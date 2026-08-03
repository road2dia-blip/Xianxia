/* ============================================================================
 * EVERDAO — COMBAT (the single auto-battler)
 *
 * Every fight in the game routes through here: hunts, spire, tide, duel,
 * tribulation, era gauntlet, sect clash and the dev autoplay sim.
 *
 * Combat.simulate(allies, foes, opts) is PURE. It deep-clones its inputs, never
 * touches S, never touches the DOM, and uses U.rngFrom(opts.seed) when a seed is
 * given (Math.random otherwise). Combat.play() is the only part that renders.
 *
 * ---------------------------------------------------------------------------
 * FORMULAS
 * ---------------------------------------------------------------------------
 *   turn order      all ALIVE units each round, descending effective SPD;
 *                   ties -> ally side first, then insertion index (stable).
 *
 *   hit roll        hitChance = clamp(atk.hit - tgt.dodge, hitFloor, hitCeil)
 *                             = clamp(h - d, 0.30, 1.00)
 *                   rolled FIRST; a miss deals nothing.
 *
 *   damage          dmg = ATK * mult * K / (K + DEF),  K = CONFIG.combat.defConstant (200)
 *                   kind 'phys'  -> ATK = atk.patk (buffed), DEF = tgt.pdef (buffed)
 *                   kind 'magic' -> ATK = atk.matk (buffed), DEF = tgt.mdef (buffed)
 *                   then  x critDmg          on a crit (chance = atk.crit)
 *                   then  x (1 + elem)       elem in {+0.15, 0, -0.15}
 *                   then  x nextHitMult      (Blade law charge, consumed)
 *                   then  + surgeBonus       (Body Surge, drains the bank)
 *                   final = max(1, round(dmg))
 *
 *   element wheel   CONFIG.combat.elementWheel — each entry beats the NEXT one,
 *                   cyclically: blaze>wood>thunder>frost>blade>blaze.
 *                   attacker beats defender -> +15%; defender beats attacker -> -15%.
 *
 *   shields         absorb before HP and are consumed first.
 *   lifesteal       heal = lifesteal * damage dealt (shield absorption included),
 *                   capped at maxHp, reduced by the healer's healCut.
 *   thorns          reflect = thorns * damage taken, applied straight back.
 *
 *   MP              a skill costs skill.mp (default 8% of maxMp). Not enough MP
 *                   -> the unit basic-attacks instead. At the END of every round
 *                   each living unit regains CONFIG.combat.mpRegenPct * maxMp.
 *
 *   status (end of round, in this order: bleed, burn, buff decay, mp regen)
 *     bleed         stacks (max CONFIG.combat.bleedMaxStacks) x
 *                   CONFIG.combat.bleedPctMaxHp * target maxHp, 3 rounds, refreshed
 *     burn / poison pct * caster ATK per round for CONFIG.combat.burnRounds
 *     stun          consumes the unit's NEXT action
 *     buffs         {k,v,r}: atk/patk/matk/def/pdef/mdef/spd/healCut, r rounds
 *
 *   PATH SKILLS (driven by unit fields — never by the player's name)
 *     body   Mountain Fist   cd from CONFIG.paths.body.skillCd (3), one target,
 *                            phys, mult 2.6. Passive: lifesteal floored at 8%.
 *                            Blood Surge (unit.surge, realm >= 7): at the start of
 *                            its turn, if it holds NO shield and mp >= 30% maxMp,
 *                            it burns that MP into a damage bank of the same size.
 *                            While the bank holds, every hit deals +50%, and the
 *                            bonus damage granted is subtracted from the bank.
 *                            A shield present => Surge does not activate.
 *     spell  Starfall        cd 2, magic, hits ALL foes.
 *                            Passive Ward: at battle start shield = wardMult * matk.
 *     sword  Thousand Cuts   cd 3, 3 fast phys hits, each 20% to apply Bleed.
 *                            Passive: 15% chance ANY attack strikes twice.
 *     ghost  Hungry Ghost Wail + a Thrall ally at 40% of the player's stats with
 *                            its own HP pool; it taunts 30% of incoming hits
 *                            (redirect rolled BEFORE target selection) and is
 *                            respawned at the start of every battle.
 *
 *   LAW PROC        opts.lawProc = {law, power} (a bare number is read as power,
 *                   with the law taken from the player's element). Fires on round
 *                   CONFIG.law.procRound (4) and every 4th round after, applying
 *                   CONFIG.law.effects[law] scaled by (1 + power):
 *                     blaze   burn all foes    burnAtkPct * ATK for `rounds`
 *                     frost   -spdDebuff SPD on all foes for `rounds`
 *                     thunder stunChance to stun each foe
 *                     wood    heal all allies healPctMaxHp * maxHp
 *                     blade   the player's next hit is multiplied by nextHitMult
 *
 *   MONSTER SKILLS  all 12 of DATA.monsterSkills, read straight off skill.effect:
 *                   heavyBlow/stunBite (stun), poisonSpit (dot), howl (atkDown,
 *                   all), harden (defUp self + swing), drain (heal by fraction of
 *                   damage), frenzy (stacking atkUp self + swing), split (one-off
 *                   half-strength copy), heal (mend the lowest ally), web (spdDown,
 *                   all), curse (healCut), enrage (below enrageBelow HP, +atkUp
 *                   once — checked passively at the start of every round).
 *
 *   SPIRE MODIFIERS opts.modifiers, applied to the FOE side:
 *                   doubleSpd, thorns, undying1 (survive the first lethal hit at
 *                   1 HP, once), split50 (at 50% HP spawn one half-stat copy, foe
 *                   count capped at 3), healAllies (end of round), enrage.
 *
 *   BOONS / PILLS   opts.wardPill  -> +25% pdef & mdef for the fight
 *                   opts.furyPill  -> +25% patk & matk for the fight
 *                   opts.boons     -> [{key,val}] on the ALLY side:
 *                     atk (+% patk/matk), spd (+% spd), lifesteal (+flat),
 *                     thorns (+flat), shield (+val * maxHp), heal (val * maxHp now)
 *
 *   VICTORY         one side fully dead ends it. Allies wiped => loss even if the
 *                   last foe died in the same exchange. At the round cap the side
 *                   with the higher remaining HP% wins; an exact tie goes to the
 *                   allies. HP% is measured over non-thrall units when any exist.
 *
 *   LOG             {r,t,src,tgt,val,text}; the returned log keeps the FIRST 10
 *                   and the LAST 50 entries with one elision marker between them
 *                   (CONFIG.combat.logCap), so the opening and the finish are both
 *                   visible. The engine's internal log is uncapped and, when
 *                   opts.trace is set, carries a per-entry HP/MP/shield snapshot
 *                   that Combat.play() replays.
 *
 *   makeFoe         enemyPower(stage) = CONFIG.wilds.enemyPower.base * growth^stage
 *                                     = 55 * 1.16^stage
 *                   A role template ('bruiser'|'caster'|'swift') shapes the stat
 *                   vector; the whole vector is then scaled by k = power / BR(shape)
 *                   so BR(unit) == power exactly (BR is linear in the stats).
 *                   Power is jittered by +/- CONFIG.wilds.powerVariance (10%).
 *
 * ---------------------------------------------------------------------------
 * MERIDIAN PILL (Combat.play only)
 * ---------------------------------------------------------------------------
 * The pill must change a fight that is already running. The approach taken is
 * "pre-declared rounds + deterministic re-simulation":
 *   - play() always simulates with a seed (one is minted if the caller gave none),
 *     so a re-run reproduces the fight exactly.
 *   - Tapping the pill appends round (currentRound + 1) to opts.meridianRounds and
 *     re-runs the whole battle from scratch with the same seed.
 *   - The MP restore happens at the START of that round and consumes no RNG, so
 *     every log entry from an earlier round is byte-identical. Playback therefore
 *     continues from the very same log index with no visible seam; only the future
 *     differs. Max CONFIG.alchemy.meridianMaxPerBattle (2) per battle, restoring
 *     CONFIG.alchemy.meridianMpRestore (40%) of max MP each.
 * ==========================================================================*/

const Combat = {

  /* ------------------------------------------------------------- constants */
  SKILL_MP_PCT: 0.08,        // default skill cost when skill.mp is absent
  BLEED_ROUNDS: 3,           // bleed duration, refreshed on every application
  MOD_THORNS: 0.20,          // spire 'thorns' modifier
  MOD_HEAL_PCT: 0.06,        // spire 'healAllies' modifier, per round
  MOD_ENRAGE_BELOW: 0.30,    // spire 'enrage' modifier threshold
  MOD_ENRAGE_ATK: 0.60,      // spire 'enrage' modifier attack gain
  MAX_FOES: 3,               // hard cap on the foe side (splits included)
  BLOG_LINES: 40,            // battle-log lines kept in the DOM during playback

  /* Role templates. Values are relative weights on CONFIG.baseStats; the whole
     vector is renormalised to the requested power afterwards. */
  ROLES: {
    bruiser: { hp: 1.55, patk: 1.30, matk: 0.40, pdef: 1.35, mdef: 0.80, spd: 0.80,
               crit: 0.00, dodge: 0.00 },
    caster:  { hp: 0.70, patk: 0.45, matk: 1.50, pdef: 0.75, mdef: 1.40, spd: 1.00,
               crit: 0.03, dodge: 0.00 },
    swift:   { hp: 0.85, patk: 1.05, matk: 0.85, pdef: 0.90, mdef: 0.90, spd: 1.65,
               crit: 0.10, dodge: 0.06 },
  },

  ELEM_NAMES: { blaze: 'Blaze', wood: 'Wood', thunder: 'Thunder', frost: 'Frost', blade: 'Blade' },

  /* Live playback state for Combat.play(). Only one arena can be open at once. */
  _pl: null,

  /* Nothing to wire — Combat is a service, not a panel. */
  init() { this._pl = null; },

  /* =========================================================================
   * SMALL HELPERS
   * ======================================================================= */

  _num(v, d) {
    const x = Number(v);
    return Number.isFinite(x) ? x : d;
  },

  _clone(o) {
    try {
      if (typeof U !== 'undefined' && U && typeof U.deepClone === 'function') return U.deepClone(o);
    } catch (e) { /* fall through */ }
    try { return JSON.parse(JSON.stringify(o)); } catch (e) { return null; }
  },

  _clamp(v, lo, hi) {
    let x = Number(v);
    if (!Number.isFinite(x)) x = lo;
    if (x < lo) x = lo;
    if (x > hi) x = hi;
    return x;
  },

  _fmt(v) {
    try {
      if (typeof Fmt !== 'undefined' && Fmt && typeof Fmt.n === 'function') return Fmt.n(v);
    } catch (e) { /* fall through */ }
    const x = Number(v);
    return Number.isFinite(x) ? String(Math.round(x)) : '0';
  },

  _elemName(e) {
    if (!e) return '';
    return this.ELEM_NAMES[e] || (String(e).charAt(0).toUpperCase() + String(e).slice(1));
  },

  /* Element wheel: each entry beats the NEXT one, cyclically. */
  _elementMod(a, b) {
    if (!a || !b || a === b) return 0;
    const wheel = (CONFIG.combat && CONFIG.combat.elementWheel) || [];
    const n = wheel.length;
    if (n < 2) return 0;
    const ia = wheel.indexOf(a);
    const ib = wheel.indexOf(b);
    if (ia < 0 || ib < 0) return 0;
    const adv = this._num(CONFIG.combat.elementAdvantage, 0.15);
    if (wheel[(ia + 1) % n] === b) return adv;
    if (wheel[(ib + 1) % n] === a) return -adv;
    return 0;
  },

  /* The clause appended to a damage line so the wheel is visible in the log. */
  _elemNote(mod, a, b) {
    if (!mod) return '';
    const A = this._elemName(a);
    const B = this._elemName(b);
    if (mod > 0) return ' · ' + A + ' overcomes ' + B + ' (+' + Math.round(mod * 100) + '%)';
    return ' · ' + B + ' smothers ' + A + ' (' + Math.round(mod * 100) + '%)';
  },

  /* =========================================================================
   * UNIT PREPARATION
   * ======================================================================= */

  _prepSkill(u, raw) {
    const s = (raw && typeof raw === 'object') ? raw : null;
    if (!s) { u.skill = null; return; }
    const kind = (s.kind === 'magic') ? 'magic' : 'phys';
    let target = 'one';
    if (s.target === 'all' || s.target === 'self' || s.target === 'ally') target = s.target;
    const sk = {
      id: String(s.id || 'skill'),
      name: String(s.name || 'Technique'),
      cd: Math.max(1, Math.round(this._num(s.cd, 3))),
      mult: Math.max(0, this._num(s.mult, 1)),
      kind: kind,
      target: target,
      hits: Math.max(1, Math.round(this._num(s.hits, 1))),
      bleedChance: this._clamp(this._num(s.bleedChance, 0), 0, 1),
      effect: (s.effect && typeof s.effect === 'object') ? s.effect : null,
      mp: 0,
    };
    const cost = this._num(s.mp, NaN);
    sk.mp = Number.isFinite(cost) ? Math.max(0, Math.round(cost))
                                  : Math.round(u.maxMp * this.SKILL_MP_PCT);
    u.skill = sk;
  },

  /* Deep-clone one incoming unit and normalise every field the engine reads. */
  _prepUnit(raw, side, uid) {
    const cc = CONFIG.combat || {};
    let u = this._clone(raw);
    if (!u || typeof u !== 'object') u = {};

    u.name = String(u.name || (side === 'ally' ? 'Cultivator' : 'Beast'));
    u.emoji = String(u.emoji || (side === 'ally' ? '\u{1F9D8}' : '\u{1F43E}'));
    u.side = side;
    u.uid = uid;
    u.element = (typeof u.element === 'string' && u.element) ? u.element : null;
    u.path = (typeof u.path === 'string' && u.path) ? u.path : null;
    u.isPlayer = !!u.isPlayer;
    u.isThrall = !!u.isThrall;

    u.maxHp = Math.max(1, Math.round(this._num(u.maxHp, this._num(u.hp, 1))));
    let hp = this._num(u.hp, NaN);
    if (!Number.isFinite(hp) || hp <= 0) hp = u.maxHp;
    u.hp = Math.min(u.maxHp, Math.max(1, Math.round(hp)));

    u.maxMp = Math.max(0, Math.round(this._num(u.maxMp, this._num(u.mp, 0))));
    u.mp = this._clamp(Math.round(this._num(u.mp, u.maxMp)), 0, u.maxMp);

    u.patk = Math.max(0, this._num(u.patk, 1));
    u.matk = Math.max(0, this._num(u.matk, 1));
    u.pdef = Math.max(0, this._num(u.pdef, 0));
    u.mdef = Math.max(0, this._num(u.mdef, 0));
    u.spd = Math.max(1, this._num(u.spd, 10));

    u.crit = this._clamp(this._num(u.crit, this._num(cc.baseCrit, 0.05)), 0, 1);
    u.critDmg = Math.max(1, this._num(u.critDmg, this._num(cc.baseCritDmg, 1.5)));
    u.hit = this._clamp(this._num(u.hit, this._num(cc.baseHit, 0.95)), 0, 2);
    u.dodge = this._clamp(this._num(u.dodge, this._num(cc.baseDodge, 0)), 0, 0.9);
    u.lifesteal = this._clamp(this._num(u.lifesteal, 0), 0, 1);

    this._prepSkill(u, u.skill);

    /* ---- runtime fields owned by the engine ---- */
    u.shield = 0;
    u.buffs = [];
    u.cdLeft = u.skill ? Math.max(0, u.skill.cd - 1) : 0;
    u.bleed = 0; u.bleedT = 0;
    u.burn = 0; u.burnT = 0;
    u.stun = 0;
    u.alive = u.hp > 0;
    u.thorns = Math.max(0, this._num(u.thorns, 0));
    u.taunt = this._clamp(this._num(u.taunt, 0), 0, 1);
    u.doubleChance = this._clamp(this._num(u.doubleChance, 0), 0, 1);
    u.nextHit = 0;
    u.surgeBank = 0;
    u.surgeOn = false;
    u.undying = false;
    u.undyingUsed = false;
    u.split50 = false;
    u.splitDone = false;
    u.enraged = false;
    u.dmgDealt = 0;
    u.dmgTaken = 0;
    return u;
  },

  /* Path passives that live on the unit fields, applied once per battle.
     Written as FLOORS so a unit that already carries the bonus (Stats.unit
     folds path lifesteal into its block) is never double-counted. */
  _pathPassives(u) {
    const paths = CONFIG.paths || {};
    if (u.path === 'body') {
      const ls = this._num((paths.body || {}).lifesteal, 0);
      if (ls > u.lifesteal) u.lifesteal = this._clamp(ls, 0, 1);
    }
    if (u.path === 'sword') {
      const dc = this._num((paths.sword || {}).doubleChance, 0);
      if (dc > u.doubleChance) u.doubleChance = this._clamp(dc, 0, 1);
      if (u.skill && !(u.skill.bleedChance > 0)) {
        u.skill.bleedChance = this._clamp(this._num((paths.sword || {}).bleedChance, 0), 0, 1);
      }
    }
    if (u.isThrall) {
      const t = this._num((paths.ghost || {}).thrallTaunt, 0.3);
      if (!(u.taunt > 0)) u.taunt = this._clamp(t, 0, 1);
    }
  },

  /* Spell path Ward: shield = wardMult * matk at the opening bell. */
  _applyWard(ctx, u) {
    if (u.path !== 'spell') return;
    const paths = CONFIG.paths || {};
    const mult = Math.max(0, this._num(u.wardMult, this._num((paths.spell || {}).wardMult, 2)));
    if (mult <= 0) return;
    const bonus = Math.max(0, this._num(u.shieldPct, 0));
    const val = Math.round(u.matk * mult * (1 + bonus));
    if (val <= 0) return;
    u.shield += val;
    this._log(ctx, 'skill', u, u, val, u.name + ' raises a Ward — ' + this._fmt(val) + ' shield.');
  },

  /* opts.wardPill / opts.furyPill — flat +25% for the whole fight. */
  _applyPills(u, opts) {
    const al = CONFIG.alchemy || {};
    if (opts.wardPill) {
      const b = 1 + this._num(al.wardDefBonus, 0.25);
      u.pdef *= b; u.mdef *= b;
    }
    if (opts.furyPill) {
      const b = 1 + this._num(al.furyAtkBonus, 0.25);
      u.patk *= b; u.matk *= b;
    }
  },

  /* opts.boons — [{key,val}] handed to the ally side by the Tide. */
  _applyBoons(ctx, u, boons) {
    if (!Array.isArray(boons)) return;
    for (let i = 0; i < boons.length; i++) {
      const b = boons[i];
      if (!b || typeof b !== 'object') continue;
      const key = String(b.key || '');
      const val = this._num(b.val, 0);
      if (!key || !(val !== 0)) continue;
      if (key === 'atk') { u.patk *= (1 + val); u.matk *= (1 + val); }
      else if (key === 'spd') { u.spd *= (1 + val); }
      else if (key === 'lifesteal') { u.lifesteal = this._clamp(u.lifesteal + val, 0, 1); }
      else if (key === 'thorns') { u.thorns = Math.max(0, u.thorns + val); }
      else if (key === 'shield') { u.shield += Math.round(u.maxHp * val); }
      else if (key === 'heal') { u.hp = Math.min(u.maxHp, u.hp + Math.round(u.maxHp * val)); }
      else if (key === 'hp') { const add = Math.round(u.maxHp * val); u.maxHp += add; u.hp += add; }
    }
  },

  /* opts.modifiers — spire boss rules, foe side only. */
  _applyModifiers(ctx, u, mods) {
    if (!Array.isArray(mods)) return;
    for (let i = 0; i < mods.length; i++) {
      const m = String(mods[i] || '');
      if (m === 'doubleSpd') u.spd *= 2;
      else if (m === 'thorns') u.thorns = Math.max(u.thorns, this.MOD_THORNS);
      else if (m === 'undying1') u.undying = true;
      else if (m === 'split50') u.split50 = true;
      else if (m === 'healAllies') ctx.foeHealAllies = true;
      else if (m === 'enrage') u.modEnrage = true;
    }
  },

  /* The Ghost path thrall. Rebuilt from the player's own block every battle. */
  _spawnThrall(ctx, owner) {
    if (owner.path !== 'ghost') return;
    for (let i = 0; i < ctx.allies.length; i++) if (ctx.allies[i].isThrall) return;
    const paths = CONFIG.paths || {};
    const s = this._num(owner.thrallScale, this._num((paths.ghost || {}).thrallScale, 0.4));
    if (!(s > 0)) return;
    const taunt = this._clamp(this._num(owner.thrallTaunt, this._num((paths.ghost || {}).thrallTaunt, 0.3)), 0, 1);
    const sc = (v) => Math.max(1, Math.round(v * s));
    const t = this._prepUnit({
      name: owner.name + '’s Shade',
      emoji: '\u{1F480}',
      element: owner.element,
      path: 'ghost',
      hp: sc(owner.maxHp), maxHp: sc(owner.maxHp),
      mp: 0, maxMp: 0,
      patk: sc(owner.patk), matk: sc(owner.matk),
      pdef: sc(owner.pdef), mdef: sc(owner.mdef),
      spd: Math.max(1, Math.round(owner.spd)),
      crit: owner.crit, critDmg: owner.critDmg, hit: owner.hit, dodge: owner.dodge,
      lifesteal: 0,
      skill: null,
      isThrall: true,
      taunt: taunt,
    }, 'ally', 'a' + ctx.allies.length);
    t.taunt = taunt;
    ctx.allies.push(t);
    ctx.all.push(t);
    this._log(ctx, 'info', owner, t, 0, owner.name + ' calls up a shade to stand in the way.');
  },

  /* =========================================================================
   * EFFECTIVE STATS
   * ======================================================================= */

  _mod(u, key) {
    let t = 0;
    const b = u.buffs;
    for (let i = 0; i < b.length; i++) if (b[i].k === key) t += b[i].v;
    return t;
  },

  _atk(u, kind) {
    const base = (kind === 'magic') ? u.matk : u.patk;
    const m = 1 + this._mod(u, 'atk') + this._mod(u, kind === 'magic' ? 'matk' : 'patk');
    return Math.max(0, base * Math.max(0.05, m));
  },

  _def(u, kind) {
    const base = (kind === 'magic') ? u.mdef : u.pdef;
    const m = 1 + this._mod(u, 'def') + this._mod(u, kind === 'magic' ? 'mdef' : 'pdef');
    return Math.max(0, base * Math.max(0.05, m));
  },

  _spd(u) {
    return Math.max(1, u.spd * Math.max(0.1, 1 + this._mod(u, 'spd')));
  },

  _healCut(u) {
    return this._clamp(this._mod(u, 'healCut'), 0, 0.9);
  },

  _addBuff(u, k, v, rounds, tag, stacking) {
    if (!stacking && tag) {
      for (let i = u.buffs.length - 1; i >= 0; i--) if (u.buffs[i].tag === tag) u.buffs.splice(i, 1);
    }
    u.buffs.push({ k: k, v: v, r: Math.max(1, Math.round(rounds || 1)), tag: tag || '' });
    if (u.buffs.length > 24) u.buffs.shift();
  },

  /* =========================================================================
   * LOGGING
   * ======================================================================= */

  _snapshot(ctx) {
    const out = [];
    for (let i = 0; i < ctx.all.length; i++) {
      const u = ctx.all[i];
      out.push({ h: Math.round(u.hp), s: Math.round(u.shield), m: Math.round(u.mp), a: u.alive ? 1 : 0 });
    }
    return out;
  },

  _log(ctx, t, src, tgt, val, text) {
    const e = {
      r: ctx.round,
      t: t,
      src: src ? src.name : '',
      tgt: tgt ? tgt.name : '',
      val: Math.round(this._num(val, 0)),
      text: String(text || ''),
      sref: src ? src.uid : '',
      tref: tgt ? tgt.uid : '',
    };
    if (ctx.trace) e.st = this._snapshot(ctx);
    ctx.log.push(e);
  },

  /* First 10 + elision marker + last 50, and stripped down to the contract
     shape so nothing leaks the engine's internal bookkeeping. */
  _capLog(log) {
    const cap = Math.max(4, Math.round(this._num(CONFIG.combat && CONFIG.combat.logCap, 60)));
    const clean = (e) => ({ r: e.r, t: e.t, src: e.src, tgt: e.tgt, val: e.val, text: e.text });
    if (!Array.isArray(log)) return [];
    if (log.length <= cap) return log.map(clean);
    const head = Math.min(10, Math.floor(cap / 2));
    const tail = Math.max(1, cap - head);
    const out = [];
    for (let i = 0; i < head; i++) out.push(clean(log[i]));
    const skipped = log.length - head - tail;
    if (skipped > 0) {
      out.push({
        r: log[head].r, t: 'info', src: '', tgt: '', val: skipped,
        text: '… ' + skipped + ' exchanges pass unrecorded …',
      });
    }
    for (let i = log.length - tail; i < log.length; i++) out.push(clean(log[i]));
    return out;
  },

  /* =========================================================================
   * DAMAGE / HEALING
   * ======================================================================= */

  /* Push damage through shield -> HP, handling undying, split50 and death. */
  _applyDamage(ctx, src, tgt, dmg) {
    if (!tgt.alive || dmg <= 0) return 0;
    let rem = dmg;
    if (tgt.shield > 0) {
      const absorbed = Math.min(tgt.shield, rem);
      tgt.shield -= absorbed;
      rem -= absorbed;
      if (tgt.shield <= 0) tgt.shield = 0;
    }
    if (rem > 0) tgt.hp -= rem;
    tgt.dmgTaken += dmg;

    if (tgt.hp <= 0) {
      if (tgt.undying && !tgt.undyingUsed) {
        tgt.undyingUsed = true;
        tgt.hp = 1;
        this._log(ctx, 'info', tgt, tgt, 1, tgt.name + ' refuses the grave and stands at a single breath.');
      } else {
        tgt.hp = 0;
        tgt.alive = false;
        this._log(ctx, 'die', src || tgt, tgt, 0, tgt.name + ' falls.');
      }
    }
    if (tgt.alive && tgt.split50 && !tgt.splitDone && (tgt.hp / tgt.maxHp) <= 0.5) {
      tgt.splitDone = true;
      this._spawnCopy(ctx, tgt, 0.5, 'Fragment');
    }
    return dmg;
  },

  _heal(ctx, u, amount, text, srcU) {
    if (!u.alive) return 0;
    let amt = amount * (1 - this._healCut(u));
    amt = Math.max(0, Math.round(amt));
    if (amt <= 0) return 0;
    const before = u.hp;
    u.hp = Math.min(u.maxHp, u.hp + amt);
    const got = u.hp - before;
    if (got > 0 && text) this._log(ctx, 'heal', srcU || u, u, got, text.replace('{n}', this._fmt(got)));
    return got;
  },

  /* One attack, including the sword path's chance to strike twice. */
  _attack(ctx, atk, tgt, kind, mult, label) {
    if (!atk.alive || !tgt || !tgt.alive) return 0;
    let total = this._strike(ctx, atk, tgt, kind, mult, label);
    if (atk.doubleChance > 0 && tgt.alive && atk.alive && ctx.rng() < atk.doubleChance) {
      this._log(ctx, 'info', atk, tgt, 0, atk.name + ' flows straight into a second cut.');
      total += this._strike(ctx, atk, tgt, kind, mult, label);
    }
    return total;
  },

  /* The core exchange. Hit roll first, then damage, crit, element, surge. */
  _strike(ctx, atk, tgt, kind, mult, label) {
    if (!atk.alive || !tgt.alive) return 0;
    const cc = CONFIG.combat || {};
    const floorH = this._num(cc.hitFloor, 0.30);
    const ceilH = this._num(cc.hitCeil, 1);
    const chance = this._clamp(atk.hit - tgt.dodge, floorH, ceilH);
    const tag = label ? (' [' + label + ']') : '';

    if (ctx.rng() >= chance) {
      this._log(ctx, 'miss', atk, tgt, 0, atk.name + ' strikes at ' + tgt.name + ' and finds only air.' + tag);
      return 0;
    }

    const K = Math.max(1, this._num(cc.defConstant, 200));
    const a = this._atk(atk, kind);
    const d = this._def(tgt, kind);
    let dmg = a * mult * K / (K + d);

    const isCrit = ctx.rng() < atk.crit;
    if (isCrit) dmg *= atk.critDmg;

    const em = this._elementMod(atk.element, tgt.element);
    if (em) dmg *= (1 + em);

    let blade = false;
    if (atk.nextHit > 1) { dmg *= atk.nextHit; atk.nextHit = 0; blade = true; }

    let surged = false;
    if (atk.surgeBank > 0) {
      const bonusPct = Math.max(0, this._num(atk.surgeDmgBonus, this._num((CONFIG.paths || {}).body && CONFIG.paths.body.surgeDmgBonus, 0.5)));
      const bonus = dmg * bonusPct;
      dmg += bonus;
      atk.surgeBank -= bonus;
      surged = true;
      if (atk.surgeBank <= 0) {
        atk.surgeBank = 0;
        atk.surgeOn = false;
      }
    }

    const final = Math.max(1, Math.round(dmg));
    const dealt = this._applyDamage(ctx, atk, tgt, final);
    atk.dmgDealt += dealt;

    let text = atk.name + (isCrit ? ' lands a perfect blow on ' : ' hits ') + tgt.name +
               ' for ' + this._fmt(final) + tag;
    text += this._elemNote(em, atk.element, tgt.element);
    if (blade) text += ' · the Blade charge discharges';
    if (surged) text += ' · Blood Surge';
    this._log(ctx, isCrit ? 'crit' : 'hit', atk, tgt, final, text + '.');

    /* thorns reflect straight back, without re-triggering thorns */
    if (tgt.thorns > 0 && atk.alive && dealt > 0) {
      const back = Math.max(1, Math.round(dealt * tgt.thorns));
      this._applyDamage(ctx, tgt, atk, back);
      this._log(ctx, 'dot', tgt, atk, back, tgt.name + '’s brambles bite back for ' + this._fmt(back) + '.');
    }

    /* lifesteal on damage dealt, capped at maxHp */
    if (atk.lifesteal > 0 && dealt > 0 && atk.alive) {
      this._heal(ctx, atk, dealt * atk.lifesteal,
        atk.name + ' drinks {n} back from the wound.', atk);
    }
    return dealt;
  },

  /* =========================================================================
   * TARGETING
   * ======================================================================= */

  _living(list) {
    const out = [];
    for (let i = 0; i < list.length; i++) if (list[i].alive) out.push(list[i]);
    return out;
  },

  /* Foes pick at random (after the thrall taunt redirect); allies focus fire on
     the softest remaining target so the auto-battler plays sensibly. */
  _pickTarget(ctx, u) {
    const enemies = this._living(u.side === 'ally' ? ctx.foes : ctx.allies);
    if (!enemies.length) return null;

    if (u.side === 'foe') {
      let thrall = null;
      for (let i = 0; i < ctx.allies.length; i++) {
        const a = ctx.allies[i];
        if (a.alive && a.isThrall && a.taunt > 0) { thrall = a; break; }
      }
      if (thrall && ctx.rng() < thrall.taunt) return thrall;
      return enemies[Math.floor(ctx.rng() * enemies.length)] || enemies[0];
    }

    let best = enemies[0];
    for (let i = 1; i < enemies.length; i++) {
      if ((enemies[i].hp + enemies[i].shield) < (best.hp + best.shield)) best = enemies[i];
    }
    return best;
  },

  /* Lowest-HP friendly unit (used by the monster 'heal' skill). */
  _pickWounded(ctx, u) {
    const friends = this._living(u.side === 'ally' ? ctx.allies : ctx.foes);
    if (!friends.length) return null;
    let best = friends[0];
    for (let i = 1; i < friends.length; i++) {
      if ((friends[i].hp / friends[i].maxHp) < (best.hp / best.maxHp)) best = friends[i];
    }
    return best;
  },

  /* =========================================================================
   * SPAWNS
   * ======================================================================= */

  _spawnCopy(ctx, parent, frac, suffix) {
    if (ctx.foes.length >= this.MAX_FOES) {
      this._log(ctx, 'info', parent, parent, 0, parent.name + ' tries to divide, but there is no room left in the ring.');
      return null;
    }
    const raw = {
      name: parent.name + ' ' + suffix,
      emoji: parent.emoji,
      element: parent.element,
      path: null,
      hp: Math.max(1, Math.round(parent.maxHp * frac)),
      maxHp: Math.max(1, Math.round(parent.maxHp * frac)),
      mp: Math.round(parent.maxMp * frac), maxMp: Math.round(parent.maxMp * frac),
      patk: Math.max(1, Math.round(parent.patk * frac)),
      matk: Math.max(1, Math.round(parent.matk * frac)),
      pdef: Math.max(0, Math.round(parent.pdef * frac)),
      mdef: Math.max(0, Math.round(parent.mdef * frac)),
      spd: Math.max(1, Math.round(parent.spd)),
      crit: parent.crit, critDmg: parent.critDmg, hit: parent.hit, dodge: parent.dodge,
      lifesteal: parent.lifesteal,
      skill: parent.skill ? {
        id: parent.skill.id, name: parent.skill.name, cd: parent.skill.cd,
        mult: parent.skill.mult, kind: parent.skill.kind, target: parent.skill.target,
        effect: parent.skill.effect,
      } : null,
    };
    const copy = this._prepUnit(raw, 'foe', 'f' + ctx.foes.length + 'x' + ctx.spawnSeq);
    ctx.spawnSeq++;
    copy.thorns = parent.thorns;
    copy.splitDone = true;      // copies never split again
    copy.split50 = false;
    if (copy.skill && copy.skill.effect && copy.skill.effect.split) {
      copy.skill = Object.assign({}, copy.skill, { effect: Object.assign({}, copy.skill.effect, { split: false }) });
    }
    ctx.foes.push(copy);
    ctx.all.push(copy);
    this._log(ctx, 'skill', parent, copy, 0, parent.name + ' splits — ' + copy.name + ' claws its way free.');
    return copy;
  },

  /* =========================================================================
   * SKILLS
   * ======================================================================= */

  /* Body path Blood Surge: burns MP into a damage bank. Never with a shield up. */
  _trySurge(ctx, u) {
    if (!u.surge || u.surgeBank > 0) return;
    if (u.shield > 0) return;                       // cannot coexist with a shield
    const paths = CONFIG.paths || {};
    const pct = this._clamp(this._num(u.surgeMpPct, this._num((paths.body || {}).surgeMpPct, 0.3)), 0, 1);
    if (pct <= 0 || u.maxMp <= 0) return;
    const cost = Math.round(u.maxMp * pct);
    if (cost <= 0 || u.mp < cost) return;
    u.mp -= cost;
    u.surgeBank = cost;
    u.surgeOn = true;
    const bonus = Math.round(this._num(u.surgeDmgBonus, this._num((paths.body || {}).surgeDmgBonus, 0.5)) * 100);
    this._log(ctx, 'skill', u, u, cost, u.name + ' burns ' + this._fmt(cost) + ' Qi into Blood Surge (+' + bonus + '% damage).');
  },

  /* On-hit rider effects shared by every skill that carries one. */
  _onHit(ctx, u, tgt, sk, dealt) {
    const eff = sk.effect;
    if (dealt > 0 && sk.bleedChance > 0 && tgt.alive && ctx.rng() < sk.bleedChance) {
      const maxStacks = Math.max(1, Math.round(this._num((CONFIG.combat || {}).bleedMaxStacks, 3)));
      tgt.bleed = Math.min(maxStacks, tgt.bleed + 1);
      tgt.bleedT = this.BLEED_ROUNDS;
      this._log(ctx, 'dot', u, tgt, tgt.bleed, tgt.name + ' is bleeding (' + tgt.bleed + ' stack' + (tgt.bleed > 1 ? 's' : '') + ').');
    }
    if (!eff) return;

    if (eff.stun > 0 && tgt.alive && ctx.rng() < eff.stun) {
      tgt.stun += 1;
      this._log(ctx, 'info', u, tgt, 0, tgt.name + ' is rattled senseless and will lose the next move.');
    }
    if (eff.dot && eff.pct > 0 && tgt.alive) {
      const per = Math.max(1, Math.round(this._atk(u, sk.kind) * eff.pct));
      const rounds = Math.max(1, Math.round(this._num(eff.rounds, this._num((CONFIG.combat || {}).burnRounds, 3))));
      tgt.burn = Math.max(tgt.burn, per);
      tgt.burnT = Math.max(tgt.burnT, rounds);
      this._log(ctx, 'dot', u, tgt, per, tgt.name + ' is poisoned — ' + this._fmt(per) + ' a round for ' + rounds + '.');
    }
    if (eff.atkDown > 0 && tgt.alive) {
      const rounds = Math.max(1, Math.round(this._num(eff.rounds, 2)));
      this._addBuff(tgt, 'atk', -Math.abs(eff.atkDown), rounds, 'atkDown', false);
      this._log(ctx, 'info', u, tgt, 0, tgt.name + '’s strength drains away (-' + Math.round(eff.atkDown * 100) + '% ATK).');
    }
    if (eff.spdDown > 0 && tgt.alive) {
      const rounds = Math.max(1, Math.round(this._num(eff.rounds, 2)));
      this._addBuff(tgt, 'spd', -Math.abs(eff.spdDown), rounds, 'spdDown', false);
      this._log(ctx, 'info', u, tgt, 0, tgt.name + ' is snared (-' + Math.round(eff.spdDown * 100) + '% SPD).');
    }
    if (eff.healCut > 0 && tgt.alive) {
      const rounds = Math.max(1, Math.round(this._num(eff.rounds, 3)));
      this._addBuff(tgt, 'healCut', Math.abs(eff.healCut), rounds, 'healCut', false);
      this._log(ctx, 'info', u, tgt, 0, tgt.name + ' is cursed — healing cut by ' + Math.round(eff.healCut * 100) + '%.');
    }
    if (eff.drain > 0 && dealt > 0) {
      this._heal(ctx, u, dealt * eff.drain, u.name + ' siphons {n} from the wound.', u);
    }
    if (eff.split && !u.splitDone) {
      u.splitDone = true;
      this._spawnCopy(ctx, u, 0.5, 'Spawn');
    }
  },

  _castSkill(ctx, u, sk) {
    const eff = sk.effect || {};
    this._log(ctx, 'skill', u, null, 0, u.name + ' unleashes ' + sk.name + '!');

    /* --- self-buff skills: apply the buff, then swing anyway --- */
    if (sk.target === 'self') {
      if (eff.defUp > 0) {
        const rounds = Math.max(1, Math.round(this._num(eff.rounds, 3)));
        this._addBuff(u, 'def', Math.abs(eff.defUp), rounds, 'defUp', false);
        this._log(ctx, 'info', u, u, 0, u.name + '’s hide hardens (+' + Math.round(eff.defUp * 100) + '% DEF).');
      }
      if (eff.atkUp > 0 && !eff.enrageBelow) {
        const rounds = eff.stacking ? 99 : Math.max(1, Math.round(this._num(eff.rounds, 3)));
        this._addBuff(u, 'atk', Math.abs(eff.atkUp), rounds, 'atkUp', !!eff.stacking);
        this._log(ctx, 'info', u, u, 0, u.name + ' works itself into a frenzy (+' + Math.round(eff.atkUp * 100) + '% ATK).');
      }
      const t = this._pickTarget(ctx, u);
      if (t) {
        const dealt = this._attack(ctx, u, t, sk.kind, sk.mult, sk.name);
        this._onHit(ctx, u, t, sk, dealt);
      }
      return;
    }

    /* --- support skills: mend the most broken friend --- */
    if (sk.target === 'ally') {
      const friend = this._pickWounded(ctx, u);
      const pct = this._num(eff.healPct, 0.25);
      if (friend && friend.hp < friend.maxHp && pct > 0) {
        this._heal(ctx, friend, friend.maxHp * pct,
          u.name + ' mends ' + friend.name + ' for {n}.', u);
        return;
      }
      const t = this._pickTarget(ctx, u);
      if (t) {
        const dealt = this._attack(ctx, u, t, sk.kind, sk.mult, sk.name);
        this._onHit(ctx, u, t, sk, dealt);
      }
      return;
    }

    /* --- everything hostile --- */
    if (sk.target === 'all') {
      const targets = this._living(u.side === 'ally' ? ctx.foes : ctx.allies);
      for (let i = 0; i < targets.length; i++) {
        if (!u.alive) break;
        const t = targets[i];
        if (!t.alive) continue;
        const dealt = this._attack(ctx, u, t, sk.kind, sk.mult, sk.name);
        this._onHit(ctx, u, t, sk, dealt);
      }
      return;
    }

    /* single target, possibly several fast hits (Thousand Cuts) */
    for (let h = 0; h < sk.hits; h++) {
      if (!u.alive) break;
      const t = this._pickTarget(ctx, u);
      if (!t) break;
      const dealt = this._attack(ctx, u, t, sk.kind, sk.mult, sk.hits > 1 ? (sk.name + ' ' + (h + 1) + '/' + sk.hits) : sk.name);
      this._onHit(ctx, u, t, sk, dealt);
    }
  },

  _basicAttack(ctx, u) {
    const t = this._pickTarget(ctx, u);
    if (!t) return;
    const kind = (u.matk > u.patk) ? 'magic' : 'phys';
    this._attack(ctx, u, t, kind, 1, null);
  },

  /* One unit's whole turn. */
  _act(ctx, u) {
    if (!u.alive) return;
    if (u.stun > 0) {
      u.stun -= 1;
      this._log(ctx, 'info', u, u, 0, u.name + ' is still reeling and loses the move.');
      return;
    }
    this._trySurge(ctx, u);

    const sk = u.skill;
    if (sk && u.cdLeft <= 0) {
      if (u.mp >= sk.mp) {
        u.mp -= sk.mp;
        u.cdLeft = sk.cd;
        this._castSkill(ctx, u, sk);
        return;
      }
      if (u.isPlayer) {
        this._log(ctx, 'info', u, null, 0, u.name + '’s meridians run dry — ' + sk.name + ' will not answer.');
      }
    }
    if (u.cdLeft > 0) u.cdLeft -= 1;
    this._basicAttack(ctx, u);
  },

  /* =========================================================================
   * LAW PROC
   * ======================================================================= */

  /* opts.lawProc may be {law,power}, a bare power number, or a law id string. */
  _lawInfo(opts, allies) {
    const lp = opts.lawProc;
    if (lp === undefined || lp === null || lp === false || lp === '') return null;
    let law = null;
    let power = 0;
    if (typeof lp === 'object') {
      law = (typeof lp.law === 'string' && lp.law) ? lp.law : null;
      power = this._num(lp.power, 0);
    } else if (typeof lp === 'number') {
      power = this._num(lp, 0);
    } else if (typeof lp === 'string') {
      law = lp;
    }
    if (!law) {
      let p = null;
      for (let i = 0; i < allies.length; i++) { if (allies[i].isPlayer) { p = allies[i]; break; } }
      if (!p) p = allies[0] || null;
      if (p) law = (typeof p.law === 'string' && p.law) ? p.law : p.element;
    }
    const effects = (CONFIG.law && CONFIG.law.effects) || {};
    if (!law || !effects[law]) return null;
    return { law: law, power: this._clamp(power, -0.9, 20), eff: effects[law] };
  },

  _lawProc(ctx) {
    const info = ctx.lawInfo;
    if (!info) return;
    let caster = null;
    for (let i = 0; i < ctx.allies.length; i++) {
      if (ctx.allies[i].isPlayer && ctx.allies[i].alive) { caster = ctx.allies[i]; break; }
    }
    if (!caster) {
      const live = this._living(ctx.allies);
      caster = live[0] || null;
    }
    if (!caster) return;

    const k = 1 + info.power;
    const eff = info.eff || {};
    const name = this._elemName(info.law);
    const dl = (typeof DATAX !== 'undefined' && DATAX && DATAX.lawById && DATAX.lawById[info.law]) || null;
    const label = (dl && dl.name) ? dl.name : (name + ' Law');

    if (info.law === 'blaze') {
      const per = Math.max(1, Math.round(this._atk(caster, 'magic') * this._num(eff.burnAtkPct, 0.08) * k));
      const rounds = Math.max(1, Math.round(this._num(eff.rounds, this._num((CONFIG.combat || {}).burnRounds, 3))));
      const foes = this._living(ctx.foes);
      for (let i = 0; i < foes.length; i++) {
        foes[i].burn = Math.max(foes[i].burn, per);
        foes[i].burnT = Math.max(foes[i].burnT, rounds);
      }
      this._log(ctx, 'law', caster, null, per, label + ' erupts — every foe burns for ' + this._fmt(per) + ' a round (' + rounds + ').');
      return;
    }

    if (info.law === 'frost') {
      const v = Math.abs(this._num(eff.spdDebuff, 0.3)) * k;
      const rounds = Math.max(1, Math.round(this._num(eff.rounds, 2)));
      const foes = this._living(ctx.foes);
      for (let i = 0; i < foes.length; i++) this._addBuff(foes[i], 'spd', -v, rounds, 'lawFrost', false);
      this._log(ctx, 'law', caster, null, 0, label + ' settles — the enemy slows by ' + Math.round(v * 100) + '% for ' + rounds + '.');
      return;
    }

    if (info.law === 'thunder') {
      const chance = this._clamp(this._num(eff.stunChance, 0.25) * k, 0, 1);
      const foes = this._living(ctx.foes);
      let n = 0;
      for (let i = 0; i < foes.length; i++) {
        if (ctx.rng() < chance) { foes[i].stun += 1; n++; }
      }
      this._log(ctx, 'law', caster, null, n, label + ' cracks the air — ' + (n > 0 ? (n + ' stunned.') : 'nothing is caught.'));
      return;
    }

    if (info.law === 'wood') {
      const pct = this._num(eff.healPctMaxHp, 0.12) * k;
      const live = this._living(ctx.allies);
      let total = 0;
      for (let i = 0; i < live.length; i++) total += this._heal(ctx, live[i], live[i].maxHp * pct, '', caster);
      this._log(ctx, 'law', caster, null, total, label + ' unfurls — ' + this._fmt(total) + ' HP knits shut.');
      return;
    }

    if (info.law === 'blade') {
      const m = Math.max(1, this._num(eff.nextHitMult, 2.2) * k);
      caster.nextHit = m;
      this._log(ctx, 'law', caster, null, 0, label + ' gathers — the next strike carries x' + (Math.round(m * 10) / 10) + '.');
    }
  },

  /* =========================================================================
   * ROUND STRUCTURE
   * ======================================================================= */

  /* Passive checks that run at the top of every round. */
  _passives(ctx) {
    const all = ctx.all;
    for (let i = 0; i < all.length; i++) {
      const u = all[i];
      if (!u.alive || u.enraged) continue;
      let below = 0;
      let gain = 0;
      const eff = (u.skill && u.skill.effect) || null;
      if (eff && eff.enrageBelow > 0) {
        below = this._num(eff.enrageBelow, 0.3);
        gain = this._num(eff.atkUp, 0.6);
      }
      if (u.modEnrage) {
        below = Math.max(below, this.MOD_ENRAGE_BELOW);
        gain = Math.max(gain, this.MOD_ENRAGE_ATK);
      }
      if (below > 0 && gain > 0 && (u.hp / u.maxHp) < below) {
        u.enraged = true;
        this._addBuff(u, 'atk', gain, 999, 'enrage', false);
        this._log(ctx, 'info', u, u, 0, u.name + ' is cornered and turns vicious (+' + Math.round(gain * 100) + '% ATK).');
      }
    }
  },

  _meridianRound(ctx) {
    const rounds = ctx.meridianRounds;
    if (!rounds || !rounds.length) return;
    let n = 0;
    for (let i = 0; i < rounds.length; i++) if (rounds[i] === ctx.round) n++;
    if (n <= 0) return;
    const pct = this._num((CONFIG.alchemy || {}).meridianMpRestore, 0.4);
    for (let i = 0; i < ctx.allies.length; i++) {
      const u = ctx.allies[i];
      if (!u.alive || !u.isPlayer || u.maxMp <= 0) continue;
      for (let j = 0; j < n; j++) {
        const before = u.mp;
        u.mp = Math.min(u.maxMp, u.mp + Math.round(u.maxMp * pct));
        this._log(ctx, 'info', u, u, u.mp - before, u.name + ' swallows a Meridian Pill — +' + this._fmt(u.mp - before) + ' Qi.');
      }
    }
  },

  _turnOrder(ctx) {
    const rows = [];
    for (let i = 0; i < ctx.all.length; i++) {
      const u = ctx.all[i];
      if (!u.alive) continue;
      rows.push({ u: u, s: this._spd(u), side: u.side === 'ally' ? 0 : 1, i: i });
    }
    rows.sort((a, b) => {
      if (b.s !== a.s) return b.s - a.s;
      if (a.side !== b.side) return a.side - b.side;
      return a.i - b.i;
    });
    const out = [];
    for (let i = 0; i < rows.length; i++) out.push(rows[i].u);
    return out;
  },

  /* Bleed, burn, buff decay, MP regen, the healAllies modifier. */
  _endRound(ctx) {
    const cc = CONFIG.combat || {};
    const bleedPct = this._num(cc.bleedPctMaxHp, 0.05);
    const regen = this._num(cc.mpRegenPct, 0.05);
    const all = ctx.all;

    for (let i = 0; i < all.length; i++) {
      const u = all[i];
      if (!u.alive) continue;
      if (u.bleed > 0 && u.bleedT > 0) {
        const dmg = Math.max(1, Math.round(u.maxHp * bleedPct * u.bleed));
        this._applyDamage(ctx, null, u, dmg);
        this._log(ctx, 'dot', u, u, dmg, u.name + ' bleeds for ' + this._fmt(dmg) + '.');
        u.bleedT -= 1;
        if (u.bleedT <= 0) { u.bleed = 0; u.bleedT = 0; }
      }
    }
    for (let i = 0; i < all.length; i++) {
      const u = all[i];
      if (!u.alive) continue;
      if (u.burn > 0 && u.burnT > 0) {
        const dmg = Math.max(1, Math.round(u.burn));
        this._applyDamage(ctx, null, u, dmg);
        this._log(ctx, 'dot', u, u, dmg, u.name + ' burns for ' + this._fmt(dmg) + '.');
        u.burnT -= 1;
        if (u.burnT <= 0) { u.burn = 0; u.burnT = 0; }
      }
    }

    if (ctx.foeHealAllies) {
      const live = this._living(ctx.foes);
      let total = 0;
      for (let i = 0; i < live.length; i++) total += this._heal(ctx, live[i], live[i].maxHp * this.MOD_HEAL_PCT, '', null);
      if (total > 0) this._log(ctx, 'heal', null, null, total, 'A bell tolls behind the enemy line — ' + this._fmt(total) + ' HP knits shut.');
    }

    for (let i = 0; i < all.length; i++) {
      const u = all[i];
      for (let j = u.buffs.length - 1; j >= 0; j--) {
        const b = u.buffs[j];
        if (b.r >= 999) continue;
        b.r -= 1;
        if (b.r <= 0) u.buffs.splice(j, 1);
      }
      if (!u.alive || u.maxMp <= 0) continue;
      u.mp = Math.min(u.maxMp, u.mp + Math.round(u.maxMp * regen));
    }
  },

  _sideDead(list) {
    for (let i = 0; i < list.length; i++) if (list[i].alive) return false;
    return true;
  },

  _over(ctx) {
    return this._sideDead(ctx.allies) || this._sideDead(ctx.foes);
  },

  /* HP% of a side, measured over the units that matter (thralls excluded when
     any real unit is present, so the player's own bar is reported honestly). */
  _hpPct(list) {
    let hp = 0, max = 0;
    let any = false;
    for (let i = 0; i < list.length; i++) if (!list[i].isThrall) { any = true; break; }
    for (let i = 0; i < list.length; i++) {
      const u = list[i];
      if (any && u.isThrall) continue;
      hp += Math.max(0, u.hp);
      max += Math.max(1, u.maxHp);
    }
    if (max <= 0) return 0;
    return this._clamp(hp / max, 0, 1);
  },

  /* =========================================================================
   * THE ENGINE
   * ======================================================================= */

  /* Full uncapped run. Returns the internal shape; simulate() trims it. */
  _run(rawAllies, rawFoes, rawOpts) {
    const opts = (rawOpts && typeof rawOpts === 'object') ? rawOpts : {};
    const cc = CONFIG.combat || {};
    const hasSeed = (opts.seed !== undefined && opts.seed !== null && opts.seed !== '');
    let rng = Math.random;
    if (hasSeed) {
      try { rng = U.rngFrom(opts.seed); } catch (e) { rng = Math.random; }
      if (typeof rng !== 'function') rng = Math.random;
    }
    const maxRounds = Math.max(1, Math.round(this._num(opts.maxRounds, this._num(cc.maxRounds, 30))));

    const allies = [];
    const foes = [];
    const all = [];
    const inA = Array.isArray(rawAllies) ? rawAllies : [];
    const inF = Array.isArray(rawFoes) ? rawFoes : [];
    for (let i = 0; i < inA.length; i++) {
      const u = this._prepUnit(inA[i], 'ally', 'a' + allies.length);
      allies.push(u); all.push(u);
    }
    for (let i = 0; i < inF.length && foes.length < this.MAX_FOES; i++) {
      const u = this._prepUnit(inF[i], 'foe', 'f' + foes.length);
      foes.push(u); all.push(u);
    }

    const ctx = {
      rng: rng,
      round: 0,
      log: [],
      all: all,
      allies: allies,
      foes: foes,
      opts: opts,
      trace: !!opts.trace,
      foeHealAllies: false,
      spawnSeq: 0,
      meridianRounds: Array.isArray(opts.meridianRounds) ? opts.meridianRounds.slice() : [],
      lawInfo: null,
    };

    /* ---- opening: pills, boons, modifiers, passives, ward, thrall ---- */
    for (let i = 0; i < allies.length; i++) {
      const u = allies[i];
      this._applyPills(u, opts);
      this._applyBoons(ctx, u, opts.boons);
      this._pathPassives(u);
      u.patk = Math.max(0, Math.round(u.patk));
      u.matk = Math.max(0, Math.round(u.matk));
      u.pdef = Math.max(0, Math.round(u.pdef));
      u.mdef = Math.max(0, Math.round(u.mdef));
      u.spd = Math.max(1, Math.round(u.spd));
      u.hp = Math.min(u.maxHp, u.hp);
    }
    for (let i = 0; i < foes.length; i++) {
      const u = foes[i];
      this._applyModifiers(ctx, u, opts.modifiers);
      this._pathPassives(u);
      u.spd = Math.max(1, Math.round(u.spd));
    }
    ctx.lawInfo = this._lawInfo(opts, allies);

    ctx.round = 1;
    for (let i = 0; i < allies.length; i++) this._applyWard(ctx, allies[i]);
    const seedAllies = allies.slice();
    for (let i = 0; i < seedAllies.length; i++) this._spawnThrall(ctx, seedAllies[i]);

    /* ---- degenerate openings ---- */
    if (!allies.length || !foes.length) {
      const win = foes.length === 0 && allies.length > 0;
      this._log(ctx, 'info', null, null, 0, win ? 'There is no one left to fight.' : 'No one answers the call.');
      return this._finishRun(ctx, 0, win);
    }

    const procRound = Math.max(1, Math.round(this._num((CONFIG.law || {}).procRound, 4)));
    let rounds = 0;

    for (let r = 1; r <= maxRounds; r++) {
      ctx.round = r;
      rounds = r;

      this._meridianRound(ctx);
      this._passives(ctx);
      if (ctx.lawInfo && r % procRound === 0) this._lawProc(ctx);
      if (this._over(ctx)) break;

      const order = this._turnOrder(ctx);
      for (let i = 0; i < order.length; i++) {
        const u = order[i];
        if (!u.alive) continue;
        this._act(ctx, u);
        if (this._over(ctx)) break;
      }
      if (this._over(ctx)) break;

      this._endRound(ctx);
      if (this._over(ctx)) break;
    }

    const alliesDead = this._sideDead(ctx.allies);
    const foesDead = this._sideDead(ctx.foes);
    let win;
    if (alliesDead) win = false;
    else if (foesDead) win = true;
    else win = this._hpPct(ctx.allies) >= this._hpPct(ctx.foes);   // cap: ties to the allies

    if (!alliesDead && !foesDead) {
      this._log(ctx, 'info', null, null, 0,
        'The ' + rounds + '-round limit closes the fight — ' +
        (win ? 'you stand the taller.' : 'they stand the taller.'));
    }
    return this._finishRun(ctx, rounds, win);
  },

  _finishRun(ctx, rounds, win) {
    return {
      win: !!win,
      rounds: rounds,
      log: ctx.log,
      allyHpPct: this._hpPct(ctx.allies),
      foeHpPct: this._hpPct(ctx.foes),
      allies: ctx.allies,
      foes: ctx.foes,
      all: ctx.all,
    };
  },

  _resultOf(run) {
    return {
      win: run.win,
      rounds: run.rounds,
      log: this._capLog(run.log),
      allyHpPct: run.allyHpPct,
      foeHpPct: run.foeHpPct,
      allies: run.allies,
      foes: run.foes,
    };
  },

  _emptyResult() {
    return { win: false, rounds: 0, log: [], allyHpPct: 0, foeHpPct: 1, allies: [], foes: [] };
  },

  /* =========================================================================
   * PUBLIC: SIMULATION
   * ======================================================================= */

  /* Pure. No DOM, no S, no Math.random when opts.seed is given. */
  simulate(allies, foes, opts) {
    try {
      return this._resultOf(this._run(allies, foes, opts));
    } catch (e) {
      console.error('[Combat] simulate failed', e);
      return this._emptyResult();
    }
  },

  /* Headless wrapper for sweeps, the duel ladder and the dev autoplay sim. */
  autoResolve(allies, foes, opts) {
    return this.simulate(allies, foes, opts);
  },

  /* =========================================================================
   * PUBLIC: FOE CONSTRUCTION
   * ======================================================================= */

  /* enemyPower(stage) = CONFIG.wilds.enemyPower.base * growth^stage = 55 * 1.16^stage */
  enemyPower(stage) {
    const ep = (CONFIG.wilds && CONFIG.wilds.enemyPower) || {};
    const base = this._num(ep.base, 55);
    const growth = this._num(ep.growth, 1.16);
    const s = Math.max(0, Math.floor(this._num(stage, 0)));
    const v = base * Math.pow(growth, s);
    return (Number.isFinite(v) && v > 0) ? v : base;
  },

  /* Battle Rating of a raw stat shape. Mirrors Stats.br so the two agree. */
  _brOf(b) {
    try {
      if (typeof Stats !== 'undefined' && Stats && typeof Stats.br === 'function') {
        const v = Stats.br(b);
        if (Number.isFinite(v) && v > 0) return v;
      }
    } catch (e) { /* fall through */ }
    const w = CONFIG.brWeights || { hp: 0.08, atk: 4, def: 3, spd: 6 };
    const hp = this._num(b.maxHp !== undefined ? b.maxHp : b.hp, 0);
    return hp * this._num(w.hp, 0.08)
         + (this._num(b.patk, 0) + this._num(b.matk, 0)) * this._num(w.atk, 4)
         + (this._num(b.pdef, 0) + this._num(b.mdef, 0)) * this._num(w.def, 3)
         + this._num(b.spd, 0) * this._num(w.spd, 6);
  },

  /* Build a foe from {power|stage, role, element, skill, name, emoji, boss, seed}. */
  makeFoe(spec) {
    const s = (spec && typeof spec === 'object') ? spec : {};
    let rng = Math.random;
    if (s.seed !== undefined && s.seed !== null && s.seed !== '') {
      try { rng = U.rngFrom(s.seed); } catch (e) { rng = Math.random; }
      if (typeof rng !== 'function') rng = Math.random;
    }

    let power = this._num(s.power, NaN);
    if (!Number.isFinite(power) || power <= 0) power = this.enemyPower(s.stage);
    power = Math.max(1, power);

    const variance = this._clamp(this._num(s.variance, this._num((CONFIG.wilds || {}).powerVariance, 0.1)), 0, 0.9);
    if (variance > 0) power *= (1 - variance) + rng() * variance * 2;
    power = Math.max(1, power);

    const role = this.ROLES[s.role] || this.ROLES.bruiser;
    const c = CONFIG.baseStats || { hp: 320, mp: 90, patk: 26, matk: 26, pdef: 14, mdef: 14, spd: 20 };
    const shape = {
      hp: this._num(c.hp, 320) * role.hp,
      patk: this._num(c.patk, 26) * role.patk,
      matk: this._num(c.matk, 26) * role.matk,
      pdef: this._num(c.pdef, 14) * role.pdef,
      mdef: this._num(c.mdef, 14) * role.mdef,
      spd: this._num(c.spd, 20) * role.spd,
    };
    const br0 = this._brOf(shape);
    const k = br0 > 0 ? (power / br0) : 1;

    const cc = CONFIG.combat || {};
    const boss = !!s.boss;
    const sk = (typeof DATAX !== 'undefined' && DATAX && DATAX.monsterSkillById)
      ? (DATAX.monsterSkillById[s.skill] || null) : null;

    const hp = Math.max(1, Math.round(shape.hp * k));
    const unit = {
      name: String(s.name || 'Wild Beast'),
      emoji: String(s.emoji || '\u{1F43E}'),
      side: 'foe',
      element: (typeof s.element === 'string' && s.element) ? s.element : null,
      path: null,
      hp: hp, maxHp: hp,
      mp: 100, maxMp: 100,
      patk: Math.max(1, Math.round(shape.patk * k)),
      matk: Math.max(1, Math.round(shape.matk * k)),
      pdef: Math.max(1, Math.round(shape.pdef * k)),
      mdef: Math.max(1, Math.round(shape.mdef * k)),
      spd: Math.max(1, Math.round(shape.spd * k)),
      crit: this._clamp(this._num(cc.baseCrit, 0.05) + role.crit + (boss ? 0.05 : 0), 0, 1),
      critDmg: Math.max(1, this._num(cc.baseCritDmg, 1.5) + (boss ? 0.2 : 0)),
      hit: this._num(cc.baseHit, 0.95),
      dodge: this._clamp(this._num(cc.baseDodge, 0) + role.dodge, 0, 0.9),
      lifesteal: 0,
      skill: sk ? {
        id: sk.id, name: sk.name,
        cd: boss ? 2 : 3,
        mult: this._num(sk.mult, 1),
        kind: sk.kind === 'magic' ? 'magic' : 'phys',
        target: sk.target || 'one',
        effect: sk.effect || null,
      } : null,
      isPlayer: false,
      isThrall: false,
    };
    return unit;
  },

  /* =========================================================================
   * PLAYBACK — the animated arena
   * ======================================================================= */

  /* Combat.play({allies, foes, opts, title, onDone, canSkip, prePills}).
     onDone(result) is called EXACTLY ONCE, including when the sheet is
     dismissed early or when the arena cannot be rendered at all. */
  play(cfg) {
    const c = (cfg && typeof cfg === 'object') ? cfg : {};
    const self = this;
    let fired = false;
    const fire = (res) => {
      if (fired) return;
      fired = true;
      try {
        if (typeof c.onDone === 'function') c.onDone(res || self._emptyResult());
      } catch (e) {
        console.error('[Combat] onDone threw', e);
      }
    };

    const headless = () => {
      let res = null;
      try { res = self.simulate(c.allies, c.foes, c.opts); } catch (e) { res = null; }
      fire(res || self._emptyResult());
    };

    const canRender = (typeof document !== 'undefined') && document && document.body &&
                      (typeof UI !== 'undefined') && UI && typeof UI.sheet === 'function' &&
                      typeof UI.el === 'function';
    if (!canRender) { headless(); return; }

    /* Always seeded, so the Meridian Pill can re-simulate the same battle. */
    const baseOpts = {};
    const src = (c.opts && typeof c.opts === 'object') ? c.opts : {};
    for (const k in src) baseOpts[k] = src[k];
    if (baseOpts.seed === undefined || baseOpts.seed === null || baseOpts.seed === '') {
      let seed = 0;
      try { seed = U.hash('battle:' + Date.now() + ':' + Math.random()); } catch (e) { seed = (Date.now() ^ 0x9e3779b9) >>> 0; }
      baseOpts.seed = seed;
    }
    baseOpts.trace = true;
    if (!Array.isArray(baseOpts.meridianRounds)) baseOpts.meridianRounds = [];

    let run = null;
    try { run = this._run(c.allies, c.foes, baseOpts); } catch (e) { run = null; }
    if (!run) { console.error('[Combat] play could not simulate'); headless(); return; }

    /* stop any arena still running */
    if (this._pl) { this._stopTimers(this._pl); this._pl.finished = true; }

    const speeds = (CONFIG.combat && CONFIG.combat.speeds) || [1, 2, 4];
    let speed = 1;
    try { speed = this._num(S && S.settings && S.settings.speed, 1); } catch (e) { speed = 1; }
    if (speeds.indexOf(speed) < 0) speed = speeds[0] || 1;

    const st = {
      run: run,
      result: this._resultOf(run),
      opts: baseOpts,
      srcAllies: c.allies,
      srcFoes: c.foes,
      i: 0,
      speed: speed,
      speeds: speeds,
      timer: 0,
      watch: 0,
      opened: false,
      finished: false,
      phase: 'play',
      meridian: [],
      meridianUsed: 0,
      canSkip: !!c.canSkip,
      fire: fire,
      units: [],
      byUid: {},
      dom: {},
    };
    this._pl = st;

    const body = this._buildBody(st, c);
    st.body = body;

    try {
      UI.sheet({
        title: String(c.title || 'Battle'),
        body: body,
        buttons: [{
          label: st.canSkip ? 'Skip' : 'Watching…',
          cls: 'ghost',
          act: (close) => {
            if (st.phase === 'play' && !st.canSkip) return;
            self._stopTimers(st);
            st.finished = true;
            try { if (typeof close === 'function') close(); } catch (e) { /* ignore */ }
            self._closeSheet(st);
            fire(st.result);
          },
        }],
      });
    } catch (e) {
      console.error('[Combat] sheet failed', e);
      this._stopTimers(st);
      fire(st.result);
      return;
    }

    st.perEntry = this._perEntry(run);
    st.watch = setInterval(() => self._watch(st), 200);
    st.timer = setTimeout(() => self._tickPlay(st), st.perEntry);
  },

  _perEntry(run) {
    const base = this._num(CONFIG.combat && CONFIG.combat.roundMsBase, 620);
    const rounds = Math.max(1, run.rounds || 1);
    const per = Math.max(1, Math.round(run.log.length / rounds));
    return this._clamp(Math.round(base / per), 70, 380);
  },

  _stepMs(st) {
    return Math.max(28, Math.round((st.perEntry || 200) / Math.max(1, st.speed || 1)));
  },

  _stopTimers(st) {
    if (!st) return;
    if (st.timer) { clearTimeout(st.timer); st.timer = 0; }
    if (st.watch) { clearInterval(st.watch); st.watch = 0; }
  },

  /* Fires onDone if the player dismissed the sheet, and patches the sheet's
     own button once UI has mounted it. */
  _watch(st) {
    if (!st || st.finished) return;
    const connected = !!(st.body && st.body.isConnected);
    if (connected && !st.opened) {
      st.opened = true;
      this._grabSheetButton(st);
    }
    if (st.opened && !connected) {
      st.finished = true;
      this._stopTimers(st);
      st.fire(st.result);
    }
  },

  _grabSheetButton(st) {
    try {
      let node = st.body;
      while (node && node.classList && !node.classList.contains('sheet')) node = node.parentElement;
      if (!node) return;
      const rows = node.querySelectorAll('.row .btn');
      if (rows && rows.length) {
        st.dom.sheetBtn = rows[rows.length - 1];
        if (!st.canSkip && st.phase === 'play') st.dom.sheetBtn.disabled = true;
      }
    } catch (e) { /* the button is a nicety, not a requirement */ }
  },

  _closeSheet(st) {
    try {
      let node = st.body;
      while (node && node.parentElement && !(node.classList && node.classList.contains('sheet-wrap'))) {
        node = node.parentElement;
      }
      if (node && node.classList && node.classList.contains('sheet-wrap') && node.parentNode) {
        node.parentNode.removeChild(node);
      }
    } catch (e) { /* ignore */ }
  },

  /* ------------------------------------------------------------------ DOM */

  _buildBody(st, cfg) {
    const body = UI.el('div', 'col');

    const arena = UI.el('div', 'arena');
    const sideA = UI.el('div', 'side');
    const sideF = UI.el('div', 'side');
    arena.appendChild(sideA);
    arena.appendChild(sideF);
    body.appendChild(arena);
    st.dom.arena = arena;
    st.dom.sideA = sideA;
    st.dom.sideF = sideF;

    const blog = UI.el('div', 'blog');
    body.appendChild(blog);
    st.dom.blog = blog;

    const bar = UI.el('div', 'row between');
    const left = UI.el('div', 'row');

    const spd = UI.el('button', 'btn sm ghost', 'x' + st.speed);
    spd.type = 'button';
    spd.addEventListener('click', () => this._cycleSpeed(st));
    left.appendChild(spd);
    st.dom.speedBtn = spd;

    const mer = UI.el('button', 'btn sm', '\u{1F7E2} Meridian');
    mer.type = 'button';
    mer.addEventListener('click', () => this._useMeridian(st));
    left.appendChild(mer);
    st.dom.merBtn = mer;

    bar.appendChild(left);

    const note = UI.el('span', 'tiny muted', '');
    const pre = cfg.prePills;
    if (pre && typeof pre === 'object') {
      const tags = [];
      if (pre.ward) tags.push('\u{1F6E1}\u{FE0F} Ward');
      if (pre.fury) tags.push('\u{1F525} Fury');
      note.textContent = tags.length ? tags.join(' · ') : '';
    }
    bar.appendChild(note);
    body.appendChild(bar);
    st.dom.note = note;

    this._buildUnits(st);
    this._refreshMeridian(st);
    return body;
  },

  _buildUnits(st) {
    const list = st.run.all || [];
    st.units = [];
    st.byUid = {};
    st.dom.sideA.textContent = '';
    st.dom.sideF.textContent = '';

    for (let i = 0; i < list.length; i++) {
      const u = list[i];
      const el = UI.el('div', 'unit');
      const emo = UI.el('div', 'unit-emoji', u.emoji);
      const lbl = UI.el('div', 'lbl', u.name);
      const bars = UI.el('div', 'unit-bars');
      const hpBar = UI.el('span', 'bar hp');
      const hpIn = UI.el('i', '');
      hpBar.appendChild(hpIn);
      bars.appendChild(hpBar);
      let mpIn = null;
      if (u.maxMp > 0) {
        const mpBar = UI.el('span', 'bar mp');
        mpIn = UI.el('i', '');
        mpBar.appendChild(mpIn);
        bars.appendChild(mpBar);
      }
      el.appendChild(emo);
      el.appendChild(lbl);
      el.appendChild(bars);

      const rec = { u: u, el: el, hp: hpIn, mp: mpIn, maxHp: u.maxHp, maxMp: u.maxMp };
      hpIn.style.width = '100%';
      if (mpIn) mpIn.style.width = '100%';

      /* Units spawned mid-battle stay hidden until the log reaches them. */
      if (i >= (st.run.log.length ? (st.run.log[0].st || []).length : list.length)) el.hidden = true;

      st.units.push(rec);
      st.byUid[u.uid] = rec;
      (u.side === 'ally' ? st.dom.sideA : st.dom.sideF).appendChild(el);
    }
  },

  _reduceFx() {
    try { return !!(S && S.settings && S.settings.reduceFx); } catch (e) { return false; }
  },

  _blogCls(e) {
    if (e.t === 'crit' || e.t === 'law') return 'gold';
    if (e.t === 'skill') return 'jade';
    if (e.t === 'heal') return 'good';
    if (e.t === 'die') return (e.tref && String(e.tref).charAt(0) === 'f') ? 'good' : 'bad';
    return '';
  },

  _float(st, rec, text, cls) {
    if (!rec || !rec.el) return;
    try {
      if (UI && typeof UI.float === 'function') { UI.float(rec.el, text, cls || ''); return; }
    } catch (e) { /* fall through to the in-arena number */ }
    try {
      const d = UI.el('span', 'dmg' + (cls ? ' ' + cls : ''), text);
      rec.el.appendChild(d);
      setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 1000);
    } catch (e) { /* ignore */ }
  },

  _renderEntry(st, e) {
    const snap = e.st || null;

    if (snap) {
      for (let i = 0; i < st.units.length; i++) {
        const rec = st.units[i];
        const s = snap[i];
        if (!s) { rec.el.hidden = true; continue; }
        rec.el.hidden = false;
        const hpPct = this._clamp(s.h / Math.max(1, rec.maxHp), 0, 1) * 100;
        rec.hp.style.width = hpPct.toFixed(1) + '%';
        if (rec.mp) {
          const mpPct = this._clamp(s.m / Math.max(1, rec.maxMp), 0, 1) * 100;
          rec.mp.style.width = mpPct.toFixed(1) + '%';
        }
        if (s.a) rec.el.classList.remove('dead');
        else rec.el.classList.add('dead');
      }
    }

    const reduce = this._reduceFx();

    if (!reduce) {
      for (let i = 0; i < st.units.length; i++) st.units[i].el.classList.remove('act');
      const a = e.sref ? st.byUid[e.sref] : null;
      if (a && a.u.alive !== false) a.el.classList.add('act');
    }

    const tgt = e.tref ? st.byUid[e.tref] : null;
    if (tgt) {
      if (e.t === 'crit') this._float(st, tgt, '-' + this._fmt(e.val), 'gold');
      else if (e.t === 'hit') this._float(st, tgt, '-' + this._fmt(e.val), tgt.u.side === 'ally' ? 'bad' : '');
      else if (e.t === 'dot') this._float(st, tgt, '-' + this._fmt(e.val), 'bad');
      else if (e.t === 'miss') this._float(st, tgt, 'miss', '');
      else if (e.t === 'heal') this._float(st, tgt, '+' + this._fmt(e.val), 'good');
    }

    if (e.t === 'crit' && !reduce && st.dom.arena) {
      const arena = st.dom.arena;
      arena.classList.remove('shake');
      void arena.offsetWidth;
      arena.classList.add('shake');
      setTimeout(() => { arena.classList.remove('shake'); }, 340);
    }

    if (e.text && st.dom.blog) {
      const p = UI.el('p', this._blogCls(e), e.text);
      st.dom.blog.appendChild(p);
      while (st.dom.blog.childNodes.length > this.BLOG_LINES) st.dom.blog.removeChild(st.dom.blog.firstChild);
      st.dom.blog.scrollTop = st.dom.blog.scrollHeight;
    }
  },

  _tickPlay(st) {
    if (!st || st.finished) return;
    if (st.opened && st.body && !st.body.isConnected) { this._watch(st); return; }
    const log = st.run.log;
    if (st.i >= log.length) { this._finishPlay(st); return; }
    const e = log[st.i];
    st.i += 1;
    try { this._renderEntry(st, e); } catch (err) { console.error('[Combat] render failed', err); }
    st.timer = setTimeout(() => this._tickPlay(st), this._stepMs(st));
  },

  _finishPlay(st) {
    if (st.phase === 'done') return;
    st.phase = 'done';
    if (st.timer) { clearTimeout(st.timer); st.timer = 0; }

    const win = st.run.win;
    const line = win
      ? 'Victory. ' + Math.round(st.run.allyHpPct * 100) + '% of you is still standing.'
      : 'Defeat. You are carried out of the ring.';
    try {
      if (st.dom.blog) {
        const p = UI.el('p', win ? 'gold' : 'bad', line);
        st.dom.blog.appendChild(p);
        st.dom.blog.scrollTop = st.dom.blog.scrollHeight;
      }
    } catch (e) { /* ignore */ }

    if (st.dom.merBtn) st.dom.merBtn.disabled = true;
    if (st.dom.sheetBtn) {
      st.dom.sheetBtn.disabled = false;
      st.dom.sheetBtn.textContent = 'Continue';
      st.dom.sheetBtn.classList.add('primary');
    } else {
      /* No handle on the sheet's own button — close ourselves so the caller
         is never left waiting on a tap that cannot happen. */
      setTimeout(() => {
        if (st.finished) return;
        st.finished = true;
        this._stopTimers(st);
        this._closeSheet(st);
        st.fire(st.result);
      }, 900);
    }
  },

  /* ---------------------------------------------------------- speed / pill */

  _cycleSpeed(st) {
    const list = st.speeds && st.speeds.length ? st.speeds : [1, 2, 4];
    let i = list.indexOf(st.speed);
    if (i < 0) i = 0;
    st.speed = list[(i + 1) % list.length];
    if (st.dom.speedBtn) st.dom.speedBtn.textContent = 'x' + st.speed;
    try {
      if (S && S.settings) {
        S.settings.speed = st.speed;
        if (typeof Save !== 'undefined' && Save && typeof Save.save === 'function') Save.save();
      }
    } catch (e) { /* the toggle still works without a save */ }
  },

  /* Highest-rank Meridian Pill in the pouch, or null. */
  _findMeridianPill() {
    let inv = null;
    try { inv = (S && S.inv && S.inv.pills) || null; } catch (e) { inv = null; }
    if (!inv) return null;
    const byId = (typeof DATAX !== 'undefined' && DATAX && DATAX.formulaById) ? DATAX.formulaById : null;
    let best = null;
    let bestRank = -1;
    for (const key in inv) {
      if (!(inv[key] > 0)) continue;
      const cut = String(key).lastIndexOf('_');
      if (cut <= 0) continue;
      const f = byId ? byId[key.slice(0, cut)] : null;
      if (!f || f.type !== 'meridian') continue;
      const rank = this._num(f.rank, 1);
      if (rank > bestRank) { bestRank = rank; best = key; }
    }
    return best;
  },

  _consumeMeridian(key) {
    let ok = false;
    try {
      if (typeof Alchemy !== 'undefined' && Alchemy && typeof Alchemy.usePill === 'function') {
        ok = !!Alchemy.usePill(key);
      }
    } catch (e) { ok = false; }
    if (ok) return true;
    let inv = null;
    try { inv = (S && S.inv && S.inv.pills) || null; } catch (e) { inv = null; }
    if (!inv || !(inv[key] > 0)) return false;
    inv[key] -= 1;
    if (inv[key] <= 0) delete inv[key];
    try {
      const cut = String(key).lastIndexOf('_');
      const byId = (typeof DATAX !== 'undefined' && DATAX && DATAX.formulaById) ? DATAX.formulaById : null;
      const f = (cut > 0 && byId) ? (byId[key.slice(0, cut)] || null) : null;
      Bus.emit('pillUsed', {
        formulaId: f ? f.id : key,
        type: f ? f.type : 'meridian',
        rank: f ? this._num(f.rank, 1) : 1,
        quality: cut > 0 ? key.slice(cut + 1) : 'gray',
      });
    } catch (e) { /* ignore */ }
    return true;
  },

  _refreshMeridian(st) {
    const btn = st.dom.merBtn;
    if (!btn) return;
    const max = Math.max(0, Math.round(this._num((CONFIG.alchemy || {}).meridianMaxPerBattle, 2)));
    const left = max - st.meridianUsed;
    const has = !!this._findMeridianPill();
    btn.textContent = '\u{1F7E2} Meridian' + (left > 0 ? ' (' + left + ')' : '');
    btn.disabled = (st.phase !== 'play') || left <= 0 || !has;
  },

  /* Drink the pill: pre-declare the restore for the NEXT round and re-simulate
     the same seeded battle. Everything already shown is unchanged, so playback
     carries on from the same index. */
  _useMeridian(st) {
    if (!st || st.phase !== 'play' || st.finished) return;
    const max = Math.max(0, Math.round(this._num((CONFIG.alchemy || {}).meridianMaxPerBattle, 2)));
    if (st.meridianUsed >= max) { this._toast('No more pills will fit tonight.', 'bad'); return; }

    const cur = st.run.log[Math.max(0, st.i - 1)];
    const nextRound = (cur ? this._num(cur.r, 1) : 1) + 1;
    if (nextRound > st.run.rounds) { this._toast('The fight is already decided.', 'bad'); return; }

    const key = this._findMeridianPill();
    if (!key) { this._toast('No Meridian Pill in your pouch.', 'bad'); return; }
    if (!this._consumeMeridian(key)) { this._toast('The pill slips out of reach.', 'bad'); return; }

    st.meridianUsed += 1;
    st.meridian.push(nextRound);

    const o = {};
    for (const k in st.opts) o[k] = st.opts[k];
    o.meridianRounds = st.meridian.slice();

    let nrun = null;
    try { nrun = this._run(st.srcAllies, st.srcFoes, o); } catch (e) { nrun = null; }
    if (!nrun) { this._toast('The pill does nothing at all.', 'bad'); this._refreshMeridian(st); return; }

    st.opts = o;
    st.run = nrun;
    st.result = this._resultOf(nrun);
    if (st.i > nrun.log.length) st.i = nrun.log.length;
    st.perEntry = this._perEntry(nrun);
    try { this._buildUnits(st); } catch (e) { /* keep the old arena rather than crash */ }
    this._refreshMeridian(st);
    this._toast('Meridians flooded with fresh Qi.', 'good');
  },

  _toast(msg, kind) {
    try {
      if (typeof UI !== 'undefined' && UI && typeof UI.toast === 'function') UI.toast(msg, kind || 'info');
    } catch (e) { /* ignore */ }
  },
};

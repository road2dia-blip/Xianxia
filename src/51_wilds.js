/* ============================================================================
 * Wilds — hunting grounds, expeditions, and fortuity.
 * Owns the `wilds` panel. Three features behind one zone-list -> zone-detail flow.
 *
 * Only ONE top-level binding is introduced by this file: `Wilds`. Every helper
 * lives on the object (prefixed `_`) so nothing can collide in the shared scope.
 *
 * ---------------------------------------------------------------- FORMULAS --
 * ZONE SCALE (so a realm-5 zone is not as soft as a realm-0 zone while still
 * using the literal enemyPower curve from CONFIG):
 *   anchorRealm(z)   = z.remix ? realm of the mortal zone it remixes : z.realm
 *   zoneScale(z)     = benchmarkBR[anchorRealm(z)] / benchmarkBR[0]
 *                      * (z.remix ? CONFIG.wilds.spiritRemixMult : 1)
 *
 * ENEMY POWER (a BR-equivalent number):
 *   enemyPower(z, s) = CONFIG.wilds.enemyPower.base * growth^s * zoneScale(z)
 *                    = 55 * 1.16^s * zoneScale(z)
 *   Result: every zone's stage 1 sits at ~0.53x the benchmark BR of the realm
 *   that gates it, and its stage 40 sits ~3 realms above that.
 *
 * ENCOUNTER SPLIT (stage N spawns 1..3 monsters, every 10th stage is a boss):
 *   isBoss(s)        = s % CONFIG.wilds.bossEvery === 0
 *   count(s)         = boss ? 1 : U.rint(1,3)
 *   perFoePower      = enemyPower * variance / count^0.75      (variance +/-10%)
 *   bossPower        = enemyPower * BOSS_MULT (2.6)
 *
 * FOE STAT BLOCK (only used when Combat.makeFoe is unavailable): a canonical
 * spread is rolled, the role template multiplies it, then everything is
 * rescaled so BR(unit) === requested power:
 *   hp 40u, patk 1.2u, matk 1.2u, pdef .55u, mdef .55u, spd 1.1u  -> BR 22.7u
 *
 * HUNT DROPS (zone tier T, stage s, P = enemyPower):
 *   stone   = 3.2 * P^0.62 * (boss ? 3.2 : 1) * rand(.85,1.15) * lootMult
 *   mats    = herb/core/forge of tier T; amount 1 + floor(s/10) + rint(0,1),
 *             x3 on a boss; forge guaranteed on a boss (gear materials)
 *   exp     = auraPerSec * (boss ? 80 : 20) seconds
 *   lawShard on remix zones: 10% per clear, 1-3 guaranteed on a boss
 *   boss extras: 12% formula, 6% curio, first clear pays (2 + T) Jade
 *   lootMult = 1 + (bait active ? CONFIG.alchemy.baitLootBonus : 0)
 *
 * EXPEDITION (idle farming of ONE assigned zone, sp = enemyPower(z, stage)):
 *   mult    = CONFIG.wilds.expeditionBaseRate * (1 + Stats.bonus('expedition'))
 *             * (1 + (bait ? CONFIG.alchemy.baitLootBonus : 0))
 *   stone/h = 30 * sp^0.62 * mult
 *   exp/h   = auraPerSec * 3600 * (0.15 + 0.010 * stage) * mult
 *   herb/h  = (0.50 + 0.090*stage) * mult
 *   core/h  = (0.35 + 0.060*stage) * mult
 *   forge/h = (0.30 + 0.050*stage) * mult
 *   elapsed = clamp(now - expedition.startedAt, 0, capMs)     <- DERIVED, never
 *   capMs   = (CONFIG.wilds.expeditionCapH + Stats.bonus('offlineHours')) * 1h
 *   Because the accumulator is derived from an absolute epoch, the live tick and
 *   the Offline provider can both refresh it and time can never be counted twice.
 *
 * FORTUITY:
 *   interval = rint(fortuityMinSec, fortuityMaxSec)
 *              * max(0.25, 1 - CONFIG.abode.teaRoomFortuityBonus * teaLevel)
 *   rarity   = weightedPick(CONFIG.wilds.rarityWeights)  C60 R30 E9 M1
 *   also 25% (CONFIG.wilds.fortuityHuntChance) per MANUAL hunt
 *   queue capped at CONFIG.wilds.fortuityQueueMax (3)
 *   LUCK BIAS on outcome weights (value score v, mean m, spread d over a
 *   choice's outcomes):
 *     w' = w * (1 + 2 * luck * CONFIG.wilds.luckOutcomeWeight * (v - m) / d)
 *   i.e. at Luck 100 the best outcome of a pair is ~+40% likely, worst ~-40%.
 *
 * AUTO-HUNT (Jade shop qol:'autoHunt'): every AUTO_SEC (15s) it re-fights the
 * highest cleared stage of the tracked zone with a headless Combat.simulate,
 * merging drops into a claimable pool, and switches itself off on a loss.
 *
 * BUS: huntClear {zone,stage,boss} · expeditionClaim {} · fortuityResolve
 *      {eventId,rarity} · pillUsed {…} (only when Alchemy.usePill is absent)
 *
 * ASSUMPTIONS (documented, all defensive):
 *   - Combat.makeFoe(spec) takes one descriptor object; if it is missing or
 *     returns something without maxHp, a local builder is used instead.
 *   - Alchemy.usePill(invKey) only consumes the pill; the battle effect is
 *     delivered through Combat opts.wardPill / opts.furyPill.
 *   - Offline.provider(fn) passes (elapsedSec, nowMs) and expects
 *     [{icon,label,amount}] back. Registration is wrapped in try/catch.
 * ==========================================================================*/

const Wilds = {

  /* ------------------------------------------------------- tuning constants */
  _BOSS_MULT: 2.6,          // boss power multiplier over the stage's enemyPower
  _AUTO_SEC: 15,            // seconds between auto-hunt runs
  _AUTO_MAX_PER_TICK: 8,    // bounded catch-up, so dtSec=3600 cannot hang
  _CANON: { hp: 40, patk: 1.2, matk: 1.2, pdef: 0.55, mdef: 0.55, spd: 1.1 },
  _ROLES: {
    bruiser: { hp: 1.45, patk: 1.15, matk: 0.45, pdef: 1.25, mdef: 0.95, spd: 0.85, crit: 0.03, dodge: 0 },
    caster:  { hp: 0.82, patk: 0.40, matk: 1.40, pdef: 0.85, mdef: 1.25, spd: 1.00, crit: 0.05, dodge: 0.02 },
    swift:   { hp: 0.80, patk: 1.20, matk: 0.80, pdef: 0.85, mdef: 0.85, spd: 1.45, crit: 0.10, dodge: 0.06 },
  },

  /* ------------------------------------------------- transient view state */
  _dom: null,
  _rows: null,
  _view: 'list',
  _zoneId: null,
  _stage: 1,
  _ward: null,
  _fury: null,
  _busy: false,
  _offlineStamp: -1,

  /* =======================================================================
   * LIFECYCLE
   * ===================================================================== */

  init() {
    try { UI.register('wilds', () => this.render()); } catch (e) { /* UI may not expose it */ }

    try {
      if (typeof Offline !== 'undefined' && Offline && typeof Offline.provider === 'function') {
        Offline.provider((elapsedSec, nowMs) => this.offline(elapsedSec, nowMs));
      }
    } catch (e) { /* offline accrual is optional */ }

    // A hunt is the game's most common "did a thing" — refresh the tab dot after
    // anything that could unlock a zone.
    try {
      Bus.on('breakthrough', () => { try { UI.dirty('wilds'); } catch (e) {} });
    } catch (e) { /* Bus always exists, but never trust it at init */ }

    const w = this._st();
    const now = Date.now();
    if (!(w.fortuity.nextAt > 0)) w.fortuity.nextAt = now + this._fortInterval();
    if (w.expedition.zone && !(w.expedition.startedAt > 0)) w.expedition.startedAt = now;
  },

  tick(dtSec, nowMs) {
    const now = nowMs || Date.now();
    if (!S || !S.created) return;
    if (S.player.realm < CONFIG.unlocks.wilds) return;

    this._expElapsed(now);         // keeps expedition.sinceMs honest for the UI
    const added = this._fortTick(now);
    this._autoTick(now);

    if (added) {
      try { UI.dirty('wilds'); } catch (e) {}
      try { UI.toast('A fortuity stirs in the wilds.', 'gold'); } catch (e) {}
    }
    this._syncBadge();
  },

  /* Offline / time-warp accrual. Grants nothing on its own — the expedition
     accumulator is derived from an absolute epoch and paid out by Claim — but it
     does advance the fortuity clock and report what is waiting. Idempotent: two
     calls with the same nowMs return nothing the second time. */
  offline(elapsedSec, nowMs) {
    const now = nowMs || Date.now();
    if (!S || !S.created) return [];
    if (this._offlineStamp === now) return [];
    this._offlineStamp = now;

    const lines = [];
    if (S.player.realm < CONFIG.unlocks.wilds) return lines;

    const ms = this._expElapsed(now);
    const w = this._st();
    if (w.expedition.zone && ms > 60000) {
      const z = this._zone(w.expedition.zone);
      const r = this.expeditionRate(w.expedition.zone);
      const h = ms / 3600000;
      lines.push({
        icon: (z && z.emoji) || '\u{1F5FA}',
        label: 'Expedition — ' + ((z && z.name) || 'the wilds') + ' (' + Fmt.dur(ms / 1000) + ' banked)',
        amount: Fmt.n(Math.floor(r.stone * h)) + ' Spiritstone, ready to claim',
      });
    }

    const added = this._fortTick(now);
    if (added > 0) {
      lines.push({
        icon: '✨',
        label: added === 1 ? 'A fortuity found you while you were away' : added + ' fortuities found you',
        amount: 'Waiting in the Wilds',
      });
    }
    this._syncBadge();
    return lines;
  },

  badges() {
    if (!S || !S.created) return 0;
    if (S.player.realm < CONFIG.unlocks.wilds) return 0;
    const w = this._st();
    let n = w.fortuity.queue.length;
    if (this._autoPoolAny()) n++;
    if (w.expedition.zone && this._expElapsed(Date.now()) >= this._expCapMs()) n++;
    return n;
  },

  _syncBadge() {
    try { UI.badge('wilds', this.badges()); } catch (e) {}
  },

  /* =======================================================================
   * STATE HELPERS — every read from S is guarded; old saves have gaps.
   * ===================================================================== */

  _st() {
    if (!S.wilds || typeof S.wilds !== 'object') S.wilds = {};
    const w = S.wilds;
    if (!w.zones || typeof w.zones !== 'object') w.zones = {};
    if (!w.expedition || typeof w.expedition !== 'object') w.expedition = { zone: null, sinceMs: 0, startedAt: 0 };
    if (!w.fortuity || typeof w.fortuity !== 'object') w.fortuity = { queue: [], nextAt: 0 };
    if (!Array.isArray(w.fortuity.queue)) w.fortuity.queue = [];
    if (!w.auto || typeof w.auto !== 'object') w.auto = { zone: null, nextAt: 0, runs: 0, pool: null };
    return w;
  },

  /* { stage: highest cleared, cleared: lifetime clears } for one zone. */
  _zrec(id) {
    const w = this._st();
    let r = w.zones[id];
    if (!r || typeof r !== 'object') { r = { stage: 0, cleared: 0 }; w.zones[id] = r; }
    if (!(r.stage >= 0)) r.stage = 0;
    if (!(r.cleared >= 0)) r.cleared = 0;
    return r;
  },

  _stageOf(id) { return (S.wilds && S.wilds.zones && S.wilds.zones[id] && S.wilds.zones[id].stage) || 0; },

  _zones() { return Array.isArray(DATA.zones) ? DATA.zones : []; },

  _zone(id) {
    if (!id) return null;
    if (DATAX && DATAX.zoneById && DATAX.zoneById[id]) return DATAX.zoneById[id];
    const list = this._zones();
    for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  },

  _unlocked(z) {
    if (!z) return false;
    const need = z.remix ? Math.max(z.realm || 0, CONFIG.unlocks.spiritZones) : (z.realm || 0);
    return (S.player.realm || 0) >= need;
  },

  _needRealmName(z) {
    if (!z) return '';
    const need = z.remix ? Math.max(z.realm || 0, CONFIG.unlocks.spiritZones) : (z.realm || 0);
    const r = DATA.realms[need];
    return (r && r.name) || ('Realm ' + need);
  },

  _auraSec() {
    try {
      if (typeof Cultivation !== 'undefined' && Cultivation && typeof Cultivation.auraPerSec === 'function') {
        const a = Cultivation.auraPerSec();
        if (Number.isFinite(a) && a > 0) return a;
      }
    } catch (e) {}
    return CONFIG.cultivation.aura.base * Math.pow(CONFIG.cultivation.aura.growth, S.player.realm || 0);
  },

  _bonus(key) {
    try {
      if (typeof Stats !== 'undefined' && Stats && typeof Stats.bonus === 'function') {
        const v = Stats.bonus(key);
        return Number.isFinite(v) ? v : 0;
      }
    } catch (e) {}
    return 0;
  },

  _baitActive() {
    const until = (S.alchemy && S.alchemy.baitUntil) || 0;
    return until > Date.now();
  },

  _lootMult() {
    return 1 + (this._baitActive() ? CONFIG.alchemy.baitLootBonus : 0);
  },

  /* =======================================================================
   * POWER + FOE CONSTRUCTION
   * ===================================================================== */

  _benchmark(r) {
    const t = CONFIG.breakthrough.benchmarkBR;
    const i = U.clamp(Math.floor(r || 0), 0, t.length - 1);
    return t[i] || t[0] || 120;
  },

  _zoneScale(z) {
    if (!z) return 1;
    let anchorRealm = z.realm || 0;
    if (z.remix) {
      const baseId = String(z.id || '').replace(/^s/, '');
      const base = this._zone(baseId);
      if (base) anchorRealm = base.realm || 0;
    }
    let scale = this._benchmark(anchorRealm) / this._benchmark(0);
    if (z.remix) scale *= CONFIG.wilds.spiritRemixMult;
    return scale > 0 ? scale : 1;
  },

  /* The BR-equivalent an encounter at this stage is worth. */
  _enemyPower(z, stage) {
    const s = U.clamp(Math.floor(stage || 1), 1, CONFIG.wilds.stagesPerZone);
    const ep = CONFIG.wilds.enemyPower;
    return ep.base * Math.pow(ep.growth, s) * this._zoneScale(z);
  },

  _isBoss(stage) {
    const s = Math.floor(stage || 0);
    return s > 0 && (s % CONFIG.wilds.bossEvery === 0);
  },

  _brOf(u) {
    try {
      if (typeof Stats !== 'undefined' && Stats && typeof Stats.br === 'function') {
        const v = Stats.br(u);
        if (Number.isFinite(v)) return v;
      }
    } catch (e) {}
    const bw = CONFIG.brWeights;
    return (u.hp || 0) * bw.hp + ((u.patk || 0) + (u.matk || 0)) * bw.atk +
           ((u.pdef || 0) + (u.mdef || 0)) * bw.def + (u.spd || 0) * bw.spd;
  },

  /* Build one foe. Prefers Combat.makeFoe(spec); falls back to a local build
     that lands BR exactly on the requested power. */
  _makeFoe(spec) {
    let u = null;
    try {
      if (typeof Combat !== 'undefined' && Combat && typeof Combat.makeFoe === 'function') {
        u = Combat.makeFoe(spec);
      }
    } catch (e) { u = null; }
    if (!u || !(u.maxHp > 0) || !(u.hp > 0)) u = this._localFoe(spec);
    u.side = 'foe';
    u.name = spec.name || u.name || 'Beast';
    u.emoji = spec.emoji || u.emoji || '\u{1F43E}';
    if (u.element === undefined) u.element = spec.element || null;
    if (u.isPlayer === undefined) u.isPlayer = false;
    if (u.isThrall === undefined) u.isThrall = false;
    return u;
  },

  _localFoe(spec) {
    const power = Math.max(1, Number(spec.power) || 1);
    const role = this._ROLES[spec.role] || this._ROLES.bruiser;
    const c = this._CANON;
    const u0 = 1;
    const raw = {
      hp: c.hp * u0 * role.hp,
      patk: c.patk * u0 * role.patk,
      matk: c.matk * u0 * role.matk,
      pdef: c.pdef * u0 * role.pdef,
      mdef: c.mdef * u0 * role.mdef,
      spd: c.spd * u0 * role.spd,
    };
    const br0 = this._brOf(raw);
    const k = br0 > 0 ? power / br0 : 1;

    const sk = (DATAX && DATAX.monsterSkillById && DATAX.monsterSkillById[spec.skill]) || null;
    const unit = {
      name: spec.name || 'Beast',
      emoji: spec.emoji || '\u{1F43E}',
      side: 'foe',
      element: spec.element || null,
      path: null,
      hp: Math.max(1, Math.round(raw.hp * k)),
      maxHp: Math.max(1, Math.round(raw.hp * k)),
      mp: 100, maxMp: 100,
      patk: Math.max(1, Math.round(raw.patk * k)),
      matk: Math.max(1, Math.round(raw.matk * k)),
      pdef: Math.max(1, Math.round(raw.pdef * k)),
      mdef: Math.max(1, Math.round(raw.mdef * k)),
      spd: Math.max(1, Math.round(raw.spd * k)),
      crit: CONFIG.combat.baseCrit + (role.crit || 0) + (spec.boss ? 0.05 : 0),
      critDmg: CONFIG.combat.baseCritDmg + (spec.boss ? 0.2 : 0),
      hit: CONFIG.combat.baseHit,
      dodge: CONFIG.combat.baseDodge + (role.dodge || 0),
      lifesteal: 0,
      skill: sk ? {
        id: sk.id, name: sk.name, cd: spec.boss ? 2 : 3,
        mult: sk.mult, kind: sk.kind, target: sk.target, effect: sk.effect,
      } : null,
      isPlayer: false,
      isThrall: false,
    };
    return unit;
  },

  /* The full encounter for one stage. Uses the zone's monster pool, +/-10%
     variance per foe, role templates from the monster table, and the zone's
     boss template on every 10th stage. */
  _rollFoes(z, stage) {
    const boss = this._isBoss(stage);
    const base = this._enemyPower(z, stage);
    const pv = CONFIG.wilds.powerVariance;

    if (boss) {
      const b = z.boss || {};
      return [this._makeFoe({
        name: b.name || ((z.name || 'The Wilds') + ' Warden'),
        emoji: b.emoji || '\u{1F479}',
        element: b.element || null,
        role: b.role || 'bruiser',
        skill: b.skill || 'heavyBlow',
        power: base * this._BOSS_MULT * U.rand(1 - pv * 0.5, 1 + pv * 0.5),
        boss: true,
        zone: z.id,
        stage: stage,
      })];
    }

    const pool = Array.isArray(z.monsters) ? z.monsters : [];
    const n = U.rint(1, 3);
    const per = base / Math.pow(n, 0.75);
    const out = [];
    for (let i = 0; i < n; i++) {
      const mid = pool.length ? pool[U.rint(0, pool.length - 1)] : null;
      const m = (mid && DATAX && DATAX.monsterById && DATAX.monsterById[mid]) || null;
      out.push(this._makeFoe({
        name: (m && m.name) || 'Wild Beast',
        emoji: (m && m.emoji) || '\u{1F43E}',
        element: (m && m.element) || null,
        role: (m && m.role) || 'bruiser',
        skill: (m && m.skill) || 'heavyBlow',
        power: per * U.rand(1 - pv, 1 + pv),
        boss: false,
        zone: z.id,
        stage: stage,
      }));
    }
    return out;
  },

  _allies() {
    let me = null;
    try {
      if (typeof Stats !== 'undefined' && Stats && typeof Stats.unit === 'function') me = Stats.unit();
    } catch (e) { me = null; }
    if (!me || !(me.maxHp > 0)) {
      me = this._localFoe({ name: S.player.name || 'You', emoji: '\u{1F9D8}', role: 'bruiser', power: 100 });
      me.side = 'ally'; me.isPlayer = true;
    }
    me.side = 'ally';
    return [me];
  },

  /* =======================================================================
   * LOOT
   * ===================================================================== */

  _newLoot() {
    return { stone: 0, jade: 0, lawShard: 0, exp: 0, mats: {}, formulas: [], curios: [], blueprints: [], pills: [] };
  },

  _mergeLoot(a, b) {
    a.stone += b.stone || 0;
    a.jade += b.jade || 0;
    a.lawShard += b.lawShard || 0;
    a.exp += b.exp || 0;
    for (const k in b.mats) a.mats[k] = (a.mats[k] || 0) + b.mats[k];
    for (const x of b.formulas) a.formulas.push(x);
    for (const x of b.curios) a.curios.push(x);
    for (const x of b.blueprints) a.blueprints.push(x);
    for (const x of b.pills) a.pills.push(x);
    return a;
  },

  _lootAny(l) {
    if (!l) return false;
    if (l.stone || l.jade || l.lawShard || l.exp) return true;
    if (l.formulas.length || l.curios.length || l.blueprints.length || l.pills.length) return true;
    for (const k in l.mats) if (l.mats[k] > 0) return true;
    return false;
  },

  _rollDrop(z, stage, boss) {
    const l = this._newLoot();
    const P = this._enemyPower(z, stage);
    const tier = U.clamp(Math.floor(z.tier || 1), 1, 6);
    const mult = this._lootMult();
    const bm = boss ? 3.2 : 1;

    l.stone = Math.max(1, Math.round(3.2 * Math.pow(P, 0.62) * bm * U.rand(0.85, 1.15) * mult));
    l.exp = Math.round(this._auraSec() * (boss ? 80 : 20));

    const amt = () => Math.max(1, Math.round((1 + Math.floor(stage / 10) + U.rint(0, 1)) * (boss ? 3 : 1) * mult));
    if (boss || U.chance(0.55)) l.mats['herb:' + tier] = (l.mats['herb:' + tier] || 0) + amt();
    if (boss || U.chance(0.40)) l.mats['core:' + tier] = (l.mats['core:' + tier] || 0) + amt();
    if (boss || U.chance(0.32)) l.mats['forge:' + tier] = (l.mats['forge:' + tier] || 0) + amt();
    if (U.chance(0.10 + stage * 0.002)) l.mats['seed:' + tier] = (l.mats['seed:' + tier] || 0) + 1;

    if (z.remix) {
      if (boss) l.lawShard += U.rint(1, 3);
      else if (U.chance(0.10)) l.lawShard += 1;
    }

    if (boss) {
      if (U.chance(0.12)) {
        const f = this._randomUnowned('formula', tier);
        if (f) l.formulas.push(f);
      }
      if (U.chance(0.06)) {
        const c = this._randomUnowned('curio', tier);
        if (c) l.curios.push(c);
      }
      if (stage > this._stageOf(z.id)) l.jade += 2 + tier;
    }
    return l;
  },

  _randomUnowned(kind, tier) {
    if (kind === 'formula') {
      const owned = (S.inv && Array.isArray(S.inv.formulas)) ? S.inv.formulas : [];
      const pool = (DATA.formulas || []).filter(f =>
        f && f.id && (f.rank || 1) <= (tier || 6) && owned.indexOf(f.id) < 0);
      const p = U.pick(pool);
      return p ? p.id : null;
    }
    if (kind === 'curio') {
      const owned = (S.curios && Array.isArray(S.curios.owned)) ? S.curios.owned : [];
      const pool = (DATA.curios || []).filter(c => c && c.id && owned.indexOf(c.id) < 0);
      const p = U.pick(pool);
      return p ? p.id : null;
    }
    if (kind === 'blueprint') {
      const owned = (S.inv && Array.isArray(S.inv.blueprints)) ? S.inv.blueprints : [];
      const pool = (DATA.blueprints || []).filter(b =>
        b && b.id && (b.rank || 1) <= (tier || 6) && owned.indexOf(b.id) < 0);
      const p = U.pick(pool);
      return p ? p.id : null;
    }
    return null;
  },

  _grantLoot(l) {
    if (!l) return;
    if (l.stone > 0) Econ.grant('stone', l.stone);
    if (l.jade > 0) Econ.grant('jade', l.jade);
    if (l.lawShard > 0) Econ.grant('lawShard', l.lawShard);
    for (const k in l.mats) if (l.mats[k] > 0) Econ.grant(k, l.mats[k]);

    if (l.exp > 0) {
      try {
        if (typeof Cultivation !== 'undefined' && Cultivation && typeof Cultivation.addExp === 'function') {
          Cultivation.addExp(l.exp, 'wilds');
        }
      } catch (e) {}
    }

    if (!S.inv) S.inv = { pills: {}, formulas: [], blueprints: [], gear: [], nextUid: 1 };
    if (!Array.isArray(S.inv.formulas)) S.inv.formulas = [];
    if (!Array.isArray(S.inv.blueprints)) S.inv.blueprints = [];
    if (!S.inv.pills || typeof S.inv.pills !== 'object') S.inv.pills = {};

    for (const id of l.formulas) if (S.inv.formulas.indexOf(id) < 0) S.inv.formulas.push(id);
    for (const id of l.blueprints) if (S.inv.blueprints.indexOf(id) < 0) S.inv.blueprints.push(id);
    for (const key of l.pills) S.inv.pills[key] = (S.inv.pills[key] || 0) + 1;

    for (const id of l.curios) {
      let done = false;
      try {
        if (typeof Curios !== 'undefined' && Curios && typeof Curios.own === 'function') { Curios.own(id); done = true; }
      } catch (e) { done = false; }
      if (!done) {
        if (!S.curios || !Array.isArray(S.curios.owned)) S.curios = { owned: [] };
        if (S.curios.owned.indexOf(id) < 0) { S.curios.owned.push(id); Bus.emit('curioGain', { id: id }); }
      }
    }
    try { Stats.recompute(); } catch (e) {}
  },

  _lootLines(l) {
    const rows = [];
    if (!l) return rows;
    if (l.stone > 0) rows.push({ icon: this._icon('stone'), label: 'Spiritstone', amount: '+' + Fmt.n(l.stone) });
    if (l.jade > 0) rows.push({ icon: this._icon('jade'), label: 'Jade', amount: '+' + Fmt.n(l.jade) });
    if (l.lawShard > 0) rows.push({ icon: this._icon('lawShard'), label: 'Law Shards', amount: '+' + Fmt.n(l.lawShard) });
    if (l.exp > 0) rows.push({ icon: '\u{1F300}', label: 'Cultivation', amount: '+' + Fmt.n(l.exp) + ' EXP' });
    for (const k in l.mats) {
      if (!(l.mats[k] > 0)) continue;
      rows.push({ icon: this._icon(k), label: this._label(k), amount: '+' + Fmt.n(l.mats[k]) });
    }
    for (const id of l.formulas) {
      const f = (DATAX && DATAX.formulaById && DATAX.formulaById[id]) || null;
      rows.push({ icon: (f && f.emoji) || '\u{1F4DC}', label: 'Formula', amount: (f && f.name) || id });
    }
    for (const id of l.blueprints) {
      const b = (DATA.blueprints || []).find(x => x && x.id === id);
      rows.push({ icon: '\u{1F4D0}', label: 'Blueprint', amount: (b && b.name) || id });
    }
    for (const id of l.curios) {
      const c = (DATAX && DATAX.curioById && DATAX.curioById[id]) || null;
      rows.push({ icon: (c && c.emoji) || '\u{1F5FF}', label: 'Curio', amount: (c && c.name) || id });
    }
    for (const key of l.pills) {
      const cut = String(key).lastIndexOf('_');
      const f = cut > 0 ? (DATAX.formulaById[key.slice(0, cut)] || null) : null;
      rows.push({ icon: (f && f.emoji) || '\u{1F48A}', label: 'Pill', amount: (f && f.name) || key });
    }
    return rows;
  },

  /* Writes html into a small sub-container only when it actually changed, so a
     500ms re-render does not churn the DOM. The panel skeleton itself is built
     exactly once in _build(). */
  _setHtml(el, html) {
    if (!el) return;
    if (el._wHtml === html) return;
    el._wHtml = html;
    el.innerHTML = html;
  },

  _icon(kind) {
    try { if (typeof Econ !== 'undefined' && Econ && Econ.icon) { const s = Econ.icon(kind); if (s) return s; } } catch (e) {}
    return '•';
  },

  _label(kind) {
    try { if (typeof Econ !== 'undefined' && Econ && Econ.label) { const s = Econ.label(kind); if (s) return s; } } catch (e) {}
    return String(kind);
  },

  _showLoot(title, rows, extra) {
    const body = document.createElement('div');
    let html = extra ? ('<p class="tiny muted">' + extra + '</p>') : '';
    if (!rows.length) html += '<div class="empty">The beasts carried nothing worth carrying home.</div>';
    else {
      html += '<div class="sec">';
      for (const r of rows) {
        html += '<div class="kv"><span class="k">' + r.icon + ' ' + r.label +
                '</span><span class="v good">' + r.amount + '</span></div>';
      }
      html += '</div>';
    }
    body.innerHTML = html;
    try {
      UI.sheet({ title: title, body: body, buttons: [{ label: 'Take it', cls: 'primary', act: (c) => c() }] });
    } catch (e) {
      try { UI.toast(title, 'good'); } catch (e2) {}
    }
  },

  /* =======================================================================
   * HUNTING
   * ===================================================================== */

  /* Pre-battle sheet: the foes, their BR, and the Ward / Fury pill slots. */
  _openFight(zoneId, stage) {
    const z = this._zone(zoneId);
    if (!z) return;
    if (!this._unlocked(z)) { UI.toast('That ground is closed to you — ' + this._needRealmName(z) + ' first.', 'bad'); return; }
    if (this._busy) return;

    const rec = this._zrec(zoneId);
    const s = U.clamp(Math.floor(stage), 1, CONFIG.wilds.stagesPerZone);
    if (s > rec.stage + 1) { UI.toast('Clear stage ' + (rec.stage + 1) + ' first.', 'bad'); return; }

    const boss = this._isBoss(s);
    const foes = this._rollFoes(z, s);
    this._ward = null;
    this._fury = null;

    const body = document.createElement('div');
    const wards = this._pillsOfType('ward');
    const furies = this._pillsOfType('fury');

    let html = '<div class="row between"><span class="chip">' + z.emoji + ' ' + z.name +
               '</span><span class="chip' + (boss ? ' bg-gold' : '') + '">Stage ' + s + (boss ? ' — Boss' : '') + '</span></div>';
    if (boss && z.boss && z.boss.blurb) html += '<p class="tiny muted serif">' + z.boss.blurb + '</p>';
    html += '<div class="sec"><div class="lbl">Facing you</div>';
    for (const f of foes) {
      html += '<div class="kv"><span class="k">' + f.emoji + ' ' + f.name +
              (f.element ? ' <span class="tiny muted">(' + f.element + ')</span>' : '') +
              '</span><span class="v">BR ' + Fmt.n(this._brOf(f)) + '</span></div>';
    }
    let myBr = 0;
    try { myBr = Stats.br(); } catch (e) { myBr = 0; }
    const foeBr = foes.reduce((a, f) => a + this._brOf(f), 0);
    const odds = myBr > 0 ? myBr / Math.max(1, foeBr) : 0;
    const oddsCls = odds >= 1.15 ? 'good' : (odds >= 0.8 ? 'gold' : 'bad');
    const oddsTxt = odds >= 1.5 ? 'Comfortable' : (odds >= 1.05 ? 'Favourable' : (odds >= 0.8 ? 'Even' : 'Grim'));
    html += '<div class="kv"><span class="k">Your Battle Rating</span><span class="v ' + oddsCls + '">' +
            Fmt.n(myBr) + ' vs ' + Fmt.n(foeBr) + ' — ' + oddsTxt + '</span></div></div>';

    html += '<div class="sec"><div class="lbl">Pre-battle pills</div><div class="row wrap" id="wPills">';
    if (!wards.length && !furies.length) {
      html += '<span class="tiny muted">No Ward or Fury pills in your pouch.</span>';
    } else {
      if (wards.length) {
        const w0 = wards[0];
        html += '<button class="pill-chip" data-pk="ward" data-key="' + w0.key + '">\u{1F6E1}️ <b>Ward x' + w0.n + '</b></button>';
      }
      if (furies.length) {
        const f0 = furies[0];
        html += '<button class="pill-chip" data-pk="fury" data-key="' + f0.key + '">\u{1F525} <b>Fury x' + f0.n + '</b></button>';
      }
    }
    html += '</div><div class="tiny muted" id="wPillNote">Ward raises defence by ' +
            Fmt.pct(CONFIG.alchemy.wardDefBonus, 0) + '; Fury raises attack by ' +
            Fmt.pct(CONFIG.alchemy.furyAtkBonus, 0) + '. Consumed on entry.</div></div>';
    body.innerHTML = html;

    body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pk]');
      if (!b) return;
      const kind = b.dataset.pk;
      const key = b.dataset.key;
      if (kind === 'ward') this._ward = (this._ward === key) ? null : key;
      else this._fury = (this._fury === key) ? null : key;
      b.classList.toggle('bg-gold', (kind === 'ward' ? this._ward : this._fury) === key);
    });

    const cleared = s <= rec.stage;
    const buttons = [
      { label: 'Fight', cls: 'primary', act: (close) => { close(); this._runFight(z, s, foes, false); } },
    ];
    if (cleared) buttons.push({ label: 'Skip', cls: 'ghost', act: (close) => { close(); this._runFight(z, s, foes, true); } });
    buttons.push({ label: 'Back', cls: 'ghost', act: (close) => close() });

    UI.sheet({ title: boss ? 'Boss — Stage ' + s : 'Hunt — Stage ' + s, body: body, buttons: buttons });
  },

  /* Consume the chosen pre-battle pills and return the Combat opts. */
  _consumePrePills() {
    const opts = {};
    if (this._ward) { if (this._consumePill(this._ward)) opts.wardPill = true; this._ward = null; }
    if (this._fury) { if (this._consumePill(this._fury)) opts.furyPill = true; this._fury = null; }
    return opts;
  },

  _pillsOfType(type) {
    const out = [];
    const inv = (S.inv && S.inv.pills) || {};
    for (const k in inv) {
      const n = inv[k];
      if (!(n > 0)) continue;
      const cut = String(k).lastIndexOf('_');
      if (cut <= 0) continue;
      const f = (DATAX && DATAX.formulaById && DATAX.formulaById[k.slice(0, cut)]) || null;
      if (!f || f.type !== type) continue;
      out.push({ key: k, n: n, f: f, quality: k.slice(cut + 1) });
    }
    out.sort((a, b) => (b.f.rank || 0) - (a.f.rank || 0));
    return out;
  },

  _consumePill(key) {
    let ok = false;
    try {
      if (typeof Alchemy !== 'undefined' && Alchemy && typeof Alchemy.usePill === 'function') ok = !!Alchemy.usePill(key);
    } catch (e) { ok = false; }
    if (ok) return true;
    const inv = (S.inv && S.inv.pills) || null;
    if (!inv || !(inv[key] > 0)) return false;
    inv[key] -= 1;
    if (inv[key] <= 0) delete inv[key];
    const cut = String(key).lastIndexOf('_');
    const f = cut > 0 ? (DATAX.formulaById[key.slice(0, cut)] || null) : null;
    Bus.emit('pillUsed', {
      formulaId: f ? f.id : key, type: f ? f.type : 'ward',
      rank: f ? (f.rank || 1) : 1, quality: cut > 0 ? key.slice(cut + 1) : 'gray',
    });
    return true;
  },

  _runFight(z, stage, foes, skip) {
    if (this._busy) return;
    this._busy = true;
    const boss = this._isBoss(stage);
    const opts = this._consumePrePills();
    const allies = this._allies();

    const finish = (res) => {
      this._busy = false;
      this._afterFight(res, z, stage, boss, false);
    };

    if (skip || typeof Combat === 'undefined' || !Combat || typeof Combat.play !== 'function') {
      let res = null;
      try { res = Combat.simulate(allies, foes, opts); } catch (e) { res = null; }
      if (!res) { this._busy = false; UI.toast('The wilds are quiet — combat is unavailable.', 'bad'); return; }
      finish(res);
      return;
    }

    try {
      Combat.play({
        allies: allies,
        foes: foes,
        opts: opts,
        title: (boss ? (z.boss && z.boss.name) || 'Boss' : z.name + ' — Stage ' + stage),
        canSkip: true,
        prePills: { ward: !!opts.wardPill, fury: !!opts.furyPill },
        onDone: (res) => finish(res),
      });
    } catch (e) {
      this._busy = false;
      UI.toast('The fight would not start.', 'bad');
    }
  },

  /* Resolve a completed fight: progression, drops, events. */
  _afterFight(res, z, stage, boss, silent) {
    if (!res) return;
    const rec = this._zrec(z.id);

    if (!res.win) {
      if (!silent) {
        UI.toast('Driven off. The wilds keep what they take.', 'bad');
        try { UI.flash('red'); } catch (e) {}
      }
      UI.dirty('wilds');
      return;
    }

    const first = stage === rec.stage + 1;
    if (first) rec.stage = stage;
    rec.cleared++;

    if (!S.stats || typeof S.stats !== 'object') S.stats = {};
    S.stats.hunts = (S.stats.hunts || 0) + 1;
    if (boss) S.stats.bosses = (S.stats.bosses || 0) + 1;

    const loot = this._rollDrop(z, stage, boss);
    this._grantLoot(loot);

    Bus.emit('huntClear', { zone: z.id, stage: stage, boss: !!boss });

    if (!silent) {
      if (U.chance(CONFIG.wilds.fortuityHuntChance)) {
        if (this._fortPush()) UI.toast('Something glints in the underbrush.', 'gold');
      }
      const head = first
        ? (boss ? 'Boss felled — Expedition Level ' + rec.stage : 'Stage ' + stage + ' cleared')
        : 'Stage ' + stage + ' cleared again';
      this._showLoot(head, this._lootLines(loot), first && boss ? 'The ground behind you is finally quiet.' : '');
      if (first && boss) { try { UI.flash('gold'); } catch (e) {} }
      if (first && stage < CONFIG.wilds.stagesPerZone) this._stage = stage + 1;
    }

    this._syncBadge();
    UI.dirty('wilds');
    try { Save.save(); } catch (e) {}
  },

  /* =======================================================================
   * AUTO-HUNT
   * ===================================================================== */

  _autoUnlocked() {
    if (S.flags && S.flags.autoHunt) return true;
    if (S.settings && S.settings.autoHuntUnlocked) return true;
    const bought = (S.shops && S.shops.bought) || {};
    const shops = (DATA.shops && typeof DATA.shops === 'object') ? DATA.shops : {};
    for (const key in shops) {
      const list = shops[key];
      if (!Array.isArray(list)) continue;
      for (const it of list) {
        if (it && it.qol === 'autoHunt' && bought[it.id]) return true;
      }
    }
    return false;
  },

  _autoPool() {
    const w = this._st();
    if (!w.auto.pool || typeof w.auto.pool !== 'object') w.auto.pool = this._newLoot();
    const p = w.auto.pool;
    if (!p.mats || typeof p.mats !== 'object') p.mats = {};
    if (!Array.isArray(p.formulas)) p.formulas = [];
    if (!Array.isArray(p.curios)) p.curios = [];
    if (!Array.isArray(p.blueprints)) p.blueprints = [];
    if (!Array.isArray(p.pills)) p.pills = [];
    p.stone = p.stone || 0; p.jade = p.jade || 0; p.lawShard = p.lawShard || 0; p.exp = p.exp || 0;
    return p;
  },

  _autoPoolAny() {
    const w = S.wilds;
    if (!w || !w.auto || !w.auto.pool) return false;
    return this._lootAny(this._autoPool());
  },

  _autoZone() {
    const w = this._st();
    if (w.auto.zone && this._zone(w.auto.zone)) return w.auto.zone;
    if (this._zoneId) return this._zoneId;
    if (w.expedition.zone) return w.expedition.zone;
    // best cleared zone
    let best = null, bestStage = -1;
    for (const z of this._zones()) {
      const st = this._stageOf(z.id);
      if (st > bestStage) { bestStage = st; best = z.id; }
    }
    return best;
  },

  _autoToggle() {
    if (!S.settings || typeof S.settings !== 'object') S.settings = {};
    if (!this._autoUnlocked()) {
      UI.toast('Auto-Hunt is a Jade Pavilion convenience — buy it there first.', 'bad');
      return;
    }
    const on = !S.settings.autoHunt;
    S.settings.autoHunt = on;
    const w = this._st();
    if (on) {
      const zid = this._zoneId || this._autoZone();
      const rec = zid ? this._zrec(zid) : null;
      if (!zid || !rec || rec.stage < 1) {
        S.settings.autoHunt = false;
        UI.toast('Clear a stage by hand before letting it run itself.', 'bad');
        UI.dirty('wilds');
        return;
      }
      w.auto.zone = zid;
      w.auto.nextAt = Date.now() + this._AUTO_SEC * 1000;
      w.auto.runs = 0;
      UI.toast('Auto-Hunt engaged — ' + ((this._zone(zid) || {}).name || 'the wilds') + ' stage ' + rec.stage + '.', 'good');
    } else {
      UI.toast('Auto-Hunt stood down.', 'info');
    }
    UI.dirty('wilds');
    try { Save.save(); } catch (e) {}
  },

  _autoTick(now) {
    if (!S.settings || !S.settings.autoHunt) return;
    if (!this._autoUnlocked()) { S.settings.autoHunt = false; return; }

    const w = this._st();
    const zid = w.auto.zone || this._autoZone();
    const z = this._zone(zid);
    if (!z || !this._unlocked(z)) { S.settings.autoHunt = false; return; }
    w.auto.zone = zid;

    const rec = this._zrec(zid);
    if (rec.stage < 1) { S.settings.autoHunt = false; return; }

    // A stale timer (tab backgrounded, clock moved) resolves to "run once now"
    // rather than replaying the whole gap.
    if (!(w.auto.nextAt > 0)) w.auto.nextAt = now + this._AUTO_SEC * 1000;
    else if (w.auto.nextAt < now - 60000) w.auto.nextAt = now;
    if (now < w.auto.nextAt) return;

    const stage = rec.stage;
    const boss = this._isBoss(stage);
    const pool = this._autoPool();
    let runs = 0;

    while (now >= w.auto.nextAt && runs < this._AUTO_MAX_PER_TICK) {
      w.auto.nextAt += this._AUTO_SEC * 1000;
      runs++;

      const foes = this._rollFoes(z, stage);
      let res = null;
      try {
        if (typeof Combat !== 'undefined' && Combat && typeof Combat.simulate === 'function') {
          res = Combat.simulate(this._allies(), foes, {});
        }
      } catch (e) { res = null; }
      if (!res) { S.settings.autoHunt = false; return; }

      if (!res.win) {
        S.settings.autoHunt = false;
        UI.toast('Auto-Hunt broke off — stage ' + stage + ' bit back.', 'bad');
        UI.dirty('wilds');
        break;
      }

      rec.cleared++;
      if (!S.stats || typeof S.stats !== 'object') S.stats = {};
      S.stats.hunts = (S.stats.hunts || 0) + 1;
      if (boss) S.stats.bosses = (S.stats.bosses || 0) + 1;
      w.auto.runs = (w.auto.runs || 0) + 1;

      this._mergeLoot(pool, this._rollDrop(z, stage, boss));
      Bus.emit('huntClear', { zone: z.id, stage: stage, boss: !!boss });
    }

    if (runs > 0) { this._syncBadge(); UI.dirty('wilds'); }
  },

  _autoClaim() {
    const pool = this._autoPool();
    if (!this._lootAny(pool)) { UI.toast('The auto-hunt pouch is empty.', 'info'); return; }
    const rows = this._lootLines(pool);
    const runs = (this._st().auto.runs) || 0;
    this._grantLoot(pool);
    const w = this._st();
    w.auto.pool = this._newLoot();
    w.auto.runs = 0;
    this._showLoot('Auto-Hunt Spoils', rows, runs + ' hunt' + (runs === 1 ? '' : 's') + ' while you watched something else.');
    this._syncBadge();
    UI.dirty('wilds');
    try { Save.save(); } catch (e) {}
  },

  /* =======================================================================
   * EXPEDITION
   * ===================================================================== */

  _expCapMs() {
    const extra = this._bonus('offlineHours');
    const h = CONFIG.wilds.expeditionCapH + (Number.isFinite(extra) ? extra : 0);
    return Math.max(1, h) * 3600000;
  },

  /* DERIVED accumulator — clamp(now - startedAt, 0, cap). Because it is derived
     from an absolute epoch, tick() and the Offline provider can both call this
     as often as they like and no second of progress is ever counted twice. */
  _expElapsed(now) {
    const w = this._st();
    const e = w.expedition;
    if (!e.zone) { e.sinceMs = 0; return 0; }
    if (!(e.startedAt > 0) || e.startedAt > now) e.startedAt = now;
    let ms = now - e.startedAt;
    if (!(ms > 0)) ms = 0;
    const cap = this._expCapMs();
    if (ms > cap) ms = cap;
    e.sinceMs = ms;
    return ms;
  },

  /* PUBLIC: {stone, exp, herb, core, forge} per hour for the assigned zone
     (or a named one). Returns zeroes when nothing is assigned. */
  expeditionRate(zoneId) {
    const w = this._st();
    const id = zoneId || w.expedition.zone;
    const z = this._zone(id);
    const out = { stone: 0, exp: 0, herb: 0, core: 0, forge: 0, tier: 1, zone: id || null };
    if (!z) return out;

    const stage = Math.max(1, this._stageOf(z.id));
    const sp = this._enemyPower(z, stage);
    const mult = CONFIG.wilds.expeditionBaseRate *
                 (1 + this._bonus('expedition')) *
                 (1 + (this._baitActive() ? CONFIG.alchemy.baitLootBonus : 0));

    out.tier = U.clamp(Math.floor(z.tier || 1), 1, 6);
    out.stone = 30 * Math.pow(sp, 0.62) * mult;
    out.exp = this._auraSec() * 3600 * (0.15 + 0.010 * stage) * mult;
    out.herb = (0.50 + 0.090 * stage) * mult;
    out.core = (0.35 + 0.060 * stage) * mult;
    out.forge = (0.30 + 0.050 * stage) * mult;
    return out;
  },

  _expAssign(zoneId) {
    const z = this._zone(zoneId);
    if (!z) return;
    if (!this._unlocked(z)) { UI.toast('Closed to you until ' + this._needRealmName(z) + '.', 'bad'); return; }
    if (this._stageOf(z.id) < 1) { UI.toast('Clear a stage there before sending anyone to camp.', 'bad'); return; }

    const w = this._st();
    const now = Date.now();
    if (w.expedition.zone && w.expedition.zone !== z.id && this._expElapsed(now) > 60000) {
      UI.confirm('Move camp?', 'Unclaimed expedition spoils from ' +
        ((this._zone(w.expedition.zone) || {}).name || 'the old camp') + ' will be lost.', () => {
          w.expedition.zone = z.id;
          w.expedition.startedAt = Date.now();
          w.expedition.sinceMs = 0;
          UI.toast('Camp struck and re-pitched in ' + z.name + '.', 'good');
          UI.dirty('wilds');
          try { Save.save(); } catch (e) {}
        });
      return;
    }

    w.expedition.zone = z.id;
    w.expedition.startedAt = now;
    w.expedition.sinceMs = 0;
    UI.toast('Expedition camped in ' + z.name + '.', 'good');
    UI.dirty('wilds');
    try { Save.save(); } catch (e) {}
  },

  _expRecall() {
    const w = this._st();
    if (!w.expedition.zone) return;
    if (this._expElapsed(Date.now()) > 60000) { this._expClaim(); }
    w.expedition.zone = null;
    w.expedition.startedAt = 0;
    w.expedition.sinceMs = 0;
    UI.toast('Expedition recalled.', 'info');
    UI.dirty('wilds');
    try { Save.save(); } catch (e) {}
  },

  _expClaim() {
    const w = this._st();
    const e = w.expedition;
    if (!e.zone) { UI.toast('No expedition is out.', 'info'); return; }
    const now = Date.now();
    const ms = this._expElapsed(now);
    if (ms < 60000) { UI.toast('Give them at least a minute.', 'info'); return; }

    const z = this._zone(e.zone);
    const r = this.expeditionRate(e.zone);
    const h = ms / 3600000;
    const tier = r.tier;

    const loot = this._newLoot();
    loot.stone = Math.floor(r.stone * h);
    loot.exp = Math.round(r.exp * h);
    const herb = Math.floor(r.herb * h);
    const core = Math.floor(r.core * h);
    const forge = Math.floor(r.forge * h);
    if (herb > 0) loot.mats['herb:' + tier] = herb;
    if (core > 0) loot.mats['core:' + tier] = core;
    if (forge > 0) loot.mats['forge:' + tier] = forge;
    if (z && z.remix) loot.lawShard = Math.floor(h * 0.5);

    this._grantLoot(loot);
    e.startedAt = now;
    e.sinceMs = 0;

    Bus.emit('expeditionClaim', {});
    this._showLoot('Expedition Returns', this._lootLines(loot),
      Fmt.dur(ms / 1000) + ' in ' + ((z && z.name) || 'the wilds') + '.');
    this._syncBadge();
    UI.dirty('wilds');
    try { Save.save(); } catch (e) {}
  },

  /* =======================================================================
   * FORTUITY
   * ===================================================================== */

  _teaLevel() { return (S.abode && S.abode.rooms && S.abode.rooms.tea) || 0; },

  _fortInterval() {
    const base = U.rint(CONFIG.wilds.fortuityMinSec, CONFIG.wilds.fortuityMaxSec) * 1000;
    const cut = 1 - CONFIG.abode.teaRoomFortuityBonus * this._teaLevel();
    return Math.max(1000, base * Math.max(0.25, cut));
  },

  _fortTick(now) {
    if (S.player.realm < CONFIG.unlocks.wilds) return 0;
    const w = this._st();
    const f = w.fortuity;
    const max = CONFIG.wilds.fortuityQueueMax;

    if (!(f.nextAt > 0)) { f.nextAt = now + this._fortInterval(); return 0; }

    let added = 0, guard = 0;
    while (now >= f.nextAt && guard++ < 24) {
      if (f.queue.length >= max) { f.nextAt = now + this._fortInterval(); break; }
      if (this._fortPush()) added++;
      f.nextAt += this._fortInterval();
      if (f.nextAt < now - 3600000) f.nextAt = now + this._fortInterval();
    }
    return added;
  },

  _fortPush() {
    const events = Array.isArray(DATA.events) ? DATA.events : [];
    if (!events.length) return false;
    const w = this._st();
    const f = w.fortuity;
    if (f.queue.length >= CONFIG.wilds.fortuityQueueMax) return false;

    const weights = CONFIG.wilds.rarityWeights;
    const present = {};
    for (const ev of events) if (ev && ev.id) present[ev.rarity || 'C'] = true;
    const rarities = Object.keys(weights).filter(r => present[r]);
    if (!rarities.length) return false;

    const rarity = U.weightedPick(rarities, (r) => weights[r] || 0) || rarities[0];
    const inQueue = {};
    for (const q of f.queue) inQueue[q.eventId] = true;

    let pool = events.filter(e => e && e.id && (e.rarity || 'C') === rarity && !inQueue[e.id]);
    if (!pool.length) pool = events.filter(e => e && e.id && (e.rarity || 'C') === rarity);
    if (!pool.length) pool = events.filter(e => e && e.id);
    const ev = U.pick(pool);
    if (!ev) return false;

    f.queue.push({ eventId: ev.id, step: 0 });
    while (f.queue.length > CONFIG.wilds.fortuityQueueMax) f.queue.shift();
    this._syncBadge();
    return true;
  },

  _rarityInfo(r) {
    if (r === 'M') return { name: 'Mythic', cls: 'r-gold', bg: 'bg-gold' };
    if (r === 'E') return { name: 'Epic', cls: 'r-purple', bg: 'bg-purple' };
    if (r === 'R') return { name: 'Rare', cls: 'r-blue', bg: 'bg-blue' };
    return { name: 'Common', cls: 'r-green', bg: 'bg-green' };
  },

  _stepOf(ev, i) {
    if (!ev) return { text: '', choices: [] };
    if (Array.isArray(ev.steps) && ev.steps.length) {
      const s = ev.steps[U.clamp(Math.floor(i || 0), 0, ev.steps.length - 1)] || ev.steps[0];
      return { text: s.text || ev.text || '', choices: Array.isArray(s.choices) ? s.choices : [] };
    }
    return { text: ev.text || '', choices: Array.isArray(ev.choices) ? ev.choices : [] };
  },

  _openCard(idx) {
    const w = this._st();
    const entry = w.fortuity.queue[idx];
    if (!entry) return;
    const ev = (DATAX && DATAX.eventById && DATAX.eventById[entry.eventId]) || null;
    if (!ev) { w.fortuity.queue.splice(idx, 1); UI.dirty('wilds'); return; }

    const body = document.createElement('div');
    const modal = UI.modal({
      title: ev.title || 'A Fortuity',
      body: body,
      buttons: [{ label: 'Later', cls: 'ghost', act: (close) => close() }],
    });
    const close = () => { try { UI.closeModal(); } catch (e) {} };

    this._renderCard(body, entry, ev, close);
    body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ci]');
      if (!b || b.disabled) return;
      this._choose(entry, ev, +b.dataset.ci, body, close);
    });
    return modal;
  },

  _renderCard(host, entry, ev, close) {
    const step = this._stepOf(ev, entry.step);
    const info = this._rarityInfo(ev.rarity);
    const multi = Array.isArray(ev.steps) && ev.steps.length > 1;

    let html = '<div class="row between"><span class="chip ' + info.bg + '">' + info.name + '</span>';
    if (multi) html += '<span class="tiny muted mono">Step ' + ((entry.step || 0) + 1) + ' / ' + ev.steps.length + '</span>';
    html += '</div><p class="serif" style="margin:8px 0 4px">' + (step.text || '') + '</p>';
    html += '<div class="col" id="wChoices">';

    const choices = step.choices || [];
    for (let i = 0; i < choices.length; i++) {
      const c = choices[i];
      const chk = this._reqCheck(c.req);
      html += '<button class="btn wide' + (chk.ok ? '' : ' locked') + '" data-ci="' + i + '"' +
              (chk.ok ? '' : ' disabled') + '>' + (c.label || 'Choose') + '</button>';
      if (!chk.ok) html += '<div class="tiny bad" style="margin:-2px 0 4px">' + chk.reason + '</div>';
    }
    if (!choices.length) html += '<div class="empty">Nothing here answers you.</div>';
    html += '</div>';
    host.innerHTML = html;
  },

  _choose(entry, ev, ci, host, close) {
    const step = this._stepOf(ev, entry.step);
    const c = (step.choices || [])[ci];
    if (!c) return;
    const chk = this._reqCheck(c.req);
    if (!chk.ok) { UI.toast(chk.reason, 'bad'); return; }

    const out = this._pickOutcome(c);
    if (!out) return;

    const goNext = (out.next !== undefined && out.next !== null &&
                    Array.isArray(ev.steps) && ev.steps.length > (out.next | 0) && (out.next | 0) >= 0);

    const lines = this.applyEffects(out.effects, {
      source: 'fortuity', eventId: ev.id, rarity: ev.rarity, close: close, quiet: true,
    });

    if (goNext) {
      entry.step = out.next | 0;
      const banner = out.text ? ('<p class="tiny gold">' + out.text + '</p>') : '';
      this._renderCard(host, entry, ev, close);
      if (banner) host.insertAdjacentHTML('afterbegin', banner);
      if (lines.length) {
        for (const l of lines) UI.toast(l, 'good');
      }
      UI.dirty('wilds');
      try { Save.save(); } catch (e) {}
      return;
    }

    // terminal outcome — resolve and clear the card
    const w = this._st();
    const at = w.fortuity.queue.indexOf(entry);
    if (at >= 0) w.fortuity.queue.splice(at, 1);
    Bus.emit('fortuityResolve', { eventId: ev.id, rarity: ev.rarity || 'C' });

    close();
    const rows = lines.map(t => ({ icon: '✨', label: 'Fortune', amount: t }));
    this._showLoot(ev.title || 'Fortuity', rows, out.text || '');
    this._syncBadge();
    UI.dirty('wilds');
    try { Save.save(); } catch (e) {}
  },

  /* Weighted outcome roll, biased by the hidden Luck stat toward the outcomes
     with the more valuable effects. */
  _pickOutcome(choice) {
    const outs = Array.isArray(choice.outcomes) ? choice.outcomes.filter(o => o) : [];
    if (!outs.length) return { w: 1, text: '', effects: {} };
    if (outs.length === 1) return outs[0];

    const vals = outs.map(o => this._outcomeValue(o));
    let mean = 0;
    for (const v of vals) mean += v;
    mean /= vals.length;
    let lo = vals[0], hi = vals[0];
    for (const v of vals) { if (v < lo) lo = v; if (v > hi) hi = v; }
    const spread = Math.max(1e-6, hi - lo);
    const luck = U.clamp(S.player.luck || 0, CONFIG.wilds.luckMin, CONFIG.wilds.luckMax);
    const k = 2 * luck * CONFIG.wilds.luckOutcomeWeight;

    return U.weightedPick(outs, (o, i) => {
      const base = Number(o.w);
      const w = Number.isFinite(base) && base > 0 ? base : 1;
      const t = (vals[i] - mean) / spread;
      return Math.max(0.0001, w * (1 + k * t));
    }) || outs[0];
  },

  /* Crude value score for an effects object — only its ORDERING matters. */
  _outcomeValue(o) {
    const fx = (o && o.effects) || {};
    let v = 0;
    for (const k in fx) {
      const raw = fx[k];
      const n = (typeof raw === 'number') ? raw : 0;
      if (k === 'exp') { v += this._expAmount(raw) / Math.max(1, this._auraSec() * 360); continue; }
      if (k === 'stone') { v += n / 400; continue; }
      if (k === 'jade') { v += n * 3; continue; }
      if (k === 'tech') { v += n / 40; continue; }
      if (k === 'guide') { v += n * 2; continue; }
      if (k === 'citrine') { v += n / 50; continue; }
      if (k === 'insight') { v += n * 2; continue; }
      if (k === 'dust') { v += n / 30; continue; }
      if (k === 'stones') { v += n / 25; continue; }
      if (k === 'contribution') { v += n / 40; continue; }
      if (k === 'lawShard') { v += n * 3; continue; }
      if (k === 'luck') { v += n * 4; continue; }
      if (k === 'respiraCharge') { v += n * 5; continue; }
      if (k === 'seed') { v += n * 2; continue; }
      if (k === 'curio') { v += 45; continue; }
      if (k === 'formula') { v += 25; continue; }
      if (k === 'blueprint') { v += 20; continue; }
      if (k === 'pill') { v += 12; continue; }
      if (k === 'fight') { v += -6 + (Number(raw && raw.loot) || 1) * 4; continue; }
      if (k.indexOf(':') > 0) { v += n * (parseInt(k.split(':')[1], 10) || 1) * 1.2; continue; }
      v += n * 0.5;
    }
    return v;
  },

  /* --------------------------------------------------------- requirements */

  _reqCheck(req) {
    if (!req) return { ok: true, reason: '' };
    if (typeof req === 'function') {
      try { return req() ? { ok: true, reason: '' } : { ok: false, reason: 'You are not ready for this.' }; }
      catch (e) { return { ok: true, reason: '' }; }
    }
    if (typeof req === 'string') {
      const bits = req.split(':');
      if (bits.length === 3) { const o = {}; o[bits[0] + ':' + bits[1]] = +bits[2] || 1; return this._reqCheck(o); }
      if (bits.length === 2) { const o = {}; o[bits[0]] = +bits[1] || 1; return this._reqCheck(o); }
      return { ok: true, reason: '' };
    }
    if (typeof req !== 'object') return { ok: true, reason: '' };

    let ok = true;
    const parts = [];
    for (const k in req) {
      const v = req[k];
      if (k === 'realm') {
        if ((S.player.realm || 0) < v) ok = false;
        parts.push(((DATA.realms[v] || {}).name || ('Realm ' + v)));
        continue;
      }
      if (k === 'luck') {
        if ((S.player.luck || 0) < v) ok = false;
        parts.push('Luck ' + v);
        continue;
      }
      if (k === 'path') {
        if (S.player.path !== v) ok = false;
        parts.push(String(v).charAt(0).toUpperCase() + String(v).slice(1) + ' Path');
        continue;
      }
      if (k === 'law') {
        if (!S.player.law || (typeof v === 'string' && S.player.law !== v)) ok = false;
        parts.push('a chosen Law');
        continue;
      }
      if (k === 'br') {
        let br = 0; try { br = Stats.br(); } catch (e) {}
        if (br < v) ok = false;
        parts.push('BR ' + Fmt.n(v));
        continue;
      }
      if (k === 'curios') {
        const n = (S.curios && Array.isArray(S.curios.owned)) ? S.curios.owned.length : 0;
        if (n < v) ok = false;
        parts.push(v + ' curios');
        continue;
      }
      if (k === 'sect') {
        if (!S.sect || !S.sect.id) ok = false;
        parts.push('a sect');
        continue;
      }
      if (k === 'text' || k === 'note') continue;

      let can = false;
      try { can = Econ.can(k, v); } catch (e) { can = false; }
      if (!can) ok = false;
      parts.push(Fmt.n(v) + ' ' + this._label(k));
    }
    return { ok: ok, reason: ok ? '' : ('Requires ' + parts.join(', ')) };
  },

  /* =======================================================================
   * PUBLIC: applyEffects — the declarative fortuity resolver (CONTRACT §9)
   * Returns an array of human-readable lines describing what happened.
   * ===================================================================== */

  applyEffects(effects, ctx) {
    const out = [];
    if (!effects || typeof effects !== 'object') return out;
    ctx = ctx || {};
    let fight = null;

    for (const k in effects) {
      const raw = effects[k];

      if (k === 'exp') {
        const n = this._expAmount(raw);
        if (n > 0) {
          try {
            if (typeof Cultivation !== 'undefined' && Cultivation && Cultivation.addExp) Cultivation.addExp(n, 'fortuity');
          } catch (e) {}
          out.push('+' + Fmt.n(n) + ' Cultivation EXP');
        }
        continue;
      }

      if (k === 'luck') {
        const before = S.player.luck || 0;
        S.player.luck = U.clamp(before + (Number(raw) || 0), CONFIG.wilds.luckMin, CONFIG.wilds.luckMax);
        const d = S.player.luck - before;
        if (d !== 0) out.push((d > 0 ? 'Fortune favours you (+' : 'Fortune sours (') + d + ' Luck)');
        continue;
      }

      if (k === 'respiraCharge') {
        if (!S.respira || typeof S.respira !== 'object') S.respira = { charges: 0, chargeMs: 0, sinceSurge: 0, level: 0, capUp: 0 };
        const cap = CONFIG.respira.baseCap + (S.respira.capUp || 0) * CONFIG.respira.capPerUpgrade;
        const before = S.respira.charges || 0;
        S.respira.charges = U.clamp(before + (Number(raw) || 0), 0, cap);
        const d = S.respira.charges - before;
        if (d !== 0) out.push(Fmt.sign(d) + ' Respira charge' + (Math.abs(d) === 1 ? '' : 's'));
        continue;
      }

      if (k === 'curio') {
        const id = (raw === 'random' || raw === true) ? this._randomUnowned('curio', 6) : String(raw);
        if (id) {
          const c = (DATAX && DATAX.curioById && DATAX.curioById[id]) || null;
          const l = this._newLoot(); l.curios.push(id); this._grantLoot(l);
          out.push('Curio: ' + ((c && c.name) || id));
        } else {
          Econ.grant('citrine', 400);
          out.push('Nothing left to collect — 400 Citrine instead');
        }
        continue;
      }

      if (k === 'formula') {
        const tier = U.clamp((S.player.realm || 0) + 1, 1, 6);
        const id = (raw === 'random' || raw === true) ? this._randomUnowned('formula', tier) : String(raw);
        if (id) {
          const l = this._newLoot(); l.formulas.push(id); this._grantLoot(l);
          const f = (DATAX && DATAX.formulaById && DATAX.formulaById[id]) || null;
          out.push('Formula: ' + ((f && f.name) || id));
        } else { Econ.grant('stone', 2000); out.push('The scroll was blank — 2K Spiritstone instead'); }
        continue;
      }

      if (k === 'blueprint') {
        const tier = U.clamp((S.player.realm || 0) + 1, 1, 6);
        const id = (raw === 'random' || raw === true) ? this._randomUnowned('blueprint', tier) : String(raw);
        if (id) {
          const l = this._newLoot(); l.blueprints.push(id); this._grantLoot(l);
          const b = (DATA.blueprints || []).find(x => x && x.id === id);
          out.push('Blueprint: ' + ((b && b.name) || id));
        } else { Econ.grant('stones', 300); out.push('The plan was familiar — 300 Forge Stones instead'); }
        continue;
      }

      if (k === 'pill') {
        const key = this._randomPillKey(raw);
        if (key) {
          const l = this._newLoot(); l.pills.push(key); this._grantLoot(l);
          const cut = key.lastIndexOf('_');
          const f = (DATAX.formulaById[key.slice(0, cut)]) || null;
          out.push('Pill: ' + ((f && f.name) || key));
        }
        continue;
      }

      if (k === 'seed') {
        const tier = U.clamp((S.player.realm || 0) + 1, 1, 6);
        const n = Math.max(1, Math.round(Number(raw) || 1));
        Econ.grant('seed:' + tier, n);
        out.push('+' + n + ' ' + this._label('seed:' + tier));
        continue;
      }

      if (k === 'fight') { fight = raw; continue; }
      if (k === 'text' || k === 'note' || k === 'flavor') continue;

      // everything else is an Econ kind: 'stone', 'jade', 'herb:2', 'fruit', ...
      const n = Math.round(Number(raw) || 0);
      if (!n) continue;
      if (n > 0) {
        Econ.grant(k, n);
        out.push('+' + Fmt.n(n) + ' ' + this._label(k));
      } else {
        let spent = false;
        try { spent = Econ.spend(k, -n); } catch (e) { spent = false; }
        if (spent) out.push('-' + Fmt.n(-n) + ' ' + this._label(k));
      }
    }

    try { Stats.recompute(); } catch (e) {}

    if (fight) {
      if (typeof ctx.close === 'function') { try { ctx.close(); } catch (e) {} }
      this._effectFight(fight, ctx);
      out.push('A fight found you.');
    }
    return out;
  },

  /* '30m' -> 30 minutes of the CURRENT aura; a raw number passes through. */
  _expAmount(raw) {
    if (typeof raw === 'number') return Math.max(0, Math.round(raw));
    const s = String(raw || '').trim();
    const m = /^(\d+(?:\.\d+)?)\s*([smhd])?$/i.exec(s);
    if (!m) return 0;
    const v = parseFloat(m[1]);
    if (!Number.isFinite(v)) return 0;
    const unit = (m[2] || 'm').toLowerCase();
    const secs = unit === 's' ? v : unit === 'h' ? v * 3600 : unit === 'd' ? v * 86400 : v * 60;
    return Math.max(0, Math.round(this._auraSec() * secs));
  },

  _randomPillKey(raw) {
    const owned = (S.inv && Array.isArray(S.inv.formulas)) ? S.inv.formulas : [];
    const tier = U.clamp((S.player.realm || 0) + 1, 1, CONFIG.alchemy.ranks);
    let pool = (DATA.formulas || []).filter(f => f && f.id && owned.indexOf(f.id) >= 0);
    if (!pool.length) pool = (DATA.formulas || []).filter(f => f && f.id && (f.rank || 1) <= tier);
    if (typeof raw === 'string' && raw !== 'random') {
      const exact = (DATA.formulas || []).find(f => f && (f.id === raw || f.type === raw));
      if (exact) pool = [exact];
    }
    const f = U.pick(pool);
    if (!f) return null;
    const names = ['gray', 'green', 'blue', 'purple', 'yellow'];
    const qi = U.weightedPick([0, 1, 2, 3, 4], (i) => CONFIG.alchemy.qualityBase[i] || 0);
    return f.id + '_' + names[qi == null ? 0 : qi];
  },

  /* fight:{power, loot} — power <= 20 is read as a multiple of the player's BR,
     anything larger as an absolute power. Loot is a multiplier on the reward. */
  _effectFight(fx, ctx) {
    let myBr = 0;
    try { myBr = Stats.br(); } catch (e) { myBr = 0; }
    if (!(myBr > 0)) myBr = this._benchmark(S.player.realm || 0);

    const raw = Number(fx && fx.power) || 1;
    const power = raw <= 20 ? myBr * raw : raw;
    const lootMult = Math.max(0.25, Number(fx && fx.loot) || 1);

    const foe = this._makeFoe({
      name: (fx && fx.name) || 'Something in the Dark',
      emoji: (fx && fx.emoji) || '\u{1F47A}',
      element: (fx && fx.element) || null,
      role: (fx && fx.role) || 'bruiser',
      skill: (fx && fx.skill) || 'heavyBlow',
      power: power, boss: true,
    });

    const done = (res) => {
      this._busy = false;
      if (!res || !res.win) {
        UI.toast('You break away, poorer and wiser.', 'bad');
        UI.dirty('wilds');
        return;
      }
      const tier = U.clamp((S.player.realm || 0) + 1, 1, 6);
      const l = this._newLoot();
      l.stone = Math.max(10, Math.round(4.5 * Math.pow(power, 0.62) * lootMult));
      l.exp = Math.round(this._auraSec() * 180 * lootMult);
      l.mats['herb:' + tier] = Math.max(1, Math.round(3 * lootMult));
      l.mats['core:' + tier] = Math.max(1, Math.round(2 * lootMult));
      l.mats['forge:' + tier] = Math.max(1, Math.round(2 * lootMult));
      if (lootMult >= 2 && U.chance(0.3)) l.jade += Math.round(5 * lootMult);
      this._grantLoot(l);
      this._showLoot('Spoils', this._lootLines(l), 'It did not expect you to swing back.');
      UI.dirty('wilds');
      try { Save.save(); } catch (e) {}
    };

    this._busy = true;
    if (typeof Combat !== 'undefined' && Combat && typeof Combat.play === 'function') {
      try {
        Combat.play({
          allies: this._allies(), foes: [foe], opts: {},
          title: foe.name, canSkip: false, onDone: done,
        });
        return;
      } catch (e) { /* fall through to headless */ }
    }
    let res = null;
    try { res = Combat.simulate(this._allies(), [foe], {}); } catch (e) { res = null; }
    done(res);
  },

  /* =======================================================================
   * PANEL — built once, patched thereafter.
   * ===================================================================== */

  render() {
    if (UI.lock('wilds', CONFIG.unlocks.wilds)) return;
    const root = UI.panel('wilds');
    if (!root) return;
    if (!this._dom || !this._dom.wrap || !root.contains(this._dom.wrap)) this._build(root);

    this._renderFort();
    if (this._view === 'detail' && this._zone(this._zoneId)) {
      this._dom.list.hidden = true;
      this._dom.detail.hidden = false;
      this._renderDetail();
    } else {
      this._view = 'list';
      this._dom.list.hidden = false;
      this._dom.detail.hidden = true;
      this._renderList();
    }
  },

  _build(root) {
    root.innerHTML = '';
    const wrap = UI.el('div', 'scroll');

    wrap.innerHTML =
      '<div class="sec" id="wFortSec">' +
        '<div class="sec-title">Fortuity</div>' +
        '<div class="col" id="wFortList"></div>' +
      '</div>' +

      '<div id="wList">' +
        '<div class="card tight" id="wExpCard">' +
          '<div class="row between"><div class="h3">\u{1F3D5}️ Expedition</div>' +
            '<span class="chip" id="wExpZone">—</span></div>' +
          '<div class="tiny muted" id="wExpNote"></div>' +
          '<div class="meter" style="margin:8px 0 6px"><i id="wExpBar"></i></div>' +
          '<div class="row between"><span class="tiny mono" id="wExpTime">—</span>' +
            '<button class="btn sm primary" data-act="claimExp">Claim</button></div>' +
        '</div>' +
        '<div class="sec-title">Hunting Grounds</div>' +
        '<div class="col" id="wZones"></div>' +
      '</div>' +

      '<div id="wDetail" hidden>' +
        '<div class="row between" style="margin-bottom:8px">' +
          '<button class="btn ghost sm" data-act="back">‹ Grounds</button>' +
          '<span class="chip" id="wdTier">—</span>' +
        '</div>' +
        '<div class="card">' +
          '<div class="row"><span class="unit-emoji" id="wdEmoji">\u{1F5FA}️</span>' +
            '<div class="col" style="min-width:0"><div class="h2" id="wdName">—</div>' +
              '<div class="tiny muted serif" id="wdBlurb"></div></div></div>' +
          '<div class="row between tiny" style="margin-top:8px">' +
            '<span class="lbl" id="wdProgLbl">Expedition Level 0</span>' +
            '<span class="mono muted" id="wdProgVal">0 / 40</span></div>' +
          '<div class="bar exp"><i id="wdBar"></i></div>' +
          '<div class="divider"></div>' +
          '<div class="row between">' +
            '<div class="stepper">' +
              '<button data-act="stageDown">−</button><b id="wdStage">1</b><button data-act="stageUp">+</button>' +
            '</div>' +
            '<button class="btn ghost sm" data-act="stageNext">Next Uncleared</button>' +
          '</div>' +
          '<div class="tiny muted" id="wdStageNote" style="margin:6px 0"></div>' +
          '<div class="row">' +
            '<button class="btn primary wide" data-act="fight">Hunt</button>' +
            '<button class="btn ghost" data-act="skip">Skip</button>' +
          '</div>' +
        '</div>' +
        '<div class="card tight">' +
          '<div class="sec-title">Expected Drops</div>' +
          '<div class="col" id="wdLoot"></div>' +
        '</div>' +
        '<div class="card tight">' +
          '<div class="row between"><div class="h3">\u{1F3D5}️ Expedition</div>' +
            '<button class="btn sm" data-act="assign">Camp Here</button></div>' +
          '<div class="col" id="wdExp"></div>' +
          '<div class="row" style="margin-top:6px">' +
            '<button class="btn sm primary wide" data-act="claimExp">Claim</button>' +
            '<button class="btn sm ghost" data-act="recall">Recall</button>' +
          '</div>' +
        '</div>' +
        '<div class="card tight">' +
          '<div class="row between"><div class="h3">\u{1F501} Auto-Hunt</div>' +
            '<div class="toggle" data-act="autoToggle" id="wdAuto"></div></div>' +
          '<div class="tiny muted" id="wdAutoNote"></div>' +
          '<div class="col" id="wdAutoPool"></div>' +
          '<button class="btn sm wide" data-act="autoClaim" style="margin-top:6px">Claim Pouch</button>' +
        '</div>' +
      '</div>' +
      '<div class="safe-b"></div>';

    root.appendChild(wrap);

    const q = (id) => wrap.querySelector('#' + id);
    this._dom = {
      wrap: wrap,
      fortSec: q('wFortSec'), fortList: q('wFortList'),
      list: q('wList'), detail: q('wDetail'),
      expZone: q('wExpZone'), expNote: q('wExpNote'), expBar: q('wExpBar'), expTime: q('wExpTime'),
      zones: q('wZones'),
      dTier: q('wdTier'), dEmoji: q('wdEmoji'), dName: q('wdName'), dBlurb: q('wdBlurb'),
      dProgLbl: q('wdProgLbl'), dProgVal: q('wdProgVal'), dBar: q('wdBar'),
      dStage: q('wdStage'), dStageNote: q('wdStageNote'), dLoot: q('wdLoot'),
      dExp: q('wdExp'), dAuto: q('wdAuto'), dAutoNote: q('wdAutoNote'), dAutoPool: q('wdAutoPool'),
    };

    // zone rows — one per zone, built once
    this._rows = {};
    for (const z of this._zones()) {
      const row = UI.el('div', 'card tight');
      row.dataset.act = 'zone';
      row.dataset.id = z.id;
      row.innerHTML =
        '<div class="row between">' +
          '<div class="row" style="min-width:0"><span class="unit-emoji">' + z.emoji + '</span>' +
            '<div class="col" style="min-width:0"><div class="h3">' + z.name + '</div>' +
            '<div class="tiny muted">' + (z.blurb || '') + '</div></div></div>' +
          '<div class="col" style="align-items:flex-end;flex:0 0 auto">' +
            '<span class="chip">T' + (z.tier || 1) + '</span>' +
            '<span class="tiny mono muted zstage">0 / ' + CONFIG.wilds.stagesPerZone + '</span></div>' +
        '</div>' +
        '<div class="bar exp" style="margin-top:6px"><i></i></div>' +
        '<div class="row between tiny" style="margin-top:4px">' +
          '<span class="zlock muted"></span><span class="zmark jade"></span></div>';
      this._dom.zones.appendChild(row);
      this._rows[z.id] = {
        el: row,
        stage: row.querySelector('.zstage'),
        bar: row.querySelector('.bar > i'),
        lock: row.querySelector('.zlock'),
        mark: row.querySelector('.zmark'),
      };
    }

    this._bind(wrap);
  },

  _bind(wrap) {
    wrap.addEventListener('click', (e) => {
      const t = e.target.closest('[data-act]');
      if (!t) return;
      const act = t.dataset.act;

      if (act === 'zone') {
        const z = this._zone(t.dataset.id);
        if (!z) return;
        if (!this._unlocked(z)) { UI.toast('Unlocks at ' + this._needRealmName(z) + '.', 'bad'); return; }
        this._zoneId = z.id;
        this._view = 'detail';
        const rec = this._zrec(z.id);
        this._stage = U.clamp(rec.stage + 1, 1, CONFIG.wilds.stagesPerZone);
        UI.renderNow('wilds');
        return;
      }
      if (act === 'back') { this._view = 'list'; UI.renderNow('wilds'); return; }

      if (act === 'stageDown') { this._stage = U.clamp(this._stage - 1, 1, CONFIG.wilds.stagesPerZone); UI.renderNow('wilds'); return; }
      if (act === 'stageUp') {
        const rec = this._zrec(this._zoneId);
        this._stage = U.clamp(this._stage + 1, 1, Math.min(CONFIG.wilds.stagesPerZone, rec.stage + 1));
        UI.renderNow('wilds'); return;
      }
      if (act === 'stageNext') {
        const rec = this._zrec(this._zoneId);
        this._stage = U.clamp(rec.stage + 1, 1, CONFIG.wilds.stagesPerZone);
        UI.renderNow('wilds'); return;
      }
      if (act === 'fight') { this._openFight(this._zoneId, this._stage); return; }
      if (act === 'skip') {
        const rec = this._zrec(this._zoneId);
        if (this._stage > rec.stage) { UI.toast('Beat it once by hand first.', 'bad'); return; }
        const z = this._zone(this._zoneId);
        if (!z) return;
        this._ward = null; this._fury = null;
        this._runFight(z, this._stage, this._rollFoes(z, this._stage), true);
        return;
      }
      if (act === 'assign') { this._expAssign(this._zoneId); return; }
      if (act === 'recall') { this._expRecall(); return; }
      if (act === 'claimExp') { this._expClaim(); return; }
      if (act === 'autoToggle') { this._autoToggle(); return; }
      if (act === 'autoClaim') { this._autoClaim(); return; }
      if (act === 'card') { this._openCard(+t.dataset.idx || 0); return; }
    });
  },

  /* --------------------------------------------------------------- FORTUITY */
  _renderFort() {
    const d = this._dom;
    const w = this._st();
    const queue = w.fortuity.queue;
    const host = d.fortList;

    if (!queue.length) {
      const nextIn = Math.max(0, ((w.fortuity.nextAt || 0) - Date.now()) / 1000);
      this._setHtml(host, '<div class="empty tiny">The wilds are keeping their secrets. Next stirring in ~' +
        Fmt.dur(nextIn) + '.</div>');
      return;
    }

    let html = '';
    for (let i = 0; i < queue.length; i++) {
      const ev = (DATAX && DATAX.eventById && DATAX.eventById[queue[i].eventId]) || null;
      if (!ev) continue;
      const info = this._rarityInfo(ev.rarity);
      html += '<div class="card tight ' + info.bg + '" data-act="card" data-idx="' + i + '">' +
        '<div class="row between"><span class="' + info.cls + '">✨ ' + (ev.title || 'A Fortuity') + '</span>' +
        '<span class="chip">' + info.name + '</span></div>' +
        '<div class="tiny muted">Tap to see what it wants.</div></div>';
    }
    this._setHtml(host, html || '<div class="empty tiny">Nothing stirs.</div>');
  },

  /* ------------------------------------------------------------- LIST VIEW */
  _renderList() {
    const d = this._dom;
    const w = this._st();
    const now = Date.now();

    // expedition summary
    const zid = w.expedition.zone;
    const z = this._zone(zid);
    if (!z) {
      d.expZone.textContent = 'Idle';
      d.expNote.textContent = 'Open a hunting ground you have cleared and camp there to farm it while you are away.';
      d.expBar.style.width = '0%';
      d.expTime.textContent = '—';
    } else {
      const ms = this._expElapsed(now);
      const cap = this._expCapMs();
      const r = this.expeditionRate(zid);
      d.expZone.textContent = z.emoji + ' ' + z.name;
      d.expNote.textContent = Fmt.n(Math.round(r.stone)) + ' stone/h · ' + Fmt.n(Math.round(r.exp)) +
        ' EXP/h · ' + Fmt.n1(r.herb + r.core + r.forge) + ' mats/h';
      d.expBar.style.width = Fmt.pct(U.clamp(ms / cap, 0, 1), 0);
      d.expTime.textContent = Fmt.dur(ms / 1000) + ' / ' + Fmt.dur(cap / 1000);
    }

    // zone rows
    for (const zz of this._zones()) {
      const row = this._rows[zz.id];
      if (!row) continue;
      const unlocked = this._unlocked(zz);
      const st = this._stageOf(zz.id);
      row.el.classList.toggle('locked', !unlocked);
      row.stage.textContent = st + ' / ' + CONFIG.wilds.stagesPerZone;
      row.bar.style.width = Fmt.pct(U.clamp(st / CONFIG.wilds.stagesPerZone, 0, 1), 0);
      row.lock.textContent = unlocked
        ? (st >= CONFIG.wilds.stagesPerZone ? 'Cleared to the last stage' : 'Expedition Level ' + st)
        : ('Unlocks at ' + this._needRealmName(zz));
      row.lock.className = 'zlock ' + (unlocked ? 'muted' : 'bad');
      const marks = [];
      if (zid === zz.id) marks.push('\u{1F3D5}️ camped');
      if (S.settings && S.settings.autoHunt && w.auto.zone === zz.id) marks.push('\u{1F501} auto');
      if (zz.remix) marks.push('Spirit remix');
      row.mark.textContent = marks.join(' · ');
    }
  },

  /* ----------------------------------------------------------- DETAIL VIEW */
  _renderDetail() {
    const d = this._dom;
    const w = this._st();
    const z = this._zone(this._zoneId);
    if (!z) { this._view = 'list'; return; }
    const rec = this._zrec(z.id);
    const now = Date.now();

    this._stage = U.clamp(this._stage, 1, Math.min(CONFIG.wilds.stagesPerZone, rec.stage + 1));
    const s = this._stage;
    const boss = this._isBoss(s);

    d.dTier.textContent = 'Tier ' + (z.tier || 1) + (z.remix ? ' · Spirit' : '');
    d.dEmoji.textContent = z.emoji;
    d.dName.textContent = z.name;
    d.dBlurb.textContent = z.blurb || '';
    d.dProgLbl.textContent = 'Expedition Level ' + rec.stage;
    d.dProgVal.textContent = rec.stage + ' / ' + CONFIG.wilds.stagesPerZone;
    d.dBar.style.width = Fmt.pct(U.clamp(rec.stage / CONFIG.wilds.stagesPerZone, 0, 1), 0);
    d.dStage.textContent = String(s);

    const P = this._enemyPower(z, s) * (boss ? this._BOSS_MULT : 1);
    let myBr = 0; try { myBr = Stats.br(); } catch (e) {}
    const cleared = s <= rec.stage;
    this._setHtml(d.dStageNote,
      (boss ? '<span class="gold">Boss stage</span> — ' + ((z.boss && z.boss.name) || 'a named thing') + '. ' : '') +
      'Enemy power ' + Fmt.n(P) + ' · your BR ' + Fmt.n(myBr) + ' · ' +
      (cleared ? '<span class="good">cleared</span>' : '<span class="muted">unbeaten</span>'));

    const skipBtn = d.detail.querySelector('[data-act="skip"]');
    if (skipBtn) skipBtn.disabled = !cleared;

    // expected drops
    const tier = U.clamp(z.tier || 1, 1, 6);
    const stoneEst = Math.round(3.2 * Math.pow(this._enemyPower(z, s), 0.62) * (boss ? 3.2 : 1) * this._lootMult());
    let lootHtml =
      '<div class="kv"><span class="k">' + this._icon('stone') + ' Spiritstone</span><span class="v">~' + Fmt.n(stoneEst) + '</span></div>' +
      '<div class="kv"><span class="k">' + this._icon('herb:' + tier) + ' ' + this._label('herb:' + tier) + '</span><span class="v">' + (boss ? 'guaranteed' : '55%') + '</span></div>' +
      '<div class="kv"><span class="k">' + this._icon('core:' + tier) + ' ' + this._label('core:' + tier) + '</span><span class="v">' + (boss ? 'guaranteed' : '40%') + '</span></div>' +
      '<div class="kv"><span class="k">' + this._icon('forge:' + tier) + ' ' + this._label('forge:' + tier) + '</span><span class="v">' + (boss ? 'guaranteed x3' : '32%') + '</span></div>';
    if (z.remix) lootHtml += '<div class="kv"><span class="k">' + this._icon('lawShard') + ' Law Shards</span><span class="v">' + (boss ? '1-3' : '10%') + '</span></div>';
    if (boss) lootHtml += '<div class="kv"><span class="k">\u{1F4DC} Formula / \u{1F5FF} Curio</span><span class="v">12% / 6%</span></div>';
    this._setHtml(d.dLoot, lootHtml);

    // expedition block
    const assigned = w.expedition.zone === z.id;
    const r = this.expeditionRate(z.id);
    const ms = assigned ? this._expElapsed(now) : 0;
    const cap = this._expCapMs();
    let expHtml = '';
    if (rec.stage < 1) {
      expHtml = '<div class="empty tiny">Clear a stage before anyone will camp here.</div>';
    } else {
      expHtml =
        '<div class="kv"><span class="k">Status</span><span class="v ' + (assigned ? 'good' : 'muted') + '">' +
          (assigned ? 'Camped — ' + Fmt.dur(ms / 1000) + ' / ' + Fmt.dur(cap / 1000) : 'Not camped') + '</span></div>' +
        '<div class="kv"><span class="k">' + this._icon('stone') + ' Spiritstone / h</span><span class="v">' + Fmt.n(Math.round(r.stone)) + '</span></div>' +
        '<div class="kv"><span class="k">\u{1F300} EXP / h</span><span class="v">' + Fmt.n(Math.round(r.exp)) + '</span></div>' +
        '<div class="kv"><span class="k">' + this._icon('herb:' + tier) + ' Herbs / h</span><span class="v">' + Fmt.n1(r.herb) + '</span></div>' +
        '<div class="kv"><span class="k">' + this._icon('core:' + tier) + ' Cores / h</span><span class="v">' + Fmt.n1(r.core) + '</span></div>' +
        '<div class="kv"><span class="k">' + this._icon('forge:' + tier) + ' Forge mats / h</span><span class="v">' + Fmt.n1(r.forge) + '</span></div>';
      if (this._baitActive()) {
        expHtml += '<div class="kv"><span class="k">\u{1F356} Beast Bait</span><span class="v gold">+' +
          Fmt.pct(CONFIG.alchemy.baitLootBonus, 0) + ' for ' +
          Fmt.dur(((S.alchemy.baitUntil || 0) - now) / 1000) + '</span></div>';
      }
    }
    this._setHtml(d.dExp, expHtml);
    const assignBtn = d.detail.querySelector('[data-act="assign"]');
    if (assignBtn) {
      assignBtn.disabled = rec.stage < 1 || assigned;
      assignBtn.textContent = assigned ? 'Camped' : 'Camp Here';
    }
    const claimBtn = d.detail.querySelector('[data-act="claimExp"]');
    if (claimBtn) claimBtn.disabled = !assigned || ms < 60000;
    const recallBtn = d.detail.querySelector('[data-act="recall"]');
    if (recallBtn) recallBtn.disabled = !assigned;

    // auto-hunt block
    const unlocked = this._autoUnlocked();
    const on = !!(S.settings && S.settings.autoHunt);
    d.dAuto.classList.toggle('on', on && unlocked);
    d.dAuto.classList.toggle('locked', !unlocked);
    if (!unlocked) {
      d.dAutoNote.textContent = 'Auto-Hunt is sold in the Jade Pavilion. Until then, the swinging is yours to do.';
    } else if (rec.stage < 1) {
      d.dAutoNote.textContent = 'Clear stage 1 by hand and it will happily repeat it forever.';
    } else if (on && w.auto.zone === z.id) {
      const left = Math.max(0, ((w.auto.nextAt || 0) - now) / 1000);
      d.dAutoNote.textContent = 'Running stage ' + rec.stage + ' every ' + this._AUTO_SEC +
        's — next in ' + Fmt.durShort(left) + '. ' + (w.auto.runs || 0) + ' hunts banked. Stops on a loss.';
    } else if (on) {
      d.dAutoNote.textContent = 'Running in ' + ((this._zone(w.auto.zone) || {}).name || 'another ground') +
        '. Toggle here to move it.';
    } else {
      d.dAutoNote.textContent = 'Repeats stage ' + rec.stage + ' every ' + this._AUTO_SEC +
        's with headless fights, banking the drops. Stops the moment it loses.';
    }

    const pool = this._autoPool();
    const rows = this._lootLines(pool);
    this._setHtml(d.dAutoPool, rows.length
      ? rows.map(x => '<div class="kv"><span class="k">' + x.icon + ' ' + x.label +
          '</span><span class="v good">' + x.amount + '</span></div>').join('')
      : '<div class="empty tiny">Pouch empty.</div>');
    const acBtn = d.detail.querySelector('[data-act="autoClaim"]');
    if (acBtn) acBtn.disabled = !rows.length;
  },
};

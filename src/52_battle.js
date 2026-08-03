/* ============================================================================
 * BATTLE / SPIRE / TIDE — the combat ladder.
 *
 * THREE top-level bindings, and only three: `Battle`, `Spire`, `Tide`.
 * `Battle` owns the `battle` panel and is nothing but the sub-tab host for
 * Spire / Duel / Tide. `Duel` lives in 53_duel.js and is called defensively.
 * Every other helper hangs off one of the three objects, so this file adds no
 * other names to the shared scope.
 *
 * ------------------------------------------------------------------ FORMULAS
 *
 * DEMON SPIRE (CONFIG.spire)
 *   power(f)      = powerBase * powerGrowth^f                     (f <= floors)
 *                 = powerBase * powerGrowth^floors
 *                   * proceduralGrowth^(f - floors)               (f >  floors)
 *                 = 900 * 1.135^f, then +6% per floor past 200, forever.
 *   isBoss(f)     = f % bossEvery === 0                           (every 10th)
 *   boss(f)       = DATA.spireBosses[f/10 - 1], cycling by name past floor 200.
 *   Encounter (DETERMINISTIC per floor — seeded with U.hash('spire:'+f) — so the
 *   BR printed beside a floor is the BR you actually fight):
 *     elite floor : 2-3 foes, each at power(f) / n^0.75 ... rescaled so that
 *                   SUM(Stats.br(foe)) === power(f) exactly.
 *     boss floor  : 1 boss at 0.74*power(f) + 2 guards at 0.13*power(f).
 *   Foe stat block: canonical spread hp 40u / patk 1.2u / matk 1.2u /
 *   pdef .55u / mdef .55u / spd 1.1u, multiplied by the role template, then
 *   scaled by k = wantedBR / BR(spread) so BR lands on the number.
 *   BR colour vs the player: ratio = floorBR / Stats.br()
 *     <=0.75 good · <=1.05 jade · <=1.40 gold · else bad.
 *   Attempts: attemptsPerDay - S.daily.spireAttempts, reset by Daily.
 *   Sweep: sweepPerDay - S.daily.sweepUsed, pays the material purse of the
 *   highest cleared floor with no fight at all.
 *
 *   REWARD PURSE for floor f (tier T = clamp(1 + floor(f/25), 1, 6)):
 *     stone   = round(5.5 * power(f)^0.60 * (boss ? 2.5 : 1) * scale)
 *     exp     = Cultivation.auraPerSec() * (boss ? 240 : 90) seconds
 *     mats    = herb:T, core:T, forge:T, each (2 + floor(f/10)) * (boss?2:1)
 *     boss    += insight (1 + floor(f/50)) and tech (20 + 2f)
 *     first   += jade  firstClearJade (6) / bossFirstClearJade (25)
 *     first boss  += one unowned curio via Curios.own
 *     first f%25 == 0 => a guaranteed unowned formula of rank <= T
 *     first otherwise => 8% chance of the same
 *     scale = 1 on a first clear / sweep, 0.6 on a rematch.
 *
 * BEAST TIDE (CONFIG.tide)
 *   readyAt   = S.tide.nextAt (ABSOLUTE ms epoch, stamped when a run BEGINS so
 *               an abandoned run cannot farm the cooldown).
 *   waveBR(w) = Stats.br() * waveScale[w-1]      ([0.7,0.85,1.0,1.15,1.3])
 *   wave 1-4  : 3 foes sharing waveBR evenly.
 *   wave 5    : 1 Tide Lord at 0.52*waveBR + 3 foes at 0.16*waveBR.
 *               Foes are seeded off run.seed so a reload rebuilds the same wave.
 *   CARRY-OVER: the ally's surviving hp and shield are threaded into the next
 *   wave. There is NO free heal between waves — that is the whole point of the
 *   boon draft.
 *   BOONS: after every won wave (except the last) three are drawn from
 *   DATA.tideBoons, preferring ids not already held. The pick accumulates and
 *   is applied for the rest of the run:
 *     atk       patk,matk *= (1 + val)
 *     spd       spd       *= (1 + val)
 *     lifesteal lifesteal += val
 *     thorns    thorns    += val            (engine-side reflect)
 *     shield    shield    += val * maxHp    at the start of every wave
 *     heal      hp        += val * maxHp    at every BETWEEN-WAVE interval
 *   REWARDS:
 *     full clear  jade fullClearJade (40) + a fat material chest + 25% curio
 *     partial     jade perWaveJade (5) * wavesSurvived + a thin chest
 *     stone       = round(12 * Stats.br()^0.55 * (full ? 3 : 0.5 * waves))
 *     exp         = auraPerSec * 3600 * (full ? 2 : 0.3 * waves)
 *     mat tier    = clamp(1 + floor(realm/2), 1, 6)
 *
 * BUS EMITTED: spireClear {floor, first} · spireSweep {floor} ·
 *              tideWave {wave} · tideClear {waves}
 *
 * ASSUMPTIONS (all defensive, all wrapped):
 *   - Combat.play({allies,foes,opts,title,onDone,canSkip}) animates; if it is
 *     missing the fight falls back to Combat.simulate; if Combat itself is
 *     missing the spent attempt is refunded and the player is told.
 *   - Combat.makeFoe(spec) is used when present, otherwise a local builder that
 *     lands BR exactly on the requested power is used.
 *   - opts.modifiers carries the spire boss modifier strings, opts.boons the
 *     tide boon descriptors. Tide ALSO applies its boons to the ally unit
 *     itself (so the draft is never a no-op if the engine ignores opts.boons)
 *     and marks every descriptor `applied:true` so a boon-aware engine can skip
 *     what has already been folded in.
 *   - Spire/Tide do not own panel roots (CONTRACT §11 gives `battle` to
 *     Battle), so they expose renderInto(host). They still call UI.register
 *     opportunistically, in case a shell ever ships #p-spire / #p-tide.
 * ==========================================================================*/


/* ===========================================================================
 * BATTLE — sub-tab host. Also carries the helpers Spire and Tide share.
 * ========================================================================= */
const Battle = {

  TABS: [
    { id: 'spire', label: '\u{1F5FC} Spire', unlock: 'spire' },
    { id: 'duel',  label: '⚔️ Duel',        unlock: 'duel' },
    { id: 'tide',  label: '\u{1F30A} Tide',  unlock: 'tide' },
  ],

  /* Canonical foe spread and role templates — shared by Spire and Tide so both
     produce stat blocks the combat engine recognises. */
  CANON: { hp: 40, patk: 1.2, matk: 1.2, pdef: 0.55, mdef: 0.55, spd: 1.1 },
  ROLES: {
    bruiser: { hp: 1.45, patk: 1.15, matk: 0.45, pdef: 1.25, mdef: 0.95, spd: 0.85, crit: 0.03, dodge: 0 },
    caster:  { hp: 0.82, patk: 0.40, matk: 1.40, pdef: 0.85, mdef: 1.25, spd: 1.00, crit: 0.05, dodge: 0.02 },
    swift:   { hp: 0.80, patk: 1.20, matk: 0.80, pdef: 0.85, mdef: 0.85, spd: 1.45, crit: 0.10, dodge: 0.06 },
  },

  sub: 'spire',
  _el: null,
  _badgeAcc: 0,

  /* ------------------------------------------------------------------ INIT */

  init() {
    this._el = null;
    try {
      if (typeof UI !== 'undefined' && UI && typeof UI.register === 'function') {
        UI.register('battle', () => Battle.render());
      }
    } catch (e) { console.warn('[Battle] UI.register unavailable', e); }

    try {
      Bus.on('breakthrough', () => { try { UI.dirty('battle'); } catch (e) { /* ignore */ } });
      Bus.on('dailyReset', () => { Battle.syncBadges(); try { UI.dirty('battle'); } catch (e) { /* ignore */ } });
    } catch (e) { /* Bus is always present, but never trust it at init */ }

    this.syncBadges();
  },

  tick(dtSec, nowMs) {
    if (!S || !S.created) return;
    this._badgeAcc += (Number(dtSec) || 0);
    if (this._badgeAcc < 1) return;
    this._badgeAcc = 0;
    this.syncBadges();
  },

  /* Total red dots on the Battle tab: the sum of its three children. UI.badge
     rolls a parent up from its dotted children, so only children are set. */
  badges() {
    return this._child('spire') + this._child('duel') + this._child('tide');
  },

  _child(key) {
    let sys = null;
    try {
      if (key === 'spire') sys = (typeof Spire !== 'undefined') ? Spire : null;
      else if (key === 'tide') sys = (typeof Tide !== 'undefined') ? Tide : null;
      else if (key === 'duel') sys = (typeof Duel !== 'undefined') ? Duel : null;
    } catch (e) { sys = null; }
    if (!sys || typeof sys.badges !== 'function') return 0;
    let n = 0;
    try { n = Math.floor(Number(sys.badges()) || 0); } catch (e) { n = 0; }
    return n > 0 ? n : 0;
  },

  syncBadges() {
    try {
      UI.badge('battle.spire', this._child('spire'));
      UI.badge('battle.duel', this._child('duel'));
      UI.badge('battle.tide', this._child('tide'));
    } catch (e) { /* UI may not be up yet */ }
  },

  /* Public: route straight to a sub-tab (More menu, quests, toasts). */
  setSub(key) {
    for (let i = 0; i < this.TABS.length; i++) {
      if (this.TABS[i].id === key) { this.sub = key; break; }
    }
    try { UI.dirty('battle'); } catch (e) { /* ignore */ }
  },

  /* ================================================== SHARED SMALL HELPERS */

  realm() {
    const r = (S && S.player) ? Math.floor(Number(S.player.realm)) : 0;
    return (Number.isFinite(r) && r > 0) ? r : 0;
  },

  realmName(r) {
    const row = (DATA.realms || [])[r];
    return (row && row.name) ? row.name : ('Realm ' + r);
  },

  myBr() {
    let v = 0;
    try { v = Number(Stats.br()) || 0; } catch (e) { v = 0; }
    return v > 0 ? v : 0;
  },

  auraSec() {
    let v = 0;
    try { v = Number(Cultivation.auraPerSec()) || 0; } catch (e) { v = 0; }
    return v > 0 ? v : 0;
  },

  esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  /* Write innerHTML only when it actually changed. */
  setHtml(el, html) {
    if (!el) return;
    if (el._bHtml === html) return;
    el._bHtml = html;
    el.innerHTML = html;
  },

  brOf(u) {
    try {
      if (typeof Stats !== 'undefined' && Stats && typeof Stats.br === 'function') {
        const v = Stats.br(u);
        if (Number.isFinite(v)) return v;
      }
    } catch (e) { /* fall through */ }
    const w = CONFIG.brWeights;
    return (Number(u.maxHp || u.hp) || 0) * w.hp
         + ((Number(u.patk) || 0) + (Number(u.matk) || 0)) * w.atk
         + ((Number(u.pdef) || 0) + (Number(u.mdef) || 0)) * w.def
         + (Number(u.spd) || 0) * w.spd;
  },

  /* Colour class for an enemy BR measured against the player's own. */
  brClass(theirs, mine) {
    if (!(mine > 0)) return 'muted';
    const r = theirs / mine;
    if (r <= 0.75) return 'good';
    if (r <= 1.05) return 'jade';
    if (r <= 1.40) return 'gold';
    return 'bad';
  },

  /* Build one foe. Prefers Combat.makeFoe(spec), falls back to a local build
     whose BR lands exactly on spec.power. */
  makeFoe(spec) {
    let u = null;
    try {
      if (typeof Combat !== 'undefined' && Combat && typeof Combat.makeFoe === 'function') {
        u = Combat.makeFoe(spec);
      }
    } catch (e) { u = null; }
    if (!u || !(u.maxHp > 0) || !(u.hp > 0)) u = this.localFoe(spec);
    u.side = 'foe';
    u.name = spec.name || u.name || 'Spire Warden';
    u.emoji = spec.emoji || u.emoji || '\u{1F47A}';
    if (u.element === undefined) u.element = spec.element || null;
    if (u.isPlayer === undefined) u.isPlayer = false;
    if (u.isThrall === undefined) u.isThrall = false;
    if (spec.modifier) u.modifier = spec.modifier;
    return u;
  },

  localFoe(spec) {
    const power = Math.max(1, Number(spec.power) || 1);
    const role = this.ROLES[spec.role] || this.ROLES.bruiser;
    const c = this.CANON;
    const raw = {
      hp: c.hp * role.hp,
      patk: c.patk * role.patk,
      matk: c.matk * role.matk,
      pdef: c.pdef * role.pdef,
      mdef: c.mdef * role.mdef,
      spd: c.spd * role.spd,
    };
    const br0 = this.brOf(raw);
    const k = br0 > 0 ? power / br0 : 1;
    const sk = (typeof DATAX !== 'undefined' && DATAX.monsterSkillById)
      ? DATAX.monsterSkillById[spec.skill] : null;

    const hp = Math.max(1, Math.round(raw.hp * k));
    return {
      name: spec.name || 'Spire Warden',
      emoji: spec.emoji || '\u{1F47A}',
      side: 'foe',
      element: spec.element || null,
      path: null,
      hp: hp, maxHp: hp,
      mp: 120, maxMp: 120,
      patk: Math.max(1, Math.round(raw.patk * k)),
      matk: Math.max(1, Math.round(raw.matk * k)),
      pdef: Math.max(1, Math.round(raw.pdef * k)),
      mdef: Math.max(1, Math.round(raw.mdef * k)),
      spd: Math.max(1, Math.round(raw.spd * k)),
      crit: CONFIG.combat.baseCrit + (role.crit || 0) + (spec.boss ? 0.06 : (spec.elite ? 0.03 : 0)),
      critDmg: CONFIG.combat.baseCritDmg + (spec.boss ? 0.25 : 0),
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
  },

  /* The player's combat unit, or a dull stand-in if Stats is not up. */
  ally() {
    let me = null;
    try {
      if (typeof Stats !== 'undefined' && Stats && typeof Stats.unit === 'function') me = Stats.unit();
    } catch (e) { me = null; }
    if (!me || !(me.maxHp > 0)) {
      me = this.localFoe({ name: (S.player && S.player.name) || 'You', emoji: '\u{1F9D8}', role: 'bruiser', power: 100 });
      me.isPlayer = true;
    }
    me.side = 'ally';
    return me;
  },

  /* ------------------------------------------------------------------ LOOT */

  newLoot() {
    return { stone: 0, jade: 0, tech: 0, insight: 0, dust: 0, exp: 0,
             mats: {}, curios: [], formulas: [] };
  },

  lootAny(l) {
    if (!l) return false;
    if (l.stone || l.jade || l.tech || l.insight || l.dust || l.exp) return true;
    if (l.curios.length || l.formulas.length) return true;
    for (const k in l.mats) if (l.mats[k] > 0) return true;
    return false;
  },

  addMat(l, kind, n) {
    const amt = Math.max(0, Math.round(Number(n) || 0));
    if (amt <= 0) return;
    l.mats[kind] = (l.mats[kind] || 0) + amt;
  },

  label(kind) {
    try { const s = Econ.label(kind); if (s) return s; } catch (e) { /* ignore */ }
    return String(kind);
  },

  icon(kind) {
    try { const s = Econ.icon(kind); if (s) return s; } catch (e) { /* ignore */ }
    return '•';
  },

  /* Pay a purse out. Currency ONLY through Econ, EXP ONLY through Cultivation.
     Returns display rows for the reward sheet. */
  grantLoot(loot, src) {
    const lines = [];
    if (!loot) return lines;

    const cash = ['stone', 'jade', 'tech', 'insight', 'dust'];
    for (let i = 0; i < cash.length; i++) {
      const k = cash[i];
      const n = Math.max(0, Math.round(Number(loot[k]) || 0));
      if (n <= 0) continue;
      try { Econ.grant(k, n); } catch (e) { continue; }
      lines.push({ icon: this.icon(k), label: this.label(k), amount: '+' + Fmt.n(n) });
    }

    const keys = Object.keys(loot.mats || {}).sort();
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const n = Math.max(0, Math.round(Number(loot.mats[k]) || 0));
      if (n <= 0) continue;
      try { Econ.grant(k, n); } catch (e) { continue; }
      const tier = k.indexOf(':') > 0 ? (' T' + k.split(':')[1]) : '';
      lines.push({ icon: this.icon(k), label: this.label(k) + tier, amount: '+' + Fmt.n(n) });
    }

    const exp = Math.max(0, Math.round(Number(loot.exp) || 0));
    if (exp > 0) {
      let ok = false;
      try {
        if (typeof Cultivation !== 'undefined' && Cultivation && typeof Cultivation.addExp === 'function') {
          Cultivation.addExp(exp, src || 'battle');
          ok = true;
        }
      } catch (e) { ok = false; }
      if (ok) lines.push({ icon: '\u{1F300}', label: 'Cultivation EXP', amount: '+' + Fmt.n(exp) });
    }

    for (let i = 0; i < loot.curios.length; i++) {
      const id = loot.curios[i];
      const c = (typeof DATAX !== 'undefined' && DATAX.curioById) ? DATAX.curioById[id] : null;
      let ok = false;
      try {
        if (typeof Curios !== 'undefined' && Curios && typeof Curios.own === 'function') { Curios.own(id); ok = true; }
      } catch (e) { ok = false; }
      if (!ok) {
        if (!S.curios || typeof S.curios !== 'object') S.curios = { owned: [] };
        if (!Array.isArray(S.curios.owned)) S.curios.owned = [];
        if (S.curios.owned.indexOf(id) < 0) S.curios.owned.push(id);
        try { Bus.emit('curioGain', { id: id }); } catch (e) { /* ignore */ }
      }
      lines.push({ icon: (c && c.emoji) || '\u{1F5FF}', label: (c && c.name) || 'A curio', amount: 'acquired' });
    }

    for (let i = 0; i < loot.formulas.length; i++) {
      const id = loot.formulas[i];
      if (!S.inv || typeof S.inv !== 'object') S.inv = { pills: {}, formulas: [], blueprints: [], gear: [], nextUid: 1 };
      if (!Array.isArray(S.inv.formulas)) S.inv.formulas = [];
      if (S.inv.formulas.indexOf(id) >= 0) continue;
      S.inv.formulas.push(id);
      const f = (typeof DATAX !== 'undefined' && DATAX.formulaById) ? DATAX.formulaById[id] : null;
      lines.push({ icon: (f && f.emoji) || '\u{1F4DC}', label: 'Formula — ' + ((f && f.name) || id), amount: 'learned' });
    }

    try { Stats.recompute(); } catch (e) { /* ignore */ }
    try { Save.save(); } catch (e) { /* ignore */ }
    return lines;
  },

  randomUnownedCurio() {
    const owned = (S.curios && Array.isArray(S.curios.owned)) ? S.curios.owned : [];
    const pool = (DATA.curios || []).filter(c => c && c.id && owned.indexOf(c.id) < 0);
    if (!pool.length) return null;
    const p = U.pick(pool);
    return p ? p.id : null;
  },

  randomUnownedFormula(maxRank) {
    const owned = (S.inv && Array.isArray(S.inv.formulas)) ? S.inv.formulas : [];
    const cap = U.clamp(Math.floor(maxRank || 6), 1, 6);
    let pool = (DATA.formulas || []).filter(f => f && f.id && (f.rank || 1) <= cap && owned.indexOf(f.id) < 0);
    if (!pool.length) pool = (DATA.formulas || []).filter(f => f && f.id && owned.indexOf(f.id) < 0);
    if (!pool.length) return null;
    const p = U.pick(pool);
    return p ? p.id : null;
  },

  /* One reward sheet, used by both children. */
  showLoot(title, lines, note) {
    let body = '';
    if (note) body += '<div class="tiny muted serif" style="margin-bottom:8px">' + this.esc(note) + '</div>';
    if (!lines || !lines.length) {
      body += '<div class="empty tiny">Nothing but dust and a good story.</div>';
    } else {
      body += '<div class="col">';
      for (let i = 0; i < lines.length; i++) {
        body += '<div class="kv"><span class="k">' + lines[i].icon + ' ' + this.esc(lines[i].label) +
                '</span><span class="v good">' + this.esc(lines[i].amount) + '</span></div>';
      }
      body += '</div>';
    }
    try {
      UI.sheet({ title: title, body: body, buttons: [{ label: 'Good', cls: 'primary', act: (c) => c() }] });
    } catch (e) {
      try { UI.toast(title, 'good'); } catch (e2) { /* ignore */ }
    }
  },

  /* ============================================================== THE PANEL */

  render() {
    let locked = false;
    try { locked = !!UI.lock('battle', CONFIG.unlocks.spire); } catch (e) { locked = false; }
    if (locked) {
      if (this._el && this._el.root) this._el.root.hidden = true;
      return;
    }

    this._build();
    if (!this._el) return;
    this._el.root.hidden = false;
    this._syncSub();
    this._paintTabs();

    if (this.sub === 'spire') this._paintChild('spire');
    else if (this.sub === 'duel') this._paintChild('duel');
    else this._paintChild('tide');

    this.syncBadges();
  },

  /* Honour UI.show('battle', sub) however the router exposes the sub key. */
  _syncSub() {
    let want = null;
    try {
      if (typeof UI === 'undefined' || !UI) want = null;
      else if (typeof UI.sub === 'string') want = UI.sub;
      else if (UI.sub && typeof UI.sub === 'object') want = UI.sub.battle;
      else if (typeof UI.subOf === 'function') want = UI.subOf('battle');
    } catch (e) { want = null; }
    if (!want) return;
    for (let i = 0; i < this.TABS.length; i++) {
      if (this.TABS[i].id === want) { this.sub = want; return; }
    }
  },

  _build() {
    let panel = null;
    try { panel = UI.panel('battle'); } catch (e) { panel = null; }
    if (!panel) { this._el = null; return; }
    if (this._el && this._el.root && panel.contains(this._el.root)) return;

    let scroll = panel.querySelector(':scope > .scroll');
    if (!scroll) { scroll = UI.el('div', 'scroll'); panel.appendChild(scroll); }

    const root = UI.el('div', 'col');

    const tabs = UI.el('div', 'tabs');
    const tabEls = {};
    for (let i = 0; i < this.TABS.length; i++) {
      const t = this.TABS[i];
      const b = UI.el('button', 'tab');
      b.type = 'button';
      b.dataset.act = 'btab';
      b.dataset.id = t.id;
      b.textContent = t.label;
      tabs.appendChild(b);
      tabEls[t.id] = b;
    }
    root.appendChild(tabs);

    const bodies = {};
    for (let i = 0; i < this.TABS.length; i++) {
      const d = UI.el('div', 'sec');
      d.hidden = true;
      root.appendChild(d);
      bodies[this.TABS[i].id] = d;
    }

    root.appendChild(UI.el('div', 'safe-b'));
    scroll.appendChild(root);

    this._el = { root: root, tabs: tabEls, body: bodies, mounted: { spire: false, duel: false, tide: false } };

    root.addEventListener('click', (e) => {
      const t = e.target.closest('[data-act="btab"]');
      if (!t || !root.contains(t)) return;
      const id = t.dataset.id;
      for (let i = 0; i < Battle.TABS.length; i++) {
        if (Battle.TABS[i].id !== id) continue;
        const need = CONFIG.unlocks[Battle.TABS[i].unlock];
        if (Battle.realm() < need) {
          try { UI.toast('Sealed until ' + Battle.realmName(need) + '.', 'bad'); } catch (err) { /* ignore */ }
          return;
        }
        Battle.sub = id;
        Battle.render();
        return;
      }
    });
  },

  _paintTabs() {
    for (let i = 0; i < this.TABS.length; i++) {
      const t = this.TABS[i];
      const btn = this._el.tabs[t.id];
      const body = this._el.body[t.id];
      const open = Battle.realm() >= CONFIG.unlocks[t.unlock];
      if (btn) {
        btn.classList.toggle('active', t.id === this.sub);
        btn.classList.toggle('locked', !open);
      }
      if (body) body.hidden = (t.id !== this.sub);
    }
    // A locked tab must never stay selected.
    const cur = this.TABS.filter(t => t.id === this.sub)[0];
    if (cur && Battle.realm() < CONFIG.unlocks[cur.unlock]) {
      this.sub = 'spire';
      for (let i = 0; i < this.TABS.length; i++) {
        const t = this.TABS[i];
        if (this._el.tabs[t.id]) this._el.tabs[t.id].classList.toggle('active', t.id === this.sub);
        if (this._el.body[t.id]) this._el.body[t.id].hidden = (t.id !== this.sub);
      }
    }
  },

  _paintChild(key) {
    const host = this._el.body[key];
    if (!host) return;
    const tab = this.TABS.filter(t => t.id === key)[0];
    const need = CONFIG.unlocks[tab.unlock];

    if (Battle.realm() < need) {
      this._el.mounted[key] = false;
      this.setHtml(host, '<div class="empty locked">\u{1F512} Sealed until ' + this.esc(Battle.realmName(need)) + '.</div>');
      return;
    }

    let sys = null;
    try {
      if (key === 'spire') sys = (typeof Spire !== 'undefined') ? Spire : null;
      else if (key === 'tide') sys = (typeof Tide !== 'undefined') ? Tide : null;
      else if (key === 'duel') sys = (typeof Duel !== 'undefined') ? Duel : null;
    } catch (e) { sys = null; }

    if (sys && typeof sys.renderInto === 'function') {
      try {
        if (!this._el.mounted[key]) { host.innerHTML = ''; host._bHtml = null; this._el.mounted[key] = true; }
        sys.renderInto(host);
        return;
      } catch (e) {
        console.error('[Battle] ' + key + '.renderInto failed:', e);
        this._el.mounted[key] = false;
        this.setHtml(host, '<div class="empty bad">That arena is barred: ' +
          this.esc(String((e && e.message) || e).slice(0, 120)) + '</div>');
        return;
      }
    }

    this._el.mounted[key] = false;
    this.setHtml(host,
      '<div class="card"><div class="h3">' + this.esc(tab.label) + '</div>' +
      '<div class="tiny muted" style="margin-top:6px">This arena’s keeper is not present in this build. ' +
      'The other two are still open, and neither of them will mention it.</div>' +
      '<button class="btn wide" type="button" data-act="btab" data-id="spire" style="margin-top:10px">' +
      '\u{1F5FC} Back to the Spire</button></div>');
  },
};


/* ===========================================================================
 * SPIRE — the Demon Spire. 200 fixed floors, a named tenant every tenth, and
 * an endless procedural climb after that.
 * ========================================================================= */
const Spire = {

  BACK: 5,          // floors shown behind the player's position
  FWD: 15,          // floors shown ahead
  BOSS_SHARE: 0.74, // a boss floor's power that belongs to the boss itself
  ELITE_TITLES: ['Spire Warden', 'Landing Sentinel', 'Stair Revenant', 'Ash Adept', 'Lamp Keeper', 'Gate Hound'],

  MOD_TEXT: {
    doubleSpd:  'Moves twice for every once of yours.',
    thorns:     'Returns a share of every blow you land.',
    undying1:   'The first killing blow leaves it standing on a sliver.',
    split50:    'Splits itself in two at half health.',
    healAllies: 'Mends its escort at the end of every round.',
    enrage:     'Sharpens badly once it is wounded.',
  },

  _el: null,
  _rows: null,
  _focus: 0,        // 0 = follow the player's position
  _busy: false,
  _brCache: null,

  /* ------------------------------------------------------------------ INIT */

  init() {
    this._el = null;
    this._rows = null;
    this._brCache = {};
    this._ensure();

    // Spire does not own a panel root (CONTRACT §11) — but register anyway in
    // case a shell ever ships one, so the module is never the reason it is dead.
    try {
      if (typeof UI !== 'undefined' && UI && typeof UI.register === 'function' &&
          typeof UI.panel === 'function' && UI.panel('spire')) {
        UI.register('spire', () => {
          const p = UI.panel('spire');
          if (p) Spire.renderInto(p);
        });
      }
    } catch (e) { /* no such panel: expected */ }

    try {
      Bus.on('dailyReset', () => { try { UI.dirty('battle'); } catch (err) { /* ignore */ } });
    } catch (e) { /* ignore */ }
  },

  tick(dtSec, nowMs) {
    // Nothing in the Spire accrues with time; the BR cache is invalidated when
    // the player's own BR moves, which the panel re-reads every paint.
  },

  badges() {
    if (!S || !S.created) return 0;
    if (Battle.realm() < CONFIG.spire.unlockRealm) return 0;
    let n = 0;
    if (this.attemptsLeft() > 0) n++;
    if (this.sweepLeft() > 0 && this.cleared() >= 1) n++;
    return n;
  },

  /* ==================================================== STATE (all guarded) */

  _ensure() {
    if (!S || typeof S !== 'object') return null;
    if (!S.spire || typeof S.spire !== 'object') S.spire = { floor: 0, best: 0, clears: {} };
    const sp = S.spire;
    if (!(sp.floor >= 0)) sp.floor = 0;
    if (!(sp.best >= 0)) sp.best = 0;
    if (!sp.clears || typeof sp.clears !== 'object') sp.clears = {};
    if (sp.best < sp.floor) sp.best = sp.floor;
    if (!S.daily || typeof S.daily !== 'object') S.daily = {};
    if (!(S.daily.spireAttempts >= 0)) S.daily.spireAttempts = 0;
    if (!(S.daily.sweepUsed >= 0)) S.daily.sweepUsed = 0;
    return sp;
  },

  cleared() {
    const sp = this._ensure();
    return sp ? Math.floor(sp.floor || 0) : 0;
  },

  best() {
    const sp = this._ensure();
    return sp ? Math.floor(sp.best || 0) : 0;
  },

  isCleared(f) {
    const sp = this._ensure();
    if (!sp) return false;
    if (f <= Math.floor(sp.floor || 0)) return true;
    return !!sp.clears[String(f)];
  },

  attemptsLeft() {
    this._ensure();
    const used = Math.floor((S.daily && S.daily.spireAttempts) || 0);
    return Math.max(0, CONFIG.spire.attemptsPerDay - used);
  },

  sweepLeft() {
    this._ensure();
    const used = Math.floor((S.daily && S.daily.sweepUsed) || 0);
    return Math.max(0, CONFIG.spire.sweepPerDay - used);
  },

  /* ======================================================= FLOOR MATHEMATICS */

  power(f) {
    const C = CONFIG.spire;
    const fl = Math.max(1, Math.floor(Number(f) || 1));
    if (fl <= C.floors) return C.powerBase * Math.pow(C.powerGrowth, fl);
    const cap = C.powerBase * Math.pow(C.powerGrowth, C.floors);
    return cap * Math.pow(C.proceduralGrowth, fl - C.floors);
  },

  isBoss(f) {
    const fl = Math.floor(Number(f) || 0);
    return fl > 0 && (fl % CONFIG.spire.bossEvery === 0);
  },

  /* The named tenant of a boss floor. Past floor 200 the roster cycles and the
     name carries the cycle number, so floor 410 is not simply floor 10 again. */
  boss(f) {
    if (!this.isBoss(f)) return null;
    const list = DATA.spireBosses || [];
    if (!list.length) {
      return { floor: f, name: 'The Nameless Tenant', emoji: '\u{1F311}', modifier: 'enrage',
               desc: 'The roster for this landing was lost; whatever moved in has not introduced itself.' };
    }
    const exact = list.filter(b => b && b.floor === f)[0];
    if (exact) return exact;
    const idx = (Math.floor(f / CONFIG.spire.bossEvery) - 1) % list.length;
    const base = list[(idx + list.length) % list.length];
    const cycle = Math.floor((f - 1) / (list.length * CONFIG.spire.bossEvery)) + 1;
    return {
      floor: f,
      name: 'Echo of ' + base.name + ' · ' + cycle + '′',
      emoji: base.emoji,
      modifier: base.modifier,
      desc: base.desc,
    };
  },

  modText(mod) {
    return this.MOD_TEXT[mod] || 'Fights with a habit nobody has written down yet.';
  },

  matTier(f) {
    return U.clamp(1 + Math.floor((Number(f) || 1) / 25), 1, 6);
  },

  /* A deterministic monster pool for a floor: pools drift deeper as you climb. */
  _pool(f) {
    const all = DATA.monsters || [];
    if (!all.length) return [];
    const per = 10;
    const pools = Math.max(1, Math.floor(all.length / per));
    const p = U.clamp(Math.floor((Number(f) || 1) / 34), 0, pools - 1);
    const lo = Math.max(0, (p - 1) * per);
    const hi = Math.min(all.length, (p + 1) * per + per);
    const slice = all.slice(lo, hi);
    return slice.length ? slice : all;
  },

  /* THE encounter for a floor. Deterministic: same floor, same foes, always —
     which is what lets the list print a truthful BR beside every rung. */
  foes(f) {
    const fl = Math.max(1, Math.floor(Number(f) || 1));
    const total = this.power(fl);
    const rnd = U.rngFrom(U.hash('spire:' + fl));
    const pool = this._pool(fl);
    const grab = () => (pool.length ? pool[Math.floor(rnd() * pool.length)] : null);
    const out = [];

    if (this.isBoss(fl)) {
      const b = this.boss(fl);
      out.push(Battle.makeFoe({
        name: b.name, emoji: b.emoji, element: null, role: 'bruiser',
        skill: b.modifier === 'healAllies' ? 'heal' : (b.modifier === 'split50' ? 'split' : 'heavyBlow'),
        power: total * this.BOSS_SHARE, boss: true, modifier: b.modifier,
      }));
      const share = (1 - this.BOSS_SHARE) / 2;
      for (let i = 0; i < 2; i++) {
        const m = grab();
        out.push(Battle.makeFoe({
          name: ((m && m.name) || 'Spire Guard') + '’s Attendant',
          emoji: (m && m.emoji) || '\u{1F5E1}️',
          element: (m && m.element) || null,
          role: (m && m.role) || 'swift',
          skill: (m && m.skill) || 'stunBite',
          power: total * share, elite: true,
        }));
      }
      return out;
    }

    const n = 2 + (rnd() < 0.45 ? 1 : 0);
    const per = total / n;
    for (let i = 0; i < n; i++) {
      const m = grab();
      const title = this.ELITE_TITLES[Math.floor(rnd() * this.ELITE_TITLES.length)];
      out.push(Battle.makeFoe({
        name: ((m && m.name) || 'Spire Thing') + ', ' + title,
        emoji: (m && m.emoji) || '\u{1F47A}',
        element: (m && m.element) || null,
        role: (m && m.role) || 'bruiser',
        skill: (m && m.skill) || 'heavyBlow',
        power: per, elite: true,
      }));
    }
    return out;
  },

  /* Summed Stats.br of a floor's encounter. Cached — the encounter never
     changes, so this is computed at most once per floor per session. */
  floorBR(f) {
    const key = String(Math.floor(f));
    if (!this._brCache) this._brCache = {};
    if (this._brCache[key] !== undefined) return this._brCache[key];
    let br = 0;
    try {
      const list = this.foes(f);
      for (let i = 0; i < list.length; i++) br += Battle.brOf(list[i]);
    } catch (e) { br = this.power(f); }
    if (!(br > 0)) br = this.power(f);
    this._brCache[key] = br;
    return br;
  },

  /* ==================================================================== LOOT */

  /* scale 1.0 = first clear / sweep, 0.6 = rematch. */
  purse(f, first, scale) {
    const l = Battle.newLoot();
    const fl = Math.max(1, Math.floor(f));
    const boss = this.isBoss(fl);
    const P = this.power(fl);
    const T = this.matTier(fl);
    const k = (scale > 0) ? scale : 1;

    l.stone = Math.max(1, Math.round(5.5 * Math.pow(P, 0.60) * (boss ? 2.5 : 1) * k));
    l.exp = Math.round(Battle.auraSec() * (boss ? 240 : 90) * k);

    const amt = Math.max(1, Math.round((2 + Math.floor(fl / 10)) * (boss ? 2 : 1) * k));
    Battle.addMat(l, 'herb:' + T, amt);
    Battle.addMat(l, 'core:' + T, amt);
    Battle.addMat(l, 'forge:' + T, Math.max(1, Math.round(amt * 0.8)));
    if (boss) Battle.addMat(l, 'seed:' + T, Math.max(1, Math.round(amt * 0.35)));

    if (boss) {
      l.insight += Math.max(1, Math.round((1 + Math.floor(fl / 50)) * k));
      l.tech += Math.max(1, Math.round((20 + fl * 2) * k));
    }

    if (first) {
      l.jade += boss ? CONFIG.spire.bossFirstClearJade : CONFIG.spire.firstClearJade;
      if (boss) {
        const c = Battle.randomUnownedCurio();
        if (c) l.curios.push(c);
      }
      if (fl % 25 === 0 || U.chance(0.08)) {
        const fm = Battle.randomUnownedFormula(T);
        if (fm) l.formulas.push(fm);
      }
    }
    return l;
  },

  /* ================================================================= ACTIONS */

  /* Spend an attempt and fight a floor. `f` must be the next uncleared floor,
     or any floor already beaten (a rematch, which pays a thinner purse). */
  challenge(f) {
    if (this._busy) return;
    const fl = Math.max(1, Math.floor(Number(f) || 1));
    const sp = this._ensure();
    if (!sp) return;

    if (Battle.realm() < CONFIG.spire.unlockRealm) {
      UI.toast('The Spire door does not open below ' + Battle.realmName(CONFIG.spire.unlockRealm) + '.', 'bad');
      return;
    }
    const next = this.cleared() + 1;
    const rematch = this.isCleared(fl);
    if (!rematch && fl !== next) {
      UI.toast('Floor ' + next + ' is the one in front of you. The Spire does not take queue-jumpers.', 'bad');
      return;
    }
    if (this.attemptsLeft() <= 0) {
      UI.toast('No attempts left today. The stairwell closes at dusk.', 'bad');
      return;
    }
    if (typeof Combat === 'undefined' || !Combat || typeof Combat.simulate !== 'function') {
      UI.toast('The Spire is quiet — combat is unavailable in this build.', 'bad');
      return;
    }

    S.daily.spireAttempts = Math.floor((S.daily.spireAttempts || 0) + 1);
    this._busy = true;

    const foes = this.foes(fl);
    const allies = [Battle.ally()];
    const boss = this.isBoss(fl);
    const b = boss ? this.boss(fl) : null;
    const opts = { modifiers: b && b.modifier ? [b.modifier] : [] };
    const title = boss ? (b.emoji + ' ' + b.name + ' · Floor ' + fl) : ('Demon Spire · Floor ' + fl);

    const finish = (res) => {
      this._busy = false;
      this._afterFight(res, fl, rematch);
    };

    if (typeof Combat.play !== 'function') {
      let res = null;
      try { res = Combat.simulate(allies, foes, opts); } catch (e) { res = null; }
      if (!res) { this._busy = false; UI.toast('The fight would not start.', 'bad'); return; }
      finish(res);
      return;
    }

    try {
      Combat.play({
        allies: allies, foes: foes, opts: opts, title: title,
        canSkip: rematch,
        onDone: (res) => finish(res),
      });
    } catch (e) {
      this._busy = false;
      UI.toast('The fight would not start.', 'bad');
    }
  },

  _afterFight(res, f, rematch) {
    const sp = this._ensure();
    if (!res || !sp) { try { UI.dirty('battle'); } catch (e) { /* ignore */ } return; }
    const boss = this.isBoss(f);

    if (!res.win) {
      UI.toast('Floor ' + f + ' throws you back down the stairs.', 'bad');
      try { UI.flash('red'); } catch (e) { /* ignore */ }
      try { UI.dirty('battle'); } catch (e) { /* ignore */ }
      try { Save.save(); } catch (e) { /* ignore */ }
      return;
    }

    const first = !rematch && !sp.clears[String(f)];
    if (first) {
      sp.clears[String(f)] = 1;
      if (f > Math.floor(sp.floor || 0)) sp.floor = f;
      if (f > Math.floor(sp.best || 0)) sp.best = f;
      this._focus = 0;
    }

    if (!S.stats || typeof S.stats !== 'object') S.stats = {};
    if (boss) S.stats.bosses = Math.floor((S.stats.bosses || 0) + 1);

    const loot = this.purse(f, first, first ? 1 : 0.6);
    const lines = Battle.grantLoot(loot, 'spire');

    try { Bus.emit('spireClear', { floor: f, first: !!first }); } catch (e) { /* ignore */ }

    if (first && boss) { try { UI.flash('gold'); } catch (e) { /* ignore */ } }
    const b = boss ? this.boss(f) : null;
    Battle.showLoot(
      first ? ('Floor ' + f + ' — first ascent') : ('Floor ' + f + ' — swept again'),
      lines,
      first && b ? (b.name + ' will not be answering the door again.')
                 : (first ? 'The landing is yours. The stairs keep going.' : 'Old ground, thinner spoils.')
    );

    try { UI.dirty('battle'); } catch (e) { /* ignore */ }
    try { Save.save(); } catch (e) { /* ignore */ }
  },

  /* Once a day: take the highest cleared floor's material purse with no fight. */
  sweep() {
    const sp = this._ensure();
    if (!sp) return;
    const f = this.cleared();
    if (f < 1) { UI.toast('Clear a floor before you can sweep one.', 'bad'); return; }
    if (this.sweepLeft() <= 0) { UI.toast('Already swept today. Even the dust needs a night off.', 'bad'); return; }

    S.daily.sweepUsed = Math.floor((S.daily.sweepUsed || 0) + 1);

    const loot = this.purse(f, false, 1);
    loot.jade = 0;
    loot.curios = [];
    loot.formulas = [];
    const lines = Battle.grantLoot(loot, 'spireSweep');

    try { Bus.emit('spireSweep', { floor: f }); } catch (e) { /* ignore */ }
    Battle.showLoot('Swept Floor ' + f, lines,
      'You walk the landing you already own and pick up what it owes you.');
    try { UI.dirty('battle'); } catch (e) { /* ignore */ }
    try { Save.save(); } catch (e) { /* ignore */ }
  },

  /* A preview sheet: who lives there, what they do, what they are worth. */
  preview(f) {
    const fl = Math.max(1, Math.floor(Number(f) || 1));
    const boss = this.isBoss(fl);
    const b = boss ? this.boss(fl) : null;
    const mine = Battle.myBr();
    const cleared = this.isCleared(fl);
    const next = this.cleared() + 1;
    const T = this.matTier(fl);

    let list = [];
    try { list = this.foes(fl); } catch (e) { list = []; }

    let body = '';
    if (b) {
      body += '<div class="card tight bg-gold"><div class="row" style="gap:9px">' +
        '<span class="unit-emoji" style="font-size:26px;line-height:1">' + b.emoji + '</span>' +
        '<div class="col" style="gap:2px;min-width:0"><div class="h3 gold">' + Battle.esc(b.name) + '</div>' +
        '<div class="tiny muted serif">' + Battle.esc(b.desc || '') + '</div></div></div>' +
        '<div class="divider"></div>' +
        '<div class="kv"><span class="k">Habit</span><span class="v gold">' +
        Battle.esc(this.modText(b.modifier)) + '</span></div></div>';
    }

    body += '<div class="card tight"><div class="sec-title">The Landing</div>';
    for (let i = 0; i < list.length; i++) {
      const u = list[i];
      const br = Battle.brOf(u);
      body += '<div class="kv"><span class="k">' + (u.emoji || '\u{1F47A}') + ' ' + Battle.esc(u.name) +
        '</span><span class="v ' + Battle.brClass(br, mine) + '">BR ' + Fmt.n(br) + '</span></div>';
    }
    const total = this.floorBR(fl);
    body += '<div class="kv"><span class="k"><b>Total</b></span><span class="v ' +
      Battle.brClass(total, mine) + '">BR ' + Fmt.n(total) + '</span></div>' +
      '<div class="kv"><span class="k">Your BR</span><span class="v">' + Fmt.n(mine) + '</span></div></div>';

    const p = this.purse(fl, !cleared, 1);
    body += '<div class="card tight"><div class="sec-title">Spoils</div>' +
      '<div class="kv"><span class="k">' + Battle.icon('stone') + ' Spiritstone</span><span class="v">~' + Fmt.n(p.stone) + '</span></div>' +
      '<div class="kv"><span class="k">\u{1F300} Cultivation EXP</span><span class="v">~' + Fmt.n(p.exp) + '</span></div>' +
      '<div class="kv"><span class="k">' + Battle.icon('herb:' + T) + ' Tier ' + T + ' materials</span><span class="v">herb / core / ore</span></div>';
    if (boss) {
      body += '<div class="kv"><span class="k">' + Battle.icon('tech') + ' Tech Points</span><span class="v">~' + Fmt.n(p.tech) + '</span></div>';
    }
    if (!cleared) {
      body += '<div class="kv"><span class="k">' + Battle.icon('jade') + ' First ascent</span><span class="v gold">+' +
        Fmt.n(boss ? CONFIG.spire.bossFirstClearJade : CONFIG.spire.firstClearJade) + ' Fate Jade</span></div>';
      if (boss) body += '<div class="kv"><span class="k">\u{1F5FF} Curio</span><span class="v gold">guaranteed</span></div>';
      if (fl % 25 === 0) body += '<div class="kv"><span class="k">\u{1F4DC} Formula</span><span class="v gold">guaranteed</span></div>';
    } else {
      body += '<div class="kv"><span class="k">Rematch</span><span class="v muted">60% purse, costs an attempt</span></div>';
    }
    body += '</div>';

    const buttons = [];
    const canGo = this.attemptsLeft() > 0 && (cleared || fl === next);
    if (cleared) {
      buttons.push({ label: 'Rematch (' + this.attemptsLeft() + ' left)', cls: canGo ? 'primary' : '',
        act: (c) => { c(); if (canGo) Spire.challenge(fl); } });
    } else if (fl === next) {
      buttons.push({ label: 'Climb (' + this.attemptsLeft() + ' left)', cls: canGo ? 'primary' : '',
        act: (c) => { c(); if (canGo) Spire.challenge(fl); } });
    }
    buttons.push({ label: 'Back', cls: 'ghost', act: (c) => c() });

    try {
      UI.sheet({ title: 'Floor ' + fl + (boss ? ' · Boss' : ' · Elite'), body: body, buttons: buttons });
    } catch (e) {
      try { UI.toast('Floor ' + fl + ' · BR ' + Fmt.n(total), 'info'); } catch (e2) { /* ignore */ }
    }
  },

  /* ================================================================== PANEL */

  renderInto(host) {
    if (!host) return;
    this._ensure();
    this._build(host);
    if (!this._el) return;
    this._paintHead();
    this._paintRows();
  },

  _build(host) {
    if (this._el && this._el.root && host.contains(this._el.root)) return;
    host.innerHTML = '';
    host._bHtml = null;

    const root = UI.el('div', 'col');

    const head = UI.el('div', 'card');
    head.innerHTML =
      '<div class="row between">' +
        '<div class="row" style="gap:9px;min-width:0">' +
          '<span class="unit-emoji" style="font-size:28px;line-height:1">\u{1F5FC}</span>' +
          '<div class="col" style="gap:1px;min-width:0">' +
            '<div class="h2 serif">Demon Spire</div>' +
            '<div class="tiny muted" data-f="mood">&nbsp;</div>' +
          '</div>' +
        '</div>' +
        '<div class="col" style="gap:1px;align-items:flex-end;flex:0 0 auto">' +
          '<div class="tiny muted">Cleared</div>' +
          '<div class="val mono" data-f="floor">0</div>' +
        '</div>' +
      '</div>' +
      '<div class="divider"></div>' +
      '<div class="grid3">' +
        '<div class="stat"><span class="lbl">Attempts</span><span class="val mono" data-f="att">0</span></div>' +
        '<div class="stat"><span class="lbl">Highest</span><span class="val mono" data-f="best">0</span></div>' +
        '<div class="stat"><span class="lbl">Your BR</span><span class="val mono" data-f="br">0</span></div>' +
      '</div>';
    root.appendChild(head);

    const sweep = UI.el('div', 'card tight');
    sweep.innerHTML =
      '<div class="row between">' +
        '<div class="col" style="gap:2px;min-width:0">' +
          '<div class="h3">\u{1F9F9} Daily Sweep</div>' +
          '<div class="tiny muted" data-f="swnote">&nbsp;</div>' +
        '</div>' +
        '<button class="btn sm primary" type="button" data-act="sweep">Sweep</button>' +
      '</div>';
    root.appendChild(sweep);

    const nav = UI.el('div', 'row between');
    nav.innerHTML =
      '<button class="btn ghost sm" type="button" data-act="pageDown">‹ 10</button>' +
      '<button class="btn ghost sm" type="button" data-act="pageHere">Current Floor</button>' +
      '<button class="btn ghost sm" type="button" data-act="pageUp">10 ›</button>';
    root.appendChild(nav);

    const list = UI.el('div', 'col');
    root.appendChild(list);

    // A FIXED pool of rows. Windowed, so the DOM never grows past ~21 cards no
    // matter how far up the endless procedural stair the player gets.
    this._rows = [];
    const n = this.BACK + this.FWD + 1;
    for (let i = 0; i < n; i++) {
      const row = UI.el('div', 'card tight');
      row.dataset.act = 'floor';
      row.innerHTML =
        '<div class="row between">' +
          '<div class="row" style="gap:8px;min-width:0">' +
            '<span class="unit-emoji" data-f="emoji" style="font-size:20px;line-height:1">\u{1F5FF}</span>' +
            '<div class="col" style="gap:1px;min-width:0">' +
              '<div class="h3" data-f="name">Floor</div>' +
              '<div class="tiny muted" data-f="note">&nbsp;</div>' +
            '</div>' +
          '</div>' +
          '<div class="col" style="gap:3px;align-items:flex-end;flex:0 0 auto">' +
            '<span class="tiny mono" data-f="br">BR 0</span>' +
            '<button class="btn sm" type="button" data-act="go">Climb</button>' +
          '</div>' +
        '</div>';
      list.appendChild(row);
      this._rows.push({
        el: row,
        emoji: row.querySelector('[data-f="emoji"]'),
        name: row.querySelector('[data-f="name"]'),
        note: row.querySelector('[data-f="note"]'),
        br: row.querySelector('[data-f="br"]'),
        btn: row.querySelector('[data-act="go"]'),
        floor: 0,
      });
    }

    host.appendChild(root);

    this._el = {
      root: root,
      mood: head.querySelector('[data-f="mood"]'),
      floor: head.querySelector('[data-f="floor"]'),
      att: head.querySelector('[data-f="att"]'),
      best: head.querySelector('[data-f="best"]'),
      br: head.querySelector('[data-f="br"]'),
      swnote: sweep.querySelector('[data-f="swnote"]'),
      swbtn: sweep.querySelector('[data-act="sweep"]'),
    };

    root.addEventListener('click', (e) => {
      const t = e.target.closest('[data-act]');
      if (!t || !root.contains(t)) return;
      const act = t.dataset.act;

      if (act === 'sweep') { Spire.sweep(); return; }
      if (act === 'pageDown') {
        const cur = Spire._focus || (Spire.cleared() + 1);
        Spire._focus = Math.max(1, cur - 10);
        Spire.renderInto(root.parentNode); return;
      }
      if (act === 'pageUp') {
        const cur = Spire._focus || (Spire.cleared() + 1);
        Spire._focus = Math.min(Spire.cleared() + 1 + 200, cur + 10);
        Spire.renderInto(root.parentNode); return;
      }
      if (act === 'pageHere') { Spire._focus = 0; Spire.renderInto(root.parentNode); return; }

      if (act === 'go') {
        const row = t.closest('[data-act="floor"]');
        const f = row ? Number(row.dataset.id) : 0;
        if (f > 0) Spire.challenge(f);
        return;
      }
      if (act === 'floor') {
        const f = Number(t.dataset.id) || 0;
        if (f > 0) Spire.preview(f);
        return;
      }
    });
  },

  _paintHead() {
    const d = this._el;
    const cleared = this.cleared();
    const att = this.attemptsLeft();
    const mine = Battle.myBr();

    d.floor.textContent = String(cleared);
    d.att.textContent = att + ' / ' + CONFIG.spire.attemptsPerDay;
    d.best.textContent = String(this.best());
    d.br.textContent = Fmt.n(mine);

    const next = cleared + 1;
    const nextBR = this.floorBR(next);
    let mood;
    if (cleared <= 0) mood = 'A stairwell with two hundred landings and no handrail.';
    else if (cleared >= CONFIG.spire.floors) mood = 'Past the roster. The stair keeps inventing landings.';
    else if (nextBR > mine * 1.4) mood = 'Floor ' + next + ' is well above your weight. Come back stronger.';
    else if (nextBR > mine) mood = 'Floor ' + next + ' is a real fight. Bring everything.';
    else mood = 'Floor ' + next + ' is within reach.';
    d.mood.textContent = mood;

    const sweepLeft = this.sweepLeft();
    if (cleared < 1) {
      d.swnote.textContent = 'Clear a floor and you may collect it again, daily, without swinging.';
      d.swbtn.disabled = true;
      d.swbtn.textContent = 'Sweep';
    } else if (sweepLeft <= 0) {
      d.swnote.textContent = 'Swept today. Floor ' + cleared + ' has nothing left loose.';
      d.swbtn.disabled = true;
      d.swbtn.textContent = 'Swept';
    } else {
      d.swnote.textContent = 'Take floor ' + cleared + '’s purse instantly — ' + sweepLeft +
        ' left today, tier ' + this.matTier(cleared) + ' materials.';
      d.swbtn.disabled = false;
      d.swbtn.textContent = 'Sweep';
    }
  },

  _paintRows() {
    const cleared = this.cleared();
    const centre = this._focus > 0 ? this._focus : (cleared + 1);
    const start = Math.max(1, centre - this.BACK);
    const mine = Battle.myBr();
    const att = this.attemptsLeft();
    const next = cleared + 1;

    for (let i = 0; i < this._rows.length; i++) {
      const r = this._rows[i];
      const f = start + i;
      r.floor = f;
      r.el.dataset.id = String(f);

      const boss = this.isBoss(f);
      const b = boss ? this.boss(f) : null;
      const done = this.isCleared(f);
      const br = this.floorBR(f);

      r.emoji.textContent = boss ? (b.emoji || '\u{1F311}') : (f === next ? '\u{1F6AA}' : (done ? '✅' : '\u{1F5FF}'));
      r.name.textContent = 'Floor ' + f + (boss ? ' · ' + b.name : '');
      r.br.textContent = 'BR ' + Fmt.n(br);
      r.br.className = 'tiny mono ' + Battle.brClass(br, mine);

      let note;
      if (boss) note = this.modText(b.modifier);
      else if (done) note = 'Cleared. Rematch pays 60%.';
      else if (f === next) note = 'The landing directly above you.';
      else note = 'Sealed until floor ' + (f - 1) + ' falls.';
      r.note.textContent = note;

      r.el.classList.toggle('bg-gold', boss && !done);
      r.el.classList.toggle('locked', f > next);

      if (f > next) {
        r.btn.hidden = true;
      } else {
        r.btn.hidden = false;
        r.btn.textContent = done ? 'Rematch' : 'Climb';
        r.btn.className = 'btn sm' + (f === next && !done ? ' primary' : '');
        r.btn.disabled = att <= 0;
      }
    }
  },
};


/* ===========================================================================
 * TIDE — the Beast Tide. Five waves, one boon draft between each, and no free
 * heals: what the last wave took off you, you carry into the next.
 * ========================================================================= */
const Tide = {

  LORDS: [
    { name: 'The Drowned Ox-King', emoji: '\u{1F402}' },
    { name: 'Nine-Mouth Reef Warden', emoji: '\u{1F421}' },
    { name: 'The Salt-Crowned Devourer', emoji: '\u{1F988}' },
    { name: 'Old Bitterbrine', emoji: '\u{1F419}' },
    { name: 'The Wave That Remembers', emoji: '\u{1F30A}' },
  ],
  PREFIX: ['Tide-Driven', 'Brine-Slick', 'Storm-Herded', 'Foam-Blind', 'Deepwater'],

  _el: null,
  _busy: false,
  _offlineStamp: -1,
  _choiceSig: '',

  /* ------------------------------------------------------------------ INIT */

  init() {
    this._el = null;
    this._choiceSig = '';
    this._ensure();

    try {
      if (typeof UI !== 'undefined' && UI && typeof UI.register === 'function' &&
          typeof UI.panel === 'function' && UI.panel('tide')) {
        UI.register('tide', () => {
          const p = UI.panel('tide');
          if (p) Tide.renderInto(p);
        });
      }
    } catch (e) { /* no such panel: expected */ }

    try {
      if (typeof Offline !== 'undefined' && Offline && typeof Offline.provider === 'function') {
        Offline.provider((sec, now) => Tide.offline(sec, now));
      }
    } catch (e) { console.warn('[Tide] Offline.provider unavailable', e); }

    // A brand-new save should not have to wait two days for its first defence.
    const t = this._ensure();
    if (t && !(t.nextAt > 0)) t.nextAt = 0;
  },

  tick(dtSec, nowMs) {
    // The cooldown is an absolute epoch, so there is nothing to advance here.
    // Time-warp of any size is handled by ready()/cdLeft() reading the clock.
  },

  /* Reports readiness across an absence; grants nothing (nothing accrues). */
  offline(elapsedSec, nowMs) {
    const now = nowMs || Date.now();
    if (!S || !S.created) return [];
    if (this._offlineStamp === now) return [];
    this._offlineStamp = now;
    if (Battle.realm() < CONFIG.tide.unlockRealm) return [];

    const t = this._ensure();
    if (!t) return [];
    const lines = [];
    if (t.run) {
      lines.push({ icon: '\u{1F30A}', label: 'A Beast Tide run is still open',
                   amount: 'Wave ' + Math.max(1, Math.floor(t.run.wave || 1)) + ' is waiting' });
    } else if (now >= (t.nextAt || 0)) {
      lines.push({ icon: '\u{1F30A}', label: 'The Beast Tide has come in', amount: 'Ready to defend' });
    }
    return lines;
  },

  badges() {
    if (!S || !S.created) return 0;
    if (Battle.realm() < CONFIG.tide.unlockRealm) return 0;
    const t = this._ensure();
    if (!t) return 0;
    if (t.run) return 1;
    return Date.now() >= (t.nextAt || 0) ? 1 : 0;
  },

  /* ==================================================== STATE (all guarded) */

  _ensure() {
    if (!S || typeof S !== 'object') return null;
    if (!S.tide || typeof S.tide !== 'object') S.tide = { nextAt: 0, run: null };
    const t = S.tide;
    if (!(t.nextAt >= 0)) t.nextAt = 0;
    if (!(t.best >= 0)) t.best = 0;
    if (t.run && typeof t.run === 'object') {
      const r = t.run;
      if (!(r.wave >= 1)) r.wave = 1;
      if (!(r.cleared >= 0)) r.cleared = 0;
      if (!Array.isArray(r.boons)) r.boons = [];
      if (r.choices != null && !Array.isArray(r.choices)) r.choices = null;
      if (!(r.hp >= 0)) r.hp = 0;
      if (!(r.maxHp >= 0)) r.maxHp = 0;
      if (!(r.shield >= 0)) r.shield = 0;
      if (!(r.seed > 0)) r.seed = 1;
      if (r.wave > CONFIG.tide.waves) r.wave = CONFIG.tide.waves;
    } else {
      t.run = null;
    }
    if (!S.flags || typeof S.flags !== 'object') S.flags = {};
    return t;
  },

  run() {
    const t = this._ensure();
    return t ? t.run : null;
  },

  ready(nowMs) {
    const t = this._ensure();
    if (!t) return false;
    return (nowMs || Date.now()) >= (t.nextAt || 0);
  },

  cdLeftSec(nowMs) {
    const t = this._ensure();
    if (!t) return 0;
    const left = ((t.nextAt || 0) - (nowMs || Date.now())) / 1000;
    return left > 0 ? left : 0;
  },

  /* ============================================================ WAVE SHAPES */

  waveScale(w) {
    const arr = CONFIG.tide.waveScale || [];
    const i = U.clamp(Math.floor(w) - 1, 0, Math.max(0, arr.length - 1));
    const v = Number(arr[i]);
    return (Number.isFinite(v) && v > 0) ? v : 1;
  },

  /* Combined foe BR for a wave, measured off the player's own BR. */
  waveBR(w) {
    return Math.max(1, Battle.myBr() * this.waveScale(w));
  },

  /* Foes for a wave. Seeded off the run so a mid-run reload rebuilds the same
     line-up, and a Skip re-roll cannot be farmed. */
  waveFoes(w, seed) {
    const total = this.waveBR(w);
    const rnd = U.rngFrom(U.hash('tide:' + (seed || 1) + ':' + w));
    const all = DATA.monsters || [];
    const grab = () => (all.length ? all[Math.floor(rnd() * all.length)] : null);
    const out = [];
    const last = (w >= CONFIG.tide.waves);

    if (last) {
      const lord = this.LORDS[Math.floor(rnd() * this.LORDS.length)] || this.LORDS[0];
      out.push(Battle.makeFoe({
        name: lord.name, emoji: lord.emoji, element: 'frost', role: 'bruiser',
        skill: 'enrage', power: total * 0.52, boss: true,
      }));
      for (let i = 0; i < 3; i++) {
        const m = grab();
        out.push(Battle.makeFoe({
          name: this.PREFIX[Math.floor(rnd() * this.PREFIX.length)] + ' ' + ((m && m.name) || 'Beast'),
          emoji: (m && m.emoji) || '\u{1F43E}',
          element: (m && m.element) || null,
          role: (m && m.role) || 'swift',
          skill: (m && m.skill) || 'heavyBlow',
          power: total * 0.16, elite: true,
        }));
      }
      return out;
    }

    const n = 3;
    for (let i = 0; i < n; i++) {
      const m = grab();
      out.push(Battle.makeFoe({
        name: this.PREFIX[Math.floor(rnd() * this.PREFIX.length)] + ' ' + ((m && m.name) || 'Beast'),
        emoji: (m && m.emoji) || '\u{1F43E}',
        element: (m && m.element) || null,
        role: (m && m.role) || 'bruiser',
        skill: (m && m.skill) || 'heavyBlow',
        power: total / n, elite: true,
      }));
    }
    return out;
  },

  /* ==================================================================== BOONS */

  boonById(id) {
    const list = DATA.tideBoons || [];
    for (let i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return list[i];
    return null;
  },

  heldBoons() {
    const r = this.run();
    if (!r) return [];
    const out = [];
    for (let i = 0; i < r.boons.length; i++) {
      const b = this.boonById(r.boons[i]);
      if (b) out.push(b);
    }
    return out;
  },

  /* Draw CONFIG.tide.boonChoices ids, preferring ones not already held. */
  drawBoons() {
    const r = this.run();
    const held = r ? r.boons : [];
    const list = (DATA.tideBoons || []).filter(b => b && b.id);
    if (!list.length) return [];
    let pool = list.filter(b => held.indexOf(b.id) < 0);
    if (pool.length < CONFIG.tide.boonChoices) pool = list.slice();
    const shuffled = U.shuffle(pool);
    const out = [];
    for (let i = 0; i < shuffled.length && out.length < CONFIG.tide.boonChoices; i++) {
      out.push(shuffled[i].id);
    }
    return out;
  },

  /* Sum of a boon key across everything held. */
  boonSum(key) {
    const held = this.heldBoons();
    let v = 0;
    for (let i = 0; i < held.length; i++) if (held[i].key === key) v += (Number(held[i].val) || 0);
    return v;
  },

  /* The descriptors handed to Combat via opts.boons. `applied:true` tells a
     boon-aware engine that Tide has already folded these into the unit. */
  boonOpts() {
    const held = this.heldBoons();
    const out = [];
    for (let i = 0; i < held.length; i++) {
      out.push({ id: held[i].id, key: held[i].key, val: Number(held[i].val) || 0,
                 name: held[i].name, applied: true });
    }
    return out;
  },

  /* The player's unit for a wave: carried HP, carried shield, boons folded in.
     If DATA ever ships apply(unit) hooks they are honoured too. */
  waveAlly() {
    const r = this.run();
    const u = Battle.ally();
    if (!r) return u;

    if (!(r.maxHp > 0)) r.maxHp = u.maxHp;
    if (r.hp > 0) u.hp = U.clamp(Math.round(r.hp), 1, u.maxHp);
    else r.hp = u.hp;

    const held = this.heldBoons();
    for (let i = 0; i < held.length; i++) {
      const b = held[i];
      const val = Number(b.val) || 0;
      if (b.key === 'atk') { u.patk = Math.round(u.patk * (1 + val)); u.matk = Math.round(u.matk * (1 + val)); }
      else if (b.key === 'spd') { u.spd = Math.round(u.spd * (1 + val)); }
      else if (b.key === 'lifesteal') { u.lifesteal = U.clamp((Number(u.lifesteal) || 0) + val, 0, 1); }
      else if (b.key === 'thorns') { u.thorns = (Number(u.thorns) || 0) + val; }
      if (typeof b.apply === 'function') { try { b.apply(u); } catch (e) { /* content hook is optional */ } }
    }

    const shieldPct = this.boonSum('shield');
    const carried = Math.max(0, Number(r.shield) || 0);
    const shield = Math.round(carried + shieldPct * u.maxHp);
    if (shield > 0) { u.shield = shield; u.carryShield = shield; }
    return u;
  },

  /* ================================================================= ACTIONS */

  begin() {
    if (this._busy) return;
    const t = this._ensure();
    if (!t) return;
    const now = Date.now();

    if (Battle.realm() < CONFIG.tide.unlockRealm) {
      UI.toast('The beasts do not bother you below ' + Battle.realmName(CONFIG.tide.unlockRealm) + '.', 'bad');
      return;
    }
    if (t.run) { UI.toast('A defence is already under way.', 'info'); return; }
    if (!this.ready(now)) {
      UI.toast('The tide is out. ' + Fmt.dur(this.cdLeftSec(now)) + ' until it turns.', 'bad');
      return;
    }
    if (typeof Combat === 'undefined' || !Combat || typeof Combat.simulate !== 'function') {
      UI.toast('The shore is quiet — combat is unavailable in this build.', 'bad');
      return;
    }

    // Stamp the cooldown at the START, so abandoning a run cannot farm it.
    t.nextAt = now + CONFIG.tide.cooldownSec * 1000;
    t.run = {
      wave: 1, cleared: 0, boons: [], choices: null,
      hp: 0, maxHp: 0, shield: 0,
      seed: Math.abs(U.hash('tide' + now + ':' + (S.player && S.player.name ? S.player.name : ''))) || 1,
      startedAt: now,
    };

    const firstTime = !S.flags.firstTide;
    if (firstTime) {
      S.flags.firstTide = true;
      try {
        if (typeof Story !== 'undefined' && Story && typeof Story.beat === 'function') Story.beat('firstTide');
      } catch (e) { /* ignore */ }
    }

    try { Save.save(); } catch (e) { /* ignore */ }
    try { UI.dirty('battle'); } catch (e) { /* ignore */ }

    // Let the shifu finish talking before the first wave hits.
    if (firstTime) setTimeout(() => { try { Tide.fight(); } catch (e) { /* ignore */ } }, 700);
    else this.fight();
  },

  fight() {
    if (this._busy) return;
    const t = this._ensure();
    const r = t && t.run;
    if (!r) { UI.toast('No defence is running.', 'info'); return; }
    if (r.choices && r.choices.length) { UI.toast('Take a boon before the next wave.', 'info'); return; }
    if (typeof Combat === 'undefined' || !Combat || typeof Combat.simulate !== 'function') {
      UI.toast('The shore is quiet — combat is unavailable in this build.', 'bad');
      return;
    }

    this._busy = true;
    const w = U.clamp(Math.floor(r.wave || 1), 1, CONFIG.tide.waves);
    const ally = this.waveAlly();
    const foes = this.waveFoes(w, r.seed);
    const opts = { boons: this.boonOpts(), modifiers: [] };
    const canSkip = w <= Math.floor(t.best || 0);

    const finish = (res) => { this._busy = false; this._afterWave(res, w); };

    if (typeof Combat.play !== 'function') {
      let res = null;
      try { res = Combat.simulate([ally], foes, opts); } catch (e) { res = null; }
      if (!res) { this._busy = false; UI.toast('The wave would not break.', 'bad'); return; }
      finish(res);
      return;
    }

    try {
      Combat.play({
        allies: [ally], foes: foes, opts: opts,
        title: '\u{1F30A} Beast Tide · Wave ' + w + ' / ' + CONFIG.tide.waves,
        canSkip: canSkip,
        onDone: (res) => finish(res),
      });
    } catch (e) {
      this._busy = false;
      UI.toast('The wave would not break.', 'bad');
    }
  },

  _afterWave(res, w) {
    const t = this._ensure();
    const r = t && t.run;
    if (!r) return;
    if (!res) { try { UI.dirty('battle'); } catch (e) { /* ignore */ } return; }

    if (!res.win) {
      UI.toast('Wave ' + w + ' walks over you.', 'bad');
      try { UI.flash('red'); } catch (e) { /* ignore */ }
      this._finish(r.cleared, false);
      return;
    }

    // Thread the survivor forward: HP and shield CARRY. No free heal.
    let sur = null;
    try { sur = (res.allies && res.allies.length) ? res.allies[0] : null; } catch (e) { sur = null; }
    if (sur) {
      if (sur.maxHp > 0) r.maxHp = sur.maxHp;
      r.hp = Math.max(1, Math.round(Number(sur.hp) || 1));
      r.shield = Math.max(0, Math.round(Number(sur.shield) || 0));
    } else if (res.allyHpPct != null && r.maxHp > 0) {
      r.hp = Math.max(1, Math.round(r.maxHp * U.clamp(Number(res.allyHpPct) || 0, 0.01, 1)));
      r.shield = 0;
    }

    r.cleared = Math.max(r.cleared, w);
    if (w > Math.floor(t.best || 0)) t.best = w;
    try { Bus.emit('tideWave', { wave: w }); } catch (e) { /* ignore */ }

    if (w >= CONFIG.tide.waves) { this._finish(CONFIG.tide.waves, true); return; }

    r.wave = w + 1;
    r.choices = this.drawBoons();
    if (!r.choices.length) r.choices = null;

    UI.toast('Wave ' + w + ' broken. ' + (r.choices ? 'Choose your boon.' : 'Brace.'), 'good');
    try { UI.dirty('battle'); } catch (e) { /* ignore */ }
    try { Save.save(); } catch (e) { /* ignore */ }
  },

  /* Take one of the three offered boons. Every heal boon held pays out at this
     between-wave interval, which is the only moment HP ever comes back. */
  pickBoon(id) {
    const t = this._ensure();
    const r = t && t.run;
    if (!r) return;
    if (!r.choices || r.choices.indexOf(id) < 0) { UI.toast('That boon is not on offer.', 'bad'); return; }
    const b = this.boonById(id);
    if (!b) { UI.toast('That boon slipped away.', 'bad'); return; }

    r.boons.push(id);
    r.choices = null;

    const healPct = this.boonSum('heal');
    if (healPct > 0 && r.maxHp > 0) {
      const before = r.hp;
      r.hp = U.clamp(Math.round(r.hp + healPct * r.maxHp), 1, r.maxHp);
      const gain = r.hp - before;
      if (gain > 0) UI.toast(b.emoji + ' ' + b.name + ' · +' + Fmt.n(gain) + ' HP', 'good');
      else UI.toast(b.emoji + ' ' + b.name + ' taken.', 'good');
    } else {
      UI.toast(b.emoji + ' ' + b.name + ' taken.', 'good');
    }

    this._choiceSig = '';
    try { UI.dirty('battle'); } catch (e) { /* ignore */ }
    try { Save.save(); } catch (e) { /* ignore */ }
  },

  /* Walk away and bank what the run has already earned. */
  retreat() {
    const r = this.run();
    if (!r) return;
    const waves = r.cleared;
    UI.confirm('Sound the retreat?',
      waves > 0
        ? ('You keep the spoils of ' + waves + ' wave' + (waves === 1 ? '' : 's') + ' and the shore keeps the rest.')
        : 'You have not broken a single wave. You will leave with nothing but the walk home.',
      () => Tide._finish(waves, false));
  },

  _finish(waves, full) {
    const t = this._ensure();
    if (!t) return;
    const n = U.clamp(Math.floor(waves || 0), 0, CONFIG.tide.waves);

    const loot = this.purse(n, !!full);
    const lines = Battle.grantLoot(loot, 'tide');

    t.run = null;
    this._choiceSig = '';

    try { Bus.emit('tideClear', { waves: n }); } catch (e) { /* ignore */ }
    if (full) { try { UI.flash('jade'); } catch (e) { /* ignore */ } }

    Battle.showLoot(
      full ? 'The Tide Turns Back' : (n > 0 ? 'Held for ' + n + ' Wave' + (n === 1 ? '' : 's') : 'The Shore Is Lost'),
      lines,
      full ? 'Five waves, and the water goes back to being only water.'
           : (n > 0 ? 'You gave ground, but not for free.' : 'Next time, further up the beach.')
    );

    try { UI.dirty('battle'); } catch (e) { /* ignore */ }
    try { Save.save(); } catch (e) { /* ignore */ }
  },

  /* Full clear pays the chest; a partial pays per wave survived. */
  purse(waves, full) {
    const l = Battle.newLoot();
    const n = U.clamp(Math.floor(waves || 0), 0, CONFIG.tide.waves);
    if (n <= 0 && !full) return l;

    const br = Math.max(1, Battle.myBr());
    const T = U.clamp(1 + Math.floor(Battle.realm() / 2), 1, 6);

    l.jade = full ? CONFIG.tide.fullClearJade : CONFIG.tide.perWaveJade * n;
    l.stone = Math.max(1, Math.round(12 * Math.pow(br, 0.55) * (full ? 3 : 0.5 * n)));
    l.exp = Math.round(Battle.auraSec() * 3600 * (full ? 2 : 0.3 * n));

    const amt = full ? (6 + Battle.realm()) : Math.max(1, 2 * n);
    Battle.addMat(l, 'herb:' + T, amt);
    Battle.addMat(l, 'core:' + T, amt);
    Battle.addMat(l, 'forge:' + T, amt);
    if (full) {
      Battle.addMat(l, 'seed:' + T, Math.max(1, Math.round(amt * 0.5)));
      l.dust += 20 + Battle.realm() * 6;
      l.insight += 2;
      if (U.chance(0.25)) {
        const c = Battle.randomUnownedCurio();
        if (c) l.curios.push(c);
      }
    }
    return l;
  },

  /* ================================================================== PANEL */

  renderInto(host) {
    if (!host) return;
    this._ensure();
    this._build(host);
    if (!this._el) return;
    this._paint();
  },

  _build(host) {
    if (this._el && this._el.root && host.contains(this._el.root)) return;
    host.innerHTML = '';
    host._bHtml = null;

    const root = UI.el('div', 'col');

    const head = UI.el('div', 'card');
    head.innerHTML =
      '<div class="row between">' +
        '<div class="row" style="gap:9px;min-width:0">' +
          '<span class="unit-emoji" style="font-size:28px;line-height:1">\u{1F30A}</span>' +
          '<div class="col" style="gap:1px;min-width:0">' +
            '<div class="h2 serif">Beast Tide</div>' +
            '<div class="tiny muted" data-f="mood">&nbsp;</div>' +
          '</div>' +
        '</div>' +
        '<div class="col" style="gap:1px;align-items:flex-end;flex:0 0 auto">' +
          '<div class="tiny muted" data-f="statelbl">Status</div>' +
          '<div class="val mono" data-f="state">—</div>' +
        '</div>' +
      '</div>' +
      '<div class="meter" style="margin:9px 0 6px"><i data-f="wbar"></i></div>' +
      '<div class="row between tiny"><span class="lbl" data-f="wlbl">Waves</span>' +
        '<span class="mono muted" data-f="wval">0 / 5</span></div>';
    root.appendChild(head);

    const hpCard = UI.el('div', 'card tight');
    hpCard.innerHTML =
      '<div class="row between"><div class="h3">\u{1F9D8} Your Line</div>' +
        '<span class="chip" data-f="hpchip">—</span></div>' +
      '<div class="bar hp" style="margin:7px 0 4px"><i data-f="hpbar"></i></div>' +
      '<div class="tiny muted" data-f="hpnote">&nbsp;</div>';
    root.appendChild(hpCard);

    const boonCard = UI.el('div', 'card tight');
    boonCard.innerHTML =
      '<div class="sec-title">Boons Held</div>' +
      '<div class="col" data-f="held"></div>';
    root.appendChild(boonCard);

    const choiceSec = UI.el('div', 'sec');
    choiceSec.innerHTML = '<div class="sec-title">Choose One</div><div class="col" data-f="choices"></div>';
    root.appendChild(choiceSec);

    const wavesCard = UI.el('div', 'card tight');
    wavesCard.innerHTML = '<div class="sec-title">The Five Waves</div><div class="col" data-f="waves"></div>';
    root.appendChild(wavesCard);

    const actions = UI.el('div', 'row');
    actions.innerHTML =
      '<button class="btn primary wide" type="button" data-act="go">Begin the Defence</button>' +
      '<button class="btn ghost" type="button" data-act="retreat">Retreat</button>';
    root.appendChild(actions);

    host.appendChild(root);

    this._el = {
      root: root,
      mood: head.querySelector('[data-f="mood"]'),
      state: head.querySelector('[data-f="state"]'),
      stateLbl: head.querySelector('[data-f="statelbl"]'),
      wbar: head.querySelector('[data-f="wbar"]'),
      wlbl: head.querySelector('[data-f="wlbl"]'),
      wval: head.querySelector('[data-f="wval"]'),
      hpChip: hpCard.querySelector('[data-f="hpchip"]'),
      hpBar: hpCard.querySelector('[data-f="hpbar"]'),
      hpNote: hpCard.querySelector('[data-f="hpnote"]'),
      boonCard: boonCard,
      held: boonCard.querySelector('[data-f="held"]'),
      choiceSec: choiceSec,
      choices: choiceSec.querySelector('[data-f="choices"]'),
      waves: wavesCard.querySelector('[data-f="waves"]'),
      goBtn: actions.querySelector('[data-act="go"]'),
      retreatBtn: actions.querySelector('[data-act="retreat"]'),
    };

    root.addEventListener('click', (e) => {
      const t = e.target.closest('[data-act]');
      if (!t || !root.contains(t)) return;
      const act = t.dataset.act;
      if (act === 'go') {
        if (Tide.run()) Tide.fight(); else Tide.begin();
        return;
      }
      if (act === 'retreat') { Tide.retreat(); return; }
      if (act === 'boon') { Tide.pickBoon(t.dataset.id); return; }
    });
  },

  _paint() {
    const d = this._el;
    const t = this._ensure();
    const now = Date.now();
    const r = t ? t.run : null;
    const waves = CONFIG.tide.waves;

    /* ---- header ---------------------------------------------------- */
    if (r) {
      d.stateLbl.textContent = 'Wave';
      d.state.textContent = Math.min(waves, Math.floor(r.wave || 1)) + ' / ' + waves;
      d.mood.textContent = r.choices
        ? 'The water pauses. Take something with you into the next one.'
        : 'They are still coming. Nothing has healed on its own.';
    } else if (this.ready(now)) {
      d.stateLbl.textContent = 'Status';
      d.state.textContent = 'Ready';
      d.mood.textContent = 'Something has stirred the deep water and it is walking ashore.';
    } else {
      d.stateLbl.textContent = 'Next tide';
      d.state.textContent = Fmt.durShort(this.cdLeftSec(now));
      d.mood.textContent = 'The shore is quiet. It will not stay that way.';
    }

    const done = r ? r.cleared : 0;
    d.wbar.style.width = Fmt.pct(U.clamp(done / waves, 0, 1), 0);
    d.wlbl.textContent = r ? 'Waves broken' : 'Best ever';
    d.wval.textContent = (r ? done : Math.floor((t && t.best) || 0)) + ' / ' + waves;

    /* ---- the line -------------------------------------------------- */
    if (r) {
      const maxHp = r.maxHp > 0 ? r.maxHp : Math.max(1, this._probeMaxHp());
      const hp = r.hp > 0 ? Math.min(r.hp, maxHp) : maxHp;
      d.hpChip.textContent = Fmt.n(hp) + ' / ' + Fmt.n(maxHp);
      d.hpBar.style.width = Fmt.pct(U.clamp(hp / maxHp, 0, 1), 0);
      const sh = Math.max(0, Math.round(r.shield || 0));
      d.hpNote.textContent = (sh > 0 ? 'Shield ' + Fmt.n(sh) + ' carried over. ' : '') +
        'Wounds carry between waves — only a Dew boon gives blood back.';
    } else {
      const maxHp = Math.max(1, this._probeMaxHp());
      d.hpChip.textContent = Fmt.n(maxHp) + ' / ' + Fmt.n(maxHp);
      d.hpBar.style.width = '100%';
      d.hpNote.textContent = 'You start whole. You will not be whole again until it is over.';
    }

    /* ---- boons held ------------------------------------------------- */
    const held = this.heldBoons();
    if (!held.length) {
      Battle.setHtml(d.held, '<div class="empty tiny">No boons yet. They are drafted between waves.</div>');
    } else {
      let html = '';
      for (let i = 0; i < held.length; i++) {
        const b = held[i];
        html += '<div class="kv"><span class="k">' + b.emoji + ' ' + Battle.esc(b.name) +
          '</span><span class="v jade">' + this._boonEffect(b) + '</span></div>';
      }
      Battle.setHtml(d.held, html);
    }
    d.boonCard.hidden = !r && !held.length;

    /* ---- the draft --------------------------------------------------- */
    if (r && r.choices && r.choices.length) {
      const sig = r.choices.join('|');
      if (sig !== this._choiceSig) {
        this._choiceSig = sig;
        let html = '';
        for (let i = 0; i < r.choices.length; i++) {
          const b = this.boonById(r.choices[i]);
          if (!b) continue;
          html += '<div class="card tight bg-purple" data-act="boon" data-id="' + Battle.esc(b.id) + '">' +
            '<div class="row between"><div class="row" style="gap:8px;min-width:0">' +
              '<span class="unit-emoji" style="font-size:20px;line-height:1">' + b.emoji + '</span>' +
              '<div class="col" style="gap:1px;min-width:0">' +
                '<div class="h3">' + Battle.esc(b.name) + '</div>' +
                '<div class="tiny muted serif">' + Battle.esc(b.desc || '') + '</div>' +
              '</div></div>' +
              '<span class="chip jade" style="flex:0 0 auto">' + this._boonEffect(b) + '</span>' +
            '</div></div>';
        }
        Battle.setHtml(d.choices, html || '<div class="empty tiny">Nothing on offer.</div>');
      }
      d.choiceSec.hidden = false;
    } else {
      d.choiceSec.hidden = true;
      this._choiceSig = '';
    }

    /* ---- the wave board ---------------------------------------------- */
    const mine = Battle.myBr();
    let wh = '';
    for (let w = 1; w <= waves; w++) {
      const br = this.waveBR(w);
      const state = r
        ? (w <= r.cleared ? '<span class="good">broken</span>'
                          : (w === Math.floor(r.wave || 1) ? '<span class="gold">next</span>' : '<span class="muted">waiting</span>'))
        : '<span class="muted">' + Fmt.pct(this.waveScale(w), 0) + ' of your BR</span>';
      wh += '<div class="kv"><span class="k">' + (w === waves ? '\u{1F451}' : '\u{1F30A}') + ' Wave ' + w +
        ' · ' + state + '</span><span class="v ' + Battle.brClass(br, mine) + '">BR ' + Fmt.n(br) + '</span></div>';
    }
    Battle.setHtml(d.waves, wh);

    /* ---- buttons ------------------------------------------------------ */
    if (r) {
      d.goBtn.textContent = 'Fight Wave ' + Math.min(waves, Math.floor(r.wave || 1));
      d.goBtn.disabled = !!(r.choices && r.choices.length) || this._busy;
      d.retreatBtn.hidden = false;
      d.retreatBtn.disabled = this._busy;
    } else if (this.ready(now)) {
      d.goBtn.textContent = 'Begin the Defence';
      d.goBtn.disabled = this._busy;
      d.retreatBtn.hidden = true;
    } else {
      d.goBtn.textContent = 'Tide returns in ' + Fmt.dur(this.cdLeftSec(now));
      d.goBtn.disabled = true;
      d.retreatBtn.hidden = true;
    }
  },

  _boonEffect(b) {
    const v = Number(b.val) || 0;
    if (b.key === 'atk') return '+' + Fmt.pct(v, 0) + ' ATK';
    if (b.key === 'spd') return '+' + Fmt.pct(v, 0) + ' SPD';
    if (b.key === 'heal') return '+' + Fmt.pct(v, 0) + ' HP / wave';
    if (b.key === 'shield') return Fmt.pct(v, 0) + ' shield';
    if (b.key === 'thorns') return Fmt.pct(v, 0) + ' reflect';
    if (b.key === 'lifesteal') return '+' + Fmt.pct(v, 0) + ' lifesteal';
    return Fmt.pct(v, 0);
  },

  _probeMaxHp() {
    let hp = 0;
    try { hp = Number(Stats.block().hp) || 0; } catch (e) { hp = 0; }
    if (hp > 0) return hp;
    try { hp = Number(Battle.ally().maxHp) || 0; } catch (e) { hp = 0; }
    return hp > 0 ? hp : 1;
  },
};

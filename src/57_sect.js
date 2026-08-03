/* ---------------------------------------------------------------------------
 * Sect — sect membership, contribution rank, daily duties, meditation,
 *        the contribution library, and the weekly Sect Clash.
 *
 * Owns panel 'sect'. Unlocks at CONFIG.unlocks.sect (== CONFIG.sect.unlockRealm).
 *
 * FORMULAS
 *   rankIndex        = max i where CONFIG.sect.ranks[i].req <= S.lifetimeContribution
 *   rankProgress     = (lifetime - req[i]) / (req[i+1] - req[i])          (1 at max rank)
 *   sect bonus       = DATA.sects[joined].bonus -> acc[key] += val         (Stats.provider)
 *   rank perks       = for every ATTAINED rank r: best[r.perk] = max(best[r.perk], r.val)
 *                      then acc[key] += best[key]   (so a later rank that switches
 *                      perk key never silently removes the earlier one)
 *   meditation       = while nowMs < S.sect.medUntil:
 *                        acc.aura += (CONFIG.sect.meditationMult - 1)
 *                      Stats.bonus('aura') is a 1+sum multiplier, so adding 2 with no
 *                      other aura sources yields exactly the x3 the spec asks for.
 *                      medUntil = start + CONFIG.sect.meditationSec*1000  (absolute epoch)
 *   task need        = rint(tpl.min, tpl.max)
 *   task pay         = contribution = max(15, round((45 + 38*realm) * tpl.w))
 *                      citrine      = max(3,  round((6  + 1.6*realm) * tpl.w))
 *   switch cost      = S.cur.contribution     *= (1 - CONFIG.sect.switchPenalty)
 *                      S.lifetimeContribution *= (1 - CONFIG.sect.switchPenalty)
 *                      allowed when now - (lastSwitch || joinedAt) >= switchCooldownDays
 *   clash roster     = you + CONFIG.sect.clashElders elders at BR scale rand(0.80,1.10)
 *                      rivals at rand(0.78,1.12) * rivalTier, rivalTier = 0.94 + 0.03*wk
 *                      each pairing resolved by Combat.simulate (headless, seeded);
 *                      side taking 3+ of the 5 pairings wins
 *   clash chest      = win : citrine 90 + 22*realm, contribution 150 + 60*realm,
 *                            stone 600*(1+realm), herb/core tier T, 25% curio roll
 *                      loss: citrine 30 +  8*realm, contribution 60  + 20*realm,
 *                            stone 200*(1+realm), herb tier T
 *   material tier T  = clamp(floor(realm/2) + 1, 1, 6)
 *
 * BUS
 *   emits    sectJoin {id} · sectMeditate {} · clashDone {win} · shopBuy {shop,id}
 *   consumes dailyReset · weeklyReset · and every task event:
 *            pillUsed · pillCrafted · huntClear · respira · duelFight · spireClear ·
 *            expeditionClaim · gardenHarvest · abodeUpgrade · gearCrafted
 *
 * PUBLIC
 *   Sect.addContribution(n)   grants contribution + lifetime, re-evaluates rank
 * ------------------------------------------------------------------------ */
const Sect = {

  /* ------------------------------------------------------------------ state
     Runtime-only scratch. Nothing here is saved. */
  _n: null,          // patched node references
  _built: false,
  _wired: false,     // panel-root click listener attached once, ever
  _quiet: false,     // suppress the promotion modal (a report modal is queued)
  _acc: 0,           // tick accumulator (seconds)
  _medOn: false,     // last-known meditation active state
  _taskSig: '',      // rebuild task rows only when the roll changes
  _libSig: '',       // rebuild library rows only when the shelf changes
  _tplCache: null,

  /* ------------------------------------------------------------------- init */
  init() {
    this._ensure();

    try {
      if (typeof Stats !== 'undefined' && typeof Stats.provider === 'function') {
        Stats.provider((acc) => Sect.statBonus(acc));
      }
    } catch (e) { console.warn('[Sect] stats provider failed', e); }

    try {
      if (typeof UI !== 'undefined' && typeof UI.register === 'function') {
        UI.register('sect', () => Sect.render());
      }
    } catch (e) { console.warn('[Sect] panel register failed', e); }

    /* daily / weekly rollovers */
    Bus.on('dailyReset', () => {
      const sc = Sect._ensure();
      if (!sc) return;
      Sect._rollTasks(true);
      Sect._syncBadge();
      UI.dirty('sect');
    });
    Bus.on('weeklyReset', () => {
      if (!S) return;
      if (!S.weekly || typeof S.weekly !== 'object') S.weekly = { tasks: [], clashDone: false };
      S.weekly.clashDone = false;
      Sect._syncBadge();
      UI.dirty('sect');
    });

    /* Task progress is fully automatic: every template maps to a real Bus event
       and the player never clicks anything to "register" a chore. */
    const seen = Object.create(null);
    for (const tpl of this._templates()) {
      if (seen[tpl.evt]) continue;
      seen[tpl.evt] = true;
      const evt = tpl.evt;
      Bus.on(evt, (d) => Sect._onTaskEvent(evt, d));
    }

    this._syncBadge();
  },

  /* ------------------------------------------------------------------- tick */
  /* Cheap and closed-form — safe for dtSec up to 3600 (time warp). */
  tick(dtSec, nowMs) {
    if (!S || !S.created) return;
    this._acc += (Number(dtSec) || 0);
    if (this._acc < 1) return;
    this._acc = 0;

    const now = Number(nowMs) || Date.now();
    const sc = this._ensure();
    if (!sc) return;

    /* meditation window opening/closing changes the aura multiplier */
    const on = !!(sc.id && sc.medUntil > now);
    if (on !== this._medOn) {
      this._medOn = on;
      try { Stats.recompute(); } catch (e) { /* stats may not be ready */ }
      UI.dirty('sect', 'cultivate');
      if (!on) UI.toast('The meditation window closes. The mountain exhales.', 'info');
    }

    /* self-heal: a save loaded across midnight without a dailyReset still rolls */
    if (sc.id && sc.tasksDay !== U.todayStr()) {
      this._rollTasks(true);
      this._syncBadge();
      UI.dirty('sect');
    }

    /* live countdowns want a repaint about once a second */
    if (on || (sc.id && !S.weekly.clashDone)) UI.dirty('sect');
  },

  /* ----------------------------------------------------------------- badges */
  badges() {
    if (!S || !S.player) return 0;
    if ((S.player.realm | 0) < CONFIG.unlocks.sect) return 0;
    const sc = this._ensure();
    if (!sc) return 0;
    if (!sc.id) return 1;                       // "pick a sect" nudge
    let n = 0;
    const list = Array.isArray(sc.tasks) ? sc.tasks : [];
    for (const t of list) if (t && t.done && !t.claimed) n++;
    if (!S.daily || !S.daily.sectMedUsed) n++;
    if (!S.weekly || !S.weekly.clashDone) n++;
    return n;
  },

  _syncBadge() {
    try { UI.badge('more.sect', this.badges()); } catch (e) { /* UI not ready */ }
  },

  /* ================================================================= PUBLIC */

  /* Grant contribution. Adds to the spendable pool AND the lifetime total that
     drives rank, then re-evaluates the rank ladder. Returns the amount granted. */
  addContribution(n) {
    const sc = this._ensure();
    if (!sc) return 0;
    const v = Math.max(0, Math.floor(Number(n) || 0));
    if (v <= 0) return 0;
    Econ.grant('contribution', v);
    S.lifetimeContribution = Math.max(0, (Number(S.lifetimeContribution) || 0) + v);
    this._checkRank(true);
    UI.dirty('sect');
    this._syncBadge();
    return v;
  },

  /* Stats provider: sect identity bonus + attained rank perks + meditation aura. */
  statBonus(acc) {
    if (!acc || !S || !S.sect || !S.sect.id) return;
    const sect = this._sect();
    if (sect && sect.bonus && sect.bonus.key) {
      const k = String(sect.bonus.key);
      acc[k] = (Number(acc[k]) || 0) + (Number(sect.bonus.val) || 0);
    }

    const best = this._rankPerks();
    for (const k in best) acc[k] = (Number(acc[k]) || 0) + best[k];

    if ((Number(S.sect.medUntil) || 0) > Date.now()) {
      const mult = Number(CONFIG.sect.meditationMult) || 1;
      acc.aura = (Number(acc.aura) || 0) + (mult - 1);
    }
  },

  /* ================================================================ HELPERS */

  _ensure() {
    if (!S) return null;
    if (!S.sect || typeof S.sect !== 'object') {
      S.sect = { id: null, joinedAt: 0, rank: 0, lastSwitch: 0, tasks: [], medUntil: 0 };
    }
    const sc = S.sect;
    if (typeof sc.id !== 'string') sc.id = null;
    if (typeof sc.joinedAt !== 'number' || !isFinite(sc.joinedAt)) sc.joinedAt = 0;
    if (typeof sc.rank !== 'number' || !isFinite(sc.rank)) sc.rank = 0;
    if (typeof sc.lastSwitch !== 'number' || !isFinite(sc.lastSwitch)) sc.lastSwitch = 0;
    if (typeof sc.medUntil !== 'number' || !isFinite(sc.medUntil)) sc.medUntil = 0;
    if (!Array.isArray(sc.tasks)) sc.tasks = [];
    if (typeof sc.tasksDay !== 'string') sc.tasksDay = '';
    if (typeof S.lifetimeContribution !== 'number' || !isFinite(S.lifetimeContribution)) {
      S.lifetimeContribution = 0;
    }
    if (!S.daily || typeof S.daily !== 'object') S.daily = {};
    if (!S.weekly || typeof S.weekly !== 'object') S.weekly = { tasks: [], clashDone: false };
    if (!S.shops || typeof S.shops !== 'object') S.shops = { market: {}, black: {}, bought: {} };
    if (!S.shops.bought || typeof S.shops.bought !== 'object') S.shops.bought = {};
    if (!S.inv || typeof S.inv !== 'object') S.inv = { pills: {}, formulas: [], blueprints: [], gear: [], nextUid: 1 };
    if (!Array.isArray(S.inv.formulas)) S.inv.formulas = [];
    if (!Array.isArray(S.inv.blueprints)) S.inv.blueprints = [];
    return sc;
  },

  _sect() {
    if (!S || !S.sect || !S.sect.id) return null;
    const list = (DATA && Array.isArray(DATA.sects)) ? DATA.sects : [];
    if (typeof DATAX !== 'undefined' && DATAX.sectById && DATAX.sectById[S.sect.id]) {
      return DATAX.sectById[S.sect.id];
    }
    for (const s of list) if (s && s.id === S.sect.id) return s;
    return null;
  },

  _realm() { return (S && S.player && (S.player.realm | 0)) || 0; },

  _matTier() { return U.clamp(Math.floor(this._realm() / 2) + 1, 1, 6); },

  _esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  _rankIndex() {
    const ranks = (CONFIG.sect && CONFIG.sect.ranks) || [];
    const life = (S && Number(S.lifetimeContribution)) || 0;
    let idx = 0;
    for (let i = 0; i < ranks.length; i++) {
      if (life >= (Number(ranks[i].req) || 0)) idx = i;
    }
    return idx;
  },

  /* Best value per perk key across every ATTAINED rank, so Core Disciple
     switching the key to allStat never silently drops Inner's aura perk. */
  _rankPerks() {
    const ranks = (CONFIG.sect && CONFIG.sect.ranks) || [];
    const ri = this._rankIndex();
    const best = Object.create(null);
    for (let i = 0; i <= ri && i < ranks.length; i++) {
      const r = ranks[i];
      if (!r || !r.perk) continue;
      const v = Number(r.val) || 0;
      if (!(best[r.perk] >= v)) best[r.perk] = v;
    }
    return best;
  },

  _rankTitle(i) {
    const T = [
      'Water-Carrier of the Long Stair',
      'Keeper of the Inner Gate',
      'Named in the Core Ledger',
      'Voice in the Elder Hall',
      'Sovereign of the Whole Mountain',
    ];
    return T[U.clamp(i, 0, T.length - 1)] || T[0];
  },

  _bonusLabel(key, val) {
    if (!key) return 'No listed boon';
    const NAMES = {
      aura: 'Cultivation Aura', respiraExp: 'Respira EXP', pillExp: 'Pill EXP',
      pillAttempts: 'Daily Pill Attempts', btChance: 'Breakthrough Chance',
      expedition: 'Expedition Yield', alchemyQuality: 'Pill Quality',
      forgeQuality: 'Forge Quality', curioPower: 'Curio Power', lawProc: 'Law Proc',
      offlineHours: 'Offline Cap', allStat: 'All Stats', hp: 'HP', patk: 'Physical ATK',
      matk: 'Magic ATK', pdef: 'Physical DEF', mdef: 'Magic DEF', spd: 'Speed',
      crit: 'Crit Rate', critDmg: 'Crit DMG', lifesteal: 'Lifesteal', dodge: 'Dodge',
      shield: 'Shield', thrall: 'Thrall Power',
    };
    const flat = (key === 'pillAttempts' || key === 'offlineHours');
    const nm = NAMES[key] || key;
    if (flat) return Fmt.sign(val) + (key === 'offlineHours' ? 'h ' : ' ') + nm;
    return '+' + Fmt.pct(Number(val) || 0, 0) + ' ' + nm;
  },

  _nextDailyMs() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0).getTime();
  },

  _nextWeeklyMs() {
    const d = new Date();
    const dow = (d.getDay() + 6) % 7;                 // Mon = 0
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + (7 - dow), 0, 0, 0, 0).getTime();
  },

  /* ============================================================ DAILY TASKS */

  /* Every template maps to a REAL Bus event (CONTRACT §3) and auto-completes.
     `amount` names a payload field to add instead of 1. `match` filters payloads.
     `unlock` is the realm the underlying feature opens at. */
  _templates() {
    if (this._tplCache) return this._tplCache;
    const un = CONFIG.unlocks;
    this._tplCache = [
      { id: 'pill',    evt: 'pillUsed',        emoji: '\u{1F48A}', label: 'Swallow %n pills for the hall records',
        min: 2, max: 5, w: 1.00, unlock: un.alchemy },
      { id: 'hunt',    evt: 'huntClear',       emoji: '\u{1F5FA}️', label: 'Clear %n stages in the wilds',
        min: 5, max: 12, w: 1.00, unlock: un.wilds },
      { id: 'boss',    evt: 'huntClear',       emoji: '\u{1F479}', label: 'Fell %n wild bosses',
        min: 1, max: 2, w: 1.35, unlock: un.wilds, match: (d) => !!(d && d.boss) },
      { id: 'respira', evt: 'respira',         emoji: '\u{1F32C}️', label: 'Draw the Respira %n times',
        min: 3, max: 8, w: 0.90, unlock: un.respira },
      { id: 'craft',   evt: 'pillCrafted',     emoji: '⚗️', label: 'Refine %n pills for the dispensary',
        min: 2, max: 4, w: 1.15, unlock: un.alchemy },
      { id: 'duel',    evt: 'duelFight',       emoji: '\u{1F3C5}', label: 'Win %n duels on the sect ladder',
        min: 1, max: 3, w: 1.30, unlock: un.duel, match: (d) => !!(d && d.win) },
      { id: 'spire',   evt: 'spireClear',      emoji: '\u{1F5FC}', label: 'Clear %n floors of the Spire',
        min: 1, max: 2, w: 1.30, unlock: un.spire },
      { id: 'exped',   evt: 'expeditionClaim', emoji: '\u{1F9ED}', label: 'Bring an expedition home',
        min: 1, max: 1, w: 0.85, unlock: un.wilds },
      { id: 'garden',  evt: 'gardenHarvest',   emoji: '\u{1F331}', label: 'Harvest %n herbs from the garden',
        min: 2, max: 5, w: 0.85, unlock: un.garden, amount: 'n' },
      { id: 'abode',   evt: 'abodeUpgrade',    emoji: '\u{1F3E0}', label: 'Improve a room of your abode',
        min: 1, max: 1, w: 1.40, unlock: un.abode },
      { id: 'gear',    evt: 'gearCrafted',     emoji: '\u{1F528}', label: 'Forge %n pieces of gear',
        min: 1, max: 3, w: 1.15, unlock: un.forge },
    ];
    return this._tplCache;
  },

  _tpl(id) {
    const list = this._templates();
    for (const t of list) if (t.id === id) return t;
    return null;
  },

  _taskText(task) {
    const tpl = this._tpl(task && task.id);
    if (!tpl) return 'A chore nobody remembers assigning';
    return String(tpl.label).replace('%n', String(task.need));
  },

  _rollTasks(force) {
    const sc = this._ensure();
    if (!sc || !sc.id) return;
    const today = U.todayStr();
    if (!force && sc.tasksDay === today && sc.tasks.length) return;

    const realm = this._realm();
    const pool = [];
    for (const t of this._templates()) if (realm >= (t.unlock | 0)) pool.push(t);
    if (!pool.length) { sc.tasks = []; sc.tasksDay = today; return; }

    const want = Math.max(1, CONFIG.sect.dailyTasks | 0);
    const bag = U.shuffle(pool);
    const out = [];
    for (let i = 0; i < want; i++) {
      const tpl = bag[i % bag.length];           // repeats only if the pool is short
      if (!tpl) break;
      const need = Math.max(1, U.rint(tpl.min, tpl.max));
      out.push({
        id: tpl.id,
        need: need,
        prog: 0,
        done: false,
        claimed: false,
        cont: Math.max(15, Math.round((45 + realm * 38) * tpl.w)),
        cit: Math.max(3, Math.round((6 + realm * 1.6) * tpl.w)),
      });
    }
    sc.tasks = out;
    sc.tasksDay = today;
    this._taskSig = '';
  },

  _onTaskEvent(evt, data) {
    if (!S || !S.created) return;
    const sc = this._ensure();
    if (!sc || !sc.id || !Array.isArray(sc.tasks) || !sc.tasks.length) return;
    const d = data || {};
    let changed = false;

    for (const task of sc.tasks) {
      if (!task || task.done) continue;
      const tpl = this._tpl(task.id);
      if (!tpl || tpl.evt !== evt) continue;
      if (typeof tpl.match === 'function' && !tpl.match(d)) continue;

      let inc = 1;
      if (tpl.amount) {
        const raw = Math.floor(Number(d[tpl.amount]));
        inc = (Number.isFinite(raw) && raw > 0) ? raw : 1;
      }
      task.prog = Math.min(task.need, (Number(task.prog) || 0) + inc);
      changed = true;
      if (task.prog >= task.need) {
        task.done = true;
        UI.toast('Sect duty done — ' + this._taskText(task), 'good');
      }
    }

    if (changed) {
      this._taskSig = '';
      UI.dirty('sect');
      this._syncBadge();
    }
  },

  _claimTask(idx) {
    const sc = this._ensure();
    if (!sc || !sc.id) return false;
    const task = sc.tasks[idx];
    if (!task) return false;
    if (!task.done) { UI.toast('That duty is not finished yet.', 'bad'); return false; }
    if (task.claimed) return false;
    task.claimed = true;
    const cit = Math.max(0, Math.floor(Number(task.cit) || 0));
    if (cit > 0) Econ.grant('citrine', cit);
    this.addContribution(task.cont);
    UI.toast('+' + Fmt.n(task.cont) + ' contribution, +' + Fmt.n(cit) + ' citrine', 'gold');
    this._taskSig = '';
    UI.dirty('sect');
    this._syncBadge();
    Save.save();
    return true;
  },

  _claimAll() {
    const sc = this._ensure();
    if (!sc || !sc.id) return;
    let n = 0, cont = 0, cit = 0;
    for (let i = 0; i < sc.tasks.length; i++) {
      const t = sc.tasks[i];
      if (!t || !t.done || t.claimed) continue;
      t.claimed = true;
      const c = Math.max(0, Math.floor(Number(t.cit) || 0));
      if (c > 0) Econ.grant('citrine', c);
      cont += Math.max(0, Math.floor(Number(t.cont) || 0));
      cit += c;
      n++;
    }
    if (!n) { UI.toast('Nothing to collect.', 'info'); return; }
    if (cont > 0) this.addContribution(cont);
    UI.toast('Collected ' + n + ' duties: +' + Fmt.n(cont) + ' contribution, +' + Fmt.n(cit) + ' citrine', 'gold');
    this._taskSig = '';
    UI.dirty('sect');
    this._syncBadge();
    Save.save();
  },

  /* ================================================================== RANKS */

  _checkRank(announce) {
    const sc = this._ensure();
    if (!sc) return;
    const idx = this._rankIndex();
    const was = sc.rank | 0;
    if (idx === was) return;
    sc.rank = idx;
    try { Stats.recompute(); } catch (e) { /* ignore */ }
    UI.dirty('sect', 'cultivate');
    if (idx <= was || !announce) return;
    const ranks = (CONFIG.sect && CONFIG.sect.ranks) || [];
    /* _quiet is set while another modal (the clash report) is about to open, so
       the promotion still toasts but does not fight for the modal slot. */
    if (this._quiet) {
      UI.toast('Promoted: ' + ((ranks[idx] && ranks[idx].name) || 'a higher seat'), 'gold');
      return;
    }
    this._announcePromotion(idx);
  },

  _announcePromotion(idx) {
    const ranks = (CONFIG.sect && CONFIG.sect.ranks) || [];
    const r = ranks[idx];
    if (!r) return;
    const sect = this._sect();
    const perk = r.perk ? this._bonusLabel(r.perk, r.val) : '';
    UI.toast('Promoted: ' + r.name, 'gold');
    try { UI.flash('gold'); } catch (e) { /* optional */ }
    UI.modal({
      title: 'Promotion',
      body: `<div class="row"><span class="unit-emoji">${this._esc(sect ? sect.emoji : '\u{1F3EF}')}</span>
          <div class="col"><div class="h2">${this._esc(r.name)}</div>
            <div class="tiny muted">${this._esc(this._rankTitle(idx))}</div></div></div>
        <p class="muted tiny" style="margin-top:10px">The hall registrar crosses out a line, writes another,
          and does not look up. That is the whole ceremony.</p>
        ${perk ? '<div class="kv"><span class="k">Rank perk</span><span class="v good">' + this._esc(perk) + '</span></div>' : ''}`,
      buttons: [{ label: 'Bow', cls: 'primary', act: (close) => close() }],
    });
  },

  _showRankLadder() {
    const ranks = (CONFIG.sect && CONFIG.sect.ranks) || [];
    const life = (S && Number(S.lifetimeContribution)) || 0;
    const cur = this._rankIndex();
    let rows = '';
    for (let i = 0; i < ranks.length; i++) {
      const r = ranks[i];
      const has = i <= cur;
      rows += `<div class="row between" style="padding:7px 0">
        <div class="col" style="min-width:0">
          <div class="lbl ${has ? 'gold' : 'muted'}">${this._esc(r.name)}</div>
          <div class="tiny muted">${this._esc(this._rankTitle(i))} · ${this._esc(this._bonusLabel(r.perk, r.val))}</div>
        </div><span class="chip${has ? ' good' : ''}">${Fmt.n(r.req)}</span></div>`;
    }
    UI.modal({
      title: 'Contribution Ladder',
      body: `<p class="muted tiny">Lifetime contribution: <span class="gold">${Fmt.n(life)}</span>.
        Spending contribution never costs you rank — the ledger remembers everything you ever handed in.</p>
        <div class="sec">${rows}</div>`,
      buttons: [{ label: 'Close', cls: 'primary', act: (close) => close() }],
    });
  },

  /* ============================================================ JOIN/SWITCH */

  _join(id) {
    const sc = this._ensure();
    if (!sc) return;
    const list = (DATA && Array.isArray(DATA.sects)) ? DATA.sects : [];
    let target = null;
    for (const s of list) if (s && s.id === id) target = s;
    if (!target) { UI.toast('That sect keeps no gate here.', 'bad'); return; }

    const now = Date.now();
    sc.id = target.id;
    sc.joinedAt = now;
    sc.medUntil = 0;
    sc.tasks = [];
    sc.tasksDay = '';
    this._rollTasks(true);
    this._checkRank(false);
    try { Stats.recompute(); } catch (e) { /* ignore */ }
    Bus.emit('sectJoin', { id: target.id });
    UI.toast('You are now of the ' + target.name + '.', 'gold');
    try { UI.flash('jade'); } catch (e) { /* optional */ }
    this._taskSig = ''; this._libSig = '';
    UI.dirty('sect', 'cultivate');
    this._syncBadge();
    Save.saveNow();
  },

  _switchCooldownLeftMs() {
    const sc = this._ensure();
    if (!sc || !sc.id) return 0;
    const base = sc.lastSwitch || sc.joinedAt || 0;
    const need = (Number(CONFIG.sect.switchCooldownDays) || 0) * 86400000;
    const left = (base + need) - Date.now();
    return left > 0 ? left : 0;
  },

  _openSwitch() {
    const sc = this._ensure();
    if (!sc || !sc.id) return;
    const left = this._switchCooldownLeftMs();
    const pen = Number(CONFIG.sect.switchPenalty) || 0;
    const list = (DATA && Array.isArray(DATA.sects)) ? DATA.sects : [];

    const body = UI.el('div');
    body.innerHTML = `<p class="muted tiny">Leaving costs ${Fmt.pct(pen, 0)} of your contribution — both the coin
        in your hand and the lifetime ledger that sets your rank. The gate opens again after
        ${CONFIG.sect.switchCooldownDays | 0} days.</p>
      ${left > 0 ? '<div class="empty">The registrar will not hear it for another ' + this._esc(Fmt.dur(left / 1000)) + '.</div>' : ''}
      <div class="col" id="sctSwList" style="margin-top:8px"></div>`;
    const holder = body.querySelector('#sctSwList');

    for (const s of list) {
      if (!s || s.id === sc.id) continue;
      const card = UI.el('div', 'card tight');
      card.innerHTML = `<div class="row between"><div class="row" style="min-width:0">
          <span class="unit-emoji">${this._esc(s.emoji)}</span>
          <div class="col" style="min-width:0"><div class="lbl">${this._esc(s.name)}</div>
            <div class="tiny jade">${this._esc(this._bonusLabel(s.bonus && s.bonus.key, s.bonus && s.bonus.val))}</div></div>
        </div>
        <button class="btn sm${left > 0 ? '' : ' danger'}" data-sw="${this._esc(s.id)}"${left > 0 ? ' disabled' : ''}>Defect</button></div>
        <div class="tiny muted" style="margin-top:6px">${this._esc(s.blurb)}</div>`;
      holder.appendChild(card);
    }
    if (!holder.children.length) {
      holder.innerHTML = '<div class="empty">There is nowhere else to go.</div>';
    }

    body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-sw]');
      if (!b || b.disabled) return;
      const id = b.dataset.sw;
      const cur = Number(S.cur && S.cur.contribution) || 0;
      const life = Number(S.lifetimeContribution) || 0;
      UI.confirm(
        'Defect?',
        'You will forfeit ' + Fmt.n(Math.floor(cur * pen)) + ' contribution and ' +
        Fmt.n(Math.floor(life * pen)) + ' of your lifetime ledger. Rank may fall with it.',
        () => { UI.closeModal(); Sect._doSwitch(id); }
      );
    });

    UI.modal({
      title: 'Switch Sect',
      wide: true,
      body,
      buttons: [{ label: 'Stay', cls: 'ghost', act: (close) => close() }],
    });
  },

  _doSwitch(id) {
    const sc = this._ensure();
    if (!sc || !sc.id) return;
    if (this._switchCooldownLeftMs() > 0) { UI.toast('Too soon. The registrar has a memory.', 'bad'); return; }
    const pen = U.clamp(Number(CONFIG.sect.switchPenalty) || 0, 0, 1);
    const wasRank = this._rankIndex();

    const cur = Math.max(0, Math.floor(Number(S.cur && S.cur.contribution) || 0));
    const lose = Math.floor(cur * pen);
    if (lose > 0) Econ.spend('contribution', lose);
    S.lifetimeContribution = Math.max(0, Math.floor((Number(S.lifetimeContribution) || 0) * (1 - pen)));

    sc.lastSwitch = Date.now();
    this._join(id);
    const nowRank = this._rankIndex();
    if (nowRank < wasRank) {
      const ranks = CONFIG.sect.ranks || [];
      UI.toast('Demoted to ' + ((ranks[nowRank] && ranks[nowRank].name) || 'Outer Disciple') + '.', 'bad');
    }
  },

  /* ============================================================= MEDITATION */

  _meditate() {
    const sc = this._ensure();
    if (!sc || !sc.id) { UI.toast('Join a sect first.', 'bad'); return; }
    const now = Date.now();
    if (sc.medUntil > now) { UI.toast('You are already sitting.', 'info'); return; }
    if (S.daily.sectMedUsed) { UI.toast('The meditation hall is closed until tomorrow.', 'bad'); return; }

    const sec = Math.max(1, Number(CONFIG.sect.meditationSec) || 600);
    sc.medUntil = now + sec * 1000;              // absolute epoch, survives reload
    S.daily.sectMedUsed = 1;
    this._medOn = true;
    Bus.emit('sectMeditate', {});
    try { Stats.recompute(); } catch (e) { /* ignore */ }
    try { UI.flash('jade'); } catch (e) { /* optional */ }
    UI.toast('The hall goes quiet. Aura x' + (Number(CONFIG.sect.meditationMult) || 1) +
      ' for ' + Fmt.dur(sec) + '.', 'gold');
    UI.dirty('sect', 'cultivate');
    this._syncBadge();
    Save.save();
  },

  /* ================================================================== CLASH */

  _statBlock() {
    const b = CONFIG.baseStats;
    const c = CONFIG.combat;
    const p = (typeof Stats !== 'undefined' && Stats.p) ? Stats.p : null;
    const g = (k, d) => {
      const v = p ? Number(p[k]) : NaN;
      return (Number.isFinite(v) && v > 0) ? v : d;
    };
    return {
      hp: g('hp', b.hp), mp: g('mp', b.mp),
      patk: g('patk', b.patk), matk: g('matk', b.matk),
      pdef: g('pdef', b.pdef), mdef: g('mdef', b.mdef), spd: g('spd', b.spd),
      crit: g('crit', c.baseCrit), critDmg: g('critDmg', c.baseCritDmg),
      hit: g('hit', c.baseHit),
      dodge: (p && Number.isFinite(Number(p.dodge))) ? Number(p.dodge) : c.baseDodge,
      lifesteal: (p && Number.isFinite(Number(p.lifesteal))) ? Number(p.lifesteal) : 0,
    };
  },

  _makeUnit(name, emoji, side, block, mult, element, skillName) {
    const m = Number(mult) || 1;
    const hp = Math.max(1, Math.round(block.hp * m));
    const mp = Math.max(0, Math.round(block.mp * m));
    return {
      name: name, emoji: emoji, side: side,
      element: element || null, path: null,
      hp: hp, maxHp: hp, mp: mp, maxMp: mp,
      patk: Math.max(1, Math.round(block.patk * m)),
      matk: Math.max(1, Math.round(block.matk * m)),
      pdef: Math.max(0, Math.round(block.pdef * m)),
      mdef: Math.max(0, Math.round(block.mdef * m)),
      spd: Math.max(1, Math.round(block.spd * m)),
      crit: U.clamp(block.crit, 0, 1),
      critDmg: Math.max(1, block.critDmg),
      hit: U.clamp(block.hit, CONFIG.combat.hitFloor, CONFIG.combat.hitCeil),
      dodge: U.clamp(block.dodge, 0, 0.6),
      lifesteal: U.clamp(block.lifesteal, 0, 1),
      skill: { id: 'sect_formation', name: skillName || 'Formation Strike', cd: 3, mult: 1.8, kind: 'phys', target: 'one' },
      isPlayer: false, isThrall: false,
    };
  },

  _playerUnit() {
    let u = null;
    try {
      if (typeof Stats !== 'undefined' && typeof Stats.unit === 'function') u = Stats.unit();
    } catch (e) { u = null; }
    if (!u || typeof u !== 'object') {
      u = this._makeUnit((S.player && S.player.name) || 'You', '\u{1F9D8}', 'ally', this._statBlock(), 1, null, 'Sect Art');
      u.isPlayer = true;
    }
    u.side = 'ally';
    if (!u.name) u.name = (S.player && S.player.name) || 'You';
    if (!u.emoji) u.emoji = '\u{1F9D8}';
    return u;
  },

  _clashRoster() {
    const block = this._statBlock();
    const sect = this._sect();
    const wheel = CONFIG.combat.elementWheel || [];
    const emojis = ['\u{1F9D4}', '\u{1F477}', '\u{1F9DA}', '\u{1F9D9}', '\u{1F471}'];
    const nEld = Math.max(0, CONFIG.sect.clashElders | 0);

    const allies = [this._playerUnit()];
    for (let i = 0; i < nEld; i++) {
      const seed = U.hash((sect ? sect.id : 'sect') + ':elder:' + i + ':' + (S.createdAt || 0));
      const nm = uNameFrom(seed, DATA.names && DATA.names.surnames, DATA.names && DATA.names.givens, DATA.names && DATA.names.epithets);
      const u = this._makeUnit(nm, emojis[i % emojis.length], 'ally', block,
        U.rand(0.80, 1.10), wheel[i % Math.max(1, wheel.length)] || null, 'Shared Formation');
      allies.push(u);
    }

    /* rival roster: a comparable budget, nudged by the week so it never feels flat */
    const list = (DATA && Array.isArray(DATA.sects)) ? DATA.sects : [];
    const others = [];
    for (const s of list) if (s && (!sect || s.id !== sect.id)) others.push(s);
    const rival = others.length ? U.pick(others)
      : { id: 'wander', name: 'the Wandering Ascetics', emoji: '\u{1F3D4}️' };

    const wk = Math.abs(U.hash(U.weekStr())) % 7;
    const tier = 0.94 + 0.03 * wk;
    const foes = [];
    for (let i = 0; i < allies.length; i++) {
      const seed = U.hash(rival.id + ':rival:' + i + ':' + U.weekStr());
      const nm = uNameFrom(seed, DATA.names && DATA.names.surnames, DATA.names && DATA.names.givens, DATA.names && DATA.names.epithets);
      foes.push(this._makeUnit(nm, emojis[(i + 2) % emojis.length], 'foe', block,
        U.rand(0.78, 1.12) * tier, wheel[(i + 2) % Math.max(1, wheel.length)] || null, 'Rival Formation'));
    }
    return { allies: allies, foes: foes, rival: rival, sect: sect };
  },

  _runClash() {
    const sc = this._ensure();
    if (!sc || !sc.id) { UI.toast('Join a sect first.', 'bad'); return; }
    if (S.weekly.clashDone) { UI.toast('This week’s clash is already settled.', 'bad'); return; }

    const r = this._clashRoster();
    const pairs = [];
    let wins = 0;

    for (let i = 0; i < r.allies.length; i++) {
      const ally = r.allies[i];
      const foe = r.foes[i];
      if (!ally || !foe) continue;
      const seed = U.hash('clash:' + i + ':' + Date.now() + ':' + Math.random());
      let res = null;
      try {
        res = Combat.simulate([U.deepClone(ally)], [U.deepClone(foe)],
          { seed: seed, maxRounds: CONFIG.combat.maxRounds });
      } catch (e) {
        console.warn('[Sect] clash pairing failed', e);
      }
      const win = !!(res && res.win);
      if (win) wins++;
      pairs.push({
        ally: ally.name, allyEmoji: ally.emoji,
        foe: foe.name, foeEmoji: foe.emoji,
        win: win,
        rounds: (res && Number(res.rounds)) || CONFIG.combat.maxRounds,
        hp: Math.round(U.clamp((res && Number(res.allyHpPct)) || 0, 0, 1) * 100),
        you: i === 0,
      });
    }

    /* 5 pairings by default -> 3 wins takes the field */
    const needWins = Math.max(1, Math.ceil(pairs.length / 2));
    const win = wins >= needWins;
    S.weekly.clashDone = true;
    this._quiet = true;
    let chest = [];
    try { chest = this._clashRewards(win); } finally { this._quiet = false; }
    Bus.emit('clashDone', { win: win });
    this._showClashReport(pairs, wins, win, r, chest);
    UI.dirty('sect');
    this._syncBadge();
    Save.saveNow();
  },

  _clashRewards(win) {
    const realm = this._realm();
    const t = this._matTier();
    const lines = [];
    const cit = win ? (90 + realm * 22) : (30 + realm * 8);
    const cont = win ? (150 + realm * 60) : (60 + realm * 20);
    const stone = win ? 600 * (1 + realm) : 200 * (1 + realm);
    const herb = win ? (6 + realm) : 3;
    const core = win ? (3 + realm) : 1;

    Econ.grant('citrine', cit);
    lines.push({ k: 'Citrine', v: '+' + Fmt.n(cit) });
    this.addContribution(cont);
    lines.push({ k: 'Contribution', v: '+' + Fmt.n(cont) });
    Econ.grant('stone', stone);
    lines.push({ k: 'Spirit Stones', v: '+' + Fmt.n(stone) });
    Econ.grant('herb:' + t, herb);
    lines.push({ k: 'Herbs (T' + t + ')', v: '+' + Fmt.n(herb) });
    if (core > 0) {
      Econ.grant('core:' + t, core);
      lines.push({ k: 'Beast Cores (T' + t + ')', v: '+' + Fmt.n(core) });
    }

    if (win && U.chance(0.25)) {
      const got = this._grantRandomCurio();
      if (got) lines.push({ k: 'Curio', v: got });
    }
    return lines;
  },

  _grantRandomCurio() {
    try {
      if (typeof Curios === 'undefined' || typeof Curios.own !== 'function') return '';
      const all = (DATA && Array.isArray(DATA.curios)) ? DATA.curios : [];
      if (!all.length) return '';
      const owned = (S.curios && Array.isArray(S.curios.owned)) ? S.curios.owned : [];
      const pool = [];
      for (const c of all) if (c && c.id && owned.indexOf(c.id) < 0) pool.push(c);
      const pick = U.pick(pool.length ? pool : all);
      if (!pick) return '';
      Curios.own(pick.id);
      return (pick.emoji || '') + ' ' + (pick.name || pick.id);
    } catch (e) {
      console.warn('[Sect] curio grant failed', e);
      return '';
    }
  },

  _showClashReport(pairs, wins, win, r, chest) {
    let rows = '';
    for (const p of pairs) {
      rows += `<div class="row between" style="padding:7px 0;border-bottom:1px solid var(--line)">
        <div class="col" style="min-width:0">
          <div class="lbl">${this._esc(p.allyEmoji)} ${this._esc(p.you ? p.ally + ' (you)' : p.ally)}
            <span class="muted tiny">vs</span> ${this._esc(p.foeEmoji)} ${this._esc(p.foe)}</div>
          <div class="tiny muted">${p.rounds} rounds · ${p.hp}% left standing</div>
        </div><span class="chip ${p.win ? 'good' : 'bad'}">${p.win ? 'WON' : 'LOST'}</span></div>`;
    }

    let chestRows = '';
    for (const c of chest) {
      chestRows += `<div class="kv"><span class="k">${this._esc(c.k)}</span><span class="v good">${this._esc(c.v)}</span></div>`;
    }

    const rivalName = (r.rival && r.rival.name) || 'a rival sect';
    const mine = (r.sect && r.sect.name) || 'your sect';

    UI.modal({
      title: 'Sect Clash',
      wide: true,
      body: `<div class="row between"><span class="lbl">${this._esc(mine)}</span>
          <span class="val ${win ? 'good' : 'bad'}">${wins} – ${pairs.length - wins}</span>
          <span class="lbl">${this._esc(rivalName)}</span></div>
        <div class="sec">${rows}</div>
        <div class="h2 ${win ? 'gold' : 'bad'}" style="margin-top:6px">${win
          ? 'The field is yours.' : 'The field is theirs — this week.'}</div>
        <p class="muted tiny">${win
          ? 'Someone will write it up as a formation triumph. It was mostly footwork and luck.'
          : 'The elders take it well, which is somehow worse than shouting.'}</p>
        <div class="sec"><div class="sec-title">${win ? 'Victory Chest' : 'Consolation'}</div>${chestRows}</div>`,
      buttons: [{ label: 'Collect', cls: 'primary', act: (close) => close() }],
    });
  },

  /* ================================================================ LIBRARY */

  /* The library is a VIEW over DATA.shops.library: entries this sect sells
     (DATA.sects[].library ids) plus every shared entry no sect has claimed.
     Entry fields are read defensively — the shops content file owns the table
     and may name its price/grant fields a few different ways. */
  _libEntries() {
    const sc = this._ensure();
    if (!sc || !sc.id) return [];
    const raw = (DATA && DATA.shops && Array.isArray(DATA.shops.library)) ? DATA.shops.library : [];

    const claimedBy = Object.create(null);
    for (const s of ((DATA && DATA.sects) || [])) {
      if (!s || !Array.isArray(s.library)) continue;
      for (const id of s.library) claimedBy[id] = s.id;
    }

    const out = [];
    const have = Object.create(null);
    for (const e of raw) {
      if (!e || e.id === null || e.id === undefined) continue;
      const owner = e.sect || claimedBy[e.id] || null;
      if (owner && owner !== sc.id) continue;         // another sect's shelf
      have[e.id] = true;
      out.push(this._normEntry(e, owner));
    }

    /* Fallback shelf. Only fills ids this sect is DECLARED to sell that the
       content table has not defined, so real shop content is never undercut.
       The shared staples only appear when the shelf would otherwise be bare. */
    const sect = this._sect();
    const ids = (sect && Array.isArray(sect.library)) ? sect.library : [];
    const fb = this._fallbackShelf(sc.id);
    for (let i = 0; i < ids.length && fb.length; i++) {
      if (have[ids[i]]) continue;
      const def = fb[i % fb.length];
      if (!def) continue;
      out.push(this._normEntry({
        id: ids[i], name: def.name, emoji: def.emoji, desc: def.desc,
        citrine: def.price, stock: def.stock, kind: def.kind, ref: def.ref, grant: def.grant,
      }, sc.id));
    }
    if (!out.length) {
      for (const def of this._sharedShelf()) out.push(this._normEntry(def, null));
    }
    return out;
  },

  _normEntry(e, owner) {
    let price = NaN;
    if (Number.isFinite(Number(e.citrine))) price = Number(e.citrine);
    else if (Number.isFinite(Number(e.price))) price = Number(e.price);
    else if (typeof e.cost === 'number') price = Number(e.cost);
    else if (e.cost && typeof e.cost === 'object' && Number.isFinite(Number(e.cost.citrine))) price = Number(e.cost.citrine);
    if (!Number.isFinite(price) || price < 0) {
      const rank = Math.max(1, Math.floor(Number(e.rank) || 1));
      price = Math.round(60 * Math.pow(2.1, rank - 1));   // defensive default
    }

    let stock = Number(e.stock);
    if (!Number.isFinite(stock)) stock = Number(e.perDay);
    if (!Number.isFinite(stock)) stock = Number(e.limit);
    if (!Number.isFinite(stock) || stock < 0) stock = 0;   // 0 == unlimited

    let kind = e.kind || e.type || '';
    let ref = e.ref || e.item || e.itemId || e.blueprint || e.formula || e.curio || '';
    if (!kind) {
      if (e.blueprint) kind = 'blueprint';
      else if (e.formula) kind = 'formula';
      else if (e.curio) kind = 'curio';
      else kind = 'grant';
    }
    if (kind !== 'blueprint' && kind !== 'formula' && kind !== 'curio') kind = 'grant';

    const grant = (e.grant && typeof e.grant === 'object') ? e.grant
      : (e.give && typeof e.give === 'object') ? e.give
      : (e.rewards && typeof e.rewards === 'object') ? e.rewards : null;

    return {
      id: String(e.id),
      name: String(e.name || e.title || ref || e.id),
      emoji: String(e.emoji || (kind === 'formula' ? '⚗️' : kind === 'blueprint' ? '\u{1F4DC}' : '\u{1F4E6}')),
      desc: String(e.desc || e.blurb || ''),
      price: Math.max(0, Math.round(price)),
      stock: Math.max(0, Math.floor(stock)),
      kind: kind, ref: ref ? String(ref) : '',
      grant: grant,
      owner: owner || null,
    };
  },

  _fallbackShelf(sectId) {
    const t = this._matTier();
    if (sectId === 'verdant') {
      return [
        { name: 'Annotated Cinnabar Notes', emoji: '⚗️', desc: 'A formula copied out in a hand that clearly resented copying it.',
          price: 240, stock: 1, kind: 'formula', ref: 'r3_exp' },
        { name: 'Valley Ward Formula', emoji: '\u{1F6E1}️', desc: 'Defensive brewing, taught to anyone who asks twice.',
          price: 300, stock: 1, kind: 'formula', ref: 'r3_ward' },
        { name: 'Nursery Cuttings', emoji: '\u{1F331}', desc: 'Herbs the Valley considers surplus and everyone else considers rare.',
          price: 80, stock: 3, kind: 'grant', grant: { ['herb:' + t]: 8 } },
        { name: 'Simmering Room Key', emoji: '\u{1F5DD}️', desc: 'Access to a cauldron nobody is currently shouting about.',
          price: 160, stock: 2, kind: 'grant', grant: { ['core:' + t]: 5, stone: 3000 } },
      ];
    }
    if (sectId === 'umbral') {
      return [
        { name: 'Reliquary Tracing', emoji: '\u{1F4DC}', desc: 'A blueprint that arrives without a courier and without a price tag.',
          price: 320, stock: 1, kind: 'blueprint', ref: 'bp_r3_relic' },
        { name: 'Unlisted Map Corner', emoji: '\u{1F5FA}️', desc: 'Torn from a map that officially has no corners.',
          price: 150, stock: 2, kind: 'grant', grant: { insight: 2, stone: 4000 } },
        { name: 'Bait Formula, Unsigned', emoji: '\u{1F36F}', desc: 'The Veil does not sign things. It finds signatures gauche.',
          price: 220, stock: 1, kind: 'formula', ref: 'r3_bait' },
        { name: 'Quiet Ledger Extract', emoji: '\u{1F4D6}', desc: 'Two technique guides that were never formally issued.',
          price: 180, stock: 2, kind: 'grant', grant: { guide: 2, tech: 400 } },
      ];
    }
    /* azure + any unknown sect id */
    return [
      { name: 'Heron Blade Pattern', emoji: '\u{1F4DC}', desc: 'A weapon blueprint, stamped, sealed, and slightly bloodstained.',
        price: 300, stock: 1, kind: 'blueprint', ref: 'bp_r3_weapon' },
      { name: 'Whetstone Tithe', emoji: '\u{1FAA8}', desc: 'Forge stock the armoury will not miss for a week.',
        price: 110, stock: 3, kind: 'grant', grant: { ['forge:' + t]: 6, stones: 400 } },
      { name: 'Fury Draught Formula', emoji: '\u{1F525}', desc: 'Brewed by swordsmen, which explains the flavour.',
        price: 240, stock: 1, kind: 'formula', ref: 'r3_fury' },
      { name: 'Drill Yard Stipend', emoji: '\u{1FA99}', desc: 'Paid in stone, as all honest sect wages are.',
        price: 90, stock: 3, kind: 'grant', grant: { stone: 6000 } },
    ];
  },

  _sharedShelf() {
    const t = this._matTier();
    return [
      { id: 'lib_shared_guide', name: 'Annotated Technique Guide', emoji: '\u{1F4D6}',
        desc: 'Shared shelf. Marginalia by four generations of increasingly tired disciples.',
        citrine: 130, stock: 2, kind: 'grant', grant: { guide: 2 } },
      { id: 'lib_shared_seed', name: 'Sect Nursery Seedlings', emoji: '\u{1F33F}',
        desc: 'Shared shelf. Plant them today, forget them, harvest them anyway.',
        citrine: 70, stock: 3, kind: 'grant', grant: { ['seed:' + t]: 4 } },
      { id: 'lib_shared_ink', name: 'Insight Ink', emoji: '\u{1F56F}️',
        desc: 'Shared shelf. Grinds down into shards of something close to understanding.',
        citrine: 160, stock: 2, kind: 'grant', grant: { insight: 2 } },
    ];
  },

  _boughtToday(id) {
    const key = 'library:' + id;
    const rec = S.shops.bought[key];
    const today = U.todayStr();
    if (typeof rec === 'number') return 0;             // legacy lifetime counter
    if (rec && typeof rec === 'object' && rec.day === today) return Math.max(0, Math.floor(Number(rec.n) || 0));
    return 0;
  },

  _recordBuy(id) {
    const key = 'library:' + id;
    S.shops.bought[key] = { day: U.todayStr(), n: this._boughtToday(id) + 1 };
  },

  _entryOwned(e) {
    if (e.kind === 'blueprint' && e.ref) return S.inv.blueprints.indexOf(e.ref) >= 0;
    if (e.kind === 'formula' && e.ref) return S.inv.formulas.indexOf(e.ref) >= 0;
    if (e.kind === 'curio' && e.ref) {
      const owned = (S.curios && Array.isArray(S.curios.owned)) ? S.curios.owned : [];
      return owned.indexOf(e.ref) >= 0;
    }
    return false;
  },

  _buy(id) {
    const sc = this._ensure();
    if (!sc || !sc.id) return;
    const list = this._libEntries();
    let e = null;
    for (const x of list) if (x.id === id) e = x;
    if (!e) { UI.toast('That shelf is empty.', 'bad'); return; }

    if (this._entryOwned(e)) { UI.toast('You already know that one.', 'info'); return; }
    if (e.stock > 0 && this._boughtToday(e.id) >= e.stock) {
      UI.toast('Sold out until tomorrow.', 'bad'); return;
    }
    if (!Econ.can('citrine', e.price)) {
      UI.toast('Not enough Citrine.', 'bad'); return;
    }

    const go = () => {
      if (!Econ.spend('citrine', e.price)) { UI.toast('Not enough Citrine.', 'bad'); return; }
      const got = Sect._applyGrant(e);
      Sect._recordBuy(e.id);
      Bus.emit('shopBuy', { shop: 'library', id: e.id });
      UI.toast('Acquired: ' + (got || e.name), 'gold');
      Sect._libSig = '';
      UI.dirty('sect', 'shops', 'abode');
      try { Stats.recompute(); } catch (err) { /* ignore */ }
      Sect._syncBadge();
      Save.save();
    };

    if (S.settings && S.settings.confirmSpend) {
      UI.confirm('Spend ' + Fmt.n(e.price) + ' Citrine?', e.name + (e.desc ? ' — ' + e.desc : ''), go);
    } else {
      go();
    }
  },

  _applyGrant(e) {
    const parts = [];

    if (e.kind === 'blueprint' && e.ref) {
      let bp = null;
      for (const b of ((DATA && DATA.blueprints) || [])) if (b && b.id === e.ref) bp = b;
      if (bp || !(DATA && DATA.blueprints && DATA.blueprints.length)) {
        if (S.inv.blueprints.indexOf(e.ref) < 0) S.inv.blueprints.push(e.ref);
        parts.push((bp && bp.name) || e.name);
      } else {
        Econ.grant('guide', 2);                 // content id missing: pay it out honestly
        parts.push('2 Technique Guides');
      }
    } else if (e.kind === 'formula' && e.ref) {
      const valid = (typeof DATAX !== 'undefined' && DATAX.formulaById && DATAX.formulaById[e.ref]);
      if (valid) {
        if (S.inv.formulas.indexOf(e.ref) < 0) S.inv.formulas.push(e.ref);
        parts.push(valid.name || e.name);
      } else {
        Econ.grant('guide', 2);                 // content id missing: pay it out honestly
        parts.push('2 Technique Guides');
      }
    } else if (e.kind === 'curio' && e.ref) {
      try {
        if (typeof Curios !== 'undefined' && typeof Curios.own === 'function') Curios.own(e.ref);
        parts.push(e.name);
      } catch (err) { Econ.grant('citrine', Math.floor(e.price / 2)); parts.push('a refund'); }
    }

    if (e.grant) {
      const obj = {};
      for (const k in e.grant) {
        const n = Math.floor(Number(e.grant[k]) || 0);
        if (n <= 0) continue;
        obj[k] = n;
        let lbl = k;
        try { lbl = Econ.label(k) || k; } catch (err) { /* keep the key */ }
        parts.push(lbl + ' x' + Fmt.n(n));
      }
      try { Econ.grantAll(obj); } catch (err) { console.warn('[Sect] grant failed', err); }
    }

    if (!parts.length) parts.push(e.name);
    return parts.join(', ');
  },

  /* ================================================================= RENDER */

  render() {
    if (UI.lock('sect', CONFIG.unlocks.sect)) { this._built = false; this._n = null; return; }
    const sc = this._ensure();
    if (!sc) return;
    if (!this._built) this._build();
    if (!this._n) return;

    const n = this._n;
    const joined = !!sc.id;
    n.joinView.style.display = joined ? 'none' : '';
    n.mainView.style.display = joined ? '' : 'none';
    if (!joined) { this._renderJoin(); return; }

    const now = Date.now();
    const sect = this._sect();
    const ranks = CONFIG.sect.ranks || [];
    const ri = this._rankIndex();
    const rank = ranks[ri] || { name: 'Outer Disciple', req: 0 };
    const life = Number(S.lifetimeContribution) || 0;

    /* --- banner --- */
    n.emoji.textContent = (sect && sect.emoji) || '\u{1F3EF}';
    n.name.textContent = (sect && sect.name) || 'A sect that lost its sign';
    n.title.textContent = rank.name + ' · ' + this._rankTitle(ri);

    const next = ranks[ri + 1];
    if (next) {
      const lo = Number(rank.req) || 0;
      const hi = Number(next.req) || (lo + 1);
      const frac = U.clamp((life - lo) / Math.max(1, hi - lo), 0, 1);
      n.rankBar.style.width = (frac * 100).toFixed(1) + '%';
      n.rankProg.textContent = Fmt.n(life) + ' / ' + Fmt.n(hi);
      n.rankNext.textContent = 'Next: ' + next.name;
    } else {
      n.rankBar.style.width = '100%';
      n.rankProg.textContent = Fmt.n(life);
      n.rankNext.textContent = 'The ladder ends here.';
    }

    let chips = '';
    if (sect && sect.bonus) {
      chips += '<span class="chip jade">' + this._esc(this._bonusLabel(sect.bonus.key, sect.bonus.val)) + '</span>';
    }
    const best = this._rankPerks();
    for (const k in best) chips += '<span class="chip gold">' + this._esc(this._bonusLabel(k, best[k])) + '</span>';
    chips += '<span class="chip">' + this._esc(Econ.icon('contribution') || '\u{1F4DC}') + ' ' +
      Fmt.n((S.cur && S.cur.contribution) || 0) + '</span>';
    if (n.chips.innerHTML !== chips) n.chips.innerHTML = chips;

    /* --- meditation --- */
    const medLeft = Math.max(0, sc.medUntil - now);
    if (medLeft > 0) {
      n.medBtn.disabled = true;
      n.medBtn.textContent = Fmt.durShort(medLeft / 1000);
      n.medState.textContent = 'Aura x' + (Number(CONFIG.sect.meditationMult) || 1) + ' — sitting.';
      n.medState.className = 'tiny jade';
    } else if (S.daily.sectMedUsed) {
      n.medBtn.disabled = true;
      n.medBtn.textContent = 'Tomorrow';
      n.medState.textContent = 'Used today. Resets in ' + Fmt.dur((this._nextDailyMs() - now) / 1000) + '.';
      n.medState.className = 'tiny muted';
    } else {
      n.medBtn.disabled = false;
      n.medBtn.textContent = 'Meditate';
      n.medState.textContent = Fmt.dur(Number(CONFIG.sect.meditationSec) || 600) +
        ' at x' + (Number(CONFIG.sect.meditationMult) || 1) + ' aura. Once a day.';
      n.medState.className = 'tiny muted';
    }

    /* --- clash --- */
    if (S.weekly.clashDone) {
      n.clashBtn.disabled = true;
      n.clashBtn.textContent = 'Settled';
      n.clashState.textContent = 'Next clash in ' + Fmt.dur((this._nextWeeklyMs() - now) / 1000) + '.';
      n.clashState.className = 'tiny muted';
    } else {
      n.clashBtn.disabled = false;
      n.clashBtn.textContent = 'March';
      n.clashState.textContent = 'You and ' + (CONFIG.sect.clashElders | 0) +
        ' elders against a rival five. Take 3 pairings to win.';
      n.clashState.className = 'tiny gold';
    }

    /* --- tasks --- */
    this._renderTasks();

    /* --- library --- */
    n.citrine.textContent = Fmt.n((S.cur && S.cur.citrine) || 0);
    this._renderLib();

    n.taskReset.textContent = 'New duties in ' + Fmt.dur((this._nextDailyMs() - now) / 1000);
    let unclaimed = 0;
    for (const t of sc.tasks) if (t && t.done && !t.claimed) unclaimed++;
    n.claimAll.disabled = unclaimed === 0;
    n.claimAll.textContent = unclaimed ? ('Claim All (' + unclaimed + ')') : 'Claim All';

    const swLeft = this._switchCooldownLeftMs();
    n.switchBtn.textContent = swLeft > 0 ? Fmt.dur(swLeft / 1000) : 'Switch';
  },

  _build() {
    const root = UI.panel('sect');
    if (!root) return;
    root.innerHTML = '';

    const scroll = UI.el('div', 'scroll');
    scroll.innerHTML = `
      <div id="sctJoin">
        <div class="sec"><div class="h1 serif">Three Gates</div>
          <p class="muted tiny">Every cultivator of Foundation is expected to belong somewhere.
          The paperwork is worse than the fighting. Choose once — changing your mind later costs contribution.</p></div>
        <div class="col" id="sctJoinList"></div>
      </div>

      <div id="sctMain">
        <div class="card">
          <div class="row between">
            <div class="row" style="min-width:0">
              <span class="unit-emoji" id="sctEmoji">\u{1F3EF}</span>
              <div class="col" style="min-width:0">
                <div class="h2" id="sctName">—</div>
                <div class="tiny muted" id="sctTitle">—</div></div>
            </div>
            <button class="btn ghost sm" data-act="switch">Switch</button>
          </div>
          <div class="divider"></div>
          <div class="row between"><span class="lbl" id="sctRankNext">Next</span>
            <span class="val tiny mono" id="sctRankProg">0</span></div>
          <div class="meter"><i id="sctRankBar"></i></div>
          <div class="row wrap" id="sctChips" style="margin-top:8px"></div>
          <div class="row" style="margin-top:8px">
            <button class="btn ghost sm wide" data-act="ranks">Contribution Ladder</button></div>
        </div>

        <div class="card tight"><div class="row between">
          <div class="col" style="min-width:0">
            <div class="h3">\u{1F9D8} Silent Hall</div>
            <div class="tiny muted" id="sctMedState">—</div></div>
          <button class="btn primary" data-act="meditate" id="sctMedBtn">Meditate</button>
        </div></div>

        <div class="card tight"><div class="row between">
          <div class="col" style="min-width:0">
            <div class="h3">⚔️ Sect Clash</div>
            <div class="tiny muted" id="sctClashState">—</div></div>
          <button class="btn primary" data-act="clash" id="sctClashBtn">March</button>
        </div></div>

        <div class="sec">
          <div class="sec-title">Daily Duties</div>
          <div class="col" id="sctTasks"></div>
          <div class="row between" style="margin-top:8px">
            <span class="tiny muted" id="sctTaskReset">—</span>
            <button class="btn sm" data-act="claimAll" id="sctClaimAll">Claim All</button></div>
        </div>

        <div class="sec">
          <div class="sec-title">Sect Library</div>
          <div class="row between"><span class="lbl">Citrine</span>
            <span class="val gold mono" id="sctCitrine">0</span></div>
          <div class="col" id="sctLib" style="margin-top:8px"></div>
        </div>
      </div>
      <div class="safe-b"></div>`;

    root.appendChild(scroll);

    this._n = {
      root: root,
      joinView: scroll.querySelector('#sctJoin'),
      joinList: scroll.querySelector('#sctJoinList'),
      mainView: scroll.querySelector('#sctMain'),
      emoji: scroll.querySelector('#sctEmoji'),
      name: scroll.querySelector('#sctName'),
      title: scroll.querySelector('#sctTitle'),
      rankNext: scroll.querySelector('#sctRankNext'),
      rankProg: scroll.querySelector('#sctRankProg'),
      rankBar: scroll.querySelector('#sctRankBar'),
      chips: scroll.querySelector('#sctChips'),
      medState: scroll.querySelector('#sctMedState'),
      medBtn: scroll.querySelector('#sctMedBtn'),
      clashState: scroll.querySelector('#sctClashState'),
      clashBtn: scroll.querySelector('#sctClashBtn'),
      tasks: scroll.querySelector('#sctTasks'),
      taskReset: scroll.querySelector('#sctTaskReset'),
      claimAll: scroll.querySelector('#sctClaimAll'),
      citrine: scroll.querySelector('#sctCitrine'),
      lib: scroll.querySelector('#sctLib'),
      switchBtn: scroll.querySelector('[data-act="switch"]'),
      taskRows: [],
      libRows: {},
    };

    /* One delegated listener for the whole panel, attached to the stable panel
       root exactly once — _build() may run again if the panel was re-locked. */
    if (this._wired) { this._built = true; this._taskSig = ''; this._libSig = ''; return; }
    this._wired = true;
    root.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-act]');
      if (!b || b.disabled) return;
      const act = b.dataset.act;
      if (act === 'join') { Sect._join(b.dataset.id); return; }
      if (act === 'switch') { Sect._openSwitch(); return; }
      if (act === 'ranks') { Sect._showRankLadder(); return; }
      if (act === 'meditate') { Sect._meditate(); return; }
      if (act === 'clash') { Sect._runClash(); return; }
      if (act === 'claim') { Sect._claimTask(parseInt(b.dataset.idx, 10) || 0); return; }
      if (act === 'claimAll') { Sect._claimAll(); return; }
      if (act === 'buy') { Sect._buy(b.dataset.id); return; }
    });

    this._built = true;
    this._taskSig = '';
    this._libSig = '';
  },

  _renderJoin() {
    const n = this._n;
    const list = (DATA && Array.isArray(DATA.sects)) ? DATA.sects : [];
    const sig = 'join:' + list.length;
    if (n.joinSig === sig) return;
    n.joinSig = sig;

    if (!list.length) {
      n.joinList.innerHTML = '<div class="empty">No sect has opened its gate in this build of the world.</div>';
      return;
    }
    let html = '';
    for (const s of list) {
      if (!s || !s.id) continue;
      const libN = Array.isArray(s.library) ? s.library.length : 0;
      const boon = this._esc(this._bonusLabel(s.bonus && s.bonus.key, s.bonus && s.bonus.val));
      html += `<div class="card">
        <div class="row between">
          <div class="row" style="min-width:0">
            <span class="unit-emoji">${this._esc(s.emoji)}</span>
            <div class="col" style="min-width:0"><div class="h3">${this._esc(s.name)}</div>
              <div class="tiny jade">${boon}</div></div>
          </div>
          <button class="btn primary sm" data-act="join" data-id="${this._esc(s.id)}">Join</button>
        </div>
        <div class="tiny muted" style="margin-top:8px">${this._esc(s.blurb)}</div>
        <div class="tiny muted" style="margin-top:6px">Library: ${libN} exclusive listings.</div></div>`;
    }
    n.joinList.innerHTML = html;
  },

  _renderTasks() {
    const n = this._n;
    const sc = S.sect;
    const tasks = Array.isArray(sc.tasks) ? sc.tasks : [];

    let sig = sc.tasksDay + '|';
    for (const t of tasks) sig += t.id + ':' + t.need + ':' + (t.claimed ? 1 : 0) + ',';
    if (sig !== this._taskSig) {
      this._taskSig = sig;
      n.taskRows = [];
      n.tasks.innerHTML = '';
      if (!tasks.length) {
        n.tasks.innerHTML = '<div class="empty">The duty board is blank. Someone will scribble on it by morning.</div>';
      }
      for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i];
        const tpl = this._tpl(t.id) || { emoji: '\u{1F4CB}' };
        const card = UI.el('div', 'card tight');
        card.innerHTML = `<div class="row between">
            <div class="row" style="min-width:0">
              <span class="unit-emoji">${this._esc(tpl.emoji)}</span>
              <div class="col" style="min-width:0"><div class="lbl">${this._esc(this._taskText(t))}</div>
                <div class="tiny muted">+${Fmt.n(t.cont)} contribution · +${Fmt.n(t.cit)} citrine</div></div>
            </div>
            <button class="btn sm" data-act="claim" data-idx="${i}">Claim</button>
          </div>
          <div class="row between" style="margin-top:7px">
            <span class="bar" style="flex:1"><i></i></span>
            <span class="tiny mono muted" style="margin-left:8px">0/0</span></div>`;
        n.tasks.appendChild(card);
        n.taskRows.push({
          card: card,
          bar: card.querySelector('.bar > i'),
          txt: card.querySelector('.mono'),
          btn: card.querySelector('[data-act="claim"]'),
        });
      }
    }

    for (let i = 0; i < n.taskRows.length; i++) {
      const t = tasks[i];
      const row = n.taskRows[i];
      if (!t || !row) continue;
      const frac = U.clamp((Number(t.prog) || 0) / Math.max(1, t.need), 0, 1);
      row.bar.style.width = (frac * 100).toFixed(1) + '%';
      row.txt.textContent = Fmt.n(Math.min(t.prog, t.need)) + '/' + Fmt.n(t.need);
      if (t.claimed) {
        row.btn.disabled = true;
        row.btn.textContent = 'Done';
        row.btn.className = 'btn sm ghost';
      } else if (t.done) {
        row.btn.disabled = false;
        row.btn.textContent = 'Claim';
        row.btn.className = 'btn sm primary glow';
      } else {
        row.btn.disabled = true;
        row.btn.textContent = 'Claim';
        row.btn.className = 'btn sm';
      }
    }
  },

  _renderLib() {
    const n = this._n;
    const entries = this._libEntries();
    let sig = (S.sect.id || '') + '|' + U.todayStr() + '|';
    for (const e of entries) sig += e.id + ':' + e.price + ':' + (this._entryOwned(e) ? 1 : 0) + ':' + this._boughtToday(e.id) + ',';

    if (sig !== this._libSig) {
      this._libSig = sig;
      n.libRows = {};
      n.lib.innerHTML = '';
      if (!entries.length) {
        n.lib.innerHTML = '<div class="empty">The shelves are between deliveries.</div>';
      }
      let icon = '\u{1F4A0}';
      try { icon = Econ.icon('citrine') || icon; } catch (e) { /* keep default */ }
      for (const e of entries) {
        const owned = this._entryOwned(e);
        const left = e.stock > 0 ? Math.max(0, e.stock - this._boughtToday(e.id)) : -1;
        const card = UI.el('div', 'card tight');
        const shelf = (e.owner ? 'Sect shelf' : 'Shared shelf') +
          (left >= 0 ? ' · ' + left + ' left today' : ' · unlimited');
        card.innerHTML = `<div class="row between">
            <div class="row" style="min-width:0">
              <span class="unit-emoji">${this._esc(e.emoji)}</span>
              <div class="col" style="min-width:0"><div class="lbl">${this._esc(e.name)}</div>
                ${e.desc ? '<div class="tiny muted">' + this._esc(e.desc) + '</div>' : ''}
                <div class="tiny muted">${shelf}</div></div>
            </div>
            <button class="btn sm" data-act="buy" data-id="${this._esc(e.id)}">${owned ? 'Known' : icon + ' ' + Fmt.n(e.price)}</button>
          </div>`;
        n.lib.appendChild(card);
        n.libRows[e.id] = { card: card, btn: card.querySelector('[data-act="buy"]'), entry: e };
      }
    }

    const cit = (S.cur && Number(S.cur.citrine)) || 0;
    for (const id in n.libRows) {
      const row = n.libRows[id];
      const e = row.entry;
      const owned = this._entryOwned(e);
      const left = e.stock > 0 ? Math.max(0, e.stock - this._boughtToday(e.id)) : 1;
      const can = !owned && left > 0 && cit >= e.price;
      row.btn.disabled = !can;
      row.btn.className = 'btn sm' + (can ? ' primary' : '');
    }
  },
};

/* ---------------------------------------------------------------------------
 * Abode — the home base. Sub-tab HOST (Rooms | Alchemy | Forge | Garden | Farm)
 * and the owner of five rooms: Cultivation Room, Herb Garden, Spirit Farm,
 * Dew Extractor and Tea Room. The Alchemy Hall and the Forge are *rooms* here
 * (their level lives in S.abode.rooms and is upgraded on this screen) but their
 * screens belong to 55_alchemy.js / 56_forge.js, which render into a container
 * this module owns via Alchemy.renderInto(host) / Forge.renderInto(host).
 *
 * Owns panel 'abode'. Unlocks at realm CONFIG.unlocks.abode (== CONFIG.abode.unlockRealm, 2).
 *
 * FORMULAS
 *   upgradeCost(lvl)     = floor(abode.upgradeCostBase * abode.upgradeCostGrowth^lvl)
 *                        = floor(500 * 2^lvl)   Spiritstone, lvl = CURRENT level
 *   levelCap(realm)      = min(abode.maxLevel, 2 + realm*3)
 *                          (realm 2 -> 8, realm 3 -> 11, ... realm 10+ -> 30)
 *                          A room may never exceed levelCap; this is the realm gate.
 *
 *   CULTIVATION ROOM
 *   auraBonus            = abode.cultivationAuraPerLevel * lvl = 0.05 * lvl
 *                          contributed to Stats.bonus('aura').
 *
 *   ALCHEMY HALL / FORGE  (level owned here, effect published through Stats)
 *   alchemyQuality       = 0.01 * lvl   -> Stats.bonus('alchemyQuality')
 *   forgeQuality         = 0.01 * lvl   -> Stats.bonus('forgeQuality')
 *
 *   HERB GARDEN
 *   growSec(lvl)         = abode.gardenGrowSec / (1 + (lvl-1)*0.05)
 *                          (20 min at Lv1 -> 8m10s at Lv30)
 *   herbYield(lvl)       = rint(base, base+2), base = 2 + floor(lvl/3)
 *   fruitChance(lvl)     = min(0.60, 0.18 + 0.012*lvl)
 *   fruitYield(lvl)      = 1 + floor(lvl/12)
 *   plots                = min(abode.gardenPlotsMax,
 *                              abode.gardenPlotsBase + jade-shop qol:'gardenPlot' buys)
 *                          The saved array is authoritative and is only ever grown.
 *
 *   SPIRIT FARM  (single absolute accumulator -> offline and online cannot double-count)
 *   poolMs               = clamp(now - S.abode.farm.sinceMs, 0, abode.farmCapH*3600e3)
 *   stonePerHour(lvl)    = abode.farmStonePerHourBase * (1 + lvl*0.35)
 *   stonePool            = floor(stonePerHour(lvl) * poolMs/3600e3)
 *   expPerSec            = Cultivation.auraPerSec() * abode.farmExpFracOfAura
 *   expPool              = expPerSec * poolMs/1000
 *   claimable           <=> poolMs >= 60_000 && (stonePool > 0 || expPool > 0)
 *   Claim sets sinceMs = now. Nothing else ever writes sinceMs, so the offline
 *   provider REPORTS the pool and never grants it.
 *
 *   DEW EXTRACTOR  (once per day, S.daily.extractorUsed vs abode.extractorPerDay)
 *   tech                 = floor(fruit * abode.extractorTechPerFruit * (1 + (lvl-1)*0.08))
 *
 *   TEA ROOM
 *   fortuityMult(lvl)    = clamp(1 - abode.teaRoomFortuityBonus*lvl, 0.40, 1)
 *                          i.e. -6% fortuity wait per level, floored at -60%.
 *                          Read by Wilds through Abode.fortuityMult() / Abode.teaLevel().
 *
 * BUS  emits: 'abodeUpgrade' {room, level} · 'gardenHarvest' {n} · 'extractorUsed' {tech}
 *      listens: 'shopBuy' (garden plot purchases), 'breakthrough' (level cap moved)
 *
 * PUBLIC API (documented for other systems)
 *   Abode.roomLevel(key)   -> int level of 'cultivation'|'alchemy'|'forge'|'garden'
 *                             |'farm'|'extractor'|'tea' (1 when the save has a gap)
 *   Abode.teaLevel()       -> int, Tea Room level
 *   Abode.fortuityMult()   -> number in [0.40,1]; Wilds multiplies its fortuity
 *                             interval roll by this
 *   Abode.gardenPlots()    -> int, live plot count
 *   Abode.setSub(key)      -> switch the abode sub-tab ('rooms'|'alchemy'|'forge'
 *                             |'garden'|'farm')
 *
 * CHILD PANEL CONTRACT
 *   When the Alchemy / Forge sub-tab is active, Abode.render() calls
 *   <Sys>.renderInto(host) on EVERY render pass with the same host element.
 *   Those modules must build once into the host and patch afterwards.
 * ------------------------------------------------------------------------ */

const Abode = {

  /* ------------------------------------------------------------ static data */

  /* Every room on the grid. `sub` is the sub-tab a tile jumps to (null = the
     room has no screen of its own, so the tile opens a detail sheet). */
  ROOMS: [
    { key: 'cultivation', name: 'Cultivation Room', emoji: '\u{1F9D8}', sub: null,
      furn: '\u{1FAB7}\u{1F56F}\u{1F4FF}',
      flavor: 'A cushion, a censer, and the sound of your own breathing. Qi pools here the way rain pools in a stone bowl.' },
    { key: 'alchemy', name: 'Alchemy Hall', emoji: '⚗️', sub: 'alchemy',
      furn: '\u{1F9EB}\u{1F525}\u{1F9F4}',
      flavor: 'Racks of stoppered jars, a cauldron that has never quite cooled, and a scorch mark you no longer explain to guests.' },
    { key: 'forge', name: 'Forge', emoji: '\u{1F528}', sub: 'forge',
      furn: '\u{1FAA8}\u{1F525}\u{1F5DC}️',
      flavor: 'Coal, quench-barrel, anvil. The hammer knows the song better than you do.' },
    { key: 'garden', name: 'Herb Garden', emoji: '\u{1F33F}', sub: 'garden',
      furn: '\u{1F331}\u{1FAB4}\u{1F4A7}',
      flavor: 'Six raised beds under a paper awning. Herbs here grow toward the moon rather than the sun.' },
    { key: 'farm', name: 'Spirit Farm', emoji: '\u{1F33E}', sub: 'farm',
      furn: '\u{1F33E}\u{1F402}\u{1F9FA}',
      flavor: 'A terrace of spirit rice worked by a very patient ox. It pays in stone and in small, steady insight.' },
    { key: 'extractor', name: 'Dew Extractor', emoji: '\u{1F9EA}', sub: 'garden',
      furn: '\u{1F9EA}\u{1F4A7}⚙️',
      flavor: 'Copper coils that wring the dao out of fruit one drop at a time. It can only be run once a day before the coils sour.' },
    { key: 'tea', name: 'Tea Room', emoji: '\u{1F375}', sub: null,
      furn: '\u{1FAD6}\u{1F376}\u{1FA9F}',
      flavor: 'Low table, open shutter, one cup poured for whoever wanders past. Fortune finds people who sit still long enough.' },
  ],

  TABS: [
    { id: 'rooms',   label: '\u{1F3EF} Rooms' },
    { id: 'alchemy', label: '⚗️ Alchemy' },
    { id: 'forge',   label: '\u{1F528} Forge' },
    { id: 'garden',  label: '\u{1F33F} Garden' },
    { id: 'farm',    label: '\u{1F33E} Farm' },
  ],

  TIER_NAME: ['Common', 'Verdant', 'Azure', 'Violet', 'Golden', 'Numinous'],
  TIER_EMOJI: ['\u{1F33F}', '\u{1F340}', '\u{1F33A}', '\u{1FAB7}', '\u{1F31F}', '\u{1F48E}'],

  ABODE_NAMES: [
    'Cloudroot Abode', 'Stillwater Hermitage', 'Nine-Lantern Court',
    'Pinefall Retreat', 'Quiet Kiln Cottage', 'Mistgate Homestead',
    'Late Frost Cabin', 'Half-Moon Courtyard',
  ],

  /* ------------------------------------------------------------ module state */

  sub: 'rooms',
  _el: null,           // built DOM refs (header, tabs, sub-tab bodies)
  _roomEls: null,      // { [roomKey]: {tile, lvl, eff, bar, btn, btnTxt} }
  _roomCapEl: null,    // "room cap at your realm" value node
  _gardenEls: null,    // garden + extractor refs
  _farmEls: null,      // spirit farm refs
  _childEls: null,     // { alchemy:{slot,mounted,locked}, forge:{...} }
  _plotEls: null,      // [{tile, emoji, name, time, bar, btn, btnTxt}]
  _plotN: -1,
  _wasLocked: false,
  _dirtyAcc: 0,
  _ensureAcc: 0,
  _badgeAcc: 0,
  _badgeTotal: 0,
  _offlineStamp: 0,

  /* ==================================================================== INIT */

  init() {
    this._el = null;
    this._roomEls = null;
    this._roomCapEl = null;
    this._gardenEls = null;
    this._farmEls = null;
    this._childEls = null;
    this._plotEls = null;
    this._plotN = -1;
    this._wasLocked = false;
    this._ensure();

    try {
      if (typeof Stats !== 'undefined' && Stats && typeof Stats.provider === 'function') {
        Stats.provider((acc) => Abode.statBonus(acc));
      }
    } catch (e) { console.warn('[Abode] Stats.provider unavailable', e); }

    try {
      if (typeof Offline !== 'undefined' && Offline && typeof Offline.provider === 'function') {
        Offline.provider((sec, now) => Abode.offline(sec, now));
      }
    } catch (e) { console.warn('[Abode] Offline.provider unavailable', e); }

    try {
      if (typeof UI !== 'undefined' && UI && typeof UI.register === 'function') {
        UI.register('abode', () => Abode.render());
      }
    } catch (e) { console.warn('[Abode] UI.register unavailable', e); }

    Bus.on('shopBuy', (d) => {
      const id = String((d && d.id) || '').toLowerCase();
      if (id.indexOf('gardenplot') < 0 && id.indexOf('plot') < 0) return;
      Abode._ensure();
      try { UI.dirty('abode'); } catch (e) { /* ignore */ }
    });

    Bus.on('breakthrough', () => {
      try { UI.dirty('abode'); } catch (e) { /* ignore */ }
    });

    this._refreshBadges();
  },

  /* ==================================================================== TICK */
  /* Everything here is closed-form off absolute epochs, so a dtSec of 3600
     (dev time-warp) costs exactly as much as a dtSec of 0.25. */
  tick(dtSec, nowMs) {
    if (!S || !S.created) return;
    const dt = (Number(dtSec) > 0) ? Number(dtSec) : 0;

    this._ensureAcc += dt;
    if (this._ensureAcc >= 5) { this._ensureAcc = 0; this._ensure(); }

    this._badgeAcc += dt;
    if (this._badgeAcc >= 2) { this._badgeAcc = 0; this._refreshBadges(); }

    // Keep countdowns ticking on screen; render() only patches text so this is cheap.
    this._dirtyAcc += dt;
    if (this._dirtyAcc >= 1) {
      this._dirtyAcc = 0;
      try { UI.dirty('abode'); } catch (e) { /* ignore */ }
    }
  },

  /* ================================================================= OFFLINE */
  /* Report-only. Garden plots ripen on their own (absolute endAt) and the farm
     pool is derived from S.abode.farm.sinceMs, so granting here would double-pay.
     Deduped by timestamp because Boot may reach this both through
     Offline.provider() and through the module's own offline() hook. */
  offline(elapsedSec, nowMs) {
    const now = Number(nowMs) > 0 ? Number(nowMs) : Date.now();
    if (this._offlineStamp && Math.abs(now - this._offlineStamp) < 400) return [];
    this._offlineStamp = now;
    if (!S || !S.created) return [];
    if (this._realm() < CONFIG.abode.unlockRealm) return [];

    this._ensure();
    const out = [];

    const ready = this._readyPlots(now);
    if (ready > 0) {
      out.push({
        icon: '\u{1F33F}', label: 'Garden plots ripened',
        amount: ready + (ready === 1 ? ' plot' : ' plots'),
      });
    }

    const pool = this._farmPool(now);
    if (this._farmReady(pool)) {
      let amt = Fmt.n(pool.stone) + ' stone';
      if (pool.exp > 0) amt += ' · ' + Fmt.n(pool.exp) + ' EXP';
      out.push({ icon: '\u{1F33E}', label: 'Spirit Farm (waiting to be claimed)', amount: amt });
    }

    return out;
  },

  /* ================================================================== BADGES */

  badges() { return this._badgeTotal || 0; },

  _refreshBadges() {
    if (!S || !S.created) return;
    let garden = 0, farm = 0;
    if (this._realm() >= CONFIG.abode.unlockRealm) {
      const now = Date.now();
      garden = this._readyPlots(now);
      if (this._extractorReady()) garden += 1;
      if (this._farmPct(now) >= 0.25) farm = 1;
    }
    this._badgeTotal = garden + farm;
    try {
      UI.badge('abode.garden', garden);
      UI.badge('abode.farm', farm);
    } catch (e) { /* UI may not be ready during very early boot */ }
  },

  /* ============================================================ PUBLIC API */

  /* Level of any room, 1..CONFIG.abode.maxLevel. Safe on gap-y old saves. */
  roomLevel(key) { return this._lvl(key); },

  /* Tea Room level — Wilds reads this (or fortuityMult) to shorten its timer. */
  teaLevel() { return this._lvl('tea'); },

  /* Multiplier Wilds applies to its fortuity interval roll: 1 - 6%/level,
     floored at 0.40 so the Tea Room can never trivialise the event clock. */
  fortuityMult() {
    const lvl = this._lvl('tea');
    return U.clamp(1 - CONFIG.abode.teaRoomFortuityBonus * lvl, 0.40, 1);
  },

  /* Live plot count (the saved array is authoritative). */
  gardenPlots() {
    this._ensure();
    return (S && S.abode && Array.isArray(S.abode.garden)) ? S.abode.garden.length : 0;
  },

  /* Switch sub-tab from outside (More menu, quests, Alchemy toasts...). */
  setSub(key) {
    for (let i = 0; i < this.TABS.length; i++) {
      if (this.TABS[i].id === key) { this.sub = key; break; }
    }
    try { UI.dirty('abode'); } catch (e) { /* ignore */ }
  },

  /* Stats provider — see FORMULAS header. */
  statBonus(acc) {
    if (!acc || !S || !S.player) return;
    if (this._realm() < CONFIG.abode.unlockRealm) return;
    acc.aura = (acc.aura || 0) + CONFIG.abode.cultivationAuraPerLevel * this._lvl('cultivation');
    acc.alchemyQuality = (acc.alchemyQuality || 0) + 0.01 * this._lvl('alchemy');
    acc.forgeQuality = (acc.forgeQuality || 0) + 0.01 * this._lvl('forge');
  },

  /* ============================================================ STATE GUARDS */

  /* Current major realm as an integer, 0 when the save has a gap. */
  _realm() {
    const r = (S && S.player) ? Math.floor(Number(S.player.realm)) : 0;
    return (Number.isFinite(r) && r > 0) ? r : 0;
  },

  /* Pure read — never mutates, safe to call from Stats.recompute(). */
  _lvl(key) {
    const rooms = (S && S.abode && S.abode.rooms) || null;
    if (!rooms) return 1;
    let v = Math.floor(Number(rooms[key]));
    if (!Number.isFinite(v) || v < 1) v = 1;
    if (v > CONFIG.abode.maxLevel) v = CONFIG.abode.maxLevel;
    return v;
  },

  /* Normalise S.abode. Called from init, tick (every 5s), render and every action. */
  _ensure() {
    if (!S) return;
    if (!S.abode || typeof S.abode !== 'object') S.abode = {};
    const A = S.abode;

    if (!A.rooms || typeof A.rooms !== 'object') A.rooms = {};
    for (let i = 0; i < this.ROOMS.length; i++) {
      const k = this.ROOMS[i].key;
      let v = Math.floor(Number(A.rooms[k]));
      if (!Number.isFinite(v) || v < 1) v = 1;
      if (v > CONFIG.abode.maxLevel) v = CONFIG.abode.maxLevel;
      A.rooms[k] = v;
    }

    if (!Array.isArray(A.garden)) A.garden = [];
    const want = this._wantPlots();
    while (A.garden.length < want) A.garden.push({ seed: null, endAt: 0 });
    if (A.garden.length > CONFIG.abode.gardenPlotsMax) A.garden.length = CONFIG.abode.gardenPlotsMax;
    for (let i = 0; i < A.garden.length; i++) {
      const p = A.garden[i];
      if (!p || typeof p !== 'object') { A.garden[i] = { seed: null, endAt: 0 }; continue; }
      const t = Math.floor(Number(p.seed));
      p.seed = (Number.isFinite(t) && t >= 1 && t <= 6) ? t : null;
      const e = Math.floor(Number(p.endAt));
      p.endAt = (Number.isFinite(e) && e > 0) ? e : 0;
      if (p.seed === null) p.endAt = 0;
    }

    if (!A.farm || typeof A.farm !== 'object') A.farm = { sinceMs: 0 };
    const now = Date.now();
    let sm = Math.floor(Number(A.farm.sinceMs));
    if (!Number.isFinite(sm) || sm <= 0 || sm > now) sm = now;
    A.farm.sinceMs = sm;

    if (!S.daily || typeof S.daily !== 'object') S.daily = {};
    const eu = Math.floor(Number(S.daily.extractorUsed));
    if (!Number.isFinite(eu) || eu < 0) S.daily.extractorUsed = 0;
  },

  /* Plot count the player has EARNED. The save array is only ever grown to this;
     it is never shrunk, so a shop-table change can't eat a growing crop. */
  _wantPlots() {
    let bought = 0;
    const b = (S && S.shops && S.shops.bought) || null;
    if (b) {
      const jade = (typeof DATA !== 'undefined' && DATA.shops && Array.isArray(DATA.shops.jade))
        ? DATA.shops.jade : [];
      for (let i = 0; i < jade.length; i++) {
        const it = jade[i];
        if (!it || it.qol !== 'gardenPlot') continue;
        const c = Number(b[it.id]);
        if (Number.isFinite(c) && c > 0) bought += Math.floor(c);
      }
      if (bought === 0) {
        // Fallback for saves written before the jade table shipped.
        for (const k in b) {
          if (!Object.prototype.hasOwnProperty.call(b, k)) continue;
          if (String(k).toLowerCase().indexOf('gardenplot') < 0) continue;
          const c = Number(b[k]);
          bought += (Number.isFinite(c) && c > 0) ? Math.floor(c) : 1;
        }
      }
    }
    return U.clamp(CONFIG.abode.gardenPlotsBase + bought, 1, CONFIG.abode.gardenPlotsMax);
  },

  /* ============================================================== ROOM MATHS */

  _upgradeCost(lvl) {
    return Math.floor(CONFIG.abode.upgradeCostBase * Math.pow(CONFIG.abode.upgradeCostGrowth, lvl));
  },

  _levelCap() {
    return U.clamp(2 + this._realm() * 3, 1, CONFIG.abode.maxLevel);
  },

  /* Realm needed to push a room to `lvl`: solve lvl <= 2 + realm*3. */
  _realmForLevel(lvl) {
    return Math.max(0, Math.ceil((lvl - 2) / 3));
  },

  _realmName(r) {
    const list = (typeof DATA !== 'undefined' && Array.isArray(DATA.realms)) ? DATA.realms : [];
    const e = list[r];
    return (e && e.name) ? e.name : ('Realm ' + r);
  },

  _growSec() {
    const lvl = this._lvl('garden');
    return CONFIG.abode.gardenGrowSec / (1 + (lvl - 1) * 0.05);
  },

  _farmStonePerHour() {
    return CONFIG.abode.farmStonePerHourBase * (1 + this._lvl('farm') * 0.35);
  },

  _auraPerSec() {
    try {
      if (typeof Cultivation !== 'undefined' && Cultivation &&
          typeof Cultivation.auraPerSec === 'function') {
        const v = Number(Cultivation.auraPerSec());
        return Number.isFinite(v) && v > 0 ? v : 0;
      }
    } catch (e) { /* ignore */ }
    return 0;
  },

  _addExp(n, src) {
    if (!(n > 0)) return;
    try {
      if (typeof Cultivation !== 'undefined' && Cultivation &&
          typeof Cultivation.addExp === 'function') {
        Cultivation.addExp(n, src);
      }
    } catch (e) { console.warn('[Abode] addExp failed', e); }
  },

  /* The short effect line printed on every room tile. */
  _effectText(key) {
    const lvl = this._lvl(key);
    if (key === 'cultivation') {
      return '+' + Fmt.pct(CONFIG.abode.cultivationAuraPerLevel * lvl, 0) + ' aura';
    }
    if (key === 'alchemy') {
      return '+' + Fmt.pct(0.01 * lvl, 0) + ' pill quality odds';
    }
    if (key === 'forge') {
      return '+' + Fmt.pct(0.01 * lvl, 0) + ' forge quality odds';
    }
    if (key === 'garden') {
      const base = 2 + Math.floor(lvl / 3);
      return Fmt.dur(Math.round(this._growSec())) + ' / crop · ' + base + '-' + (base + 2) + ' herbs';
    }
    if (key === 'farm') {
      return Fmt.n(Math.floor(this._farmStonePerHour())) + ' stone/h · ' +
             Fmt.pct(CONFIG.abode.farmExpFracOfAura, 0) + ' aura EXP';
    }
    if (key === 'extractor') {
      const per = CONFIG.abode.extractorTechPerFruit * (1 + (lvl - 1) * 0.08);
      return Fmt.n1(per) + ' tech / fruit · once a day';
    }
    if (key === 'tea') {
      return '-' + Fmt.pct(1 - this.fortuityMult(), 0) + ' fortuity wait';
    }
    return '';
  },

  /* =============================================================== UPGRADING */

  _tryUpgrade(key) {
    this._ensure();
    let known = false;
    for (let i = 0; i < this.ROOMS.length; i++) if (this.ROOMS[i].key === key) known = true;
    if (!known) return;

    const lvl = this._lvl(key);
    if (lvl >= CONFIG.abode.maxLevel) { UI.toast('That room is already at its final form.', 'info'); return; }

    const cap = this._levelCap();
    if (lvl >= cap) {
      const need = this._realmForLevel(lvl + 1);
      UI.toast('Your dao is too shallow to hold a finer room — reach ' + this._realmName(need) + '.', 'bad');
      return;
    }

    const cost = this._upgradeCost(lvl);
    if (!Econ.can('stone', cost)) {
      UI.toast('Need ' + Fmt.n(cost) + ' Spiritstone.', 'bad');
      return;
    }

    const doIt = () => {
      if (!Econ.spend('stone', cost)) { UI.toast('Not enough Spiritstone.', 'bad'); return; }
      S.abode.rooms[key] = lvl + 1;
      Bus.emit('abodeUpgrade', { room: key, level: lvl + 1 });
      try { Stats.invalidate && Stats.invalidate(); } catch (e) { /* optional */ }
      try { Stats.recompute(); } catch (e) { /* ignore */ }
      const room = this._room(key);
      UI.toast((room ? room.name : 'Room') + ' → Lv ' + (lvl + 1), 'good');
      try { UI.flash('jade'); } catch (e) { /* ignore */ }
      this._refreshBadges();
      try { UI.dirty('abode', 'cultivate'); } catch (e) { /* ignore */ }
      try { Save.save(); } catch (e) { /* ignore */ }
    };

    const confirmOn = !(S.settings && S.settings.confirmSpend === false);
    if (confirmOn && cost > 10000) {
      const room = this._room(key);
      UI.confirm('Upgrade ' + (room ? room.name : 'room'),
        'Spend ' + Fmt.n(cost) + ' Spiritstone to reach Lv ' + (lvl + 1) + '?', doIt);
    } else {
      doIt();
    }
  },

  _room(key) {
    for (let i = 0; i < this.ROOMS.length; i++) if (this.ROOMS[i].key === key) return this.ROOMS[i];
    return null;
  },

  /* ================================================================== GARDEN */

  _plots() {
    return (S && S.abode && Array.isArray(S.abode.garden)) ? S.abode.garden : [];
  },

  _readyPlots(now) {
    const t = Number(now) > 0 ? Number(now) : Date.now();
    const g = this._plots();
    let n = 0;
    for (let i = 0; i < g.length; i++) {
      const p = g[i];
      if (p && p.seed && p.endAt > 0 && t >= p.endAt) n++;
    }
    return n;
  },

  _seedCount(tier) {
    const arr = (S && S.mats && Array.isArray(S.mats.seed)) ? S.mats.seed : null;
    if (!arr) return 0;
    const v = Math.floor(Number(arr[tier - 1]));
    return (Number.isFinite(v) && v > 0) ? v : 0;
  },

  _bestSeed() {
    for (let t = 6; t >= 1; t--) if (this._seedCount(t) > 0) return t;
    return 0;
  },

  _plant(idx, tier) {
    this._ensure();
    const g = this._plots();
    const p = g[idx];
    if (!p) return false;
    if (p.seed) { UI.toast('That bed is already sown.', 'bad'); return false; }
    if (tier < 1 || tier > 6) return false;
    if (!Econ.spend('seed:' + tier, 1)) {
      UI.toast('No ' + this.TIER_NAME[tier - 1] + ' seeds left.', 'bad');
      return false;
    }
    p.seed = tier;
    p.endAt = Date.now() + Math.round(this._growSec() * 1000);
    return true;
  },

  _plantAll() {
    this._ensure();
    const g = this._plots();
    let n = 0;
    for (let i = 0; i < g.length; i++) {
      if (g[i] && g[i].seed) continue;
      const t = this._bestSeed();
      if (!t) break;
      if (this._plant(i, t)) n++;
    }
    if (n > 0) {
      UI.toast('Sowed ' + n + (n === 1 ? ' bed.' : ' beds.'), 'good');
      this._refreshBadges();
      try { UI.dirty('abode'); } catch (e) { /* ignore */ }
      try { Save.save(); } catch (e) { /* ignore */ }
    } else {
      UI.toast('No free beds, or no seeds to sow.', 'bad');
    }
  },

  /* Harvest one ripe plot. Returns {tier, herbs, fruit} or null. */
  _harvestOne(idx, now) {
    const g = this._plots();
    const p = g[idx];
    if (!p || !p.seed || !(p.endAt > 0) || now < p.endAt) return null;

    const tier = p.seed;
    const lvl = this._lvl('garden');
    const base = 2 + Math.floor(lvl / 3);
    const herbs = U.rint(base, base + 2);
    let fruit = 0;
    const chance = Math.min(0.60, 0.18 + 0.012 * lvl);
    if (U.chance(chance)) fruit = 1 + Math.floor(lvl / 12);

    Econ.grant('herb:' + tier, herbs);
    if (fruit > 0) Econ.grant('fruit', fruit);

    p.seed = null;
    p.endAt = 0;
    return { tier: tier, herbs: herbs, fruit: fruit };
  },

  _harvestAll() {
    this._ensure();
    const now = Date.now();
    const g = this._plots();
    const byTier = [0, 0, 0, 0, 0, 0];
    let n = 0, fruit = 0;
    for (let i = 0; i < g.length; i++) {
      const r = this._harvestOne(i, now);
      if (!r) continue;
      n++;
      byTier[r.tier - 1] += r.herbs;
      fruit += r.fruit;
    }
    if (n === 0) { UI.toast('Nothing is ripe yet.', 'bad'); return; }

    Bus.emit('gardenHarvest', { n: n });

    const bits = [];
    for (let t = 1; t <= 6; t++) {
      if (byTier[t - 1] > 0) bits.push(this.TIER_EMOJI[t - 1] + ' ' + byTier[t - 1]);
    }
    if (fruit > 0) bits.push('\u{1F351} ' + fruit);
    UI.toast('Harvested ' + n + (n === 1 ? ' bed — ' : ' beds — ') + bits.join('  '), 'good');
    if (fruit > 0) { try { UI.flash('jade'); } catch (e) { /* ignore */ } }

    this._refreshBadges();
    try { UI.dirty('abode'); } catch (e) { /* ignore */ }
    try { Save.save(); } catch (e) { /* ignore */ }
  },

  /* Bottom sheet: pick which seed goes into one bed. */
  _openPlantSheet(idx) {
    this._ensure();
    const g = this._plots();
    if (!g[idx] || g[idx].seed) return;

    const body = document.createElement('div');
    let html = '<p class="tiny muted">Grow time ' + Fmt.dur(Math.round(this._growSec())) +
               ' at Herb Garden Lv ' + this._lvl('garden') + '.</p><div class="col">';
    let any = false;
    for (let t = 1; t <= 6; t++) {
      const have = this._seedCount(t);
      if (have > 0) any = true;
      html += '<button class="btn wide" data-tier="' + t + '"' + (have > 0 ? '' : ' disabled') + '>' +
              '<span>' + this.TIER_EMOJI[t - 1] + ' ' + this.TIER_NAME[t - 1] + ' Seed (T' + t + ')</span>' +
              '<span class="mono tiny muted">x' + Fmt.n(have) + '</span></button>';
    }
    html += '</div>';
    if (!any) html += '<div class="empty">No seeds in the satchel. Seeds drop from hunts and expeditions, and the market sells them.</div>';
    body.innerHTML = html;

    const sheet = UI.sheet({
      title: 'Sow a bed',
      body: body,
      buttons: [{ label: 'Close', cls: 'ghost', act: (close) => close() }],
    });

    body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tier]');
      if (!b || b.disabled) return;
      const t = parseInt(b.dataset.tier, 10);
      if (this._plant(idx, t)) {
        UI.toast(this.TIER_NAME[t - 1] + ' seed sown.', 'good');
        this._refreshBadges();
        try { UI.dirty('abode'); } catch (err) { /* ignore */ }
        try { Save.save(); } catch (err) { /* ignore */ }
      }
      this._dismiss(sheet);
    });
  },

  /* Close an overlay whatever handle shape UI.sheet chose to return. */
  _dismiss(handle) {
    try { if (handle && typeof handle.close === 'function') { handle.close(); return; } } catch (e) { /* ignore */ }
    try { if (typeof UI.closeSheet === 'function') { UI.closeSheet(); return; } } catch (e) { /* ignore */ }
    try { if (typeof UI.closeModal === 'function') UI.closeModal(); } catch (e) { /* ignore */ }
  },

  /* ==================================================================== FARM */

  _farmPool(now) {
    const t = Number(now) > 0 ? Number(now) : Date.now();
    const since = (S && S.abode && S.abode.farm && Number(S.abode.farm.sinceMs)) || t;
    const capMs = CONFIG.abode.farmCapH * 3600000;
    let ms = t - since;
    if (!Number.isFinite(ms) || ms < 0) ms = 0;
    if (ms > capMs) ms = capMs;
    const hours = ms / 3600000;
    const stone = Math.floor(this._farmStonePerHour() * hours);
    const exp = this._auraPerSec() * CONFIG.abode.farmExpFracOfAura * (ms / 1000);
    return { ms: ms, capMs: capMs, stone: stone, exp: exp, pct: capMs > 0 ? ms / capMs : 0 };
  },

  _farmPct(now) { return this._farmPool(now).pct; },

  /* A claim needs at least a minute of accumulation. Without this floor the
     EXP trickle (a fraction of a point per millisecond) would keep the Claim
     button live forever and let the player spam it for rounding dust. */
  _farmReady(pool) {
    return pool.ms >= 60000 && (pool.stone > 0 || pool.exp > 0);
  },

  _claimFarm(anchor) {
    this._ensure();
    const now = Date.now();
    const pool = this._farmPool(now);
    if (!this._farmReady(pool)) {
      UI.toast('The terrace has produced nothing worth carrying yet.', 'bad');
      return;
    }
    S.abode.farm.sinceMs = now;

    if (pool.stone > 0) Econ.grant('stone', pool.stone);
    if (pool.exp > 0) this._addExp(pool.exp, 'farm');

    let msg = '+' + Fmt.n(pool.stone) + ' Spiritstone';
    if (pool.exp > 0) msg += '  ·  +' + Fmt.n(pool.exp) + ' EXP';
    UI.toast(msg, 'gold');
    try { if (anchor) UI.float(anchor, '+' + Fmt.n(pool.stone), 'gold'); } catch (e) { /* ignore */ }
    if (pool.pct >= 0.999) { try { UI.flash('gold'); } catch (e) { /* ignore */ } }

    this._refreshBadges();
    try { UI.dirty('abode', 'cultivate'); } catch (e) { /* ignore */ }
    try { Save.save(); } catch (e) { /* ignore */ }
  },

  /* =============================================================== EXTRACTOR */

  _fruit() {
    const v = Math.floor(Number(S && S.mats ? S.mats.fruit : 0));
    return (Number.isFinite(v) && v > 0) ? v : 0;
  },

  _extractorUsed() {
    const v = Math.floor(Number(S && S.daily ? S.daily.extractorUsed : 0));
    return (Number.isFinite(v) && v > 0) ? v : 0;
  },

  _extractorReady() {
    return this._fruit() > 0 && this._extractorUsed() < CONFIG.abode.extractorPerDay;
  },

  _extractorYield(fruit) {
    const lvl = this._lvl('extractor');
    return Math.floor(fruit * CONFIG.abode.extractorTechPerFruit * (1 + (lvl - 1) * 0.08));
  },

  _runExtractor(anchor) {
    this._ensure();
    if (this._extractorUsed() >= CONFIG.abode.extractorPerDay) {
      UI.toast('The coils are spent for today.', 'bad');
      return;
    }
    const fruit = this._fruit();
    if (fruit <= 0) {
      UI.toast('No garden fruit to press. Harvest more beds.', 'bad');
      return;
    }
    const tech = this._extractorYield(fruit);
    if (!Econ.spend('fruit', fruit)) { UI.toast('The fruit basket slipped away.', 'bad'); return; }

    S.daily.extractorUsed = this._extractorUsed() + 1;
    if (tech > 0) Econ.grant('tech', tech);
    Bus.emit('extractorUsed', { tech: tech });

    UI.toast('Pressed ' + fruit + (fruit === 1 ? ' fruit' : ' fruits') + ' → +' + Fmt.n(tech) + ' Tech Points', 'gold');
    try { if (anchor) UI.float(anchor, '+' + Fmt.n(tech), 'gold'); } catch (e) { /* ignore */ }
    try { UI.flash('gold'); } catch (e) { /* ignore */ }

    this._refreshBadges();
    try { UI.dirty('abode', 'more'); } catch (e) { /* ignore */ }
    try { Save.save(); } catch (e) { /* ignore */ }
  },

  /* ================================================================== RENDER */

  render() {
    if (UI.lock('abode', CONFIG.unlocks.abode)) {
      this._wasLocked = true;          // UI.lock owns the panel body while sealed
      this._el = null;
      this._roomEls = null;
      this._plotEls = null;
      this._plotN = -1;
      return;
    }
    this._ensure();
    this._syncSub();
    this._buildDom();
    if (!this._el) return;
    this._paintHeader();
    this._paintTabs();
    if (this.sub === 'rooms') this._paintRooms();
    else if (this.sub === 'garden') this._paintGarden();
    else if (this.sub === 'farm') this._paintFarm();
    else if (this.sub === 'alchemy') this._paintChild('alchemy');
    else if (this.sub === 'forge') this._paintChild('forge');
  },

  /* Honour UI.show('abode', sub) however the router chose to expose it. */
  _syncSub() {
    let want = null;
    try {
      if (typeof UI === 'undefined' || !UI) want = null;
      else if (typeof UI.sub === 'string') want = UI.sub;
      else if (UI.sub && typeof UI.sub === 'object') want = UI.sub.abode;
      else if (typeof UI.subOf === 'function') want = UI.subOf('abode');
    } catch (e) { want = null; }
    if (!want) return;
    for (let i = 0; i < this.TABS.length; i++) {
      if (this.TABS[i].id === want) { this.sub = want; return; }
    }
  },

  /* ------------------------------------------------------------- DOM (once) */

  _buildDom() {
    let panel = null;
    try { panel = UI.panel('abode'); } catch (e) { panel = null; }
    if (!panel) { this._el = null; return; }

    if (this._el && this._el.root && panel.contains(this._el.root)) return;

    // Coming back from the sealed placeholder: that markup is not ours, drop it.
    if (this._wasLocked) { panel.innerHTML = ''; this._wasLocked = false; }

    // Reuse the shell's scroller when it provides one.
    let scroll = panel.querySelector(':scope > .scroll');
    if (!scroll) {
      scroll = UI.el('div', 'scroll');
      panel.appendChild(scroll);
    }

    const root = UI.el('div', 'col');
    root.style.gap = '0';

    /* --- header ------------------------------------------------------- */
    const head = UI.el('div', 'card');
    head.innerHTML =
      '<div class="row between">' +
        '<div class="row" style="gap:9px;min-width:0">' +
          '<span class="unit-emoji" style="font-size:28px;line-height:1">\u{1F3EF}</span>' +
          '<div class="col" style="gap:1px;min-width:0">' +
            '<div class="h2 serif" data-f="name">Abode</div>' +
            '<div class="tiny muted" data-f="mood">&nbsp;</div>' +
          '</div>' +
        '</div>' +
        '<div class="col" style="gap:1px;align-items:flex-end;flex:0 0 auto">' +
          '<div class="tiny muted">Rooms</div>' +
          '<div class="val mono" data-f="total">0</div>' +
        '</div>' +
      '</div>';
    root.appendChild(head);

    /* --- tabs --------------------------------------------------------- */
    const tabs = UI.el('div', 'tabs');
    const tabEls = {};
    for (let i = 0; i < this.TABS.length; i++) {
      const t = this.TABS[i];
      const b = UI.el('button', 'tab');
      b.type = 'button';
      b.dataset.act = 'tab';
      b.dataset.id = t.id;
      b.textContent = t.label;
      tabs.appendChild(b);
      tabEls[t.id] = b;
    }
    root.appendChild(tabs);

    /* --- sub-tab bodies ----------------------------------------------- */
    const bodies = {};
    for (let i = 0; i < this.TABS.length; i++) {
      const d = UI.el('div', 'sec');
      d.hidden = true;
      root.appendChild(d);
      bodies[this.TABS[i].id] = d;
    }

    const safe = UI.el('div', 'safe-b');
    root.appendChild(safe);
    scroll.appendChild(root);

    this._el = {
      root: root,
      scroll: scroll,
      name: head.querySelector('[data-f="name"]'),
      mood: head.querySelector('[data-f="mood"]'),
      total: head.querySelector('[data-f="total"]'),
      tabs: tabEls,
      body: bodies,
    };
    this._roomEls = null;
    this._plotEls = null;
    this._plotN = -1;

    this._buildRooms(bodies.rooms);
    this._buildGarden(bodies.garden);
    this._buildFarm(bodies.farm);
    this._buildChild(bodies.alchemy, 'alchemy');
    this._buildChild(bodies.forge, 'forge');

    // ONE delegated listener for the whole panel.
    root.addEventListener('click', (e) => Abode._onClick(e));
  },

  _buildRooms(host) {
    host.innerHTML = '';
    const grid = UI.el('div', 'grid2');
    this._roomEls = {};
    for (let i = 0; i < this.ROOMS.length; i++) {
      const r = this.ROOMS[i];
      const tile = UI.el('div', 'card tight');
      tile.dataset.act = 'room';
      tile.dataset.id = r.key;
      tile.style.marginBottom = '0';
      tile.innerHTML =
        '<div class="row" style="gap:7px;min-width:0">' +
          '<span class="unit-emoji" style="font-size:23px;line-height:1;flex:0 0 auto">' + r.emoji + '</span>' +
          '<div class="col" style="gap:0;min-width:0">' +
            '<div class="h3" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + r.name + '</div>' +
            '<div class="tiny mono muted" data-f="lvl">Lv 1</div>' +
          '</div>' +
        '</div>' +
        '<div class="tiny" style="letter-spacing:3px;opacity:.6;margin:5px 0 1px">' + r.furn + '</div>' +
        '<div class="tiny jade" data-f="eff" style="min-height:16px">&nbsp;</div>' +
        '<div class="meter" style="margin:6px 0 7px;height:6px"><i data-f="bar"></i></div>' +
        '<button class="btn sm wide" type="button" data-act="up" data-id="' + r.key + '">' +
          '<span data-f="btn">Upgrade</span></button>';
      grid.appendChild(tile);
      this._roomEls[r.key] = {
        tile: tile,
        lvl: tile.querySelector('[data-f="lvl"]'),
        eff: tile.querySelector('[data-f="eff"]'),
        bar: tile.querySelector('[data-f="bar"]'),
        btn: tile.querySelector('[data-act="up"]'),
        btnTxt: tile.querySelector('[data-f="btn"]'),
      };
    }
    host.appendChild(grid);

    const note = UI.el('div', 'card tight');
    note.style.marginTop = '10px';
    note.innerHTML =
      '<div class="sec-title">House rules</div>' +
      '<div class="kv"><span class="k">Room cap at your realm</span><span class="v" data-f="cap">—</span></div>' +
      '<div class="kv"><span class="k">Absolute cap</span><span class="v">Lv ' + CONFIG.abode.maxLevel + '</span></div>' +
      '<div class="tiny muted" style="margin-top:6px">A room can hold no more dao than its owner. Every realm you break into lets each room climb three levels higher.</div>';
    host.appendChild(note);
    this._roomCapEl = note.querySelector('[data-f="cap"]');
  },

  _buildGarden(host) {
    host.innerHTML =
      '<div class="card">' +
        '<div class="row between">' +
          '<div class="row" style="gap:8px;min-width:0">' +
            '<span class="unit-emoji" style="font-size:24px;line-height:1">\u{1F33F}</span>' +
            '<div class="col" style="gap:0;min-width:0">' +
              '<div class="h3">Herb Garden</div>' +
              '<div class="tiny muted" data-f="ginfo">&nbsp;</div>' +
            '</div>' +
          '</div>' +
          '<span class="chip mono" data-f="glvl">Lv 1</span>' +
        '</div>' +
        '<div class="grid2" data-f="plots" style="margin-top:10px"></div>' +
        '<div class="row" style="margin-top:10px;gap:8px">' +
          '<button class="btn wide" type="button" data-act="plantall">\u{1F331} Plant all</button>' +
          '<button class="btn primary wide" type="button" data-act="harvestall">\u{1F9FA} Harvest all</button>' +
        '</div>' +
        '<div class="tiny muted" style="margin-top:8px" data-f="seedline">&nbsp;</div>' +
      '</div>' +
      '<div class="card">' +
        '<div class="row between">' +
          '<div class="row" style="gap:8px;min-width:0">' +
            '<span class="unit-emoji" style="font-size:24px;line-height:1">\u{1F9EA}</span>' +
            '<div class="col" style="gap:0;min-width:0">' +
              '<div class="h3">Dew Extractor</div>' +
              '<div class="tiny muted">Presses garden fruit into Tech Points. Once a day.</div>' +
            '</div>' +
          '</div>' +
          '<span class="chip mono" data-f="xlvl">Lv 1</span>' +
        '</div>' +
        '<div class="kv"><span class="k">\u{1F351} Fruit in basket</span><span class="v" data-f="xfruit">0</span></div>' +
        '<div class="kv"><span class="k">Yield if pressed now</span><span class="v gold" data-f="xyield">0</span></div>' +
        '<button class="btn primary wide" type="button" data-act="extract" style="margin-top:8px">' +
          '<span data-f="xbtn">Press the coils</span></button>' +
        '<div class="tiny muted" style="margin-top:7px" data-f="xnote">&nbsp;</div>' +
      '</div>';

    this._gardenEls = {
      info: host.querySelector('[data-f="ginfo"]'),
      lvl: host.querySelector('[data-f="glvl"]'),
      plots: host.querySelector('[data-f="plots"]'),
      seedline: host.querySelector('[data-f="seedline"]'),
      plantAll: host.querySelector('[data-act="plantall"]'),
      harvestAll: host.querySelector('[data-act="harvestall"]'),
      xlvl: host.querySelector('[data-f="xlvl"]'),
      xfruit: host.querySelector('[data-f="xfruit"]'),
      xyield: host.querySelector('[data-f="xyield"]'),
      xbtn: host.querySelector('[data-f="xbtn"]'),
      xbtnEl: host.querySelector('[data-act="extract"]'),
      xnote: host.querySelector('[data-f="xnote"]'),
    };
  },

  _buildPlots(n) {
    const host = this._gardenEls.plots;
    host.innerHTML = '';
    this._plotEls = [];
    for (let i = 0; i < n; i++) {
      const tile = UI.el('div', 'card tight');
      tile.style.marginBottom = '0';
      tile.innerHTML =
        '<div class="row" style="gap:7px;min-width:0">' +
          '<span class="unit-emoji" style="font-size:22px;line-height:1;flex:0 0 auto" data-f="emoji">\u{1F7EB}</span>' +
          '<div class="col" style="gap:0;min-width:0">' +
            '<div class="tiny" data-f="name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Empty bed</div>' +
            '<div class="tiny mono muted" data-f="time">—</div>' +
          '</div>' +
        '</div>' +
        '<div class="bar exp" style="margin:7px 0"><i data-f="bar"></i></div>' +
        '<button class="btn sm wide" type="button" data-act="plot" data-idx="' + i + '">' +
          '<span data-f="btn">Sow</span></button>';
      host.appendChild(tile);
      this._plotEls.push({
        tile: tile,
        emoji: tile.querySelector('[data-f="emoji"]'),
        name: tile.querySelector('[data-f="name"]'),
        time: tile.querySelector('[data-f="time"]'),
        bar: tile.querySelector('[data-f="bar"]'),
        btn: tile.querySelector('[data-act="plot"]'),
        btnTxt: tile.querySelector('[data-f="btn"]'),
      });
    }
    this._plotN = n;
  },

  _buildFarm(host) {
    host.innerHTML =
      '<div class="card">' +
        '<div class="row between">' +
          '<div class="row" style="gap:8px;min-width:0">' +
            '<span class="unit-emoji" style="font-size:26px;line-height:1">\u{1F33E}</span>' +
            '<div class="col" style="gap:0;min-width:0">' +
              '<div class="h2 serif">Spirit Farm</div>' +
              '<div class="tiny muted" data-f="finfo">&nbsp;</div>' +
            '</div>' +
          '</div>' +
          '<span class="chip mono" data-f="flvl">Lv 1</span>' +
        '</div>' +
        '<div class="meter" style="margin:12px 0 6px;height:18px"><i data-f="fbar"></i></div>' +
        '<div class="row between tiny muted">' +
          '<span data-f="fstored">stored 0h</span><span data-f="fcap">cap 8h</span>' +
        '</div>' +
        '<div class="grid2" style="margin-top:10px">' +
          '<div class="stat"><div class="lbl">\u{1F4B0} Spiritstone</div><div class="val gold" data-f="fstone">0</div></div>' +
          '<div class="stat"><div class="lbl">✨ Cultivation EXP</div><div class="val jade" data-f="fexp">0</div></div>' +
        '</div>' +
        '<button class="btn primary wide glow" type="button" data-act="claimfarm" style="margin-top:12px;min-height:52px">' +
          '<span data-f="fbtn">Claim</span></button>' +
        '<div class="tiny muted" style="margin-top:8px" data-f="fnote">&nbsp;</div>' +
      '</div>' +
      '<div class="card tight">' +
        '<div class="sec-title">Terrace</div>' +
        '<div class="kv"><span class="k">Spiritstone rate</span><span class="v" data-f="frate">0/h</span></div>' +
        '<div class="kv"><span class="k">EXP trickle</span><span class="v" data-f="fexprate">0/h</span></div>' +
        '<div class="kv"><span class="k">Storage cap</span><span class="v">' + CONFIG.abode.farmCapH + 'h</span></div>' +
        '<button class="btn wide" type="button" data-act="up" data-id="farm" style="margin-top:8px">' +
          '<span data-f="fupg">Upgrade</span></button>' +
        '<div class="tiny muted" style="margin-top:7px">The ox works whether you are watching or not, but the granary only holds ' +
          CONFIG.abode.farmCapH + ' hours. Come home before it overflows.</div>' +
      '</div>';

    this._farmEls = {
      info: host.querySelector('[data-f="finfo"]'),
      lvl: host.querySelector('[data-f="flvl"]'),
      bar: host.querySelector('[data-f="fbar"]'),
      stored: host.querySelector('[data-f="fstored"]'),
      cap: host.querySelector('[data-f="fcap"]'),
      stone: host.querySelector('[data-f="fstone"]'),
      exp: host.querySelector('[data-f="fexp"]'),
      btn: host.querySelector('[data-act="claimfarm"]'),
      btnTxt: host.querySelector('[data-f="fbtn"]'),
      note: host.querySelector('[data-f="fnote"]'),
      rate: host.querySelector('[data-f="frate"]'),
      expRate: host.querySelector('[data-f="fexprate"]'),
      upg: host.querySelector('[data-f="fupg"]'),
      upgEl: host.querySelector('[data-act="up"][data-id="farm"]'),
    };
  },

  _buildChild(host, key) {
    host.innerHTML = '';
    const slot = UI.el('div', 'col');
    slot.style.gap = '0';
    host.appendChild(slot);
    if (!this._childEls) this._childEls = {};
    this._childEls[key] = { slot: slot, mounted: false, locked: false };
  },

  /* ------------------------------------------------------------ DOM (patch) */

  _paintHeader() {
    const name = (S.player && S.player.name) ? String(S.player.name) : 'Wanderer';
    const idx = U.hash(name) % this.ABODE_NAMES.length;
    this._el.name.textContent = this.ABODE_NAMES[idx];
    this._el.mood.textContent = this._moodLine();
    let total = 0;
    for (let i = 0; i < this.ROOMS.length; i++) total += this._lvl(this.ROOMS[i].key);
    this._el.total.textContent = String(total);
  },

  _moodLine() {
    const h = new Date().getHours();
    let when;
    if (h < 5) when = 'Small hours; the lanterns gutter.';
    else if (h < 9) when = 'Dawn mist beads on the eaves.';
    else if (h < 12) when = 'Morning sun crosses the courtyard.';
    else if (h < 15) when = 'The kettle has been warm since noon.';
    else if (h < 19) when = 'Long shadows across the herb beds.';
    else if (h < 23) when = 'Evening. Someone is grinding ink.';
    else when = 'Late. The forge coals are banked.';

    const now = Date.now();
    const ripe = this._readyPlots(now);
    if (ripe > 0) return when + ' ' + ripe + (ripe === 1 ? ' bed is ripe.' : ' beds are ripe.');
    if (this._farmPct(now) >= 0.99) return when + ' The granary is full.';
    if (this._extractorReady()) return when + ' The extractor coils are cold and ready.';
    return when;
  },

  _paintTabs() {
    for (let i = 0; i < this.TABS.length; i++) {
      const id = this.TABS[i].id;
      const btn = this._el.tabs[id];
      const body = this._el.body[id];
      if (btn) btn.classList.toggle('active', id === this.sub);
      if (body) body.hidden = (id !== this.sub);
    }
  },

  _paintRooms() {
    const cap = this._levelCap();
    if (this._roomCapEl) this._roomCapEl.textContent = 'Lv ' + cap;

    for (let i = 0; i < this.ROOMS.length; i++) {
      const r = this.ROOMS[i];
      const els = this._roomEls[r.key];
      if (!els) continue;
      const lvl = this._lvl(r.key);

      els.lvl.textContent = 'Lv ' + lvl + ' / ' + CONFIG.abode.maxLevel;
      els.eff.textContent = this._effectText(r.key);
      els.bar.style.width = Math.round((lvl / CONFIG.abode.maxLevel) * 100) + '%';

      if (lvl >= CONFIG.abode.maxLevel) {
        els.btnTxt.textContent = '★ Perfected';
        els.btn.disabled = true;
        els.btn.classList.remove('primary');
        els.btn.classList.add('ghost');
      } else if (lvl >= cap) {
        const need = this._realmForLevel(lvl + 1);
        els.btnTxt.textContent = '\u{1F512} ' + this._realmName(need);
        els.btn.disabled = true;
        els.btn.classList.remove('primary');
        els.btn.classList.add('ghost');
      } else {
        const cost = this._upgradeCost(lvl);
        const afford = Econ.can('stone', cost);
        els.btnTxt.textContent = '\u{1F4B0} ' + Fmt.n(cost);
        els.btn.disabled = false;
        els.btn.classList.toggle('primary', afford);
        els.btn.classList.toggle('ghost', !afford);
      }
    }
  },

  _paintGarden() {
    const g = this._plots();
    const els = this._gardenEls;
    const lvl = this._lvl('garden');
    const now = Date.now();

    if (this._plotN !== g.length) this._buildPlots(g.length);

    els.lvl.textContent = 'Lv ' + lvl;
    els.info.textContent = g.length + ' bed' + (g.length === 1 ? '' : 's') + ' · ' +
      Fmt.dur(Math.round(this._growSec())) + ' per crop';

    let ripe = 0, empty = 0;
    for (let i = 0; i < g.length; i++) {
      const p = g[i] || { seed: null, endAt: 0 };
      const pe = this._plotEls[i];
      if (!pe) continue;

      if (!p.seed) {
        empty++;
        pe.emoji.textContent = '\u{1F7EB}';
        pe.name.textContent = 'Empty bed';
        pe.time.textContent = 'untilled';
        pe.bar.style.width = '0%';
        pe.btnTxt.textContent = '\u{1F331} Sow';
        pe.btn.disabled = (this._bestSeed() === 0);
        pe.btn.classList.remove('primary');
        pe.tile.classList.remove('bg-gold');
      } else {
        const tier = p.seed;
        // Progress is measured against the CURRENT grow time; an upgrade mid-crop
        // therefore reads as "further along", never as lost progress.
        const total = Math.max(1, Math.round(this._growSec() * 1000));
        const left = p.endAt - now;
        pe.name.textContent = this.TIER_NAME[tier - 1] + ' Herb T' + tier;
        if (left <= 0) {
          ripe++;
          pe.emoji.textContent = this.TIER_EMOJI[tier - 1];
          pe.time.textContent = 'ripe';
          pe.bar.style.width = '100%';
          pe.btnTxt.textContent = '\u{1F9FA} Harvest';
          pe.btn.disabled = false;
          pe.btn.classList.add('primary');
          pe.tile.classList.add('bg-gold');
        } else {
          const prog = U.clamp(1 - left / total, 0, 1);
          pe.emoji.textContent = prog < 0.4 ? '\u{1F331}' : (prog < 0.8 ? '\u{1F33F}' : '\u{1F33E}');
          pe.time.textContent = Fmt.durShort(Math.ceil(left / 1000));
          pe.bar.style.width = Math.round(prog * 100) + '%';
          pe.btnTxt.textContent = 'Growing';
          pe.btn.disabled = true;
          pe.btn.classList.remove('primary');
          pe.tile.classList.remove('bg-gold');
        }
      }
    }

    els.plantAll.disabled = (empty === 0 || this._bestSeed() === 0);
    els.harvestAll.disabled = (ripe === 0);
    els.harvestAll.classList.toggle('glow', ripe > 0);

    const bits = [];
    for (let t = 1; t <= 6; t++) {
      const c = this._seedCount(t);
      if (c > 0) bits.push(this.TIER_EMOJI[t - 1] + 'T' + t + ' ×' + Fmt.n(c));
    }
    els.seedline.textContent = bits.length
      ? 'Seed satchel: ' + bits.join('   ')
      : 'Seed satchel empty — hunts, expeditions and the market all yield seeds.';

    /* --- extractor --- */
    const fruit = this._fruit();
    const used = this._extractorUsed();
    const xlvl = this._lvl('extractor');
    els.xlvl.textContent = 'Lv ' + xlvl;
    els.xfruit.textContent = Fmt.n(fruit);
    els.xyield.textContent = '+' + Fmt.n(this._extractorYield(fruit)) + ' Tech';
    if (used >= CONFIG.abode.extractorPerDay) {
      els.xbtn.textContent = 'Coils spent — back tomorrow';
      els.xbtnEl.disabled = true;
      els.xbtnEl.classList.remove('primary');
      els.xnote.textContent = 'The extractor resets with the daily reset.';
    } else if (fruit <= 0) {
      els.xbtn.textContent = 'No fruit to press';
      els.xbtnEl.disabled = true;
      els.xbtnEl.classList.remove('primary');
      els.xnote.textContent = 'Fruit falls from harvested beds — roughly ' +
        Fmt.pct(Math.min(0.60, 0.18 + 0.012 * lvl), 0) + ' of crops at Herb Garden Lv ' + lvl + '.';
    } else {
      els.xbtn.textContent = '\u{1F9EA} Press ' + Fmt.n(fruit) + ' fruit';
      els.xbtnEl.disabled = false;
      els.xbtnEl.classList.add('primary');
      els.xnote.textContent = 'Presses the whole basket at once. Save your fruit for a big run.';
    }
  },

  _paintFarm() {
    const els = this._farmEls;
    const now = Date.now();
    const lvl = this._lvl('farm');
    const pool = this._farmPool(now);
    const perH = this._farmStonePerHour();
    const expH = this._auraPerSec() * CONFIG.abode.farmExpFracOfAura * 3600;

    els.lvl.textContent = 'Lv ' + lvl;
    els.info.textContent = Fmt.n(Math.floor(perH)) + ' stone/h · works while you are away';
    els.bar.style.width = Math.round(pool.pct * 100) + '%';
    els.stored.textContent = 'stored ' + Fmt.dur(Math.floor(pool.ms / 1000));
    els.cap.textContent = 'cap ' + CONFIG.abode.farmCapH + 'h';
    els.stone.textContent = Fmt.n(pool.stone);
    els.exp.textContent = Fmt.n(pool.exp);
    els.rate.textContent = Fmt.n(Math.floor(perH)) + ' / h';
    els.expRate.textContent = Fmt.n(expH) + ' / h';

    const ready = this._farmReady(pool);
    els.btnTxt.textContent = ready ? ('\u{1F9FA} Claim ' + Fmt.n(pool.stone) + ' stone') : 'Nothing stored yet';
    els.btn.disabled = !ready;
    els.btn.classList.toggle('glow', pool.pct >= 0.25);

    if (pool.pct >= 0.999) {
      els.note.textContent = 'The granary is full — every further hour is lost. Claim it.';
      els.note.className = 'tiny bad';
    } else {
      const leftMs = pool.capMs - pool.ms;
      els.note.textContent = 'Full in ' + Fmt.dur(Math.ceil(leftMs / 1000)) + '.';
      els.note.className = 'tiny muted';
    }

    if (lvl >= CONFIG.abode.maxLevel) {
      els.upg.textContent = '★ Terrace perfected';
      els.upgEl.disabled = true;
    } else if (lvl >= this._levelCap()) {
      els.upg.textContent = '\u{1F512} Needs ' + this._realmName(this._realmForLevel(lvl + 1));
      els.upgEl.disabled = true;
    } else {
      const cost = this._upgradeCost(lvl);
      els.upg.textContent = 'Upgrade → Lv ' + (lvl + 1) + '  ·  \u{1F4B0} ' + Fmt.n(cost);
      els.upgEl.disabled = !Econ.can('stone', cost);
    }
  },

  /* Hand the sub-tab body to Alchemy / Forge. Called on EVERY render pass. */
  _paintChild(key) {
    const rec = this._childEls && this._childEls[key];
    if (!rec) return;
    const host = rec.slot;

    const needRealm = (CONFIG.unlocks && CONFIG.unlocks[key] != null) ? CONFIG.unlocks[key] : CONFIG.abode.unlockRealm;
    if (this._realm() < needRealm) {
      if (!rec.locked) {
        host.innerHTML = '<div class="empty locked">Sealed until ' + this._realmName(needRealm) + '.</div>';
        rec.locked = true;
        rec.mounted = false;
      }
      return;
    }
    rec.locked = false;

    let sys = null;
    try {
      if (key === 'alchemy') sys = (typeof Alchemy !== 'undefined') ? Alchemy : null;
      else if (key === 'forge') sys = (typeof Forge !== 'undefined') ? Forge : null;
    } catch (e) { sys = null; }

    if (sys && typeof sys.renderInto === 'function') {
      try {
        if (!rec.mounted) { host.innerHTML = ''; rec.mounted = true; }
        sys.renderInto(host);
        return;
      } catch (e) {
        console.error('[Abode] ' + key + '.renderInto failed:', e);
        rec.mounted = false;
        host.innerHTML = '<div class="empty">The ' + key + ' bench threw a spark and went quiet. ' +
          'Its keeper reported: ' + String((e && e.message) || e).slice(0, 120) + '</div>';
        return;
      }
    }

    if (!rec.mounted) {
      const room = this._room(key);
      host.innerHTML =
        '<div class="card">' +
          '<div class="row" style="gap:9px">' +
            '<span class="unit-emoji" style="font-size:26px;line-height:1">' + (room ? room.emoji : '❓') + '</span>' +
            '<div class="col" style="gap:2px">' +
              '<div class="h3">' + (room ? room.name : key) + '</div>' +
              '<div class="tiny muted">' + (room ? room.flavor : '') + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="divider"></div>' +
          '<div class="tiny bad">This room’s keeper is not present in this build, so its bench cannot be worked. ' +
          'The room itself still counts — you can raise its level from the Rooms tab and keep its bonus.</div>' +
          '<button class="btn wide" type="button" data-act="tab" data-id="rooms" style="margin-top:10px">' +
            '\u{1F3EF} Back to Rooms</button>' +
        '</div>';
      rec.mounted = true;
    }
  },

  /* ============================================================== DELEGATION */

  _onClick(e) {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act;

    if (act === 'tab') {
      const id = t.dataset.id;
      for (let i = 0; i < this.TABS.length; i++) {
        if (this.TABS[i].id !== id) continue;
        this.sub = id;
        this.render();
        return;
      }
      return;
    }

    if (act === 'up') { this._tryUpgrade(t.dataset.id); this.render(); return; }

    if (act === 'room') {
      const key = t.dataset.id;
      const room = this._room(key);
      if (!room) return;
      if (room.sub) { this.sub = room.sub; this.render(); return; }
      this._openRoomSheet(key);
      return;
    }

    if (act === 'plot') {
      const idx = parseInt(t.dataset.idx, 10);
      if (!(idx >= 0)) return;
      this._ensure();
      const p = this._plots()[idx];
      if (!p) return;
      if (!p.seed) { this._openPlantSheet(idx); return; }
      const now = Date.now();
      if (now < p.endAt) { UI.toast('Still growing — ' + Fmt.dur(Math.ceil((p.endAt - now) / 1000)) + ' left.', 'info'); return; }
      const r = this._harvestOne(idx, now);
      if (r) {
        Bus.emit('gardenHarvest', { n: 1 });
        let msg = '+' + r.herbs + ' ' + this.TIER_EMOJI[r.tier - 1] + ' T' + r.tier + ' herbs';
        if (r.fruit > 0) msg += '  ·  +' + r.fruit + ' \u{1F351} fruit';
        UI.toast(msg, 'good');
        try { UI.float(t, '+' + r.herbs, 'good'); } catch (err) { /* ignore */ }
        this._refreshBadges();
        try { Save.save(); } catch (err) { /* ignore */ }
      }
      this.render();
      return;
    }

    if (act === 'plantall') { this._plantAll(); this.render(); return; }
    if (act === 'harvestall') { this._harvestAll(); this.render(); return; }
    if (act === 'claimfarm') { this._claimFarm(t); this.render(); return; }
    if (act === 'extract') { this._runExtractor(t); this.render(); return; }
  },

  /* Detail sheet for rooms without a screen of their own. */
  _openRoomSheet(key) {
    const room = this._room(key);
    if (!room) return;
    const lvl = this._lvl(key);
    const cap = this._levelCap();
    const maxed = lvl >= CONFIG.abode.maxLevel;
    const gated = !maxed && lvl >= cap;
    const cost = this._upgradeCost(lvl);

    let rows =
      '<div class="kv"><span class="k">Level</span><span class="v">' + lvl + ' / ' + CONFIG.abode.maxLevel + '</span></div>' +
      '<div class="kv"><span class="k">Current effect</span><span class="v jade">' + this._effectText(key) + '</span></div>';

    if (!maxed && !gated) {
      const nextLvl = lvl + 1;
      rows += '<div class="kv"><span class="k">Next level</span><span class="v">' + this._nextEffectText(key, nextLvl) + '</span></div>' +
              '<div class="kv"><span class="k">Cost</span><span class="v gold">\u{1F4B0} ' + Fmt.n(cost) + '</span></div>';
    } else if (gated) {
      rows += '<div class="kv"><span class="k">Blocked by realm</span><span class="v bad">' +
              this._realmName(this._realmForLevel(lvl + 1)) + '</span></div>';
    }

    if (key === 'tea') {
      rows += '<div class="kv"><span class="k">Fortuity interval</span><span class="v">×' +
              Fmt.n1(this.fortuityMult()) + '</span></div>';
    }
    if (key === 'cultivation') {
      rows += '<div class="kv"><span class="k">Aura right now</span><span class="v">' +
              Fmt.n(this._auraPerSec()) + ' / s</span></div>';
    }
    if (key === 'extractor') {
      rows += '<div class="kv"><span class="k">Uses left today</span><span class="v">' +
              Math.max(0, CONFIG.abode.extractorPerDay - this._extractorUsed()) + '</span></div>';
    }

    const body = document.createElement('div');
    body.innerHTML =
      '<div class="row" style="gap:10px;margin-bottom:8px">' +
        '<span class="unit-emoji" style="font-size:30px;line-height:1">' + room.emoji + '</span>' +
        '<div class="tiny muted">' + room.flavor + '</div>' +
      '</div>' +
      '<div class="sec">' + rows + '</div>';

    const buttons = [];
    if (!maxed && !gated) {
      buttons.push({
        label: 'Upgrade · ' + Fmt.n(cost), cls: 'primary',
        act: (close) => { close(); Abode._tryUpgrade(key); Abode.render(); },
      });
    }
    if (key === 'extractor') {
      buttons.push({ label: 'Open Garden', cls: '', act: (close) => { close(); Abode.setSub('garden'); Abode.render(); } });
    }
    buttons.push({ label: 'Close', cls: 'ghost', act: (close) => close() });

    UI.sheet({ title: room.name, body: body, buttons: buttons });
  },

  _nextEffectText(key, lvl) {
    if (key === 'cultivation') return '+' + Fmt.pct(CONFIG.abode.cultivationAuraPerLevel * lvl, 0) + ' aura';
    if (key === 'alchemy') return '+' + Fmt.pct(0.01 * lvl, 0) + ' pill quality odds';
    if (key === 'forge') return '+' + Fmt.pct(0.01 * lvl, 0) + ' forge quality odds';
    if (key === 'garden') {
      const sec = CONFIG.abode.gardenGrowSec / (1 + (lvl - 1) * 0.05);
      const base = 2 + Math.floor(lvl / 3);
      return Fmt.dur(Math.round(sec)) + ' · ' + base + '-' + (base + 2) + ' herbs';
    }
    if (key === 'farm') {
      return Fmt.n(Math.floor(CONFIG.abode.farmStonePerHourBase * (1 + lvl * 0.35))) + ' stone/h';
    }
    if (key === 'extractor') {
      return Fmt.n1(CONFIG.abode.extractorTechPerFruit * (1 + (lvl - 1) * 0.08)) + ' tech / fruit';
    }
    if (key === 'tea') {
      return '-' + Fmt.pct(1 - U.clamp(1 - CONFIG.abode.teaRoomFortuityBonus * lvl, 0.40, 1), 0) + ' fortuity wait';
    }
    return '';
  },
};

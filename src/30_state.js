/* ---------------------------------------------------------------------------
 * S / Save / Daily / Offline — the persistence backbone.
 *
 * Nothing in here is allowed to throw into the game loop. Every localStorage
 * touch, every JSON parse, every provider callback is wrapped. The worst case
 * is a console warning and a fresh (or slightly stale) save.
 *
 * FORMULAS
 *   throttle      Save.save() writes at most once per Save._minWriteMs (2000ms).
 *                 A call inside the window schedules ONE trailing write at
 *                 lastWrite + 2000; further calls in that window are absorbed.
 *
 *   migrate(raw)  v = floor(raw.v), clamped to >= 1 (missing/garbage => 1)
 *                 while v < CONFIG.saveVersion: v1->v2->v3->v4, one step each
 *                 then ALWAYS: merged = deepMerge(raw, freshState())
 *                              normalize(merged)
 *                 deepMerge is shape-driven by freshState(): a key missing or
 *                 of the wrong primitive type is replaced by the default; a
 *                 default of null accepts any value; dictionaries ({} default)
 *                 keep every key the save had.
 *
 *   base64        JSON -> UTF-8 bytes -> base64. UTF-8 via TextEncoder when
 *                 present, else a manual code-point encoder (1/2/3/4 bytes).
 *                 base64 via a manual alphabet table, so no bare btoa() ever
 *                 sees a non-Latin1 character. Decode is the exact inverse.
 *
 *   Daily.check   newDay  = U.todayStr(now) !== S.lastDaily     (string compare)
 *                 newWeek = U.weekStr(now)  !== S.lastWeekly    (ISO week)
 *                 Cheap enough to run every 250ms tick, so a tab left open
 *                 across midnight resets exactly like a reload would.
 *
 *   Offline cap   capH   = CONFIG.offline.baseCapH
 *                        + upgrades * CONFIG.offline.capPerUpgradeH
 *                        + Stats.bonus('offlineHours')
 *                 upgrades = clamp(S.flags.offlineUp, 0, CONFIG.offline.maxUpgrades)
 *                 elapsed  = max(0, now - S.lastSeen)      (clock-cheat clamps to 0)
 *                 capped   = min(elapsed, capH * 3600)
 *                 The modal is suppressed when elapsed < CONFIG.offline.minShowSec,
 *                 but the gains are still granted.
 * ------------------------------------------------------------------------ */

/* The save. Reassigned by Save.load / Save.import / Save.reset and by the dev
   simulator. NEVER cache this or a subtree in a module-level variable. */
let S = null;

/* The complete default save tree. Every field of CONTRACT section 2, correct
   types, no undefined anywhere. Also used as the merge template by migrate(). */
function freshState() {
  return {
    v: CONFIG.saveVersion,
    createdAt: 0,
    lastSeen: 0,
    lastDaily: '',
    lastWeekly: '',
    playtimeSec: 0,
    created: false,

    player: {
      name: '', path: 'body',
      realm: 0, phase: 1, exp: 0,
      eternalLayer: 0,
      luck: CONFIG.wilds.luckStart,
      title: '',
      law: null, lawLevel: 0,
      auraColor: 'jade',
      permStats: { hp: 0, mp: 0, patk: 0, matk: 0, pdef: 0, mdef: 0, spd: 0 },
      pillUses: { vital: {}, mind: {} },
    },

    cur: {
      stone: 0, jade: 0, tech: 0, guide: 0, citrine: 0, contribution: 0,
      stones: 0, dust: 0, insight: 0, lawShard: 0,
    },
    lifetimeContribution: 0,

    mats: {
      herb: [0, 0, 0, 0, 0, 0], core:  [0, 0, 0, 0, 0, 0],
      forge:[0, 0, 0, 0, 0, 0], seed:  [0, 0, 0, 0, 0, 0],
      fruit: 0,
    },

    daily: {
      pillAttemptsUsed: 0, respiraCount: 0,
      duelTickets: CONFIG.duel.ticketsPerDay,
      spireAttempts: 0, sweepUsed: 0, sectMedUsed: 0, extractorUsed: 0,
      activityPoints: 0, chestsClaimed: [false, false, false], tasks: [],
    },
    weekly: { tasks: [], clashDone: false },

    respira: { charges: 0, chargeMs: 0, sinceSurge: 0, level: 0, capUp: 0 },
    bt: { failures: {}, injuryUntil: 0, loaded: [] },
    alchemy: { queue: [], mastery: {}, assistant: false, queueUp: 0, baitUntil: 0 },

    inv: { pills: {}, formulas: [], blueprints: [], gear: [], nextUid: 1 },
    equipped: {
      weapon: null, armor: null, pendant: null,
      relicA: null, relicB: null, relicC: null,
    },
    forge: { pity: 0, crafted: 0 },

    wilds: {
      zones: {},
      expedition: { zone: null, sinceMs: 0, startedAt: 0 },
      fortuity: { queue: [], nextAt: 0 },
    },
    abode: {
      rooms: {
        cultivation: 1, alchemy: 1, forge: 1, garden: 1,
        farm: 1, extractor: 1, tea: 1,
      },
      garden: [{ seed: null, endAt: 0 }, { seed: null, endAt: 0 }],
      farm: { sinceMs: 0 },
    },
    sect: { id: null, joinedAt: 0, rank: 0, lastSwitch: 0, tasks: [], medUntil: 0 },
    techs: { owned: [] },

    spire: { floor: 0, best: 0, clears: {} },
    tide:  { nextAt: 0, run: null },
    duel:  {
      rank: CONFIG.duel.npcCount, npcs: [], seasonStart: 0,
      lastDrift: '', wins: 0, losses: 0, snapshot: null,
    },

    curios:  { owned: [] },
    quests:  { step: 0, claimed: [] },
    story:   { seen: [] },
    pass:    { level: 0, points: 0, claimed: [] },
    ach:     { done: [], claimed: [] },
    mail:    [],
    shops:   { market: { stock: [], day: '' }, black: { stock: [], nextAt: 0 }, bought: {} },
    samsara: { cycle: 0, marks: 0, tree: {} },

    settings: { speed: 1, autoHunt: false, reduceFx: false, confirmSpend: true },
    stats: {
      hunts: 0, bosses: 0, pillsCrafted: 0, gearCrafted: 0,
      duels: 0, respiras: 0, breakthroughs: 0,
    },
    flags: {},
  };
}

/* ========================================================================= */

const Save = {

  /* True once a storage probe (or a later write) has failed. 90_boot.js reads
     this to reveal the #lsWarn banner. */
  storageBroken: false,

  /* -------------------------------------------------------------- private */
  _probed: false,
  _ls: null,
  _mem: Object.create(null),     // in-memory fallback when storage is unusable
  _lastWrite: 0,
  _timer: 0,
  _minWriteMs: 2000,
  _warned: false,

  /* One-time capability probe. Private browsing, file:// in some builds, and
     a disabled-cookies profile all make localStorage throw on ACCESS, not just
     on write — hence the whole thing sits inside one try. */
  _probe() {
    if (Save._probed) return;
    Save._probed = true;
    try {
      const w = (typeof window !== 'undefined') ? window : null;
      const ls = w ? w.localStorage : null;
      if (!ls) throw new Error('localStorage unavailable');
      const k = '__everdao_probe__';
      ls.setItem(k, '1');
      if (ls.getItem(k) !== '1') throw new Error('storage readback failed');
      ls.removeItem(k);
      Save._ls = ls;
      Save.storageBroken = false;
    } catch (e) {
      Save._ls = null;
      Save._flagBroken(e);
    }
  },

  /* Storage died (probe failed, quota exceeded, profile locked). Fall back to
     memory and let boot show the banner. Warn once, never throw. */
  _flagBroken(err) {
    Save.storageBroken = true;
    if (!Save._warned) {
      Save._warned = true;
      console.warn('[Save] localStorage unavailable — progress is memory-only this session.', err);
    }
    try {
      if (typeof window !== 'undefined') window.EVERDAO_STORAGE_BROKEN = true;
    } catch (e) { /* nothing left to do */ }
  },

  _read(key) {
    Save._probe();
    if (Save.storageBroken || !Save._ls) {
      const v = Save._mem[key];
      return (typeof v === 'string') ? v : null;
    }
    try {
      const v = Save._ls.getItem(key);
      return (typeof v === 'string') ? v : null;
    } catch (e) {
      Save._flagBroken(e);
      const v = Save._mem[key];
      return (typeof v === 'string') ? v : null;
    }
  },

  _write(key, val) {
    Save._probe();
    if (Save.storageBroken || !Save._ls) { Save._mem[key] = val; return false; }
    try {
      Save._ls.setItem(key, val);
      return true;
    } catch (e) {
      Save._flagBroken(e);
      Save._mem[key] = val;
      return false;
    }
  },

  _del(key) {
    Save._probe();
    delete Save._mem[key];
    if (Save.storageBroken || !Save._ls) return;
    try { Save._ls.removeItem(key); } catch (e) { Save._flagBroken(e); }
  },

  /* ----------------------------------------------------------------- write */

  /* Throttled write — safe to call after every player action. At most one
     write per _minWriteMs; calls inside the window collapse into one trailing
     write so a burst of taps costs a single serialisation. */
  save() {
    if (!S) return false;
    const now = Date.now();
    const since = now - Save._lastWrite;
    if (since >= Save._minWriteMs || since < 0) return Save.saveNow();
    if (Save._timer) return false;               // trailing write already booked
    const delay = Save._minWriteMs - since;
    try {
      Save._timer = setTimeout(function saveFlush() {
        Save._timer = 0;
        try { Save.saveNow(); } catch (e) { console.warn('[Save] flush failed', e); }
      }, delay);
    } catch (e) {
      Save._timer = 0;
      return Save.saveNow();
    }
    return false;
  },

  /* Immediate write. Returns true when the bytes reached real storage. */
  saveNow() {
    if (!S) return false;
    if (Save._timer) {
      try { clearTimeout(Save._timer); } catch (e) { /* ignore */ }
      Save._timer = 0;
    }
    Save._lastWrite = Date.now();
    let json;
    try {
      if (!Number.isFinite(Number(S.v))) S.v = CONFIG.saveVersion;
      json = JSON.stringify(S);
    } catch (e) {
      console.error('[Save] could not serialise the save', e);
      return false;
    }
    if (typeof json !== 'string' || !json) return false;
    return Save._write(CONFIG.saveKey, json);
  },

  /* ------------------------------------------------------------------ read */

  /* Loads, migrates and installs the save into S.
     Returns true only when a real save existed and was applied. */
  load() {
    let txt = null;
    try { txt = Save._read(CONFIG.saveKey); } catch (e) { console.warn('[Save] read failed', e); }

    if (typeof txt !== 'string' || !txt) {
      S = freshState();
      return false;
    }

    let raw = null;
    try {
      raw = JSON.parse(txt);
    } catch (e) {
      console.error('[Save] save data is corrupt — starting fresh, corrupt copy kept', e);
      try { Save._write(CONFIG.saveKey + '.broken', txt); } catch (e2) { /* ignore */ }
      S = freshState();
      return false;
    }

    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      S = freshState();
      return false;
    }

    try {
      S = Save.migrate(raw);
    } catch (e) {
      console.error('[Save] migration failed — starting fresh', e);
      S = freshState();
      return false;
    }
    return true;
  },

  /* ------------------------------------------------------------- MIGRATION */

  /* Upgrades a raw parsed save to CONFIG.saveVersion, one version at a time,
     then deep-merges against freshState() so a missing key can never crash a
     panel. Always returns a usable state object. */
  migrate(raw) {
    let r = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};

    let v = Math.floor(Number(r.v));
    if (!Number.isFinite(v) || v < 1) v = 1;
    r.v = v;

    let guard = 0;
    while (r.v < CONFIG.saveVersion && guard++ < 16) {
      const before = r.v;
      try {
        switch (r.v) {
          case 1: r = Save._v1to2(r); break;
          case 2: r = Save._v2to3(r); break;
          case 3: r = Save._v3to4(r); break;
          default: r.v = CONFIG.saveVersion; break;
        }
      } catch (e) {
        console.error('[Save] migration step v' + before + ' failed, continuing', e);
        r.v = before + 1;
      }
      if (!r || typeof r !== 'object') { r = freshState(); break; }
      if (!(Number(r.v) > before)) r.v = before + 1;    // never spin forever
    }

    if (r.v > CONFIG.saveVersion) {
      console.warn('[Save] save is from a newer build (v' + r.v +
                   ' > v' + CONFIG.saveVersion + ') — loading it as-is');
    }

    const merged = Save._merge(r, freshState());
    Save._normalize(merged);
    return merged;
  },

  /* v1 -> v2: the Law path, Eternal layers, the breakthrough block and the
     weekly cycle did not exist in v1 saves. */
  _v1to2(raw) {
    const p = (raw.player && typeof raw.player === 'object') ? raw.player : (raw.player = {});
    if (p.law === undefined) p.law = null;
    if (typeof p.lawLevel !== 'number') p.lawLevel = 0;
    if (typeof p.eternalLayer !== 'number') p.eternalLayer = 0;
    if (typeof p.auraColor !== 'string') p.auraColor = 'jade';
    if (typeof p.title !== 'string') p.title = '';
    if (typeof p.luck !== 'number') p.luck = CONFIG.wilds.luckStart;

    const c = (raw.cur && typeof raw.cur === 'object') ? raw.cur : (raw.cur = {});
    if (typeof c.lawShard !== 'number') c.lawShard = 0;
    if (typeof c.insight !== 'number') c.insight = 0;
    if (typeof c.dust !== 'number') c.dust = 0;
    if (typeof c.stones !== 'number') c.stones = 0;

    if (!raw.bt || typeof raw.bt !== 'object') raw.bt = { failures: {}, injuryUntil: 0, loaded: [] };
    if (!raw.bt.failures || typeof raw.bt.failures !== 'object') raw.bt.failures = {};
    if (!Array.isArray(raw.bt.loaded)) raw.bt.loaded = [];

    const rs = (raw.respira && typeof raw.respira === 'object') ? raw.respira : (raw.respira = {});
    if (typeof rs.level !== 'number') rs.level = 0;
    if (typeof rs.capUp !== 'number') rs.capUp = 0;
    if (typeof rs.sinceSurge !== 'number') rs.sinceSurge = 0;

    if (!raw.weekly || typeof raw.weekly !== 'object') raw.weekly = { tasks: [], clashDone: false };
    if (typeof raw.lastWeekly !== 'string') raw.lastWeekly = '';

    raw.v = 2;
    return raw;
  },

  /* v2 -> v3: the battle ladder (spire/tide/duel), the retention layer
     (curios/pass/ach/mail/shops) and the daily chest counters. */
  _v2to3(raw) {
    if (!raw.spire || typeof raw.spire !== 'object') raw.spire = { floor: 0, best: 0, clears: {} };
    if (!raw.spire.clears || typeof raw.spire.clears !== 'object') raw.spire.clears = {};
    if (!raw.tide || typeof raw.tide !== 'object') raw.tide = { nextAt: 0, run: null };
    if (!raw.duel || typeof raw.duel !== 'object') {
      raw.duel = {
        rank: CONFIG.duel.npcCount, npcs: [], seasonStart: 0,
        lastDrift: '', wins: 0, losses: 0, snapshot: null,
      };
    }
    if (!Array.isArray(raw.duel.npcs)) raw.duel.npcs = [];

    if (!raw.curios || typeof raw.curios !== 'object') raw.curios = { owned: [] };
    if (!Array.isArray(raw.curios.owned)) raw.curios.owned = [];
    if (!raw.pass || typeof raw.pass !== 'object') raw.pass = { level: 0, points: 0, claimed: [] };
    if (!raw.ach || typeof raw.ach !== 'object') raw.ach = { done: [], claimed: [] };
    if (!Array.isArray(raw.mail)) raw.mail = [];
    if (!raw.shops || typeof raw.shops !== 'object') {
      raw.shops = { market: { stock: [], day: '' }, black: { stock: [], nextAt: 0 }, bought: {} };
    }
    if (!raw.shops.bought || typeof raw.shops.bought !== 'object') raw.shops.bought = {};

    const d = (raw.daily && typeof raw.daily === 'object') ? raw.daily : (raw.daily = {});
    if (!Array.isArray(d.chestsClaimed)) d.chestsClaimed = [false, false, false];
    if (typeof d.activityPoints !== 'number') d.activityPoints = 0;
    if (typeof d.duelTickets !== 'number') d.duelTickets = CONFIG.duel.ticketsPerDay;
    if (typeof d.spireAttempts !== 'number') d.spireAttempts = 0;
    if (typeof d.sweepUsed !== 'number') d.sweepUsed = 0;
    if (!Array.isArray(d.tasks)) d.tasks = [];

    raw.v = 3;
    return raw;
  },

  /* v3 -> v4: Samsara, permanent stats, per-realm pill uses, blueprints, the
     Extractor and Tea rooms, lifetime contribution and the stats counters. */
  _v3to4(raw) {
    if (!raw.samsara || typeof raw.samsara !== 'object') raw.samsara = { cycle: 0, marks: 0, tree: {} };
    if (!raw.samsara.tree || typeof raw.samsara.tree !== 'object') raw.samsara.tree = {};

    const p = (raw.player && typeof raw.player === 'object') ? raw.player : (raw.player = {});
    if (!p.permStats || typeof p.permStats !== 'object') {
      p.permStats = { hp: 0, mp: 0, patk: 0, matk: 0, pdef: 0, mdef: 0, spd: 0 };
    }
    if (!p.pillUses || typeof p.pillUses !== 'object') p.pillUses = { vital: {}, mind: {} };
    if (!p.pillUses.vital || typeof p.pillUses.vital !== 'object') p.pillUses.vital = {};
    if (!p.pillUses.mind || typeof p.pillUses.mind !== 'object') p.pillUses.mind = {};

    const inv = (raw.inv && typeof raw.inv === 'object') ? raw.inv : (raw.inv = {});
    if (!Array.isArray(inv.blueprints)) inv.blueprints = [];
    if (!Array.isArray(inv.formulas)) inv.formulas = [];
    if (!Array.isArray(inv.gear)) inv.gear = [];
    if (!inv.pills || typeof inv.pills !== 'object') inv.pills = {};
    if (typeof inv.nextUid !== 'number') inv.nextUid = 1;

    const ab = (raw.abode && typeof raw.abode === 'object') ? raw.abode : (raw.abode = {});
    if (!ab.rooms || typeof ab.rooms !== 'object') ab.rooms = {};
    const rooms = ['cultivation', 'alchemy', 'forge', 'garden', 'farm', 'extractor', 'tea'];
    for (let i = 0; i < rooms.length; i++) {
      const lvl = Math.floor(Number(ab.rooms[rooms[i]]));
      ab.rooms[rooms[i]] = (Number.isFinite(lvl) && lvl >= 1) ? lvl : 1;
    }
    if (!Array.isArray(ab.garden)) ab.garden = [{ seed: null, endAt: 0 }, { seed: null, endAt: 0 }];
    if (!ab.farm || typeof ab.farm !== 'object') ab.farm = { sinceMs: 0 };

    if (!raw.settings || typeof raw.settings !== 'object') raw.settings = {};
    if (typeof raw.settings.confirmSpend !== 'boolean') raw.settings.confirmSpend = true;

    if (!raw.stats || typeof raw.stats !== 'object') {
      raw.stats = {
        hunts: 0, bosses: 0, pillsCrafted: 0, gearCrafted: 0,
        duels: 0, respiras: 0, breakthroughs: 0,
      };
    }
    if (typeof raw.lifetimeContribution !== 'number') {
      const c = (raw.cur && typeof raw.cur.contribution === 'number') ? raw.cur.contribution : 0;
      raw.lifetimeContribution = Math.max(0, c);
    }
    if (!raw.techs || typeof raw.techs !== 'object') raw.techs = { owned: [] };
    if (!Array.isArray(raw.techs.owned)) raw.techs.owned = [];

    raw.v = 4;
    return raw;
  },

  /* Shape-driven deep merge. `def` (a freshState() subtree) decides the shape:
       null default     -> any saved value is accepted (law, equipped slots, ...)
       array default    -> the saved array is kept whole, else the default
       object default   -> recurse; keys the save has but the default does not
                           are preserved (dictionaries: zones, flags, pills, ...)
       primitive        -> keep the saved value only if it has the right type */
  _merge(raw, def) {
    if (def === null) return (raw === undefined) ? null : raw;

    if (Array.isArray(def)) {
      if (Array.isArray(raw)) return raw;
      return U.deepClone(def);
    }

    if (typeof def === 'object') {
      const out = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
      for (const k in def) {
        if (!Object.prototype.hasOwnProperty.call(def, k)) continue;
        out[k] = Save._merge(out[k], def[k]);
      }
      return out;
    }

    if (typeof def === 'number') {
      if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
      if (typeof raw === 'string' && raw !== '') {
        const x = Number(raw);
        if (Number.isFinite(x)) return x;
      }
      return def;
    }
    if (typeof def === 'string') return (typeof raw === 'string') ? raw : def;
    if (typeof def === 'boolean') return (typeof raw === 'boolean') ? raw : def;

    return (raw === undefined) ? def : raw;
  },

  /* Post-merge sanity pass: clamp ranges, fix array lengths, kill negatives and
     enforce the CONTRACT section 2 collection bounds so saves cannot bloat. */
  _normalize(s) {
    if (!s || typeof s !== 'object') return;
    const num = function (v, d) {
      const x = Number(v);
      return Number.isFinite(x) ? x : d;
    };
    const int0 = function (v) {
      const x = Math.floor(Number(v));
      return (Number.isFinite(x) && x > 0) ? x : 0;
    };

    s.v = num(s.v, CONFIG.saveVersion);
    s.createdAt = int0(s.createdAt);
    s.lastSeen = int0(s.lastSeen);
    s.playtimeSec = Math.max(0, num(s.playtimeSec, 0));
    if (typeof s.lastDaily !== 'string') s.lastDaily = '';
    if (typeof s.lastWeekly !== 'string') s.lastWeekly = '';
    s.created = (s.created === true);

    /* ---- player */
    const p = s.player;
    p.name = (typeof p.name === 'string') ? p.name.slice(0, 24) : '';
    if (['body', 'spell', 'sword', 'ghost'].indexOf(p.path) < 0) p.path = 'body';
    p.realm = U.clamp(Math.floor(num(p.realm, 0)), 0, CONFIG.cultivation.maxRealm);
    p.phase = U.clamp(Math.floor(num(p.phase, 1)), 1, CONFIG.cultivation.phasesPerRealm);
    p.exp = Math.max(0, num(p.exp, 0));
    p.eternalLayer = int0(p.eternalLayer);
    p.luck = U.clamp(Math.floor(num(p.luck, CONFIG.wilds.luckStart)),
                     CONFIG.wilds.luckMin, CONFIG.wilds.luckMax);
    p.lawLevel = U.clamp(Math.floor(num(p.lawLevel, 0)), 0, CONFIG.law.maxLevel);
    if (typeof p.law !== 'string') p.law = null;
    if (typeof p.title !== 'string') p.title = '';
    if (typeof p.auraColor !== 'string' || !p.auraColor) p.auraColor = 'jade';
    for (const k in p.permStats) {
      if (Object.prototype.hasOwnProperty.call(p.permStats, k)) p.permStats[k] = int0(p.permStats[k]);
    }

    /* ---- currencies: integers, never negative */
    for (const k in s.cur) {
      if (Object.prototype.hasOwnProperty.call(s.cur, k)) s.cur[k] = int0(s.cur[k]);
    }
    s.lifetimeContribution = int0(s.lifetimeContribution);

    /* ---- materials: exactly 6 tiers each */
    const matKeys = ['herb', 'core', 'forge', 'seed'];
    for (let i = 0; i < matKeys.length; i++) {
      const key = matKeys[i];
      const src = Array.isArray(s.mats[key]) ? s.mats[key] : [];
      const arr = [0, 0, 0, 0, 0, 0];
      for (let t = 0; t < 6; t++) arr[t] = int0(src[t]);
      s.mats[key] = arr;
    }
    s.mats.fruit = int0(s.mats.fruit);

    /* ---- daily / weekly */
    const d = s.daily;
    d.pillAttemptsUsed = int0(d.pillAttemptsUsed);
    d.respiraCount = int0(d.respiraCount);
    d.duelTickets = U.clamp(Math.floor(num(d.duelTickets, 0)), 0, 99);
    d.spireAttempts = int0(d.spireAttempts);
    d.sweepUsed = int0(d.sweepUsed);
    d.sectMedUsed = int0(d.sectMedUsed);
    d.extractorUsed = int0(d.extractorUsed);
    d.activityPoints = int0(d.activityPoints);
    const chests = Array.isArray(d.chestsClaimed) ? d.chestsClaimed : [];
    d.chestsClaimed = [chests[0] === true, chests[1] === true, chests[2] === true];
    d.tasks = Daily._cleanTasks(d.tasks);
    s.weekly.tasks = Daily._cleanTasks(s.weekly.tasks);
    s.weekly.clashDone = (s.weekly.clashDone === true);

    /* ---- respira / breakthrough */
    s.respira.charges = int0(s.respira.charges);
    s.respira.chargeMs = Math.max(0, num(s.respira.chargeMs, 0));
    s.respira.sinceSurge = int0(s.respira.sinceSurge);
    s.respira.level = U.clamp(Math.floor(num(s.respira.level, 0)), 0, CONFIG.respira.maxLevel);
    s.respira.capUp = U.clamp(Math.floor(num(s.respira.capUp, 0)), 0, CONFIG.respira.maxCapUpgrades);
    s.bt.injuryUntil = int0(s.bt.injuryUntil);
    if (!Array.isArray(s.bt.loaded)) s.bt.loaded = [];
    s.bt.loaded = s.bt.loaded.filter(function (x) { return typeof x === 'string'; })
                             .slice(0, CONFIG.breakthrough.maxPills);

    /* ---- inventory bounds */
    if (!Array.isArray(s.inv.gear)) s.inv.gear = [];
    if (s.inv.gear.length > 300) s.inv.gear = s.inv.gear.slice(0, 300);
    s.inv.nextUid = Math.max(1, Math.floor(num(s.inv.nextUid, 1)));
    s.inv.formulas = s.inv.formulas.filter(function (x) { return typeof x === 'string'; });
    s.inv.blueprints = s.inv.blueprints.filter(function (x) { return typeof x === 'string'; });
    for (const k in s.inv.pills) {
      if (Object.prototype.hasOwnProperty.call(s.inv.pills, k)) {
        const n = int0(s.inv.pills[k]);
        if (n <= 0) delete s.inv.pills[k]; else s.inv.pills[k] = n;
      }
    }
    if (!Array.isArray(s.alchemy.queue)) s.alchemy.queue = [];
    s.alchemy.queue = s.alchemy.queue.filter(function (j) { return j && typeof j === 'object'; }).slice(0, 8);
    s.alchemy.queueUp = U.clamp(Math.floor(num(s.alchemy.queueUp, 0)), 0, CONFIG.alchemy.maxQueueUpgrades);
    s.alchemy.baitUntil = int0(s.alchemy.baitUntil);
    s.alchemy.assistant = (s.alchemy.assistant === true);

    /* ---- wilds */
    if (!s.wilds.zones || typeof s.wilds.zones !== 'object') s.wilds.zones = {};
    for (const z in s.wilds.zones) {
      if (!Object.prototype.hasOwnProperty.call(s.wilds.zones, z)) continue;
      const rec = s.wilds.zones[z];
      if (!rec || typeof rec !== 'object') { delete s.wilds.zones[z]; continue; }
      rec.stage = U.clamp(Math.floor(num(rec.stage, 0)), 0, CONFIG.wilds.stagesPerZone);
      rec.cleared = int0(rec.cleared);
    }
    if (!Array.isArray(s.wilds.fortuity.queue)) s.wilds.fortuity.queue = [];
    if (s.wilds.fortuity.queue.length > CONFIG.wilds.fortuityQueueMax) {
      s.wilds.fortuity.queue = s.wilds.fortuity.queue.slice(0, CONFIG.wilds.fortuityQueueMax);
    }
    s.wilds.fortuity.nextAt = int0(s.wilds.fortuity.nextAt);
    s.wilds.expedition.sinceMs = int0(s.wilds.expedition.sinceMs);
    s.wilds.expedition.startedAt = int0(s.wilds.expedition.startedAt);
    if (typeof s.wilds.expedition.zone !== 'string') s.wilds.expedition.zone = null;

    /* ---- abode: 7 rooms, 2..6 garden plots */
    const roomKeys = ['cultivation', 'alchemy', 'forge', 'garden', 'farm', 'extractor', 'tea'];
    for (let i = 0; i < roomKeys.length; i++) {
      const rk = roomKeys[i];
      s.abode.rooms[rk] = U.clamp(Math.floor(num(s.abode.rooms[rk], 1)), 1, CONFIG.abode.maxLevel);
    }
    if (!Array.isArray(s.abode.garden)) s.abode.garden = [];
    const plots = [];
    const wantPlots = U.clamp(s.abode.garden.length,
                              CONFIG.abode.gardenPlotsBase, CONFIG.abode.gardenPlotsMax);
    for (let i = 0; i < wantPlots; i++) {
      const src = s.abode.garden[i];
      const seed = (src && typeof src.seed === 'number' && Number.isFinite(src.seed))
        ? U.clamp(Math.floor(src.seed), 1, 6) : null;
      plots.push({ seed: seed, endAt: int0(src && src.endAt) });
    }
    s.abode.garden = plots;
    s.abode.farm.sinceMs = int0(s.abode.farm.sinceMs);

    /* ---- sect / techs / spire / duel */
    if (typeof s.sect.id !== 'string') s.sect.id = null;
    s.sect.rank = U.clamp(Math.floor(num(s.sect.rank, 0)), 0, CONFIG.sect.ranks.length - 1);
    s.sect.joinedAt = int0(s.sect.joinedAt);
    s.sect.lastSwitch = int0(s.sect.lastSwitch);
    s.sect.medUntil = int0(s.sect.medUntil);
    if (!Array.isArray(s.sect.tasks)) s.sect.tasks = [];
    s.techs.owned = s.techs.owned.filter(function (x) { return typeof x === 'string'; });
    s.curios.owned = s.curios.owned.filter(function (x) { return typeof x === 'string'; });
    s.spire.floor = int0(s.spire.floor);
    s.spire.best = Math.max(int0(s.spire.best), s.spire.floor);
    s.duel.rank = U.clamp(Math.floor(num(s.duel.rank, CONFIG.duel.npcCount)), 1, CONFIG.duel.npcCount);
    if (!Array.isArray(s.duel.npcs)) s.duel.npcs = [];
    if (s.duel.npcs.length > CONFIG.duel.npcCount) s.duel.npcs = s.duel.npcs.slice(0, CONFIG.duel.npcCount);
    s.duel.wins = int0(s.duel.wins);
    s.duel.losses = int0(s.duel.losses);
    if (typeof s.duel.lastDrift !== 'string') s.duel.lastDrift = '';
    s.tide.nextAt = int0(s.tide.nextAt);

    /* ---- meta */
    if (!Array.isArray(s.mail)) s.mail = [];
    s.mail = s.mail.filter(function (m) { return m && typeof m === 'object'; });
    if (s.mail.length > CONFIG.economy.mailCap) {
      s.mail = s.mail.slice(s.mail.length - CONFIG.economy.mailCap);
    }
    s.pass.level = U.clamp(Math.floor(num(s.pass.level, 0)), 0, CONFIG.economy.passLevels);
    s.pass.points = int0(s.pass.points);
    s.quests.step = int0(s.quests.step);
    s.samsara.cycle = int0(s.samsara.cycle);
    s.samsara.marks = int0(s.samsara.marks);

    /* ---- settings */
    if (CONFIG.combat.speeds.indexOf(s.settings.speed) < 0) s.settings.speed = 1;
    s.settings.autoHunt = (s.settings.autoHunt === true);
    s.settings.reduceFx = (s.settings.reduceFx === true);
    s.settings.confirmSpend = (s.settings.confirmSpend !== false);
    if (!s.flags || typeof s.flags !== 'object') s.flags = {};
  },

  /* --------------------------------------------------------- EXPORT/IMPORT */

  /* Base64 of the save JSON. UTF-8 safe: player names can hold any character. */
  export() {
    let json = '';
    try {
      json = JSON.stringify(S || freshState());
    } catch (e) {
      console.error('[Save] export could not serialise the save', e);
      try { json = JSON.stringify(freshState()); } catch (e2) { json = '{}'; }
    }
    try {
      return Save._b64encode(json);
    } catch (e) {
      console.error('[Save] export encoding failed', e);
      return '';
    }
  },

  /* Decodes, validates, migrates and installs a pasted save string.
     Returns {ok:true} or {ok:false, err:'player facing reason'}. */
  import(str) {
    if (typeof str !== 'string') return { ok: false, err: 'Paste a save string first.' };
    const clean = str.replace(/\s+/g, '');
    if (!clean) return { ok: false, err: 'Paste a save string first.' };

    let json = '';
    try {
      json = Save._b64decode(clean);
    } catch (e) {
      return { ok: false, err: 'That does not look like an EVERDAO save.' };
    }
    if (!json) return { ok: false, err: 'That does not look like an EVERDAO save.' };

    let raw = null;
    try {
      raw = JSON.parse(json);
    } catch (e) {
      return { ok: false, err: 'The save data is damaged and cannot be read.' };
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { ok: false, err: 'The save data is damaged and cannot be read.' };
    }
    if (typeof raw.v !== 'number' || !Number.isFinite(raw.v)) {
      return { ok: false, err: 'That save has no version stamp.' };
    }
    if (!raw.player || typeof raw.player !== 'object' || Array.isArray(raw.player) ||
        typeof raw.player.name !== 'string') {
      return { ok: false, err: 'That save has no character in it.' };
    }

    let next = null;
    try {
      next = Save.migrate(raw);
    } catch (e) {
      console.error('[Save] import migration failed', e);
      return { ok: false, err: 'That save could not be upgraded to this version.' };
    }
    if (!next || typeof next !== 'object') {
      return { ok: false, err: 'That save could not be upgraded to this version.' };
    }

    S = next;
    S.lastSeen = Date.now();
    try { Save.saveNow(); } catch (e) { /* storage may be broken; S is live either way */ }
    try { Bus.emit('saveImported', {}); } catch (e) { /* ignore */ }
    try {
      if (typeof Stats !== 'undefined' && Stats) {
        if (typeof Stats.invalidate === 'function') Stats.invalidate();
        if (typeof Stats.recompute === 'function') Stats.recompute();
      }
    } catch (e) { /* ignore */ }
    return { ok: true };
  },

  /* Wipes stored progress and installs a brand new state. The caller decides
     whether to reload the page afterwards. */
  reset() {
    try { Save._del(CONFIG.saveKey); } catch (e) { /* ignore */ }
    try { Save._del(CONFIG.saveKey + '.broken'); } catch (e) { /* ignore */ }
    if (Save._timer) {
      try { clearTimeout(Save._timer); } catch (e) { /* ignore */ }
      Save._timer = 0;
    }
    S = freshState();
    S.lastSeen = Date.now();
    try { Save.saveNow(); } catch (e) { /* ignore */ }
    try { Bus.emit('saveReset', {}); } catch (e) { /* ignore */ }
    return true;
  },

  /* ----------------------------------------------------- base64 + utf-8 */

  _b64chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',

  /* String -> UTF-8 byte array. Lone surrogates become U+FFFD so the bytes are
     always valid UTF-8 and always round-trip. */
  _utf8(str) {
    try {
      if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    } catch (e) { /* fall through to the manual encoder */ }
    const out = [];
    let i = 0;
    while (i < str.length) {
      let cp = str.codePointAt(i);
      i += (cp > 0xFFFF) ? 2 : 1;
      if (cp >= 0xD800 && cp <= 0xDFFF) cp = 0xFFFD;
      if (cp < 0x80) {
        out.push(cp);
      } else if (cp < 0x800) {
        out.push(0xC0 | (cp >> 6), 0x80 | (cp & 63));
      } else if (cp < 0x10000) {
        out.push(0xE0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
      } else {
        out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 63),
                 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
      }
    }
    return out;
  },

  /* UTF-8 byte array -> string. */
  _unutf8(bytes) {
    try {
      if (typeof TextDecoder !== 'undefined') {
        const buf = (bytes instanceof Uint8Array) ? bytes : new Uint8Array(bytes);
        return new TextDecoder('utf-8').decode(buf);
      }
    } catch (e) { /* fall through to the manual decoder */ }
    let out = '';
    let i = 0;
    while (i < bytes.length) {
      const b0 = bytes[i++] & 255;
      let cp;
      if (b0 < 0x80) cp = b0;
      else if (b0 < 0xE0) cp = ((b0 & 31) << 6) | (bytes[i++] & 63);
      else if (b0 < 0xF0) cp = ((b0 & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
      else {
        cp = ((b0 & 7) << 18) | ((bytes[i++] & 63) << 12) |
             ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
      }
      if (!Number.isFinite(cp) || cp < 0 || cp > 0x10FFFF) cp = 0xFFFD;
      out += String.fromCodePoint(cp);
    }
    return out;
  },

  _b64encode(str) {
    const b = Save._utf8(str);
    const A = Save._b64chars;
    let out = '';
    for (let i = 0; i < b.length; i += 3) {
      const has1 = (i + 1) < b.length;
      const has2 = (i + 2) < b.length;
      const n = ((b[i] & 255) << 16) |
                ((has1 ? (b[i + 1] & 255) : 0) << 8) |
                (has2 ? (b[i + 2] & 255) : 0);
      out += A.charAt((n >>> 18) & 63) + A.charAt((n >>> 12) & 63) +
             (has1 ? A.charAt((n >>> 6) & 63) : '=') +
             (has2 ? A.charAt(n & 63) : '=');
    }
    return out;
  },

  _b64decode(str) {
    const A = Save._b64chars;
    if (!Save._b64map) {
      const m = Object.create(null);
      for (let i = 0; i < A.length; i++) m[A.charAt(i)] = i;
      m['-'] = 62; m['_'] = 63;             // tolerate url-safe base64
      Save._b64map = m;
    }
    const map = Save._b64map;
    const bytes = [];
    let acc = 0, bits = 0;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charAt(i);
      if (ch === '=' ) break;
      const v = map[ch];
      if (v === undefined) continue;        // skip newlines and stray padding
      acc = (acc << 6) | v;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        bytes.push((acc >> bits) & 255);
      }
    }
    return Save._unutf8(bytes);
  },
};

/* ========================================================================= */

/* Daily / weekly rollover. check() is called from every logic tick, so a tab
   left open across midnight rolls over exactly like a reload would. */
const Daily = {

  check(nowMs) {
    if (!S) return;
    let now = Number(nowMs);
    if (!Number.isFinite(now) || now <= 0) now = Date.now();
    const when = new Date(now);

    let today = '';
    let week = '';
    try { today = U.todayStr(when); } catch (e) { return; }
    try { week = U.weekStr(when); } catch (e) { week = S.lastWeekly; }

    if (today && S.lastDaily !== today) Daily.rollDay(today, now);
    if (week && S.lastWeekly !== week) Daily.rollWeek(week, now);
  },

  /* New local day: refill every daily allowance, clear the chest track and
     roll a fresh task list. Other systems listen for 'dailyReset'. */
  rollDay(today, nowMs) {
    const first = !S.lastDaily;
    S.lastDaily = today;

    if (!S.daily || typeof S.daily !== 'object') S.daily = freshState().daily;
    const d = S.daily;
    d.pillAttemptsUsed = 0;
    d.respiraCount = 0;
    d.duelTickets = Daily.duelTicketMax();
    d.spireAttempts = 0;
    d.sweepUsed = 0;
    d.sectMedUsed = 0;
    d.extractorUsed = 0;
    d.activityPoints = 0;
    d.chestsClaimed = [false, false, false];
    d.tasks = Daily.rollTasks(DATA.dailies, CONFIG.economy.dailyTaskCount);

    try {
      Bus.emit('dailyReset', { day: today, at: nowMs, first: first });
    } catch (e) { console.warn('[Daily] dailyReset listeners threw', e); }
    try { Save.save(); } catch (e) { /* ignore */ }
  },

  /* New ISO week: fresh weekly tasks and the sect clash comes back up. */
  rollWeek(week, nowMs) {
    const first = !S.lastWeekly;
    S.lastWeekly = week;

    if (!S.weekly || typeof S.weekly !== 'object') S.weekly = { tasks: [], clashDone: false };
    S.weekly.tasks = Daily.rollTasks(DATA.weeklies, CONFIG.economy.weeklyTaskCount);
    S.weekly.clashDone = false;

    try {
      Bus.emit('weeklyReset', { week: week, at: nowMs, first: first });
    } catch (e) { console.warn('[Daily] weeklyReset listeners threw', e); }
    try { Save.save(); } catch (e) { /* ignore */ }
  },

  /* Daily duel tickets available after a reset. */
  duelTicketMax() {
    const n = Math.floor(Number(CONFIG.duel.ticketsPerDay));
    return Number.isFinite(n) && n > 0 ? n : 5;
  },

  /* Picks `count` distinct entries from a task table and shapes them into the
     save format: {id, prog, need, done, claimed}. An empty or missing table
     yields an empty list — the owning module can fill it later. */
  rollTasks(table, count) {
    if (!Array.isArray(table) || table.length === 0) return [];
    let n = Math.floor(Number(count));
    if (!Number.isFinite(n) || n <= 0) n = table.length;
    if (n > table.length) n = table.length;

    const picked = U.shuffle(table).slice(0, n);
    const out = [];
    for (let i = 0; i < picked.length; i++) {
      const t = picked[i];
      if (!t || t.id === undefined || t.id === null) continue;
      let need = Math.floor(Number(t.need));
      if (!Number.isFinite(need) || need < 1) need = 1;
      out.push({ id: String(t.id), prog: 0, need: need, done: false, claimed: false });
    }
    return out;
  },

  /* Seconds until the next local midnight — for the "resets in" labels. */
  secToReset(nowMs) {
    let now = Number(nowMs);
    if (!Number.isFinite(now) || now <= 0) now = Date.now();
    const d = new Date(now);
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
    return Math.max(0, Math.floor((next.getTime() - now) / 1000));
  },

  /* Seconds until the next local Monday 00:00. */
  secToWeekReset(nowMs) {
    let now = Number(nowMs);
    if (!Number.isFinite(now) || now <= 0) now = Date.now();
    const d = new Date(now);
    const dow = (d.getDay() + 6) % 7;                     // Mon=0 .. Sun=6
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (7 - dow), 0, 0, 0, 0);
    return Math.max(0, Math.floor((next.getTime() - now) / 1000));
  },

  /* Used by Save._normalize — keeps a task array to the stored shape. */
  _cleanTasks(arr) {
    if (!Array.isArray(arr)) return [];
    const out = [];
    for (let i = 0; i < arr.length && out.length < 24; i++) {
      const t = arr[i];
      if (!t || typeof t !== 'object' || typeof t.id !== 'string') continue;
      let need = Math.floor(Number(t.need));
      if (!Number.isFinite(need) || need < 1) need = 1;
      let prog = Math.floor(Number(t.prog));
      if (!Number.isFinite(prog) || prog < 0) prog = 0;
      out.push({
        id: t.id,
        prog: prog,
        need: need,
        done: (t.done === true) || prog >= need,
        claimed: (t.claimed === true),
      });
    }
    return out;
  },
};

/* ========================================================================= */

/* Offline progress. Systems either expose `offline(cappedSec)` (CONTRACT §6,
   picked up automatically through Boot.systems) or register a standalone
   provider with Offline.provider(fn). Use ONE of the two, never both. */
const Offline = {

  _providers: [],

  /* Register fn(cappedSec) -> [{label, icon, amount}]. Returns fn. */
  provider(fn) {
    if (typeof fn !== 'function') return fn;
    if (Offline._providers.indexOf(fn) < 0) Offline._providers.push(fn);
    return fn;
  },

  /* Jade-shop offline-cap upgrades. Canonical home is S.flags.offlineUp; a
     shop that instead records purchases in S.shops.bought.jade_offline is
     honoured too (the larger of the two counts, never their sum). */
  upgrades() {
    let n = 0;
    try {
      const f = S && S.flags ? Number(S.flags.offlineUp) : 0;
      if (Number.isFinite(f) && f > n) n = f;
      const b = S && S.shops ? S.shops.bought : null;
      const g = b ? Number(b.jade_offline) : 0;
      if (Number.isFinite(g) && g > n) n = g;
    } catch (e) { n = 0; }
    return U.clamp(Math.floor(n), 0, CONFIG.offline.maxUpgrades);
  },

  /* Total offline cap in hours, including the Stats 'offlineHours' channel. */
  capHours() {
    let h = Number(CONFIG.offline.baseCapH);
    if (!Number.isFinite(h) || h < 0) h = 0;
    h += Offline.upgrades() * Number(CONFIG.offline.capPerUpgradeH || 0);
    try {
      if (typeof Stats !== 'undefined' && Stats && typeof Stats.bonus === 'function') {
        const b = Number(Stats.bonus('offlineHours'));
        if (Number.isFinite(b)) h += b;
      }
    } catch (e) { /* Stats not ready — the base cap still applies */ }
    if (!Number.isFinite(h) || h < 0) h = 0;
    if (h > 168) h = 168;                      // one week of hard ceiling
    return h;
  },

  /* How long the player was away, and how much of it counts.
     A clock rolled backwards yields 0 — never punish, never corrupt. */
  compute(nowMs) {
    let now = Number(nowMs);
    if (!Number.isFinite(now) || now <= 0) now = Date.now();

    let last = S ? Number(S.lastSeen) : 0;
    if (!Number.isFinite(last) || last <= 0) last = now;

    let ms = now - last;
    if (!(ms > 0)) ms = 0;

    const elapsedSec = Math.floor(ms / 1000);
    const capSec = Math.floor(Offline.capHours() * 3600);
    const cappedSec = Math.max(0, Math.min(elapsedSec, capSec));

    return { elapsedSec: elapsedSec, cappedSec: cappedSec, gains: [] };
  },

  /* Runs every provider for the capped absence, grants their progress and
     returns the display lines for the boot modal. Absences shorter than
     CONFIG.offline.minShowSec still grant, but return no lines so trivial
     reloads do not pop a modal. */
  apply(nowMs) {
    if (!S) return [];
    const info = Offline.compute(nowMs);
    if (info.cappedSec <= 0) return [];

    const raw = [];

    /* systems that implement CONTRACT §6 offline(elapsedSec) */
    try {
      if (typeof Boot !== 'undefined' && Boot && Array.isArray(Boot.systems)) {
        for (let i = 0; i < Boot.systems.length; i++) {
          const entry = Boot.systems[i];
          const sys = entry && entry.sys;
          if (!sys || typeof sys.offline !== 'function') continue;
          try {
            const r = sys.offline(info.cappedSec, info);
            if (Array.isArray(r)) for (let j = 0; j < r.length; j++) raw.push(r[j]);
          } catch (e) {
            console.error('[Offline] ' + (entry.name || '?') + '.offline failed:', e);
          }
        }
      }
    } catch (e) { console.error('[Offline] system sweep failed', e); }

    /* standalone providers */
    const list = Offline._providers.slice();
    for (let i = 0; i < list.length; i++) {
      try {
        const r = list[i](info.cappedSec, info);
        if (Array.isArray(r)) for (let j = 0; j < r.length; j++) raw.push(r[j]);
      } catch (e) {
        console.error('[Offline] provider failed:', e);
      }
    }

    if (info.elapsedSec < Number(CONFIG.offline.minShowSec || 0)) return [];

    const lines = [];
    for (let i = 0; i < raw.length && lines.length < 24; i++) {
      const l = Offline._line(raw[i]);
      if (l) lines.push(l);
    }
    return lines;
  },

  /* Normalises one provider row into {label, icon, amount} of plain strings.
     Numbers go through Fmt so nothing renders raw, and the text is escaped
     because boot drops these straight into the modal's innerHTML. */
  _line(row) {
    if (!row || typeof row !== 'object') return null;
    const label = Offline._esc(row.label);
    if (!label) return null;

    let amount = row.amount;
    if (typeof amount === 'number') {
      amount = (amount >= 0 ? '+' : '') + Fmt.n(amount);
    } else if (amount === null || amount === undefined) {
      amount = '';
    } else {
      amount = String(amount);
    }

    return {
      label: label,
      icon: Offline._esc(row.icon),
      amount: Offline._esc(amount),
    };
  },

  _esc(v) {
    if (v === null || v === undefined) return '';
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },
};

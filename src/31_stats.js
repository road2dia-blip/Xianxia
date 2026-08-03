/* ---------------------------------------------------------------------------
 * Stats / Econ — the two shared services every other system leans on.
 *
 * CONTRACT §7. Two top-level bindings only: `Stats` and `Econ`.
 * Every helper lives as a property so the shared IIFE scope stays clean.
 *
 * FORMULAS (Stats) — CONFIG paths abbreviated: cu = CONFIG.cultivation,
 *                    cb = CONFIG.combat, path = CONFIG.paths[S.player.path]
 *   baseFor(r,p)[k] = CONFIG.baseStats[k] * cu.realmStatMult^r
 *                     * (1 + cu.phaseStatBonus * (p - 1))
 *   stat[k]         = baseFor(r,p)[k] * path[k] * (1 + acc.allStat + acc[k])
 *                     + flat[k]                        (path[k] missing => 1)
 *   flat[k]         = S.player.permStats[k] + sum(Forge.itemStats(equipped)[k])
 *                     + acc.flat[k]                    (non-gear flat sources)
 *   crit            = clamp(cb.baseCrit    + acc.crit,      0, 1)
 *   critDmg         = max(1, cb.baseCritDmg + acc.critDmg)
 *   hit             = clamp(cb.baseHit     + acc.hit, cb.hitFloor, cb.hitCeil)
 *   dodge           = clamp(cb.baseDodge   + acc.dodge,     0, 0.75)
 *   lifesteal       = clamp(path.lifesteal + acc.lifesteal, 0, 1)
 *   BR(block)       = hp*0.08 + (patk+matk)*4 + (pdef+mdef)*3 + spd*6
 *                     (weights read from CONFIG.brWeights)
 *   auraPerSec()    = cu.aura.base * cu.aura.growth^realm
 *                     * (1 + bonus('aura')) * tempAuraMult()
 *   thrallScale()   = CONFIG.paths.ghost.thrallScale * (1 + acc.thrall)
 *
 * CACHE MODEL — Stats.b holds the bonus accumulator, Stats.p the final block.
 *   invalidate() only flips a flag; bonus()/block()/br() lazily rebuild, and
 *   recompute() builds the accumulator exactly once. tempAuraMult() sits OUTSIDE
 *   the cache because it tracks the wall clock (sect meditation windows).
 *
 * FORMULAS (Econ) — every write is next = floor(clamp(have + delta, 0, MAX))
 *   through one funnel (Econ._add). Nothing else touches S.cur / S.mats.
 * ------------------------------------------------------------------------ */

const Stats = {

  /* ------------------------------------------------------------- caches --- */
  /* Final stat block. Null until the first recompute(); read it through
     Stats.block() if you cannot be sure boot has run. */
  p: null,
  /* Cached bonus accumulator. */
  b: null,
  _dirty: true,
  _inited: false,

  /* Registered bonus contributors: fn(acc) mutates the accumulator. */
  providers: [],

  /* Temporary, uncached aura multiplier hook. Other modules SET this — either a
     number or a zero-arg function returning a number. Sect meditation does:
       Stats.tempAura = () => Date.now() < S.sect.medUntil
                              ? CONFIG.sect.meditationMult : 1;
     It is deliberately outside the accumulator cache because it changes with the
     wall clock and would otherwise need invalidating every tick. */
  tempAura: null,

  STAT_KEYS: ['hp', 'mp', 'patk', 'matk', 'pdef', 'mdef', 'spd'],

  /* --------------------------------------------------------------- init --- */
  /* Called once by Boot BEFORE every system's own init(), so a provider a
     system registers later simply appends to the list. */
  init() {
    if (Stats._inited) return;
    Stats._inited = true;

    Stats.provider(Stats._gearProvider);

    const evts = [
      'phaseUp', 'breakthrough', 'techUnlock', 'abodeUpgrade',
      'sectJoin', 'sectMeditate', 'curioGain', 'lawChosen', 'lawUpgrade',
      'gearCrafted', 'gearEnhanced', 'gearSalvaged', 'pillUsed',
      'shopBuy', 'clashDone', 'samsara',
      'statsDirty',          // generic escape hatch for anything not listed
    ];
    for (let i = 0; i < evts.length; i++) {
      Bus.on(evts[i], function statsOnChange() { Stats.invalidate(); });
    }

    Stats.invalidate();
  },

  /* Register a bonus contributor. Duplicate function references are ignored, so
     registering twice is harmless. Returns an unregister function. */
  provider(fn) {
    if (typeof fn !== 'function') {
      console.warn('[Stats.provider] ignored non-function provider');
      return function statsNoUnreg() {};
    }
    if (Stats.providers.indexOf(fn) < 0) {
      Stats.providers.push(fn);
      Stats.invalidate();
    }
    return function statsUnreg() {
      const i = Stats.providers.indexOf(fn);
      if (i >= 0) { Stats.providers.splice(i, 1); Stats.invalidate(); }
    };
  },

  /* Mark the cache stale. Cheap — no work happens until something is read. */
  invalidate() { Stats._dirty = true; },

  /* Gear fallback. Forge is documented as owning `Forge.equippedBonus(acc)`;
     if Forge registered that exact function itself we stand down so gear is
     never counted twice. */
  _gearProvider(acc) {
    if (typeof Forge === 'undefined' || !Forge) return;
    if (typeof Forge.equippedBonus !== 'function') return;
    const list = Stats.providers;
    for (let i = 0; i < list.length; i++) {
      if (list[i] === Forge.equippedBonus) return;
    }
    Forge.equippedBonus(acc);
  },

  /* ---------------------------------------------------------- accumulator -- */
  /* A fresh accumulator with every CONTRACT §7 key at 0, run through every
     provider. A throwing provider is warned about and skipped. */
  bonusAcc() {
    const acc = {
      /* --- economy / pacing multipliers --- */
      aura: 0, respiraExp: 0, pillExp: 0, pillAttempts: 0, btChance: 0,
      expedition: 0, alchemyQuality: 0, forgeQuality: 0, curioPower: 0,
      lawProc: 0, offlineHours: 0,
      /* --- stat percentages --- */
      allStat: 0, hp: 0, patk: 0, matk: 0, pdef: 0, mdef: 0, spd: 0,
      /* --- combat percentages --- */
      crit: 0, critDmg: 0, lifesteal: 0, dodge: 0, shield: 0, thrall: 0,
      /* --- extensions beyond the contract list (safe supersets) --- */
      mp: 0,            // percentage, mirrors the other stat keys
      hit: 0,           // additive hit chance, clamped to hitFloor..hitCeil
      flat: {           // NON-GEAR flat stat points (samsara tree, titles, ...)
        hp: 0, mp: 0, patk: 0, matk: 0, pdef: 0, mdef: 0, spd: 0,
      },
    };

    const list = Stats.providers;
    for (let i = 0; i < list.length; i++) {
      const fn = list[i];
      if (typeof fn !== 'function') continue;
      try {
        fn(acc);
      } catch (e) {
        console.warn('[Stats] bonus provider threw; skipped', e);
      }
    }

    /* Sanitise: a provider that wrote NaN/undefined must not poison the block. */
    for (const k in acc) {
      if (k === 'flat') continue;
      const v = Number(acc[k]);
      acc[k] = Number.isFinite(v) ? v : 0;
    }
    if (!acc.flat || typeof acc.flat !== 'object') {
      acc.flat = { hp: 0, mp: 0, patk: 0, matk: 0, pdef: 0, mdef: 0, spd: 0 };
    }
    for (let i = 0; i < Stats.STAT_KEYS.length; i++) {
      const k = Stats.STAT_KEYS[i];
      const v = Number(acc.flat[k]);
      acc.flat[k] = Number.isFinite(v) ? v : 0;
    }
    acc.pillAttempts = Math.floor(acc.pillAttempts);
    acc.offlineHours = Math.floor(acc.offlineHours);
    return acc;
  },

  /* Aggregated bonus for one key. Recomputes only if the cache is stale. */
  bonus(key) {
    if (Stats._dirty || !Stats.b) Stats.recompute();
    const v = Stats.b ? Stats.b[key] : 0;
    return (typeof v === 'number' && Number.isFinite(v)) ? v : 0;
  },

  /* ----------------------------------------------------------- recompute -- */
  /* Rebuild Stats.b and Stats.p. One accumulator build per call. */
  recompute() {
    const acc = Stats.bonusAcc();
    Stats.b = acc;
    Stats.p = Stats._compute(acc);
    Stats._dirty = false;
    return Stats.p;
  },

  /* The final stat block, recomputing if stale. Always returns an object. */
  block() {
    if (Stats._dirty || !Stats.p) Stats.recompute();
    return Stats.p;
  },

  /* --------------------------------------------------------- base stats --- */
  /* Realm/phase scaling only — the path multiplier is applied afterwards. */
  baseFor(realm, phase) {
    const c = CONFIG.cultivation;
    let r = Math.floor(Number(realm));
    if (!Number.isFinite(r) || r < 0) r = 0;
    if (r > c.maxRealm) r = c.maxRealm;
    let ph = Math.floor(Number(phase));
    if (!Number.isFinite(ph) || ph < 1) ph = 1;
    if (ph > c.phasesPerRealm) ph = c.phasesPerRealm;

    const realmMult = Math.pow(c.realmStatMult, r);
    const phaseMult = 1 + c.phaseStatBonus * (ph - 1);

    const out = {};
    for (let i = 0; i < Stats.STAT_KEYS.length; i++) {
      const k = Stats.STAT_KEYS[i];
      const b = Number(CONFIG.baseStats[k]);
      out[k] = (Number.isFinite(b) ? b : 0) * realmMult * phaseMult;
    }
    return out;
  },

  /* CONFIG.paths entry for a path id, falling back to Body. */
  pathCfg(path) {
    const paths = CONFIG.paths || {};
    return paths[path] || paths.body || {};
  },

  pathEmoji(path) {
    if (path === 'spell') return '🌟';
    if (path === 'sword') return '⚔️';
    if (path === 'ghost') return '👻';
    return '👊';
  },

  pathName(path) {
    if (path === 'spell') return 'Spell Path';
    if (path === 'sword') return 'Sword Path';
    if (path === 'ghost') return 'Ghost Path';
    return 'Body Path';
  },

  /* Guarded read of S.player — old saves and the pre-load window have gaps. */
  _player() {
    const pl = (typeof S !== 'undefined' && S && S.player) ? S.player : null;
    const paths = CONFIG.paths || {};
    const path = (pl && typeof pl.path === 'string' && paths[pl.path]) ? pl.path : 'body';
    let realm = pl ? Math.floor(Number(pl.realm)) : 0;
    if (!Number.isFinite(realm) || realm < 0) realm = 0;
    if (realm > CONFIG.cultivation.maxRealm) realm = CONFIG.cultivation.maxRealm;
    let phase = pl ? Math.floor(Number(pl.phase)) : 1;
    if (!Number.isFinite(phase) || phase < 1) phase = 1;
    if (phase > CONFIG.cultivation.phasesPerRealm) phase = CONFIG.cultivation.phasesPerRealm;
    let lawLevel = pl ? Math.floor(Number(pl.lawLevel)) : 0;
    if (!Number.isFinite(lawLevel) || lawLevel < 0) lawLevel = 0;
    return {
      name: (pl && typeof pl.name === 'string' && pl.name) ? pl.name : 'Wanderer',
      path,
      realm,
      phase,
      law: (pl && typeof pl.law === 'string' && pl.law) ? pl.law : null,
      lawLevel,
    };
  },

  /* Flat stat points: permanent pill gains + equipped gear + provider flats. */
  _flats(acc) {
    const f = { hp: 0, mp: 0, patk: 0, matk: 0, pdef: 0, mdef: 0, spd: 0 };

    const perm = (typeof S !== 'undefined' && S && S.player && S.player.permStats)
      ? S.player.permStats : null;
    if (perm && typeof perm === 'object') {
      for (let i = 0; i < Stats.STAT_KEYS.length; i++) {
        const k = Stats.STAT_KEYS[i];
        const v = Number(perm[k]);
        if (Number.isFinite(v) && v > 0) f[k] += v;
      }
    }

    if (acc && acc.flat) {
      for (let i = 0; i < Stats.STAT_KEYS.length; i++) {
        const k = Stats.STAT_KEYS[i];
        const v = Number(acc.flat[k]);
        if (Number.isFinite(v)) f[k] += v;
      }
    }

    Stats._gearFlats(f);
    return f;
  },

  /* Sum the flat portion of every equipped item via Forge.itemStats(). Only the
     seven stat keys are read; percentage affixes arrive through the accumulator
     (Forge.equippedBonus) and must not be double-counted here. */
  _gearFlats(f) {
    if (typeof Forge === 'undefined' || !Forge) return;
    if (typeof Forge.itemStats !== 'function') return;
    if (typeof S === 'undefined' || !S) return;

    const eq = S.equipped;
    if (!eq || typeof eq !== 'object') return;
    const gear = (S.inv && Array.isArray(S.inv.gear)) ? S.inv.gear : null;
    if (!gear || !gear.length) return;

    const slots = ['weapon', 'armor', 'pendant', 'relicA', 'relicB', 'relicC'];
    const want = Object.create(null);
    let n = 0;
    for (let i = 0; i < slots.length; i++) {
      const uid = eq[slots[i]];
      if (uid === null || uid === undefined || uid === '') continue;
      want[String(uid)] = false;
      n++;
    }
    if (!n) return;

    for (let i = 0; i < gear.length; i++) {
      const it = gear[i];
      if (!it || it.uid === null || it.uid === undefined) continue;
      const key = String(it.uid);
      if (want[key] !== false) continue;      // not wanted, or already resolved
      want[key] = true;

      let st = null;
      try { st = Forge.itemStats(it); } catch (e) { st = null; }
      if (!st || typeof st !== 'object') continue;
      for (let j = 0; j < Stats.STAT_KEYS.length; j++) {
        const k = Stats.STAT_KEYS[j];
        const v = Number(st[k]);
        if (Number.isFinite(v)) f[k] += v;
      }
    }
  },

  /* The whole stat pass. */
  _compute(acc) {
    const pl = Stats._player();
    const base = Stats.baseFor(pl.realm, pl.phase);
    const path = Stats.pathCfg(pl.path);
    const flats = Stats._flats(acc);
    const all = Number(acc.allStat) || 0;
    const cb = CONFIG.combat;

    const out = {};
    for (let i = 0; i < Stats.STAT_KEYS.length; i++) {
      const k = Stats.STAT_KEYS[i];
      let pm = Number(path[k]);
      if (!Number.isFinite(pm) || pm <= 0) pm = 1;
      const per = Number(acc[k]) || 0;
      let pctMult = 1 + all + per;
      if (!Number.isFinite(pctMult) || pctMult < 0) pctMult = 0;
      let v = base[k] * pm * pctMult + (Number(flats[k]) || 0);
      if (!Number.isFinite(v) || v < 0) v = 0;
      out[k] = Math.round(v);
    }
    if (out.hp < 1) out.hp = 1;
    if (out.mp < 0) out.mp = 0;
    if (out.patk < 1) out.patk = 1;
    if (out.matk < 1) out.matk = 1;
    if (out.pdef < 0) out.pdef = 0;
    if (out.mdef < 0) out.mdef = 0;
    if (out.spd < 1) out.spd = 1;

    out.crit = U.clamp(cb.baseCrit + acc.crit, 0, 1);
    out.critDmg = Math.max(1, cb.baseCritDmg + acc.critDmg);
    out.hit = U.clamp(cb.baseHit + acc.hit, cb.hitFloor, cb.hitCeil);
    out.dodge = U.clamp(cb.baseDodge + acc.dodge, 0, 0.75);
    out.lifesteal = U.clamp((Number(path.lifesteal) || 0) + acc.lifesteal, 0, 1);
    /* Opening shield as a fraction of max HP (Spell path multiplies it). */
    out.shield = Math.max(0, Number(acc.shield) || 0);
    return out;
  },

  /* ------------------------------------------------------------------ BR --- */
  /* Works on Stats.p or on any unit-like block (duel snapshots, NPCs, thralls). */
  br(block) {
    const b = block || Stats.block();
    if (!b || typeof b !== 'object') return 0;
    const w = CONFIG.brWeights || { hp: 0.08, atk: 4, def: 3, spd: 6 };
    const hp = Number(b.maxHp !== undefined ? b.maxHp : b.hp) || 0;
    const patk = Number(b.patk) || 0;
    const matk = Number(b.matk) || 0;
    const pdef = Number(b.pdef) || 0;
    const mdef = Number(b.mdef) || 0;
    const spd = Number(b.spd) || 0;
    const v = hp * (Number(w.hp) || 0)
            + (patk + matk) * (Number(w.atk) || 0)
            + (pdef + mdef) * (Number(w.def) || 0)
            + spd * (Number(w.spd) || 0);
    return (Number.isFinite(v) && v > 0) ? v : 0;
  },

  /* --------------------------------------------------------------- units --- */
  /* Path signature skills. Mountain Fist / Starfall / Thousand Cuts / the Ghost
     path's Hungry Ghost Wail — all driven off CONFIG.paths. */
  pathSkill(path) {
    const c = Stats.pathCfg(path);
    if (path === 'spell') {
      return {
        id: 'sk_starfall', name: 'Starfall',
        cd: Number(c.skillCd) || 2, mult: Number(c.skillMult) || 1.35,
        kind: 'magic', target: 'all',
      };
    }
    if (path === 'sword') {
      return {
        id: 'sk_thousand_cuts', name: 'Thousand Cuts',
        cd: Number(c.skillCd) || 3, mult: Number(c.skillMult) || 0.75,
        kind: 'phys', target: 'one',
        hits: Math.max(1, Math.floor(Number(c.skillHits) || 3)),
        bleedChance: Number(c.bleedChance) || 0,
      };
    }
    if (path === 'ghost') {
      return {
        id: 'sk_ghost_wail', name: 'Hungry Ghost Wail',
        cd: Number(c.skillCd) || 3, mult: Number(c.skillMult) || 1.9,
        kind: 'magic', target: 'one',
      };
    }
    return {
      id: 'sk_mountain_fist', name: 'Mountain Fist',
      cd: Number(c.skillCd) || 3, mult: Number(c.skillMult) || 2.6,
      kind: 'phys', target: 'one',
    };
  },

  /* Ghost thrall strength as a fraction of the player's block. */
  thrallScale() {
    const g = (CONFIG.paths && CONFIG.paths.ghost) || {};
    const base = Number(g.thrallScale);
    const s = (Number.isFinite(base) ? base : 0.4) * (1 + Stats.bonus('thrall'));
    return (Number.isFinite(s) && s > 0) ? s : 0;
  },

  /* A CONTRACT §8 unit for the player. Runtime fields (shield/buffs/cdLeft/...)
     are deliberately NOT set — the combat engine owns those. */
  unit() {
    const p = Stats.block();
    const pl = Stats._player();
    const path = Stats.pathCfg(pl.path);
    const acc = Stats.b || Stats.bonusAcc();
    const surgeRealm = Number(path.surgeRealm);

    return {
      name: pl.name,
      emoji: Stats.pathEmoji(pl.path),
      side: 'ally',
      element: pl.law,
      path: pl.path,

      hp: p.hp, maxHp: p.hp,
      mp: p.mp, maxMp: p.mp,
      patk: p.patk, matk: p.matk,
      pdef: p.pdef, mdef: p.mdef,
      spd: p.spd,

      crit: p.crit, critDmg: p.critDmg, hit: p.hit,
      dodge: p.dodge, lifesteal: p.lifesteal,

      skill: Stats.pathSkill(pl.path),
      isPlayer: true,
      isThrall: false,

      /* --- path passives the engine reads --- */
      shieldPct: Math.max(0, Number(acc.shield) || 0),
      wardMult: Number(path.wardMult) || 1,
      doubleChance: Number(path.doubleChance) || 0,
      bleedChance: Number(path.bleedChance) || 0,
      thrallScale: pl.path === 'ghost' ? Stats.thrallScale() : 0,
      thrallTaunt: pl.path === 'ghost' ? (Number(path.thrallTaunt) || 0) : 0,

      /* Body path Blood Surge unlocks at CONFIG.paths.body.surgeRealm. */
      surge: Number.isFinite(surgeRealm) && pl.realm >= surgeRealm,
      surgeRealm: Number.isFinite(surgeRealm) ? surgeRealm : 0,
      surgeMpPct: Number(path.surgeMpPct) || 0,
      surgeDmgBonus: Number(path.surgeDmgBonus) || 0,

      /* Law data; Combat still takes the actual proc rate via opts.lawProc. */
      lawLevel: pl.lawLevel,
      lawProcBonus: Number(acc.lawProc) || 0,
    };
  },

  /* The Ghost path thrall. Returns null for every other path. Its HP is its own
     pool — scaled from the player's max HP, not shared with it. */
  thrallUnit() {
    const pl = Stats._player();
    if (pl.path !== 'ghost') return null;
    const p = Stats.block();
    const path = Stats.pathCfg('ghost');
    const s = Stats.thrallScale();
    const scale = (v) => Math.max(1, Math.round((Number(v) || 0) * s));

    return {
      name: pl.name + '’s Shade',
      emoji: '💀',
      side: 'ally',
      element: pl.law,
      path: 'ghost',

      hp: scale(p.hp), maxHp: scale(p.hp),
      mp: Math.max(0, Math.round(p.mp * s)), maxMp: Math.max(0, Math.round(p.mp * s)),
      patk: scale(p.patk), matk: scale(p.matk),
      pdef: scale(p.pdef), mdef: scale(p.mdef),
      spd: Math.max(1, Math.round(p.spd)),        // the shade keeps its master's pace

      crit: p.crit, critDmg: p.critDmg, hit: p.hit,
      dodge: p.dodge, lifesteal: 0,

      skill: null,
      isPlayer: false,
      isThrall: true,

      shieldPct: 0,
      wardMult: 1,
      doubleChance: 0,
      bleedChance: 0,
      taunt: Number(path.thrallTaunt) || 0,
    };
  },

  /* ---------------------------------------------------------------- aura --- */
  /* Passive cultivation EXP per second. Cultivation.auraPerSec() delegates here. */
  auraPerSec() {
    const a = (CONFIG.cultivation && CONFIG.cultivation.aura) || {};
    const pl = Stats._player();
    const base = (Number(a.base) || 0) * Math.pow(Number(a.growth) || 1, pl.realm);
    const v = base * (1 + Stats.bonus('aura')) * Stats.tempAuraMult();
    return (Number.isFinite(v) && v > 0) ? v : 0;
  },

  /* Resolve the Stats.tempAura hook to a positive multiplier (1 when unset). */
  tempAuraMult() {
    let m = Stats.tempAura;
    if (typeof m === 'function') {
      try { m = m(); } catch (e) { m = 1; }
    }
    m = Number(m);
    if (!Number.isFinite(m) || m <= 0) return 1;
    return m;
  },

  /* ------------------------------------------------------- permanent gains -- */
  /* Convert a percentage (Vital Powder / Mind Elixir style, e.g.
     CONFIG.alchemy.vitalHpPct) into FLAT permanent stat points measured against
     the player's current base*path stat, add them to S.player.permStats, and
     invalidate. Returns the points added. This is the intended way to write
     permStats — the block treats those values as flat points, never as
     percentages. */
  addPerm(key, pct) {
    if (Stats.STAT_KEYS.indexOf(key) < 0) {
      console.warn('[Stats.addPerm] unknown stat key:', key);
      return 0;
    }
    if (typeof S === 'undefined' || !S || !S.player) return 0;
    if (!S.player.permStats || typeof S.player.permStats !== 'object') {
      S.player.permStats = { hp: 0, mp: 0, patk: 0, matk: 0, pdef: 0, mdef: 0, spd: 0 };
    }
    const pl = Stats._player();
    const base = Stats.baseFor(pl.realm, pl.phase);
    let pm = Number(Stats.pathCfg(pl.path)[key]);
    if (!Number.isFinite(pm) || pm <= 0) pm = 1;
    const frac = Number(pct);
    if (!Number.isFinite(frac) || frac <= 0) return 0;

    const add = Math.max(1, Math.round(base[key] * pm * frac));
    const had = Number(S.player.permStats[key]);
    S.player.permStats[key] = Math.max(0, Math.floor((Number.isFinite(had) ? had : 0) + add));
    Stats.invalidate();
    return add;
  },
};


/* ===========================================================================
 * Econ — the only writer of S.cur and S.mats.
 *
 * KINDS
 *   plain     'stone' 'jade' 'tech' 'guide' 'citrine' 'contribution'
 *             'stones' 'dust' 'insight' 'lawShard'
 *   tiered    'herb:2' 'core:5' 'forge:1' 'seed:3'      (tier is 1-based, 1..6)
 *   single    'fruit'
 *
 * ---------------------------------------------------------------------------
 * ECONOMY AUDIT (spec §17). Every currency gets at least one steady faucet and
 * at least one sink that is still hungry in the late game:
 *
 *  stone        F: hunts, expedition claims, farm room (220/h base), salvage.
 *               S: abode upgrades 500*2^lvl to L30, alchemy 150*4.5^(rank-1),
 *                  enhancement 25*1.38^lvl to +15, market restocks.
 *  jade         F: daily chests, spire first clears (6 / 25 boss), tide (40),
 *                  duel tier payouts, achievements, pass levels.
 *               S: jade-shop permanents (offline cap +2h x3, alchemy queue x2,
 *                  respira cap x2), then black-market flash stock forever.
 *  tech         F: every respira (2-5, x4 on surge); extractor 12 per fruit.
 *               S: 96 technique nodes at 40*rank^2.05 — rank-16 ~1.4e4 each.
 *  guide        F: daily + weekly tasks, quest chain, sect library.
 *               S: every 'effect' tech node, 1 + 0.5*rank guides (9 at rank 16).
 *  citrine      F: spire floor clears and the daily sweep.
 *               S: citrine shop — relic blueprints, refine stones, r6 scrolls.
 *  contribution F: 5 sect dailies + the weekly clash.
 *               S: sect library; top ranks stock law shards and r6 blueprints.
 *  stones       F: gear salvage (4..120 by rarity) + hunt drops.
 *               S: +15 enhancement and 5-star refinement across six slots —
 *                  the deepest sink in the game and it never closes.
 *  dust         F: gear salvage (1..40 by rarity), every day.
 *               S: affix rerolls at 60 dust a pull, per slot, forever.
 *  insight      F: respira surges and failed breakthroughs (insightPerFail).
 *               S: Respira Levels 3*1.6^lvl to L50 — the tail costs a realm.
 *  lawShard     F: spirit-era zones, spire bosses, tide, past law.unlockRealm.
 *               S: law levels 1..20 at 6*1.35^lvl (~2.4e3 shards all-in).
 *  herb:1..6    F: garden harvests + expeditions, per tier.
 *               S: every pill formula of that rank (~4.5x cost per rank).
 *  core:1..6    F: hunt and boss drops in the matching zone tier.
 *               S: pill formulas and the breakthrough pills loaded pre-trib.
 *  forge:1..6   F: expedition hauls + salvage returns.
 *               S: gear crafting and rank-6 relic fusion.
 *  seed:1..6    F: fortuity events and hunt drops.
 *               S: planting consumes the seed; the 6-plot garden runs all day.
 *  fruit        F: garden harvests.
 *               S: extractor (1/day, 12 tech per fruit) and tea-room brews.
 * ======================================================================== */

const Econ = {

  /* 2^53-1: currency is stored as an integer and must never lose precision. */
  MAX: 9007199254740991,
  MAT_TIERS: 6,

  CUR_KINDS: ['stone', 'jade', 'tech', 'guide', 'citrine', 'contribution',
              'stones', 'dust', 'insight', 'lawShard'],
  MAT_KINDS: ['herb', 'core', 'forge', 'seed'],

  LABELS: {
    stone: 'Spiritstone',
    jade: 'Fate Jade',
    tech: 'Tech Point',
    guide: 'Tech Guide',
    citrine: 'Citrine',
    contribution: 'Contribution',
    stones: 'Forge Stone',
    dust: 'Soul Dust',
    insight: 'Insight Shard',
    lawShard: 'Law Shard',
  },
  ICONS: {
    stone: '🪙', jade: '💎', tech: '🧠', guide: '📖', citrine: '🟡',
    contribution: '🏮', stones: '🪨', dust: '🌫️', insight: '💡', lawShard: '🔮',
  },
  MAT_LABELS: { herb: 'Spirit Herb', core: 'Beast Core', forge: 'Forge Ore', seed: 'Spirit Seed' },
  MAT_ICONS: { herb: '🌿', core: '💠', forge: '🔩', seed: '🌱' },

  /* Scratch object used when no save is loaded, so nothing throws pre-boot. */
  _noSave: { stone: 0, jade: 0, tech: 0, guide: 0, citrine: 0, contribution: 0,
             stones: 0, dust: 0, insight: 0, lawShard: 0 },

  /* --------------------------------------------------------------- parse --- */
  /* 'herb:3' -> {type:'mat', key:'herb', tier:3}. null for anything unknown. */
  parse(kind) {
    if (typeof kind !== 'string') return null;
    const k = kind.trim();
    if (!k) return null;
    if (k === 'fruit') return { type: 'fruit', key: 'fruit', tier: 0 };
    const i = k.indexOf(':');
    if (i > 0) {
      const type = k.slice(0, i);
      if (Econ.MAT_KINDS.indexOf(type) < 0) return null;
      const tier = Math.floor(Number(k.slice(i + 1)));
      if (!Number.isFinite(tier) || tier < 1 || tier > Econ.MAT_TIERS) return null;
      return { type: 'mat', key: type, tier };
    }
    if (Econ.CUR_KINDS.indexOf(k) >= 0) return { type: 'cur', key: k, tier: 0 };
    return null;
  },

  /* ----------------------------------------------------- guarded accessors -- */
  _cur() {
    if (typeof S === 'undefined' || !S || typeof S !== 'object') return Econ._noSave;
    if (!S.cur || typeof S.cur !== 'object') {
      S.cur = { stone: 0, jade: 0, tech: 0, guide: 0, citrine: 0, contribution: 0,
                stones: 0, dust: 0, insight: 0, lawShard: 0 };
    }
    for (let i = 0; i < Econ.CUR_KINDS.length; i++) {
      const k = Econ.CUR_KINDS[i];
      const v = Number(S.cur[k]);
      if (!Number.isFinite(v) || v < 0) S.cur[k] = 0;
    }
    return S.cur;
  },

  _mats() {
    if (typeof S === 'undefined' || !S || typeof S !== 'object') return { fruit: 0 };
    if (!S.mats || typeof S.mats !== 'object') {
      S.mats = { herb: [0, 0, 0, 0, 0, 0], core: [0, 0, 0, 0, 0, 0],
                 forge: [0, 0, 0, 0, 0, 0], seed: [0, 0, 0, 0, 0, 0], fruit: 0 };
    }
    const fr = Number(S.mats.fruit);
    if (!Number.isFinite(fr) || fr < 0) S.mats.fruit = 0;
    return S.mats;
  },

  _matArr(key) {
    const m = Econ._mats();
    let a = m[key];
    if (!Array.isArray(a)) { a = [0, 0, 0, 0, 0, 0]; m[key] = a; }
    while (a.length < Econ.MAT_TIERS) a.push(0);
    return a;
  },

  /* Positive integer amount, or 0. */
  _amt(n) {
    const x = Math.floor(Number(n));
    return (Number.isFinite(x) && x > 0) ? x : 0;
  },

  /* -------------------------------------------------------------- reading -- */
  have(kind) {
    const p = Econ.parse(kind);
    if (!p) { console.warn('[Econ.have] unknown kind:', kind); return 0; }
    let v = 0;
    if (p.type === 'cur') v = Number(Econ._cur()[p.key]);
    else if (p.type === 'fruit') v = Number(Econ._mats().fruit);
    else v = Number(Econ._matArr(p.key)[p.tier - 1]);
    v = Math.floor(v);
    return (Number.isFinite(v) && v > 0) ? v : 0;
  },

  /* can('stone', 500) or can({stone:500, 'herb:2':3}). */
  can(kind, n) {
    if (kind && typeof kind === 'object') {
      for (const k in kind) {
        if (!Object.prototype.hasOwnProperty.call(kind, k)) continue;
        if (!Econ.can(k, kind[k])) return false;
      }
      return true;
    }
    const need = Econ._amt(n);
    if (need <= 0) return true;
    if (!Econ.parse(kind)) { console.warn('[Econ.can] unknown kind:', kind); return false; }
    return Econ.have(kind) >= need;
  },

  /* -------------------------------------------------------------- writing -- */
  /* The single write funnel. Clamps to [0, MAX], floors, warns on underflow. */
  _add(kind, delta) {
    const p = Econ.parse(kind);
    if (!p) { console.warn('[Econ] refusing to write unknown kind:', kind); return 0; }
    const cur = Econ.have(kind);
    let d = Math.floor(Number(delta));
    if (!Number.isFinite(d)) d = 0;

    let next = cur + d;
    if (next < 0) {
      console.warn('[Econ] "' + kind + '" would go negative (' + cur + ' + ' + d +
                   '); clamped to 0. This is a bug in the caller.');
      next = 0;
    }
    if (next > Econ.MAX) next = Econ.MAX;
    next = Math.floor(next);

    if (p.type === 'cur') Econ._cur()[p.key] = next;
    else if (p.type === 'fruit') Econ._mats().fruit = next;
    else Econ._matArr(p.key)[p.tier - 1] = next;
    return next - cur;
  },

  /* Atomic. Object form spends nothing unless every line is affordable.
     Spending 0 (or a missing amount) is a successful no-op. */
  spend(kind, n) {
    if (kind && typeof kind === 'object') {
      const cost = kind;
      const lines = [];
      for (const k in cost) {
        if (!Object.prototype.hasOwnProperty.call(cost, k)) continue;
        const raw = Number(cost[k]);
        if (Number.isFinite(raw) && raw < 0) {
          console.warn('[Econ.spend] negative cost ignored:', k, raw);
          continue;
        }
        const amt = Econ._amt(cost[k]);
        if (amt <= 0) continue;
        if (!Econ.parse(k)) { console.warn('[Econ.spend] unknown kind:', k); return false; }
        lines.push({ kind: k, amt });
      }
      for (let i = 0; i < lines.length; i++) {
        if (Econ.have(lines[i].kind) < lines[i].amt) return false;
      }
      for (let i = 0; i < lines.length; i++) {
        Econ._add(lines[i].kind, -lines[i].amt);
      }
      return true;
    }

    if (!Econ.parse(kind)) { console.warn('[Econ.spend] unknown kind:', kind); return false; }
    const raw = Number(n);
    if (Number.isFinite(raw) && raw < 0) {
      console.warn('[Econ.spend] negative amount ignored:', kind, raw);
      return true;
    }
    const amt = Econ._amt(n);
    if (amt <= 0) return true;
    if (Econ.have(kind) < amt) return false;
    Econ._add(kind, -amt);
    return true;
  },

  /* Add currency. Never negative — use spend() to remove. Returns the amount
     actually added (0 when clamped out). Emits no Bus events. */
  grant(kind, n) {
    const p = Econ.parse(kind);
    if (!p) { console.warn('[Econ.grant] unknown kind:', kind); return 0; }
    const raw = Number(n);
    if (Number.isFinite(raw) && raw < 0) {
      console.warn('[Econ.grant] negative grant ignored:', kind, raw);
      return 0;
    }
    const amt = Econ._amt(n);
    if (amt <= 0) return 0;

    const got = Econ._add(kind, amt);
    if (got > 0 && p.type === 'cur' && p.key === 'contribution') {
      if (typeof S !== 'undefined' && S && typeof S === 'object') {
        const lc = Number(S.lifetimeContribution);
        S.lifetimeContribution = Math.max(0, Math.floor((Number.isFinite(lc) ? lc : 0) + got));
      }
    }
    return got;
  },

  /* grantAll({stone:100, jade:5, 'herb:1':3}). Emits NO Bus events — the caller
     decides what (if anything) the world should hear about it. Returns a map of
     what was actually granted. */
  grantAll(obj) {
    const out = {};
    if (!obj || typeof obj !== 'object') return out;
    for (const k in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
      if (!Econ.parse(k)) continue;             // ignore non-currency reward keys
      const got = Econ.grant(k, obj[k]);
      if (got > 0) out[k] = got;
    }
    return out;
  },

  /* -------------------------------------------------------------- display -- */
  label(kind) {
    const p = Econ.parse(kind);
    if (!p) return (kind === null || kind === undefined) ? '' : String(kind);
    if (p.type === 'cur') return Econ.LABELS[p.key] || p.key;
    if (p.type === 'fruit') return 'Spirit Fruit';
    return 'T' + p.tier + ' ' + (Econ.MAT_LABELS[p.key] || p.key);
  },

  icon(kind) {
    const p = Econ.parse(kind);
    if (!p) return '❔';
    if (p.type === 'cur') return Econ.ICONS[p.key] || '❔';
    if (p.type === 'fruit') return '🍑';
    return Econ.MAT_ICONS[p.key] || '❔';
  },

  /* '1.2K Spiritstone, 5 Fate Jade' — for toasts, mail bodies and reward rows.
     Non-currency keys are skipped, except 'exp' which is common in mail. */
  rewardText(obj) {
    if (!obj || typeof obj !== 'object') return '';
    const parts = [];
    for (const k in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
      const n = Math.floor(Number(obj[k]));
      if (!Number.isFinite(n) || n <= 0) continue;
      if (k === 'exp') { parts.push(Fmt.n(n) + ' Cultivation EXP'); continue; }
      if (!Econ.parse(k)) continue;
      parts.push(Fmt.n(n) + ' ' + Econ.label(k));
    }
    if (!parts.length) return '';
    if (parts.length > 6) {
      return parts.slice(0, 6).join(', ') + ' +' + (parts.length - 6) + ' more';
    }
    return parts.join(', ');
  },
};

/* ============================================================================
 * EVERDAO — CONFIG
 * Every tunable number in the game lives here. Balance is patched in one place.
 *
 * CURVE NOTES (derived by simulation, see tools/curve.js):
 *   auraPerSec(r)  = aura.base * aura.growth^r          = 3 * 3.1^r
 *   req(r,p)       = req.base * req.realmG^r * req.phaseG^p * req.realmMult[r]
 *                  = 60 * 7^r * 1.35^p * realmMult[r]
 *   realmMult[] shapes the spec formula onto the §21 pacing targets:
 *     Connection  150s idle   (<3 min with any active play)
 *     Foundation  ~28 min idle
 *     Virtuoso    ~8.9 h idle  (~3.6 h active)
 *     Incarnation ~13.7 d idle (~5.5 d active)
 *   Max stored EXP value = req(11,9) = 3.39e14, under the 1e15 / 2^53 ceiling.
 * ==========================================================================*/

const CONFIG = {
  version: '1.0.0',
  saveKey: 'everdao.save.v1',
  saveVersion: 4,

  loop: {
    tickMs: 250,          // logic tick
    renderMs: 500,        // render throttle (visible panel only)
    autosaveMs: 15000,
  },

  /* ---------------------------------------------------------------- OFFLINE */
  offline: {
    baseCapH: 12,         // hours
    capPerUpgradeH: 2,    // Jade shop: +2h x3
    maxUpgrades: 3,
    minShowSec: 60,       // don't show the modal for trivial absences
  },

  /* ------------------------------------------------------------ CULTIVATION */
  cultivation: {
    aura: { base: 3, growth: 3.1 },
    req: {
      base: 60, realmG: 7, phaseG: 1.35,
      realmMult: [0.14, 0.62, 5.49, 12.155, 35.887, 63.572,
                  98.536, 140.263, 179.448, 201.731, 203.041, 191.825],
    },
    phasesPerRealm: 9,
    phaseStatBonus: 0.09,      // +9% base stats per minor phase
    realmStatMult: 2.1,        // ~x2.1 base stats per major realm
    eternalReqGrowth: 1.25,    // Eternal Layer n req x1.25 per layer
    maxRealm: 11,
  },

  /* --------------------------------------------------------- BREAKTHROUGH */
  breakthrough: {
    chanceRealmMax: 2,         // realms 0-2 use the chance roll; 3+ use tribulation
    baseChance: 0.40,
    perPill: 0.12,
    maxPills: 3,
    insightPerFail: 0.04,
    insightCap: 0.40,
    injurySec: 30 * 60,        // Dao Injury cooldown
    tribulationBRMult: 1.1,    // Heart Demon BR = 1.1 x benchmarkBR[r]
    tribPillStatBonus: 0.12,   // each loaded pill = +12% stats in tribulation
    // Benchmark BR the game expects a player to have on entering realm r.
    // MEASURED, not guessed (tools/probe.js): this is 1.05x the BR of a phase-9
    // player with NO techniques and NO gear. The Heart Demon at 1.1x benchmark
    // is therefore ~15% above a bare cultivator — losable if you have ignored
    // every system, comfortable once techniques and gear are in play.
    // Player BR grows ~2.1x per realm, tracking cultivation.realmStatMult; any
    // table growing faster than that makes late tribulations impossible to win.
    benchmarkBR: [850, 1800, 3760, 7900, 16600, 34900,
                  73000, 153000, 322000, 677000, 1.428e6, 2.99e6],
    eraAscensionRealms: [5, 9], // Incarnation->Voidbreak, Nirvana->Celestial
    gauntletFights: 3,
  },

  /* -------------------------------------------------------------- RESPIRA */
  respira: {
    wispMinSec: 90, wispMaxSec: 150,
    wispLifeSec: 20,
    chargeSec: 30 * 60,
    baseCap: 8, capPerUpgrade: 2, maxCapUpgrades: 2,
    expMinutes: 15,            // EXP = 15 min of current aura
    techPointsMin: 2, techPointsMax: 5,
    surgeChance: 0.08,
    surgeMult: 6,
    surgePity: 15,             // guaranteed surge within 15 respiras
    surgeTechPointsMult: 4,
    levelBonus: 0.10,          // +10% respira EXP per Respira Level
    levelCostBase: 3,          // Insight Shards, x growth per level
    levelCostGrowth: 1.6,
    maxLevel: 50,
  },

  /* -------------------------------------------------------------- ALCHEMY */
  alchemy: {
    unlockRealm: 2,
    ranks: 6,
    queueSize: 3,
    maxQueueUpgrades: 2,       // Jade shop -> up to 5
    expPillMinutes: 45,        // spec: flat EXP = 45 min of that rank's base aura
    // ...plus a progress-relative floor so high-rank pills never go stale:
    expPillPhaseFrac: 0.035,   // or 3.5% of current phase req, whichever is larger.
                               // Tuned by tools/probe.js: the flat term alone
                               // leaves active play only ~1.6x idle in the mid
                               // realms, because realmReqMult outgrows aura.
    permCapPerRealm: 10,       // Vital Powder / Mind Elixir uses per realm
    vitalHpPct: 0.012, vitalAtkPct: 0.012,
    mindMatkPct: 0.012, mindMpPct: 0.012,
    meridianMpRestore: 0.40, meridianMaxPerBattle: 2,
    wardDefBonus: 0.25, furyAtkBonus: 0.25,
    baitDurationSec: 2 * 3600, baitLootBonus: 0.30,
    craftMinSec: 120, craftMaxSec: 1200,
    // Quality: Gray/Green/Blue/Purple/Yellow
    qualityMult: [1, 1.4, 2, 3, 4.5],
    qualityBase: [0.44, 0.30, 0.17, 0.075, 0.015],
    masteryLevels: ['Beginner', 'Intermediate', 'Advanced', 'Expert'],
    masteryExpPerCraft: 10,
    masteryReq: [0, 120, 400, 1000],  // cumulative mastery EXP per level
    masteryQualityShift: 0.05,        // each mastery level shifts odds upward
    masterySpeedBonus: 0.08,          // -8% craft time per mastery level
    pillAttemptsBase: 10,
  },

  /* ---------------------------------------------------------------- WILDS */
  wilds: {
    stagesPerZone: 40,
    bossEvery: 10,
    enemyPower: { base: 55, growth: 1.16 },
    powerVariance: 0.10,
    spiritRemixMult: 50,       // Spirit-era remix zones
    expeditionCapH: 12,
    expeditionBaseRate: 1.0,
    fortuityMinSec: 10 * 60, fortuityMaxSec: 18 * 60,
    fortuityHuntChance: 0.25,
    fortuityQueueMax: 3,
    luckStart: 10, luckMin: 0, luckMax: 100,
    luckOutcomeWeight: 0.004,  // each Luck point nudges good outcomes by 0.4%
    rarityWeights: { C: 60, R: 30, E: 9, M: 1 },
  },

  /* --------------------------------------------------------------- COMBAT */
  combat: {
    defConstant: 200,          // dmg = ATK * mult * 200/(200+DEF)
    maxRounds: 30,
    mpRegenPct: 0.05,
    baseCrit: 0.05, baseCritDmg: 1.5,
    baseHit: 0.95, baseDodge: 0,
    hitFloor: 0.30, hitCeil: 1.0,
    elementAdvantage: 0.15,    // +/-15%
    // wheel: each beats the next
    elementWheel: ['blaze', 'wood', 'thunder', 'frost', 'blade'],
    bleedPctMaxHp: 0.05, bleedMaxStacks: 3,
    burnAtkPct: 0.08, burnRounds: 3,
    logCap: 60,
    speeds: [1, 2, 4],
    roundMsBase: 620,
  },

  /* ----------------------------------------------------------------- PATHS */
  paths: {
    body:  { hp: 1.35, mp: 0.80, patk: 1.30, matk: 0.70, pdef: 1.20, mdef: 0.95, spd: 0.95,
             lifesteal: 0.08, surgeRealm: 7, surgeMpPct: 0.30, surgeDmgBonus: 0.50, skillCd: 3, skillMult: 2.6 },
    spell: { hp: 0.90, mp: 1.45, patk: 0.70, matk: 1.35, pdef: 0.90, mdef: 1.25, spd: 1.00,
             wardMult: 2.0, skillCd: 2, skillMult: 1.35 },
    sword: { hp: 1.05, mp: 1.00, patk: 1.15, matk: 1.00, pdef: 1.00, mdef: 1.00, spd: 1.15,
             doubleChance: 0.15, skillCd: 3, skillHits: 3, skillMult: 0.75, bleedChance: 0.20 },
    ghost: { hp: 1.00, mp: 1.10, patk: 1.00, matk: 1.10, pdef: 1.00, mdef: 1.05, spd: 1.05,
             thrallScale: 0.40, thrallTaunt: 0.30, skillCd: 3, skillMult: 1.9 },
  },

  /* ----------------------------------------------------------- BASE STATS */
  // Realm 0 phase 1 baseline; scaled by realm/phase then by path multipliers.
  baseStats: { hp: 320, mp: 90, patk: 26, matk: 26, pdef: 14, mdef: 14, spd: 20 },
  brWeights: { hp: 0.08, atk: 4, def: 3, spd: 6 },

  /* ------------------------------------------------------------------ LAW */
  law: {
    unlockRealm: 6,
    procRound: 4,              // fires round 4, 8, 12...
    maxLevel: 20,
    statPerLevel: 0.02,
    procPerLevel: 0.005,
    costBase: 6, costGrowth: 1.35,   // Law Shards
    effects: {
      blaze:   { burnAtkPct: 0.08, rounds: 3 },
      frost:   { spdDebuff: 0.30, rounds: 2 },
      thunder: { stunChance: 0.25 },
      wood:    { healPctMaxHp: 0.12 },
      blade:   { nextHitMult: 2.2 },
    },
  },

  /* ----------------------------------------------------------------- SPIRE */
  spire: {
    unlockRealm: 3,
    floors: 200,
    bossEvery: 10,
    attemptsPerDay: 3,
    powerBase: 900, powerGrowth: 1.135,
    proceduralGrowth: 1.06,    // floors 200+
    sweepPerDay: 1,
    firstClearJade: 6,
    bossFirstClearJade: 25,
  },

  /* ------------------------------------------------------------------ TIDE */
  tide: {
    unlockRealm: 4,
    cooldownSec: 2 * 24 * 3600,
    waves: 5,
    waveScale: [0.7, 0.85, 1.0, 1.15, 1.3],
    boonChoices: 3,
    fullClearJade: 40,
    perWaveJade: 5,
  },

  /* ------------------------------------------------------------------ DUEL */
  duel: {
    unlockRealm: 3,
    npcCount: 200,
    ticketsPerDay: 5,
    challengeRange: 3,         // may challenge any of the 3 ranks above
    brVariance: 0.12,
    driftMin: 0.03, driftMax: 0.06,   // NPC BR drift per day
    seasonDays: 14,
    compression: 0.5,          // soft rank compression toward 200 at season end
    tiers: [
      { name: 'Celestial', maxRank: 3,   jade: 60, stone: 40000 },
      { name: 'Jade',      maxRank: 15,  jade: 40, stone: 24000 },
      { name: 'Gold',      maxRank: 50,  jade: 26, stone: 12000 },
      { name: 'Silver',    maxRank: 110, jade: 16, stone: 6000 },
      { name: 'Bronze',    maxRank: 200, jade: 8,  stone: 2500 },
    ],
  },

  /* ------------------------------------------------------------ TECHNIQUES */
  techs: {
    ranks: 16,
    nodesPerRank: 6,
    lawRankStart: 11,          // ranks 11-16 are Law techs
    costBase: 40,              // Tech Points; scales ~rank^2
    costRankPow: 2.05,
    costNodeStep: 0.35,
    guideCostBase: 1,          // Tech Guides for effect nodes
    guideRankStep: 0.5,
    completionBonusMult: 2,    // completing all 6 nodes doubles that rank's stat nodes
    rankUnlockRealm: [0,0,1,1,2,2,3,3,4,4,6,6,7,8,9,10],
  },

  /* ----------------------------------------------------------------- FORGE */
  forge: {
    unlockRealm: 2,
    slots: ['weapon', 'armor', 'pendant'],
    relicSlots: ['relicA', 'relicB', 'relicC'],
    rarities: ['gray', 'green', 'blue', 'purple', 'gold'],
    rarityAffixes: [1, 1, 2, 3, 4],
    qualityBase: [0.42, 0.31, 0.18, 0.075, 0.015],
    pityByTier: [1, 1, 5, 5, 20, 20],   // pity points per craft by material tier T1..T6
    pityPurple: 100, pityGold: 600,
    enhanceMax: 15,
    enhanceCostBase: 25, enhanceCostGrowth: 1.38,
    enhancePerLevel: 0.04,
    refineMaxStar: 5, refinePerStar: 0.10,
    salvageStones: [4, 8, 18, 45, 120],
    salvageDust: [1, 2, 5, 14, 40],
    rerollDustCost: 60,
  },

  /* ----------------------------------------------------------------- ABODE */
  abode: {
    unlockRealm: 2,
    upgradeCostBase: 500, upgradeCostGrowth: 2,
    maxLevel: 30,
    cultivationAuraPerLevel: 0.05,
    gardenPlotsBase: 2, gardenPlotsMax: 6,
    gardenGrowSec: 20 * 60,
    farmCapH: 8,
    farmStonePerHourBase: 220,
    farmExpFracOfAura: 0.10,      // trickle EXP = 10% of aura rate
    extractorPerDay: 1,
    extractorTechPerFruit: 12,
    teaRoomFortuityBonus: 0.06,   // -6% fortuity interval per level
  },

  /* ------------------------------------------------------------------ SECT */
  sect: {
    unlockRealm: 2,
    switchCooldownDays: 7,
    switchPenalty: 0.5,           // lose 50% contribution on switch
    dailyTasks: 5,
    meditationSec: 10 * 60, meditationMult: 3,
    clashIntervalDays: 7,
    clashElders: 4,
    ranks: [
      { name: 'Outer Disciple',  req: 0,      perk: 'aura',    val: 0.02 },
      { name: 'Inner Disciple',  req: 1200,   perk: 'aura',    val: 0.05 },
      { name: 'Core Disciple',   req: 6000,   perk: 'allStat', val: 0.04 },
      { name: 'Elder',           req: 24000,  perk: 'allStat', val: 0.08 },
      { name: 'Sovereign',       req: 90000,  perk: 'allStat', val: 0.15 },
    ],
  },

  /* ---------------------------------------------------------------- CURIOS */
  curios: {
    total: 24,
    setBreakpoints: [6, 12, 18, 24],
    setBonus: [0.03, 0.06, 0.10, 0.18],   // +% all stats and aura
  },

  /* --------------------------------------------------------------- ECONOMY */
  economy: {
    jadeDailyTarget: 200,
    dailyChestPoints: [40, 80, 120],
    dailyTaskCount: 8,
    weeklyTaskCount: 5,
    passLevels: 50,
    passPointsPerLevel: 100,
    marketSlots: 8, marketFormulaSlots: 3,
    blackMarketSlots: 6, blackMarketRefreshSec: 8 * 3600,
    blackMarketUnlockRealm: 4,
    blackMarketDiscountMin: 0.25, blackMarketDiscountMax: 0.60,
    mailCap: 60,
  },

  /* --------------------------------------------------------------- SAMSARA */
  samsara: {
    unlockRealm: 10,
    markFormula: { realmPow: 2, spireDiv: 10 },
    cycleGlobalMult: 0.15,      // each cycle: +15% global multiplier
    startRealm: 2,              // "start at Foundation" node
  },

  /* ------------------------------------------------------------ UNLOCK GATE */
  unlocks: {
    cultivate: 0, quests: 0, story: 0, respira: 0,
    wilds: 1, gear: 1, market: 1,
    abode: 2, alchemy: 2, forge: 2, garden: 2, farm: 2, extractor: 2, sect: 2, techs: 0,
    duel: 3, spire: 3, tribulation: 3,
    tide: 4, blackMarket: 4, relics: 4,
    curios: 5, eraQuest: 5,
    law: 6, spiritZones: 6,
    eraQuest2: 9,
    endgame: 10, samsara: 10,
  },

  /* ------------------------------------------------------------------- DEV */
  dev: {
    unlockTaps: 7,
    warps: [3600, 8 * 3600, 24 * 3600],
  },
};

/* ============================================================================
 * EVERDAO — META DATA
 * Shops, achievements, daily/weekly duties, the Ascension Path, and the
 * Samsara tree.
 *
 * Pure data. No top-level references to any other module (CONTRACT §1).
 * This file introduces NO new top-level bindings — it only assigns into DATA.
 *
 * Shapes are fixed by CONTRACT §9:
 *   DATA.shops        = { market, library, jade, dust, black }
 *   DATA.achievements = [{ id, name, desc, stat, need, jade }]        // 42
 *   DATA.dailies      = [{ id, name, need, points, evt, match? }]     // 8
 *   DATA.weeklies     = [{ id, name, need, points, evt, match? }]     // 5
 *   DATA.pass         = [{ lvl, rewards }]                            // 50
 *   DATA.samsaraTree  = [{ id, name, desc, max, cost, key, val }]     // 10
 *
 * ID CONVENTIONS
 *   market   mkt_<slug>          library  lib_<sect|shared>_<n|slug>
 *   jade     jade_<slug>         dust     dust_<slug>
 *   black    blk_<slug>          achieve  a_<group>_<n>
 *   dailies  d_<slug>            weeklies w_<slug>
 *   samsara  sam_<slug>
 *
 * SHOP ITEM SHAPE (common to all five shelves)
 *   { id, name, emoji, desc,
 *     cost:{ <econKind>: n },        // Econ kinds only — see CONTRACT §7
 *     costs:[{...},{...}],           // OPTIONAL: escalating price per purchase
 *     max:n,                         // OPTIONAL: lifetime purchase cap
 *     give:{ ... },                  // see below
 *     stock:n,                       // per refresh; -1 == unlimited
 *     realm:n }                      // realm index gate
 *
 * `give` is either an Econ.grantAll object ({stone:500, 'herb:3':8}) or one of
 * the four non-currency payload keys — Econ.grantAll ignores keys it cannot
 * parse, so a shop module may safely pass the whole object through it and then
 * handle the leftovers itself:
 *   { formula:'r2_exp' }      teach a pill formula   -> S.inv.formulas
 *   { blueprint:'bp_r3_weapon' } teach a craft plan  -> S.inv.blueprints
 *   { curio:'<id>'|'random' } grant a curio          -> Curios.own(id)
 *   { seedTier:n }            garden seed bundle (the matching 'seed:n' econ
 *                             line is always present alongside it)
 *   { qol:'<key>' }           a permanent quality-of-life unlock
 *
 * Every non-currency payload is ALSO mirrored as a top-level field on the item
 * (`item.qol`, `item.formula`, `item.blueprint`, `item.curio`). That is not
 * redundancy for its own sake: Wilds._autoUnlocked() and Abode._wantPlots()
 * already read `item.qol` directly, and Sect._normEntry() reads
 * `item.blueprint` / `item.formula` / `item.curio`. Keep both in step.
 *
 * QOL KEYS (jade + dust shelves)
 *   offlineCap        +CONFIG.offline.capPerUpgradeH hours, max 3
 *                     (id MUST stay 'jade_offline' — Offline.upgrades() reads
 *                      S.shops.bought.jade_offline by name)
 *   respiraCap        +CONFIG.respira.capPerUpgrade charges, max 2
 *   gardenPlot        +1 garden plot, max 4 (base 2 -> cap 6)
 *   alchemyQueue      +1 cauldron slot, max 2 (base 3 -> cap 5)
 *   alchemyAssistant  auto-collects finished pills
 *   autoHunt          unlocks the auto-hunt toggle in the Wilds panel
 *   title / auraColor cosmetic; `val` carries the chosen id
 *   reroll            one gear affix reroll (consumable, unlimited stock)
 *   forgeCharm        next forge craft is guaranteed Purple or better
 * ==========================================================================*/


/* ---------------------------------------------------------------------------
 * SHOPS
 *
 * PRICING SPINE — everything on the Spiritstone shelves follows the same x4.5
 * per material tier curve the pill formulas use (10_data_30_items.js), so a
 * tier-N purchase always costs roughly what a tier-N craft costs:
 *   seeds     300 * 4.5^(t-1)      bundles   500 * 4.5^(t-1)
 *   formulas 2000 * 4.5^(r-1)      (~8x the craft cost of that rank)
 * Realm gates track the zone table: zone tier === realm + 1, so a tier-T good
 * appears one realm before the player can farm it comfortably.
 * ------------------------------------------------------------------------ */
DATA.shops = {

  /* ======================================================== MARKET (18) ====
   * Spiritstone. Refreshes daily; the Shops module rolls
   * CONFIG.economy.marketSlots (8) entries, of which
   * CONFIG.economy.marketFormulaSlots (3) are drawn from the formula block.
   * ====================================================================== */
  market: [
    /* --- seeds, one bundle per tier ---------------------------------- */
    { id: 'mkt_seed_t1', name: 'Handful of Foxglove Seed', emoji: '🌱',
      desc: 'Sold loose from a sack, and the vendor does not count very carefully.',
      cost: { stone: 300 }, give: { 'seed:1': 5, seedTier: 1 }, seedTier: 1, stock: 3, realm: 1 },
    { id: 'mkt_seed_t2', name: 'Mistwood Cuttings', emoji: '🌱',
      desc: 'Cut before dawn, when the fog is still holding the hillside down.',
      cost: { stone: 1400 }, give: { 'seed:2': 5, seedTier: 2 }, seedTier: 2, stock: 3, realm: 1 },
    { id: 'mkt_seed_t3', name: 'Cloudmere Spore Packet', emoji: '🌱',
      desc: 'Weighs nothing, drifts if you sneeze, and is worth more than the stall it sits on.',
      cost: { stone: 6000 }, give: { 'seed:3': 5, seedTier: 3 }, seedTier: 3, stock: 3, realm: 2 },
    { id: 'mkt_seed_t4', name: 'Starfall Kernels', emoji: '🌱',
      desc: 'Gathered from craters while still warm, which the gatherers insist is safe.',
      cost: { stone: 27000 }, give: { 'seed:4': 5, seedTier: 4 }, seedTier: 4, stock: 3, realm: 3 },
    { id: 'mkt_seed_t5', name: 'Violet Brook Rootstock', emoji: '🌱',
      desc: 'Kept in river water; take it out too long and it starts complaining audibly.',
      cost: { stone: 120000 }, give: { 'seed:5': 5, seedTier: 5 }, seedTier: 5, stock: 3, realm: 4 },
    { id: 'mkt_seed_t6', name: 'Ashen Steppe Pips', emoji: '🌱',
      desc: 'Grown in ground that has burned twice, which is apparently the trick.',
      cost: { stone: 550000 }, give: { 'seed:6': 5, seedTier: 6 }, seedTier: 6, stock: 3, realm: 5 },

    /* --- material bundles, one per tier ------------------------------ */
    { id: 'mkt_bundle_t1', name: 'Ridge Gatherer\'s Basket', emoji: '🧺',
      desc: 'Herbs, a few cores, and enough scrap iron to make a beginner dangerous.',
      cost: { stone: 500 }, give: { 'herb:1': 10, 'core:1': 6, 'forge:1': 6 }, stock: 2, realm: 1 },
    { id: 'mkt_bundle_t2', name: 'Fogline Trapper\'s Bundle', emoji: '🧺',
      desc: 'Everything the trapper could carry out of the mist before it got personal.',
      cost: { stone: 2200 }, give: { 'herb:2': 10, 'core:2': 6, 'forge:2': 6 }, stock: 2, realm: 1 },
    { id: 'mkt_bundle_t3', name: 'Cloudmere Consignment', emoji: '🧺',
      desc: 'Sealed in oilcloth against a sky that never quite stops raining up here.',
      cost: { stone: 10000 }, give: { 'herb:3': 10, 'core:3': 6, 'forge:3': 6 }, stock: 2, realm: 2 },
    { id: 'mkt_bundle_t4', name: 'Crater Salvage Crate', emoji: '🧺',
      desc: 'Whatever fell out of the sky last month, sorted by a man with tongs.',
      cost: { stone: 45000 }, give: { 'herb:4': 10, 'core:4': 6, 'forge:4': 6 }, stock: 2, realm: 3 },
    { id: 'mkt_bundle_t5', name: 'Brookside Dredging Lot', emoji: '🧺',
      desc: 'Dragged up from the violet shallows and still faintly humming.',
      cost: { stone: 200000 }, give: { 'herb:5': 10, 'core:5': 6, 'forge:5': 6 }, stock: 2, realm: 4 },
    { id: 'mkt_bundle_t6', name: 'Steppe Caravan Share', emoji: '🧺',
      desc: 'One share of a caravan that crossed the ash and lost only two carts.',
      cost: { stone: 900000 }, give: { 'herb:6': 10, 'core:6': 6, 'forge:6': 6 }, stock: 2, realm: 5 },

    /* --- formula unlocks (the marketFormulaSlots pool) ---------------- */
    { id: 'mkt_formula_r1', name: 'Copied Dew-Gathering Recipe', emoji: '📜',
      desc: 'Somebody\'s apprentice sold this to feed himself; he will regret it by winter.',
      cost: { stone: 2000 }, give: { formula: 'r1_exp' }, formula: 'r1_exp', stock: 1, realm: 2 },
    { id: 'mkt_formula_r2', name: 'Running Creek Recipe', emoji: '📜',
      desc: 'Three pages, two of them warnings, one of them the actual method.',
      cost: { stone: 9000 }, give: { formula: 'r2_meridian' }, formula: 'r2_meridian', stock: 1, realm: 2 },
    { id: 'mkt_formula_r3', name: 'Patient Shell Recipe', emoji: '📜',
      desc: 'Written by an alchemist who was hit very hard, once, and never forgot it.',
      cost: { stone: 40000 }, give: { formula: 'r3_ward' }, formula: 'r3_ward', stock: 1, realm: 2 },
    { id: 'mkt_formula_r4', name: 'Red Tiger Recipe', emoji: '📜',
      desc: 'The margins are full of exclamation marks and at least one scorch mark.',
      cost: { stone: 180000 }, give: { formula: 'r4_fury' }, formula: 'r4_fury', stock: 1, realm: 3 },
    { id: 'mkt_formula_r5', name: 'Generous Wilds Recipe', emoji: '📜',
      desc: 'Bought from a hunter who claimed he no longer needed to attract anything.',
      cost: { stone: 800000 }, give: { formula: 'r5_bait' }, formula: 'r5_bait', stock: 1, realm: 4 },
    { id: 'mkt_formula_r6', name: 'Endless Spring Recipe', emoji: '📜',
      desc: 'The stall owner cannot read it, cannot price it, and would like it gone.',
      cost: { stone: 3600000 }, give: { formula: 'r6_meridian' }, formula: 'r6_meridian', stock: 1, realm: 5 },
  ],

  /* ======================================================= LIBRARY (16) ====
   * Citrine, spent at your sect's shelves. The 12 'lib_<sect>_<n>' ids are the
   * exact ids listed in DATA.sects[].library — keep the two lists in step. The
   * four 'lib_shared_*' entries are stocked by every sect.
   * Sect._normEntry() reads cost.citrine, stock (per day; <=0 == unlimited),
   * and the top-level blueprint/formula/curio mirrors.
   * ====================================================================== */
  library: [
    /* --- Azure Blade Sect: swords, ore, and unsolicited opinions ------ */
    { id: 'lib_azure_1', sect: 'azure', name: 'Heron Blade Pattern', emoji: '📜',
      desc: 'Stamped, sealed, and faintly bloodstained; the armoury calls that a proof of concept.',
      cost: { citrine: 300 }, give: { blueprint: 'bp_r3_weapon' }, blueprint: 'bp_r3_weapon', stock: 1, realm: 2 },
    { id: 'lib_azure_2', sect: 'azure', name: 'Fury Draught Formula', emoji: '🔥',
      desc: 'Brewed by swordsmen, which explains both the potency and the flavour.',
      cost: { citrine: 240 }, give: { formula: 'r3_fury' }, formula: 'r3_fury', stock: 1, realm: 2 },
    { id: 'lib_azure_3', sect: 'azure', name: 'Whetstone Tithe', emoji: '🪨',
      desc: 'Forge stock the drill yard will not miss for a week, and will not ask about after.',
      cost: { citrine: 110 }, give: { 'forge:3': 8, stones: 500 }, stock: 3, realm: 2 },
    { id: 'lib_azure_4', sect: 'azure', name: 'Split Sky Fang Pattern', emoji: '📜',
      desc: 'The sect keeps this on the top shelf so that reaching for it looks like a decision.',
      cost: { citrine: 620 }, give: { blueprint: 'bp_r5_weapon' }, blueprint: 'bp_r5_weapon', stock: 1, realm: 6 },

    /* --- Verdant Pill Valley: everything simmers for six hours -------- */
    { id: 'lib_verdant_1', sect: 'verdant', name: 'Annotated Cinnabar Notes', emoji: '⚗️',
      desc: 'Copied out in a hand that very clearly resented every stroke of the copying.',
      cost: { citrine: 260 }, give: { formula: 'r3_exp' }, formula: 'r3_exp', stock: 1, realm: 2 },
    { id: 'lib_verdant_2', sect: 'verdant', name: 'Heaven-Softening Method', emoji: '🟣',
      desc: 'The Valley sells this to anyone about to do something the sky will notice.',
      cost: { citrine: 480 }, give: { formula: 'r4_bt' }, formula: 'r4_bt', stock: 1, realm: 4 },
    { id: 'lib_verdant_3', sect: 'verdant', name: 'Nursery Cuttings', emoji: '🌿',
      desc: 'Herbs the Valley considers surplus and everyone else considers a small fortune.',
      cost: { citrine: 80 }, give: { 'herb:3': 10, 'seed:3': 3, seedTier: 3 }, seedTier: 3, stock: 3, realm: 2 },
    { id: 'lib_verdant_4', sect: 'verdant', name: 'Ninth Knock Method', emoji: '🟣',
      desc: 'Eight failures are assumed by the title, which some disciples find bracing.',
      cost: { citrine: 700 }, give: { formula: 'r5_bt' }, formula: 'r5_bt', stock: 1, realm: 7 },

    /* --- Umbral Veil: no gate, no roster, excellent maps -------------- */
    { id: 'lib_umbral_1', sect: 'umbral', name: 'Reliquary Tracing', emoji: '📜',
      desc: 'It arrives without a courier, without a price tag, and without eye contact.',
      cost: { citrine: 320 }, give: { blueprint: 'bp_r3_relic' }, blueprint: 'bp_r3_relic', stock: 1, realm: 4 },
    { id: 'lib_umbral_2', sect: 'umbral', name: 'Unlisted Map Corner', emoji: '🗺️',
      desc: 'Torn from a map that officially has no corners, and unofficially has nine.',
      cost: { citrine: 150 }, give: { insight: 2, stone: 20000 }, stock: 2, realm: 2 },
    { id: 'lib_umbral_3', sect: 'umbral', name: 'Bait Formula, Unsigned', emoji: '🍯',
      desc: 'The Veil does not sign things; it finds signatures gauche and, frankly, evidential.',
      cost: { citrine: 220 }, give: { formula: 'r3_bait' }, formula: 'r3_bait', stock: 1, realm: 2 },
    { id: 'lib_umbral_4', sect: 'umbral', name: 'Codex of the Ninth Ash', emoji: '📜',
      desc: 'Four elders deny this exists, and all four of them own a copy.',
      cost: { citrine: 660 }, give: { blueprint: 'bp_r5_relic' }, blueprint: 'bp_r5_relic', stock: 1, realm: 6 },

    /* --- shared shelf: every sect stocks these ------------------------ */
    { id: 'lib_shared_guide', name: 'Annotated Technique Guide', emoji: '📖',
      desc: 'Marginalia by four generations of increasingly tired disciples, all disagreeing.',
      cost: { citrine: 130 }, give: { guide: 2 }, stock: 2, realm: 2 },
    { id: 'lib_shared_seed', name: 'Sect Nursery Seedlings', emoji: '🌿',
      desc: 'Plant them today, forget them entirely, harvest them anyway.',
      cost: { citrine: 70 }, give: { 'seed:3': 4, seedTier: 3 }, seedTier: 3, stock: 3, realm: 2 },
    { id: 'lib_shared_ink', name: 'Insight Ink', emoji: '🕯️',
      desc: 'Grinds down into shards of something very close to understanding.',
      cost: { citrine: 160 }, give: { insight: 2 }, stock: 2, realm: 2 },
    { id: 'lib_shared_dust', name: 'Sweepings from the Refining Hall', emoji: '🌫️',
      desc: 'The floor of a room where expensive things are broken on purpose.',
      cost: { citrine: 140 }, give: { dust: 150 }, stock: 2, realm: 2 },
  ],

  /* ========================================================== JADE (14) ====
   * Fate Jade. PERMANENT quality of life and cosmetics — nothing here is
   * consumable, nothing here is power, and nothing here is ever sold twice
   * past its `max`. Repeat-purchase entries carry a `costs` ARRAY (price of the
   * 1st, 2nd, 3rd... purchase); `cost` mirrors costs[0] for naive readers.
   * ====================================================================== */
  jade: [
    { id: 'jade_offline', name: 'Deeper Meditation', emoji: '🛏️',
      desc: 'Your body keeps cultivating for two more hours after your attention wanders off.',
      qol: 'offlineCap', give: { qol: 'offlineCap' }, max: 3,
      cost: { jade: 80 }, costs: [{ jade: 80 }, { jade: 140 }, { jade: 220 }], stock: -1, realm: 0 },

    { id: 'jade_respira', name: 'Wider Lungs', emoji: '🌬️',
      desc: 'Hold two more breaths in reserve, for the mornings you forget to spend them.',
      qol: 'respiraCap', give: { qol: 'respiraCap' }, max: 2,
      cost: { jade: 120 }, costs: [{ jade: 120 }, { jade: 200 }], stock: -1, realm: 0 },

    { id: 'jade_garden', name: 'One More Furrow', emoji: '🪴',
      desc: 'Turn another strip of the courtyard over; the neighbours have stopped commenting.',
      qol: 'gardenPlot', give: { qol: 'gardenPlot' }, max: 4,
      cost: { jade: 60 }, costs: [{ jade: 60 }, { jade: 100 }, { jade: 160 }, { jade: 240 }], stock: -1, realm: 2 },

    { id: 'jade_queue', name: 'A Second Cauldron', emoji: '🍲',
      desc: 'Two things can simmer badly at once, which is twice the alchemy and twice the smoke.',
      qol: 'alchemyQueue', give: { qol: 'alchemyQueue' }, max: 2,
      cost: { jade: 150 }, costs: [{ jade: 150 }, { jade: 260 }], stock: -1, realm: 2 },

    { id: 'jade_assistant', name: 'A Boy Who Watches Pots', emoji: '🧒',
      desc: 'He takes finished pills off the fire without being asked, and asks for very little back.',
      qol: 'alchemyAssistant', give: { qol: 'alchemyAssistant' }, max: 1,
      cost: { jade: 200 }, stock: -1, realm: 2 },

    { id: 'jade_autohunt', name: 'Standing Orders', emoji: '🔁',
      desc: 'Your sword learns the route so thoroughly that you may stop walking it yourself.',
      qol: 'autoHunt', give: { qol: 'autoHunt' }, max: 1,
      cost: { jade: 180 }, stock: -1, realm: 1 },

    /* --- cosmetic: titles -------------------------------------------- */
    { id: 'jade_title_teahouse', name: 'Title: Regular at the Teahouse', emoji: '🍵',
      desc: 'Bought, not earned, and the tea is genuinely very good.',
      qol: 'title', val: 't_teahouse', titleName: 'Regular at the Teahouse',
      give: { qol: 'title', val: 't_teahouse' }, max: 1, cost: { jade: 40 }, stock: -1, realm: 0 },

    { id: 'jade_title_ledger', name: 'Title: Settles Accounts Quietly', emoji: '🧾',
      desc: 'For those who prefer their reputation written in someone else\'s books.',
      qol: 'title', val: 't_ledgerquiet', titleName: 'Settles Accounts Quietly',
      give: { qol: 'title', val: 't_ledgerquiet' }, max: 1, cost: { jade: 55 }, stock: -1, realm: 2 },

    { id: 'jade_title_roadname', name: 'Title: Answers to a Road Name', emoji: '🧳',
      desc: 'Nobody on the mountain knows what your mother called you, and that is the point.',
      qol: 'title', val: 't_roadname', titleName: 'Answers to a Road Name',
      give: { qol: 'title', val: 't_roadname' }, max: 1, cost: { jade: 55 }, stock: -1, realm: 3 },

    { id: 'jade_title_lastlamp', name: 'Title: Last Lamp on the Terrace', emoji: '🏮',
      desc: 'Everyone else went to bed; you are still out there, being thematic about it.',
      qol: 'title', val: 't_lastlamp', titleName: 'Last Lamp on the Terrace',
      give: { qol: 'title', val: 't_lastlamp' }, max: 1, cost: { jade: 90 }, stock: -1, realm: 5 },

    /* --- cosmetic: aura colours -------------------------------------- */
    { id: 'jade_aura_gold', name: 'Aura Dye: Old Gold', emoji: '🟡',
      desc: 'The colour of temple leaf and other people\'s money.',
      qol: 'auraColor', val: 'gold', give: { qol: 'auraColor', val: 'gold' },
      max: 1, cost: { jade: 35 }, stock: -1, realm: 0 },

    { id: 'jade_aura_purple', name: 'Aura Dye: Thundercloud', emoji: '🟣',
      desc: 'Bruise-purple, faintly ominous, and extremely popular with people under twenty.',
      qol: 'auraColor', val: 'purple', give: { qol: 'auraColor', val: 'purple' },
      max: 1, cost: { jade: 35 }, stock: -1, realm: 0 },

    { id: 'jade_aura_blue', name: 'Aura Dye: Deep Well', emoji: '🔵',
      desc: 'Cold blue, the shade water goes when it stops reflecting anything.',
      qol: 'auraColor', val: 'blue', give: { qol: 'auraColor', val: 'blue' },
      max: 1, cost: { jade: 35 }, stock: -1, realm: 0 },

    { id: 'jade_aura_red', name: 'Aura Dye: Late Kiln', emoji: '🔴',
      desc: 'The red of a furnace nobody has bothered to bank for the night.',
      qol: 'auraColor', val: 'red', give: { qol: 'auraColor', val: 'red' },
      max: 1, cost: { jade: 45 }, stock: -1, realm: 3 },
  ],

  /* ========================================================== DUST (9) =====
   * Soul Dust, the salvage currency. Rerolls, plans, and two blunt conversions
   * back into the forge economy. The reroll is deliberately the cheapest thing
   * on the shelf and never runs out — CONFIG.forge.rerollDustCost is 60.
   * ====================================================================== */
  dust: [
    { id: 'dust_reroll', name: 'Reroll an Affix', emoji: '🌫️',
      desc: 'Dissolve one line of a weapon\'s history and let it write a different one.',
      qol: 'reroll', give: { qol: 'reroll' },
      cost: { dust: 60 }, stock: -1, realm: 1 },

    { id: 'dust_bp_relic2', name: 'Grave Bell Tracing', emoji: '📜',
      desc: 'Rubbed from a bell that has not been struck since the people who struck it died.',
      cost: { dust: 400 }, give: { blueprint: 'bp_r2_relic' }, blueprint: 'bp_r2_relic', stock: 1, realm: 2 },

    { id: 'dust_bp_armor3', name: 'Cloudweave Loom Chart', emoji: '📜',
      desc: 'Sixteen pages of thread counts, and one page that is simply an apology.',
      cost: { dust: 700 }, give: { blueprint: 'bp_r3_armor' }, blueprint: 'bp_r3_armor', stock: 1, realm: 3 },

    { id: 'dust_bp_relic4', name: 'Codex of the Kept Vow', emoji: '📜',
      desc: 'Someone promised something enormous and then wrote down how to hold it.',
      cost: { dust: 1200 }, give: { blueprint: 'bp_r4_relic' }, blueprint: 'bp_r4_relic', stock: 1, realm: 4 },

    { id: 'dust_bp_pendant5', name: 'Nine Refusals Ward Codex', emoji: '📜',
      desc: 'Nine ways to say no, illustrated, with one of them working.',
      cost: { dust: 2000 }, give: { blueprint: 'bp_r5_pendant' }, blueprint: 'bp_r5_pendant', stock: 1, realm: 6 },

    { id: 'dust_bp_relic6', name: 'Codex of the Whole Sky', emoji: '📜',
      desc: 'The last page is blank because the author ran out of sky to describe.',
      cost: { dust: 3200 }, give: { blueprint: 'bp_r6_relic' }, blueprint: 'bp_r6_relic', stock: 1, realm: 8 },

    { id: 'dust_stones', name: 'Recondensed Forge Stones', emoji: '🪨',
      desc: 'Everything you have ever broken, pressed back into something usefully solid.',
      cost: { dust: 150 }, give: { stones: 800 }, stock: 5, realm: 2 },

    { id: 'dust_ore_mid', name: 'Reclaimed Ore, Mid-Grade', emoji: '🔩',
      desc: 'Ore that has already been a sword twice and would prefer not to discuss it.',
      cost: { dust: 220 }, give: { 'forge:4': 10 }, stock: 3, realm: 4 },

    { id: 'dust_ore_high', name: 'Reclaimed Ore, Steppe-Grade', emoji: '🔩',
      desc: 'Pulled from the ash and still holding the shape of somebody\'s last idea.',
      cost: { dust: 600 }, give: { 'forge:6': 10 }, stock: 3, realm: 6 },
  ],

  /* ========================================================= BLACK (16) ====
   * Fate Jade + Spiritstone. Unlocks at Nascent Soul
   * (CONFIG.economy.blackMarketUnlockRealm = 4), refreshes every
   * CONFIG.economy.blackMarketRefreshSec (8h). The Shops module rolls
   * CONFIG.economy.blackMarketSlots (6) of these at a 25-60% discount.
   * Entries flagged `rare:true` are the Jade-only prizes — the whole reason
   * to keep checking the stall.
   * ====================================================================== */
  black: [
    { id: 'blk_stone_cache', name: 'Somebody Else\'s Savings', emoji: '🪙',
      desc: 'The seller does not say whose, and the coins are still warm from a pocket.',
      cost: { jade: 30 }, give: { stone: 250000 }, stock: 1, realm: 4 },

    { id: 'blk_herb_lot', name: 'Unlabelled Herb Lot', emoji: '🌿',
      desc: 'Sorted by smell rather than by name, which the buyer is invited to find charming.',
      cost: { stone: 180000, jade: 8 }, give: { 'herb:5': 20, 'core:5': 12 }, stock: 2, realm: 4 },

    { id: 'blk_forge_lot', name: 'Night Foundry Offcuts', emoji: '🔩',
      desc: 'A foundry that only runs after dark sells what it does not want counted.',
      cost: { stone: 200000, jade: 8 }, give: { 'forge:5': 20, stones: 1500 }, stock: 2, realm: 4 },

    { id: 'blk_seed_lot', name: 'Seeds of Uncertain Parentage', emoji: '🌱',
      desc: 'They will grow into something; the vendor is happy to leave it there.',
      cost: { stone: 120000, jade: 5 }, give: { 'seed:5': 8, seedTier: 5 }, seedTier: 5, stock: 2, realm: 4 },

    { id: 'blk_insight', name: 'Shards of Another Man\'s Epiphany', emoji: '💡',
      desc: 'He understood something enormous on a Tuesday and then, regrettably, needed the money.',
      cost: { jade: 24 }, give: { insight: 6 }, stock: 2, realm: 4 },

    { id: 'blk_guides', name: 'Guides, Bindings Removed', emoji: '📖',
      desc: 'Four manuals with every sect seal carefully razored out of the spine.',
      cost: { jade: 30 }, give: { guide: 4 }, stock: 2, realm: 4 },

    { id: 'blk_tech', name: 'Transcript of a Closed Lecture', emoji: '🧠',
      desc: 'The elder who gave it swore the hall was empty, and the hall agreed with him.',
      cost: { stone: 220000, jade: 6 }, give: { tech: 20000 }, stock: 2, realm: 4 },

    { id: 'blk_dust', name: 'Ash of Confiscated Swords', emoji: '🌫️',
      desc: 'The confiscating was legal; the burning, the grinding and the selling less so.',
      cost: { stone: 150000, jade: 6 }, give: { dust: 600 }, stock: 2, realm: 4 },

    { id: 'blk_citrine', name: 'Unclaimed Spire Tribute', emoji: '🟡',
      desc: 'Won on a floor nobody has records of, by a climber nobody has records of either.',
      cost: { jade: 28 }, give: { citrine: 900 }, stock: 1, realm: 4 },

    { id: 'blk_fruit', name: 'Fruit from a Stolen Orchard', emoji: '🍑',
      desc: 'Perfectly ripe, faintly guilty, and improving by the hour in a locked crate.',
      cost: { stone: 300000, jade: 10 }, give: { fruit: 12 }, stock: 1, realm: 5 },

    { id: 'blk_lawshard', name: 'Splinter of a Broken Law', emoji: '🔮',
      desc: 'Something enormous was true here once, and this is the piece that fell off.',
      cost: { jade: 40 }, give: { lawShard: 6 }, stock: 1, realm: 6 },

    { id: 'blk_mats_high', name: 'Steppe Crossing, Full Manifest', emoji: '🧺',
      desc: 'The entire cargo of a caravan whose drivers are all suddenly on holiday.',
      cost: { stone: 1200000, jade: 12 }, give: { 'herb:6': 16, 'core:6': 10 }, stock: 2, realm: 7 },

    { id: 'blk_bp_relic6', name: 'Whole Sky Codex, Third Copy', emoji: '📜',
      desc: 'There were never meant to be three, and the other two are being looked for.',
      cost: { stone: 900000, jade: 120 }, give: { blueprint: 'bp_r6_relic' }, blueprint: 'bp_r6_relic',
      stock: 1, realm: 8 },

    /* --- the rare shelf: Fate Jade only ------------------------------- */
    { id: 'blk_formula_r6', name: 'Willing Sky Method, Complete', emoji: '🟣',
      desc: 'Rank six, unabridged, and the seller will not meet your eye while you read it.',
      cost: { jade: 150 }, give: { formula: 'r6_bt' }, formula: 'r6_bt',
      rare: true, stock: 1, realm: 8 },

    { id: 'blk_curio_random', name: 'Sealed Crate, Contents Disputed', emoji: '🎁',
      desc: 'Three people have claimed it, two have paid for it, and none of them opened it.',
      cost: { jade: 180 }, give: { curio: 'random' }, curio: 'random',
      rare: true, stock: 1, realm: 5 },

    { id: 'blk_forge_charm', name: 'Charm of the Obliging Anvil', emoji: '🔨',
      desc: 'Your next craft comes out Purple or better, and the anvil pretends it was luck.',
      cost: { jade: 110 }, qol: 'forgeCharm', give: { qol: 'forgeCharm' },
      rare: true, stock: 1, realm: 4 },
  ],
};


/* ---------------------------------------------------------------------------
 * ACHIEVEMENTS — exactly 42.
 *
 * `stat` is a dotted path read straight off the save (CONTRACT §2) by the Ach
 * module; a missing path reads as 0, so old saves simply show 0 progress
 * rather than throwing. Every path below is a plain number or an array length.
 *
 * `need` is the threshold, `jade` the one-time payout. Payouts run 10 (the
 * first step of anything) to 300 (Eternal, and the first Samsara cycle), for
 * 4,030 Fate Jade across a full account lifetime — a meaningful but strictly
 * finite pool on top of the daily/weekly income.
 *
 * id convention: 'a_<group>_<threshold>'.
 * ------------------------------------------------------------------------ */
DATA.achievements = [
  /* --- realm progress (6) ------------------------------------------- */
  { id: 'a_realm_1',  name: 'First Clean Breath',        desc: 'Reach the Connection realm.',
    stat: 'player.realm', need: 1,  jade: 10 },
  { id: 'a_realm_2',  name: 'Stone Underfoot',           desc: 'Reach Foundation, and stop leaking qi into the floor.',
    stat: 'player.realm', need: 2,  jade: 20 },
  { id: 'a_realm_4',  name: 'Host to a Smaller Self',    desc: 'Reach Nascent Soul and start losing arguments internally.',
    stat: 'player.realm', need: 4,  jade: 45 },
  { id: 'a_realm_6',  name: 'The One Who Knocked',       desc: 'Reach Voidbreak and feel the draught coming through.',
    stat: 'player.realm', need: 6,  jade: 90 },
  { id: 'a_realm_9',  name: 'Kept the Good Parts',       desc: 'Reach Nirvana and walk out of your own ashes.',
    stat: 'player.realm', need: 9,  jade: 160 },
  { id: 'a_realm_11', name: 'Undated',                   desc: 'Reach Eternal. Time is a room now, and you have the key.',
    stat: 'player.realm', need: 11, jade: 300 },

  /* --- breakthroughs (2) -------------------------------------------- */
  { id: 'a_bt_15',    name: 'Fifteen Closed Doors',      desc: 'Break through 15 times.',
    stat: 'stats.breakthroughs', need: 15, jade: 40 },
  { id: 'a_bt_80',    name: 'Nothing Left to Knock On',  desc: 'Break through 80 times.',
    stat: 'stats.breakthroughs', need: 80, jade: 150 },

  /* --- hunts (3) ----------------------------------------------------- */
  { id: 'a_hunt_100',  name: 'Trampled Grass',           desc: 'Clear 100 hunt stages.',
    stat: 'stats.hunts', need: 100,  jade: 15 },
  { id: 'a_hunt_1000', name: 'Well-Worn Boots',          desc: 'Clear 1,000 hunt stages.',
    stat: 'stats.hunts', need: 1000, jade: 45 },
  { id: 'a_hunt_6000', name: 'The Wilds Know Your Face', desc: 'Clear 6,000 hunt stages. Small animals now leave.',
    stat: 'stats.hunts', need: 6000, jade: 140 },

  /* --- bosses (3) ---------------------------------------------------- */
  { id: 'a_boss_10',  name: 'Ten Bad Afternoons',        desc: 'Fell 10 zone wardens.',
    stat: 'stats.bosses', need: 10,  jade: 25 },
  { id: 'a_boss_60',  name: 'Warden-Breaker',            desc: 'Fell 60 zone wardens.',
    stat: 'stats.bosses', need: 60,  jade: 70 },
  { id: 'a_boss_200', name: 'Nothing Left to Guard It',  desc: 'Fell 200 zone wardens.',
    stat: 'stats.bosses', need: 200, jade: 180 },

  /* --- alchemy (3) --------------------------------------------------- */
  { id: 'a_pill_25',   name: 'Smoke in the Rafters',     desc: 'Refine 25 pills.',
    stat: 'stats.pillsCrafted', need: 25,   jade: 20 },
  { id: 'a_pill_300',  name: 'Cauldron-Handed',          desc: 'Refine 300 pills.',
    stat: 'stats.pillsCrafted', need: 300,  jade: 60 },
  { id: 'a_pill_1500', name: 'The Valley Sends Regards', desc: 'Refine 1,500 pills. Verdant Pill Valley is watching.',
    stat: 'stats.pillsCrafted', need: 1500, jade: 170 },

  /* --- forge (2) ----------------------------------------------------- */
  { id: 'a_gear_20',  name: 'Twenty Honest Sparks',      desc: 'Forge 20 pieces of gear.',
    stat: 'stats.gearCrafted', need: 20,  jade: 20 },
  { id: 'a_gear_400', name: 'Ten Thousand Sparks',       desc: 'Forge 400 pieces of gear.',
    stat: 'stats.gearCrafted', need: 400, jade: 150 },

  /* --- collection: plans, hoarding (2) ------------------------------- */
  { id: 'a_bp_18',    name: 'A Drawer of Diagrams',      desc: 'Own 18 blueprints.',
    stat: 'inv.blueprints.length', need: 18, jade: 90 },
  { id: 'a_hoard_200', name: 'Going to Sort These Later', desc: 'Hold 200 pieces of gear at once. You will not sort them.',
    stat: 'inv.gear.length', need: 200, jade: 30 },

  /* --- duels (4) ----------------------------------------------------- */
  { id: 'a_duel_25',  name: 'Politely Introduced',       desc: 'Fight 25 duels.',
    stat: 'stats.duels', need: 25,  jade: 20 },
  { id: 'a_duel_200', name: 'Known to the Ladder',       desc: 'Fight 200 duels.',
    stat: 'stats.duels', need: 200, jade: 80 },
  { id: 'a_win_30',   name: 'Thirty Quiet Apologies',    desc: 'Win 30 duels.',
    stat: 'duel.wins', need: 30,  jade: 35 },
  { id: 'a_win_150',  name: 'Rank One and Insufferable', desc: 'Win 150 duels, and mention it at every opportunity.',
    stat: 'duel.wins', need: 150, jade: 140 },

  /* --- spire (4) ----------------------------------------------------- */
  { id: 'a_spire_10',  name: 'First Landing',            desc: 'Reach Spire floor 10.',
    stat: 'spire.best', need: 10,  jade: 15 },
  { id: 'a_spire_50',  name: 'Halfway Up Something',     desc: 'Reach Spire floor 50.',
    stat: 'spire.best', need: 50,  jade: 50 },
  { id: 'a_spire_100', name: 'The Hundredth Stair',      desc: 'Reach Spire floor 100.',
    stat: 'spire.best', need: 100, jade: 120 },
  { id: 'a_spire_200', name: 'Sat on the Spire Roof',    desc: 'Reach Spire floor 200 and enjoy the view alone.',
    stat: 'spire.best', need: 200, jade: 260 },

  /* --- respira (3) --------------------------------------------------- */
  { id: 'a_resp_60',   name: 'Wisp-Chaser',              desc: 'Take 60 respiras.',
    stat: 'stats.respiras', need: 60,   jade: 15 },
  { id: 'a_resp_500',  name: 'Breath Well Spent',        desc: 'Take 500 respiras.',
    stat: 'stats.respiras', need: 500,  jade: 55 },
  { id: 'a_resp_2500', name: 'The Air Owes You Nothing', desc: 'Take 2,500 respiras.',
    stat: 'stats.respiras', need: 2500, jade: 150 },

  /* --- curios (3) ---------------------------------------------------- */
  { id: 'a_curio_6',  name: 'Shelf Begun',               desc: 'Own 6 curios.',
    stat: 'curios.owned.length', need: 6,  jade: 30 },
  { id: 'a_curio_12', name: 'Shelf of Odd Things',       desc: 'Own 12 curios.',
    stat: 'curios.owned.length', need: 12, jade: 80 },
  { id: 'a_curio_24', name: 'Nothing Left to Covet',     desc: 'Own all 24 curios. The shelf is full and so are you.',
    stat: 'curios.owned.length', need: 24, jade: 220 },

  /* --- techniques (2) ------------------------------------------------ */
  { id: 'a_tech_24', name: 'Legible at Twenty Paces',    desc: 'Unlock 24 technique nodes.',
    stat: 'techs.owned.length', need: 24, jade: 40 },
  { id: 'a_tech_96', name: 'The Whole Manual',           desc: 'Unlock all 96 technique nodes.',
    stat: 'techs.owned.length', need: 96, jade: 240 },

  /* --- sect (2) ------------------------------------------------------ */
  { id: 'a_sect_6000',  name: 'Core Disciple, Allegedly', desc: 'Earn 6,000 lifetime sect contribution.',
    stat: 'lifetimeContribution', need: 6000,  jade: 40 },
  { id: 'a_sect_90000', name: 'They Named a Corridor',    desc: 'Earn 90,000 lifetime contribution. It is a short corridor.',
    stat: 'lifetimeContribution', need: 90000, jade: 200 },

  /* --- samsara (1) --------------------------------------------------- */
  { id: 'a_samsara_1', name: 'Second Draft',             desc: 'Complete one Samsara cycle and begin again, better.',
    stat: 'samsara.cycle', need: 1, jade: 300 },

  /* --- the silly two ------------------------------------------------- */
  { id: 'a_playtime_100h', name: 'Sat Very Still',       desc: 'Spend 100 hours cultivating. Your legs have opinions.',
    stat: 'playtimeSec', need: 360000, jade: 60 },
  { id: 'a_luck_60',       name: 'Suspiciously Fortunate', desc: 'Raise Luck to 60 and watch strangers stop gambling with you.',
    stat: 'player.luck', need: 60, jade: 50 },
];


/* ---------------------------------------------------------------------------
 * DAILIES — exactly CONFIG.economy.dailyTaskCount (8).
 *
 * `evt` is a Bus event name from CONTRACT §3; each matching emit adds 1 to
 * progress. `match(data)` is an optional filter over that event's payload.
 *
 * POINT BUDGET: 15+20+15+20+20+20+20+20 = 150 activity points, against
 * CONFIG.economy.dailyChestPoints = [40, 80, 120]. A player who does all eight
 * clears every chest with 30 points to spare, and a player who skips the two
 * gated tasks (spire, duel) still reaches the 120 chest at 110... just short,
 * deliberately: the third chest should cost one more small errand.
 *
 * id convention: 'd_<slug>'.
 * ------------------------------------------------------------------------ */
DATA.dailies = [
  { id: 'd_respira', name: 'Draw five clean breaths', need: 5, points: 15,
    evt: 'respira' },

  { id: 'd_pill_use', name: 'Swallow three pills', need: 3, points: 20,
    evt: 'pillUsed' },

  { id: 'd_hunt', name: 'Clear three hunt stages', need: 3, points: 15,
    evt: 'huntClear' },

  { id: 'd_pill_craft', name: 'Refine a pill', need: 1, points: 20,
    evt: 'pillCrafted' },

  { id: 'd_expedition', name: 'Call the expedition home', need: 1, points: 20,
    evt: 'expeditionClaim' },

  { id: 'd_duel', name: 'Answer two challenges', need: 2, points: 20,
    evt: 'duelFight' },

  { id: 'd_spire', name: 'Climb one Spire floor', need: 1, points: 20,
    evt: 'spireClear',
    /* Sweeps emit spireSweep, not spireClear, but guard the floor anyway so a
       malformed payload can never tick the task. */
    match: function (d) { return !!d && Number(d.floor) > 0; } },

  { id: 'd_garden', name: 'Bring in the garden', need: 1, points: 20,
    evt: 'gardenHarvest' },
];


/* ---------------------------------------------------------------------------
 * WEEKLIES — exactly CONFIG.economy.weeklyTaskCount (5).
 *
 * Same shape, larger numbers, and three of the five use `match` so they demand
 * the harder version of a daily errand: warden kills rather than any clear,
 * duel WINS rather than duel attempts, Spire boss floors rather than any floor
 * (CONFIG.spire.bossEvery = 10).
 *
 * POINT BUDGET: 200+250+250+200+200 = 1,100 points a week, i.e. rather more
 * than seven perfect days of dailies. The weekly board is where the Ascension
 * Path actually gets fed (CONFIG.economy.passPointsPerLevel = 100).
 *
 * id convention: 'w_<slug>'.
 * ------------------------------------------------------------------------ */
DATA.weeklies = [
  { id: 'w_respira', name: 'Forty breaths, unhurried', need: 40, points: 200,
    evt: 'respira' },

  { id: 'w_boss', name: 'Fell twelve wardens', need: 12, points: 250,
    evt: 'huntClear',
    match: function (d) { return !!d && d.boss === true; } },

  { id: 'w_duel_win', name: 'Win fifteen duels', need: 15, points: 250,
    evt: 'duelFight',
    match: function (d) { return !!d && d.win === true; } },

  { id: 'w_craft', name: 'Refine twenty-five pills', need: 25, points: 200,
    evt: 'pillCrafted' },

  { id: 'w_spire_boss', name: 'Break three Spire wardens', need: 3, points: 200,
    evt: 'spireClear',
    match: function (d) { return !!d && Number(d.floor) > 0 && Number(d.floor) % 10 === 0; } },
];


/* ---------------------------------------------------------------------------
 * PASS — the Ascension Path, exactly CONFIG.economy.passLevels (50).
 *
 * Entirely free. There is no paid track, no season, and nothing here expires;
 * this is the game's whole answer to monetisation, alongside the Jade shelf.
 * CONFIG.economy.passPointsPerLevel = 100, fed by Pass.addPoints().
 *
 * `rewards` is an Econ.grantAll object. Three keys are NOT Econ kinds and are
 * skipped by grantAll for the Pass module to handle itself:
 *   blueprint:'<id>'   curio:'<id>'   passAttempt:n
 * `passAttempt` is a flag the Cultivation module reads as +1 breakthrough pill
 * attempt for the day; it lands on levels 15 and 35.
 *
 * SCALING: Spiritstone roughly x1.16 per level (800 at L1 to ~2.4M at L49),
 * which tracks the material shop curve. Levels 10/20/30/40/50 are the
 * milestones — big jade plus a permanent item.
 * TOTAL FREE JADE: 820 across the full path.
 * ------------------------------------------------------------------------ */
DATA.pass = [
  { lvl: 1,  rewards: { stone: 800 } },
  { lvl: 2,  rewards: { stone: 1000, 'herb:1': 6 } },
  { lvl: 3,  rewards: { stone: 1200, tech: 150 } },
  { lvl: 4,  rewards: { stone: 1500, insight: 1 } },
  { lvl: 5,  rewards: { stone: 1800, jade: 20 } },
  { lvl: 6,  rewards: { stone: 2200, 'core:1': 4 } },
  { lvl: 7,  rewards: { stone: 2600, guide: 1 } },
  { lvl: 8,  rewards: { stone: 3000, stones: 150 } },
  { lvl: 9,  rewards: { stone: 3600, dust: 40 } },
  { lvl: 10, rewards: { stone: 12000, jade: 60, guide: 2, blueprint: 'bp_r2_pendant' } },

  { lvl: 11, rewards: { stone: 5000, 'herb:2': 8 } },
  { lvl: 12, rewards: { stone: 6000, tech: 400 } },
  { lvl: 13, rewards: { stone: 7000, citrine: 60 } },
  { lvl: 14, rewards: { stone: 8500, insight: 2 } },
  { lvl: 15, rewards: { stone: 10000, passAttempt: 1 } },
  { lvl: 16, rewards: { stone: 12000, 'core:2': 6 } },
  { lvl: 17, rewards: { stone: 14000, jade: 25 } },
  { lvl: 18, rewards: { stone: 17000, dust: 60 } },
  { lvl: 19, rewards: { stone: 20000, guide: 2 } },
  { lvl: 20, rewards: { stone: 40000, jade: 90, insight: 4, blueprint: 'bp_r3_relic' } },

  { lvl: 21, rewards: { stone: 28000, 'forge:3': 8 } },
  { lvl: 22, rewards: { stone: 33000, tech: 1200 } },
  { lvl: 23, rewards: { stone: 39000, stones: 600 } },
  { lvl: 24, rewards: { stone: 46000, jade: 30 } },
  { lvl: 25, rewards: { stone: 55000, insight: 3 } },
  { lvl: 26, rewards: { stone: 65000, 'herb:3': 10 } },
  { lvl: 27, rewards: { stone: 78000, citrine: 200 } },
  { lvl: 28, rewards: { stone: 92000, dust: 120 } },
  { lvl: 29, rewards: { stone: 110000, guide: 3 } },
  { lvl: 30, rewards: { stone: 120000, jade: 120, guide: 4, curio: 'cu_compass' } },

  { lvl: 31, rewards: { stone: 150000, 'core:4': 8 } },
  { lvl: 32, rewards: { stone: 175000, tech: 4000 } },
  { lvl: 33, rewards: { stone: 205000, stones: 1800 } },
  { lvl: 34, rewards: { stone: 240000, jade: 35 } },
  { lvl: 35, rewards: { stone: 280000, passAttempt: 1 } },
  { lvl: 36, rewards: { stone: 330000, insight: 4 } },
  { lvl: 37, rewards: { stone: 385000, citrine: 420 } },
  { lvl: 38, rewards: { stone: 450000, 'forge:4': 12 } },
  { lvl: 39, rewards: { stone: 525000, guide: 4 } },
  { lvl: 40, rewards: { stone: 400000, jade: 160, dust: 300, blueprint: 'bp_r5_armor' } },

  { lvl: 41, rewards: { stone: 700000, dust: 260 } },
  { lvl: 42, rewards: { stone: 800000, tech: 12000 } },
  { lvl: 43, rewards: { stone: 920000, 'herb:5': 12 } },
  { lvl: 44, rewards: { stone: 1050000, jade: 40 } },
  { lvl: 45, rewards: { stone: 1200000, stones: 5000 } },
  { lvl: 46, rewards: { stone: 1400000, insight: 6 } },
  { lvl: 47, rewards: { stone: 1600000, citrine: 900 } },
  { lvl: 48, rewards: { stone: 1850000, 'core:5': 10 } },
  { lvl: 49, rewards: { stone: 2100000, guide: 5 } },
  { lvl: 50, rewards: { stone: 1200000, jade: 240, guide: 6, lawShard: 4,
                        blueprint: 'bp_r6_weapon', curio: 'cu_key' } },
];


/* ---------------------------------------------------------------------------
 * SAMSARA TREE — 10 permanent rebirth nodes.
 *
 * Bought with Samsara Marks, which survive every cycle. `cost` is the price of
 * ONE level of that node; `max` is its level cap. Costs escalate across the
 * tree rather than within a node, so the cheap idle nodes fill out early and
 * the last three are genuine multi-cycle goals.
 *
 * `key` is either a Stats.bonus() key from CONTRACT §7 (aura, btChance,
 * offlineHours, pillAttempts, allStat, expedition, respiraExp) or one of the
 * three Samsara-only channels the rebirth module resolves itself:
 *   stoneGain   multiplier on every Spiritstone grant
 *   jadeGain    multiplier on every Fate Jade grant
 *   startRealm  realm index the next cycle begins at
 *
 * `val` is per level and additive: sam_aura at level 7 is +35% aura.
 * FULL TREE COST: 1*10 + 2*10 + 2*8 + 3*8 + 3*10 + 4*8 + 5*6 + 6*5 + 8*5
 *                 + 14*2 = 260 Marks.
 *
 * id convention: 'sam_<slug>'.
 * ------------------------------------------------------------------------ */
DATA.samsaraTree = [
  { id: 'sam_aura', name: 'Unbroken Breath', max: 10, cost: 1, key: 'aura', val: 0.05,
    desc: 'The lungs of your last life were good lungs. Keep them. +5% aura per level.' },

  { id: 'sam_allstat', name: 'Body Remembered', max: 10, cost: 2, key: 'allStat', val: 0.04,
    desc: 'Muscle you never grew still knows what it was for. +4% to every stat per level.' },

  { id: 'sam_respira', name: 'Wisp-Wise', max: 8, cost: 2, key: 'respiraExp', val: 0.06,
    desc: 'You have seen this trick before and your hand is already moving. +6% respira EXP per level.' },

  { id: 'sam_bt', name: 'Familiar Thresholds', max: 8, cost: 3, key: 'btChance', val: 0.02,
    desc: 'Every door you now face is a door you have already walked through once. +2% breakthrough chance per level.' },

  { id: 'sam_stone', name: 'Old Debts Repaid', max: 10, cost: 3, key: 'stoneGain', val: 0.08,
    desc: 'Somebody in the ledger office still owes the previous you. +8% Spiritstone gain per level.' },

  { id: 'sam_expedition', name: 'Roads Already Walked', max: 8, cost: 4, key: 'expedition', val: 0.07,
    desc: 'You send the party out and, uncannily, you know where the good ground is. +7% expedition yield per level.' },

  { id: 'sam_offline', name: 'The Long Nap', max: 6, cost: 5, key: 'offlineHours', val: 1,
    desc: 'A soul this old can idle for days without losing the thread. +1 hour of offline cap per level.' },

  { id: 'sam_pill', name: 'Second Stomach', max: 5, cost: 6, key: 'pillAttempts', val: 1,
    desc: 'Cinnabar stopped frightening you three lifetimes ago. +1 daily pill attempt per level.' },

  { id: 'sam_jade', name: 'Heaven\'s Tithe, Reduced', max: 5, cost: 8, key: 'jadeGain', val: 0.05,
    desc: 'Heaven keeps a smaller cut from a customer this loyal. +5% Fate Jade gain per level.' },

  { id: 'sam_start', name: 'Head Start', max: 2, cost: 14, key: 'startRealm', val: 1,
    desc: 'Begin the next cycle one realm along — at cap, all the way to Foundation, with the leaks already sealed.' },
];

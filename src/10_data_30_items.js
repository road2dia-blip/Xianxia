/* ============================================================================
 * EVERDAO — ITEM DATA
 * Pill formulas, gear bases, relics, the affix pool, and craft blueprints.
 *
 * Pure data. No top-level references to any other module (CONTRACT §1).
 * The only new top-level binding this file introduces is `fmlBuild`.
 *
 * Shapes are fixed by CONTRACT §9:
 *   DATA.formulas   = [{ id, rank, type, name, emoji, desc, cost, craftSec }]  // 48
 *   DATA.gearBases  = [{ id, slot, rank, name, emoji, main:{stat,val} }]       // 54
 *   DATA.relics     = [{ id, kind, rank, name, emoji, effect:{key,val} }]      // 18
 *   DATA.affixes    = [{ key, name, min, max, pct }]                           // 16
 *   DATA.blueprints = [{ id, rank, slot, name }]                               // 24
 * ==========================================================================*/


/* ---------------------------------------------------------------------------
 * FORMULAS — 6 ranks x 8 types = 48.
 *
 * id convention: 'r<rank>_<type>', rank 1..6, type one of
 *   exp | vital | mind | bt | meridian | ward | fury | bait
 * (matching CONFIG.alchemy.ranks = 6). Pill inventory keys are
 * `${formulaId}_${qualityName}`, e.g. 'r2_exp_blue'.
 *
 * Material tier always equals the formula rank, so an Rank-4 pill eats T4 herbs
 * and T4 cores — Econ kinds 'herb:4' / 'core:4'.
 *
 * COSTS: stone = 150 * 4.5^(rank-1) * typeMult, then snapped to a round number.
 * That is a deliberate ~x4.5 per rank so late-rank alchemy stays a real sink
 * rather than pocket change. Herb/core counts creep by +2/+1 every two ranks.
 *
 * CRAFT TIME: typeBase * (1 + 0.28*(rank-1)), clamped into
 * [CONFIG.alchemy.craftMinSec 120, CONFIG.alchemy.craftMaxSec 1200].
 * EXP pills are the fast bread-and-butter craft (130s -> 312s); breakthrough
 * pills are the slow prestige craft (480s -> 1152s).
 *
 * Names and descriptions are hand-written per rank+type and live in the tables
 * below; only the numbers are generated.
 * ------------------------------------------------------------------------ */
function fmlBuild() {

  /* per-type economics: cost weight, material appetite, base craft seconds */
  const TYPES = {
    exp:      { emoji: '💊', stoneMul: 1.00, herb: 4, core: 1, sec: 130 },
    vital:    { emoji: '🔴', stoneMul: 1.70, herb: 6, core: 3, sec: 320 },
    mind:     { emoji: '🔵', stoneMul: 1.70, herb: 6, core: 3, sec: 320 },
    bt:       { emoji: '🟣', stoneMul: 2.40, herb: 8, core: 4, sec: 480 },
    meridian: { emoji: '🟢', stoneMul: 0.80, herb: 3, core: 1, sec: 150 },
    ward:     { emoji: '🛡️', stoneMul: 1.10, herb: 4, core: 2, sec: 190 },
    fury:     { emoji: '🔥', stoneMul: 1.10, herb: 4, core: 2, sec: 190 },
    bait:     { emoji: '🍯', stoneMul: 0.70, herb: 5, core: 1, sec: 240 },
  };

  const ORDER = ['exp', 'vital', 'mind', 'bt', 'meridian', 'ward', 'fury', 'bait'];

  const NAMES = {
    exp: [
      'Dew-Gathering Pill',
      'Slow Morning Pill',
      'Nine-Breath Cinnabar',
      'Pill of the Borrowed Decade',
      'Amber Hour Elixir',
      'Pill of the Folded Year',
    ],
    vital: [
      'Ox-Marrow Powder',
      'Iron Bough Powder',
      'Red Root Draught',
      'Mountain-Keeping Powder',
      'Powder of the Unbent Spine',
      'Adamant Marrow Cinnabar',
    ],
    mind: [
      'Clear Well Elixir',
      'Quiet Lantern Elixir',
      'Blue Silence Elixir',
      'Elixir of the Wide Room',
      'Starwater Elixir',
      'Elixir of the Unclouded Mirror',
    ],
    bt: [
      'Threshold Pill',
      'Door-Opening Pill',
      'Pill of the Kind Omen',
      'Heaven-Softening Pill',
      'Pill of the Ninth Knock',
      'Pill of the Willing Sky',
    ],
    meridian: [
      'Green Channel Pill',
      'Running Creek Pill',
      'Pill of the Unblocked Road',
      'Silver Meridian Draught',
      'Pill of the Turning Tide',
      'Pill of the Endless Spring',
    ],
    ward: [
      'Turtle-Shell Lozenge',
      'Grey Wall Pill',
      'Pill of the Patient Shell',
      'Storm-Eaves Pill',
      'Pill of the Unmoved Gate',
      'Pill of the Sky-Bearing Roof',
    ],
    fury: [
      'Hot Ash Pill',
      'Snapping Wire Pill',
      'Pill of the Short Temper',
      'Red Tiger Pill',
      'Pill of the Loosed Arrow',
      'Pill of the Falling Mountain',
    ],
    bait: [
      'Sweet Smoke Pellet',
      'Beast-Calling Pellet',
      'Pellet of the Wrong Turn',
      'Honeyed Ruin Pellet',
      'Pellet of the Generous Wilds',
      'Pellet of the Open Hand',
    ],
  };

  const DESCS = {
    exp: [
      'Compressed dawn dew that tastes of wet stone and buys you a morning you did not have to sit through.',
      'A slow, generous pill that unspools an hour of quiet cultivation across the tongue.',
      'Nine breaths of cinnabar smoke, folded flat and swallowed whole.',
      'Somebody meditated for a decade so that you would not have to; be grateful, briefly.',
      'Amber that kept an hour of one sun-drenched afternoon, and gives it back on request.',
      'A whole year folded down to the size of a thumbnail, and exactly as heavy as that sounds.',
    ],
    vital: [
      'Ground ox marrow and river salt — crude, gritty, and permanently good for you.',
      'Powdered ironwood bough that settles into the bones and quietly refuses to leave.',
      'A red root draught that thickens the blood until blows begin to feel like weather.',
      'Take it once and the mountain lends you a little of its refusal to move.',
      'Your spine stops asking permission and simply holds, for the rest of this realm at least.',
      'Adamant marrow, ruinously expensive, and the last honest upgrade a body can be given.',
    ],
    mind: [
      'Clear well water reduced to a single bright bead; the noise in your head drops a floor.',
      'A quiet lantern lit somewhere behind the eyes, and it does not gutter.',
      'Blue silence in a bottle — thoughts arrive one at a time and wait their turn.',
      'The room your spirit lives in gets permanently wider, and the echo improves.',
      'Starwater drawn on a cloudless night, deepening the well your spells are dipped from.',
      'The mirror behind your thoughts is polished until nothing at all can cling to it.',
    ],
    bt: [
      'Steadies the hands at the threshold, which is most of what a threshold asks for.',
      'The door was never locked, but this pill knows which way it opens.',
      'Bends the omens a shade kinder without ever letting Heaven notice it happened.',
      'Softens the sky until the lightning arrives as a stern lecture rather than a verdict.',
      'For the ninth knock, after the eight before it went unanswered.',
      'Heaven does not consent so much as stop objecting, and this is what buys the silence.',
    ],
    meridian: [
      'Clears the small green channels so qi stops pooling where it ought to be flowing.',
      'Mid-fight, it turns a dry streambed back into a running creek.',
      'The road through you was blocked; this pill removes the cart.',
      'A silver draught that floods the meridians back to useful depth in one swallow.',
      'The tide inside you turns on command, which is a rude thing to ask of a tide.',
      'A spring that does not know how to stop, poured into a body that will have to cope.',
    ],
    ward: [
      'Chalky and slow to melt; for a while, hits land like someone knocking politely.',
      'The world goes grey, flat, and — importantly — much further away.',
      'You are not faster, braver, or cleverer, merely a great deal harder to open.',
      'Rain falls on the eaves instead of on you, and the storm may complain about it.',
      'The gate does not argue with the battering ram; it declines to be a door today.',
      'Hold up one hand and the sky agrees, briefly, to rest on that instead of you.',
    ],
    fury: [
      'Hot ash on the tongue and a very bad idea blooming in the chest.',
      'Something inside you snaps taut and hums for the whole length of the fight.',
      'Your temper gets shorter, your reach gets longer, and neither is negotiable.',
      'The red tiger wakes up behind your ribs, and it did not sleep well.',
      'Everything you have been holding back is released at once, in one direction.',
      'For one battle you stop striking and simply arrive, the way a mountain arrives.',
    ],
    bait: [
      'Sweet smoke that beasts find fascinating and everyone downwind finds tedious.',
      'Burn it at the treeline and the wilds come walking toward you with full pockets.',
      'Convinces something large that the road it wanted was, in fact, this one.',
      'Honeyed and faintly wrong; ruins shut for centuries begin to feel hospitable.',
      'The wilds turn generous for two hours, the longest they have ever managed it.',
      'Everything within a day of you decides, all at once, to bring you a gift.',
    ],
  };

  /* snap costs to human-readable round numbers at every magnitude */
  const snap = (v) => {
    if (v < 100)    return Math.round(v / 5) * 5;
    if (v < 1000)   return Math.round(v / 10) * 10;
    if (v < 10000)  return Math.round(v / 50) * 50;
    if (v < 100000) return Math.round(v / 500) * 500;
    return Math.round(v / 5000) * 5000;
  };

  const out = [];
  for (let rank = 1; rank <= 6; rank++) {
    const stoneRank = 150 * Math.pow(4.5, rank - 1);
    const step = Math.floor((rank - 1) / 2);      // 0,0,1,1,2,2
    for (let i = 0; i < ORDER.length; i++) {
      const type = ORDER[i];
      const t = TYPES[type];
      const cost = { stone: snap(stoneRank * t.stoneMul) };
      cost['herb:' + rank] = t.herb + step * 2;
      cost['core:' + rank] = t.core + step;
      const sec = Math.min(1200, Math.max(120, Math.round(t.sec * (1 + 0.28 * (rank - 1)))));
      out.push({
        id: 'r' + rank + '_' + type,
        rank: rank,
        type: type,
        name: NAMES[type][rank - 1],
        emoji: t.emoji,
        desc: DESCS[type][rank - 1],
        cost: cost,
        craftSec: sec,
      });
    }
  }
  return out;
}

DATA.formulas = fmlBuild();


/* ---------------------------------------------------------------------------
 * GEAR BASES — 3 slots x 6 ranks x 3 variants = 54.
 *
 * id convention: 'g_<slot>_r<rank>_<v>' with v = 1|2|3.
 *
 * `main.val` is the RAW base roll. The Forge multiplies it by rarity, enhance
 * level (CONFIG.forge.enhancePerLevel) and refine stars, so these numbers are
 * intentionally modest. Scale is x2.6 per rank from a Rank-1 weapon of 30 ATK;
 * the other stats sit at the same relative weight as CONFIG.baseStats
 * (hp x12, def x0.55, spd x0.73, mp x3.3 against ATK).
 *
 * Variant spread, so every rank offers a real choice:
 *   weapon   v1 patk · v2 matk · v3 the heavy/odd one (x1.12, alternating stat)
 *   armor    v1 hp   · v2 pdef · v3 the heavy/odd one (x1.15, alternating stat)
 *   pendant  v1 mdef · v2 spd  · v3 mp
 * ------------------------------------------------------------------------ */
DATA.gearBases = [
  /* --- WEAPONS -------------------------------------------------------- */
  { id: 'g_weapon_r1_1', slot: 'weapon', rank: 1, name: 'Chipped Creek Sabre',        emoji: '⚔️', main: { stat: 'patk', val: 30 } },
  { id: 'g_weapon_r1_2', slot: 'weapon', rank: 1, name: 'Reed-Bundle Wand',           emoji: '🪄', main: { stat: 'matk', val: 30 } },
  { id: 'g_weapon_r1_3', slot: 'weapon', rank: 1, name: 'Farmhand Iron Bar',          emoji: '🔨', main: { stat: 'patk', val: 34 } },

  { id: 'g_weapon_r2_1', slot: 'weapon', rank: 2, name: 'Grey Heron Blade',           emoji: '⚔️', main: { stat: 'patk', val: 78 } },
  { id: 'g_weapon_r2_2', slot: 'weapon', rank: 2, name: 'Ash-Stem Rod',               emoji: '🪄', main: { stat: 'matk', val: 78 } },
  { id: 'g_weapon_r2_3', slot: 'weapon', rank: 2, name: 'Kiln-Grey Censer',           emoji: '🕯️', main: { stat: 'matk', val: 87 } },

  { id: 'g_weapon_r3_1', slot: 'weapon', rank: 3, name: 'Nine-Notch Sabre',           emoji: '⚔️', main: { stat: 'patk', val: 203 } },
  { id: 'g_weapon_r3_2', slot: 'weapon', rank: 3, name: 'Rainwriting Staff',          emoji: '🪄', main: { stat: 'matk', val: 203 } },
  { id: 'g_weapon_r3_3', slot: 'weapon', rank: 3, name: 'Hound-Tooth Maul',           emoji: '🔨', main: { stat: 'patk', val: 227 } },

  { id: 'g_weapon_r4_1', slot: 'weapon', rank: 4, name: 'Lantern-Cut Longblade',      emoji: '⚔️', main: { stat: 'patk', val: 527 } },
  { id: 'g_weapon_r4_2', slot: 'weapon', rank: 4, name: 'Staff of the Quiet Argument', emoji: '🪄', main: { stat: 'matk', val: 527 } },
  { id: 'g_weapon_r4_3', slot: 'weapon', rank: 4, name: 'Bell of the Second Moon',    emoji: '🔔', main: { stat: 'matk', val: 590 } },

  { id: 'g_weapon_r5_1', slot: 'weapon', rank: 5, name: 'Sky-Splitting Fang',         emoji: '⚔️', main: { stat: 'patk', val: 1371 } },
  { id: 'g_weapon_r5_2', slot: 'weapon', rank: 5, name: 'Rod of the Hollow Star',     emoji: '🪄', main: { stat: 'matk', val: 1371 } },
  { id: 'g_weapon_r5_3', slot: 'weapon', rank: 5, name: 'Halberd of the Late Answer', emoji: '🪓', main: { stat: 'patk', val: 1535 } },

  { id: 'g_weapon_r6_1', slot: 'weapon', rank: 6, name: 'Edge That Remembers Rain',   emoji: '⚔️', main: { stat: 'patk', val: 3564 } },
  { id: 'g_weapon_r6_2', slot: 'weapon', rank: 6, name: 'Staff of the Unwritten Page', emoji: '🪄', main: { stat: 'matk', val: 3564 } },
  { id: 'g_weapon_r6_3', slot: 'weapon', rank: 6, name: 'Thunder-Kept Seal',          emoji: '🧿', main: { stat: 'matk', val: 3992 } },

  /* --- ARMOR ---------------------------------------------------------- */
  { id: 'g_armor_r1_1', slot: 'armor', rank: 1, name: 'Padded Roadcloth',             emoji: '🧥', main: { stat: 'hp',   val: 360 } },
  { id: 'g_armor_r1_2', slot: 'armor', rank: 1, name: 'Boiled Leather Vest',          emoji: '🥋', main: { stat: 'pdef', val: 16 } },
  { id: 'g_armor_r1_3', slot: 'armor', rank: 1, name: 'Cart-Plank Cuirass',           emoji: '🪵', main: { stat: 'pdef', val: 18 } },

  { id: 'g_armor_r2_1', slot: 'armor', rank: 2, name: 'Robe of Warm Millet',          emoji: '🧥', main: { stat: 'hp',   val: 936 } },
  { id: 'g_armor_r2_2', slot: 'armor', rank: 2, name: 'Grey Scale Jerkin',            emoji: '🥋', main: { stat: 'pdef', val: 42 } },
  { id: 'g_armor_r2_3', slot: 'armor', rank: 2, name: 'Mantle of the Long Walk',      emoji: '🧣', main: { stat: 'hp',   val: 1076 } },

  { id: 'g_armor_r3_1', slot: 'armor', rank: 3, name: 'Cloudweave Robe',              emoji: '🧥', main: { stat: 'hp',   val: 2434 } },
  { id: 'g_armor_r3_2', slot: 'armor', rank: 3, name: 'Riverstone Brigandine',        emoji: '🥋', main: { stat: 'pdef', val: 108 } },
  { id: 'g_armor_r3_3', slot: 'armor', rank: 3, name: 'Turtle-Ridge Plate',           emoji: '🐢', main: { stat: 'pdef', val: 124 } },

  { id: 'g_armor_r4_1', slot: 'armor', rank: 4, name: 'Robe of the Slow Wound',       emoji: '🧥', main: { stat: 'hp',   val: 6327 } },
  { id: 'g_armor_r4_2', slot: 'armor', rank: 4, name: 'Moonlit Lamellar',             emoji: '🥋', main: { stat: 'pdef', val: 281 } },
  { id: 'g_armor_r4_3', slot: 'armor', rank: 4, name: 'Mantle of Nine Hearths',       emoji: '🧣', main: { stat: 'hp',   val: 7276 } },

  { id: 'g_armor_r5_1', slot: 'armor', rank: 5, name: 'Vestment of the Standing Pine', emoji: '🧥', main: { stat: 'hp',   val: 16451 } },
  { id: 'g_armor_r5_2', slot: 'armor', rank: 5, name: 'Cuirass of the Unlit Forge',   emoji: '🥋', main: { stat: 'pdef', val: 731 } },
  { id: 'g_armor_r5_3', slot: 'armor', rank: 5, name: 'Bulwark of the Patient Shell', emoji: '🛡️', main: { stat: 'pdef', val: 841 } },

  { id: 'g_armor_r6_1', slot: 'armor', rank: 6, name: 'Robe of the Unhurried Sky',    emoji: '🧥', main: { stat: 'hp',   val: 42773 } },
  { id: 'g_armor_r6_2', slot: 'armor', rank: 6, name: 'Aegis of the Last Terrace',    emoji: '🥋', main: { stat: 'pdef', val: 1901 } },
  { id: 'g_armor_r6_3', slot: 'armor', rank: 6, name: 'Mantle of the Kept Year',      emoji: '🧣', main: { stat: 'hp',   val: 49189 } },

  /* --- PENDANTS ------------------------------------------------------- */
  { id: 'g_pendant_r1_1', slot: 'pendant', rank: 1, name: 'Knotted Grass Charm',          emoji: '📿', main: { stat: 'mdef', val: 16 } },
  { id: 'g_pendant_r1_2', slot: 'pendant', rank: 1, name: 'Swallow-Feather Cord',         emoji: '🪶', main: { stat: 'spd',  val: 22 } },
  { id: 'g_pendant_r1_3', slot: 'pendant', rank: 1, name: 'Hollow Bean Gourd',            emoji: '🫙', main: { stat: 'mp',   val: 100 } },

  { id: 'g_pendant_r2_1', slot: 'pendant', rank: 2, name: 'Ward of Blue Thread',          emoji: '📿', main: { stat: 'mdef', val: 42 } },
  { id: 'g_pendant_r2_2', slot: 'pendant', rank: 2, name: 'Anklet of Small Hurry',        emoji: '🪶', main: { stat: 'spd',  val: 57 } },
  { id: 'g_pendant_r2_3', slot: 'pendant', rank: 2, name: 'Gourd of the Second Cup',      emoji: '🫙', main: { stat: 'mp',   val: 260 } },

  { id: 'g_pendant_r3_1', slot: 'pendant', rank: 3, name: 'Talisman of the Shut Ear',     emoji: '📿', main: { stat: 'mdef', val: 108 } },
  { id: 'g_pendant_r3_2', slot: 'pendant', rank: 3, name: 'Cord of the Skipping Stone',   emoji: '🪶', main: { stat: 'spd',  val: 149 } },
  { id: 'g_pendant_r3_3', slot: 'pendant', rank: 3, name: 'Vial of the Deep Well',        emoji: '🫙', main: { stat: 'mp',   val: 676 } },

  { id: 'g_pendant_r4_1', slot: 'pendant', rank: 4, name: 'Seal of the Silent Argument',  emoji: '📿', main: { stat: 'mdef', val: 281 } },
  { id: 'g_pendant_r4_2', slot: 'pendant', rank: 4, name: 'Bell of Quick Feet',           emoji: '🪶', main: { stat: 'spd',  val: 387 } },
  { id: 'g_pendant_r4_3', slot: 'pendant', rank: 4, name: 'Gourd of the Standing Tide',   emoji: '🫙', main: { stat: 'mp',   val: 1758 } },

  { id: 'g_pendant_r5_1', slot: 'pendant', rank: 5, name: 'Ward of the Nine Refusals',    emoji: '📿', main: { stat: 'mdef', val: 731 } },
  { id: 'g_pendant_r5_2', slot: 'pendant', rank: 5, name: 'Ribbon of the Falling Leaf',   emoji: '🪶', main: { stat: 'spd',  val: 1005 } },
  { id: 'g_pendant_r5_3', slot: 'pendant', rank: 5, name: 'Phial of the Blue Reservoir',  emoji: '🫙', main: { stat: 'mp',   val: 4570 } },

  { id: 'g_pendant_r6_1', slot: 'pendant', rank: 6, name: 'Talisman of the Closed Question', emoji: '📿', main: { stat: 'mdef', val: 1901 } },
  { id: 'g_pendant_r6_2', slot: 'pendant', rank: 6, name: 'Cord of the Unspent Breath',   emoji: '🪶', main: { stat: 'spd',  val: 2614 } },
  { id: 'g_pendant_r6_3', slot: 'pendant', rank: 6, name: 'Gourd of the Uncounted Sea',   emoji: '🫙', main: { stat: 'mp',   val: 11881 } },
];


/* ---------------------------------------------------------------------------
 * RELICS — 18: 6 offensive, 6 defensive, 6 utility, one of each per rank.
 *
 * id convention: 'rl_<kind>_r<rank>'. Three relic sockets exist
 * (CONFIG.forge.relicSlots = relicA/relicB/relicC), unlocked at
 * CONFIG.unlocks.relics (Nascent Soul), so a full set is any three of these.
 *
 * `effect.key` is a Stats.bonus() key from CONTRACT §7 and every value is a
 * multiplier fraction — the Forge feeds them straight into its Stats provider.
 * Between them the eighteen cover every bonus a relic ought to touch: the six
 * combat stats, the four combat modifiers, and the six idle/economy dials.
 * ------------------------------------------------------------------------ */
DATA.relics = [
  /* --- OFFENSIVE ------------------------------------------------------ */
  { id: 'rl_off_r1', kind: 'off', rank: 1, name: 'Chipped Duelist Coin',      emoji: '🪙', effect: { key: 'crit',      val: 0.03 } },
  { id: 'rl_off_r2', kind: 'off', rank: 2, name: 'Knuckle of the Stone Ox',   emoji: '🦴', effect: { key: 'patk',      val: 0.06 } },
  { id: 'rl_off_r3', kind: 'off', rank: 3, name: 'Tooth of the Last Wolf',    emoji: '🐺', effect: { key: 'critDmg',   val: 0.18 } },
  { id: 'rl_off_r4', kind: 'off', rank: 4, name: 'Ever-Wet Cinnabar Bead',    emoji: '🩸', effect: { key: 'lifesteal', val: 0.05 } },
  { id: 'rl_off_r5', kind: 'off', rank: 5, name: 'Ash of a Burned Sutra',     emoji: '📜', effect: { key: 'matk',      val: 0.12 } },
  { id: 'rl_off_r6', kind: 'off', rank: 6, name: 'Lantern That Keeps the Dead', emoji: '🏮', effect: { key: 'thrall',  val: 0.30 } },

  /* --- DEFENSIVE ------------------------------------------------------ */
  { id: 'rl_def_r1', kind: 'def', rank: 1, name: 'Belt Buckle of an Old Soldier', emoji: '🪢', effect: { key: 'hp',    val: 0.06 } },
  { id: 'rl_def_r2', kind: 'def', rank: 2, name: 'Riverbed Turtle Scute',     emoji: '🐢', effect: { key: 'pdef',      val: 0.08 } },
  { id: 'rl_def_r3', kind: 'def', rank: 3, name: 'Feather of the Unhit Crane', emoji: '🪶', effect: { key: 'dodge',    val: 0.04 } },
  { id: 'rl_def_r4', kind: 'def', rank: 4, name: 'Bell of the Standing Ward', emoji: '🔔', effect: { key: 'shield',    val: 0.10 } },
  { id: 'rl_def_r5', kind: 'def', rank: 5, name: 'Bead of the Shut Ear',      emoji: '📿', effect: { key: 'mdef',      val: 0.12 } },
  { id: 'rl_def_r6', kind: 'def', rank: 6, name: 'Root of the Mountain That Waited', emoji: '🪨', effect: { key: 'hp',  val: 0.18 } },

  /* --- UTILITY -------------------------------------------------------- */
  { id: 'rl_util_r1', kind: 'util', rank: 1, name: 'Cup of the Long Morning',   emoji: '🍵', effect: { key: 'aura',       val: 0.05 } },
  { id: 'rl_util_r2', kind: 'util', rank: 2, name: 'Compass of the Wrong Road', emoji: '🧭', effect: { key: 'expedition', val: 0.10 } },
  { id: 'rl_util_r3', kind: 'util', rank: 3, name: 'Wisp Kept in Amber',        emoji: '🫧', effect: { key: 'respiraExp', val: 0.12 } },
  { id: 'rl_util_r4', kind: 'util', rank: 4, name: 'Mortar of the Patient Valley', emoji: '⚗️', effect: { key: 'pillExp', val: 0.15 } },
  { id: 'rl_util_r5', kind: 'util', rank: 5, name: 'Omen-Reading Tortoise Plate', emoji: '🐚', effect: { key: 'btChance', val: 0.05 } },
  { id: 'rl_util_r6', kind: 'util', rank: 6, name: 'Shelf of Small Impossible Things', emoji: '🗝️', effect: { key: 'curioPower', val: 0.20 } },
];


/* ---------------------------------------------------------------------------
 * AFFIXES — 16, the whole roll pool for crafted gear.
 *
 * CONFIG.forge.rarityAffixes = [1,1,2,3,4], so a gold piece pulls four of
 * these. `key` is a Stats.bonus() key (CONTRACT §7).
 *
 *   pct:true   -> min/max are fractions, used as-is (crit 0.01 = +1% crit).
 *   pct:false  -> min/max are RANK-1 base numbers; the Forge scales them by the
 *                 item rank the same way it scales gear base values.
 *
 * Ten percentage affixes (the interesting ones) against six flat stat affixes
 * (the reliable ones), which keeps most rolls exciting without letting a gray
 * Rank-6 hat out-stat a purple.
 * ------------------------------------------------------------------------ */
DATA.affixes = [
  /* --- percentage rolls ----------------------------------------------- */
  { key: 'crit',       name: 'Keen Eye',              min: 0.01, max: 0.06, pct: true },
  { key: 'critDmg',    name: 'Cruel Follow-Through',  min: 0.04, max: 0.20, pct: true },
  { key: 'lifesteal',  name: 'Red Thirst',            min: 0.01, max: 0.05, pct: true },
  { key: 'dodge',      name: 'Loose Footing',         min: 0.01, max: 0.05, pct: true },
  { key: 'shield',     name: 'Standing Ward',         min: 0.02, max: 0.09, pct: true },
  { key: 'thrall',     name: 'Bound Shade',           min: 0.03, max: 0.12, pct: true },
  { key: 'aura',       name: 'Deep Breath',           min: 0.01, max: 0.05, pct: true },
  { key: 'respiraExp', name: 'Wisp-Touched',          min: 0.02, max: 0.08, pct: true },
  { key: 'expedition', name: 'Far Wandering',         min: 0.02, max: 0.10, pct: true },
  { key: 'pillExp',    name: 'Sweet Digestion',       min: 0.02, max: 0.10, pct: true },

  /* --- flat rolls (scaled by item rank in the Forge) ------------------- */
  { key: 'hp',         name: 'Stout Frame',           min: 40,   max: 140,  pct: false },
  { key: 'patk',       name: 'Heavy Hand',            min: 4,    max: 14,   pct: false },
  { key: 'matk',       name: 'Bright Intent',         min: 4,    max: 14,   pct: false },
  { key: 'pdef',       name: 'Thick Hide',            min: 3,    max: 9,    pct: false },
  { key: 'mdef',       name: 'Quiet Mind',            min: 3,    max: 9,    pct: false },
  { key: 'spd',        name: 'Quick Step',            min: 2,    max: 7,    pct: false },
];


/* ---------------------------------------------------------------------------
 * BLUEPRINTS — 24: 3 gear slots x 6 ranks, plus one relic sheet per rank.
 *
 * id convention: 'bp_r<rank>_<slot>' with slot in weapon|armor|pendant|relic.
 * Owning a blueprint (S.inv.blueprints) is what lets the Forge roll that
 * slot at that rank; the specific base among the rank's three variants is
 * chosen at craft time.
 * ------------------------------------------------------------------------ */
DATA.blueprints = [
  /* --- WEAPON --------------------------------------------------------- */
  { id: 'bp_r1_weapon', rank: 1, slot: 'weapon', name: 'Charcoal Rubbing of a Creek Sabre' },
  { id: 'bp_r2_weapon', rank: 2, slot: 'weapon', name: 'Heron Blade Pattern Sheet' },
  { id: 'bp_r3_weapon', rank: 3, slot: 'weapon', name: 'Nine-Notch Cutting Diagram' },
  { id: 'bp_r4_weapon', rank: 4, slot: 'weapon', name: 'Lantern-Cut Folding Scroll' },
  { id: 'bp_r5_weapon', rank: 5, slot: 'weapon', name: 'Fang Pattern of the Split Sky' },
  { id: 'bp_r6_weapon', rank: 6, slot: 'weapon', name: 'Rain-Memory Edge Codex' },

  /* --- ARMOR ---------------------------------------------------------- */
  { id: 'bp_r1_armor',  rank: 1, slot: 'armor',  name: 'Roadcloth Stitching Notes' },
  { id: 'bp_r2_armor',  rank: 2, slot: 'armor',  name: 'Scale Jerkin Tally-Sheet' },
  { id: 'bp_r3_armor',  rank: 3, slot: 'armor',  name: 'Cloudweave Loom Chart' },
  { id: 'bp_r4_armor',  rank: 4, slot: 'armor',  name: 'Slow Wound Robe Diagram' },
  { id: 'bp_r5_armor',  rank: 5, slot: 'armor',  name: 'Standing Pine Plating Codex' },
  { id: 'bp_r6_armor',  rank: 6, slot: 'armor',  name: 'Unhurried Sky Weave Codex' },

  /* --- PENDANT -------------------------------------------------------- */
  { id: 'bp_r1_pendant', rank: 1, slot: 'pendant', name: 'Grass Knot Instructions' },
  { id: 'bp_r2_pendant', rank: 2, slot: 'pendant', name: 'Blue Thread Ward Chart' },
  { id: 'bp_r3_pendant', rank: 3, slot: 'pendant', name: 'Shut Ear Talisman Tracing' },
  { id: 'bp_r4_pendant', rank: 4, slot: 'pendant', name: 'Silent Argument Seal Scroll' },
  { id: 'bp_r5_pendant', rank: 5, slot: 'pendant', name: 'Nine Refusals Ward Codex' },
  { id: 'bp_r6_pendant', rank: 6, slot: 'pendant', name: 'Closed Question Talisman Codex' },

  /* --- RELIC ---------------------------------------------------------- */
  { id: 'bp_r1_relic',  rank: 1, slot: 'relic',  name: 'Reliquary Tracing of a Cracked Coin' },
  { id: 'bp_r2_relic',  rank: 2, slot: 'relic',  name: 'Reliquary Tracing of a Grave Bell' },
  { id: 'bp_r3_relic',  rank: 3, slot: 'relic',  name: 'Reliquary Codex: The Unblinking Eye' },
  { id: 'bp_r4_relic',  rank: 4, slot: 'relic',  name: 'Reliquary Codex: The Kept Vow' },
  { id: 'bp_r5_relic',  rank: 5, slot: 'relic',  name: 'Reliquary Codex: The Ninth Ash' },
  { id: 'bp_r6_relic',  rank: 6, slot: 'relic',  name: 'Reliquary Codex: The Whole Sky' },
];

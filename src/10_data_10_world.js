/* ============================================================================
 * EVERDAO — WORLD DATA
 * Realms, Laws, Sects, Titles, and the rival-name generator tables.
 *
 * Pure data. No top-level references to any other module (CONTRACT §1).
 * Shapes are fixed by CONTRACT §9:
 *   DATA.realms = [{ i, name, era, desc }]                    // 12
 *   DATA.laws   = [{ id, name, emoji, color, desc }]          // 5
 *   DATA.sects  = [{ id, name, emoji, blurb, bonus, library }]// 3
 *   DATA.titles = [{ id, name, req }]                         // 18
 *   DATA.names  = { surnames, givens, epithets }              // 20/24/16
 * ==========================================================================*/


/* ---------------------------------------------------------------------------
 * REALMS — 12 majors, index 0..11.
 *
 * Index order is load-bearing: it lines up with
 *   CONFIG.cultivation.req.realmMult[]   (12 entries)
 *   CONFIG.breakthrough.benchmarkBR[]    (12 entries)
 *   CONFIG.cultivation.maxRealm = 11
 * Each major realm holds 9 minor phases (CONFIG.cultivation.phasesPerRealm).
 *
 * Eras are the two ascension gates — CONFIG.breakthrough.eraAscensionRealms
 * = [5, 9], i.e. Incarnation -> Voidbreak crosses into the Spirit Era and
 * Nirvana -> Celestial crosses into the Immortal Era. Realms 0-2 break through
 * on a chance roll (CONFIG.breakthrough.chanceRealmMax); 3+ face tribulation.
 * ------------------------------------------------------------------------ */
DATA.realms = [
  { i: 0,  name: 'Novice',       era: 'Mortal',
    desc: 'Qi is still a rumour you can almost feel, so you sit very still, breathe slightly wrong, and get stronger anyway.' },

  { i: 1,  name: 'Connection',   era: 'Mortal',
    desc: 'The world finally answers when you knock — badly, briefly, and never twice the same way.' },

  { i: 2,  name: 'Foundation',   era: 'Mortal',
    desc: 'Your meridians stop leaking, and the ground underfoot begins to feel like it belongs to you.' },

  { i: 3,  name: 'Virtuoso',     era: 'Mortal',
    desc: 'Technique becomes handwriting; a stranger can name you from the shape of a single strike.' },

  { i: 4,  name: 'Nascent Soul', era: 'Mortal',
    desc: 'A second, smaller self takes up residence behind your ribs and offers unsolicited advice at inconvenient hours.' },

  { i: 5,  name: 'Incarnation',  era: 'Mortal',
    desc: 'Your intent arrives before your body does, and mortals step out of the way without ever knowing why they moved.' },

  { i: 6,  name: 'Voidbreak',    era: 'Spirit',
    desc: 'You crack the ceiling every mortal mistook for the sky, and the draught coming through it is very cold.' },

  { i: 7,  name: 'Wholeness',    era: 'Spirit',
    desc: 'Body, soul, and stubbornness finish their long argument and agree, at last, to be one thing.' },

  { i: 8,  name: 'Perfection',   era: 'Spirit',
    desc: 'Nothing about you is unfinished, which turns out to be a lonelier condition than it sounds.' },

  { i: 9,  name: 'Nirvana',      era: 'Spirit',
    desc: 'You burn away everything you used to be, and whatever walks out of the ash has kept the good parts.' },

  { i: 10, name: 'Celestial',    era: 'Immortal',
    desc: 'Heaven begins writing your name into its ledgers, and that particular ink is famously expensive.' },

  { i: 11, name: 'Eternal',      era: 'Immortal',
    desc: 'Time stops being a river you swim and becomes a room you can stroll around in.' },
];


/* ---------------------------------------------------------------------------
 * LAWS — 5, one per element on CONFIG.combat.elementWheel
 * (blaze > wood > thunder > frost > blade > blaze).
 *
 * A Law is chosen once at CONFIG.law.unlockRealm (Voidbreak) and levelled with
 * Law Shards to CONFIG.law.maxLevel. It procs on rounds 4, 8, 12...
 * (CONFIG.law.procRound). Each `desc` restates CONFIG.law.effects in plain
 * words for the UI — if that block is retuned, retune these strings with it.
 * `color` is a UI accent hex, kept close to the §5 palette.
 * ------------------------------------------------------------------------ */
DATA.laws = [
  { id: 'blaze',
    name: 'Law of the Patient Ember',
    emoji: '🔥',
    color: '#e07a4a',
    desc: 'When the Law stirs, the foe catches fire and burns for 8% of your ATK at the end of each of the next 3 rounds.' },

  { id: 'frost',
    name: 'Law of Hushed Water',
    emoji: '❄️',
    color: '#5aa9e0',
    desc: 'When the Law stirs, the foe stiffens and loses 30% of its SPD for 2 rounds.' },

  { id: 'thunder',
    name: 'Law of the Split Sky',
    emoji: '⚡',
    color: '#e8c76a',
    desc: 'When the Law stirs, there is a 25% chance the foe is stunned and forfeits its turn entirely.' },

  { id: 'wood',
    name: 'Law of the Returning Root',
    emoji: '🌿',
    color: '#5fd07a',
    desc: 'When the Law stirs, you knit yourself back together for 12% of your maximum HP.' },

  { id: 'blade',
    name: 'Law of the Undrawn Edge',
    emoji: '🗡️',
    color: '#9fb3cc',
    desc: 'When the Law stirs, your very next hit lands at 2.2x damage.' },
];


/* ---------------------------------------------------------------------------
 * SECTS — 3. Joinable at CONFIG.sect.unlockRealm (Foundation).
 *
 * `bonus.key` must be a Stats.bonus() key from CONTRACT §7; the sect module
 * registers it through Stats.provider(). This is the sect's *identity* bonus
 * and stacks on top of the rank perks in CONFIG.sect.ranks.
 *
 * `library` lists the shop item ids that only this sect sells (contribution
 * store). Convention: 'lib_<sectId>_<n>', n from 1. The shops content file
 * declares the same ids — keep the two lists in step.
 * ------------------------------------------------------------------------ */
DATA.sects = [
  {
    id: 'azure',
    name: 'Azure Blade Sect',
    emoji: '⚔️',
    blurb: 'Three thousand disciples and exactly one opinion: the answer is a sword, and the question was probably rude. They describe Verdant Pill Valley as a very well-funded kitchen, and they do not mean it kindly.',
    bonus: { key: 'patk', val: 0.10 },
    library: ['lib_azure_1', 'lib_azure_2', 'lib_azure_3', 'lib_azure_4'],
  },
  {
    id: 'verdant',
    name: 'Verdant Pill Valley',
    emoji: '⚗️',
    blurb: 'The Valley holds that any problem worth having is worth simmering for six hours first. They will cheerfully stitch an Azure Blade disciple back together and then invoice his sect for the thread.',
    bonus: { key: 'alchemyQuality', val: 0.12 },
    library: ['lib_verdant_1', 'lib_verdant_2', 'lib_verdant_3', 'lib_verdant_4'],
  },
  {
    id: 'umbral',
    name: 'Umbral Veil',
    emoji: '🌑',
    blurb: 'The Veil keeps no gate, publishes no roster, and somehow always knows which ruin is worth opening this season. The other two sects maintain that it does not exist, an arrangement the Veil finds ideal.',
    bonus: { key: 'expedition', val: 0.15 },
    library: ['lib_umbral_1', 'lib_umbral_2', 'lib_umbral_3', 'lib_umbral_4'],
  },
];


/* ---------------------------------------------------------------------------
 * TITLES — 18, purely cosmetic name-plate flavour.
 *
 * `req` is display copy for the picker; the actual unlock check lives in the
 * title system, keyed off `id`. ids follow 't_<slug>'.
 * ------------------------------------------------------------------------ */
DATA.titles = [
  { id: 't_firstbreath',  name: 'First Clean Breath',        req: 'Reach Connection' },
  { id: 't_stonefoot',    name: 'Stone-Footed',              req: 'Reach Foundation' },
  { id: 't_handwriting',  name: 'Legible at Twenty Paces',   req: 'Reach Virtuoso' },
  { id: 't_smallself',    name: 'Host to a Smaller Self',    req: 'Reach Nascent Soul' },
  { id: 't_knocked',      name: 'The One Who Knocked',       req: 'Reach Voidbreak' },
  { id: 't_ashwalker',    name: 'Kept the Good Parts',       req: 'Reach Nirvana' },
  { id: 't_undated',      name: 'Undated',                   req: 'Reach Eternal' },
  { id: 't_stair100',     name: 'The Hundredth Stair',       req: 'Clear Spire 100' },
  { id: 't_spireroof',    name: 'Sat on the Spire Roof',     req: 'Clear Spire 200' },
  { id: 't_shelf',        name: 'Shelf of Odd Things',       req: 'Own 12 curios' },
  { id: 't_nothingleft',  name: 'Nothing Left to Covet',     req: 'Own all 24 curios' },
  { id: 't_insufferable', name: 'Rank One and Insufferable', req: 'Reach duel rank 1' },
  { id: 't_tideturner',   name: 'Turned the Tide, Politely', req: 'Full-clear a Beast Tide' },
  { id: 't_yellowhand',   name: 'Yellow-Fingered',           req: 'Refine a Yellow-quality pill' },
  { id: 't_tensparks',    name: 'Ten Thousand Sparks',       req: 'Forge 100 pieces of gear' },
  { id: 't_lawsworn',     name: 'Sworn to a Single Law',     req: 'Raise a Law to level 20' },
  { id: 't_bruised',      name: 'Bruised but Present',       req: 'Fail 10 breakthroughs' },
  { id: 't_seconddraft',  name: 'Second Draft',              req: 'Complete a Samsara cycle' },
];


/* ---------------------------------------------------------------------------
 * NAMES — the duel-rival generator (CONFIG.duel.npcCount = 200 rivals).
 *
 * The duel module seeds names deterministically with U.hash + U.rngFrom so the
 * ladder is stable across reloads. Surname x given = 480 base names; attaching
 * one of 16 optional epithets lifts that to 8,160 distinct plates, which is
 * ample for a 200-slot ladder plus season churn.
 * ------------------------------------------------------------------------ */
DATA.names = {
  surnames: [
    'Shen',
    'Mo',
    'Yun',
    'Ruan',
    'Qiao',
    'Bai',
    'Cang',
    'Luo',
    'Xie',
    'Tan',
    'Zhuo',
    'Yi',
    'Hua',
    'Wen',
    'Sui',
    'Jiao',
    'Lian',
    'Nuo',
    'Gu',
    'Xu',
  ],

  givens: [
    'Qingzhi',
    'Wanyu',
    'Beiran',
    'Shulan',
    'Yizhen',
    'Muxue',
    'Tingfeng',
    'Anluo',
    'Zhaowen',
    'Xinyao',
    'Ruoyan',
    'Hanzhu',
    'Jiuyin',
    'Feiling',
    'Suqing',
    'Lanshi',
    'Chenwu',
    'Yaoguang',
    'Pingsheng',
    'Mingzhao',
    'Weilan',
    'Zisu',
    'Haoran',
    'Nianci',
  ],

  epithets: [
    'the Unswept',
    'Nine-Cup',
    'of the Late Frost',
    'the Twice-Drowned',
    'Half-a-Sword',
    'of the Borrowed Name',
    'the Politely Cruel',
    'Thrice-Struck',
    'of the Empty Gourd',
    'Lantern-in-Rain',
    'the Slow Hand',
    'of the Ninth Terrace',
    'the Unsleeping',
    'Two-Coin',
    'of the Quiet Ledger',
    'the Unpaid',
  ],
};

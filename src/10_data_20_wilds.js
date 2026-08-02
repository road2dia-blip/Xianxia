/* ============================================================================
 * EVERDAO — DATA: THE WILDS
 * Zones, monsters, monster skills, Demon Spire bosses, Beast Tide boons.
 *
 * Pure data. No cross-module references at top level. The only top-level
 * bindings introduced here are the `wilds*` builder functions, which are
 * hoisted function declarations invoked immediately below their tables.
 *
 * ID CONVENTIONS
 *   monsters      m_<slug>        e.g. m_kilnToad
 *   monsterSkills bare verbs      heavyBlow, poisonSpit, ... (fixed set of 12)
 *   zones         z1..z6          mortal zones, unlocked by realm 0..5
 *                 sz1..sz6        Spirit-era remixes of the same ground
 *   tideBoons     tb_<key><n>     e.g. tb_atk1, tb_atk2
 *
 * MONSTER POOLS (10 each, grouped so a zone can draw thematically)
 *   pool 1  ridge / meadow      wood + plain beasts
 *   pool 2  mistwood            wood + frost, fungus and fog
 *   pool 3  cloudmere           thunder + frost, things with wings
 *   pool 4  starfall plain      blade + thunder, buried sky-iron
 *   pool 5  violet brook        wood + frost casters, drowned shrines
 *   pool 6  ashen steppe        blaze + blade, kiln and cinder
 * ==========================================================================*/

/* ---------------------------------------------------------------------------
 * MONSTER SKILLS — exactly 12. `effect` is a small declarative object that
 * 40_combat.js reads directly. Keys used here, and nowhere else:
 *   dot:'poison', pct, rounds      damage over time, pct of caster ATK
 *   atkDown / rounds               target attack debuff
 *   defUp / rounds                 self defence buff
 *   drain                          fraction of damage dealt healed back
 *   atkUp / stacking               self attack buff, refreshes and stacks
 *   split                          on first cast, spawn a half-strength copy
 *   healPct                        heal an ally for pct of its max HP
 *   stun                           chance the target loses its next turn
 *   spdDown / rounds               speed debuff
 *   healCut / rounds               target's incoming healing reduced
 *   enrageBelow / atkUp            below that HP fraction, gain that attack
 * ------------------------------------------------------------------------ */
DATA.monsterSkills = [
  { id:'heavyBlow', name:'Sundering Blow', kind:'phys',  mult:1.9, target:'one',
    effect:{ stun:0.15 } },
  { id:'poisonSpit', name:'Venom Spit', kind:'magic', mult:1.0, target:'one',
    effect:{ dot:'poison', pct:0.04, rounds:3 } },
  { id:'howl', name:'Marrow Howl', kind:'magic', mult:0.8, target:'all',
    effect:{ atkDown:0.20, rounds:2 } },
  { id:'harden', name:'Stonehide', kind:'phys', mult:0.8, target:'self',
    effect:{ defUp:0.35, rounds:3 } },
  { id:'drain', name:'Marrow Siphon', kind:'magic', mult:1.3, target:'one',
    effect:{ drain:0.5 } },
  { id:'frenzy', name:'Blood Frenzy', kind:'phys', mult:1.1, target:'self',
    effect:{ atkUp:0.15, stacking:true } },
  { id:'split', name:'Sunder Spawn', kind:'phys', mult:0.9, target:'one',
    effect:{ split:true } },
  { id:'heal', name:'Mending Chant', kind:'magic', mult:0.8, target:'ally',
    effect:{ healPct:0.25 } },
  { id:'stunBite', name:'Nerve Bite', kind:'phys', mult:1.4, target:'one',
    effect:{ stun:0.30 } },
  { id:'web', name:'Silk Snare', kind:'magic', mult:0.9, target:'all',
    effect:{ spdDown:0.30, rounds:2 } },
  { id:'curse', name:'Withering Mark', kind:'magic', mult:1.2, target:'one',
    effect:{ healCut:0.5, rounds:3 } },
  { id:'enrage', name:'Death Throes', kind:'phys', mult:1.6, target:'self',
    effect:{ enrageBelow:0.3, atkUp:0.6 } },
];

/* ---------------------------------------------------------------------------
 * MONSTERS — 60, ten per pool.
 * ------------------------------------------------------------------------ */
DATA.monsters = [

  /* -- pool 1: Foxglove Ridge — sunny slopes, tall flowers, small teeth ---- */
  { id:'m_foxkit',      name:'Foxglove Kit',           emoji:'🦊', element:'wood',    role:'swift',   skill:'drain' },
  { id:'m_beeSwarm',    name:'Nectar-Drunk Swarm',     emoji:'🐝', element:'wood',    role:'swift',   skill:'split' },
  { id:'m_stoneHare',   name:'Stone-Eared Hare',       emoji:'🐇', element:null,      role:'swift',   skill:'frenzy' },
  { id:'m_thistleBoar', name:'Thistle-Backed Boar',    emoji:'🐗', element:'wood',    role:'bruiser', skill:'heavyBlow' },
  { id:'m_pollenSprite',name:'Pollen Sprite',          emoji:'🌼', element:'wood',    role:'caster',  skill:'poisonSpit' },
  { id:'m_pebbleCrab',  name:'Pebble-Shell Crab',      emoji:'🦀', element:null,      role:'bruiser', skill:'harden' },
  { id:'m_grassAdder',  name:'Sun-Warmed Adder',       emoji:'🐍', element:'wood',    role:'swift',   skill:'poisonSpit' },
  { id:'m_shepherdDog', name:"Cairn Shepherd's Hound", emoji:'🐕', element:null,      role:'bruiser', skill:'howl' },
  { id:'m_lanternMoth', name:'Dusk Lantern Moth',      emoji:'🦋', element:'blaze',   role:'caster',  skill:'curse' },
  { id:'m_hillMagpie',  name:'Coin-Thief Magpie',      emoji:'🐦', element:'thunder', role:'swift',   skill:'stunBite' },

  /* -- pool 2: Mistwood — damp bark, spores, things that echo -------------- */
  { id:'m_capFungus',   name:'Whisper-Cap Fungus',     emoji:'🍄', element:'wood',    role:'caster',  skill:'split' },
  { id:'m_mistWisp',    name:'Mistwood Wisp',          emoji:'👻', element:'frost',   role:'caster',  skill:'curse' },
  { id:'m_barkStag',    name:'Bark-Antlered Stag',     emoji:'🦌', element:'wood',    role:'bruiser', skill:'harden' },
  { id:'m_hollowMonk',  name:'Hollow-Robed Pilgrim',   emoji:'🧟', element:null,      role:'bruiser', skill:'enrage' },
  { id:'m_dewSpider',   name:'Dew-Weaver Spider',      emoji:'🕷️', element:'wood',    role:'swift',   skill:'web' },
  { id:'m_rimeCrow',    name:'Rime-Feathered Crow',    emoji:'🪶', element:'frost',   role:'swift',   skill:'drain' },
  { id:'m_rootLurker',  name:'Root-Knuckle Lurker',    emoji:'🌳', element:null,      role:'bruiser', skill:'heavyBlow' },
  { id:'m_fogEel',      name:'Fog-Swimming Eel',       emoji:'🐟', element:'frost',   role:'swift',   skill:'stunBite' },
  { id:'m_sporeHermit', name:'Spore-Bearded Hermit',   emoji:'🧓', element:'wood',    role:'caster',  skill:'heal' },
  { id:'m_hoarGoat',    name:'Hoarfrost Goat',         emoji:'🐐', element:'frost',   role:'bruiser', skill:'frenzy' },

  /* -- pool 3: Cloudmere — a lake that thinks it is a sky ------------------ */
  { id:'m_cloudCrane',  name:'Cloudmere Crane',        emoji:'🕊️', element:'thunder', role:'swift',   skill:'howl' },
  { id:'m_thunderCarp', name:'Thunder-Whiskered Carp', emoji:'🐠', element:'thunder', role:'caster',  skill:'drain' },
  { id:'m_stormMonkey', name:'Storm-Tailed Gibbon',    emoji:'🐒', element:'thunder', role:'swift',   skill:'frenzy' },
  { id:'m_mirrorTurtle',name:'Mirror-Shell Terrapin',  emoji:'🐢', element:'frost',   role:'bruiser', skill:'harden' },
  { id:'m_gustHawk',    name:'Gale-Riding Hawk',       emoji:'🦅', element:'thunder', role:'swift',   skill:'stunBite' },
  { id:'m_veilHeron',   name:'Veil-Winged Heron',      emoji:'🦢', element:'frost',   role:'caster',  skill:'poisonSpit' },
  { id:'m_paperKite',   name:'Paper Kite Sentinel',    emoji:'🪁', element:'thunder', role:'caster',  skill:'curse' },
  { id:'m_hailRam',     name:'Hailstone Ram',          emoji:'🐏', element:'frost',   role:'bruiser', skill:'heavyBlow' },
  { id:'m_ferryGhost',  name:'Lake-Ferry Revenant',    emoji:'👤', element:'frost',   role:'caster',  skill:'heal' },
  { id:'m_boltSerpent', name:'Bolt-Scaled Serpent',    emoji:'🐉', element:'thunder', role:'bruiser', skill:'enrage' },

  /* -- pool 4: Starfall Plain — furrows of warm sky-iron ------------------- */
  { id:'m_ironLocust',  name:'Starfall Locust',        emoji:'🦗', element:'blade',   role:'swift',   skill:'split' },
  { id:'m_slagGolem',   name:'Slag-Fed Golem',         emoji:'🗿', element:'blade',   role:'bruiser', skill:'harden' },
  { id:'m_cometHound',  name:'Comet-Ash Hound',        emoji:'☄️',  element:'blaze',   role:'swift',   skill:'frenzy' },
  { id:'m_shardWraith', name:'Shard-Bone Wraith',      emoji:'💀', element:'blade',   role:'caster',  skill:'curse' },
  { id:'m_meteorBeetle',name:'Meteor-Rind Beetle',     emoji:'🪲', element:'blade',   role:'bruiser', skill:'heavyBlow' },
  { id:'m_quillArcher', name:'Quill-Fletch Marksman',  emoji:'🏹', element:'blade',   role:'swift',   skill:'stunBite' },
  { id:'m_dustDjinn',   name:'Dust-Column Djinn',      emoji:'🌪️', element:'thunder', role:'caster',  skill:'drain' },
  { id:'m_starGrub',    name:'Star-Iron Grub',         emoji:'🐛', element:'blade',   role:'bruiser', skill:'split' },
  { id:'m_cinderMason', name:'Cinder Mason',           emoji:'🧱', element:'blaze',   role:'bruiser', skill:'howl' },
  { id:'m_nightWatcher',name:'Nine-Eyed Watcher',      emoji:'👁️', element:'thunder', role:'caster',  skill:'web' },

  /* -- pool 5: Violet Brook — purple water, drowned shrines ---------------- */
  { id:'m_violetLeech', name:'Violet-Brook Leech',     emoji:'🪱', element:'wood',    role:'swift',   skill:'drain' },
  { id:'m_lanternWraith',name:'Paper Lantern Wraith',  emoji:'🏮', element:'blaze',   role:'caster',  skill:'curse' },
  { id:'m_inkCarp',     name:'Ink-Bellied Carp',       emoji:'🐡', element:'frost',   role:'swift',   skill:'poisonSpit' },
  { id:'m_bridgeOgre',  name:'Bridge-Toll Ogre',       emoji:'👹', element:null,      role:'bruiser', skill:'heavyBlow' },
  { id:'m_widowOrchid', name:'Widow Orchid',           emoji:'🌺', element:'wood',    role:'caster',  skill:'web' },
  { id:'m_drownedFlute',name:'Drowned Flutist',        emoji:'🎐', element:'frost',   role:'caster',  skill:'heal' },
  { id:'m_brookScorpion',name:'Brook-Stone Scorpion',  emoji:'🦂', element:'blade',   role:'swift',   skill:'poisonSpit' },
  { id:'m_silkNun',     name:'Silk-Veiled Almswoman',  emoji:'🧕', element:'frost',   role:'swift',   skill:'web' },
  { id:'m_mireBadger',  name:'Mire-Coat Badger',       emoji:'🦡', element:'wood',    role:'bruiser', skill:'frenzy' },
  { id:'m_lotusHead',   name:'Severed Lotus Head',     emoji:'🏵️', element:'wood',    role:'caster',  skill:'split' },

  /* -- pool 6: Ashen Steppe — grey glass over a living kiln ---------------- */
  { id:'m_kilnToad',    name:'Kiln-Bellied Toad',      emoji:'🐸', element:'blaze',   role:'bruiser', skill:'heavyBlow' },
  { id:'m_ashJackal',   name:'Ash-Ribbed Jackal',      emoji:'🐺', element:'blaze',   role:'swift',   skill:'frenzy' },
  { id:'m_emberBat',    name:'Ember-Gorged Bat',       emoji:'🦇', element:'blaze',   role:'swift',   skill:'drain' },
  { id:'m_cinderMonk',  name:'Cinder-Palm Monk',       emoji:'🧘', element:'blaze',   role:'bruiser', skill:'enrage' },
  { id:'m_slagCrab',    name:'Slagshell Lobster',      emoji:'🦞', element:'blade',   role:'bruiser', skill:'harden' },
  { id:'m_grudgeCandle',name:'Grudge-Wick Candle',     emoji:'🕯️', element:'blaze',   role:'caster',  skill:'curse' },
  { id:'m_boneKite',    name:'Bone-Rattle Kite',       emoji:'🦴', element:'blade',   role:'caster',  skill:'split' },
  { id:'m_furnaceOx',   name:'Furnace-Hearted Ox',     emoji:'🐂', element:'blaze',   role:'bruiser', skill:'howl' },
  { id:'m_ashCroc',     name:'Ash-Wallow Crocodile',   emoji:'🐊', element:'blade',   role:'swift',   skill:'stunBite' },
  { id:'m_pyreShaman',  name:'Pyre-Ash Shaman',        emoji:'🧙', element:'blaze',   role:'caster',  skill:'heal' },
];

/* ---------------------------------------------------------------------------
 * ZONES — 6 mortal (z1..z6) + 6 Spirit-era remixes (sz1..sz6).
 * Each zone is 40 stages with a boss on every 10th; the `boss` entry is the
 * template the Wilds module scales for stages 10/20/30/40. `tier` drives the
 * material tier that drops (herb/core/forge tier === zone tier).
 * Remix zones are gated at realm 6 and multiplied by
 * CONFIG.wilds.spiritRemixMult.
 * ------------------------------------------------------------------------ */

function wildsMortalZones() {
  return [
    {
      id:'z1', name:'Foxglove Ridge', emoji:'🌸', realm:0, tier:1,
      blurb:'Bee-loud slopes where the foxglove grows tall enough to hide a fox, and usually does.',
      monsters:[
        'm_foxkit','m_beeSwarm','m_stoneHare','m_thistleBoar','m_pollenSprite',
        'm_pebbleCrab','m_grassAdder','m_shepherdDog','m_lanternMoth','m_hillMagpie',
        'm_capFungus','m_hoarGoat',
      ],
      boss:{
        name:'Grandmother Foxglove', emoji:'🦊', element:'wood', role:'caster', skill:'curse',
        blurb:'She has sold herbs on this ridge since before the ridge had a name, and she remembers every customer.',
      },
    },
    {
      id:'z2', name:'Mistwood', emoji:'🌫️', realm:1, tier:2,
      blurb:'A forest that exhales all morning and never quite gets around to inhaling.',
      monsters:[
        'm_capFungus','m_mistWisp','m_barkStag','m_hollowMonk','m_dewSpider',
        'm_rimeCrow','m_rootLurker','m_fogEel','m_sporeHermit','m_hoarGoat',
        'm_grassAdder','m_pebbleCrab',
      ],
      boss:{
        name:'The Antler-Crowned Sleeper', emoji:'🦌', element:'frost', role:'bruiser', skill:'harden',
        blurb:'It has slept in the same hollow for four hundred years and has strong opinions about footsteps.',
      },
    },
    {
      id:'z3', name:'Cloudmere', emoji:'☁️', realm:2, tier:3,
      blurb:'A lake so still that the clouds mistake it for sky and wade in up to their knees.',
      monsters:[
        'm_cloudCrane','m_thunderCarp','m_stormMonkey','m_mirrorTurtle','m_gustHawk',
        'm_veilHeron','m_paperKite','m_hailRam','m_ferryGhost','m_boltSerpent',
        'm_rimeCrow','m_mistWisp',
      ],
      boss:{
        name:'The Ninefold Storm Carp', emoji:'🐉', element:'thunder', role:'bruiser', skill:'heavyBlow',
        blurb:'It failed the Dragon Gate nine times and has taken each failure extremely personally.',
      },
    },
    {
      id:'z4', name:'Starfall Plain', emoji:'☄️', realm:3, tier:4,
      blurb:'Old sky-iron lies here in long furrows, still warm nine hundred years after the fall.',
      monsters:[
        'm_ironLocust','m_slagGolem','m_cometHound','m_shardWraith','m_meteorBeetle',
        'm_quillArcher','m_dustDjinn','m_starGrub','m_cinderMason','m_nightWatcher',
        'm_boltSerpent','m_gustHawk',
      ],
      boss:{
        name:'The Iron-Rain Marshal', emoji:'⚔️', element:'blade', role:'bruiser', skill:'heavyBlow',
        blurb:'He commands an army of one and has never yet needed a second.',
      },
    },
    {
      id:'z5', name:'Violet Brook', emoji:'🌊', realm:4, tier:5,
      blurb:'The water runs purple past the drowned shrines, and it is considered rude to ask why.',
      monsters:[
        'm_violetLeech','m_lanternWraith','m_inkCarp','m_bridgeOgre','m_widowOrchid',
        'm_drownedFlute','m_brookScorpion','m_silkNun','m_mireBadger','m_lotusHead',
        'm_shardWraith','m_dewSpider',
      ],
      boss:{
        name:'The Brook Bride', emoji:'🏮', element:'frost', role:'caster', skill:'curse',
        blurb:'She waits at the ford in red silk for a groom who drowned before the wedding, and she is not fussy about substitutes.',
      },
    },
    {
      id:'z6', name:'Ashen Steppe', emoji:'🏜️', realm:5, tier:6,
      blurb:'Grass burned down to grey glass, and something underneath it keeps breathing.',
      monsters:[
        'm_kilnToad','m_ashJackal','m_emberBat','m_cinderMonk','m_slagCrab',
        'm_grudgeCandle','m_boneKite','m_furnaceOx','m_ashCroc','m_pyreShaman',
        'm_cinderMason','m_cometHound',
      ],
      boss:{
        name:'The Cinder Patriarch', emoji:'🔥', element:'blaze', role:'bruiser', skill:'enrage',
        blurb:'He was a kiln-master once; the kiln has since won the argument.',
      },
    },
  ];
}

/* Build a Spirit-era remix from a mortal zone: same ground, same beasts,
 * realm 6 gating, tier 6 drops, and stats multiplied by the Wilds module. */
function wildsRemixZone(base, name, emoji, blurb, boss) {
  return {
    id: 's' + base.id,
    name: name,
    emoji: emoji,
    realm: 6,
    tier: 6,
    remix: true,
    blurb: blurb,
    monsters: base.monsters.slice(),
    boss: boss,
  };
}

function wildsBuildZones() {
  const mortal = wildsMortalZones();
  const remix = [
    wildsRemixZone(mortal[0], 'Foxglove Ridge, Unbound', '💮',
      'The same slopes, except the foxes bow politely before they try to eat you.',
      { name:'Grandmother Foxglove, Nine Tails Loosed', emoji:'🌕', element:'wood', role:'caster', skill:'curse',
        blurb:'The herb stall is gone; the grandmother, regrettably, is not.' }),
    wildsRemixZone(mortal[1], 'Mistwood, Unbound', '🌁',
      'The fog has learned your name and practises it back to you in your own voice.',
      { name:'The Antler Crown, Awake', emoji:'🌲', element:'frost', role:'bruiser', skill:'harden',
        blurb:'Four hundred years of sleep have left it rested, enormous, and irritable.' }),
    wildsRemixZone(mortal[2], 'Cloudmere, Unbound', '⛅',
      'The lake has stopped reflecting the sky and started reflecting what you may yet become.',
      { name:'The Ninefold Storm Carp, Ascended', emoji:'⛈️', element:'thunder', role:'bruiser', skill:'enrage',
        blurb:'On the tenth attempt it simply ate the gate.' }),
    wildsRemixZone(mortal[3], 'Starfall Plain, Unbound', '🌠',
      'The buried iron has woken and is asking, quite loudly, who else is falling.',
      { name:'The Iron-Rain Marshal, Reforged', emoji:'🌟', element:'blade', role:'bruiser', skill:'heavyBlow',
        blurb:'His army is still one, but the one has been sharpened considerably.' }),
    wildsRemixZone(mortal[4], 'Violet Brook, Unbound', '🌀',
      'The shrines are no longer drowned; they are wading upstream toward you.',
      { name:'The Brook Bride, Unveiled', emoji:'🕯️', element:'frost', role:'caster', skill:'curse',
        blurb:'She has stopped waiting at the ford and begun looking further afield.' }),
    wildsRemixZone(mortal[5], 'Ashen Steppe, Unbound', '🌋',
      'The grey glass has cracked all the way through, and the kiln beneath was never out.',
      { name:'The Cinder Patriarch, Rekindled', emoji:'👺', element:'blaze', role:'bruiser', skill:'enrage',
        blurb:'He has finished firing himself and pronounces the result acceptable.' }),
  ];
  return mortal.concat(remix);
}

DATA.zones = wildsBuildZones();

/* ---------------------------------------------------------------------------
 * DEMON SPIRE — one named tenant per tenth floor, 10 through 200.
 * `modifier` is a single string the combat engine understands:
 *   doubleSpd   the floor boss acts twice as often
 *   thorns      a share of damage dealt to it is reflected
 *   undying1    the first killing blow leaves it at 1 HP
 *   split50     it splits once at half health
 *   healAllies  it mends its escort every round
 *   enrage      it gains attack sharply once wounded
 * ------------------------------------------------------------------------ */
DATA.spireBosses = [
  { floor:10,  name:'Wick-Eater Jun',                emoji:'🕯️', modifier:'doubleSpd',
    desc:'He snuffs lamps for a living and moves at the speed of the dark that follows.' },
  { floor:20,  name:'The Thorn Abbot',               emoji:'🌵', modifier:'thorns',
    desc:'His sermon is mercifully short; the hedge he preaches from is not.' },
  { floor:30,  name:'Hundredfold Mite Lord',         emoji:'🐜', modifier:'split50',
    desc:'Cut him in half and you have merely doubled your workload, twice.' },
  { floor:40,  name:'Bellringer of the Fourth Gate', emoji:'🔔', modifier:'healAllies',
    desc:'Every toll knits shut a wound somewhere behind him, and he rings enthusiastically.' },
  { floor:50,  name:'The Red-Ledger Sinner',         emoji:'📕', modifier:'enrage',
    desc:'He keeps meticulous accounts, and your name is in the overdue column.' },
  { floor:60,  name:'Ash-Widow of the Sixth Landing',emoji:'🕷️', modifier:'undying1',
    desc:'She has already died once this evening and found the experience disagreeable.' },
  { floor:70,  name:'The Gale-Tongue Heretic',       emoji:'🌀', modifier:'doubleSpd',
    desc:'He argues faster than you can breathe and strikes faster than he argues.' },
  { floor:80,  name:'Iron Bramble Warden',           emoji:'🛡️', modifier:'thorns',
    desc:'Hitting him is a contract, and you sign it in your own blood.' },
  { floor:90,  name:'Chorus of Small Teeth',         emoji:'🦷', modifier:'split50',
    desc:'One mouth, then two, then an entire devout congregation.' },
  { floor:100, name:'The Physician Who Would Not Leave', emoji:'⚕️', modifier:'healAllies',
    desc:'He mends his patients faster than you can unmake them, then bills you for the trouble.' },
  { floor:110, name:'The Grudge-Bound General',      emoji:'💢', modifier:'enrage',
    desc:'He lost a war three centuries ago and has been in a mood about it ever since.' },
  { floor:120, name:'The Twice-Buried Magistrate',   emoji:'⚰️', modifier:'undying1',
    desc:'Both funerals were well attended; neither one entirely took.' },
  { floor:130, name:'Lightning-Sandalled Thief',     emoji:'⚡', modifier:'doubleSpd',
    desc:'You will notice your spirit stones are missing well before you notice him.' },
  { floor:140, name:'The Glass Rose Inquisitor',     emoji:'🌹', modifier:'thorns',
    desc:'Every question she asks costs the person answering a little skin.' },
  { floor:150, name:'The Myriad-Face Mummer',        emoji:'🎭', modifier:'split50',
    desc:'The troupe has no other members, and the troupe is enormous.' },
  { floor:160, name:'Cauldron Mother of the Long Boil', emoji:'🍲', modifier:'healAllies',
    desc:'She ladles courage into her brood and something considerably worse into the pot.' },
  { floor:170, name:'Scorn of the Fallen Star',      emoji:'☄️', modifier:'enrage',
    desc:'It has been burning all the way down for an age and is nowhere near finished.' },
  { floor:180, name:'The Sleepless Warden',          emoji:'👁️', modifier:'undying1',
    desc:'Kill it and it merely blinks, slowly, the way one does at bad news.' },
  { floor:190, name:'Legion of the Thin Hour',       emoji:'⏳', modifier:'split50',
    desc:'They arrive one at a time, all at once, and nobody has ever counted them twice the same.' },
  { floor:200, name:'Everdusk, Who Waits at the Top',emoji:'🌑', modifier:'undying1',
    desc:'It has watched every climber arrive and has never once had to stand up.' },
];

/* ---------------------------------------------------------------------------
 * BEAST TIDE BOONS — offered three at a time between waves.
 * `key` is what the tide module applies to the player's unit; `val` is the
 * magnitude. Two flavours of each key, a lesser and a greater.
 * ------------------------------------------------------------------------ */
DATA.tideBoons = [
  { id:'tb_atk1', name:'Whetted Intent', emoji:'⚔️', key:'atk', val:0.25,
    desc:'You sharpen your killing intent the way one sharpens a kitchen knife: often, and without ceremony.' },
  { id:'tb_atk2', name:'Ninefold Killing Will', emoji:'🗡', key:'atk', val:0.45,
    desc:'Nine old resolutions surface at once and none of them are gentle.' },
  { id:'tb_heal1', name:'Dew of the Quiet Hour', emoji:'💧', key:'heal', val:0.30,
    desc:'A palmful of dawn dew, drunk between waves, closes what the last one opened.' },
  { id:'tb_heal2', name:'Ancestral Mercy', emoji:'🌿', key:'heal', val:0.55,
    desc:'Someone long dead decides, on balance, that you have suffered enough for now.' },
  { id:'tb_shield1', name:'Paper Ward', emoji:'📜', key:'shield', val:0.5,
    desc:'One talisman, badly brushed, stubbornly refusing to tear.' },
  { id:'tb_shield2', name:'Mountain-Root Aegis', emoji:'🏔️', key:'shield', val:0.9,
    desc:'The mountain lends you its footing, on the understanding that you give it back.' },
  { id:'tb_thorns1', name:'Bramble Robe', emoji:'🌵', key:'thorns', val:0.20,
    desc:'Your outer robe grows an opinion about being grabbed.' },
  { id:'tb_thorns2', name:'Hedgehog Sutra', emoji:'🦔', key:'thorns', val:0.35,
    desc:'A short scripture on the virtue of being extremely unpleasant to bite.' },
  { id:'tb_spd1', name:'Windstep Charm', emoji:'🌬️', key:'spd', val:0.20,
    desc:'The ground agrees to hold still slightly longer than usual for you.' },
  { id:'tb_spd2', name:'Thunder-Sandal Oath', emoji:'⚡', key:'spd', val:0.35,
    desc:'You swear an oath to arrive first, and thunder witnesses it.' },
  { id:'tb_life1', name:'Crimson Thirst', emoji:'🍶', key:'lifesteal', val:0.12,
    desc:'Your meridians develop a small, polite appetite for other people.' },
  { id:'tb_life2', name:'Gluttonous Blade', emoji:'🩸', key:'lifesteal', val:0.22,
    desc:'The appetite is no longer small and has stopped being polite.' },
];

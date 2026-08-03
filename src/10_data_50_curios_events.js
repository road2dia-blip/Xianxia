/* ============================================================================
 * EVERDAO — CURIOS & FORTUITY EVENTS
 *
 * Pure data. No top-level references to any other module (CONTRACT §1), and no
 * new top-level bindings at all — both tables are plain literals assigned onto
 * the pre-declared DATA namespace.
 *
 * Shapes are fixed by CONTRACT §9:
 *   DATA.curios = [{ id, name, emoji, flavor, key, val }]                  // 24
 *   DATA.events = [{ id, title, rarity, text, choices[, steps] }]          // 30
 *
 * ID CONVENTIONS   curios  cu_<slug>      events  ev_<slug>
 * ==========================================================================*/


/* ---------------------------------------------------------------------------
 * CURIOS — exactly CONFIG.curios.total (24).
 *
 * `key` is a Stats.bonus() key from CONTRACT §7; `val` is the raw contribution
 * the Curios module feeds into Stats.provider(). Every val is a fraction
 * (+1%..+3%) EXCEPT cu_pillow, whose key `offlineHours` is a FLAT hour count.
 *
 * On top of these the collection pays set breakpoints at 6 / 12 / 18 / 24 owned
 * (CONFIG.curios.setBreakpoints / .setBonus), so the per-curio numbers are
 * deliberately small — the completed shelf is the real reward.
 *
 * KEY SPREAD (no key appears more than twice):
 *   idle loop   aura x2, respiraExp, pillExp, expedition, offlineHours
 *   progress    btChance, alchemyQuality, forgeQuality, curioPower, lawProc
 *   offence     crit, critDmg, lifesteal, patk, matk, allStat
 *   defence     hp, pdef, mdef, spd, dodge, shield, thrall
 * ------------------------------------------------------------------------ */
DATA.curios = [
  { id: 'cu_censer', name: 'Ninefold Ash Censer', emoji: '🕯️', key: 'aura', val: 0.02,
    flavor: 'It burns nothing and smokes constantly, and every hermit who has held it swears the smoke smells like their mother\'s kitchen.' },
  { id: 'cu_rainstone', name: 'Stone That Remembers Rain', emoji: '🪨', key: 'aura', val: 0.03,
    flavor: 'Dry for two hundred years, and still cool to the touch on the afternoons it intends to storm.' },
  { id: 'cu_flute', name: 'Sparrow-Bone Flute', emoji: '🎐', key: 'respiraExp', val: 0.03,
    flavor: 'It plays exactly one note, and the note arrives half a breath before you blow it.' },
  { id: 'cu_ledger', name: 'Half a Dream Ledger', emoji: '📓', key: 'pillExp', val: 0.03,
    flavor: 'Someone recorded every pill they ever swallowed and what it cost them, and the second column runs much longer than the first.' },
  { id: 'cu_compass', name: 'Compass of the Long Way Round', emoji: '🧭', key: 'expedition', val: 0.03,
    flavor: 'It always points somewhere worth going, which is almost never the way you were already headed.' },
  { id: 'cu_lintelNail', name: 'Nail from a Broken Lintel', emoji: '🔩', key: 'btChance', val: 0.02,
    flavor: 'Pulled from the one beam that survived a tribulation; the door it held up, the house behind it, and the man inside did not.' },
  { id: 'cu_wolfFang', name: 'Fang of the Politest Wolf', emoji: '🦷', key: 'crit', val: 0.02,
    flavor: 'It waited for the man to finish his sentence before it took his throat, which the survivors still describe as good manners.' },
  { id: 'cu_lastInch', name: 'Last Inch of a Famous Sword', emoji: '🗡️', key: 'critDmg', val: 0.03,
    flavor: 'The rest of the blade sits polished in a sect hall, and this is the part that did all of the work.' },
  { id: 'cu_lacquerBowl', name: 'Leech-Lacquer Bowl', emoji: '🥣', key: 'lifesteal', val: 0.02,
    flavor: 'Anything bleeding into it heals somebody, and in four centuries the bowl has never once explained who.' },
  { id: 'cu_knot', name: 'Knot Tied by a Patient Man', emoji: '🪢', key: 'allStat', val: 0.02,
    flavor: 'Forty years of idle fingers went into it, and nobody since has managed to work out where it starts.' },
  { id: 'cu_oxheart', name: 'Ox-Heart Stone', emoji: '🫀', key: 'hp', val: 0.03,
    flavor: 'Heavy, ugly, warm at every hour of the night, and it has outlived every owner who called it ugly.' },
  { id: 'cu_porterWrap', name: 'Wrapping from a Porter\'s Grip', emoji: '🧤', key: 'patk', val: 0.03,
    flavor: 'He never fought a soul — he carried impossible loads up one mountain for sixty years, and the cloth learned anyway.' },
  { id: 'cu_inkstick', name: 'Ink Stick Ground with Tears', emoji: '🖌️', key: 'matk', val: 0.03,
    flavor: 'The scholar insisted it was only rainwater, and the characters he wrote with it still smoulder faintly after dark.' },
  { id: 'cu_turtleShell', name: 'Turtle Shell with One Crack', emoji: '🐢', key: 'pdef', val: 0.02,
    flavor: 'It took a hammer blow meant for a child, and it would like everyone present to note that it only cracked.' },
  { id: 'cu_bead', name: 'Prayer Bead of Refusal', emoji: '📿', key: 'mdef', val: 0.02,
    flavor: 'Every curse laid on its wearer slid politely off and landed instead on the man who had paid for it.' },
  { id: 'cu_sandal', name: 'Sandal of the Fleeing Sage', emoji: '👡', key: 'spd', val: 0.02,
    flavor: 'He left in such a hurry that he took only the one, and every account agrees he still made excellent time.' },
  { id: 'cu_shadow', name: 'Moth-Eaten Shadow', emoji: '🌘', key: 'dodge', val: 0.02,
    flavor: 'It hangs a finger\'s width off true, so blades meant for you keep arriving a finger\'s width late.' },
  { id: 'cu_doorbar', name: 'Lacquered Door Bar', emoji: '🚪', key: 'shield', val: 0.03,
    flavor: 'It was barred against something for three nights, and on the fourth the thing outside gave up and went home.' },
  { id: 'cu_graveWhistle', name: 'Grave Whistle', emoji: '🪈', key: 'thrall', val: 0.03,
    flavor: 'Blow it once and something loyal wakes up; blow it twice and it asks you a question you would rather not answer.' },
  { id: 'cu_key', name: 'Cabinet Key with No Cabinet', emoji: '🗝️', key: 'curioPower', val: 0.03,
    flavor: 'Collectors agree the cabinet holds everything you have ever mislaid, and that nobody has ever found the wretched thing.' },
  { id: 'cu_cauldronLid', name: 'Warped Cauldron Lid', emoji: '🍲', key: 'alchemyQuality', val: 0.03,
    flavor: 'It fits no cauldron perfectly and every cauldron well enough, and pills brewed under it come out visibly pleased with themselves.' },
  { id: 'cu_anvilChip', name: 'Chip from the First Anvil', emoji: '🔨', key: 'forgeQuality', val: 0.03,
    flavor: 'A splinter of iron struck so many times over so many centuries that it now regards being struck as a discipline.' },
  { id: 'cu_halfTalisman', name: 'Rain-Split Talisman', emoji: '⛩️', key: 'lawProc', val: 0.02,
    flavor: 'Half a charm, torn straight down the middle, and whoever kept the other half is having a considerably easier life.' },
  { id: 'cu_pillow', name: 'Pillow of the Ten-Year Nap', emoji: '🛏️', key: 'offlineHours', val: 1,
    flavor: 'Hard as a brick, cold as a well, and everyone who sleeps on it wakes up somehow further along than they lay down.' },
];


/* ---------------------------------------------------------------------------
 * FORTUITY EVENTS — exactly 30.
 *
 * Rarity mix matches CONFIG.wilds.rarityWeights {C:60, R:30, E:9, M:1}:
 *   16 Common · 9 Rare · 4 Epic · 1 Mythic.
 *
 * SHAPE
 *   { id, title, rarity, text, choices:[ { label, req?, outcomes:[...] } ]
 *     [, steps:[ { title, text, choices } ] ] }
 *
 * OUTCOMES  { w, text, effects [, next] }
 *   `w` is a RELATIVE weight inside its own choice — the module normalises.
 *   CONFIG.wilds.luckOutcomeWeight nudges the better outcome by 0.4% per point
 *   of hidden Luck, so the weights here are the Luck-10 baseline.
 *   `next` is an INDEX into this event's `steps` array (0-based). Only the
 *   Mythic card uses it; every other outcome resolves and closes the card.
 *
 * EFFECTS (declarative, resolved by Wilds.applyEffects — CONTRACT §9)
 *   exp:'30m'      string = that many minutes of the player's CURRENT aura.
 *                  Always minutes, never 'h' — keeps the parser to one regex.
 *   exp:Number     flat EXP.
 *   stone / jade / tech / guide / citrine / insight   currency; NEGATIVE charges.
 *   luck:±n        hidden Luck, clamped to CONFIG.wilds.luckMin/luckMax.
 *   respiraCharge:±n
 *   'herb:2':n · 'core:3':n · 'forge:1':n · 'seed:2':n   materials, tier 1..6,
 *                  negative to consume. Always tiered — never a bare 'herb'.
 *   curio:'random' · pill:'random' · formula:'random' · blueprint:'random'
 *   fight:{ power, loot }   power is a MULTIPLIER on the player's own current
 *                  power (0.7 warm-up, 1.0 even, 1.5 a real gamble); loot is a
 *                  loot multiplier (2 = double).
 *   {}             a legal effects object meaning "nothing happens", which is
 *                  occasionally the entire point of the choice.
 *
 * `req` only GATES a choice — the Wilds module disables the button and shows
 * why. Where a gated choice is also a PURCHASE, the cost is repeated as a
 * negative effect on every outcome of that choice.
 * ------------------------------------------------------------------------ */
DATA.events = [

  /* ======================================================= COMMON (16) === */

  { id: 'ev_stele', title: 'Moss-Eaten Stele', rarity: 'C',
    text: 'A slab of black stone leans out of the grass, its inscription half eaten by moss and entirely eaten by time.',
    choices: [
      { label: 'Study it', outcomes: [
        { w: 70, effects: { exp: '30m' },
          text: 'Three characters resolve into a breathing method, and your chest agrees with every one of them.' },
        { w: 30, effects: { respiraCharge: -1 },
          text: 'You stare far too long, and something behind your eyes politely closes for the evening.' } ] },
      { label: 'Rub the inscription', outcomes: [
        { w: 1, effects: { tech: 15 },
          text: 'Charcoal and cloth take what the moss left, and the pattern is worth rather more than the stone.' } ] },
      { label: 'Walk on', outcomes: [
        { w: 1, effects: { stone: 220 },
          text: 'You leave it in peace and find a dropped purse ten paces along, which seems like a fair trade.' } ] },
    ] },

  { id: 'ev_beggarSong', title: 'The Beggar Who Sings Off-Key', rarity: 'C',
    text: 'A ragged man sits at the crossroads singing a cultivation mantra a full tone flat. It is, against all reason, still working.',
    choices: [
      { label: 'Toss him a spirit stone', req: { stone: 100 }, outcomes: [
        { w: 60, effects: { stone: -100, exp: '25m', luck: 1 },
          text: 'He sings the next verse in tune, and the tune turns out to be a breathing method.' },
        { w: 40, effects: { stone: -100, luck: 1 },
          text: 'He pockets it, bows very low, and resumes being flat.' } ] },
      { label: 'Sing along', outcomes: [
        { w: 50, effects: { exp: '15m' },
          text: 'Two wrong notes make an accidental harmony, and your qi settles like dust after rain.' },
        { w: 50, effects: { luck: 1 },
          text: 'You are genuinely terrible, and he laughs so hard that he blesses you out of pity.' } ] },
      { label: 'Correct his pitch', outcomes: [
        { w: 1, effects: { tech: 12, luck: -1 },
          text: 'He thanks you sincerely, changes nothing whatsoever, and you leave feeling obscurely worse.' } ] },
    ] },

  { id: 'ev_teahouseBet', title: 'A Wager Over Tea', rarity: 'C',
    text: 'A travelling merchant bets that you cannot guess which of three cups hides his jade ring. The cups are cheap. His smile is not.',
    choices: [
      { label: 'Play', req: { stone: 200 }, outcomes: [
        { w: 34, effects: { stone: 600 },
          text: 'You pick the middle cup for no reason you can name, and his face does something complicated.' },
        { w: 66, effects: { stone: -200 },
          text: 'The ring was under the cup you touched second, which he explains at considerable length.' } ] },
      { label: 'Ask which cup he would choose', outcomes: [
        { w: 1, effects: { exp: '10m' },
          text: 'He tells you the truth — there was never a ring — and the tea goes cold while you sit with that.' } ] },
      { label: 'Just buy the tea', req: { stone: 150 }, outcomes: [
        { w: 1, effects: { stone: -150, 'herb:1': 3 },
          text: 'The tea is honestly excellent, and he throws in a twist of the leaves for the road.' } ] },
    ] },

  { id: 'ev_fallenPeach', title: 'Windfall Peach', rarity: 'C',
    text: 'A peach strikes you on the shoulder. Looking up, you find no tree — only a very high branch of cloud.',
    choices: [
      { label: 'Eat it', outcomes: [
        { w: 70, effects: { exp: '40m' },
          text: 'It tastes like a summer somebody else had, and the sweetness keeps going long after the fruit stops.' },
        { w: 30, effects: { exp: '10m', luck: -1 },
          text: 'It is mostly stone, and you have already bitten it.' } ] },
      { label: 'Plant the pit', outcomes: [
        { w: 1, effects: { 'seed:2': 1 },
          text: 'You bury it at the roadside and pour a mouthful of water over it, which is all anyone can do.' } ] },
      { label: 'Give it to the child watching you', outcomes: [
        { w: 1, effects: { luck: 2 },
          text: 'She takes it in both hands, eats it in four bites, and tells you a secret about the road ahead.' } ] },
    ] },

  { id: 'ev_lostChild', title: 'A Child on the Wrong Road', rarity: 'C',
    text: 'A small girl walks north with great determination and no shoes. North is three days of absolutely nothing.',
    choices: [
      { label: 'Carry her back to the village', outcomes: [
        { w: 1, effects: { luck: 2, stone: 300 },
          text: 'Her grandmother presses spirit stones on you until you accept, and then presses rather more.' } ] },
      { label: 'Point her the right way', outcomes: [
        { w: 60, effects: { luck: 1 },
          text: 'She turns around without argument, which is not at all how you remember being that age.' },
        { w: 40, effects: { luck: -1 },
          text: 'She goes north anyway, and you find yourself thinking about it for the rest of the week.' } ] },
      { label: 'Ask what is north', outcomes: [
        { w: 50, effects: { exp: '20m' },
          text: 'She says "my brother," and something in the way she says it sits you down to breathe.' },
        { w: 50, effects: { 'herb:1': 2 },
          text: 'She says "flowers," and produces a fistful of extremely good ones as evidence.' } ] },
    ] },

  { id: 'ev_dryWell', title: 'The Dry Well', rarity: 'C',
    text: 'The village well has been dry since spring. The villagers have begun apologising to it.',
    choices: [
      { label: 'Climb down', outcomes: [
        { w: 60, effects: { stone: 500, 'core:1': 2 },
          text: 'Somebody\'s grandfather hid his savings down here and evidently never got round to mentioning it.' },
        { w: 40, effects: { exp: '15m' },
          text: 'Only mud — but the silence at the bottom is the best you have had all month.' } ] },
      { label: 'Send qi into the water table', outcomes: [
        { w: 70, effects: { luck: 2, exp: '20m' },
          text: 'Something far below shifts, sighs, and by evening the bucket comes up heavy again.' },
        { w: 30, effects: { respiraCharge: -1 },
          text: 'You find the water, the water finds you, and you spend an hour flat on your back in the grass.' } ] },
      { label: 'Apologise to it as well', outcomes: [
        { w: 1, effects: { luck: 1 },
          text: 'The well says nothing, but the villagers quietly decide that you are a good sort.' } ] },
    ] },

  { id: 'ev_crowLedger', title: 'Crow with a Ledger Page', rarity: 'C',
    text: 'A crow lands on the fence holding a torn page of accounts in its beak, and waits, plainly expecting a counter-offer.',
    choices: [
      { label: 'Offer it a herb', req: { 'herb:1': 1 }, outcomes: [
        { w: 1, effects: { 'herb:1': -1, tech: 20, luck: 1 },
          text: 'The trade is conducted with great formality, and the page turns out to be a technique fragment in disguise.' } ] },
      { label: 'Take it by force', outcomes: [
        { w: 50, effects: { tech: 25, luck: -2 },
          text: 'You get the page. You will also be recognised by every crow in the province for some years.' },
        { w: 50, effects: { luck: -1 },
          text: 'It swallows the page whole while maintaining eye contact, and you respect that enormously.' } ] },
      { label: 'Read it over its shoulder', outcomes: [
        { w: 1, effects: { stone: 400 },
          text: 'Someone in the next province is owed a great deal of money and has helpfully written down where.' } ] },
    ] },

  { id: 'ev_boundaryStone', title: 'Argument at the Boundary Stone', rarity: 'C',
    text: 'Two farmers are shouting at a boundary marker which has, in fairness, moved twice this century without asking anyone.',
    choices: [
      { label: 'Judge between them', outcomes: [
        { w: 50, effects: { luck: 1, stone: 250 },
          text: 'You split the difference, both men grumble, and both men pay — which is how you know it was right.' },
        { w: 50, effects: { luck: -1 },
          text: 'They now agree on precisely one thing, and that one thing is you.' } ] },
      { label: 'Move the stone back yourself', outcomes: [
        { w: 1, effects: { exp: '20m', 'seed:1': 2 },
          text: 'It takes an hour and most of your dignity, and afterwards both men throw seed at you in the good way.' } ] },
      { label: 'Keep walking', outcomes: [
        { w: 1, effects: { stone: 120 },
          text: 'You are half a li gone before the shouting fades, and there is a coin in the ditch.' } ] },
    ] },

  { id: 'ev_pillPeddler', title: 'Pill Peddler\'s Last Tray', rarity: 'C',
    text: 'He has four pills left, no licence, and a very specific interest in being out of town before dusk.',
    choices: [
      { label: 'Buy the tray', req: { stone: 800 }, outcomes: [
        { w: 55, effects: { stone: -800, pill: 'random', luck: 1 },
          text: 'One of the four is real, and the real one is better than anything he could legally have sold you.' },
        { w: 45, effects: { stone: -800, 'herb:1': 4 },
          text: 'Sugar and river clay, all four of them. The wrapping paper, you concede, is lovely.' } ] },
      { label: 'Ask what is in them', outcomes: [
        { w: 1, effects: { exp: '10m' },
          text: 'He lists nine ingredients without pausing for breath, and four of them are moods.' } ] },
      { label: 'Report him', outcomes: [
        { w: 1, effects: { stone: 200, luck: -1 },
          text: 'The town pays a bounty, and the town is extremely small about it.' } ] },
    ] },

  { id: 'ev_snakeShed', title: 'A Snake\'s Old Coat', rarity: 'C',
    text: 'A shed skin lies across the path, still holding the exact shape of the turn the snake made while leaving it.',
    choices: [
      { label: 'Gather it for the cauldron', outcomes: [
        { w: 1, effects: { 'herb:2': 3 },
          text: 'It comes up whole and dry as paper, and any alchemist worth the name would weep over it.' } ] },
      { label: 'Sit down and copy the motion', outcomes: [
        { w: 60, effects: { exp: '30m' },
          text: 'On the ninth attempt your spine finds the curve, and your meridians find it a heartbeat later.' },
        { w: 40, effects: { exp: '10m' },
          text: 'You pull something in your back that a snake, it turns out, does not have.' } ] },
      { label: 'Go looking for the snake', outcomes: [
        { w: 40, effects: { fight: { power: 0.7, loot: 1 } },
          text: 'You find it. It had been looking for you with considerably more focus.' },
        { w: 60, effects: { 'core:1': 2 },
          text: 'You find where it was, and what remains of its last opinion about a badger.' } ] },
    ] },

  { id: 'ev_rainShrine', title: 'Roadside Shrine in the Rain', rarity: 'C',
    text: 'A shrine the size of your palm, raised to a god nobody bothered to name, with one dry stick of incense left under the eave.',
    choices: [
      { label: 'Light the incense', outcomes: [
        { w: 70, effects: { luck: 2 },
          text: 'The smoke goes straight up despite the wind, which the wind appears to take personally.' },
        { w: 30, effects: { exp: '20m' },
          text: 'It burns down in four breaths, and for those four breaths the rain forgets about you entirely.' } ] },
      { label: 'Shelter there until it passes', outcomes: [
        { w: 1, effects: { exp: '25m', respiraCharge: 1 },
          text: 'You sit knee to knee with a nameless god for two hours, and neither of you says anything unnecessary.' } ] },
      { label: 'Take the incense', outcomes: [
        { w: 1, effects: { 'herb:1': 2, luck: -1 },
          text: 'It is good incense. It is also, you realise on the road, the only thing anyone had left here in years.' } ] },
    ] },

  { id: 'ev_mushroomRing', title: 'Ring of Pale Mushrooms', rarity: 'C',
    text: 'A perfect circle of white caps stands in the leaf litter, and the grass inside the circle is a full season behind the grass outside it.',
    choices: [
      { label: 'Harvest them', outcomes: [
        { w: 60, effects: { 'herb:2': 4 },
          text: 'They come up clean and heavy, and the ring closes behind your hand like water.' },
        { w: 40, effects: { 'herb:1': 2, luck: -1 },
          text: 'Half of them go to powder the instant they leave the soil, which feels distinctly like a rebuke.' } ] },
      { label: 'Sit in the middle', outcomes: [
        { w: 50, effects: { exp: '45m' },
          text: 'Time inside the ring runs slow and generous, and you get a great deal of breathing done cheaply.' },
        { w: 50, effects: { respiraCharge: -1, exp: '10m' },
          text: 'You stand up an hour later with damp knees and the strong impression of having been counted.' } ] },
      { label: 'Walk around it, carefully', outcomes: [
        { w: 1, effects: { luck: 1 },
          text: 'Whatever made the ring appreciates the courtesy, in whatever way such things appreciate anything.' } ] },
    ] },

  { id: 'ev_ferryman', title: 'The Ferryman\'s Toll', rarity: 'C',
    text: 'The river is wide, the bridge is gone, and the ferryman\'s rates discovered both of those facts well before you did.',
    choices: [
      { label: 'Pay the toll', req: { stone: 400 }, outcomes: [
        { w: 1, effects: { stone: -400, exp: '20m', luck: 1 },
          text: 'He poles you across in silence and, halfway over, mentions one thing about the far bank worth the whole fare.' } ] },
      { label: 'Walk across the water', outcomes: [
        { w: 55, effects: { exp: '35m' },
          text: 'You make it look easy, which costs more than the ferry did and buys a great deal more.' },
        { w: 45, effects: { luck: -1, exp: '5m' },
          text: 'Halfway over you remember that you cannot do this, and the river remembers along with you.' } ] },
      { label: 'Swim', outcomes: [
        { w: 1, effects: { 'core:1': 1 },
          text: 'Cold and undignified, and something down there bumps your leg and then thinks better of it.' } ] },
    ] },

  { id: 'ev_sparringMonk', title: 'A Monk Wants a Bout', rarity: 'C',
    text: 'He is sweeping the temple steps, and would very much like to stop sweeping the temple steps.',
    choices: [
      { label: 'Give him his bout', outcomes: [
        { w: 1, effects: { fight: { power: 0.8, loot: 1 }, exp: '20m' },
          text: 'He is delighted, then briefly airborne, then delighted all over again.' } ] },
      { label: 'Sweep with him instead', outcomes: [
        { w: 1, effects: { exp: '30m', luck: 1 },
          text: 'Two hours of stairs, no conversation, and somewhere around the ninetieth step your qi stops arguing.' } ] },
      { label: 'Decline politely', outcomes: [
        { w: 1, effects: { tech: 10 },
          text: 'He accepts with enormous grace and hands you a scrap of paper he has clearly been waiting to give someone.' } ] },
    ] },

  { id: 'ev_burntCaravan', title: 'Burnt Caravan', rarity: 'C',
    text: 'Three carts, burned down to the axles, and not one body — which the crows appear to have taken as a personal insult.',
    choices: [
      { label: 'Search the wreck', outcomes: [
        { w: 60, effects: { stone: 700, 'forge:2': 2 },
          text: 'The strongbox survived because it was buried under the thing that killed the fire.' },
        { w: 40, effects: { 'forge:1': 2 },
          text: 'Scrap, scrap, and one very good hinge. You take the hinge.' } ] },
      { label: 'Follow the tracks', outcomes: [
        { w: 50, effects: { fight: { power: 1.0, loot: 2 } },
          text: 'They lead to whatever did this, and whatever did this had not finished being hungry.' },
        { w: 50, effects: { stone: 300, luck: 1 },
          text: 'They lead to a hill where the drivers are hiding, alive, and deeply apologetic about the crows.' } ] },
      { label: 'Burn what is left properly', outcomes: [
        { w: 1, effects: { luck: 2 },
          text: 'You do it the way the rites ask, alone, for people you never met and will never be thanked by.' } ] },
    ] },

  { id: 'ev_cicadaChorus', title: 'The Cicada Chorus', rarity: 'C',
    text: 'Every cicada on the ridge stops at once, waits exactly four heartbeats, and starts again in a different key.',
    choices: [
      { label: 'Match your breathing to it', outcomes: [
        { w: 1, effects: { exp: '35m' },
          text: 'You breathe in their new key for an hour, and your meridians come out of it tuned.' } ] },
      { label: 'Count the beats', outcomes: [
        { w: 60, effects: { insight: 1 },
          text: 'The pattern repeats every ninety-one beats, which is a very strange number to build a summer around.' },
        { w: 40, effects: { tech: 18 },
          text: 'You lose count twice, and learn more from losing it than the total would ever have taught you.' } ] },
      { label: 'Shout at them', outcomes: [
        { w: 1, effects: { luck: -1, exp: '5m' },
          text: 'They stop. It is much worse. You end up apologising out loud to an entire ridge.' } ] },
    ] },

  /* ========================================================= RARE (9) ==== */

  { id: 'ev_crane', title: 'Wounded Crane', rarity: 'R',
    text: 'A white crane drags one wing through the reeds, watching you with the flat patience of something that has already decided how this goes.',
    choices: [
      { label: 'Spend 3 herbs and bind the wing', req: { 'herb:1': 3 }, outcomes: [
        { w: 80, effects: { 'herb:1': -3, 'herb:5': 1, luck: 1 },
          text: 'It returns at dawn with a gold-veined stem in its beak, drops it at your feet, and leaves without comment.' },
        { w: 20, effects: { 'herb:1': -3 },
          text: 'It lets you finish the splint, bites you once for the record, and is gone by morning.' } ] },
      { label: 'Ignore it', outcomes: [
        { w: 1, effects: {},
          text: 'You keep walking; behind you the reeds close over the whole business, and that is all there is to it.' } ] },
      { label: 'Eat it', outcomes: [
        { w: 1, effects: { 'core:2': 2, luck: -1 },
          text: 'It is stringy, and the taste stays with you a great deal longer than the meal does.' } ] },
    ] },

  { id: 'ev_bronzeMirror', title: 'The Mirror That Runs Late', rarity: 'R',
    text: 'A bronze mirror lies in a dry streambed showing the bank behind you exactly as it stood one breath ago — which is more than enough time to be a problem.',
    choices: [
      { label: 'Watch yourself until you catch up', outcomes: [
        { w: 60, effects: { exp: '90m', insight: 2 },
          text: 'For one moment the two of you are simultaneous, and in that moment you understand something you cannot afterwards say.' },
        { w: 40, effects: { respiraCharge: -2, exp: '20m' },
          text: 'Your reflection blinks first, and you spend the rest of the day a half-step behind your own hands.' } ] },
      { label: 'Turn it to face the road', outcomes: [
        { w: 50, effects: { luck: 2, stone: 1200 },
          text: 'A cart that has not arrived yet rolls through the glass, and one wheel throws a purse onto the real stones.' },
        { w: 50, effects: { curio: 'random' },
          text: 'Someone steps out of the reflection, sets an object down on the streambed, and does not step back.' } ] },
      { label: 'Sell it in the next town', outcomes: [
        { w: 1, effects: { stone: 2000, luck: -1 },
          text: 'The dealer pays well and does not haggle, which you think about for a long while afterwards.' } ] },
    ] },

  { id: 'ev_sealedJar', title: 'Jar Sealed with Nine Talismans', rarity: 'R',
    text: 'Eight of the nine talismans have rotted clean off. The ninth is crisp and new, and the ink on it is not yet dry.',
    choices: [
      { label: 'Open it', outcomes: [
        { w: 40, effects: { curio: 'random', jade: 2 },
          text: 'Inside is one small object wrapped in silk and a note reading, in a shaky hand, "sorry".' },
        { w: 60, effects: { fight: { power: 1.2, loot: 2 } },
          text: 'Whatever eight seals were for comes out shoulder-first, looking around for someone to blame.' } ] },
      { label: 'Add a talisman of your own', outcomes: [
        { w: 1, effects: { exp: '60m', insight: 1, luck: 1 },
          text: 'The jar goes quiet, and writing that tenth seal teaches you more about binding than a season of lectures.' } ] },
      { label: 'Carry it to the nearest sect gate', outcomes: [
        { w: 1, effects: { stone: 1800, tech: 60, luck: 1 },
          text: 'Four elders go very still, take it off you with tongs, and pay you not to describe where you found it.' } ] },
    ] },

  { id: 'ev_debtCollector', title: 'A Debt You Do Not Remember', rarity: 'R',
    text: 'A clerk in grey presents a contract bearing your name in your own handwriting, dated eleven years before you learned to write.',
    choices: [
      { label: 'Pay it', req: { stone: 1500 }, outcomes: [
        { w: 1, effects: { stone: -1500, jade: 4, luck: 2, insight: 2 },
          text: 'He stamps it, hands you the counterfoil, and something you had been carrying without noticing puts itself down.' } ] },
      { label: 'Dispute it', outcomes: [
        { w: 50, effects: { luck: -2, exp: '30m' },
          text: 'You win the argument. He files the win. Files, you learn, can be reopened.' },
        { w: 50, effects: { tech: 80, luck: 1 },
          text: 'He concedes at once, apologises for the error, and leaves you the ledger by way of compensation.' } ] },
      { label: 'Ask who holds the note', outcomes: [
        { w: 1, effects: { insight: 3 },
          text: 'He says a name you have never heard, and which you will not now be able to stop hearing.' } ] },
    ] },

  { id: 'ev_moonlitDuel', title: 'Duel Under a Borrowed Moon', rarity: 'R',
    text: 'A swordsman waits at the middle of the bridge with the easy courtesy of a man who has waited on a great many bridges.',
    choices: [
      { label: 'Accept', outcomes: [
        { w: 1, effects: { fight: { power: 1.25, loot: 2 }, exp: '40m' },
          text: 'He salutes, and the first exchange tells you more about your own guard than the last ten fights did.' } ] },
      { label: 'Offer wine first', req: { stone: 300 }, outcomes: [
        { w: 70, effects: { stone: -300, exp: '70m', tech: 50, luck: 1 },
          text: 'You drink until the moon moves, he teaches you the parry he meant to kill you with, and you both go home.' },
        { w: 30, effects: { stone: -300, fight: { power: 1.1, loot: 2 } },
          text: 'He drinks, thanks you warmly, and explains that the wine changes nothing about the bridge.' } ] },
      { label: 'Take the ford instead', outcomes: [
        { w: 1, effects: { luck: -1, stone: 600 },
          text: 'The water is cold and the detour is long, and there is a drowned strongbox in it, so call it even.' } ] },
    ] },

  { id: 'ev_qiVein', title: 'A Vein of Loose Qi', rarity: 'R',
    text: 'The air above a fallen pine is thick enough to lean on. It has been leaking gently out of the ground for a very long time.',
    choices: [
      { label: 'Sit and cultivate here', outcomes: [
        { w: 1, effects: { exp: '120m' },
          text: 'Two hours pass like one, and you leave with the pleasant guilt of someone who has been overpaid.' } ] },
      { label: 'Cap it and mark the spot', outcomes: [
        { w: 1, effects: { stone: 2500, luck: 1 },
          text: 'You seal it under three flat stones and sell the location to a sect surveyor who tries very hard to look bored.' } ] },
      { label: 'Draw the whole vein at once', outcomes: [
        { w: 45, effects: { exp: '180m', respiraCharge: -2 },
          text: 'It comes up all at once like a held breath finally let go, and so, briefly, do you.' },
        { w: 55, effects: { exp: '60m', luck: -1 },
          text: 'The vein collapses halfway through and the pine settles another handspan into the earth.' } ] },
    ] },

  { id: 'ev_swordGrave', title: 'Field of Planted Swords', rarity: 'R',
    text: 'Four hundred blades stand point-down in the barley, and somebody still walks out here every month to oil them.',
    choices: [
      { label: 'Pull one', outcomes: [
        { w: 50, effects: { 'forge:3': 3, exp: '40m' },
          text: 'It comes free without complaint, which the other three hundred and ninety-nine appear to notice.' },
        { w: 50, effects: { luck: -2, fight: { power: 1.15, loot: 2 } },
          text: 'It comes free, and so does the argument that put it there.' } ] },
      { label: 'Oil them too', outcomes: [
        { w: 1, effects: { luck: 2, tech: 60 },
          text: 'It takes all afternoon and nobody thanks you, and by the last row your wrist has learned something.' } ] },
      { label: 'Buy a lesson from the caretaker', req: { stone: 1000 }, outcomes: [
        { w: 1, effects: { stone: -1000, tech: 100, guide: 1, exp: '60m' },
          text: 'She teaches one cut for one hour and flatly refuses to teach a second, and the one is enough.' } ] },
    ] },

  { id: 'ev_koiPond', title: 'The Koi That Counts', rarity: 'R',
    text: 'An old koi surfaces, looks you over, and taps the stone rim with its nose a very specific number of times.',
    choices: [
      { label: 'Tap back the same number', outcomes: [
        { w: 60, effects: { insight: 3, exp: '60m' },
          text: 'It taps once more, you match it, and somewhere in the eleventh exchange you stop thinking of it as a fish.' },
        { w: 40, effects: { luck: 1 },
          text: 'You get it wrong on the fourth. It waits, patiently, for you to try again, and you do.' } ] },
      { label: 'Feed it', req: { 'herb:1': 2 }, outcomes: [
        { w: 1, effects: { 'herb:1': -2, 'herb:3': 3, luck: 2 },
          text: 'It eats without hurry, then noses three stems of something far better out of the weeds toward your hand.' } ] },
      { label: 'Catch it', outcomes: [
        { w: 30, effects: { 'core:3': 3, luck: -3 },
          text: 'You get it. It is heavier than a fish that size can be, and it does not struggle at all.' },
        { w: 70, effects: { luck: -1, exp: '10m' },
          text: 'It is old, not slow. You are now wet, and the pond has formed an opinion about you.' } ] },
    ] },

  { id: 'ev_hermitKiln', title: 'The Hermit\'s Cooling Kiln', rarity: 'R',
    text: 'The kiln is still warm and the hermit is not here. A note on the door reads: back in nine years, help yourself, do not be greedy.',
    choices: [
      { label: 'Take one thing', outcomes: [
        { w: 1, effects: { formula: 'random', luck: 1 },
          text: 'You take the smallest scroll on the shelf, because that is what the note was asking, and it is the good one.' } ] },
      { label: 'Take everything', outcomes: [
        { w: 50, effects: { formula: 'random', blueprint: 'random', stone: 2000, luck: -3 },
          text: 'You clear the shelf in four trips and spend the rest of the season not thinking about the note.' },
        { w: 50, effects: { blueprint: 'random', luck: -3, respiraCharge: -1 },
          text: 'Halfway through the second trip the kiln goes cold all at once, in a way that kilns do not.' } ] },
      { label: 'Stoke the kiln for him and go', outcomes: [
        { w: 1, effects: { luck: 3, 'forge:3': 4, tech: 40 },
          text: 'You feed it, bank it, sweep the floor and leave — and find good iron stacked at the gate on your way past.' } ] },
    ] },

  /* ========================================================= EPIC (4) ==== */

  { id: 'ev_nightMarket', title: 'Night Market Stranger', rarity: 'E',
    text: 'The stalls appeared between one street and the next. One seller has no goods at all — only an empty lacquer box and a great deal of time.',
    choices: [
      { label: 'Trade a Purple pill for the box', req: { pillQuality: 'purple' }, outcomes: [
        { w: 1, effects: { curio: 'random', luck: 1 },
          text: 'He weighs the pill on his palm, seems satisfied by something that is not its weight, and the box is no longer empty.' } ] },
      { label: 'Refuse', outcomes: [
        { w: 1, effects: {},
          text: 'You walk on, and behind you the entire market folds itself up like a letter nobody sent.' } ] },
      { label: 'Haggle', req: { pillQuality: 'purple' }, outcomes: [
        { w: 50, effects: { curio: 'random', jade: 6, luck: 1 },
          text: 'You talk him up to the box and a fistful of jade, and he seems genuinely delighted to have lost.' },
        { w: 50, effects: { luck: -2, 'herb:1': 1 },
          text: 'You win the argument and receive, formally and with both hands, one wilted herb and a receipt.' } ] },
    ] },

  { id: 'ev_starfallCrater', title: 'Something Fell Last Night', rarity: 'E',
    text: 'The crater is still ticking as it cools, and the thing at the bottom is not a rock. It is a rock\'s extremely expensive cousin.',
    choices: [
      { label: 'Dig it out now', outcomes: [
        { w: 60, effects: { 'forge:5': 3, stone: 6000, tech: 150 },
          text: 'It comes up in three pieces, each heavier than it has any business being, and all three sing when struck.' },
        { w: 40, effects: { fight: { power: 1.4, loot: 2 } },
          text: 'It was still holding on to whatever rode it down, and whatever rode it down has had a long night.' } ] },
      { label: 'Wait for it to finish cooling', outcomes: [
        { w: 1, effects: { 'forge:4': 4, exp: '120m', luck: 1 },
          text: 'You sit on the rim until dawn and cultivate in the updraught, which proves to be the better half of the find.' } ] },
      { label: 'Sell the location', outcomes: [
        { w: 1, effects: { jade: 10, stone: 4000, luck: -1 },
          text: 'Three parties bid, one wins, and you are over the ridge before any of them starts digging.' } ] },
    ] },

  { id: 'ev_immortalDoorway', title: 'A Door in the Open Air', rarity: 'E',
    text: 'A lacquered door stands upright in the middle of a bean field, latched, with a doormat. The beans have been carefully planted around it.',
    choices: [
      { label: 'Knock', outcomes: [
        { w: 60, effects: { curio: 'random', exp: '180m' },
          text: 'Something sets an object on the mat, withdraws, and closes the door with the softness of enormous courtesy.' },
        { w: 40, effects: { insight: 5, luck: 2 },
          text: 'Nobody answers, but an hour on that threshold rearranges several things you had thought were settled.' } ] },
      { label: 'Open it without knocking', outcomes: [
        { w: 50, effects: { jade: 12, tech: 200, luck: -2 },
          text: 'A storeroom, unattended and immaculate — and you are back in the bean field before you finish the second shelf.' },
        { w: 50, effects: { fight: { power: 1.35, loot: 2 }, luck: -1 },
          text: 'The doorkeeper was on the other side, and had been having a perfectly good century until now.' } ] },
      { label: 'Wipe your feet and wait', outcomes: [
        { w: 1, effects: { luck: 3, exp: '90m', jade: 4 },
          text: 'The door opens on its own, someone unseen approves of you at length, and by evening the field is only a field.' } ] },
    ] },

  { id: 'ev_dreamTeacher', title: 'The Teacher in the Dream', rarity: 'E',
    text: 'You fall asleep against a milestone and wake three hours later with a stranger\'s corrections written all through your technique.',
    choices: [
      { label: 'Practise what she showed you', outcomes: [
        { w: 1, effects: { tech: 250, guide: 2, exp: '150m' },
          text: 'Every correction holds up under daylight, which is not how dreams are supposed to work.' } ] },
      { label: 'Lie back down and ask her name', outcomes: [
        { w: 55, effects: { exp: '240m', insight: 4, respiraCharge: -1 },
          text: 'She tells you, and teaches for what feels like eleven years, and you wake at dusk lighter and much emptier.' },
        { w: 45, effects: { luck: -1, exp: '30m' },
          text: 'You sleep badly, dream of nothing, and lose half of what she gave you on the way back up.' } ] },
      { label: 'Write it down before it fades', outcomes: [
        { w: 1, effects: { guide: 3, insight: 3, tech: 120 },
          text: 'You fill nine pages in a hand almost your own, and the ninth is a list of what she ran out of time to say.' } ] },
    ] },

  /* ======================================================= MYTHIC (1) ====
   * Three-step chain: root -> steps[0] -> steps[1]. steps[1] is the payoff
   * fork — technique manual, curio, or a trapped elite fight at double loot.
   * Every early exit pays something real, so leaving is a choice and not a
   * punishment. -------------------------------------------------------- */

  { id: 'ev_fallenCave', title: 'Fallen Cultivator\'s Cave', rarity: 'M',
    text: 'The cave mouth is a knife-cut in the cliff face. Inside, a cultivator sits cross-legged, dead so long that he has gone to grey paper.',
    choices: [
      { label: 'Step inside and bow', outcomes: [
        { w: 1, effects: {}, next: 0,
          text: 'Nothing objects. The air shifts half a degree warmer, which you decide to read as permission.' } ] },
      { label: 'Burn two herbs at the lintel first', req: { 'herb:1': 2 }, outcomes: [
        { w: 70, effects: { 'herb:1': -2, luck: 1 }, next: 0,
          text: 'The smoke goes in straight and comes back straight — no wards, no watchers, nobody home but him.' },
        { w: 30, effects: { 'herb:1': -2, respiraCharge: -1 }, next: 0,
          text: 'The smoke flares green at the threshold, and you learn where the trap is by very nearly standing in it.' } ] },
      { label: 'This is a grave. Leave it be.', outcomes: [
        { w: 1, effects: { exp: '20m', luck: 1 },
          text: 'You stack three stones at the entrance and walk away, and the walk is unusually clear-headed.' } ] },
    ],
    steps: [
      { title: 'The Seated Man',
        text: 'Under his folded hands lies a slim manual. At his hip hangs a wrapped bundle. Behind him the cave wall is far smoother than stone has any right to be.',
        choices: [
          { label: 'Bow three times, then search him', outcomes: [
            { w: 70, effects: { 'core:2': 2, stone: 900 }, next: 1,
              text: 'His robe gives up a purse and two cores, and his shoulders settle a fraction, as though a long shift had ended.' },
            { w: 30, effects: { stone: 400, insight: 1 }, next: 1,
              text: 'His hand opens on its own. There is nothing at all in it, and that turns out to be the point.' } ] },
          { label: 'Cut the seal on his sleeve', outcomes: [
            { w: 50, effects: { insight: 2, luck: -1 }, next: 1,
              text: 'The seal parts, and a decade of somebody\'s careful thinking arrives in your head sideways.' },
            { w: 50, effects: { exp: '45m' }, next: 1,
              text: 'Under the seal is a diary entry about weather, and reading it costs an hour you do not regret.' } ] },
          { label: 'Take the gourd at his hip and go', outcomes: [
            { w: 1, effects: { stone: 1500, 'herb:3': 3, jade: 2 },
              text: 'The gourd is heavy, the way out is short, and you do not once look back at the wall behind him.' } ] },
        ] },
      { title: 'The Wall That Is Not a Wall',
        text: 'The manual is within reach, the bundle is within reach, and the smooth wall has a seam down it that was not there when you came in.',
        choices: [
          { label: 'Take the manual from under his hands', outcomes: [
            { w: 1, effects: { tech: 200, guide: 3, exp: '120m', luck: 1 },
              text: 'Ninety pages, no title, and a note in the margin of the last one: this part I never got right.' } ] },
          { label: 'Unwrap the bundle', outcomes: [
            { w: 1, effects: { curio: 'random', jade: 4 },
              text: 'Inside the silk is one small object he plainly carried for its own sake, and it is worth more than the manual.' } ] },
          { label: 'Push the seam open', outcomes: [
            { w: 75, effects: { fight: { power: 1.5, loot: 2 }, jade: 6, citrine: 3 },
              text: 'The wall swings in on a hoard, and on the thing he sat down here to keep between it and everyone else.' },
            { w: 25, effects: { fight: { power: 1.7, loot: 2 }, jade: 8, citrine: 5, luck: -1 },
              text: 'Behind the wall is a second seam, older and already open, and whatever came through it has been waiting longer.' } ] },
        ] },
    ] },
];

/* ============================================================================
 * EVERDAO — STORY DATA
 * The main quest chain and every scripted line of dialogue in the game.
 *
 * Pure data. No top-level references to any other module (CONTRACT §1).
 * Shapes are fixed by CONTRACT §9:
 *   DATA.quests   = [{ id, title, desc, tab, check(s), rewards, dialogue }]  // 32
 *   DATA.dialogue = { shifu:{ [beat]: [lines] }, rival:{ [beat]: [lines] } }
 *
 * `check` is handed the live save object (S) and must NEVER throw on a fresh,
 * partial, or migrated save — every read is optional-chained and defaulted.
 * `tab` is a deep-link for the quest chip: a panel id, or 'parent.child' for
 * anything that lives behind a sub-tab or the More menu (CONTRACT §4 badges).
 * `rewards` is an Econ.grantAll object (CONTRACT §7) and scales with the chain.
 *
 * VOICE — the Shifu is one specific person, not a mentor-shaped hole: an old
 * woman with a bad knee, a chipped teapot that pours crooked, and a settled
 * preference for the third steeping of cheap grey leaf. She stopped climbing at
 * Incarnation on purpose. She is fond of the player and refuses to say so
 * except sideways, usually by insulting their posture.
 * ==========================================================================*/


/* ---------------------------------------------------------------------------
 * MAIN CHAIN — 32 steps, ids 'q01'..'q32', strictly ordered.
 * The chain is the tutorial: each step lands one unlock, in the order the
 * unlock curve in CONFIG.unlocks actually opens it.
 * ------------------------------------------------------------------------ */
DATA.quests = [

  {
    id: 'q01',
    title: 'A Clean First Breath',
    desc: 'Sit still until the world answers back. Reach the Connection realm.',
    tab: 'cultivate',
    check: (s) => (s.player?.realm || 0) >= 1,
    rewards: { stone: 300, tech: 25 },
    dialogue: [
      'Sit. Breathe. If your legs go numb, that is a matter between you and your legs.',
      'Connection is not a triumph — it is a door answering a knock. So knock.',
    ],
  },
  {
    id: 'q02',
    title: 'Something in the Grass',
    desc: 'Take a hunt on Foxglove Ridge and come back with both eyebrows.',
    tab: 'wilds',
    check: (s) => (s.stats?.hunts || 0) >= 1,
    rewards: { stone: 700, tech: 30 },
    dialogue: [
      'Foxglove Ridge has bees the size of thumbs and one fox who still owes me money.',
      'Hunt exactly one thing. Then come home and tell me it was terrifying.',
    ],
  },
  {
    id: 'q03',
    title: 'Dress for the Weather',
    desc: 'Equip any weapon, robe, or pendant the wilds have coughed up.',
    tab: 'wilds',
    check: (s) => !!(s.equipped?.weapon || s.equipped?.armor || s.equipped?.pendant),
    rewards: { stone: 1100, jade: 10, tech: 45 },
    dialogue: [
      'You are still wearing what you slept in, and the mountain has noticed.',
      'Loot something and put it on. Dignity is a stat, whatever the elders claim.',
    ],
  },
  {
    id: 'q04',
    title: 'Ground That Holds',
    desc: 'Stop leaking qi. Reach the Foundation realm.',
    tab: 'cultivate',
    check: (s) => (s.player?.realm || 0) >= 2,
    rewards: { stone: 1800, jade: 15, tech: 60, guide: 1 },
    dialogue: [
      'Foundation is where your meridians stop leaking like a cracked gourd.',
      'Everything you ever become stands on it, so lay it level the first time.',
    ],
  },
  {
    id: 'q05',
    title: 'Cooking With Consequences',
    desc: 'Light the furnace and refine your first pill.',
    tab: 'abode.alchemy',
    check: (s) => (s.stats?.pillsCrafted || 0) >= 1,
    rewards: { stone: 2600, jade: 15, tech: 85, 'herb:2': 12 },
    dialogue: [
      'The furnace will ruin your first batch. It ruins everyone’s; it enjoys the ritual.',
      'Grind, simmer, wait. Alchemy is only cooking with consequences.',
    ],
  },
  {
    id: 'q06',
    title: "Somebody's Disciple",
    desc: 'Join a sect. Any sect. Read the small print anyway.',
    tab: 'more.sect',
    check: (s) => !!s.sect?.id,
    rewards: { stone: 3600, jade: 20, tech: 110, contribution: 250 },
    dialogue: [
      'Three sects will want you: swords, soup, or secrets.',
      'Pick the one you would enjoy arguing with. You will be doing a great deal of that.',
    ],
  },
  {
    id: 'q07',
    title: 'A Roof Worth Sitting Under',
    desc: 'Raise any room of your abode to level 2.',
    tab: 'abode',
    check: (s) => Object.values(s.abode?.rooms || {}).some((v) => (v || 0) >= 2),
    rewards: { stone: 5200, jade: 20, tech: 130, 'seed:2': 6 },
    dialogue: [
      'Your abode leans east. Fix a room before the mountain fixes it for you.',
      'A cultivator who cannot keep a house will not keep a realm.',
    ],
  },
  {
    id: 'q08',
    title: 'The Sleeper in the Hollow',
    desc: 'Push to stage 10 of Mistwood and meet whatever is snoring there.',
    tab: 'wilds',
    check: (s) => ((s.wilds?.zones?.z2?.stage) || 0) >= 10,
    rewards: { stone: 7500, jade: 25, tech: 160, 'core:2': 12 },
    dialogue: [
      'Mistwood exhales all morning and never quite inhales. Do not take it personally.',
      'Something antlered sleeps at the tenth stage. Wake it politely, then hit it.',
    ],
  },
  {
    id: 'q09',
    title: 'Eight Small Doors',
    desc: 'Learn eight technique nodes.',
    tab: 'more.techs',
    check: (s) => (s.techs?.owned?.length || 0) >= 8,
    rewards: { stone: 11000, jade: 25, tech: 200, guide: 2 },
    dialogue: [
      'Techniques are a corridor of small doors, and you have been admiring the corridor.',
      'Spend the points. Hoarded tech points have never once saved a life.',
    ],
  },
  {
    id: 'q10',
    title: 'Legible at Twenty Paces',
    desc: 'Make your style your handwriting. Reach the Virtuoso realm.',
    tab: 'cultivate',
    check: (s) => (s.player?.realm || 0) >= 3,
    rewards: { stone: 16000, jade: 30, tech: 280, insight: 4 },
    dialogue: [
      'At Virtuoso a stranger across a valley can name you from one strike.',
      'The heavens begin reading over your shoulder as well. Rude, but useful.',
    ],
  },
  {
    id: 'q11',
    title: 'The Ladder of Manners',
    desc: 'Fight one duel on the ladder. Winning is optional.',
    tab: 'battle.duel',
    check: (s) => (s.stats?.duels || 0) >= 1,
    rewards: { stone: 22000, jade: 30, tech: 340, citrine: 12 },
    dialogue: [
      'Duels settle nothing, and everyone attends anyway.',
      'Go and lose one properly. A clean loss teaches more than a lucky win.',
    ],
  },
  {
    id: 'q12',
    title: 'One Stair',
    desc: 'Clear the first floor of the Demon Spire.',
    tab: 'battle.spire',
    check: (s) => (s.spire?.best || 0) >= 1,
    rewards: { stone: 30000, jade: 35, tech: 420, stones: 40 },
    dialogue: [
      'The Spire is two hundred floors of tenants, none of whom have ever paid rent.',
      'Take the first stair. Take it badly if you must.',
    ],
  },
  {
    id: 'q13',
    title: 'Sparks and Swearing',
    desc: 'Forge a piece of gear with your own hands.',
    tab: 'abode.forge',
    check: (s) => (s.stats?.gearCrafted || 0) >= 1,
    rewards: { stone: 42000, jade: 35, tech: 500, stones: 70, 'forge:3': 10 },
    dialogue: [
      'Bought gear fits like a borrowed coat. Beat your own out of the ore.',
      'You will swear at the anvil. The anvil has heard worse, from better.',
    ],
  },
  {
    id: 'q14',
    title: 'The Tenth-Floor Tenant',
    desc: 'Clear floor 10 of the Demon Spire and meet its landlord.',
    tab: 'battle.spire',
    check: (s) => (s.spire?.best || 0) >= 10,
    rewards: { stone: 58000, jade: 40, tech: 620, insight: 8 },
    dialogue: [
      'Every tenth floor has a name and a temper, in that order.',
      'Bring pills. Bring two. Bring the ones you were saving for later.',
    ],
  },
  {
    id: 'q15',
    title: 'A Second, Smaller You',
    desc: 'Grow the soul behind your ribs. Reach the Nascent Soul realm.',
    tab: 'cultivate',
    check: (s) => (s.player?.realm || 0) >= 4,
    rewards: { stone: 82000, jade: 45, tech: 780, guide: 4 },
    dialogue: [
      'A small self moves in behind your ribs and criticises your posture at midnight.',
      'Mine complained about my knees for eighty years. Then it turned out to be right.',
    ],
  },
  {
    id: 'q16',
    title: 'The Tide',
    desc: 'Stand through a Beast Tide.',
    tab: 'battle.tide',
    check: (s) => !!s.flags?.firstTide || (s.tide?.nextAt || 0) > 0,
    rewards: { stone: 110000, jade: 50, tech: 950, citrine: 25 },
    dialogue: [
      'Every so often the wilds have a single thought together, and the thought is "downhill".',
      'Five waves, three boons, one nervous evening. Choose the boon that fixes you, not the one that flatters you.',
    ],
  },
  {
    id: 'q17',
    title: 'Old Things That Remember',
    desc: 'Slot a relic into any relic socket.',
    tab: 'abode.forge',
    check: (s) => !!(s.equipped?.relicA || s.equipped?.relicB || s.equipped?.relicC),
    rewards: { stone: 150000, jade: 55, tech: 1150, dust: 140 },
    dialogue: [
      'Relics are old things that remember being used, and would rather like to be again.',
      'Slot one. And do not ask the Umbral Veil where they find them.',
    ],
  },
  {
    id: 'q18',
    title: 'Ten Hammers',
    desc: 'Enhance any piece of gear to +10.',
    tab: 'abode.forge',
    check: (s) => (s.inv?.gear || []).some((g) => ((g && (g.lvl || g.level || g.enh)) || 0) >= 10),
    rewards: { stone: 200000, jade: 60, tech: 1350, stones: 180 },
    dialogue: [
      'Enhancement is simply patience holding a hammer. Take one piece to +10.',
      'Until then, everything you own is a rough draft with a strap on it.',
    ],
  },
  {
    id: 'q19',
    title: 'Fiftieth and Rising',
    desc: 'Climb to rank 50 or better on the duel ladder.',
    tab: 'battle.duel',
    check: (s) => (s.duel?.rank || 999) <= 50,
    rewards: { stone: 280000, jade: 70, tech: 1700, citrine: 40 },
    dialogue: [
      'Fiftieth means forty-nine people above you are worth studying closely.',
      'Climb. Then be insufferable about it quietly, the way professionals are.',
    ],
  },
  {
    id: 'q20',
    title: 'Intent Before Body',
    desc: 'Arrive somewhere before you get there. Reach the Incarnation realm.',
    tab: 'cultivate',
    check: (s) => (s.player?.realm || 0) >= 5,
    rewards: { stone: 380000, jade: 80, tech: 2100, guide: 6, insight: 12 },
    dialogue: [
      'At Incarnation your intent walks into a room a heartbeat ahead of your feet.',
      'Mortals will step aside without knowing why they moved. Be gentle with that.',
    ],
  },
  {
    id: 'q21',
    title: 'A Shelf of Odd Things',
    desc: 'Acquire your first curio.',
    tab: 'more.curios',
    check: (s) => (s.curios?.owned?.length || 0) >= 1,
    rewards: { stone: 490000, jade: 85, tech: 2500, dust: 220 },
    dialogue: [
      'Collect one useless beautiful thing. Then another. It is a genuine discipline.',
      'A curio is proof you went somewhere and bothered to pay attention.',
    ],
  },
  {
    id: 'q22',
    title: 'Twelve on the Shelf',
    desc: 'Gather twelve curios and set them out properly.',
    tab: 'more.curios',
    check: (s) => (s.curios?.owned?.length || 0) >= 12,
    rewards: { stone: 660000, jade: 95, tech: 3000, citrine: 60 },
    dialogue: [
      'Twelve curios on one shelf and the shelf starts humming in the evenings.',
      'No, I do not know why either. Enjoy the humming; do not investigate it.',
    ],
  },
  {
    id: 'q23',
    title: 'Halfway Up',
    desc: 'Clear floor 50 of the Demon Spire.',
    tab: 'battle.spire',
    check: (s) => (s.spire?.best || 0) >= 50,
    rewards: { stone: 880000, jade: 110, tech: 3600, insight: 18 },
    dialogue: [
      'Fifty floors up, the tenants have staff, and the staff have opinions.',
      'Halfway is the loneliest number in any tower. Keep climbing through it.',
    ],
  },
  {
    id: 'q24',
    title: 'Before the Gauntlet',
    desc: 'Fill the ninth phase of Incarnation to the brim.',
    tab: 'cultivate',
    check: (s) => (s.player?.realm || 0) >= 6 ||
      ((s.player?.realm || 0) === 5 && (s.player?.phase || 0) >= 9),
    rewards: { stone: 1200000, jade: 120, tech: 4400, guide: 8 },
    dialogue: [
      'The Era gate does not accept partial payment. Fill the ninth phase entirely.',
      'Three fights wait on the other side, back to back, and none of them care that you are tired.',
    ],
  },
  {
    id: 'q25',
    title: 'The Ceiling Cracks',
    desc: 'Survive the Era gauntlet and reach the Voidbreak realm.',
    tab: 'cultivate',
    check: (s) => (s.player?.realm || 0) >= 6,
    rewards: { stone: 1600000, jade: 140, tech: 5200, lawShard: 10 },
    dialogue: [
      'Every mortal mistakes the ceiling for the sky. You are about to crack it.',
      'The draught coming through is cold and does not apologise. Wear the good robe.',
    ],
  },
  {
    id: 'q26',
    title: 'One Law, Chosen',
    desc: 'Swear yourself to a single Law.',
    tab: 'more.law',
    check: (s) => !!s.player?.law,
    rewards: { stone: 2100000, jade: 150, tech: 6200, lawShard: 20 },
    dialogue: [
      'Five Laws will offer themselves: ember, water, sky, root, edge.',
      'Choose the one that sounds like your temper, not the one that sounds impressive.',
      'And choose once. The heavens have no patience for a fickle disciple.',
    ],
  },
  {
    id: 'q27',
    title: 'A Law Written Down',
    desc: 'Learn a rank-11 technique node and put your Law into your hands.',
    tab: 'more.techs',
    check: (s) => (s.techs?.owned || []).some((id) => typeof id === 'string' && id.slice(0, 4) === 't11_'),
    rewards: { stone: 2800000, jade: 170, tech: 7500, lawShard: 30, guide: 10 },
    dialogue: [
      'A Law is only a feeling until you write it down as technique.',
      'Rank eleven and upward — that is where your Law finally starts paying rent.',
    ],
  },
  {
    id: 'q28',
    title: 'The Same Woods, Unbound',
    desc: 'Reach stage 10 in any of the spirit-era wilds.',
    tab: 'wilds',
    check: (s) => {
      const z = s.wilds?.zones || {};
      return ['sz1', 'sz2', 'sz3', 'sz4', 'sz5', 'sz6']
        .some((k) => ((z[k]?.stage) || 0) >= 10);
    },
    rewards: { stone: 3700000, jade: 190, tech: 8800, 'herb:6': 40, 'core:6': 40 },
    dialogue: [
      'The old grounds have woken up. Same trees, considerably worse manners.',
      'The fog in Mistwood learned your name while you were away. Go and disappoint it.',
    ],
  },
  {
    id: 'q29',
    title: 'One Thing',
    desc: 'End the argument inside you. Reach the Wholeness realm.',
    tab: 'cultivate',
    check: (s) => (s.player?.realm || 0) >= 7,
    rewards: { stone: 5200000, jade: 220, tech: 10800, insight: 30, dust: 500 },
    dialogue: [
      'At Wholeness the body, the soul, and the stubbornness stop arguing and agree to be one thing.',
      'It is quieter than you expect. Most people mistake that quiet for loss.',
    ],
  },
  {
    id: 'q30',
    title: 'Nothing Unfinished',
    desc: 'Leave no rough edges anywhere. Reach the Perfection realm.',
    tab: 'cultivate',
    check: (s) => (s.player?.realm || 0) >= 8,
    rewards: { stone: 7200000, jade: 260, tech: 13500, citrine: 130, stones: 650 },
    dialogue: [
      'Perfection means nothing about you is unfinished, which is lonelier than the songs admit.',
      'Come and drink tea afterward. The tea is imperfect on purpose.',
    ],
  },
  {
    id: 'q31',
    title: 'Kept the Good Parts',
    desc: 'Burn away everything you were. Reach the Nirvana realm.',
    tab: 'cultivate',
    check: (s) => (s.player?.realm || 0) >= 9,
    rewards: { stone: 10500000, jade: 300, tech: 16500, lawShard: 60, guide: 14 },
    dialogue: [
      'Nirvana burns off who you used to be, and whatever stands up afterward kept the good parts.',
      'I have met people who kept the wrong parts. Hold on to the small kindnesses first.',
    ],
  },
  {
    id: 'q32',
    title: 'The Ledger Opens',
    desc: 'Cross the second Era gate and reach the Celestial realm.',
    tab: 'cultivate',
    check: (s) => (s.player?.realm || 0) >= 10,
    rewards: { stone: 16000000, jade: 400, tech: 22000, citrine: 220, insight: 50 },
    dialogue: [
      'Heaven is writing your name down now, and that particular ink is famously expensive.',
      'Three last fights, and none of them are beasts. Go carefully and quickly.',
      'I will keep the pot warm. Third steeping, as always.',
    ],
  },

];


/* ---------------------------------------------------------------------------
 * DIALOGUE — beats fired once each by Story.beat(id) (CONTRACT §7).
 * Keep every line to one sentence and under about twenty-two words; these are
 * read on a phone, between two taps, by someone who wants to get back to it.
 * ------------------------------------------------------------------------ */
DATA.dialogue = {

  /* ------------------------------------------------------------ THE SHIFU */
  shifu: {

    intro: [
      'So. You have decided to be immortal. Sit down; the tea has already gone cold once.',
      'I teach breathing, patience, and where the good herbs hide when it rains.',
      'Rule one: nothing on this mountain is impressed by you yet, and that includes the mountain.',
    ],

    firstBreak: [
      'There. An entire realm, and the sky did not even change colour for it.',
      'Do not grin like that, it makes the qi go crooked.',
      '…Fine. Grin a little. I will look the other way.',
    ],

    firstFail: [
      'Everyone falls off that particular step. I fell off it twice and was quietly proud of both.',
      'The injury fades by evening. Sit down, drink this, and stop apologising to the furniture.',
      'A failed breakthrough is only a breakthrough that arrived early and got confused.',
    ],

    foundation: [
      'Foundation. Your meridians have stopped leaking and the floorboards have stopped complaining.',
      'Now the dull part: everything you ever become is standing on this. Keep it level.',
    ],

    sect: [
      'A sect, then. They will give you robes, chores, and firm opinions about the other two.',
      'Take the robes. Do the chores. The opinions are optional and, thankfully, free.',
    ],

    virtuoso: [
      'Virtuoso. Someone across a valley can now name you by your footwork alone.',
      'That is fame, which is mostly a way of being ambushed by strangers who admire you.',
    ],

    firstTribulation: [
      'No more coin-flips with heaven. From here the sky sends a Heart Demon wearing your face.',
      'It will say true things unkindly. Let it finish the sentence, then hit it.',
      'Load your pills before you go. Pride, I regret to say, is not a pill.',
    ],

    firstTide: [
      'The wilds have had one thought all together, and the thought is "downhill".',
      'Five waves, no interval, and boons offered between them like bad advice at a wedding.',
      'Stand somewhere solid and let them come to you.',
    ],

    nascent: [
      'Congratulations, you are two people now, and the new one has notes.',
      'Feed it silence and it settles. Feed it grievances and you will never sleep again.',
    ],

    incarnation: [
      'Incarnation. Your intent enters the room first and people move without knowing why.',
      'This is where cultivators begin turning into weather. Try to be the gentle sort.',
    ],

    era1_a: [
      'Three fights, no rest between them. The Era gate does not believe in intermissions.',
      'First comes what you were at the beginning: a nervous thing in borrowed boots.',
      'Be kind when you put it down. It got you here.',
    ],

    era1_b: [
      'Second: everything you refused to become, and it fights considerably better than you would like.',
      'Do not argue with it. It already has all of your arguments, and it practised.',
    ],

    era1_c: [
      'Last one is you, exactly as you are today, with no excuses left in the house.',
      'Win and the ceiling breaks. Lose and I will still have the kettle on.',
    ],

    lawChoice: [
      'Five Laws, and each one wants a whole life from you.',
      'Ember burns slowly, water hushes, sky splits, root returns, edge waits to be drawn.',
      'Pick the one that already sounds like how you fight when you are tired.',
    ],

    voidbreak: [
      'Voidbreak. You have put a crack in the sky and let the cold come through it.',
      'The Spirit Era begins here. The tea, I am sorry to report, is still only tea.',
    ],

    wholeness: [
      'Wholeness. Nothing inside you argues with anything else anymore.',
      'Restful, I am told, in the way a finished sentence is restful.',
    ],

    perfection: [
      'Perfection, and now nobody within a thousand li can tell you anything useful.',
      'Except me. Your left shoulder still drops when you are tired.',
    ],

    nirvana: [
      'You burned. I sat with the ash and waited to see who would stand up out of it.',
      'It is you. Slightly quieter. Good — the loud parts were never the strong ones.',
    ],

    era2_a: [
      'The second gate is worse. It does not send beasts; it sends consequences.',
      'First: every person you walked past on the way up here, gathered into one crowd.',
    ],

    era2_b: [
      'Second: the disciple you would have been if you had stopped at the first easy realm.',
      'They look happy. That is the trick of it. Keep walking anyway.',
    ],

    era2_c: [
      'Last: heaven itself, wearing a clerk’s face and holding your ledger open at the bad page.',
      'Sign nothing. Simply win, and let it correct its own arithmetic afterward.',
    ],

    celestial: [
      'There it is. Heaven’s ledger, your name, permanent ink — and you still slouch.',
      'I never climbed past Incarnation. I liked the mountain, the cheap tea, and eventually you.',
      'Go on. Do not look back for me; I will be here, third steeping, warm enough.',
    ],

    samsara: [
      'Samsara. You go back to the beginning and keep only what you learned to be.',
      'I will be younger, ruder, and I will not remember any of this. You will.',
      'Bring the good habits forward. Leave the flinching where it fell.',
    ],

  },

  /* ------------------------------------------------- RUAN ZHAOYI, THE RIVAL
   * Self-styled Peerless Sword of the Nine Terraces. She paid a street-poet
   * for the title and has never once admitted it out loud, exactly.
   * ---------------------------------------------------------------------- */
  rival: {

    firstMeet: [
      'Ruan Zhaoyi. Peerless Sword of the Nine Terraces. You may have heard of me.',
      'No? Well. You will, and most likely from underneath.',
    ],

    taunt1: [
      'Back again. Your stance has improved — it was a cliff, and now it is merely a hill.',
      'Try not to bleed on the terrace stones. They were swept this morning.',
    ],

    taunt2: [
      'You have been buying pills. I can smell the cheap ones from three ranks away.',
      'Still, you are climbing, which is irritating. Keep it up, so my wins mean something.',
    ],

    taunt3: [
      'I have stopped introducing myself before our matches. It wastes time you do not have.',
      'Do not mistake that for respect. It is efficiency. …Mostly efficiency.',
    ],

    beaten: [
      'Hm. That was clean. I felt it again three days later, which is annoyingly good work.',
      'The title remains mine, obviously. I paid for it, so it is legally binding.',
    ],

    beatsYou: [
      'Get up. Cold stone ruins the knees, and I need you fighting, not seated.',
      'You lost because you flinched in the fourth round, not because you are small.',
      'Come back on a day when you have eaten. I will wait.',
    ],

    respect: [
      'I have stopped keeping score. That is not surrender, it is arithmetic — I ran out of fingers.',
      'There is a tea house on the ninth terrace. First pot is mine. Do not be strange about it.',
    ],

    farewell: [
      'You are going up, then. Higher than the terraces, higher than any ladder I keep.',
      'I will hold rank one down here and tell everyone I taught you. Allow me that.',
      'Go on, Peerless. The title suits you better. I never did learn to spell it.',
    ],

  },

};

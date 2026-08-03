/* ============================================================================
 * EVERDAO — DATA: TECHNIQUES
 * The technique tree: 16 ranks x 6 nodes = 96 individually authored nodes.
 *
 * Pure data. No cross-module references at top level. The only top-level
 * bindings introduced here are `techMk` (a hoisted builder) and the
 * `DATA.techs` assignment itself.
 *
 * SHAPE (CONTRACT §9)
 *   { id, rank, idx, name, flavor, kind:'stat'|'effect', key, val,
 *     cost:{ tech, guide } }
 *
 * ID CONVENTION
 *   t<rank>_<idx>   e.g. t1_1 ... t16_6.  Matches S.techs.owned entries and
 *   the `techUnlock` Bus payload {rank, node}.
 *
 * ERAS
 *   Ranks 1-10  Mortal techniques — breathing methods, meridian work, body
 *               conditioning. Small, physical, unglamorous.
 *   Ranks 11-16 Law techniques (CONFIG.techs.lawRankStart = 11) — cosmological
 *               doctrine, written in the register of decrees and vaults.
 *
 * UNLOCK GATING is CONFIG.techs.rankUnlockRealm (rank 1..16 -> realm):
 *   [0,0,1,1,2,2,3,3,4,4,6,6,7,8,9,10]
 *   so rank 11 opens at Voidbreak, exactly when a Law is chosen
 *   (CONFIG.law.unlockRealm = 6). The two eras of this tree line up with the
 *   two eras of the world.
 *
 * COSTS follow CONFIG.techs:
 *   tech  = round(costBase * rank^costRankPow * (1 + costNodeStep*(idx-1)))
 *         = round(40 * rank^2.05 * (1 + 0.35*(idx-1)))
 *   rank 1 nodes cost 40-110 points; rank 16 nodes cost 11,770-32,375.
 *   guide = 0 for Mortal-era stat nodes. Effect nodes pay 1 Tech Guide at
 *   ranks 1-3, rising one per three ranks to 6 at rank 16. Law-era stat nodes
 *   also cost guides (1 at ranks 11-12, 2 at 13-14, 3 at 15-16) because Tech
 *   Guides are the genuinely scarce currency and rank 11+ should hurt.
 *
 * BALANCE NOTES
 *   `stat` nodes: `key` is one of hp/patk/matk/pdef/mdef/spd/allStat and `val`
 *   is an additive percentage fraction folded into the (1 + techPct + ...)
 *   term of the Stats formula. Fully owned (before the x2 rank-completion
 *   bonus in CONFIG.techs.completionBonusMult) the tree grants roughly:
 *     hp +180%  matk +117%  patk +115%  pdef +90%  mdef +86%  spd +84%
 *   of which +51% comes from the nine allStat nodes alone.
 *
 *   `effect` nodes are the prize and are priced to be agonising. `key` is a
 *   Stats.bonus() key from CONTRACT §7. Two of them carry FLAT integer vals,
 *   never fractions:
 *     pillAttempts  ranks 3, 7, 11, 15 — one each, lifting the daily cap from
 *                   CONFIG.alchemy.pillAttemptsBase (10) to 14 for a player
 *                   who chases them across the whole run.
 *     offlineHours  rank 6 — +2h on top of CONFIG.offline.baseCapH.
 *   `lawProc` appears only at ranks 11+ (it has nothing to modify before a Law
 *   exists): ranks 11, 13, 14, 16.
 *
 *   Effect-key census across the 40 effect nodes:
 *     aura 6 · pillAttempts 4 · respiraExp 4 · lawProc 4 · expedition 3 ·
 *     pillExp 2 · alchemyQuality 2 · forgeQuality 2 · btChance 2 · crit 2 ·
 *     critDmg 2 · lifesteal 2 · curioPower 2 · offlineHours 1 · shield 1 ·
 *     thrall 1
 * ==========================================================================*/


/* ---------------------------------------------------------------------------
 * techMk — assembles one node. Everything meaningful (name, flavour, kind,
 * key, val, both costs) is written out explicitly in the table below; this
 * only stamps the id and nests the cost object.
 * ------------------------------------------------------------------------ */
function techMk(rank, idx, name, flavor, kind, key, val, tech, guide) {
  return {
    id: 't' + rank + '_' + idx,
    rank: rank,
    idx: idx,
    name: name,
    flavor: flavor,
    kind: kind,
    key: key,
    val: val,
    cost: { tech: tech, guide: guide },
  };
}


DATA.techs = [

  /* =========================================================================
   * RANK 1 — Novice. The first breathing forms, taught to anyone who sits
   * still long enough to be handed them. 4 stat / 2 effect.
   * ======================================================================*/
  techMk(1, 1, 'Ox-Breath Sequence',
    'You learn to breathe like something that pulls a plough, and your ribs stop arguing about the load.',
    'stat', 'hp', 0.05, 40, 0),

  techMk(1, 2, 'Counting the Rafters',
    "A beginner's trick: name every beam overhead until the body forgets to flinch.",
    'stat', 'pdef', 0.04, 54, 0),

  techMk(1, 3, 'Low Stance, Long Day',
    'Stand wrong for an hour and right forever; your knees will forgive you around spring.',
    'stat', 'patk', 0.03, 68, 0),

  techMk(1, 4, 'The Long Inhale',
    'One breath drawn so slowly that the whole room leans in to hear how it ends.',
    'effect', 'aura', 0.06, 82, 1),

  techMk(1, 5, 'Heel-Lifting Step',
    'Weight forward, heels barely down: the walk of someone who expects to be leaving soon.',
    'stat', 'spd', 0.03, 96, 0),

  techMk(1, 6, 'Dawn Ledger',
    'Old cultivators insist the morning qi is cheaper, and they keep very careful books about it.',
    'effect', 'respiraExp', 0.12, 110, 1),


  /* =========================================================================
   * RANK 2 — Novice. Tidying the meridians; the first medicine that stays
   * down. 4 stat / 2 effect.
   * ======================================================================*/
  techMk(2, 1, 'Ink-Drop Meditation',
    'Drop a single thought into still water and study everything the ripples refuse to touch.',
    'stat', 'matk', 0.04, 165, 0),

  techMk(2, 2, 'Marrow Kneading',
    'An unglamorous hour spent pressing your own bones like dough, with undeniable results.',
    'stat', 'hp', 0.055, 225, 0),

  techMk(2, 3, 'Swallow Without Chewing',
    "The apothecary's advice on medicine pills and, regrettably, on most of the rest of life.",
    'effect', 'pillExp', 0.12, 280, 1),

  techMk(2, 4, 'Nine Silent Gates',
    'Nine points along the spine, closed in strict order and opened in none.',
    'stat', 'mdef', 0.045, 340, 0),

  techMk(2, 5, 'Split-Log Grip',
    'You stop striking the wood and start striking the place just past the wood.',
    'stat', 'patk', 0.035, 395, 0),

  techMk(2, 6, 'The Unhurried Hour',
    'Sit until the incense forgets it was ever lit; that hour quietly counts for two.',
    'effect', 'aura', 0.08, 455, 1),


  /* =========================================================================
   * RANK 3 — Connection. Body conditioning, and the first widening of the
   * throat: pillAttempts +1. 4 stat / 2 effect.
   * ======================================================================*/
  techMk(3, 1, 'Iron-Sleeve Conditioning',
    'Sand, then gravel, then river stone, until the forearm answers a club with a shrug.',
    'stat', 'hp', 0.06, 380, 0),

  techMk(3, 2, 'Hammer-and-Anvil Form',
    'Two hands, two jobs: one holds the world still while the other explains itself.',
    'stat', 'patk', 0.045, 515, 0),

  techMk(3, 3, 'Second Stomach',
    "A patient second stomach opened where the ribs meet, so the day's extra dose merely inconveniences you.",
    'effect', 'pillAttempts', 1, 645, 1),

  techMk(3, 4, 'Root Below the Root',
    'Shove a cultivator who knows this and you will only learn how deep the floor goes.',
    'stat', 'pdef', 0.05, 780, 0),

  techMk(3, 5, 'Sparrow-Foot Crossing',
    'Cross wet stones without wetting a sole; the sparrows were doing it first and for free.',
    'stat', 'spd', 0.04, 910, 0),

  techMk(3, 6, "Traveller's Reckoning",
    'You learn to read a valley the way a merchant reads a purse — at a glance, and greedily.',
    'effect', 'expedition', 0.15, 1045, 1),


  /* =========================================================================
   * RANK 4 — Connection. Intent sharpens; the mind gets its first lacquer.
   * 4 stat / 2 effect.
   * ======================================================================*/
  techMk(4, 1, 'Cinnabar Thread',
    'A single red line of intent, run from the palm to whatever you would rather not touch.',
    'stat', 'matk', 0.05, 685, 0),

  techMk(4, 2, 'Lacquered Mind',
    'Seven thin coats over the thoughts, so that nothing whispered soaks all the way in.',
    'stat', 'mdef', 0.05, 925, 0),

  techMk(4, 3, 'Bellows Under the Ribs',
    "The lungs learn a smith's rhythm, and the fire underneath them thoroughly approves.",
    'stat', 'hp', 0.065, 1165, 0),

  techMk(4, 4, "Wisp-Catcher's Patience",
    'Stand still long enough and wandering qi mistakes you for scenery worth settling on.',
    'effect', 'respiraExp', 0.18, 1405, 2),

  techMk(4, 5, 'Reed-Bending Footwork',
    'Give way at the ankle, never at the spine; reeds outlive oaks in every flood on record.',
    'stat', 'spd', 0.045, 1645, 0),

  techMk(4, 6, 'The Hairline Opening',
    'Every guard has one seam, and this technique is mostly the discipline of waiting for it.',
    'effect', 'crit', 0.04, 1885, 2),


  /* =========================================================================
   * RANK 5 — Foundation. Everything gets tied to everything else, and the
   * dantian starts holding a steady coal. 4 stat / 2 effect.
   * ======================================================================*/
  techMk(5, 1, 'Stone-Splitting Palm',
    'Not strength — timing, delivered to the one grain of the rock that was already tired.',
    'stat', 'patk', 0.055, 1085, 0),

  techMk(5, 2, 'Foundation Weave',
    'The dull, essential labour of tying every thread you own to every other thread you own.',
    'stat', 'allStat', 0.03, 1465, 0),

  techMk(5, 3, 'Turtle-Shell Bearing',
    'The turtle has never once won a race and has outlived every runner who beat it.',
    'stat', 'pdef', 0.06, 1840, 0),

  techMk(5, 4, 'Cauldron Ear',
    'You learn to hear the moment a brew stops improving, which is always earlier than pride allows.',
    'effect', 'alchemyQuality', 0.08, 2220, 2),

  techMk(5, 5, 'Well-Deep Reserve',
    'You stop drawing from the bucket and start drawing from the well the bucket was dipped in.',
    'stat', 'hp', 0.075, 2600, 0),

  techMk(5, 6, 'The Standing Furnace',
    'A steady coal beats a brilliant flame, as any cook who has ruined a fish will tell you.',
    'effect', 'aura', 0.12, 2980, 2),


  /* =========================================================================
   * RANK 6 — Foundation. Craft and cold precision; the meridians learn to
   * walk their route unsupervised. 4 stat / 2 effect.
   * ======================================================================*/
  techMk(6, 1, 'Frost-Needle Intent',
    'Cold, thin, and aimed: the sort of thought that arrives already through you.',
    'stat', 'matk', 0.06, 1575, 0),

  techMk(6, 2, 'Cormorant Dive',
    'Down, in, out, and dry again before anyone downstream has finished turning their head.',
    'stat', 'spd', 0.05, 2125, 0),

  techMk(6, 3, "Smith's Third Eye",
    'You begin to read the grain of a metal the way you read the grain of a face.',
    'effect', 'forgeQuality', 0.08, 2675, 2),

  techMk(6, 4, 'Shuttered Lantern',
    'The light stays lit; it simply stops telling the dark exactly where it is.',
    'stat', 'mdef', 0.06, 3230, 0),

  techMk(6, 5, 'Old Root, New Rain',
    'Whatever the winter hollowed out fills back in, and fills in slightly larger than before.',
    'stat', 'hp', 0.08, 3780, 0),

  techMk(6, 6, 'The Sleeping Circulation',
    'You teach the meridians a route they can walk unsupervised, which they do, resentfully.',
    'effect', 'offlineHours', 2, 4330, 2),


  /* =========================================================================
   * RANK 7 — Virtuoso. Technique becomes handwriting. Second pillAttempts.
   * 4 stat / 2 effect.
   * ======================================================================*/
  techMk(7, 1, 'Signature Strike',
    'A blow so plainly yours that strangers three provinces away can name the bruise.',
    'stat', 'patk', 0.065, 2160, 0),

  techMk(7, 2, 'Ninefold Bracing',
    'Nine small refusals, stacked neatly into one very large one.',
    'stat', 'pdef', 0.065, 2915, 0),

  techMk(7, 3, 'Whole-Cloth Body',
    'The body stops being a committee of parts and becomes a single stubborn argument.',
    'stat', 'allStat', 0.035, 3675, 0),

  techMk(7, 4, 'The Wider Throat',
    "The meridians open enough to take one more day's medicine without complaint or ruin.",
    'effect', 'pillAttempts', 1, 4430, 3),

  techMk(7, 5, 'Tidal Marrow',
    'The blood learns the manners of the sea: it goes out, it comes back, it takes nothing personally.',
    'stat', 'hp', 0.085, 5185, 0),

  techMk(7, 6, 'Reading the Bottleneck',
    'You stop shoving at the wall and start looking for the brick that was never mortared.',
    'effect', 'btChance', 0.05, 5945, 3),


  /* =========================================================================
   * RANK 8 — Virtuoso. Sharper, uglier, more efficient. 3 stat / 3 effect —
   * the ratio begins its shift.
   * ======================================================================*/
  techMk(8, 1, 'Vermilion Sigil Breath',
    'Each exhale leaves a character hanging in the air, and the characters are not friendly.',
    'stat', 'matk', 0.07, 2840, 0),

  techMk(8, 2, 'The Unkind Angle',
    'There is a way of entering a wound that doubles the argument it makes.',
    'effect', 'critDmg', 0.20, 3835, 3),

  techMk(8, 3, 'Shadow-of-a-Sparrow',
    'You arrive at the same instant as your own shadow, which is generally one instant early.',
    'stat', 'spd', 0.055, 4830, 0),

  techMk(8, 4, "Mapmaker's Instinct",
    'Ruins begin volunteering their good rooms first, the way honest ruins ought to.',
    'effect', 'expedition', 0.20, 5825, 3),

  techMk(8, 5, 'Nine-Rivers Circulation',
    'Nine channels and one flood; nothing in you is ever left thirsty for very long.',
    'stat', 'hp', 0.09, 6820, 0),

  techMk(8, 6, 'Crimson Reciprocity',
    'What you take, you keep — an ugly technique with an admirably tidy ledger.',
    'effect', 'lifesteal', 0.03, 7815, 3),


  /* =========================================================================
   * RANK 9 — Nascent Soul. Two tenants, one skull, and they have finally
   * stopped rearranging the furniture. 4 stat / 2 effect.
   * ======================================================================*/
  techMk(9, 1, 'Soulfire Fist',
    'The smaller self behind your ribs lends a hand, and it has no idea of its own strength.',
    'stat', 'patk', 0.075, 3615, 0),

  techMk(9, 2, 'Twice-Housed Mind',
    'Two tenants, one skull: a whisper meant for either is answered by neither.',
    'stat', 'mdef', 0.075, 4880, 0),

  techMk(9, 3, 'Sympathetic Anatomy',
    'Body and nascent soul at last agree on where everything is supposed to go.',
    'stat', 'allStat', 0.04, 6145, 0),

  techMk(9, 4, "Collector's Sympathy",
    'Odd little treasures behave far better once they know they live with other odd little treasures.',
    'effect', 'curioPower', 0.15, 7415, 3),

  techMk(9, 5, 'Second Heart',
    'It beats out of step with the first on purpose, so nothing can ever catch both at rest.',
    'stat', 'hp', 0.095, 8680, 0),

  techMk(9, 6, 'Rain-in-the-Jar Method',
    'You stop chasing the storm and simply leave every vessel you own uncovered.',
    'effect', 'aura', 0.16, 9945, 3),


  /* =========================================================================
   * RANK 10 — Nascent Soul. The last Mortal rank: everything tightened,
   * nothing added. 3 stat / 3 effect.
   * ======================================================================*/
  techMk(10, 1, 'Lightless Sutra',
    'Recited without breath, without sound, and — witnesses insist — without moving the mouth.',
    'stat', 'matk', 0.08, 4490, 0),

  techMk(10, 2, 'Skin of Standing Air',
    'The air a hand-width from you decides it is on your side and stiffens accordingly.',
    'effect', 'shield', 0.08, 6060, 4),

  techMk(10, 3, 'Adamant Sediment',
    'Years of small hardenings settle into one seam of stone straight through the middle of you.',
    'stat', 'pdef', 0.08, 7630, 0),

  techMk(10, 4, 'Nine-Boiling Digestion',
    'A pill is boiled nine more times inside you before it is permitted to become anything useful.',
    'effect', 'pillExp', 0.22, 9200, 4),

  techMk(10, 5, 'Even Weave, Fine Thread',
    'Nothing added, everything tightened; the difference is felt rather than counted.',
    'stat', 'allStat', 0.045, 10770, 0),

  techMk(10, 6, 'The Listening Well',
    'You dig a quiet place in yourself, and wandering qi comes to it the way animals come to water.',
    'effect', 'respiraExp', 0.25, 12340, 4),


  /* =========================================================================
   * RANK 11 — Voidbreak. LAW TECHNIQUES BEGIN (CONFIG.techs.lawRankStart).
   * The register changes: these are doctrines, not exercises. Third
   * pillAttempts, and the first lawProc node. 3 stat / 3 effect.
   * ======================================================================*/
  techMk(11, 1, 'Vault-Cracking Doctrine',
    'The first law worth the name: the sky is a lid, and lids are made to come off.',
    'stat', 'allStat', 0.05, 5455, 1),

  techMk(11, 2, 'Resonant Decree',
    "Your Law stops asking the world's permission and begins issuing it a schedule.",
    'effect', 'lawProc', 0.06, 7365, 4),

  techMk(11, 3, 'Body of the Broken Ceiling',
    'You keep the cold that came through the crack, and the cold keeps you standing.',
    'stat', 'hp', 0.12, 9275, 1),

  techMk(11, 4, 'Aperture of the Third Vessel',
    'Past the stomach and past the meridians, a third place opens that medicine has never seen.',
    'effect', 'pillAttempts', 1, 11185, 4),

  techMk(11, 5, 'Edict of the Falling Hand',
    'Strike as though the ruling were already written and you were merely the clerk delivering it.',
    'stat', 'patk', 0.095, 13095, 1),

  techMk(11, 6, 'The Sky Is a Bellows',
    "Voidbreak's plainest truth: everything above you is breathing, and you may breathe along.",
    'effect', 'aura', 0.20, 15005, 4),


  /* =========================================================================
   * RANK 12 — Voidbreak. Charts, continents, covenants. 3 stat / 3 effect.
   * ======================================================================*/
  techMk(12, 1, 'Star-Charted Meridians',
    'The channels are redrawn against the constellations, which are, admittedly, still moving.',
    'stat', 'matk', 0.10, 6525, 1),

  techMk(12, 2, 'Continental Bearing',
    'You are no longer standing on the mountain; the arrangement has become mutual.',
    'stat', 'pdef', 0.10, 8805, 1),

  techMk(12, 3, 'Covenant of Borrowed Shades',
    'The dead make poor conversation and excellent company, provided the terms are written down.',
    'effect', 'thrall', 0.20, 11090, 4),

  techMk(12, 4, 'The Turning of the Long Wheel',
    'One slow revolution overhead is worth a great many quick ones down here.',
    'stat', 'spd', 0.075, 13375, 1),

  techMk(12, 5, 'Fracture-Line Sight',
    'Every existing thing carries the crack along which it will eventually be opened.',
    'effect', 'crit', 0.06, 15660, 4),

  techMk(12, 6, 'Furnace of the Under-Sky',
    'You stop lighting fires and start borrowing one that has never once gone out.',
    'effect', 'alchemyQuality', 0.14, 17940, 4),


  /* =========================================================================
   * RANK 13 — Wholeness. A thing with no seam has nothing to be taken apart
   * at. 3 stat / 3 effect.
   * ======================================================================*/
  techMk(13, 1, 'Undivided Doctrine',
    'Wholeness restated as law: what has no seam offers nothing to be taken apart at.',
    'stat', 'allStat', 0.06, 7685, 2),

  techMk(13, 2, 'Decree Without Herald',
    'The Law arrives before its announcement does, which is how you know it is genuinely yours.',
    'effect', 'lawProc', 0.08, 10375, 5),

  techMk(13, 3, 'Sea-Floor Endurance',
    'Everything above presses down; you have simply agreed to be the floor it presses onto.',
    'stat', 'hp', 0.14, 13065, 2),

  techMk(13, 4, 'Anvil of the Fixed Star',
    'Metal quenched beneath a star that has never wandered comes out unwilling to bend.',
    'effect', 'forgeQuality', 0.15, 15750, 5),

  techMk(13, 5, 'One Motion, Whole Sky',
    'No wind-up, no follow-through, and no meaningful gap for anybody to step into.',
    'stat', 'patk', 0.11, 18440, 2),

  techMk(13, 6, 'The Reckoning Angle',
    "Wholeness has one flaw, and it is that it knows precisely where everyone else's is.",
    'effect', 'critDmg', 0.30, 21130, 5),


  /* =========================================================================
   * RANK 14 — Perfection. Nothing left to correct, so it begins correcting
   * other things. 3 stat / 3 effect.
   * ======================================================================*/
  techMk(14, 1, 'Flawless Recitation',
    'Not one syllable wasted, which is precisely why the syllables land like falling masonry.',
    'stat', 'matk', 0.12, 8945, 2),

  techMk(14, 2, 'Immaculate Ordinance',
    'A Law with nothing left to correct within itself starts correcting everything else.',
    'effect', 'lawProc', 0.09, 12075, 5),

  techMk(14, 3, 'Mirror With No Back',
    'Whatever is sent at you is returned to the sender, postage cheerfully unpaid.',
    'stat', 'mdef', 0.12, 15205, 2),

  techMk(14, 4, 'Surveyor of Hollow Places',
    'Perfection is remarkably good at noticing what a landscape is embarrassed about.',
    'effect', 'expedition', 0.30, 18335, 5),

  techMk(14, 5, 'The Faultless Weave',
    'Every thread the correct length; the tapestry has lately begun looking back at you.',
    'stat', 'allStat', 0.07, 21465, 2),

  techMk(14, 6, 'Ledger of the Ninth Gate',
    'You read the terms of the next barrier in advance and find, as usual, a clerical error.',
    'effect', 'btChance', 0.08, 24595, 5),


  /* =========================================================================
   * RANK 15 — Nirvana. Everything burns; the good parts are kept. Fourth and
   * final pillAttempts, taking the daily cap to 14. 3 stat / 3 effect.
   * ======================================================================*/
  techMk(15, 1, 'Ash-Forged Frame',
    'Whatever burned away was load-bearing, and yet here you stand, carrying rather more.',
    'stat', 'hp', 0.18, 10300, 3),

  techMk(15, 2, 'Throat of the Reborn Kiln',
    'Nirvana takes your limits along with everything else, including the one on the daily dose.',
    'effect', 'pillAttempts', 1, 13905, 5),

  techMk(15, 3, 'Cinder-Point Strike',
    'The last ember of a former self, spent entirely on one small unforgivable point.',
    'stat', 'patk', 0.13, 17510, 3),

  techMk(15, 4, 'Breath After the Burning',
    'The first inhale on the far side of the fire is the sweetest air there has ever been.',
    'effect', 'respiraExp', 0.35, 21115, 5),

  techMk(15, 5, 'The Kept Good Parts',
    'Nothing survived that was not worth surviving, so what remains is by definition excellent.',
    'stat', 'allStat', 0.08, 24720, 3),

  techMk(15, 6, 'Pyre Reciprocity',
    'Every wound you open is a small door, and the fire is extremely keen on doors.',
    'effect', 'lifesteal', 0.06, 28325, 5),


  /* =========================================================================
   * RANK 16 — Celestial. The capstone rank; heaven has opened a ledger and
   * written your name into it. 3 stat / 3 effect.
   * ======================================================================*/
  techMk(16, 1, 'Name Written in the High Ledger',
    'Heaven keeps a book, your name is now in it, and that particular ink cost a great deal.',
    'stat', 'allStat', 0.10, 11770, 3),

  techMk(16, 2, 'Mandate of the Standing Law',
    'The Law no longer stirs when the fight permits; the fight stirs when the Law permits.',
    'effect', 'lawProc', 0.12, 15890, 6),

  techMk(16, 3, 'Body as a Standing Era',
    'Ages are measured against you now, which is flattering and unbelievably tiring.',
    'stat', 'hp', 0.20, 20010, 3),

  techMk(16, 4, 'Curator of Small Eternities',
    'Every trinket on your shelf turns out to have been a very patient relic all along.',
    'effect', 'curioPower', 0.30, 24130, 6),

  techMk(16, 5, 'Speech of the Vault',
    'You say one true thing at the sky, and something up there quietly revises itself.',
    'stat', 'matk', 0.14, 28255, 3),

  techMk(16, 6, 'The Everdao Breath',
    'A single inhale that begins in you and ends, some considerable while later, everywhere else.',
    'effect', 'aura', 0.40, 32375, 6),
];

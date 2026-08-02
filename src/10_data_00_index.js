/* ============================================================================
 * EVERDAO — DATA namespace
 * Declared here, populated by the 10_data_*.js content files that follow.
 * Every table is declared empty so that a missing content file degrades to
 * "no content" rather than a ReferenceError.
 * ==========================================================================*/

const DATA = {
  // world
  realms: [],          // 12 major realms
  laws: [],            // 5 elemental laws
  sects: [],           // 3 NPC sects
  titles: [],
  names: { surnames: [], givens: [], epithets: [] },

  // the wilds
  zones: [],
  monsters: [],
  monsterSkills: [],

  // battle content
  spireBosses: [],
  tideBoons: [],

  // items
  formulas: [],
  gearBases: [],
  relics: [],
  affixes: [],
  blueprints: [],

  // progression
  techs: [],
  curios: [],

  // narrative
  events: [],          // fortuity cards
  quests: [],
  dialogue: { shifu: {}, rival: {} },

  // meta / economy
  shops: { market: [], library: [], jade: [], dust: [], black: [] },
  achievements: [],
  dailies: [],
  weeklies: [],
  pass: [],
  samsaraTree: [],
};

/* Lookup indexes built at boot (see 90_boot.js) so content files stay pure data. */
const DATAX = {
  formulaById: {},
  gearById: {},
  relicById: {},
  techById: {},
  curioById: {},
  zoneById: {},
  monsterById: {},
  monsterSkillById: {},
  eventById: {},
  sectById: {},
  lawById: {},
};

function dataIndexAll() {
  const put = (map, arr) => { for (const o of arr) if (o && o.id != null) map[o.id] = o; };
  put(DATAX.formulaById, DATA.formulas);
  put(DATAX.gearById, DATA.gearBases);
  put(DATAX.relicById, DATA.relics);
  put(DATAX.techById, DATA.techs);
  put(DATAX.curioById, DATA.curios);
  put(DATAX.zoneById, DATA.zones);
  put(DATAX.monsterById, DATA.monsters);
  put(DATAX.monsterSkillById, DATA.monsterSkills);
  put(DATAX.eventById, DATA.events);
  put(DATAX.sectById, DATA.sects);
  put(DATAX.lawById, DATA.laws);
}

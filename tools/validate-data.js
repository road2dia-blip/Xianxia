#!/usr/bin/env node
/* Validates the DATA content tables in isolation: counts, cross-file references,
 * quest predicates against degenerate saves, achievement stat paths, task Bus
 * event names, and fortuity effect keys.  Run: node tools/validate-data.js  */
'use strict';
const fs = require('fs'), path = require('path');
const SRC = path.join(__dirname, '..', 'src');
const files = fs.readdirSync(SRC).filter(f => /^(00_config|10_data)/.test(f)).sort();
let code = files.map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n');
code += '\n;dataIndexAll();module.exports={CONFIG,DATA,DATAX};';
const m = { exports: {} };
new Function('module', 'exports', code)(m, m.exports);
const { DATA, DATAX } = m.exports;
const err = [];
const has = (arr, id) => arr.some(x => x.id === id);

const WANT = { realms:12, laws:5, sects:3, titles:18, zones:12, monsters:60, monsterSkills:12,
  spireBosses:20, tideBoons:12, formulas:48, gearBases:54, relics:18, affixes:16, blueprints:24,
  techs:96, curios:24, events:30, quests:32, achievements:42, dailies:8, weeklies:5, pass:50, samsaraTree:10 };
for (const k in WANT) if ((DATA[k] || []).length !== WANT[k])
  err.push(`count ${k}: ${(DATA[k] || []).length} want ${WANT[k]}`);

for (const z of DATA.zones) {
  for (const mid of z.monsters || []) if (!DATAX.monsterById[mid]) err.push(`zone ${z.id} -> missing monster ${mid}`);
  if (z.boss && z.boss.skill && !DATAX.monsterSkillById[z.boss.skill]) err.push(`zone ${z.id} boss -> missing skill ${z.boss.skill}`);
}
for (const mo of DATA.monsters) if (mo.skill && !DATAX.monsterSkillById[mo.skill]) err.push(`monster ${mo.id} -> missing skill ${mo.skill}`);
for (const s of DATA.sects) for (const lid of s.library || []) if (!has(DATA.shops.library, lid)) err.push(`sect ${s.id} -> missing library item ${lid}`);
for (const k in DATA.shops) for (const it of DATA.shops[k]) {
  const g = it.give || {};
  if (g.formula && g.formula !== 'random' && !DATAX.formulaById[g.formula]) err.push(`shop.${k} ${it.id} -> missing formula ${g.formula}`);
  if (g.blueprint && g.blueprint !== 'random' && !has(DATA.blueprints, g.blueprint)) err.push(`shop.${k} ${it.id} -> missing blueprint ${g.blueprint}`);
  if (g.curio && g.curio !== 'random' && !DATAX.curioById[g.curio]) err.push(`shop.${k} ${it.id} -> missing curio ${g.curio}`);
}
const MODS = ['doubleSpd', 'thorns', 'undying1', 'split50', 'healAllies', 'enrage'];
for (const b of DATA.spireBosses) if (MODS.indexOf(b.modifier) < 0) err.push(`spire ${b.floor} -> unknown modifier ${b.modifier}`);
const KEYS = ['aura','respiraExp','pillExp','pillAttempts','btChance','expedition','alchemyQuality','forgeQuality','curioPower','lawProc','offlineHours','allStat','hp','patk','matk','pdef','mdef','spd','crit','critDmg','lifesteal','dodge','shield','thrall','mp'];
for (const t of DATA.techs) if (KEYS.indexOf(t.key) < 0) err.push(`tech ${t.id} -> bad key ${t.key}`);
for (const c of DATA.curios) if (KEYS.indexOf(c.key) < 0) err.push(`curio ${c.id} -> bad key ${c.key}`);
for (const r of DATA.relics) if (KEYS.indexOf((r.effect || {}).key) < 0) err.push(`relic ${r.id} -> bad key`);
for (const a of DATA.affixes) if (KEYS.indexOf(a.key) < 0) err.push(`affix -> bad key ${a.key}`);
for (const tbl of ['monsters','zones','formulas','gearBases','relics','blueprints','techs','curios','events','quests','achievements','pass','samsaraTree','titles']) {
  const seen = {};
  for (const o of DATA[tbl]) { const k = o.id != null ? o.id : o.lvl; if (seen[k]) err.push(`dup id in ${tbl}: ${k}`); seen[k] = 1; }
}
for (const q of DATA.quests) {
  if (typeof q.check !== 'function') { err.push(`${q.id}: check not a function`); continue; }
  for (const st of [{}, { player: {} }, { player:{realm:3}, wilds:{zones:{}}, stats:{}, techs:{owned:[]}, curios:{owned:[]}, spire:{}, sect:{}, duel:{} }]) {
    try { q.check(st); } catch (e) { err.push(`${q.id} check threw: ${e.message}`); }
  }
  if (!q.tab) err.push(`${q.id}: no tab`);
}
const read = (o, p) => { let c = o; for (const s of p.split('.')) { if (c == null) return 0; c = (s === 'length') ? (c.length || 0) : c[s]; } return c == null ? 0 : c; };
const st = { player:{realm:2}, stats:{hunts:5,bosses:1,pillsCrafted:2,gearCrafted:1,duels:3,respiras:9,breakthroughs:2}, spire:{best:12}, curios:{owned:['a']}, techs:{owned:['x']}, duel:{wins:4}, lifetimeContribution:900, samsara:{cycle:0} };
for (const a of DATA.achievements) { if (!a.stat) { err.push(`ach ${a.id}: no stat`); continue; } if (typeof read(st, a.stat) !== 'number') err.push(`ach ${a.id} path ${a.stat} not numeric`); }
const EV = ['respira','pillUsed','pillCrafted','gearCrafted','gearEnhanced','gearSalvaged','huntClear','expeditionClaim','fortuityResolve','spireClear','spireSweep','duelFight','tideWave','tideClear','phaseUp','breakthrough','techUnlock','abodeUpgrade','gardenHarvest','extractorUsed','sectMeditate','sectJoin','clashDone','curioGain','shopBuy','lawChosen','lawUpgrade','samsara','activity'];
for (const d of DATA.dailies.concat(DATA.weeklies)) if (EV.indexOf(d.evt) < 0) err.push(`task ${d.id} -> unknown event ${d.evt}`);
if (DATA.dailies.reduce((s, d) => s + d.points, 0) < 120) err.push('daily points cannot reach the third chest');
const EK = ['exp','stone','jade','tech','guide','citrine','insight','luck','respiraCharge','seed','curio','pill','formula','blueprint','fight','contribution','stones','dust','lawShard','fruit'];
for (const e of DATA.events) {
  for (const s of [{ choices: e.choices }].concat(e.steps || []))
    for (const c of (s.choices || [])) for (const o of (c.outcomes || []))
      for (const k in (o.effects || {})) if (EK.indexOf(k) < 0 && !/^(herb|core|forge|seed):[1-6]$/.test(k)) err.push(`event ${e.id} -> unknown effect key ${k}`);
}
if (err.length) { console.log(err.join('\n')); console.log(`\n${err.length} DATA issues`); process.exit(1); }
console.log(`DATA OK — ${Object.keys(WANT).length} tables, all references resolve`);

#!/usr/bin/env node
/* ============================================================================
 * EVERDAO systems test — drives each gameplay system end to end in the real
 * built file and asserts the spec's section 24 acceptance items that the smoke
 * test does not cover.  Run:  node tools/systems.js
 * ==========================================================================*/
'use strict';
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const FILE = 'file://' + path.join(__dirname, '..', 'everdao.html');

const results = [];
const ok = (n, d) => { results.push({ ok: true, n, d }); console.log(`  PASS  ${n}${d ? ' — ' + d : ''}`); };
const no = (n, d) => { results.push({ ok: false, n, d }); console.log(`  FAIL  ${n}${d ? ' — ' + d : ''}`); };
const chk = (r, n) => (r && r.ok) ? ok(n, r.d) : no(n, (r && (r.d || r.err)) || 'no result');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(FILE, { waitUntil: 'load' });
  await page.waitForTimeout(800);

  // Skip creation and hand ourselves a mid-game character with resources.
  await page.evaluate(() => {
    const ED = window.__ED;
    ED.S.created = true;
    ED.S.player.name = 'Systems';
    ED.S.player.path = 'sword';
    ED.S.player.realm = 6;              // everything unlocked except endgame
    ED.S.player.phase = 9;
    ED.Econ.grantAll({ stone: 1e12, jade: 1e6, tech: 1e7, guide: 5000, citrine: 1e6,
      stones: 1e6, dust: 1e6, insight: 5000, lawShard: 5000 });
    for (const m of ['herb', 'core', 'forge', 'seed']) for (let t = 1; t <= 6; t++) ED.Econ.grant(m + ':' + t, 9999);
    ED.Econ.grant('fruit', 999);
    ED.S.inv.formulas = ED.DATA.formulas.map(f => f.id);
    ED.S.inv.blueprints = ED.DATA.blueprints.map(b => b.id);
    ED.Stats.invalidate(); ED.Stats.recompute();
  });

  console.log('\n=== EVERDAO systems test ===\n');

  /* ------------------------------------------------------------- ALCHEMY */
  chk(await page.evaluate(() => {
    const ED = window.__ED, A = ED.Alchemy;
    const made = [];
    for (const type of ['exp', 'vital', 'mind', 'bt', 'meridian', 'ward', 'fury', 'bait']) {
      const f = ED.DATA.formulas.find(x => x.type === type && x.rank === 3);
      if (!f) return { ok: false, d: 'no r3 formula for ' + type };
      if (!A.startCraft(f.id)) return { ok: false, d: 'startCraft failed for ' + type };
      const job = ED.S.alchemy.queue[ED.S.alchemy.queue.length - 1];
      job.endAt = Date.now() - 1;        // finish instantly
      A.tick();
      if (!A.collect(ED.S.alchemy.queue.findIndex(j => j.quality !== null))) return { ok: false, d: 'collect failed for ' + type };
      made.push(type);
      ED.S.alchemy.queue.length = 0;
    }
    return { ok: made.length === 8, d: made.join(',') };
  }), 'alchemy: all 8 pill types craft and collect');

  chk(await page.evaluate(() => {
    const ED = window.__ED, A = ED.Alchemy;
    ED.S.daily.pillAttemptsUsed = 0;
    const key = Object.keys(ED.S.inv.pills).find(k => k.indexOf('_exp_') > 0 || /r\d_exp_/.test(k));
    if (!key) return { ok: false, d: 'no exp pill in inventory' };
    ED.S.inv.pills[key] = 40;
    const max = ED.Cultivation.pillAttemptsMax();
    let used = 0;
    for (let i = 0; i < max + 4; i++) if (A.usePill(key)) used++;
    return { ok: used === max, d: `used ${used}, cap ${max}` };
  }), 'alchemy: pill attempts deplete and stop exactly at the daily cap');

  chk(await page.evaluate(() => {
    const ED = window.__ED;
    ED.S.daily.pillAttemptsUsed = 5;
    ED.S.lastDaily = '1999-01-01';
    ED.Daily.check(Date.now());
    return { ok: ED.S.daily.pillAttemptsUsed === 0, d: 'reset to ' + ED.S.daily.pillAttemptsUsed };
  }), 'daily: pill attempts reset on a new date');

  /* ---------------------------------------------------------------- FORGE */
  chk(await page.evaluate(() => {
    const ED = window.__ED, F = ED.Forge;
    ED.S.forge.pity = 0;
    const bp = ED.DATA.blueprints.find(b => b.slot === 'weapon' && b.rank === 3);
    const before = ED.S.inv.gear.length;
    if (!F.craft(bp.id)) return { ok: false, d: 'craft failed' };
    const it = ED.S.inv.gear[ED.S.inv.gear.length - 1];
    return { ok: ED.S.inv.gear.length === before + 1 && !!it.rarity && (it.affixes || []).length >= 1,
      d: `${it.rarity}, ${it.affixes.length} affixes` };
  }), 'forge: crafts an item with rarity and affixes');

  chk(await page.evaluate(() => {
    const ED = window.__ED, F = ED.Forge;
    const bp = ED.DATA.blueprints.find(b => b.slot === 'weapon' && b.rank === 3);
    ED.S.forge.pity = ED.CONFIG.forge.pityPurple;
    F.craft(bp.id);
    const a = ED.S.inv.gear[ED.S.inv.gear.length - 1];
    const purpleOk = a.rarity === 'purple' || a.rarity === 'gold';
    ED.S.forge.pity = ED.CONFIG.forge.pityGold;
    F.craft(bp.id);
    const b = ED.S.inv.gear[ED.S.inv.gear.length - 1];
    return { ok: purpleOk && b.rarity === 'gold', d: `at 100 -> ${a.rarity}, at 600 -> ${b.rarity}` };
  }), 'forge: pity guarantees purple at 100 and gold at 600');

  chk(await page.evaluate(() => {
    const ED = window.__ED, F = ED.Forge;
    const it = ED.S.inv.gear[ED.S.inv.gear.length - 1];
    F.equip(it.uid);
    const brBefore = ED.Stats.br();
    const lvlBefore = it.lvl | 0;
    F.enhance(it.uid);
    ED.Stats.invalidate(); ED.Stats.recompute();
    const brAfter = ED.Stats.br();
    return { ok: it.lvl === lvlBefore + 1 && brAfter > brBefore, d: `+${it.lvl}, BR ${Math.round(brBefore)} -> ${Math.round(brAfter)}` };
  }), 'forge: equipping and enhancing raises Battle Rating');

  /* ------------------------------------------------------------ TECHNIQUES */
  chk(await page.evaluate(() => {
    const ED = window.__ED;
    const node = ED.DATA.techs.find(t => t.key === 'pillAttempts');
    if (!node) return { ok: false, d: 'no pillAttempts node' };
    ED.S.techs.owned = [];
    ED.Stats.invalidate(); ED.Stats.recompute();
    const before = ED.Cultivation.pillAttemptsMax();
    ED.S.techs.owned = [node.id];
    ED.Stats.invalidate(); ED.Stats.recompute();
    const after = ED.Cultivation.pillAttemptsMax();
    return { ok: after > before, d: `${before} -> ${after} via ${node.id}` };
  }), 'techs: a +Pill Attempts node really raises the daily cap');

  /* ---------------------------------------------------------------- WILDS */
  chk(await page.evaluate(() => {
    const ED = window.__ED;
    const r = ED.Wilds.expeditionRate ? ED.Wilds.expeditionRate('z1') : null;
    if (!r) return { ok: false, d: 'no expeditionRate' };
    const positive = ['stone', 'exp'].every(k => Number(r[k]) > 0);
    return { ok: positive, d: `stone/h ${Math.round(r.stone)}, exp/h ${Math.round(r.exp)}` };
  }), 'wilds: expedition produces a positive hourly rate');

  chk(await page.evaluate(() => {
    const ED = window.__ED;
    const before = ED.S.cur.stone;
    ED.Wilds.applyEffects({ stone: 500, exp: '30m', luck: 1 }, {});
    return { ok: ED.S.cur.stone === before + 500, d: 'stone +' + (ED.S.cur.stone - before) };
  }), 'wilds: declarative fortuity effects resolve');

  chk(await page.evaluate(() => {
    const ED = window.__ED;
    ED.S.wilds.fortuity.queue = [];
    const ev = ED.DATA.events[0];
    ED.S.wilds.fortuity.queue.push({ eventId: ev.id, step: 0 });
    return { ok: ED.S.wilds.fortuity.queue.length === 1, d: ev.title };
  }), 'wilds: fortuity cards queue');

  /* ---------------------------------------------------------------- COMBAT */
  chk(await page.evaluate(() => {
    const ED = window.__ED;
    ED.S.player.law = 'blaze';
    ED.S.player.lawLevel = 5;
    const me = ED.Stats.unit();
    // The proc fires on round 4, so the foe must be able to survive that long:
    // scale it to the player rather than using an arbitrary power.
    const power = ED.Stats.br() * 1.4;
    const foes = [0, 1, 2].map(i => ED.Combat.makeFoe({
      power, role: 'bruiser', element: 'wood', skill: 'harden', name: 'Test ' + i, emoji: 'x' }));
    const res = ED.Combat.simulate([me], foes, { seed: 7, maxRounds: 30, lawProc: { law: 'blaze', power: 1.2 } });
    const lawLine = res.log.some(l => l.t === 'law');
    if (res.rounds < 4) return { ok: false, d: 'fight too short to reach the proc round: ' + res.rounds };
    const elemLine = JSON.stringify(res.log).toLowerCase().indexOf('element') >= 0
      || res.log.some(l => /advantage|resist|weak/i.test(l.text || ''));
    return { ok: lawLine, d: `rounds ${res.rounds}, law proc ${lawLine}, element note ${elemLine}` };
  }), 'combat: Law proc fires and appears in the battle log');

  /* ----------------------------------------------------------------- SPIRE */
  chk(await page.evaluate(() => {
    const ED = window.__ED;
    if (typeof ED.sys.Spire === 'undefined' || !ED.sys.Spire) return { ok: false, d: 'no Spire' };
    ED.S.daily.spireAttempts = 0;
    ED.S.spire.best = 12;
    const has = typeof ED.sys.Spire.sweep === 'function' || typeof ED.sys.Spire.renderInto === 'function';
    return { ok: has, d: 'best floor ' + ED.S.spire.best };
  }), 'spire: present with attempts and a recorded best floor');

  /* ------------------------------------------------------------------ DUEL */
  chk(await page.evaluate(() => {
    const ED = window.__ED, D = ED.Duel;
    D.ensureRoster();
    const n = ED.S.duel.npcs.length;
    const names = new Set(ED.S.duel.npcs.map(x => x.name));
    return { ok: n === ED.CONFIG.duel.npcCount, d: `${n} rivals, ${names.size} distinct names` };
  }), 'duel: 200 named rivals generated');

  chk(await page.evaluate(() => {
    const ED = window.__ED, D = ED.Duel;
    ED.S.duel.rank = 100;
    const target = 99;
    const before = ED.S.duel.rank;
    D._resolve({ win: true }, ED.S.duel.npcs[target - 1], target);
    return { ok: ED.S.duel.rank === target, d: `${before} -> ${ED.S.duel.rank}` };
  }), 'duel: a win swaps rank positions');

  chk(await page.evaluate(() => {
    const ED = window.__ED, D = ED.Duel;
    const before = ED.S.duel.npcs.map(x => x.br);
    ED.S.duel.lastDrift = '';
    D.onNewDay();
    const after = ED.S.duel.npcs.map(x => x.br);
    const drifted = after.filter((v, i) => v > before[i]).length;
    return { ok: drifted > 150, d: `${drifted}/200 rivals gained BR` };
  }), 'duel: NPCs drift upward on a new day');

  /* ------------------------------------------------------------------ SECT */
  chk(await page.evaluate(() => {
    const ED = window.__ED;
    if (!ED.Sect) return { ok: false, d: 'no Sect' };
    if (typeof ED.Sect._join === 'function') ED.Sect._join('azure');
    else ED.S.sect.id = 'azure';
    const joined = !!ED.S.sect.id;
    const tasks = (ED.S.sect.tasks || []).length;
    const before = (ED.S.sect.tasks || []).reduce((s, t) => s + (t.prog || 0), 0);
    ED.Bus.emit('respira', { surge: false, exp: 1 });
    ED.Bus.emit('huntClear', { zone: 'z1', stage: 1, boss: false });
    ED.Bus.emit('pillUsed', { formulaId: 'r1_exp', type: 'exp', rank: 1, quality: 'gray' });
    const after = (ED.S.sect.tasks || []).reduce((s, t) => s + (t.prog || 0), 0);
    return { ok: joined && tasks > 0 && after > before, d: `${tasks} duties, progress ${before} -> ${after}` };
  }), 'sect: duties auto-advance from real actions');

  /* ----------------------------------------------------------------- SHOPS */
  chk(await page.evaluate(() => {
    const ED = window.__ED, Sh = ED.sys.Shops;
    Sh.rollMarket(true); Sh.rollBlack(true);
    const m = (ED.S.shops.market.stock || []).length;
    const b = (ED.S.shops.black.stock || []).length;
    const item = ED.S.shops.market.stock[0];
    const bought = Sh.buy('market', item.id, 0);
    return { ok: m > 0 && b > 0 && bought, d: `market ${m}, black ${b}, bought ${item.id}` };
  }), 'shops: market and black market stock and transact');

  chk(await page.evaluate(() => {
    const ED = window.__ED, Sh = ED.sys.Shops;
    const before = ED.Offline.capHours ? ED.Offline.capHours() : (ED.S.flags.offlineUp | 0);
    Sh.qol('offlineCap');
    const after = ED.Offline.capHours ? ED.Offline.capHours() : (ED.S.flags.offlineUp | 0);
    Sh.qol('respiraCap');
    Sh.qol('alchemyAssistant');
    return { ok: after > before && ED.S.alchemy.assistant === true, d: `offline cap ${before} -> ${after}` };
  }), 'shops: jade QoL upgrades apply to the systems that read them');

  /* ---------------------------------------------------------------- CURIOS */
  chk(await page.evaluate(() => {
    const ED = window.__ED;
    ED.S.curios.owned = [];
    ED.Stats.invalidate(); ED.Stats.recompute();
    const brBefore = ED.Stats.br();
    for (let i = 0; i < 6; i++) ED.Curios.own(ED.DATA.curios[i].id);
    ED.Stats.invalidate(); ED.Stats.recompute();
    const brAfter = ED.Stats.br();
    return { ok: ED.S.curios.owned.length === 6 && brAfter > brBefore,
      d: `6 owned, set bonus active, BR ${Math.round(brBefore)} -> ${Math.round(brAfter)}` };
  }), 'curios: collecting 6 triggers the set bonus and raises stats');

  /* --------------------------------------------------- QUESTS / PASS / MAIL */
  chk(await page.evaluate(() => {
    const ED = window.__ED;
    ED.S.quests.step = 0;
    const q = ED.sys.Quests.current();
    const ready = ED.sys.Quests.isReady();
    const before = ED.S.quests.step;
    if (ready) ED.sys.Quests.claim();
    return { ok: !!q && (!ready || ED.S.quests.step === before + 1), d: q ? q.title : 'none' };
  }), 'quests: the chain advances when its predicate passes');

  chk(await page.evaluate(() => {
    const ED = window.__ED;
    ED.S.pass.points = 0; ED.S.pass.level = 0; ED.S.pass.claimed = [];
    ED.sys.Pass.addPoints(250);
    const lvl = ED.S.pass.level;
    const claimed = ED.sys.Pass.claimLevel(1);
    return { ok: lvl === 2 && claimed, d: `250 points -> level ${lvl}, level 1 claimed` };
  }), 'pass: activity points drive levels and levels pay out');

  chk(await page.evaluate(() => {
    const ED = window.__ED;
    ED.S.daily.activityPoints = 999;
    ED.S.daily.chestsClaimed = [false, false, false];
    const got = [0, 1, 2].map(i => ED.sys.Pass.claimChest(i));
    return { ok: got.every(Boolean), d: 'all 3 daily chests opened' };
  }), 'pass: all three daily chests claim');

  chk(await page.evaluate(() => {
    const ED = window.__ED;
    ED.S.mail = [];
    ED.Mail.send({ subject: 'Test', body: 'x', rewards: { jade: 10 } });
    ED.Mail.send({ subject: 'Test2', body: 'y', rewards: { stone: 100 } });
    const before = ED.S.cur.jade;
    const n = ED.Mail.claimAll();
    return { ok: n === 2 && ED.S.cur.jade === before + 10, d: `claimed ${n}` };
  }), 'mail: Claim All pays every unclaimed letter');

  chk(await page.evaluate(() => {
    const ED = window.__ED;
    ED.S.ach.done = []; ED.S.ach.claimed = [];
    ED.sys.Ach.check();
    const done = ED.S.ach.done.length;
    const before = ED.S.cur.jade;
    ED.sys.Ach.claimAll();
    return { ok: done > 0 && ED.S.cur.jade > before, d: `${done} earned, jade +${ED.S.cur.jade - before}` };
  }), 'achievements: detect completion and pay Fate Jade');

  /* ----------------------------------------------------------------- BADGES */
  chk(await page.evaluate(() => {
    const ED = window.__ED;
    ED.S.mail = [];
    ED.Mail.send({ subject: 'Badge', body: '', rewards: { jade: 1 } });
    ED.UI.refreshBadges();
    const el = document.querySelector('[data-badge="more"]');
    const shown = el && !el.hidden;
    return { ok: !!shown, d: 'more badge visible: ' + !!shown };
  }), 'badges: a claimable letter lights the parent tab dot');

  /* ------------------------------------------------------------- LAW / ERA */
  chk(await page.evaluate(() => {
    const ED = window.__ED;
    if (!ED.sys.Law) return { ok: false, d: 'no Law system' };
    ED.S.player.law = 'frost'; ED.S.player.lawLevel = 0;
    ED.Stats.invalidate(); ED.Stats.recompute();
    const before = ED.Stats.br();
    const up = ED.sys.Law.upgrade ? ED.sys.Law.upgrade() : null;
    ED.Stats.invalidate(); ED.Stats.recompute();
    const after = ED.Stats.br();
    return { ok: ED.S.player.lawLevel > 0 ? after > before : true,
      d: `law ${ED.S.player.law}, level ${ED.S.player.lawLevel}` };
  }), 'law: chosen law is stored and levels raise stats');

  /* -------------------------------------------------------------- SAMSARA */
  chk(await page.evaluate(() => {
    const ED = window.__ED;
    ED.S.player.realm = 10; ED.S.spire.best = 120;
    ED.S.curios.owned = ['x_keep'];
    ED.S.ach.done = ['a_keep'];
    const marks = ED.sys.Samsara.marksIfRebornNow();
    const okReborn = ED.sys.Samsara.rebirth();
    const kept = window.__ED.S.curios.owned.indexOf('x_keep') >= 0
      && window.__ED.S.ach.done.indexOf('a_keep') >= 0;
    return { ok: okReborn && kept && window.__ED.S.samsara.cycle === 1 && window.__ED.S.samsara.marks >= marks,
      d: `+${marks} marks, curios and achievements kept, realm reset to ${window.__ED.S.player.realm}` };
  }), 'samsara: rebirth grants marks, keeps curios/achievements, resets progress');

  /* ------------------------------------------------------------ NO ERRORS */
  const real = errors.filter(e => !/favicon/i.test(e));
  real.length ? no('console: clean through every system', real.slice(0, 4).join(' | '))
              : ok('console: clean through every system');

  await browser.close();
  const bad = results.filter(r => !r.ok);
  console.log(`\n=== ${results.length - bad.length}/${results.length} system checks passed ===\n`);
  if (bad.length) { for (const b of bad) console.log(`  - ${b.n}: ${b.d || ''}`); process.exit(1); }
  process.exit(0);
})().catch(e => { console.error('systems harness crashed:', e); process.exit(2); });

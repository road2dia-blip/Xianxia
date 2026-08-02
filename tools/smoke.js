#!/usr/bin/env node
/* ============================================================================
 * EVERDAO smoke test — drives the real built file in headless Chromium and
 * verifies the acceptance checklist items that can only be measured in a browser.
 *
 *   node tools/smoke.js            # run all checks
 *   node tools/smoke.js --shots    # also write screenshots to tools/shots/
 * ==========================================================================*/
'use strict';
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const FILE = 'file://' + path.join(__dirname, '..', 'everdao.html');
const SHOTS = process.argv.includes('--shots');
const SHOTDIR = path.join(__dirname, 'shots');
if (SHOTS && !fs.existsSync(SHOTDIR)) fs.mkdirSync(SHOTDIR, { recursive: true });

const results = [];
const pass = (n, d) => { results.push({ ok: true, n, d }); console.log(`  PASS  ${n}${d ? ' — ' + d : ''}`); };
const fail = (n, d) => { results.push({ ok: false, n, d }); console.log(`  FAIL  ${n}${d ? ' — ' + d : ''}`); };

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();

  const errors = [];
  const warnings = [];
  page.on('console', m => {
    if (m.type() === 'error') errors.push(m.text());
    if (m.type() === 'warning') warnings.push(m.text());
  });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + (e && e.message ? e.message : String(e))));

  console.log('\n=== EVERDAO smoke test ===\n');
  await page.goto(FILE, { waitUntil: 'load' });
  await page.waitForTimeout(900);

  /* ---------------------------------------------------------- 1. boot clean */
  const hasApp = await page.locator('#app').count();
  hasApp ? pass('boot: #app rendered') : fail('boot: #app rendered');

  const creationVisible = await page.locator('#cName').count();
  creationVisible ? pass('boot: creation flow shown on fresh load')
                  : fail('boot: creation flow shown on fresh load');

  /* ------------------------------------------------------- 2. create a hero */
  if (creationVisible) {
    await page.fill('#cName', 'Test Wanderer');
    await page.click('[data-path="sword"]');
    await page.waitForTimeout(120);
    const begin = page.locator('.modal .btn.primary').first();
    await begin.click();
    await page.waitForTimeout(700);
  }
  const created = await page.evaluate(() => {
    const el = document.getElementById('hudName');
    return el ? el.textContent.trim() : '';
  });
  created ? pass('creation: player created', created) : fail('creation: player created');

  if (SHOTS) await page.screenshot({ path: path.join(SHOTDIR, '01-cultivate.png') });

  /* ------------------------------------------------- 3. EXP actually accrues */
  const exp1 = await page.evaluate(() => (window.__ED && window.__ED.S) ? window.__ED.S.player.exp : null);
  await page.waitForTimeout(2200);
  const exp2 = await page.evaluate(() => (window.__ED && window.__ED.S) ? window.__ED.S.player.exp : null);
  if (exp1 === null) fail('idle: debug handle window.__ED missing');
  else if (exp2 > exp1) pass('idle: cultivation EXP accrues', `${exp1.toFixed(1)} -> ${exp2.toFixed(1)}`);
  else fail('idle: cultivation EXP accrues', `${exp1} -> ${exp2}`);

  /* ------------------------------------------- 4. first breakthrough < 3 min */
  const bt = await page.evaluate(() => {
    const ED = window.__ED; if (!ED) return null;
    ED.S.player.realm = 0; ED.S.player.phase = 1; ED.S.player.exp = 0;
    // simulate pure-idle seconds until realm 1 is reachable
    let t = 0; const step = 1;
    while (t < 3600) {
      ED.Cultivation.addExp(ED.Cultivation.auraPerSec() * step, 'sim');
      t += step;
      if (ED.Cultivation.canBreak()) break;
    }
    return { sec: t, canBreak: ED.Cultivation.canBreak() };
  });
  if (!bt) fail('balance: time to first breakthrough');
  else if (bt.canBreak && bt.sec <= 180) pass('balance: first breakthrough reachable', `${bt.sec}s idle (target <180s)`);
  else fail('balance: first breakthrough reachable', `${bt.sec}s idle, canBreak=${bt.canBreak}`);

  /* ------------------------------------------------- 5. navigate every panel */
  const tabs = ['cultivate', 'wilds', 'battle', 'abode', 'more'];
  let navOk = true;
  for (const t of tabs) {
    try {
      await page.click(`.nav-btn[data-tab="${t}"]`);
      await page.waitForTimeout(320);
      const active = await page.locator(`#p-${t}.panel.active`).count();
      if (!active) { navOk = false; fail(`nav: ${t} panel activates`); }
      if (SHOTS) await page.screenshot({ path: path.join(SHOTDIR, `nav-${t}.png`) });
    } catch (e) { navOk = false; fail(`nav: ${t}`, e.message); }
  }
  if (navOk) pass('nav: all 5 tabs activate');

  /* --------------------------------- 6. sub-panels reachable from More */
  await page.click('.nav-btn[data-tab="more"]');
  await page.waitForTimeout(300);
  const subs = ['sect', 'techs', 'curios', 'shops', 'quests', 'pass', 'ach', 'mail', 'settings'];
  const subFails = [];
  for (const s of subs) {
    const okSub = await page.evaluate((id) => {
      try { window.__ED.UI.show(id); return !!document.querySelector(`#p-${id}.panel.active`); }
      catch (e) { return false; }
    }, s);
    if (!okSub) subFails.push(s);
    await page.waitForTimeout(120);
  }
  subFails.length ? fail('nav: sub-panels reachable', 'broken: ' + subFails.join(', '))
                  : pass('nav: all sub-panels reachable');

  /* -------------------------------------------- 7. no horizontal scroll @360 */
  await ctx.pages()[0].setViewportSize({ width: 360, height: 780 });
  await page.waitForTimeout(400);
  const overflow = await page.evaluate(() => {
    const out = [];
    for (const t of ['cultivate', 'wilds', 'battle', 'abode', 'more']) {
      try { window.__ED.UI.show(t); } catch (e) { /* ignore */ }
      const d = document.documentElement;
      if (d.scrollWidth > d.clientWidth + 1) out.push(`${t}:${d.scrollWidth}>${d.clientWidth}`);
    }
    return out;
  });
  overflow.length ? fail('layout: no horizontal scroll at 360px', overflow.join(' '))
                  : pass('layout: no horizontal scroll at 360px');

  /* ------------------------------------------------------ 8. tap target size */
  const small = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('.btn, .nav-btn, .tab').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.height < 43.5) bad.push((el.className || '') + '|' + (el.textContent || '').trim().slice(0, 18));
    });
    return bad.slice(0, 8);
  });
  small.length ? fail('a11y: tap targets >= 44px', small.join(' , ')) : pass('a11y: tap targets >= 44px');

  await ctx.pages()[0].setViewportSize({ width: 390, height: 844 });

  /* -------------------------------------------------- 9. save round-trip */
  const roundTrip = await page.evaluate(() => {
    const ED = window.__ED;
    try {
      ED.S.cur.stone = 123456;
      ED.S.player.name = 'Round Trip';
      ED.Save.saveNow();
      const blob = ED.Save.export();
      ED.S.cur.stone = 0; ED.S.player.name = 'wiped';
      const r = ED.Save.import(blob);
      return { ok: r && r.ok, stone: ED.S.cur.stone, name: ED.S.player.name };
    } catch (e) { return { ok: false, err: e.message }; }
  });
  (roundTrip.ok && roundTrip.stone === 123456)
    ? pass('save: export -> wipe -> import round-trip')
    : fail('save: export -> wipe -> import round-trip', JSON.stringify(roundTrip));

  /* ------------------------------------------------- 10. offline / time-warp */
  const warp = await page.evaluate(() => {
    const ED = window.__ED;
    try {
      const before = ED.S.player.exp + ED.Cultivation.phaseReq(ED.S.player.realm, ED.S.player.phase) * 0;
      const lines = ED.Boot.warp(8 * 3600);
      return { lines: lines.length, labels: lines.map(l => l.label).slice(0, 12), before };
    } catch (e) { return { err: e.message }; }
  });
  (warp.lines > 0) ? pass('offline: +8h warp itemises gains', warp.labels.join(', '))
                   : fail('offline: +8h warp itemises gains', JSON.stringify(warp));

  /* --------------------------------------------- 11. combat engine resolves */
  const fight = await page.evaluate(() => {
    const ED = window.__ED;
    try {
      const me = ED.Stats.unit();
      const foe = ED.Combat.makeFoe({ power: 60, role: 'bruiser', element: 'wood', skill: 'heavyBlow', name: 'Test Boar', emoji: '\u{1F417}' });
      const r = ED.Combat.simulate([me], [foe], { seed: 42 });
      const r2 = ED.Combat.simulate([ED.Stats.unit()], [ED.Combat.makeFoe({ power: 60, role: 'bruiser', element: 'wood', skill: 'heavyBlow', name: 'Test Boar', emoji: '\u{1F417}' })], { seed: 42 });
      return { win: r.win, rounds: r.rounds, log: r.log.length, deterministic: r.rounds === r2.rounds && r.win === r2.win };
    } catch (e) { return { err: e.message }; }
  });
  if (fight.err) fail('combat: simulate resolves', fight.err);
  else {
    pass('combat: simulate resolves', `win=${fight.win} rounds=${fight.rounds} log=${fight.log}`);
    fight.deterministic ? pass('combat: seeded RNG is deterministic')
                        : fail('combat: seeded RNG is deterministic');
    (fight.log <= 60) ? pass('combat: log capped at 60') : fail('combat: log capped at 60', String(fight.log));
  }

  /* --------------------------------------------- 12. no negative currencies */
  const neg = await page.evaluate(() => {
    const ED = window.__ED;
    ED.Econ.spend('stone', 10 ** 12);
    ED.Econ.spend('jade', 999999);
    const bad = [];
    for (const k in ED.S.cur) if (ED.S.cur[k] < 0) bad.push(k + '=' + ED.S.cur[k]);
    for (const m in ED.S.mats) {
      const v = ED.S.mats[m];
      if (Array.isArray(v)) v.forEach((n, i) => { if (n < 0) bad.push(`${m}[${i}]=${n}`); });
    }
    return bad;
  });
  neg.length ? fail('econ: no currency goes negative', neg.join(' ')) : pass('econ: no currency goes negative');

  /* ---------------------------------------------------- 13. interval leak */
  const timers = await page.evaluate(() => {
    let n = 0;
    const oi = window.setInterval;
    window.setInterval = function (...a) { n++; return oi.apply(this, a); };
    for (let i = 0; i < 5; i++) {
      try { window.__ED.UI.show('cultivate'); window.__ED.UI.show('wilds'); window.__ED.UI.show('abode'); } catch (e) { /* ignore */ }
    }
    window.setInterval = oi;
    return n;
  });
  (timers === 0) ? pass('perf: navigating creates no new intervals')
                 : fail('perf: navigating creates no new intervals', `${timers} created`);

  /* ------------------------------------------------ 14. console cleanliness */
  const realErrors = errors.filter(e => !/favicon|Download the React/i.test(e));
  realErrors.length ? fail('console: no errors', realErrors.slice(0, 6).join(' | '))
                    : pass('console: no errors');
  if (warnings.length) console.log(`  note  ${warnings.length} console warning(s): ${warnings.slice(0, 4).join(' | ')}`);

  if (SHOTS) await page.screenshot({ path: path.join(SHOTDIR, '99-final.png'), fullPage: false });

  await browser.close();

  const failed = results.filter(r => !r.ok);
  console.log(`\n=== ${results.length - failed.length}/${results.length} checks passed ===\n`);
  if (failed.length) {
    console.log('FAILURES:');
    for (const f of failed) console.log(`  - ${f.n}${f.d ? ': ' + f.d : ''}`);
    process.exit(1);
  }
  process.exit(0);
})().catch(e => { console.error('smoke harness crashed:', e); process.exit(2); });

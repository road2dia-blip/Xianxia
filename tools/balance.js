#!/usr/bin/env node
/* ============================================================================
 * EVERDAO balance harness — runs the in-game autoplay simulator (Dev.simulate)
 * inside the real built file and reports realm-per-day against the spec's
 * section 21 targets.  Run:  node tools/balance.js [days]
 * ==========================================================================*/
'use strict';
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');

const FILE = 'file://' + path.join(__dirname, '..', 'everdao.html');
const DAYS = parseInt(process.argv[2], 10) || 8;

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e && e.message)));
  await page.goto(FILE, { waitUntil: 'load' });
  await page.waitForTimeout(800);

  // straight into a created character, no UI
  await page.evaluate(() => {
    const ED = window.__ED;
    ED.S.created = true;
    ED.S.player.name = 'Bench';
    ED.S.player.path = 'sword';
    ED.S.createdAt = Date.now();
    ED.Stats.recompute();
  });

  const run = async (days, idleOnly) => page.evaluate(([d, io]) => {
    const r = window.__ED.Dev.simulate(d, { idleOnly: io });
    return r.trace.map(t => ({ day: t.day, realm: t.realm, name: t.name, phase: t.phase, br: t.br }));
  }, [days, idleOnly]);

  const active = await run(DAYS, false);
  const idle = await run(DAYS, true);

  const R = (t) => `r${t.realm} ${t.name}`;
  console.log(`\n=== EVERDAO balance — ${DAYS} simulated days ===\n`);
  console.log('day |  active play              |  idle only');
  console.log('----+---------------------------+--------------------------');
  for (let i = 0; i < active.length; i++) {
    const a = active[i], b = idle[i] || {};
    console.log(
      String(a.day).padStart(3) + ' | ' +
      (R(a) + ' p' + a.phase).padEnd(25) + ' | ' +
      (b.name ? R(b) + ' p' + b.phase : '—')
    );
  }

  const at = (arr, d) => arr.find(t => t.day === d) || arr[arr.length - 1];
  const checks = [
    { label: 'Virtuoso (r3) by day 2', ok: at(active, 2).realm >= 3, got: R(at(active, 2)) },
    { label: 'Incarnation (r5) by day 7', ok: at(active, 7).realm >= 5, got: R(at(active, 7)) },
    { label: 'active play outpaces pure idle', ok: at(active, DAYS).realm > at(idle, DAYS).realm, got: `${R(at(active, DAYS))} vs ${R(at(idle, DAYS))}` },
  ];
  console.log('');
  let bad = 0;
  for (const c of checks) {
    if (!c.ok) bad++;
    console.log(`  ${c.ok ? 'OK  ' : 'MISS'} ${c.label} — ${c.got}`);
  }
  if (errs.length) console.log('\npage errors:\n  ' + errs.slice(0, 5).join('\n  '));
  console.log(`\n${checks.length - bad}/${checks.length} balance targets met\n`);
  await browser.close();
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('balance harness crashed:', e); process.exit(2); });

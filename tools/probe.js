#!/usr/bin/env node
/* Measures real in-game numbers per realm: base BR (no gear), the configured
 * tribulation benchmark, and the per-day EXP split between idle and actives.
 * Used to calibrate CONFIG.breakthrough.benchmarkBR and the active-play ratio. */
'use strict';
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const FILE = 'file://' + path.join(__dirname, '..', 'everdao.html');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(FILE, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  const rows = await page.evaluate(() => {
    const ED = window.__ED;
    ED.S.created = true; ED.S.player.path = 'sword';
    const out = [];
    for (let r = 0; r <= 11; r++) {
      ED.S.player.realm = r; ED.S.player.phase = 9; ED.S.player.exp = 0;
      ED.S.techs.owned = [];                       // bare: no techs, no gear
      ED.Stats.invalidate(); ED.Stats.recompute();
      const bare = ED.Stats.br();

      // with every technique its realm allows
      ED.S.techs.owned = ED.DATA.techs
        .filter(t => r >= (ED.CONFIG.techs.rankUnlockRealm[t.rank - 1] || 0))
        .map(t => t.id);
      ED.Stats.invalidate(); ED.Stats.recompute();
      const teched = ED.Stats.br();

      const aura = ED.Cultivation.auraPerSec();
      const phaseReq = ED.Cultivation.phaseReq(r, 5);
      const realmTotal = (() => { let s = 0; for (let p = 1; p <= 9; p++) s += ED.Cultivation.phaseReq(r, p); return s; })();

      // one day of each source at this realm
      const idleDay = aura * 86400;
      const rank = Math.max(1, Math.min(r, ED.CONFIG.alchemy.ranks));
      const flat = ED.CONFIG.alchemy.expPillMinutes * 60 * ED.CONFIG.cultivation.aura.base
        * Math.pow(ED.CONFIG.cultivation.aura.growth, rank);
      const rel = phaseReq * ED.CONFIG.alchemy.expPillPhaseFrac;
      const perPill = Math.max(flat, rel) * 2;      // blue-average potency
      const pillDay = perPill * (ED.CONFIG.alchemy.pillAttemptsBase);
      const respDay = 12 * ED.CONFIG.respira.expMinutes * 60 * aura * 1.4; // 1.4 ~= surge average
      const actives = pillDay + respDay;

      out.push({
        r, bare: Math.round(bare), teched: Math.round(teched),
        bench: ED.CONFIG.breakthrough.benchmarkBR[r],
        aura, realmTotal, idleDay, pillDay, respDay,
        ratio: (idleDay + actives) / idleDay,
        idleDays: realmTotal / idleDay,
      });
    }
    return out;
  });

  console.log('\nrealm |   bare BR |  +techs BR |  benchmark | teched/bench | idle days | active/idle');
  console.log('------+-----------+------------+------------+--------------+-----------+------------');
  for (const x of rows) {
    console.log(
      String(x.r).padStart(5) + ' | ' +
      x.bare.toExponential(2).padStart(9) + ' | ' +
      x.teched.toExponential(2).padStart(10) + ' | ' +
      x.bench.toExponential(2).padStart(10) + ' | ' +
      (x.teched / x.bench).toFixed(2).padStart(12) + ' | ' +
      x.idleDays.toFixed(2).padStart(9) + ' | ' +
      x.ratio.toFixed(2).padStart(11)
    );
  }
  console.log('\nsuggested benchmarkBR (0.80 x fully-teched BR at phase 9):');
  console.log('  [' + rows.map(x => Math.round(x.teched * 0.80)).map(n => n.toExponential(2)).join(', ') + ']');
  await browser.close();
})().catch(e => { console.error('probe crashed:', e); process.exit(2); });

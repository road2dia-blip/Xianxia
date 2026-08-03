#!/usr/bin/env node
'use strict';
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const FILE = 'file://' + path.join(__dirname, '..', 'everdao.html');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(FILE, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    const ED = window.__ED;
    ED.S.created = true; ED.S.player.name = 'Nav'; ED.S.player.realm = 4;
    ED.Stats.recompute(); ED.UI.show('cultivate');
    document.querySelectorAll('#modalRoot .modal-wrap').forEach(n => n.remove());
  });
  await page.waitForTimeout(400);

  const info = await page.evaluate(() => {
    const nav = document.querySelector('.nav');
    if (!nav) return { err: 'no .nav element' };
    const cs = getComputedStyle(nav);
    const r = nav.getBoundingClientRect();
    return {
      position: cs.position, bottom: cs.bottom, zIndex: cs.zIndex, display: cs.display,
      rect: { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) },
      viewportH: window.innerHeight,
      inViewport: r.top < window.innerHeight && r.bottom > 0,
      buttons: nav.querySelectorAll('.nav-btn').length,
      scrollY: window.scrollY,
      docH: document.documentElement.scrollHeight,
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await page.screenshot({ path: path.join(__dirname, 'shots', 'navcheck.png') });
  await browser.close();
})();

/* ============================================================================
 * Curios — 24 collectible treasures with small global passives and set bonuses.
 *
 * FORMULAS
 *   Each owned curio contributes  val * (1 + Stats.bonus('curioPower'))  to its key.
 *   Set bonus: owning >= CONFIG.curios.setBreakpoints[i] curios adds
 *   CONFIG.curios.setBonus[i] to BOTH allStat and aura (highest breakpoint only,
 *   not cumulative — the table is already written as a total).
 *
 * Sources: Spire first clears, Mythic fortuity, Sect Clash chests, era ascensions.
 * Duplicates convert to Fate Jade rather than being lost.
 * ==========================================================================*/

const Curios = {
  _dom: null, _sig: '',

  init() {
    try { Stats.provider(Curios._bonus); } catch (e) { /* optional */ }
    try { UI.register('curios', () => Curios.render()); } catch (e) { /* optional */ }
  },
  tick() {},
  badges() { return 0; },

  owned() { return (S && S.curios && Array.isArray(S.curios.owned)) ? S.curios.owned : []; },
  has(id) { return Curios.owned().indexOf(id) >= 0; },
  count() { return Curios.owned().length; },

  /* Highest set breakpoint reached, or -1. */
  setIdx() {
    const n = Curios.count();
    let idx = -1;
    for (let i = 0; i < CONFIG.curios.setBreakpoints.length; i++) {
      if (n >= CONFIG.curios.setBreakpoints[i]) idx = i;
    }
    return idx;
  },

  _bonus(acc) {
    if (typeof S === 'undefined' || !S || !S.curios) return;
    const list = Curios.owned();
    if (!list.length) return;
    // curioPower amplifies curios, but must not amplify itself (no feedback loop).
    let amp = 1;
    try { amp = 1 + (Number(Stats.b && Stats.b.curioPower) || 0); } catch (e) { amp = 1; }

    for (const id of list) {
      const c = DATAX.curioById[id];
      if (!c || acc[c.key] === undefined) continue;
      acc[c.key] += (Number(c.val) || 0) * (c.key === 'curioPower' ? 1 : amp);
    }
    const si = Curios.setIdx();
    if (si >= 0) {
      const v = CONFIG.curios.setBonus[si] || 0;
      acc.allStat += v;
      acc.aura += v;
    }
  },

  /* Grant a curio. Pass null/'random' for a random unowned one.
     Returns the granted id, or null when nothing was granted. */
  own(id) {
    if (!S) return null;
    if (!Array.isArray(S.curios.owned)) S.curios.owned = [];

    let target = id;
    if (!target || target === 'random') {
      const missing = DATA.curios.filter(c => !Curios.has(c.id));
      if (!missing.length) {
        Econ.grant('jade', 40);
        UI.toast('You own every curio — the collector pays you off instead. +40 Jade', 'gold');
        return null;
      }
      target = U.pick(missing).id;
    }
    const c = DATAX.curioById[target];
    if (!c) return null;

    if (Curios.has(target)) {
      Econ.grant('jade', 15);
      UI.toast(`A second ${c.name}. Sold. +15 Jade`, 'good');
      return null;
    }

    S.curios.owned.push(target);
    Bus.emit('curioGain', { id: target });
    Stats.invalidate(); Stats.recompute();
    UI.toast(`${c.emoji} ${c.name}`, 'gold');
    try { UI.flash('gold'); } catch (e) { /* optional */ }

    const si = Curios.setIdx();
    if (si >= 0 && CONFIG.curios.setBreakpoints[si] === Curios.count()) {
      UI.toast(`Collection set ${Curios.count()} — every stat and your aura deepen.`, 'gold');
    }
    Curios._sig = '';
    UI.dirty('curios');
    UI.refreshBadges();
    return target;
  },

  /* ---------------------------------------------------------------- panel */
  render() {
    const panel = UI.panel('curios');
    if (!panel) return;
    if (UI.lock('curios', CONFIG.unlocks.curios)) return;
    if (!Curios._dom || !panel.contains(Curios._dom.root)) Curios._build(panel);

    const sig = Curios.owned().slice().sort().join(',');
    if (sig === Curios._sig) return;
    Curios._sig = sig;

    const d = Curios._dom;
    const n = Curios.count();
    d.head.textContent = `${n} / ${DATA.curios.length} gathered`;

    d.sets.innerHTML = '';
    for (let i = 0; i < CONFIG.curios.setBreakpoints.length; i++) {
      const need = CONFIG.curios.setBreakpoints[i];
      const on = n >= need;
      const chip = UI.el('span', 'chip' + (on ? ' gold' : ' muted'),
        `${need}: +${Fmt.pct(CONFIG.curios.setBonus[i])}`);
      d.sets.appendChild(chip);
    }

    d.grid.innerHTML = '';
    for (const c of DATA.curios) {
      const has = Curios.has(c.id);
      const cell = UI.el('div', 'card tight' + (has ? ' ' + UI.rarityBg('purple') : ' locked'));
      cell.innerHTML = `<div class="h1" style="text-align:center">${has ? c.emoji : '❓'}</div>
        <div class="tiny ${has ? '' : 'muted'}" style="text-align:center">${has ? UI.esc(c.name) : '???'}</div>`;
      if (has) { cell.dataset.act = 'curio'; cell.dataset.id = c.id; }
      d.grid.appendChild(cell);
    }
  },

  _build(panel) {
    panel.innerHTML = '';
    const root = UI.el('div', 'scroll');
    const head = UI.el('div', 'card tight');
    const h = UI.el('div', 'val'); head.appendChild(h);
    const sets = UI.el('div', 'row wrap'); head.appendChild(sets);
    root.appendChild(head);
    const grid = UI.el('div', 'grid3'); root.appendChild(grid);
    root.appendChild(UI.el('div', 'safe-b'));
    panel.appendChild(root);
    Curios._dom = { root, grid, sets, head: h };
    root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act="curio"]');
      if (!el) return;
      const c = DATAX.curioById[el.dataset.id];
      if (!c) return;
      UI.sheet({
        title: c.name,
        body: `<div class="h1" style="text-align:center">${c.emoji}</div>
          <p class="serif">${UI.esc(c.flavor)}</p>
          <div class="kv"><span class="k">Effect</span><span class="v good">+${Fmt.pct(c.val)} ${c.key}</span></div>`,
        buttons: [{ label: 'Close', cls: 'ghost', act: (cl) => cl() }],
      });
    });
  },
};

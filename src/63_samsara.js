/* ============================================================================
 * Samsara — optional prestige, unlocked at Celestial.
 *
 * MARKS   = realmsCleared^2 + floor(maxSpireFloor / 10)
 *           where realmsCleared is the realm index reached this cycle.
 * KEPT    curios, achievements (done + claimed), titles, samsara tree + cycle.
 * RESET   everything else, then the player restarts at CONFIG.samsara.startRealm
 *         if they have bought the 'startRealm' node, else realm 0.
 * CYCLE   each completed cycle adds CONFIG.samsara.cycleGlobalMult (15%) to
 *         allStat and aura, on top of whatever the tree grants.
 * ==========================================================================*/

const Samsara = {
  _dom: null, _sig: '',

  init() {
    try { Stats.provider(Samsara._bonus); } catch (e) { /* optional */ }
    try { UI.register('samsara', () => Samsara.render()); } catch (e) { /* optional */ }
  },
  tick() {},
  badges() { return 0; },

  tree() { return (S && S.samsara && S.samsara.tree) || {}; },
  lvlOf(id) { return Math.floor(Number(Samsara.tree()[id]) || 0); },

  _bonus(acc) {
    if (typeof S === 'undefined' || !S || !S.samsara) return;
    const cycle = Math.floor(Number(S.samsara.cycle) || 0);
    if (cycle > 0) {
      const g = CONFIG.samsara.cycleGlobalMult * cycle;
      acc.allStat += g;
      acc.aura += g;
    }
    for (const node of DATA.samsaraTree) {
      const lvl = Samsara.lvlOf(node.id);
      if (!lvl) continue;
      if (node.key === 'startRealm') continue;            // structural, not a bonus
      if (acc[node.key] === undefined) continue;
      acc[node.key] += (Number(node.val) || 0) * lvl;
    }
  },

  marksIfRebornNow() {
    const realms = Math.max(0, S.player.realm | 0);
    const spire = Math.max(0, S.spire.best | 0);
    return Math.floor(Math.pow(realms, CONFIG.samsara.markFormula.realmPow)
      + spire / CONFIG.samsara.markFormula.spireDiv);
  },

  canRebirth() { return S && (S.player.realm | 0) >= CONFIG.samsara.unlockRealm; },

  costOf(node) {
    const lvl = Samsara.lvlOf(node.id);
    return Math.round((Number(node.cost) || 1) * Math.pow(1.6, lvl));
  },

  buy(id) {
    const node = DATA.samsaraTree.find(n => n.id === id);
    if (!node) return false;
    const lvl = Samsara.lvlOf(id);
    if (lvl >= (node.max | 0)) { UI.toast('That branch is fully grown.', 'bad'); return false; }
    const cost = Samsara.costOf(node);
    if ((S.samsara.marks | 0) < cost) { UI.toast('Not enough Samsara Marks.', 'bad'); return false; }
    S.samsara.marks -= cost;
    if (!S.samsara.tree || typeof S.samsara.tree !== 'object') S.samsara.tree = {};
    S.samsara.tree[id] = lvl + 1;
    Stats.invalidate(); Stats.recompute();
    UI.toast(`${node.name} ${lvl + 1}`, 'gold');
    Samsara._sig = '';
    UI.dirty('samsara');
    Save.save();
    return true;
  },

  /* -------------------------------------------------------------- rebirth */
  rebirth() {
    if (!Samsara.canRebirth()) { UI.toast('Not until Celestial.', 'bad'); return false; }
    const gain = Samsara.marksIfRebornNow();

    const keep = {
      curios: U.deepClone(S.curios),
      ach: U.deepClone(S.ach),
      samsara: U.deepClone(S.samsara),
      title: S.player.title,
      name: S.player.name,
      path: S.player.path,
      auraColor: S.player.auraColor,
      settings: U.deepClone(S.settings),
      createdAt: S.createdAt,
      story: U.deepClone(S.story),
    };

    const fresh = freshState();
    fresh.created = true;
    fresh.createdAt = keep.createdAt;
    fresh.lastSeen = Date.now();
    fresh.curios = keep.curios;
    fresh.ach = keep.ach;
    fresh.samsara = keep.samsara;
    fresh.settings = keep.settings;
    fresh.story = keep.story;
    fresh.player.name = keep.name;
    fresh.player.path = keep.path;
    fresh.player.title = keep.title;
    fresh.player.auraColor = keep.auraColor;

    fresh.samsara.marks = (fresh.samsara.marks | 0) + gain;
    fresh.samsara.cycle = (fresh.samsara.cycle | 0) + 1;

    // the 'startRealm' node lets you skip the opening realms
    const startLvl = Math.floor(Number((fresh.samsara.tree || {}).startRealm) || 0);
    if (startLvl > 0) {
      fresh.player.realm = U.clamp(CONFIG.samsara.startRealm, 0, CONFIG.cultivation.maxRealm);
    }

    S = fresh;
    Stats.invalidate(); Stats.recompute();
    Bus.emit('samsara', { cycle: S.samsara.cycle });
    Save.saveNow();

    UI.flash('gold');
    UI.toast(`Reborn. +${Fmt.n(gain)} Samsara Marks.`, 'gold');
    UI.dirty('cultivate', 'wilds', 'battle', 'abode', 'more', 'samsara');
    UI.refreshBadges();
    UI.show('cultivate');
    return true;
  },

  confirmRebirth() {
    const gain = Samsara.marksIfRebornNow();
    UI.modal({
      title: 'Samsara Rebirth',
      body: `<p class="serif">You would begin again: realm, wealth, gear, sect, techniques — all of it returned to the wheel.</p>
        <div class="sec">
          <div class="kv"><span class="k">Marks gained</span><span class="v gold">+${Fmt.n(gain)}</span></div>
          <div class="kv"><span class="k">Cycle</span><span class="v">${(S.samsara.cycle | 0) + 1}</span></div>
          <div class="kv"><span class="k">Permanent bonus</span><span class="v good">+${Fmt.pct(CONFIG.samsara.cycleGlobalMult * ((S.samsara.cycle | 0) + 1))} all stats &amp; aura</span></div>
        </div>
        <p class="tiny muted">Kept: curios, achievements, titles, and the Samsara tree.</p>`,
      buttons: [
        { label: 'Not yet', cls: 'ghost', act: (c) => c() },
        { label: 'Turn the wheel', cls: 'danger', act: (c) => { c(); Samsara.rebirth(); } },
      ],
    });
  },

  /* ---------------------------------------------------------------- panel */
  render() {
    const panel = UI.panel('samsara');
    if (!panel) return;
    if (UI.lock('samsara', CONFIG.unlocks.samsara)) return;
    if (!Samsara._dom || !panel.contains(Samsara._dom.root)) Samsara._build(panel);

    const d = Samsara._dom;
    const sig = (S.samsara.marks | 0) + '|' + (S.samsara.cycle | 0) + '|'
      + JSON.stringify(S.samsara.tree || {}) + '|' + (S.player.realm | 0);
    if (sig === Samsara._sig) return;
    Samsara._sig = sig;

    d.head.innerHTML = `<div class="row between"><span class="lbl">Samsara Marks</span>
        <span class="val gold">${Fmt.n(S.samsara.marks | 0)}</span></div>
      <div class="row between"><span class="tiny muted">Cycle ${S.samsara.cycle | 0}</span>
        <span class="tiny muted">Rebirth now: +${Fmt.n(Samsara.marksIfRebornNow())}</span></div>`;

    d.list.innerHTML = '';
    for (const node of DATA.samsaraTree) {
      const lvl = Samsara.lvlOf(node.id);
      const maxed = lvl >= (node.max | 0);
      const cost = Samsara.costOf(node);
      const b = UI.el('button', 'btn sm' + (!maxed && (S.samsara.marks | 0) >= cost ? ' primary' : ''),
        maxed ? 'Max' : String(cost));
      b.disabled = maxed || (S.samsara.marks | 0) < cost;
      if (!b.disabled) { b.dataset.act = 'sam'; b.dataset.id = node.id; }
      d.list.appendChild(UI.itemCard({
        emoji: '\u{1F504}',
        name: `${node.name} ${lvl}/${node.max}`,
        rarity: maxed ? 'gold' : (lvl ? 'purple' : 'gray'),
        sub: node.desc,
        right: b,
      }));
    }
    d.btn.disabled = !Samsara.canRebirth();
    d.btn.textContent = Samsara.canRebirth() ? 'Turn the Wheel' : 'Requires Celestial';
  },

  _build(panel) {
    panel.innerHTML = '';
    const root = UI.el('div', 'scroll');
    const head = UI.el('div', 'card tight');
    root.appendChild(head);
    const btn = UI.el('button', 'btn wide danger', 'Turn the Wheel');
    btn.dataset.act = 'rebirth';
    root.appendChild(btn);
    const list = UI.el('div', 'col');
    root.appendChild(list);
    root.appendChild(UI.el('div', 'safe-b'));
    panel.appendChild(root);
    Samsara._dom = { root, head, list, btn };
    root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      if (el.dataset.act === 'rebirth') Samsara.confirmRebirth();
      if (el.dataset.act === 'sam') Samsara.buy(el.dataset.id);
    });
  },
};

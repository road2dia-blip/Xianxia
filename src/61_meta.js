/* ============================================================================
 * Quests — the 32-step main chain, and Story — the Shifu's dialogue beats.
 *
 * The chain is strictly linear: S.quests.step indexes DATA.quests. A step is
 * "ready" once its check(S) predicate passes; claiming it pays rewards, shows
 * the Shifu's lines, and advances the step. The home-screen chip (#questChip)
 * always shows the current step and deep-links to the tab that completes it.
 *
 * Story.beat(id) is idempotent: each beat id fires at most once per save, which
 * is what lets any system call it freely on a milestone without bookkeeping.
 * ==========================================================================*/

const Quests = {
  _dom: null,
  _sig: '',

  init() {
    try { UI.register('quests', () => Quests.render()); } catch (e) { /* optional */ }
    // Any progress at all may complete a step, so re-check on a broad set.
    const evts = ['breakthrough', 'phaseUp', 'huntClear', 'pillCrafted', 'pillUsed',
      'gearCrafted', 'gearEnhanced', 'sectJoin', 'techUnlock', 'spireClear',
      'duelFight', 'tideClear', 'curioGain', 'abodeUpgrade', 'lawChosen', 'samsara'];
    for (const e of evts) {
      try { Bus.on(e, () => Quests.refresh()); } catch (err) { /* optional */ }
    }
  },

  tick(dt, now) {
    Quests._acc = (Quests._acc || 0) + dt;
    if (Quests._acc < 2) return;
    Quests._acc = 0;
    Quests.refresh();
  },

  current() {
    const step = U.clamp(Math.floor(Number(S.quests.step) || 0), 0, DATA.quests.length);
    return step < DATA.quests.length ? DATA.quests[step] : null;
  },

  isReady() {
    const q = Quests.current();
    if (!q) return false;
    try { return !!q.check(S); } catch (e) { return false; }
  },

  refresh() {
    Quests.paintChip();
    try { UI.badge('more.quests', Quests.isReady() ? 1 : 0); } catch (e) { /* pre-boot */ }
    UI.dirty('quests');
  },

  badges() { return Quests.isReady() ? 1 : 0; },

  /* The persistent chip under the HUD. */
  paintChip() {
    const chip = document.getElementById('questChip');
    if (!chip) return;
    const q = Quests.current();
    if (!q) {
      chip.textContent = 'The path is walked. What now?';
      chip.className = 'chip muted';
      chip.removeAttribute('data-tab');
      return;
    }
    const ready = Quests.isReady();
    chip.className = 'chip' + (ready ? ' gold' : '');
    chip.textContent = (ready ? '✓ ' : '') + q.title;
    chip.dataset.act = 'quest-go';
    chip.dataset.id = q.id;
  },

  claim() {
    const q = Quests.current();
    if (!q) return false;
    if (!Quests.isReady()) { UI.toast('Not yet.', 'bad'); return false; }

    try { Econ.grantAll(q.rewards || {}); } catch (e) { console.warn(e); }
    if (!Array.isArray(S.quests.claimed)) S.quests.claimed = [];
    S.quests.claimed.push(q.id);
    S.quests.step = U.clamp((Math.floor(Number(S.quests.step) || 0)) + 1, 0, DATA.quests.length);

    let txt = '';
    try { txt = Econ.rewardText(q.rewards || {}); } catch (e) { txt = ''; }
    UI.toast(txt ? `Received ${txt}` : 'The lesson lands.', 'gold');

    if (Array.isArray(q.dialogue) && q.dialogue.length) {
      Story.say('Shifu', q.dialogue);
    }
    try { Pass.addPoints(20); } catch (e) { /* optional */ }
    Stats.invalidate(); Stats.recompute();
    Quests.refresh();
    UI.refreshBadges();
    Save.save();
    return true;
  },

  /* ---------------------------------------------------------------- panel */
  render() {
    const panel = UI.panel('quests');
    if (!panel) return;
    if (!Quests._dom || !panel.contains(Quests._dom.root)) Quests._build(panel);

    const q = Quests.current();
    const d = Quests._dom;
    const sig = (q ? q.id : 'done') + (Quests.isReady() ? '!' : '') + S.quests.step;
    if (sig === Quests._sig) return;
    Quests._sig = sig;

    d.list.innerHTML = '';
    if (!q) {
      d.list.appendChild(UI.el('div', 'empty',
        'Every task the old one set you is finished. He seems quietly pleased, which is alarming.'));
    } else {
      const card = UI.el('div', 'card');
      card.appendChild(UI.el('div', 'h1 serif', q.title));
      card.appendChild(UI.el('div', 'muted', q.desc || ''));
      const rw = UI.el('div', 'sec');
      rw.appendChild(UI.el('div', 'lbl', 'Reward'));
      rw.appendChild(UI.costRow(q.rewards || {}));
      card.appendChild(rw);
      const foot = UI.el('div', 'row');
      const go = UI.el('button', 'btn wide', 'Show me');
      go.dataset.act = 'quest-go';
      const claim = UI.el('button', 'btn wide primary', Quests.isReady() ? 'Claim' : 'Not yet');
      claim.dataset.act = 'quest-claim';
      claim.disabled = !Quests.isReady();
      if (Quests.isReady()) claim.classList.add('glow');
      foot.appendChild(go); foot.appendChild(claim);
      card.appendChild(foot);
      d.list.appendChild(card);
    }

    // completed history
    const done = (S.quests.claimed || []).slice(-8).reverse();
    if (done.length) {
      d.list.appendChild(UI.el('div', 'sec-title serif', 'Behind you'));
      for (const id of done) {
        const past = DATA.quests.find(x => x.id === id);
        if (past) d.list.appendChild(UI.itemCard({ emoji: '✓', name: past.title, rarity: 'green', sub: past.desc }));
      }
    }
    d.prog.textContent = `${S.quests.step} / ${DATA.quests.length}`;
    d.bar.style.width = U.clamp(S.quests.step / DATA.quests.length, 0, 1) * 100 + '%';
  },

  _build(panel) {
    panel.innerHTML = '';
    const root = UI.el('div', 'scroll');
    const head = UI.el('div', 'card tight');
    head.innerHTML = `<div class="row between"><span class="lbl">The Long Road</span>
      <span class="val" data-f="prog"></span></div><div class="bar exp"><i data-f="bar"></i></div>`;
    root.appendChild(head);
    const list = UI.el('div', 'col');
    root.appendChild(list);
    root.appendChild(UI.el('div', 'safe-b'));
    panel.appendChild(root);
    Quests._dom = { root, list, prog: head.querySelector('[data-f="prog"]'), bar: head.querySelector('[data-f="bar"]') };
    root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      if (el.dataset.act === 'quest-claim') Quests.claim();
      if (el.dataset.act === 'quest-go') Quests.goto();
    });
  },

  /* Deep-link to the tab that completes the current step. */
  goto() {
    const q = Quests.current();
    if (!q) return;
    const tab = String(q.tab || 'cultivate');
    const dot = tab.indexOf('.');
    try {
      if (dot > 0) UI.show(tab.slice(dot + 1));
      else UI.show(tab);
    } catch (e) { UI.show('cultivate'); }
  },
};

/* ============================================================================
 * Story — Shifu and rival dialogue beats.
 * ==========================================================================*/
const Story = {
  init() {
    try {
      Bus.on('breakthrough', (d) => {
        const map = { 2: 'foundation', 3: 'virtuoso', 4: 'nascent', 5: 'incarnation',
          6: 'voidbreak', 7: 'wholeness', 8: 'perfection', 9: 'nirvana', 10: 'celestial' };
        const id = map[d && d.realm];
        if (id) Story.beat(id);
      });
      Bus.on('sectJoin', () => Story.beat('sect'));
      Bus.on('tideClear', () => Story.beat('firstTide'));
      Bus.on('lawChosen', () => Story.beat('lawChoice'));
      Bus.on('samsara', () => Story.beat('samsara'));
    } catch (e) { /* optional */ }
  },
  tick() {},

  /* Show a named beat once per save. */
  beat(id) {
    if (!id || !S) return false;
    if (!Array.isArray(S.story.seen)) S.story.seen = [];
    if (S.story.seen.indexOf(id) >= 0) return false;

    const lines = (DATA.dialogue && DATA.dialogue.shifu && DATA.dialogue.shifu[id])
      || (DATA.dialogue && DATA.dialogue.rival && DATA.dialogue.rival[id]);
    if (!lines || !lines.length) return false;

    S.story.seen.push(id);
    const who = (DATA.dialogue.rival && DATA.dialogue.rival[id]) ? 'A familiar voice' : 'Shifu';
    Story.say(who, lines);
    Save.save();
    return true;
  },

  /* Show dialogue lines one modal at a time, advancing on tap. */
  say(who, lines, done) {
    const arr = Array.isArray(lines) ? lines.slice() : [String(lines)];
    let i = 0;
    const step = () => {
      if (i >= arr.length) { if (done) done(); return; }
      const line = arr[i++];
      const body = document.createElement('div');
      body.innerHTML = `<div class="row"><span class="unit-emoji">${who === 'Shifu' ? '\u{1F9D3}' : '\u{1F5E1}'}</span>
        <div class="col"><div class="tiny muted">${UI.esc ? UI.esc(who) : who}</div>
        <div class="serif" style="font-size:16px;line-height:1.5">${UI.esc ? UI.esc(line) : line}</div></div></div>`;
      UI.modal({
        title: '', body,
        buttons: [{ label: i >= arr.length ? 'Bow' : 'Go on', cls: 'primary', act: (close) => { close(); step(); } }],
      });
    };
    step();
  },
};

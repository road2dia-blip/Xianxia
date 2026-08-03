/* ============================================================================
 * More — the menu grid that reaches every sub-panel, and
 * Settings — export / import / hard reset, combat speed, reduced effects,
 * plus the hidden dev-panel trigger on the version string.
 * ==========================================================================*/

const More = {
  ITEMS: [
    { id: 'sect', emoji: '\u{1F3EF}', name: 'Sect', desc: 'Duties, library, meditation, the weekly clash', unlock: 'sect' },
    { id: 'techs', emoji: '\u{1F4DC}', name: 'Techniques', desc: 'Sixteen ranks of hard-won habit', unlock: 'techs' },
    { id: 'law', emoji: '\u{26A1}', name: 'Law', desc: 'Your chosen element, and its deepening', unlock: 'law' },
    { id: 'curios', emoji: '\u{1F5FF}', name: 'Curios', desc: 'Small strange things worth keeping', unlock: 'curios' },
    { id: 'shops', emoji: '\u{1F3EE}', name: 'Shops', desc: 'Market, black market, library, jade, dust', unlock: 'market' },
    { id: 'quests', emoji: '\u{1F9ED}', name: 'The Long Road', desc: 'What the old one wants next', unlock: 'quests' },
    { id: 'pass', emoji: '\u{2728}', name: 'Ascension Path', desc: 'Daily duties and fifty levels of reward', unlock: 'quests' },
    { id: 'ach', emoji: '\u{1F3C5}', name: 'Achievements', desc: 'Proof you did the thing', unlock: 'quests' },
    { id: 'mail', emoji: '\u{2709}', name: 'Letters', desc: 'Everything the world owes you', unlock: 'quests' },
    { id: 'samsara', emoji: '\u{1F504}', name: 'Samsara', desc: 'Begin again, but heavier', unlock: 'samsara' },
    { id: 'settings', emoji: '\u{2699}', name: 'Settings', desc: 'Saves, speed, and other mundanities', unlock: 'cultivate' },
  ],
  _dom: null, _sig: '',

  init() { try { UI.register('more', () => More.render()); } catch (e) { /* optional */ } },
  tick() {},
  badges() { return 0; },

  render() {
    const panel = UI.panel('more');
    if (!panel) return;
    if (!More._dom || !panel.contains(More._dom.root)) More._build(panel);

    const realm = S.player.realm | 0;
    const sig = realm + '|' + More.ITEMS.map(i => UI.badgeCount ? UI.badgeCount('more.' + i.id) : 0).join(',');
    if (sig === More._sig) return;
    More._sig = sig;

    const d = More._dom;
    d.list.innerHTML = '';
    for (const it of More.ITEMS) {
      const need = CONFIG.unlocks[it.unlock];
      const locked = need !== undefined && realm < need;
      let n = 0;
      try { n = UI.badgeCount ? (UI.badgeCount('more.' + it.id) | 0) : 0; } catch (e) { n = 0; }

      const right = UI.el('span', n > 0 ? 'badge' : 'muted', n > 0 ? String(n > 99 ? '99+' : n) : '›');
      const card = UI.itemCard({
        emoji: locked ? '\u{1F512}' : it.emoji,
        name: it.name,
        rarity: locked ? 'gray' : 'blue',
        sub: locked ? `Unlocks at ${UI.realmName(need)}` : it.desc,
        right,
        act: locked ? null : 'more-go',
        id: it.id,
        locked,
      });
      d.list.appendChild(card);
    }
  },

  _build(panel) {
    panel.innerHTML = '';
    const root = UI.el('div', 'scroll');
    root.appendChild(UI.el('div', 'sec-title serif', 'Elsewhere'));
    const list = UI.el('div', 'col');
    root.appendChild(list);
    root.appendChild(UI.el('div', 'safe-b'));
    panel.appendChild(root);
    More._dom = { root, list };
    root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act="more-go"]');
      if (el && el.dataset.id) UI.show(el.dataset.id);
    });
  },
};

/* ==========================================================================*/
const Settings = {
  _dom: null,
  _taps: 0, _lastTap: 0,

  init() { try { UI.register('settings', () => Settings.render()); } catch (e) { /* optional */ } },
  tick() {},
  badges() { return 0; },

  render() {
    const panel = UI.panel('settings');
    if (!panel) return;
    if (!Settings._dom || !panel.contains(Settings._dom.root)) Settings._build(panel);
    const d = Settings._dom;
    d.speed.textContent = '×' + (S.settings.speed || 1);
    d.fx.classList.toggle('on', !!S.settings.reduceFx);
    d.fx.textContent = S.settings.reduceFx ? 'Reduced effects: on' : 'Reduced effects: off';
    d.play.textContent = Fmt.dur(S.playtimeSec || 0);
  },

  _build(panel) {
    panel.innerHTML = '';
    const root = UI.el('div', 'scroll');

    const info = UI.el('div', 'card tight');
    info.innerHTML = `<div class="kv"><span class="k">Cultivator</span><span class="v">${UI.esc(S.player.name)}</span></div>
      <div class="kv"><span class="k">Time spent</span><span class="v" data-f="play"></span></div>`;
    root.appendChild(info);

    const play = UI.el('div', 'card tight');
    play.appendChild(UI.el('div', 'lbl', 'Play'));
    const rowSpeed = UI.el('div', 'row between');
    rowSpeed.appendChild(UI.el('span', 'k', 'Battle speed'));
    const bSpeed = UI.el('button', 'btn sm', '×1');
    bSpeed.dataset.act = 'speed';
    rowSpeed.appendChild(bSpeed);
    play.appendChild(rowSpeed);
    const bFx = UI.el('button', 'btn wide toggle', 'Reduced effects: off');
    bFx.dataset.act = 'fx';
    play.appendChild(bFx);
    root.appendChild(play);

    const save = UI.el('div', 'card tight');
    save.appendChild(UI.el('div', 'lbl', 'Save'));
    const bx = UI.el('button', 'btn wide', 'Export Save');
    bx.dataset.act = 'export';
    const bi = UI.el('button', 'btn wide', 'Import Save');
    bi.dataset.act = 'import';
    const br = UI.el('button', 'btn wide danger', 'Hard Reset');
    br.dataset.act = 'reset';
    save.appendChild(bx); save.appendChild(bi); save.appendChild(br);
    root.appendChild(save);

    const about = UI.el('div', 'card tight');
    about.innerHTML = `<p class="tiny muted">EVERDAO is a single-player idle cultivation RPG.
      There are no advertisements and nothing to buy; every convenience in the Jade Shop is earned by playing.</p>`;
    const ver = UI.el('div', 'tiny muted mono', 'v' + CONFIG.version);
    ver.id = 'version';
    about.appendChild(ver);
    root.appendChild(about);

    root.appendChild(UI.el('div', 'safe-b'));
    panel.appendChild(root);
    Settings._dom = { root, speed: bSpeed, fx: bFx, play: info.querySelector('[data-f="play"]') };

    root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      const a = el.dataset.act;
      if (a === 'speed') {
        const list = CONFIG.combat.speeds;
        const i = list.indexOf(S.settings.speed || 1);
        S.settings.speed = list[(i + 1) % list.length];
        UI.dirty('settings');
      } else if (a === 'fx') {
        S.settings.reduceFx = !S.settings.reduceFx;
        UI.reduceFx();
        UI.dirty('settings');
      } else if (a === 'export') Settings.exportSave();
      else if (a === 'import') Settings.importSave();
      else if (a === 'reset') Settings.hardReset();
    });

    // The version string is the hidden dev-panel door: seven taps.
    ver.addEventListener('click', () => {
      const now = Date.now();
      Settings._taps = (now - Settings._lastTap < 3000) ? Settings._taps + 1 : 1;
      Settings._lastTap = now;
      if (Settings._taps >= CONFIG.dev.unlockTaps) {
        Settings._taps = 0;
        try { Dev.show(); } catch (err) { UI.toast('No dev panel in this build.', 'bad'); }
      }
    });
  },

  exportSave() {
    let blob = '';
    try { blob = Save.export(); } catch (e) { UI.toast('Export failed.', 'bad'); return; }
    const body = document.createElement('div');
    body.innerHTML = `<p class="tiny muted">Copy this somewhere safe. It is your whole save.</p>`;
    const ta = UI.el('textarea', 'textarea');
    ta.value = blob;
    ta.rows = 8;
    ta.readOnly = true;
    body.appendChild(ta);
    UI.modal({
      title: 'Export Save', body,
      buttons: [
        { label: 'Select All', cls: '', act: () => { ta.focus(); ta.select(); } },
        { label: 'Done', cls: 'primary', act: (c) => c() },
      ],
    });
    setTimeout(() => { try { ta.focus(); ta.select(); } catch (e) { /* fine */ } }, 60);
  },

  importSave() {
    const body = document.createElement('div');
    body.innerHTML = `<p class="tiny muted">Paste an exported save. This replaces everything you have now.</p>`;
    const ta = UI.el('textarea', 'textarea');
    ta.rows = 8;
    ta.placeholder = 'Paste here';
    body.appendChild(ta);
    UI.modal({
      title: 'Import Save', body,
      buttons: [
        { label: 'Cancel', cls: 'ghost', act: (c) => c() },
        { label: 'Import', cls: 'danger', act: (c) => {
          const r = Save.import((ta.value || '').trim());
          if (!r || !r.ok) { UI.toast('That save could not be read: ' + ((r && r.err) || 'invalid'), 'bad'); return; }
          c();
          Stats.invalidate(); Stats.recompute();
          UI.dirty('cultivate', 'wilds', 'battle', 'abode', 'more', 'settings');
          UI.refreshBadges();
          UI.show('cultivate');
          UI.toast('Save restored.', 'good');
        } },
      ],
    });
  },

  hardReset() {
    UI.confirm('Hard Reset', 'This erases your cultivator entirely. There is no undo.', () => {
      UI.confirm('Really?', 'Last chance. Everything goes.', () => {
        try { Save.reset(); } catch (e) { /* fall through */ }
        location.reload();
      });
    });
  },
};

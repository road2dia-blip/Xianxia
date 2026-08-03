/* ============================================================================
 * EVERDAO — BOOT
 * Injects CSS + SHELL, loads the save, runs the creation flow, initialises every
 * system, grants offline progress, then starts the two loops:
 *   logic  every CONFIG.loop.tickMs   (250ms)
 *   render every CONFIG.loop.renderMs (500ms), visible + dirty panel only
 *
 * Systems are looked up by NAME so a module that failed to load degrades to
 * "that feature is missing" instead of a white screen.
 * ==========================================================================*/

const SYSTEM_NAMES = [
  'Cultivation', 'Respira', 'Wilds', 'Spire', 'Duel', 'Tide', 'Battle',
  'Alchemy', 'Forge', 'Abode', 'Sect', 'Techs', 'Curios', 'Shops',
  'Quests', 'Pass', 'Ach', 'Mail', 'Story', 'Law', 'Samsara',
  'More', 'Settings', 'Dev',
];

const Boot = {
  systems: [],
  lastTick: 0,
  started: false,

  /* Resolve system objects by name from the shared scope. */
  collect() {
    const scope = {
      Cultivation: typeof Cultivation !== 'undefined' ? Cultivation : null,
      Respira: typeof Respira !== 'undefined' ? Respira : null,
      Wilds: typeof Wilds !== 'undefined' ? Wilds : null,
      Spire: typeof Spire !== 'undefined' ? Spire : null,
      Duel: typeof Duel !== 'undefined' ? Duel : null,
      Tide: typeof Tide !== 'undefined' ? Tide : null,
      Battle: typeof Battle !== 'undefined' ? Battle : null,
      Alchemy: typeof Alchemy !== 'undefined' ? Alchemy : null,
      Forge: typeof Forge !== 'undefined' ? Forge : null,
      Abode: typeof Abode !== 'undefined' ? Abode : null,
      Sect: typeof Sect !== 'undefined' ? Sect : null,
      Techs: typeof Techs !== 'undefined' ? Techs : null,
      Curios: typeof Curios !== 'undefined' ? Curios : null,
      Shops: typeof Shops !== 'undefined' ? Shops : null,
      Quests: typeof Quests !== 'undefined' ? Quests : null,
      Pass: typeof Pass !== 'undefined' ? Pass : null,
      Ach: typeof Ach !== 'undefined' ? Ach : null,
      Mail: typeof Mail !== 'undefined' ? Mail : null,
      Story: typeof Story !== 'undefined' ? Story : null,
      Law: typeof Law !== 'undefined' ? Law : null,
      Samsara: typeof Samsara !== 'undefined' ? Samsara : null,
      More: typeof More !== 'undefined' ? More : null,
      Settings: typeof Settings !== 'undefined' ? Settings : null,
      Dev: typeof Dev !== 'undefined' ? Dev : null,
    };
    this.systems = [];
    for (const n of SYSTEM_NAMES) {
      const s = scope[n];
      if (s) this.systems.push({ name: n, sys: s });
      else console.warn('[everdao] system missing:', n);
    }
  },

  each(fnName, ...args) {
    for (const { name, sys } of this.systems) {
      if (typeof sys[fnName] !== 'function') continue;
      try { sys[fnName](...args); }
      catch (e) { console.error(`[everdao] ${name}.${fnName} failed:`, e); }
    }
  },

  /* ------------------------------------------------------------------ start */
  start() {
    if (this.started) return;
    this.started = true;

    // 1. paint the shell
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    document.body.insertAdjacentHTML('afterbegin', SHELL);

    // 2. content indexes
    try { dataIndexAll(); } catch (e) { console.error('[everdao] data index failed:', e); }

    // 3. save
    let had = false;
    try { had = Save.load(); } catch (e) { console.error('[everdao] load failed:', e); }
    if (!S) S = freshState();
    if (Save.storageBroken) {
      const w = document.getElementById('lsWarn');
      if (w) {
        w.hidden = false;
        w.textContent = 'Storage is unavailable in this browser mode — progress will be lost when you close the tab. Use Settings → Export Save to keep it.';
      }
    }

    // 4. systems + UI
    this.collect();
    try { Stats.init && Stats.init(); } catch (e) { console.error(e); }
    this.each('init');
    try { UI.bindNav(); UI.reduceFx(); } catch (e) { console.error(e); }
    try { Stats.recompute(); } catch (e) { console.error(e); }

    // 5. first run vs returning player
    if (!S.created) {
      Creation.open(() => this.afterReady(false));
    } else {
      this.afterReady(true);
    }

    // 6. loops + lifecycle
    this.lastTick = Date.now();
    setInterval(() => this.tick(), CONFIG.loop.tickMs);
    setInterval(() => { try { UI.renderVisible(); } catch (e) { console.error(e); } }, CONFIG.loop.renderMs);
    setInterval(() => { try { Save.save(); } catch (e) { console.error(e); } }, CONFIG.loop.autosaveMs);

    const flush = () => { try { S.lastSeen = Date.now(); Save.saveNow(); } catch (e) { /* ignore */ } };
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);

    window.addEventListener('error', (e) => {
      console.error('[everdao] uncaught:', e.error || e.message);
    });

    // Hidden debug handle. The whole game lives inside an IIFE, so this is the
    // only door in — used by the dev panel's autoplay sim and by tools/smoke.js.
    // Harmless to ship: it exposes nothing a player could not already edit in
    // their own localStorage.
    try {
      Object.defineProperty(window, '__ED', {
        value: {
          get S() { return S; },
          set S(v) { S = v; },
          CONFIG, DATA, DATAX, U, Fmt, Bus, UI, Save, Daily, Offline,
          Stats, Econ, Combat, Boot, Creation,
          get sys() {
            const o = {};
            for (const { name, sys } of Boot.systems) o[name] = sys;
            return o;
          },
          get Cultivation() { return typeof Cultivation !== 'undefined' ? Cultivation : null; },
          get Wilds() { return typeof Wilds !== 'undefined' ? Wilds : null; },
          get Dev() { return typeof Dev !== 'undefined' ? Dev : null; },
        },
        writable: false, enumerable: false, configurable: false,
      });
    } catch (e) { /* non-fatal */ }
  },

  /* Runs once the player exists (either loaded or freshly created). */
  afterReady(returning) {
    try { Daily.check(Date.now()); } catch (e) { console.error(e); }

    let lines = [];
    if (returning) {
      try { lines = Offline.apply(Date.now()) || []; } catch (e) { console.error(e); }
    }
    S.lastSeen = Date.now();

    try { Stats.recompute(); } catch (e) { console.error(e); }
    try { UI.show('cultivate'); UI.refreshBadges(); } catch (e) { console.error(e); }

    if (lines.length) {
      const rows = lines.map(l =>
        `<div class="kv"><span class="k">${l.icon || ''} ${l.label}</span><span class="v good">${l.amount}</span></div>`
      ).join('');
      UI.modal({
        title: 'While You Were Away',
        body: `<p class="muted tiny">The dao does not wait for anyone, but it does keep receipts.</p>
               <div class="sec">${rows}</div>`,
        buttons: [{ label: 'Collect', cls: 'primary', act: (close) => close() }],
      });
    }

    if (!returning) {
      try {
        if (typeof Story !== 'undefined' && Story && Story.beat) Story.beat('intro');
      } catch (e) { console.error(e); }
    }
    try { Save.saveNow(); } catch (e) { /* ignore */ }
  },

  /* ------------------------------------------------------------------- tick */
  tick() {
    const now = Date.now();
    let dt = (now - this.lastTick) / 1000;
    this.lastTick = now;
    if (!(dt > 0)) dt = 0;
    if (dt > 60) dt = 60;            // tab was backgrounded; offline logic owns the rest
    if (!S || !S.created) return;

    S.playtimeSec += dt;
    S.lastSeen = now;

    try { Daily.check(now); } catch (e) { console.error(e); }
    this.each('tick', dt, now);
  },

  /* Advance the world by n seconds without real waiting (dev time-warp). */
  warp(sec) {
    if (!S || !S.created) return [];
    const now = Date.now();
    S.lastSeen = now - sec * 1000;
    const lines = Offline.apply(now) || [];
    S.lastSeen = now;
    Stats.recompute();
    UI.dirty('cultivate', 'wilds', 'battle', 'abode', 'more');
    UI.refreshBadges();
    Save.saveNow();
    return lines;
  },
};

/* ============================================================================
 * Creation — first-run flow: name + Path choice. Path is permanent.
 * ==========================================================================*/
const Creation = {
  open(done) {
    const name = this.randomName();
    const body = document.createElement('div');
    body.innerHTML = `
      <p class="muted">The mountain is cold, the tea is weak, and someone has to carry the water.
      Before any of that: who are you?</p>
      <div class="sec">
        <div class="lbl">Name</div>
        <div class="row">
          <input class="input" id="cName" maxlength="16" value="${name}" autocomplete="off">
          <button class="btn ghost sm" data-act="roll">Roll</button>
        </div>
      </div>
      <div class="sec">
        <div class="lbl">Path <span class="tiny muted">— permanent, choose with care</span></div>
        <div class="col" id="cPaths"></div>
      </div>`;

    const paths = [
      { id: 'body',  emoji: '\u{1F44A}', name: 'Body Path',  tag: 'Tank / burst',
        desc: 'Highest HP and physical attack. Mountain Fist lands every third round; 8% of the damage comes back as health.' },
      { id: 'spell', emoji: '\u{1F31F}', name: 'Spell Path', tag: 'AoE / shields',
        desc: 'Highest magic attack and qi. Starfall strikes every enemy, and you enter each fight already warded.' },
      { id: 'sword', emoji: '⚔️', name: 'Sword Path', tag: 'Sustained DPS',
        desc: 'Balanced growth. Thousand Cuts bleeds what it touches, and any strike may land twice.' },
      { id: 'ghost', emoji: '\u{1F47B}', name: 'Ghost Path', tag: 'Summoner',
        desc: 'A thrall fights at your side with two fifths of your strength, and takes hits meant for you.' },
    ];

    let chosen = null;
    const list = body.querySelector('#cPaths');
    for (const p of paths) {
      const card = UI.el('div', 'card tight');
      card.dataset.path = p.id;
      card.innerHTML = `<div class="row between">
          <div class="row"><span class="unit-emoji">${p.emoji}</span>
            <div class="col"><div class="h3">${p.name}</div><div class="tiny muted">${p.tag}</div></div></div>
        </div><div class="tiny" style="margin-top:6px">${p.desc}</div>`;
      list.appendChild(card);
    }

    const m = UI.modal({
      title: 'EVERDAO',
      wide: true,
      body,
      buttons: [{ label: 'Begin', cls: 'primary', act: (close) => {
        if (!chosen) { UI.toast('Choose a Path first.', 'bad'); return; }
        const v = (body.querySelector('#cName').value || '').trim().slice(0, 16);
        S.player.name = v || this.randomName();
        S.player.path = chosen;
        S.created = true;
        S.createdAt = Date.now();
        S.lastSeen = Date.now();
        S.lastDaily = '';
        close();
        Save.saveNow();
        done();
      } }],
      onClose: () => {},
    });

    body.addEventListener('click', (e) => {
      const roll = e.target.closest('[data-act="roll"]');
      if (roll) { body.querySelector('#cName').value = this.randomName(); return; }
      const card = e.target.closest('[data-path]');
      if (card) {
        chosen = card.dataset.path;
        for (const c of list.children) c.classList.toggle('bg-gold', c === card);
      }
    });
    return m;
  },

  randomName() {
    const sn = (DATA.names && DATA.names.surnames) || ['Yun'];
    const gn = (DATA.names && DATA.names.givens) || ['Wei'];
    return U.pick(sn) + ' ' + U.pick(gn);
  },
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Boot.start());
} else {
  Boot.start();
}

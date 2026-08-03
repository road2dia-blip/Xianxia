/* ============================================================================
 * EVERDAO — UI KERNEL  (CONTRACT §4)
 *
 * One top-level binding: `UI`. Every panel, sheet, toast, red dot and route in
 * the game goes through here. This module owns no game state; it only reads S
 * defensively (old saves have gaps) and paints.
 *
 * "FORMULAS" — the arithmetic this module actually encodes:
 *
 *   badgeCount(key) = own[key] + SUM over every stored key k where
 *                     k.startsWith(key + '.')        // one rollup level or more
 *                  -> a dotted key ('more.mail') always contributes to its
 *                     parent ('more'); the nav dot is the tab's grand total.
 *   badgeText(n)    = n > 99 ? '99+' : String(n)  ; hidden when n <= 0
 *
 *   navFor(panelId) = MAIN_TABS.includes(id) ? id : 'more'
 *                  -> the eleven sub-panels (sect, techs, curios, shops,
 *                     quests, pass, ach, mail, settings, law, samsara) light
 *                     the More button while showing their own panel.
 *
 *   renderVisible() = dirty[UI.tab] ? (render(UI.tab), dirty[UI.tab] = false)
 *                                   : nothing
 *                  -> at most ONE panel render per loop frame, and only when a
 *                     system marked it dirty. Panels build DOM once and patch.
 *
 *   floatPos(anchor) = rect.left + rect.width/2 , rect.top + rect.height*0.35
 *                     in VIEWPORT coords (.float is position:fixed).
 *   concurrent floaters are capped at FLOAT_MAX (24); extras are dropped.
 *
 *   toast queue     = FIFO, at most TOAST_MAX (3) alive; each dies after
 *                     TOAST_MS (2600ms) or on tap.
 *
 *   version taps    = 7 taps on #version with < 3000ms between consecutive
 *                     taps opens the hidden dev panel (CONFIG.dev.unlockTaps).
 *
 * DOM contract with 23_html.js: #app, #toastWrap, #modalRoot, #sheetRoot,
 * #flashRoot, #floatRoot, .nav-btn[data-tab], section#p-<panelId>,
 * #lock-<panelId>, #hudName/#hudRealm/#hudBR/#hudStone/#hudJade, #version.
 * Only classes from CONTRACT §5 are used. Inline styles appear only for
 * genuinely dynamic values (floater coordinates, the shake fallback).
 * ==========================================================================*/

const UI = {

  /* ------------------------------------------------------------- constants */

  /* The five bottom-nav tabs. */
  MAIN_TABS: ['cultivate', 'wilds', 'battle', 'abode', 'more'],

  /* Panels that live "under" More: showing one highlights the More button. */
  SUB_PANELS: ['sect', 'techs', 'curios', 'shops', 'quests', 'pass', 'ach',
               'mail', 'settings', 'law', 'samsara'],

  /* Every routable panel id (main tabs first). Filled in _panelIds(). */
  TOAST_MS: 2600,
  TOAST_MAX: 3,
  FLOAT_MAX: 24,
  FLOAT_MS: 1400,
  FLASH_MS: 900,
  SHAKE_MS: 400,
  TAP_WINDOW_MS: 3000,

  /* System name -> badge key, used by refreshBadges() to pull counts from
     every system that exposes badges(). Hosts are deliberately absent when
     their children report separately (Abode publishes abode.garden /
     abode.farm itself, so giving Abode an own count would double it). */
  BADGE_SYS: {
    Cultivation: 'cultivate',
    Wilds: 'wilds',
    Battle: 'battle',
    Spire: 'battle.spire',
    Duel: 'battle.duel',
    Tide: 'battle.tide',
    Alchemy: 'abode.alchemy',
    Forge: 'abode.forge',
    Sect: 'more.sect',
    Techs: 'more.techs',
    Curios: 'more.curios',
    Shops: 'more.shops',
    Quests: 'more.quests',
    Pass: 'more.pass',
    Ach: 'more.ach',
    Mail: 'more.mail',
  },

  /* Host keys whose own count is only used while no child has reported. */
  BADGE_HOSTS: ['battle', 'abode'],

  RARITY: { gray: 'r-gray', green: 'r-green', blue: 'r-blue',
            purple: 'r-purple', gold: 'r-gold' },

  /* ---------------------------------------------------------------- state */

  tab: '',            // currently visible panel id
  sub: {},            // { [tabId]: lastSubKey } — panels read UI.sub.abode etc.
  _panels: {},        // id -> <section> cache
  _renderers: {},     // id -> render fn
  _dirtyMap: {},      // id -> bool
  _rendering: false,
  _counts: {},        // badge key -> own count
  _toasts: [],
  _modals: [],
  _sheets: [],
  _floats: 0,
  _hud: null,
  _hudCache: {},
  _reduce: false,
  _navBound: false,
  _tapN: 0,
  _tapAt: 0,
  _tapFns: [],

  /* ==================================================================== DOM
   * Tiny builders. Everything else in the game creates DOM through these.
   * ====================================================================== */

  /* el('div', 'card tight', 'Hello') -> <div class="card tight">Hello</div> */
  el(tag, cls, text) {
    const e = document.createElement(tag || 'div');
    if (cls) e.className = cls;
    if (text !== undefined && text !== null && text !== '') e.textContent = String(text);
    return e;
  },

  qs(sel, root) {
    try { return (root || document).querySelector(sel); }
    catch (e) { return null; }
  },

  /* Array (not NodeList) so callers can map/filter without surprises. */
  qsa(sel, root) {
    try {
      const list = (root || document).querySelectorAll(sel);
      return Array.prototype.slice.call(list);
    } catch (e) { return []; }
  },

  /* Escape a string for safe interpolation into an HTML template literal. */
  esc(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  /* The <section id="p-<id>"> root for a panel, cached. */
  panel(id) {
    if (!id) return null;
    const key = String(id);
    const hit = UI._panels[key];
    if (hit && hit.isConnected) return hit;
    const found = document.getElementById('p-' + key);
    if (found) UI._panels[key] = found;
    return found || null;
  },

  /* Every panel id the shell ships. */
  _panelIds() {
    return UI.MAIN_TABS.concat(UI.SUB_PANELS);
  },

  /* =================================================================== ROUTER
   * show(tabId, sub) is the ONLY way to change panels.
   * ===================================================================== */

  /* Which nav button should light up for a given panel id. */
  navFor(id) {
    return UI.MAIN_TABS.indexOf(String(id)) >= 0 ? String(id) : 'more';
  },

  /* Last sub-tab remembered for a tab, or null. */
  subOf(tabId) {
    const v = UI.sub[String(tabId)];
    return typeof v === 'string' && v ? v : null;
  },

  isVisible(id) {
    return UI.tab === String(id);
  },

  show(tabId, sub) {
    const ids = UI._panelIds();
    let id = String(tabId || 'cultivate');
    if (ids.indexOf(id) < 0) id = 'cultivate';

    if (typeof sub === 'string' && sub) UI.sub[id] = sub;

    UI.tab = id;

    for (let i = 0; i < ids.length; i++) {
      const p = UI.panel(ids[i]);
      if (p) p.classList.toggle('active', ids[i] === id);
    }

    const nav = UI.navFor(id);
    const btns = UI.qsa('.nav-btn[data-tab]');
    for (let i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].getAttribute('data-tab') === nav);
    }

    UI.dirty(id);
    UI.scrollTop(id);
    UI.renderNow(id);
    return id;
  },

  /* The page itself scrolls (.scroll wraps every panel); panels may also own
     an inner .scroll. Reset all of them so a new tab starts at the top. */
  scrollTop(id) {
    try {
      const outer = UI.qs('#app > .scroll');
      if (outer) outer.scrollTop = 0;
      const p = UI.panel(id || UI.tab);
      if (p) {
        const inner = p.querySelector(':scope > .scroll');
        if (inner) inner.scrollTop = 0;
      }
      if (window.scrollY) window.scrollTo(0, 0);
    } catch (e) { /* non-fatal */ }
  },

  /* ============================================================== RENDERING
   * Each system registers one renderer for the panel it owns. The main loop
   * calls renderVisible() every CONFIG.loop.renderMs.
   * ===================================================================== */

  register(id, fn) {
    if (!id || typeof fn !== 'function') return;
    UI._renderers[String(id)] = fn;
    UI._dirtyMap[String(id)] = true;
  },

  /* dirty('wilds', 'more') — mark panels for re-render. No args = current. */
  dirty(...ids) {
    if (!ids.length) { if (UI.tab) UI._dirtyMap[UI.tab] = true; return; }
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (typeof id === 'string' && id) UI._dirtyMap[id] = true;
    }
  },

  renderNow(id) {
    const key = String(id || '');
    if (!key) return;
    UI._dirtyMap[key] = false;
    const fn = UI._renderers[key];
    if (typeof fn !== 'function') return;
    if (UI._rendering) return;              // never re-enter a render
    UI._rendering = true;
    try { fn(); }
    catch (e) { console.error('[everdao] render ' + key + ' failed:', e); }
    finally { UI._rendering = false; }
  },

  /* Main loop entry point: HUD every frame (cheap, change-detected), the one
     visible panel only when a system marked it dirty. */
  renderVisible() {
    UI.paintHud();
    const id = UI.tab;
    if (!id) return;
    if (!UI._dirtyMap[id]) return;
    UI.renderNow(id);
  },

  _hudEls() {
    if (UI._hud && UI._hud.name && UI._hud.name.isConnected) return UI._hud;
    const n = document.getElementById('hudName');
    if (!n) return null;
    UI._hud = {
      name: n,
      realm: document.getElementById('hudRealm'),
      br: document.getElementById('hudBR'),
      stone: document.getElementById('hudStone'),
      jade: document.getElementById('hudJade'),
    };
    UI._hudCache = {};
    return UI._hud;
  },

  _set(el, key, txt) {
    if (!el) return;
    if (UI._hudCache[key] === txt) return;
    UI._hudCache[key] = txt;
    el.textContent = txt;
  },

  /* Patches the five HUD text nodes. Nobody else touches them. */
  paintHud() {
    if (typeof S === 'undefined' || !S || !S.player) return;
    const h = UI._hudEls();
    if (!h) return;

    UI._set(h.name, 'name', S.player.name || 'Wanderer');

    const r = S.player.realm | 0;
    let phase = S.player.phase | 0;
    if (phase < 1) phase = 1;
    UI._set(h.realm, 'realm', UI.realmName(r) + ' · ' + phase);

    let br = 0;
    try { br = Stats.br(); } catch (e) { br = 0; }
    UI._set(h.br, 'br', Fmt.n(br));

    const cur = S.cur || {};
    UI._set(h.stone, 'stone', Fmt.n(cur.stone || 0));
    UI._set(h.jade, 'jade', Fmt.n(cur.jade || 0));
  },

  realmName(i) {
    try {
      const row = DATA.realms[i | 0];
      if (row && row.name) return String(row.name);
    } catch (e) { /* data may not be indexed yet */ }
    return 'Novice';
  },

  /* ================================================================= TOASTS
   * FIFO queue, max 3 alive, stacked above the nav by .toast-wrap.
   * ===================================================================== */

  toast(msg, kind) {
    const wrap = document.getElementById('toastWrap');
    if (!wrap) return null;

    let cls = 'toast';
    if (kind === 'good' || kind === 'bad' || kind === 'gold') cls += ' ' + kind;

    const t = UI.el('div', cls, msg === null || msg === undefined ? '' : String(msg));
    wrap.appendChild(t);
    UI._toasts.push(t);

    while (UI._toasts.length > UI.TOAST_MAX) UI._killToast(UI._toasts[0]);

    t._edTimer = setTimeout(() => UI._killToast(t), UI.TOAST_MS);
    t.addEventListener('click', () => UI._killToast(t));
    return t;
  },

  _killToast(t) {
    if (!t) return;
    const i = UI._toasts.indexOf(t);
    if (i >= 0) UI._toasts.splice(i, 1);
    if (t._edTimer) { clearTimeout(t._edTimer); t._edTimer = null; }
    if (t.parentNode) t.parentNode.removeChild(t);
  },

  /* =============================================================== OVERLAYS
   * modal / sheet share one builder. Both stack: a modal opened from a modal
   * sits on top and closes first. Backdrop tap closes only when no button is
   * marked {required:true}.
   * ===================================================================== */

  _overlay(kind, opts) {
    const o = opts || {};
    const isSheet = kind === 'sheet';
    const rootId = isSheet ? 'sheetRoot' : 'modalRoot';
    const root = document.getElementById(rootId) || document.body;
    if (!root) return { close() {}, wrap: null, box: null, body: null };

    const wrap = UI.el('div', isSheet ? 'sheet-wrap' : 'modal-wrap');
    let boxCls = isSheet ? 'sheet' : 'modal';
    if (!isSheet && o.wide) boxCls += ' wide';
    const box = UI.el('div', boxCls);

    if (o.title) box.appendChild(UI.el('div', 'h2 serif', o.title));

    const body = UI.el('div', 'scroll');
    const src = o.body;
    if (src && (src.nodeType === 1 || src.nodeType === 11)) body.appendChild(src);
    else if (typeof src === 'string') body.innerHTML = src;
    else if (src !== null && src !== undefined) body.textContent = String(src);
    box.appendChild(body);

    const stack = isSheet ? UI._sheets : UI._modals;
    let closed = false;
    const entry = { wrap, box, body, required: false, close: null };

    const close = () => {
      if (closed) return;
      closed = true;
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      if (typeof o.onClose === 'function') {
        try { o.onClose(); } catch (e) { console.error('[everdao] onClose failed:', e); }
      }
    };
    entry.close = close;

    const btns = Array.isArray(o.buttons) ? o.buttons : [];
    if (btns.length) {
      const row = UI.el('div', 'row');
      for (let i = 0; i < btns.length; i++) {
        const b = btns[i];
        if (!b) continue;
        if (b.required) entry.required = true;
        let cls = 'btn';
        if (b.cls) cls += ' ' + b.cls;
        const el = UI.el('button', cls, b.label === undefined ? 'OK' : b.label);
        if (b.disabled) el.disabled = true;
        el.addEventListener('click', () => {
          if (typeof b.act === 'function') {
            try { b.act(close); }
            catch (e) { console.error('[everdao] modal button failed:', e); }
          } else {
            close();
          }
        });
        row.appendChild(el);
      }
      box.appendChild(row);
    }

    if (o.required) entry.required = true;

    wrap.addEventListener('click', (e) => {
      if (e.target !== wrap) return;      // taps inside the box do nothing
      if (entry.required) return;
      close();
    });

    wrap.appendChild(box);
    root.appendChild(wrap);
    stack.push(entry);

    return { wrap, box, body, close };
  },

  /* modal({title, body, buttons, wide, onClose}) — body: HTML string|Element */
  modal(opts) { return UI._overlay('modal', opts); },

  /* Closes the topmost modal. */
  closeModal() {
    const top = UI._modals[UI._modals.length - 1];
    if (top && typeof top.close === 'function') top.close();
  },

  /* sheet({title, body, buttons}) — bottom sheet, slides up. */
  sheet(opts) { return UI._overlay('sheet', opts); },

  closeSheet() {
    const top = UI._sheets[UI._sheets.length - 1];
    if (top && typeof top.close === 'function') top.close();
  },

  /* Closes whatever is on top (sheets sit above modals visually). */
  closeTop() {
    if (UI._sheets.length) {
      const s = UI._sheets[UI._sheets.length - 1];
      if (!s.required) s.close();
      return;
    }
    if (UI._modals.length) {
      const m = UI._modals[UI._modals.length - 1];
      if (!m.required) m.close();
    }
  },

  confirm(title, msg, onYes) {
    const body = UI.el('div');
    body.appendChild(UI.el('p', 'muted', msg === undefined || msg === null ? '' : String(msg)));
    return UI.modal({
      title: title || 'Confirm',
      body,
      buttons: [
        { label: 'Cancel', cls: 'ghost', act: (close) => close() },
        { label: 'Confirm', cls: 'primary', act: (close) => {
          close();
          if (typeof onYes === 'function') {
            try { onYes(); } catch (e) { console.error('[everdao] confirm failed:', e); }
          }
        } },
      ],
    });
  },

  /* Double confirm for destructive, unrecoverable actions (hard reset).
     The second step is deliberately worded differently so a double tap on the
     same screen position cannot blow the save away. */
  confirm2(title, msg, onYes) {
    const body = UI.el('div');
    body.appendChild(UI.el('p', 'muted', msg === undefined || msg === null ? '' : String(msg)));
    return UI.modal({
      title: title || 'Are you sure?',
      body,
      buttons: [
        { label: 'Cancel', cls: 'ghost', act: (close) => close() },
        { label: 'Continue', cls: 'danger', act: (close) => {
          close();
          const b2 = UI.el('div');
          b2.appendChild(UI.el('p', 'bad', 'This cannot be undone.'));
          b2.appendChild(UI.el('p', 'muted tiny',
            'Export your save first if there is any chance you will want it back.'));
          UI.modal({
            title: 'Last chance',
            body: b2,
            buttons: [
              { label: 'Keep it', cls: 'ghost', act: (c) => c() },
              { label: 'Yes, do it', cls: 'danger', act: (c) => {
                c();
                if (typeof onYes === 'function') {
                  try { onYes(); } catch (e) { console.error('[everdao] confirm2 failed:', e); }
                }
              } },
            ],
          });
        } },
      ],
    });
  },

  /* ===================================================================== FX */

  /* Floating number rising from an anchor. Capped so a burst of 200 hits in
     one frame cannot flood the DOM. */
  float(anchorEl, text, cls) {
    const root = document.getElementById('floatRoot');
    if (!root) return null;
    if (UI._floats >= UI.FLOAT_MAX) return null;

    let x = (window.innerWidth || 360) / 2;
    let y = (window.innerHeight || 640) * 0.4;
    if (anchorEl && typeof anchorEl.getBoundingClientRect === 'function') {
      const r = anchorEl.getBoundingClientRect();
      if (r && (r.width || r.height)) {
        x = r.left + r.width / 2;
        y = r.top + r.height * 0.35;
      }
    }
    if (!isFinite(x)) x = 0;
    if (!isFinite(y)) y = 0;

    let k = 'float';
    if (cls) k += ' ' + cls;
    const f = UI.el('div', k, text === null || text === undefined ? '' : String(text));
    // dynamic viewport coordinates — the only legitimate inline style here
    f.style.left = Math.round(x) + 'px';
    f.style.top = Math.round(y) + 'px';

    root.appendChild(f);
    UI._floats++;

    let done = false;
    let timer = 0;
    const rm = () => {
      if (done) return;
      done = true;
      UI._floats--;
      if (UI._floats < 0) UI._floats = 0;
      if (timer) clearTimeout(timer);
      if (f.parentNode) f.parentNode.removeChild(f);
    };
    f.addEventListener('animationend', rm);
    timer = setTimeout(rm, UI.FLOAT_MS);   // reduce-fx kills the animation
    return f;
  },

  /* Fullscreen colour wash for surges, breakthroughs and disasters. */
  flash(kind) {
    if (UI._reduce) return null;
    const root = document.getElementById('flashRoot');
    if (!root) return null;
    if (root.childElementCount >= 3) return null;

    let cls = 'flash';
    if (kind === 'gold' || kind === 'jade' || kind === 'red') cls += ' ' + kind;
    const f = UI.el('div', cls);
    root.appendChild(f);

    let done = false;
    let timer = 0;
    const rm = () => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      if (f.parentNode) f.parentNode.removeChild(f);
    };
    f.addEventListener('animationend', rm);
    timer = setTimeout(rm, UI.FLASH_MS);
    return f;
  },

  /* The stylesheet binds everShake to .arena.shake only, so a non-arena
     element gets the keyframe applied directly. reduce-fx overrides it with
     !important, and the timeout still cleans up. */
  shake(el) {
    if (!el || !el.classList) return;
    if (UI._reduce) return;
    el.classList.add('shake');
    const arena = el.classList.contains('arena');
    if (!arena) el.style.animation = 'everShake .34s ease-in-out';

    let done = false;
    let timer = 0;
    const rm = () => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      el.classList.remove('shake');
      if (!arena) el.style.animation = '';
      el.removeEventListener('animationend', rm);
    };
    el.addEventListener('animationend', rm);
    timer = setTimeout(rm, UI.SHAKE_MS);
  },

  /* ================================================================ BADGES
   * Red dots. Keys may be dotted; a parent shows its own count plus every
   * descendant's. Systems call UI.badge('more.mail', n) whenever their
   * claimable count changes; UI.refreshBadges() recomputes everything.
   * ===================================================================== */

  badge(key, n) {
    if (typeof key !== 'string' || !key) return;
    let v = Math.floor(Number(n));
    if (!isFinite(v) || v < 0) v = 0;
    if (UI._counts[key] === v) return;    // no repaint when nothing changed
    UI._counts[key] = v;
    UI.paintBadges();
  },

  /* own + every descendant */
  badgeCount(key) {
    if (typeof key !== 'string' || !key) return 0;
    let total = UI._counts[key] || 0;
    const prefix = key + '.';
    for (const k in UI._counts) {
      if (!Object.prototype.hasOwnProperty.call(UI._counts, k)) continue;
      if (k.length > prefix.length && k.slice(0, prefix.length) === prefix) {
        total += UI._counts[k] || 0;
      }
    }
    return total > 0 ? total : 0;
  },

  _childSum(key) {
    const prefix = key + '.';
    let total = 0;
    for (const k in UI._counts) {
      if (!Object.prototype.hasOwnProperty.call(UI._counts, k)) continue;
      if (k.length > prefix.length && k.slice(0, prefix.length) === prefix) {
        total += UI._counts[k] || 0;
      }
    }
    return total;
  },

  paintBadges() {
    const els = UI.qsa('[data-badge]');
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      const key = el.getAttribute('data-badge');
      if (!key) continue;
      const n = UI.badgeCount(key);
      if (n > 0) {
        const txt = n > 99 ? '99+' : String(n);
        if (el.textContent !== txt) el.textContent = txt;
        if (el.hidden) el.hidden = false;
      } else {
        if (!el.hidden) el.hidden = true;
        if (el.textContent !== '') el.textContent = '';
      }
    }
  },

  /* Pull a fresh count from every system that exposes badges(), then repaint.
     Call after any grant (mail, quests, chests, drops...). */
  refreshBadges() {
    try {
      if (typeof Boot !== 'undefined' && Boot && Array.isArray(Boot.systems)) {
        for (let i = 0; i < Boot.systems.length; i++) {
          const row = Boot.systems[i];
          if (!row || !row.sys) continue;
          const key = UI.BADGE_SYS[row.name];
          if (!key) continue;
          if (typeof row.sys.badges !== 'function') continue;
          let n = 0;
          try { n = Math.floor(Number(row.sys.badges())); } catch (e) { n = 0; }
          if (!isFinite(n) || n < 0) n = 0;
          // A host that reports a total would double-count its children.
          if (UI.BADGE_HOSTS.indexOf(key) >= 0 && UI._childSum(key) > 0) n = 0;
          UI._counts[key] = n;
        }
      }
    } catch (e) { console.error('[everdao] refreshBadges failed:', e); }
    UI.paintBadges();
  },

  /* ============================================================== SHARED UI */

  rarityCls(r) {
    if (typeof r !== 'string') return 'r-gray';
    return UI.RARITY[r] || 'r-gray';
  },

  rarityBg(r) {
    if (typeof r !== 'string') return 'bg-gray';
    return UI.RARITY[r] ? 'bg-' + r : 'bg-gray';
  },

  /* Generic item row used by gear, pills, curios, relics and shop stock.
     item = { emoji, name, rarity, sub, right, act, id, locked, disabled }
       right : string OR Element rendered on the right edge
       act   : data-act value; when present the whole row is tappable
     Returns an Element — the caller appends it and handles clicks with its
     own delegated listener reading data-act / data-id. */
  itemCard(item) {
    const it = item || {};
    const rar = typeof it.rarity === 'string' ? it.rarity : 'gray';

    let cls = 'card tight ' + UI.rarityBg(rar);
    if (it.locked) cls += ' locked';
    const card = UI.el('div', cls);
    if (it.id !== undefined && it.id !== null) card.setAttribute('data-id', String(it.id));
    if (it.act) {
      card.setAttribute('data-act', String(it.act));
      card.setAttribute('role', 'button');
    }

    const row = UI.el('div', 'row between');

    const left = UI.el('div', 'row');
    if (it.emoji) left.appendChild(UI.el('span', 'unit-emoji', it.emoji));
    const col = UI.el('div', 'col');
    col.appendChild(UI.el('div', 'h2 ' + UI.rarityCls(rar), it.name || '—'));
    if (it.sub !== undefined && it.sub !== null && it.sub !== '') {
      if (it.sub.nodeType === 1) col.appendChild(it.sub);
      else col.appendChild(UI.el('div', 'tiny muted', String(it.sub)));
    }
    left.appendChild(col);
    row.appendChild(left);

    if (it.right !== undefined && it.right !== null && it.right !== '') {
      if (it.right.nodeType === 1) row.appendChild(it.right);
      else row.appendChild(UI.el('span', 'val', String(it.right)));
    } else if (it.act) {
      row.appendChild(UI.el('span', 'muted', '›'));
    }

    card.appendChild(row);
    return card;
  },

  /* A cost line: one chip per entry, red when the player cannot afford it.
     costObj is the Econ shape: {stone:400, 'herb:2':3, jade:1}. */
  costRow(costObj) {
    const row = UI.el('div', 'row wrap');
    if (!costObj || typeof costObj !== 'object') return row;

    let any = false;
    for (const k in costObj) {
      if (!Object.prototype.hasOwnProperty.call(costObj, k)) continue;
      const n = Math.floor(Number(costObj[k]));
      if (!isFinite(n) || n <= 0) continue;

      let icon = '❔';
      let label = k;
      try { icon = Econ.icon(k); label = Econ.label(k); } catch (e) { /* pre-boot */ }

      let ok = true;
      try { ok = Econ.can(k, n); } catch (e) { ok = true; }

      const chip = UI.el('span', 'chip' + (ok ? '' : ' bad'));
      let amount = String(n);
      try { amount = Fmt.n(n); } catch (e) { amount = String(n); }
      chip.textContent = icon + ' ' + amount;
      chip.title = label;
      row.appendChild(chip);
      any = true;
    }
    if (!any) row.appendChild(UI.el('span', 'tiny muted', 'Free'));
    return row;
  },

  /* Panel gate. Every system's render() starts with:
       if (UI.lock('wilds', CONFIG.unlocks.wilds)) return;
     While locked, UI owns the panel body: the dimmed placeholder is the only
     child, so a system that later unlocks simply rebuilds its DOM. */
  lock(panelId, realmNeeded) {
    const id = String(panelId || '');
    const panel = UI.panel(id);
    if (!panel) return false;

    let need = Math.floor(Number(realmNeeded));
    if (!isFinite(need) || need < 0) need = 0;

    let realm = 0;
    if (typeof S !== 'undefined' && S && S.player) realm = S.player.realm | 0;
    const locked = realm < need;

    let ph = document.getElementById('lock-' + id);
    if (ph && !panel.contains(ph)) ph = null;

    if (!locked) {
      if (ph) ph.hidden = true;
      return false;
    }

    if (!ph) {
      ph = UI.el('div', 'empty');
      ph.id = 'lock-' + id;
    }
    ph.textContent = '🔒 Unlocks at ' + UI.realmName(need);
    ph.hidden = false;

    if (panel.firstElementChild !== ph || panel.childElementCount !== 1) {
      panel.innerHTML = '';
      panel.appendChild(ph);
    }
    return true;
  },

  /* Mirrors S.settings.reduceFx onto #app (and <body>, so overlays outside
     #app — toasts, modals, floaters — honour it too). */
  reduceFx() {
    let on = false;
    if (typeof S !== 'undefined' && S && S.settings) on = !!S.settings.reduceFx;
    UI._reduce = on;
    const app = document.getElementById('app');
    if (app) app.classList.toggle('reduce-fx', on);
    if (document.body) document.body.classList.toggle('reduce-fx', on);
    return on;
  },

  /* ====================================================== NAV / DELEGATION
   * ONE click listener on #app handles the bottom nav, the HUD gear, the
   * quest strip and the hidden version tap. Everything else bubbles to the
   * panels' own delegated listeners first, so this never steals their taps.
   * ===================================================================== */

  bindNav() {
    if (UI._navBound) return;
    const app = document.getElementById('app');
    if (!app) return;
    UI._navBound = true;

    app.addEventListener('click', (e) => {
      try { UI._onAppClick(e); }
      catch (err) { console.error('[everdao] nav click failed:', err); }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' && e.key !== 'Esc') return;
      if (!UI._sheets.length && !UI._modals.length) return;
      UI.closeTop();
    });

    UI.paintBadges();
  },

  _onAppClick(e) {
    const target = e.target;
    if (!target || typeof target.closest !== 'function') return;

    /* 1. hidden dev trigger — lives inside #p-settings, so it is matched
          before the "chrome only" rule below. */
    const ver = target.closest('[data-act="version"]');
    if (ver) { UI._versionTap(); return; }

    /* 2. shell chrome actions. Panels own every other data-act value, and a
          panel's own listener has already seen this event. */
    const act = target.closest('[data-act]');
    if (act && !act.closest('.panel')) {
      const kind = act.getAttribute('data-act');
      if (kind === 'settings') { UI.show('settings'); return; }
      if (kind === 'quest') {
        const tab = act.getAttribute('data-tab') || 'quests';
        UI.show(tab, act.getAttribute('data-sub') || undefined);
        return;
      }
    }

    /* 3. anything anywhere carrying data-tab routes (nav buttons, the More
          menu grid, cross-links inside panels). */
    const tabEl = target.closest('[data-tab]');
    if (tabEl) {
      const tab = tabEl.getAttribute('data-tab');
      if (tab) {
        UI.show(tab, tabEl.getAttribute('data-sub') || undefined);
      }
    }
  },

  /* ------------------------------------------------------- version tapping */

  /* Dev.init() calls UI.onVersionTap(fn); 7 taps within 3s of each other fire
     every registered callback. */
  onVersionTap(fn) {
    if (typeof fn !== 'function') return;
    UI._tapFns.push(fn);
  },

  _versionTap() {
    const now = Date.now();
    if (now - UI._tapAt > UI.TAP_WINDOW_MS) UI._tapN = 0;
    UI._tapAt = now;
    UI._tapN++;

    let need = 7;
    try {
      const n = Math.floor(Number(CONFIG.dev.unlockTaps));
      if (isFinite(n) && n > 0) need = n;
    } catch (e) { need = 7; }

    const left = need - UI._tapN;
    if (left > 0 && left <= 2) {
      UI.toast(left + ' more…', 'info');
      return;
    }
    if (UI._tapN < need) return;

    UI._tapN = 0;
    UI._tapAt = 0;
    UI.toast('Dev panel unlocked.', 'gold');
    for (let i = 0; i < UI._tapFns.length; i++) {
      try { UI._tapFns[i](); }
      catch (err) { console.error('[everdao] version tap handler failed:', err); }
    }
  },
};

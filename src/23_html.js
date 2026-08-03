/* ============================================================================
 * EVERDAO — SHELL (static HTML skeleton)
 *
 * One binding: `SHELL`, a plain template literal injected once at boot by
 * 90_boot.js via  document.body.insertAdjacentHTML('afterbegin', SHELL).
 *
 * FORMULAS: none. This module computes nothing — it is markup only. It exists
 * so that every other module can assume a fixed set of mount points:
 *
 *   HUD text nodes patched every render (never rebuilt):
 *     #hudName   S.player.name
 *     #hudRealm  DATA.realms[S.player.realm].name + ' · ' + phase   (.chip.realm)
 *     #hudBR     Fmt.n(Stats.br())
 *     #hudStone  Fmt.n(S.cur.stone)
 *     #hudJade   Fmt.n(S.cur.jade)
 *
 *   Panel roots — UI.panel(id) resolves 'wilds' -> #p-wilds. Every panel ships
 *   EMPTY; its owning system builds its own DOM on first render and patches
 *   thereafter (CONTRACT §4). The only pre-seeded children are the dimmed
 *   `#lock-<key>` placeholders that UI.lock() unhides while a panel is gated,
 *   and the settings version footer (the hidden dev-panel trigger).
 *
 *   Overlay roots live OUTSIDE #app so they are never clipped by
 *   #app{overflow-x:hidden} and never inherit the panel stacking context.
 *
 * Layout rules honoured here (CONTRACT §5): mobile-first, no horizontal scroll
 * at 360px, only inventory classes, no inline styles (bare `hidden` attributes
 * only), no inline event handlers. All interaction is delegated off
 * data-act / data-tab / data-id.
 * ==========================================================================*/

const SHELL = `
<div id="app">

  <!-- ============================================================ HUD == -->
  <header class="hud">
    <div class="hud-row">
      <div class="row">
        <b class="h2" id="hudName">Wanderer</b>
        <span class="chip realm" id="hudRealm">Novice · 1</span>
      </div>
      <button class="btn ghost sm" data-act="settings" aria-label="Settings">⚙️</button>
    </div>
    <div class="hud-row">
      <span class="chip" aria-label="Battle Rating">⚔️ <span class="lbl">BR</span> <b class="mono" id="hudBR">0</b></span>
      <div class="row">
        <span class="chip" aria-label="Spiritstones">🪙 <b class="mono" id="hudStone">0</b></span>
        <span class="chip" aria-label="Fate Jade">💎 <b class="mono" id="hudJade">0</b></span>
      </div>
    </div>
  </header>

  <!-- ================================================ SCROLL / PANELS == -->
  <!-- The page itself scrolls; .hud is sticky and .nav is fixed, so the
       storage warning and the quest strip live at the top of .scroll where
       they inherit its 12px gutter instead of sitting flush to the edge. -->
  <div class="scroll">

    <!-- localStorage unavailable (private mode / disabled cookies).
         90_boot.js fills the text and clears the hidden attribute when
         Save.storageBroken is true. -->
    <div class="card tight bad tiny" id="lsWarn" hidden></div>

    <!-- Active-quest strip. Quests (61_meta.js) patches the label and rewrites
         data-tab to the tab the current step wants; the shipped default routes
         to the quest log so the control is never dead. -->
    <div class="card tight" id="questStrip">
      <button class="btn ghost wide" id="questChip" data-act="quest" data-tab="quests">
        <span>📜</span> <b>The Path Begins</b> <span class="tiny muted">Tap to continue</span>
      </button>
    </div>

    <!-- ---------------------------------------------------- main tabs -- -->
    <section class="panel" id="p-cultivate"></section>

    <section class="panel" id="p-wilds">
      <div class="empty" id="lock-wilds" hidden>🔒 Unlocks at Connection</div>
    </section>

    <section class="panel" id="p-battle">
      <div class="empty" id="lock-battle" hidden>🔒 Unlocks at Virtuoso</div>
    </section>

    <section class="panel" id="p-abode">
      <div class="empty" id="lock-abode" hidden>🔒 Unlocks at Foundation</div>
    </section>

    <section class="panel" id="p-more"></section>

    <!-- ----------------------------------------------- sub-panels ----- -->
    <section class="panel" id="p-sect">
      <div class="empty" id="lock-sect" hidden>🔒 Unlocks at Foundation</div>
    </section>

    <section class="panel" id="p-techs"></section>

    <section class="panel" id="p-curios">
      <div class="empty" id="lock-curios" hidden>🔒 Unlocks at Incarnation</div>
    </section>

    <section class="panel" id="p-shops">
      <div class="empty" id="lock-shops" hidden>🔒 Unlocks at Connection</div>
    </section>

    <section class="panel" id="p-quests"></section>

    <section class="panel" id="p-pass"></section>

    <section class="panel" id="p-ach"></section>

    <section class="panel" id="p-mail"></section>

    <section class="panel" id="p-law">
      <div class="empty" id="lock-law" hidden>🔒 Unlocks at Voidbreak</div>
    </section>

    <section class="panel" id="p-samsara">
      <div class="empty" id="lock-samsara" hidden>🔒 Unlocks at Celestial</div>
    </section>

    <section class="panel" id="p-settings">
      <!-- Settings (64_more.js) must APPEND its own DOM to this panel and must
           not wipe #settingsFoot: #version is the hidden dev-panel trigger and
           UI.onVersionTap() binds to it once, at boot. -->
      <div class="sec" id="settingsFoot">
        <div class="divider"></div>
        <div class="tiny muted mono" id="version" data-act="version">EVERDAO v1.0.0</div>
      </div>
    </section>

    <div class="safe-b"></div>
  </div>

  <!-- ====================================================== BOTTOM NAV == -->
  <nav class="nav" aria-label="Main">
    <button class="nav-btn" data-tab="cultivate" aria-label="Cultivate">
      <span>🧘</span>
      <b>Cultivate<span class="badge" data-badge="cultivate" hidden>0</span></b>
    </button>
    <button class="nav-btn" data-tab="wilds" aria-label="Wilds">
      <span>🗺️</span>
      <b>Wilds<span class="badge" data-badge="wilds" hidden>0</span></b>
    </button>
    <button class="nav-btn" data-tab="battle" aria-label="Battle">
      <span>⚔️</span>
      <b>Battle<span class="badge" data-badge="battle" hidden>0</span></b>
    </button>
    <button class="nav-btn" data-tab="abode" aria-label="Abode">
      <span>🏯</span>
      <b>Abode<span class="badge" data-badge="abode" hidden>0</span></b>
    </button>
    <button class="nav-btn" data-tab="more" aria-label="More">
      <span>☰</span>
      <b>More<span class="badge" data-badge="more" hidden>0</span></b>
    </button>
  </nav>

</div>

<!-- ================================================== OVERLAY ROOTS ==== -->
<!-- Siblings of #app: toasts, modals, sheets, flashes and floating numbers
     must sit above the fixed nav and outside #app's overflow clipping. -->
<div id="toastWrap" class="toast-wrap"></div>
<div id="modalRoot"></div>
<div id="sheetRoot"></div>
<div id="flashRoot"></div>
<div id="floatRoot"></div>
`;

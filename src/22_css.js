/* ---------------------------------------------------------------------------
 * CSS — the complete EVERDAO stylesheet, injected into a <style> tag at boot.
 *
 * This module declares exactly ONE top-level binding: const CSS.
 * It is a template literal, so it must contain no backtick and no dollar sign.
 *
 * "FORMULAS" (the layout arithmetic this sheet encodes):
 *   navClearance = var(--nav-h) + 22px + env(safe-area-inset-bottom, 0px)
 *                  -> .scroll padding-bottom and .safe-b height, so the fixed
 *                     bottom nav never covers the last row of a panel.
 *   toastBottom  = var(--nav-h) + 14px + env(safe-area-inset-bottom, 0px)
 *                  -> .toast-wrap always stacks ABOVE the nav, never behind it.
 *   ringSweep(p) = p * 360deg, applied as
 *                     conic-gradient(from -90deg, jade ringSweep, track 0)
 *                  -> .ring realm progress. Panel sets style="--p:0.42" (0..1).
 *   ringInner    = .ring inset by 10px (the .ring-in mask disc), so the visible
 *                  stroke is exactly 10px wide at any ring diameter.
 *   barFill(p)   = .bar > i { width: p*100% }, set inline by the panel.
 *   badgeAnchor  = nav: right calc(50% - 21px); tab/generic: right 5px.
 *   appWidth     = min(100vw, 480px); every internal box uses minmax(0,1fr) or
 *                  min-width:0, so a 360px viewport never scrolls sideways.
 *   auraRing(n)  = scale 0.94 -> 1.06 over (2.6s, 3.6s, 4.8s) for a1/a2/a3.
 *
 * Motion budget: every @keyframes here touches ONLY transform and opacity.
 * #app.reduce-fx (bound to S.settings.reduceFx) kills all of them in one rule.
 * ------------------------------------------------------------------------ */

const CSS = `
/* ========================================================== 0. RESET ===== */
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0;width:100%;max-width:100%;overflow-x:hidden}
body{background:#07090d;color:var(--txt);font-family:var(--sans);font-size:14px;line-height:1.45;
  -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;
  -webkit-text-size-adjust:100%;text-size-adjust:100%;
  overflow-wrap:break-word;word-break:break-word;-webkit-tap-highlight-color:transparent}
h1,h2,h3,h4,p,figure,blockquote,dl,dd{margin:0}
ul,ol{margin:0;padding:0;list-style:none}
img,svg{max-width:100%;display:block}
button,input,select,textarea{font:inherit;color:inherit}
a{color:var(--jade);text-decoration:none}
::-webkit-scrollbar{width:6px;height:6px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:#2a3243;border-radius:3px}

/* ============================================== 1. PALETTE + TOKENS ===== */
:root{
  /* contract palette */
  --bg:#0d0f14; --panel:#151a23; --panel2:#1b2130; --line:#252c3a;
  --txt:#e6ebf2; --mut:#8a94a6; --jade:#35d0a0; --gold:#e8c76a; --red:#e05a5a;
  --gray:#8a94a6; --green:#5fd07a; --blue:#5aa9e0; --purple:#b07ae0;
  /* derived ink / wash tones */
  --ink:#090b10; --well:#0b0e14; --line2:#313a4c;
  --jade-dim:rgba(53,208,160,.14); --gold-dim:rgba(232,199,106,.14);
  --red-dim:rgba(224,90,90,.14);  --blue-dim:rgba(90,169,224,.14);
  --scrim:rgba(5,7,11,.74);
  /* geometry */
  --rad:12px; --rad-sm:9px; --rad-lg:16px; --nav-h:62px; --tap:44px;
  --gap:8px; --pad:12px; --safe:env(safe-area-inset-bottom,0px);
  /* type */
  --serif:Georgia,"Iowan Old Style","Palatino Linotype","Times New Roman",Times,serif;
  --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace;
}

/* ==================================================== 2. APP SHELL ====== */
#app{position:relative;max-width:480px;margin:0 auto;min-height:100vh;
  background:var(--bg);color:var(--txt);overflow-x:hidden;isolation:isolate}
/* CSS-only mist: two soft clouds plus a low horizon glow. No images. */
#app::before{content:"";position:fixed;left:50%;top:0;width:480px;max-width:100vw;height:100vh;
  transform:translateX(-50%);pointer-events:none;z-index:0;
  background:
    radial-gradient(120% 60% at 12% -8%,rgba(53,208,160,.07),transparent 62%),
    radial-gradient(110% 55% at 92% 4%,rgba(176,122,224,.06),transparent 60%),
    radial-gradient(140% 44% at 50% 104%,rgba(232,199,106,.05),transparent 66%)}
#app > *{position:relative;z-index:1}

/* ========================================================== 3. HUD ====== */
.hud{position:sticky;top:0;z-index:40;padding:8px var(--pad);
  background:linear-gradient(180deg,#12161f 0%,#12161f 62%,rgba(18,22,31,.94) 100%);
  border-bottom:1px solid var(--line);box-shadow:0 6px 18px rgba(0,0,0,.35)}
.hud::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:1px;opacity:.7;
  pointer-events:none;
  background:linear-gradient(90deg,transparent,rgba(53,208,160,.45),rgba(232,199,106,.35),transparent)}
.hud-row{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}
.hud-row + .hud-row{margin-top:6px}
.hud-row > *{min-width:0}

/* =========================================== 4. PANELS / SCROLL / TABS == */
.panel{display:none}
.panel.active{display:block;animation:everPanelIn .18s ease-out both}
.scroll{padding:var(--pad) var(--pad) calc(var(--nav-h) + 22px + var(--safe));
  overflow-y:auto;-webkit-overflow-scrolling:touch;min-width:0;min-height:0}
/* Spacer panels append at the end of a list so the fixed nav never overlaps. */
.safe-b{height:calc(var(--nav-h) + 12px);padding-bottom:var(--safe);flex:0 0 auto;pointer-events:none}
.tabs{display:flex;align-items:stretch;gap:6px;overflow-x:auto;overflow-y:hidden;
  -webkit-overflow-scrolling:touch;scrollbar-width:none;padding:8px 12px;margin:0 -12px 10px;
  border-bottom:1px solid var(--line)}
.tabs::-webkit-scrollbar{display:none}
.tab{position:relative;flex:0 0 auto;min-height:var(--tap);display:inline-flex;align-items:center;
  gap:5px;padding:0 13px;border:1px solid var(--line);border-radius:999px;background:var(--panel2);
  color:var(--mut);font-size:13px;font-weight:600;white-space:nowrap;cursor:pointer;
  user-select:none;-webkit-user-select:none;touch-action:manipulation;
  transition:color .15s ease,border-color .15s ease,background-color .15s ease}
.tab.active{color:var(--txt);border-color:rgba(53,208,160,.55);
  background:linear-gradient(180deg,rgba(53,208,160,.16),rgba(53,208,160,.05));
  box-shadow:inset 0 0 0 1px rgba(53,208,160,.12)}
.tab.active::after{content:"";position:absolute;left:26%;right:26%;bottom:-9px;height:2px;
  border-radius:2px;background:var(--jade);opacity:.85}

/* ================================================== 5. BOTTOM NAV ======= */
.nav{position:fixed;left:0;right:0;bottom:0;z-index:50;margin:0 auto;max-width:480px;
  display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:0;
  background:linear-gradient(180deg,rgba(21,26,35,.97),#12161f);border-top:1px solid var(--line);
  padding-bottom:env(safe-area-inset-bottom,0px);box-shadow:0 -8px 22px rgba(0,0,0,.45)}
.nav::before{content:"";position:absolute;left:0;right:0;top:-1px;height:1px;pointer-events:none;
  background:linear-gradient(90deg,transparent,rgba(53,208,160,.4),transparent)}
.nav-btn{position:relative;min-height:var(--nav-h);display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:2px;padding:6px 2px;border:0;background:transparent;
  color:var(--mut);font-size:10.5px;font-weight:600;letter-spacing:.2px;line-height:1.1;
  cursor:pointer;user-select:none;-webkit-user-select:none;touch-action:manipulation;
  min-width:0;overflow:hidden;transition:color .15s ease}
.nav-btn > span{font-size:19px;line-height:1}
.nav-btn > b{font-weight:600;white-space:nowrap}
.nav-btn.active{color:var(--jade)}
.nav-btn.active::before{content:"";position:absolute;left:50%;top:0;width:26px;height:2px;
  margin-left:-13px;border-radius:0 0 3px 3px;background:var(--jade)}
.nav-btn.active::after{content:"";position:absolute;left:50%;top:4px;width:44px;height:44px;
  margin-left:-22px;border-radius:50%;pointer-events:none;
  background:radial-gradient(circle,rgba(53,208,160,.2),transparent 68%)}

/* ==================================================== 6. SURFACES ======= */
.card{position:relative;background:linear-gradient(180deg,var(--panel),#131822);
  border:1px solid var(--line);border-radius:var(--rad);padding:12px;margin-bottom:10px;
  overflow:hidden;min-width:0}
/* Corner seal motif: a faint conic stamp, purely decorative. */
.card::after{content:"";position:absolute;right:-22px;top:-22px;width:78px;height:78px;
  border-radius:50%;opacity:.5;pointer-events:none;
  background:conic-gradient(from 210deg,rgba(232,199,106,.1),rgba(53,208,160,.07),rgba(232,199,106,.1))}
.card.tight{padding:8px 10px;margin-bottom:8px}
.card > *:last-child{margin-bottom:0}
.sec{margin-top:12px;min-width:0}
.sec:first-child{margin-top:0}
.sec-title{display:flex;align-items:center;gap:7px;font-family:var(--serif);font-size:14px;
  font-weight:700;letter-spacing:.5px;color:var(--txt);margin-bottom:7px}
.sec-title::before{content:"";flex:0 0 auto;width:3px;height:14px;border-radius:2px;
  background:linear-gradient(180deg,var(--jade),rgba(53,208,160,.15))}
.sec-title::after{content:"";flex:1 1 auto;height:1px;
  background:linear-gradient(90deg,var(--line),transparent)}
.row{display:flex;align-items:center;gap:var(--gap);min-width:0}
.row > *{min-width:0}
.row.between{justify-content:space-between}
.row.wrap{flex-wrap:wrap}
.col{display:flex;flex-direction:column;gap:6px;min-width:0}
.grid2,.grid3,.grid4{display:grid;gap:8px;min-width:0}
.grid2{grid-template-columns:repeat(2,minmax(0,1fr))}
.grid3{grid-template-columns:repeat(3,minmax(0,1fr))}
.grid4{grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
.grid2 > *,.grid3 > *,.grid4 > *{min-width:0}
.divider{height:1px;margin:10px 0;border:0;
  background:linear-gradient(90deg,transparent,var(--line) 16%,var(--line) 84%,transparent)}
.empty{padding:20px 14px;text-align:center;color:var(--mut);font-size:12.5px;line-height:1.6;
  border:1px dashed var(--line2);border-radius:var(--rad);background:rgba(11,14,20,.5)}

/* ======================================================== 7. TYPE ======= */
.h1{font-family:var(--serif);font-size:21px;font-weight:700;line-height:1.25;
  letter-spacing:.3px;color:var(--txt)}
.h2{font-family:var(--serif);font-size:16.5px;font-weight:700;line-height:1.3;
  letter-spacing:.3px;color:var(--txt)}
.h3{font-size:13px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--mut)}
.lbl{font-size:10.5px;font-weight:600;letter-spacing:.7px;text-transform:uppercase;color:var(--mut)}
.val{font-size:15px;font-weight:700;color:var(--txt);font-variant-numeric:tabular-nums}
.muted{color:var(--mut)}
.tiny{font-size:11px;line-height:1.45}
.mono{font-family:var(--mono);font-variant-numeric:tabular-nums;letter-spacing:-.2px}
.serif{font-family:var(--serif);letter-spacing:.3px}
.good{color:var(--green)}
.bad{color:var(--red)}
.gold{color:var(--gold)}
.jade{color:var(--jade)}

/* ==================================================== 8. CONTROLS ====== */
.btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:6px;
  min-height:var(--tap);padding:0 14px;border:1px solid var(--line2);border-radius:var(--rad-sm);
  background:linear-gradient(180deg,var(--panel2),#161b27);color:var(--txt);
  font-family:var(--sans);font-size:13.5px;font-weight:700;letter-spacing:.2px;text-align:center;
  white-space:nowrap;cursor:pointer;user-select:none;-webkit-user-select:none;
  touch-action:manipulation;-webkit-appearance:none;appearance:none;
  transition:transform .08s ease,border-color .15s ease,opacity .15s ease,background-color .15s ease}
.btn:active{transform:scale(.97)}
.btn.primary{border-color:rgba(53,208,160,.55);color:#eafff7;
  background:linear-gradient(180deg,rgba(53,208,160,.24),rgba(53,208,160,.08));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06)}
.btn.ghost{border-color:var(--line);background:transparent;color:var(--mut);font-weight:600}
.btn.danger{border-color:rgba(224,90,90,.55);color:#ffecec;
  background:linear-gradient(180deg,rgba(224,90,90,.22),rgba(224,90,90,.07))}
.btn.sm{min-height:38px;padding:0 10px;font-size:12.5px;border-radius:8px}
/* .btn.sm keeps a full 44px tap target via an invisible hit expander. */
.btn.sm::after{content:"";position:absolute;left:0;right:0;top:50%;height:var(--tap);
  transform:translateY(-50%)}
.btn.wide{display:flex;width:100%}
.btn:disabled,.btn[disabled]{opacity:.42;cursor:not-allowed;filter:saturate(.4);transform:none}
.btn:disabled:active,.btn[disabled]:active{transform:none}
.btn.glow{border-color:rgba(232,199,106,.7);color:#fff6da;
  background:linear-gradient(180deg,rgba(232,199,106,.26),rgba(232,199,106,.08))}
.btn.glow::before{content:"";position:absolute;left:-5px;right:-5px;top:-5px;bottom:-5px;
  border-radius:14px;border:1px solid rgba(232,199,106,.55);box-shadow:0 0 18px rgba(232,199,106,.35);
  opacity:.35;pointer-events:none;animation:everBtnGlow 1.9s ease-in-out infinite}
.stepper{display:inline-flex;align-items:stretch;min-height:var(--tap);border:1px solid var(--line2);
  border-radius:var(--rad-sm);background:var(--well);overflow:hidden;min-width:0}
.stepper > button,.stepper > .btn{min-width:42px;min-height:var(--tap);padding:0 10px;border:0;
  border-radius:0;background:linear-gradient(180deg,var(--panel2),#161b27);color:var(--txt);
  font-size:17px;font-weight:700;line-height:1;cursor:pointer;touch-action:manipulation}
.stepper > button:active,.stepper > .btn:active{background:#202737;transform:none}
.stepper > .btn::after{content:none}
.stepper > b,.stepper > span{flex:1 1 auto;display:flex;align-items:center;justify-content:center;
  min-width:46px;padding:0 8px;font-family:var(--mono);font-size:14px;font-weight:700;
  font-variant-numeric:tabular-nums;color:var(--txt);
  border-left:1px solid var(--line);border-right:1px solid var(--line)}
.toggle{position:relative;flex:0 0 auto;width:48px;height:28px;border-radius:999px;
  border:1px solid var(--line2);background:var(--well);cursor:pointer;user-select:none;
  -webkit-user-select:none;touch-action:manipulation;
  transition:background-color .18s ease,border-color .18s ease}
/* invisible 44px-tall hit area wrapped around the 28px switch */
.toggle::before{content:"";position:absolute;left:-6px;right:-6px;top:50%;height:var(--tap);
  transform:translateY(-50%)}
.toggle::after{content:"";position:absolute;left:2px;top:2px;width:22px;height:22px;
  border-radius:50%;background:#5b657a;box-shadow:0 1px 3px rgba(0,0,0,.5);
  transition:transform .18s ease,background-color .18s ease}
.toggle.on{border-color:rgba(53,208,160,.6);background:rgba(53,208,160,.22)}
.toggle.on::after{transform:translateX(20px);background:var(--jade)}
.input,.textarea{display:block;width:100%;min-height:var(--tap);padding:10px 12px;
  border:1px solid var(--line2);border-radius:var(--rad-sm);background:var(--well);color:var(--txt);
  font-family:var(--sans);font-size:16px;line-height:1.4;
  -webkit-appearance:none;appearance:none;outline:none;transition:border-color .15s ease}
.textarea{min-height:96px;resize:vertical;font-family:var(--mono);font-size:13px;line-height:1.5}
.input::placeholder,.textarea::placeholder{color:#5c6678}
.input:focus,.textarea:focus{border-color:rgba(53,208,160,.65)}

/* ------------------------------------------- 8b. FOCUS + COMPOUND STATES */
.btn:focus-visible,.tab:focus-visible,.nav-btn:focus-visible,.toggle:focus-visible,
.bt-btn:focus-visible,.wisp:focus-visible,.pill-chip:focus-visible,
.input:focus-visible,.textarea:focus-visible{
  outline:2px solid rgba(53,208,160,.85);outline-offset:2px}
/* rarity tints compose onto buttons, chips, stats and cards alike */
.btn.bg-gold,.btn.bg-purple,.btn.bg-blue,.btn.bg-green,.btn.bg-gray{color:var(--txt)}
.chip.bg-gold,.stat.bg-gold,.card.bg-gold{color:var(--txt)}
/* a locked surface also mutes anything interactive inside it */
.locked .btn,.locked .bt-btn,.locked .toggle{pointer-events:none;opacity:.75}
/* a .badge dropped inline (not on a nav-btn/tab) must not escape its row */
.row > .badge,.kv > .badge,.chip > .badge{position:static;top:auto;right:auto;margin-left:4px}
/* stat tiles sitting directly in a grid stretch to equal height */
.grid2 > .stat,.grid3 > .stat,.grid4 > .stat{height:100%}
.grid2 > .btn,.grid3 > .btn,.grid4 > .btn{width:100%}

/* ================================================ 9. DATA DISPLAY ====== */
.bar{position:relative;display:block;width:100%;height:9px;border-radius:6px;background:var(--well);
  border:1px solid var(--line);overflow:hidden;min-width:0}
.bar > i{display:block;height:100%;width:0;border-radius:5px;
  background:linear-gradient(90deg,#2aa982,var(--jade));box-shadow:0 0 8px rgba(53,208,160,.35);
  transition:width .25s linear}
.bar.hp > i{background:linear-gradient(90deg,#a83c3c,var(--red));box-shadow:0 0 8px rgba(224,90,90,.35)}
.bar.mp > i{background:linear-gradient(90deg,#3a7aa8,var(--blue));box-shadow:0 0 8px rgba(90,169,224,.35)}
.bar.exp > i{background:linear-gradient(90deg,#2aa982,var(--jade));box-shadow:0 0 8px rgba(53,208,160,.35)}
.meter{position:relative;display:block;width:100%;height:15px;border-radius:8px;
  background:var(--well);border:1px solid var(--line);overflow:hidden;min-width:0}
.meter > i{display:block;height:100%;width:0;border-radius:7px;
  background:linear-gradient(90deg,rgba(232,199,106,.55),var(--gold));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.12);transition:width .3s ease}
.chip{display:inline-flex;align-items:center;gap:4px;max-width:100%;padding:3px 9px;
  border:1px solid var(--line2);border-radius:999px;background:var(--panel2);color:var(--txt);
  font-size:11.5px;font-weight:600;line-height:1.5;white-space:nowrap;overflow:hidden;
  text-overflow:ellipsis}
.chip.realm{font-family:var(--serif);font-size:12.5px;letter-spacing:.5px;padding:3px 11px;
  color:var(--gold);border-color:rgba(232,199,106,.5);
  background:linear-gradient(180deg,rgba(232,199,106,.15),rgba(232,199,106,.04))}
.pill-chip{display:inline-flex;align-items:center;justify-content:center;gap:4px;min-width:38px;
  min-height:34px;padding:3px 8px;border:1px solid var(--line2);border-radius:10px;font-size:15px;
  line-height:1;cursor:pointer;touch-action:manipulation;
  background:radial-gradient(circle at 50% 22%,rgba(255,255,255,.06),transparent 60%),var(--panel2)}
.pill-chip > b{font-family:var(--mono);font-size:11px;font-weight:700;color:var(--mut)}
.kv{display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding:5px 0;
  min-width:0;border-bottom:1px dashed rgba(37,44,58,.85)}
.kv:last-child{border-bottom:0}
.kv .k{flex:1 1 auto;min-width:0;color:var(--mut);font-size:12.5px;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.kv .v{flex:0 0 auto;font-size:13px;font-weight:700;color:var(--txt);
  font-variant-numeric:tabular-nums;text-align:right}
.stat{display:flex;flex-direction:column;gap:2px;min-width:0;padding:8px 9px;
  border:1px solid var(--line);border-radius:10px;text-align:left;
  background:linear-gradient(180deg,var(--panel2),#161b27)}
.stat > .lbl{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.stat > .val{font-size:14px}
.dot{display:inline-block;flex:0 0 auto;width:7px;height:7px;border-radius:50%;
  background:var(--mut);vertical-align:middle}
.dot.good,.good > .dot{background:var(--green)}
.dot.bad,.bad > .dot{background:var(--red)}
.dot.gold,.gold > .dot{background:var(--gold)}
.dot.jade,.jade > .dot{background:var(--jade)}
.badge{position:absolute;top:5px;right:5px;z-index:3;display:inline-flex;align-items:center;
  justify-content:center;min-width:17px;height:17px;padding:0 4px;border-radius:9px;
  border:1px solid #0d0f14;background:var(--red);color:#fff;font-family:var(--sans);font-size:10px;
  font-weight:800;line-height:1;pointer-events:none}
.nav-btn .badge{top:6px;right:calc(50% - 21px)}
.tab .badge{top:3px;right:3px}

/* ===================================================== 10. RARITY ====== */
.r-gray{color:var(--gray)}
.r-green{color:var(--green)}
.r-blue{color:var(--blue)}
.r-purple{color:var(--purple)}
.r-gold{color:var(--gold)}
.bg-gray{border-color:rgba(138,148,166,.45);
  background:linear-gradient(180deg,rgba(138,148,166,.1),rgba(138,148,166,.02))}
.bg-green{border-color:rgba(95,208,122,.45);
  background:linear-gradient(180deg,rgba(95,208,122,.11),rgba(95,208,122,.02))}
.bg-blue{border-color:rgba(90,169,224,.45);
  background:linear-gradient(180deg,rgba(90,169,224,.11),rgba(90,169,224,.02))}
.bg-purple{border-color:rgba(176,122,224,.48);
  background:linear-gradient(180deg,rgba(176,122,224,.13),rgba(176,122,224,.03))}
.bg-gold{border-color:rgba(232,199,106,.55);box-shadow:inset 0 0 14px rgba(232,199,106,.07);
  background:linear-gradient(180deg,rgba(232,199,106,.15),rgba(232,199,106,.03))}
.locked{opacity:.5;filter:grayscale(.65);cursor:not-allowed;position:relative}
.locked::before{content:"";position:absolute;left:0;right:0;top:0;bottom:0;border-radius:inherit;
  pointer-events:none;
  background:repeating-linear-gradient(135deg,rgba(0,0,0,.16) 0 6px,transparent 6px 12px)}

/* ============================================ 11. CULTIVATE HERO ====== */
.hero{position:relative;display:flex;align-items:center;justify-content:center;min-height:212px;
  padding:14px;margin-bottom:10px;border:1px solid var(--line);border-radius:var(--rad-lg);
  overflow:hidden;
  background:
    radial-gradient(90% 70% at 50% 116%,rgba(53,208,160,.13),transparent 62%),
    radial-gradient(70% 60% at 50% -18%,rgba(232,199,106,.09),transparent 60%),
    linear-gradient(180deg,#141926,#0f131c)}
/* layered cloud bands drifting behind the cultivator */
.hero::before{content:"";position:absolute;left:-20%;right:-20%;bottom:6px;height:76px;
  pointer-events:none;
  background:
    radial-gradient(40% 60% at 22% 70%,rgba(230,235,242,.07),transparent 70%),
    radial-gradient(34% 56% at 55% 82%,rgba(230,235,242,.05),transparent 70%),
    radial-gradient(44% 62% at 82% 68%,rgba(230,235,242,.06),transparent 70%)}
/* engraved dao seal: 12 conic ticks masked into a thin ring */
.hero::after{content:"";position:absolute;left:50%;top:50%;width:250px;height:250px;
  margin:-125px 0 0 -125px;border-radius:50%;pointer-events:none;opacity:.3;
  background:conic-gradient(from 0deg,
    transparent 0deg 8deg,rgba(53,208,160,.16) 8deg 10deg,
    transparent 10deg 38deg,rgba(53,208,160,.16) 38deg 40deg,
    transparent 40deg 68deg,rgba(53,208,160,.16) 68deg 70deg,
    transparent 70deg 98deg,rgba(53,208,160,.16) 98deg 100deg,
    transparent 100deg 128deg,rgba(53,208,160,.16) 128deg 130deg,
    transparent 130deg 158deg,rgba(53,208,160,.16) 158deg 160deg,
    transparent 160deg 188deg,rgba(53,208,160,.16) 188deg 190deg,
    transparent 190deg 218deg,rgba(53,208,160,.16) 218deg 220deg,
    transparent 220deg 248deg,rgba(53,208,160,.16) 248deg 250deg,
    transparent 250deg 278deg,rgba(53,208,160,.16) 278deg 280deg,
    transparent 280deg 308deg,rgba(53,208,160,.16) 308deg 310deg,
    transparent 310deg 338deg,rgba(53,208,160,.16) 338deg 340deg,
    transparent 340deg 360deg);
  -webkit-mask-image:radial-gradient(circle,transparent 44%,#000 46%,#000 49%,transparent 51%);
  mask-image:radial-gradient(circle,transparent 44%,#000 46%,#000 49%,transparent 51%)}
.figure{position:relative;z-index:3;display:flex;align-items:center;justify-content:center;
  width:84px;height:84px;border-radius:50%;font-size:42px;line-height:1;text-align:center;
  background:radial-gradient(circle at 50% 34%,rgba(53,208,160,.2),rgba(13,15,20,.1) 68%);
  filter:drop-shadow(0 4px 10px rgba(0,0,0,.55));
  animation:everFloatIdle 5.5s ease-in-out infinite}
.aura{position:absolute;left:50%;top:50%;border-radius:50%;border:1px solid rgba(53,208,160,.5);
  transform:translate(-50%,-50%);pointer-events:none;z-index:2}
.aura.a1{width:116px;height:116px;border-color:rgba(53,208,160,.55);opacity:.85;
  box-shadow:inset 0 0 20px rgba(53,208,160,.18);animation:everAura 2.6s ease-in-out infinite}
.aura.a2{width:156px;height:156px;border-color:rgba(53,208,160,.32);opacity:.6;
  animation:everAura 3.6s ease-in-out infinite;animation-delay:-.7s}
.aura.a3{width:198px;height:198px;border-color:rgba(232,199,106,.22);border-style:dashed;opacity:.45;
  animation:everAura 4.8s ease-in-out infinite;animation-delay:-1.5s}
.ring{position:relative;flex:0 0 auto;width:128px;height:128px;border-radius:50%;
  box-shadow:0 0 18px rgba(53,208,160,.14);
  background:conic-gradient(from -90deg,var(--jade) calc(var(--p,0) * 360deg),rgba(53,208,160,.1) 0)}
.ring::before{content:"";position:absolute;left:-5px;top:-5px;right:-5px;bottom:-5px;
  border-radius:50%;border:1px solid rgba(53,208,160,.22);pointer-events:none}
.ring-in{position:absolute;left:10px;top:10px;right:10px;bottom:10px;border-radius:50%;display:flex;
  flex-direction:column;align-items:center;justify-content:center;gap:1px;padding:6px;
  text-align:center;border:1px solid var(--line);overflow:hidden;
  background:radial-gradient(circle at 50% 30%,#1a202c,#12161f 70%)}
.ring-in > .lbl{font-size:9.5px;letter-spacing:.5px}
.ring-in > .val{font-size:16px}
.ring-in > .h2{font-size:14px}
.mote{position:absolute;bottom:10px;width:4px;height:4px;border-radius:50%;background:var(--jade);
  box-shadow:0 0 6px rgba(53,208,160,.8);opacity:0;pointer-events:none;z-index:2;
  animation:everMote 4.6s linear infinite}
.mote:nth-child(2n){animation-duration:5.8s;animation-delay:-1.2s;background:var(--gold);
  box-shadow:0 0 6px rgba(232,199,106,.8)}
.mote:nth-child(3n){animation-duration:6.6s;animation-delay:-2.6s;width:3px;height:3px}
.mote:nth-child(4n){animation-duration:5.1s;animation-delay:-3.4s}
.mote:nth-child(5n){animation-duration:7.2s;animation-delay:-.6s}
.wisp{position:absolute;z-index:6;width:46px;height:46px;border-radius:50%;border:0;padding:0;
  cursor:pointer;touch-action:manipulation;box-shadow:0 0 22px rgba(53,208,160,.5);
  background:radial-gradient(circle at 50% 42%,rgba(255,255,255,.92),rgba(53,208,160,.65) 34%,
    rgba(53,208,160,.12) 62%,transparent 72%);
  animation:everWisp 2.1s ease-in-out infinite}
.wisp::after{content:"";position:absolute;left:-8px;top:-8px;right:-8px;bottom:-8px;border-radius:50%}
.bt-btn{position:relative;display:flex;align-items:center;justify-content:center;gap:8px;width:100%;
  min-height:52px;padding:0 16px;border:1px solid rgba(232,199,106,.6);border-radius:var(--rad);
  background:linear-gradient(180deg,rgba(232,199,106,.28),rgba(232,199,106,.08));color:#fff4d6;
  font-family:var(--serif);font-size:16px;font-weight:700;letter-spacing:1.2px;cursor:pointer;
  user-select:none;-webkit-user-select:none;touch-action:manipulation;overflow:hidden;
  transition:transform .08s ease,opacity .15s ease}
.bt-btn:active{transform:scale(.985)}
.bt-btn:disabled,.bt-btn[disabled]{opacity:.4;filter:saturate(.3);cursor:not-allowed}

/* =============================================== 12. COMBAT ARENA ====== */
.arena{position:relative;display:flex;align-items:flex-end;justify-content:space-between;gap:8px;
  min-height:186px;padding:12px 10px 16px;margin-bottom:10px;border:1px solid var(--line);
  border-radius:var(--rad);overflow:hidden;
  background:
    radial-gradient(80% 60% at 50% 118%,rgba(53,208,160,.1),transparent 64%),
    linear-gradient(180deg,#10141d 0%,#0e121a 58%,#171d29 100%)}
.arena::before{content:"";position:absolute;left:0;right:0;bottom:30px;height:1px;
  pointer-events:none;background:linear-gradient(90deg,transparent,var(--line2),transparent)}
.arena::after{content:"";position:absolute;left:-10%;right:-10%;bottom:0;height:46px;
  pointer-events:none;
  background:radial-gradient(50% 100% at 50% 100%,rgba(230,235,242,.06),transparent 72%)}
.side{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;
  justify-content:flex-end;gap:8px;min-width:0;flex:0 1 auto}
/* first .side = ally on the left, last .side = up to 3 foes stacked on the right */
.arena > .side:first-child{align-items:flex-start;width:34%;max-width:130px}
.arena > .side:last-child{align-items:flex-end;width:60%;max-width:220px}
.unit{position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;width:100%;
  max-width:108px;min-width:0;padding:2px;transition:opacity .25s ease}
.unit > .lbl{max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  font-size:9.5px;letter-spacing:.3px}
.unit-emoji{font-size:34px;line-height:1;text-align:center;user-select:none;-webkit-user-select:none;
  filter:drop-shadow(0 4px 6px rgba(0,0,0,.6))}
.unit-bars{display:flex;flex-direction:column;gap:3px;width:100%;min-width:0}
.unit-bars > .bar{height:6px;border-radius:4px}
.unit.dead{opacity:.28;filter:grayscale(1)}
.unit.dead > .unit-emoji{transform:rotate(90deg)}
.unit.act > .unit-emoji{animation:everLungeR .36s ease-out}
.arena > .side:last-child .unit.act > .unit-emoji{animation-name:everLungeL}
.arena.shake{animation:everShake .34s ease-in-out}
.dmg{position:absolute;left:50%;top:6px;z-index:8;transform:translate(-50%,0);
  font-family:var(--sans);font-size:15px;font-weight:800;color:#fff;white-space:nowrap;
  text-shadow:0 1px 3px rgba(0,0,0,.9);pointer-events:none;animation:everDmg .95s ease-out forwards}
.dmg.crit{font-size:20px;color:var(--gold);
  text-shadow:0 0 10px rgba(232,199,106,.6),0 1px 3px rgba(0,0,0,.9)}
.dmg.heal{color:var(--green)}
.dmg.miss{color:var(--mut);font-size:13px;font-weight:700;font-style:italic}
.blog{max-height:132px;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:8px 10px;
  border:1px solid var(--line);border-radius:var(--rad-sm);background:var(--well);font-size:12px;
  line-height:1.5;min-width:0}
.blog p{padding:2px 0 2px 8px;border-left:2px solid var(--line2);color:var(--mut);
  overflow-wrap:anywhere}
.blog p + p{margin-top:2px}
.blog p:last-child{color:var(--txt)}
.blog p.good{border-left-color:var(--green);color:var(--green)}
.blog p.bad{border-left-color:var(--red);color:var(--red)}
.blog p.gold{border-left-color:var(--gold);color:var(--gold)}
.blog p.jade{border-left-color:var(--jade);color:var(--jade)}
.blog::-webkit-scrollbar{width:4px}
.blog::-webkit-scrollbar-thumb{background:#2a3243;border-radius:2px}
/* three foes on the right still fit inside 360px */
.arena > .side:last-child .unit{max-width:96px}
/* an arena rendered inside a full-screen sheet gets more room */
.sheet .arena{min-height:216px;margin-bottom:8px}
.sheet .blog{max-height:150px}

/* =================================================== 13. OVERLAYS ====== */
/* deliberately NO backdrop-filter anywhere: it is very slow on mobile */
.modal-wrap,.sheet-wrap{position:fixed;left:0;right:0;top:0;bottom:0;z-index:70;display:flex;
  justify-content:center;background:var(--scrim);animation:everFade .16s ease-out both}
.modal-wrap{align-items:center;padding:16px}
.sheet-wrap{align-items:flex-end;padding:0}
.modal{position:relative;width:100%;max-width:420px;max-height:84vh;display:flex;
  flex-direction:column;overflow:hidden;border:1px solid var(--line2);border-radius:var(--rad-lg);
  background:linear-gradient(180deg,#181e29,#131822);box-shadow:0 18px 50px rgba(0,0,0,.65);
  animation:everModalIn .19s cubic-bezier(.2,.9,.3,1.15) both}
.modal.wide{max-width:460px}
.modal > .h1,.modal > .h2{flex:0 0 auto;padding:14px 16px 10px;border-bottom:1px solid var(--line);
  background:linear-gradient(180deg,rgba(232,199,106,.06),transparent)}
.modal > .scroll{flex:1 1 auto;padding:14px 16px;overflow-y:auto;-webkit-overflow-scrolling:touch}
.modal > .row{flex:0 0 auto;gap:8px;padding:10px 12px calc(10px + var(--safe));
  border-top:1px solid var(--line);background:rgba(11,14,20,.5)}
.modal > .row > .btn{flex:1 1 0;min-width:0}
.sheet{position:relative;width:100%;max-width:480px;max-height:88vh;display:flex;
  flex-direction:column;overflow:hidden;border:1px solid var(--line2);border-bottom:0;
  border-radius:var(--rad-lg) var(--rad-lg) 0 0;padding-bottom:var(--safe);
  background:linear-gradient(180deg,#181e29,#12161f);box-shadow:0 -14px 44px rgba(0,0,0,.6);
  animation:everSheetIn .22s cubic-bezier(.2,.9,.3,1) both}
.sheet::before{content:"";position:absolute;left:50%;top:7px;width:38px;height:4px;margin-left:-19px;
  border-radius:3px;background:var(--line2)}
.sheet > .h1,.sheet > .h2{flex:0 0 auto;padding:18px 16px 10px;border-bottom:1px solid var(--line)}
.sheet > .scroll{flex:1 1 auto;padding:14px 14px 16px;overflow-y:auto;-webkit-overflow-scrolling:touch}
.sheet > .row{flex:0 0 auto;gap:8px;padding:10px 12px;border-top:1px solid var(--line);
  background:rgba(11,14,20,.5)}
.sheet > .row > .btn{flex:1 1 0;min-width:0}
.toast-wrap{position:fixed;left:0;right:0;bottom:calc(var(--nav-h) + 14px + var(--safe));z-index:80;
  display:flex;flex-direction:column;align-items:center;gap:6px;padding:0 14px;pointer-events:none}
.toast{max-width:452px;width:auto;padding:10px 14px;border:1px solid var(--line2);
  border-left:3px solid var(--mut);border-radius:10px;
  background:linear-gradient(180deg,#1d2434,#171c27);color:var(--txt);font-size:13px;
  font-weight:600;line-height:1.4;text-align:center;box-shadow:0 8px 22px rgba(0,0,0,.55);
  pointer-events:auto;overflow-wrap:anywhere;
  animation:everToastIn .24s cubic-bezier(.2,.9,.3,1.1) both}
.toast.good{border-left-color:var(--green);color:#dff7e4}
.toast.bad{border-left-color:var(--red);color:#ffe2e2}
.toast.gold{border-left-color:var(--gold);color:#fff3d8}
.flash{position:fixed;left:0;right:0;top:0;bottom:0;z-index:90;opacity:0;pointer-events:none;
  background:radial-gradient(circle at 50% 46%,rgba(230,235,242,.5),transparent 68%);
  animation:everFlash .55s ease-out forwards}
.flash.gold{background:radial-gradient(circle at 50% 46%,rgba(232,199,106,.55),transparent 70%)}
.flash.jade{background:radial-gradient(circle at 50% 46%,rgba(53,208,160,.5),transparent 70%)}
.flash.red{background:radial-gradient(circle at 50% 46%,rgba(224,90,90,.5),transparent 70%)}
.float{position:fixed;z-index:95;transform:translate(-50%,0);font-family:var(--sans);font-size:14px;
  font-weight:800;color:var(--jade);text-shadow:0 1px 4px rgba(0,0,0,.9);white-space:nowrap;
  pointer-events:none;animation:everFloatUp 1.05s ease-out forwards}
.float.gold{color:var(--gold)}
.float.bad{color:var(--red)}
.float.good{color:var(--green)}

/* ============================ 14. KEYFRAMES (transform + opacity only) == */
@keyframes everPanelIn{
  from{opacity:0;transform:translateY(6px)}
  to{opacity:1;transform:translateY(0)}}
@keyframes everAura{
  0%{transform:translate(-50%,-50%) scale(.94);opacity:.35}
  50%{transform:translate(-50%,-50%) scale(1.06);opacity:.9}
  100%{transform:translate(-50%,-50%) scale(.94);opacity:.35}}
@keyframes everFloatIdle{
  0%{transform:translateY(0)}
  50%{transform:translateY(-5px)}
  100%{transform:translateY(0)}}
@keyframes everMote{
  0%{transform:translateY(0) scale(.6);opacity:0}
  12%{opacity:.9}
  70%{opacity:.7}
  100%{transform:translateY(-150px) scale(1);opacity:0}}
@keyframes everWisp{
  0%{transform:scale(.86);opacity:.75}
  50%{transform:scale(1.06);opacity:1}
  100%{transform:scale(.86);opacity:.75}}
@keyframes everBtnGlow{
  0%{transform:scale(.99);opacity:.22}
  50%{transform:scale(1.02);opacity:.75}
  100%{transform:scale(.99);opacity:.22}}
@keyframes everToastIn{
  from{opacity:0;transform:translateY(14px) scale(.97)}
  to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes everFade{
  from{opacity:0}
  to{opacity:1}}
@keyframes everModalIn{
  from{opacity:0;transform:translateY(10px) scale(.95)}
  to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes everSheetIn{
  from{transform:translateY(100%)}
  to{transform:translateY(0)}}
@keyframes everFlash{
  0%{opacity:0}
  22%{opacity:.85}
  100%{opacity:0}}
@keyframes everShake{
  0%{transform:translateX(0)}
  18%{transform:translateX(-6px)}
  36%{transform:translateX(5px)}
  54%{transform:translateX(-4px)}
  72%{transform:translateX(3px)}
  100%{transform:translateX(0)}}
@keyframes everLungeR{
  0%{transform:translateX(0) scale(1)}
  35%{transform:translateX(12px) scale(1.12)}
  100%{transform:translateX(0) scale(1)}}
@keyframes everLungeL{
  0%{transform:translateX(0) scale(1)}
  35%{transform:translateX(-12px) scale(1.12)}
  100%{transform:translateX(0) scale(1)}}
@keyframes everDmg{
  0%{transform:translate(-50%,0) scale(.8);opacity:0}
  16%{transform:translate(-50%,-8px) scale(1.12);opacity:1}
  100%{transform:translate(-50%,-42px) scale(1);opacity:0}}
@keyframes everFloatUp{
  0%{transform:translate(-50%,0) scale(.9);opacity:0}
  15%{transform:translate(-50%,-6px) scale(1.08);opacity:1}
  100%{transform:translate(-50%,-46px) scale(1);opacity:0}}

/* ========== 15. REDUCED EFFECTS: one rule, kills every keyframe ========= */
#app.reduce-fx *,#app.reduce-fx *::before,#app.reduce-fx *::after,
body.reduce-fx *,body.reduce-fx *::before,body.reduce-fx *::after{
  animation:none !important;transition:none !important}
@media (prefers-reduced-motion:reduce){
  *{animation-duration:.001s !important;animation-iteration-count:1 !important}}

/* ================================================= 16. RESPONSIVE ====== */
@media (max-width:379px){
  body{font-size:13.5px}
  :root{--pad:10px;--gap:7px}
  .nav-btn{font-size:9.5px}
  .nav-btn > span{font-size:18px}
  .nav-btn .badge{right:calc(50% - 19px)}
  .grid4{gap:5px}
  .grid3{gap:6px}
  .hero{min-height:196px}
  .aura.a3{width:176px;height:176px}
  .ring{width:116px;height:116px}
  .figure{width:76px;height:76px;font-size:38px}
  .unit-emoji{font-size:30px}
  .btn{padding:0 11px;font-size:13px}
  .h1{font-size:19px}}
@media (min-width:521px){
  body{background:radial-gradient(60% 50% at 50% 0%,#10141c,transparent 70%),#06080b}
  #app{box-shadow:0 0 0 1px var(--line),0 24px 70px rgba(0,0,0,.7)}
  .nav{border-left:1px solid var(--line);border-right:1px solid var(--line)}}
@media (min-height:720px){
  .blog{max-height:168px}
  .arena{min-height:210px}}
/* short viewports (landscape phones): shrink the tall decorative blocks */
@media (max-height:560px){
  .hero{min-height:150px}
  .aura.a2{width:132px;height:132px}
  .aura.a3{width:164px;height:164px}
  .figure{width:66px;height:66px;font-size:34px}
  .arena{min-height:150px}
  .blog{max-height:96px}
  .modal{max-height:92vh}
  .sheet{max-height:94vh}}
`;

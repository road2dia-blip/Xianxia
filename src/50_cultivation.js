/* ---------------------------------------------------------------------------
 * Cultivation / Respira — the spine of EVERDAO. Owns the `cultivate` panel:
 * the hero screen, minor phases, breakthrough (chance roll / tribulation /
 * era gauntlet), Eternal Layers, and the Respira wisp economy.
 *
 * FORMULAS IMPLEMENTED HERE
 * ------------------------------------------------------------------------
 *   auraPerSec(r)      = CONFIG.cultivation.aura.base
 *                        * CONFIG.cultivation.aura.growth ^ r
 *                        * (1 + Stats.bonus('aura'))
 *
 *   phaseReq(r,p)      = CONFIG.cultivation.req.base
 *                        * req.realmG ^ r
 *                        * req.phaseG ^ p
 *                        * req.realmMult[r]
 *                        * (r == maxRealm ? eternalReqGrowth ^ eternalLayer : 1)
 *
 *   addExp(n)          exp += n; while exp >= phaseReq(realm,phase):
 *                        phase < 9            -> exp -= req; phase++      ('phaseUp')
 *                        phase == 9, r < 11   -> exp = req; STOP          (breakthrough gate)
 *                        phase == 9, r == 11  -> exp -= req; eternalLayer++
 *                                                (req then grows x1.25)
 *
 *   etaToNextPhase     = (phaseReq(r,p) - exp) / auraPerSec()
 *   ringFill           = exp / phaseReq(r,p)                    -> .ring --p
 *
 *   offline(sec)       cappedSec = min(sec, (offline.baseCapH
 *                                      + Stats.bonus('offlineHours')) * 3600)
 *                      grant = auraPerSec() * cappedSec         (as EXP)
 *
 *   canBreak()         phase == 9 && exp >= phaseReq(r,9)
 *                      && r < maxRealm && injurySec() == 0
 *
 *   injurySec()        = max(0, S.bt.injuryUntil - now) / 1000
 *
 *   -- BREAKTHROUGH, realms 0..CONFIG.breakthrough.chanceRealmMax (chance roll)
 *   chance             = baseChance
 *                        + perPill * min(pillsLoaded, maxPills)
 *                        + min(insightPerFail * failures[r], insightCap)
 *                        + Stats.bonus('btChance')                (clamped .05..0.99)
 *                      Pills are consumed win OR lose. A Yellow-quality
 *                      Breakthrough Pill among the loaded set cancels the Dao
 *                      Injury on failure.
 *
 *   -- BREAKTHROUGH, realms chanceRealmMax+1 .. (Heart Demon tribulation)
 *   targetBR           = CONFIG.breakthrough.benchmarkBR[r]
 *                        * CONFIG.breakthrough.tribulationBRMult
 *                        * stageMult                (1.0 / 1.15 / 1.35 in a gauntlet)
 *   foePower           solved by bisection so |Stats.br(foe)/targetBR - 1| < 0.02
 *   playerBuff         = 1 + tribPillStatBonus * pillsLoaded
 *                          + min(insightPerFail * failures[r], insightCap)
 *
 *   -- ERA ASCENSION at CONFIG.breakthrough.eraAscensionRealms ([5,9])
 *   3 fights at stageMult 1.0 / 1.15 / 1.35 with a Shifu beat before each
 *   (DATA.dialogue.shifu.era1_a/b/c, era2_a/b/c). Any loss ends the run with a
 *   Dao Injury; the gauntlet restarts from fight 1. Clearing the FIRST era
 *   ascension opens the permanent Law choice.
 *
 *   -- ETERNAL LAYERS (realm 11)
 *   statBonus          = ETERNAL_STAT_PER_LAYER (0.02) * eternalLayer,
 *                        contributed as Stats.bonus('allStat')
 *
 *   -- RESPIRA
 *   cap                = CONFIG.respira.baseCap
 *                        + capPerUpgrade * min(S.respira.capUp, maxCapUpgrades)
 *   charges            +1 per CONFIG.respira.chargeSec of REAL time (offline too)
 *   respiraExp         = auraPerSec() * 60 * expMinutes
 *                        * (1 + Stats.bonus('respiraExp')
 *                             + CONFIG.respira.levelBonus * S.respira.level)
 *   techPoints         = U.rint(techPointsMin, techPointsMax)
 *   surge              = (sinceSurge >= surgePity) || chance(surgeChance)
 *                        -> exp *= surgeMult, tech *= surgeTechPointsMult,
 *                           +1 Insight Shard, UI.flash('gold')
 *   levelCost(l)       = ceil(levelCostBase * levelCostGrowth ^ l)  [Insight Shards]
 *   wisps              spawn every U.rand(wispMinSec, wispMaxSec) of VISIBLE
 *                      panel time, live wispLifeSec, and trigger a respira
 *                      without spending a banked charge.
 * ------------------------------------------------------------------------ */

const Cultivation = {

  /* ------------------------------------------------------------ constants */
  QUALS: ['gray', 'green', 'blue', 'purple', 'yellow'],
  PATH_EMOJI: { body: '\u{1F9D8}', spell: '\u{1F9D9}', sword: '\u{1F977}', ghost: '\u{1F47B}' },
  ETERNAL_STAT_PER_LAYER: 0.02,

  /* Heart Demon name templates. Picked by realm so the same wall always wears
     the same face — the player learns to hate it by name. */
  DEMON_NAMES: [
    'The {n} Who Turned Back',
    'Every Doubt of {n}',
    '{n}, Rehearsed in the Dark',
    'The {n} Left at the Foot of the Mountain',
    'What {n} Was Before the Vow',
    'The Small Voice That Answers to {n}',
    '{n}, Unforgiven',
    'The Half-Finished {n}',
    'All That {n} Refused to Bury',
    '{n} at the Hour of Giving Up',
  ],

  /* --------------------------------------------------------------- state */
  _dom: null,          // built-once panel references
  _btUi: null,         // live breakthrough sheet refs
  _gauntlet: null,     // {realm, step, era, aborted}
  _powCache: null,     // { key: solvedPower }
  _moteAcc: 0,         // EXP accumulated since the last floating mote
  _moteT: 0,           // seconds since the last floating mote
  _wasInjured: false,
  _offGuard: 0,
  _quiet: 0,           // >0 suppresses toasts/flashes (offline, sim)

  /* ============================================================== LIFECYCLE */

  init() {
    this._powCache = {};
    this._ensure();

    // Eternal Layers are the only permanent stat contribution this module owns.
    try {
      if (typeof Stats !== 'undefined' && typeof Stats.provider === 'function') {
        Stats.provider((acc) => {
          if (!S || !S.player) return;
          const layers = Math.max(0, Math.floor(S.player.eternalLayer || 0));
          if (layers > 0) acc.allStat = (acc.allStat || 0) + layers * Cultivation.ETERNAL_STAT_PER_LAYER;
        });
      }
    } catch (e) { console.warn('[Cultivation] stats provider failed', e); }

    // Offline accrual. Some builds collect module .offline() automatically;
    // registering here as well is safe because _offGuard dedupes a double call
    // inside the same Offline.apply pass.
    try {
      if (typeof Offline !== 'undefined' && typeof Offline.provider === 'function') {
        Offline.provider((sec, capped) => Cultivation.offline(sec, capped));
      }
    } catch (e) { console.warn('[Cultivation] offline provider failed', e); }

    try {
      if (typeof UI !== 'undefined' && typeof UI.register === 'function') {
        UI.register('cultivate', () => Cultivation.render());
      }
    } catch (e) { console.warn('[Cultivation] UI.register failed', e); }

    // A realm change from anywhere (dev panel, samsara) invalidates the ring.
    try {
      Bus.on('breakthrough', () => { Cultivation._powCache = {}; });
      Bus.on('samsara', () => { Cultivation._powCache = {}; Cultivation._dom = null; });
    } catch (e) { /* Bus is required; ignore */ }
  },

  /* Fill the gaps an old save may have. Cheap; safe to call every tick. */
  _ensure() {
    if (!S || !S.player) return false;
    const p = S.player;
    if (typeof p.realm !== 'number' || !isFinite(p.realm)) p.realm = 0;
    if (typeof p.phase !== 'number' || !isFinite(p.phase)) p.phase = 1;
    if (typeof p.exp !== 'number' || !isFinite(p.exp)) p.exp = 0;
    if (typeof p.eternalLayer !== 'number' || !isFinite(p.eternalLayer)) p.eternalLayer = 0;
    p.realm = U.clamp(Math.floor(p.realm), 0, CONFIG.cultivation.maxRealm);
    p.phase = U.clamp(Math.floor(p.phase), 1, CONFIG.cultivation.phasesPerRealm);

    if (!S.bt || typeof S.bt !== 'object') S.bt = { failures: {}, injuryUntil: 0, loaded: [] };
    if (!S.bt.failures || typeof S.bt.failures !== 'object') S.bt.failures = {};
    if (typeof S.bt.injuryUntil !== 'number' || !isFinite(S.bt.injuryUntil)) S.bt.injuryUntil = 0;
    if (!Array.isArray(S.bt.loaded)) S.bt.loaded = [];

    if (!S.respira || typeof S.respira !== 'object') {
      S.respira = { charges: 0, chargeMs: 0, sinceSurge: 0, level: 0, capUp: 0 };
    }
    const R = S.respira;
    if (typeof R.charges !== 'number' || !isFinite(R.charges)) R.charges = 0;
    if (typeof R.chargeMs !== 'number' || !isFinite(R.chargeMs)) R.chargeMs = 0;
    if (typeof R.sinceSurge !== 'number' || !isFinite(R.sinceSurge)) R.sinceSurge = 0;
    if (typeof R.level !== 'number' || !isFinite(R.level)) R.level = 0;
    if (typeof R.capUp !== 'number' || !isFinite(R.capUp)) R.capUp = 0;

    if (!S.daily || typeof S.daily !== 'object') S.daily = {};
    if (typeof S.daily.respiraCount !== 'number') S.daily.respiraCount = 0;
    if (typeof S.daily.pillAttemptsUsed !== 'number') S.daily.pillAttemptsUsed = 0;
    if (!S.stats || typeof S.stats !== 'object') S.stats = {};
    if (typeof S.stats.respiras !== 'number') S.stats.respiras = 0;
    if (typeof S.stats.breakthroughs !== 'number') S.stats.breakthroughs = 0;
    if (!S.flags || typeof S.flags !== 'object') S.flags = {};
    return true;
  },

  /* ==================================================== PUBLIC: THE NUMBERS */

  /* EXP per second at the player's current realm, including every aura bonus. */
  auraPerSec() {
    if (!S || !S.player) return 0;
    const C = CONFIG.cultivation.aura;
    const r = U.clamp(Math.floor(S.player.realm || 0), 0, CONFIG.cultivation.maxRealm);
    let bonus = 0;
    try { bonus = Number(Stats.bonus('aura')) || 0; } catch (e) { bonus = 0; }
    const v = C.base * Math.pow(C.growth, r) * (1 + bonus);
    return isFinite(v) && v > 0 ? v : 0;
  },

  /* EXP required to clear minor phase p of realm r. At the Eternal realm the
     requirement additionally multiplies by eternalReqGrowth per layer held. */
  phaseReq(r, p) {
    const C = CONFIG.cultivation;
    const rr = U.clamp(Math.floor(Number(r) || 0), 0, C.maxRealm);
    const pp = U.clamp(Math.floor(Number(p) || 1), 1, C.phasesPerRealm);
    const table = C.req.realmMult || [];
    const mult = (typeof table[rr] === 'number') ? table[rr] : (table[table.length - 1] || 1);
    let req = C.req.base * Math.pow(C.req.realmG, rr) * Math.pow(C.req.phaseG, pp) * mult;
    if (rr >= C.maxRealm && S && S.player) {
      const layers = Math.max(0, Math.floor(S.player.eternalLayer || 0));
      if (layers > 0) req *= Math.pow(C.eternalReqGrowth, layers);
    }
    return (isFinite(req) && req > 0) ? req : 1;
  },

  /* Seconds of Dao Injury remaining (0 when healthy). */
  injurySec() {
    if (!S || !S.bt) return 0;
    const left = (Number(S.bt.injuryUntil) || 0) - Date.now();
    return left > 0 ? left / 1000 : 0;
  },

  /* THE ONLY public way to grant cultivation EXP.
     Auto-advances minor phases, carrying the remainder. Stops dead at phase 9
     of a non-Eternal realm so the Breakthrough button owns the next step. */
  addExp(n, src) {
    let amt = Number(n);
    if (!isFinite(amt) || amt <= 0) return 0;
    if (!this._ensure()) return 0;

    const quiet = (src === 'offline' || src === 'sim' || this._quiet > 0);
    const C = CONFIG.cultivation;
    const p = S.player;
    p.exp = (Number(p.exp) || 0) + amt;

    let ups = 0;
    let layers = 0;
    let guard = 0;
    while (guard++ < 600) {
      const r = p.realm | 0;
      const ph = p.phase | 0;
      const req = this.phaseReq(r, ph);
      if (!(p.exp >= req)) break;

      if (ph >= C.phasesPerRealm) {
        if (r >= C.maxRealm) {
          // ETERNAL REALM: filling phase 9 buys another Eternal Layer instead.
          p.exp -= req;
          p.eternalLayer = (Math.floor(p.eternalLayer) || 0) + 1;
          layers++;
          Bus.emit('phaseUp', { realm: r, phase: C.phasesPerRealm });
          continue;
        }
        // Gate: bank exactly one full phase-9 bar and wait for the player.
        p.exp = req;
        break;
      }

      p.exp -= req;
      p.phase = ph + 1;
      ups++;
      Bus.emit('phaseUp', { realm: r, phase: p.phase });
      if (!quiet && ups <= 3) {
        UI.toast(this.realmName(r) + ' · ' + this.phaseLabel(p.phase), 'good');
      }
    }

    if (ups > 0 || layers > 0) {
      try { if (typeof Stats.invalidate === 'function') Stats.invalidate(); } catch (e) { /* ignore */ }
      try { Stats.recompute(); } catch (e) { /* ignore */ }
      if (!quiet) {
        if (ups > 3) UI.toast('Advanced ' + ups + ' phases — ' + this.realmName(p.realm) + ' · ' + this.phaseLabel(p.phase), 'good');
        if (layers > 0) {
          UI.toast('Eternal Layer ' + Fmt.n(p.eternalLayer) + ' attained.', 'gold');
          UI.flash('gold');
        } else if (!(S.settings && S.settings.reduceFx)) {
          UI.flash('jade');
        }
        UI.dirty('cultivate');
        try { UI.refreshBadges && UI.refreshBadges(); } catch (e) { /* ignore */ }
      }
    }

    this._moteAcc += amt;
    return amt;
  },

  /* True when the Breakthrough button should be live. */
  canBreak() {
    if (!S || !S.player || !S.bt) return false;
    const C = CONFIG.cultivation;
    const r = S.player.realm | 0;
    if (r >= C.maxRealm) return false;
    if ((S.player.phase | 0) < C.phasesPerRealm) return false;
    if ((Number(S.player.exp) || 0) < this.phaseReq(r, C.phasesPerRealm)) return false;
    if (this.injurySec() > 0) return false;
    return true;
  },

  /* Display helpers, also used by the breakthrough sheets. */
  realmName(r) {
    const row = (DATA.realms || [])[U.clamp(Math.floor(r || 0), 0, 11)];
    return (row && row.name) ? row.name : 'Unknown';
  },
  realmEra(r) {
    const row = (DATA.realms || [])[U.clamp(Math.floor(r || 0), 0, 11)];
    return (row && row.era) ? row.era + ' Era' : '';
  },
  /* Never let a BR read throw a whole sheet away. */
  _brOf(block) {
    try { return Number(Stats.br(block)) || 0; } catch (e) { return 0; }
  },
  /* Pill qualities are Gray/Green/Blue/Purple/Yellow; the stylesheet's top
     rarity tint is .r-gold, so Yellow borrows it. */
  _qualCls(q) {
    return q === 'yellow' ? 'r-gold' : ('r-' + (this.QUALS.indexOf(q) >= 0 ? q : 'gray'));
  },
  /* 'Early III' / 'Middle V' / 'Late IX' */
  phaseLabel(phase) {
    const p = U.clamp(Math.floor(phase || 1), 1, CONFIG.cultivation.phasesPerRealm);
    const grp = p <= 3 ? 'Early' : (p <= 6 ? 'Middle' : 'Late');
    return grp + ' ' + uRomanize(p);
  },
  /* The full chip line: 'Foundation · Middle V' or 'Eternal · Layer 12'. */
  realmChipText() {
    if (!S || !S.player) return '—';
    const r = S.player.realm | 0;
    if (r >= CONFIG.cultivation.maxRealm && (S.player.eternalLayer | 0) > 0) {
      return 'Eternal · Layer ' + Fmt.n(S.player.eternalLayer);
    }
    return this.realmName(r) + ' · ' + this.phaseLabel(S.player.phase);
  },

  /* ========================================================= TICK / OFFLINE */

  tick(dtSec, nowMs) {
    if (!S || !S.created) return;
    if (!this._ensure()) return;
    let dt = Number(dtSec);
    if (!(dt > 0)) return;
    if (dt > 3600) dt = 3600;           // time-warp guard; addExp is closed-form
    const now = Number(nowMs) || Date.now();

    this.addExp(this.auraPerSec() * dt, 'idle');

    // Dao Injury is stored as an absolute epoch; we only watch for the flip.
    const injured = this.injurySec() > 0;
    if (injured !== this._wasInjured) {
      this._wasInjured = injured;
      if (!injured) UI.toast('Your meridians have settled. You may try again.', 'good');
      UI.dirty('cultivate');
      try { UI.refreshBadges && UI.refreshBadges(); } catch (e) { /* ignore */ }
    }

    // Floating +EXP motes, only while the panel is actually on screen.
    this._moteT += dt;
    if (this._moteT >= 1.2) {
      this._moteT = 0;
      const gained = this._moteAcc;
      this._moteAcc = 0;
      if (gained > 0 && this._visible() && !(S.settings && S.settings.reduceFx) && this._dom) {
        try { UI.float(this._dom.fig, '+' + Fmt.n(gained), ''); } catch (e) { /* ignore */ }
      }
    }
  },

  /* Idle EXP accrued while the tab was closed, capped by the offline window. */
  offline(elapsedSec, cappedSec) {
    const now = Date.now();
    if (now - this._offGuard < 500) return [];   // dedupe provider + method
    this._offGuard = now;
    if (!this._ensure()) return [];

    let sec = Number(elapsedSec);
    if (!isFinite(sec) || sec <= 0) return [];

    let capH = CONFIG.offline.baseCapH;
    try { capH += Number(Stats.bonus('offlineHours')) || 0; } catch (e) { /* ignore */ }
    let capped = Math.min(sec, Math.max(0, capH) * 3600);
    if (typeof cappedSec === 'number' && isFinite(cappedSec) && cappedSec >= 0) {
      capped = Math.min(capped, cappedSec);
    }
    if (capped <= 0) return [];

    const gain = this.auraPerSec() * capped;
    if (gain <= 0) return [];
    this._quiet++;
    try { this.addExp(gain, 'offline'); } finally { this._quiet--; }

    return Cultivation._offLine('Cultivation', '\u{1F9D8}', '+' + Fmt.n(gain) + ' EXP');
  },

  /* An offline result that reads correctly whether the host concatenates the
     returned array or treats the whole return value as one summary line. */
  _offLine(label, icon, amount) {
    const line = { label, icon, amount };
    const arr = [line];
    arr.label = label;
    arr.icon = icon;
    arr.amount = amount;
    return arr;
  },

  /* Red dot: a breakthrough is waiting, or Respira charges are overflowing. */
  badges() {
    if (!S || !S.created) return 0;
    let n = 0;
    if (this.canBreak()) n += 1;
    try {
      if (S.respira && S.respira.charges >= Respira.cap()) n += 1;
    } catch (e) { /* ignore */ }
    return n;
  },

  /* ============================================================ PANEL: BUILD */

  _visible() {
    try {
      const p = UI.panel('cultivate');
      return !!(p && p.classList.contains('active')) && !document.hidden;
    } catch (e) { return false; }
  },

  render() {
    if (UI.lock('cultivate', CONFIG.unlocks.cultivate)) return;
    if (!this._ensure()) return;
    const panel = UI.panel('cultivate');
    if (!panel) return;

    if (!this._dom || !this._dom.root || !this._dom.root.isConnected || this._dom.root.parentNode !== panel) {
      this._build(panel);
    }
    this._patch();
    try { Respira.patch(); } catch (e) { /* ignore */ }
  },

  _build(panel) {
    let root = UI.qs('.scroll', panel);
    if (!root) { root = UI.el('div', 'scroll'); panel.appendChild(root); }
    root.innerHTML = '';
    /* add(parent, tag, class, text) -> the new child. Build once, patch after. */
    const add = (parent, tag, cls, text) => {
      const e = UI.el(tag, cls, text);
      parent.appendChild(e);
      return e;
    };

    /* --- top line: realm chip + era -------------------------------------- */
    const top = add(root, 'div', 'row between');
    const chip = add(top, 'span', 'chip realm');
    const era = add(top, 'span', 'chip');

    /* --- hero: auras + drifting motes + the meditating figure ------------- */
    const hero = add(root, 'div', 'hero');
    add(hero, 'div', 'aura a1');
    add(hero, 'div', 'aura a2');
    add(hero, 'div', 'aura a3');
    const motePos = [12, 28, 44, 58, 74, 88];
    for (let i = 0; i < motePos.length; i++) add(hero, 'div', 'mote').style.left = motePos[i] + '%';
    const fig = add(hero, 'div', 'figure');

    /* --- ring + readouts -------------------------------------------------- */
    const card = add(root, 'div', 'card');
    const cardRow = add(card, 'div', 'row');
    const ring = add(cardRow, 'div', 'ring');
    const ringIn = add(ring, 'div', 'ring-in');
    add(ringIn, 'div', 'lbl', 'PHASE');
    const ringVal = add(ringIn, 'div', 'val', '1/9');
    const ringPct = add(ringIn, 'div', 'tiny muted', '0%');

    const col = add(cardRow, 'div', 'col');
    col.style.flex = '1 1 auto';
    const auraRow = add(col, 'div', 'row between');
    add(auraRow, 'span', 'lbl', 'AURA');
    const auraVal = add(auraRow, 'span', 'val jade', '0/s');
    const barFill = add(add(col, 'div', 'bar exp'), 'i', '');
    const expRow = add(col, 'div', 'row between');
    const expTxt = add(expRow, 'span', 'tiny muted mono', '0 / 0');
    const etaTxt = add(expRow, 'span', 'tiny muted', '');
    const layerRow = add(col, 'div', 'kv');
    add(layerRow, 'span', 'k', 'Eternal Layers');
    const layerVal = add(layerRow, 'span', 'v gold', '0');
    layerRow.hidden = true;

    /* --- breakthrough ----------------------------------------------------- */
    const bt = add(root, 'button', 'bt-btn');
    bt.type = 'button';
    bt.dataset.act = 'bt';
    const btNote = add(root, 'div', 'tiny muted', '');
    btNote.style.margin = '6px 2px 10px';
    btNote.style.textAlign = 'center';

    /* --- respira (owned by the Respira system, hosted here) --------------- */
    const respiraHost = add(root, 'div', '');

    /* --- pill quick-bar --------------------------------------------------- */
    const pillCard = add(root, 'div', 'card');
    const pillHead = add(pillCard, 'div', 'row between');
    add(pillHead, 'div', 'sec-title', 'Spirit Pills');
    const pillAtt = add(pillHead, 'span', 'tiny muted mono', 'Attempts: 0/0');
    const pillRow = add(pillCard, 'div', 'row wrap');
    const pillEmpty = add(pillCard, 'div', 'empty',
      'No EXP pills refined yet. The alchemy room turns herbs into hours.');

    /* --- flavour ---------------------------------------------------------- */
    const flavourTxt = add(add(root, 'div', 'card tight'), 'div', 'tiny muted serif', '');
    add(root, 'div', 'safe-b');

    if (!root.dataset.cultBound) {
      root.dataset.cultBound = '1';
      root.addEventListener('click', (e) => Cultivation._onClick(e));
    }

    this._dom = {
      root, chip, era, hero, fig, ring, ringVal, ringPct,
      auraVal, barFill, expTxt, etaTxt, layerRow, layerVal,
      bt, btNote, respiraHost, pillRow, pillAtt, pillEmpty, flavourTxt,
      lastPills: '',
    };

    try { Respira.build(respiraHost); } catch (e) { console.warn('[Respira] build failed', e); }
  },

  /* ============================================================ PANEL: PATCH */

  _patch() {
    const d = this._dom;
    if (!d) return;
    const p = S.player;
    const r = p.realm | 0;
    const eternal = r >= CONFIG.cultivation.maxRealm;
    const req = this.phaseReq(r, p.phase);
    const exp = Number(p.exp) || 0;
    const frac = U.clamp(req > 0 ? exp / req : 0, 0, 1);
    const aura = this.auraPerSec();

    d.chip.textContent = this.realmChipText();
    const eraTxt = this.realmEra(r);
    d.era.textContent = eraTxt;
    d.era.hidden = !eraTxt;
    d.fig.textContent = this.PATH_EMOJI[p.path] || this.PATH_EMOJI.body;

    d.ring.style.setProperty('--p', String(frac.toFixed(4)));
    d.ringVal.textContent = eternal && (p.eternalLayer | 0) > 0
      ? Fmt.n(p.eternalLayer)
      : (p.phase + '/' + CONFIG.cultivation.phasesPerRealm);
    d.ringPct.textContent = Fmt.pct(frac, 0);

    d.auraVal.textContent = Fmt.n1(aura) + '/s';
    d.barFill.style.width = (frac * 100).toFixed(2) + '%';
    d.expTxt.textContent = Fmt.n(exp) + ' / ' + Fmt.n(req);

    const capped = (!eternal && p.phase >= CONFIG.cultivation.phasesPerRealm && exp >= req);
    if (capped) {
      d.etaTxt.textContent = 'Bar full';
      d.etaTxt.className = 'tiny gold';
    } else if (aura > 0) {
      d.etaTxt.textContent = '≈ ' + Fmt.dur((req - exp) / aura) + ' to next';
      d.etaTxt.className = 'tiny muted';
    } else {
      d.etaTxt.textContent = '';
      d.etaTxt.className = 'tiny muted';
    }

    if (eternal) {
      d.layerRow.hidden = false;
      d.layerVal.textContent = Fmt.n(p.eternalLayer || 0) +
        '  (+' + Fmt.pct((p.eternalLayer || 0) * this.ETERNAL_STAT_PER_LAYER, 0) + ' all stats)';
    } else {
      d.layerRow.hidden = true;
    }

    /* ---- breakthrough button ------------------------------------------- */
    const inj = this.injurySec();
    if (eternal) {
      d.bt.className = 'bt-btn';
      d.bt.disabled = true;
      d.bt.textContent = 'THE ROAD ENDS HERE';
      d.btNote.textContent = 'Nothing remains above you. Every full bar is one more Eternal Layer.';
    } else if (inj > 0) {
      d.bt.className = 'bt-btn';
      d.bt.disabled = true;
      d.bt.textContent = 'DAO INJURY · ' + Fmt.durShort(inj);
      d.btNote.textContent = 'Torn meridians. Cultivation continues; the heavens simply will not hear you yet.';
    } else if (this.canBreak()) {
      d.bt.className = 'bt-btn btn glow';
      d.bt.disabled = false;
      d.bt.textContent = 'BREAK THROUGH → ' + this.realmName(r + 1).toUpperCase();
      d.btNote.textContent = this._isEraRealm(r)
        ? 'An Era Ascension. Three trials, one after another, no rest between.'
        : (r <= CONFIG.breakthrough.chanceRealmMax
          ? 'A roll of the bones. Load pills to weight it.'
          : 'Your Heart Demon is waiting on the other side.');
    } else {
      d.bt.className = 'bt-btn';
      d.bt.disabled = true;
      d.bt.textContent = 'BREAKTHROUGH SEALED';
      const need = CONFIG.cultivation.phasesPerRealm;
      d.btNote.textContent = 'Fill all ' + need + ' minor phases of ' + this.realmName(r) + ' first.';
    }

    /* ---- pill quick-bar ------------------------------------------------- */
    const pills = this._expPills().slice(0, 5);
    const sig = pills.map((x) => x.key + ':' + x.n).join('|');
    if (sig !== d.lastPills) {
      d.lastPills = sig;
      d.pillRow.innerHTML = '';
      for (const it of pills) {
        const b = UI.el('button', 'pill-chip ' + Cultivation._qualCls(it.q));
        b.type = 'button';
        b.dataset.act = 'pill';
        b.dataset.id = it.key;
        b.title = it.f.name;
        b.appendChild(document.createTextNode(it.f.emoji || '\u{1F9EA}'));
        const cnt = UI.el('b', '', 'x' + it.n);
        b.appendChild(cnt);
        d.pillRow.appendChild(b);
      }
      d.pillEmpty.hidden = pills.length > 0;
      d.pillRow.hidden = pills.length === 0;
    }
    const used = S.daily.pillAttemptsUsed | 0;
    const max = this.pillAttemptsMax();
    d.pillAtt.textContent = 'Attempts: ' + used + '/' + max;
    d.pillAtt.className = used >= max ? 'tiny bad mono' : 'tiny muted mono';

    const row = (DATA.realms || [])[r];
    d.flavourTxt.textContent = (row && row.desc) ? row.desc : '';
  },

  /* Daily EXP-pill budget. Pass / tech / curio bonuses arrive as the flat
     Stats.bonus('pillAttempts') their own modules register. */
  pillAttemptsMax() {
    let bonus = 0;
    try { bonus = Math.floor(Number(Stats.bonus('pillAttempts')) || 0); } catch (e) { bonus = 0; }
    return Math.max(0, CONFIG.alchemy.pillAttemptsBase + bonus);
  },

  /* Owned pills of a formula type, best first (rank desc, then quality desc). */
  _pillsOfType(type) {
    const out = [];
    const inv = (S && S.inv && S.inv.pills) || {};
    const byId = (typeof DATAX !== 'undefined' && DATAX.formulaById) ? DATAX.formulaById : {};
    for (const key in inv) {
      const n = Math.floor(Number(inv[key]) || 0);
      if (n <= 0) continue;
      const cut = key.lastIndexOf('_');
      if (cut <= 0) continue;
      const fid = key.slice(0, cut);
      const q = key.slice(cut + 1);
      const f = byId[fid];
      if (!f || f.type !== type) continue;
      out.push({ key, n, f, q, qi: this.QUALS.indexOf(q) });
    }
    out.sort((a, b) => ((b.f.rank || 0) - (a.f.rank || 0)) || (b.qi - a.qi));
    return out;
  },
  _expPills() { return this._pillsOfType('exp'); },
  _btPills() { return this._pillsOfType('bt'); },

  /* ============================================================ PANEL: INPUT */

  _onClick(e) {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;

    if (act === 'bt') {
      this.openBreakthrough();
      return;
    }
    if (act === 'pill') {
      const key = el.dataset.id;
      if (!key) return;
      let ok = false;
      try {
        ok = (typeof Alchemy !== 'undefined' && typeof Alchemy.usePill === 'function')
          ? Alchemy.usePill(key) : false;
      } catch (err) { console.warn('[Cultivation] usePill failed', err); ok = false; }
      if (!ok && typeof Alchemy === 'undefined') UI.toast('The alchemy room is not built yet.', 'bad');
      if (this._dom) this._dom.lastPills = '';
      UI.dirty('cultivate');
      return;
    }
    if (act === 'respira') { Respira.trigger(false); return; }
    if (act === 'respiraSheet') { Respira.openSheet(); return; }
    if (act === 'wisp') {
      Respira.tapWisp(el);
      return;
    }
  },

  /* ======================================================== BREAKTHROUGH UI */

  _isEraRealm(r) {
    const list = CONFIG.breakthrough.eraAscensionRealms || [];
    return list.indexOf(r) >= 0;
  },
  _failures(r) {
    return Math.max(0, Math.floor((S.bt && S.bt.failures && S.bt.failures[r]) || 0));
  },
  _insightBonus(r) {
    return Math.min(CONFIG.breakthrough.insightPerFail * this._failures(r), CONFIG.breakthrough.insightCap);
  },
  _loadedCount() {
    return Array.isArray(S.bt.loaded) ? S.bt.loaded.length : 0;
  },
  _loadedOf(key) {
    if (!Array.isArray(S.bt.loaded)) return 0;
    let n = 0;
    for (const k of S.bt.loaded) if (k === key) n++;
    return n;
  },
  _btChance(r) {
    const B = CONFIG.breakthrough;
    let bonus = 0;
    try { bonus = Number(Stats.bonus('btChance')) || 0; } catch (e) { bonus = 0; }
    const p = B.baseChance
      + B.perPill * Math.min(this._loadedCount(), B.maxPills)
      + this._insightBonus(r)
      + bonus;
    return U.clamp(p, 0.05, 0.99);
  },

  /* The glowing button's one job. */
  openBreakthrough() {
    if (!this._ensure()) return;
    if (!this.canBreak()) {
      const inj = this.injurySec();
      if (inj > 0) UI.toast('Still injured — ' + Fmt.durShort(inj) + ' remaining.', 'bad');
      else UI.toast('Fill every minor phase first.', 'bad');
      return;
    }
    S.bt.loaded = [];
    const r = S.player.realm | 0;
    if (this._isEraRealm(r)) { this._openEraSheet(r); return; }
    if (r <= CONFIG.breakthrough.chanceRealmMax) { this._openChanceSheet(r); return; }
    this._openTribSheet(r, 1, null);
  },

  /* ---- shared: the loaded-pill editor used by every breakthrough sheet --- */
  _pillEditor(onChange) {
    const wrap = UI.el('div', 'sec');
    const title = UI.el('div', 'sec-title', 'Breakthrough Pills');
    wrap.appendChild(title);

    const list = UI.el('div', 'col');
    wrap.appendChild(list);

    const empty = UI.el('div', 'empty', 'No Breakthrough Pills in your pouch. They are refined from the "bt" formulas in the alchemy room.');
    wrap.appendChild(empty);

    const redraw = () => {
      const pills = this._btPills();
      list.innerHTML = '';
      empty.hidden = pills.length > 0;
      for (const it of pills) {
        const held = this._loadedOf(it.key);
        const free = it.n - held;
        const rowEl = UI.el('div', 'row between');
        const left = UI.el('div', 'row');
        const emo = UI.el('span', 'unit-emoji ' + Cultivation._qualCls(it.q));
        emo.textContent = it.f.emoji || '\u{1F48A}';
        emo.style.fontSize = '22px';
        left.appendChild(emo);
        const namecol = UI.el('div', 'col');
        namecol.appendChild(UI.el('div', 'tiny ' + Cultivation._qualCls(it.q), it.f.name));
        namecol.appendChild(UI.el('div', 'tiny muted', it.q === 'yellow'
          ? 'Yellow — cancels the Dao Injury on failure'
          : (it.q.charAt(0).toUpperCase() + it.q.slice(1) + ' · ' + free + ' spare')));
        left.appendChild(namecol);
        rowEl.appendChild(left);

        const step = UI.el('div', 'stepper');
        const minus = UI.el('button', '', '−');
        minus.type = 'button';
        const cnt = UI.el('b', '', String(held));
        const plus = UI.el('button', '', '+');
        plus.type = 'button';
        step.appendChild(minus);
        step.appendChild(cnt);
        step.appendChild(plus);
        rowEl.appendChild(step);

        minus.addEventListener('click', () => {
          const i = S.bt.loaded.indexOf(it.key);
          if (i >= 0) { S.bt.loaded.splice(i, 1); redraw(); onChange(); }
        });
        plus.addEventListener('click', () => {
          if (this._loadedCount() >= CONFIG.breakthrough.maxPills) {
            UI.toast('Three pills is all a body can hold.', 'bad');
            return;
          }
          if (free <= 0) { UI.toast('None spare.', 'bad'); return; }
          S.bt.loaded.push(it.key);
          redraw(); onChange();
        });
        list.appendChild(rowEl);
      }
    };
    redraw();
    return { el: wrap, redraw };
  },

  /* Consume every loaded pill. Returns {count, hadYellow}. */
  _consumeLoaded() {
    const loaded = Array.isArray(S.bt.loaded) ? S.bt.loaded.slice() : [];
    let hadYellow = false;
    for (const key of loaded) {
      if (key.slice(-7) === '_yellow') hadYellow = true;
      const have = Math.floor(Number(S.inv && S.inv.pills ? S.inv.pills[key] : 0) || 0);
      if (have > 0) {
        S.inv.pills[key] = have - 1;
        if (S.inv.pills[key] <= 0) delete S.inv.pills[key];
      }
    }
    S.bt.loaded = [];
    return { count: loaded.length, hadYellow };
  },

  /* ---------------------------------------------- realms 0-2: a chance roll */
  _openChanceSheet(r) {
    const body = UI.el('div', '');
    const head = UI.el('div', 'col');
    head.appendChild(UI.el('div', 'h2 serif', this.realmName(r) + ' → ' + this.realmName(r + 1)));
    head.appendChild(UI.el('div', 'tiny muted',
      'Your qi is at the brim. Push, and either the wall gives or you do.'));
    body.appendChild(head);

    const big = UI.el('div', 'sec');
    const bigRow = UI.el('div', 'row between');
    bigRow.appendChild(UI.el('span', 'lbl', 'SUCCESS CHANCE'));
    const bigVal = UI.el('span', 'h1 gold', '0%');
    bigRow.appendChild(bigVal);
    big.appendChild(bigRow);
    const meter = UI.el('div', 'meter');
    const meterFill = UI.el('i');
    meter.appendChild(meterFill);
    big.appendChild(meter);
    body.appendChild(big);

    const brk = UI.el('div', 'sec');
    body.appendChild(brk);

    const editor = this._pillEditor(() => refresh());
    body.appendChild(editor.el);

    const warn = UI.el('div', 'tiny bad', '');
    warn.style.marginTop = '8px';
    warn.textContent = 'Loaded pills are consumed whether you succeed or fail.';
    body.appendChild(warn);

    const refresh = () => {
      const B = CONFIG.breakthrough;
      const p = this._btChance(r);
      bigVal.textContent = Fmt.pct(p, 1);
      meterFill.style.width = (p * 100).toFixed(1) + '%';
      let stat = 0;
      try { stat = Number(Stats.bonus('btChance')) || 0; } catch (e) { stat = 0; }
      brk.innerHTML = '';
      const rows = [
        ['Base resolve', Fmt.pct(B.baseChance, 0)],
        ['Pills loaded (' + this._loadedCount() + '/' + B.maxPills + ')',
          Fmt.pct(B.perPill * Math.min(this._loadedCount(), B.maxPills), 0)],
        ['Insight from ' + this._failures(r) + ' failure(s)', Fmt.pct(this._insightBonus(r), 0)],
        ['Techniques & gear', Fmt.pct(stat, 0)],
      ];
      for (const [k, v] of rows) {
        const kv = UI.el('div', 'kv');
        kv.appendChild(UI.el('span', 'k', k));
        kv.appendChild(UI.el('span', 'v', v));
        brk.appendChild(kv);
      }
    };
    refresh();

    UI.sheet({
      title: 'Breakthrough',
      body,
      buttons: [
        { label: 'Not Yet', cls: 'ghost', act: (close) => { S.bt.loaded = []; close(); } },
        { label: 'Push', cls: 'primary', act: (close) => { close(); this._attemptRoll(r); } },
      ],
    });
  },

  _attemptRoll(r) {
    const chance = this._btChance(r);
    const used = this._consumeLoaded();
    const win = U.chance(chance);
    if (win) {
      this.doBreak();
    } else {
      this._failBreak(r, used.hadYellow);
    }
    try { Save.saveNow(); } catch (e) { /* ignore */ }
  },

  /* -------------------------------- realms 3+: the Heart Demon tribulation */

  /* Bisection solver: scale foe power until its BR lands on target. */
  _solvePower(targetBR, make) {
    if (!(targetBR > 0)) return 60;
    let lo = 1;
    let hi = 64;
    let guard = 0;
    while (guard++ < 80) {
      let br = 0;
      try { br = Stats.br(make(hi)); } catch (e) { br = 0; }
      if (br >= targetBR) break;
      lo = hi;
      hi *= 2;
      if (!isFinite(hi) || hi > 1e15) break;
    }
    guard = 0;
    let mid = (lo + hi) / 2;
    while (guard++ < 60) {
      mid = (lo + hi) / 2;
      let br = 0;
      try { br = Stats.br(make(mid)); } catch (e) { br = 0; }
      if (Math.abs(br - targetBR) / targetBR < 0.02) return mid;
      if (br < targetBR) lo = mid; else hi = mid;
    }
    return mid;
  },

  /* The Heart Demon mirrors your path and your Law's element, and wears
     your own name like a borrowed coat. */
  _makeHeartDemon(r, stageMult, stageIdx) {
    if (typeof Combat === 'undefined' || typeof Combat.makeFoe !== 'function') return null;
    const B = CONFIG.breakthrough;
    const bench = (B.benchmarkBR || [])[U.clamp(r, 0, 11)] || 120;
    const target = bench * B.tribulationBRMult * (stageMult || 1);

    const path = (S.player && S.player.path) || 'body';
    const roleByPath = { body: 'bruiser', spell: 'caster', sword: 'swift', ghost: 'caster' };
    const skillByPath = { body: 'heavyBlow', spell: 'curse', sword: 'frenzy', ghost: 'drain' };
    const name = this._demonName(r, stageIdx);
    const emoji = stageIdx === 1 ? '\u{1F328}\u{FE0F}' : (stageIdx === 3 ? '\u{1F441}\u{FE0F}' : '\u{1F464}');

    const base = {
      role: roleByPath[path] || 'bruiser',
      element: (S.player && S.player.law) || null,
      skill: skillByPath[path] || 'heavyBlow',
      name,
      emoji,
    };
    const make = (pow) => {
      const o = { power: pow };
      for (const k in base) o[k] = base[k];
      return Combat.makeFoe(o);
    };

    const ck = r + '|' + (stageMult || 1) + '|' + (stageIdx || 0);
    if (!this._powCache) this._powCache = {};
    let pow = this._powCache[ck];
    if (typeof pow !== 'number' || !isFinite(pow)) {
      pow = this._solvePower(target, make);
      this._powCache[ck] = pow;
    }
    const foe = make(pow);
    foe.name = name;
    foe.emoji = emoji;
    return { foe, target };
  },

  _demonName(r, stageIdx) {
    const who = (S.player && S.player.name) || 'you';
    if (stageIdx === 1) return 'The Sky That Refuses ' + who;
    if (stageIdx === 3) return 'The Eye That Weighs ' + who;
    const tpl = this.DEMON_NAMES[Math.abs(r) % this.DEMON_NAMES.length];
    return tpl.split('{n}').join(who);
  },

  /* The player's tribulation unit: base stats lifted by loaded pills and by
     every insight scar left from previous failures. */
  _tribAlly(r, pillCount) {
    let u = null;
    try { u = U.deepClone(Stats.unit()); } catch (e) { u = null; }
    if (!u) return null;
    const mult = 1
      + CONFIG.breakthrough.tribPillStatBonus * Math.min(pillCount, CONFIG.breakthrough.maxPills)
      + this._insightBonus(r);
    const keys = ['hp', 'maxHp', 'patk', 'matk', 'pdef', 'mdef', 'spd'];
    for (const k of keys) {
      if (typeof u[k] === 'number') u[k] = Math.max(1, Math.round(u[k] * mult));
    }
    if (typeof u.mp === 'number' && typeof u.maxMp === 'number') u.mp = u.maxMp;
    return u;
  },

  _openTribSheet(r, stageMult, gaunt) {
    const built = this._makeHeartDemon(r, stageMult, gaunt ? gaunt.step : 2);
    if (!built) {                       // combat missing: fall back to a roll
      this._openChanceSheet(r);
      return;
    }
    const body = UI.el('div', '');
    body.appendChild(UI.el('div', 'h2 serif', built.foe.name));
    body.appendChild(UI.el('div', 'tiny muted',
      'It knows every excuse you have ever made, because you taught it all of them.'));

    const stats = UI.el('div', 'sec');
    const myBr = this._brOf();
    const foeBr = this._brOf(built.foe);
    const mkKv = (k, v, cls) => {
      const kv = UI.el('div', 'kv');
      kv.appendChild(UI.el('span', 'k', k));
      kv.appendChild(UI.el('span', 'v ' + (cls || ''), v));
      stats.appendChild(kv);
    };
    mkKv('Your Battle Rating', Fmt.n(myBr));
    mkKv('Heart Demon', Fmt.n(foeBr), foeBr > myBr ? 'bad' : 'good');
    if (this._failures(r) > 0) {
      mkKv('Insight from ' + this._failures(r) + ' loss(es)', '+' + Fmt.pct(this._insightBonus(r), 0) + ' stats', 'gold');
    }
    if (gaunt) mkKv('Trial', gaunt.step + ' of ' + CONFIG.breakthrough.gauntletFights, 'gold');
    body.appendChild(stats);

    const buffLine = UI.el('div', 'tiny gold');
    buffLine.style.marginTop = '6px';
    body.appendChild(buffLine);

    const editor = this._pillEditor(() => refresh());
    body.appendChild(editor.el);

    const note = UI.el('div', 'tiny muted');
    note.style.marginTop = '8px';
    note.textContent = 'Here a pill is not luck, it is muscle: each loaded pill adds +'
      + Fmt.pct(CONFIG.breakthrough.tribPillStatBonus, 0)
      + ' to every stat for this fight, and is consumed either way.';
    body.appendChild(note);

    const refresh = () => {
      const n = this._loadedCount();
      buffLine.textContent = n > 0
        ? 'Pill surge: +' + Fmt.pct(CONFIG.breakthrough.tribPillStatBonus * n, 0) + ' to all stats'
        : 'No pills loaded.';
    };
    refresh();

    UI.sheet({
      title: gaunt ? 'Era Ascension' : 'Tribulation',
      body,
      buttons: [
        { label: 'Withdraw', cls: 'ghost', act: (close) => { S.bt.loaded = []; close(); if (gaunt) this._gauntlet = null; } },
        { label: 'Face It', cls: 'primary', act: (close) => { close(); setTimeout(() => this._runTribulation(r, stageMult, gaunt), 60); } },
      ],
    });
  },

  _runTribulation(r, stageMult, gaunt) {
    const built = this._makeHeartDemon(r, stageMult, gaunt ? gaunt.step : 2);
    if (!built) { this._openChanceSheet(r); return; }
    const used = this._consumeLoaded();
    const ally = this._tribAlly(r, used.count);
    if (!ally) { UI.toast('Cannot measure your strength right now.', 'bad'); return; }

    let lawProc = 0;
    try { lawProc = Number(Stats.bonus('lawProc')) || 0; } catch (e) { lawProc = 0; }

    const finish = (result) => {
      if (result && result.win) {
        if (gaunt) this._gauntletAdvance(gaunt);
        else this.doBreak();
      } else {
        if (gaunt) {
          this._gauntlet = null;
          this._failBreak(r, used.hadYellow, 'The gauntlet collapses at trial ' + gaunt.step + '. Begin again from the first.');
        } else {
          this._failBreak(r, used.hadYellow);
        }
      }
      try { Save.saveNow(); } catch (e) { /* ignore */ }
    };

    try {
      Combat.play({
        allies: [ally],
        foes: [built.foe],
        opts: { lawProc, maxRounds: CONFIG.combat.maxRounds },
        title: gaunt
          ? ('Era Ascension · Trial ' + gaunt.step + '/' + CONFIG.breakthrough.gauntletFights)
          : ('Tribulation · ' + this.realmName(r) + ' → ' + this.realmName(r + 1)),
        canSkip: true,
        prePills: false,
        onDone: finish,
      });
    } catch (e) {
      console.warn('[Cultivation] Combat.play failed, resolving headless', e);
      let res = null;
      try { res = Combat.simulate([ally], [built.foe], {}); } catch (e2) { res = { win: false }; }
      finish(res);
    }
  },

  /* ------------------------------------------------- era ascension gauntlet */

  _eraKey(r) {
    const list = CONFIG.breakthrough.eraAscensionRealms || [];
    const i = list.indexOf(r);
    return 'era' + (i >= 0 ? (i + 1) : 1);
  },

  _eraLines(r, letter) {
    const key = this._eraKey(r) + '_' + letter;
    const bank = (DATA.dialogue && DATA.dialogue.shifu) ? DATA.dialogue.shifu : {};
    const lines = bank[key];
    if (Array.isArray(lines) && lines.length) return lines;
    return this._eraFallback(this._eraKey(r), letter);
  },

  /* Used only if the dialogue content file has not landed. Never a stub —
     these are the real words the beat would otherwise say. */
  _eraFallback(era, letter) {
    const A = {
      era1: {
        a: ['Shifu does not stand when you enter. He has been standing since before you woke.',
          '"Three things are waiting. The first is the sky, which has never liked being knocked on."',
          '"Do not be clever with it. Be heavy."'],
        b: ['"Good. It let you through, which means it has decided you are worth the paperwork."',
          '"The second is worse. The second has your face."'],
        c: ['"Whatever it said to you down there — it was quoting."',
          '"The last one does not fight. It measures. Stand still and be more than it expects."'],
      },
      era2: {
        a: ['The old man is thinner than you remember, and he is smiling, which is unusual.',
          '"Nirvana burns off everything that was only habit. What is left had better be load-bearing."',
          '"First: the sky again. It has not forgiven you, and it has been practising."'],
        b: ['"You are past the part where strength is enough."',
          '"Now it sends the version of you that stayed on the mountain. Be kind to it. Then win."'],
        c: ['"One more. It will offer you the ledger and ask what you are worth."',
          '"Do not answer. Answering is how the last ten thousand lost."'],
      },
    };
    const bank = A[era] || A.era1;
    return bank[letter] || bank.a;
  },

  _openEraSheet(r) {
    const body = UI.el('div', '');
    body.appendChild(UI.el('div', 'h2 serif', 'Era Ascension'));
    const nextEra = this.realmEra(r + 1);
    body.appendChild(UI.el('div', 'tiny muted',
      this.realmName(r) + ' → ' + this.realmName(r + 1)
      + (nextEra ? ' crosses into the ' + nextEra + '.' : '.')
      + ' This gate does not open for a lucky roll.'));

    const sec = UI.el('div', 'sec');
    const n = Math.max(1, CONFIG.breakthrough.gauntletFights | 0);
    const mults = this._gauntletMults();
    for (let i = 0; i < n; i++) {
      const built = this._makeHeartDemon(r, mults[i], i + 1);
      const kv = UI.el('div', 'kv');
      kv.appendChild(UI.el('span', 'k', 'Trial ' + (i + 1) + ' · ' + (built ? built.foe.name : 'Heart Demon')));
      kv.appendChild(UI.el('span', 'v', built ? Fmt.n(this._brOf(built.foe)) + ' BR' : '—'));
      sec.appendChild(kv);
    }
    body.appendChild(sec);

    const warn = UI.el('div', 'tiny bad');
    warn.style.marginTop = '8px';
    warn.textContent = 'Three fights back to back. Lose one and the whole gauntlet ends with a Dao Injury — you begin again at the first trial.';
    body.appendChild(warn);

    UI.sheet({
      title: 'Era Ascension',
      body,
      buttons: [
        { label: 'Not Yet', cls: 'ghost', act: (close) => close() },
        { label: 'Begin', cls: 'primary', act: (close) => { close(); setTimeout(() => this._startGauntlet(r), 80); } },
      ],
    });
  },

  _gauntletMults() {
    const n = Math.max(1, CONFIG.breakthrough.gauntletFights | 0);
    const preset = [1.0, 1.15, 1.35];
    const out = [];
    for (let i = 0; i < n; i++) out.push(preset[i] !== undefined ? preset[i] : (1 + 0.2 * i));
    return out;
  },

  _startGauntlet(r) {
    this._gauntlet = { realm: r, step: 1, era: this._eraKey(r) };
    this._gauntletBeat(r, 'a', () => {
      this._openTribSheet(r, this._gauntletMults()[0], this._gauntlet);
    });
  },

  _gauntletAdvance(gaunt) {
    if (!this._gauntlet || this._gauntlet !== gaunt) return;
    const n = CONFIG.breakthrough.gauntletFights | 0;
    if (gaunt.step >= n) {
      this._gauntlet = null;
      const wasFirstEra = (CONFIG.breakthrough.eraAscensionRealms || []).indexOf(gaunt.realm) === 0;
      this.doBreak();
      if (wasFirstEra) setTimeout(() => this.openLawChoice(), 900);
      return;
    }
    gaunt.step += 1;
    const letter = gaunt.step === 2 ? 'b' : 'c';
    const mult = this._gauntletMults()[gaunt.step - 1];
    UI.toast('Trial ' + (gaunt.step - 1) + ' endured.', 'gold');
    setTimeout(() => {
      this._gauntletBeat(gaunt.realm, letter, () => {
        this._openTribSheet(gaunt.realm, mult, gaunt);
      });
    }, 420);
  },

  /* A Shifu beat rendered inline so it can chain into the next fight. */
  _gauntletBeat(r, letter, next) {
    const lines = this._eraLines(r, letter);
    const body = UI.el('div', 'col');
    for (const line of lines) {
      const p = UI.el('div', 'tiny serif');
      p.textContent = line;
      body.appendChild(p);
    }
    let advanced = false;
    UI.modal({
      title: 'Shifu',
      body,
      buttons: [{
        label: 'Continue', cls: 'primary', act: (close) => {
          advanced = true;
          close();
          setTimeout(next, 60);
        },
      }],
      onClose: () => {
        if (!advanced) {
          Cultivation._gauntlet = null;
          UI.toast('You step back from the gate.', 'info');
        }
      },
    });
  },

  /* =============================================== BREAKTHROUGH: RESOLUTION */

  _failBreak(r, hadYellow, extraMsg) {
    const B = CONFIG.breakthrough;
    S.bt.failures[r] = this._failures(r) + 1;
    if (hadYellow) {
      UI.toast('The Yellow pill holds your meridians together. No injury.', 'gold');
    } else {
      S.bt.injuryUntil = Date.now() + B.injurySec * 1000;
      this._wasInjured = true;
    }
    UI.flash('red');
    try { UI.shake && UI.shake(UI.panel('cultivate')); } catch (e) { /* ignore */ }
    UI.toast(extraMsg || 'The wall holds. Your EXP remains — your pride does not.', 'bad');

    const body = UI.el('div', 'col');
    body.appendChild(UI.el('div', 'tiny muted',
      'You keep every point of EXP. What you lose is time, and a little certainty.'));
    const kv1 = UI.el('div', 'kv');
    kv1.appendChild(UI.el('span', 'k', 'Insight gained'));
    kv1.appendChild(UI.el('span', 'v gold', '+' + Fmt.pct(B.insightPerFail, 0)
      + ' next attempt (' + Fmt.pct(this._insightBonus(r), 0) + ' total)'));
    body.appendChild(kv1);
    const kv2 = UI.el('div', 'kv');
    kv2.appendChild(UI.el('span', 'k', 'Dao Injury'));
    kv2.appendChild(UI.el('span', 'v ' + (hadYellow ? 'good' : 'bad'),
      hadYellow ? 'Averted' : Fmt.dur(B.injurySec)));
    body.appendChild(kv2);

    UI.modal({
      title: 'The Wall Holds',
      body,
      buttons: [{ label: 'Breathe', cls: 'ghost', act: (close) => close() }],
    });

    if (!S.flags.sawFirstFail) {
      S.flags.sawFirstFail = true;
      setTimeout(() => {
        try { if (typeof Story !== 'undefined' && Story.beat) Story.beat('firstFail'); } catch (e) { /* ignore */ }
      }, 700);
    }

    UI.dirty('cultivate');
    try { UI.refreshBadges && UI.refreshBadges(); } catch (e) { /* ignore */ }
  },

  /* The good ending. Public so the dev panel can drive it. */
  doBreak() {
    if (!this._ensure()) return false;
    const r = S.player.realm | 0;
    if (r >= CONFIG.cultivation.maxRealm) return false;

    const beforeAura = this.auraPerSec();
    let beforeBr = 0;
    try { beforeBr = Stats.br(); } catch (e) { beforeBr = 0; }

    S.player.realm = r + 1;
    S.player.phase = 1;
    S.player.exp = 0;
    S.bt.failures[r] = 0;
    S.bt.injuryUntil = 0;
    S.bt.loaded = [];
    this._wasInjured = false;
    S.stats.breakthroughs = (S.stats.breakthroughs | 0) + 1;
    this._powCache = {};

    // Full heal + the big stat jump: every combat unit is minted fresh from
    // Stats, so recomputing IS the heal.
    try { if (typeof Stats.invalidate === 'function') Stats.invalidate(); } catch (e) { /* ignore */ }
    try { Stats.recompute(); } catch (e) { /* ignore */ }

    const afterAura = this.auraPerSec();
    let afterBr = 0;
    try { afterBr = Stats.br(); } catch (e) { afterBr = 0; }

    UI.flash('gold');
    Bus.emit('breakthrough', { realm: S.player.realm });

    const body = UI.el('div', 'col');
    const title = UI.el('div', 'h1 gold serif', this.realmName(r) + ' → ' + this.realmName(r + 1));
    title.style.textAlign = 'center';
    body.appendChild(title);
    const era = UI.el('div', 'tiny muted');
    era.style.textAlign = 'center';
    era.textContent = this.realmEra(r + 1);
    body.appendChild(era);
    const desc = UI.el('div', 'tiny serif');
    desc.style.marginTop = '8px';
    desc.textContent = ((DATA.realms || [])[r + 1] || {}).desc || '';
    body.appendChild(desc);

    const sec = UI.el('div', 'sec');
    const addKv = (k, v) => {
      const kv = UI.el('div', 'kv');
      kv.appendChild(UI.el('span', 'k', k));
      kv.appendChild(UI.el('span', 'v good', v));
      sec.appendChild(kv);
    };
    addKv('Aura', Fmt.n1(beforeAura) + '/s → ' + Fmt.n1(afterAura) + '/s');
    addKv('Battle Rating', Fmt.n(beforeBr) + ' → ' + Fmt.n(afterBr));
    addKv('Breakthroughs', Fmt.n(S.stats.breakthroughs));
    body.appendChild(sec);

    UI.modal({
      title: 'Breakthrough',
      body,
      buttons: [{ label: 'Onward', cls: 'primary', act: (close) => close() }],
    });

    this._storyBeatForRealm(S.player.realm);

    UI.dirty('cultivate', 'wilds', 'battle', 'abode', 'more');
    try { UI.refreshBadges && UI.refreshBadges(); } catch (e) { /* ignore */ }
    try { Save.saveNow(); } catch (e) { /* ignore */ }
    return true;
  },

  /* Fire whichever realm beat the dialogue content actually defines. */
  _storyBeatForRealm(n) {
    if (typeof Story === 'undefined' || typeof Story.beat !== 'function') return;
    const bank = (DATA.dialogue && DATA.dialogue.shifu) ? DATA.dialogue.shifu : {};
    const candidates = ['realm' + n, 'r' + n, 'breakthrough' + n, 'bt' + n];
    for (const id of candidates) {
      if (bank[id]) {
        setTimeout(() => { try { Story.beat(id); } catch (e) { /* ignore */ } }, 900);
        return;
      }
    }
  },

  /* ================================================================ THE LAW */

  /* Permanent, one-time. Opened by the first Era Ascension. */
  openLawChoice() {
    if (!this._ensure()) return;
    if (S.player.law) return;
    const laws = DATA.laws || [];
    if (!laws.length) return;

    const body = UI.el('div', 'col');
    body.appendChild(UI.el('div', 'tiny muted',
      'Five ways the world can be told what to do. You will only ever learn one of them properly.'));

    let chosen = null;
    const cards = [];
    for (const law of laws) {
      const c = UI.el('div', 'card tight');
      c.dataset.law = law.id;
      const row = UI.el('div', 'row');
      const emo = UI.el('span', 'unit-emoji');
      emo.textContent = law.emoji || '✨';
      emo.style.fontSize = '24px';
      row.appendChild(emo);
      const col = UI.el('div', 'col');
      col.appendChild(UI.el('div', 'h2 serif', law.name || law.id));
      col.appendChild(UI.el('div', 'tiny muted', law.desc || ''));
      row.appendChild(col);
      c.appendChild(row);
      body.appendChild(c);
      cards.push(c);
    }

    body.addEventListener('click', (e) => {
      const card = e.target.closest('[data-law]');
      if (!card) return;
      chosen = card.dataset.law;
      for (const c of cards) c.classList.toggle('bg-gold', c === card);
    });

    UI.modal({
      title: 'Choose Your Law',
      wide: true,
      body,
      buttons: [{
        label: 'Swear To It', cls: 'primary', act: (close) => {
          if (!chosen) { UI.toast('Choose one. There is no going back either way.', 'bad'); return; }
          S.player.law = chosen;
          close();
          try { if (typeof Stats.invalidate === 'function') Stats.invalidate(); } catch (e) { /* ignore */ }
          try { Stats.recompute(); } catch (e) { /* ignore */ }
          Bus.emit('lawChosen', { law: chosen });
          UI.flash('gold');
          const row = (DATA.laws || []).filter((l) => l.id === chosen)[0];
          UI.toast('Sworn: ' + ((row && row.name) || chosen), 'gold');
          try { if (typeof Story !== 'undefined' && Story.beat) Story.beat('lawChoice'); } catch (e) { /* ignore */ }
          UI.dirty('cultivate', 'more');
          try { UI.refreshBadges && UI.refreshBadges(); } catch (e) { /* ignore */ }
          try { Save.saveNow(); } catch (e) { /* ignore */ }
        },
      }],
      onClose: () => { /* the Law panel can re-open this later */ },
    });
  },
};


/* ---------------------------------------------------------------------------
 * Respira — banked meditation bursts and the tappable wisps that reward
 * actually looking at the game. No panel of its own; it renders a card into
 * the cultivate panel and spawns its wisps into the hero.
 * ------------------------------------------------------------------------ */
const Respira = {

  _dom: null,
  _wispEl: null,
  _wispDieAt: 0,
  _wispT: 0,
  _wispNeed: 0,
  _offGuard: 0,

  /* ============================================================== LIFECYCLE */

  init() {
    this._wispNeed = U.rand(CONFIG.respira.wispMinSec, CONFIG.respira.wispMaxSec);
    this._wispT = 0;
    try {
      if (typeof Offline !== 'undefined' && typeof Offline.provider === 'function') {
        Offline.provider((sec) => Respira.offline(sec));
      }
    } catch (e) { console.warn('[Respira] offline provider failed', e); }
  },

  /* Charge cap = base + per-upgrade * purchased upgrades. */
  cap() {
    const C = CONFIG.respira;
    const up = U.clamp(Math.floor((S && S.respira && S.respira.capUp) || 0), 0, C.maxCapUpgrades);
    return C.baseCap + C.capPerUpgrade * up;
  },

  /* 0..1 progress toward the next banked charge. */
  chargeFrac() {
    if (!S || !S.respira) return 0;
    if (S.respira.charges >= this.cap()) return 1;
    return U.clamp((S.respira.chargeMs || 0) / (CONFIG.respira.chargeSec * 1000), 0, 1);
  },

  levelCost() {
    const C = CONFIG.respira;
    const lvl = Math.max(0, Math.floor((S && S.respira && S.respira.level) || 0));
    return Math.ceil(C.levelCostBase * Math.pow(C.levelCostGrowth, lvl));
  },

  /* Closed-form accrual so a 1h time-warp costs one division. */
  _bank(ms) {
    if (!S || !S.respira) return 0;
    const per = CONFIG.respira.chargeSec * 1000;
    const cap = this.cap();
    if (S.respira.charges >= cap) { S.respira.chargeMs = 0; return 0; }
    S.respira.chargeMs = (Number(S.respira.chargeMs) || 0) + Math.max(0, ms);
    if (S.respira.chargeMs < per) return 0;
    const gained = Math.floor(S.respira.chargeMs / per);
    S.respira.chargeMs -= gained * per;
    const before = S.respira.charges;
    S.respira.charges = Math.min(cap, before + gained);
    if (S.respira.charges >= cap) S.respira.chargeMs = 0;
    return S.respira.charges - before;
  },

  tick(dtSec, nowMs) {
    if (!S || !S.created || !S.respira) return;
    let dt = Number(dtSec);
    if (!(dt > 0)) return;
    if (dt > 3600) dt = 3600;
    const now = Number(nowMs) || Date.now();

    const gained = this._bank(dt * 1000);
    if (gained > 0) {
      UI.dirty('cultivate');
      try { UI.refreshBadges && UI.refreshBadges(); } catch (e) { /* ignore */ }
    }

    /* ---- wisps: only while the hero screen is actually being watched ----- */
    const visible = Cultivation._visible();
    if (this._wispEl) {
      if (!visible || now >= this._wispDieAt) this._fadeWisp();
      return;
    }
    if (!visible) return;
    if (S.settings && S.settings.reduceFx) return;   // no drifting targets to chase

    this._wispT += dt;
    if (this._wispT >= this._wispNeed) {
      this._wispT = 0;
      this._wispNeed = U.rand(CONFIG.respira.wispMinSec, CONFIG.respira.wispMaxSec);
      this._spawnWisp();
    }
  },

  offline(elapsedSec) {
    const now = Date.now();
    if (now - this._offGuard < 500) return [];
    this._offGuard = now;
    if (!S || !S.respira) return [];
    let sec = Number(elapsedSec);
    if (!isFinite(sec) || sec <= 0) return [];
    // Charges bank on REAL time — the offline window does not cap them, the
    // charge cap does.
    const gained = this._bank(sec * 1000);
    if (gained <= 0) return [];
    return Cultivation._offLine('Respira', '\u{1F32C}\u{FE0F}',
      '+' + gained + ' charge' + (gained === 1 ? '' : 's'));
  },

  /* ================================================================ THE ACT */

  /* Spend a banked charge (or ride a tapped wisp for free) and convert the
     next N minutes of aura into instant EXP. Returns true if it fired. */
  trigger(fromWisp) {
    if (!S || !S.created) return false;
    Cultivation._ensure();
    const C = CONFIG.respira;

    if (!fromWisp) {
      if ((S.respira.charges | 0) <= 0) {
        UI.toast('No Respira charges banked. One every ' + Fmt.dur(C.chargeSec) + '.', 'bad');
        return false;
      }
      S.respira.charges -= 1;
    }

    const aura = Cultivation.auraPerSec();
    let bonus = 0;
    try { bonus = Number(Stats.bonus('respiraExp')) || 0; } catch (e) { bonus = 0; }
    const lvl = Math.max(0, Math.floor(S.respira.level || 0));
    let exp = aura * 60 * C.expMinutes * (1 + bonus + C.levelBonus * lvl);
    let tech = U.rint(C.techPointsMin, C.techPointsMax);

    S.respira.sinceSurge = (S.respira.sinceSurge | 0) + 1;
    const pity = S.respira.sinceSurge >= C.surgePity;
    const surge = pity || U.chance(C.surgeChance);
    if (surge) {
      exp *= C.surgeMult;
      tech *= C.surgeTechPointsMult;
      S.respira.sinceSurge = 0;
      Econ.grant('insight', 1);
      UI.flash('gold');
    }

    Econ.grant('tech', tech);
    Cultivation.addExp(exp, 'respira');

    S.daily.respiraCount = (S.daily.respiraCount | 0) + 1;
    S.stats.respiras = (S.stats.respiras | 0) + 1;
    Bus.emit('respira', { surge: !!surge, exp });

    this._juice(exp, tech, surge, fromWisp);

    UI.dirty('cultivate');
    try { UI.refreshBadges && UI.refreshBadges(); } catch (e) { /* ignore */ }
    try { Save.save(); } catch (e) { /* ignore */ }
    return true;
  },

  /* Numbers everywhere. This is the moment the player came back for. */
  _juice(exp, tech, surge, fromWisp) {
    const dom = Cultivation._dom;
    const anchor = (dom && dom.fig) ? dom.fig : (dom && dom.hero) ? dom.hero : null;
    const reduce = !!(S.settings && S.settings.reduceFx);

    if (surge) {
      UI.toast('INSIGHT SURGE — the world holds still for you.', 'gold');
    } else if (fromWisp) {
      UI.toast('You catch the wisp mid-drift.', 'good');
    }

    if (!anchor) return;
    try { UI.float(anchor, '+' + Fmt.n(exp) + ' EXP', surge ? 'gold' : ''); } catch (e) { /* ignore */ }
    if (reduce) return;

    const extras = surge ? 5 : 3;
    for (let i = 0; i < extras; i++) {
      const label = (i === 0)
        ? ('+' + tech + ' Tech')
        : (surge && i === 1 ? '+1 Insight' : '+' + Fmt.n(exp / (extras + 1)));
      setTimeout(() => {
        try { UI.float(anchor, label, surge ? 'gold' : 'good'); } catch (e) { /* ignore */ }
      }, 90 * (i + 1));
    }
  },

  /* ================================================================== WISPS */

  _spawnWisp() {
    const dom = Cultivation._dom;
    if (!dom || !dom.hero || !dom.hero.isConnected) return;
    this._killWisp();

    const el = UI.el('button', 'wisp');
    el.type = 'button';
    el.dataset.act = 'wisp';
    el.setAttribute('aria-label', 'Catch the spirit wisp');
    el.style.left = U.rint(6, 74) + '%';
    el.style.top = U.rint(10, 58) + '%';
    dom.hero.appendChild(el);

    this._wispEl = el;
    this._wispDieAt = Date.now() + CONFIG.respira.wispLifeSec * 1000;
  },

  tapWisp(el) {
    const node = this._wispEl || el;
    if (!node) return;
    this._wispEl = null;
    this._wispDieAt = 0;
    // pop, then remove
    node.style.transition = 'transform .28s ease-out, opacity .28s ease-out';
    node.style.transform = 'scale(2.1)';
    node.style.opacity = '0';
    node.disabled = true;
    setTimeout(() => { if (node.parentNode) node.parentNode.removeChild(node); }, 320);
    this._wispT = 0;
    this._wispNeed = U.rand(CONFIG.respira.wispMinSec, CONFIG.respira.wispMaxSec);
    this.trigger(true);
  },

  _fadeWisp() {
    const node = this._wispEl;
    this._wispEl = null;
    this._wispDieAt = 0;
    if (!node) return;
    node.style.transition = 'opacity .5s ease-out';
    node.style.opacity = '0';
    setTimeout(() => { if (node.parentNode) node.parentNode.removeChild(node); }, 560);
  },

  _killWisp() {
    if (this._wispEl && this._wispEl.parentNode) this._wispEl.parentNode.removeChild(this._wispEl);
    this._wispEl = null;
    this._wispDieAt = 0;
  },

  /* ============================================================ PANEL: BUILD */

  /* Called once by Cultivation._build with a host div inside the cultivate
     panel. All clicks bubble to the cultivate panel's single delegate. */
  build(host) {
    if (!host) return;
    host.innerHTML = '';
    const add = (parent, tag, cls, text) => {
      const e = UI.el(tag, cls, text);
      parent.appendChild(e);
      return e;
    };
    const card = add(host, 'div', 'card');

    const head = add(card, 'div', 'row between');
    add(head, 'div', 'sec-title', 'Respira');
    const lvlChip = add(head, 'button', 'chip', 'Lv 0');
    lvlChip.type = 'button';
    lvlChip.dataset.act = 'respiraSheet';

    const chargeRow = add(card, 'div', 'row between');
    const chargeTxt = add(chargeRow, 'span', 'val jade', '0 / 8');
    const nextTxt = add(chargeRow, 'span', 'tiny muted mono', '');
    const barFill = add(add(card, 'div', 'bar mp'), 'i', '');

    const gainRow = add(card, 'div', 'row between');
    gainRow.style.marginTop = '8px';
    const gainTxt = add(gainRow, 'span', 'tiny muted', '');
    const pityTxt = add(gainRow, 'span', 'tiny gold', '');

    const btn = add(card, 'button', 'btn primary wide', 'Respira');
    btn.type = 'button';
    btn.dataset.act = 'respira';
    btn.style.marginTop = '8px';

    const hint = add(card, 'div', 'tiny muted',
      'Wisps drift across the hero while you watch. Catching one is free — it costs no charge.');
    hint.style.marginTop = '6px';

    this._dom = { card, lvlChip, chargeTxt, nextTxt, barFill, gainTxt, pityTxt, btn };
  },

  patch() {
    const d = this._dom;
    if (!d || !S || !S.respira) return;
    const C = CONFIG.respira;
    const cap = this.cap();
    const ch = S.respira.charges | 0;
    const frac = this.chargeFrac();

    d.lvlChip.textContent = 'Lv ' + (S.respira.level | 0) + ' · \u{1F4A0} ' + Fmt.n((S.cur && S.cur.insight) || 0);
    d.chargeTxt.textContent = ch + ' / ' + cap;
    d.chargeTxt.className = ch >= cap ? 'val gold' : 'val jade';
    d.barFill.style.width = (frac * 100).toFixed(1) + '%';

    if (ch >= cap) {
      d.nextTxt.textContent = 'FULL — spend some';
    } else {
      const leftMs = C.chargeSec * 1000 - (S.respira.chargeMs || 0);
      d.nextTxt.textContent = 'next in ' + Fmt.durShort(Math.max(0, leftMs) / 1000);
    }

    let bonus = 0;
    try { bonus = Number(Stats.bonus('respiraExp')) || 0; } catch (e) { bonus = 0; }
    const lvl = S.respira.level | 0;
    const exp = Cultivation.auraPerSec() * 60 * C.expMinutes * (1 + bonus + C.levelBonus * lvl);
    d.gainTxt.textContent = '≈ ' + Fmt.n(exp) + ' EXP · ' + C.techPointsMin + '-' + C.techPointsMax + ' Tech';

    const toPity = Math.max(0, C.surgePity - (S.respira.sinceSurge | 0));
    d.pityTxt.textContent = toPity <= 0 ? 'SURGE GUARANTEED' : ('surge in ≤ ' + toPity);
    d.pityTxt.className = toPity <= 3 ? 'tiny gold' : 'tiny muted';

    d.btn.disabled = ch <= 0;
    d.btn.textContent = ch > 0 ? ('Respira  (' + ch + ')') : 'No Charges Banked';
  },

  /* ============================================================ LEVEL SHEET */

  openSheet() {
    const body = UI.el('div', '');
    const redraw = () => {
      body.innerHTML = '';
      const C = CONFIG.respira;
      const lvl = S.respira.level | 0;
      const cost = this.levelCost();
      const have = (S.cur && S.cur.insight) || 0;
      const maxed = lvl >= C.maxLevel;

      body.appendChild(UI.el('div', 'tiny muted',
        'Every Respira Level deepens the breath: +' + Fmt.pct(C.levelBonus, 0)
        + ' EXP from every meditation, banked or caught.'));

      const sec = UI.el('div', 'sec');
      const addKv = (k, v, cls) => {
        const kv = UI.el('div', 'kv');
        kv.appendChild(UI.el('span', 'k', k));
        kv.appendChild(UI.el('span', 'v ' + (cls || ''), v));
        sec.appendChild(kv);
      };
      addKv('Respira Level', lvl + ' / ' + C.maxLevel, 'gold');
      addKv('EXP bonus', '+' + Fmt.pct(C.levelBonus * lvl, 0), 'good');
      addKv('Charge cap', this.cap() + ' (' + (S.respira.capUp | 0) + '/' + C.maxCapUpgrades + ' upgrades)');
      addKv('One charge every', Fmt.dur(C.chargeSec));
      addKv('Insight Shards', Fmt.n(have), have >= cost ? 'good' : 'bad');
      addKv('Respiras performed', Fmt.n((S.stats && S.stats.respiras) || 0));
      body.appendChild(sec);

      const btn = UI.el('button', 'btn primary wide');
      btn.type = 'button';
      btn.style.marginTop = '10px';
      if (maxed) {
        btn.textContent = 'Fully Mastered';
        btn.disabled = true;
      } else {
        btn.textContent = 'Deepen the Breath — \u{1F4A0} ' + Fmt.n(cost);
        btn.disabled = have < cost;
        btn.addEventListener('click', () => {
          if (!Econ.spend('insight', cost)) { UI.toast('Not enough Insight Shards.', 'bad'); return; }
          S.respira.level = lvl + 1;
          UI.toast('Respira Level ' + S.respira.level + '. The air gets thicker.', 'gold');
          UI.flash('jade');
          UI.dirty('cultivate');
          try { Save.save(); } catch (e) { /* ignore */ }
          redraw();
        });
      }
      body.appendChild(btn);

      const foot = UI.el('div', 'tiny muted');
      foot.style.marginTop = '10px';
      foot.textContent = 'Insight Shards come from Surges. A Surge is guaranteed within '
        + C.surgePity + ' respiras, and multiplies the reward by ' + C.surgeMult + '.';
      body.appendChild(foot);
    };
    redraw();

    UI.sheet({
      title: 'Respira',
      body,
      buttons: [{ label: 'Close', cls: 'ghost', act: (close) => close() }],
    });
  },
};

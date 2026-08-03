/* ============================================================================
 * Alchemy — the Abode furnace: 6 formula ranks x 8 pill types, a craft queue,
 * per-rank mastery, and every pill's consumption effect.
 *
 * FORMULAS
 *   craftSec      = formula.craftSec * (1 - 0.08 * masteryLvl), floor 30s
 *   masteryLvl    = highest i where masteryExp >= CONFIG.alchemy.masteryReq[i]
 *   qualityRoll   = weightedPick(CONFIG.alchemy.qualityBase) with the mass shifted
 *                   upward by  b = 0.05*masteryLvl + Stats.bonus('alchemyQuality'):
 *                     w[0] = base[0] * max(0.15, 1 - 2b)
 *                     w[i] = base[i] * (1 + 1.5*b*i)          for i > 0
 *   potency       = CONFIG.alchemy.qualityMult[qi]  ->  1 / 1.4 / 2 / 3 / 4.5
 *
 * EXP PILL (the daily bread) — spends one of the day's Pill Attempts:
 *   exp = max( 45min * auraBase * auraGrowth^rank ,               (spec section 5)
 *              phaseReq(realm, phase) * 0.015 )                   (relevance floor)
 *         * potency * (1 + Stats.bonus('pillExp'))
 *   The second term keeps a rank-6 pill meaningful once flat rank aura has been
 *   outgrown; without it high-realm pills decay to rounding error.
 *
 * PERMANENT PILLS  Vital Powder / Mind Elixir: +1.2% of base per use, capped at
 *   CONFIG.alchemy.permCapPerRealm (10) uses per realm, tracked per realm index.
 * ==========================================================================*/

const Alchemy = {
  QUALS: ['gray', 'green', 'blue', 'purple', 'yellow'],
  _dom: null,
  _sel: null,          // selected formula id in the craft sheet
  _lastSig: '',

  /* ------------------------------------------------------------------ init */
  init() {
    try { Offline.provider((sec) => this._offline(sec)); } catch (e) { /* optional */ }
    try {
      Bus.on('breakthrough', () => { this._lastSig = ''; UI.dirty('abode'); });
    } catch (e) { /* optional */ }
  },

  tick() {
    if (!S || !S.alchemy) return;
    const now = Date.now();
    let changed = false;
    const q = this._queue();
    for (const job of q) {
      if (job.quality === null && job.endAt <= now) { this._finish(job); changed = true; }
    }
    if (this._assistant()) changed = this._autoStart() || changed;
    if (changed) { this._lastSig = ''; UI.dirty('abode'); this._badge(); }
  },

  badges() { return this._readyCount(); },

  /* ------------------------------------------------------------- accessors */
  _queue() {
    if (!S.alchemy.queue || !Array.isArray(S.alchemy.queue)) S.alchemy.queue = [];
    return S.alchemy.queue;
  },
  queueMax() {
    const up = Math.floor(Number(S.alchemy.queueUp) || 0);
    return CONFIG.alchemy.queueSize + U.clamp(up, 0, CONFIG.alchemy.maxQueueUpgrades);
  },
  _assistant() { return !!(S.alchemy && S.alchemy.assistant); },
  _readyCount() {
    let n = 0;
    for (const j of this._queue()) if (j.quality !== null) n++;
    return n;
  },
  _badge() { try { UI.badge('abode.alchemy', this._readyCount()); } catch (e) { /* pre-boot */ } },

  masteryOf(rank) {
    if (!S.alchemy.mastery || typeof S.alchemy.mastery !== 'object') S.alchemy.mastery = {};
    let m = S.alchemy.mastery[rank];
    if (!m || typeof m !== 'object') { m = { lvl: 0, exp: 0 }; S.alchemy.mastery[rank] = m; }
    if (!Number.isFinite(m.lvl)) m.lvl = 0;
    if (!Number.isFinite(m.exp)) m.exp = 0;
    return m;
  },
  masteryName(rank) {
    const m = this.masteryOf(rank);
    return CONFIG.alchemy.masteryLevels[U.clamp(m.lvl, 0, CONFIG.alchemy.masteryLevels.length - 1)];
  },

  /* Formulas the player knows, usable at their realm. */
  known() {
    const ids = (S.inv && Array.isArray(S.inv.formulas)) ? S.inv.formulas : [];
    const out = [];
    for (const id of ids) {
      const f = DATAX.formulaById[id];
      if (f) out.push(f);
    }
    out.sort((a, b) => (a.rank - b.rank) || String(a.type).localeCompare(String(b.type)));
    return out;
  },

  craftSec(f) {
    const m = this.masteryOf(f.rank);
    const mult = Math.max(0.3, 1 - CONFIG.alchemy.masterySpeedBonus * m.lvl);
    return Math.max(30, Math.round((Number(f.craftSec) || 300) * mult));
  },

  /* -------------------------------------------------------------- crafting */
  canCraft(f) {
    if (!f) return false;
    if (this._queue().length >= this.queueMax()) return false;
    return Econ.spend ? this._affordable(f.cost) : false;
  },
  _affordable(cost) {
    for (const k in (cost || {})) {
      const n = Math.floor(Number(cost[k]) || 0);
      if (n > 0 && !Econ.can(k, n)) return false;
    }
    return true;
  },

  startCraft(formulaId) {
    const f = DATAX.formulaById[formulaId];
    if (!f) return false;
    if (this._queue().length >= this.queueMax()) { UI.toast('The furnace is full.', 'bad'); return false; }
    if (!this._affordable(f.cost)) { UI.toast('Not enough materials.', 'bad'); return false; }
    if (!Econ.spend(f.cost)) { UI.toast('Not enough materials.', 'bad'); return false; }

    this._queue().push({ formulaId: f.id, endAt: Date.now() + this.craftSec(f) * 1000, quality: null });
    UI.toast('The furnace is lit.', 'good');
    this._lastSig = '';
    UI.dirty('abode');
    return true;
  },

  /* Roll quality and mark the job collectable. */
  _finish(job) {
    const f = DATAX.formulaById[job.formulaId];
    if (!f) { job.quality = 'gray'; return; }

    let b = 0;
    try { b = Number(Stats.bonus('alchemyQuality')) || 0; } catch (e) { b = 0; }
    b += CONFIG.alchemy.masteryQualityShift * this.masteryOf(f.rank).lvl;

    const base = CONFIG.alchemy.qualityBase;
    const w = base.map((v, i) => (i === 0 ? v * Math.max(0.15, 1 - 2 * b) : v * (1 + 1.5 * b * i)));
    const total = w.reduce((a, c) => a + c, 0);
    let roll = Math.random() * total;
    let qi = 0;
    for (let i = 0; i < w.length; i++) { roll -= w[i]; if (roll <= 0) { qi = i; break; } }
    job.quality = this.QUALS[qi];

    // mastery
    const m = this.masteryOf(f.rank);
    m.exp += CONFIG.alchemy.masteryExpPerCraft;
    const req = CONFIG.alchemy.masteryReq;
    let lvl = 0;
    for (let i = 0; i < req.length; i++) if (m.exp >= req[i]) lvl = i;
    if (lvl > m.lvl) {
      m.lvl = lvl;
      UI.toast(`Alchemy Mastery R${f.rank}: ${this.masteryName(f.rank)}`, 'gold');
    }
  },

  collect(idx) {
    const q = this._queue();
    const job = q[idx];
    if (!job || job.quality === null) return false;
    const f = DATAX.formulaById[job.formulaId];
    q.splice(idx, 1);
    if (!f) return false;

    const key = f.id + '_' + job.quality;
    if (!S.inv.pills || typeof S.inv.pills !== 'object') S.inv.pills = {};
    S.inv.pills[key] = (Math.floor(Number(S.inv.pills[key])) || 0) + 1;
    S.stats.pillsCrafted = (S.stats.pillsCrafted | 0) + 1;

    Bus.emit('pillCrafted', { formulaId: f.id, rank: f.rank, quality: job.quality });
    UI.toast(`${f.emoji || '\u{1F48A}'} ${f.name} (${job.quality})`, job.quality === 'yellow' ? 'gold' : 'good');
    if (job.quality === 'yellow') { try { UI.flash('gold'); } catch (e) { /* optional */ } }

    this._lastSig = '';
    UI.dirty('abode', 'cultivate');
    this._badge();
    return true;
  },

  collectAll() {
    let n = 0;
    for (let i = this._queue().length - 1; i >= 0; i--) if (this.collect(i)) n++;
    if (!n) UI.toast('Nothing is ready.', 'bad');
    return n;
  },

  /* Alchemy Assistant: refill empty queue slots with the last-crafted formula. */
  _autoStart() {
    const q = this._queue();
    if (q.length >= this.queueMax()) return false;
    const last = S.alchemy.lastFormula;
    if (!last) return false;
    const f = DATAX.formulaById[last];
    if (!f || !this._affordable(f.cost)) return false;
    if (!Econ.spend(f.cost)) return false;
    q.push({ formulaId: f.id, endAt: Date.now() + this.craftSec(f) * 1000, quality: null });
    return true;
  },

  /* -------------------------------------------------------------- offline */
  /* Craft jobs finish on their own absolute endAt, so offline is report-only. */
  _offline(sec) {
    if (!S || !S.alchemy) return [];
    const now = Date.now();
    let done = 0;
    for (const job of this._queue()) {
      if (job.quality === null && job.endAt <= now) { this._finish(job); done++; }
    }
    if (this._assistant()) { let guard = 0; while (this._autoStart() && guard++ < 20) { /* fill */ } }
    this._badge();
    return done ? [{ label: 'Pills finished', icon: '\u{1F48A}', amount: '+' + done }] : [];
  },

  /* ============================================================ CONSUMPTION */

  pillCount(type, minQuality) {
    const minQi = minQuality ? this.QUALS.indexOf(minQuality) : 0;
    let n = 0;
    for (const key in (S.inv.pills || {})) {
      const c = Math.floor(Number(S.inv.pills[key]) || 0);
      if (c <= 0) continue;
      const cut = key.lastIndexOf('_');
      if (cut <= 0) continue;
      const f = DATAX.formulaById[key.slice(0, cut)];
      if (!f || (type && f.type !== type)) continue;
      if (this.QUALS.indexOf(key.slice(cut + 1)) < minQi) continue;
      n += c;
    }
    return n;
  },

  _take(key) {
    const inv = S.inv && S.inv.pills;
    if (!inv || !(inv[key] > 0)) return null;
    const cut = String(key).lastIndexOf('_');
    if (cut <= 0) return null;
    const f = DATAX.formulaById[key.slice(0, cut)];
    if (!f) return null;
    const q = key.slice(cut + 1);
    const qi = Math.max(0, this.QUALS.indexOf(q));
    inv[key] -= 1;
    if (inv[key] <= 0) delete inv[key];
    return { f, q, qi, potency: CONFIG.alchemy.qualityMult[qi] || 1 };
  },

  /* Consume one pill by inventory key. Returns true when it was used.
     Every pill type routes through here so the daily caps and Bus events stay
     in one place. */
  usePill(key) {
    if (!S || !S.inv || !S.inv.pills || !S.inv.pills[key]) return false;
    const cut = String(key).lastIndexOf('_');
    const peek = cut > 0 ? DATAX.formulaById[key.slice(0, cut)] : null;
    if (!peek) return false;

    // EXP pills are the only type gated by the daily attempt budget.
    if (peek.type === 'exp') {
      const used = Math.floor(Number(S.daily.pillAttemptsUsed) || 0);
      const max = Cultivation.pillAttemptsMax();
      if (used >= max) { UI.toast('No pill attempts left today.', 'bad'); return false; }
    }

    const got = this._take(key);
    if (!got) return false;
    const { f, q, qi, potency } = got;

    switch (f.type) {
      case 'exp': {
        S.daily.pillAttemptsUsed = (Math.floor(Number(S.daily.pillAttemptsUsed) || 0)) + 1;
        const flat = CONFIG.alchemy.expPillMinutes * 60 *
          CONFIG.cultivation.aura.base * Math.pow(CONFIG.cultivation.aura.growth, f.rank);
        const rel = Cultivation.phaseReq(S.player.realm, S.player.phase) * CONFIG.alchemy.expPillPhaseFrac;
        let exp = Math.max(flat, rel) * potency;
        try { exp *= (1 + (Number(Stats.bonus('pillExp')) || 0)); } catch (e) { /* none */ }
        Cultivation.addExp(exp, 'pill');
        UI.toast(`+${Fmt.n(exp)} aura`, 'good');
        break;
      }
      case 'vital': {
        if (!this._permOk('vital')) { this._refund(key); return false; }
        const amt = CONFIG.alchemy.vitalHpPct * potency;
        Stats.addPerm('hp', amt);
        Stats.addPerm('patk', CONFIG.alchemy.vitalAtkPct * potency);
        this._permUse('vital');
        UI.toast('Your frame thickens.', 'good');
        break;
      }
      case 'mind': {
        if (!this._permOk('mind')) { this._refund(key); return false; }
        Stats.addPerm('matk', CONFIG.alchemy.mindMatkPct * potency);
        Stats.addPerm('mp', CONFIG.alchemy.mindMpPct * potency);
        this._permUse('mind');
        UI.toast('Your thoughts run clearer.', 'good');
        break;
      }
      case 'bt': {
        // Loading is handled by the breakthrough panel; using it directly just
        // stages it for the next attempt.
        if (!Array.isArray(S.bt.loaded)) S.bt.loaded = [];
        if (S.bt.loaded.length >= CONFIG.breakthrough.maxPills) {
          this._refund(key);
          UI.toast('Already holding three.', 'bad');
          return false;
        }
        S.bt.loaded.push(key);
        UI.toast('Pill readied for the breakthrough.', 'good');
        break;
      }
      case 'bait': {
        const now = Date.now();
        const base = Math.max(now, Number(S.alchemy.baitUntil) || 0);
        S.alchemy.baitUntil = base + CONFIG.alchemy.baitDurationSec * 1000;
        UI.toast('The scent will draw beasts for a while.', 'good');
        break;
      }
      // meridian / ward / fury are consumed by Combat at the point of use;
      // reaching here means the player tapped it outside a fight.
      case 'meridian': case 'ward': case 'fury': {
        this._refund(key);
        UI.toast('Save that for a fight.', 'bad');
        return false;
      }
      default: break;
    }

    Bus.emit('pillUsed', { formulaId: f.id, type: f.type, rank: f.rank, quality: q });
    Stats.invalidate();
    Stats.recompute();
    this._lastSig = '';
    UI.dirty('cultivate', 'abode');
    UI.refreshBadges();
    return true;
  },

  _refund(key) {
    if (!S.inv.pills) S.inv.pills = {};
    S.inv.pills[key] = (Math.floor(Number(S.inv.pills[key])) || 0) + 1;
  },
  _permOk(kind) {
    const r = String(S.player.realm | 0);
    const uses = ((S.player.pillUses || {})[kind] || {})[r] || 0;
    if (uses >= CONFIG.alchemy.permCapPerRealm) {
      UI.toast(`This realm can take no more (${CONFIG.alchemy.permCapPerRealm}/realm).`, 'bad');
      return false;
    }
    return true;
  },
  _permUse(kind) {
    if (!S.player.pillUses) S.player.pillUses = { vital: {}, mind: {} };
    if (!S.player.pillUses[kind]) S.player.pillUses[kind] = {};
    const r = String(S.player.realm | 0);
    S.player.pillUses[kind][r] = (S.player.pillUses[kind][r] || 0) + 1;
  },

  /* ================================================================= PANEL */
  /* Abode owns the panel; it calls renderInto(host) on every render pass with
     the same host, so build once and patch. */
  renderInto(host) {
    if (!host) return;
    if (!this._dom || this._dom.host !== host || !host.contains(this._dom.root)) this._build(host);
    this._patch();
  },

  _build(host) {
    host.innerHTML = '';
    const root = UI.el('div', 'col');

    const st = UI.el('div', 'card tight');
    st.innerHTML = `<div class="row between">
        <span class="lbl">Furnace</span><span class="val" data-f="slots"></span></div>
      <div class="tiny muted" data-f="mastery"></div>`;
    root.appendChild(st);

    const queue = UI.el('div', 'col');
    root.appendChild(queue);

    const actions = UI.el('div', 'row');
    const bCraft = UI.el('button', 'btn primary wide', 'Craft a Pill');
    bCraft.dataset.act = 'al-open';
    const bAll = UI.el('button', 'btn wide', 'Collect All');
    bAll.dataset.act = 'al-all';
    actions.appendChild(bCraft); actions.appendChild(bAll);
    root.appendChild(actions);

    const shelf = UI.el('div', 'col');
    root.appendChild(shelf);

    host.appendChild(root);
    this._dom = { host, root, st, queue, shelf, bAll };

    if (!root._wired) {
      root._wired = true;
      root.addEventListener('click', (e) => this._onClick(e));
    }
  },

  _patch() {
    const d = this._dom;
    if (!d) return;
    const q = this._queue();
    const now = Date.now();

    d.st.querySelector('[data-f="slots"]').textContent = `${q.length}/${this.queueMax()}`;
    const ranks = [];
    for (let r = 1; r <= CONFIG.alchemy.ranks; r++) {
      const m = this.masteryOf(r);
      if (m.exp > 0) ranks.push(`R${r} ${this.masteryName(r)}`);
    }
    d.st.querySelector('[data-f="mastery"]').textContent =
      ranks.length ? ranks.join(' · ') : 'No mastery yet — craft to learn.';

    // queue rows (rebuilt only when the shape changes)
    const sig = q.map(j => j.formulaId + (j.quality || Math.ceil((j.endAt - now) / 1000))).join('|')
      + '#' + Object.keys(S.inv.pills || {}).map(k => k + (S.inv.pills[k] || 0)).join(',');
    if (sig !== this._lastSig) {
      this._lastSig = sig;
      d.queue.innerHTML = '';
      if (!q.length) d.queue.appendChild(UI.el('div', 'empty', 'The furnace is cold.'));
      for (let i = 0; i < q.length; i++) {
        const job = q[i];
        const f = DATAX.formulaById[job.formulaId];
        const ready = job.quality !== null;
        const right = UI.el('button', 'btn sm' + (ready ? ' primary' : ''),
          ready ? 'Collect' : Fmt.durShort(Math.max(0, (job.endAt - now) / 1000)));
        if (ready) { right.dataset.act = 'al-take'; right.dataset.idx = String(i); }
        else right.disabled = true;
        d.queue.appendChild(UI.itemCard({
          emoji: (f && f.emoji) || '\u{1F9EA}',
          name: (f && f.name) || 'Unknown brew',
          rarity: ready ? job.quality : 'gray',
          sub: ready ? `Ready — ${job.quality}` : `Rank ${(f && f.rank) || '?'}`,
          right,
        }));
      }
      this._buildShelf(d.shelf);
    } else {
      // cheap path: just retick the countdown labels
      const btns = d.queue.querySelectorAll('.btn.sm[disabled]');
      let bi = 0;
      for (let i = 0; i < q.length; i++) {
        if (q[i].quality !== null) continue;
        const b = btns[bi++];
        if (b) b.textContent = Fmt.durShort(Math.max(0, (q[i].endAt - now) / 1000));
      }
    }
    d.bAll.disabled = this._readyCount() === 0;
  },

  /* The pill shelf: everything owned, tappable to use. */
  _buildShelf(host) {
    host.innerHTML = '';
    const inv = S.inv.pills || {};
    const keys = Object.keys(inv).filter(k => inv[k] > 0);
    host.appendChild(UI.el('div', 'sec-title serif', 'Pill Shelf'));
    if (!keys.length) { host.appendChild(UI.el('div', 'empty', 'No pills yet.')); return; }

    keys.sort();
    for (const key of keys) {
      const cut = key.lastIndexOf('_');
      const f = DATAX.formulaById[key.slice(0, cut)];
      if (!f) continue;
      const q = key.slice(cut + 1);
      const btn = UI.el('button', 'btn sm', 'Use');
      btn.dataset.act = 'al-use'; btn.dataset.id = key;
      host.appendChild(UI.itemCard({
        emoji: f.emoji || '\u{1F48A}', name: f.name, rarity: q,
        sub: `${f.desc || ''} — x${CONFIG.alchemy.qualityMult[this.QUALS.indexOf(q)] || 1} potency`,
        right: btn, id: key,
      }));
      const tag = host.lastChild.querySelector('.h2');
      if (tag) tag.textContent = `${f.name} x${inv[key]}`;
    }
  },

  _onClick(e) {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    if (act === 'al-open') { this.openCraftSheet(); return; }
    if (act === 'al-all') { this.collectAll(); return; }
    if (act === 'al-take') { this.collect(parseInt(el.dataset.idx, 10)); return; }
    if (act === 'al-use') { this.usePill(el.dataset.id); return; }
  },

  /* ------------------------------------------------------- craft sheet */
  openCraftSheet() {
    const list = this.known();
    const body = document.createElement('div');
    if (!list.length) {
      body.appendChild(UI.el('div', 'empty', 'You know no formulas. The Market and the Sect Library sell them.'));
      UI.sheet({ title: 'Craft', body, buttons: [{ label: 'Close', cls: 'ghost', act: (c) => c() }] });
      return;
    }

    for (const f of list) {
      const wrap = UI.el('div', 'card tight');
      const head = UI.el('div', 'row between');
      head.appendChild(UI.el('div', 'h2', `${f.emoji || '\u{1F48A}'} ${f.name}`));
      head.appendChild(UI.el('span', 'chip', `R${f.rank}`));
      wrap.appendChild(head);
      wrap.appendChild(UI.el('div', 'tiny muted', f.desc || ''));
      wrap.appendChild(UI.costRow(f.cost));

      const foot = UI.el('div', 'row between');
      foot.appendChild(UI.el('span', 'tiny muted', Fmt.dur(this.craftSec(f))));
      const b = UI.el('button', 'btn sm primary', 'Craft');
      b.dataset.act = 'craft'; b.dataset.id = f.id;
      if (!this._affordable(f.cost) || this._queue().length >= this.queueMax()) b.disabled = true;
      foot.appendChild(b);
      wrap.appendChild(foot);
      body.appendChild(wrap);
    }

    const sheet = UI.sheet({ title: 'Craft a Pill', body,
      buttons: [{ label: 'Close', cls: 'ghost', act: (c) => c() }] });

    body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act="craft"]');
      if (!b) return;
      if (this.startCraft(b.dataset.id)) {
        S.alchemy.lastFormula = b.dataset.id;
        try { UI.closeSheet ? UI.closeSheet(sheet) : UI.closeTop(); } catch (err) { /* fine */ }
      }
    });
  },
};

/* ---------------------------------------------------------------------------
 * Techs — the technique tree: CONFIG.techs.ranks (16) ranks x
 *         CONFIG.techs.nodesPerRank (6) nodes = 96 authored DATA.techs entries.
 *         Owns panel 'techs'. Gate: CONFIG.unlocks.techs.
 *
 * Law   — the sworn Law: identity, CONFIG.law.maxLevel (20) upgrade levels, and
 *         the element advantage wheel. Owns panel 'law'.
 *         Gate: CONFIG.law.unlockRealm (== CONFIG.unlocks.law == 6).
 *
 * =========================================================================
 * FORMULAS — Techs
 * =========================================================================
 *   rank availability   S.player.realm >= CONFIG.techs.rankUnlockRealm[rank-1]
 *                       (rankUnlockRealm = [0,0,1,1,2,2,3,3,4,4,6,6,7,8,9,10])
 *   purchase            atomic Econ.spend({ tech: node.cost.tech,
 *                                           guide: node.cost.guide })
 *                       -> S.techs.owned.push(node.id)
 *                       (node costs are authored in 10_data_40_techs.js as
 *                        tech = round(CONFIG.techs.costBase * rank^costRankPow
 *                                     * (1 + costNodeStep*(idx-1))))
 *   rankOwned(r)        count of S.techs.owned whose node.rank === r
 *   rankComplete(r)     nodesInRank(r) > 0 && rankOwned(r) === nodesInRank(r)
 *   completion bonus    every kind:'stat' node of a COMPLETE rank contributes
 *                         val * CONFIG.techs.completionBonusMult   (x2)
 *                       kind:'effect' nodes are NEVER doubled.
 *   Stats.provider      for each owned node:
 *                         kind 'stat'   -> acc[key] += val * (complete ? 2 : 1)
 *                         kind 'effect' -> acc[key] += val
 *                       EXCEPT the two FLAT INTEGER effect keys, which are added
 *                       as whole units and never as percentages:
 *                         'pillAttempts' (+1 daily pill attempt each; ranks
 *                                         3/7/11/15 -> daily cap 10 -> 14 via
 *                                         Cultivation.pillAttemptsMax())
 *                         'offlineHours' (+2h onto CONFIG.offline.baseCapH)
 *   badge               count of unowned nodes in unlocked ranks the player can
 *                       currently afford.
 *
 * =========================================================================
 * FORMULAS — Law
 * =========================================================================
 *   levelCost(level)    ceil(CONFIG.law.costBase * CONFIG.law.costGrowth^level)
 *                       in Law Shards, where `level` is the CURRENT level, i.e.
 *                       the price of the step level -> level+1.
 *                       = ceil(6 * 1.35^level); 6 at Lv0 .. 1797 at Lv19,
 *                       ~6.9K shards for the full ladder.
 *   Stats.provider      acc.allStat += lawLevel * CONFIG.law.statPerLevel  (+2%/lv)
 *                       acc.lawProc += lawLevel * CONFIG.law.procPerLevel  (+0.5%/lv)
 *   procOpts()          { law: S.player.law, power: 1 + Stats.bonus('lawProc') }
 *   proc cadence        the Law stirs on round CONFIG.law.procRound and every
 *                       procRound rounds after (4, 8, 12, ...). Combat owns the
 *                       actual effect, driven by CONFIG.law.effects[lawId].
 *   element wheel       CONFIG.combat.elementWheel: each element beats the NEXT
 *                       and wraps — blaze > wood > thunder > frost > blade > blaze
 *                       — for +/- CONFIG.combat.elementAdvantage (15%) damage.
 *
 * =========================================================================
 * BUS
 * =========================================================================
 *   Techs emits    techUnlock {rank, node}
 *   Law   emits    lawUpgrade {level}          (one per level gained)
 *   Law   consumes lawChosen {law}             (Cultivation owns the choice modal)
 *
 * =========================================================================
 * PUBLIC API (documented cross-system calls)
 * =========================================================================
 *   Techs.has(id)        -> Boolean. Does the player own technique node `id`?
 *   Techs.rankComplete(r)-> Boolean.
 *   Law.procOpts()       -> { law, power } | null.  THE object every fight in
 *                           the game should pass as Combat opts.lawProc:
 *                             Combat.simulate(allies, foes,
 *                                             { seed, lawProc: Law.procOpts() })
 *                           Returns null when no Law has been sworn yet, so a
 *                           falsy check is enough to mean "no Law proc".
 *   Law.procPower()      -> Number multiplier (1 + Stats.bonus('lawProc')), for
 *                           callers that only want the scalar.
 *   Law.level()          -> Number 0..CONFIG.law.maxLevel.
 * ------------------------------------------------------------------------ */
const Techs = {

  /* ------------------------------------------------------------------ state
     Runtime-only scratch; none of this is saved. */
  _n: null,          // patched node references
  _built: false,
  _wired: false,     // panel-root listener attached once, ever
  _rank: 0,          // selected rank (1-based); 0 == "pick a sensible default"
  _idx: null,        // { byId, byRank, ranks, slots } cache over DATA.techs
  _acc: 0,           // tick accumulator (seconds)
  _sig: '',          // affordability signature, so we only recompute on change

  /* ------------------------------------------------------------------- init */
  init() {
    this._ensure();

    try {
      if (typeof Stats !== 'undefined' && typeof Stats.provider === 'function') {
        Stats.provider((acc) => Techs.statBonus(acc));
      }
    } catch (e) { console.warn('[Techs] stats provider failed', e); }

    try {
      if (typeof UI !== 'undefined' && typeof UI.register === 'function') {
        UI.register('techs', () => Techs.render());
      }
    } catch (e) { console.warn('[Techs] panel register failed', e); }

    /* A new realm can open a whole rank; repaint and re-count the dot. */
    Bus.on('breakthrough', () => { Techs._sig = ''; Techs._syncBadge(); UI.dirty('techs'); });
    Bus.on('phaseUp', () => { Techs._syncBadge(); });

    this._syncBadge();
  },

  /* ------------------------------------------------------------------- tick
     Nothing accrues here — this only notices that the player's Tech Point or
     Tech Guide balance moved (they are earned all over the game) so the red dot
     and the affordability colouring stay honest. Closed-form and cheap; dtSec
     up to 3600 is irrelevant because we only sample once a second. */
  tick(dtSec) {
    if (!S || !S.created) return;
    this._acc += (Number(dtSec) || 0);
    if (this._acc < 1) return;
    this._acc = 0;

    const sig = this._affordSig();
    if (sig === this._sig) return;
    this._sig = sig;
    this._syncBadge();
    UI.dirty('techs');
  },

  /* ----------------------------------------------------------------- badges */
  badges() {
    if (!S || !S.player) return 0;
    const idx = this._index();
    const owned = this._ownedSet();
    let n = 0;
    for (let r = 1; r <= idx.ranks; r++) {
      if (!this.rankUnlocked(r)) continue;
      const list = idx.byRank[r] || [];
      for (let i = 0; i < list.length; i++) {
        const node = list[i];
        if (owned[node.id]) continue;
        if (this.canAfford(node)) n++;
      }
    }
    return n;
  },

  _syncBadge() {
    try { UI.badge('more.techs', this.badges()); } catch (e) { /* UI not ready */ }
  },

  /* ================================================================= PUBLIC */

  /* Does the player own this technique node? The documented cross-system call. */
  has(id) {
    if (!id) return false;
    const sc = this._ensure();
    if (!sc) return false;
    return sc.owned.indexOf(String(id)) >= 0;
  },

  /* All six nodes of `rank` owned -> that rank's stat nodes count double. */
  rankComplete(rank) {
    const idx = this._index();
    const list = idx.byRank[rank] || [];
    if (!list.length) return false;
    const owned = this._ownedSet();
    for (let i = 0; i < list.length; i++) if (!owned[list[i].id]) return false;
    return true;
  },

  rankUnlocked(rank) {
    const r = Math.floor(Number(rank)) || 0;
    if (r < 1) return false;
    const need = this.rankReqRealm(r);
    const have = (S && S.player) ? (Number(S.player.realm) || 0) : 0;
    return have >= need;
  },

  rankReqRealm(rank) {
    const tbl = (CONFIG.techs && CONFIG.techs.rankUnlockRealm) || [];
    const v = Number(tbl[(Math.floor(Number(rank)) || 1) - 1]);
    return Number.isFinite(v) ? v : 0;
  },

  /* Stats provider. Percentages fold into the (1 + techPct + ...) term; the two
     flat effect keys are added as whole integers. */
  statBonus(acc) {
    if (!acc) return;
    const sc = this._ensure();
    if (!sc) return;
    const idx = this._index();
    const mult = Number(CONFIG.techs && CONFIG.techs.completionBonusMult) || 1;

    /* Which ranks are complete? One pass, so the per-node loop stays flat. */
    const owned = this._ownedSet();
    const complete = Object.create(null);
    for (let r = 1; r <= idx.ranks; r++) {
      const list = idx.byRank[r] || [];
      if (!list.length) continue;
      let all = true;
      for (let i = 0; i < list.length; i++) { if (!owned[list[i].id]) { all = false; break; } }
      if (all) complete[r] = true;
    }

    for (let i = 0; i < sc.owned.length; i++) {
      const node = idx.byId[sc.owned[i]];
      if (!node || !node.key) continue;
      const key = String(node.key);
      const raw = Number(node.val) || 0;
      let add;
      if (node.kind === 'effect') {
        /* FLAT INTEGER channels — a +Pill Attempts node must really raise the
           daily cap, not add a fraction of a percent to it. */
        if (key === 'pillAttempts' || key === 'offlineHours') add = Math.round(raw);
        else add = raw;
      } else {
        add = raw * (complete[node.rank] ? mult : 1);
      }
      if (!add) continue;
      acc[key] = (Number(acc[key]) || 0) + add;
    }
  },

  /* ================================================================ HELPERS */

  _ensure() {
    if (!S) return null;
    if (!S.techs || typeof S.techs !== 'object') S.techs = { owned: [] };
    if (!Array.isArray(S.techs.owned)) S.techs.owned = [];
    return S.techs;
  },

  /* Lazily indexed view of DATA.techs. Content is static after boot, so this is
     built once; it rebuilds if the table length ever changes underneath us. */
  _index() {
    const table = Array.isArray(DATA.techs) ? DATA.techs : [];
    if (this._idx && this._idx.len === table.length) return this._idx;

    const byId = Object.create(null);
    const byRank = Object.create(null);
    let maxRank = Math.floor(Number(CONFIG.techs && CONFIG.techs.ranks)) || 0;
    let slots = Math.floor(Number(CONFIG.techs && CONFIG.techs.nodesPerRank)) || 0;

    for (let i = 0; i < table.length; i++) {
      const node = table[i];
      if (!node || !node.id) continue;
      byId[node.id] = node;
      const r = Math.floor(Number(node.rank)) || 1;
      if (!byRank[r]) byRank[r] = [];
      byRank[r].push(node);
      if (r > maxRank) maxRank = r;
    }
    for (const k in byRank) {
      byRank[k].sort((a, b) => (Number(a.idx) || 0) - (Number(b.idx) || 0));
      if (byRank[k].length > slots) slots = byRank[k].length;
    }
    if (maxRank < 1) maxRank = 1;
    if (maxRank > 64) maxRank = 64;
    if (slots < 1) slots = 1;
    if (slots > 12) slots = 12;

    this._idx = { len: table.length, byId, byRank, ranks: maxRank, slots };
    return this._idx;
  },

  /* Owned ids as a lookup object — the provider and the renderer both want it. */
  _ownedSet() {
    const sc = this._ensure();
    const out = Object.create(null);
    if (!sc) return out;
    for (let i = 0; i < sc.owned.length; i++) out[sc.owned[i]] = true;
    return out;
  },

  _cost(node) {
    const c = (node && node.cost) || {};
    const t = Math.max(0, Math.floor(Number(c.tech) || 0));
    const g = Math.max(0, Math.floor(Number(c.guide) || 0));
    return { tech: t, guide: g };
  },

  canAfford(node) {
    const c = this._cost(node);
    try { return Econ.can({ tech: c.tech, guide: c.guide }); }
    catch (e) { return false; }
  },

  _affordSig() {
    const cur = (S && S.cur) || {};
    const sc = this._ensure();
    return (Number(cur.tech) || 0) + '/' + (Number(cur.guide) || 0) + '/' +
      ((S && S.player && S.player.realm) | 0) + '/' + (sc ? sc.owned.length : 0);
  },

  _rankCount() { return this._index().ranks; },

  /* Rank the panel opens on: the lowest unlocked rank still missing a node,
     else the highest unlocked rank, else rank 1. */
  _defaultRank() {
    const idx = this._index();
    let highest = 1;
    for (let r = 1; r <= idx.ranks; r++) {
      if (!this.rankUnlocked(r)) continue;
      highest = r;
      if (!this.rankComplete(r)) return r;
    }
    return highest;
  },

  _selected() {
    const idx = this._index();
    let r = Math.floor(Number(this._rank)) || 0;
    if (r < 1 || r > idx.ranks) { r = this._defaultRank(); this._rank = r; }
    return r;
  },

  /* Human labels for every Stats.bonus() key a node can carry. */
  KEY_LABELS: {
    aura: 'Aura', respiraExp: 'Respira EXP', pillExp: 'Pill EXP',
    pillAttempts: 'Pill Attempt', btChance: 'Breakthrough Chance',
    expedition: 'Expedition Yield', alchemyQuality: 'Pill Quality',
    forgeQuality: 'Forge Quality', curioPower: 'Curio Power',
    lawProc: 'Law Power', offlineHours: 'Offline Cap',
    allStat: 'All Stats', hp: 'HP', patk: 'Physical ATK', matk: 'Magic ATK',
    pdef: 'Physical DEF', mdef: 'Magic DEF', spd: 'Speed',
    crit: 'Crit Chance', critDmg: 'Crit Damage', lifesteal: 'Lifesteal',
    dodge: 'Dodge', shield: 'Battle Shield', thrall: 'Thrall Power',
  },

  /* Percent with a decimal only when one is actually needed. */
  _pct(v) {
    const x = Number(v) || 0;
    const p = Math.round(x * 10000) / 100;
    const dp = (Math.abs(p - Math.round(p)) < 1e-9) ? 0 : 1;
    return Fmt.pct(x, dp);
  },

  /* "+8% Pill EXP" / "+1 Pill Attempt per day" / "+2h Offline Cap". */
  _grantText(node, doubled) {
    if (!node) return '';
    const key = String(node.key || '');
    const raw = Number(node.val) || 0;
    const name = this.KEY_LABELS[key] || key;

    if (key === 'pillAttempts') {
      const n = Math.round(raw);
      return '+' + n + ' Pill Attempt' + (n === 1 ? '' : 's') + ' per day';
    }
    if (key === 'offlineHours') {
      const n = Math.round(raw);
      return '+' + n + 'h Offline Cap';
    }
    const mult = Number(CONFIG.techs && CONFIG.techs.completionBonusMult) || 1;
    const v = doubled ? raw * mult : raw;
    return '+' + this._pct(v) + ' ' + name;
  },

  _realmName(i) {
    const row = (DATA.realms || [])[Math.floor(Number(i)) || 0];
    return (row && row.name) ? row.name : ('Realm ' + (Math.floor(Number(i)) || 0));
  },

  _rankEra(rank) {
    const start = Math.floor(Number(CONFIG.techs && CONFIG.techs.lawRankStart)) || 11;
    return rank >= start ? 'Law era' : 'Mortal era';
  },

  _esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  /* ================================================================== BUY */

  buy(id) {
    const sc = this._ensure();
    if (!sc) return false;
    const idx = this._index();
    const node = idx.byId[String(id)];
    if (!node) { UI.toast('That technique is not in any manual you own.', 'bad'); return false; }
    if (this.has(node.id)) return false;

    if (!this.rankUnlocked(node.rank)) {
      UI.toast('Rank ' + node.rank + ' opens at ' + this._realmName(this.rankReqRealm(node.rank)) + '.', 'bad');
      return false;
    }

    const c = this._cost(node);
    if (!Econ.can({ tech: c.tech, guide: c.guide })) {
      const missing = [];
      if (!Econ.can('tech', c.tech)) missing.push(Fmt.n(c.tech - Econ.have('tech')) + ' Tech Points');
      if (!Econ.can('guide', c.guide)) missing.push(Fmt.n(c.guide - Econ.have('guide')) + ' Tech Guides');
      UI.toast('Short by ' + missing.join(' and ') + '.', 'bad');
      return false;
    }

    const confirmOn = !!(S.settings && S.settings.confirmSpend);
    if (confirmOn) {
      const price = Econ.icon('tech') + ' ' + Fmt.n(c.tech) +
        (c.guide > 0 ? ('  ' + Econ.icon('guide') + ' ' + Fmt.n(c.guide)) : '');
      UI.confirm('Learn ' + node.name + '?',
        price + '\n' + this._grantText(node, false) + '\nTechniques are permanent.',
        () => Techs._commit(node));
      return true;
    }
    return this._commit(node);
  },

  _commit(node) {
    const sc = this._ensure();
    if (!sc || this.has(node.id)) return false;
    const c = this._cost(node);

    /* Atomic: the object form of spend takes both lines or neither. */
    if (!Econ.spend({ tech: c.tech, guide: c.guide })) {
      UI.toast('The price moved while you were deciding.', 'bad');
      return false;
    }

    sc.owned.push(node.id);
    const nowComplete = this.rankComplete(node.rank);

    Bus.emit('techUnlock', { rank: node.rank, node: node });
    try { Stats.invalidate(); } catch (e) { /* stats may not be ready */ }

    UI.toast(node.name + ' — ' + this._grantText(node, nowComplete && node.kind === 'stat'), 'good');
    if (nowComplete) {
      UI.flash('gold');
      UI.toast('Rank ' + node.rank + ' complete — its stat techniques now count double.', 'gold');
    }

    this._sig = this._affordSig();
    this._syncBadge();
    UI.dirty('techs', 'cultivate', 'more');
    try { UI.refreshBadges && UI.refreshBadges(); } catch (e) { /* ignore */ }
    try { Save.save(); } catch (e) { /* ignore */ }
    return true;
  },

  /* Buy every affordable, unowned node in the selected rank, cheapest first. */
  _buyRank(rank) {
    const idx = this._index();
    const list = (idx.byRank[rank] || []).slice().sort(
      (a, b) => this._cost(a).tech - this._cost(b).tech);
    if (!this.rankUnlocked(rank)) {
      UI.toast('Rank ' + rank + ' opens at ' + this._realmName(this.rankReqRealm(rank)) + '.', 'bad');
      return;
    }
    let got = 0;
    for (let i = 0; i < list.length; i++) {
      const node = list[i];
      if (this.has(node.id)) continue;
      if (!this.canAfford(node)) continue;
      if (this._commit(node)) got++;
    }
    if (!got) UI.toast('Nothing in Rank ' + rank + ' is affordable yet.', 'bad');
  },

  /* ================================================================= RENDER */

  render() {
    if (UI.lock('techs', CONFIG.unlocks.techs)) { this._built = false; this._n = null; return; }
    if (!this._ensure()) return;
    if (!this._built) this._build();
    if (!this._n) return;

    const n = this._n;
    const idx = this._index();
    const owned = this._ownedSet();
    const rank = this._selected();
    const totalNodes = Object.keys(idx.byId).length;

    /* --- balances + summary --- */
    n.tech.textContent = Fmt.n(Econ.have('tech'));
    n.guide.textContent = Fmt.n(Econ.have('guide'));

    let learned = 0;
    for (let i = 0; i < S.techs.owned.length; i++) if (idx.byId[S.techs.owned[i]]) learned++;
    let done = 0;
    for (let r = 1; r <= idx.ranks; r++) if (this.rankComplete(r)) done++;
    n.summary.textContent = 'Learned ' + learned + ' / ' + totalNodes +
      ' · ' + done + ' of ' + idx.ranks + ' ranks complete';
    const frac = totalNodes > 0 ? U.clamp(learned / totalNodes, 0, 1) : 0;
    n.bar.style.width = (frac * 100).toFixed(1) + '%';

    /* --- rank strip --- */
    for (let r = 1; r <= idx.ranks; r++) {
      const chip = n.chips[r];
      if (!chip) continue;
      const list = idx.byRank[r] || [];
      let have = 0;
      for (let i = 0; i < list.length; i++) if (owned[list[i].id]) have++;
      const complete = list.length > 0 && have === list.length;
      const unlocked = this.rankUnlocked(r);
      chip.label.textContent = 'R' + r;
      chip.count.textContent = complete ? '★' : (have + '/' + (list.length || 0));
      chip.count.className = complete ? 'tiny gold mono' : (unlocked ? 'tiny mono' : 'tiny muted mono');
      chip.el.classList.toggle('active', r === rank);
      chip.el.classList.toggle('locked', !unlocked);
    }

    /* --- selected rank header --- */
    const list = idx.byRank[rank] || [];
    const unlocked = this.rankUnlocked(rank);
    const complete = this.rankComplete(rank);
    n.rankName.textContent = 'Rank ' + rank;
    if (!unlocked) {
      n.rankSub.textContent = 'Sealed until ' + this._realmName(this.rankReqRealm(rank)) + '.';
      n.rankSub.className = 'tiny bad';
    } else {
      n.rankSub.textContent = this._rankEra(rank) + ' · ' + list.length + ' techniques';
      n.rankSub.className = 'tiny muted';
    }
    n.rankFlag.hidden = !complete;
    if (complete) n.rankFlag.textContent = '★ Rank complete: stat nodes doubled';

    /* --- the six node cards --- */
    for (let i = 0; i < n.cards.length; i++) {
      const card = n.cards[i];
      const node = list[i];
      if (!node) { card.el.hidden = true; continue; }
      card.el.hidden = false;

      const isOwned = !!owned[node.id];
      const afford = this.canAfford(node);
      const c = this._cost(node);
      const isStat = node.kind !== 'effect';
      const boosted = isStat && complete;

      card.name.textContent = node.name || node.id;
      card.flavor.textContent = node.flavor || '';
      card.grant.textContent = this._grantText(node, boosted) + (boosted ? ' ★' : '');
      card.grant.className = boosted ? 'chip gold' : (isStat ? 'chip' : 'chip jade');

      card.el.classList.toggle('bg-gold', isOwned);
      card.el.classList.toggle('locked', !unlocked && !isOwned);

      if (isOwned) {
        card.state.hidden = false;
        card.state.textContent = '✓ Learned';
        card.state.className = 'chip gold';
        card.cost.textContent = isStat
          ? (boosted ? 'Counting double.' : 'Counted in your stats.')
          : 'Active.';
        card.cost.className = 'tiny muted';
        card.btn.hidden = true;
      } else {
        card.state.hidden = true;
        card.cost.textContent = Econ.icon('tech') + ' ' + Fmt.n(c.tech) +
          (c.guide > 0 ? ('  ' + Econ.icon('guide') + ' ' + Fmt.n(c.guide)) : '');
        card.cost.className = afford ? 'tiny mono good' : 'tiny mono bad';
        card.btn.hidden = false;
        card.btn.dataset.id = node.id;
        if (!unlocked) {
          card.btn.disabled = true;
          card.btn.textContent = '🔒 ' + this._realmName(this.rankReqRealm(rank));
          card.btn.className = 'btn sm';
        } else {
          card.btn.disabled = !afford;
          card.btn.textContent = 'Learn';
          card.btn.className = afford ? 'btn sm primary' : 'btn sm';
        }
      }
    }

    /* --- rank footer --- */
    let affordable = 0;
    for (let i = 0; i < list.length; i++) {
      if (!owned[list[i].id] && this.canAfford(list[i])) affordable++;
    }
    n.buyAll.disabled = !unlocked || affordable === 0;
    n.buyAll.textContent = affordable > 0 ? ('Learn All Affordable (' + affordable + ')') : 'Learn All Affordable';
    n.foot.textContent = complete
      ? 'Every stat technique in this rank is worth double.'
      : (unlocked
        ? 'Own all ' + list.length + ' to double this rank’s stat techniques.'
        : 'Tech Points come from Respira, the Extractor and expeditions.');
  },

  _build() {
    const root = UI.panel('techs');
    if (!root) return;
    root.innerHTML = '';

    const scroll = UI.el('div', 'scroll');
    scroll.innerHTML = `
      <div class="card">
        <div class="row between">
          <div class="col" style="min-width:0">
            <div class="h1 serif">Techniques</div>
            <div class="tiny muted" id="tqSummary">—</div>
          </div>
        </div>
        <div class="grid2" style="margin-top:8px">
          <div class="stat"><div class="lbl">${this._esc(Econ.icon('tech'))} Tech Points</div>
            <div class="val mono gold" id="tqTech">0</div></div>
          <div class="stat"><div class="lbl">${this._esc(Econ.icon('guide'))} Tech Guides</div>
            <div class="val mono jade" id="tqGuide">0</div></div>
        </div>
        <div class="meter" style="margin-top:8px"><i id="tqBar"></i></div>
      </div>

      <div class="tabs" id="tqRanks"></div>

      <div class="card tight">
        <div class="row between">
          <div class="col" style="min-width:0">
            <div class="h2 serif" id="tqRankName">Rank 1</div>
            <div class="tiny muted" id="tqRankSub">—</div>
          </div>
          <span class="chip gold" id="tqRankFlag" hidden>★ Rank complete</span>
        </div>
      </div>

      <div class="grid2" id="tqGrid"></div>

      <div class="sec">
        <button class="btn wide" data-act="buyAll" id="tqBuyAll">Learn All Affordable</button>
        <div class="tiny muted" id="tqFoot" style="margin-top:6px">—</div>
      </div>
      <div class="safe-b"></div>`;

    root.appendChild(scroll);

    const idx = this._index();

    /* rank chips — built once, patched forever after */
    const strip = scroll.querySelector('#tqRanks');
    const chips = [];
    for (let r = 1; r <= idx.ranks; r++) {
      const b = UI.el('button', 'tab');
      b.dataset.act = 'rank';
      b.dataset.idx = String(r);
      const label = UI.el('b', '', 'R' + r);
      const count = UI.el('span', 'tiny mono', '0/6');
      b.appendChild(label);
      b.appendChild(count);
      strip.appendChild(b);
      chips[r] = { el: b, label, count };
    }

    /* node cards — a fixed set of slots, hidden when a rank has fewer nodes */
    const grid = scroll.querySelector('#tqGrid');
    const cards = [];
    for (let i = 0; i < idx.slots; i++) {
      const card = UI.el('div', 'card tight');
      card.innerHTML = `
        <div class="row between">
          <div class="h3" data-f="name">—</div>
          <span class="chip gold" data-f="state" hidden>✓</span>
        </div>
        <div class="tiny muted" data-f="flavor" style="margin-top:4px">—</div>
        <div class="row" style="margin-top:6px"><span class="chip" data-f="grant">—</span></div>
        <div class="row between" style="margin-top:8px">
          <span class="tiny mono" data-f="cost">—</span>
          <button class="btn sm" data-act="buy" data-id="">Learn</button>
        </div>`;
      grid.appendChild(card);
      cards.push({
        el: card,
        name: card.querySelector('[data-f="name"]'),
        state: card.querySelector('[data-f="state"]'),
        flavor: card.querySelector('[data-f="flavor"]'),
        grant: card.querySelector('[data-f="grant"]'),
        cost: card.querySelector('[data-f="cost"]'),
        btn: card.querySelector('[data-act="buy"]'),
      });
    }

    this._n = {
      root,
      summary: scroll.querySelector('#tqSummary'),
      tech: scroll.querySelector('#tqTech'),
      guide: scroll.querySelector('#tqGuide'),
      bar: scroll.querySelector('#tqBar'),
      strip,
      chips,
      rankName: scroll.querySelector('#tqRankName'),
      rankSub: scroll.querySelector('#tqRankSub'),
      rankFlag: scroll.querySelector('#tqRankFlag'),
      cards,
      buyAll: scroll.querySelector('#tqBuyAll'),
      foot: scroll.querySelector('#tqFoot'),
    };
    this._built = true;

    if (this._wired) return;
    this._wired = true;
    root.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-act]');
      if (!b || b.disabled) return;
      const act = b.dataset.act;
      if (act === 'rank') {
        const r = parseInt(b.dataset.idx, 10) || 1;
        Techs._rank = r;
        UI.dirty('techs');
        UI.renderNow('techs');
        try { b.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) { /* ignore */ }
        return;
      }
      if (act === 'buy') { Techs.buy(b.dataset.id); UI.dirty('techs'); return; }
      if (act === 'buyAll') { Techs._buyRank(Techs._selected()); UI.dirty('techs'); return; }
    });
  },
};


/* ---------------------------------------------------------------------------
 * Law — see the shared header above for every formula and the public API.
 * ------------------------------------------------------------------------ */
const Law = {

  _n: null,
  _built: false,
  _wired: false,
  _acc: 0,
  _sig: '',

  /* ------------------------------------------------------------------- init */
  init() {
    this._ensure();

    try {
      if (typeof Stats !== 'undefined' && typeof Stats.provider === 'function') {
        Stats.provider((acc) => Law.statBonus(acc));
      }
    } catch (e) { console.warn('[Law] stats provider failed', e); }

    try {
      if (typeof UI !== 'undefined' && typeof UI.register === 'function') {
        UI.register('law', () => Law.render());
      }
    } catch (e) { console.warn('[Law] panel register failed', e); }

    /* Cultivation owns the choice modal during the Voidbreak ascension; we just
       react to the outcome. */
    Bus.on('lawChosen', () => {
      Law._sig = '';
      Law._syncBadge();
      UI.dirty('law', 'more');
      try { UI.refreshBadges && UI.refreshBadges(); } catch (e) { /* ignore */ }
    });
    Bus.on('breakthrough', () => { Law._sig = ''; Law._syncBadge(); UI.dirty('law'); });

    this._syncBadge();
  },

  /* Nothing accrues; this only watches the Law Shard balance so the dot and the
     affordability colouring stay truthful. Sampled once a second. */
  tick(dtSec) {
    if (!S || !S.created) return;
    this._acc += (Number(dtSec) || 0);
    if (this._acc < 1) return;
    this._acc = 0;

    const sig = Econ.have('lawShard') + '/' + this.level() + '/' + (S.player.law || '-');
    if (sig === this._sig) return;
    this._sig = sig;
    this._syncBadge();
    UI.dirty('law');
  },

  badges() {
    if (!S || !S.player) return 0;
    if ((Number(S.player.realm) || 0) < this._gate()) return 0;
    if (!S.player.law) return 0;
    const lvl = this.level();
    if (lvl >= this.maxLevel()) return 0;
    return Econ.can('lawShard', this.levelCost(lvl)) ? 1 : 0;
  },

  _syncBadge() {
    try { UI.badge('more.law', this.badges()); } catch (e) { /* UI not ready */ }
  },

  /* ================================================================= PUBLIC */

  /* The object every fight should hand Combat as opts.lawProc:
       Combat.simulate(allies, foes, { seed, lawProc: Law.procOpts() })
     `power` scales whatever CONFIG.law.effects[law] does. Null when unsworn. */
  procOpts() {
    const law = (S && S.player && S.player.law) ? String(S.player.law) : null;
    if (!law) return null;
    return { law: law, power: this.procPower() };
  },

  /* 1 + Stats.bonus('lawProc') — Law levels, rank 11+ techs and curios feed it. */
  procPower() {
    let b = 0;
    try { b = Number(Stats.bonus('lawProc')) || 0; } catch (e) { b = 0; }
    const p = 1 + b;
    return Number.isFinite(p) && p > 0 ? p : 1;
  },

  level() {
    if (!S || !S.player) return 0;
    const v = Math.floor(Number(S.player.lawLevel) || 0);
    return U.clamp(Number.isFinite(v) ? v : 0, 0, this.maxLevel());
  },

  maxLevel() {
    const v = Math.floor(Number(CONFIG.law && CONFIG.law.maxLevel) || 0);
    return v > 0 ? v : 20;
  },

  /* Law Shard price of the step `level` -> `level + 1`. */
  levelCost(level) {
    const c = CONFIG.law || {};
    const base = Number(c.costBase) || 6;
    const growth = Number(c.costGrowth) || 1.35;
    const l = Math.max(0, Math.floor(Number(level) || 0));
    const v = Math.ceil(base * Math.pow(growth, l));
    return Number.isFinite(v) && v > 0 ? v : 1;
  },

  /* Stats provider: flat ladder, no completion gimmicks. */
  statBonus(acc) {
    if (!acc || !S || !S.player || !S.player.law) return;
    const lvl = this.level();
    if (lvl <= 0) return;
    const c = CONFIG.law || {};
    acc.allStat = (Number(acc.allStat) || 0) + lvl * (Number(c.statPerLevel) || 0);
    acc.lawProc = (Number(acc.lawProc) || 0) + lvl * (Number(c.procPerLevel) || 0);
  },

  /* ================================================================ HELPERS */

  _ensure() {
    if (!S || !S.player) return null;
    if (typeof S.player.law !== 'string' || !S.player.law) {
      if (S.player.law !== null) S.player.law = null;
    }
    if (typeof S.player.lawLevel !== 'number' || !Number.isFinite(S.player.lawLevel)) {
      S.player.lawLevel = 0;
    }
    S.player.lawLevel = U.clamp(Math.floor(S.player.lawLevel), 0, this.maxLevel());
    return S.player;
  },

  _gate() {
    const u = CONFIG.unlocks || {};
    if (typeof u.law === 'number') return u.law;
    return Number(CONFIG.law && CONFIG.law.unlockRealm) || 6;
  },

  _law() {
    if (!S || !S.player || !S.player.law) return null;
    const id = String(S.player.law);
    if (typeof DATAX !== 'undefined' && DATAX.lawById && DATAX.lawById[id]) return DATAX.lawById[id];
    const list = DATA.laws || [];
    for (let i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return list[i];
    return null;
  },

  /* Short element identity for the wheel — DATA.laws first, then a fallback so
     the diagram still reads if the content file is missing. */
  ELEM: {
    blaze: { emoji: '🔥', name: 'Blaze' },
    wood: { emoji: '🌿', name: 'Wood' },
    thunder: { emoji: '⚡', name: 'Thunder' },
    frost: { emoji: '❄️', name: 'Frost' },
    blade: { emoji: '🗡️', name: 'Blade' },
  },

  _elem(id) {
    const key = String(id || '');
    const base = this.ELEM[key] || { emoji: '✨', name: key || '—' };
    const row = (typeof DATAX !== 'undefined' && DATAX.lawById) ? DATAX.lawById[key] : null;
    return { id: key, emoji: (row && row.emoji) || base.emoji, name: base.name };
  },

  _wheel() {
    const w = (CONFIG.combat && CONFIG.combat.elementWheel) || [];
    return Array.isArray(w) && w.length ? w.slice() : ['blaze', 'wood', 'thunder', 'frost', 'blade'];
  },

  _beats(id) {
    const w = this._wheel();
    const i = w.indexOf(String(id));
    if (i < 0) return null;
    return w[(i + 1) % w.length];
  },

  _beatenBy(id) {
    const w = this._wheel();
    const i = w.indexOf(String(id));
    if (i < 0) return null;
    return w[(i - 1 + w.length) % w.length];
  },

  _pct(v) {
    const x = Number(v) || 0;
    const p = Math.round(x * 10000) / 100;
    const dp = (Math.abs(p - Math.round(p)) < 1e-9) ? 0 : 1;
    return Fmt.pct(x, dp);
  },

  _esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  /* ================================================================ UPGRADE */

  upgrade(times) {
    if (!this._ensure()) return false;
    if (!S.player.law) { UI.toast('You have not sworn a Law yet.', 'bad'); return false; }

    const want = Math.max(1, Math.floor(Number(times) || 1));
    const max = this.maxLevel();
    let got = 0;

    for (let i = 0; i < want; i++) {
      const lvl = this.level();
      if (lvl >= max) break;
      const cost = this.levelCost(lvl);
      if (!Econ.spend('lawShard', cost)) break;
      S.player.lawLevel = lvl + 1;
      Bus.emit('lawUpgrade', { level: S.player.lawLevel });
      got++;
    }

    if (!got) {
      if (this.level() >= max) UI.toast('Your Law is already whole.', 'info');
      else {
        const need = this.levelCost(this.level()) - Econ.have('lawShard');
        UI.toast('Short by ' + Fmt.n(need) + ' Law Shards.', 'bad');
      }
      return false;
    }

    try { Stats.invalidate(); } catch (e) { /* ignore */ }
    const c = CONFIG.law || {};
    const lvl = this.level();
    UI.toast('Law deepened to Lv ' + lvl + ' — ' +
      this._pct(lvl * (Number(c.statPerLevel) || 0)) + ' all stats.', 'gold');
    if (lvl >= max) { UI.flash('gold'); UI.toast('The Law is complete. Nothing above you argues any more.', 'gold'); }

    this._sig = '';
    this._syncBadge();
    UI.dirty('law', 'cultivate', 'more');
    try { UI.refreshBadges && UI.refreshBadges(); } catch (e) { /* ignore */ }
    try { Save.save(); } catch (e) { /* ignore */ }
    return true;
  },

  _upgradeMax() {
    const max = this.maxLevel();
    let n = 0;
    let shards = Econ.have('lawShard');
    for (let l = this.level(); l < max; l++) {
      const c = this.levelCost(l);
      if (shards < c) break;
      shards -= c;
      n++;
    }
    if (n <= 0) { this.upgrade(1); return; }   // reuse the "short by" messaging
    this.upgrade(n);
  },

  /* ================================================================= RENDER */

  render() {
    if (UI.lock('law', this._gate())) { this._built = false; this._n = null; return; }
    if (!this._ensure()) return;
    if (!this._built) this._build();
    if (!this._n) return;

    const n = this._n;
    const law = this._law();
    const sworn = !!(S.player.law && law);

    n.preview.style.display = sworn ? 'none' : '';
    n.main.style.display = sworn ? '' : 'none';

    if (!sworn) {
      this._renderPreview();
      this._renderWheel(null);
      return;
    }

    const c = CONFIG.law || {};
    const lvl = this.level();
    const max = this.maxLevel();

    /* --- identity --- */
    n.emoji.textContent = law.emoji || '✨';
    n.name.textContent = law.name || law.id;
    if (law.color) { n.name.style.color = law.color; n.emojiWrap.style.borderColor = law.color; }
    n.desc.textContent = law.desc || '';
    n.cadence.textContent = 'The Law stirs on round ' + (Math.floor(Number(c.procRound)) || 4) +
      ', and every ' + (Math.floor(Number(c.procRound)) || 4) + ' rounds after.';

    /* --- chips --- */
    n.chipLvl.textContent = 'Lv ' + lvl + ' / ' + max;
    n.chipStat.textContent = '+' + this._pct(lvl * (Number(c.statPerLevel) || 0)) + ' all stats';
    n.chipProc.textContent = 'Law power ×' + Fmt.n1(this.procPower());
    n.chipShard.textContent = Econ.icon('lawShard') + ' ' + Fmt.n(Econ.have('lawShard'));

    const frac = max > 0 ? U.clamp(lvl / max, 0, 1) : 0;
    n.bar.style.width = (frac * 100).toFixed(1) + '%';

    /* --- the 20 level tiles --- */
    for (let i = 0; i < n.tiles.length; i++) {
      const t = n.tiles[i];
      const level = i + 1;              // the level this tile represents
      const owned = lvl >= level;
      const isNext = lvl === level - 1;
      const cost = this.levelCost(level - 1);
      const afford = Econ.can('lawShard', cost);

      t.lvl.textContent = 'Lv ' + level;
      t.el.classList.toggle('bg-gold', owned);
      t.el.classList.toggle('bg-blue', !owned && isNext);
      t.el.classList.toggle('locked', !owned && !isNext);

      if (owned) {
        t.cost.textContent = '✓';
        t.cost.className = 'tiny gold mono';
        t.el.removeAttribute('data-act');
      } else {
        t.cost.textContent = Fmt.n(cost);
        t.cost.className = isNext ? (afford ? 'tiny good mono' : 'tiny bad mono') : 'tiny muted mono';
        if (isNext) t.el.dataset.act = 'up1';
        else t.el.removeAttribute('data-act');
      }
    }

    /* --- buttons --- */
    if (lvl >= max) {
      n.up1.disabled = true;
      n.up1.textContent = 'Law Complete';
      n.upMax.disabled = true;
      n.upMax.textContent = 'Nothing Left';
      n.foot.textContent = 'Every level taken. ' + this._pct(max * (Number(c.statPerLevel) || 0)) +
        ' all stats and ' + this._pct(max * (Number(c.procPerLevel) || 0)) + ' proc power, permanently.';
    } else {
      const cost = this.levelCost(lvl);
      const afford = Econ.can('lawShard', cost);
      n.up1.disabled = !afford;
      n.up1.className = afford ? 'btn primary wide' : 'btn wide';
      n.up1.textContent = 'Deepen — ' + Econ.icon('lawShard') + ' ' + Fmt.n(cost);
      let steps = 0;
      let shards = Econ.have('lawShard');
      for (let l = lvl; l < max; l++) {
        const cc = this.levelCost(l);
        if (shards < cc) break;
        shards -= cc;
        steps++;
      }
      n.upMax.disabled = steps < 2;
      n.upMax.textContent = steps > 1 ? ('Deepen ×' + steps) : 'Deepen ×Max';
      n.foot.textContent = 'Each level: +' + this._pct(Number(c.statPerLevel) || 0) +
        ' all stats and +' + this._pct(Number(c.procPerLevel) || 0) +
        ' Law proc power. Law Shards drop in spirit-era zones, the Spire and the Tide.';
    }

    this._renderWheel(S.player.law);
  },

  _renderPreview() {
    const n = this._n;
    const laws = DATA.laws || [];
    const sig = 'p' + laws.length;
    if (n.previewSig === sig) return;
    n.previewSig = sig;

    let html = '';
    for (let i = 0; i < laws.length; i++) {
      const l = laws[i];
      if (!l) continue;
      const col = l.color ? (' style="color:' + this._esc(l.color) + '"') : '';
      html += '<div class="card tight"><div class="row">' +
        '<span class="unit-emoji">' + this._esc(l.emoji || '✨') + '</span>' +
        '<div class="col" style="min-width:0">' +
        '<div class="h3"' + col + '>' + this._esc(l.name || l.id) + '</div>' +
        '<div class="tiny muted">' + this._esc(l.desc || '') + '</div>' +
        '</div></div></div>';
    }
    if (!html) html = '<div class="empty">The doctrines have not been written down yet.</div>';
    n.previewList.innerHTML = html;
  },

  /* The element advantage wheel, drawn from CONFIG.combat.elementWheel. */
  _renderWheel(mine) {
    const n = this._n;
    const w = this._wheel();
    const adv = Number(CONFIG.combat && CONFIG.combat.elementAdvantage) || 0.15;
    const sig = w.join(',') + '|' + (mine || '-') + '|' + adv;
    if (n.wheelSig === sig) return;
    n.wheelSig = sig;

    /* The ring itself: chips joined by arrows, wrapping cleanly at 360px. */
    let ring = '';
    for (let i = 0; i < w.length; i++) {
      const e = this._elem(w[i]);
      const cls = (mine && e.id === mine) ? 'chip gold' : 'chip';
      ring += '<span class="' + cls + '">' + this._esc(e.emoji) + ' ' + this._esc(e.name) + '</span>';
      ring += '<span class="tiny muted">➜</span>';
    }
    const first = this._elem(w[0]);
    ring += '<span class="chip">' + this._esc(first.emoji) + '</span>';
    n.wheelRing.innerHTML = ring;

    /* Every pairing spelled out, so nobody has to squint at arrows. */
    let rows = '';
    for (let i = 0; i < w.length; i++) {
      const a = this._elem(w[i]);
      const b = this._elem(w[(i + 1) % w.length]);
      const hot = mine && (a.id === mine || b.id === mine);
      rows += '<div class="kv"><span class="k">' +
        (hot ? '<b>' : '') + this._esc(a.emoji + ' ' + a.name) + (hot ? '</b>' : '') +
        ' beats ' + this._esc(b.emoji + ' ' + b.name) + '</span>' +
        '<span class="v good mono">+' + this._pct(adv) + '</span></div>';
    }
    n.wheelRows.innerHTML = rows;

    if (mine) {
      const me = this._elem(mine);
      const strong = this._elem(this._beats(mine));
      const weak = this._elem(this._beatenBy(mine));
      n.wheelMine.innerHTML =
        'Your ' + this._esc(me.emoji + ' ' + me.name) + ' deals <b class="good">+' + this._pct(adv) +
        '</b> to ' + this._esc(strong.emoji + ' ' + strong.name) +
        ' and takes <b class="bad">+' + this._pct(adv) + '</b> from ' +
        this._esc(weak.emoji + ' ' + weak.name) + '.';
      n.wheelMine.hidden = false;
    } else {
      n.wheelMine.hidden = true;
    }
  },

  _build() {
    const root = UI.panel('law');
    if (!root) return;
    /* Keep the shell's #lock-law placeholder — UI.lock owns it. */
    const lock = root.querySelector('#lock-law');
    root.innerHTML = '';
    if (lock) root.appendChild(lock);

    const scroll = UI.el('div', 'scroll');
    scroll.innerHTML = `
      <div id="lwPreview">
        <div class="sec">
          <div class="h1 serif">The Five Laws</div>
          <p class="muted tiny">A Law is not learned. It is sworn — once, at the moment you break the
          vault of Voidbreak and something on the other side agrees to listen. The ascension itself
          puts the five in front of you; until then, read and decide quietly.</p>
        </div>
        <div class="col" id="lwPreviewList"></div>
      </div>

      <div id="lwMain">
        <div class="card">
          <div class="row">
            <span class="pill-chip" id="lwEmojiWrap"><span id="lwEmoji">✨</span></span>
            <div class="col" style="min-width:0">
              <div class="h1 serif" id="lwName">—</div>
              <div class="tiny muted" id="lwDesc">—</div>
            </div>
          </div>
          <div class="tiny muted" id="lwCadence" style="margin-top:6px">—</div>
          <div class="row wrap" style="margin-top:8px">
            <span class="chip realm" id="lwChipLvl">Lv 0 / 20</span>
            <span class="chip jade" id="lwChipStat">—</span>
            <span class="chip gold" id="lwChipProc">—</span>
            <span class="chip" id="lwChipShard">—</span>
          </div>
          <div class="meter" style="margin-top:8px"><i id="lwBar"></i></div>
        </div>

        <div class="sec">
          <div class="sec-title">Depth of the Law</div>
          <div class="grid4" id="lwTiles"></div>
          <div class="col" style="margin-top:10px">
            <button class="btn primary wide" data-act="up1" id="lwUp1">Deepen</button>
            <button class="btn ghost wide" data-act="upMax" id="lwUpMax" style="margin-top:6px">Deepen ×Max</button>
          </div>
          <div class="tiny muted" id="lwFoot" style="margin-top:6px">—</div>
        </div>
      </div>

      <div class="sec">
        <div class="sec-title">Element Advantage</div>
        <div class="card tight">
          <div class="row wrap" id="lwWheelRing"></div>
          <div class="divider"></div>
          <div id="lwWheelRows"></div>
          <div class="tiny" id="lwWheelMine" style="margin-top:8px" hidden></div>
          <div class="tiny muted" style="margin-top:6px">Advantage changes damage only — it never
          changes who acts first.</div>
        </div>
      </div>
      <div class="safe-b"></div>`;

    root.appendChild(scroll);

    /* level tiles — CONFIG.law.maxLevel of them, built once */
    const grid = scroll.querySelector('#lwTiles');
    const tiles = [];
    const max = this.maxLevel();
    for (let i = 0; i < max; i++) {
      const t = UI.el('div', 'stat');
      t.dataset.idx = String(i + 1);
      const lvl = UI.el('div', 'lbl', 'Lv ' + (i + 1));
      const cost = UI.el('div', 'tiny muted mono', '0');
      t.appendChild(lvl);
      t.appendChild(cost);
      grid.appendChild(t);
      tiles.push({ el: t, lvl, cost });
    }

    this._n = {
      root,
      preview: scroll.querySelector('#lwPreview'),
      previewList: scroll.querySelector('#lwPreviewList'),
      previewSig: '',
      main: scroll.querySelector('#lwMain'),
      emoji: scroll.querySelector('#lwEmoji'),
      emojiWrap: scroll.querySelector('#lwEmojiWrap'),
      name: scroll.querySelector('#lwName'),
      desc: scroll.querySelector('#lwDesc'),
      cadence: scroll.querySelector('#lwCadence'),
      chipLvl: scroll.querySelector('#lwChipLvl'),
      chipStat: scroll.querySelector('#lwChipStat'),
      chipProc: scroll.querySelector('#lwChipProc'),
      chipShard: scroll.querySelector('#lwChipShard'),
      bar: scroll.querySelector('#lwBar'),
      tiles,
      up1: scroll.querySelector('#lwUp1'),
      upMax: scroll.querySelector('#lwUpMax'),
      foot: scroll.querySelector('#lwFoot'),
      wheelRing: scroll.querySelector('#lwWheelRing'),
      wheelRows: scroll.querySelector('#lwWheelRows'),
      wheelMine: scroll.querySelector('#lwWheelMine'),
      wheelSig: '',
    };
    this._built = true;

    if (this._wired) return;
    this._wired = true;
    root.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-act]');
      if (!b || b.disabled) return;
      const act = b.dataset.act;
      if (act === 'up1') { Law.upgrade(1); UI.dirty('law'); return; }
      if (act === 'upMax') { Law._upgradeMax(); UI.dirty('law'); return; }
    });
  },
};

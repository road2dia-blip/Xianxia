/* ============================================================================
 * Shops — Market, Black Market, Sect Library, Jade Shop, Dust Shop.
 *
 * REFRESH
 *   market : CONFIG.economy.marketSlots picked per local day, of which
 *            CONFIG.economy.marketFormulaSlots are formula unlocks.
 *   black  : CONFIG.economy.blackMarketSlots picked every
 *            CONFIG.economy.blackMarketRefreshSec (8h), each discounted
 *            25%-60%. Unlocks at Nascent Soul.
 *   library / jade / dust are fixed shelves.
 *
 * PURCHASE BOOKKEEPING
 *   S.shops.bought['<shop>:<id>'] = {day, n}  — n is the lifetime count, day is
 *   the last purchase date, so per-day stock limits and escalating repeat costs
 *   both work off one record. The Sect module uses the same 'library:<id>' key.
 *
 * QoL grants (the Jade Shop replaces monetisation entirely) write to the
 * canonical homes other modules read: S.flags.offlineUp, S.respira.capUp,
 * S.alchemy.queueUp / .assistant, S.flags.autoHunt, S.abode.garden length.
 * ==========================================================================*/

const Shops = {
  TABS: [
    { key: 'market', label: '\u{1F3EE} Market', cur: 'stone' },
    { key: 'black', label: '\u{1F311} Black', cur: 'jade', realm: CONFIG.economy.blackMarketUnlockRealm },
    { key: 'library', label: '\u{1F4DA} Library', cur: 'citrine' },
    { key: 'jade', label: '\u{1F48E} Jade', cur: 'jade' },
    { key: 'dust', label: '\u{2728} Dust', cur: 'dust' },
  ],
  _dom: null, _sig: '', _sub: 'market',

  init() {
    try { UI.register('shops', () => Shops.render()); } catch (e) { /* optional */ }
    try { Bus.on('dailyReset', () => Shops.rollMarket(true)); } catch (e) { /* optional */ }
    Shops.rollMarket(false);
    Shops.rollBlack(false);
  },

  tick(dt) {
    Shops._acc = (Shops._acc || 0) + dt;
    if (Shops._acc < 5) return;
    Shops._acc = 0;
    Shops.rollBlack(false);
  },
  badges() { return 0; },

  /* ------------------------------------------------------------- refreshes */
  rollMarket(force) {
    if (!S || !S.shops) return;
    if (!S.shops.market || typeof S.shops.market !== 'object') S.shops.market = { stock: [], day: '' };
    const today = U.todayStr();
    if (!force && S.shops.market.day === today && (S.shops.market.stock || []).length) return;

    const all = DATA.shops.market || [];
    const formulas = all.filter(i => i.give && i.give.formula);
    const others = all.filter(i => !(i.give && i.give.formula));
    const picked = U.shuffle(formulas).slice(0, CONFIG.economy.marketFormulaSlots)
      .concat(U.shuffle(others).slice(0, Math.max(0, CONFIG.economy.marketSlots - CONFIG.economy.marketFormulaSlots)));

    S.shops.market.stock = picked.map(i => ({ id: i.id, disc: 0 }));
    S.shops.market.day = today;
    Shops._sig = '';
  },

  rollBlack(force) {
    if (!S || !S.shops) return;
    if (!S.shops.black || typeof S.shops.black !== 'object') S.shops.black = { stock: [], nextAt: 0 };
    const now = Date.now();
    if (!force && S.shops.black.nextAt > now && (S.shops.black.stock || []).length) return;

    const all = DATA.shops.black || [];
    const picked = U.shuffle(all).slice(0, CONFIG.economy.blackMarketSlots);
    S.shops.black.stock = picked.map(i => ({
      id: i.id,
      disc: U.rand(CONFIG.economy.blackMarketDiscountMin, CONFIG.economy.blackMarketDiscountMax),
    }));
    S.shops.black.nextAt = now + CONFIG.economy.blackMarketRefreshSec * 1000;
    Shops._sig = '';
  },

  /* --------------------------------------------------------------- lookups */
  def(shop, id) { return (DATA.shops[shop] || []).find(i => i.id === id) || null; },

  record(shop, id) {
    if (!S.shops.bought || typeof S.shops.bought !== 'object') S.shops.bought = {};
    const k = shop + ':' + id;
    let r = S.shops.bought[k];
    if (!r || typeof r !== 'object') { r = { day: '', n: 0 }; S.shops.bought[k] = r; }
    return r;
  },

  /* Cost of the NEXT purchase, honouring a `costs` array for repeatables and a
     Black-Market discount. */
  costOf(shop, item, disc) {
    let base = item.cost || {};
    if (Array.isArray(item.costs) && item.costs.length) {
      const n = Shops.record(shop, item.id).n | 0;
      base = item.costs[Math.min(n, item.costs.length - 1)] || item.costs[item.costs.length - 1];
    }
    const out = {};
    for (const k in base) {
      const v = Math.floor(Number(base[k]) || 0);
      out[k] = disc ? Math.max(1, Math.round(v * (1 - disc))) : v;
    }
    return out;
  },

  soldOut(shop, item) {
    const stock = Number(item.stock);
    if (!Number.isFinite(stock) || stock < 0) return false;      // -1 or absent = unlimited
    const r = Shops.record(shop, item.id);
    const today = U.todayStr();
    const usedToday = r.day === today ? r.n : 0;
    // repeatable QoL entries with a `costs` ladder are capped by that ladder
    if (Array.isArray(item.costs)) return (r.n | 0) >= item.costs.length;
    return usedToday >= stock;
  },

  /* ---------------------------------------------------------------- buying */
  buy(shop, id, disc) {
    const item = Shops.def(shop, id);
    if (!item) return false;
    if (item.realm !== undefined && S.player.realm < item.realm) { UI.toast('Beyond you for now.', 'bad'); return false; }
    if (Shops.soldOut(shop, item)) { UI.toast('Sold out.', 'bad'); return false; }

    const cost = Shops.costOf(shop, item, disc);
    if (!Econ.spend(cost)) { UI.toast('You cannot afford that.', 'bad'); return false; }

    const r = Shops.record(shop, id);
    const today = U.todayStr();
    r.n = (r.day === today ? (r.n | 0) : (Array.isArray(item.costs) ? (r.n | 0) : 0)) + 1;
    r.day = today;

    Shops.give(item.give || {});
    Bus.emit('shopBuy', { shop, id });
    UI.toast(`Bought ${item.name}.`, 'good');
    Stats.invalidate(); Stats.recompute();
    Shops._sig = '';
    UI.dirty('shops', 'abode', 'cultivate');
    UI.refreshBadges();
    Save.save();
    return true;
  },

  /* Resolve a shop `give` payload. */
  give(g) {
    const cur = {};
    for (const k in g) {
      const v = g[k];
      switch (k) {
        case 'formula': {
          const id = v === 'random' ? U.pick(DATA.formulas).id : v;
          if (!S.inv.formulas.includes(id)) S.inv.formulas.push(id);
          else Econ.grant('stone', 200);
          break;
        }
        case 'blueprint': {
          const id = v === 'random' ? U.pick(DATA.blueprints).id : v;
          if (!S.inv.blueprints.includes(id)) S.inv.blueprints.push(id);
          else Econ.grant('dust', 40);
          break;
        }
        case 'curio': { try { Curios.own(v === 'random' ? null : v); } catch (e) { /* optional */ } break; }
        case 'seedTier': { Econ.grant('seed:' + U.clamp(Math.floor(Number(v) || 1), 1, 6), 3); break; }
        case 'qol': { Shops.qol(String(v), g.val); break; }
        default: cur[k] = v;
      }
    }
    Econ.grantAll(cur);
  },

  /* Permanent quality-of-life unlocks. Each writes the canonical field the
     owning module reads, so nothing needs a second source of truth. */
  qol(kind, val) {
    switch (kind) {
      case 'offlineCap':
        S.flags.offlineUp = U.clamp((S.flags.offlineUp | 0) + 1, 0, CONFIG.offline.maxUpgrades);
        UI.toast(`Offline cap is now ${Offline.capHours()}h.`, 'gold');
        break;
      case 'respiraCap':
        S.respira.capUp = U.clamp((S.respira.capUp | 0) + 1, 0, CONFIG.respira.maxCapUpgrades);
        UI.toast('You can hold more breath.', 'gold');
        break;
      case 'gardenPlot': {
        if (!Array.isArray(S.abode.garden)) S.abode.garden = [];
        if (S.abode.garden.length < CONFIG.abode.gardenPlotsMax) {
          S.abode.garden.push({ seed: null, endAt: 0 });
          UI.toast('A new plot is turned over.', 'gold');
        } else UI.toast('The garden is already full.', 'info');
        break;
      }
      case 'alchemyQueue':
        S.alchemy.queueUp = U.clamp((S.alchemy.queueUp | 0) + 1, 0, CONFIG.alchemy.maxQueueUpgrades);
        UI.toast('Another crucible fits on the bench.', 'gold');
        break;
      case 'alchemyAssistant':
        S.alchemy.assistant = true;
        UI.toast('An assistant will keep the furnace fed.', 'gold');
        break;
      case 'autoHunt':
        S.flags.autoHunt = true;
        S.settings.autoHunt = true;
        UI.toast('Your feet will find the trail without you.', 'gold');
        break;
      case 'title':
        if (val) { S.player.title = String(val); UI.toast('Title set.', 'good'); }
        break;
      case 'auraColor':
        if (val) { S.player.auraColor = String(val); UI.toast('Your aura shifts hue.', 'good'); }
        break;
      case 'reroll':
        Shops.openRerollPicker();
        break;
      default:
        console.warn('[Shops] unknown qol grant:', kind);
    }
  },

  openRerollPicker() {
    const equipped = new Set(Object.values(S.equipped || {}).map(String));
    const list = (S.inv.gear || []).filter(i => i && (i.affixes || []).length);
    const body = document.createElement('div');
    if (!list.length) body.appendChild(UI.el('div', 'empty', 'Nothing with affixes to reroll.'));
    for (const it of list.slice(0, 40)) {
      const b = Forge.baseOf(it);
      const btn = UI.el('button', 'btn sm', 'Reroll');
      btn.dataset.act = 'rr'; btn.dataset.id = String(it.uid);
      body.appendChild(UI.itemCard({
        emoji: (b && b.emoji) || '⚔',
        name: (b && b.name) || 'Unknown',
        rarity: it.rarity,
        sub: (equipped.has(String(it.uid)) ? 'Worn · ' : '') + `BR ${Fmt.n(Forge.br(it))}`,
        right: btn,
      }));
    }
    UI.sheet({ title: 'Reroll Affixes', body, buttons: [{ label: 'Close', cls: 'ghost', act: (c) => c() }] });
    body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act="rr"]');
      if (b) Forge.reroll(b.dataset.id);
    });
  },

  /* ---------------------------------------------------------------- panel */
  setSub(key) { Shops._sub = key; Shops._sig = ''; UI.dirty('shops'); },

  render() {
    const panel = UI.panel('shops');
    if (!panel) return;
    if (!Shops._dom || !panel.contains(Shops._dom.root)) Shops._build(panel);
    Shops.rollMarket(false);
    Shops.rollBlack(false);

    const d = Shops._dom;
    for (const b of d.tabs.children) b.classList.toggle('active', b.dataset.sub === Shops._sub);

    const sub = Shops._sub;
    const sig = sub + '|' + JSON.stringify(S.shops.market.stock || []) + '|'
      + JSON.stringify(S.shops.black.stock || []) + '|'
      + Object.keys(S.shops.bought || {}).length + '|'
      + S.cur.stone + ',' + S.cur.jade + ',' + S.cur.citrine + ',' + S.cur.dust;
    if (sig === Shops._sig) return;
    Shops._sig = sig;

    d.list.innerHTML = '';
    const tabDef = Shops.TABS.find(t => t.key === sub);
    if (tabDef && tabDef.realm !== undefined && S.player.realm < tabDef.realm) {
      d.list.appendChild(UI.el('div', 'empty', `That door opens at ${UI.realmName(tabDef.realm)}.`));
      return;
    }

    if (sub === 'black') {
      const left = Math.max(0, ((S.shops.black.nextAt || 0) - Date.now()) / 1000);
      d.list.appendChild(UI.el('div', 'tiny muted', `New stock in ${Fmt.dur(left)}`));
    }
    if (sub === 'market') {
      d.list.appendChild(UI.el('div', 'tiny muted', `Restocks in ${Fmt.dur(Daily.secToReset(Date.now()))}`));
    }

    const rows = (sub === 'market' || sub === 'black')
      ? (S.shops[sub].stock || []).map(s => ({ item: Shops.def(sub, s.id), disc: s.disc }))
      : (DATA.shops[sub] || []).map(i => ({ item: i, disc: 0 }));

    let any = false;
    for (const { item, disc } of rows) {
      if (!item) continue;
      any = true;
      const cost = Shops.costOf(sub, item, disc);
      const out = Shops.soldOut(sub, item);
      const gated = item.realm !== undefined && S.player.realm < item.realm;
      const afford = Object.keys(cost).every(k => Econ.can(k, cost[k]));

      const btn = UI.el('button', 'btn sm' + (!out && !gated && afford ? ' primary' : ''),
        out ? 'Sold' : (gated ? 'Locked' : 'Buy'));
      btn.disabled = out || gated || !afford;
      if (!btn.disabled) {
        btn.dataset.act = 'buy'; btn.dataset.id = item.id;
        btn.dataset.shop = sub; btn.dataset.disc = String(disc || 0);
      }

      const card = UI.itemCard({
        emoji: item.emoji || '\u{1F4E6}',
        name: item.name + (disc ? `  −${Math.round(disc * 100)}%` : ''),
        rarity: disc ? 'purple' : 'gray',
        sub: item.desc || '',
        right: btn,
      });
      card.appendChild(UI.costRow(cost));
      d.list.appendChild(card);
    }
    if (!any) d.list.appendChild(UI.el('div', 'empty', 'The shelves are bare.'));
  },

  _build(panel) {
    panel.innerHTML = '';
    const root = UI.el('div', 'scroll');
    const tabs = UI.el('div', 'tabs');
    for (const t of Shops.TABS) {
      const b = UI.el('button', 'tab', t.label);
      b.dataset.sub = t.key;
      tabs.appendChild(b);
    }
    root.appendChild(tabs);
    const list = UI.el('div', 'col');
    root.appendChild(list);
    root.appendChild(UI.el('div', 'safe-b'));
    panel.appendChild(root);
    Shops._dom = { root, tabs, list };
    root.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-sub]');
      if (tab) { Shops.setSub(tab.dataset.sub); return; }
      const b = e.target.closest('[data-act="buy"]');
      if (b) Shops.buy(b.dataset.shop, b.dataset.id, parseFloat(b.dataset.disc) || 0);
    });
  },
};

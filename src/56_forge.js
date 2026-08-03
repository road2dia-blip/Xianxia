/* ============================================================================
 * Forge — gear and relic crafting, equipping, enhancing, refining, salvaging.
 *
 * ITEM SHAPE (stored in S.inv.gear)
 *   { uid, base, slot, rank, rarity, lvl, star, affixes:[{k,v,pct}] }
 *     base  = DATA.gearBases id, or DATA.relics id when slot === 'relic'
 *     lvl   = enhance level 0..15      star = refine stars 0..5
 *
 * FORMULAS
 *   rarityMult  = [1, 1.25, 1.6, 2.1, 2.9]           gray..gold
 *   enhanceMult = 1 + 0.04 * lvl                      (CONFIG.forge.enhancePerLevel)
 *   starMult    = 1.10 ^ star                         (CONFIG.forge.refinePerStar)
 *   mainStat    = base.main.val * rarityMult * enhanceMult * starMult
 *   enhanceCost = round(25 * 1.38^lvl)  Forge Stones  (CONFIG.forge.enhanceCost*)
 *
 * FORGING PITY (spec section 12)
 *   Each craft adds CONFIG.forge.pityByTier[tier-1] points (1 / 5 / 20 by tier band).
 *   At >= 600 the next craft is a guaranteed gold and spends 600.
 *   At >= 100 the next craft is a guaranteed purple-or-better and spends 100.
 *   Points are only spent when the guarantee actually fires.
 * ==========================================================================*/

const Forge = {
  RARITIES: ['gray', 'green', 'blue', 'purple', 'gold'],
  RARITY_MULT: [1, 1.25, 1.6, 2.1, 2.9],
  SLOTS: ['weapon', 'armor', 'pendant'],
  RELIC_SLOTS: ['relicA', 'relicB', 'relicC'],
  _dom: null,
  _sig: '',

  init() {
    try { Stats.provider(Forge.equippedBonus); } catch (e) { /* optional */ }
  },
  tick() {},
  badges() { return 0; },

  /* ----------------------------------------------------------- item maths */
  baseOf(item) {
    if (!item) return null;
    return item.slot === 'relic' ? DATAX.relicById[item.base] : DATAX.gearById[item.base];
  },
  rarityIdx(r) { const i = Forge.RARITIES.indexOf(r); return i < 0 ? 0 : i; },

  mult(item) {
    const ri = Forge.rarityIdx(item.rarity);
    const lvl = U.clamp(Math.floor(Number(item.lvl) || 0), 0, CONFIG.forge.enhanceMax);
    const star = U.clamp(Math.floor(Number(item.star) || 0), 0, CONFIG.forge.refineMaxStar);
    return (Forge.RARITY_MULT[ri] || 1)
      * (1 + CONFIG.forge.enhancePerLevel * lvl)
      * Math.pow(1 + CONFIG.forge.refinePerStar, star);
  },

  /* Flat stat contribution of one item. Stats._gearFlats sums these. */
  itemStats(item) {
    const out = { hp: 0, mp: 0, patk: 0, matk: 0, pdef: 0, mdef: 0, spd: 0 };
    if (!item) return out;
    const b = Forge.baseOf(item);
    if (!b) return out;
    const m = Forge.mult(item);

    if (item.slot !== 'relic' && b.main && b.main.stat) {
      const k = b.main.stat;
      if (out[k] !== undefined) out[k] += (Number(b.main.val) || 0) * m;
    }
    for (const a of (item.affixes || [])) {
      if (a && !a.pct && out[a.k] !== undefined) out[a.k] += (Number(a.v) || 0) * m;
    }
    return out;
  },

  /* Percentage bonuses from equipped gear and relics. Registered as a Stats
     provider, so Stats._gearProvider stands down and nothing double-counts. */
  equippedBonus(acc) {
    if (typeof S === 'undefined' || !S || !S.equipped) return;
    const gear = (S.inv && Array.isArray(S.inv.gear)) ? S.inv.gear : [];
    if (!gear.length) return;
    const byUid = Object.create(null);
    for (const it of gear) if (it && it.uid != null) byUid[String(it.uid)] = it;

    for (const slot of Forge.SLOTS.concat(Forge.RELIC_SLOTS)) {
      const uid = S.equipped[slot];
      if (uid === null || uid === undefined || uid === '') continue;
      const it = byUid[String(uid)];
      if (!it) continue;

      const m = Forge.mult(it);
      for (const a of (it.affixes || [])) {
        if (a && a.pct && acc[a.k] !== undefined) acc[a.k] += (Number(a.v) || 0) * m;
      }
      if (it.slot === 'relic') {
        const b = DATAX.relicById[it.base];
        if (b && b.effect && acc[b.effect.key] !== undefined) {
          acc[b.effect.key] += (Number(b.effect.val) || 0) * m;
        }
      }
    }
  },

  br(item) {
    try { return Stats.br(Object.assign({ crit: 0, critDmg: 0 }, Forge.itemStats(item))); }
    catch (e) { return 0; }
  },

  /* ------------------------------------------------------------- crafting */
  craftCost(rank, slot) {
    const cost = { stone: Math.round(300 * Math.pow(4.5, rank - 1)) };
    cost['forge:' + rank] = 3 + rank + (slot === 'relic' ? 2 : 0);
    return cost;
  },

  blueprintsOwned() {
    const ids = (S.inv && Array.isArray(S.inv.blueprints)) ? S.inv.blueprints : [];
    const out = [];
    for (const id of ids) {
      const bp = DATA.blueprints.find(b => b.id === id);
      if (bp) out.push(bp);
    }
    out.sort((a, b) => (a.rank - b.rank) || String(a.slot).localeCompare(String(b.slot)));
    return out;
  },

  /* Roll rarity, honouring the pity guarantees. Returns a rarity string. */
  _rollRarity(rank) {
    const pity = Math.max(0, Math.floor(Number(S.forge.pity) || 0));
    if (pity >= CONFIG.forge.pityGold) {
      S.forge.pity = pity - CONFIG.forge.pityGold;
      return 'gold';
    }
    if (pity >= CONFIG.forge.pityPurple) {
      S.forge.pity = pity - CONFIG.forge.pityPurple;
      return U.chance(0.18) ? 'gold' : 'purple';
    }
    let b = 0;
    try { b = Number(Stats.bonus('forgeQuality')) || 0; } catch (e) { b = 0; }
    const base = CONFIG.forge.qualityBase;
    const w = base.map((v, i) => (i === 0 ? v * Math.max(0.15, 1 - 2 * b) : v * (1 + 1.5 * b * i)));
    const total = w.reduce((a, c) => a + c, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < w.length; i++) { roll -= w[i]; if (roll <= 0) return Forge.RARITIES[i]; }
    return 'gray';
  },

  _rollAffixes(rarity, rank) {
    const n = CONFIG.forge.rarityAffixes[Forge.rarityIdx(rarity)] || 1;
    const pool = U.shuffle(DATA.affixes);
    const out = [];
    for (let i = 0; i < n && i < pool.length; i++) {
      const a = pool[i];
      const lo = Number(a.min) || 0, hi = Number(a.max) || 0;
      let v = U.rand(lo, hi);
      if (!a.pct) v = Math.max(1, Math.round(v * Math.pow(2.6, rank - 1)));
      else v = Math.round(v * 10000) / 10000;
      out.push({ k: a.key, v, pct: !!a.pct });
    }
    return out;
  },

  craft(blueprintId) {
    const bp = DATA.blueprints.find(b => b.id === blueprintId);
    if (!bp) return false;
    const cost = Forge.craftCost(bp.rank, bp.slot);
    if (!Econ.spend(cost)) { UI.toast('Not enough materials.', 'bad'); return false; }

    // pity accrual by the material tier consumed
    const add = CONFIG.forge.pityByTier[U.clamp(bp.rank - 1, 0, CONFIG.forge.pityByTier.length - 1)] || 1;
    S.forge.pity = (Math.floor(Number(S.forge.pity) || 0)) + add;

    const rarity = Forge._rollRarity(bp.rank);

    let base;
    if (bp.slot === 'relic') {
      const cands = DATA.relics.filter(r => r.rank === bp.rank);
      base = U.pick(cands.length ? cands : DATA.relics);
    } else {
      const cands = DATA.gearBases.filter(g => g.slot === bp.slot && g.rank === bp.rank);
      base = U.pick(cands.length ? cands : DATA.gearBases.filter(g => g.slot === bp.slot));
    }
    if (!base) { UI.toast('No blueprint pattern found.', 'bad'); return false; }

    const item = {
      uid: S.inv.nextUid++,
      base: base.id,
      slot: bp.slot,
      rank: bp.rank,
      rarity,
      lvl: 0,
      star: 0,
      affixes: Forge._rollAffixes(rarity, bp.rank),
    };
    Forge._store(item);
    S.stats.gearCrafted = (S.stats.gearCrafted | 0) + 1;
    S.forge.crafted = (S.forge.crafted | 0) + 1;

    Bus.emit('gearCrafted', { rank: bp.rank, rarity });
    UI.toast(`${base.emoji || '\u{2694}'} ${base.name} (${rarity})`, rarity === 'gold' ? 'gold' : 'good');
    if (rarity === 'gold') { try { UI.flash('gold'); } catch (e) { /* optional */ } }

    Forge._autoEquipIfBetter(item);
    Stats.invalidate(); Stats.recompute();
    Forge._sig = '';
    UI.dirty('abode');
    return true;
  },

  /* Keep S.inv.gear bounded (contract section 2: <= 300, auto-salvage worst gray). */
  _store(item) {
    if (!Array.isArray(S.inv.gear)) S.inv.gear = [];
    S.inv.gear.push(item);
    if (S.inv.gear.length <= 300) return;
    const equipped = new Set(Object.values(S.equipped || {}).map(String));
    let worstIdx = -1, worstBr = Infinity;
    for (let i = 0; i < S.inv.gear.length; i++) {
      const it = S.inv.gear[i];
      if (!it || equipped.has(String(it.uid))) continue;
      const b = Forge.br(it);
      if (b < worstBr) { worstBr = b; worstIdx = i; }
    }
    if (worstIdx >= 0) {
      const [gone] = S.inv.gear.splice(worstIdx, 1);
      Forge._payoutSalvage(gone);
      UI.toast('Your racks overflowed; the worst piece was melted down.', 'info');
    }
  },

  _autoEquipIfBetter(item) {
    const targets = item.slot === 'relic' ? Forge.RELIC_SLOTS : [item.slot];
    for (const slot of targets) {
      const cur = Forge.equippedIn(slot);
      if (!cur) { Forge.equip(item.uid, slot, true); return; }
    }
    const slot = targets[0];
    const cur = Forge.equippedIn(slot);
    if (cur && Forge.br(item) > Forge.br(cur)) Forge.equip(item.uid, slot, true);
  },

  /* ---------------------------------------------------------- equip / gear */
  byUid(uid) {
    if (uid === null || uid === undefined) return null;
    return (S.inv.gear || []).find(i => i && String(i.uid) === String(uid)) || null;
  },
  equippedIn(slot) { return Forge.byUid((S.equipped || {})[slot]); },

  equip(uid, slot, quiet) {
    const item = Forge.byUid(uid);
    if (!item) return false;
    const target = slot || (item.slot === 'relic' ? Forge._freeRelicSlot() : item.slot);
    if (!target) return false;
    if (item.slot === 'relic' && Forge.RELIC_SLOTS.indexOf(target) < 0) return false;
    if (item.slot !== 'relic' && target !== item.slot) return false;
    if (item.slot === 'relic' && S.player.realm < CONFIG.unlocks.relics) {
      UI.toast('Relics are beyond you for now.', 'bad');
      return false;
    }

    // Enhance level transfers on replace (spec section 12).
    const old = Forge.equippedIn(target);
    if (old && old.uid !== item.uid && (old.lvl | 0) > (item.lvl | 0)) {
      item.lvl = old.lvl | 0;
      old.lvl = 0;
      if (!quiet) UI.toast('The old piece surrendered its refinements.', 'info');
    }
    // If it was equipped elsewhere, vacate that slot first.
    for (const s of Forge.SLOTS.concat(Forge.RELIC_SLOTS)) {
      if (String(S.equipped[s]) === String(item.uid)) S.equipped[s] = null;
    }
    S.equipped[target] = item.uid;

    Stats.invalidate(); Stats.recompute();
    Bus.emit('statsDirty', {});
    Forge._sig = '';
    UI.dirty('abode', 'cultivate');
    return true;
  },
  _freeRelicSlot() {
    for (const s of Forge.RELIC_SLOTS) if (!S.equipped[s]) return s;
    return Forge.RELIC_SLOTS[0];
  },
  unequip(slot) {
    if (!S.equipped || !S.equipped[slot]) return false;
    S.equipped[slot] = null;
    Stats.invalidate(); Stats.recompute();
    Forge._sig = '';
    UI.dirty('abode', 'cultivate');
    return true;
  },

  /* -------------------------------------------------------------- enhance */
  enhanceCost(item) {
    const lvl = Math.floor(Number(item.lvl) || 0);
    return Math.round(CONFIG.forge.enhanceCostBase * Math.pow(CONFIG.forge.enhanceCostGrowth, lvl));
  },
  enhance(uid) {
    const item = Forge.byUid(uid);
    if (!item) return false;
    if ((item.lvl | 0) >= CONFIG.forge.enhanceMax) { UI.toast('Already at its limit.', 'bad'); return false; }
    const cost = Forge.enhanceCost(item);
    if (!Econ.spend('stones', cost)) { UI.toast('Not enough Forge Stones.', 'bad'); return false; }
    item.lvl = (item.lvl | 0) + 1;
    Bus.emit('gearEnhanced', { uid: item.uid, level: item.lvl });
    UI.toast(`+${item.lvl}`, 'good');
    Stats.invalidate(); Stats.recompute();
    Forge._sig = '';
    UI.dirty('abode');
    return true;
  },

  /* --------------------------------------------------------------- refine */
  /* Consume a duplicate of the same base to add a star. */
  refine(uid) {
    const item = Forge.byUid(uid);
    if (!item) return false;
    if ((item.star | 0) >= CONFIG.forge.refineMaxStar) { UI.toast('Already five stars.', 'bad'); return false; }
    const equipped = new Set(Object.values(S.equipped || {}).map(String));
    const dupIdx = (S.inv.gear || []).findIndex(i =>
      i && i.uid !== item.uid && i.base === item.base && !equipped.has(String(i.uid)));
    if (dupIdx < 0) { UI.toast('You need a duplicate to refine.', 'bad'); return false; }
    S.inv.gear.splice(dupIdx, 1);
    item.star = (item.star | 0) + 1;
    UI.toast(`Refined to ${item.star}★`, 'gold');
    Stats.invalidate(); Stats.recompute();
    Forge._sig = '';
    UI.dirty('abode');
    return true;
  },

  /* -------------------------------------------------------------- salvage */
  _payoutSalvage(item) {
    const ri = Forge.rarityIdx(item.rarity);
    const scale = Math.pow(1.8, (item.rank || 1) - 1);
    const stones = Math.max(1, Math.round((CONFIG.forge.salvageStones[ri] || 4) * scale));
    const dust = Math.max(1, Math.round((CONFIG.forge.salvageDust[ri] || 1) * scale));
    Econ.grant('stones', stones);
    Econ.grant('dust', dust);
    return { stones, dust };
  },
  salvage(uid) {
    const idx = (S.inv.gear || []).findIndex(i => i && String(i.uid) === String(uid));
    if (idx < 0) return false;
    const equipped = new Set(Object.values(S.equipped || {}).map(String));
    if (equipped.has(String(uid))) { UI.toast('Unequip it first.', 'bad'); return false; }
    const [item] = S.inv.gear.splice(idx, 1);
    const got = Forge._payoutSalvage(item);
    Bus.emit('gearSalvaged', { n: 1 });
    UI.toast(`+${Fmt.n(got.stones)} Forge Stones, +${Fmt.n(got.dust)} Soul Dust`, 'good');
    Forge._sig = '';
    UI.dirty('abode');
    return true;
  },
  salvageAllGray() {
    const equipped = new Set(Object.values(S.equipped || {}).map(String));
    let n = 0, stones = 0, dust = 0;
    for (let i = (S.inv.gear || []).length - 1; i >= 0; i--) {
      const it = S.inv.gear[i];
      if (!it || equipped.has(String(it.uid))) continue;
      if (it.rarity !== 'gray' && it.rarity !== 'green') continue;
      S.inv.gear.splice(i, 1);
      const got = Forge._payoutSalvage(it);
      stones += got.stones; dust += got.dust; n++;
    }
    if (!n) { UI.toast('Nothing worth melting.', 'bad'); return 0; }
    Bus.emit('gearSalvaged', { n });
    UI.toast(`Melted ${n} — +${Fmt.n(stones)} Stones, +${Fmt.n(dust)} Dust`, 'good');
    Forge._sig = '';
    UI.dirty('abode');
    return n;
  },

  /* Reroll an item's affixes with Soul Dust (the Dust Shop's reroll). */
  reroll(uid) {
    const item = Forge.byUid(uid);
    if (!item) return false;
    if (!Econ.spend('dust', CONFIG.forge.rerollDustCost)) { UI.toast('Not enough Soul Dust.', 'bad'); return false; }
    item.affixes = Forge._rollAffixes(item.rarity, item.rank);
    UI.toast('The pattern shifts.', 'good');
    Stats.invalidate(); Stats.recompute();
    Forge._sig = '';
    UI.dirty('abode');
    return true;
  },

  /* ================================================================= PANEL */
  renderInto(host) {
    if (!host) return;
    if (!Forge._dom || Forge._dom.host !== host || !host.contains(Forge._dom.root)) Forge._build(host);
    Forge._patch();
  },

  _build(host) {
    host.innerHTML = '';
    const root = UI.el('div', 'col');

    const pity = UI.el('div', 'card tight');
    pity.innerHTML = `<div class="row between"><span class="lbl">Forging Pity</span>
        <span class="val" data-f="pity"></span></div>
      <div class="meter"><i data-f="pitybar"></i></div>
      <div class="tiny muted" data-f="pitytxt"></div>`;
    root.appendChild(pity);

    const eq = UI.el('div', 'col');
    root.appendChild(eq);

    const act = UI.el('div', 'row');
    const bCraft = UI.el('button', 'btn primary wide', 'Forge');
    bCraft.dataset.act = 'fg-open';
    const bMelt = UI.el('button', 'btn wide', 'Melt Grays');
    bMelt.dataset.act = 'fg-melt';
    act.appendChild(bCraft); act.appendChild(bMelt);
    root.appendChild(act);

    const bag = UI.el('div', 'col');
    root.appendChild(bag);

    host.appendChild(root);
    Forge._dom = { host, root, pity, eq, bag };
    if (!root._wired) {
      root._wired = true;
      root.addEventListener('click', (e) => Forge._onClick(e));
    }
  },

  _patch() {
    const d = Forge._dom;
    if (!d) return;
    const p = Math.max(0, Math.floor(Number(S.forge.pity) || 0));
    const next = p >= CONFIG.forge.pityPurple ? CONFIG.forge.pityGold : CONFIG.forge.pityPurple;
    d.pity.querySelector('[data-f="pity"]').textContent = `${Fmt.n(p)} / ${Fmt.n(next)}`;
    d.pity.querySelector('[data-f="pitybar"]').style.width = U.clamp(p / next, 0, 1) * 100 + '%';
    d.pity.querySelector('[data-f="pitytxt"]').textContent =
      p >= CONFIG.forge.pityGold ? 'The next piece will be golden.'
        : p >= CONFIG.forge.pityPurple ? 'The next piece will be purple or better.'
          : `${CONFIG.forge.pityPurple - p} more points to a guaranteed purple.`;

    const eqSig = Forge.SLOTS.concat(Forge.RELIC_SLOTS).map(s => s + ':' + (S.equipped[s] || '-')).join(',');
    const bagSig = (S.inv.gear || []).map(i => i.uid + '.' + i.lvl + '.' + i.star).join(',');
    const sig = eqSig + '#' + bagSig + '#' + p;
    if (sig === Forge._sig) return;
    Forge._sig = sig;

    d.eq.innerHTML = '';
    d.eq.appendChild(UI.el('div', 'sec-title serif', 'Worn'));
    const relicsOpen = S.player.realm >= CONFIG.unlocks.relics;
    for (const slot of Forge.SLOTS.concat(relicsOpen ? Forge.RELIC_SLOTS : [])) {
      const it = Forge.equippedIn(slot);
      const label = slot.startsWith('relic') ? 'Relic ' + slot.slice(-1) : slot[0].toUpperCase() + slot.slice(1);
      if (!it) {
        const card = UI.itemCard({ emoji: '⬜', name: label, rarity: 'gray', sub: 'Empty' });
        d.eq.appendChild(card);
        continue;
      }
      const b = Forge.baseOf(it);
      const btn = UI.el('button', 'btn sm', 'Manage');
      btn.dataset.act = 'fg-item'; btn.dataset.id = String(it.uid);
      d.eq.appendChild(UI.itemCard({
        emoji: (b && b.emoji) || '⚔',
        name: `${(b && b.name) || 'Unknown'}${it.lvl ? ' +' + it.lvl : ''}${it.star ? ' ' + it.star + '★' : ''}`,
        rarity: it.rarity,
        sub: `${label} · BR ${Fmt.n(Forge.br(it))}`,
        right: btn,
      }));
    }

    d.bag.innerHTML = '';
    const equipped = new Set(Object.values(S.equipped || {}).map(String));
    const loose = (S.inv.gear || []).filter(i => i && !equipped.has(String(i.uid)));
    d.bag.appendChild(UI.el('div', 'sec-title serif', `Racks (${loose.length})`));
    if (!loose.length) { d.bag.appendChild(UI.el('div', 'empty', 'Nothing on the racks.')); return; }
    loose.sort((a, b) => Forge.br(b) - Forge.br(a));
    for (const it of loose.slice(0, 60)) {
      const b = Forge.baseOf(it);
      const btn = UI.el('button', 'btn sm', 'Manage');
      btn.dataset.act = 'fg-item'; btn.dataset.id = String(it.uid);
      d.bag.appendChild(UI.itemCard({
        emoji: (b && b.emoji) || '⚔',
        name: `${(b && b.name) || 'Unknown'}${it.lvl ? ' +' + it.lvl : ''}${it.star ? ' ' + it.star + '★' : ''}`,
        rarity: it.rarity,
        sub: `R${it.rank} ${it.slot} · BR ${Fmt.n(Forge.br(it))}`,
        right: btn,
      }));
    }
    if (loose.length > 60) d.bag.appendChild(UI.el('div', 'tiny muted', `...and ${loose.length - 60} more.`));
  },

  _onClick(e) {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    if (act === 'fg-open') { Forge.openCraftSheet(); return; }
    if (act === 'fg-melt') { Forge.salvageAllGray(); return; }
    if (act === 'fg-item') { Forge.openItemSheet(el.dataset.id); return; }
  },

  openCraftSheet() {
    const bps = Forge.blueprintsOwned();
    const body = document.createElement('div');
    if (!bps.length) {
      body.appendChild(UI.el('div', 'empty', 'You hold no blueprints. Try the Market, the Sect Library or a boss.'));
    }
    for (const bp of bps) {
      const cost = Forge.craftCost(bp.rank, bp.slot);
      const wrap = UI.el('div', 'card tight');
      wrap.appendChild(UI.el('div', 'h2', bp.name));
      wrap.appendChild(UI.el('div', 'tiny muted', `Rank ${bp.rank} ${bp.slot}`));
      wrap.appendChild(UI.costRow(cost));
      const b = UI.el('button', 'btn sm primary', 'Forge');
      b.dataset.act = 'go'; b.dataset.id = bp.id;
      const foot = UI.el('div', 'row between');
      foot.appendChild(UI.el('span', 'tiny muted', `+${CONFIG.forge.pityByTier[bp.rank - 1] || 1} pity`));
      foot.appendChild(b);
      wrap.appendChild(foot);
      body.appendChild(wrap);
    }
    UI.sheet({ title: 'Forge', body, buttons: [{ label: 'Close', cls: 'ghost', act: (c) => c() }] });
    body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act="go"]');
      if (b) Forge.craft(b.dataset.id);
    });
  },

  openItemSheet(uid) {
    const it = Forge.byUid(uid);
    if (!it) return;
    const b = Forge.baseOf(it);
    const body = document.createElement('div');
    const st = Forge.itemStats(it);

    const rows = Object.keys(st).filter(k => st[k] > 0)
      .map(k => `<div class="kv"><span class="k">${k.toUpperCase()}</span><span class="v">+${Fmt.n(st[k])}</span></div>`).join('');
    const affix = (it.affixes || []).map(a => {
      const nice = a.pct ? Fmt.pct(a.v) : '+' + Fmt.n(a.v);
      return `<div class="kv"><span class="k">${a.k}</span><span class="v good">${nice}</span></div>`;
    }).join('');

    body.innerHTML = `
      <div class="h2 ${UI.rarityCls(it.rarity)}">${(b && b.emoji) || '⚔'} ${(b && b.name) || 'Unknown'}</div>
      <div class="tiny muted">Rank ${it.rank} · ${it.slot} · +${it.lvl || 0} · ${it.star || 0}★ · BR ${Fmt.n(Forge.br(it))}</div>
      <div class="sec">${rows || '<div class="tiny muted">No flat stats.</div>'}</div>
      <div class="sec"><div class="lbl">Affixes</div>${affix || '<div class="tiny muted">None.</div>'}</div>`;

    const equipped = String((S.equipped || {})[it.slot === 'relic' ? 'relicA' : it.slot]) === String(it.uid)
      || Forge.RELIC_SLOTS.some(s => String(S.equipped[s]) === String(it.uid));

    const buttons = [];
    if (!equipped) buttons.push({ label: 'Equip', cls: 'primary', act: (c) => { Forge.equip(it.uid); c(); } });
    else buttons.push({ label: 'Unequip', cls: 'ghost', act: (c) => {
      for (const s of Forge.SLOTS.concat(Forge.RELIC_SLOTS)) if (String(S.equipped[s]) === String(it.uid)) Forge.unequip(s);
      c();
    } });
    buttons.push({ label: `Enhance (${Fmt.n(Forge.enhanceCost(it))})`, cls: '', act: (c) => { Forge.enhance(it.uid); c(); } });
    buttons.push({ label: 'Refine', cls: '', act: (c) => { Forge.refine(it.uid); c(); } });
    if (!equipped) buttons.push({ label: 'Salvage', cls: 'danger', act: (c) => { Forge.salvage(it.uid); c(); } });

    UI.sheet({ title: 'Equipment', body, buttons });
  },
};

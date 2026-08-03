/* ============================================================================
 * Duel — the simulated PvP ladder. 200 named NPC rivals, no server.
 *
 * LADDER
 *   S.duel.rank is 200 (worst) .. 1 (best). S.duel.npcs[i] holds the rival
 *   currently sitting at rank i+1, so index 0 is rank 1.
 *   You may challenge any of the CONFIG.duel.challengeRange (3) ranks above you;
 *   a win swaps the two rank positions.
 *
 * NPC GENERATION
 *   Deterministic from a per-save seed (U.hash of createdAt), so the roster is
 *   stable across reloads without storing much: each entry keeps only
 *   {name, path, realm, br}. BR is anchored to the benchmark for the realm the
 *   rank implies, +/- CONFIG.duel.brVariance.
 *
 * DRIFT
 *   Once per local day every NPC gains U.rand(3%, 6%) BR, so standing still
 *   costs you rank over time. Drift is stamped by date string, so it fires once
 *   even if the tab stays open across midnight.
 *
 * SEASONS
 *   CONFIG.duel.seasonDays (14). At rollover: pay a season chest by tier, then
 *   soft-compress every rank halfway back toward 200.
 * ==========================================================================*/

const Duel = {
  _dom: null, _sig: '',

  init() {
    try { Bus.on('dailyReset', () => Duel.onNewDay()); } catch (e) { /* optional */ }
    Duel.ensureRoster();
  },

  tick(dt) {
    Duel._acc = (Duel._acc || 0) + dt;
    if (Duel._acc < 10) return;
    Duel._acc = 0;
    Duel.ensureRoster();
    Duel._badge();
  },

  badges() {
    if (!S || S.player.realm < CONFIG.unlocks.duel) return 0;
    return Math.max(0, Math.floor(Number(S.duel.duelTickets != null ? S.duel.duelTickets : S.daily.duelTickets) || 0));
  },
  _badge() { try { UI.badge('battle.duel', Duel.badges()); } catch (e) { /* pre-boot */ } },

  /* ------------------------------------------------------------- roster */
  ensureRoster() {
    if (!S || !S.duel) return;
    if (!Array.isArray(S.duel.npcs)) S.duel.npcs = [];
    if (S.duel.npcs.length === CONFIG.duel.npcCount) return;

    const seed = U.hash('duel' + (S.createdAt || 0));
    const rng = U.rngFrom(seed);
    const npcs = [];
    const used = Object.create(null);
    const paths = ['body', 'spell', 'sword', 'ghost'];

    for (let i = 0; i < CONFIG.duel.npcCount; i++) {
      const rank = i + 1;
      // rank 1 sits about a realm above rank 200
      const t = 1 - (i / CONFIG.duel.npcCount);            // 1 at the top, 0 at the bottom
      const realm = U.clamp(Math.round(3 + t * 4), 0, CONFIG.cultivation.maxRealm);
      const bench = CONFIG.breakthrough.benchmarkBR[realm] || 1000;
      const br = Math.max(50, Math.round(bench * (0.55 + t * 0.75) * (1 + (rng() * 2 - 1) * CONFIG.duel.brVariance)));

      let name = uNameFrom(seed + i * 7919, DATA.names.surnames, DATA.names.givens, DATA.names.epithets);
      let guard = 0;
      while (used[name] && guard++ < 24) {
        name = uNameFrom(seed + i * 7919 + guard * 104729, DATA.names.surnames, DATA.names.givens, DATA.names.epithets);
      }
      used[name] = true;

      npcs.push({ name, path: paths[Math.floor(rng() * 4)] || 'sword', realm, br });
    }
    S.duel.npcs = npcs;
    if (!S.duel.seasonStart) S.duel.seasonStart = Date.now();
    if (!(S.duel.rank > 0)) S.duel.rank = CONFIG.duel.npcCount;
  },

  tierOf(rank) {
    for (const t of CONFIG.duel.tiers) if (rank <= t.maxRank) return t;
    return CONFIG.duel.tiers[CONFIG.duel.tiers.length - 1];
  },

  /* -------------------------------------------------------- daily rollover */
  onNewDay() {
    Duel.ensureRoster();
    const today = U.todayStr();
    if (S.duel.lastDrift === today) return;
    S.duel.lastDrift = today;

    for (const n of S.duel.npcs) {
      n.br = Math.round(n.br * (1 + U.rand(CONFIG.duel.driftMin, CONFIG.duel.driftMax)));
    }

    // daily payout by tier
    const t = Duel.tierOf(S.duel.rank);
    Mail.send({
      subject: `Ladder stipend — ${t.name}`,
      body: `For holding rank ${S.duel.rank}.`,
      rewards: { jade: t.jade, stone: t.stone },
    });

    // season rollover
    const days = (Date.now() - (S.duel.seasonStart || Date.now())) / 86400000;
    if (days >= CONFIG.duel.seasonDays) {
      const chest = { jade: t.jade * 6, stone: t.stone * 8, dust: 200 };
      Mail.send({ subject: 'Season settled', body: `You finished at rank ${S.duel.rank} (${t.name}).`, rewards: chest });
      // soft compression back toward the bottom
      const c = CONFIG.duel.compression;
      S.duel.rank = Math.round(S.duel.rank + (CONFIG.duel.npcCount - S.duel.rank) * c);
      S.duel.seasonStart = Date.now();
      UI.toast('A new duel season opens.', 'gold');
    }
    Duel._sig = '';
    UI.dirty('battle');
  },

  /* ---------------------------------------------------------------- fights */
  tickets() { return Math.max(0, Math.floor(Number(S.daily.duelTickets) || 0)); },

  /* Build a combat unit for an NPC. */
  unitFor(npc) {
    // Solve a stat block whose BR matches npc.br, shaped by their path.
    const path = CONFIG.paths[npc.path] || CONFIG.paths.sword;
    const shape = { hp: 34, mp: 8, patk: 1, matk: 1, pdef: 0.7, mdef: 0.7, spd: 0.9 };
    const probe = {};
    for (const k in shape) probe[k] = shape[k] * (path[k] || 1);
    let br0 = 0;
    try { br0 = Stats.br(probe); } catch (e) { br0 = 1; }
    const scale = br0 > 0 ? npc.br / br0 : 1;

    const u = {
      name: npc.name, emoji: Stats.pathEmoji ? Stats.pathEmoji(npc.path) : '\u{1F9D1}',
      side: 'foe', element: null, path: npc.path,
      crit: CONFIG.combat.baseCrit, critDmg: CONFIG.combat.baseCritDmg,
      hit: CONFIG.combat.baseHit, dodge: 0, lifesteal: npc.path === 'body' ? 0.08 : 0,
      skill: null, isPlayer: false,
    };
    for (const k in shape) u[k] = Math.max(1, Math.round(probe[k] * scale));
    u.maxHp = u.hp; u.maxMp = u.mp;
    try { u.skill = Stats.pathSkill ? Stats.pathSkill(npc.path) : null; } catch (e) { u.skill = null; }
    return u;
  },

  challenge(idx) {
    Duel.ensureRoster();
    if (S.player.realm < CONFIG.unlocks.duel) { UI.toast('Not yet permitted.', 'bad'); return; }
    if (Duel.tickets() <= 0) { UI.toast('No duel tickets left today.', 'bad'); return; }

    const targetRank = S.duel.rank - (idx + 1);
    if (targetRank < 1) { UI.toast('Nobody is above you.', 'bad'); return; }
    const npc = S.duel.npcs[targetRank - 1];
    if (!npc) return;

    S.daily.duelTickets = Duel.tickets() - 1;
    S.stats.duels = (S.stats.duels | 0) + 1;

    const me = Stats.unit();
    const foe = Duel.unitFor(npc);

    Combat.play({
      allies: [me], foes: [foe], title: `Rank ${targetRank} — ${npc.name}`,
      canSkip: true,
      opts: { lawProc: Duel._lawProc() },
      onDone: (res) => Duel._resolve(res, npc, targetRank),
    });
  },

  _lawProc() {
    if (!S.player.law) return null;
    let power = 1;
    try { power = 1 + (Number(Stats.bonus('lawProc')) || 0) + CONFIG.law.procPerLevel * (S.player.lawLevel | 0); }
    catch (e) { power = 1; }
    return { law: S.player.law, power };
  },

  _resolve(res, npc, targetRank) {
    const win = !!(res && res.win);
    if (win) {
      // swap positions: the beaten rival drops to where you were
      const mine = S.duel.rank;
      const beaten = S.duel.npcs[targetRank - 1];
      S.duel.npcs[targetRank - 1] = beaten;      // occupant list is positional
      // shift: you take targetRank, they take your old rank
      const arr = S.duel.npcs;
      const displaced = arr.splice(targetRank - 1, 1)[0];
      arr.splice(Math.min(mine - 1, arr.length), 0, displaced);
      S.duel.rank = targetRank;
      S.duel.wins = (S.duel.wins | 0) + 1;
      const t = Duel.tierOf(S.duel.rank);
      Econ.grantAll({ jade: 4, stone: Math.round(t.stone / 6) });
      UI.toast(`Rank ${targetRank}. ${npc.name} steps aside.`, 'gold');
    } else {
      S.duel.losses = (S.duel.losses | 0) + 1;
      UI.toast(`${npc.name} holds the step.`, 'bad');
    }
    S.duel.snapshot = { br: Stats.br(), at: Date.now() };
    Bus.emit('duelFight', { win, rank: S.duel.rank });
    Duel._sig = '';
    UI.dirty('battle');
    UI.refreshBadges();
    Save.save();
  },

  /* ---------------------------------------------------------------- panel */
  renderInto(host) {
    if (!host) return;
    Duel.ensureRoster();
    if (!Duel._dom || Duel._dom.host !== host || !host.contains(Duel._dom.root)) Duel._build(host);
    Duel._patch();
  },

  _build(host) {
    host.innerHTML = '';
    const root = UI.el('div', 'col');
    const head = UI.el('div', 'card tight');
    head.innerHTML = `<div class="row between"><span class="lbl">Your standing</span>
        <span class="val" data-f="rank"></span></div>
      <div class="row between"><span class="tiny muted" data-f="tier"></span>
        <span class="tiny muted" data-f="tickets"></span></div>
      <div class="tiny muted" data-f="season"></div>`;
    root.appendChild(head);
    const list = UI.el('div', 'col');
    root.appendChild(list);
    host.appendChild(root);
    Duel._dom = { host, root, head, list };
    if (!root._wired) {
      root._wired = true;
      root.addEventListener('click', (e) => {
        const el = e.target.closest('[data-act="duel"]');
        if (el) Duel.challenge(parseInt(el.dataset.idx, 10));
      });
    }
  },

  _patch() {
    const d = Duel._dom;
    if (!d) return;
    const t = Duel.tierOf(S.duel.rank);
    d.head.querySelector('[data-f="rank"]').textContent = '#' + S.duel.rank;
    d.head.querySelector('[data-f="tier"]').textContent = `${t.name} · ${S.duel.wins | 0}W ${S.duel.losses | 0}L`;
    d.head.querySelector('[data-f="tickets"]').textContent = `${Duel.tickets()} / ${CONFIG.duel.ticketsPerDay} tickets`;
    const left = Math.max(0, CONFIG.duel.seasonDays - (Date.now() - (S.duel.seasonStart || Date.now())) / 86400000);
    d.head.querySelector('[data-f="season"]').textContent = `Season ends in ${Fmt.dur(left * 86400)}`;

    const sig = S.duel.rank + '|' + Duel.tickets() + '|' + (S.duel.wins | 0) + '|' + (S.duel.losses | 0);
    if (sig === Duel._sig) return;
    Duel._sig = sig;

    d.list.innerHTML = '';
    d.list.appendChild(UI.el('div', 'sec-title serif', 'Challengeable'));
    let any = false;
    const myBr = Stats.br();
    for (let i = 0; i < CONFIG.duel.challengeRange; i++) {
      const targetRank = S.duel.rank - (i + 1);
      if (targetRank < 1) break;
      const npc = S.duel.npcs[targetRank - 1];
      if (!npc) continue;
      any = true;
      const b = UI.el('button', 'btn sm' + (Duel.tickets() > 0 ? ' primary' : ''), 'Duel');
      b.disabled = Duel.tickets() <= 0;
      b.dataset.act = 'duel'; b.dataset.idx = String(i);
      const edge = npc.br > 0 ? myBr / npc.br : 1;
      d.list.appendChild(UI.itemCard({
        emoji: '\u{1F5E1}',
        name: `#${targetRank} ${npc.name}`,
        rarity: edge >= 1.15 ? 'green' : (edge >= 0.85 ? 'blue' : 'purple'),
        sub: `BR ${Fmt.n(npc.br)} · yours ${Fmt.n(myBr)}`,
        right: b,
      }));
    }
    if (!any) d.list.appendChild(UI.el('div', 'empty', 'You stand at the very top. Enjoy the draught.'));

    d.list.appendChild(UI.el('div', 'sec-title serif', 'Above you'));
    for (let r = Math.max(1, S.duel.rank - 8); r < S.duel.rank; r++) {
      const npc = S.duel.npcs[r - 1];
      if (!npc) continue;
      d.list.appendChild(UI.itemCard({
        emoji: '·', name: `#${r} ${npc.name}`, rarity: 'gray', sub: `BR ${Fmt.n(npc.br)}`,
      }));
    }
  },
};

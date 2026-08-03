/* ============================================================================
 * Retention — Pass (the free Ascension Path), Ach (achievements), Mail (inbox),
 * and the daily/weekly task tracker that feeds them.
 *
 * FORMULAS
 *   Daily/weekly tasks live in S.daily.tasks / S.weekly.tasks as
 *     {id, prog, need, done, claimed}
 *   and are advanced purely from Bus events, so the player never "reports" work.
 *   Claiming a task pays activity points; activity points drive both the three
 *   daily chests (40 / 80 / 120) and the 50-level Ascension Path
 *   (CONFIG.economy.passPointsPerLevel = 100 per level).
 *
 * Achievements read a dotted stat path out of the save generically, so adding a
 * new achievement is a pure DATA change.
 * ==========================================================================*/

const Pass = {
  _dom: null, _sig: '',

  init() {
    try { UI.register('pass', () => Pass.render()); } catch (e) { /* optional */ }
    Pass._wireTasks();
    try { Stats.provider(Pass._bonus); } catch (e) { /* optional */ }
  },
  tick() {},

  /* Pass milestones can grant permanent pill attempts (rewards:{passAttempt:1}). */
  _bonus(acc) {
    if (typeof S === 'undefined' || !S || !S.pass) return;
    let n = 0;
    for (const lvl of (S.pass.claimed || [])) {
      const row = DATA.pass.find(p => p.lvl === lvl);
      if (row && row.rewards && row.rewards.passAttempt) n += Math.floor(Number(row.rewards.passAttempt) || 0);
    }
    acc.pillAttempts += n;
  },

  /* -------------------------------------------------- task event plumbing */
  _wireTasks() {
    const tables = [
      { list: () => DATA.dailies, state: () => S.daily.tasks },
      { list: () => DATA.weeklies, state: () => S.weekly.tasks },
    ];
    const evts = {};
    for (const t of DATA.dailies.concat(DATA.weeklies)) {
      if (t && t.evt) evts[t.evt] = true;
    }
    for (const evt in evts) {
      try {
        Bus.on(evt, (data) => {
          let touched = false;
          for (const tbl of tables) {
            const defs = tbl.list();
            const st = tbl.state();
            if (!Array.isArray(st)) continue;
            for (const row of st) {
              const def = defs.find(d => d.id === row.id);
              if (!def || def.evt !== evt || row.done) continue;
              if (typeof def.match === 'function') {
                let ok = false;
                try { ok = !!def.match(data || {}); } catch (e) { ok = false; }
                if (!ok) continue;
              }
              row.prog = (Number(row.prog) || 0) + 1;
              if (row.prog >= row.need) { row.done = true; touched = true; }
              touched = true;
            }
          }
          if (touched) { Pass._badge(); UI.dirty('pass'); }
        });
      } catch (e) { /* optional */ }
    }
  },

  _defOf(id) {
    return DATA.dailies.find(d => d.id === id) || DATA.weeklies.find(d => d.id === id) || null;
  },

  claimTask(scope, id) {
    const st = scope === 'weekly' ? S.weekly.tasks : S.daily.tasks;
    if (!Array.isArray(st)) return false;
    const row = st.find(r => r.id === id);
    if (!row || !row.done || row.claimed) return false;
    const def = Pass._defOf(id);
    row.claimed = true;
    const pts = Math.max(0, Math.floor(Number(def && def.points) || 0));
    Pass.addPoints(pts);
    UI.toast(`+${pts} activity`, 'good');
    Pass._badge();
    UI.dirty('pass');
    Save.save();
    return true;
  },

  claimAllTasks() {
    let n = 0;
    for (const row of (S.daily.tasks || [])) if (row.done && !row.claimed) { if (Pass.claimTask('daily', row.id)) n++; }
    for (const row of (S.weekly.tasks || [])) if (row.done && !row.claimed) { if (Pass.claimTask('weekly', row.id)) n++; }
    if (!n) UI.toast('Nothing to claim.', 'bad');
    return n;
  },

  /* ------------------------------------------------------- activity/levels */
  addPoints(n) {
    const add = Math.max(0, Math.floor(Number(n) || 0));
    if (!add) return 0;
    S.daily.activityPoints = (Math.floor(Number(S.daily.activityPoints) || 0)) + add;
    S.pass.points = (Math.floor(Number(S.pass.points) || 0)) + add;

    const per = CONFIG.economy.passPointsPerLevel;
    let lvl = Math.floor(S.pass.points / per);
    if (lvl > CONFIG.economy.passLevels) lvl = CONFIG.economy.passLevels;
    if (lvl > (S.pass.level | 0)) {
      S.pass.level = lvl;
      UI.toast(`Ascension Path — level ${lvl}`, 'gold');
    }
    try { Bus.emit('activity', { points: add }); } catch (e) { /* optional */ }
    Pass._badge();
    return add;
  },

  chestReady(i) {
    const need = CONFIG.economy.dailyChestPoints[i];
    return (S.daily.activityPoints | 0) >= need && !(S.daily.chestsClaimed || [])[i];
  },
  claimChest(i) {
    if (!Pass.chestReady(i)) return false;
    if (!Array.isArray(S.daily.chestsClaimed)) S.daily.chestsClaimed = [false, false, false];
    S.daily.chestsClaimed[i] = true;
    const rewards = { jade: [20, 26, 34][i] || 20, stone: Math.round(2000 * Math.pow(3, S.player.realm) / 3) };
    Econ.grantAll(rewards);
    UI.toast(`Chest opened — ${Econ.rewardText(rewards)}`, 'gold');
    Pass._badge();
    UI.dirty('pass');
    Save.save();
    return true;
  },

  claimLevel(lvl) {
    if (lvl > (S.pass.level | 0)) { UI.toast('Not reached yet.', 'bad'); return false; }
    if (!Array.isArray(S.pass.claimed)) S.pass.claimed = [];
    if (S.pass.claimed.indexOf(lvl) >= 0) return false;
    const row = DATA.pass.find(p => p.lvl === lvl);
    if (!row) return false;
    S.pass.claimed.push(lvl);
    Pass._grant(row.rewards || {});
    UI.toast(`Level ${lvl} claimed`, 'gold');
    Stats.invalidate(); Stats.recompute();
    Pass._badge();
    UI.dirty('pass');
    Save.save();
    return true;
  },
  claimAllLevels() {
    let n = 0;
    for (const row of DATA.pass) {
      if (row.lvl <= (S.pass.level | 0) && (S.pass.claimed || []).indexOf(row.lvl) < 0) {
        if (Pass.claimLevel(row.lvl)) n++;
      }
    }
    if (!n) UI.toast('Nothing to claim.', 'bad');
    return n;
  },

  /* Rewards may contain non-currency grants (curio / blueprint / formula). */
  _grant(rw) {
    const cur = {};
    for (const k in rw) {
      if (k === 'curio') { try { Curios.own(rw[k] === 'random' ? null : rw[k]); } catch (e) { /* optional */ } continue; }
      if (k === 'blueprint') {
        const id = rw[k] === 'random' ? U.pick(DATA.blueprints).id : rw[k];
        if (!S.inv.blueprints.includes(id)) S.inv.blueprints.push(id);
        continue;
      }
      if (k === 'formula') {
        const id = rw[k] === 'random' ? U.pick(DATA.formulas).id : rw[k];
        if (!S.inv.formulas.includes(id)) S.inv.formulas.push(id);
        continue;
      }
      if (k === 'passAttempt') continue;   // read by Pass._bonus
      cur[k] = rw[k];
    }
    Econ.grantAll(cur);
  },

  _badge() {
    let n = 0;
    for (const row of (S.daily.tasks || [])) if (row.done && !row.claimed) n++;
    for (const row of (S.weekly.tasks || [])) if (row.done && !row.claimed) n++;
    for (let i = 0; i < 3; i++) if (Pass.chestReady(i)) n++;
    for (const row of DATA.pass) {
      if (row.lvl <= (S.pass.level | 0) && (S.pass.claimed || []).indexOf(row.lvl) < 0) n++;
    }
    try { UI.badge('more.pass', n); } catch (e) { /* pre-boot */ }
    return n;
  },
  badges() { return Pass._badge(); },

  /* ---------------------------------------------------------------- panel */
  render() {
    const panel = UI.panel('pass');
    if (!panel) return;
    if (!Pass._dom || !panel.contains(Pass._dom.root)) Pass._build(panel);
    const d = Pass._dom;

    const ap = S.daily.activityPoints | 0;
    d.ap.textContent = `${ap} activity today`;
    d.lvl.textContent = `Level ${S.pass.level | 0} / ${CONFIG.economy.passLevels}`;
    const per = CONFIG.economy.passPointsPerLevel;
    d.bar.style.width = U.clamp(((S.pass.points | 0) % per) / per, 0, 1) * 100 + '%';

    const sig = ap + '|' + (S.pass.level | 0) + '|' + (S.pass.claimed || []).length + '|'
      + (S.daily.tasks || []).map(t => t.prog + (t.claimed ? 'c' : '')).join(',')
      + '|' + (S.weekly.tasks || []).map(t => t.prog + (t.claimed ? 'c' : '')).join(',');
    if (sig === Pass._sig) return;
    Pass._sig = sig;

    // chests
    d.chests.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const need = CONFIG.economy.dailyChestPoints[i];
      const claimed = (S.daily.chestsClaimed || [])[i];
      const ready = Pass.chestReady(i);
      const b = UI.el('button', 'btn sm' + (ready ? ' primary glow' : ''), claimed ? 'Opened' : (ready ? 'Open' : String(need)));
      b.disabled = !ready;
      if (ready) { b.dataset.act = 'chest'; b.dataset.idx = String(i); }
      const box = UI.el('div', 'col');
      box.appendChild(UI.el('div', 'h3', claimed ? '\u{1F4E6}' : '\u{1F381}'));
      box.appendChild(b);
      d.chests.appendChild(box);
    }

    d.tasks.innerHTML = '';
    Pass._renderTasks(d.tasks, 'daily', S.daily.tasks, 'Today');
    Pass._renderTasks(d.tasks, 'weekly', S.weekly.tasks, 'This week');

    d.levels.innerHTML = '';
    d.levels.appendChild(UI.el('div', 'sec-title serif', 'Ascension Path'));
    const from = Math.max(1, (S.pass.level | 0) - 2);
    for (const row of DATA.pass.filter(p => p.lvl >= from && p.lvl <= from + 11)) {
      const owned = (S.pass.claimed || []).indexOf(row.lvl) >= 0;
      const reached = row.lvl <= (S.pass.level | 0);
      const b = UI.el('button', 'btn sm' + (reached && !owned ? ' primary' : ''), owned ? '✓' : (reached ? 'Claim' : 'Locked'));
      b.disabled = owned || !reached;
      if (reached && !owned) { b.dataset.act = 'plvl'; b.dataset.idx = String(row.lvl); }
      let txt = '';
      try { txt = Econ.rewardText(row.rewards || {}); } catch (e) { txt = ''; }
      d.levels.appendChild(UI.itemCard({
        emoji: row.lvl % 10 === 0 ? '\u{1F3C6}' : '\u{2728}',
        name: `Level ${row.lvl}`,
        rarity: row.lvl % 10 === 0 ? 'gold' : (owned ? 'green' : 'gray'),
        sub: txt || 'A small kindness.',
        right: b,
      }));
    }
  },

  _renderTasks(host, scope, list, title) {
    host.appendChild(UI.el('div', 'sec-title serif', title));
    if (!Array.isArray(list) || !list.length) {
      host.appendChild(UI.el('div', 'empty', 'Nothing set.'));
      return;
    }
    for (const row of list) {
      const def = Pass._defOf(row.id);
      const b = UI.el('button', 'btn sm' + (row.done && !row.claimed ? ' primary' : ''),
        row.claimed ? '✓' : (row.done ? 'Claim' : `${row.prog}/${row.need}`));
      b.disabled = row.claimed || !row.done;
      if (row.done && !row.claimed) { b.dataset.act = 'task'; b.dataset.id = row.id; b.dataset.scope = scope; }
      host.appendChild(UI.itemCard({
        emoji: row.claimed ? '✓' : '\u{1F4CB}',
        name: (def && def.name) || row.id,
        rarity: row.claimed ? 'green' : 'gray',
        sub: `+${(def && def.points) || 0} activity`,
        right: b,
      }));
    }
  },

  _build(panel) {
    panel.innerHTML = '';
    const root = UI.el('div', 'scroll');
    const head = UI.el('div', 'card tight');
    head.innerHTML = `<div class="row between"><span class="lbl" data-f="lvl"></span>
      <span class="val" data-f="ap"></span></div><div class="bar exp"><i data-f="bar"></i></div>
      <div class="row between" data-f="chests" style="margin-top:8px"></div>`;
    root.appendChild(head);
    const bar2 = UI.el('div', 'row');
    const ca = UI.el('button', 'btn wide', 'Claim Tasks');
    ca.dataset.act = 'claimTasks';
    const cl = UI.el('button', 'btn wide', 'Claim Levels');
    cl.dataset.act = 'claimLevels';
    bar2.appendChild(ca); bar2.appendChild(cl);
    root.appendChild(bar2);
    const tasks = UI.el('div', 'col'); root.appendChild(tasks);
    const levels = UI.el('div', 'col'); root.appendChild(levels);
    root.appendChild(UI.el('div', 'safe-b'));
    panel.appendChild(root);
    Pass._dom = {
      root, tasks, levels,
      ap: head.querySelector('[data-f="ap"]'), lvl: head.querySelector('[data-f="lvl"]'),
      bar: head.querySelector('[data-f="bar"]'), chests: head.querySelector('[data-f="chests"]'),
    };
    root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      const a = el.dataset.act;
      if (a === 'task') Pass.claimTask(el.dataset.scope, el.dataset.id);
      else if (a === 'chest') Pass.claimChest(parseInt(el.dataset.idx, 10));
      else if (a === 'plvl') Pass.claimLevel(parseInt(el.dataset.idx, 10));
      else if (a === 'claimTasks') Pass.claimAllTasks();
      else if (a === 'claimLevels') Pass.claimAllLevels();
      Pass._sig = '';
    });
  },
};

/* ============================================================================
 * Ach — achievements. Each row reads a dotted path out of the save.
 * ==========================================================================*/
const Ach = {
  _dom: null, _sig: '',

  init() {
    try { UI.register('ach', () => Ach.render()); } catch (e) { /* optional */ }
    const evts = ['breakthrough', 'huntClear', 'pillCrafted', 'gearCrafted', 'duelFight',
      'spireClear', 'curioGain', 'techUnlock', 'respira', 'samsara', 'clashDone'];
    for (const e of evts) { try { Bus.on(e, () => Ach.check()); } catch (err) { /* optional */ } }
  },
  tick(dt) {
    Ach._acc = (Ach._acc || 0) + dt;
    if (Ach._acc < 5) return;
    Ach._acc = 0;
    Ach.check();
  },

  read(pathStr) {
    let cur = S;
    for (const seg of String(pathStr).split('.')) {
      if (cur == null) return 0;
      cur = (seg === 'length') ? (cur.length || 0) : cur[seg];
    }
    const n = Number(cur);
    return Number.isFinite(n) ? n : 0;
  },

  check() {
    if (!S || !S.ach) return;
    if (!Array.isArray(S.ach.done)) S.ach.done = [];
    let newly = 0;
    for (const a of DATA.achievements) {
      if (S.ach.done.indexOf(a.id) >= 0) continue;
      if (Ach.read(a.stat) >= a.need) { S.ach.done.push(a.id); newly++; }
    }
    if (newly) {
      UI.toast(`${newly} achievement${newly > 1 ? 's' : ''} earned`, 'gold');
      Ach._sig = '';
      UI.dirty('ach');
    }
    Ach._badge();
  },

  claim(id) {
    if (!Array.isArray(S.ach.claimed)) S.ach.claimed = [];
    if (S.ach.done.indexOf(id) < 0 || S.ach.claimed.indexOf(id) >= 0) return false;
    const a = DATA.achievements.find(x => x.id === id);
    if (!a) return false;
    S.ach.claimed.push(id);
    Econ.grant('jade', a.jade || 0);
    UI.toast(`+${a.jade} Fate Jade`, 'gold');
    Ach._badge(); Ach._sig = ''; UI.dirty('ach'); Save.save();
    return true;
  },
  claimAll() {
    let n = 0;
    for (const id of S.ach.done.slice()) if (Ach.claim(id)) n++;
    if (!n) UI.toast('Nothing to claim.', 'bad');
    return n;
  },

  _badge() {
    const done = S.ach.done || [], claimed = S.ach.claimed || [];
    const n = done.filter(id => claimed.indexOf(id) < 0).length;
    try { UI.badge('more.ach', n); } catch (e) { /* pre-boot */ }
    return n;
  },
  badges() { return Ach._badge(); },

  render() {
    const panel = UI.panel('ach');
    if (!panel) return;
    if (!Ach._dom || !panel.contains(Ach._dom.root)) Ach._build(panel);
    const sig = (S.ach.done || []).length + '/' + (S.ach.claimed || []).length;
    if (sig === Ach._sig) return;
    Ach._sig = sig;

    const d = Ach._dom;
    d.head.textContent = `${(S.ach.done || []).length} / ${DATA.achievements.length} earned`;
    d.list.innerHTML = '';
    const rows = DATA.achievements.slice().sort((a, b) => {
      const ad = S.ach.done.indexOf(a.id) >= 0, bd = S.ach.done.indexOf(b.id) >= 0;
      const ac = (S.ach.claimed || []).indexOf(a.id) >= 0, bc = (S.ach.claimed || []).indexOf(b.id) >= 0;
      const rank = (dn, cl) => (dn && !cl) ? 0 : (dn ? 2 : 1);
      return rank(ad, ac) - rank(bd, bc);
    });
    for (const a of rows) {
      const done = S.ach.done.indexOf(a.id) >= 0;
      const claimed = (S.ach.claimed || []).indexOf(a.id) >= 0;
      const have = Ach.read(a.stat);
      const b = UI.el('button', 'btn sm' + (done && !claimed ? ' primary' : ''),
        claimed ? '✓' : (done ? `+${a.jade}` : `${Fmt.n(have)}/${Fmt.n(a.need)}`));
      b.disabled = claimed || !done;
      if (done && !claimed) { b.dataset.act = 'ach'; b.dataset.id = a.id; }
      d.list.appendChild(UI.itemCard({
        emoji: claimed ? '\u{1F3C5}' : (done ? '\u{2B50}' : '\u{25CB}'),
        name: a.name, rarity: claimed ? 'green' : (done ? 'gold' : 'gray'),
        sub: a.desc, right: b,
      }));
    }
  },

  _build(panel) {
    panel.innerHTML = '';
    const root = UI.el('div', 'scroll');
    const head = UI.el('div', 'card tight');
    const h = UI.el('div', 'val'); head.appendChild(h);
    const b = UI.el('button', 'btn sm wide', 'Claim All'); b.dataset.act = 'achAll';
    head.appendChild(b);
    root.appendChild(head);
    const list = UI.el('div', 'col'); root.appendChild(list);
    root.appendChild(UI.el('div', 'safe-b'));
    panel.appendChild(root);
    Ach._dom = { root, list, head: h };
    root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      if (el.dataset.act === 'ach') Ach.claim(el.dataset.id);
      if (el.dataset.act === 'achAll') Ach.claimAll();
    });
  },
};

/* ============================================================================
 * Mail — the inbox every system uses to deliver grants.
 * ==========================================================================*/
const Mail = {
  _dom: null, _sig: '',

  init() { try { UI.register('mail', () => Mail.render()); } catch (e) { /* optional */ } },
  tick() {},

  /* Public: Mail.send({subject, body, rewards}) */
  send(msg) {
    if (!S) return null;
    if (!Array.isArray(S.mail)) S.mail = [];
    const m = {
      id: U.id(),
      subject: String((msg && msg.subject) || 'A letter'),
      body: String((msg && msg.body) || ''),
      rewards: (msg && msg.rewards) || {},
      read: false, claimed: false, at: Date.now(),
    };
    S.mail.unshift(m);
    while (S.mail.length > CONFIG.economy.mailCap) S.mail.pop();
    Mail._badge(); Mail._sig = ''; UI.dirty('mail');
    return m;
  },

  claim(id) {
    const m = (S.mail || []).find(x => x.id === id);
    if (!m || m.claimed) return false;
    m.claimed = true; m.read = true;
    if (m.rewards && Object.keys(m.rewards).length) {
      Pass._grant(m.rewards);
      UI.toast(Econ.rewardText(m.rewards) || 'Received.', 'good');
    }
    Mail._badge(); Mail._sig = ''; UI.dirty('mail'); Save.save();
    return true;
  },
  claimAll() {
    let n = 0;
    for (const m of (S.mail || []).slice()) if (!m.claimed) { if (Mail.claim(m.id)) n++; }
    if (!n) UI.toast('The inbox is quiet.', 'bad');
    else UI.toast(`Claimed ${n}.`, 'good');
    // sweep read-and-claimed letters so the box stays tidy
    S.mail = (S.mail || []).filter(m => !m.claimed || Object.keys(m.rewards || {}).length === 0).slice(0, CONFIG.economy.mailCap);
    Mail._sig = '';
    return n;
  },

  _badge() {
    const n = (S.mail || []).filter(m => !m.claimed).length;
    try { UI.badge('more.mail', n); } catch (e) { /* pre-boot */ }
    return n;
  },
  badges() { return Mail._badge(); },

  render() {
    const panel = UI.panel('mail');
    if (!panel) return;
    if (!Mail._dom || !panel.contains(Mail._dom.root)) Mail._build(panel);
    const sig = (S.mail || []).map(m => m.id + (m.claimed ? 'c' : '')).join(',');
    if (sig === Mail._sig) return;
    Mail._sig = sig;

    const d = Mail._dom;
    d.list.innerHTML = '';
    if (!(S.mail || []).length) {
      d.list.appendChild(UI.el('div', 'empty', 'No letters. Somehow that is worse.'));
      return;
    }
    for (const m of S.mail) {
      const b = UI.el('button', 'btn sm' + (m.claimed ? '' : ' primary'), m.claimed ? '✓' : 'Claim');
      b.disabled = m.claimed;
      if (!m.claimed) { b.dataset.act = 'mail'; b.dataset.id = m.id; }
      let rw = '';
      try { rw = Econ.rewardText(m.rewards || {}); } catch (e) { rw = ''; }
      d.list.appendChild(UI.itemCard({
        emoji: m.claimed ? '\u{1F4C4}' : '\u{2709}',
        name: m.subject, rarity: m.claimed ? 'gray' : 'blue',
        sub: (m.body || '') + (rw ? ' — ' + rw : ''),
        right: b,
      }));
    }
  },

  _build(panel) {
    panel.innerHTML = '';
    const root = UI.el('div', 'scroll');
    const b = UI.el('button', 'btn wide primary', 'Claim All');
    b.dataset.act = 'mailAll';
    root.appendChild(b);
    const list = UI.el('div', 'col'); root.appendChild(list);
    root.appendChild(UI.el('div', 'safe-b'));
    panel.appendChild(root);
    Mail._dom = { root, list };
    root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      if (el.dataset.act === 'mail') Mail.claim(el.dataset.id);
      if (el.dataset.act === 'mailAll') Mail.claimAll();
    });
  },
};

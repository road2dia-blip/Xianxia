/* ============================================================================
 * Dev — hidden developer panel (tap the version string 7x to open)
 *
 * Contents:
 *   - time warp  +1h / +8h / +24h  (routes through Boot.warp -> Offline.apply)
 *   - currency grants
 *   - BR calculator (what BR does the game EXPECT at each realm vs what you have)
 *   - headless autoplay simulation: plays N days "optimally" and logs the realm
 *     reached per day. This is the tool used to tune CONFIG against spec section 21.
 *
 * The simulation runs on a DEEP COPY of the save: it swaps S out, drives the real
 * systems, records the trace, then restores the player's real save. Nothing it does
 * can touch live progress.
 * ==========================================================================*/

const Dev = {
  open: false,

  init() {
    try {
      UI.onVersionTap(() => this.show());
    } catch (e) { /* UI may not expose it; the panel is optional */ }
  },

  /* ---------------------------------------------------------------- panel */
  show() {
    const body = document.createElement('div');
    body.innerHTML = `
      <div class="sec">
        <div class="lbl">Time warp</div>
        <div class="row wrap" id="dvWarp">
          <button class="btn sm" data-warp="3600">+1h</button>
          <button class="btn sm" data-warp="28800">+8h</button>
          <button class="btn sm" data-warp="86400">+24h</button>
        </div>
      </div>
      <div class="sec">
        <div class="lbl">Grant</div>
        <div class="row wrap" id="dvGrant">
          <button class="btn sm" data-g="stone" data-n="1000000">Stone</button>
          <button class="btn sm" data-g="jade" data-n="5000">Jade</button>
          <button class="btn sm" data-g="tech" data-n="50000">Tech</button>
          <button class="btn sm" data-g="guide" data-n="200">Guides</button>
          <button class="btn sm" data-g="citrine" data-n="20000">Citrine</button>
          <button class="btn sm" data-g="stones" data-n="20000">Forge St.</button>
          <button class="btn sm" data-g="dust" data-n="5000">Dust</button>
          <button class="btn sm" data-g="insight" data-n="500">Insight</button>
          <button class="btn sm" data-g="lawShard" data-n="500">Law Sh.</button>
          <button class="btn sm" data-g="mats" data-n="500">All mats</button>
        </div>
      </div>
      <div class="sec">
        <div class="lbl">Realm</div>
        <div class="row wrap" id="dvRealm">
          <button class="btn sm" data-realm="-1">- realm</button>
          <button class="btn sm" data-realm="1">+ realm</button>
          <button class="btn sm" data-phase="1">+ phase</button>
          <button class="btn sm" data-act="fillbar">Fill bar</button>
        </div>
      </div>
      <div class="sec">
        <div class="lbl">Battle Rating check</div>
        <div id="dvBR" class="col tiny"></div>
      </div>
      <div class="sec">
        <div class="lbl">Autoplay simulation</div>
        <div class="row wrap">
          <button class="btn sm" data-sim="7">Sim 7 days</button>
          <button class="btn sm" data-sim="14">Sim 14 days</button>
          <button class="btn sm" data-sim="30">Sim 30 days</button>
          <button class="btn sm" data-sim="7" data-idle="1">Sim 7d idle-only</button>
        </div>
        <pre class="mono tiny" id="dvSim" style="white-space:pre-wrap;max-height:240px;overflow:auto"></pre>
      </div>`;

    this.renderBR(body.querySelector('#dvBR'));

    body.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;

      if (b.dataset.warp) {
        const lines = Boot.warp(+b.dataset.warp);
        UI.toast(`Warped ${Fmt.dur(+b.dataset.warp)} — ${lines.length} gain lines`, 'good');
        this.renderBR(body.querySelector('#dvBR'));
        return;
      }
      if (b.dataset.g) {
        const n = +b.dataset.n;
        if (b.dataset.g === 'mats') {
          for (const m of ['herb', 'core', 'forge', 'seed']) {
            for (let t = 1; t <= 6; t++) Econ.grant(`${m}:${t}`, n);
          }
          Econ.grant('fruit', n);
        } else {
          Econ.grant(b.dataset.g, n);
        }
        UI.toast('Granted.', 'good');
        UI.dirty('cultivate', 'wilds', 'battle', 'abode', 'more');
        UI.refreshBadges();
        return;
      }
      if (b.dataset.realm) {
        S.player.realm = U.clamp(S.player.realm + (+b.dataset.realm), 0, CONFIG.cultivation.maxRealm);
        S.player.phase = 1; S.player.exp = 0;
        Stats.recompute(); UI.dirty('cultivate'); UI.refreshBadges();
        this.renderBR(body.querySelector('#dvBR'));
        return;
      }
      if (b.dataset.phase) {
        S.player.phase = U.clamp(S.player.phase + 1, 1, CONFIG.cultivation.phasesPerRealm);
        S.player.exp = 0; Stats.recompute(); UI.dirty('cultivate');
        this.renderBR(body.querySelector('#dvBR'));
        return;
      }
      if (b.dataset.act === 'fillbar') {
        S.player.exp = Cultivation.phaseReq(S.player.realm, S.player.phase);
        UI.dirty('cultivate');
        return;
      }
      if (b.dataset.sim) {
        const out = body.querySelector('#dvSim');
        out.textContent = 'running...';
        setTimeout(() => {
          const r = this.simulate(+b.dataset.sim, { idleOnly: !!b.dataset.idle });
          out.textContent = r.text;
        }, 30);
      }
    });

    UI.modal({ title: 'Dev', wide: true, body,
      buttons: [{ label: 'Close', cls: 'ghost', act: (c) => c() }] });
  },

  renderBR(host) {
    if (!host) return;
    const have = Stats.br();
    const r = S.player.realm;
    const want = CONFIG.breakthrough.benchmarkBR[r] || 0;
    const ratio = want ? have / want : 0;
    const cls = ratio >= 1 ? 'good' : (ratio >= 0.75 ? 'gold' : 'bad');
    host.innerHTML = `
      <div class="kv"><span class="k">Your BR</span><span class="v">${Fmt.n(have)}</span></div>
      <div class="kv"><span class="k">Benchmark (realm ${r})</span><span class="v">${Fmt.n(want)}</span></div>
      <div class="kv"><span class="k">Ratio</span><span class="v ${cls}">${Fmt.pct(ratio)}</span></div>
      <div class="kv"><span class="k">Tribulation foe</span><span class="v">${Fmt.n(want * CONFIG.breakthrough.tribulationBRMult)}</span></div>`;
  },

  /* ------------------------------------------------------------ SIMULATION */
  /* Plays `days` of optimal-ish play on a throwaway copy of the save.
     Returns { text, trace:[{day, realm, phase, br}] }. */
  simulate(days, opts) {
    opts = opts || {};
    const realS = S;
    const trace = [];
    let text = '';

    try {
      // fresh character on the same path, so the sim measures the CURVE not the save
      S = freshState();
      S.created = true;
      S.createdAt = Date.now();
      S.lastSeen = Date.now();
      S.player.name = 'Sim';
      S.player.path = realS.player.path || 'sword';
      S.lastDaily = U.todayStr();
      S.lastWeekly = U.weekStr();
      Stats.invalidate();
      Stats.recompute();

      const HOUR = 3600;
      for (let d = 1; d <= days; d++) {
        // --- idle accrual, hour by hour so aura tracks realm growth as it climbs
        for (let h = 0; h < 24; h++) {
          const aura = Cultivation.auraPerSec();
          Cultivation.addExp(aura * HOUR, 'sim');
          this.simAutoBreak();
        }

        if (!opts.idleOnly) {
          // --- daily actives ---------------------------------------------
          // respira: 8 banked charges + a few tapped wisps
          const respiras = 12;
          for (let i = 0; i < respiras; i++) {
            const aura = Cultivation.auraPerSec();
            let exp = aura * 60 * CONFIG.respira.expMinutes * (1 + Stats.bonus('respiraExp'));
            S.respira.sinceSurge++;
            if (S.respira.sinceSurge >= CONFIG.respira.surgePity || Math.random() < CONFIG.respira.surgeChance) {
              exp *= CONFIG.respira.surgeMult;
              S.respira.sinceSurge = 0;
              Econ.grant('insight', 1);
            }
            Cultivation.addExp(exp, 'sim');
            Econ.grant('tech', 3);
            this.simAutoBreak();
          }

          // pills: spend the full daily attempt budget on the best EXP pill
          const attempts = CONFIG.alchemy.pillAttemptsBase + Stats.bonus('pillAttempts');
          const rank = U.clamp(S.player.realm, 1, CONFIG.alchemy.ranks);
          for (let i = 0; i < attempts; i++) {
            const flat = CONFIG.alchemy.expPillMinutes * 60 *
              CONFIG.cultivation.aura.base * Math.pow(CONFIG.cultivation.aura.growth, rank);
            const rel = Cultivation.phaseReq(S.player.realm, S.player.phase) * CONFIG.alchemy.expPillPhaseFrac;
            const q = 2; // assume blue-ish average quality
            const exp = Math.max(flat, rel) * CONFIG.alchemy.qualityMult[q] * (1 + Stats.bonus('pillExp'));
            Cultivation.addExp(exp, 'sim');
            this.simAutoBreak();
          }

          // sect meditation: 10 min at x3 aura
          Cultivation.addExp(Cultivation.auraPerSec() * CONFIG.sect.meditationSec *
            (CONFIG.sect.meditationMult - 1), 'sim');
          this.simAutoBreak();

          // technique investment: spend tech points down the cheapest useful nodes
          this.simBuyTechs();
        }

        Stats.invalidate(); Stats.recompute();
        trace.push({
          day: d,
          realm: S.player.realm,
          name: (DATA.realms[S.player.realm] || {}).name || '?',
          phase: S.player.phase,
          br: Stats.br(),
        });
      }

      const targets = [
        { day: 1, realm: 3, label: 'Virtuoso by day 1-2' },
        { day: 7, realm: 5, label: 'Incarnation by day 5-7' },
      ];
      const lines = trace.map(t =>
        `d${String(t.day).padStart(2)}  r${t.realm} ${t.name.padEnd(12)} p${t.phase}  BR ${Fmt.n(t.br)}`
      );
      let verdict = '';
      for (const tg of targets) {
        const at = trace.find(t => t.day === tg.day);
        if (!at) continue;
        verdict += `\n${at.realm >= tg.realm ? 'OK  ' : 'MISS'} ${tg.label} -> day ${tg.day} reached realm ${at.realm}`;
      }
      text = (opts.idleOnly ? '[IDLE ONLY]\n' : '[ACTIVE PLAY]\n') + lines.join('\n') + '\n' + verdict;
    } catch (e) {
      text = 'sim error: ' + (e && e.message ? e.message : String(e));
      console.error('[everdao] sim failed', e);
    } finally {
      S = realS;
      Stats.invalidate();
      Stats.recompute();
    }
    return { text, trace };
  },

  /* Auto-advance realms in the sim: assume the player wins tribulations when their
     BR meets the benchmark, and otherwise stalls (which is the honest outcome). */
  simAutoBreak() {
    let guard = 0;
    while (Cultivation.canBreak() && guard++ < 40) {
      const r = S.player.realm;
      if (r >= CONFIG.cultivation.maxRealm) break;
      if (r >= CONFIG.breakthrough.chanceRealmMax + 1) {
        const want = CONFIG.breakthrough.benchmarkBR[r] * CONFIG.breakthrough.tribulationBRMult;
        if (Stats.br() < want * 0.85) break;   // not strong enough yet — stall here
      }
      S.player.realm = r + 1;
      S.player.phase = 1;
      S.player.exp = 0;
      S.stats.breakthroughs++;
      Stats.invalidate();
      Stats.recompute();
    }
  },

  /* Spend accumulated Tech Points on the cheapest unowned affordable node. */
  simBuyTechs() {
    let guard = 0;
    while (guard++ < 60) {
      const owned = S.techs.owned;
      const avail = DATA.techs.filter(t =>
        owned.indexOf(t.id) < 0 &&
        S.player.realm >= (CONFIG.techs.rankUnlockRealm[t.rank - 1] || 0) &&
        (t.cost.tech || 0) <= S.cur.tech &&
        (t.cost.guide || 0) <= S.cur.guide
      );
      if (!avail.length) break;
      avail.sort((a, b) => (a.cost.tech || 0) - (b.cost.tech || 0));
      const pick = avail[0];
      Econ.spend('tech', pick.cost.tech || 0);
      if (pick.cost.guide) Econ.spend('guide', pick.cost.guide);
      owned.push(pick.id);
      Stats.invalidate();
    }
    Stats.recompute();
  },
};

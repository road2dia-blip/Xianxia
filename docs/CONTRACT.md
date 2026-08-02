# EVERDAO — INTEGRATION CONTRACT (authoritative)

Every module is authored **against this document**. If your module needs something not
listed here, implement it *locally inside your own module* — do not invent new globals,
do not modify another module's file, and do not assume undocumented helpers exist.

---

## 1. BUILD MODEL

Source files in `src/` are concatenated **in filename order** into a single
`<script>` block inside `everdao.html` by `build.js`. The build wraps everything in
one IIFE with `'use strict';` at the top. Therefore:

* All files share **one top-level scope**. Every top-level binding must be **globally
  unique**. Prefix module-private helpers with the module name (`forgeRollAffixes`,
  not `rollAffixes`).
* Each module declares exactly one `const <Name> = { ... }` system object.
* Cross-module references only happen **inside function bodies** (called after boot),
  never at top level — otherwise you hit a TDZ error.
* **No `import`/`export`, no `require`, no top-level `await`.** No external requests.
* Never call `document.write`. Never use `eval`.
* Target: ES2020 syntax that Safari 15+ supports. `?.` and `??` are fine.

File order:

```
00_config.js      CONFIG                       (written — do not edit)
10_data_*.js      DATA.<table> assignments     (content authors)
20_utils.js       U, Fmt, Bus
21_ui.js          UI  (toast/modal/sheet/float/badge/router)
22_css.js         CSS  (a template string, injected at boot)
23_html.js        SHELL (a template string: HUD + nav + panel roots)
30_state.js       S, Save, Daily, Offline
31_stats.js       Stats, Econ
40_combat.js      Combat
5x_*.js           systems
90_boot.js        Boot
```

Modules assign into pre-existing namespaces; they never re-declare them.
`DATA` and its tables are declared in `10_data_00_index.js`:

```js
const DATA = { realms:[], zones:[], /* ...every table, empty */ };
```

Content files then do `DATA.zones = [ ... ];`.

---

## 2. STATE (`S`)

`S` is the save object. It is a **plain JSON-serialisable tree** — no functions, no
`Map`/`Set`, no `undefined`, no circular refs.

> **`S` is reassigned on load/import.** Never cache `S` or a subtree in a module-level
> variable. Always read through `S.…` at call time.

```js
let S = null;   // declared in 30_state.js

S = {
  v: CONFIG.saveVersion,
  createdAt: 0,           // ms epoch
  lastSeen: 0,            // ms epoch
  lastDaily: '',          // 'YYYY-MM-DD' local
  lastWeekly: '',         // 'YYYY-Www' local
  playtimeSec: 0,
  created: false,         // false => show creation flow

  player: {
    name: '', path: 'body',        // 'body'|'spell'|'sword'|'ghost'
    realm: 0, phase: 1, exp: 0,    // phase 1..9
    eternalLayer: 0,
    luck: 10,
    title: '',
    law: null, lawLevel: 0,        // 'blaze'|'frost'|'thunder'|'wood'|'blade'
    auraColor: 'jade',
    permStats: { hp:0, mp:0, patk:0, matk:0, pdef:0, mdef:0, spd:0 },
    pillUses:  { vital:{}, mind:{} },   // { [realmIndex]: usesThisRealm }
  },

  cur: {                    // all integers >= 0, never negative
    stone:0, jade:0, tech:0, guide:0, citrine:0, contribution:0,
    stones:0,               // Forge Stones
    dust:0,                 // Soul Dust
    insight:0,              // Insight Shards
    lawShard:0,
  },
  lifetimeContribution: 0,

  mats: {                   // 6 tiers each, index 0 == T1
    herb:  [0,0,0,0,0,0],
    core:  [0,0,0,0,0,0],
    forge: [0,0,0,0,0,0],
    seed:  [0,0,0,0,0,0],
    fruit: 0,               // garden fruit for the Extractor
  },

  daily: {
    pillAttemptsUsed:0, respiraCount:0, duelTickets:0, spireAttempts:0,
    sweepUsed:0, sectMedUsed:0, extractorUsed:0, activityPoints:0,
    chestsClaimed:[false,false,false],
    tasks:[],               // [{id, prog, need, done, claimed}]
  },
  weekly: { tasks:[], clashDone:false },

  respira: { charges:0, chargeMs:0, sinceSurge:0, level:0, capUp:0 },

  bt: {                     // breakthrough
    failures:{},            // { [realm]: count }
    injuryUntil:0,          // ms epoch
    loaded:[],              // array of pill inventory keys currently loaded
  },

  alchemy: {
    queue:[],               // [{formulaId, endAt, quality:null}] max CONFIG.alchemy.queueSize+upgrades
    mastery:{},             // { [rank]: {lvl, exp} }
    assistant:false,
    queueUp:0,
    baitUntil:0,
  },

  inv: {
    pills:{},               // { 'r2_exp_blue': 3 }  key = `${formulaId}_${qualityName}`
    formulas:[],            // ['r1_exp', ...]
    blueprints:[],          // ['bp_r1_weapon', ...]
    gear:[],                // Item[] (see §7)
    nextUid:1,
  },
  equipped: { weapon:null, armor:null, pendant:null, relicA:null, relicB:null, relicC:null },
  forge: { pity:0, crafted:0 },

  wilds: {
    zones:{},               // { [zoneId]: {stage:0, cleared:0} }  stage = highest cleared
    expedition:{ zone:null, sinceMs:0, startedAt:0 },
    fortuity:{ queue:[], nextAt:0 },     // queue: [{eventId, step:0}]
  },

  abode: { rooms:{}, garden:[], farm:{ sinceMs:0 } },
                            // rooms: { cultivation:1, alchemy:1, forge:1, garden:1, farm:1, extractor:1, tea:1 }
                            // garden: [{seed:null|tier, endAt:0}]  length = plot count

  sect: { id:null, joinedAt:0, rank:0, lastSwitch:0, tasks:[], medUntil:0 },

  techs: { owned:[] },      // ['t1_1', ...]

  spire: { floor:0, best:0, clears:{} },
  tide:  { nextAt:0, run:null },   // run = live wave state or null
  duel:  { rank:200, npcs:[], seasonStart:0, lastDrift:'', wins:0, losses:0, snapshot:null },

  curios: { owned:[] },
  quests: { step:0, claimed:[] },
  story:  { seen:[] },
  pass:   { level:0, points:0, claimed:[] },
  ach:    { done:[], claimed:[] },
  mail:   [],               // [{id, subject, body, rewards:{}, read:false, claimed:false, at}]
  shops:  { market:{ stock:[], day:'' }, black:{ stock:[], nextAt:0 }, bought:{} },
  samsara:{ cycle:0, marks:0, tree:{} },

  settings:{ speed:1, autoHunt:false, reduceFx:false, confirmSpend:true },
  stats:  { hunts:0, bosses:0, pillsCrafted:0, gearCrafted:0, duels:0, respiras:0, breakthroughs:0 },
  flags:  {},               // one-shot booleans: firstTide, sawLawIntro, ...
};
```

**Bounded collections** (enforce on write, so saves cannot bloat):
`S.mail` ≤ 60 · `S.wilds.fortuity.queue` ≤ 3 · `S.inv.gear` ≤ 300 (auto-salvage worst
gray on overflow) · `S.duel.npcs` = 200 · any log array ≤ 60.

---

## 3. UTILITIES (`20_utils.js`)

```js
const U = {
  rand(a=1,b=0),            // float in [min,max)
  rint(a,b),                // integer inclusive
  chance(p),                // bool, p in 0..1
  pick(arr),                // uniform element
  weightedPick(arr, wfn),   // wfn(item)=>weight ; returns item
  shuffle(arr),             // returns NEW shuffled array
  clamp(v,lo,hi),
  sum(arr),
  hash(str),                // 32-bit int, for deterministic NPC/name generation
  rngFrom(seed),            // () => float in [0,1), mulberry32
  todayStr(d=new Date()),   // 'YYYY-MM-DD' LOCAL
  weekStr(d=new Date()),    // 'YYYY-Www' LOCAL
  deepClone(o),             // JSON round-trip
  id(),                     // unique string id
};

const Fmt = {
  n(v),         // 1.23K / 1.23M / B / T / then aa, ab, ac...  (<1000 => integer)
  n1(v),        // same, one decimal always
  pct(v, dp=1), // 0.125 -> '12.5%'
  dur(sec),     // '3d 4h' / '4h 12m' / '12m 30s' / '30s'
  durShort(sec),// '04:31'
  time(ms),     // local 'HH:MM'
  sign(v),      // '+12' / '-3'
};

const Bus = {
  on(evt, fn),      // returns an unsubscribe fn
  emit(evt, data),  // data is always an object
};
```

`Fmt.n` must handle 0, negatives, `Infinity`, and `NaN` (render `0`) without throwing.

### Bus events (the glue for tasks / quests / achievements)

Emit these **exactly**; task, quest, and achievement modules only listen.

| event | payload |
|---|---|
| `respira` | `{surge:Boolean, exp:Number}` |
| `pillUsed` | `{formulaId, type, rank, quality}` |
| `pillCrafted` | `{formulaId, rank, quality}` |
| `gearCrafted` | `{rank, rarity}` |
| `gearEnhanced` | `{uid, level}` |
| `gearSalvaged` | `{n}` |
| `huntClear` | `{zone, stage, boss:Boolean}` |
| `expeditionClaim` | `{}` |
| `fortuityResolve` | `{eventId, rarity}` |
| `spireClear` | `{floor, first:Boolean}` |
| `spireSweep` | `{floor}` |
| `duelFight` | `{win:Boolean, rank}` |
| `tideWave` | `{wave}` |
| `tideClear` | `{waves}` |
| `phaseUp` | `{realm, phase}` |
| `breakthrough` | `{realm}` |
| `techUnlock` | `{rank, node}` |
| `abodeUpgrade` | `{room, level}` |
| `gardenHarvest` | `{n}` |
| `extractorUsed` | `{tech}` |
| `sectMeditate` | `{}` |
| `sectJoin` | `{id}` |
| `clashDone` | `{win:Boolean}` |
| `curioGain` | `{id}` |
| `shopBuy` | `{shop, id}` |
| `lawChosen` | `{law}` |
| `lawUpgrade` | `{level}` |
| `samsara` | `{cycle}` |
| `activity` | `{points}` |

---

## 4. UI (`21_ui.js`)

```js
const UI = {
  el(tag, cls, text),                 // create element
  qs(sel, root=document),
  panel(id),                          // returns the panel's root <section>
  show(tabId, sub),                   // route; sub is optional sub-tab key
  dirty(...panelIds),                 // mark for re-render
  renderNow(panelId),

  toast(msg, kind='info'),            // kind: info|good|bad|gold
  modal({title, body, buttons, wide, onClose}),  // body: string(HTML) | Element
                                      // buttons: [{label, cls, act(close)}]
  closeModal(),
  sheet({title, body, buttons}),      // bottom sheet, same shape
  confirm(title, msg, onYes),
  float(anchorEl, text, cls),         // floating number, auto-removes
  flash(kind),                        // fullscreen flash: 'gold'|'jade'|'red'
  shake(el),
  badge(key, n),                      // red dot counts; key e.g. 'wilds', 'more.mail'
  rarityCls(r),                       // 'gray'|'green'|... -> 'r-gold'
};
```

* Panels build DOM **once** (on first render) and afterwards **patch** text/width/class.
  Do not `innerHTML =` a whole panel every frame.
* Use **event delegation**: attach one listener to the panel root and read
  `e.target.closest('[data-act]')`. Standard attributes: `data-act`, `data-id`,
  `data-idx`.
* Every button is `.btn` and at least 44px tall.
* Never render raw JSON or object dumps to the user.

### Badge keys
`cultivate`, `wilds`, `battle`, `battle.spire`, `battle.duel`, `battle.tide`,
`abode`, `abode.alchemy`, `abode.garden`, `abode.farm`, `abode.forge`,
`more`, `more.sect`, `more.techs`, `more.curios`, `more.shops`, `more.quests`,
`more.pass`, `more.ach`, `more.mail`.
A parent's dot is the sum of its children — `UI.badge` handles rollup automatically
when the key contains a `.`.

---

## 5. CSS CLASS INVENTORY (`22_css.js`)

The stylesheet author implements **all** of these; panel authors use **only** these.

Layout: `#app` `.hud` `.hud-row` `.nav` `.nav-btn` `.nav-btn.active` `.panel`
`.panel.active` `.scroll` `.tabs` `.tab` `.tab.active` `.safe-b`

Surfaces: `.card` `.card.tight` `.sec` `.sec-title` `.row` `.row.between` `.row.wrap`
`.col` `.grid2` `.grid3` `.grid4` `.divider` `.empty`

Type: `.h1` `.h2` `.h3` `.lbl` `.val` `.muted` `.tiny` `.mono` `.serif`
`.good` `.bad` `.gold` `.jade`

Controls: `.btn` `.btn.primary` `.btn.ghost` `.btn.danger` `.btn.sm` `.btn.wide`
`.btn:disabled` `.btn.glow` `.stepper` `.toggle` `.toggle.on` `.input` `.textarea`

Data: `.bar` `.bar > i` `.bar.mp` `.bar.hp` `.bar.exp` `.chip` `.chip.realm`
`.pill-chip` `.kv` `.kv .k` `.kv .v` `.stat` `.dot` `.badge` `.meter` `.meter > i`

Rarity: `.r-gray` `.r-green` `.r-blue` `.r-purple` `.r-gold` (text colour)
and `.bg-gray` … `.bg-gold` (border/tint). `.locked`

Cultivate hero: `.hero` `.figure` `.aura` `.aura.a1` `.aura.a2` `.aura.a3`
`.ring` `.ring-in` `.mote` `.wisp` `.bt-btn`

Combat: `.arena` `.side` `.unit` `.unit.dead` `.unit.act` `.unit-emoji` `.unit-bars`
`.dmg` `.dmg.crit` `.dmg.heal` `.dmg.miss` `.blog` `.blog p` `.arena.shake`

Overlays: `.modal-wrap` `.modal` `.modal.wide` `.sheet-wrap` `.sheet`
`.toast-wrap` `.toast` `.toast.good` `.toast.bad` `.toast.gold`
`.flash` `.flash.gold` `.flash.jade` `.flash.red` `.float`

Palette (CSS variables on `:root`):
`--bg:#0d0f14` `--panel:#151a23` `--panel2:#1b2130` `--line:#252c3a`
`--txt:#e6ebf2` `--mut:#8a94a6` `--jade:#35d0a0` `--gold:#e8c76a` `--red:#e05a5a`
`--gray:#8a94a6` `--green:#5fd07a` `--blue:#5aa9e0` `--purple:#b07ae0`

Rules: mobile-first; `#app{max-width:480px;margin:0 auto}`; no horizontal scroll at
360px; `padding-bottom: env(safe-area-inset-bottom)`; only `transform`/`opacity`
animations; respect `.reduce-fx` on `#app` to disable keyframes.

---

## 6. SYSTEM MODULE SHAPE

```js
/* ---------------------------------------------------------------------------
 * <Name> — one-line purpose
 * FORMULAS: ...spell out every formula this module uses...
 * ------------------------------------------------------------------------ */
const Alchemy = {
  init() {},                 // called once after state load; wire Bus listeners here
  tick(dtSec, nowMs) {},     // called every logic tick (250ms). dtSec is seconds.
  render() {},               // called only when its panel is visible AND dirty
  offline(elapsedSec) {},    // optional: grant offline progress, return {label, amount}[]
  badges() { return 0; },    // optional: claimable count for the red dot
  // public API used by other modules goes here, documented above the fn
};
```

`tick` must be cheap and must tolerate `dtSec` up to 3600 (time-warp) — loop
internally in bounded steps or compute closed-form. Never assume `dtSec ≈ 0.25`.

---

## 7. SHARED SERVICES

### `Stats` (`31_stats.js`)
```js
Stats.recompute();        // recomputes Stats.p from S; call after ANY change
Stats.p                   // {hp,mp,patk,matk,pdef,mdef,spd,crit,critDmg,hit,dodge,lifesteal}
Stats.br(block=Stats.p)   // BR = hp*.08 + (patk+matk)*4 + (pdef+mdef)*3 + spd*6
Stats.bonus(key)          // aggregated multiplier bonus, see keys below
Stats.unit()              // a combat unit for the player (see §8)
```
`Stats.bonus(key)` keys — every module contributing a bonus registers a provider via
`Stats.provider(fn)` where `fn(acc)` mutates an accumulator object:
`aura`, `respiraExp`, `pillExp`, `pillAttempts` (flat int), `btChance`,
`expedition`, `alchemyQuality`, `forgeQuality`, `curioPower`, `lawProc`,
`offlineHours` (flat), `allStat`, `hp`, `patk`, `matk`, `pdef`, `mdef`, `spd`,
`crit`, `critDmg`, `lifesteal`, `dodge`, `shield`, `thrall`.

Formula: `stat = base(realm,phase) * pathMult * (1 + techPct + gearPct + miscPct) + flats`.

### `Econ` (`31_stats.js`)
```js
Econ.can(kind, n)          // kind: 'stone'|'jade'|'tech'|'guide'|'citrine'|'stones'
                           //       |'dust'|'insight'|'lawShard'|'contribution'
                           //       |'herb:2'|'core:5'|'forge:1'|'seed:3'|'fruit'
Econ.spend(kind, n)        // returns false and spends NOTHING if insufficient
Econ.grant(kind, n)        // clamps to >= 0, emits nothing
Econ.grantAll(obj)         // {stone:100, jade:5, 'herb:1':3}
Econ.label(kind)           // display name
Econ.icon(kind)            // emoji
```
`Econ.spend` is the **only** way to remove currency. No module decrements `S.cur`
directly. Currency can never go negative — `Econ` asserts this.

### `Save`
```js
Save.save()          // throttled write
Save.saveNow()
Save.load()          // returns true if a save existed
Save.migrate(raw)    // version-by-version upgrade, returns migrated raw
Save.export()        // base64 string
Save.import(str)     // validates, returns {ok, err}
Save.reset()
```

---

## 8. COMBAT (`40_combat.js`)

A **Unit**:
```js
{ name, emoji, side:'ally'|'foe', element:null|'blaze'|..., path:null|'body'|...,
  hp, maxHp, mp, maxMp, patk, matk, pdef, mdef, spd,
  crit, critDmg, hit, dodge, lifesteal,
  skill:{ id, name, cd, mult, kind:'phys'|'magic', target:'one'|'all' } | null,
  isPlayer:false, isThrall:false,
  // runtime, added by the engine — do not set:
  shield:0, buffs:[], cdLeft:0, bleed:0, burn:0, stun:0, alive:true }
```

```js
Combat.simulate(allies, foes, opts) -> {
  win:Boolean, rounds:Number, log:[{r, t:'hit'|'crit'|'miss'|'skill'|'law'|'dot'|'die'|'info',
                                    src, tgt, val, text}],
  allyHpPct, foeHpPct, allies, foes
}
```
`opts`: `{ seed, maxRounds, lawProc, wardPill, furyPill, boons:[], modifiers:[] }`.

`Combat.simulate` is **pure**: no DOM, no `S` mutation, no `Math.random` unless
`opts.seed` is absent. Every fight in the game (hunts, spire, tide, duel, tribulation,
clash, gauntlet, dev autoplay) calls it.

```js
Combat.play({ allies, foes, opts, title, onDone(result), canSkip, prePills })
```
renders the animated arena into a full-screen sheet, then calls `onDone(result)` with
exactly the object `simulate` returned. Skip resolves instantly with the same object.

Damage: `dmg = ATK * mult * 200/(200 + DEF)` where physical checks `pdef`, magic checks
`mdef`; then `× critDmg` on crit; then `× (1 ± 0.15)` on element advantage; shields
absorb before HP; Bleed/Burn tick at end of round; 30-round cap → higher remaining
HP% wins (ties go to the ally side).

---

## 9. CONTENT (`DATA`) SHAPES

```js
DATA.realms   = [{ i, name, era, desc }]                       // 12
DATA.zones    = [{ id, name, emoji, realm, tier, blurb, monsters:[monsterIdx], boss:{...} }]
DATA.monsters = [{ id, name, emoji, element, role:'bruiser'|'caster'|'swift', skill }]
DATA.monsterSkills = [{ id, name, kind, mult, target, effect }]   // 12
DATA.formulas = [{ id:'r2_exp', rank, type:'exp'|'vital'|'mind'|'bt'|'meridian'
                  |'ward'|'fury'|'bait', name, emoji, desc,
                  cost:{ stone, 'herb:2':n, 'core:2':n }, craftSec }]
DATA.gearBases= [{ id, slot, rank, name, emoji, main:{stat, val} }]
DATA.relics   = [{ id, kind:'off'|'def'|'util', rank, name, emoji, effect:{key,val} }]
DATA.affixes  = [{ key, name, min, max, pct:Boolean }]
DATA.blueprints=[{ id:'bp_r1_weapon', rank, slot, name }]
DATA.techs    = [{ id:'t3_2', rank, idx, name, flavor,
                   kind:'stat'|'effect', key, val,
                   cost:{tech, guide} }]                        // 96 (16 ranks x 6)
DATA.curios   = [{ id, name, emoji, flavor, key, val }]          // 24
DATA.events   = [{ id, title, rarity:'C'|'R'|'E'|'M', text,
                   choices:[{ label, req?, outcomes:[{ w, text, effects, next? }] }] }]
DATA.quests   = [{ id, title, desc, tab, check(), rewards:{}, dialogue:[lines] }]
DATA.dialogue = { shifu:{ [beatId]: [lines] }, rival:{...} }
DATA.shops    = { market:[], library:[], jade:[], dust:[], black:[] }
DATA.achievements = [{ id, name, desc, stat, need, jade }]       // ~40
DATA.dailies  = [{ id, name, need, points, evt, match? }]        // 8
DATA.weeklies = [{ id, name, need, points, evt }]                // 5
DATA.pass     = [{ lvl, rewards:{} }]                            // 50
DATA.spireBosses = [{ floor, name, emoji, modifier, desc }]      // 20
DATA.tideBoons= [{ id, name, emoji, desc, apply(unit) }]
DATA.sects    = [{ id, name, emoji, blurb, bonus:{key,val}, library:[shopIds] }]
DATA.names    = { surnames:[20], givens:[24], epithets:[] }
DATA.laws     = [{ id, name, emoji, color, desc }]               // 5
DATA.samsaraTree = [{ id, name, desc, max, cost, key, val }]
DATA.titles   = [{ id, name, req }]
```

`effects` in fortuity outcomes is a declarative object resolved by `Wilds.applyEffects`:
`{ exp:'30m' | Number, stone:n, jade:n, tech:n, luck:±n, respiraCharge:±n,
   'herb:2':n, curio:'random', pill:'random', fight:{power, loot:2} }`

---

## 10. HOUSE RULES

1. **No TODOs, no stubs, no "coming soon".** Every button does something real.
2. Guard every array/object access from the save (`S.wilds.zones[id] || default`) —
   old saves and migrations will have gaps.
3. Any timer stored in state is an **absolute ms epoch** (`endAt`), never a countdown,
   so it survives reload and time-warp.
4. `Math.random()` is fine in gameplay; `Combat.simulate` must use the seeded RNG when
   `opts.seed` is given (needed by the autoplay sim).
5. Clamp every displayed number through `Fmt`. Never `toFixed` into the DOM directly.
6. Every module that grants something must also register its red-dot count.
7. Prefer boring code. Long explicit `if`/`switch` beats clever abstraction.

---

## 11. SYSTEM REGISTRY & PANEL OWNERSHIP

`90_boot.js` looks these up **by name**. Declare exactly the name listed; a missing
system is skipped with a console warning rather than crashing the game.

| System | File | Owns panel | Notes |
|---|---|---|---|
| `Cultivation` | `50_cultivation.js` | `cultivate` | hero screen, phases, breakthrough, tribulation, era ascension, eternal layers |
| `Respira` | `50_cultivation.js` | — | renders into the cultivate panel |
| `Wilds` | `51_wilds.js` | `wilds` | hunts, expedition, fortuity |
| `Battle` | `52_battle.js` | `battle` | sub-tab host only: spire / duel / tide |
| `Spire` | `52_battle.js` | — | renders into `battle` sub-tab |
| `Duel` | `53_duel.js` | — | renders into `battle` sub-tab |
| `Tide` | `52_battle.js` | — | renders into `battle` sub-tab |
| `Abode` | `54_abode.js` | `abode` | sub-tab host + cultivation room, garden, farm, extractor, tea room |
| `Alchemy` | `55_alchemy.js` | — | renders into `abode` sub-tab |
| `Forge` | `56_forge.js` | — | renders into `abode` sub-tab; also owns gear/relics/enhance/refine/salvage |
| `Sect` | `57_sect.js` | `sect` | tasks, library, meditation, rank, weekly clash |
| `Techs` | `58_techs.js` | `techs` | 16 ranks x 6 nodes |
| `Law` | `58_techs.js` | `law` | law choice + 20 upgrade levels |
| `Curios` | `59_curios.js` | `curios` | collection + set bonuses |
| `Shops` | `60_shops.js` | `shops` | market / black / library / jade / dust sub-tabs |
| `Quests` | `61_meta.js` | `quests` | main chain |
| `Story` | `61_meta.js` | — | dialogue modals, `Story.beat(id)` |
| `Pass` | `62_retention.js` | `pass` | 50-level Ascension Path |
| `Ach` | `62_retention.js` | `ach` | ~42 achievements |
| `Mail` | `62_retention.js` | `mail` | inbox + Claim All |
| `Samsara` | `63_samsara.js` | `samsara` | rebirth + permanent tree |
| `More` | `64_more.js` | `more` | menu grid linking every sub-panel |
| `Settings` | `64_more.js` | `settings` | export/import/reset, speed, reduce-fx |
| `Dev` | `80_dev.js` | — | hidden panel: time-warp, grants, BR calc, autoplay sim |

### Cross-system calls that ARE allowed (documented public API)

```js
Cultivation.addExp(n, src)        // the ONLY way to grant cultivation EXP
Cultivation.auraPerSec()          // -> number
Cultivation.phaseReq(r, p)        // -> number
Cultivation.canBreak()            // -> bool
Respira.trigger(fromWisp)         // spend a charge / tap a wisp
Wilds.applyEffects(effects, ctx)  // resolve a declarative fortuity effects object
Wilds.expeditionRate()            // -> {stone, exp, herb, core, forge} per hour
Alchemy.usePill(invKey)           // -> bool
Alchemy.pillCount(type, minQuality)
Forge.equippedBonus(acc)          // Stats provider
Forge.itemStats(item)             // -> stat block
Techs.has(id)                     // -> bool
Sect.addContribution(n)
Curios.own(id)                    // grant a curio, handles dupes
Mail.send({subject, body, rewards})
Story.beat(id)                    // show a dialogue beat once (idempotent per id)
Pass.addPoints(n)                 // activity points -> pass levels
Combat.simulate / Combat.play     // see section 8
```

Anything not on this list stays private to its module.

### Unlock gating

Every panel render starts with:
```js
if (UI.lock('wilds', CONFIG.unlocks.wilds)) return;
```
`UI.lock` renders the dimmed "Unlocks at <Realm>" placeholder and returns `true`
when `S.player.realm < needed`.

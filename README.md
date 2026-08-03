# EVERDAO

A complete single-player idle cultivation RPG in **one self-contained HTML file**.
No servers, no network calls, no build step required to play, no advertisements and
nothing to buy. Open `everdao.html` and cultivate.

> You begin as a novice on a cold mountain with weak tea and a Shifu who is
> unimpressed by grandeur. Twelve realms later you may be something else.

---

## Play

Download **`everdao.html`** and open it in any browser — double-click it, or drop it
onto a phone and open it from Files. It works fully offline. Progress saves to
`localStorage` every 15 seconds and on tab close; if storage is unavailable the game
falls back to memory and warns you so you can use **Settings → Export Save**.

Designed portrait-first at 390×844, verified down to 360px wide, and centred at
480px on desktop.

---

## What is in it

**Cultivation** — 12 realms across three eras (Novice → Eternal), each with 9 phases.
Aura accrues always, including offline (12h cap, upgradable to 18h). Breakthroughs at
Novice–Foundation are a chance roll you can weight with pills; from Virtuoso up they
become a **tribulation battle** against your own Heart Demon. Failure means a Dao
Injury and a 30-minute wait — but the insight it grants makes the next attempt easier.

**Respira** — wisps drift across the cultivate screen while you watch, and charges
bank one per 30 minutes whether you are there or not. Each is a burst of EXP with an
8% chance of an Insight Surge worth six times as much, guaranteed within 15.

**The Wilds** — 6 zones of 40 hunt stages plus 6 Spirit-era remixes, an idle
expedition that farms whichever zone you assign, and 30 hand-written fortuity events
with weighted outcomes and a hidden Luck stat.

**Combat** — one seeded auto-battler drives every fight in the game: hunts, the Demon
Spire, Beast Tide, duels, tribulations, sect clashes and the era gauntlets. Four
permanent Paths (Body, Spell, Sword, Ghost) with distinct skills and passives, five
elemental Laws on an advantage wheel, twelve monster skills, bleed/burn/stun/shield.

**The Abode** — cultivation room, alchemy (48 formulas, craft queue, per-rank
mastery, 8 pill types), forge (gear and relics, rarity, affixes, a pity meter,
enhance to +15, refine to 5★, salvage), garden, spirit farm, extractor, tea room.

**Progression** — 96 technique nodes across 16 ranks, 24 curios with set bonuses, 3
NPC sects with duties and a weekly clash, a 200-rival duel ladder with tiers, daily
drift and 14-day seasons, a 200-floor Demon Spire, a 32-step story chain, 42
achievements, a 50-level free Ascension Path, and optional Samsara Rebirth.

**Economy** — Spiritstone, Fate Jade, Tech Points, Tech Guides, Citrine, Contribution,
Forge Stones, Soul Dust, Insight Shards, Law Shards and four material lines across six
tiers. Every currency has a documented faucet and a documented sink (see the audit
comment in `src/31_stats.js`). Fate Jade is earned, never sold; everything the genre
normally monetises is a Jade Shop upgrade you play for.

---

## Building from source

The shipped file is generated. Sources live in `src/` and are concatenated in
filename order into one `<script>` inside a single IIFE.

```sh
node build.js          # src/*.js  ->  everdao.html
```

`docs/CONTRACT.md` is the authoritative integration contract: the save shape, the
utility / UI / combat / economy APIs, the CSS class inventory, the DATA table shapes
and the system registry. Every module is written against it.

```
src/00_config.js       every tunable number in the game
src/10_data_*.js       all content tables (realms, zones, monsters, items, story…)
src/20-23_*.js         utilities, UI kernel, stylesheet, HTML shell
src/30-31_*.js         save/load/migrate/offline, stats and economy
src/40_combat.js       the auto-battler
src/5x-6x_*.js         gameplay systems, one file each
src/80_dev.js          hidden dev panel (tap the version string 7 times)
src/90_boot.js         boot, character creation, the two loops
```

## Verifying

Four harnesses drive the real built file in headless Chromium:

```sh
node tools/validate-data.js   # content integrity: counts, cross-file id references,
                              # quest predicates, achievement paths, effect keys
node tools/smoke.js           # boot, navigation, layout, saves, offline, no console errors
node tools/systems.js         # every gameplay system end to end
node tools/balance.js 8       # runs the in-game autoplay sim, checks the pacing targets
node tools/probe.js           # measures BR and EXP rates per realm (used for tuning)
```

`tools/smoke.js --shots` also writes screenshots to `tools/shots/`.

## Balance

The realm curve is tuned by simulation rather than by feel. Measured on a fresh save:

| Milestone | Idle only | With active play |
|---|---|---|
| First breakthrough (Connection) | 151 s | ~1 min |
| Foundation | ~28 min | ~12 min |
| Virtuoso | ~8.9 h | day 1 |
| Incarnation | ~13.7 d | day 6 |

Maximum stored EXP is `3.39e14`, comfortably inside double precision — no big-number
library is needed.

## Credits

Systems and pacing are modelled on the mobile idle-xianxia genre. All names, writing,
art (CSS, SVG and emoji only) and numbers here are original to this project.

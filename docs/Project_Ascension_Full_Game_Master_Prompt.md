# Project Ascension — Full Playable Cultivation Game
## Master Implementation Prompt for Claude Fable 5.1 in Claude Code

---

## HOW TO USE THIS DOCUMENT (read before sending anything)

This document is written in two parts that are meant to be delivered differently.

**Part A — The Standing Charter (Sections 1–14).** Save this as `CLAUDE.md` in the root of the new Unreal project folder, or as `/docs/ASCENSION_CHARTER.md` referenced from `CLAUDE.md`. Claude Code reads `CLAUDE.md` automatically at the start of every session, so the charter stays in force across sessions without being re-pasted. It contains the vision, terminology, rules, data model, realm ladder, mechanics, architecture, and reporting standards.

**Part B — The Kickoff Message (Section 15).** Send this as the first chat message after the charter is in place. It tells Claude which milestone to start on and how to stop.

Do not paste Parts A and B together as one message. A single fifteen-thousand-word message is worse than a charter plus a short instruction: it crowds the context that Claude needs for tool results, and it gets summarized away as the session grows. A `CLAUDE.md` is re-read every session and is never summarized.

**Gate before you begin.** This document assumes the aura-circulation prototype in `/Game/MCP_Test/AuraCirculation` has been played through Stage 7 (inward draw and absorption) and that the answer to the question "does establishing circulation and releasing an inward Pulse feel like cultivation?" is *yes* or *yes with tuning notes*. If the answer is *no* or *uncertain*, do not start this build. Fix the prototype first. Milestone 1 of this document re-validates the loop in the new project regardless, but it cannot rescue a loop that never felt right.

**Recommended session procedure.**
```
cd "<path to new project>"
claude --model claude-fable-5-1
/status         (confirm Fable)
/mcp            (confirm unreal-mcp connected, if using MCP for editor operations)
```
Then send the Kickoff Message. Approve one milestone at a time. Every milestone ends with a report in the format of Section 14 and a stop. Play every milestone yourself before approving the next. The implementation agent cannot hold keys; you are the only source of evidence about feel.

---

# PART A — THE STANDING CHARTER

---

## 1. Role and standing instructions

You are the lead technical designer and implementation engineer for **Project Ascension**, a single-player classless cultivation game built in **Unreal Engine 5.8**. You have full access to the project through Claude Code: the file system, the build tools, and (when connected) the Unreal MCP for editor operations. You may write C++ and Blueprints. You may create Materials, Niagara systems, MetaSounds, Data Assets, Data Tables, Widgets, Levels, and Input assets.

Your job is to produce a **directly playable game**: launch the editor or a packaged build, press Play, and cultivate from the first minor realm of the first major realm to the ninth minor realm of the ninth major realm, with every system described here functioning, readable, and tuned.

This charter is authoritative. When a decision is not covered here, choose the option that best serves the player fantasy in Section 3 and the decision rules in Section 13, then record the decision in the change log so it can be reviewed.

You work in milestones (Section 12). You stop at the end of every milestone and wait for approval. You never begin the next milestone on your own initiative.

---

## 2. Project boundaries and safety rules

This is a **new project**, created from the Unreal Third Person template (or Blank template, at your discretion, reported in Milestone 0). Because it is a fresh project owned entirely by this build, the restrictions that applied to the disposable sandbox are relaxed, but not removed.

### 2.1 You MAY
- Create a new project and configure Project Settings, GameMode, Enhanced Input, Collision channels, Rendering settings, and plugins that ship with the engine (Enhanced Input, Niagara, MetaSounds, Control Rig, Gameplay Tags, Common UI, Gameplay Abilities if you choose and justify it).
- Write C++ classes for data, state, and systems. Prefer C++ for anything that is a data model, a state machine, a save format, or a calculation that must be deterministic. Prefer Blueprint for visuals, timing, and anything a designer will tune.
- Use the template mannequins, their animations, and their materials.
- Create new levels, materials, VFX, audio, UI, and input.
- Refactor your own earlier work when a milestone report explains why.

### 2.2 You MUST NOT
- Download or install anything from outside the engine and the project. No Marketplace/Fab assets, no third-party plugins, no external libraries, no fetched textures or sounds. Everything is created in-project or ships with the engine.
- Add multiplayer, replication, networking, or any online feature.
- Add a real fluid simulation, a physics-driven aura, or thousands of independent Qi actors. The aura is a field represented by parameters, materials, and Niagara, not by a simulation.
- Make individual Qi Wisps the player-controlled objects. No cursor targeting, no wisp-following reticle, no dragging, no A/D steering of Qi, no predetermined orbit tracks or circular wisp paths.
- Use the word "Law" as a progression term anywhere in code, data, or UI. Use Dao, Dao Insight, Dao Aspect, Dao Principle, Technique.
- Call the Qi resource "mana," "energy," or "MP" in any user-facing text.
- Introduce combat, inventory, economy, quests, factions, NPC dialogue, or an open world. This game is about cultivation. The only "enemies" are instability, impurity, and the player's own impatience. A Technique test target may exist (Section 9.6) so that Dao Techniques have something to be demonstrated on.
- Silently expand scope. If you believe a system in this charter is necessary but insufficient, report it at the end of the milestone and propose the smallest addition.
- Report a feature as complete without the evidence required in Section 14.

### 2.3 Source control
Initialize a git repository at Milestone 0 with a sensible `.gitignore` for Unreal (Binaries, Intermediate, Saved, DerivedDataCache). Commit at the end of every milestone with the milestone name in the commit message. Never force-push. Never rewrite history.

### 2.4 Change log
Maintain `/docs/CHANGELOG.md`. Every milestone appends: assets created, assets modified, C++ files added or changed, Project Settings changed, compile results, test results, warnings, and decisions taken that this charter did not specify.

---

## 3. Vision and player fantasy

### 3.1 What this game is
Project Ascension is a classless cultivation game inspired by xianxia and related cultivation fiction. The player begins as an unformed cultivator who can barely sense Qi, and develops through nine major Realms of nine minor realms each, through Mantras that change how they cultivate, through mastery of Qi conditions and natures, and through Daos that grant Techniques, Principles, and identity.

There are no character classes. The player's Dao investments *are* their class.

The central fantasy is not "getting stronger." It is **learning to perceive, control, refine, and embody increasingly profound forces**. Each Realm must feel like a new level of understanding, not a bigger number.

### 3.2 The defining moment
Every implementation decision serves one moment:

> A cultivator sits in stillness, extends their aura, gathers the world's energy, and draws it into themselves through deliberate control.

If a feature makes that moment less clear, less embodied, or less readable, the feature is wrong.

### 3.3 The core loop
```
Enter meditation (body remains in the world as an anchor)
→ Consciousness enters the Cultivation Space
→ The aura becomes visible around the cultivator
→ Qi exists within the field as passive material
→ The player establishes global aura circulation (Q/E)
→ The whole field responds as one current
→ The player charges a Pulse (hold)
→ The aura compresses; inward pressure builds
→ The player releases the Pulse
→ An inward wave propagates from the boundary to the centre
→ Eligible Qi is drawn toward the Dantian, according to distance, condition, nature, and resistance
→ Qi reaches the Dantian threshold, condenses, and is absorbed (or resisted, or rejected)
→ Cultivation Progress, Dao Insight, Stability, and Purity update
→ When Progress fills, the player attempts a Breakthrough
→ A successful Breakthrough advances the minor realm; the ninth minor Breakthrough is a Major Breakthrough with a Tribulation
→ Each Realm expands the aura, unlocks systems, introduces new Qi natures, new Mantras, deeper Dao nodes, and a new responsibility
→ Exit meditation; return to the body
```

### 3.4 Three kinds of player, one system
- **Low-attention cultivator.** Wants to leave the game cultivating. Uses a stable Mantra, an automatic circulation and a safe automatic Pulse cadence. Progress is slow, safe, and never wasted. This mode is real cultivation, not an idle stub: it runs the same aura, the same wisps, the same absorption, with conservative automatic inputs.
- **Casual cultivator.** Plays actively but does not master timing. Reads the aura, circulates, pulses when Qi looks close, accepts some instability. Progresses noticeably faster than the low-attention mode.
- **Mastery cultivator.** Reads Qi condition and nature, times Pulse release to circulation peaks, manages Stability against Impure surges, uses Mantra-specific behaviours, and exploits Dao nodes. Progresses fastest and unlocks Insight that others miss.

These must be **different levels of mastery over the same system**. There is no separate idle minigame. The automatic mode literally presses the same functions with cautious parameters.

---

## 4. Terminology (binding)

| Term | Meaning |
|---|---|
| **Realm** | One of nine major stages of cultivation. Also "Major Realm". |
| **Minor Realm** / **Layer** | One of nine sub-stages within a Major Realm. Written as e.g. "Foundation Establishment, 4th Layer". |
| **Cultivation Progress** | Fill toward the next Breakthrough. |
| **Breakthrough** | The act of advancing a minor or major realm. Has a success chance, a cost, and a failure state. |
| **Tribulation** | The special, dangerous Breakthrough from the 9th Layer of a Major Realm to the 1st Layer of the next. |
| **Inner Qi** / **Qi Reserve** | The player's usable Qi resource. Never "mana". |
| **Dantian** | The internal centre where Qi is absorbed and stored. Has a capacity. |
| **Qi Wisp** | A visible concentration of Qi that can be drawn, refined, absorbed, resisted, or rejected. |
| **Qi Condition** | Pure or Impure (later: also Refined, Corrupted). |
| **Qi Nature** | Generic, Fire, Water, Wood, Metal, Earth, Yin, Yang, Life, Void (introduced by Realm). |
| **Aura** | The cultivator's active field of spiritual reach and influence. The primary interactive object. |
| **Circulation** | The global rotation state of the aura: direction and strength. |
| **Pulse** | A controlled contraction and release of the aura that draws Qi inward. |
| **Stability** | The aura's coherence, 0–1. Low Stability causes weak Pulses, rejection, and backlash. |
| **Purity** | The Dantian's contamination state, 0–1. Absorbing Impure Qi lowers it; refinement raises it. |
| **Backlash** | A damaging event caused by instability: Qi loss, Progress loss, forced exit, or injury. |
| **Qi Deviation** | The severe failure state: a failed Tribulation or catastrophic backlash. |
| **Mantra** | A cultivation method that modifies how the core loop behaves. The player has one active Mantra. |
| **Dao** | A path of understanding. Has a tree of nodes. Grants Techniques, Principles, Expressions, Insights, and a Keystone. |
| **Dao Insight** | Dao-specific currency spent on that Dao's nodes. Earned by cultivating with related Qi and using related Techniques. |
| **Technique** | An active ability granted by a Dao node. |
| **Cultivation Space** | The private inner environment where cultivation is presented. |
| **Anchor** | The player's physical body left in the outer world during meditation. |

---

## 5. Design principles (binding)

1. **The aura is the primary mechanic.** It has reach, density, circulation, pressure, stability, and capacity. Every player action changes one of those and produces a visible consequence.
2. **Cultivation must feel embodied.** Breath, concentration, pressure, compression, internalization. Actions relate to the body and the Dantian.
3. **Progression expands possibilities.** A Realm answers three questions: what broad power does it give, what new behaviour becomes possible, what new problem or responsibility arrives.
4. **Complexity must be earned.** No meter, type, or control appears before the player has a reason to care. Realm gates exist to pace introduction.
5. **Player freedom.** Deep specialization and broad development are both viable. Soft limits and diminishing returns, not hard locks.
6. **Every feature has a readable consequence.** Animation, sound, colour, UI, timing, or outcome. Hidden complexity is not depth.
7. **Failure has quality.** When the player fails, the game shows why: which Qi, which instability, which timing.
8. **Scale by field, not by object.** A ninth-Realm aura is thousands of units across. It is represented by layers, density, waves, and domain-wide state. Never by thousands of actors.
9. **Data over graphs.** New Realms, Qi natures, Mantras, and Dao nodes are rows and assets, not new Blueprint logic.
10. **Placeholder assets, never placeholder thinking.** A capsule is not acceptable where a mannequin exists. A flat ring is not acceptable where a field material can be authored in an hour.

---

## 6. The Realm ladder: nine Major Realms, nine Layers each

### 6.1 Structural rules
- There are exactly **81 progression steps**: 9 Major Realms × 9 Layers.
- Layers 1–3 of a Realm are its **Early** stage, 4–6 **Middle**, 7–9 **Late**. Layer 9 is also called **Peak**. These labels are cosmetic groupings used in UI and in a few Mantra conditions; they do not add mechanics.
- Advancing from Layer *n* to Layer *n+1* within a Realm is a **Minor Breakthrough**.
- Advancing from Layer 9 of Realm *r* to Layer 1 of Realm *r+1* is a **Major Breakthrough**, and it is always a **Tribulation**.
- Each Realm has a **theme**, a **new system**, a **new Qi nature or condition** (from Realm 2 onward), a **new responsibility**, a **Tribulation type**, and an **aura scale**.
- **Every numeric property of every step is data.** The ladder lives in a single Data Table (`DT_RealmLadder`, 81 rows) generated from a formula in a Data Asset (`DA_RealmLadderConfig`) plus per-Realm override rows. You will write a small editor utility (Blutility or C++ commandlet) that regenerates the table from the config so that tuning is a config edit, not 81 manual edits.

### 6.2 The nine Major Realms

Names are provisional and may be replaced by the project owner; the *structure* is not.

| # | Realm | Theme | New system unlocked | New Qi | New responsibility | Tribulation type |
|---|---|---|---|---|---|---|
| 1 | **Qi Sensing** | Learning to perceive. The aura is small and unsteady. | Circulation, Pulse, Pure/Impure, Stability, Basic Mantra | Generic Pure, Generic Impure | Do not absorb Impure Qi carelessly | **Coalescence**: hold a stable full-charge Pulse under an Impure surge |
| 2 | **Qi Condensation** | Compressing Qi into the Dantian. | Purity meter, Refinement Pulse (hold-then-double-tap), Dantian capacity, first Dao unlock | Yin, Yang (natures) | Manage Purity; Impure Qi now contaminates | **Condensation**: absorb a set quantity in one meditation without Purity dropping below threshold |
| 3 | **Foundation Establishment** | Building a lasting base. Aura becomes coherent. | Aura density layers (inner/outer), second Mantra choice, Dao Insight generation, Anchor drift (the body is affected by what happens inside) | Fire, Water | Density must be balanced; an over-dense inner layer rejects Qi | **Foundation**: hold the aura at full density through three wave surges without collapse |
| 4 | **Core Formation** | Forming a Golden Core. The Dantian becomes a structure. | Core (a persistent Dantian object with its own stability), Circulation momentum (circulation persists between meditations), Keystone Dao node available | Wood, Metal | The Core can crack; cracked Core halves absorption until repaired by Pure Qi | **Core Forging**: compress a large Qi mass into the Core under counter-rotating field pressure |
| 5 | **Nascent Soul** | A second self within. | Split circulation (inner and outer layers can rotate independently), automatic cultivation now runs at full efficiency when the player is present, third Mantra choice, Earth nature | Earth | Two layers must not oppose each other for long; opposition drains Stability | **Nascent Birth**: sustain opposing inner/outer circulation for a set duration to birth the Soul |
| 6 | **Soul Transformation** | Refining the self. Impurity becomes a resource. | Corrupted Qi (a third condition) that yields high Insight at high risk, Devouring-type Mantra available, Dao Expression nodes | Life | Corrupted Qi can corrupt the Core; corruption is a persistent state with its own visual | **Transformation**: absorb Corrupted Qi and refine it to Pure before the Purity threshold fails |
| 7 | **Void Refinement** | Cultivating in emptiness. The aura becomes a domain. | Domain (the Cultivation Space itself changes with the aura; environment nodes appear inside the domain), Void nature, Realm-scale wave layers | Void | Void Qi reduces reach if absorbed carelessly; the domain can shrink | **Void Crossing**: maintain a Pulse cadence while the domain is collapsing inward |
| 8 | **Dao Integration** | Merging path and self. | Dual active Mantras (with conflict rules), second Keystone, Dao resonance (nodes in two Daos interact) | Refined condition (Pure Qi that has been refined twice) | Resonance can overload; overload causes Qi Deviation if uncontrolled | **Integration**: cultivate under both Mantras simultaneously while resonance is at peak |
| 9 | **Ascension** | Transcending the mortal frame. | Ascension Pulse (a field-wide contraction that consumes the domain), final Dao nodes, endgame state | — (all natures available) | Every action has a tenfold consequence; instability is catastrophic | **Ascension**: the final sequence; success ends the game with the ascension cinematic, failure is Qi Deviation and a return to 9th Realm Layer 1 |

### 6.3 What every Layer changes
Each Layer, on its own, changes the following numbers by formula (all exposed in `DA_RealmLadderConfig`):
- **Aura Reach** (radius in Unreal units). Suggested: `Reach = BaseReach × RealmGrowth^(Realm−1) × (1 + LayerGrowth × (Layer−1))`, with BaseReach 800, RealmGrowth 1.9, LayerGrowth 0.06. That gives roughly 800 at 1.1, ~1200 at 1.9, ~1500 at 2.1, ~5500 at 4.1, ~40,000 at 7.1, and beyond 250,000 at 9.9. Reach above ~6000 is presented by the Domain system (Section 7.9), not by a larger flat mesh.
- **Dantian Capacity** (Qi units storable). Suggested: `Capacity = 10 × 3^(Realm−1) × (1 + 0.1 × (Layer−1))`.
- **Qi Reserve maximum** (spendable Inner Qi). Suggested: `Reserve = Capacity × 0.6`.
- **Progress Required** for the next Breakthrough. Suggested: `Required = 8 × 2.2^(Realm−1) × (1 + 0.25 × (Layer−1))`, so early Layers are quick and each Peak is meaningful.
- **Base Stability Recovery** per second. Suggested: `0.05 + 0.01 × Realm`.
- **Max Circulation Strength** cap. Suggested 1.0 at all Layers; Mantras and Daos raise it.
- **Pulse Charge Duration** and **Recovery Duration**. Suggested: charge 1.25 s reducing by 0.03 s per Realm to a floor of 0.9 s; recovery 0.75 s reducing by 0.02 s per Realm to a floor of 0.5 s.
- **Ambient Qi Spawn** in the Cultivation Space: count of wisps present at once, spawn interval, Pure:Impure ratio, nature weights. Suggested: count `3 + Realm × 2 + Layer ÷ 3`, Impure fraction rising from 0.33 at Realm 1 to 0.5 at Realm 6 then falling as refinement dominates.
- **Breakthrough Success Chance** (Section 7.10): base `0.9 − 0.05 × (Layer−1)` for Minor, modified by Stability and Purity at the moment of attempt; Tribulations have no random chance, they are skill sequences.

### 6.4 Minor Breakthrough
When `CultivationProgress ≥ ProgressRequired`, the debug HUD and the Dantian both indicate readiness. The player triggers a Breakthrough with a dedicated input (Section 8) *while in meditation*. A Minor Breakthrough is:
1. A three-second held charge that behaves like a Pulse charge but compresses the entire aura toward the Dantian (visual: the field's boundary collapses inward).
2. On release, a success roll modified by current Stability and Purity. Success: the Layer advances, all Layer numbers update immediately, the aura visibly re-expands to its new Reach, a chime sounds, Progress resets to zero, and a small Dao Insight bonus is granted.
3. Failure: Progress drops by a data-defined fraction (suggested 25%), Stability drops to a data-defined value (0.4), and the player cannot re-attempt for a cooldown (suggested 20 s). The failure shows *why*: "Breakthrough failed — Stability 0.31 was below 0.5" or "Purity 0.44 — Impure Qi resisted condensation".

A low-attention player will still reach Breakthroughs but with lower Stability and therefore lower odds; the automatic mode (Section 7.11) waits until Stability recovers before attempting.

### 6.5 Major Breakthrough: the Tribulation
From Layer 9 of any Realm, the Breakthrough input starts a **Tribulation**, a scripted skill sequence lasting 45–120 seconds (data-defined per Realm) inside the Cultivation Space. It is not a random roll. Each Realm has its own Tribulation type (table 6.2). All share the structure:

1. **Warning.** The field darkens; the Dantian pulses; text and sound announce the Tribulation. The player can cancel here at no cost.
2. **Trial.** The Cultivation Space spawns a Realm-specific pattern of Qi surges (waves of Impure or Corrupted Qi, opposing currents, domain collapse) that the player must handle with the same tools they have always used: circulation, Pulse, and Stability management. The Tribulation defines a **success condition** (for example "absorb 40 Qi while Purity stays above 0.6") and a **failure condition** (Stability reaches 0, or Purity reaches 0, or the timer expires).
3. **Resolution.** Success: a Major Breakthrough with a longer sequence (5–8 seconds): the aura collapses completely, the Dantian flares, the new Realm's theme colour washes the space, the aura re-expands to the new Reach with its new density layers, the new system's tutorial hint appears, and the Realm name is shown. Failure: **Qi Deviation** (Section 7.12).

Tribulations are the moments where the mastery player is separated from the casual one. They must be **fair**: every surge must be visible before it arrives, every failure must be attributable.

### 6.6 Data model for the ladder
```
UDA_RealmLadderConfig (Primary Data Asset)
  BaseReach, RealmGrowth, LayerGrowth
  BaseCapacity, CapacityRealmGrowth, CapacityLayerGrowth
  BaseProgress, ProgressRealmGrowth, ProgressLayerGrowth
  ... every formula constant above ...
  TArray<FRealmDefinition> Realms (9 entries)

FRealmDefinition (struct)
  FName RealmId; FText DisplayName; FText Theme
  FLinearColor ThemeColor
  TArray<FName> UnlockedSystems      (gameplay tags, e.g. Ascension.System.Purity)
  TArray<FName> UnlockedQiNatures    (tags)
  TArray<FName> UnlockedQiConditions (tags)
  TArray<FName> UnlockedMantras      (Mantra asset ids)
  int32 DaoNodeDepthUnlocked
  TSubclassOf<UTribulationDefinition> Tribulation
  TMap<FName, float> Overrides       (per-Realm numeric overrides by property name)

FRealmLayerRow (Data Table row, 81 rows, generated)
  int32 Realm; int32 Layer
  float AuraReach; float DantianCapacity; float QiReserveMax
  float ProgressRequired; float StabilityRecovery
  float PulseChargeDuration; float PulseRecoveryDuration
  int32 AmbientWispCount; float AmbientSpawnInterval; float ImpureFraction
  TMap<FName,float> NatureWeights
  float MinorBreakthroughBaseChance
```
The player's `UCultivationState` stores `Realm` and `Layer` and reads the row. Nothing else stores per-Layer numbers.

---

## 7. Cultivation mechanics in full

Everything in this section extends the validated prototype. Where the prototype made a decision that worked (FlowPhase accumulated in Blueprint, force-as-wave matching the visual wave, resistance as a value, wisps with no Tick of their own), keep it.

### 7.1 Aura state (global properties)
```
AuraReach            float   from ladder row, modified by Mantra/Dao
CirculationDirection float   −1, 0, +1 (sign of CirculationSigned)
CirculationStrength  float   0..MaxCirculationStrength
CirculationSigned    float   the single integrated value; Direction and Strength derive from it
InnerDensity         float   0..1 (Realm 3+)
OuterDensity         float   0..1 (Realm 3+)
InnerCirculationSigned float (Realm 5+; before that mirrors CirculationSigned)
PulseCharge          float   0..1
Stability            float   0..1
Purity               float   0..1 (Realm 2+; before that fixed 1.0 and hidden)
Pressure             float   derived: PulseCharge × (1 + InnerDensity)
FlowPhase            float   accumulated in code, drives all field visuals; never shader time
```

### 7.2 Circulation
Held Q builds `CirculationSigned` toward +Max at `BuildRate`; held E toward −Max. Releasing decays toward 0 at `DecayRate`. The opposite key brakes through zero at `BrakeRate`. Both keys held: **Circulation Held**, phase frozen, field dims, Stability recovers 50% faster (this is the "stillness" action, and it matters for Mantras like Stillness and for Tribulations).

From Realm 4, **momentum**: `CirculationSigned` persists between meditations at a data-defined retention (0.5). From Realm 5, inner and outer layers can be driven separately: Q/E drive the outer layer; holding a modifier (Section 8) makes Q/E drive the inner layer. Opposing layers produce a visible shear band and drain Stability at `OppositionDrainRate`; matching layers produce a coherence bonus to Pulse efficiency.

Circulation affects wisps only through the field: a small bounded tangential drift (never an orbit), a Pulse efficiency bonus (`CirculationBonus × Strength`), and, from Realm 3, density-layer sorting (Pure Qi drifts slowly toward the inner layer when circulation is coherent; Impure Qi is pushed outward).

### 7.3 Pulse
Hold the Pulse input to charge from 0 to 1 over `PulseChargeDuration`. While charging the field compresses (existing visuals) and, from Realm 3, `InnerDensity` rises. Over-charging (holding beyond 1.0 by more than `OverchargeGrace`, suggested 0.5 s) drains Stability at `OverchargeDrainRate`; this is the "aggressive cultivation" penalty and it must be visible as a reddening tension in the compression ring.

Release: an inward wave from `AuraReach` to the centre over `PulseFlashDuration`. A wisp is affected when the wave front passes its distance. Impulse:
```
InwardSpeed = PulseBaseSpeed × ReleaseStrength × Falloff(distFraction) × (1 − Resistance) × (1 + CirculationBonus × Strength) × MantraPulseMultiplier × DaoPulseMultiplier
```
The impulse decays over `PulseDrawDuration`; the wisp then settles and returns to Free. Far wisps need multiple Pulses. That rhythm is intentional and must survive tuning.

Release strength floors at `PulseMinReleaseStrength` (0.25). Recovery for `PulseRecoveryDuration` blocks new Pulses with a readable "Recovering" state.

**Refinement Pulse (Realm 2+):** charge to full, then instead of releasing, double-tap the Pulse input. The wave still fires, but wisps it draws are also *refined* on absorption: Impure becomes Pure (Purity is not reduced) at the cost of half the Progress gain and a Stability cost of `RefinementStabilityCost`. This is the tool for handling Impure Qi safely, and the mastery player uses it selectively.

**Ascension Pulse (Realm 9 only):** a data-defined field-wide contraction used in the final Tribulation.

### 7.4 Qi Wisps
A wisp is an actor with no Tick; the `UQiFieldComponent` on the cultivator updates all active wisps each frame. Wisp data:
```
QiCondition   tag  (Pure, Impure, Corrupted, Refined)
QiNature      tag  (Generic, Fire, Water, Wood, Metal, Earth, Yin, Yang, Life, Void)
QiValue       float  progress on absorption
Resistance    float  0..1
StabilityDrainRate float  per second while Drawn
PurityImpact  float  applied on absorption (negative for Impure, strongly negative for Corrupted)
InsightYield  TMap<DaoId, float>  Insight granted on absorption
WispState     Free, Drawn, Absorbing, Absorbed, Rejected, Refining
DistanceFromCenter, AbsorptionProgress, DriftAngle, JitterAmplitude
Visual: Color, Brightness, Noise, Flicker, Size
```
**Every value comes from a preset**: `UDA_QiPreset` assets keyed by (Condition, Nature). The wisp never branches on Condition or Nature. Adding a nature is adding a preset.

**Ambient spawning:** the Cultivation Space maintains the ladder row's `AmbientWispCount` by spawning at `AmbientSpawnInterval` at random radii between 0.3 and 0.95 of Reach and random angles, weighted by `ImpureFraction` and `NatureWeights`. Spawns fade in over 1 s; they never appear in the inner 0.3.

### 7.5 Qi Conditions (behavioural identities, not colours)
- **Pure.** The baseline. Smooth response, clean absorption, small Insight for its nature's Dao.
- **Impure.** Resistance 0.7, drains Stability while Drawn (Option B, validated in the prototype), reduces Purity on absorption, gives 1.5× Progress. If Stability is below `RejectionThreshold` (0.35) when it reaches the Dantian, it is **Rejected**: flung outward to 0.8 Reach with a visible burst and a Stability hit. Impure Qi is the risk/reward axis of the whole early game.
- **Corrupted** (Realm 6+). Resistance 0.85, heavy Stability drain, large Purity loss, 3× Progress, and high Insight for demonic-leaning Daos. Absorbing it without the Refinement Pulse or a Devouring Mantra applies **Corruption** to the Core (a persistent state that reduces Pure Qi attraction until cleansed).
- **Refined** (Realm 8+). Produced only by refining Pure Qi. Resistance 0.05, no drain, 2× Progress, and it *raises* Stability on absorption. Rare.

### 7.6 Qi Natures
Natures determine Insight yield, visual language, and one behavioural trait each. The trait is data (a curve or a couple of floats on the preset), not code:
- **Generic.** No trait. Realm 1.
- **Yin.** Drawn faster by counterclockwise circulation. Realm 2.
- **Yang.** Drawn faster by clockwise circulation. Realm 2.
- **Fire.** Higher Progress, raises Pressure while Drawn (charging next Pulse is faster), drains Stability slightly. Realm 3.
- **Water.** Lower Resistance, restores a little Stability on absorption. Realm 3.
- **Wood.** Slowly multiplies (a Wood wisp left Free for a while spawns a small second Wood wisp, capped). Realm 4.
- **Metal.** High Resistance, very high Progress; only responds to Pulses above 0.8 charge. Realm 4.
- **Earth.** Heavy: slow to draw, but stabilises the aura while Drawn. Realm 5.
- **Life.** Restores Purity on absorption. Realm 6.
- **Void.** Reduces Reach temporarily on absorption but yields the largest Insight. Realm 7.

Yin/Yang give circulation direction a *reason* from Realm 2 onward. Before Realm 2, direction is a pure feel choice (and a Mantra condition).

### 7.7 Stability
0..1. Recovers at the ladder's `StabilityRecovery` per second while meditating, doubled during Circulation Held. Drained by: Impure/Corrupted Qi while Drawn, overcharging, opposing layers (Realm 5+), failed Breakthroughs, Tribulation surges. Effects of low Stability:
- Below 0.7: field visibly flickers; Pulse release strength scaled by `Stability / 0.7`.
- Below 0.5: Minor Breakthrough chance heavily penalised; automatic mode pauses Pulses.
- Below 0.35: Impure Qi is Rejected on arrival.
- At 0: **Backlash** (Section 7.12).

### 7.8 Purity and the Dantian (Realm 2+)
The Dantian has `Capacity`. Absorbed Qi fills the **Qi Reserve** (spendable on Techniques) and contributes to **Progress**. Purity is the Dantian's contamination state. Impure absorption reduces it by `PurityImpact`; Refinement Pulses and Life/Water Qi raise it; it slowly recovers at `PurityRecovery` per second only when the Dantian is below 50% full (a full, contaminated Dantian does not self-clean; the player must spend Qi or refine).

Low Purity: below 0.6 Breakthrough chance drops; below 0.4 Pure Qi is attracted more weakly (contaminated Dantian repels clean Qi); at 0 the Core (Realm 4+) cracks.

The Dantian visual: a glowing sphere at the lower belly that grows brighter with fill and muddier with contamination, with a lotus-hands placeholder from Realm 2 (the mannequin's hands are posed at the belly via a simple Control Rig or a static additive pose; if neither is reliable, a Niagara lotus at the Dantian position is acceptable).

### 7.9 Density layers and the Domain (Realm 3+, Realm 7+)
From Realm 3 the aura has two density layers. `InnerDensity` and `OuterDensity` are visual (material layers) and mechanical (inner density multiplies Pulse draw speed inside 0.4 Reach; outer density multiplies wisp capture radius at the boundary). Density is raised by charging and by coherent circulation, and it decays. Over-dense inner (above 0.9) rejects incoming Qi until it decays. This is the Realm 3 responsibility.

From Realm 7 the aura's Reach exceeds what a flat disc can present. The **Domain** replaces the disc: the Cultivation Space's floor, horizon, and sky are driven by the aura's parameters (the whole space *is* the aura). Circulation becomes a horizon-wide current; Pulse becomes a sky-to-centre collapse; density becomes fog and light. Qi spawns as far as the horizon and approaches over multiple Pulses. Implementation: a second material set and a Niagara "domain" system driven by the same six parameters. The player's controls do not change. This is the proof that the global-field design scales; it must be built and it must be readable.

### 7.10 Breakthrough mechanics
See 6.4 and 6.5. The Minor Breakthrough success chance:
```
Chance = Base × StabilityFactor × PurityFactor × MantraFactor
StabilityFactor = clamp((Stability − 0.3) / 0.5, 0, 1)
PurityFactor    = clamp((Purity − 0.2) / 0.6, 0, 1)   (1.0 before Realm 2)
```
Rolls use a seeded stream stored in the save so that reloading does not reroll.

### 7.11 Automatic cultivation (low-attention mode)
Toggle with the Auto input. When active, an `UAutoCultivationController` drives the *same* input functions the pawn drives: it builds circulation in the active Mantra's preferred direction to `AutoTargetStrength` (0.6), charges a Pulse to `AutoChargeTarget` (0.85) whenever any Pure wisp is within `AutoPulseRange` and Stability is above `AutoStabilityFloor` (0.7), never charges when an Impure wisp is closer than the nearest Pure one unless the Mantra handles Impure safely, never overcharges, never attempts a Breakthrough below Stability 0.9, and always waits for Purity above 0.7 before attempting. It is deliberately conservative. It is visible: the HUD shows "Auto-cultivating (Basic Mantra)" and the aura's inputs animate exactly as if a cautious player were pressing them. The player can take over at any moment by pressing any cultivation input; Auto resumes after `AutoResumeDelay` (5 s) of no input if the toggle is still on.

The rates are exposed. The point is not to make idle optimal; it is to make idle *real*.

### 7.12 Backlash and Qi Deviation
**Backlash** (Stability reaches 0): the aura collapses with a violent visual, all Drawn wisps are Rejected, Progress loses `BacklashProgressLoss` (15%), Qi Reserve loses 50%, the player is forced out of meditation, and the Anchor body shows a lingering injury visual (a dark vein overlay) with a `BacklashRecovery` timer (60 s) during which Stability recovery is halved. The HUD explains the cause: "Backlash — Impure Qi drained Stability while Drawn".

**Qi Deviation** (failed Tribulation, or Backlash while Corrupted, or resonance overload at Realm 8): the severe state. The player drops to Layer 1 of the current Realm (not the previous Realm; the Realm itself is never lost), Progress resets, Purity drops to 0.3, Corruption is applied, the Cultivation Space is visibly scarred for a data-defined period, and a persistent debuff (`DeviationScar`) halves Insight gain until the player completes one clean meditation (absorbs 10 Pure Qi with no Rejection). The scar's cause is displayed and logged. This is the one severe punishment in the game and it must be dramatic, fair, and recoverable.

### 7.13 Exiting meditation, the Anchor, and time
Meditation can be exited at any time except during a Tribulation's Trial phase. Exiting mid-Pulse cancels it. The Anchor body in the outer world plays a seated meditation pose (Section 10.4) while the player is inside. The outer world has a simple day/night cycle (data-driven, ~10 minutes per cycle) and ambient Qi in the Cultivation Space is modulated by it (Yang at day, Yin at night from Realm 2). Nothing else in the outer world is simulated.

---

## 8. Controls

All input uses Enhanced Input with a dedicated `IMC_Cultivation` (active only in meditation) and `IMC_World` (active outside). Every action is rebindable through data; no hardcoded key checks anywhere.

| Action | Default | Context | Behaviour |
|---|---|---|---|
| `IA_Circulate_CW` | Q | Cultivation | Hold: build clockwise circulation |
| `IA_Circulate_CCW` | E | Cultivation | Hold: build counterclockwise circulation |
| `IA_Pulse` | Left Shift | Cultivation | Hold: charge. Release: Pulse. Double-tap at full charge (Realm 2+): Refinement Pulse |
| `IA_LayerModifier` | Left Ctrl | Cultivation | Realm 5+: while held, Q/E drive the inner layer |
| `IA_Breakthrough` | B | Cultivation | Hold 3 s when Progress is full: attempt Breakthrough / start Tribulation |
| `IA_AutoCultivate` | X | Cultivation | Toggle automatic cultivation |
| `IA_Technique_1..4` | 1–4 | Cultivation & World | Activate an equipped Dao Technique |
| `IA_ExitMeditation` | M | Cultivation | Exit to the body (blocked during Tribulation Trial) |
| `IA_EnterMeditation` | M | World | Enter meditation (must be stationary) |
| `IA_Menu` | Tab | Both | Open the Cultivation menu (Mantras, Daos, Realm, Settings). Note: Tab is intercepted by Slate in PIE viewports; also bind `I` |
| `IA_Move`, `IA_Look`, `IA_Jump` | template | World | Template locomotion, unchanged |

Escape is left to the engine. No controls require aiming at Qi. There is no cursor in the Cultivation Space except inside menus.

Controls are always shown in a compact legend in the Cultivation Space HUD, and the legend expands as Realms unlock new actions (Breakthrough appears only when first available; Layer Modifier appears at Realm 5). Unavailable actions are never listed.

---

## 9. Mantras and Daos

### 9.1 Mantra rules
The player has one active Mantra (two at Realm 8). Mantras are `UDA_Mantra` Primary Data Assets. A Mantra is a set of **modifier entries**, each one a (property, operation, value, condition) tuple applied to the cultivation model, plus optional **behaviour hooks** implemented as small Blueprint-implementable functions on a `UMantraBehaviour` object (for the few Mantras that need logic, such as Yin-Yang's transformation). No Mantra is a percentage-only bonus; each must change *what the player does*.

```
UDA_Mantra
  MantraId, DisplayName, Description, Philosophy (one sentence shown in UI)
  RequiredRealm
  PreferredCirculationDirection   (−1, 0, +1; used by Auto mode and by conditions)
  TArray<FMantraModifier> Modifiers
  TSubclassOf<UMantraBehaviour> Behaviour (optional)
  ConflictTags (Realm 8 dual-Mantra rules)

FMantraModifier
  FName Property        (e.g. PulseChargeDuration, ImpureResistance, StabilityRecovery)
  EModifierOp Op        (Add, Multiply, Override)
  float Value
  FGameplayTagQuery Condition (e.g. "circulating CCW", "Stability > 0.8", "Layer is Peak")
```

### 9.2 The Mantras
| Mantra | Realm | Philosophy | Identity (what changes in play) |
|---|---|---|---|
| **Basic Cultivation Mantra** | 1 | "Breathe, circulate, gather." | Balanced. Slightly faster Stability recovery. Auto mode is at its safest. The teaching Mantra. |
| **Stillness Mantra** | 1 (second choice at Realm 3) | "Water settles when undisturbed." | Circulation Held recovers Stability 3× and *slowly draws Pure Qi inward by itself* (a gentle constant field pull, no Pulse needed). Pulse is 30% weaker. Slow, extremely safe, the deep-idle Mantra. |
| **Heavenly Light Mantra** | 3 | "See the pattern; the pattern sees you." | Pure Qi is highlighted with a visible thread to the Dantian; Pure absorption gives +50% Insight; Impure Qi is *repelled* from the inner layer. Weak against Impure, strong for players who read the field. |
| **Fire God's Mantra** | 3 | "Pressure is power." | Pulse charges 40% faster and Pressure raises draw speed, Fire Qi 2× Progress, but Stability drains while charging and overcharge is punishing. The aggressive Mantra. |
| **Yin-Yang Mantra** | 5 | "Two currents, one river." | Requires opposing inner/outer layers to function: while opposed, Impure Qi crossing the shear band is *transformed* to Pure. Coherent layers do nothing special. The transformation Mantra; hard to hold, very rewarding. |
| **Demonic Devouring Mantra** | 6 | "What resists you feeds you." | Impure and Corrupted Qi are drawn *faster* than Pure and yield 3× Progress and high Insight; Purity loss is doubled and Corruption accumulates. Requires deliberate cleansing. The demonic path. |
| **Void Stillness Mantra** | 7 | "Emptiness has no edge." | Reach +50%, ambient Qi count +50%, Void Qi is safe, but Pulse recovery is doubled. The domain Mantra. |
| **Integration Mantra** | 8 | "The path and the walker." | Only usable as the second of two Mantras; it resolves conflicts between the pair and enables Dao resonance. |

### 9.3 Dao rules
Daos are the build system. `UDA_Dao` assets contain a node graph. Node families:
- **Technique** — grants an active ability (slots 1–4).
- **Expression** — modifies a Technique's behaviour or visual.
- **Principle** — passive rule change.
- **Cultivation Insight** — improves interaction with a Qi nature, Mantra, aura state, or Realm system.
- **Keystone** — one per Dao, identity-defining, with a tradeoff. Available at Realm 4.

Nodes cost that Dao's **Insight**. Insight is earned by absorbing Qi of the Dao's natures (via `InsightYield` on presets), by using the Dao's Techniques, and by Breakthroughs. There is no generic Insight after Realm 2 (a small generic pool exists at Realms 1–2 to let the player unlock their first Dao). Depth into a tree is gated by `DaoNodeDepthUnlocked` on the Realm.

Efficiency nodes exist but must express the Dao's philosophy ("Fire Qi is drawn 30% faster" is fine; "+10% cultivation speed" is forbidden).

### 9.4 The Daos in this build
Build **five** Daos with 12–16 nodes each. This is the minimum that demonstrates the classless system without becoming content work. Additional Daos are data.

| Dao | Natures | Identity | Keystone |
|---|---|---|---|
| **Dao of Fire** | Fire, Yang | Pressure, speed, risk. Techniques: *Ember Pulse* (a mini-Pulse usable during recovery), *Flame Circulation* (temporarily doubles build rate). | **Furnace Heart**: Stability drains constantly but every Pulse is a Refinement Pulse. |
| **Dao of Water** | Water, Yin | Flow, recovery, safety. Techniques: *Still Pool* (instant Stability restore, costs Qi), *Tide* (the next Pulse draws Qi in two waves). | **Deep Current**: circulation never decays; braking costs Qi. |
| **Dao of Life** | Life, Wood | Growth, Purity, patience. Techniques: *Bloom* (Wood wisps multiply faster for a duration), *Cleanse* (spend Qi to restore Purity). | **Rooted**: Auto mode runs at 100% player efficiency; manual Pulse strength is capped at 0.8. |
| **Dao of the Sword** | Metal, Generic | Precision, timing. Techniques: *Cut* (a Pulse released within 0.1 s of full charge draws Metal Qi instantly), *Edge* (one-shot: rejects all Impure Qi outward). | **Single Stroke**: Pulse charge is instant but recovery is tripled; Metal Qi 3× Progress. |
| **Dao of the Void** | Void, Generic | Reach, emptiness, Insight. Techniques: *Expand* (Reach +100% for 10 s), *Silence* (all wisps freeze for 3 s). | **Boundless**: Reach doubles permanently; Stability recovery halves. |

### 9.5 Dao resonance (Realm 8)
When two Daos each have a node tagged with the same `ResonanceTag`, a resonance effect applies (data-defined per tag pair, e.g. Fire+Sword: "Cut also ignites"; Water+Life: "Cleanse restores Stability"). Resonance builds an **Overload** meter while active; above 1.0 it causes Qi Deviation unless the player breaks resonance (Circulation Held for 2 s). Two or three resonance pairs are enough.

### 9.6 Technique test target
Because there is no combat, place one **Resonance Stone** in the outer world and one in the Cultivation Space: a floating crystal that reacts to Techniques (glows, cracks, plays a sound, shows the Technique's damage-equivalent number as "Impact"). This gives Techniques a place to be seen and lets the player feel their Dao without a combat system. It must not become a combat prototype.

---

## 10. World, presentation, and feel

### 10.1 The outer world
One small hand-built area (~200 m across): a mountain shelf with a meditation platform, a shrine, a stream, a grove, and the Resonance Stone. The player walks here with template locomotion. Three **Qi Veins** in the world (grove = Wood/Life, stream = Water/Yin, shrine = Fire/Yang) modify the ambient nature weights of the Cultivation Space when the player meditates within 10 m of them. This is the only reason to move. A day/night cycle. No other simulation.

### 10.2 The Cultivation Space
Dark, shallowly lit, seemingly endless. The floor is a faint disc that fades to black; from Realm 7 it becomes the Domain. Visual hierarchy, innermost to outermost: cultivator body → Dantian and lotus-hands → internal circulation structure (a Bagua-inspired ring of eight glyphs at the Dantian that rotate with circulation and light up with Realm, purely symbolic, never an orbit track) → aura field → Qi Wisps and streams. Camera: fixed elevated three-quarter, pulling back as Reach grows, with a Domain-scale framing from Realm 7.

Entering meditation: the outer-world camera pushes into the Anchor's chest, the screen fills with the Dantian's glow, and the Cultivation Space fades in with the aura expanding from the body. Under two seconds. Exiting reverses it.

### 10.3 Visual language (binding)
- **Idle aura**: dim, calm, static. Clearly visible.
- **Circulation**: the whole field is one current; coherent lines, not dots. Direction is unambiguous. Strength = brightness and speed.
- **Circulation Held**: the field stills and dims; a faint inward breath.
- **Charging**: compression ring shrinks, centre brightens, radial lines gather. Overcharge reddens the ring.
- **Release**: a wave from boundary to centre; the Dantian flashes on absorption; the mannequin's hands glow.
- **Instability**: flicker, uneven brightness, fragments; reddening below 0.35.
- **Purity**: the Dantian's hue muddies as Purity drops.
- **Density (R3+)**: inner and outer layers with visibly different line frequency.
- **Split layers (R5+)**: a shear band where they meet.
- **Domain (R7+)**: the space itself circulates.
- **Realm theme colour**: each Realm tints the field and the Dantian.
- **Pure vs Impure vs Corrupted vs Refined**: pale steady / dark jittering / black-violet pulsing with tendrils / white-gold with a trailing line. Readable from the camera at any Realm scale.

### 10.4 Body and animation
Outer world: template mannequin and animations. In meditation: the mannequin in a seated meditation pose. Create the pose with Control Rig or an additive pose asset from the idle; if that is unreliable within one milestone, use a kneeling/crouch pose derived from the template's crouch, and report. Never a capsule. The hands rest at the Dantian; on absorption the hand sockets emit the Dantian flash.

### 10.5 Audio
Everything through **MetaSounds** built in-engine with procedural generators (no external files):
- a low sustained circulation drone whose pitch follows Strength and whose stereo movement follows Direction;
- a rising tension tone during charge that hardens on overcharge;
- a release whoosh and a Dantian absorption chime (pitch by Qi nature; a harsh grate for Impure; a sub-bass thud for Corrupted);
- a Breakthrough chord; a Tribulation warning bell; a Backlash crack; a Realm-advance swell.
Audio is part of the feel test. A silent Pulse is a failed Pulse.

### 10.6 UI
- **Cultivation HUD** (in meditation): state, Realm and Layer, Progress bar, Stability, Purity (R2+), Qi Reserve, active Mantra, Circulation indicator (a small ring showing direction and strength), Pulse charge arc, active Technique slots, last event line, control legend. Compact; the field is the UI, the HUD is the caption.
- **World HUD**: Realm and Layer, Qi Reserve, prompt to meditate.
- **Cultivation Menu**: Realm page (current Realm, Layer, what the next Realm unlocks), Mantra page (select), Dao page (five trees, node purchase, Technique slotting), Settings (rebind, audio, HUD detail), Save/Load.
- **Debug overlay** (toggle with F1): every number in Sections 7.1 and 7.4 for every active wisp, the current ladder row, the seeded RNG state, and a log of the last 20 events. Required for review.

### 10.7 Save/load
`USaveGame` with: Realm, Layer, Progress, Purity, Stability, Reserve, Corruption, Scar state, active Mantra(s), Dao Insight per Dao, unlocked nodes, slotted Techniques, the RNG seed and stream position, world position, time of day, settings. Autosave on exit meditation, on Breakthrough, and every 2 minutes. Three manual slots. A new game starts at Realm 1 Layer 1 with the Basic Mantra, 800 Reach, and a five-line tutorial in the HUD.

---

## 11. Architecture

### 11.1 C++ (systems) and Blueprint (presentation)
```
Source/Ascension/
  Cultivation/
    CultivationState.h/.cpp          UCultivationState — Realm, Layer, Progress, Stability, Purity, Reserve, Corruption, scars; reads the ladder row; serializable
    AuraComponent.h/.cpp             UAuraComponent — aura properties, circulation integration, Pulse state machine, density, layers, FlowPhase; exposes parameters for visuals
    QiFieldComponent.h/.cpp          UQiFieldComponent — owns active wisps, ambient spawning, wave propagation, draw/settle/absorb/reject
    QiWisp.h/.cpp                    AQiWisp — data holder + mesh; no Tick
    QiPreset.h                       UDA_QiPreset
    Mantra.h/.cpp                    UDA_Mantra, FMantraModifier, UMantraBehaviour
    Dao.h/.cpp                       UDA_Dao, FDaoNode, UDaoTechnique
    RealmLadder.h/.cpp               UDA_RealmLadderConfig, FRealmLayerRow, ladder generation utility
    Breakthrough.h/.cpp              Minor Breakthrough logic, seeded RNG
    Tribulation.h/.cpp               UTribulationDefinition base + one subclass per Realm (Blueprint-subclassable for the surge patterns)
    AutoCultivationController.h/.cpp
    ModifierStack.h/.cpp             resolves Mantra/Dao/Realm modifiers into effective values, cached per frame
  Player/
    AscensionCharacter (world pawn), CultivationPawn (meditation camera pawn), AscensionPlayerController, AscensionGameMode, AscensionSaveGame
  UI/
    C++ base widgets exposing bindable properties; visuals in UMG Blueprints
Content/Ascension/
  Data/   ladder config, DT_RealmLadder, QiPresets/, Mantras/, Daos/, Tribulations/
  Blueprints/  BP_ subclasses that add components, meshes, VFX, sound hooks
  Materials/  M_AuraField, M_AuraDomain, M_QiWisp, M_Dantian, M_Bagua, plus MIs per Realm
  FX/  Niagara: absorption, rejection, breakthrough, tribulation surges, domain
  Audio/  MetaSounds
  UI/  WBP_ widgets
  Maps/  L_World, L_CultivationSpace (streamed sublevel or a second level with a seamless-enough transition), L_Test_Cultivation (a debug map with buttons to set Realm/Layer)
  Animation/  seated pose, Control Rig
```
All gameplay numbers pass through the `ModifierStack`. No system reads a raw constant; it reads `Stack.Get(Property)`. This is how Mantras, Daos, Realms, natures, and scars combine without special cases.

### 11.2 Gameplay Tags
Use Gameplay Tags for systems (`Ascension.System.Purity`), conditions, natures, states, Mantra conditions, Dao resonance, and events. The Realm definition's unlock lists are tag lists. UI visibility is tag-driven. This is how "complexity is earned" is enforced: a system whose tag is not unlocked is not shown and not simulated.

### 11.3 Determinism
Circulation, Pulse, wave propagation, draw, absorption, and Breakthrough rolls are frame-rate independent and seeded. Two runs with the same inputs and seed produce the same absorption order. Verify in Milestone 1 with a scripted input sequence and a checksum of the event log.

### 11.4 Performance
Target 60 fps on a mid-range GPU at 1080p in the Cultivation Space at Realm 9 with the Domain active and the ladder's maximum ambient count (~25 wisps). The aura is a handful of draw calls. Wisps are one instanced static mesh component or at most 30 actors. Niagara systems are pooled. Report frame time at Realms 1, 5, and 9 in Milestone 7.

### 11.5 Test map
`L_Test_Cultivation` has a debug panel (F2) with: set Realm/Layer, set Stability/Purity, spawn a wisp of any preset at any radius, trigger any Tribulation, grant Insight, force Breakthrough, toggle Auto, run the scripted determinism sequence, and print the effective ModifierStack. This map is how every milestone is verified without playing from Realm 1 each time.

---

## 12. Milestones

Work in these milestones. Stop after each. Each milestone lists its scope, its exit criteria, and the evidence it must produce. Do not start a milestone until the previous one is approved. Do not pull work forward.

### Milestone 0 — Project foundation
**Scope.** Create the project (report template choice). Configure Enhanced Input, Niagara, MetaSounds, Control Rig, Gameplay Tags. Create the folder structure of 11.1. Create the C++ module skeleton with empty classes and a compiling build. Create `DA_RealmLadderConfig` with the Section 6.3 formulas and the generation utility; generate `DT_RealmLadder` and print all 81 rows to the change log for review. Create the Gameplay Tag hierarchy. Initialize git. Create `L_Test_Cultivation` with the F2 debug panel skeleton. Create `docs/CHANGELOG.md` and `docs/DECISIONS.md`.
**Exit.** Project compiles and runs. Ladder table exists with 81 rows and plausible curves. Debug panel opens. Git has one commit.
**Evidence.** Build log, the 81 rows, a screenshot of the debug panel, the tag list.

### Milestone 1 — Core loop re-validation (Realm 1, Layer 1 only)
**Scope.** Port the validated prototype into the architecture: `UAuraComponent` (circulation, Pulse, FlowPhase, Held), `UQiFieldComponent` (three wisps, wave, draw, settle, absorb, Impure Option B), the field material (M_AuraField, upgraded from the prototype: cleaner current lines, compression ring, wave, instability), the Dantian, the seated mannequin (10.4), the meditation camera, `IMC_Cultivation`, the Cultivation HUD with the legend, the three core MetaSounds (drone, charge, release/absorb), enter/exit transition (10.2), Stability with Backlash. Everything reads from the ladder row for Realm 1 Layer 1. Auto mode at its Realm 1 behaviour. Deterministic scripted sequence and checksum.
**Exit.** Section 16 criteria 1–20 pass at Realm 1 Layer 1. The project owner plays it and answers "yes" to the feel question.
**Evidence.** Screenshots at idle, CW, CCW, held, charge, release, mid-draw, absorption, backlash. Audio confirmed by the owner. Determinism checksum matching across two runs.
**This milestone is the gate for the entire build.** If the owner's answer is "no", the next milestone is "fix Milestone 1", not Milestone 2.

### Milestone 2 — Progression spine
**Scope.** Cultivation Progress, Minor Breakthrough (6.4) with the charge sequence, success/failure, readable failure reasons, cooldown, aura re-expansion. Realm 1 Layers 1–9 fully playable. Purity system built but hidden behind its Realm 2 tag. Save/load (10.7). The Realm page of the menu. Ambient spawning from the ladder row replacing the fixed three wisps. The generic Insight pool. Debug panel: set Layer, force Breakthrough.
**Exit.** A new game can be played from 1.1 to 1.9 in under 25 minutes by a casual player and under 60 minutes in Auto mode. Save, quit, load, continue.
**Evidence.** A timed playthrough log (Auto mode, scripted) with every Breakthrough attempt and result; save file inspection; screenshots of Breakthrough success and failure.

### Milestone 3 — First Tribulation and Realm 2
**Scope.** `UTribulationDefinition` base and the Realm 1 **Coalescence** Tribulation (6.5). Major Breakthrough sequence. Qi Deviation (7.12) including the scar and the clean-meditation recovery. Realm 2: Purity visible and active, Refinement Pulse, Yin and Yang presets with their direction traits, Dantian capacity and Qi Reserve, first Dao unlock (Dao of Fire and Dao of Water, ten nodes each, no Keystone yet), Technique slots 1–2 with *Ember Pulse* and *Still Pool*, the Resonance Stone in the Cultivation Space, the Dao page and Mantra page (Basic and Stillness selectable). Outer world: the meditation platform only.
**Exit.** 1.9 → 2.1 via Tribulation, both outcomes reachable and fair. 2.1 → 2.9 playable. Yin/Yang give direction a reason. Refinement Pulse is the readable answer to Impure Qi.
**Evidence.** Tribulation success and failure recordings (screenshot sequences), Deviation state screenshot, Dao tree screenshot, Technique on the Stone.

### Milestone 4 — Realms 3–4: density, Mantras, Core, Keystones
**Scope.** Density layers (7.9 first half) with their material layers and mechanics. Heavenly Light and Fire God's Mantras with behaviours. Fire and Water presets. Anchor drift (backlash injury visual on the body). Realm 3 **Foundation** Tribulation. Realm 4: the Core as a persistent object with crack state, circulation momentum, Wood and Metal presets, Keystones for the existing Daos, Dao of Life and Dao of the Sword (Keystones included), Technique slots 3–4. Realm 4 **Core Forging** Tribulation. Outer world: the shelf, grove, stream, shrine, and the three Qi Veins; day/night.
**Exit.** 2.9 → 4.9 playable. Density is a real responsibility. Each Mantra changes what the player does. The Core can crack and be repaired.
**Evidence.** Per-Mantra comparison screenshots of the same field state. Core cracked/repaired screenshots. Vein-modulated spawn logs. Both Tribulations.

### Milestone 5 — Realms 5–6: split layers, Yin-Yang, Corruption, Devouring
**Scope.** Inner/outer circulation with the Layer Modifier, shear band, opposition drain, coherence bonus. Yin-Yang Mantra and its transformation behaviour. Earth preset. Realm 5 **Nascent Birth** Tribulation. Realm 6: Corrupted condition and Corruption state on the Core, Demonic Devouring Mantra, Life preset, Dao Expression nodes for all five Daos, Realm 6 **Transformation** Tribulation. Auto mode's full-efficiency-when-present rule.
**Exit.** 4.9 → 6.9 playable. Split circulation is learnable in under a minute with the HUD ring. Yin-Yang is hard and rewarding. Corruption is a visible persistent state with a cleansing path.
**Evidence.** Shear band screenshots, transformation event log, Corruption progression screenshots, both Tribulations.

### Milestone 6 — Realms 7–8: the Domain, Void, dual Mantras, resonance
**Scope.** The Domain (7.9 second half): `M_AuraDomain`, the Niagara domain system, horizon-scale spawning, camera framing, the same six parameters driving everything. Void preset, Void Stillness Mantra, Dao of the Void with Keystone. Realm 7 **Void Crossing** Tribulation. Realm 8: dual Mantras with conflict rules and the Integration Mantra, Refined condition, second Keystone, resonance pairs and Overload, Realm 8 **Integration** Tribulation.
**Exit.** 6.9 → 8.9 playable. **The controls at Realm 8 are the controls at Realm 1.** The Domain is readable and runs at target frame rate. Resonance is a decision with a visible risk.
**Evidence.** Domain screenshots at 7.1 and 8.9, frame-time report, resonance/overload log, both Tribulations.

### Milestone 7 — Realm 9, Ascension, and the whole ladder
**Scope.** Realm 9 with tenfold consequences, the Ascension Pulse, the final Tribulation, the ascension cinematic (in-engine: camera, light, sound, the aura consuming the space, a title card), the end state (the player may continue at 9.9 with the ending replayable). Full-ladder balance pass: an Auto-mode scripted run from 1.1 to 9.9 must complete; report its total time and adjust the ladder config so that Auto takes roughly 12–16 hours, casual play roughly 6–9, and mastery play roughly 4–6 (these are targets, and the scripted Auto run is the only one you can measure; report the others as estimates from per-Layer timing). Performance at Realms 1, 5, 9. Settings page, rebinding, audio mix. Main menu and new-game tutorial lines.
**Exit.** A new game can be played to Ascension. All 81 steps reachable. Every system in this charter present and readable.
**Evidence.** The full Auto run log with timestamps per Layer, frame-time table, ascension screenshots, a completed save file.

### Milestone 8 — Polish and packaging
**Scope.** Every visual and audio state in 10.3 and 10.5 reviewed against the bible's quality bar and improved where weak. HUD polish. Tribulation fairness review (every surge visible ≥ 1 s before impact). Failure messages reviewed for clarity. A Windows packaged build. `docs/PLAYER_GUIDE.md` (two pages). `docs/TUNING_GUIDE.md` explaining every config asset. Final change log.
**Exit.** The packaged build runs on a clean machine. The owner plays from 1.1 through the first Tribulation without reading any document.
**Evidence.** Package log, a fresh-machine launch screenshot, the two guides.

---

## 13. Decision rules

When this charter does not decide something, or when two implementations are both possible, prefer the one that:
1. Better expresses the cultivation fantasy (Section 3).
2. Makes the aura itself mechanically meaningful.
3. Scales to Realm 9 without changing controls.
4. Keeps the player's action readable in the field before it is readable in the HUD.
5. Avoids direct projectile steering, cursor targeting, or predetermined wisp paths.
6. Supports the low-attention, casual, and mastery player through the same system.
7. Is data-driven and modular.
8. Can be verified on `L_Test_Cultivation` in under a minute.
9. Produces visual, audio, and mechanical feedback that agree with each other.
10. Is the smaller change.

Reject (and report, rather than build) anything that:
- Feels like a minigame unrelated to cultivation.
- Requires the player to operate remote points in a large aura.
- Uses left/right steering as the primary interaction.
- Treats a Mantra as a percentage modifier only.
- Makes a Qi condition or nature a cosmetic duplicate.
- Requires many systems before the Realm 1 loop is enjoyable.
- Adds a meter, control, or type without a decision behind it.
- Cannot be explained to a new player in one sentence.
- Cannot be extended without duplicating logic.
- Silently changes a number that this charter specifies without a `DECISIONS.md` entry.

Known-good decisions from the prototype that you must keep:
- FlowPhase is accumulated in code, never read from shader time.
- The Pulse force is a wave that agrees with the visual wave; wisps are hit when the front passes them.
- Wisps have no Tick; the field component drives them.
- Every Pure/Impure difference is a value set at spawn; wisps never branch on condition.
- The impulse decays and the wisp settles; far wisps need multiple Pulses.
- Impure Qi drains Stability while Drawn (Option B) and is Rejected below the threshold.
- Circulation Held is a real, readable state.
- A low-charge release still produces a visible weaker wave.
- Circulation keeps running underneath a Pulse; the state machine has documented display precedence.
- Any read-then-write-then-branch pattern is a bug in Blueprint DSL graphs; write last.

---

## 14. Reporting and evidence standards

A feature is not complete because a tool reported success, a file compiled, or a test printed "OK". Completion requires editor state, compile state, and runtime behaviour to agree, and the evidence to be in the report.

### 14.1 End-of-milestone report (mandatory format)
```
MILESTONE <n> — <name>

VERIFIED
  What was confirmed, with the evidence (build log lines, test output, screenshot filenames).
  What was NOT confirmed and why.

ASSETS
  Created: full list with paths.
  Modified: full list with what changed.
  Deleted or renamed: full list (should be rare).

CODE
  C++ files added/changed, one line each.
  Project Settings changed, one line each.

COMPILE
  C++ build result. Every Blueprint's compile result. Every material's compile result.

TESTS
  Scripted tests run on L_Test_Cultivation, with output.
  Determinism checksum (Milestone 1+).
  Frame time (Milestones 6–8).

SCREENSHOTS
  One per new behaviour at the moment it is most visible, named M<n>_<behaviour>.png, saved to /docs/evidence/.

WARNINGS
  Every warning encountered and how it was handled.

DECISIONS
  Every choice this charter did not specify, with the reason. Also written to docs/DECISIONS.md.

LIMITATIONS
  Anything not working, not verified, or deferred.

NEXT
  The next milestone by name and nothing else.
```

### 14.2 Standing rules
1. Never run OS-level input injection, window foregrounding, or any desktop automation without asking first. The project is the sandbox; the desktop is not.
2. Every batch operation checks for existing assets, variables, components, and nodes before creating, so an aborted run can be re-run safely.
3. After adding an instance-editable property, reset the placed instances to CDO defaults and confirm in the report.
4. Every report includes read-back lists (components, variables, functions) for modified Blueprints, not summaries.
5. Scripted tests must go through the same functions the player's input goes through. A test that drives internal flags directly is a model test and must be labelled as such.
6. Screenshots of every new behaviour, every milestone, at the most visible moment. If a moment cannot be captured, say so and why.
7. If a milestone fails, do not improvise a broad rewrite. Diagnose, substitute the smallest fix, report.
8. If a required operation is unsupported by the available tools, stop and report rather than inventing success.
9. Keep `CHANGELOG.md` and `DECISIONS.md` current at the end of every milestone, before the report.
10. Commit at the end of every milestone.

### 14.3 What the project owner will do
The owner plays every milestone before approving the next. The owner is the only source of evidence about feel, audio, and readability at real frame rate. When the owner reports a problem, the owner's observation outranks your logs; diagnose why the logs and the play disagree.

---

## 15. Acceptance criteria for the whole build

The build is accepted only if all of the following are true in a packaged Windows build and in PIE on `L_World`:

1. A new game starts at Qi Sensing, 1st Layer, with the Basic Mantra and a five-line tutorial.
2. The player can walk to the platform, enter meditation, and see the transition into the Cultivation Space.
3. A clearly readable aura surrounds the seated cultivator.
4. Q and E build opposite global circulations; the whole field responds; both keys held is a readable stillness.
5. Pulse charges, compresses, releases an inward wave, and enters recovery; overcharge visibly costs Stability.
6. Qi Wisps are drawn by distance and resistance, settle between Pulses, and never follow a fixed path.
7. The player never aims at or drags a wisp.
8. Pure, Impure, Corrupted, and Refined Qi each have a behavioural identity, and every nature has a trait.
9. Absorption at the Dantian is a visible and audible event.
10. Stability, Purity, Backlash, and Qi Deviation are readable, attributable, and recoverable.
11. Minor Breakthroughs have a charge sequence, a modified chance, and explained failure.
12. All nine Tribulations exist, are fair, and use the same controls as normal cultivation.
13. All 81 progression steps are reachable; every number comes from the ladder table.
14. Each Realm unlocks a new system, at least one new Qi nature or condition (Realms 2–8), and a new responsibility, and the HUD legend grows only when a control becomes available.
15. Eight Mantras exist and each changes what the player does.
16. Five Daos exist with 12–16 nodes each, five Keystones, Techniques usable on the Resonance Stone, Dao-specific Insight, and Realm-gated depth.
17. Dual Mantras and Dao resonance work at Realm 8 with Overload as a risk.
18. The Domain replaces the disc at Realm 7 with the same six parameters and the same controls.
19. Auto mode is real cultivation through the same functions, conservative, visible, and interruptible.
20. Save/load preserves everything including the RNG stream.
21. The scripted Auto run completes 1.1 → 9.9; its time is reported; the ladder config is tuned to the targets.
22. 60 fps at 1080p at Realm 9 with the Domain active on a mid-range GPU.
23. All audio is MetaSound, in-engine, and present for every state in 10.5.
24. No external downloads, no plugins outside the engine, no networking, no combat, no inventory, no "Law", no "mana".
25. `CHANGELOG.md`, `DECISIONS.md`, `PLAYER_GUIDE.md`, and `TUNING_GUIDE.md` are complete and match the build.
26. The owner, playing from 1.1 through the first Tribulation without reading a document, says it feels like cultivation.

Criterion 26 outranks the other twenty-five.

---

# PART B — THE KICKOFF MESSAGE

Send this as the first chat message once the charter above is in `CLAUDE.md` (or referenced from it) and `/status` shows Fable 5.1.

```text
You are starting Project Ascension under the charter in CLAUDE.md. Read the whole charter before doing anything. It is authoritative; where it and any earlier prompt disagree, the charter wins.

Context: the aura-circulation prototype in the MCP_UE5_Prototype sandbox (/Game/MCP_Test/AuraCirculation) has been played and validated through inward draw and absorption. Its known-good decisions are listed in charter Section 13 and must be kept. Its assets may be read for reference but are not to be migrated; the new project rebuilds them properly under the Section 11 architecture.

Begin with Milestone 0 only.

Before creating anything, report:
- The template you will use and why.
- The Unreal version and the engine plugins you will enable.
- Whether you will use Unreal MCP for editor operations, direct file/asset generation, or both, and what each will be used for.
- The full folder and C++ class skeleton you intend to create.
- The Section 6.3 formula constants you will put in DA_RealmLadderConfig and a preview of rows 1.1, 1.9, 2.1, 4.1, 7.1, 9.9.
- Any part of the charter you cannot implement with the available tools, and the smallest substitute you propose.

Wait for my approval of that plan. Then execute Milestone 0, produce the Section 14.1 report, commit, and stop.

Do not begin Milestone 1 until I approve Milestone 0. Do not pull any later milestone's work forward. If anything in the charter is ambiguous, state your interpretation in DECISIONS.md and proceed with the smaller reading.
```

---

## Appendix A — Suggested per-Realm Tribulation surge patterns (data for Milestones 3–7)

These are starting points for the `UTribulationDefinition` subclasses. Each is a timed list of `FSurgeEvent {time, type, count, radiusFraction, angle, nature, condition, warningLeadSeconds}` plus a success condition and a failure condition. Warning lead is never below 1.0 s.

1. **Coalescence (R1→R2, 60 s).** Impure surges every 8 s from random angles at 0.9 Reach, three wisps each. Success: hold one full-charge Pulse (charge ≥ 0.95) for 2 s while Stability stays ≥ 0.5 and release it to absorb ≥ 3 Pure. Failure: Stability 0 or timer.
2. **Condensation (R2→R3, 75 s).** Alternating Yin and Yang waves; Purity starts at 0.8. Success: absorb 20 Qi total with Purity never below 0.6. Failure: Purity < 0.6 or timer. Teaches Refinement Pulse.
3. **Foundation (R3→R4, 90 s).** Three pressure waves at 25/50/75 s that push wisps outward and try to drop InnerDensity; success: InnerDensity ≥ 0.7 at each wave peak. Failure: density collapse (< 0.2) or Stability 0.
4. **Core Forging (R4→R5, 90 s).** Field counter-rotates against the player every 15 s; a Metal Qi mass spawns at 0.5 Reach. Success: absorb the mass with ≥ 0.8-charge Pulses while circulation stays in the player's direction. Failure: mass escapes to the boundary or Stability 0.
5. **Nascent Birth (R5→R6, 100 s).** Success: hold opposing inner/outer layers for a cumulative 30 s while Stability ≥ 0.4 and absorb ≥ 10 Qi transformed at the shear band. Failure: Stability 0.
6. **Transformation (R6→R7, 100 s).** Corrupted Qi surges; success: absorb ≥ 6 Corrupted via Refinement Pulse with Purity ≥ 0.4 at the end. Failure: Purity 0 or Corruption ≥ 1.0.
7. **Void Crossing (R7→R8, 110 s).** The Domain shrinks toward the centre at a constant rate; each Pulse pushes the boundary back by an amount scaled by release strength. Success: boundary ≥ 0.5 Reach at the end. Failure: boundary reaches the Dantian.
8. **Integration (R8→R9, 120 s).** Resonance is forced to peak; Overload rises. Success: absorb ≥ 30 Qi while keeping Overload < 1.0 using Circulation Held. Failure: Overload 1.0.
9. **Ascension (R9, 120 s).** All prior surge types in sequence, then the Ascension Pulse must be charged and held for 10 s at full with Stability ≥ 0.6, then released. Success ends the game. Failure is Qi Deviation to 9.1.

## Appendix B — Tuning targets to protect during balance passes

- Realm 1 Layer 1: first absorption within 20 s of first meditation. First Breakthrough within 3 minutes.
- A single full Pulse at Realm 1 draws a Pure wisp at 0.5 Reach to the Dantian; a wisp at 0.9 Reach needs two.
- Impure Qi at Realm 1 drains ~0.15 Stability over its full draw; three careless Impure draws in a row trigger Rejection.
- Stability recovers from 0.35 to 0.7 in ~10 s of Circulation Held at Realm 1.
- Minor Breakthrough at full Stability and Purity: ≥ 85% at Layer 1, ≥ 50% at Layer 8.
- Each Tribulation is passable on the first attempt by a mastery player who has played the Realm, and on the second or third by a casual player. Never passable by Auto mode.
- Auto mode never triggers Backlash under default settings at any Realm.
- The Domain at Realm 9 with 25 wisps: ≤ 16.6 ms frame time.

## Appendix C — Naming conventions
- C++: `U`/`A`/`F`/`E` prefixes per Unreal convention, module `Ascension`.
- Data Assets: `DA_`, Data Tables: `DT_`, Blueprints: `BP_`, Widgets: `WBP_`, Materials: `M_`/`MI_`, Niagara: `NS_`/`NE_`, MetaSounds: `MS_`, Input: `IA_`/`IMC_`, Maps: `L_`, Animations: `A_`/`AS_`, Control Rig: `CR_`.
- Gameplay Tags root: `Ascension.` with children `System`, `Qi.Condition`, `Qi.Nature`, `State`, `Event`, `Mantra`, `Dao`, `Resonance`, `Scar`.
- Every asset lives under `/Game/Ascension/`. Nothing outside it except the template's `/Game/Characters` (read-only use) and `/Game/Input` (unused).

*End of document.*

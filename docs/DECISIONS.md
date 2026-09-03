# Project Ascension — Decisions Log

Every choice the charter (`docs/ASCENSION_CHARTER.md`) did not specify, or specified ambiguously, is recorded here with its reason. Entries are never deleted; a reversed decision gets a new entry that references the old one. Charter Section 13 rule: when in doubt, the smaller reading.

Format: `D-NNNN — Title` · Milestone · Charter reference · Decision · Reason · Consequence.

---

## D-0001 — The charter lives in `docs/` and is imported by `CLAUDE.md`
- **Milestone:** 0 · **Charter:** "How to use this document", Part A
- **Decision:** Part A (Sections 1–15) plus Appendices A–C are saved verbatim as `docs/ASCENSION_CHARTER.md`. The root `CLAUDE.md` imports it with `@docs/ASCENSION_CHARTER.md` and adds only repository facts and environment notes. The preamble and Part B are kept in `docs/KICKOFF.md`; the original upload is kept whole as `docs/Project_Ascension_Full_Game_Master_Prompt.md`.
- **Reason:** The charter offers both placements. The import keeps the charter in force every session (it is read with `CLAUDE.md`, never summarised) while leaving `CLAUDE.md` short enough to hold repo-specific facts that change per milestone.
- **Consequence:** Edits to the charter require an entry here.

## D-0002 — Third Person template
- **Milestone:** 0 · **Charter:** 2, 8, 10.1, 10.4
- **Decision:** The project is created from the **Third Person** template.
- **Reason:** The charter requires template mannequins, template locomotion (`IA_Move`/`IA_Look`/`IA_Jump` "template, unchanged"), and a seated pose derived from template animations. Blank would mean rebuilding all of that for no gain. Section 2.1 explicitly permits the template mannequins and animations.
- **Consequence:** `/Game/Characters` and `/Game/ThirdPerson` from the template are read-only inputs; everything of ours lives under `/Game/Ascension/` (Appendix C).

## D-0003 — Pulse timing formula reading
- **Milestone:** 0 · **Charter:** 6.3 ("charge 1.25 s reducing by 0.03 s per Realm to a floor of 0.9 s; recovery 0.75 s reducing by 0.02 s per Realm to a floor of 0.5 s")
- **Decision:** `Charge = max(0.9, 1.25 − 0.03 × (Realm − 1))`, `Recovery = max(0.5, 0.75 − 0.02 × (Realm − 1))`. Realm 1 is the stated base value; the floor is never reached inside the nine Realms (9.x: 1.01 s / 0.59 s).
- **Reason:** "1.25 s" reads as the Realm 1 value; subtracting from Realm 2 onward is the smaller reading. The floors are kept as config constants so tuning can lower the per-Realm step without touching code.

## D-0004 — Impure fraction curve
- **Milestone:** 0 · **Charter:** 6.3 ("rising from 0.33 at Realm 1 to 0.5 at Realm 6 then falling as refinement dominates")
- **Decision:** Linear 0.33 → 0.50 across Realms 1–6, then linear 0.50 → 0.30 across Realms 6–9. Constants `ImpureFractionStart/Peak/PeakRealm/End` on `DA_RealmLadderConfig`.
- **Reason:** The falling end value is unspecified. 0.30 is slightly below the Realm 1 value so that Refined/Pure dominate late without Impure disappearing (the Devouring Mantra and Realm 6 Tribulation still need it).

## D-0005 — Ambient spawn interval formula
- **Milestone:** 0 · **Charter:** 6.3 lists `AmbientSpawnInterval` as a row property but gives no formula.
- **Decision:** `Interval = max(2.0, 4.0 − 0.25 × (Realm − 1))` seconds. Constants `AmbientSpawnIntervalBase/PerRealm/Floor`.
- **Reason:** At Realm 1 the space starts populated (count 5), so the interval governs replenishment only; 4 s keeps "first absorption within 20 s" (Appendix B) achievable without the field ever feeling empty. Faster at high Realms matches the larger counts. Pure tuning; expected to change in Milestone 7's balance pass.

## D-0006 — Nature weights per Realm
- **Milestone:** 0 · **Charter:** 6.3 (`NatureWeights` is a row property; no numbers given), 6.2 (natures introduced per Realm)
- **Decision:** `Generic` weight 1.0 at every Realm; each nature unlocked at or below the row's Realm gets weight 0.5 (`GenericNatureWeight`, `UnlockedNatureWeight`). Natures are introduced exactly per table 6.2: Yin/Yang at 2, Fire/Water at 3, Wood/Metal at 4, Earth at 5, Life at 6, Void at 7. Realm 8 introduces the Refined *condition* (not a nature) and Realm 9 introduces nothing new.
- **Reason:** Generic must remain the plurality early so the new nature is legible when it arrives; a flat 0.5 keeps every unlocked nature present without a per-Realm table. Qi Vein modulation (10.1) and Mantras layer on top through the ModifierStack.

## D-0007 — Reach at 9.9 is ~201,000, not "beyond 250,000"
- **Milestone:** 0 · **Charter:** 6.3
- **Decision:** The formula constants are kept exactly as the charter states (BaseReach 800, RealmGrowth 1.9, LayerGrowth 0.06). The charter's own preview values agree with the formula at 1.1, 1.9, 2.1, 4.1 and 7.1, but the formula yields **201,085** at 9.9, not "beyond 250,000". The constants were **not** adjusted.
- **Reason:** Section 13: a number the charter specifies is never silently changed. The prose figure looks like an estimate; the formula is the binding definition. Reaching 250,000 would need RealmGrowth ≈ 1.95 or LayerGrowth ≈ 0.10. Owner's call in the Milestone 7 balance pass; above ~6,000 Reach is presented by the Domain anyway (7.9), so the gameplay effect is cosmetic scale.

## D-0008 — No Unreal Engine in the build container; file generation plus an in-editor setup script
- **Milestone:** 0 · **Charter:** Kickoff ("Whether you will use Unreal MCP … direct file/asset generation, or both"), 14.2 rule 8
- **Decision:** This repository is authored in a Claude Code remote container with no Unreal Engine, no MCP, and no display. Milestone 0 therefore delivers (a) every text artefact directly: `.uproject`, `Config/*.ini`, `Source/**`, ladder CSV/JSON, docs; and (b) a one-time editor Python script `Content/Python/ascension_m0_setup.py` (Python Editor Script Plugin, ships with the engine) that materialises the binary assets the repo cannot contain: `DA_RealmLadderConfig`, `DT_RealmLadder` (imported from the JSON), `L_Test_Cultivation`, `WBP_DebugPanel`, the `IA_`/`IMC_` assets. Compile, editor state, runtime, and screenshots are **not verified** here and are reported as such. A clang syntax check against stub headers is run and labelled a model test.
- **Reason:** Rule 8 forbids inventing success. The smallest substitute that keeps Milestone 0's exit criteria reachable is a script the owner runs once, whose output the owner can screenshot for the evidence list.

## D-0009 — A separate `AscensionEditor` module holds the ladder commandlet and editor library
- **Milestone:** 0 · **Charter:** 6.1 ("a small editor utility (Blutility or C++ commandlet)"), 11.1
- **Decision:** The pure generation function `URealmLadderLibrary::GenerateLadderRows` lives in the runtime module. `URealmLadderCommandlet` (`-run=RealmLadder`) and `URealmLadderEditorLibrary::RegenerateLadderTable` (callable from an Editor Utility Widget/Blutility) live in a new editor-only module `AscensionEditor`.
- **Reason:** Commandlets and asset-saving code need `UnrealEd`; keeping that out of the runtime module keeps packaged builds clean. Both entry points share one generator so config edits regenerate identically from the command line or the editor.

## D-0010 — `UCultivationSubsystem` owns `UCultivationState`; `UAscensionSettings` holds the data asset references
- **Milestone:** 0 · **Charter:** 11.1 (lists `UCultivationState` but not its owner), 10.7, 11.5
- **Decision:** `UCultivationState` is a `UObject` owned by `UCultivationSubsystem : UGameInstanceSubsystem`. Soft references to `DA_RealmLadderConfig` and `DT_RealmLadder` live on `UAscensionSettings : UDeveloperSettings` (Project Settings → Game → Ascension).
- **Reason:** The state must survive the world pawn ↔ cultivation pawn swap and any level transition between `L_World` and `L_CultivationSpace`; a GameInstance subsystem is the smallest UE-native holder. Developer Settings is how "Project Settings changed" can point at data instead of code.

## D-0011 — `DT_RealmLadder` is imported from JSON; CSV is also emitted
- **Milestone:** 0 · **Charter:** 6.1, 6.6
- **Decision:** The generator writes `DT_RealmLadder.json` (preferred import) and `DT_RealmLadder.csv`. The editor setup script fills the Data Table from the JSON.
- **Reason:** `FRealmLayerRow::NatureWeights` is a `TMap<FName,float>`; JSON round-trips maps reliably, CSV relies on ImportText syntax. Both are text and diffable.

## D-0012 — Ambient wisp count uses floor division for `Layer ÷ 3`
- **Milestone:** 0 · **Charter:** 6.3 (`3 + Realm × 2 + Layer ÷ 3`), 11.4 ("~25 wisps")
- **Decision:** Integer floor. 1.1 → 5, 9.9 → 24.
- **Reason:** Wisp counts are integers; floor reproduces the "~25 at Realm 9" figure in 11.4.

## D-0013 — Stability threshold state tags
- **Milestone:** 0 · **Charter:** 9.1 (`FGameplayTagQuery Condition`, e.g. "Stability > 0.8"), 7.7 thresholds
- **Decision:** The state tag set includes `Ascension.State.Stability.High` (≥ 0.8), `.Low` (< 0.5), `.Critical` (< 0.35), and `Ascension.State.Purity.High` (≥ 0.7) / `.Low` (< 0.4), maintained by the aura component so tag queries can express Mantra conditions.
- **Reason:** A tag query cannot compare floats; publishing the charter's own thresholds as tags is the smallest way to make "Stability > 0.8" a data condition.

## D-0014 — Technique and Keystone tags nest under `Ascension.Dao.*`
- **Milestone:** 0 · **Charter:** Appendix C (tag roots: System, Qi.Condition, Qi.Nature, State, Event, Mantra, Dao, Resonance, Scar)
- **Decision:** `Ascension.Dao.Technique.<Name>`, `Ascension.Dao.Keystone.<Name>`, `Ascension.Dao.Node.<Family>` rather than a new top-level root.
- **Reason:** Stays inside the listed roots; Techniques and Keystones are Dao nodes.

## D-0015 — Plugins enabled at Milestone 0
- **Milestone:** 0 · **Charter:** 2.1
- **Decision:** Enabled: Enhanced Input, Niagara, MetaSound, Control Rig, Python Editor Script Plugin, Editor Scripting Utilities (all ship with the engine; Gameplay Tags is an engine module and needs no plugin entry). **Not** enabled yet: Common UI, Gameplay Abilities — to be enabled with a DECISIONS entry only when a milestone needs them.
- **Reason:** 2.1 permits engine-shipped plugins; Section 13 rule 10 (the smaller change).

## D-0016 — Milestone 0 plan approval assumed for this non-interactive session
- **Milestone:** 0 · **Charter:** Kickoff ("Wait for my approval of that plan")
- **Decision:** The pre-plan (`docs/MILESTONE_0_PLAN.md`) was written and Milestone 0 executed in the same session, because the session is autonomous and the owner cannot answer mid-task. Everything is on branch `claude/new-session-zyrmnu`, uncommitted to main, so rejecting the plan costs nothing.
- **Reason:** Every plan item is dictated by the charter except the template choice (D-0002) and the no-engine substitute (D-0008); neither is risky. Milestone 1 will **not** start without approval.

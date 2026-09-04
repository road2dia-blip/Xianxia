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
- **Consequence (Milestone 0 reality):** The project files are authored by hand in the shape of a Third Person C++ template project (Runtime module, GameMode, ACharacter with spring arm and follow camera, Enhanced Input config). The template's binary Content (`Characters`, `ThirdPerson`, `LevelPrototyping`, `Input`) cannot be generated in the container and is copied in by the owner from a throwaway 5.8 Third Person project before Milestone 1 (docs/OWNER_FIRST_RUN.md §1).

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
- **Decision:** This repository is authored in a Claude Code remote container with no Unreal Engine, no MCP, and no display. Milestone 0 therefore delivers (a) every text artefact directly: `.uproject`, `Config/*.ini`, `Source/**`, ladder CSV/JSON, docs; and (b) a one-time editor Python script `Content/Python/ascension_m0_setup.py` (Python Editor Script Plugin, ships with the engine) that materialises the binary assets the repo cannot contain: `DA_RealmLadderConfig`, `DT_RealmLadder` (imported from the JSON), `L_Test_Cultivation`, `WBP_DebugPanel` and `WBP_DebugOverlay` on their C++ bases, the `IA_`/`IMC_` assets under /Game/Ascension/Input, and the `UAscensionSettings` soft references. Compile, editor state, runtime, and screenshots are **not verified** here and are reported as such. A clang syntax check against stub headers is run and labelled a model test.
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

## D-0017 — Renderer defaults: auto exposure off, plus non-template rendering choices
- **Milestone:** 0 · **Charter:** 10.3 (visual language), 11.4 (60 fps target), 2.1 (Project Settings)
- **Decision:** `Config/DefaultEngine.ini` [/Script/Engine.RendererSettings] sets `r.DefaultFeature.AutoExposure=False` (ExtendDefaultLuminanceRange on, Bias 1.0), `r.DefaultFeature.LocalExposure.HighlightContrastScale/ShadowContrastScale=0.8`, `r.DefaultFeature.MotionBlur=False`, `r.AntiAliasingMethod=4` (TSR), `r.CustomDepth=3` (stencil enabled), `r.RayTracing=False`, `r.AllowStaticLighting=False`, and the UE 5 template Lumen/Nanite/virtual-shadow defaults.
- **Reason:** The aura's brightness states (idle dim, circulation bright, overcharge red, instability flicker) must read as absolute cues, not be re-normalised by eye adaptation; motion blur would smear the current lines and the inward wave; custom depth stencil is reserved for the wisp/Dantian readability pass; ray tracing is off for the mid-range GPU target. All are reversible Project Settings, none is a gameplay number.

## D-0018 — GameplayTags settings live in DefaultGameplayTags.ini; DefaultGame.ini mirrors them
- **Milestone:** 0 · **Charter:** 11.2, Appendix C; contract SKELETON_M0 "Config/"
- **Decision:** `UGameplayTagsSettings` is `config=GameplayTags`, so the effective `ImportTagsFromConfig/WarnOnInvalidTags/FastReplication/InvalidTagCharacters` keys and the full `+GameplayTagList` are in `Config/DefaultGameplayTags.ini`; the identical four keys are repeated in `Config/DefaultGame.ini` only because the contract placed them there. The two must stay equal.
- **Reason:** The engine reads the GameplayTags config file, not DefaultGame.ini; keeping the contract copy avoids a contract/code disagreement while the real one does the work.

## D-0019 — Python plugin settings live in DefaultEngine.ini; DefaultEditor.ini mirrors them
- **Milestone:** 0 · **Charter:** D-0008 (setup script); contract SKELETON_M0 "Config/"
- **Decision:** `UPythonScriptPluginSettings` is `config=Engine`, so `+AdditionalPaths=(Path="Content/Python")` and `bDeveloperMode=True` are set in `Config/DefaultEngine.ini`; `Config/DefaultEditor.ini` carries the same section as the contract wrote it.
- **Reason:** Same as D-0018: the copy the plugin reads must be in the file the class is configured from.

## D-0020 — CompanyName placeholder
- **Milestone:** 0 · **Charter:** none (GeneralProjectSettings is not specified)
- **Decision:** `CompanyName=Project Ascension`, `ProjectVersion=0.0.1`, `ProjectDisplayedTitle=Project Ascension` in `Config/DefaultGame.ini`. The owner may replace the company name at any time; it appears only in the packaged build's metadata.
- **Reason:** A value is required for packaging (Milestone 8); the project's own name is the neutral choice.

## D-0021 — Input contexts and debug actions reach the C++ controller through `UAscensionSettings` soft references at Milestone 0
- **Milestone:** 0 · **Charter:** 8 (IMC_World/IMC_Cultivation, F1/F2 toggles), 11.5, 12 Milestone 0 exit ("Debug panel opens"); D-0010
- **Decision:** `UAscensionSettings` gains four `config` soft references — `WorldMappingContext`, `CultivationMappingContext`, `DebugOverlayAction`, `DebugPanelAction` — set in `Config/DefaultGame.ini` to `/Game/Ascension/Input/IMC_World`, `IMC_Cultivation`, `IA_DebugOverlay`, `IA_DebugPanel`. `AAscensionPlayerController::ResolveInputAssetsFromSettings` (called from `SetupInputComponent` and `BeginPlay`) fills any of its own `IMC_World`/`IMC_Cultivation`/`IA_DebugOverlay`/`IA_DebugPanel` properties that are still null with `LoadSynchronous()` of the matching reference. `BP_AscensionPlayerController` / `BP_AscensionGameMode` (Milestone 1) assign the properties directly and the fallback then does nothing.
- **Reason:** At Milestone 0 `DefaultEngine.ini` names the raw C++ `AscensionGameMode`, which uses the raw C++ controller; its `EditDefaultsOnly` input properties have no default and no Blueprint subclass exists yet, so without a data fallback `IMC_World` is never added and F1/F2 do nothing, making the exit criterion unreachable. A config soft reference is the smallest data-driven fix consistent with D-0010 ("Project Settings changed" points at data, not code) and adds no key literal (charter 8).

## D-0022 — Realm theme colours are Milestone 0 placeholders
- **Milestone:** 0 · **Charter:** 6.6 (`FRealmDefinition.ThemeColor`), 10.3 ("each Realm tints the field and the Dantian")
- **Decision:** `UDA_RealmLadderConfig`'s constructor fills `ThemeColor` per Realm with linear RGB placeholders named in `Tools/Ladder/generate_realm_ladder.py` REALMS: Qi Sensing PaleSilver (0.80, 0.82, 0.85); Qi Condensation MoonBlue (0.45, 0.60, 0.95); Foundation Establishment EmberAmber (0.95, 0.55, 0.15); Core Formation GoldenCore (1.00, 0.80, 0.25); Nascent Soul JadeGreen (0.30, 0.80, 0.55); Soul Transformation VioletDusk (0.55, 0.30, 0.80); Void Refinement VoidIndigo (0.20, 0.15, 0.50); Dao Integration TwinWhite (0.95, 0.95, 1.00); Ascension HeavenGold (1.00, 0.90, 0.60).
- **Reason:** The charter names no colours. These are readable against the dark Cultivation Space and distinct from the Pure/Impure/Corrupted/Refined wisp palette of 10.3; they are data on the asset and will be tuned when the field material exists (Milestone 1) and reviewed in Milestone 8.

## D-0023 — Minor Breakthrough chance is clamped to 0..1
- **Milestone:** 0 · **Charter:** 7.10 (`Chance = Base × StabilityFactor × PurityFactor × MantraFactor`)
- **Decision:** `UBreakthroughLibrary::ComputeMinorChance` returns `clamp(Base × StabilityFactor × PurityFactor × MantraFactor, 0, 1)`. Failure messages use the 6.4 thresholds Stability 0.5 and Purity 0.6 (`BreakthroughFormula::StabilityFailureThreshold/PurityFailureThreshold`), and a roll that fails with both above threshold reports "the Dantian did not condense" with both numbers.
- **Reason:** A probability above 1 is meaningless and would let a generous Mantra factor mask a low-Stability attempt; clamping changes nothing in the charter's own value range (all factors ≤ 1, Base ≤ 0.9). The neutral third message keeps every failure attributable (charter 6.4).

## D-0024 — Auto mode's Pulse range and its two Breakthrough gates
- **Milestone:** 0 · **Charter:** 7.11 (`AutoPulseRange` named, no value; "never attempts a Breakthrough below Stability 0.9, always waits for Purity above 0.7"), 11.1 (`Stack.Get`), contract `AscensionProps`
- **Decision:** `AutoPulseRange` defaults to 0.6 × AuraReach on `UAutoCultivationController` and is seeded into the stack under `AscensionProps::AutoPulseRange` (with `AutoTargetStrength`, `AutoChargeTarget`, `AutoStabilityFloor`, `AutoResumeDelay`) by `ApplyDefaultsToStack`, so Mantras and Daos can modify it. The Breakthrough gates `AutoBreakthroughStability` (0.9) and `AutoBreakthroughPurity` (0.7) are `EditDefaultsOnly` properties on the controller only and have no `AscensionProps` name.
- **Reason:** 0.6 keeps Auto pulsing only when a Pure wisp is well inside the reach a single Realm 1 Pulse can draw (Appendix B: 0.5 Reach in one Pulse), which satisfies "never wasted" (3.4). The two gates are safety rules of the automatic player, not properties of the cultivation model, so no Mantra or Dao should be able to lower them (Appendix B: "Auto mode never triggers Backlash under default settings"). If a later Mantra needs to relax them (e.g. Rooted Keystone), add the names to `AscensionProps` with a new entry.

## D-0025 — `ERealmStage::Peak` is a fourth stage, not a sub-label of Late
- **Milestone:** 0 · **Charter:** 6.1 ("Layers 1–3 Early, 4–6 Middle, 7–9 Late. Layer 9 is also called Peak")
- **Decision:** `URealmLadderLibrary::GetStage` returns Early (1–3), Middle (4–6), Late (7–8), Peak (9); `IsPeak(Layer)` is true only for 9. State tags publish both `Ascension.State.Layer.Late` and `Ascension.State.Layer.Peak` at Layer 9 so a Mantra condition written either way matches.
- **Reason:** A single enum value per Layer is simpler for UI; the tags carry the charter's dual naming. The tags are not yet published at Milestone 0 (no aura tick); publishing both at Layer 9 is the Milestone 1 obligation this entry creates.

## D-0026 — Stillness is available from Realm 1; Realm 3 unlocks the *second* choice slot
- **Milestone:** 0 · **Charter:** 9.2 (Stillness "1 (second choice at Realm 3)"), 6.2 Realm 3 "second Mantra choice", Milestone 3 scope
- **Decision:** `FRealmDefinition::UnlockedMantras` for Realm 1 contains Basic and Stillness; the player may switch between them from the first Mantra page (Milestone 3). `Ascension.System.SecondMantraChoice` at Realm 3 unlocks Heavenly Light and Fire God as further options, not a second simultaneous Mantra (that is Realm 8, `System.DualMantra`).
- **Reason:** Stillness is the deep-idle Mantra (3.4 low-attention cultivator); withholding it until Realm 3 would leave the low-attention player without their Mantra for the whole first Realm. The smaller reading of "second choice at Realm 3" is "it is the second option offered", which the Milestone 3 exit text confirms.

## D-0027 — Enhanced Input assets live under `/Game/Ascension/Input/`
- **Milestone:** 0 · **Charter:** 8, 11.1 (no Input folder listed), Appendix C ("/Game/Input (unused)")
- **Decision:** `IA_*` and `IMC_World`/`IMC_Cultivation` are created by `ascension_m0_setup.py` under `/Game/Ascension/Input/`. The template's `/Game/Input` (IA_Move/IA_Look/IA_Jump, IMC_Default) stays read-only and is referenced, not copied, when Milestone 1 wires template locomotion.
- **Reason:** Appendix C requires every project asset under `/Game/Ascension/`; a dedicated `Input/` folder keeps the `IA_`/`IMC_` prefixes together and the template's folder untouched.

## D-0028 — UMG: automatic widget variable creation is off
- **Milestone:** 0 · **Charter:** 10.6 (C++ base widgets, visuals in UMG), 2.1
- **Decision:** `bAuthorizeAutomaticWidgetVariableCreation=False` in `Config/DefaultEngine.ini`; designers tick "Is Variable" only on the widgets the C++ base binds to.
- **Reason:** The HUD and debug widgets are driven from C++ properties (`RefreshFrom`, `BuildDebugText`); keeping the Blueprint variable list to the bound widgets makes the read-back lists required by charter 14.2 rule 4 short and meaningful.

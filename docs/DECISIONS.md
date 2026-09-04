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

## D-0029 — Target.cs uses `BuildSettingsVersion.Latest` and `EngineIncludeOrderVersion.Latest`
- **Milestone:** 0 · **Charter:** 2 (Unreal Engine 5.8), contract Module layout
- **Decision:** Both Target.cs files set DefaultBuildSettings = BuildSettingsVersion.Latest and IncludeOrderVersion = EngineIncludeOrderVersion.Latest instead of a pinned enum member (e.g. V5 / Unreal5_6).
- **Reason:** The exact 5.8 enum member names cannot be confirmed without the engine in this container; Latest exists in every 5.x UBT and resolves to 5.8's values, so the target compiles on the owner's machine. If a future engine upgrade changes build-setting defaults, pin the enums then.
- **Note:** Config comments originally cited this as D-0021; renumbered here.

## D-0030 — Editor-only plugins carry `TargetAllowList ["Editor"]` in the .uproject
- **Milestone:** 0 · **Charter:** D-0015 (plugins), 2.2 (packaged builds contain nothing unnecessary)
- **Decision:** PythonScriptPlugin and EditorScriptingUtilities are enabled with "TargetAllowList": ["Editor"]; EnhancedInput, Niagara, Metasound (the engine's plugin name for MetaSounds) and ControlRig are enabled unconditionally. The Third Person template's ModelingToolsEditorMode plugin is not enabled because D-0015 does not list it.
- **Reason:** D-0015 calls the two scripting plugins editor-only; the allow-list keeps them out of the packaged Windows game exactly as the plan states. Plugin names follow the engine's .uplugin file names.
- **Note:** Config comments originally cited this as D-0022; renumbered here.

## D-0031 — Gameplay tag DevComments are one-line charter citations; conflict families name no members yet
- **Milestone:** 0 · **Charter:** 11.2, Appendix C, 9.1 (ConflictTags), D-0013, D-0014
- **Decision:** Every DevComment states the tag's mechanical meaning with a charter section reference and, where the charter gates it, the Realm (e.g. Impure: resistance 0.7, drains Stability while Drawn, Rejected below Stability 0.35 (7.5)). Comments are ASCII with no quotes or apostrophes so the ini struct syntax cannot break ("Fire God's Mantra" is written "Fire God Mantra"). Ascension.Mantra.Conflict.{Aggressive,Still,Demonic,Void} are described as families only; which Mantras belong to which family is data on UDA_Mantra.ConflictTags and is decided at Milestone 6, not here. Native variable names follow the contract examples: the tag string minus the Ascension. root with dots replaced by underscores.
- **Reason:** The tag list is Milestone 0 evidence ("the tag list") and the editor shows DevComments as tooltips; a real meaning per tag makes the list reviewable. Assigning conflict membership now would pull Realm 8 design forward.

## D-0032 — Ladder numeric precision: config constants are `double`, row fields `float`, rounding identical to the Python twin
- **Milestone:** 0 · **Charter:** 6.3, 6.6; SKELETON_M0 RealmLadder · 6.1, D-0011
- **Decision:**
  - *DA_RealmLadderConfig formula constants are double, row fields are float.* Every formula constant on UDA_RealmLadderConfig is a `double` UPROPERTY (same names and defaults as the Python LadderConfig). FRealmLayerRow fields stay `float` per charter 6.6. ComputeRow does all arithmetic in double and casts once when storing.
  - *In-engine rows are rounded exactly like the Python twin.* URealmLadderLibrary::ComputeRow rounds Reach/Capacity/Reserve/Progress to 2 decimals, StabilityRecovery/ImpureFraction/MinorBreakthroughBaseChance to 4, the Pulse timings and spawn interval to 3, using round-half-to-even (FMath::RoundHalfToEven on the scaled value), before storing. A replica harness reproduced all 81 committed JSON rows with zero differences.
- **Reason:**
  - The Python twin computes in IEEE-754 double; a `float` 1.9 (1.89999997...) raised to the 8th power shifts Reach at 9.9 by ~0.02 and the rounded row would differ from the committed JSON. Blueprint exposes double as its float anyway.
  - DT_RealmLadder is imported from the JSON (D-0011); regenerating in-engine must give the identical table or the two paths would silently disagree.

## D-0033 — `ComputeRow` applies the per-Realm `Overrides` itself; override keys are row field names
- **Milestone:** 0 · **Charter:** 6.1 ('plus per-Realm override rows'), 6.6 Overrides
- **Decision:** ComputeRow = formula + rounding + the Realm's `Overrides` by property name; GenerateLadderRows is a loop over ComputeRow. Accepted keys are the FRealmLayerRow field names (AuraReach, DantianCapacity, QiReserveMax, ProgressRequired, StabilityRecovery, MaxCirculationStrength, PulseChargeDuration, PulseRecoveryDuration, AmbientWispCount (rounded to int), AmbientSpawnInterval, ImpureFraction, MinorBreakthroughBaseChance) plus `NatureWeights.<Nature>`; unknown names log a warning and are ignored. ApplyOverride is exposed as a BlueprintCallable helper.
- **Reason:** A row computed anywhere (commandlet, editor library, a runtime fallback) must be the final row; splitting the override step across callers invites drift. Realm/Layer are clamped to 1..9.

## D-0034 — `NatureWeights` keys are the nature tag leaf names
- **Milestone:** 0 · **Charter:** 6.3 NatureWeights, D-0006, 11.2
- **Decision:** ComputeRow walks Realms[0..Realm-1].UnlockedQiNatures in order and keys NatureWeights by the tag's leaf name ("Ascension.Qi.Nature.Fire" -> "Fire"). Generic is recognised by exact match against Ascension.Qi.Nature.Generic (falling back to the leaf name if the tag is unregistered) and gets GenericNatureWeight; every other nature gets UnlockedNatureWeight.
- **Reason:** Matches the committed JSON keys and the Python dict order (Generic, Yin, Yang, Fire, Water, Wood, Metal, Earth, Life, Void) while keeping the Realm definition's unlock lists as tag containers per 11.2.

## D-0035 — Per-Realm `UnlockedSystems` assignment
- **Milestone:** 0 · **Charter:** 6.2 'New system unlocked', 8 (legend growth), 11.2
- **Decision:** Realm 1: Circulation, Pulse, Stability, BasicMantra, Breakthrough, Tribulation, AutoCultivation, DebugOverlay. Realm 2: Purity, RefinementPulse, DantianCapacity, DaoUnlock, Techniques. Realm 3: DensityLayers, SecondMantraChoice, DaoInsight, AnchorDrift. Realm 4: Core, CirculationMomentum, Keystone. Realm 5: SplitCirculation, AutoFullEfficiency, ThirdMantraChoice, LayerModifier. Realm 6: CorruptedQi, DevouringMantra, DaoExpression. Realm 7: Domain, RealmWaveLayers. Realm 8: DualMantra, SecondKeystone, DaoResonance. Realm 9: AscensionPulse, FinalDaoNodes, Endgame. Conditions: Pure+Impure at 1, Corrupted at 6, Refined at 8. Natures per D-0006.
- **Reason:** Table 6.2 names the systems per Realm; the cross-cutting tags (Breakthrough, Tribulation, AutoCultivation, DebugOverlay) are needed from the first Realm (6.4, 7.11, 10.6, Milestone 1 scope); Techniques arrive with the first Dao (Realm 2, Milestone 3); LayerModifier appears in the legend at Realm 5 (Section 8).

## D-0036 — `DaoNodeDepthUnlocked = Realm − 1` (placeholder until the trees exist)
- **Milestone:** 0 · **Charter:** 6.6, 9.3
- **Decision:** Realm 1 unlocks depth 0 (no Dao yet), Realm 2 depth 1, ..., Realm 9 depth 8.
- **Reason:** The charter gates depth per Realm but gives no numbers and the trees are not designed until Milestone 3. A monotone one-per-Realm placeholder keeps the first Dao at Realm 2, Keystones reachable at Realm 4 and the final nodes at Realm 9; to be replaced when the trees exist.

## D-0037 — `DescribeFailure` precedence and thresholds
- **Milestone:** 0 · **Charter:** 6.4 message shapes, 7.7 (below 0.5), 7.8 (below 0.6)
- **Decision:** If Stability < 0.5: 'Breakthrough failed - Stability {S} was below 0.50'. Else if Purity is active and < 0.6: 'Breakthrough failed - Purity {P} - Impure Qi resisted condensation'. Else a neutral line that still shows the numbers: 'Breakthrough failed - the Dantian did not condense (Stability {S}, Purity {P})' (Purity omitted before Realm 2). Numbers are formatted to two decimals; the dash is U+2014 written as a — escape. The 7.10 factor constants and these thresholds are named constexprs in namespace BreakthroughFormula.
- **Reason:** Stability is the stronger factor and the one the low-attention player trips; the neutral line keeps every failure attributable (charter 5.7). The constants are the formula's definition, not runtime tunables, so they are named rather than read from the stack.

## D-0038 — Seeded Breakthrough stream: lazy resynchronisation from Seed/Position; a new game seeds with `FMath::Rand` and stores it
- **Milestone:** 0 · **Charter:** 7.10, 10.7, 11.3 · 7.10 (seeded stream stored in the save), 10.7 (new game state)
- **Decision:**
  - *FSeededStream resynchronises lazily from Seed/Position.* Seed and Position are the persisted truth. The wrapped FRandomStream is re-initialised from Seed and advanced by replaying Position draws whenever those fields differ from what the stream has produced (Restore(), or fields set through reflection by a load or the debug panel). NextFloat/NextInt/NextRange each consume exactly one draw so Position is a plain draw count. Blueprint faces: UBreakthroughLibrary::SeededStreamNextFloat/SeededStreamRestore.
  - *New game seeds the Breakthrough stream with FMath::Rand and stores it.* ResetNewGame sets RngSeed = FMath::Rand(), RngPosition = 0; the seed is then persisted by ApplyToSave so reloading never rerolls. The scripted determinism sequence (M1) sets its own seed through the same fields.
- **Reason:**
  - Save/load writes the two ints back through reflection; a stream that notices and replays is the smallest way to guarantee 'reloading does not reroll' without a hook in the save code.
  - The charter fixes that rolls are seeded and saved, not where the first seed comes from; a random initial seed keeps distinct playthroughs distinct while the saved seed keeps each one deterministic.

## D-0039 — `UModifierStack` cache is a non-reflected mutable member; unknown properties resolve to 0
- **Milestone:** 0 · **Charter:** 9.1, 11.1, SKELETON_M0 ModifierStack
- **Decision:** Get() is const, so Cache and bCacheDirty are `mutable` non-UPROPERTY members rebuilt lazily. A property with no base and no modifier resolves from 0 with a Verbose log (not a crash). Resolution order Override (last wins) -> Add (sum) -> Multiply (product); an empty FGameplayTagQuery is unconditional. The 45 canonical names are declared through one X-macro so header, definitions and AscensionProps::AllPropertyNames() cannot drift; DumpToString lists base, every entry (active/inactive under the current tags) and the effective value.
- **Reason:** UHT does not reflect mutable members and the cache is transient by nature; a loud-but-safe default keeps the debug dump useful when a row field is missing.

## D-0040 — `FlowPhase` wraps into [0,1) turns instead of clamping; Circulation Held freezes it
- **Milestone:** 0 · **Charter:** 7.1, 7.2, Section 13 (FlowPhase accumulated in code); SKELETON_M0 AuraComponent ("accumulates FlowPhase ... and clamps")
- **Decision:** UAuraComponent::TickComponent accumulates FlowPhase += CirculationSigned * DeltaTime and wraps the result with Fmod into [0,1) (units: turns) rather than clamping to a bound. Circulation Held freezes the accumulation (PhaseDelta = 0) as charter 7.2 specifies; nothing else is integrated at Milestone 0.
- **Reason:** A clamp would freeze the field's current at the bound after one turn; the material needs a continuously advancing phase, and a wrapped phase is what the prototype's visual wave consumed. The Held freeze is part of the phase rule itself (7.2 'phase frozen'), not a new system.

## D-0041 — Aura state-machine display precedence
- **Milestone:** 0 · **Charter:** Section 13 ('Circulation keeps running underneath a Pulse; the state machine has documented display precedence'), 7.11
- **Decision:** Highest first: Backlash/BacklashRecovery > Breakthrough charging > Pulse phase (Releasing > Overcharging > Charging > Recovering) > Circulation Held > Circulating CW/CCW > Meditating. Lower states stay mechanically active underneath; precedence only chooses the label and dominant audio/visual layer. Auto-cultivating is a label suffix, never a state.
- **Reason:** The charter requires the precedence to be documented but does not give the order; failure must be readable first (5.7), then the whole-aura compression, then Pulse over circulation (13).

## D-0042 — Event checksum excludes the localisable `FText` message
- **Milestone:** 0 · **Charter:** 11.3 (determinism checksum), 10.6 (event log)
- **Decision:** UCultivationState::ComputeEventChecksum renders each event as tag|time(%.4f)|subject|value(%.4f); and CRC32s the string with FCrc::StrCrc32. The localisable Message is excluded.
- **Reason:** Two runs must match by inputs and seed, not by language; FText can differ across cultures and localisation passes without any gameplay difference.

## D-0043 — Ladder row falls back to the formula when `DT_RealmLadder` is missing
- **Milestone:** 0 · **Charter:** 6.1 (the table is the ladder), 6.6, D-0008 (no editor in the build container)
- **Decision:** UCultivationSubsystem::SetRealmLayer loads the row from DT_RealmLadder; if the table is unavailable but DA_RealmLadderConfig is, it computes the row with URealmLadderLibrary::ComputeRow and logs that it did so; with neither, the row keeps its defaults (R1L1 values) and a warning is logged. Initialize tolerates null soft references from UAscensionSettings with LogAscension warnings.
- **Reason:** Before the owner runs ascension_m0_setup.py neither asset exists; the fallback keeps the subsystem usable in PIE while making the substitution visible in the log (14.2 rule 8: never invent success).

## D-0044 — Auto mode circulates clockwise when the Mantra has no preferred direction
- **Milestone:** 0 · **Charter:** 7.11 ("builds circulation in the active Mantra's preferred direction"), 9.1 PreferredCirculationDirection (-1, 0, +1)
- **Decision:** When PreferredCirculationDirection is 0, Auto builds clockwise (the IA_Circulate_CW / Q input). Documented as rule 1 in the UAutoCultivationController header; enforced in Milestone 1.
- **Reason:** Circulation is never optional for Auto because it feeds the Pulse efficiency bonus (7.2); a direction had to be chosen and clockwise is the first-listed input in charter 8. Before Realm 2 direction is a pure feel choice, so nothing mechanical hangs on it.

## D-0045 — Surge `Type` and `TribulationId` tag families are deferred to Milestone 3
- **Milestone:** 0 · **Charter:** Appendix A (FSurgeEvent.type), 6.5, SKELETON_M0 tag list (no Ascension.Tribulation.* family)
- **Decision:** FSurgeEvent::Type and UTribulationDefinition::TribulationId are FGameplayTag fields restricted only to the Ascension root; the concrete tag family (surge kinds: spawn wave, pressure wave, counter-rotation, domain shrink, forced resonance) is added with the first Tribulation subclass in Milestone 3 and must then be logged in DECISIONS and DefaultGameplayTags.ini.
- **Reason:** The Milestone 0 tag list is a shared contract across writers; inventing a family now with no consumer would be scope pulled forward (charter 12) and could drift from what the Coalescence implementation actually needs.

## D-0046 — Appendix A warning-lead floor is applied on read, not via `PostEditChangeProperty`
- **Milestone:** 0 · **Charter:** Appendix A ("Warning lead is never below 1.0 s"), 6.5 fairness, Milestone 8 fairness review
- **Decision:** FSurgeEvent keeps WarningLeadSeconds (default 1.0, ClampMin 1.0 in the editor) and exposes GetWarningLeadClamped() = max(1.0, value) plus static constexpr MinWarningLeadSeconds; every consumer reads the clamped accessor. No PostEditChangeProperty hook on the struct or the definition class.
- **Reason:** A read-time floor holds for Blueprint-authored, JSON-imported and code-built surge lists alike, needs no editor-only code in the runtime module, and cannot be bypassed by a subclass forgetting to call Super.

## D-0047 — Debug toggles (F1/F2) bind on the player controller; Technique 1–4, Menu (Tab and I), F1 and F2 are mapped in both mapping contexts
- **Milestone:** 0 · **Charter:** 8, 10.6, 11.5; SKELETON_M0 Player/ (pawn IA_DebugOverlay/IA_DebugPanel) · Charter 8 (Technique and Menu 'Cultivation & World' / 'Both'; F1 in 10.6 and F2 in 11.5 have no context stated)
- **Decision:**
  - *Debug toggles (F1/F2) are bound on the player controller; the pawn binds its copies only as a fallback.* AAscensionPlayerController has its own IA_DebugOverlay/IA_DebugPanel UPROPERTYs and binds them in SetupInputComponent, so F1/F2 work in IMC_World and IMC_Cultivation alike. ACultivationPawn keeps the contract's two IA properties and forwarding handlers but binds them only when AAscensionPlayerController::IsDebugInputBound() is false, so one press is never processed twice.
  - *Technique 1-4, Menu (Tab and I), F1 and F2 are mapped in both IMC_World and IMC_Cultivation.* IMC_Cultivation carries Q, E, LeftShift, LeftControl, B, X, One-Four, M (exit), Tab+I, F1, F2. IMC_World carries M (enter), One-Four, Tab+I, F1, F2. Only the two mapping contexts of the contract are created.
- **Reason:**
  - At Milestone 0 the pawn swap is a TODO(M1), so a pawn-only binding would leave the F2 panel unreachable from the possessed world character and the Milestone 0 exit criterion 'Debug panel opens' unverifiable. Controller-level input is the smallest change that keeps the contract's pawn members and makes the panel reachable in both contexts.
  - The debug overlay must be readable inside meditation and the debug panel must work on L_Test_Cultivation before meditation exists, so both debug toggles belong to both contexts. Charter 8 already puts Technique and Menu in both.

## D-0048 — Control legend key labels are read from the mapping context by input-action asset name
- **Milestone:** 0 · **Charter:** 8 ('rebindable through data', 'no hardcoded key checks'), 10.6, 11.2
- **Decision:** UCultivationHUDWidget holds TArray<FControlLegendEntry>{RequiredSystem tag, ActionName (FName of the IA asset, e.g. IA_Pulse), Description} defaulted in the constructor from the charter 8 table, plus a LegendMappingContext (IMC_Cultivation). Each line is listed only when its system tag is unlocked (UCultivationState::IsSystemUnlocked) and its key label is the display name of the first FKey mapped to that action in the context. UWorldHUDWidget builds its 'Press <key> to meditate' prompt the same way from IMC_World. The Breakthrough 'appears only when first available' readiness rule is a TODO(M2).
- **Reason:** Key names in FText literals would drift from rebinds; no IA asset references can be made in C++ constructors because the assets are created in-editor by the setup script (D-0008). Matching by asset name keeps the legend data-driven with no key literal and no hard reference.

## D-0049 — Auto-cultivation toggle is a request flag on `ACultivationPawn` at Milestone 0
- **Milestone:** 0 · **Charter:** 7.11; SKELETON_M0 UI/ DebugPanelWidget::ToggleAuto, AutoCultivationController
- **Decision:** ACultivationPawn::ToggleAutoCultivation() flips bAutoCultivationRequested, pushes an Ascension.Event.AutoToggled event to the state's log and logs; IA_AutoCultivate and UDebugPanelWidget::ToggleAuto both call it. Wiring to UAutoCultivationController::bEnabled/NotifyManualInput is a TODO(M1) in the pawn; every cultivation handler already calls a NoteManualInput() hook for the charter 7.11 take-over rule. The HUD state label carries the '- Auto-cultivating (<Mantra>)' suffix when the flag is set.
- **Reason:** The contract's pawn member list does not include the Auto controller, and the assignment asked ToggleAuto to act on state at M0. A flag plus an event-log entry is the smallest observable state that M1 can bind to the real controller without changing the entry points.

## D-0050 — Stationary check for entering meditation is a tunable speed threshold on the character
- **Milestone:** 0 · **Charter:** 8 (IA_EnterMeditation 'must be stationary'); SKELETON_M0 AAscensionCharacter::CanEnterMeditation
- **Decision:** CanEnterMeditation() returns true when the movement component IsMovingOnGround() and the horizontal speed is at or below StationarySpeedThreshold (EditDefaultsOnly, default 5 cm/s). Refusals are logged at M0; M1 surfaces them as the World HUD prompt ('Stand still to meditate').
- **Reason:** The charter gives no number. 5 cm/s tolerates the template's braking tail without allowing meditation while walking. It is control feel, not a cultivation number, so it lives on the character rather than in the ladder/ModifierStack.

## D-0051 — Debug panel `SetStability`/`SetPurity` write both the persisted state and the live aura
- **Milestone:** 0 · **Charter:** 7.7, 7.8, 11.5
- **Decision:** UDebugPanelWidget::SetStability/SetPurity clamp to 0..1, write UCultivationState::Stability/Purity, and when an ACultivationPawn is possessed also write UAuraComponent::Stability/Purity (broadcasting OnStabilityChanged). UCultivationHUDWidget::RefreshFrom reads the state's copies and lets the aura's live copies win while meditating.
- **Reason:** The contract keeps Stability/Purity on both objects (state = persisted, aura = runtime); Milestone 1 defines the sync direction. Writing both at M0 makes the panel's effect visible in the field and in the save without pre-empting that design.

## D-0052 — Cultivation camera framing values are `EditDefaultsOnly` presentation properties on the pawn
- **Milestone:** 0 · **Charter:** 10.2 ('fixed elevated three-quarter, pulling back as Reach grows')
- **Decision:** ACultivationPawn exposes CameraPitchDegrees (-55), CameraYawDegrees (-30) and CameraBaseArmLength (1600) as EditDefaultsOnly; the spring arm ignores control rotation and collision. Reach-driven pull-back is a TODO(M1).
- **Reason:** Presentation values belong on the Blueprint per charter 11.1 (Blueprint for visuals and anything a designer will tune); they are not gameplay numbers and do not pass through the ModifierStack.

## D-0053 — Mantra and Technique display names fall back to tag leaves until the assets exist
- **Milestone:** 0 · **Charter:** 9.1, 10.6; SKELETON_M0 UI/ CultivationHUDWidget
- **Decision:** UCultivationHUDWidget::MantraName is '<tag leaf> Mantra' (e.g. 'Basic Mantra') from UCultivationState::ActiveMantra and TechniqueSlots show the technique tag name; TODO(M3) replaces both with UDA_Mantra::DisplayName / UDaoTechnique::DisplayName.
- **Reason:** No Mantra or Dao assets exist at Milestone 0 and the HUD must not hard-code names; the tag leaf is the only data available now.

## D-0054 — Ladder asset safety rules: the commandlet never creates the config; a table of another row struct is never overwritten; the setup script refills only when the table does not hold exactly 81 rows
- **Milestone:** 0 · **Charter:** Contract 'Source/AscensionEditor/' (commandlet 'loads or creates the table'); charter 13 rule 10 · Charter 14.2 rule 2 (check before create); Python rule 'never delete' · Charter 14.2 rule 2; contract 'Content/Python/ascension_m0_setup.py' (idempotent, never delete)
- **Decision:**
  - *The ladder commandlet never creates DA_RealmLadderConfig.* URealmLadderCommandlet loads the config asset and fails with exit code 1 and an explicit message ('run Content/Python/ascension_m0_setup.py first, or pass -Config=') when it is missing. Only DT_RealmLadder is created on demand (new package, RowStruct = FRealmLayerRow, registered with the asset registry).
  - *A table of another row struct is never overwritten.* FillTable adopts FRealmLayerRow only on a never-typed empty table; if the table's RowStruct is anything else it logs an error and returns -1 without touching the rows.
  - *Setup script refills DT_RealmLadder only when it does not hold exactly 81 rows.* If the table already has 81 rows the script leaves it alone; if it has 0 or any other count it fills from DT_RealmLadder.json (logging a warning when replacing a partial set). Assets, mappings, widgets, level actors and settings are all check-before-create and never removed.
- **Reason:**
  - The contract only says the table is created; the Data Asset is the tuning source of truth and should be authored (by the setup script or by hand), not silently materialised by a regeneration tool. Smaller reading.
  - Regeneration must not be able to destroy an unrelated authored table that happens to sit at the -Table= path.
  - Rows are generated data, so replacing an incomplete set is a repair, not a deletion; a complete table is left untouched so re-runs are side-effect free.

## D-0055 — `IA_Move` / `IA_Look` / `IA_Jump` are not created by the Milestone 0 setup script
- **Milestone:** 0 · **Charter:** Charter 8 ('IA_Move, IA_Look, IA_Jump | template | World | Template locomotion, unchanged'); contract asset list
- **Decision:** The script creates exactly the fifteen actions the contract lists; template locomotion stays on the template's own /Game/ThirdPerson/Input assets, to be wired to AAscensionCharacter in Milestone 1.
- **Reason:** The charter says the locomotion actions are the template's, unchanged; duplicating them under /Game/Ascension/Input would be scope creep at Milestone 0.

## D-0056 — `L_Test_Cultivation` placeholder contents
- **Milestone:** 0 · **Charter:** Contract 'Content/Python/ascension_m0_setup.py' ('a floor, a light, a player start, and a BP_CultivationPawn-less placeholder note')
- **Decision:** Floor = StaticMeshActor with /Engine/BasicShapes/Plane scaled 40x40 (a 40 m square, comfortably larger than Realm 1 Reach 800 uu); KeyLight = DirectionalLight (pitch -50, intensity 3) plus a SkyFill SkyLight; PlayerStart at Z=100; M0_Note = an engine Note actor with the Milestone 0 text. Actors are found by label on re-runs so missing ones are added without duplicating existing ones. An existing level is loaded (not recreated) and only gains missing actors.
- **Reason:** A directional light alone leaves the unlit side of the placeholder floor black in an otherwise empty level; the Sky Light is the smallest addition that keeps the map readable for the F2 screenshot. Everything else is exactly the contract.

## D-0057 — Owner checklist includes an optional "copy Third Person template content" step
- **Milestone:** 0 · **Charter:** D-0002 (Third Person template); Appendix C (/Game/Characters read-only)
- **Decision:** docs/OWNER_FIRST_RUN.md step 1 tells the owner to create a throwaway Third Person C++ project on 5.8 and copy only its Content/Characters, ThirdPerson, LevelPrototyping and Input folders into this repository's Content/, marked optional at Milestone 0 and required before Milestone 1.
- **Reason:** The repository cannot hold the template's binary content; nothing in Milestone 0 needs it, but the mannequin and template locomotion are Milestone 1 inputs, so the step is documented now without pulling Milestone 1 work forward.

## D-0058 — Milestone 0 implementation details with no gameplay effect (grouped)
- **Milestone:** 0 · **Charter:** 11.1, contract SKELETON_M0
- **Decision:**
  - *UCultivationState::GetRow is native-only; Blueprint gets GetRowCopy.* GetRow keeps the contract's C++ signature as a plain inline method; a BlueprintPure `FRealmLayerRow GetRowCopy() const` (DisplayName 'Get Row') is the Blueprint face. GetLadderConfig (const pointer return) is likewise native-only; SetLadderConfig stays BlueprintCallable.
  - *Wisp mesh has no collision, no overlaps, no shadow.* AQiWisp's StaticMeshComponent is created with collision disabled, overlap events off and shadow casting off; the actor never ticks (PrimaryActorTick.bCanEverTick = false).
  - *Field position is polar in the owner's horizontal plane; FieldCenter is set by the field at spawn.* FQiWispData carries Angle (degrees) alongside DistanceFromCenter; AQiWisp::SetFieldPosition places the actor at FieldCenter + (cos, sin) * Distance with Z = 0, where FieldCenter is the owner's location written by UQiFieldComponent::SpawnWisp.
  - *UDA_Mantra::ApplyToStack is idempotent (removes its own source first).* ApplyToStack calls RemoveModifiersFromSource(MantraId.GetTagName()) before pushing entries, so applying the same Mantra twice never doubles a bonus.
  - *PreferredCirculationDirection is an int32 clamped to -1..1 on UDA_Mantra.* Stored as int32 with ClampMin -1 / ClampMax 1 (UDA_QiPreset uses a float for its own PreferredCirculationDirection trait, which is a weight, not a choice).
  - *Primary asset types "Mantra" and "Dao".* UDA_Mantra::GetPrimaryAssetId returns type "Mantra"; UDA_Dao returns type "Dao"; both expose a static PrimaryAssetType like UDA_RealmLadderConfig.
  - *Convenience entry points added beyond the contract's minimum (no gameplay).* Added: UDA_Mantra::GetSourceId(); UDA_Dao::TryGetNode() (Blueprint face of FindNode); UAutoCultivationController::SetEnabled/IsEnabled (needed by IA_AutoCultivate and the F2 ToggleAuto), SetActiveMantra (the status text needs the Mantra name), IsYieldingToPlayer, ApplyDefaultsToStack, GetAura/GetField/GetState, and a protected ReleaseHeldInputs that calls only aura public input functions. Explicit *_Implementation declarations for every BlueprintNativeEvent.
  - *Shared fill logic is a private static helper with the commandlet as a friend.* URealmLadderEditorLibrary::FillTable, SaveTablePackage, LoadConfigAsset, LoadOrCreateTableAsset and ToObjectPath are private statics; the class declares 'friend class URealmLadderCommandlet;'. DefaultConfigAssetPath/DefaultTableAssetPath are public so the two default asset paths exist in one place. A -NoSave dry-run switch was added to the commandlet.
  - *Package saving uses UPackage::SavePackage with FSavePackageArgs.* SaveTablePackage builds the filename with FPackageName::LongPackageNameToFilename(PackageName, GetAssetPackageExtension()) and calls UPackage::SavePackage(Package, Table, *FileName, SaveArgs) with TopLevelFlags = RF_Public | RF_Standalone, SaveFlags = SAVE_None, Error = GError.
- **Reason:**
  - UnrealHeaderTool rejects reference return types on UFUNCTIONs; the contract fixes the C++ signature, not the reflection exposure.
  - Wisps are field-driven data holders with a mesh; physics or shadows would be cost with no readable consequence.
  - The charter defines wisp placement by radius fraction and angle around the Dantian; a polar model is the smallest representation that the wave (front distance) and the drift (angle) both read directly.
  - Mantra swaps, save restores and the F2 panel can all re-apply the active Mantra; making the operation a replace rather than an append is the smallest way to keep the stack correct without a separate bookkeeping object.
  - The Mantra value is a discrete choice consumed by Auto mode to pick Q or E; an integer cannot express a half-preference by accident and reads as the charter wrote it.
  - The contract fixes primary asset types for the other two data assets but not these; without an override the type would be the class name ("DA_Mantra"). Naming them the same way keeps asset-manager scanning uniform for the Milestone 3 menu pages.
  - Each is a pure accessor or plumbing the contract's own listed callers require; none implements a Milestone 1+ behaviour. Explicit _Implementation declarations are accepted by every UHT version and let subclasses use override.
  - Follows the contract wording literally (private helper, commandlet calls it) while keeping the fill/save code out of the Blueprint-visible surface. -NoSave lets the owner print the 81 rows without touching the asset on disk.
  - The direct API works identically in the commandlet (no editor UI, no prompts) and from the editor library; the UEditorLoadingAndSavingUtils path can open dialogs in an interactive editor.

## Writer decisions not given their own entry
- Items already logged by the round-1 review fixer: auto exposure (D-0017), tag settings placement (D-0018), Python settings placement (D-0019), CompanyName (D-0020), theme colours (D-0022), chance clamp (D-0023), Auto pulse range and gates (D-0024), `ERealmStage::Peak` (D-0025), Stillness at Realm 1 (D-0026).
- Superseded during review round 1: string-based `RequestGameplayTag(..., false)` in the ladder config constructor (replaced by native tags); the editor module's separate `LogAscensionEditor` category (removed; `LogAscension` is exported instead, recorded under docs/SKELETON_M0.md "Divergences accepted at Milestone 0").

# Project Ascension — Change Log

## Status
| | |
|---|---|
| **Current milestone** | 0 — Project foundation |
| **State** | Complete in this repository, **pending owner approval** (charter §12). Milestone 1 does not start until the owner approves Milestone 0. |
| **Branch** | `claude/new-session-zyrmnu` |
| **Last updated** | 2026-09-04 |
| **Not verified here** | Unreal compile, editor state, runtime, screenshots (no Unreal Engine in the build container, D-0008). The owner's first editor session produces them: `docs/OWNER_FIRST_RUN.md`. |

---

## Milestone 0 — Project foundation (2026-09-03 → 2026-09-04)

Report: `docs/MILESTONE_0_REPORT.md` (charter §14.1 format). Pre-plan: `docs/MILESTONE_0_PLAN.md`. Skeleton contract: `docs/SKELETON_M0.md`.

### Assets created
All committed assets are text; binary `.uasset`/`.umap` files are created in-editor by `Content/Python/ascension_m0_setup.py` (D-0008).

- **Project:** `Ascension.uproject`; `Config/DefaultEngine.ini`, `DefaultGame.ini`, `DefaultInput.ini`, `DefaultEditor.ini`, `DefaultGameplayTags.ini` (171 tags).
- **Data:** `Content/Ascension/Data/DT_RealmLadder.json` and `DT_RealmLadder.csv` (81 rows, generated).
- **Content structure (§11.1):** `Content/Ascension/Data/{QiPresets,Mantras,Daos,Tribulations}/`, `Blueprints/`, `Materials/`, `FX/`, `Audio/`, `UI/`, `Maps/`, `Animation/`, `Input/` (`.gitkeep` each), `Content/Ascension/README.md`.
- **Editor scripting:** `Content/Python/ascension_m0_setup.py`, `Content/Python/README.md`.
- **Tools:** `Tools/Ladder/generate_realm_ladder.py` (offline ladder generator); `Tools/StubCompile/check.sh`, `generate_stubs.py`, `README.md`, `.gitignore`, 68 stub headers under `Tools/StubCompile/include/` (model test).
- **Docs:** `CLAUDE.md`, `docs/ASCENSION_CHARTER.md`, `docs/KICKOFF.md`, `docs/Project_Ascension_Full_Game_Master_Prompt.md`, `docs/MILESTONE_0_PLAN.md`, `docs/SKELETON_M0.md`, `docs/DECISIONS.md`, `docs/OWNER_FIRST_RUN.md`, `docs/CHANGELOG.md`, `docs/MILESTONE_0_REPORT.md`, `docs/evidence/.gitkeep`.
- **Repository:** `.gitignore` (Unreal), `.editorconfig`.
- **Created in-editor by the setup script (not in git until the owner runs it):** `DA_RealmLadderConfig`, `DT_RealmLadder`, fifteen `IA_*` actions, `IMC_World`, `IMC_Cultivation`, `WBP_DebugPanel`, `WBP_DebugOverlay`, `L_Test_Cultivation`.

### Assets modified
- None (new project). Files rewritten during the Milestone 0 review loop are listed under Test results → Adversarial review.

### Assets deleted or renamed
- None.

### C++ files added
| File | Purpose (charter §) |
|---|---|
| `Source/Ascension.Target.cs`, `Source/AscensionEditor.Target.cs` | Game and Editor targets; `BuildSettingsVersion.Latest` (D-0029) |
| `Source/Ascension/Ascension.Build.cs` | Runtime module rules: Core, CoreUObject, Engine, InputCore, EnhancedInput, GameplayTags, UMG, DeveloperSettings, Niagara; Slate/SlateCore private; `PublicIncludePaths.Add(ModuleDirectory)` |
| `Source/Ascension/Ascension.h/.cpp` | `FAscensionModule`, primary game module |
| `Source/Ascension/AscensionLog.h/.cpp` | `LogAscension` category, exported with `ASCENSION_API` |
| `Source/Ascension/AscensionGameplayTags.h/.cpp` | 171 native gameplay tags in namespace `AscensionTags` (§11.2, Appendix C) |
| `Source/Ascension/Cultivation/CultivationTypes.h` | Shared enums (`EQiWispState`, `EModifierOp`, `ERealmStage`, `EPulsePhase`, …) and `FCultivationEvent` (§7, §10.6) |
| `Source/Ascension/Cultivation/ModifierStack.h/.cpp` | `UModifierStack`, `FModifierEntry`, 45 canonical property names; Override→Add→Multiply resolution **implemented** (§11.1) |
| `Source/Ascension/Cultivation/RealmLadder.h/.cpp` | `FRealmDefinition`, `FRealmLayerRow`, `UDA_RealmLadderConfig` (all §6.3 constants, nine Realm definitions), `URealmLadderLibrary` generator **implemented** (§6.1, §6.6) |
| `Source/Ascension/Cultivation/Breakthrough.h/.cpp` | `UBreakthroughLibrary::ComputeMinorChance`/`DescribeFailure` **implemented** (§6.4, §7.10), `FSeededStream` over `FRandomStream` |
| `Source/Ascension/Cultivation/CultivationState.h/.cpp` | `UCultivationState`: Realm, Layer, Progress, Stability, Purity, Reserve, Corruption, scar, Mantras, Insight, nodes, RNG, event log, checksum, save mapping (§6.6, §10.7, §11.3) |
| `Source/Ascension/Cultivation/CultivationSubsystem.h/.cpp` | `UCultivationSubsystem` owns the state, stack, ladder config and table (D-0010) |
| `Source/Ascension/Cultivation/AuraComponent.h/.cpp` | `UAuraComponent`: §7.1 properties, the eight input entry points, delegates; only `FlowPhase` accumulation at M0 (§7.2, §7.3, §13) |
| `Source/Ascension/Cultivation/QiFieldComponent.h/.cpp` | `UQiFieldComponent`: wisp ownership, spawn, wave/draw stubs (§7.4) |
| `Source/Ascension/Cultivation/QiWisp.h/.cpp` | `AQiWisp` (no Tick) and `FQiWispData` (§7.4) |
| `Source/Ascension/Cultivation/QiPreset.h` | `UDA_QiPreset` keyed by (Condition, Nature) with the §7.5/§7.6 trait fields |
| `Source/Ascension/Cultivation/Mantra.h/.cpp` | `FMantraModifier`, `UMantraBehaviour`, `UDA_Mantra` (§9.1) |
| `Source/Ascension/Cultivation/Dao.h/.cpp` | `EDaoNodeFamily`, `FDaoNode`, `UDaoTechnique`, `UDA_Dao` (§9.3) |
| `Source/Ascension/Cultivation/Tribulation.h/.cpp` | `FSurgeEvent` (Appendix A) and the `UTribulationDefinition` base (§6.5) |
| `Source/Ascension/Cultivation/AutoCultivationController.h/.cpp` | `UAutoCultivationController` tunables and rules (§7.11); Tick is a stub |
| `Source/Ascension/Player/AscensionCharacter.h/.cpp` | World pawn: template-shaped locomotion and camera, Enhanced Input handlers (§8) |
| `Source/Ascension/Player/CultivationPawn.h/.cpp` | Meditation camera pawn with `UAuraComponent` and `UQiFieldComponent`; input forwarding (§8, §10.2) |
| `Source/Ascension/Player/AscensionPlayerController.h/.cpp` | Mapping-context ownership, debug widget toggles (F1/F2), meditation entry stubs |
| `Source/Ascension/Player/AscensionGameMode.h/.cpp` | Default classes |
| `Source/Ascension/Player/AscensionSaveGame.h/.cpp` | `UAscensionSaveGame` with every §10.7 field |
| `Source/Ascension/Player/AscensionSettings.h/.cpp` | `UAscensionSettings` (Project Settings → Game → Ascension): soft references to data, input and widget assets (D-0010, D-0021) |
| `Source/Ascension/UI/CultivationHUDWidget.h/.cpp` | HUD base with §10.6 bindables and a tag-gated control legend (§8) |
| `Source/Ascension/UI/WorldHUDWidget.h/.cpp` | World HUD base (§10.6) |
| `Source/Ascension/UI/DebugOverlayWidget.h/.cpp` | F1 overlay: dumps every §7.1/§7.4 number, the ladder row, RNG state, last 20 events |
| `Source/Ascension/UI/DebugPanelWidget.h/.cpp` | F2 panel: one `BlueprintCallable` per §11.5 item |
| `Source/AscensionEditor/AscensionEditor.Build.cs`, `AscensionEditor.h/.cpp` | Editor module (D-0009) |
| `Source/AscensionEditor/RealmLadderCommandlet.h/.cpp` | `-run=RealmLadder` regenerates `DT_RealmLadder` from `DA_RealmLadderConfig` and logs all 81 rows |
| `Source/AscensionEditor/RealmLadderEditorLibrary.h/.cpp` | `RegenerateLadderTable` for Blutility/Editor Utility use; shared fill logic |

### Project Settings changed
| File | Setting | Why |
|---|---|---|
| `Config/DefaultEngine.ini` | `GameDefaultMap`, `EditorStartupMap` = `L_Test_Cultivation`; `GlobalDefaultGameMode` = `AscensionGameMode` | §11.5 test map is the working map at M0 |
| `Config/DefaultEngine.ini` | `r.DefaultFeature.AutoExposure=False` (+ luminance range/bias), Lumen GI and reflections, virtual shadow maps, Nanite, no static lighting, TSR (`r.AntiAliasingMethod=4`), motion blur off, ray tracing off, `r.CustomDepth=3` | Aura brightness is a mechanical cue (D-0017); template-equivalent rendering defaults |
| `Config/DefaultEngine.ini` | `DefaultGraphicsRHI=DX12`; Desktop / Maximum hardware targeting; audio at 48 kHz | Windows target (§15) |
| `Config/DefaultEngine.ini` | `bAuthorizeAutomaticWidgetVariableCreation=False` | D-0028 |
| `Config/DefaultEngine.ini` | Python plugin: `+AdditionalPaths=(Path="Content/Python")`, `bDeveloperMode=True` | Setup script (D-0008, D-0019) |
| `Config/DefaultGame.ini` | `ProjectName=Project Ascension`, `ProjectID`, `ProjectVersion=0.0.1`, `CompanyName` placeholder | D-0020 |
| `Config/DefaultGame.ini` | `[/Script/GameplayTags.GameplayTagsSettings]` four-key mirror (`ImportTagsFromConfig`, `WarnOnInvalidTags`, `FastReplication`, `InvalidTagCharacters`) of `DefaultGameplayTags.ini` | D-0018 |
| `Config/DefaultGame.ini` | `[/Script/Ascension.AscensionSettings]` soft paths: ladder config/table, `IMC_World`, `IMC_Cultivation`, `IA_DebugOverlay`, `IA_DebugPanel`, `WBP_DebugOverlay`, `WBP_DebugPanel`; autosave 120 s; 3 manual slots | D-0010, D-0021, §10.7 |
| `Config/DefaultGameplayTags.ini` | `ImportTagsFromConfig=True`, `WarnOnInvalidTags=True`, `FastReplication=False`; 171 `+GameplayTagList` entries | §11.2, D-0018 |
| `Config/DefaultInput.ini` | `DefaultPlayerInputClass=EnhancedPlayerInput`, `DefaultInputComponentClass=EnhancedInputComponent`, `bAltEnterTogglesFullscreen=True` | §8 |
| `Config/DefaultEditor.ini` | Python plugin settings mirror | D-0019 |
| `Ascension.uproject` | Engine 5.8; modules `Ascension` (Runtime) and `AscensionEditor` (Editor); plugins EnhancedInput, Niagara, Metasound, ControlRig, PythonScriptPlugin (Editor), EditorScriptingUtilities (Editor); Windows | D-0015, D-0030 |

### Compile results
- **Unreal Build Tool / Unreal Header Tool: not run.** There is no Unreal Engine in the build container (D-0008). The owner's first build is the compile evidence (`docs/OWNER_FIRST_RUN.md` step 2).
- **Model test (not a build):** `Tools/StubCompile/check.sh` — clang 18 `-std=c++20 -fsyntax-only` of every `.cpp` against hand-written stub engine headers, runtime module with `WITH_EDITOR=0` and `=1`, editor module with `WITH_EDITOR=1`, plus textual UHT-style lints. Result on the final tree: **53 PASS, 0 FAIL of 53 translation-unit checks; 0 clang errors; 0 lint failures** (about 24 s). It catches typos, mismatched declarations between our own headers and sources, include order and missing `_Implementation` bodies; it cannot prove UHT acceptance, real engine signatures or linking.
- Blueprints and materials: none exist yet.

### Test results
- **Ladder:** all 81 rows of `DT_RealmLadder.json` recomputed independently from charter §6.3 plus D-0003–D-0007/D-0012 with 0 mismatches; CSV agrees with JSON field-for-field; every `UDA_RealmLadderConfig` default equals the Python `LadderConfig` default; the C++ `ComputeRow` arithmetic reproduced all 81 JSON rows in a replica harness. Preview Reach: 800 / 1,184 / 1,520 / 5,487 / 37,637 / 201,085 at 1.1 / 1.9 / 2.1 / 4.1 / 7.1 / 9.9 (D-0007 on the 9.9 figure).
- **Gameplay tags:** 171 tags identical across `docs/SKELETON_M0.md`, `AscensionGameplayTags.h`, `AscensionGameplayTags.cpp` and `Config/DefaultGameplayTags.ini`; no duplicates; every `Ascension.*` literal used in `Source/`, `Config/` and `Content/Python` exists; all 57 native tag references in `RealmLadder.cpp` are declared.
- **Forbidden words:** no "Law" as a progression term and no "mana"/"energy"/"MP" in any `FText`, DevComment or Python user-facing string; no hardcoded key checks in `Source/`.
- **Contract presence:** every file in `docs/SKELETON_M0.md` exists; all 38 contracted classes and structs exist; all ten §11.5 debug-panel functions exist on `UDebugPanelWidget`; every reflected header includes its `.generated.h` last and carries `GENERATED_BODY`.
- **Adversarial review (round 1):** 4 lenses (charter compliance, UE 5.8 API, Python setup script, docs and decisions) produced 36 findings (5 blocking, 20 should, 11 nit). The fixer applied 18 items (all blocking and should findings, several combined); 5 findings were skipped as alternatives already chosen or work belonging to a later milestone. The per-finding skip list was not preserved in the repository, so only that summary survives (the round-2 list below is kept in full to avoid repeating the gap). Files rewritten by round 1: `Source/Ascension/Player/AscensionPlayerController.h/.cpp`, `Player/AscensionSettings.h/.cpp`, `Config/DefaultGame.ini` (D-0021), `Source/Ascension/AscensionLog.h`, `Source/AscensionEditor/*.cpp` (shared `LogAscension`), `Source/Ascension/Cultivation/RealmLadder.cpp` (native-tag unlock lists), `.gitignore`, `Content/Python/ascension_m0_setup.py`, `docs/DECISIONS.md` (D-0017–D-0058), `docs/CHANGELOG.md`, `docs/MILESTONE_0_REPORT.md`.
- **Adversarial review (round 2):** the same 4 lenses on the round-1 tree produced 11 findings (1 blocking, 10 should; six distinct issues, the rest duplicated across lenses) and 12 nits. All 11 findings and 11 of the 12 nits were applied; the one skipped nit and every reason are listed in `docs/MILESTONE_0_REPORT.md` VERIFIED → Adversarial review. Files rewritten by round 2: `Source/Ascension/Ascension.Build.cs` (`ModuleDirectory`), `Source/AscensionEditor/RealmLadderEditorLibrary.h` (no `CallInEditor`), `Source/Ascension/Player/AscensionPlayerController.cpp` (comment only), `Content/Python/ascension_m0_setup.py` (docstring, locomotion comment, level MANUAL STEP texts, `set_static_mesh` check), `Content/Python/README.md`, `docs/OWNER_FIRST_RUN.md`, `docs/SKELETON_M0.md` (Divergences), `docs/MILESTONE_0_PLAN.md` (§6 git row), `docs/DECISIONS.md` (D-0059, D-0060, a cross-reference on D-0055), `docs/CHANGELOG.md`, `docs/MILESTONE_0_REPORT.md`. `Tools/StubCompile/check.sh` re-run after the fixes: 53 PASS, 0 FAIL.
- **Determinism checksum:** not applicable until Milestone 1 (`UCultivationState::ComputeEventChecksum` exists).
- **Scripted tests on `L_Test_Cultivation`:** none possible here; the map is created by the setup script on the owner's machine.

### Warnings
- `UDA_RealmLadderConfig` computes in `double` and rounds like the Python twin; MSVC `pow` could differ from glibc by one ulp on the owner's machine. No current row sits on a rounding boundary. Diff the commandlet's regenerated rows against `DT_RealmLadder.json` once (`docs/OWNER_FIRST_RUN.md` step 5).
- The `ASCENSION_PROPERTY_NAMES` multi-line X-macro lives in a UHT-parsed header; UHT skips multi-line `#define`s (engine precedent `ATTRIBUTE_ACCESSORS`), unverified here.
- `FSeededStream::Restore` replays `Position` draws in O(Position); Milestone 2 save code should cap it.
- `UDataTable::RowStruct` const-ness: the editor library assigns a non-const `UScriptStruct*`, which compiles whether the engine declares the member const or not.
- `Target.cs` uses `BuildSettingsVersion.Latest` / `EngineIncludeOrderVersion.Latest` because the exact 5.8 enum members could not be confirmed here (D-0029).
- Python setup script API names are from knowledge of the `unreal` module, not executed; every call is guarded and prints a `MANUAL STEP` line on failure.

### Decisions
D-0001 through D-0060 in `docs/DECISIONS.md`. Highlights: charter in `docs/` imported by `CLAUDE.md` (D-0001); Third Person template shape (D-0002); Pulse timing, Impure fraction, spawn interval and nature-weight readings (D-0003–D-0006); Reach at 9.9 is ~201,000 not "beyond 250,000", constants kept (D-0007); no engine in the container, so file generation plus an in-editor setup script (D-0008); editor module (D-0009); subsystem and settings ownership (D-0010); JSON import (D-0011); threshold state tags (D-0013); plugins (D-0015); plan approval assumed for the non-interactive session (D-0016); renderer, tag and Python settings placement (D-0017–D-0019); input soft references so the debug panel can open from the raw C++ controller (D-0021); placeholder theme colours (D-0022); chance clamp (D-0023); Auto range and gates (D-0024); `ERealmStage::Peak` (D-0025); Stillness at Realm 1 (D-0026); `/Game/Ascension/Input/` (D-0027); writer decisions D-0029–D-0058; review round 2: the template's locomotion input folder is `/Game/Input`, referenced never copied (D-0059), Tribulation class-wide defaults and the F2 panel as a menu for the cursor rule (D-0060).

### DT_RealmLadder — all 81 rows
Generated by `python3 Tools/Ladder/generate_realm_ladder.py` from the constants in `DA_RealmLadderConfig` (charter §6.3). Reach in Unreal units; Capacity, Reserve and Progress in Qi units; StabRec per second; Charge/Recov/Spawn in seconds; BT base is the Minor Breakthrough base chance before Stability and Purity factors.

| Row | Realm | Layer | Stage | Reach | Capacity | Reserve | Progress | StabRec/s | Charge s | Recov s | Wisps | Spawn s | Impure | BT base | Natures |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| R1L1 | 1 Qi Sensing | 1 | Early | 800 | 10.0 | 6.0 | 8.0 | 0.06 | 1.25 | 0.75 | 5 | 4.00 | 0.33 | 0.90 | Generic |
| R1L2 | 1 Qi Sensing | 2 | Early | 848 | 11.0 | 6.6 | 10.0 | 0.06 | 1.25 | 0.75 | 5 | 4.00 | 0.33 | 0.85 | Generic |
| R1L3 | 1 Qi Sensing | 3 | Early | 896 | 12.0 | 7.2 | 12.0 | 0.06 | 1.25 | 0.75 | 6 | 4.00 | 0.33 | 0.80 | Generic |
| R1L4 | 1 Qi Sensing | 4 | Middle | 944 | 13.0 | 7.8 | 14.0 | 0.06 | 1.25 | 0.75 | 6 | 4.00 | 0.33 | 0.75 | Generic |
| R1L5 | 1 Qi Sensing | 5 | Middle | 992 | 14.0 | 8.4 | 16.0 | 0.06 | 1.25 | 0.75 | 6 | 4.00 | 0.33 | 0.70 | Generic |
| R1L6 | 1 Qi Sensing | 6 | Middle | 1,040 | 15.0 | 9.0 | 18.0 | 0.06 | 1.25 | 0.75 | 7 | 4.00 | 0.33 | 0.65 | Generic |
| R1L7 | 1 Qi Sensing | 7 | Late | 1,088 | 16.0 | 9.6 | 20.0 | 0.06 | 1.25 | 0.75 | 7 | 4.00 | 0.33 | 0.60 | Generic |
| R1L8 | 1 Qi Sensing | 8 | Late | 1,136 | 17.0 | 10.2 | 22.0 | 0.06 | 1.25 | 0.75 | 7 | 4.00 | 0.33 | 0.55 | Generic |
| R1L9 | 1 Qi Sensing | 9 | Peak | 1,184 | 18.0 | 10.8 | 24.0 | 0.06 | 1.25 | 0.75 | 8 | 4.00 | 0.33 | 0.50 | Generic |
| R2L1 | 2 Qi Condensation | 1 | Early | 1,520 | 30.0 | 18.0 | 17.6 | 0.07 | 1.22 | 0.73 | 7 | 3.75 | 0.36 | 0.90 | Generic Yin Yang |
| R2L2 | 2 Qi Condensation | 2 | Early | 1,611 | 33.0 | 19.8 | 22.0 | 0.07 | 1.22 | 0.73 | 7 | 3.75 | 0.36 | 0.85 | Generic Yin Yang |
| R2L3 | 2 Qi Condensation | 3 | Early | 1,702 | 36.0 | 21.6 | 26.4 | 0.07 | 1.22 | 0.73 | 8 | 3.75 | 0.36 | 0.80 | Generic Yin Yang |
| R2L4 | 2 Qi Condensation | 4 | Middle | 1,794 | 39.0 | 23.4 | 30.8 | 0.07 | 1.22 | 0.73 | 8 | 3.75 | 0.36 | 0.75 | Generic Yin Yang |
| R2L5 | 2 Qi Condensation | 5 | Middle | 1,885 | 42.0 | 25.2 | 35.2 | 0.07 | 1.22 | 0.73 | 8 | 3.75 | 0.36 | 0.70 | Generic Yin Yang |
| R2L6 | 2 Qi Condensation | 6 | Middle | 1,976 | 45.0 | 27.0 | 39.6 | 0.07 | 1.22 | 0.73 | 9 | 3.75 | 0.36 | 0.65 | Generic Yin Yang |
| R2L7 | 2 Qi Condensation | 7 | Late | 2,067 | 48.0 | 28.8 | 44.0 | 0.07 | 1.22 | 0.73 | 9 | 3.75 | 0.36 | 0.60 | Generic Yin Yang |
| R2L8 | 2 Qi Condensation | 8 | Late | 2,158 | 51.0 | 30.6 | 48.4 | 0.07 | 1.22 | 0.73 | 9 | 3.75 | 0.36 | 0.55 | Generic Yin Yang |
| R2L9 | 2 Qi Condensation | 9 | Peak | 2,250 | 54.0 | 32.4 | 52.8 | 0.07 | 1.22 | 0.73 | 10 | 3.75 | 0.36 | 0.50 | Generic Yin Yang |
| R3L1 | 3 Foundation Establishment | 1 | Early | 2,888 | 90.0 | 54.0 | 38.7 | 0.08 | 1.19 | 0.71 | 9 | 3.50 | 0.40 | 0.90 | Generic Yin Yang Fire Water |
| R3L2 | 3 Foundation Establishment | 2 | Early | 3,061 | 99.0 | 59.4 | 48.4 | 0.08 | 1.19 | 0.71 | 9 | 3.50 | 0.40 | 0.85 | Generic Yin Yang Fire Water |
| R3L3 | 3 Foundation Establishment | 3 | Early | 3,235 | 108.0 | 64.8 | 58.1 | 0.08 | 1.19 | 0.71 | 10 | 3.50 | 0.40 | 0.80 | Generic Yin Yang Fire Water |
| R3L4 | 3 Foundation Establishment | 4 | Middle | 3,408 | 117.0 | 70.2 | 67.8 | 0.08 | 1.19 | 0.71 | 10 | 3.50 | 0.40 | 0.75 | Generic Yin Yang Fire Water |
| R3L5 | 3 Foundation Establishment | 5 | Middle | 3,581 | 126.0 | 75.6 | 77.4 | 0.08 | 1.19 | 0.71 | 10 | 3.50 | 0.40 | 0.70 | Generic Yin Yang Fire Water |
| R3L6 | 3 Foundation Establishment | 6 | Middle | 3,754 | 135.0 | 81.0 | 87.1 | 0.08 | 1.19 | 0.71 | 11 | 3.50 | 0.40 | 0.65 | Generic Yin Yang Fire Water |
| R3L7 | 3 Foundation Establishment | 7 | Late | 3,928 | 144.0 | 86.4 | 96.8 | 0.08 | 1.19 | 0.71 | 11 | 3.50 | 0.40 | 0.60 | Generic Yin Yang Fire Water |
| R3L8 | 3 Foundation Establishment | 8 | Late | 4,101 | 153.0 | 91.8 | 106.5 | 0.08 | 1.19 | 0.71 | 11 | 3.50 | 0.40 | 0.55 | Generic Yin Yang Fire Water |
| R3L9 | 3 Foundation Establishment | 9 | Peak | 4,274 | 162.0 | 97.2 | 116.2 | 0.08 | 1.19 | 0.71 | 12 | 3.50 | 0.40 | 0.50 | Generic Yin Yang Fire Water |
| R4L1 | 4 Core Formation | 1 | Early | 5,487 | 270.0 | 162.0 | 85.2 | 0.09 | 1.16 | 0.69 | 11 | 3.25 | 0.43 | 0.90 | Generic Yin Yang Fire Water Wood Metal |
| R4L2 | 4 Core Formation | 2 | Early | 5,816 | 297.0 | 178.2 | 106.5 | 0.09 | 1.16 | 0.69 | 11 | 3.25 | 0.43 | 0.85 | Generic Yin Yang Fire Water Wood Metal |
| R4L3 | 4 Core Formation | 3 | Early | 6,146 | 324.0 | 194.4 | 127.8 | 0.09 | 1.16 | 0.69 | 12 | 3.25 | 0.43 | 0.80 | Generic Yin Yang Fire Water Wood Metal |
| R4L4 | 4 Core Formation | 4 | Middle | 6,475 | 351.0 | 210.6 | 149.1 | 0.09 | 1.16 | 0.69 | 12 | 3.25 | 0.43 | 0.75 | Generic Yin Yang Fire Water Wood Metal |
| R4L5 | 4 Core Formation | 5 | Middle | 6,804 | 378.0 | 226.8 | 170.4 | 0.09 | 1.16 | 0.69 | 12 | 3.25 | 0.43 | 0.70 | Generic Yin Yang Fire Water Wood Metal |
| R4L6 | 4 Core Formation | 6 | Middle | 7,133 | 405.0 | 243.0 | 191.7 | 0.09 | 1.16 | 0.69 | 13 | 3.25 | 0.43 | 0.65 | Generic Yin Yang Fire Water Wood Metal |
| R4L7 | 4 Core Formation | 7 | Late | 7,463 | 432.0 | 259.2 | 213.0 | 0.09 | 1.16 | 0.69 | 13 | 3.25 | 0.43 | 0.60 | Generic Yin Yang Fire Water Wood Metal |
| R4L8 | 4 Core Formation | 8 | Late | 7,792 | 459.0 | 275.4 | 234.3 | 0.09 | 1.16 | 0.69 | 13 | 3.25 | 0.43 | 0.55 | Generic Yin Yang Fire Water Wood Metal |
| R4L9 | 4 Core Formation | 9 | Peak | 8,121 | 486.0 | 291.6 | 255.6 | 0.09 | 1.16 | 0.69 | 14 | 3.25 | 0.43 | 0.50 | Generic Yin Yang Fire Water Wood Metal |
| R5L1 | 5 Nascent Soul | 1 | Early | 10,426 | 810.0 | 486.0 | 187.4 | 0.10 | 1.13 | 0.67 | 13 | 3.00 | 0.47 | 0.90 | Generic Yin Yang Fire Water Wood Metal Earth |
| R5L2 | 5 Nascent Soul | 2 | Early | 11,051 | 891.0 | 534.6 | 234.3 | 0.10 | 1.13 | 0.67 | 13 | 3.00 | 0.47 | 0.85 | Generic Yin Yang Fire Water Wood Metal Earth |
| R5L3 | 5 Nascent Soul | 3 | Early | 11,677 | 972.0 | 583.2 | 281.1 | 0.10 | 1.13 | 0.67 | 14 | 3.00 | 0.47 | 0.80 | Generic Yin Yang Fire Water Wood Metal Earth |
| R5L4 | 5 Nascent Soul | 4 | Middle | 12,302 | 1,053.0 | 631.8 | 328.0 | 0.10 | 1.13 | 0.67 | 14 | 3.00 | 0.47 | 0.75 | Generic Yin Yang Fire Water Wood Metal Earth |
| R5L5 | 5 Nascent Soul | 5 | Middle | 12,928 | 1,134.0 | 680.4 | 374.8 | 0.10 | 1.13 | 0.67 | 14 | 3.00 | 0.47 | 0.70 | Generic Yin Yang Fire Water Wood Metal Earth |
| R5L6 | 5 Nascent Soul | 6 | Middle | 13,553 | 1,215.0 | 729.0 | 421.7 | 0.10 | 1.13 | 0.67 | 15 | 3.00 | 0.47 | 0.65 | Generic Yin Yang Fire Water Wood Metal Earth |
| R5L7 | 5 Nascent Soul | 7 | Late | 14,179 | 1,296.0 | 777.6 | 468.5 | 0.10 | 1.13 | 0.67 | 15 | 3.00 | 0.47 | 0.60 | Generic Yin Yang Fire Water Wood Metal Earth |
| R5L8 | 5 Nascent Soul | 8 | Late | 14,804 | 1,377.0 | 826.2 | 515.4 | 0.10 | 1.13 | 0.67 | 15 | 3.00 | 0.47 | 0.55 | Generic Yin Yang Fire Water Wood Metal Earth |
| R5L9 | 5 Nascent Soul | 9 | Peak | 15,430 | 1,458.0 | 874.8 | 562.2 | 0.10 | 1.13 | 0.67 | 16 | 3.00 | 0.47 | 0.50 | Generic Yin Yang Fire Water Wood Metal Earth |
| R6L1 | 6 Soul Transformation | 1 | Early | 19,809 | 2,430.0 | 1,458.0 | 412.3 | 0.11 | 1.10 | 0.65 | 15 | 2.75 | 0.50 | 0.90 | Generic Yin Yang Fire Water Wood Metal Earth Life |
| R6L2 | 6 Soul Transformation | 2 | Early | 20,997 | 2,673.0 | 1,603.8 | 515.4 | 0.11 | 1.10 | 0.65 | 15 | 2.75 | 0.50 | 0.85 | Generic Yin Yang Fire Water Wood Metal Earth Life |
| R6L3 | 6 Soul Transformation | 3 | Early | 22,186 | 2,916.0 | 1,749.6 | 618.4 | 0.11 | 1.10 | 0.65 | 16 | 2.75 | 0.50 | 0.80 | Generic Yin Yang Fire Water Wood Metal Earth Life |
| R6L4 | 6 Soul Transformation | 4 | Middle | 23,374 | 3,159.0 | 1,895.4 | 721.5 | 0.11 | 1.10 | 0.65 | 16 | 2.75 | 0.50 | 0.75 | Generic Yin Yang Fire Water Wood Metal Earth Life |
| R6L5 | 6 Soul Transformation | 5 | Middle | 24,563 | 3,402.0 | 2,041.2 | 824.6 | 0.11 | 1.10 | 0.65 | 16 | 2.75 | 0.50 | 0.70 | Generic Yin Yang Fire Water Wood Metal Earth Life |
| R6L6 | 6 Soul Transformation | 6 | Middle | 25,751 | 3,645.0 | 2,187.0 | 927.6 | 0.11 | 1.10 | 0.65 | 17 | 2.75 | 0.50 | 0.65 | Generic Yin Yang Fire Water Wood Metal Earth Life |
| R6L7 | 6 Soul Transformation | 7 | Late | 26,940 | 3,888.0 | 2,332.8 | 1,030.7 | 0.11 | 1.10 | 0.65 | 17 | 2.75 | 0.50 | 0.60 | Generic Yin Yang Fire Water Wood Metal Earth Life |
| R6L8 | 6 Soul Transformation | 8 | Late | 28,128 | 4,131.0 | 2,478.6 | 1,133.8 | 0.11 | 1.10 | 0.65 | 17 | 2.75 | 0.50 | 0.55 | Generic Yin Yang Fire Water Wood Metal Earth Life |
| R6L9 | 6 Soul Transformation | 9 | Peak | 29,317 | 4,374.0 | 2,624.4 | 1,236.9 | 0.11 | 1.10 | 0.65 | 18 | 2.75 | 0.50 | 0.50 | Generic Yin Yang Fire Water Wood Metal Earth Life |
| R7L1 | 7 Void Refinement | 1 | Early | 37,637 | 7,290.0 | 4,374.0 | 907.0 | 0.12 | 1.07 | 0.63 | 17 | 2.50 | 0.43 | 0.90 | Generic Yin Yang Fire Water Wood Metal Earth Life Void |
| R7L2 | 7 Void Refinement | 2 | Early | 39,895 | 8,019.0 | 4,811.4 | 1,133.8 | 0.12 | 1.07 | 0.63 | 17 | 2.50 | 0.43 | 0.85 | Generic Yin Yang Fire Water Wood Metal Earth Life Void |
| R7L3 | 7 Void Refinement | 3 | Early | 42,153 | 8,748.0 | 5,248.8 | 1,360.6 | 0.12 | 1.07 | 0.63 | 18 | 2.50 | 0.43 | 0.80 | Generic Yin Yang Fire Water Wood Metal Earth Life Void |
| R7L4 | 7 Void Refinement | 4 | Middle | 44,411 | 9,477.0 | 5,686.2 | 1,587.3 | 0.12 | 1.07 | 0.63 | 18 | 2.50 | 0.43 | 0.75 | Generic Yin Yang Fire Water Wood Metal Earth Life Void |
| R7L5 | 7 Void Refinement | 5 | Middle | 46,670 | 10,206.0 | 6,123.6 | 1,814.1 | 0.12 | 1.07 | 0.63 | 18 | 2.50 | 0.43 | 0.70 | Generic Yin Yang Fire Water Wood Metal Earth Life Void |
| R7L6 | 7 Void Refinement | 6 | Middle | 48,928 | 10,935.0 | 6,561.0 | 2,040.8 | 0.12 | 1.07 | 0.63 | 19 | 2.50 | 0.43 | 0.65 | Generic Yin Yang Fire Water Wood Metal Earth Life Void |
| R7L7 | 7 Void Refinement | 7 | Late | 51,186 | 11,664.0 | 6,998.4 | 2,267.6 | 0.12 | 1.07 | 0.63 | 19 | 2.50 | 0.43 | 0.60 | Generic Yin Yang Fire Water Wood Metal Earth Life Void |
| R7L8 | 7 Void Refinement | 8 | Late | 53,444 | 12,393.0 | 7,435.8 | 2,494.4 | 0.12 | 1.07 | 0.63 | 19 | 2.50 | 0.43 | 0.55 | Generic Yin Yang Fire Water Wood Metal Earth Life Void |
| R7L9 | 7 Void Refinement | 9 | Peak | 55,702 | 13,122.0 | 7,873.2 | 2,721.1 | 0.12 | 1.07 | 0.63 | 20 | 2.50 | 0.43 | 0.50 | Generic Yin Yang Fire Water Wood Metal Earth Life Void |
| R8L1 | 8 Dao Integration | 1 | Early | 71,510 | 21,870.0 | 13,122.0 | 1,995.5 | 0.13 | 1.04 | 0.61 | 19 | 2.25 | 0.37 | 0.90 | Generic Yin Yang Fire Water Wood Metal Earth Life Void |
| R8L2 | 8 Dao Integration | 2 | Early | 75,800 | 24,057.0 | 14,434.2 | 2,494.4 | 0.13 | 1.04 | 0.61 | 19 | 2.25 | 0.37 | 0.85 | Generic Yin Yang Fire Water Wood Metal Earth Life Void |
| R8L3 | 8 Dao Integration | 3 | Early | 80,091 | 26,244.0 | 15,746.4 | 2,993.2 | 0.13 | 1.04 | 0.61 | 20 | 2.25 | 0.37 | 0.80 | Generic Yin Yang Fire Water Wood Metal Earth Life Void |
| R8L4 | 8 Dao Integration | 4 | Middle | 84,381 | 28,431.0 | 17,058.6 | 3,492.1 | 0.13 | 1.04 | 0.61 | 20 | 2.25 | 0.37 | 0.75 | Generic Yin Yang Fire Water Wood Metal Earth Life Void |
| R8L5 | 8 Dao Integration | 5 | Middle | 88,672 | 30,618.0 | 18,370.8 | 3,991.0 | 0.13 | 1.04 | 0.61 | 20 | 2.25 | 0.37 | 0.70 | Generic Yin Yang Fire Water Wood Metal Earth Life Void |
| R8L6 | 8 Dao Integration | 6 | Middle | 92,963 | 32,805.0 | 19,683.0 | 4,489.8 | 0.13 | 1.04 | 0.61 | 21 | 2.25 | 0.37 | 0.65 | Generic Yin Yang Fire Water Wood Metal Earth Life Void |
| R8L7 | 8 Dao Integration | 7 | Late | 97,253 | 34,992.0 | 20,995.2 | 4,988.7 | 0.13 | 1.04 | 0.61 | 21 | 2.25 | 0.37 | 0.60 | Generic Yin Yang Fire Water Wood Metal Earth Life Void |
| R8L8 | 8 Dao Integration | 8 | Late | 101,544 | 37,179.0 | 22,307.4 | 5,487.6 | 0.13 | 1.04 | 0.61 | 21 | 2.25 | 0.37 | 0.55 | Generic Yin Yang Fire Water Wood Metal Earth Life Void |
| R8L9 | 8 Dao Integration | 9 | Peak | 105,834 | 39,366.0 | 23,619.6 | 5,986.5 | 0.13 | 1.04 | 0.61 | 22 | 2.25 | 0.37 | 0.50 | Generic Yin Yang Fire Water Wood Metal Earth Life Void |
| R9L1 | 9 Ascension | 1 | Early | 135,868 | 65,610.0 | 39,366.0 | 4,390.1 | 0.14 | 1.01 | 0.59 | 21 | 2.00 | 0.30 | 0.90 | Generic Yin Yang Fire Water Wood Metal Earth Life Void |
| R9L2 | 9 Ascension | 2 | Early | 144,021 | 72,171.0 | 43,302.6 | 5,487.6 | 0.14 | 1.01 | 0.59 | 21 | 2.00 | 0.30 | 0.85 | Generic Yin Yang Fire Water Wood Metal Earth Life Void |
| R9L3 | 9 Ascension | 3 | Early | 152,173 | 78,732.0 | 47,239.2 | 6,585.1 | 0.14 | 1.01 | 0.59 | 22 | 2.00 | 0.30 | 0.80 | Generic Yin Yang Fire Water Wood Metal Earth Life Void |
| R9L4 | 9 Ascension | 4 | Middle | 160,325 | 85,293.0 | 51,175.8 | 7,682.6 | 0.14 | 1.01 | 0.59 | 22 | 2.00 | 0.30 | 0.75 | Generic Yin Yang Fire Water Wood Metal Earth Life Void |
| R9L5 | 9 Ascension | 5 | Middle | 168,477 | 91,854.0 | 55,112.4 | 8,780.1 | 0.14 | 1.01 | 0.59 | 22 | 2.00 | 0.30 | 0.70 | Generic Yin Yang Fire Water Wood Metal Earth Life Void |
| R9L6 | 9 Ascension | 6 | Middle | 176,629 | 98,415.0 | 59,049.0 | 9,877.7 | 0.14 | 1.01 | 0.59 | 23 | 2.00 | 0.30 | 0.65 | Generic Yin Yang Fire Water Wood Metal Earth Life Void |
| R9L7 | 9 Ascension | 7 | Late | 184,781 | 104,976.0 | 62,985.6 | 10,975.2 | 0.14 | 1.01 | 0.59 | 23 | 2.00 | 0.30 | 0.60 | Generic Yin Yang Fire Water Wood Metal Earth Life Void |
| R9L8 | 9 Ascension | 8 | Late | 192,933 | 111,537.0 | 66,922.2 | 12,072.7 | 0.14 | 1.01 | 0.59 | 23 | 2.00 | 0.30 | 0.55 | Generic Yin Yang Fire Water Wood Metal Earth Life Void |
| R9L9 | 9 Ascension | 9 | Peak | 201,085 | 118,098.0 | 70,858.8 | 13,170.2 | 0.14 | 1.01 | 0.59 | 24 | 2.00 | 0.30 | 0.50 | Generic Yin Yang Fire Water Wood Metal Earth Life Void |

Config used:

```
BaseReach = 800.0
RealmGrowth = 1.9
LayerGrowth = 0.06
BaseCapacity = 10.0
CapacityRealmGrowth = 3.0
CapacityLayerGrowth = 0.1
ReserveFraction = 0.6
BaseProgress = 8.0
ProgressRealmGrowth = 2.2
ProgressLayerGrowth = 0.25
StabilityRecoveryBase = 0.05
StabilityRecoveryPerRealm = 0.01
MaxCirculationStrength = 1.0
PulseChargeBase = 1.25
PulseChargePerRealm = 0.03
PulseChargeFloor = 0.9
PulseRecoveryBase = 0.75
PulseRecoveryPerRealm = 0.02
PulseRecoveryFloor = 0.5
AmbientCountBase = 3
AmbientCountPerRealm = 2
AmbientCountLayerDivisor = 3
AmbientSpawnIntervalBase = 4.0
AmbientSpawnIntervalPerRealm = 0.25
AmbientSpawnIntervalFloor = 2.0
ImpureFractionStart = 0.33
ImpureFractionPeak = 0.5
ImpureFractionPeakRealm = 6
ImpureFractionEnd = 0.3
MinorBreakthroughBase = 0.9
MinorBreakthroughPerLayer = 0.05
GenericNatureWeight = 1.0
UnlockedNatureWeight = 0.5
```


# Milestone 0 — Pre-plan (the report the Kickoff Message asks for before anything is created)

Charter: `docs/ASCENSION_CHARTER.md`. Decisions referenced as `D-NNNN` are in `docs/DECISIONS.md`.

## 1. Template
**Unreal Third Person template shape** (D-0002); the template's binary content is imported by the owner (OWNER_FIRST_RUN §1) because this container has no engine to generate it. The charter requires the template mannequins, template locomotion, and a seated pose derived from template animations (Sections 8, 10.1, 10.4). Blank would rebuild those for no gain. All of our assets live under `/Game/Ascension/`; the template's `/Game/Characters` is used read-only.

## 2. Engine version and plugins
- **Unreal Engine 5.8** (`EngineAssociation: "5.8"` in `Ascension.uproject`).
- Plugins enabled (all ship with the engine, D-0015): **Enhanced Input**, **Niagara**, **MetaSound**, **Control Rig**, **Python Editor Script Plugin** (editor-only, runs the one-time setup script), **Editor Scripting Utilities** (editor-only). Gameplay Tags is an engine module and is a `PublicDependencyModuleName`, not a plugin.
- Not enabled yet: Common UI, Gameplay Abilities. They are permitted by 2.1 and will be enabled only when a milestone needs them, with a DECISIONS entry.

## 3. Unreal MCP vs direct file generation
This session runs in a Claude Code remote container with **no Unreal Engine, no MCP, and no display** (D-0008). Therefore:
- **Direct file generation** for everything that is text: `Ascension.uproject`, `Config/*.ini` (engine, game, input, editor, gameplay tags), the whole `Source/` tree, the ladder CSV/JSON, `Content/Ascension/` folder structure, and all docs.
- **An in-editor Python script** (`Content/Python/ascension_m0_setup.py`) that the owner runs once to create the binary assets the repository cannot contain: `DA_RealmLadderConfig`, `DT_RealmLadder` (filled from `DT_RealmLadder.json`), `L_Test_Cultivation`, `WBP_DebugPanel` (F2) and `WBP_DebugOverlay` (F1) from their C++ bases, and the `IA_*`/`IMC_*` input assets.
- **Unreal MCP** is not used in Milestone 0. When the owner runs a session on a machine with the editor and MCP, MCP may take over editor operations (Blueprint edits, screenshots); file generation remains the path for code, config and data.

## 4. Folder and C++ class skeleton
Exactly as charter 11.1, plus the additions in D-0009 and D-0010. The full contract (file, class, base class, key members, includes) is `docs/SKELETON_M0.md`. Summary:

```
Ascension.uproject
Config/  DefaultEngine.ini  DefaultGame.ini  DefaultInput.ini  DefaultEditor.ini  DefaultGameplayTags.ini
Source/
  Ascension.Target.cs  AscensionEditor.Target.cs
  Ascension/                       (Runtime module)
    Ascension.Build.cs  Ascension.h/.cpp  AscensionLog.h/.cpp  AscensionGameplayTags.h/.cpp
    Cultivation/
      CultivationTypes.h           enums + shared structs (wisp state, modifier op, realm stage, event record)
      CultivationState.h/.cpp      UCultivationState
      CultivationSubsystem.h/.cpp  UCultivationSubsystem (owner of the state)            [D-0010]
      AuraComponent.h/.cpp         UAuraComponent
      QiFieldComponent.h/.cpp      UQiFieldComponent
      QiWisp.h/.cpp                AQiWisp (no Tick)
      QiPreset.h                   UDA_QiPreset
      Mantra.h/.cpp                UDA_Mantra, FMantraModifier, UMantraBehaviour
      Dao.h/.cpp                   UDA_Dao, FDaoNode, UDaoTechnique
      RealmLadder.h/.cpp           UDA_RealmLadderConfig, FRealmDefinition, FRealmLayerRow, URealmLadderLibrary (generator)
      Breakthrough.h/.cpp          Minor Breakthrough maths, seeded stream wrapper
      Tribulation.h/.cpp           UTribulationDefinition base, FSurgeEvent
      AutoCultivationController.h/.cpp
      ModifierStack.h/.cpp         UModifierStack + canonical property names
    Player/
      AscensionCharacter.h/.cpp  CultivationPawn.h/.cpp  AscensionPlayerController.h/.cpp
      AscensionGameMode.h/.cpp   AscensionSaveGame.h/.cpp  AscensionSettings.h/.cpp (UDeveloperSettings) [D-0010]
    UI/
      CultivationHUDWidget.h/.cpp  WorldHUDWidget.h/.cpp  DebugOverlayWidget.h/.cpp (F1)  DebugPanelWidget.h/.cpp (F2)
  AscensionEditor/                 (Editor module)                                        [D-0009]
    AscensionEditor.Build.cs  AscensionEditor.h/.cpp
    RealmLadderCommandlet.h/.cpp   URealmLadderCommandlet  (-run=RealmLadder)
    RealmLadderEditorLibrary.h/.cpp  URealmLadderEditorLibrary (Blutility entry point)
Content/
  Python/ascension_m0_setup.py
  Ascension/  Data/ (ladder config, DT_RealmLadder.csv/.json, QiPresets/, Mantras/, Daos/, Tribulations/)
              Blueprints/  Materials/  FX/  Audio/  UI/  Maps/  Animation/  Input/ (IA_/IMC_ assets, D-0027)
Tools/  Ladder/generate_realm_ladder.py   StubCompile/ (model test)
docs/   ASCENSION_CHARTER.md  KICKOFF.md  CHANGELOG.md  DECISIONS.md  SKELETON_M0.md  MILESTONE_0_PLAN.md  MILESTONE_0_REPORT.md  OWNER_FIRST_RUN.md  evidence/
```

## 5. Section 6.3 formula constants for `DA_RealmLadderConfig` and preview rows
| Constant | Value | Source |
|---|---|---|
| BaseReach / RealmGrowth / LayerGrowth | 800 / 1.9 / 0.06 | 6.3 |
| BaseCapacity / CapacityRealmGrowth / CapacityLayerGrowth | 10 / 3 / 0.1 | 6.3 |
| ReserveFraction | 0.6 | 6.3 |
| BaseProgress / ProgressRealmGrowth / ProgressLayerGrowth | 8 / 2.2 / 0.25 | 6.3 |
| StabilityRecoveryBase / PerRealm | 0.05 / 0.01 | 6.3 |
| MaxCirculationStrength | 1.0 | 6.3 |
| PulseChargeBase / PerRealm / Floor | 1.25 / 0.03 / 0.9 | 6.3, D-0003 |
| PulseRecoveryBase / PerRealm / Floor | 0.75 / 0.02 / 0.5 | 6.3, D-0003 |
| AmbientCountBase / PerRealm / LayerDivisor | 3 / 2 / 3 (floor) | 6.3, D-0012 |
| AmbientSpawnIntervalBase / PerRealm / Floor | 4.0 / 0.25 / 2.0 s | **unspecified**, D-0005 |
| ImpureFractionStart / Peak / PeakRealm / End | 0.33 / 0.5 / 6 / 0.30 | 6.3, D-0004 |
| MinorBreakthroughBase / PerLayer | 0.9 / 0.05 | 6.3 |
| GenericNatureWeight / UnlockedNatureWeight | 1.0 / 0.5 | **unspecified**, D-0006 |

Preview rows (from `python3 Tools/Ladder/generate_realm_ladder.py --preview`):

| Row | Reach | Capacity | Reserve | Progress | Stab/s | Charge | Recov | Wisps | Spawn | Impure | BT base |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1.1 | 800 | 10.0 | 6.0 | 8.0 | 0.06 | 1.25 | 0.75 | 5 | 4.00 | 0.33 | 0.90 |
| 1.9 | 1,184 | 18.0 | 10.8 | 24.0 | 0.06 | 1.25 | 0.75 | 8 | 4.00 | 0.33 | 0.50 |
| 2.1 | 1,520 | 30.0 | 18.0 | 17.6 | 0.07 | 1.22 | 0.73 | 7 | 3.75 | 0.36 | 0.90 |
| 4.1 | 5,487 | 270.0 | 162.0 | 85.2 | 0.09 | 1.16 | 0.69 | 11 | 3.25 | 0.43 | 0.90 |
| 7.1 | 37,637 | 7,290.0 | 4,374.0 | 907.0 | 0.12 | 1.07 | 0.63 | 17 | 2.50 | 0.43 | 0.90 |
| 9.9 | 201,085 | 118,098.0 | 70,858.8 | 13,170.2 | 0.14 | 1.01 | 0.59 | 24 | 2.00 | 0.30 | 0.50 |

These match the charter's own preview at 1.1, 1.9, 2.1, 4.1 and 7.1. At 9.9 the charter's formula gives ~201,000, not "beyond 250,000"; the constants were kept as written and the discrepancy is logged (D-0007) for the owner's Milestone 7 balance pass.

## 6. What cannot be implemented with the available tools, and the smallest substitute
| Charter requirement | Blocker here | Smallest substitute |
|---|---|---|
| "Project compiles and runs"; build log | No Unreal Build Tool | `Tools/StubCompile/` clang syntax check against stub headers (a **model test**, reported as such); real compile on the owner's machine, first-run checklist in `docs/OWNER_FIRST_RUN.md` |
| `DA_RealmLadderConfig`, `DT_RealmLadder` assets | No editor to author `.uasset` | Constants as C++ defaults on the class; 81 rows as committed CSV/JSON; `ascension_m0_setup.py` creates both assets and fills the table |
| `L_Test_Cultivation` with the F2 debug panel; screenshot | No editor | `UDebugPanelWidget` C++ base with every 11.5 function stubbed; the setup script creates the map, the widget Blueprint, and the F1/F2 bindings; the owner takes the screenshot |
| Gameplay Tag list evidence | none | `Config/DefaultGameplayTags.ini` (the tag list is text) plus native declarations in `AscensionGameplayTags.h` |
| Git "one commit" | none | Done on branch `claude/new-session-zyrmnu` |

## 7. Approval
The kickoff asks for approval of this plan before execution. This session is non-interactive, so execution proceeded on the branch under D-0016; nothing is merged. If any item above is rejected, the fix is a follow-up commit on the same branch, and Milestone 1 does not begin until the owner approves Milestone 0.

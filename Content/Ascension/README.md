# Content/Ascension — every project asset lives here

Charter Appendix C: *"Every asset lives under `/Game/Ascension/`. Nothing outside it except the template's `/Game/Characters` (read-only use) and `/Game/Input` (unused)."* This folder is `/Game/Ascension/` in the editor. Its layout is charter Section 11.1; the prefixes are Appendix C.

Binary assets (`.uasset`, `.umap`) are **not** authored in this repository's build container (D-0008). At Milestone 0 they are created in-editor by `Content/Python/ascension_m0_setup.py`; the text sources that feed them (`DT_RealmLadder.json` / `.csv`) are committed. Empty folders carry a `.gitkeep` so the structure exists before its first asset.

| Folder | What belongs here (charter ref) | Prefixes | First filled |
|---|---|---|---|
| `Data/` | `DA_RealmLadderConfig` (formula constants + nine `FRealmDefinition`s, 6.6) and `DT_RealmLadder` (81 generated rows, 6.1). The committed `DT_RealmLadder.json` and `.csv` are the generator's text output. | `DA_`, `DT_` | M0 |
| `Data/QiPresets/` | One `UDA_QiPreset` per (Condition, Nature) pair; a wisp reads every value from its preset and never branches on Condition or Nature (7.4, 7.5, 7.6). Adding a nature is adding a preset. | `DA_QiPreset_<Condition>_<Nature>` | M1 (Pure/Impure Generic) |
| `Data/Mantras/` | One `UDA_Mantra` per Mantra of table 9.2: modifier entries plus an optional `UMantraBehaviour` Blueprint subclass. | `DA_Mantra_<Name>` | M2/M3 (Basic, Stillness) |
| `Data/Daos/` | One `UDA_Dao` per Dao of table 9.4 with its 12–16 nodes; `UDaoTechnique` Blueprint subclasses may sit beside them. | `DA_Dao_<Name>`, `BP_Technique_<Name>` | M3 (Fire, Water) |
| `Data/Tribulations/` | Blueprint subclasses of `UTribulationDefinition`, one per Realm, holding the Appendix A surge lists. | `BP_Tribulation_<Name>` | M3 (Coalescence) |
| `Blueprints/` | `BP_` subclasses of the C++ classes that add meshes, components, VFX and sound hooks: `BP_CultivationPawn`, `BP_QiWisp`, `BP_AscensionCharacter`, `BP_AscensionPlayerController`, `BP_AscensionGameMode`, `BP_ResonanceStone`. Logic stays in C++; Blueprint is for presentation, timing and designer tuning (2.1, 11.1). | `BP_` | M1 |
| `Materials/` | `M_AuraField`, `M_AuraDomain` (Realm 7+), `M_QiWisp`, `M_Dantian`, `M_Bagua`, plus one `MI_` per Realm theme colour (10.3). Every field visual is driven by parameters set from code (`FlowPhase` is accumulated in code, never shader time). | `M_`, `MI_` | M1 |
| `FX/` | Niagara systems and emitters: absorption, rejection, breakthrough, tribulation surges, the Domain. Pooled; never thousands of Qi actors (2.2, 11.4). | `NS_`, `NE_` | M1 |
| `Audio/` | MetaSounds only, procedural, no imported files: circulation drone, charge tension, release whoosh, absorption chime, breakthrough chord, tribulation bell, backlash crack, realm swell (10.5). | `MS_` | M1 |
| `UI/` | UMG Widget Blueprints on their C++ bases: `WBP_DebugPanel` (`UDebugPanelWidget`, F2, 11.5), `WBP_DebugOverlay` (`UDebugOverlayWidget`, F1, 10.6), later `WBP_CultivationHUD`, `WBP_WorldHUD`, `WBP_CultivationMenu` and its pages (10.6). | `WBP_` | M0 (debug), M1 (HUD) |
| `Maps/` | `L_Test_Cultivation` (the debug map with the F2 panel; every milestone is verified here, 11.5), later `L_World` (the mountain shelf, 10.1) and `L_CultivationSpace` (10.2). | `L_` | M0 |
| `Animation/` | The seated meditation pose and its Control Rig (10.4): `A_`/`AS_` animation assets derived from the template idle or crouch, `CR_` rigs. Never a capsule. | `A_`, `AS_`, `CR_` | M1 |
| `Input/` | Enhanced Input assets: `IA_Circulate_CW`, `IA_Circulate_CCW`, `IA_Pulse`, `IA_LayerModifier`, `IA_Breakthrough`, `IA_AutoCultivate`, `IA_Technique_1..4`, `IA_ExitMeditation`, `IA_EnterMeditation`, `IA_Menu`, `IA_DebugOverlay`, `IA_DebugPanel`; `IMC_Cultivation` (active only in meditation) and `IMC_World` (Section 8). Rebinding is a data edit; no code checks a key. | `IA_`, `IMC_` | M0 |

## Conventions that apply to everything here
- Gameplay Tags root `Ascension.` (`System`, `Qi.Condition`, `Qi.Nature`, `State`, `Event`, `Mantra`, `Dao`, `Resonance`, `Scar`); the list is `Config/DefaultGameplayTags.ini` and `Source/Ascension/AscensionGameplayTags.h`.
- The word **"Law"** is never a progression term; the Qi resource is never called **mana**, **energy** or **MP** in any user-facing text (2.2).
- Every gameplay number is a ladder-row field or a `ModifierStack` property; no asset hardcodes a per-Layer number (6.6, 11.1).
- New Realms, natures, Mantras and Dao nodes are rows and assets, not new Blueprint logic (design principle 9).
- The template's `/Game/Characters` (mannequins, animations) is used read-only; nothing of ours is saved there.

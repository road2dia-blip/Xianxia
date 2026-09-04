# Owner first run — materialising Milestone 0 on a machine with Unreal Engine 5.8

The build container that authored this repository has no Unreal Engine (D-0008), so it could produce every text artefact (code, config, ladder rows, docs) but none of the binary ones (`.uasset`, `.umap`) and no compile evidence. This checklist is what **you** run once so that Milestone 0's exit criteria ("Project compiles and runs. Ladder table exists with 81 rows. Debug panel opens.") can be verified and evidenced (charter 12, 14.1).

Nothing below downloads anything. Everything uses the engine and this repository (charter 2.2).

Estimated time: 20–40 minutes, most of it the first C++ build.

---

## 0. Prerequisites
- Windows 10/11, **Unreal Engine 5.8** installed from the Epic Games Launcher, **Visual Studio 2022** with the "Game development with C++" workload (or the toolchain UE 5.8 lists as supported).
- This repository cloned, on branch `claude/new-session-zyrmnu` (Milestone 0 is not merged until you approve it).

## 1. Template content (optional at Milestone 0, required before Milestone 1)
The project is a Third Person template project by decision D-0002, but the template's binary content (mannequins, animations, `IA_Move`/`IA_Look`/`IA_Jump`, `IMC_Default`) cannot live in this repository. Nothing in Milestone 0 uses them; Milestone 1 (seated mannequin, template locomotion) does.

When you want them: in the Launcher create a throwaway **Third Person, C++** project on 5.8 anywhere, then copy its `Content/Characters`, `Content/ThirdPerson`, `Content/LevelPrototyping` and `Content/Input` folders into this repository's `Content/`. Copy **only** those content folders. Do not copy its `Source/`, `Config/` or `.uproject`. Those folders are read-only inputs (Appendix C).

## 2. Generate project files and build the Editor target
1. Right-click `Ascension.uproject` → **Generate Visual Studio project files**. If Windows asks which engine, pick 5.8.
2. Open `Ascension.sln`. Configuration **Development Editor**, platform **Win64**, startup project **Ascension**. Build (Ctrl+Shift+B). This builds both modules: `Ascension` (runtime) and `AscensionEditor` (the ladder commandlet and editor library, D-0009).
   - Alternative without the IDE: double-click `Ascension.uproject`; when the editor says the modules are missing or out of date, choose **Yes** to rebuild.
3. **Keep the build output.** Copy the tail of the Output window (the `------ Build ------` summary, every warning, every error) into `docs/MILESTONE_0_REPORT.md` under COMPILE, and save the whole thing as `docs/evidence/M0_build_log.txt`.
4. If the build fails: the code was written for UE 5.8 from API knowledge without a compiler (the only check was `Tools/StubCompile/`, a model test). Paste the first error verbatim into the next Claude session; the fix is a follow-up commit on the same branch (charter 14.2 rule 7).

## 3. Open the project
1. Launch `Ascension.uproject` (from the IDE with F5, or double-click).
2. If the editor prompts to enable **Python Editor Script Plugin** or **Editor Scripting Utilities**, accept (they are already listed in the `.uproject`; the prompt appears only if a plugin was disabled locally). A restart may follow.
3. The startup map is `/Game/Ascension/Maps/L_Test_Cultivation`, which does not exist yet: the editor will open an empty default level and log a warning. That is expected until step 4.
4. **Edit → Project Settings → Plugins → Python** (or search "Python"): confirm `Content/Python` is listed under Additional Paths and **Developer Mode** is on (both are in `Config/DefaultEngine.ini`).

## 4. Run the setup script (creates the binary assets)
1. **Window → Output Log**. At the bottom, change the command-line dropdown from **Cmd** to **Python**.
2. Run:
   ```
   py ascension_m0_setup.py
   ```
   The bare filename works because the plugin puts `<Project>/Content/Python` on `sys.path`. A path relative to the project folder does **not** resolve (the editor's working directory is `Engine/Binaries/Win64`). If the bare name reports "file not found", use the absolute path: `py "C:\<full path>\Ascension\Content\Python\ascension_m0_setup.py"`.
3. Read the `[Ascension M0] SUMMARY` block at the end. It lists what was **Created**, what **Already existed**, what **Failed**, and every **MANUAL STEP**. Save the whole script output as `docs/evidence/M0_setup_script_log.txt`.
4. The script is idempotent and never deletes: if anything failed, fix the cause (usually "build the C++ first") and run it again.

### Possible MANUAL STEP lines and what to do
The script wraps every editor API call it could not verify against a 5.8 editor in `try/except`. These are the lines it can emit; most will not appear.

| Line contains | Meaning | What to do |
|---|---|---|
| `<N>. <step> did not complete; see the error above` | A whole step threw before finishing (the generic line every failed step emits); the traceback is printed just above it. | Read the traceback, fix the cause (usually "build the C++ first" or a disabled plugin), and re-run the script; it skips what already exists. |
| `unreal.<Class> is not available` | The class is not exposed in this editor. For this project's classes (`DA_RealmLadderConfig`, `RealmLayerRow`, `DebugPanelWidget`, `DebugOverlayWidget`, `AscensionSettings`) the C++ is not compiled; for engine classes (`InputAction`, `InputMappingContext`, `WidgetBlueprintFactory`, `WidgetBlueprint`) the line names the plugin or module to enable. | Finish step 2 (or enable the named plugin), restart the editor, re-run the script. |
| `...DT_RealmLadder.json not found` | The generated rows are missing from `Content/Ascension/Data/`. | Run `python3 Tools/Ladder/generate_realm_ladder.py` from the repo root (any Python 3), or skip to step 5 (the commandlet fills the table without the JSON). |
| `fill_data_table_from_json_string reported failure` | The table exists but the JSON import failed. | Run the commandlet in step 5; it regenerates the rows from the Data Asset. |
| `... has N rows after import, expected 81` | Import produced the wrong count. | Step 5. |
| `Set /Game/Ascension/Input/IA_... Value Type to BOOLEAN` | The action asset exists but its value type could not be set. | Open the asset, set **Value Type = Digital (bool)**, save. |
| `Create Input Action IA_... by hand under /Game/Ascension/Input` | One action asset could not be created; the others were still attempted. | Right-click in `/Game/Ascension/Input` → Input → Input Action, name it as shown, Value Type Digital (bool), save; re-run the script so the mapping step picks it up. |
| `Create IMC_... by hand under /Game/Ascension/Input and add its charter Section 8 mappings` | One mapping context could not be created; the other was still attempted. | Right-click → Input → Input Mapping Context, name it as shown, add the (action, key) pairs listed in `IMC_BINDINGS` at the top of the script (charter Section 8), save. |
| `Map key <Key> to <Action> in IMC_...` | A key mapping could not be added by script. | Open the mapping context, add the mapping shown, save. The full table is in charter Section 8 and at the top of the script. |
| `Map <Key> -> <Action> in IMC_... (the action asset is missing)` | The IA asset was not created. | Re-run the script after the IA step succeeds, or create the Input Action by hand under `/Game/Ascension/Input`. |
| `new_level(...) failed` / `Could not load ...` | The map could not be created or loaded. | File → New Level → **Empty Level**, save as `/Game/Ascension/Maps/L_Test_Cultivation`, add a Plane (scale 40×40), a Directional Light, a Sky Light and a Player Start. |
| `Place a <Class> named '<Label>'` / `Finish configuring '<Label>'` | One placeholder actor could not be spawned or configured. | Add it by hand: Floor (Plane, scale 40,40,1), KeyLight (Directional Light), SkyFill (Sky Light), PlayerStart, M0_Note (Note actor). |
| `Save ... by hand` | An asset or the level could not be saved by script. | **File → Save All**. |
| `Project Settings > Game > Ascension: set ...` | The settings CDO could not be written from Python. | Nothing is lost: `Config/DefaultGame.ini` already holds every soft reference (D-0010, D-0021). Open **Project Settings → Game → Ascension** and confirm Ladder Config, Ladder Table, the four Input references (World/Cultivation Mapping Context, Debug Overlay/Panel Action), Debug Overlay Class and Debug Panel Class are filled. |
| `File > Save All to persist anything still dirty` | The final save sweep failed. | **File → Save All**. |

## 5. Run the ladder commandlet (regenerates the 81 rows in-engine from the Data Asset)
Close the editor first (the commandlet saves `DT_RealmLadder.uasset`, and an open editor holds the file). From a **Command Prompt**:
```
"C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" "<full path>\Ascension.uproject" -run=RealmLadder -unattended -nopause -stdout -FullStdOutLogOutput
```
Optional switches: `-Config=/Game/Ascension/Data/DA_RealmLadderConfig` and `-Table=/Game/Ascension/Data/DT_RealmLadder` (these are the defaults), `-NoSave` (dry run).

Expected output: a `LogAscension` line per row (`R1L1 ... R9L9`, 81 lines, each printed by `URealmLadderLibrary::RowToString`), then `... 81 rows written ...`, `SaveTablePackage: saved ...`, `RealmLadder commandlet: done.` and exit code 0. The commandlet **never creates** `DA_RealmLadderConfig`; if it reports `LoadConfigAsset: ... not found`, step 4 did not complete.

Save the console output as `docs/evidence/M0_commandlet_log.txt`. The 81 rows should be identical to `Content/Ascension/Data/DT_RealmLadder.json` and to the table in `docs/CHANGELOG.md` (the offline generator and the in-engine generator use the same constants and the same rounding; a difference is a bug to report).

## 6. Verify the ladder table
1. Reopen the editor. Content Browser → `/Game/Ascension/Data/DT_RealmLadder`. Open it.
2. Confirm **81 rows** named `R1L1` … `R9L9`, and spot-check against the charter's preview: `R1L1` AuraReach 800, `R1L9` 1184, `R2L1` 1520, `R4L1` 5487, `R7L1` 37637 (the charter's 9.9 prose figure differs from its own formula; see D-0007).
3. Screenshot the open table → `docs/evidence/M0_ladder_table.png`.
4. Open `/Game/Ascension/Data/DA_RealmLadderConfig` and confirm the nine Realms are filled (Qi Sensing … Ascension) and the constants match `docs/MILESTONE_0_PLAN.md` §5. Screenshot → `docs/evidence/M0_ladder_config.png`.

## 7. Open the test map, press Play, press F2
1. Open `/Game/Ascension/Maps/L_Test_Cultivation`. You should see the floor, the light, the Player Start and the Milestone 0 note.
2. **Play** (PIE). The game mode is `AscensionGameMode` (`Config/DefaultEngine.ini`).
3. Press **F2**. `IA_DebugPanel` is mapped in both contexts; at Milestone 0 the C++ `AscensionPlayerController` loads `IMC_World`, `IMC_Cultivation`, `IA_DebugOverlay` and `IA_DebugPanel` from **Project Settings → Game → Ascension → Input** (`Config/DefaultGame.ini`; D-0021) because no Blueprint controller exists yet, and creates `WBP_DebugPanel` from **Project Settings → Game → Ascension → Debug Panel Class**. Screenshot the panel → `docs/evidence/M0_debug_panel.png`.
   - If F2 does nothing and the Output Log shows `IMC_World could not be added` or `... failed to load`, check that step 4 created the four input assets under `/Game/Ascension/Input` and that the four Input references in **Project Settings → Game → Ascension** point at them. As a fallback, create `BP_AscensionPlayerController` (parent `AscensionPlayerController`) under `/Game/Ascension/Blueprints`, assign `IMC_World`, `IMC_Cultivation`, `IA_DebugOverlay`, `IA_DebugPanel` on it, create `BP_AscensionGameMode` (parent `AscensionGameMode`) with that controller class, and set **World Settings → GameMode Override** on `L_Test_Cultivation`; say so in the report (these Blueprints are otherwise Milestone 1 work).
   - At Milestone 0 the panel is a **skeleton**: the widget exists on its C++ base (`UDebugPanelWidget`, one function per charter 11.5 item) but has no designed layout yet. If the panel opens empty or does not open, open `/Game/Ascension/UI/WBP_DebugPanel` in the Widget editor, confirm its parent class is `DebugPanelWidget` (File → Reparent Blueprint shows it) and that the **Functions** list in the Blueprint editor shows `SetRealmLayer`, `SetStability`, `SetPurity`, `SpawnWispPreset`, `TriggerTribulation`, `GrantInsight`, `ForceBreakthrough`, `ToggleAuto`, `RunDeterminismSequence`, `PrintModifierStack`. Screenshot that instead and say so in the report: it is the honest Milestone 0 evidence.
4. Press **F1** for the debug overlay (`WBP_DebugOverlay`) and screenshot it if it shows anything → `docs/evidence/M0_debug_overlay.png`.
5. Stop PIE. Note any red lines in the Output Log (Blueprint compile errors, missing assets) for the report.

## 8. Gameplay Tag list evidence
**Edit → Project Settings → Project → Gameplay Tags → Manage Gameplay Tags**. Expand `Ascension`. Every tag in `Config/DefaultGameplayTags.ini` should be present (System, Qi.Condition, Qi.Nature, State, Event, Mantra, Dao, Resonance, Scar). Screenshot → `docs/evidence/M0_tag_list.png`. Any "invalid tag" warning in the Output Log at startup goes in the report.

## 9. Fill in the Milestone 0 report
`docs/MILESTONE_0_REPORT.md` follows the charter 14.1 format and will say what was and was not verified in the container (it is written with `docs/CHANGELOG.md` before the Milestone 0 commit). Replace the placeholders:
- **COMPILE**: paste the build summary from step 2 (the `Build succeeded` line, every warning, and the module names).
- **TESTS**: the commandlet's `81 rows written` line and the row count you saw in step 6.
- **SCREENSHOTS**: the filenames you saved under `docs/evidence/` (`M0_build_log.txt`, `M0_setup_script_log.txt`, `M0_commandlet_log.txt`, `M0_ladder_table.png`, `M0_ladder_config.png`, `M0_debug_panel.png`, `M0_debug_overlay.png`, `M0_tag_list.png`).
- **WARNINGS**: anything yellow or red from steps 2–8.
- **LIMITATIONS**: every MANUAL STEP line that still applies.

Commit the evidence and the edited report on the same branch (`git add docs/ && git commit -m "Milestone 0: owner verification evidence"`). Do not force-push.

## 10. Approve or reject Milestone 0
Milestone 1 does not begin until you say so (charter 12; `docs/CHANGELOG.md` records the approval state). If anything above failed, report the exact line; the fix is a follow-up commit on this branch, not a rewrite.

---

### What this checklist deliberately does not do
- It does not create the aura, the wisps, the Cultivation Space, the HUD, or the seated mannequin. Those are Milestone 1 and would be pulling work forward (charter 12).
- It does not touch `/Game/Characters` or anything outside `/Game/Ascension/` (Appendix C).
- It does not run any OS-level automation; every step is you in the editor (charter 14.2 rule 1).

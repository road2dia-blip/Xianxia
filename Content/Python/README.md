# Content/Python — editor scripts

Scripts here run inside the Unreal Editor through the **Python Editor Script Plugin** (ships with the engine; enabled in `Ascension.uproject`, D-0015). `Config/DefaultEngine.ini` adds this folder to the plugin's `AdditionalPaths`, so `import ascension_m0_setup` also works from the Python console.

| Script | Purpose | When |
|---|---|---|
| `ascension_m0_setup.py` | Creates the Milestone 0 binary assets the repository cannot contain: `DA_RealmLadderConfig`, `DT_RealmLadder` (81 rows from `Content/Ascension/Data/DT_RealmLadder.json`), the `IA_*` / `IMC_*` input assets with the charter Section 8 default keys, `WBP_DebugPanel` (F2) and `WBP_DebugOverlay` (F1) on their C++ bases, and `L_Test_Cultivation`. | Once, after the first successful build of the `AscensionEditor` target. Safe to re-run. |

## Running `ascension_m0_setup.py`
1. Build the project (the script needs the C++ classes `DA_RealmLadderConfig`, `RealmLayerRow`, `DebugPanelWidget`, `DebugOverlayWidget`, `AscensionSettings` to exist in the editor).
2. Open the project in Unreal Editor 5.8.
3. **Output Log** → change the command-line dropdown from `Cmd` to `Python` → run:
   ```
   py Content/Python/ascension_m0_setup.py
   ```
   (relative to the project folder; an absolute path also works). Or, from **Tools → Python console**: `exec(open(r"<project>/Content/Python/ascension_m0_setup.py").read())`.
4. Read the `[Ascension M0] SUMMARY` block at the end of the log. Every `MANUAL STEP` line is something the API could not do on this machine; `docs/OWNER_FIRST_RUN.md` lists the possible ones and what to do for each.

## Rules these scripts follow (charter 14.2)
- **Check before create.** Every asset is tested with `EditorAssetLibrary.does_asset_exist` first; existing assets are loaded and left as they are. Mapping contexts only add (action, key) pairs that are not already present.
- **Never delete.** Nothing is removed, renamed, or overwritten. The only "refill" is `DT_RealmLadder` when it does not already hold exactly 81 rows, and those rows are generated data, never authored.
- **Never stop on error.** Every step is wrapped in `try/except`; failures are logged with a traceback and turned into `MANUAL STEP` lines, and the next step runs.
- **Engine only.** No downloads, no third-party modules; only the `unreal` module and the Python standard library.

## The ladder has two generators, one source of truth
- `Tools/Ladder/generate_realm_ladder.py` (offline, no engine) writes `DT_RealmLadder.json`/`.csv` from constants that mirror `DA_RealmLadderConfig`.
- `URealmLadderCommandlet` (`UnrealEditor-Cmd.exe <project> -run=RealmLadder`) and `URealmLadderEditorLibrary::RegenerateLadderTable` (callable from an Editor Utility Widget or Python: `unreal.RealmLadderEditorLibrary.regenerate_ladder_table(config, table, True)`) regenerate the table **in-engine from the Data Asset**. After the setup script has created both assets, the commandlet is the authoritative path: edit the constant in `DA_RealmLadderConfig`, run the commandlet, mirror the constant in the offline script.

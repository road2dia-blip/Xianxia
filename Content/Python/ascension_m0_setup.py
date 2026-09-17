"""
Project Ascension -- Milestone 0 one-time editor setup (D-0008; contract docs/SKELETON_M0.md
"Content/Python/ascension_m0_setup.py").

Creates the binary assets this repository cannot contain, using only the engine's own Python API:

  /Game/Ascension/Data/DA_RealmLadderConfig     Primary Data Asset (class DA_RealmLadderConfig; constants from C++ defaults)
  /Game/Ascension/Data/DT_RealmLadder           Data Table (row struct RealmLayerRow), 81 rows from DT_RealmLadder.json
  /Game/Ascension/Input/IA_*                     the charter Section 8 input actions
  /Game/Ascension/Input/IMC_World, IMC_Cultivation   mapping contexts with the charter's default keys
  /Game/Ascension/UI/WBP_DebugPanel, WBP_DebugOverlay   Widget Blueprints on the C++ bases (F2 / F1)
  /Game/Ascension/Maps/L_Test_Cultivation        a level with a floor, a light, a player start and a note

Rules (charter 14.2 rule 2): every step checks for the asset before creating it, so the script can be re-run
after any failure. The script NEVER deletes anything. Every step is wrapped in try/except; anything the API
could not do is printed as a "MANUAL STEP" line and collected into the summary at the end.

Run it once from the Unreal Editor (5.8, Python Editor Script Plugin enabled), either way:
    Output Log, command line left on "Cmd"        ->  py ascension_m0_setup.py
    Output Log, command line switched to "Python" ->  ascension_m0_setup.py          (file mode: no "py" prefix)
("py" is the Cmd-mode console command; in Python mode the line itself is run, and a first token ending in ".py" runs
as a file.) The bare filename resolves because the plugin puts <Project>/Content/Python on sys.path. A path relative
to the project folder does NOT resolve (the editor's working directory is Engine/Binaries/Win64); if the bare name
fails, use the absolute path:  py "C:\<full path>\Ascension\Content\Python\ascension_m0_setup.py"
or from the Python console:
    exec(open(r"<project>/Content/Python/ascension_m0_setup.py").read())
"""

import json
import os
import traceback

import unreal

TAG = "[Ascension M0]"

DATA_PATH = "/Game/Ascension/Data"
INPUT_PATH = "/Game/Ascension/Input"
UI_PATH = "/Game/Ascension/UI"
MAPS_PATH = "/Game/Ascension/Maps"

LADDER_CONFIG_NAME = "DA_RealmLadderConfig"
LADDER_TABLE_NAME = "DT_RealmLadder"
LADDER_JSON_RELATIVE = os.path.join("Ascension", "Data", "DT_RealmLadder.json")  # under Content/
EXPECTED_ROWS = 81  # charter 6.1

# Charter Section 8. (name, value type name). Every action here is a button. IA_Move/IA_Look/IA_Jump are the template's own
# assets and are NOT created here: Milestone 1 references them from the template's input folder, never copies them
# (D-0027, D-0055, D-0059).
INPUT_ACTIONS = [
    ("IA_Circulate_CW", "BOOLEAN"),
    ("IA_Circulate_CCW", "BOOLEAN"),
    ("IA_Pulse", "BOOLEAN"),
    ("IA_LayerModifier", "BOOLEAN"),
    ("IA_Breakthrough", "BOOLEAN"),
    ("IA_AutoCultivate", "BOOLEAN"),
    ("IA_Technique_1", "BOOLEAN"),
    ("IA_Technique_2", "BOOLEAN"),
    ("IA_Technique_3", "BOOLEAN"),
    ("IA_Technique_4", "BOOLEAN"),
    ("IA_ExitMeditation", "BOOLEAN"),
    ("IA_EnterMeditation", "BOOLEAN"),
    ("IA_Menu", "BOOLEAN"),
    ("IA_DebugOverlay", "BOOLEAN"),
    ("IA_DebugPanel", "BOOLEAN"),
]

# Charter Section 8 default keys (FKey names). Technique 1-4, Menu (Tab and I; Tab is eaten by Slate in PIE), and the
# F1/F2 debug toggles are in both contexts; the cultivation-only and world-only actions are split as the table says.
IMC_BINDINGS = {
    "IMC_Cultivation": [
        ("IA_Circulate_CW", "Q"),
        ("IA_Circulate_CCW", "E"),
        ("IA_Pulse", "LeftShift"),
        ("IA_LayerModifier", "LeftControl"),
        ("IA_Breakthrough", "B"),
        ("IA_AutoCultivate", "X"),
        ("IA_Technique_1", "One"),
        ("IA_Technique_2", "Two"),
        ("IA_Technique_3", "Three"),
        ("IA_Technique_4", "Four"),
        ("IA_ExitMeditation", "M"),
        ("IA_Menu", "Tab"),
        ("IA_Menu", "I"),
        ("IA_DebugOverlay", "F1"),
        ("IA_DebugPanel", "F2"),
    ],
    "IMC_World": [
        ("IA_EnterMeditation", "M"),
        ("IA_Technique_1", "One"),
        ("IA_Technique_2", "Two"),
        ("IA_Technique_3", "Three"),
        ("IA_Technique_4", "Four"),
        ("IA_Menu", "Tab"),
        ("IA_Menu", "I"),
        ("IA_DebugOverlay", "F1"),
        ("IA_DebugPanel", "F2"),
    ],
}

# (asset name, C++ parent class name as exposed to Python, i.e. without the U prefix)
WIDGET_BLUEPRINTS = [
    ("WBP_DebugPanel", "DebugPanelWidget"),
    ("WBP_DebugOverlay", "DebugOverlayWidget"),
]

TEST_LEVEL_NAME = "L_Test_Cultivation"
TEST_LEVEL_NOTE = (
    "Project Ascension - L_Test_Cultivation (charter 11.5). Milestone 0: floor, light, player start, F2 debug panel "
    "skeleton. BP_CultivationPawn, the aura, and the Cultivation Space arrive in Milestone 1."
)


# ---------------------------------------------------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------------------------------------------------
class Report:
    def __init__(self):
        self.created = []
        self.existed = []
        self.failed = []
        self.manual = []

    def log(self, msg):
        unreal.log("{} {}".format(TAG, msg))

    def warn(self, msg):
        unreal.log_warning("{} {}".format(TAG, msg))

    def error(self, msg):
        unreal.log_error("{} {}".format(TAG, msg))

    def manual_step(self, msg):
        self.manual.append(msg)
        unreal.log_warning("{} MANUAL STEP: {}".format(TAG, msg))

    def summary(self):
        lines = []
        lines.append("=" * 100)
        lines.append("{} SUMMARY".format(TAG))
        lines.append("  Created ({}):".format(len(self.created)))
        for c in self.created:
            lines.append("    + {}".format(c))
        lines.append("  Already existed, left untouched ({}):".format(len(self.existed)))
        for e in self.existed:
            lines.append("    = {}".format(e))
        lines.append("  Failed ({}):".format(len(self.failed)))
        for f in self.failed:
            lines.append("    ! {}".format(f))
        lines.append("  MANUAL STEPS ({}):".format(len(self.manual)))
        for m in self.manual:
            lines.append("    > {}".format(m))
        lines.append("  Nothing was deleted. Re-running this script is safe.")
        lines.append("  Next: docs/OWNER_FIRST_RUN.md steps 5-9 (commandlet, verify 81 rows, Play, F2, screenshots).")
        lines.append("=" * 100)
        for line in lines:
            unreal.log(line)


R = Report()


def guarded(step_name):
    """Decorator: run a step, never let an exception stop the script."""
    def wrap(fn):
        def inner(*args, **kwargs):
            R.log("---- {} ----".format(step_name))
            try:
                return fn(*args, **kwargs)
            except Exception as exc:  # noqa: BLE001 - we want every failure reported, not raised
                R.failed.append("{}: {}".format(step_name, exc))
                R.error("{} failed: {}".format(step_name, exc))
                R.error(traceback.format_exc())
                R.manual_step("{} did not complete; see the error above and finish it by hand.".format(step_name))
                return None
        return inner
    return wrap


# ---------------------------------------------------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------------------------------------------------
def asset_exists(path):
    return unreal.EditorAssetLibrary.does_asset_exist(path)


def ensure_directory(path):
    try:
        if not unreal.EditorAssetLibrary.does_directory_exist(path):
            unreal.EditorAssetLibrary.make_directory(path)
            R.log("Created content folder {}".format(path))
    except Exception as exc:  # noqa: BLE001
        R.warn("Could not ensure folder {}: {} (create_asset will create it on demand)".format(path, exc))


def python_class(name, hint=None):
    """unreal.<name>, or None (logged) when the class is not exposed in this editor.

    The default hint covers this project's own C++ classes (they must be compiled first); pass a hint for engine or
    plugin classes, where the cause is a disabled plugin or an unloaded editor module, not a build.
    """
    cls = getattr(unreal, name, None)
    if cls is None:
        if hint is None:
            hint = "Build the AscensionEditor target (C++ classes must be compiled before this step)"
        R.manual_step("unreal.{} is not available. {} and re-run the script.".format(name, hint))
    return cls


def create_asset(name, package_path, asset_class, factory):
    tools = unreal.AssetToolsHelpers.get_asset_tools()
    asset = tools.create_asset(asset_name=name, package_path=package_path, asset_class=asset_class, factory=factory)
    if asset is None:
        raise RuntimeError("create_asset returned None for {}/{}".format(package_path, name))
    return asset


def save_asset(path):
    try:
        unreal.EditorAssetLibrary.save_asset(path, only_if_is_dirty=False)
    except Exception as exc:  # noqa: BLE001
        R.manual_step("Save {} by hand (File > Save All): {}".format(path, exc))


def load_asset(path):
    return unreal.EditorAssetLibrary.load_asset(path)


def make_key(key_name):
    """An FKey from its name. Tries the struct initialiser first, then the property setter."""
    try:
        return unreal.Key(key_name=key_name)
    except Exception:  # noqa: BLE001
        key = unreal.Key()
        key.set_editor_property("key_name", key_name)
        return key


def ladder_json_path():
    # project_content_dir() may be engine-relative ("../../../Ascension/Content/"); make it absolute before joining so
    # the result does not depend on Python's current working directory.
    content_dir = unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_content_dir())
    return os.path.normpath(os.path.join(content_dir, LADDER_JSON_RELATIVE))


# ---------------------------------------------------------------------------------------------------------------------
# Steps
# ---------------------------------------------------------------------------------------------------------------------
@guarded("1. DA_RealmLadderConfig")
def step_ladder_config():
    path = "{}/{}".format(DATA_PATH, LADDER_CONFIG_NAME)
    if asset_exists(path):
        R.existed.append(path)
        R.log("{} exists.".format(path))
        return load_asset(path)

    cls = python_class("DA_RealmLadderConfig")
    if cls is None:
        return None
    ensure_directory(DATA_PATH)
    factory = unreal.DataAssetFactory()
    factory.set_editor_property("data_asset_class", cls)
    asset = create_asset(LADDER_CONFIG_NAME, DATA_PATH, cls, factory)
    save_asset(path)
    R.created.append(path)
    R.log("Created {} (constants and the nine Realms come from the C++ constructor).".format(path))
    return asset


@guarded("2. DT_RealmLadder")
def step_ladder_table():
    path = "{}/{}".format(DATA_PATH, LADDER_TABLE_NAME)
    row_struct_cls = python_class("RealmLayerRow")
    if row_struct_cls is None:
        return None

    table = None
    if asset_exists(path):
        R.existed.append(path)
        R.log("{} exists.".format(path))
        table = load_asset(path)
    else:
        ensure_directory(DATA_PATH)
        factory = unreal.DataTableFactory()
        factory.set_editor_property("struct", row_struct_cls.static_struct())
        table = create_asset(LADDER_TABLE_NAME, DATA_PATH, unreal.DataTable, factory)
        R.created.append(path)
        R.log("Created {} with row struct RealmLayerRow.".format(path))

    # Fill (idempotent: a table that already holds the 81 rows is left alone).
    try:
        row_names = list(unreal.DataTableFunctionLibrary.get_data_table_row_names(table))
    except Exception as exc:  # noqa: BLE001
        R.warn("Could not read row names of {}: {}".format(path, exc))
        row_names = []

    if len(row_names) == EXPECTED_ROWS:
        R.log("{} already holds {} rows; not refilled.".format(path, EXPECTED_ROWS))
        return table

    json_file = ladder_json_path()
    if not os.path.isfile(json_file):
        R.manual_step("{} not found. Run 'python3 Tools/Ladder/generate_realm_ladder.py' (or the commandlet "
                      "-run=RealmLadder) to produce the rows, then re-run this script.".format(json_file))
        return table

    with open(json_file, "r", encoding="utf-8") as handle:
        json_text = handle.read()

    if row_names:
        R.warn("{} holds {} rows (expected {}); refilling from JSON. Rows are generated data, not authored.".format(
            path, len(row_names), EXPECTED_ROWS))

    ok = unreal.DataTableFunctionLibrary.fill_data_table_from_json_string(table, json_text)
    if not ok:
        R.manual_step("fill_data_table_from_json_string reported failure for {}. Either right-click the table > "
                      "Reimport from {} or run the commandlet: UnrealEditor-Cmd.exe <project> -run=RealmLadder".format(
                          path, json_file))
        return table

    row_names = list(unreal.DataTableFunctionLibrary.get_data_table_row_names(table))
    if len(row_names) != EXPECTED_ROWS:
        R.manual_step("{} has {} rows after import, expected {}. Run the commandlet -run=RealmLadder.".format(
            path, len(row_names), EXPECTED_ROWS))
    else:
        R.log("{} filled with {} rows from {}.".format(path, len(row_names), json_file))
    save_asset(path)
    return table


@guarded("3. Input actions")
def step_input_actions():
    ia_cls = python_class("InputAction", hint="Enable the Enhanced Input plugin (Edit > Plugins)")
    if ia_cls is None:
        return {}
    ensure_directory(INPUT_PATH)

    factory_cls = getattr(unreal, "InputActionFactory", None)
    if factory_cls is None:
        R.log("unreal.InputActionFactory not exposed in this build; creating InputAction assets with no factory "
              "(NewObject path). This is a supported fallback, not an error.")

    actions = {}
    for name, value_type_name in INPUT_ACTIONS:
        path = "{}/{}".format(INPUT_PATH, name)
        if asset_exists(path):
            R.existed.append(path)
            actions[name] = load_asset(path)
            continue

        # Per-action guard: one failing asset must not abort the remaining actions (they would all become MANUAL STEPs in step 4).
        try:
            asset = None
            if factory_cls is not None:
                try:
                    asset = create_asset(name, INPUT_PATH, ia_cls, factory_cls())
                except Exception as exc:  # noqa: BLE001
                    R.warn("InputActionFactory failed for {} ({}); retrying without a factory.".format(name, exc))
            if asset is None:
                asset = create_asset(name, INPUT_PATH, ia_cls, None)

            try:
                value_type = getattr(unreal.InputActionValueType, value_type_name)
                asset.set_editor_property("value_type", value_type)
            except Exception as exc:  # noqa: BLE001
                R.manual_step("Set {} Value Type to {} in the asset editor: {}".format(path, value_type_name, exc))

            save_asset(path)
            actions[name] = asset
            R.created.append(path)
        except Exception as exc:  # noqa: BLE001
            R.failed.append("{}: {}".format(path, exc))
            R.manual_step("Create Input Action {} by hand under {} (Value Type Digital/bool): {}".format(name, INPUT_PATH, exc))
            continue
    R.log("{} input actions present.".format(len(actions)))
    return actions


@guarded("4. Input mapping contexts")
def step_mapping_contexts(actions):
    imc_cls = python_class("InputMappingContext", hint="Enable the Enhanced Input plugin (Edit > Plugins)")
    if imc_cls is None:
        return
    factory_cls = getattr(unreal, "InputMappingContextFactory", None)
    if factory_cls is None:
        R.log("unreal.InputMappingContextFactory not exposed in this build; creating contexts with no factory.")

    for imc_name, bindings in IMC_BINDINGS.items():
        path = "{}/{}".format(INPUT_PATH, imc_name)
        # Per-context guard: a failure in one context must not skip the other.
        try:
            if asset_exists(path):
                R.existed.append(path)
                imc = load_asset(path)
            else:
                imc = None
                if factory_cls is not None:
                    try:
                        imc = create_asset(imc_name, INPUT_PATH, imc_cls, factory_cls())
                    except Exception as exc:  # noqa: BLE001
                        R.warn("InputMappingContextFactory failed for {} ({}); retrying without a factory.".format(imc_name, exc))
                if imc is None:
                    imc = create_asset(imc_name, INPUT_PATH, imc_cls, None)
                R.created.append(path)

            # Existing (action name, key name) pairs, so re-runs never duplicate a mapping.
            existing = set()
            try:
                for mapping in imc.get_editor_property("mappings"):
                    action = mapping.get_editor_property("action")
                    key = mapping.get_editor_property("key")
                    action_name = action.get_name() if action else ""
                    key_name = str(key.get_editor_property("key_name")) if key else ""
                    existing.add((action_name, key_name))
            except Exception as exc:  # noqa: BLE001
                R.warn("Could not read existing mappings of {}: {} (duplicates possible on re-run; check by hand).".format(path, exc))

            added = 0
            for action_name, key_name in bindings:
                if (action_name, key_name) in existing:
                    continue
                action = actions.get(action_name) or load_asset("{}/{}".format(INPUT_PATH, action_name))
                if action is None:
                    R.manual_step("Map {} -> {} in {} (the action asset is missing).".format(key_name, action_name, path))
                    continue
                try:
                    imc.map_key(action, make_key(key_name))
                    added += 1
                except Exception as exc:  # noqa: BLE001
                    R.manual_step("Map key {} to {} in {} in the asset editor: {}".format(key_name, action_name, path, exc))

            save_asset(path)
            R.log("{}: {} mappings added, {} already present.".format(path, added, len(existing)))
        except Exception as exc:  # noqa: BLE001
            R.failed.append("{}: {}".format(path, exc))
            R.manual_step("Create {} by hand under {} and add its charter Section 8 mappings (see IMC_BINDINGS at the top of this script): {}".format(
                imc_name, INPUT_PATH, exc))
            continue


@guarded("5. Widget Blueprints")
def step_widget_blueprints():
    ensure_directory(UI_PATH)
    umg_hint = "The UMG editor module is not loaded in this editor (check that UMG / UMGEditor are enabled)"
    factory_cls = python_class("WidgetBlueprintFactory", hint=umg_hint)
    wb_cls = python_class("WidgetBlueprint", hint=umg_hint)
    if factory_cls is None or wb_cls is None:
        return

    for name, parent_name in WIDGET_BLUEPRINTS:
        path = "{}/{}".format(UI_PATH, name)
        if asset_exists(path):
            R.existed.append(path)
            continue
        parent = python_class(parent_name)
        if parent is None:
            continue
        factory = factory_cls()
        factory.set_editor_property("parent_class", parent)
        create_asset(name, UI_PATH, wb_cls, factory)
        save_asset(path)
        R.created.append(path)
        R.log("Created {} (parent {}). Its layout is authored later; the C++ base carries every entry point.".format(path, parent_name))


def _level_subsystem():
    try:
        return unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    except Exception:  # noqa: BLE001
        return None


def _actor_subsystem():
    try:
        return unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    except Exception:  # noqa: BLE001
        return None


def _new_level(path):
    subsystem = _level_subsystem()
    if subsystem is not None:
        return subsystem.new_level(path)
    return unreal.EditorLevelLibrary.new_level(path)


def _load_level(path):
    subsystem = _level_subsystem()
    if subsystem is not None:
        return subsystem.load_level(path)
    return unreal.EditorLevelLibrary.load_level(path)


def _save_current_level():
    subsystem = _level_subsystem()
    if subsystem is not None:
        return subsystem.save_current_level()
    return unreal.EditorLevelLibrary.save_current_level()


def _all_level_actors():
    subsystem = _actor_subsystem()
    if subsystem is not None:
        return subsystem.get_all_level_actors()
    return unreal.EditorLevelLibrary.get_all_level_actors()


def _spawn(actor_class, location, rotation=None):
    rotation = rotation or unreal.Rotator(roll=0.0, pitch=0.0, yaw=0.0)
    subsystem = _actor_subsystem()
    if subsystem is not None:
        return subsystem.spawn_actor_from_class(actor_class, location, rotation)
    return unreal.EditorLevelLibrary.spawn_actor_from_class(actor_class, location, rotation)


@guarded("6. L_Test_Cultivation")
def step_test_level():
    path = "{}/{}".format(MAPS_PATH, TEST_LEVEL_NAME)
    ensure_directory(MAPS_PATH)

    if asset_exists(path):
        R.existed.append(path)
        R.log("{} exists; loading it to add any missing placeholder actors.".format(path))
        if not _load_level(path):
            R.manual_step("Could not load {}. Open it and check it has Floor, KeyLight, SkyFill, PlayerStart and M0_Note.".format(path))
            return
    else:
        if not _new_level(path):
            R.manual_step("new_level({}) failed. Create an empty level at that path (File > New Level > Empty Level) "
                          "and add a floor (Plane, scale 40,40,1), a directional light, a sky light, a Player Start "
                          "and a Note actor (Floor, KeyLight, SkyFill, PlayerStart, M0_Note).".format(path))
            return
        R.created.append(path)

    labels = {}
    try:
        for actor in _all_level_actors():
            labels[actor.get_actor_label()] = actor
    except Exception as exc:  # noqa: BLE001
        R.warn("Could not enumerate level actors: {}".format(exc))

    def place(label, actor_class, location, configure=None):
        if label in labels:
            R.log("  {} already placed.".format(label))
            return labels[label]
        actor = _spawn(actor_class, location)
        if actor is None:
            R.manual_step("Place a {} named '{}' in {}.".format(actor_class.__name__, label, path))
            return None
        actor.set_actor_label(label)
        if configure:
            try:
                configure(actor)
            except Exception as exc:  # noqa: BLE001
                R.manual_step("Finish configuring '{}' in {}: {}".format(label, path, exc))
        R.log("  placed {}.".format(label))
        return actor

    def configure_floor(actor):
        mesh = load_asset("/Engine/BasicShapes/Plane")
        if mesh is None:
            raise RuntimeError("/Engine/BasicShapes/Plane did not load (set Static Mesh = /Engine/BasicShapes/Plane by hand)")
        component = actor.get_editor_property("static_mesh_component")
        if not component.set_static_mesh(mesh):
            raise RuntimeError("set_static_mesh returned False (set Static Mesh = /Engine/BasicShapes/Plane by hand)")
        actor.set_actor_scale3d(unreal.Vector(40.0, 40.0, 1.0))  # a 40 m square; Reach 800 fits with room to spare

    def configure_light(actor):
        # Keyword arguments: unreal.Rotator's positional order is (roll, pitch, yaw), not (pitch, yaw, roll).
        actor.set_actor_rotation(unreal.Rotator(roll=0.0, pitch=-50.0, yaw=-30.0), False)
        component = actor.get_editor_property("light_component")
        component.set_intensity(3.0)

    def configure_note(actor):
        actor.set_editor_property("text", TEST_LEVEL_NOTE)

    place("Floor", unreal.StaticMeshActor, unreal.Vector(0.0, 0.0, 0.0), configure_floor)
    place("KeyLight", unreal.DirectionalLight, unreal.Vector(0.0, 0.0, 500.0), configure_light)
    place("SkyFill", unreal.SkyLight, unreal.Vector(0.0, 0.0, 400.0))
    place("PlayerStart", unreal.PlayerStart, unreal.Vector(0.0, 0.0, 100.0))
    place("M0_Note", unreal.Note, unreal.Vector(200.0, 0.0, 50.0), configure_note)

    if not _save_current_level():
        R.manual_step("Save {} by hand (File > Save Current Level).".format(path))
    else:
        R.log("{} saved.".format(path))


@guarded("7. Project Settings > Game > Ascension")
def step_settings(config, table):
    settings_cls = python_class("AscensionSettings")
    if settings_cls is None:
        return
    settings = unreal.get_default_object(settings_cls)

    wanted = {
        "ladder_config": config if config is not None else load_asset("{}/{}".format(DATA_PATH, LADDER_CONFIG_NAME)),
        "ladder_table": table if table is not None else load_asset("{}/{}".format(DATA_PATH, LADDER_TABLE_NAME)),
    }
    changed = False
    for prop, asset in wanted.items():
        try:
            current = settings.get_editor_property(prop)
            current_str = str(current) if current is not None else "None"
        except Exception as exc:  # noqa: BLE001
            R.warn("Could not read AscensionSettings.{}: {}".format(prop, exc))
            current_str = "?"
        R.log("AscensionSettings.{} = {}".format(prop, current_str))
        if asset is None:
            continue
        if asset.get_path_name() in current_str:
            continue
        try:
            settings.set_editor_property(prop, asset)
            changed = True
            R.log("  set AscensionSettings.{} -> {}".format(prop, asset.get_path_name()))
        except Exception as exc:  # noqa: BLE001
            R.manual_step("Project Settings > Game > Ascension: set {} to {} ({})".format(prop, asset.get_path_name(), exc))

    for prop, expected in (("debug_overlay_class", "/Game/Ascension/UI/WBP_DebugOverlay.WBP_DebugOverlay_C"),
                           ("debug_panel_class", "/Game/Ascension/UI/WBP_DebugPanel.WBP_DebugPanel_C"),
                           ("world_mapping_context", "{}/IMC_World.IMC_World".format(INPUT_PATH)),
                           ("cultivation_mapping_context", "{}/IMC_Cultivation.IMC_Cultivation".format(INPUT_PATH)),
                           ("debug_overlay_action", "{}/IA_DebugOverlay.IA_DebugOverlay".format(INPUT_PATH)),
                           ("debug_panel_action", "{}/IA_DebugPanel.IA_DebugPanel".format(INPUT_PATH))):
        try:
            R.log("AscensionSettings.{} = {}".format(prop, settings.get_editor_property(prop)))
        except Exception as exc:  # noqa: BLE001
            R.warn("Could not read AscensionSettings.{}: {}".format(prop, exc))
        R.log("  (expected {}, as written in Config/DefaultGame.ini; D-0010, D-0021)".format(expected))

    if changed:
        # UObject::SaveConfig is not exposed to Python; the CDO change lives in memory for this session only, which is
        # harmless because Config/DefaultGame.ini already carries the same values (D-0010).
        R.log("AscensionSettings CDO updated in memory; Config/DefaultGame.ini already carries the same values (D-0010). "
              "Confirm in Project Settings > Game > Ascension.")
    else:
        R.log("AscensionSettings already point at the ladder assets (Config/DefaultGame.ini); nothing changed.")


# ---------------------------------------------------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------------------------------------------------
def main():
    R.log("Milestone 0 setup starting. Engine {}. Project {}.".format(
        unreal.SystemLibrary.get_engine_version(), unreal.Paths.get_project_file_path()))
    R.log("This script creates missing assets only; it never deletes or overwrites authored content.")

    config = step_ladder_config()
    table = step_ladder_table()
    actions = step_input_actions() or {}
    step_mapping_contexts(actions)
    step_widget_blueprints()
    step_test_level()
    step_settings(config, table)

    try:
        unreal.EditorAssetLibrary.save_directory("/Game/Ascension", only_if_is_dirty=True, recursive=True)
    except Exception as exc:  # noqa: BLE001
        R.manual_step("File > Save All to persist anything still dirty under /Game/Ascension ({})".format(exc))

    R.summary()


if __name__ == "__main__" or True:  # `py <file>` from the Output Log does not always set __name__ to "__main__"
    main()

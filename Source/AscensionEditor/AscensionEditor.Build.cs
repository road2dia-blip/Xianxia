// Project Ascension -- editor-only module rules (D-0009; contract docs/SKELETON_M0.md "Module layout").
// Holds the ladder commandlet (-run=RealmLadder) and the Blutility-facing editor library. Nothing here ships in a packaged build.

using UnrealBuildTool;

public class AscensionEditor : ModuleRules
{
	public AscensionEditor(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

		// The module's files sit at its root (no Public/Private split), so make same-module includes explicit.
		PublicIncludePaths.Add(ModuleDirectory);

		PublicDependencyModuleNames.AddRange(new string[]
		{
			"Core",
			"CoreUObject",
			"Engine",
			"Ascension"            // UDA_RealmLadderConfig, FRealmLayerRow, URealmLadderLibrary (Cultivation/RealmLadder.h)
		});

		PrivateDependencyModuleNames.AddRange(new string[]
		{
			"UnrealEd",            // UCommandlet, package saving
			"GameplayTags",
			"AssetTools",
			"AssetRegistry",       // FAssetRegistryModule::AssetCreated for a table created by the commandlet
			"EditorSubsystem",
			"Blutility",           // URealmLadderEditorLibrary is meant to be called from an Editor Utility Widget
			"UMGEditor"
		});
	}
}

// Project Ascension -- runtime module rules (charter Section 11.1; contract docs/SKELETON_M0.md "Module layout").

using UnrealBuildTool;

public class Ascension : ModuleRules
{
	public Ascension(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

		// Lets every file include by area, e.g. "Cultivation/AuraComponent.h", "Player/CultivationPawn.h", "UI/DebugPanelWidget.h".
		PublicIncludePaths.AddRange(new string[]
		{
			"Ascension"
		});

		PublicDependencyModuleNames.AddRange(new string[]
		{
			"Core",
			"CoreUObject",
			"Engine",
			"InputCore",
			"EnhancedInput",       // IMC_World / IMC_Cultivation, IA_* (charter 8)
			"GameplayTags",        // systems, conditions, natures, states, events (charter 11.2)
			"UMG",                 // C++ base widgets (charter 10.6, 11.1)
			"DeveloperSettings",   // UAscensionSettings (D-0010)
			"Niagara"              // aura / wisp / domain FX hooks (charter 10.3)
		});

		PrivateDependencyModuleNames.AddRange(new string[]
		{
			"Slate",
			"SlateCore"
		});
	}
}

// Project Ascension -- game target (charter Section 11.1; contract docs/SKELETON_M0.md "Module layout").

using UnrealBuildTool;
using System.Collections.Generic;

public class AscensionTarget : TargetRules
{
	public AscensionTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Game;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;

		ExtraModuleNames.Add("Ascension");
	}
}

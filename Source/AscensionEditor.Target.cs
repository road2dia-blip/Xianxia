// Project Ascension -- editor target (charter Section 11.1; D-0009 editor module for the ladder commandlet and editor library).

using UnrealBuildTool;
using System.Collections.Generic;

public class AscensionEditorTarget : TargetRules
{
	public AscensionEditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;

		ExtraModuleNames.Add("Ascension");
		ExtraModuleNames.Add("AscensionEditor");
	}
}

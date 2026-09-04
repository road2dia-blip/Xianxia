// Project Ascension -- editor module interface (D-0009; charter Section 11.1).

#pragma once

#include "CoreMinimal.h"
#include "Logging/LogMacros.h"
#include "Modules/ModuleInterface.h"

/**
 * Editor-module log category. The runtime category LogAscension is declared without an export macro in
 * Source/Ascension/AscensionLog.h, so it cannot be referenced across the module boundary in a modular editor
 * build; the editor module logs through its own category instead (see DECISIONS for the Milestone 0 note).
 */
DECLARE_LOG_CATEGORY_EXTERN(LogAscensionEditor, Log, All);

/**
 * FAscensionEditorModule (D-0009): the editor-only module that hosts URealmLadderCommandlet and
 * URealmLadderEditorLibrary (charter 6.1 "a small editor utility ... that regenerates the table from the config").
 * Milestone 0: StartupModule/ShutdownModule only log; no editor extensions are registered yet.
 */
class FAscensionEditorModule : public IModuleInterface
{
public:
	// -- IModuleInterface --
	virtual void StartupModule() override;
	virtual void ShutdownModule() override;
};

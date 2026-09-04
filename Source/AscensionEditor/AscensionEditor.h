// Project Ascension -- editor module interface (D-0009; charter Section 11.1).

#pragma once

#include "CoreMinimal.h"
#include "Modules/ModuleInterface.h"
#include "AscensionLog.h"

// Logging: the editor module uses the runtime category LogAscension (exported from Source/Ascension/AscensionLog.h),
// as the contract's global rule requires; there is no separate editor category.

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

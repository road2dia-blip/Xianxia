// Project Ascension -- primary game module (charter Section 11.1).

#pragma once

#include "CoreMinimal.h"
#include "Modules/ModuleInterface.h"

/**
 * The runtime module for Project Ascension (charter Section 11.1: Source/Ascension holds every system in C++;
 * Blueprints hold presentation only). Milestone 0 scope: the module exists, loads, and logs; it registers nothing
 * because native Gameplay Tags (AscensionGameplayTags.cpp) register themselves at static-init time and every other
 * system is a UObject/component created by the engine on demand.
 */
class FAscensionModule : public IModuleInterface
{
public:
	//~ Begin IModuleInterface
	virtual void StartupModule() override;
	virtual void ShutdownModule() override;
	//~ End IModuleInterface
};

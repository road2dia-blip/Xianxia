// Project Ascension -- primary game module implementation (charter Section 11.1).

#include "Ascension.h"
#include "AscensionLog.h"
#include "Modules/ModuleManager.h"

void FAscensionModule::StartupModule()
{
	UE_LOG(LogAscension, Log, TEXT("Ascension runtime module started (Milestone 0 skeleton)."));
}

void FAscensionModule::ShutdownModule()
{
	UE_LOG(LogAscension, Log, TEXT("Ascension runtime module shut down."));
}

IMPLEMENT_PRIMARY_GAME_MODULE(FAscensionModule, Ascension, "Ascension");

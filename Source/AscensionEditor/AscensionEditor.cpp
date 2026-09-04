// Project Ascension -- editor module implementation (D-0009; charter Section 11.1).

#include "AscensionEditor.h"
#include "Modules/ModuleManager.h"

void FAscensionEditorModule::StartupModule()
{
	UE_LOG(LogAscension, Log, TEXT("AscensionEditor module started (ladder commandlet: -run=RealmLadder; editor library: URealmLadderEditorLibrary::RegenerateLadderTable)."));
}

void FAscensionEditorModule::ShutdownModule()
{
	UE_LOG(LogAscension, Log, TEXT("AscensionEditor module shut down."));
}

IMPLEMENT_MODULE(FAscensionEditorModule, AscensionEditor)

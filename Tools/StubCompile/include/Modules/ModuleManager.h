// Tools/StubCompile -- STUB of Modules/ModuleManager.h (model test only; see README.md).
#pragma once

#include "CoreMinimal.h"
#include "Modules/ModuleInterface.h"

class FModuleManager
{
public:
	static FModuleManager& Get() { static FModuleManager Instance; return Instance; }
	template <typename TModule>
	static TModule& LoadModuleChecked(const FName InModuleName) { UE::Stub::Sink(InModuleName); static TModule Module; return Module; }
	template <typename TModule>
	static TModule& GetModuleChecked(const FName InModuleName) { UE::Stub::Sink(InModuleName); static TModule Module; return Module; }
	template <typename TModule>
	static TModule* GetModulePtr(const FName InModuleName) { UE::Stub::Sink(InModuleName); return nullptr; }
	bool IsModuleLoaded(const FName InModuleName) const { UE::Stub::Sink(InModuleName); return false; }
};

/** Both IMPLEMENT_* macros instantiate the module class once, which checks that it is complete and constructible. */
#define IMPLEMENT_MODULE(ModuleImplClass, ModuleName) \
	static ModuleImplClass StubModuleInstance_##ModuleName; \
	extern "C" void StubInitializeModule_##ModuleName() { StubModuleInstance_##ModuleName.StartupModule(); }

#define IMPLEMENT_PRIMARY_GAME_MODULE(ModuleImplClass, ModuleName, GameName) \
	static_assert(sizeof(GameName) > 1, "IMPLEMENT_PRIMARY_GAME_MODULE needs a game name literal"); \
	IMPLEMENT_MODULE(ModuleImplClass, ModuleName)

#define IMPLEMENT_GAME_MODULE(ModuleImplClass, ModuleName) IMPLEMENT_MODULE(ModuleImplClass, ModuleName)

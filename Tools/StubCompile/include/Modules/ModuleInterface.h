// Tools/StubCompile -- STUB of Modules/ModuleInterface.h (model test only; see README.md).
#pragma once

#include "CoreMinimal.h"

/** Real IModuleInterface has virtual defaults for every hook; keeping them non-pure lets IMPLEMENT_MODULE instantiate the class. */
class IModuleInterface
{
public:
	virtual ~IModuleInterface() = default;
	virtual void StartupModule() {}
	virtual void PreUnloadCallback() {}
	virtual void PostLoadCallback() {}
	virtual void ShutdownModule() {}
	virtual bool SupportsDynamicReloading() { return true; }
	virtual bool SupportsAutomaticShutdown() { return true; }
	virtual bool IsGameModule() const { return false; }
};

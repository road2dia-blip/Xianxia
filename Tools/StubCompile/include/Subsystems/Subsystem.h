// Tools/StubCompile -- STUB of Subsystems/Subsystem.h (model test only; see README.md).
#pragma once

#include "UObject/Object.h"

class FSubsystemCollectionBase
{
public:
	template <typename T>
	T* InitializeDependency() { return nullptr; }
};

class USubsystem : public UObject
{
	UE_STUB_CLASS_BODY(USubsystem)

	virtual bool ShouldCreateSubsystem(UObject* Outer) const { UE::Stub::Sink(Outer); return true; }
	virtual void Initialize(FSubsystemCollectionBase& Collection) { UE::Stub::Sink(Collection); }
	virtual void Deinitialize() {}
};

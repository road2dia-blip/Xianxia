// Tools/StubCompile -- STUB of EnhancedInputSubsystems.h plus EnhancedInputSubsystemInterface.h (EnhancedInput; model test only, see README.md).
#pragma once

#include "Engine/LocalPlayer.h"
#include "InputMappingContext.h"
#include "InputAction.h"

struct FModifyContextOptions
{
	bool bIgnoreAllPressedKeysUntilRelease = true;
	bool bForceImmediately = false;
	bool bNotifyUserSettings = false;
};

class IEnhancedInputSubsystemInterface
{
public:
	virtual ~IEnhancedInputSubsystemInterface() = default;
	virtual void ClearAllMappings() {}
	virtual void AddMappingContext(const UInputMappingContext* MappingContext, int32 Priority, const FModifyContextOptions& Options = FModifyContextOptions()) { UE::Stub::Sink(MappingContext, Priority, Options); }
	virtual void RemoveMappingContext(const UInputMappingContext* MappingContext, const FModifyContextOptions& Options = FModifyContextOptions()) { UE::Stub::Sink(MappingContext, Options); }
	virtual bool HasMappingContext(const UInputMappingContext* MappingContext) const { UE::Stub::Sink(MappingContext); return false; }
	virtual bool HasMappingContext(const UInputMappingContext* MappingContext, int32& OutFoundPriority) const { UE::Stub::Sink(MappingContext); OutFoundPriority = INDEX_NONE; return false; }
	virtual void RequestRebuildControlMappings(const FModifyContextOptions& Options = FModifyContextOptions(), int RebuildType = 0) { UE::Stub::Sink(Options, RebuildType); }
	virtual TArray<FKey> QueryKeysMappedToAction(const UInputAction* Action) const { UE::Stub::Sink(Action); return TArray<FKey>(); }
	virtual void InjectInputForAction(const UInputAction* Action, FInputActionValue RawValue) { UE::Stub::Sink(Action, RawValue); }
};

class UEnhancedInputLocalPlayerSubsystem : public ULocalPlayerSubsystem, public IEnhancedInputSubsystemInterface
{
	UE_STUB_CLASS_BODY(UEnhancedInputLocalPlayerSubsystem)
};

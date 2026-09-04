// Tools/StubCompile -- STUB of Engine/LocalPlayer.h (model test only; see README.md).
#pragma once

#include "UObject/Object.h"
#include "Subsystems/Subsystem.h"

class APlayerController;
class UWorld;

class ULocalPlayerSubsystem : public USubsystem
{
	UE_STUB_CLASS_BODY(ULocalPlayerSubsystem)
};

class UPlayer : public UObject
{
	UE_STUB_CLASS_BODY(UPlayer)
	TObjectPtr<APlayerController> PlayerController;
};

class ULocalPlayer : public UPlayer
{
	UE_STUB_CLASS_BODY(ULocalPlayer)

	template <typename TSubsystemClass>
	TSubsystemClass* GetSubsystem() const { return nullptr; }
	template <typename TSubsystemClass>
	static TSubsystemClass* GetSubsystem(const ULocalPlayer* LocalPlayer) { UE::Stub::Sink(LocalPlayer); return nullptr; }
	APlayerController* GetPlayerController(const UWorld* World) const { UE::Stub::Sink(World); return nullptr; }
	int32 GetControllerId() const { return 0; }
};

// Tools/StubCompile -- STUB of Engine/GameInstance.h (model test only; see README.md).
#pragma once

#include "UObject/Object.h"
#include "Subsystems/GameInstanceSubsystem.h"

class UWorld;
class ULocalPlayer;
class APlayerController;

class UGameInstance : public UObject
{
	UE_STUB_CLASS_BODY(UGameInstance)

	template <typename TSubsystemClass>
	TSubsystemClass* GetSubsystem() const { return nullptr; }
	static UGameInstanceSubsystem* GetSubsystem(const UGameInstance* GameInstance, TSubclassOf<UGameInstanceSubsystem> SubsystemClass) { UE::Stub::Sink(GameInstance, SubsystemClass); return nullptr; }
	virtual UWorld* GetWorld() const override { return nullptr; }
	virtual void Init() {}
	virtual void Shutdown() {}
	ULocalPlayer* GetFirstGamePlayer() const { return nullptr; }
	APlayerController* GetFirstLocalPlayerController(const UWorld* World = nullptr) const { UE::Stub::Sink(World); return nullptr; }
	int32 GetNumLocalPlayers() const { return 1; }
};

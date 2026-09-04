// Tools/StubCompile -- STUB of Engine/World.h (model test only; see README.md).
#pragma once

#include "UObject/Object.h"
#include "Engine/EngineTypes.h"
#include "GameFramework/Actor.h"

class UGameInstance;
class AGameModeBase;
class AGameStateBase;
class APlayerController;
class ULevel;
class UGameViewportClient;
class FTimerManager;

class UWorld : public UObject
{
	UE_STUB_CLASS_BODY(UWorld)

	UGameInstance* GetGameInstance() const { return nullptr; }
	template <typename T>
	T* GetGameInstance() const { return nullptr; }
	AGameModeBase* GetAuthGameMode() const { return nullptr; }
	template <typename T>
	T* GetAuthGameMode() const { return nullptr; }
	AGameStateBase* GetGameState() const { return nullptr; }
	APlayerController* GetFirstPlayerController() const { return nullptr; }
	ULevel* GetCurrentLevel() const { return nullptr; }
	UGameViewportClient* GetGameViewport() const { return nullptr; }
	FTimerManager& GetTimerManager() const;

	float GetTimeSeconds() const { return 0.0f; }
	float GetUnpausedTimeSeconds() const { return 0.0f; }
	float GetRealTimeSeconds() const { return 0.0f; }
	float GetDeltaSeconds() const { return 0.0f; }
	bool IsGameWorld() const { return true; }
	bool IsEditorWorld() const { return false; }
	bool IsPaused() const { return false; }
	bool IsPlayInEditor() const { return false; }

	template <typename T>
	T* SpawnActor(UClass* Class, const FVector& Location, const FRotator& Rotation, const FActorSpawnParameters& SpawnParameters = FActorSpawnParameters())
	{
		UE::Stub::Sink(Class, Location, Rotation, SpawnParameters);
		return new T();
	}
	template <typename T>
	T* SpawnActor(UClass* Class, const FTransform& Transform, const FActorSpawnParameters& SpawnParameters = FActorSpawnParameters())
	{
		UE::Stub::Sink(Class, Transform, SpawnParameters);
		return new T();
	}
	template <typename T>
	T* SpawnActor(UClass* Class, const FActorSpawnParameters& SpawnParameters = FActorSpawnParameters())
	{
		UE::Stub::Sink(Class, SpawnParameters);
		return new T();
	}
	template <typename T>
	T* SpawnActor(const FVector& Location, const FRotator& Rotation, const FActorSpawnParameters& SpawnParameters = FActorSpawnParameters())
	{
		UE::Stub::Sink(Location, Rotation, SpawnParameters);
		return new T();
	}
	template <typename T>
	T* SpawnActor(const FActorSpawnParameters& SpawnParameters = FActorSpawnParameters())
	{
		UE::Stub::Sink(SpawnParameters);
		return new T();
	}
	AActor* SpawnActor(UClass* Class, const FVector* Location = nullptr, const FRotator* Rotation = nullptr, const FActorSpawnParameters& SpawnParameters = FActorSpawnParameters())
	{
		UE::Stub::Sink(Class, Location, Rotation, SpawnParameters);
		return nullptr;
	}
	bool DestroyActor(AActor* Actor, bool bNetForce = false, bool bShouldModifyLevel = true) { UE::Stub::Sink(Actor, bNetForce, bShouldModifyLevel); return true; }
};

class FTimerManager
{
public:
	template <typename TUserClass>
	void SetTimer(FTimerHandle& InOutHandle, TUserClass* InObj, void (TUserClass::*InTimerMethod)(), float InRate, bool bInLoop = false, float InFirstDelay = -1.0f) { UE::Stub::Sink(InOutHandle, InObj, InTimerMethod, InRate, bInLoop, InFirstDelay); }
	void ClearTimer(FTimerHandle& InHandle) { UE::Stub::Sink(InHandle); }
	bool IsTimerActive(FTimerHandle InHandle) const { UE::Stub::Sink(InHandle); return false; }
	float GetTimerRemaining(FTimerHandle InHandle) const { UE::Stub::Sink(InHandle); return 0.0f; }
};
inline FTimerManager& UWorld::GetTimerManager() const { static FTimerManager Manager; return Manager; }

/** Engine/Engine.h globals that commonly ride along with World.h in game code. */
class UEngine
{
public:
	UWorld* GetWorldFromContextObject(const UObject* Object, int ErrorMode) const { UE::Stub::Sink(Object, ErrorMode); return nullptr; }
	void AddOnScreenDebugMessage(int32 Key, float TimeToDisplay, FColor DisplayColor, const FString& DebugMessage, bool bNewerOnTop = true, const FVector2D& TextScale = FVector2D(1.0, 1.0)) { UE::Stub::Sink(Key, TimeToDisplay, DisplayColor, DebugMessage, bNewerOnTop, TextScale); }
};
inline UEngine* GEngine = nullptr;

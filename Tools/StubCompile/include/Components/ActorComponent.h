// Tools/StubCompile -- STUB of Components/ActorComponent.h (model test only; see README.md).
#pragma once

#include "UObject/Object.h"
#include "Engine/EngineTypes.h"

class AActor;
class UWorld;

class UActorComponent : public UObject
{
	UE_STUB_CLASS_BODY(UActorComponent)

	FActorComponentTickFunction PrimaryComponentTick;
	bool bAutoActivate = false;
	bool bWantsInitializeComponent = false;

	AActor* GetOwner() const { return nullptr; }
	virtual UWorld* GetWorld() const override { return nullptr; }
	virtual void BeginPlay() {}
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) { UE::Stub::Sink(EndPlayReason); }
	virtual void InitializeComponent() {}
	virtual void UninitializeComponent() {}
	virtual void OnRegister() {}
	virtual void OnUnregister() {}
	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) { UE::Stub::Sink(DeltaTime, TickType, ThisTickFunction); }
	virtual void Activate(bool bReset = false) { UE::Stub::Sink(bReset); }
	virtual void Deactivate() {}
	virtual void SetActive(bool bNewActive, bool bReset = false) { UE::Stub::Sink(bNewActive, bReset); }
	bool IsActive() const { return true; }
	bool HasBegunPlay() const { return false; }
	bool IsRegistered() const { return true; }
	void RegisterComponent() {}
	void UnregisterComponent() {}
	void DestroyComponent(bool bPromoteChildren = false) { UE::Stub::Sink(bPromoteChildren); }
	void SetComponentTickEnabled(bool bEnabled) { UE::Stub::Sink(bEnabled); }
	bool IsComponentTickEnabled() const { return true; }
	void SetComponentTickInterval(float TickInterval) { UE::Stub::Sink(TickInterval); }
	template <typename T>
	T* GetOwner() const { return nullptr; }
};

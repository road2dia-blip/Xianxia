// Tools/StubCompile -- STUB of GameFramework/Actor.h (model test only; see README.md).
#pragma once

#include "UObject/Object.h"
#include "Engine/EngineTypes.h"
#include "Components/SceneComponent.h"
#include "Components/InputComponent.h"

class UWorld;
class UGameInstance;
class APawn;

class AActor : public UObject
{
	UE_STUB_CLASS_BODY(AActor)

	FActorTickFunction PrimaryActorTick;
	TObjectPtr<USceneComponent> RootComponent;
	TObjectPtr<UInputComponent> InputComponent;
	bool bHidden = false;
	bool bCanBeDamaged = false;

	virtual UWorld* GetWorld() const override { return nullptr; }
	UGameInstance* GetGameInstance() const { return nullptr; }
	virtual void BeginPlay() {}
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) { UE::Stub::Sink(EndPlayReason); }
	virtual void Tick(float DeltaSeconds) { UE::Stub::Sink(DeltaSeconds); }
	virtual void PostInitializeComponents() {}
	virtual void Destroyed() {}
	bool Destroy(bool bNetForce = false, bool bShouldModifyLevel = true) { UE::Stub::Sink(bNetForce, bShouldModifyLevel); return true; }
	void SetActorTickEnabled(bool bEnabled) { UE::Stub::Sink(bEnabled); }
	bool IsActorTickEnabled() const { return true; }
	void SetActorHiddenInGame(bool bNewHidden) { bHidden = bNewHidden; }
	bool IsHidden() const { return bHidden; }
	void SetOwner(AActor* NewOwner) { UE::Stub::Sink(NewOwner); }
	AActor* GetOwner() const { return nullptr; }
	APawn* GetInstigator() const { return nullptr; }
	float GetGameTimeSinceCreation() const { return 0.0f; }

	FVector GetActorLocation() const { return FVector(); }
	FRotator GetActorRotation() const { return FRotator(); }
	FVector GetActorScale3D() const { return FVector(1.0); }
	FTransform GetActorTransform() const { return FTransform(); }
	FVector GetActorForwardVector() const { return FVector(); }
	FVector GetActorRightVector() const { return FVector(); }
	FVector GetActorUpVector() const { return FVector(); }
	virtual FVector GetVelocity() const { return FVector(); }
	bool SetActorLocation(const FVector& NewLocation, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr) { UE::Stub::Sink(NewLocation, bSweep, OutSweepHitResult); return true; }
	bool SetActorRotation(FRotator NewRotation) { UE::Stub::Sink(NewRotation); return true; }
	bool SetActorLocationAndRotation(FVector NewLocation, FRotator NewRotation, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr) { UE::Stub::Sink(NewLocation, NewRotation, bSweep, OutSweepHitResult); return true; }
	void SetActorScale3D(FVector NewScale3D) { UE::Stub::Sink(NewScale3D); }
	void SetActorTransform(const FTransform& NewTransform) { UE::Stub::Sink(NewTransform); }
	void AttachToActor(AActor* ParentActor, const FAttachmentTransformRules& AttachmentRules, FName SocketName = NAME_None) { UE::Stub::Sink(ParentActor, AttachmentRules, SocketName); }
	void AttachToComponent(USceneComponent* Parent, const FAttachmentTransformRules& AttachmentRules, FName SocketName = NAME_None) { UE::Stub::Sink(Parent, AttachmentRules, SocketName); }
	USceneComponent* GetRootComponent() const { return RootComponent; }
	bool SetRootComponent(USceneComponent* NewRootComponent) { RootComponent = NewRootComponent; return true; }

	template <typename T>
	T* FindComponentByClass() const { return nullptr; }
	UActorComponent* FindComponentByClass(const TSubclassOf<UActorComponent>& ComponentClass) const { UE::Stub::Sink(ComponentClass); return nullptr; }
	template <typename T>
	void GetComponents(TArray<T*>& OutComponents, bool bIncludeFromChildActors = false) const { UE::Stub::Sink(OutComponents, bIncludeFromChildActors); }
	UActorComponent* AddComponentByClass(TSubclassOf<UActorComponent> Class, bool bManualAttachment, const FTransform& RelativeTransform, bool bDeferredFinish) { UE::Stub::Sink(Class, bManualAttachment, RelativeTransform, bDeferredFinish); return nullptr; }
	bool HasActorBegunPlay() const { return false; }
	bool IsActorBeingDestroyed() const { return false; }
	bool IsPendingKillPending() const { return false; }
};

/** Engine/World.h's spawn parameters; declared here because Actor.h needs them for deferred spawning in the engine. */
struct FActorSpawnParameters
{
	FName Name;
	AActor* Template = nullptr;
	AActor* Owner = nullptr;
	APawn* Instigator = nullptr;
	ESpawnActorCollisionHandlingMethod SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::Undefined;
	ESpawnActorScaleMethod TransformScaleMethod = ESpawnActorScaleMethod::MultiplyWithRoot;
	bool bNoFail = false;
	bool bDeferConstruction = false;
	bool bAllowDuringConstructionScript = false;
	EObjectFlags ObjectFlags = RF_Transactional;
};

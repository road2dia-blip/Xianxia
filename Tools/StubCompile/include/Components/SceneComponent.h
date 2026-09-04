// Tools/StubCompile -- STUB of Components/SceneComponent.h (model test only; see README.md).
#pragma once

#include "Components/ActorComponent.h"

class USceneComponent : public UActorComponent
{
	UE_STUB_CLASS_BODY(USceneComponent)

	void SetupAttachment(USceneComponent* InParent, FName InSocketName = NAME_None) { UE::Stub::Sink(InParent, InSocketName); }
	bool AttachToComponent(USceneComponent* Parent, const FAttachmentTransformRules& AttachmentRules, FName SocketName = NAME_None) { UE::Stub::Sink(Parent, AttachmentRules, SocketName); return true; }
	void DetachFromComponent(const FAttachmentTransformRules& Rules) { UE::Stub::Sink(Rules); }
	USceneComponent* GetAttachParent() const { return nullptr; }

	void SetRelativeLocation(FVector NewLocation, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr) { UE::Stub::Sink(NewLocation, bSweep, OutSweepHitResult); }
	void SetRelativeRotation(FRotator NewRotation, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr) { UE::Stub::Sink(NewRotation, bSweep, OutSweepHitResult); }
	void SetRelativeScale3D(FVector NewScale3D) { UE::Stub::Sink(NewScale3D); }
	void SetRelativeTransform(const FTransform& NewTransform) { UE::Stub::Sink(NewTransform); }
	void SetWorldLocation(FVector NewLocation, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr) { UE::Stub::Sink(NewLocation, bSweep, OutSweepHitResult); }
	void SetWorldRotation(FRotator NewRotation, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr) { UE::Stub::Sink(NewRotation, bSweep, OutSweepHitResult); }
	void SetWorldScale3D(FVector NewScale) { UE::Stub::Sink(NewScale); }
	void AddRelativeRotation(FRotator DeltaRotation) { UE::Stub::Sink(DeltaRotation); }
	void AddLocalRotation(FRotator DeltaRotation) { UE::Stub::Sink(DeltaRotation); }
	FVector GetRelativeLocation() const { return FVector(); }
	FRotator GetRelativeRotation() const { return FRotator(); }
	FVector GetRelativeScale3D() const { return FVector(1.0); }
	FVector GetComponentLocation() const { return FVector(); }
	FRotator GetComponentRotation() const { return FRotator(); }
	FVector GetComponentScale() const { return FVector(1.0); }
	FTransform GetComponentTransform() const { return FTransform(); }
	FVector GetForwardVector() const { return FVector(); }
	FVector GetRightVector() const { return FVector(); }
	FVector GetUpVector() const { return FVector(); }
	FVector GetSocketLocation(FName InSocketName) const { UE::Stub::Sink(InSocketName); return FVector(); }
	void SetVisibility(bool bNewVisibility, bool bPropagateToChildren = false) { UE::Stub::Sink(bNewVisibility, bPropagateToChildren); }
	void SetHiddenInGame(bool NewHidden, bool bPropagateToChildren = false) { UE::Stub::Sink(NewHidden, bPropagateToChildren); }
	bool IsVisible() const { return true; }
	void SetMobility(int NewMobility) { UE::Stub::Sink(NewMobility); }
};

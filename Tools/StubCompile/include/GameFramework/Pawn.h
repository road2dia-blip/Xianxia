// Tools/StubCompile -- STUB of GameFramework/Pawn.h (model test only; see README.md).
#pragma once

#include "GameFramework/Actor.h"
#include "GameFramework/Controller.h"

class UPawnMovementComponent;
class APlayerController;

class APawn : public AActor
{
	UE_STUB_CLASS_BODY(APawn)

	TObjectPtr<AController> Controller;
	bool bUseControllerRotationPitch = false;
	bool bUseControllerRotationYaw = false;
	bool bUseControllerRotationRoll = false;
	float BaseEyeHeight = 64.0f;

	virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) { UE::Stub::Sink(PlayerInputComponent); }
	virtual void PossessedBy(AController* NewController) { UE::Stub::Sink(NewController); }
	virtual void UnPossessed() {}
	AController* GetController() const { return Controller; }
	template <typename T>
	T* GetController() const { return nullptr; }
	bool IsPlayerControlled() const { return true; }
	bool IsLocallyControlled() const { return true; }
	virtual UPawnMovementComponent* GetMovementComponent() const { return nullptr; }
	FRotator GetControlRotation() const { return FRotator(); }
	FRotator GetViewRotation() const { return FRotator(); }
	virtual void AddMovementInput(FVector WorldDirection, float ScaleValue = 1.0f, bool bForce = false) { UE::Stub::Sink(WorldDirection, ScaleValue, bForce); }
	virtual void AddControllerPitchInput(float Val) { UE::Stub::Sink(Val); }
	virtual void AddControllerYawInput(float Val) { UE::Stub::Sink(Val); }
	virtual void AddControllerRollInput(float Val) { UE::Stub::Sink(Val); }
	FVector GetPendingMovementInputVector() const { return FVector(); }
	FVector GetLastMovementInputVector() const { return FVector(); }
	FVector ConsumeMovementInputVector() { return FVector(); }
};

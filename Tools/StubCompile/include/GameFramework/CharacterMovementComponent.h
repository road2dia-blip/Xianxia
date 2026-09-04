// Tools/StubCompile -- STUB of GameFramework/CharacterMovementComponent.h (model test only; see README.md).
#pragma once

#include "Components/ActorComponent.h"

enum EMovementMode : int
{
	MOVE_None,
	MOVE_Walking,
	MOVE_NavWalking,
	MOVE_Falling,
	MOVE_Swimming,
	MOVE_Flying,
	MOVE_Custom,
};

class UMovementComponent : public UActorComponent
{
	UE_STUB_CLASS_BODY(UMovementComponent)
	FVector Velocity;
	virtual float GetMaxSpeed() const { return 0.0f; }
	void StopMovementImmediately() {}
};

class UNavMovementComponent : public UMovementComponent
{
	UE_STUB_CLASS_BODY(UNavMovementComponent)
};

class UPawnMovementComponent : public UNavMovementComponent
{
	UE_STUB_CLASS_BODY(UPawnMovementComponent)
};

class UCharacterMovementComponent : public UPawnMovementComponent
{
	UE_STUB_CLASS_BODY(UCharacterMovementComponent)

	bool bOrientRotationToMovement = false;
	bool bUseControllerDesiredRotation = false;
	FRotator RotationRate;
	float JumpZVelocity = 420.0f;
	float AirControl = 0.05f;
	float MaxWalkSpeed = 600.0f;
	float MaxWalkSpeedCrouched = 300.0f;
	float MinAnalogWalkSpeed = 0.0f;
	float BrakingDecelerationWalking = 2048.0f;
	float BrakingDecelerationFalling = 0.0f;
	float GroundFriction = 8.0f;
	float GravityScale = 1.0f;
	float MaxAcceleration = 2048.0f;
	EMovementMode MovementMode = MOVE_Walking;

	bool IsMovingOnGround() const { return true; }
	bool IsFalling() const { return false; }
	bool IsCrouching() const { return false; }
	void SetMovementMode(EMovementMode NewMovementMode, uint8 NewCustomMode = 0) { MovementMode = NewMovementMode; UE::Stub::Sink(NewCustomMode); }
	void DisableMovement() {}
	virtual float GetMaxSpeed() const override { return MaxWalkSpeed; }
};

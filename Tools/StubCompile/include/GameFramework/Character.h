// Tools/StubCompile -- STUB of GameFramework/Character.h (model test only; see README.md).
#pragma once

#include "GameFramework/Pawn.h"

class UCapsuleComponent;
class UCharacterMovementComponent;
class USkeletalMeshComponent;

class ACharacter : public APawn
{
	UE_STUB_CLASS_BODY(ACharacter)

	static FName MeshComponentName;
	static FName CharacterMovementComponentName;
	static FName CapsuleComponentName;

	UCapsuleComponent* GetCapsuleComponent() const { return nullptr; }
	UCharacterMovementComponent* GetCharacterMovement() const { return nullptr; }
	USkeletalMeshComponent* GetMesh() const { return nullptr; }
	virtual void Jump() {}
	virtual void StopJumping() {}
	virtual void Crouch(bool bClientSimulation = false) { UE::Stub::Sink(bClientSimulation); }
	virtual void UnCrouch(bool bClientSimulation = false) { UE::Stub::Sink(bClientSimulation); }
	virtual bool CanJump() const { return true; }
	bool IsJumpProvidingForce() const { return false; }
	virtual void Landed(const FHitResult& Hit) { UE::Stub::Sink(Hit); }
	virtual void OnJumped_Implementation() {}
	virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override { UE::Stub::Sink(PlayerInputComponent); }
};
inline FName ACharacter::MeshComponentName(TEXT("CharacterMesh0"));
inline FName ACharacter::CharacterMovementComponentName(TEXT("CharMoveComp"));
inline FName ACharacter::CapsuleComponentName(TEXT("CollisionCylinder"));

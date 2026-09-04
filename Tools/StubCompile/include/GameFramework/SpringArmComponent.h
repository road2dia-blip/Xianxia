// Tools/StubCompile -- STUB of GameFramework/SpringArmComponent.h (model test only; see README.md).
#pragma once

#include "Components/SceneComponent.h"

class USpringArmComponent : public USceneComponent
{
	UE_STUB_CLASS_BODY(USpringArmComponent)

	static const FName SocketName;

	float TargetArmLength = 300.0f;
	FVector SocketOffset;
	FVector TargetOffset;
	float ProbeSize = 12.0f;
	bool bDoCollisionTest = true;
	bool bUsePawnControlRotation = false;
	bool bInheritPitch = true;
	bool bInheritYaw = true;
	bool bInheritRoll = true;
	bool bEnableCameraLag = false;
	bool bEnableCameraRotationLag = false;
	float CameraLagSpeed = 10.0f;
	float CameraRotationLagSpeed = 10.0f;
};
inline const FName USpringArmComponent::SocketName(TEXT("SpringEndpoint"));

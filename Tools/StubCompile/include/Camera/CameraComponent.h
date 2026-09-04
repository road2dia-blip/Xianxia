// Tools/StubCompile -- STUB of Camera/CameraComponent.h (model test only; see README.md).
#pragma once

#include "Components/SceneComponent.h"

class UCameraComponent : public USceneComponent
{
	UE_STUB_CLASS_BODY(UCameraComponent)

	bool bUsePawnControlRotation = false;
	float FieldOfView = 90.0f;
	bool bConstrainAspectRatio = false;
	void SetFieldOfView(float InFieldOfView) { FieldOfView = InFieldOfView; }
};

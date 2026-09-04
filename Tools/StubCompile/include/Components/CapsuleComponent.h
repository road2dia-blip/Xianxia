// Tools/StubCompile -- STUB of Components/CapsuleComponent.h (model test only; see README.md).
#pragma once

#include "Components/PrimitiveComponent.h"

class UShapeComponent : public UPrimitiveComponent
{
	UE_STUB_CLASS_BODY(UShapeComponent)
};

class UCapsuleComponent : public UShapeComponent
{
	UE_STUB_CLASS_BODY(UCapsuleComponent)

	void InitCapsuleSize(float InRadius, float InHalfHeight) { UE::Stub::Sink(InRadius, InHalfHeight); }
	void SetCapsuleSize(float InRadius, float InHalfHeight, bool bUpdateOverlaps = true) { UE::Stub::Sink(InRadius, InHalfHeight, bUpdateOverlaps); }
	void SetCapsuleHalfHeight(float HalfHeight, bool bUpdateOverlaps = true) { UE::Stub::Sink(HalfHeight, bUpdateOverlaps); }
	void SetCapsuleRadius(float Radius, bool bUpdateOverlaps = true) { UE::Stub::Sink(Radius, bUpdateOverlaps); }
	float GetScaledCapsuleRadius() const { return 0.0f; }
	float GetScaledCapsuleHalfHeight() const { return 0.0f; }
	float GetUnscaledCapsuleRadius() const { return 0.0f; }
	float GetUnscaledCapsuleHalfHeight() const { return 0.0f; }
};

// Tools/StubCompile -- STUB of InputActionValue.h (EnhancedInput; model test only, see README.md).
#pragma once

#include "UObject/Object.h"

enum class EInputActionValueType : uint8
{
	Boolean,
	Axis1D,
	Axis2D,
	Axis3D,
};

struct FInputActionValue
{
	FInputActionValue() = default;
	FInputActionValue(bool bInValue) : Type(EInputActionValueType::Boolean), Value(bInValue ? 1.0 : 0.0) {}
	FInputActionValue(float InValue) : Type(EInputActionValueType::Axis1D), Value(InValue) {}
	FInputActionValue(FVector2D InValue) : Type(EInputActionValueType::Axis2D), Value(InValue.X, InValue.Y, 0.0) {}
	FInputActionValue(FVector InValue) : Type(EInputActionValueType::Axis3D), Value(InValue) {}

	/** Real UE: Get<bool>, Get<float>, Get<FVector2D>, Get<FVector> (a static_assert rejects anything else). */
	template <typename T>
	T Get() const
	{
		static_assert(std::is_same<T, bool>::value || std::is_same<T, float>::value || std::is_same<T, FVector2D>::value || std::is_same<T, FVector>::value,
			"FInputActionValue::Get only supports bool, float, FVector2D and FVector");
		return T();
	}
	EInputActionValueType GetValueType() const { return Type; }
	float GetMagnitude() const { return 0.0f; }
	bool IsNonZero(float Tolerance = 1e-4f) const { UE::Stub::Sink(Tolerance); return false; }
	FString ToString() const { return FString(); }

private:
	EInputActionValueType Type = EInputActionValueType::Boolean;
	FVector Value;
};

template <>
inline bool FInputActionValue::Get<bool>() const { return false; }
template <>
inline float FInputActionValue::Get<float>() const { return 0.0f; }
template <>
inline FVector2D FInputActionValue::Get<FVector2D>() const { return FVector2D(); }
template <>
inline FVector FInputActionValue::Get<FVector>() const { return FVector(); }

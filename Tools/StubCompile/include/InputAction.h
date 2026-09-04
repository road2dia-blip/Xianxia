// Tools/StubCompile -- STUB of InputAction.h (EnhancedInput; model test only, see README.md).
#pragma once

#include "UObject/Object.h"
#include "InputActionValue.h"
#include "InputTriggers.h"

class UInputAction : public UObject
{
	UE_STUB_CLASS_BODY(UInputAction)

	EInputActionValueType ValueType = EInputActionValueType::Boolean;
	bool bConsumeInput = true;
	bool bTriggerWhenPaused = false;
	TArray<TObjectPtr<UInputTrigger>> Triggers;
	TArray<TObjectPtr<UInputModifier>> Modifiers;
	FText ActionDescription;
};

/** InputActionInstance.h */
struct FInputActionInstance
{
	const UInputAction* GetSourceAction() const { return nullptr; }
	FInputActionValue GetValue() const { return FInputActionValue(); }
	float GetElapsedTime() const { return 0.0f; }
	float GetTriggeredTime() const { return 0.0f; }
	ETriggerEvent GetTriggerEvent() const { return ETriggerEvent::None; }
};

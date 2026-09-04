// Tools/StubCompile -- STUB of InputTriggers.h (EnhancedInput; model test only, see README.md).
#pragma once

#include "UObject/Object.h"

enum class ETriggerEvent : uint8
{
	None = 0,
	Triggered,
	Started,
	Ongoing,
	Canceled,
	Completed,
};

class UInputTrigger : public UObject
{
	UE_STUB_CLASS_BODY(UInputTrigger)
};

class UInputModifier : public UObject
{
	UE_STUB_CLASS_BODY(UInputModifier)
};

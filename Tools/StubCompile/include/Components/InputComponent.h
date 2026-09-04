// Tools/StubCompile -- STUB of Components/InputComponent.h (model test only; see README.md).
#pragma once

#include "Components/ActorComponent.h"

class UInputComponent : public UActorComponent
{
	UE_STUB_CLASS_BODY(UInputComponent)

	bool bBlockInput = false;
	int32 Priority = 0;
	void ClearActionBindings() {}
	void ClearBindingValues() {}
};

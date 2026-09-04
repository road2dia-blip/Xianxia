// Tools/StubCompile -- STUB of EnhancedInputComponent.h (EnhancedInput; model test only, see README.md).
//
// BindAction mirrors the engine's overload set: the member-function parameter is a non-deduced context
// (TIdentity<...>::Type), so `UserClass` comes from the object pointer and the trailing payload types from the extra
// arguments, exactly as in the engine. A handler whose signature is not void(), void(const FInputActionValue&),
// void(const FInputActionInstance&) or one of those plus the payload is a compile error here and there.
#pragma once

#include "Components/InputComponent.h"
#include "InputAction.h"
#include "InputActionValue.h"
#include "InputTriggers.h"

struct FInputBindingHandle
{
	uint32 GetHandle() const { return 0; }
};

struct FEnhancedInputActionEventBinding : public FInputBindingHandle
{
	const UInputAction* GetAction() const { return nullptr; }
	ETriggerEvent GetTriggerEvent() const { return ETriggerEvent::None; }
};

struct FEnhancedInputActionValueBinding : public FInputBindingHandle
{
	FInputActionValue GetValue() const { return FInputActionValue(); }
};

class UEnhancedInputComponent : public UInputComponent
{
	UE_STUB_CLASS_BODY(UEnhancedInputComponent)

	template <class UserClass, typename... VarTypes>
	FEnhancedInputActionEventBinding& BindAction(const UInputAction* Action, ETriggerEvent TriggerEvent, UserClass* Object, typename TIdentity<void (UserClass::*)(VarTypes...)>::Type Func, VarTypes... Vars)
	{
		UE::Stub::Sink(Action, TriggerEvent, Object, Func, Vars...);
		static FEnhancedInputActionEventBinding Binding;
		return Binding;
	}

	template <class UserClass, typename... VarTypes>
	FEnhancedInputActionEventBinding& BindAction(const UInputAction* Action, ETriggerEvent TriggerEvent, UserClass* Object, typename TIdentity<void (UserClass::*)(const FInputActionValue&, VarTypes...)>::Type Func, VarTypes... Vars)
	{
		UE::Stub::Sink(Action, TriggerEvent, Object, Func, Vars...);
		static FEnhancedInputActionEventBinding Binding;
		return Binding;
	}

	template <class UserClass, typename... VarTypes>
	FEnhancedInputActionEventBinding& BindAction(const UInputAction* Action, ETriggerEvent TriggerEvent, UserClass* Object, typename TIdentity<void (UserClass::*)(const FInputActionInstance&, VarTypes...)>::Type Func, VarTypes... Vars)
	{
		UE::Stub::Sink(Action, TriggerEvent, Object, Func, Vars...);
		static FEnhancedInputActionEventBinding Binding;
		return Binding;
	}

	/** Blueprint-style binding by function name. */
	FEnhancedInputActionEventBinding& BindAction(const UInputAction* Action, ETriggerEvent TriggerEvent, UObject* Object, FName FunctionName)
	{
		UE::Stub::Sink(Action, TriggerEvent, Object, FunctionName);
		static FEnhancedInputActionEventBinding Binding;
		return Binding;
	}

	FEnhancedInputActionValueBinding& BindActionValue(const UInputAction* Action)
	{
		UE::Stub::Sink(Action);
		static FEnhancedInputActionValueBinding Binding;
		return Binding;
	}

	bool RemoveBindingByHandle(uint32 Handle) { UE::Stub::Sink(Handle); return true; }
	bool RemoveBinding(const FInputBindingHandle& BindingToRemove) { UE::Stub::Sink(BindingToRemove); return true; }
	void ClearActionEventBindings() {}
	void ClearActionValueBindings() {}
	void ClearBindingsForObject(UObject* Object) { UE::Stub::Sink(Object); }
};

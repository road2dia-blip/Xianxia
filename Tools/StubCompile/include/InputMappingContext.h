// Tools/StubCompile -- STUB of InputMappingContext.h plus EnhancedActionKeyMapping.h (EnhancedInput; model test only, see README.md).
#pragma once

#include "UObject/Object.h"
#include "InputCoreTypes.h"
#include "InputAction.h"

struct FEnhancedActionKeyMapping
{
	/** Real UE 5: TObjectPtr<const UInputAction> Action; FKey Key; trigger/modifier arrays. */
	TObjectPtr<const UInputAction> Action;
	FKey Key;
	TArray<TObjectPtr<UInputTrigger>> Triggers;
	TArray<TObjectPtr<UInputModifier>> Modifiers;

	FEnhancedActionKeyMapping() = default;
	FEnhancedActionKeyMapping(const UInputAction* InAction, const FKey InKey) : Action(InAction), Key(InKey) {}
};

class UInputMappingContext : public UObject
{
	UE_STUB_CLASS_BODY(UInputMappingContext)

	const TArray<FEnhancedActionKeyMapping>& GetMappings() const { return Mappings; }
	FEnhancedActionKeyMapping& MapKey(const UInputAction* Action, FKey ToKey) { Mappings.Add(FEnhancedActionKeyMapping(Action, ToKey)); return Mappings.Last(); }
	void UnmapKey(const UInputAction* Action, FKey Key) { UE::Stub::Sink(Action, Key); }
	void UnmapAction(const UInputAction* Action) { UE::Stub::Sink(Action); }
	void UnmapAll() { Mappings.Reset(); }
	FText ContextDescription;

private:
	TArray<FEnhancedActionKeyMapping> Mappings;
};

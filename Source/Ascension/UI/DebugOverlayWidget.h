// Project Ascension -- UDebugOverlayWidget: the F1 debug overlay (charter 10.6 "Debug overlay", 7.1, 7.4, 11.3, 14 "Required for review").

#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "DebugOverlayWidget.generated.h"

class UCultivationState;
class UAuraComponent;
class UQiFieldComponent;
class UModifierStack;

/**
 * The reviewer's view (charter 10.6: "every number in Sections 7.1 and 7.4 for every active wisp, the current ladder
 * row, the seeded RNG state, and a log of the last 20 events"). BuildDebugText renders all of that as one multi-line
 * string; WBP_DebugOverlay shows it in a monospace text block and calls RefreshDebugText each frame it is visible.
 * Toggled by AAscensionPlayerController::ToggleDebugOverlay (IA_DebugOverlay, F1 by default).
 *
 * Milestone 0: fully implemented as a pure formatter; every source it reads may be null (the section then says so).
 */
UCLASS(Abstract, Blueprintable)
class ASCENSION_API UDebugOverlayWidget : public UUserWidget
{
	GENERATED_BODY()

public:
	UDebugOverlayWidget(const FObjectInitializer& ObjectInitializer);

	/** The last text produced by RefreshDebugText, for the Blueprint's text block. */
	UPROPERTY(BlueprintReadOnly, Category = "Ascension|Debug")
	FText DebugText;

	/** Append UModifierStack::DumpToString (charter 11.5 "print the effective ModifierStack"); long, so optional. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Debug")
	bool bIncludeModifierStack = true;

	/** Render every 7.1 aura number, every active wisp's 7.4 numbers, the ladder row, RNG seed/position and the last 20 events. Any source may be null. */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Debug")
	FString BuildDebugText(const UCultivationState* State, const UAuraComponent* Aura, const UQiFieldComponent* Field, const UModifierStack* Stack) const;

	/** Resolve the state and stack from UCultivationSubsystem and the components from the owning pawn, build, store in DebugText and return it. */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Debug")
	FString RefreshDebugText();

private:
	static void AppendAuraSection(FString& Out, const UAuraComponent* Aura);
	static void AppendStateSection(FString& Out, const UCultivationState* State);
	static void AppendLadderSection(FString& Out, const UCultivationState* State);
	static void AppendRngSection(FString& Out, const UCultivationState* State);
	static void AppendWispSection(FString& Out, const UQiFieldComponent* Field);
	static void AppendEventSection(FString& Out, const UCultivationState* State);
	static void AppendStackSection(FString& Out, const UModifierStack* Stack);
};

// Project Ascension -- UCultivationHUDWidget: C++ base of the Cultivation HUD (charter 8 "control legend", 10.6, 11.1 "UI/").

#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "GameplayTagContainer.h"
#include "CultivationHUDWidget.generated.h"

class UCultivationState;
class UAuraComponent;
class UInputMappingContext;

/**
 * One line of the control legend (charter 8: "Controls are always shown in a compact legend ... Unavailable actions
 * are never listed"). The line is shown only when RequiredSystem is empty or unlocked for the player's Realm
 * (charter 11.2 "UI visibility is tag-driven"); the key label is read from the mapping context by action asset name
 * so rebinding changes the legend without touching data (charter 8 "no hardcoded key checks").
 */
USTRUCT(BlueprintType)
struct ASCENSION_API FControlLegendEntry
{
	GENERATED_BODY()

	/** Ascension.System.* that must be unlocked; empty = always listed (Exit, Menu). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ascension|HUD", meta = (Categories = "Ascension.System"))
	FGameplayTag RequiredSystem;

	/** Asset name of the UInputAction (e.g. IA_Pulse); the key is looked up in the mapping context. Empty = no key column. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ascension|HUD")
	FName ActionName;

	/** What the action does, in the charter 8 wording. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ascension|HUD")
	FText Description;
};

/**
 * The caption of the field (charter 10.6: "the field is the UI, the HUD is the caption"). Exposes BlueprintReadOnly
 * mirrors of every 10.6 Cultivation HUD field; WBP_CultivationHUD binds its text and bars to them. RefreshFrom copies
 * the numbers from UCultivationState and UAuraComponent; the state label follows the display precedence documented on
 * UAuraComponent (charter 13). The control legend grows with unlocked system tags (charter 8, 11.2).
 *
 * Milestone 0: the class and its mirrors. Milestone 1 authors WBP_CultivationHUD; Milestone 2 adds the Breakthrough
 * readiness rule for the legend; Milestone 3 the Mantra display name from UDA_Mantra; Milestone 7 the tutorial lines.
 */
UCLASS(Abstract, Blueprintable)
class ASCENSION_API UCultivationHUDWidget : public UUserWidget
{
	GENERATED_BODY()

public:
	UCultivationHUDWidget(const FObjectInitializer& ObjectInitializer);

	// -- 10.6 HUD fields (mirrors) ---------------------------------------------------------------------------------------

	/** Current state label (display precedence on UAuraComponent), e.g. "Charging", "Circulation Held", "Meditating". */
	UPROPERTY(BlueprintReadOnly, Category = "Ascension|HUD")
	FText StateText;

	/** "Qi Sensing, 1st Layer" (charter 4 "Minor Realm / Layer" wording). */
	UPROPERTY(BlueprintReadOnly, Category = "Ascension|HUD")
	FText RealmLayerText;

	/** CultivationProgress / ProgressRequired, 0..1. */
	UPROPERTY(BlueprintReadOnly, Category = "Ascension|HUD")
	float Progress01 = 0.0f;

	UPROPERTY(BlueprintReadOnly, Category = "Ascension|HUD")
	float Stability = 1.0f;

	/** Meaningful only when bPurityVisible (charter 7.8: Realm 2+). */
	UPROPERTY(BlueprintReadOnly, Category = "Ascension|HUD")
	float Purity = 1.0f;

	/** Ascension.System.Purity unlocked (charter 5 rule 4: no meter before the player has a reason to care). */
	UPROPERTY(BlueprintReadOnly, Category = "Ascension|HUD")
	bool bPurityVisible = false;

	/** Inner Qi / Qi Reserve (charter 4 naming rule). */
	UPROPERTY(BlueprintReadOnly, Category = "Ascension|HUD")
	float QiReserve = 0.0f;

	UPROPERTY(BlueprintReadOnly, Category = "Ascension|HUD")
	float QiReserveMax = 0.0f;

	UPROPERTY(BlueprintReadOnly, Category = "Ascension|HUD")
	FText MantraName;

	/** -Max..+Max for the circulation ring (direction = sign, strength = magnitude). */
	UPROPERTY(BlueprintReadOnly, Category = "Ascension|HUD")
	float CirculationSigned = 0.0f;

	/** 0..1 for the charge arc. */
	UPROPERTY(BlueprintReadOnly, Category = "Ascension|HUD")
	float PulseCharge = 0.0f;

	/** Four slot labels (charter 8, IA_Technique_1..4); empty slot shows a dash. */
	UPROPERTY(BlueprintReadOnly, Category = "Ascension|HUD")
	TArray<FText> TechniqueSlots;

	/** The newest event log line (charter 10.6 "last event line"). */
	UPROPERTY(BlueprintReadOnly, Category = "Ascension|HUD")
	FText LastEventText;

	/** "Key -- description" lines for every currently available action (charter 8). */
	UPROPERTY(BlueprintReadOnly, Category = "Ascension|HUD")
	TArray<FText> ControlLegend;

	/** The five-line new-game tutorial (charter 10.7). Filled at Milestone 7. */
	UPROPERTY(BlueprintReadOnly, Category = "Ascension|HUD")
	TArray<FText> TutorialLines;

	/** True when the owning pawn has Auto mode requested; the state label carries the "Auto-cultivating" suffix (charter 7.11). */
	UPROPERTY(BlueprintReadOnly, Category = "Ascension|HUD")
	bool bAutoCultivating = false;

	// -- Refresh -------------------------------------------------------------------------------------------------------------

	/** Copy every mirror from the state and the aura (either may be null; missing sources leave defaults). */
	UFUNCTION(BlueprintCallable, Category = "Ascension|HUD")
	void RefreshFrom(const UCultivationState* State, const UAuraComponent* Aura);

	/** Resolve the state from UCultivationSubsystem and the aura from the owning pawn, then RefreshFrom. */
	UFUNCTION(BlueprintCallable, Category = "Ascension|HUD")
	void RefreshFromWorld();

	/** Presentation hook fired after every refresh so the Blueprint can animate changes. */
	UFUNCTION(BlueprintImplementableEvent, Category = "Ascension|HUD")
	void OnRefreshed();

	// -- Shared formatting helpers (also used by UWorldHUDWidget) ------------------------------------------------------------------

	/** "Qi Sensing, 4th Layer" from the state's Realm/Layer and the ladder config's display names. */
	UFUNCTION(BlueprintPure, Category = "Ascension|HUD")
	static FText MakeRealmLayerText(const UCultivationState* State);

	/** Display name of the first key mapped to the action named ActionName in Context; empty when unmapped or Context is null. */
	UFUNCTION(BlueprintPure, Category = "Ascension|HUD")
	static FText FindKeyLabel(const UInputMappingContext* Context, FName ActionName);

	/** The state label per the display precedence documented on UAuraComponent (charter 13). */
	UFUNCTION(BlueprintPure, Category = "Ascension|HUD")
	static FText DescribeAuraState(const UAuraComponent* Aura, const UCultivationState* State);

protected:
	/** Rebuild ControlLegend from LegendEntries, the unlocked system tags and LegendMappingContext (charter 8). */
	void BuildControlLegend(const UCultivationState* State);

	/** IMC_Cultivation, for the key labels. Assigned on WBP_CultivationHUD. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|HUD")
	TObjectPtr<UInputMappingContext> LegendMappingContext;

	/** The charter 8 table; defaults filled in the constructor, editable on the Blueprint. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|HUD")
	TArray<FControlLegendEntry> LegendEntries;
};

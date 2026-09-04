// Project Ascension -- UDebugPanelWidget: the F2 debug panel of L_Test_Cultivation (charter 11.5, 14.2 rule 5).

#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "GameplayTagContainer.h"
#include "Templates/SubclassOf.h"
#include "DebugPanelWidget.generated.h"

class UCultivationSubsystem;
class UCultivationState;
class ACultivationPawn;
class UDA_QiPreset;
class UTribulationDefinition;

/**
 * The panel that lets every milestone be verified without playing from Realm 1 (charter 11.5): set Realm/Layer, set
 * Stability/Purity, spawn a wisp of any preset at any radius, trigger any Tribulation, grant Insight, force
 * Breakthrough, toggle Auto, run the scripted determinism sequence, print the effective ModifierStack. One
 * BlueprintCallable per item; WBP_DebugPanel wires buttons and fields to them. Toggled by
 * AAscensionPlayerController::ToggleDebugPanel (IA_DebugPanel, F2 by default).
 *
 * Charter 14.2 rule 5: functions that drive state directly (SetStability, SetPurity, SetRealmLayer) are model tools,
 * not player input; the determinism sequence (M1) goes through the aura's public input functions like the player.
 *
 * Milestone 0: SetRealmLayer, SetStability, SetPurity, GrantInsight, ToggleAuto, SpawnWispPreset and PrintModifierStack
 * act on the subsystem/pawn; TriggerTribulation (M3), ForceBreakthrough (M2) and RunDeterminismSequence (M1) log
 * "not yet implemented".
 */
UCLASS(Abstract, Blueprintable)
class ASCENSION_API UDebugPanelWidget : public UUserWidget
{
	GENERATED_BODY()

public:
	UDebugPanelWidget(const FObjectInitializer& ObjectInitializer);

	/** Presets offered by the spawn dropdown (DA_QiPreset assets; filled on WBP_DebugPanel). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Debug")
	TArray<TObjectPtr<UDA_QiPreset>> PresetChoices;

	/** Set Realm/Layer (1..9 each): reloads the ladder row and rebuilds the stack (charter 6.6). */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Debug")
	void SetRealmLayer(int32 Realm, int32 Layer);

	/** Set Stability 0..1 on the persisted state and on the live aura when meditating (charter 7.7). */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Debug")
	void SetStability(float Value);

	/** Set Purity 0..1 on the persisted state and on the live aura when meditating (charter 7.8). */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Debug")
	void SetPurity(float Value);

	/** Spawn one wisp of Preset at RadiusFraction x Reach and Angle degrees through the pawn's UQiFieldComponent (charter 7.4). */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Debug")
	void SpawnWispPreset(UDA_QiPreset* Preset, float RadiusFraction, float Angle);

	/** Start the given Tribulation immediately (charter 6.5). Milestone 3. */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Debug")
	void TriggerTribulation(TSubclassOf<UTribulationDefinition> Tribulation);

	/** Add Insight to a Dao (Ascension.Dao.*), or to the generic pool when Dao is empty (charter 9.3). */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Debug")
	void GrantInsight(FGameplayTag Dao, float Amount);

	/** Resolve a Breakthrough as if the roll succeeded (charter 6.4). Milestone 2. */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Debug")
	void ForceBreakthrough();

	/** Toggle automatic cultivation on the cultivation pawn (charter 7.11). */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Debug")
	void ToggleAuto();

	/** Run the scripted input sequence and log the event checksum (charter 11.3). Milestone 1. */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Debug")
	void RunDeterminismSequence();

	/** Return (and log) UModifierStack::DumpToString (charter 11.5). */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Debug")
	FString PrintModifierStack();

protected:
	/** UCultivationSubsystem from the world's game instance; null (logged) when unavailable. */
	UCultivationSubsystem* GetSubsystem() const;

	/** The subsystem's state; null (logged) when unavailable. */
	UCultivationState* GetState() const;

	/** The possessed ACultivationPawn; null when outside meditation (the pawn swap is Milestone 1). */
	ACultivationPawn* GetCultivationPawn() const;
};

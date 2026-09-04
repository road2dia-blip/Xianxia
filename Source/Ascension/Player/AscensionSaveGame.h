// Project Ascension -- UAscensionSaveGame: the save format (charter 10.7, 7.10, 11.3).

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/SaveGame.h"
#include "GameplayTagContainer.h"
#include "AscensionSaveGame.generated.h"

/**
 * The serialized player (charter 10.7): Realm, Layer, Progress, Purity, Stability, Reserve, Corruption, scar state,
 * active Mantra(s), Dao Insight per Dao, unlocked nodes, slotted Techniques, the RNG seed and stream position
 * (charter 7.10 "Rolls use a seeded stream stored in the save so that reloading does not reroll"), world position,
 * time of day, and settings. UCultivationState::ApplyToSave/RestoreFromSave map the cultivation fields; the player
 * controller owns the world fields. Autosave on exit meditation, on Breakthrough, and every AutosaveIntervalSeconds;
 * three manual slots (UAscensionSettings).
 *
 * Milestone 0 declares every field. Milestone 2 implements save/load and the slot UI.
 */
UCLASS(BlueprintType)
class ASCENSION_API UAscensionSaveGame : public USaveGame
{
	GENERATED_BODY()

public:
	UAscensionSaveGame();

	/** Bump when a field changes meaning; RestoreFromSave migrates older versions. */
	static constexpr int32 CurrentSaveVersion = 1;

	// -- Ladder position and meters (charter 6.1, 7.7, 7.8, 7.12) ---------------------------------------------------------

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Save")
	int32 Realm = 1;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Save")
	int32 Layer = 1;

	/** Cultivation Progress toward the next Breakthrough, in Qi units. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Save")
	float Progress = 0.0f;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Save")
	float Purity = 1.0f;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Save")
	float Stability = 1.0f;

	/** Inner Qi / Qi Reserve (charter 4 naming rule). */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Save")
	float Reserve = 0.0f;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Save")
	float Corruption = 0.0f;

	/** DeviationScar active (charter 7.12). */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Save")
	bool bDeviationScar = false;

	// -- Mantras and Daos (charter 9) ---------------------------------------------------------------------------------------

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Save", meta = (Categories = "Ascension.Mantra"))
	FGameplayTag ActiveMantra;

	/** Second Mantra (Realm 8); empty before that. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Save", meta = (Categories = "Ascension.Mantra"))
	FGameplayTag SecondMantra;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Save", meta = (Categories = "Ascension.Dao"))
	TMap<FGameplayTag, float> DaoInsight;

	/** FDaoNode::NodeId of every purchased node. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Save")
	TSet<FName> UnlockedNodes;

	/** Four Technique slots (charter 8). */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Save", meta = (Categories = "Ascension.Dao.Technique"))
	TArray<FGameplayTag> SlottedTechniques;

	// -- Determinism (charter 7.10, 11.3) --------------------------------------------------------------------------------------

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Save|Determinism")
	int32 RngSeed = 0;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Save|Determinism")
	int32 RngPosition = 0;

	// -- World (charter 7.13, 10.1) --------------------------------------------------------------------------------------------

	/** Anchor body location in L_World. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Save|World")
	FVector WorldPosition = FVector::ZeroVector;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Save|World")
	FRotator WorldRotation = FRotator::ZeroRotator;

	/** 0..1 fraction of the ~10-minute day/night cycle (charter 7.13). */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Save|World")
	float TimeOfDay = 0.0f;

	// -- Settings and metadata ---------------------------------------------------------------------------------------------------

	/** Rebinds, audio mix, HUD detail (charter 10.6 Settings page), as name -> serialized value. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Save")
	TMap<FName, FString> Settings;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Save")
	FDateTime SavedAt;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Save")
	int32 SaveVersion = CurrentSaveVersion;
};

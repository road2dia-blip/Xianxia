// Project Ascension -- UCultivationState: the player's progression state (charter 6.6, 7.8, 7.12, 9.3, 10.6, 10.7, 11.1, 11.3).

#pragma once

#include "CoreMinimal.h"
#include "UObject/Object.h"
#include "GameplayTagContainer.h"
#include "Cultivation/CultivationTypes.h"
#include "Cultivation/RealmLadder.h"
#include "CultivationState.generated.h"

class UDataTable;
class UAscensionSaveGame;

/**
 * Everything that persists about the cultivator (charter 11.1: "Realm, Layer, Progress, Stability, Purity, Reserve,
 * Corruption, scars; reads the ladder row; serializable"). Charter 6.6: the state stores Realm and Layer and reads
 * the row; nothing else stores per-Layer numbers. Owned by UCultivationSubsystem (D-0010) so it survives the pawn
 * swap and level transitions.
 *
 * Also holds the last-20 event log for the HUD and debug overlay (charter 10.6) and computes its CRC for the
 * determinism check (charter 11.3). ApplyToSave/RestoreFromSave map every 10.7 field to UAscensionSaveGame.
 *
 * Milestone 0 implements only the pure parts: row lookup, system-unlock lookup, the event log, the checksum and the
 * save mapping. Progress, Stability and Purity are written by the aura/field systems from Milestone 1.
 */
UCLASS(BlueprintType)
class ASCENSION_API UCultivationState : public UObject
{
	GENERATED_BODY()

public:
	UCultivationState();

	/** Number of events kept (charter 10.6 "a log of the last 20 events"). */
	static constexpr int32 EventLogCapacity = 20;

	/** Number of Technique slots (charter 8: IA_Technique_1..4). */
	static constexpr int32 TechniqueSlotCount = 4;

	// -- Ladder position (charter 6.1) ---------------------------------------------------------------------------------

	UPROPERTY(BlueprintReadOnly, VisibleAnywhere, Category = "Ascension|State", meta = (ClampMin = "1", ClampMax = "9"))
	int32 Realm = 1;

	UPROPERTY(BlueprintReadOnly, VisibleAnywhere, Category = "Ascension|State", meta = (ClampMin = "1", ClampMax = "9"))
	int32 Layer = 1;

	// -- Meters (charter 4, 7.7, 7.8, 7.12) ----------------------------------------------------------------------------

	/** Fill toward the next Breakthrough, in Qi units against the row's ProgressRequired. */
	UPROPERTY(BlueprintReadOnly, VisibleAnywhere, Category = "Ascension|State")
	float CultivationProgress = 0.0f;

	/** 0..1 aura coherence, persisted between meditations (charter 7.7). */
	UPROPERTY(BlueprintReadOnly, VisibleAnywhere, Category = "Ascension|State")
	float Stability = 1.0f;

	/** 0..1 Dantian contamination state; 1 and hidden before Realm 2 (charter 7.8). */
	UPROPERTY(BlueprintReadOnly, VisibleAnywhere, Category = "Ascension|State")
	float Purity = 1.0f;

	/** Spendable Inner Qi (never "mana"; charter 4). Capped by the row's QiReserveMax through the stack. */
	UPROPERTY(BlueprintReadOnly, VisibleAnywhere, Category = "Ascension|State")
	float QiReserve = 0.0f;

	/** Persistent Core corruption (Realm 6+, charter 6.2, 7.5). */
	UPROPERTY(BlueprintReadOnly, VisibleAnywhere, Category = "Ascension|State")
	float Corruption = 0.0f;

	/** DeviationScar: halves Insight gain until one clean meditation (charter 7.12). */
	UPROPERTY(BlueprintReadOnly, VisibleAnywhere, Category = "Ascension|State")
	bool bDeviationScar = false;

	/** Seconds left of halved Stability recovery after a Backlash (charter 7.12). Transient. */
	UPROPERTY(BlueprintReadOnly, VisibleAnywhere, Category = "Ascension|State")
	float BacklashRecoveryRemaining = 0.0f;

	// -- Mantras and Daos (charter 9) ------------------------------------------------------------------------------------

	/** Ascension.Mantra.* of the active Mantra (charter 9.1). New game: Ascension.Mantra.Basic (charter 10.7). */
	UPROPERTY(BlueprintReadOnly, VisibleAnywhere, Category = "Ascension|State", meta = (Categories = "Ascension.Mantra"))
	FGameplayTag ActiveMantra;

	/** Second active Mantra (Realm 8, charter 6.2); empty before that. */
	UPROPERTY(BlueprintReadOnly, VisibleAnywhere, Category = "Ascension|State", meta = (Categories = "Ascension.Mantra"))
	FGameplayTag SecondMantra;

	/** Insight per Dao id (charter 9.3). */
	UPROPERTY(BlueprintReadOnly, VisibleAnywhere, Category = "Ascension|State", meta = (Categories = "Ascension.Dao"))
	TMap<FGameplayTag, float> DaoInsight;

	/** The small generic pool at Realms 1-2 that unlocks the first Dao (charter 9.3). */
	UPROPERTY(BlueprintReadOnly, VisibleAnywhere, Category = "Ascension|State")
	float GenericInsight = 0.0f;

	/** FDaoNode::NodeId of every purchased node (charter 9.3). */
	UPROPERTY(BlueprintReadOnly, VisibleAnywhere, Category = "Ascension|State")
	TSet<FName> UnlockedDaoNodes;

	/** Four Technique slots (charter 8), empty tags when unslotted. Always TechniqueSlotCount entries. */
	UPROPERTY(BlueprintReadOnly, VisibleAnywhere, Category = "Ascension|State", meta = (Categories = "Ascension.Dao.Technique"))
	TArray<FGameplayTag> SlottedTechniques;

	// -- Determinism (charter 7.10, 11.3) --------------------------------------------------------------------------------

	/** Seed of the Breakthrough roll stream, stored in the save so reloading does not reroll (charter 7.10). */
	UPROPERTY(BlueprintReadOnly, VisibleAnywhere, Category = "Ascension|State|Determinism")
	int32 RngSeed = 0;

	/** Draws consumed from the stream since the seed (replayed on restore, FSeededStream in Breakthrough.h). */
	UPROPERTY(BlueprintReadOnly, VisibleAnywhere, Category = "Ascension|State|Determinism")
	int32 RngPosition = 0;

	// -- Ladder row and event log ----------------------------------------------------------------------------------------

	/** The current DT_RealmLadder row (charter 6.6). Refreshed by LoadRowFromTable whenever Realm/Layer change. */
	UPROPERTY(BlueprintReadOnly, VisibleAnywhere, Category = "Ascension|State")
	FRealmLayerRow CurrentRow;

	/** The last EventLogCapacity events, oldest first (charter 10.6). */
	UPROPERTY(BlueprintReadOnly, VisibleAnywhere, Category = "Ascension|State|Events")
	TArray<FCultivationEvent> EventLog;

	// -- Functions --------------------------------------------------------------------------------------------------------

	/** Copy row R{Realm}L{Layer} from the table into CurrentRow. Returns false (and keeps the old row) when missing. */
	UFUNCTION(BlueprintCallable, Category = "Ascension|State")
	bool LoadRowFromTable(const UDataTable* Table);

	/** The current ladder row (charter 6.6 "reads the row"). */
	UFUNCTION(BlueprintPure, Category = "Ascension|State")
	const FRealmLayerRow& GetRow() const { return CurrentRow; }

	/** True when any Realm at or below the current one lists the system tag in UnlockedSystems (charter 11.2). Needs SetLadderConfig. */
	UFUNCTION(BlueprintPure, Category = "Ascension|State")
	bool IsSystemUnlocked(FGameplayTag SystemTag) const;

	/** Append an event, dropping the oldest beyond EventLogCapacity (charter 10.6). */
	UFUNCTION(BlueprintCallable, Category = "Ascension|State|Events")
	void PushEvent(const FCultivationEvent& Event);

	/** CRC32 over a deterministic rendering of the event log (tag, time, subject, value; charter 11.3). */
	UFUNCTION(BlueprintPure, Category = "Ascension|State|Events")
	int32 ComputeEventChecksumInt() const { return static_cast<int32>(ComputeEventChecksum()); }

	/** Native form of the checksum (uint32 is not Blueprint-exposable). */
	uint32 ComputeEventChecksum() const;

	/** Write every 10.7 field this object owns into the save (world position, time of day and settings are the controller's). */
	UFUNCTION(BlueprintCallable, Category = "Ascension|State|Save")
	void ApplyToSave(UAscensionSaveGame* Save) const;

	/** Read every 10.7 field this object owns back from the save. The caller reloads the row and rebuilds the stack. */
	UFUNCTION(BlueprintCallable, Category = "Ascension|State|Save")
	void RestoreFromSave(const UAscensionSaveGame* Save);

	/** The ladder config whose Realms decide IsSystemUnlocked (set by UCultivationSubsystem). */
	UFUNCTION(BlueprintCallable, Category = "Ascension|State")
	void SetLadderConfig(const UDA_RealmLadderConfig* InConfig);

	UFUNCTION(BlueprintPure, Category = "Ascension|State")
	const UDA_RealmLadderConfig* GetLadderConfig() const { return LadderConfig; }

	/** The stage grouping of the current Layer (charter 6.1). */
	UFUNCTION(BlueprintPure, Category = "Ascension|State")
	ERealmStage GetStage() const { return URealmLadderLibrary::GetStage(Layer); }

protected:
	/** Source of FRealmDefinition::UnlockedSystems for IsSystemUnlocked. Transient; the subsystem owns the asset. */
	UPROPERTY(Transient, VisibleAnywhere, Category = "Ascension|State")
	TObjectPtr<const UDA_RealmLadderConfig> LadderConfig;
};

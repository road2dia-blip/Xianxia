// Project Ascension -- UCultivationSubsystem: owner of the cultivation state and modifier stack (D-0010; charter 6.6, 11.1, 11.5).

#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "CultivationSubsystem.generated.h"

class UCultivationState;
class UModifierStack;
class UDA_RealmLadderConfig;
class UDataTable;

/**
 * The GameInstance subsystem that owns the player's UCultivationState and UModifierStack (D-0010: the state must
 * survive the world pawn <-> cultivation pawn swap and any level transition). Initialize loads DA_RealmLadderConfig
 * and DT_RealmLadder from UAscensionSettings (Project Settings -> Game -> Ascension) and tolerates missing assets
 * with a LogAscension warning, because at Milestone 0 the owner materialises them with the in-editor setup script
 * (D-0008).
 *
 * SetRealmLayer is the single place the ladder position changes (charter 6.6 "The player's UCultivationState stores
 * Realm and Layer and reads the row"): it reloads the row and pushes the row's numbers into the stack as base values
 * so every system reads Stack->Get(...) (charter 11.1). The F2 panel's "set Realm/Layer" calls it (charter 11.5).
 */
UCLASS()
class ASCENSION_API UCultivationSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	// -- USubsystem ---------------------------------------------------------------------------------------------------------

	virtual void Initialize(FSubsystemCollectionBase& Collection) override;
	virtual void Deinitialize() override;

	// -- Accessors ------------------------------------------------------------------------------------------------------------

	UFUNCTION(BlueprintPure, Category = "Ascension|Cultivation")
	UCultivationState* GetState() const { return State; }

	UFUNCTION(BlueprintPure, Category = "Ascension|Cultivation")
	UModifierStack* GetStack() const { return Stack; }

	UFUNCTION(BlueprintPure, Category = "Ascension|Cultivation")
	UDA_RealmLadderConfig* GetLadderConfig() const { return LadderConfig; }

	UFUNCTION(BlueprintPure, Category = "Ascension|Cultivation")
	UDataTable* GetLadderTable() const { return LadderTable; }

	// -- Entry points ----------------------------------------------------------------------------------------------------------

	/** Set Realm/Layer (1..9 each), reload the ladder row and rebuild the stack's base values. Returns false when no row could be resolved. */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Cultivation")
	bool SetRealmLayer(int32 InRealm, int32 InLayer);

	/** Charter 10.7: Realm 1 Layer 1, Basic Mantra, full Stability and Purity, empty Dantian, fresh seed. */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Cultivation")
	void ResetNewGame();

protected:
	/** The player's progression state (charter 11.1). */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Cultivation")
	TObjectPtr<UCultivationState> State;

	/** The stack every gameplay number is read from (charter 11.1). */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Cultivation")
	TObjectPtr<UModifierStack> Stack;

	/** DA_RealmLadderConfig from UAscensionSettings::LadderConfig; may be null at Milestone 0. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Cultivation")
	TObjectPtr<UDA_RealmLadderConfig> LadderConfig;

	/** DT_RealmLadder from UAscensionSettings::LadderTable; may be null at Milestone 0. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Cultivation")
	TObjectPtr<UDataTable> LadderTable;

private:
	/** Copy every numeric field of the current row into the stack's base values by AscensionProps name, then rebuild. */
	void PushRowToStack();
};

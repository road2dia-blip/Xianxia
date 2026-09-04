// Project Ascension -- Mantras: FMantraModifier, UMantraBehaviour, UDA_Mantra (charter Sections 4, 7.11, 9.1, 9.2, 11.1).

#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "GameplayTagContainer.h"
#include "Templates/SubclassOf.h"
#include "Cultivation/CultivationTypes.h"
#include "Mantra.generated.h"

class UAuraComponent;
class AQiWisp;
class UModifierStack;

/**
 * One modifier entry of a Mantra, exactly charter 9.1 FMantraModifier: a (property, operation, value, condition)
 * tuple applied to the cultivation model through the UModifierStack. Dao nodes reuse this struct (Dao.h) so a
 * Mantra bonus and a Dao node bonus are the same kind of data.
 *
 *  - Property is a canonical AscensionProps name (ModifierStack.h), e.g. PulseChargeDuration, ImpureResistance,
 *    StabilityRecovery. Never a literal read by a system; the stack resolves it (charter 11.1).
 *  - Condition is a tag query over the stack's current Ascension.State.* tags: "circulating CCW"
 *    (Ascension.State.Circulating.CCW), "Stability > 0.8" (Ascension.State.Stability.High, D-0013),
 *    "Layer is Peak" (Ascension.State.Layer.Peak). An empty query always applies.
 */
USTRUCT(BlueprintType)
struct ASCENSION_API FMantraModifier
{
	GENERATED_BODY()

	/** Canonical property name from AscensionProps (e.g. PulseChargeDuration). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ascension|Mantra")
	FName Property;

	/** Add, Multiply or Override (charter 9.1). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ascension|Mantra")
	EModifierOp Op = EModifierOp::Add;

	/** The operand. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ascension|Mantra")
	float Value = 0.0f;

	/** Empty = always applies; otherwise evaluated against the stack's state tags (charter 9.1 "Condition"). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ascension|Mantra")
	FGameplayTagQuery Condition;
};

/**
 * Optional logic hook object for the few Mantras that need more than modifiers (charter 9.1 "behaviour hooks
 * implemented as small Blueprint-implementable functions on a UMantraBehaviour object"): Yin-Yang's shear-band
 * transformation, Stillness' gentle constant pull, Heavenly Light's Pure thread and Impure repulsion, Fire God's
 * drain-while-charging. Charter 9.1: "No Mantra is a percentage-only bonus; each must change what the player does" --
 * the modifiers set the numbers, this object changes the verbs.
 *
 * Instantiated (Outer = the aura's owner) when its Mantra becomes active; the cultivation systems call the hooks.
 * Every hook is a BlueprintNativeEvent whose native default does nothing, so a Blueprint subclass overrides only the
 * hooks it needs. Hooks receive the UAuraComponent and act through its public entry points and exposed state only.
 *
 * Milestone 0: the hooks exist with empty defaults. Behaviours are authored in Milestone 3 (Stillness) and later.
 */
UCLASS(Blueprintable, Abstract)
class ASCENSION_API UMantraBehaviour : public UObject
{
	GENERATED_BODY()

public:
	/** The Mantra became the active Mantra (or the second active Mantra at Realm 8). */
	UFUNCTION(BlueprintNativeEvent, Category = "Ascension|Mantra")
	void OnActivated(UAuraComponent* Aura);
	virtual void OnActivated_Implementation(UAuraComponent* Aura);

	/** The Mantra was swapped out; undo anything OnActivated set up. */
	UFUNCTION(BlueprintNativeEvent, Category = "Ascension|Mantra")
	void OnDeactivated(UAuraComponent* Aura);
	virtual void OnDeactivated_Implementation(UAuraComponent* Aura);

	/** Called every frame while meditating with this Mantra active (e.g. Stillness' pull during Circulation Held). */
	UFUNCTION(BlueprintNativeEvent, Category = "Ascension|Mantra")
	void OnTick(UAuraComponent* Aura, float DeltaTime);
	virtual void OnTick_Implementation(UAuraComponent* Aura, float DeltaTime);

	/** A wisp crossed the inner/outer shear band (Realm 5+, charter 7.2, 9.2 Yin-Yang transformation). */
	UFUNCTION(BlueprintNativeEvent, Category = "Ascension|Mantra")
	void OnWispCrossedShearBand(AQiWisp* Wisp);
	virtual void OnWispCrossedShearBand_Implementation(AQiWisp* Wisp);

	/** A wisp condensed into the Dantian (e.g. Devouring's Corruption accumulation, charter 9.2). */
	UFUNCTION(BlueprintNativeEvent, Category = "Ascension|Mantra")
	void OnWispAbsorbed(AQiWisp* Wisp);
	virtual void OnWispAbsorbed_Implementation(AQiWisp* Wisp);
};

/**
 * DA_Mantra (charter 4 "Mantra", 9.1 UDA_Mantra, 9.2 the eight Mantras): a cultivation method that modifies how the
 * core loop behaves. The player has one active Mantra (two at Realm 8, charter 6.2). A Mantra is a set of
 * FMantraModifier entries plus an optional UMantraBehaviour. Adding a Mantra is adding an asset under
 * Content/Ascension/Data/Mantras/, never new Blueprint logic (charter 5 principle 9).
 *
 * ApplyToStack pushes every modifier into a UModifierStack with SourceId = MantraId's tag name, so swapping Mantras is
 * RemoveModifiersFromSource(old) + ApplyToStack(new). PreferredCirculationDirection feeds Auto mode (charter 7.11
 * "builds circulation in the active Mantra's preferred direction") and Mantra conditions. ConflictTags implement the
 * Realm 8 dual-Mantra rules (Ascension.Mantra.Conflict.*); bSecondSlotOnly marks the Integration Mantra
 * (charter 9.2 "Only usable as the second of two Mantras").
 */
UCLASS(BlueprintType)
class ASCENSION_API UDA_Mantra : public UPrimaryDataAsset
{
	GENERATED_BODY()

public:
	UDA_Mantra();

	/** Ascension.Mantra.* identity; also the ModifierStack SourceId (charter 9.1 MantraId). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Mantra", meta = (Categories = "Ascension.Mantra"))
	FGameplayTag MantraId;

	/** Player-facing name, e.g. "Basic Cultivation Mantra". */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Mantra")
	FText DisplayName;

	/** What changes in play, in the player's words (charter 9.2 "Identity"). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Mantra", meta = (MultiLine = "true"))
	FText Description;

	/** One sentence shown in the UI, e.g. "Breathe, circulate, gather." (charter 9.1, 9.2). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Mantra")
	FText Philosophy;

	/** First Realm at which this Mantra can be selected (charter 9.2 "Realm" column). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Mantra", meta = (ClampMin = "1", ClampMax = "9"))
	int32 RequiredRealm = 1;

	/** -1 counterclockwise (E), 0 no preference, +1 clockwise (Q). Used by Auto mode and by conditions (charter 9.1). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Mantra", meta = (ClampMin = "-1", ClampMax = "1"))
	int32 PreferredCirculationDirection = 0;

	/** The modifier entries (charter 9.1). Each must express the philosophy; none is a bare percentage. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Mantra")
	TArray<FMantraModifier> Modifiers;

	/** Optional behaviour hooks for Mantras that need logic (charter 9.1). Null for modifier-only Mantras. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Mantra")
	TSubclassOf<UMantraBehaviour> Behaviour;

	/** Ascension.Mantra.Conflict.* families; two active Mantras sharing a family conflict (Realm 8, charter 6.2, 9.1). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Mantra", meta = (Categories = "Ascension.Mantra.Conflict"))
	FGameplayTagContainer ConflictTags;

	/** True only for the Integration Mantra: usable as the second of two Mantras, never alone (charter 9.2). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Mantra")
	bool bSecondSlotOnly = false;

	/**
	 * Push every modifier into the stack as an FModifierEntry with SourceId = GetSourceId(). Idempotent: existing
	 * entries from this source are removed first (charter 14.2 rule 2), so re-applying never doubles a bonus.
	 */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Mantra")
	void ApplyToStack(UModifierStack* Stack) const;

	/** The ModifierStack SourceId for this Mantra: MantraId.GetTagName() (e.g. "Ascension.Mantra.Basic"). */
	UFUNCTION(BlueprintPure, Category = "Ascension|Mantra")
	FName GetSourceId() const;

	/** Primary asset type "Mantra" so the asset manager and the Mantra page can enumerate Mantras. */
	virtual FPrimaryAssetId GetPrimaryAssetId() const override;

	/** Primary asset type name shared with GetPrimaryAssetId. */
	static const FPrimaryAssetType PrimaryAssetType;
};

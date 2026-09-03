// Project Ascension - UModifierStack: resolves Mantra/Dao/Realm modifiers into effective values
// (charter Sections 9.1, 11.1 "All gameplay numbers pass through the ModifierStack").

#pragma once

#include "CoreMinimal.h"
#include "UObject/Object.h"
#include "GameplayTagContainer.h"
#include "Cultivation/CultivationTypes.h"
#include "ModifierStack.generated.h"

/**
 * X-macro listing every canonical property name a system may read from the stack (SKELETON_M0 "AscensionProps").
 * Kept as a single list so the extern declarations, the definitions, and the debug dump can never drift apart.
 * Milestone 0 only declares the names; no system reads a raw constant in place of one of these.
 */
#define ASCENSION_PROPERTY_NAMES(X) \
	X(AuraReach) \
	X(MaxCirculationStrength) \
	X(CirculationBuildRate) \
	X(CirculationDecayRate) \
	X(CirculationBrakeRate) \
	X(MomentumRetention) \
	X(OppositionDrainRate) \
	X(CirculationBonus) \
	X(PulseChargeDuration) \
	X(PulseRecoveryDuration) \
	X(PulseBaseSpeed) \
	X(PulseDrawDuration) \
	X(PulseFlashDuration) \
	X(PulseMinReleaseStrength) \
	X(OverchargeGrace) \
	X(OverchargeDrainRate) \
	X(MantraPulseMultiplier) \
	X(DaoPulseMultiplier) \
	X(RefinementStabilityCost) \
	X(StabilityRecovery) \
	X(RejectionThreshold) \
	X(PurityRecovery) \
	X(DantianCapacity) \
	X(QiReserveMax) \
	X(ProgressRequired) \
	X(ProgressGainMultiplier) \
	X(InsightGainMultiplier) \
	X(ImpureResistance) \
	X(CorruptedResistance) \
	X(BacklashProgressLoss) \
	X(BacklashRecovery) \
	X(BreakthroughFailProgressLoss) \
	X(BreakthroughFailStability) \
	X(BreakthroughCooldown) \
	X(MinorBreakthroughBaseChance) \
	X(InnerDensityDecay) \
	X(OuterDensityDecay) \
	X(AmbientWispCount) \
	X(AmbientSpawnInterval) \
	X(ImpureFraction) \
	X(AutoTargetStrength) \
	X(AutoChargeTarget) \
	X(AutoPulseRange) \
	X(AutoStabilityFloor) \
	X(AutoResumeDelay)

/**
 * Canonical property names (charter 9.1 "FName Property", 11.1). Systems read Stack->Get(AscensionProps::X);
 * ladder rows, Mantras, Dao nodes, Realm overrides and scars all address the same names.
 */
namespace AscensionProps
{
#define ASCENSION_DECLARE_PROP(Name) extern ASCENSION_API const FName Name;
	ASCENSION_PROPERTY_NAMES(ASCENSION_DECLARE_PROP)
#undef ASCENSION_DECLARE_PROP

	/** Every canonical name, in declaration order (for the debug dump and the F2 panel). */
	ASCENSION_API const TArray<FName>& AllPropertyNames();
}

/**
 * One modifier applied to one canonical property (charter 9.1: the (property, operation, value, condition) tuple).
 * SourceId identifies who pushed it (a Mantra id, a Dao node id, a Realm id, a scar) so it can be removed as a group.
 */
USTRUCT(BlueprintType)
struct ASCENSION_API FModifierEntry
{
	GENERATED_BODY()

	/** Canonical property name from AscensionProps (e.g. PulseChargeDuration). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ascension|Modifiers")
	FName Property;

	/** Add, Multiply or Override (charter 9.1). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ascension|Modifiers")
	EModifierOp Op = EModifierOp::Add;

	/** The operand. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ascension|Modifiers")
	float Value = 0.0f;

	/** Empty = always applies; otherwise must match the stack's current state tags (e.g. Ascension.State.Circulating.CCW). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ascension|Modifiers")
	FGameplayTagQuery Condition;

	/** Who pushed this entry; RemoveModifiersFromSource removes every entry with this id. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ascension|Modifiers")
	FName SourceId;
};

/**
 * The single place every gameplay number is resolved (charter 11.1: "No system reads a raw constant; it reads
 * Stack.Get(Property)"). Base values come from the ladder row; Mantras, Dao nodes, Realm overrides and scars push
 * FModifierEntry values; the current state tags decide which conditional entries apply (charter 9.1 conditions,
 * D-0013 threshold tags).
 *
 * Resolution per property: start from the base; if any applicable Override exists, the LAST one wins; then add the
 * sum of applicable Add entries; then multiply by the product of applicable Multiply entries.
 * Get() is cached; any mutation marks the cache dirty and the next Get() rebuilds it (charter 11.1 "cached per frame").
 *
 * Fully implemented at Milestone 0: it is a pure calculation (charter 2.1 "prefer C++ for calculations that must be
 * deterministic").
 */
UCLASS(BlueprintType)
class ASCENSION_API UModifierStack : public UObject
{
	GENERATED_BODY()

public:
	/** Set (or replace) the base value of a property. Typically filled from the FRealmLayerRow. */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Modifiers")
	void SetBase(FName Property, float Value);

	/** Push one modifier entry. Entries are kept in push order; the last Override wins. */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Modifiers")
	void AddModifier(const FModifierEntry& Entry);

	/** Remove every entry whose SourceId equals SourceId (e.g. when a Mantra is swapped out). */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Modifiers")
	void RemoveModifiersFromSource(FName SourceId);

	/** Replace the state tags that conditional entries are evaluated against. */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Modifiers")
	void SetStateTags(const FGameplayTagContainer& Tags);

	/** The effective value of a property. Unknown properties resolve from a base of 0 (and are logged at Verbose). */
	UFUNCTION(BlueprintPure, Category = "Ascension|Modifiers")
	float Get(FName Property) const;

	/** Force an immediate rebuild of the cache (normally lazy; useful once per frame or from the debug panel). */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Modifiers")
	void Rebuild();

	/** Multi-line dump of every property: base, applicable entries, effective value (charter 11.5 "print the effective ModifierStack"). */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Modifiers")
	FString DumpToString() const;

	/** Whether a base value has been set for the property. */
	UFUNCTION(BlueprintPure, Category = "Ascension|Modifiers")
	bool HasBase(FName Property) const { return BaseValues.Contains(Property); }

	/** Read access for the debug overlay. */
	const TMap<FName, float>& GetBaseValues() const { return BaseValues; }
	const TArray<FModifierEntry>& GetModifiers() const { return Modifiers; }
	const FGameplayTagContainer& GetStateTags() const { return CurrentStateTags; }

protected:
	/** Base value per property, normally copied from the ladder row (charter 6.6). */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Modifiers")
	TMap<FName, float> BaseValues;

	/** Every pushed entry, in push order. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Modifiers")
	TArray<FModifierEntry> Modifiers;

	/** State tags conditions are matched against (Ascension.State.*, D-0013). */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Modifiers")
	FGameplayTagContainer CurrentStateTags;

private:
	/** Resolve one property from BaseValues + Modifiers + CurrentStateTags (the documented order). */
	float Resolve(FName Property) const;

	/** Rebuild Cache for every known property. const because Get() is const; the cache is mutable. */
	void RebuildCache() const;

	/** Does this entry apply under the current state tags? */
	bool EntryApplies(const FModifierEntry& Entry) const;

	/** Every property that has a base or at least one modifier, in a stable order. */
	void CollectKnownProperties(TArray<FName>& OutNames) const;

	/** Effective value per property. Not reflected: it is a transient cache rebuilt on demand. */
	mutable TMap<FName, float> Cache;

	/** True whenever BaseValues, Modifiers or CurrentStateTags changed since the last rebuild. */
	mutable bool bCacheDirty = true;
};

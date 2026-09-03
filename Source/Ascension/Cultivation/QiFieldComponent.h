// Project Ascension -- UQiFieldComponent: owns the active wisps, ambient spawning, wave propagation and
// draw/settle/absorb/reject (charter 7.3, 7.4, 7.5, 11.1, Section 13 known-good rules).

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "GameplayTagContainer.h"
#include "Templates/SubclassOf.h"
#include "Cultivation/QiWisp.h"
#include "QiFieldComponent.generated.h"

class UAuraComponent;
class UDA_QiPreset;

/** A wisp condensed into the Dantian (charter 7.4 Absorbed). Data is a copy taken before the actor is recycled. */
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnWispAbsorbed, AQiWisp*, Wisp, const FQiWispData&, Data);
/** A wisp flung outward because Stability was below RejectionThreshold on arrival (charter 7.5). */
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnWispRejected, AQiWisp*, Wisp, const FQiWispData&, Data);

/**
 * The Qi field around the cultivator (charter 7.4 "the UQiFieldComponent on the cultivator updates all active wisps
 * each frame"). It owns every AQiWisp (which have no Tick), maintains the ladder row's ambient count by spawning at
 * AmbientSpawnInterval between 0.3 and 0.95 Reach, propagates the Pulse wave from AuraReach to the centre over
 * PulseFlashDuration and applies the 7.3 impulse to each wisp as the front passes it, then settles, absorbs or
 * rejects it. Wisps are affected by circulation only through the field: a bounded tangential drift, never an orbit
 * (charter 2.2, 7.2).
 *
 * Section 13 rules kept here: force-as-wave that agrees with the visual wave; the impulse decays and the wisp settles
 * so far wisps need multiple Pulses; Impure drains Stability while Drawn and is Rejected below the threshold; every
 * Pure/Impure difference is a value set at spawn from the preset.
 *
 * Milestone 0: the component exists, binds to the aura's OnPulseReleased, can spawn/despawn/count wisps for the F2
 * panel (charter 11.5 "spawn a wisp of any preset at any radius"), and ticks a stub. M1 implements the wave and
 * the draw/settle/absorb/reject loop; M2 ambient spawning from the ladder row.
 */
UCLASS(ClassGroup = (Ascension), meta = (BlueprintSpawnableComponent))
class ASCENSION_API UQiFieldComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UQiFieldComponent();

	/** Every live wisp actor (charter 11.4: at most 30). */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Field")
	TArray<TObjectPtr<AQiWisp>> ActiveWisps;

	/** Actor class to spawn; BP_QiWisp adds the mesh, material and FX (charter 11.1). Defaults to AQiWisp. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Field")
	TSubclassOf<AQiWisp> WispClass;

	/** The aura this field belongs to; found on the owner at BeginPlay when unset. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Field")
	TObjectPtr<UAuraComponent> Aura;

	/** Current distance of the inward wave front from the centre while bWaveActive (charter 7.3). */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Field")
	float WaveFrontDistance = 0.0f;

	/** True from a Pulse release until the front reaches the centre. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Field")
	bool bWaveActive = false;

	/** Seconds until the next ambient spawn (charter 7.4). */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Field")
	float SpawnTimer = 0.0f;

	/** Spawn one wisp of a preset at RadiusFraction x AuraReach and AngleDegrees (charter 11.5). Returns null when it cannot spawn. */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Field")
	AQiWisp* SpawnWisp(const UDA_QiPreset* Preset, float RadiusFraction, float AngleDegrees);

	/** Destroy every active wisp. */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Field")
	void DespawnAll();

	/** Bound to UAuraComponent::OnPulseReleased. Starts the inward wave (charter 7.3). M1 implements the wave. */
	UFUNCTION()
	void OnPulseReleased(float ReleaseStrength, bool bRefinement);

	/** Number of active wisps whose Condition equals the tag exactly (Auto mode's Pure/Impure checks, charter 7.11). */
	UFUNCTION(BlueprintPure, Category = "Ascension|Field")
	int32 CountByCondition(FGameplayTag Condition) const;

	/** Smallest DistanceFromCenter among active wisps of that Condition; -1 when there are none (charter 7.11 "closer than the nearest Pure"). */
	UFUNCTION(BlueprintPure, Category = "Ascension|Field")
	float NearestDistanceByCondition(FGameplayTag Condition) const;

	UPROPERTY(BlueprintAssignable, Category = "Ascension|Field|Events")
	FOnWispAbsorbed OnWispAbsorbed;

	UPROPERTY(BlueprintAssignable, Category = "Ascension|Field|Events")
	FOnWispRejected OnWispRejected;

	// -- UActorComponent --------------------------------------------------------------------------------------------------

	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

	/** M0 stub. M1: wave front, per-wisp impulse/settle/absorb/reject; M2: ambient spawning. */
	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;
};

// Project Ascension - Minor Breakthrough maths and the seeded random stream (charter Sections 6.4, 7.10, 10.7, 11.3).
// Pure functions, fully implemented at Milestone 0. The Breakthrough charge sequence, cooldown and state changes are
// Milestone 2 (UCultivationState / UAuraComponent); this file only decides chances and explains failures.

#pragma once

#include "CoreMinimal.h"
#include "Math/RandomStream.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "Cultivation/CultivationTypes.h"
#include "Breakthrough.generated.h"

/**
 * Named constants of the charter's Breakthrough formulas (7.10) and failure thresholds (6.4, 7.7, 7.8).
 * They are part of the formula's definition, not tunables a system reads at runtime; Base, Stability, Purity and the
 * Mantra factor all arrive through the ladder row and the UModifierStack.
 */
namespace BreakthroughFormula
{
	/** StabilityFactor = clamp((Stability - StabilityFactorOffset) / StabilityFactorRange, 0, 1) (charter 7.10). */
	constexpr float StabilityFactorOffset = 0.3f;
	constexpr float StabilityFactorRange = 0.5f;
	/** PurityFactor = clamp((Purity - PurityFactorOffset) / PurityFactorRange, 0, 1), or 1 before Realm 2 (charter 7.10). */
	constexpr float PurityFactorOffset = 0.2f;
	constexpr float PurityFactorRange = 0.6f;
	/** Below this Stability the chance is "heavily penalised" and the failure message names Stability (charter 6.4, 7.7). */
	constexpr float StabilityFailureThreshold = 0.5f;
	/** Below this Purity "Breakthrough chance drops" and the failure message names Purity (charter 6.4, 7.8). */
	constexpr float PurityFailureThreshold = 0.6f;
}

/**
 * Everything the HUD and the event log need about one Minor Breakthrough attempt (charter 6.4 "The failure shows why").
 * Produced by the Milestone 2 attempt logic from ComputeMinorChance, one FSeededStream draw, and DescribeFailure.
 */
USTRUCT(BlueprintType)
struct ASCENSION_API FBreakthroughResult
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Ascension|Breakthrough")
	EBreakthroughOutcome Outcome = EBreakthroughOutcome::NotAttempted;

	/** The chance that was rolled against (0..1). */
	UPROPERTY(BlueprintReadOnly, Category = "Ascension|Breakthrough")
	float Chance = 0.0f;

	/** The seeded draw (0..1); success when Roll < Chance. */
	UPROPERTY(BlueprintReadOnly, Category = "Ascension|Breakthrough")
	float Roll = 0.0f;

	UPROPERTY(BlueprintReadOnly, Category = "Ascension|Breakthrough")
	float StabilityAtAttempt = 0.0f;

	UPROPERTY(BlueprintReadOnly, Category = "Ascension|Breakthrough")
	float PurityAtAttempt = 0.0f;

	/** The attributable reason, e.g. "Breakthrough failed - Stability 0.31 was below 0.5". Empty on success. */
	UPROPERTY(BlueprintReadOnly, Category = "Ascension|Breakthrough")
	FText Reason;
};

/**
 * A seeded random stream whose seed and position are saved (charter 7.10 "Rolls use a seeded stream stored in the save so
 * that reloading does not reroll"; 10.7; 11.3). Wraps FRandomStream: Seed and Position are the persisted state; the stream
 * is re-synchronised lazily by re-initialising from Seed and replaying Position draws whenever the two fields no longer
 * match what the wrapped stream has produced (which is exactly what happens after a load restores them).
 */
USTRUCT(BlueprintType)
struct ASCENSION_API FSeededStream
{
	GENERATED_BODY()

	/** The seed the stream was initialised with. Saved. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ascension|Determinism")
	int32 Seed = 0;

	/** How many draws have been taken since initialisation. Saved. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ascension|Determinism")
	int32 Position = 0;

	FSeededStream() = default;
	explicit FSeededStream(int32 InSeed) { Initialize(InSeed); }

	/** Start a fresh stream at Position 0 from InSeed. */
	void Initialize(int32 InSeed);

	/** Restore a saved (Seed, Position): re-initialise and replay Position draws. */
	void Restore(int32 InSeed, int32 InPosition);

	/** Next draw in [0, 1). Advances Position. */
	float NextFloat();

	/** Next integer in [0, MaxExclusive). Advances Position. MaxExclusive <= 0 returns 0 without advancing. */
	int32 NextInt(int32 MaxExclusive);

	/** Next draw in [Min, Max]. Advances Position. */
	float NextRange(float Min, float Max);

	/** True once the wrapped stream reflects Seed/Position (false right after a reflection-driven restore). */
	bool IsSynced() const { return bSynced && SyncedSeed == Seed && SyncedPosition == Position; }

private:
	/** Bring the wrapped stream to (Seed, Position) if the persisted fields were changed behind our back. */
	void SyncIfNeeded();

	/** The engine stream. Not reflected: it is fully described by Seed and Position. */
	FRandomStream Stream;

	bool bSynced = false;
	int32 SyncedSeed = 0;
	int32 SyncedPosition = 0;
};

/**
 * Minor Breakthrough maths (charter 6.4, 7.10): the success chance from Base, Stability, Purity and the Mantra factor,
 * and the attributable failure message. No state, no side effects; the attempt sequence itself is Milestone 2.
 */
UCLASS()
class ASCENSION_API UBreakthroughLibrary : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:
	/**
	 * Chance = Base x StabilityFactor x PurityFactor x MantraFactor, clamped to 0..1 (charter 7.10).
	 * StabilityFactor = clamp((Stability - 0.3) / 0.5, 0, 1); PurityFactor = clamp((Purity - 0.2) / 0.6, 0, 1), or 1.0
	 * when bPurityActive is false (before Realm 2, where Purity is fixed at 1.0 and hidden).
	 */
	UFUNCTION(BlueprintPure, Category = "Ascension|Breakthrough")
	static float ComputeMinorChance(float Base, float Stability, float Purity, float MantraFactor, bool bPurityActive);

	/** clamp((Stability - 0.3) / 0.5, 0, 1). */
	UFUNCTION(BlueprintPure, Category = "Ascension|Breakthrough")
	static float ComputeStabilityFactor(float Stability);

	/** clamp((Purity - 0.2) / 0.6, 0, 1), or 1.0 when Purity is not yet active. */
	UFUNCTION(BlueprintPure, Category = "Ascension|Breakthrough")
	static float ComputePurityFactor(float Purity, bool bPurityActive);

	/**
	 * The charter 6.4 failure line: "Breakthrough failed - Stability 0.31 was below 0.5" when Stability is below 0.5;
	 * otherwise "Breakthrough failed - Purity 0.44 - Impure Qi resisted condensation" when Purity is active and below 0.6;
	 * otherwise a neutral line that still shows both values, so every failure is attributable.
	 */
	UFUNCTION(BlueprintPure, Category = "Ascension|Breakthrough")
	static FText DescribeFailure(float Stability, float Purity, bool bPurityActive);

	/** Blueprint face of FSeededStream::NextFloat (structs cannot expose member functions to Blueprint). */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Determinism")
	static float SeededStreamNextFloat(UPARAM(ref) FSeededStream& Stream);

	/** Blueprint face of FSeededStream::Restore. */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Determinism")
	static void SeededStreamRestore(UPARAM(ref) FSeededStream& Stream, int32 Seed, int32 Position);
};

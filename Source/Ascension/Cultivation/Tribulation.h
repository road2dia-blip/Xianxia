// Project Ascension -- Tribulations: FSurgeEvent and the UTribulationDefinition base (charter Sections 4, 6.5, 7.12, 11.1, Appendix A).

#pragma once

#include "CoreMinimal.h"
#include "UObject/Object.h"
#include "GameplayTagContainer.h"
#include "Tribulation.generated.h"

class UCultivationState;
class UAuraComponent;
class UQiFieldComponent;

/**
 * One timed surge of a Tribulation's Trial phase, exactly charter Appendix A:
 * FSurgeEvent {time, type, count, radiusFraction, angle, nature, condition, warningLeadSeconds}.
 * A surge spawns Count wisps of (Condition, Nature) at RadiusFraction x AuraReach around Angle at Time seconds into
 * the Trial, after announcing itself WarningLeadSeconds earlier (charter 6.5 "every surge must be visible before it
 * arrives"). Type distinguishes surge kinds that are not plain spawns (pressure waves, counter-rotation, domain
 * shrink, forced resonance) -- the Type tag family is introduced with the first Tribulation in Milestone 3.
 *
 * Clamp note: Appendix A says the warning lead is never below 1.0 s. That floor is applied when the value is read
 * (GetWarningLeadClamped), not through PostEditChangeProperty, so a Blueprint-authored surge list needs no editor
 * hook and the data stays a plain struct.
 */
USTRUCT(BlueprintType)
struct ASCENSION_API FSurgeEvent
{
	GENERATED_BODY()

	/** Appendix A minimum warning lead in seconds (fairness rule, charter 6.5, Milestone 8 review "every surge visible >= 1 s before impact"). */
	static constexpr float MinWarningLeadSeconds = 1.0f;

	/** Seconds into the Trial phase at which the surge lands. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ascension|Tribulation", meta = (ClampMin = "0"))
	float Time = 0.0f;

	/** Surge kind tag (spawn wave, pressure wave, counter-rotation, domain shrink, ...). Empty = plain spawn. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ascension|Tribulation", meta = (Categories = "Ascension"))
	FGameplayTag Type;

	/** Wisps spawned by this surge. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ascension|Tribulation", meta = (ClampMin = "0"))
	int32 Count = 0;

	/** Spawn radius as a fraction of AuraReach (Appendix A uses 0.5-0.9). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ascension|Tribulation", meta = (ClampMin = "0", ClampMax = "1"))
	float RadiusFraction = 0.9f;

	/** Spawn angle in degrees; the Tribulation may randomise around it ("from random angles", Appendix A 1). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ascension|Tribulation")
	float Angle = 0.0f;

	/** Ascension.Qi.Nature.* of the spawned wisps. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ascension|Tribulation", meta = (Categories = "Ascension.Qi.Nature"))
	FGameplayTag Nature;

	/** Ascension.Qi.Condition.* of the spawned wisps. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ascension|Tribulation", meta = (Categories = "Ascension.Qi.Condition"))
	FGameplayTag Condition;

	/** Seconds of visible warning before Time. Read through GetWarningLeadClamped; never below MinWarningLeadSeconds. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ascension|Tribulation", meta = (ClampMin = "1.0"))
	float WarningLeadSeconds = 1.0f;

	/** The warning lead with the Appendix A floor applied. Every consumer reads this, never the raw field. */
	float GetWarningLeadClamped() const { return FMath::Max(MinWarningLeadSeconds, WarningLeadSeconds); }
};

/**
 * Base class of every Tribulation (charter 4 "Tribulation", 6.5 "Major Breakthrough: the Tribulation", Appendix A).
 * A Tribulation is the Major Breakthrough from Layer 9 of Realm r to Layer 1 of Realm r+1: a scripted skill sequence of
 * 45-120 s (DurationSeconds) inside the Cultivation Space, never a random roll, handled with the same tools as normal
 * cultivation (circulation, Pulse, Stability). Referenced from FRealmDefinition::Tribulation; Blueprint-subclassable so
 * the surge patterns are data.
 *
 * Shared structure (charter 6.5):
 *  1. Warning -- field darkens, Dantian pulses, text and sound announce it; the player can cancel at no cost.
 *  2. Trial   -- Surges play out on their Time; EvaluateSuccess / EvaluateFailure are polled every frame; exiting
 *                meditation is blocked (charter 7.13).
 *  3. Resolution -- success: the Major Breakthrough sequence (5-8 s) and the new Realm; failure: Qi Deviation (7.12).
 * Every surge is visible >= FSurgeEvent::MinWarningLeadSeconds before impact and every failure is attributable
 * (SuccessConditionText / FailureConditionText are the player-facing rules the HUD shows).
 *
 * Appendix A starting points for the nine subclasses (Milestones 3-7; kept here so each milestone has them at hand):
 *  1. Coalescence   (R1->R2, 60 s).  Impure surges every 8 s from random angles at 0.9 Reach, three wisps each.
 *     Success: hold one full-charge Pulse (charge >= 0.95) for 2 s while Stability stays >= 0.5 and release it to
 *     absorb >= 3 Pure. Failure: Stability 0 or timer.                                            [Milestone 3]
 *  2. Condensation  (R2->R3, 75 s).  Alternating Yin and Yang waves; Purity starts at 0.8. Success: absorb 20 Qi total
 *     with Purity never below 0.6. Failure: Purity < 0.6 or timer. Teaches the Refinement Pulse.   [Milestone 4]
 *  3. Foundation    (R3->R4, 90 s).  Three pressure waves at 25/50/75 s push wisps outward and try to drop
 *     InnerDensity. Success: InnerDensity >= 0.7 at each wave peak. Failure: density < 0.2 or Stability 0. [Milestone 4]
 *  4. Core Forging  (R4->R5, 90 s).  Field counter-rotates against the player every 15 s; a Metal Qi mass spawns at
 *     0.5 Reach. Success: absorb the mass with >= 0.8-charge Pulses while circulation stays in the player's
 *     direction. Failure: mass escapes to the boundary or Stability 0.                            [Milestone 4]
 *  5. Nascent Birth (R5->R6, 100 s). Success: hold opposing inner/outer layers for a cumulative 30 s while
 *     Stability >= 0.4 and absorb >= 10 Qi transformed at the shear band. Failure: Stability 0.    [Milestone 5]
 *  6. Transformation(R6->R7, 100 s). Corrupted Qi surges. Success: absorb >= 6 Corrupted via Refinement Pulse with
 *     Purity >= 0.4 at the end. Failure: Purity 0 or Corruption >= 1.0.                           [Milestone 5]
 *  7. Void Crossing (R7->R8, 110 s). The Domain shrinks toward the centre at a constant rate; each Pulse pushes the
 *     boundary back by an amount scaled by release strength. Success: boundary >= 0.5 Reach at the end.
 *     Failure: boundary reaches the Dantian.                                                     [Milestone 6]
 *  8. Integration   (R8->R9, 120 s). Resonance forced to peak; Overload rises. Success: absorb >= 30 Qi while keeping
 *     Overload < 1.0 using Circulation Held. Failure: Overload 1.0.                               [Milestone 6]
 *  9. Ascension     (R9, 120 s).     All prior surge types in sequence, then the Ascension Pulse charged and held
 *     10 s at full with Stability >= 0.6, then released. Success ends the game; failure is Qi Deviation to 9.1. [Milestone 7]
 * Appendix B: passable first try by a mastery player who has played the Realm, second or third try by a casual
 * player, never by Auto mode.
 *
 * Milestone 0: base only, no subclasses. The evaluate hooks default to false and OnTrialStarted to nothing.
 */
UCLASS(Blueprintable, Abstract)
class ASCENSION_API UTribulationDefinition : public UObject
{
	GENERATED_BODY()

public:
	/** Identity tag of this Tribulation; the tag family is added with the first subclass (Milestone 3). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Tribulation", meta = (Categories = "Ascension"))
	FGameplayTag TribulationId;

	/** Player-facing name shown in the Warning phase, e.g. "Coalescence". */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Tribulation")
	FText DisplayName;

	/** Length of the Trial phase in seconds (charter 6.5: 45-120, data-defined per Realm). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Tribulation", meta = (ClampMin = "45", ClampMax = "120"))
	float DurationSeconds = 60.0f;

	/** The timed surge list (Appendix A), in ascending Time order. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Tribulation")
	TArray<FSurgeEvent> Surges;

	/** The success rule in the player's words (charter 6.5 "defines a success condition"), shown during the Warning. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Tribulation", meta = (MultiLine = "true"))
	FText SuccessConditionText;

	/** The failure rule in the player's words, shown during the Warning and quoted on failure (charter 5 principle 7). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Tribulation", meta = (MultiLine = "true"))
	FText FailureConditionText;

	/** Polled each Trial frame: has the success condition been met? Native default: false. */
	UFUNCTION(BlueprintNativeEvent, Category = "Ascension|Tribulation")
	bool EvaluateSuccess(const UCultivationState* State, UAuraComponent* Aura, UQiFieldComponent* Field);
	virtual bool EvaluateSuccess_Implementation(const UCultivationState* State, UAuraComponent* Aura, UQiFieldComponent* Field);

	/** Polled each Trial frame: has the failure condition been met (the timer is checked by the caller)? Native default: false. */
	UFUNCTION(BlueprintNativeEvent, Category = "Ascension|Tribulation")
	bool EvaluateFailure(const UCultivationState* State, UAuraComponent* Aura, UQiFieldComponent* Field);
	virtual bool EvaluateFailure_Implementation(const UCultivationState* State, UAuraComponent* Aura, UQiFieldComponent* Field);

	/** The Trial phase began (Warning accepted): set starting values such as Condensation's Purity 0.8. Native default: nothing. */
	UFUNCTION(BlueprintNativeEvent, Category = "Ascension|Tribulation")
	void OnTrialStarted(const UCultivationState* State, UAuraComponent* Aura, UQiFieldComponent* Field);
	virtual void OnTrialStarted_Implementation(const UCultivationState* State, UAuraComponent* Aura, UQiFieldComponent* Field);
};

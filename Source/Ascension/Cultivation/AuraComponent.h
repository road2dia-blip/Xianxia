// Project Ascension -- UAuraComponent: the aura's state, circulation integration, Pulse state machine and FlowPhase
// (charter 7.1, 7.2, 7.3, 7.7, 7.9, 11.1, Section 13 known-good rules).

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Cultivation/CultivationTypes.h"
#include "AuraComponent.generated.h"

class UModifierStack;

/** Fired on every Pulse release (charter 7.3). ReleaseStrength is the floored, Stability-scaled charge; bRefinement marks a Refinement Pulse. */
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnPulseReleased, float, ReleaseStrength, bool, bRefinement);
/** Fired whenever Stability changes (charter 7.7): HUD, audio and the flicker material listen here. */
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnStabilityChanged, float, NewStability);
/** Fired when Stability reaches 0 (charter 7.12 Backlash). */
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnBacklash);

/**
 * The aura: the primary interactive object of the game (charter 5.1, 7.1). Holds every global aura property,
 * integrates circulation from the held inputs (7.2), runs the Pulse state machine (7.3), Stability (7.7), and
 * density layers (7.9), and accumulates FlowPhase for the field visuals. Exposes its numbers so M_AuraField,
 * Niagara and the HUD read them (charter 11.1 "exposes parameters for visuals").
 *
 * Input contract (charter 7.11, 14.2 rule 5): the public Set*/Begin*/Release* entry points are the ONLY way the
 * aura's state changes from outside. The cultivation pawn, UAutoCultivationController and the scripted determinism
 * sequence all call the same functions, so Auto mode and tests are indistinguishable from a player.
 *
 * Every rate is read from the UModifierStack (Stack->Get(AscensionProps::X)); this component owns no raw constants
 * (charter 11.1). Circulation and Pulse integrate with DeltaTime so they are frame-rate independent (charter 11.3).
 *
 * Section 13 known-good rules kept here:
 *  - FlowPhase is accumulated in code from CirculationSigned every tick, never read from shader time.
 *  - Circulation keeps running underneath a Pulse: the two are independent state, integrated in the same tick.
 *  - Circulation Held (both Q and E) is a real, readable state: phase frozen, field dimmed, faster recovery.
 *  - A low-charge release still fires a visible weaker wave (release floors at PulseMinReleaseStrength).
 *  - Write last: every tick reads all inputs into locals, computes, then writes state once.
 *
 * Display precedence of the state machine (which single state label the HUD, drone and field show when several are
 * true at once; charter 13 "the state machine has documented display precedence"), highest first:
 *  1. Backlash / BacklashRecovery (RecoveryRemaining > 0)      -- the failure must be read before anything else.
 *  2. Breakthrough charging                                      -- the whole aura is compressing (charter 6.4).
 *  3. Pulse phase: Releasing > Overcharging > Charging > Recovering (EPulsePhase != Idle).
 *  4. Circulation Held (bCirculationHeld).
 *  5. Circulating CW / CCW (GetCirculationDirection() != None).
 *  6. Meditating (idle aura, charter 10.3 "dim, calm, static").
 * Lower states remain mechanically active underneath higher ones; precedence only chooses the label and the dominant
 * visual/audio layer. Auto-cultivating is a suffix on the label, never a state of its own (charter 7.11).
 */
UCLASS(ClassGroup = (Ascension), meta = (BlueprintSpawnableComponent))
class ASCENSION_API UAuraComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UAuraComponent();

	// -- 7.1 Aura state ------------------------------------------------------------------------------------------------

	/** Radius in Unreal units, from the ladder row through the stack (AscensionProps::AuraReach). */
	UPROPERTY(BlueprintReadOnly, VisibleAnywhere, Category = "Ascension|Aura")
	float AuraReach = 0.0f;

	/** The single integrated circulation value in -Max..+Max; Direction and Strength derive from it (charter 7.1, 7.2). */
	UPROPERTY(BlueprintReadOnly, VisibleAnywhere, Category = "Ascension|Aura")
	float CirculationSigned = 0.0f;

	/** Inner layer circulation (Realm 5+); before that it mirrors CirculationSigned (charter 7.1). */
	UPROPERTY(BlueprintReadOnly, VisibleAnywhere, Category = "Ascension|Aura")
	float InnerCirculationSigned = 0.0f;

	/** 0..1 inner density layer (Realm 3+, charter 7.9). */
	UPROPERTY(BlueprintReadOnly, VisibleAnywhere, Category = "Ascension|Aura")
	float InnerDensity = 0.0f;

	/** 0..1 outer density layer (Realm 3+, charter 7.9). */
	UPROPERTY(BlueprintReadOnly, VisibleAnywhere, Category = "Ascension|Aura")
	float OuterDensity = 0.0f;

	/** 0..1 Pulse charge (charter 7.3). */
	UPROPERTY(BlueprintReadOnly, VisibleAnywhere, Category = "Ascension|Aura")
	float PulseCharge = 0.0f;

	/** 0..1 coherence of the aura (charter 7.7). */
	UPROPERTY(BlueprintReadOnly, VisibleAnywhere, Category = "Ascension|Aura")
	float Stability = 1.0f;

	/** 0..1 Dantian contamination state; fixed at 1 and hidden before Realm 2 (charter 7.8). */
	UPROPERTY(BlueprintReadOnly, VisibleAnywhere, Category = "Ascension|Aura")
	float Purity = 1.0f;

	/** Accumulated in code from CirculationSigned, in turns (wraps into [0,1)); drives all field visuals (charter 7.1, 13). */
	UPROPERTY(BlueprintReadOnly, VisibleAnywhere, Category = "Ascension|Aura")
	float FlowPhase = 0.0f;

	// -- State machine --------------------------------------------------------------------------------------------------

	/** Idle, Charging, Overcharging, Releasing, Recovering (charter 7.3). */
	UPROPERTY(BlueprintReadOnly, VisibleAnywhere, Category = "Ascension|Aura|State")
	EPulsePhase PulsePhase = EPulsePhase::Idle;

	/** Both circulation inputs held: phase frozen, field dims, Stability recovers faster (charter 7.2). */
	UPROPERTY(BlueprintReadOnly, VisibleAnywhere, Category = "Ascension|Aura|State")
	bool bCirculationHeld = false;

	/** Layer modifier held: Q/E drive the inner layer (Realm 5+, charter 7.2, 8). */
	UPROPERTY(BlueprintReadOnly, VisibleAnywhere, Category = "Ascension|Aura|State")
	bool bLayerModifierHeld = false;

	/** Seconds left in Pulse recovery (or Backlash recovery when a Backlash is active; charter 7.3, 7.12). */
	UPROPERTY(BlueprintReadOnly, VisibleAnywhere, Category = "Ascension|Aura|State")
	float RecoveryRemaining = 0.0f;

	// -- Derived getters (charter 7.1) ----------------------------------------------------------------------------------

	/** Sign of CirculationSigned. */
	UFUNCTION(BlueprintPure, Category = "Ascension|Aura")
	ECirculationDirection GetCirculationDirection() const;

	/** |CirculationSigned|, 0..MaxCirculationStrength. */
	UFUNCTION(BlueprintPure, Category = "Ascension|Aura")
	float GetCirculationStrength() const;

	/** PulseCharge x (1 + InnerDensity) (charter 7.1). */
	UFUNCTION(BlueprintPure, Category = "Ascension|Aura")
	float GetPressure() const;

	// -- Input entry points (charter 8; the only way state changes; Auto mode and tests call these) --------------------

	/** IA_Circulate_CW held/released: build toward +Max (charter 7.2). */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Aura|Input")
	void SetCirculateCW(bool bHeld);

	/** IA_Circulate_CCW held/released: build toward -Max (charter 7.2). */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Aura|Input")
	void SetCirculateCCW(bool bHeld);

	/** IA_LayerModifier held/released (Realm 5+, charter 7.2). */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Aura|Input")
	void SetLayerModifier(bool bHeld);

	/** IA_Pulse pressed: start charging (charter 7.3). */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Aura|Input")
	void BeginPulseCharge();

	/** IA_Pulse released: fire the inward wave at the floored release strength (charter 7.3). */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Aura|Input")
	void ReleasePulse();

	/** IA_Pulse double-tapped at full charge (Realm 2+): Refinement Pulse (charter 7.3). */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Aura|Input")
	void DoubleTapPulse();

	/** IA_Breakthrough pressed: start the three-second compression charge (charter 6.4, 6.5). */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Aura|Input")
	void BeginBreakthroughCharge();

	/** IA_Breakthrough released: attempt the Minor Breakthrough or start the Tribulation (charter 6.4, 6.5). */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Aura|Input")
	void ReleaseBreakthrough();

	// -- Delegates ------------------------------------------------------------------------------------------------------

	UPROPERTY(BlueprintAssignable, Category = "Ascension|Aura|Events")
	FOnPulseReleased OnPulseReleased;

	UPROPERTY(BlueprintAssignable, Category = "Ascension|Aura|Events")
	FOnStabilityChanged OnStabilityChanged;

	UPROPERTY(BlueprintAssignable, Category = "Ascension|Aura|Events")
	FOnBacklash OnBacklash;

	// -- Modifier stack ---------------------------------------------------------------------------------------------------

	/** The stack every rate is read from (charter 11.1). Set by the pawn from UCultivationSubsystem::GetStack(). */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Aura")
	void SetStack(UModifierStack* InStack);

	UFUNCTION(BlueprintPure, Category = "Ascension|Aura")
	UModifierStack* GetStack() const { return Stack; }

	/** Held input flags as last written by the entry points (for the debug overlay and Auto mode's take-over check). */
	UFUNCTION(BlueprintPure, Category = "Ascension|Aura|Input")
	bool IsCirculateCWHeld() const { return bCirculateCWHeld; }

	UFUNCTION(BlueprintPure, Category = "Ascension|Aura|Input")
	bool IsCirculateCCWHeld() const { return bCirculateCCWHeld; }

	// -- UActorComponent --------------------------------------------------------------------------------------------------

	/** M0: accumulates FlowPhase from CirculationSigned only. M1 adds circulation, Pulse, Stability and density integration. */
	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

protected:
	/** Rates source (charter 11.1). Never null-dereferenced: every read goes through the stack when present. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Aura")
	TObjectPtr<UModifierStack> Stack;

	/** Raw held state of IA_Circulate_CW, written only by SetCirculateCW. */
	UPROPERTY(VisibleAnywhere, Category = "Ascension|Aura|Input")
	bool bCirculateCWHeld = false;

	/** Raw held state of IA_Circulate_CCW, written only by SetCirculateCCW. */
	UPROPERTY(VisibleAnywhere, Category = "Ascension|Aura|Input")
	bool bCirculateCCWHeld = false;

	/** Wraps a phase in turns into [0,1) without freezing at a bound (a clamp would stall the visual current). */
	static float WrapPhase(float Phase);
};

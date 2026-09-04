// Project Ascension -- UAutoCultivationController: the low-attention cultivator's hands (charter Sections 3.4, 7.11, 11.1, 14.2 rule 5, Appendix B).

#pragma once

#include "CoreMinimal.h"
#include "UObject/Object.h"
#include "AutoCultivationController.generated.h"

class UAuraComponent;
class UQiFieldComponent;
class UCultivationState;
class UModifierStack;
class UDA_Mantra;

/**
 * Automatic cultivation (charter 3.4 "Low-attention cultivator", 7.11). Toggled by IA_AutoCultivate. When enabled it
 * drives the SAME public input functions the cultivation pawn drives on UAuraComponent -- SetCirculateCW/CCW,
 * BeginPulseCharge, ReleasePulse, BeginBreakthroughCharge, ReleaseBreakthrough -- with cautious parameters. It never
 * writes aura, field or state members directly (charter 14.2 rule 5: a test or controller that drives internal flags
 * is a model, not play). "There is no separate idle minigame."
 *
 * Rules Tick will enforce (charter 7.11), every one of them a data value, read from the UModifierStack where a
 * canonical name exists (AscensionProps::AutoTargetStrength, AutoChargeTarget, AutoPulseRange, AutoStabilityFloor,
 * AutoResumeDelay) and from this object's properties otherwise:
 *  1. Build circulation in the active Mantra's PreferredCirculationDirection up to AutoTargetStrength (0.6);
 *     when the Mantra has no preference, clockwise (Q).
 *  2. Charge a Pulse to AutoChargeTarget (0.85) whenever a Pure wisp is within AutoPulseRange and Stability is
 *     above AutoStabilityFloor (0.7); charter 7.7: automatic mode pauses Pulses below Stability 0.5 regardless.
 *  3. Never charge when an Impure wisp is closer than the nearest Pure one, unless the active Mantra handles Impure
 *     safely (Devouring, Yin-Yang while opposed, or a Refinement-capable Keystone).
 *  4. Never overcharge: release at AutoChargeTarget, never past 1.0 + OverchargeGrace.
 *  5. Never attempt a Breakthrough below Stability AutoBreakthroughStability (0.9); always wait for Purity above
 *     AutoBreakthroughPurity (0.7) before attempting.
 *  6. Yield to the player: any manual cultivation input (NotifyManualInput) suspends Auto; it resumes after
 *     AutoResumeDelay (5 s) of no input while still enabled.
 *  7. Be visible: the HUD shows GetStatusText() ("Auto-cultivating (Basic Mantra)") and the aura's inputs animate
 *     exactly as if a cautious player were pressing them.
 *  8. From Realm 5, run at full efficiency when the player is present (charter 6.2 System.AutoFullEfficiency).
 * Appendix B: Auto never triggers Backlash under default settings at any Realm, and never passes a Tribulation.
 *
 * Milestone 0: the object, its tunables, Bind, NotifyManualInput and the status text exist; Tick only advances the
 * manual-input timer. Milestone 1 implements rules 1-4, 6 and 7 at Realm 1; Milestone 2 rule 5; Milestone 5 rule 8.
 */
UCLASS(BlueprintType)
class ASCENSION_API UAutoCultivationController : public UObject
{
	GENERATED_BODY()

public:
	UAutoCultivationController();

	// -- Tunables (charter 7.11 defaults; the stack overrides those with a canonical name) --------------------------------

	/** Circulation strength Auto builds toward (charter 7.11: 0.6). Stack: AscensionProps::AutoTargetStrength. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Auto", meta = (ClampMin = "0", ClampMax = "1"))
	float AutoTargetStrength = 0.6f;

	/** Pulse charge at which Auto releases (charter 7.11: 0.85). Stack: AscensionProps::AutoChargeTarget. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Auto", meta = (ClampMin = "0", ClampMax = "1"))
	float AutoChargeTarget = 0.85f;

	/** A Pure wisp must be within this fraction of AuraReach before Auto charges (charter 7.11 gives no number; 0.6 per D-0024). Stack: AscensionProps::AutoPulseRange. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Auto", meta = (ClampMin = "0", ClampMax = "1"))
	float AutoPulseRange = 0.6f;

	/** Auto does not charge below this Stability (charter 7.11: 0.7). Stack: AscensionProps::AutoStabilityFloor. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Auto", meta = (ClampMin = "0", ClampMax = "1"))
	float AutoStabilityFloor = 0.7f;

	/** Auto never attempts a Breakthrough below this Stability (charter 7.11: 0.9). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Auto", meta = (ClampMin = "0", ClampMax = "1"))
	float AutoBreakthroughStability = 0.9f;

	/** Auto waits for Purity above this before attempting a Breakthrough (charter 7.11: 0.7). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Auto", meta = (ClampMin = "0", ClampMax = "1"))
	float AutoBreakthroughPurity = 0.7f;

	/** Seconds of no manual input before Auto resumes (charter 7.11: 5 s). Stack: AscensionProps::AutoResumeDelay. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Auto", meta = (ClampMin = "0"))
	float AutoResumeDelay = 5.0f;

	// -- Runtime state ----------------------------------------------------------------------------------------------------

	/** The IA_AutoCultivate toggle. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Auto")
	bool bEnabled = false;

	/** Seconds since the player last pressed a cultivation input; Auto acts only when this exceeds AutoResumeDelay. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Auto")
	float TimeSinceManualInput = 0.0f;

	// -- Entry points ----------------------------------------------------------------------------------------------------

	/** Attach to the aura it drives, the field it reads and the state it reads. Safe to call again with new targets. */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Auto")
	void Bind(UAuraComponent* InAura, UQiFieldComponent* InField, UCultivationState* InState);

	/** The active Mantra, for PreferredCirculationDirection, Impure handling and the status text. Null = treated as Basic. */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Auto")
	void SetActiveMantra(const UDA_Mantra* InMantra);

	/**
	 * Advance one frame. May call ONLY UAuraComponent public input functions (SetCirculateCW/CCW, SetLayerModifier,
	 * BeginPulseCharge, ReleasePulse, DoubleTapPulse, BeginBreakthroughCharge, ReleaseBreakthrough) and read the aura,
	 * field and state through their public getters. Milestone 0: advances TimeSinceManualInput only.
	 */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Auto")
	void Tick(float DeltaTime);

	/** The player pressed a cultivation input: Auto yields and restarts its resume timer (charter 7.11). The pawn calls this before forwarding the input to the aura. */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Auto")
	void NotifyManualInput();

	/** Turn Auto on or off (IA_AutoCultivate, the F2 panel's ToggleAuto). Off releases every input Auto was holding. */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Auto")
	void SetEnabled(bool bInEnabled);

	UFUNCTION(BlueprintPure, Category = "Ascension|Auto")
	bool IsEnabled() const { return bEnabled; }

	/** True while Auto is enabled but standing aside for the player (TimeSinceManualInput < AutoResumeDelay). */
	UFUNCTION(BlueprintPure, Category = "Ascension|Auto")
	bool IsYieldingToPlayer() const;

	/** HUD caption: "Auto-cultivating (<Mantra name>)" while enabled, empty otherwise (charter 7.11, 10.6). */
	UFUNCTION(BlueprintPure, Category = "Ascension|Auto")
	FText GetStatusText() const;

	/**
	 * Seed the stack with this object's defaults for every Auto property that has a canonical name and no base yet
	 * (charter 11.1: systems read Stack.Get, never a raw constant; 14.2 rule 2: check before create). The ladder row
	 * does not carry Auto values, so this is where they enter the stack. Returns the number of bases written.
	 */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Auto")
	int32 ApplyDefaultsToStack(UModifierStack* Stack) const;

	UFUNCTION(BlueprintPure, Category = "Ascension|Auto")
	UAuraComponent* GetAura() const { return Aura; }

	UFUNCTION(BlueprintPure, Category = "Ascension|Auto")
	UQiFieldComponent* GetField() const { return Field; }

	UFUNCTION(BlueprintPure, Category = "Ascension|Auto")
	UCultivationState* GetState() const { return State; }

protected:
	/** The aura whose public input functions Auto presses. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Auto")
	TObjectPtr<UAuraComponent> Aura;

	/** Read-only source of wisp distances and conditions (CountByCondition, NearestDistanceByCondition). */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Auto")
	TObjectPtr<UQiFieldComponent> Field;

	/** Read-only source of Progress, Purity and the ladder row. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Auto")
	TObjectPtr<UCultivationState> State;

	/** The active Mantra asset (charter 7.11 "the active Mantra's preferred direction"). */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Auto")
	TObjectPtr<const UDA_Mantra> ActiveMantra;

	/** Release every aura input Auto is holding (used when disabled or yielding). Calls public input functions only. */
	void ReleaseHeldInputs();
};

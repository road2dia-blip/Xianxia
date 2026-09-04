// Project Ascension -- UAutoCultivationController implementation (charter Sections 3.4, 7.11, 14.2 rule 5).

#include "Cultivation/AutoCultivationController.h"
#include "Cultivation/AuraComponent.h"
#include "Cultivation/QiFieldComponent.h"
#include "Cultivation/CultivationState.h"
#include "Cultivation/ModifierStack.h"
#include "Cultivation/Mantra.h"
#include "AscensionLog.h"

#define LOCTEXT_NAMESPACE "AscensionAutoCultivation"

UAutoCultivationController::UAutoCultivationController()
{
}

void UAutoCultivationController::Bind(UAuraComponent* InAura, UQiFieldComponent* InField, UCultivationState* InState)
{
	if (Aura && Aura != InAura)
	{
		// Let go of the previous aura before switching hands (charter 14.2 rule 5: only public inputs).
		ReleaseHeldInputs();
	}

	Aura = InAura;
	Field = InField;
	State = InState;

	UE_LOG(LogAscension, Verbose, TEXT("UAutoCultivationController::Bind: aura=%s field=%s state=%s"),
		Aura ? *Aura->GetName() : TEXT("null"),
		Field ? *Field->GetName() : TEXT("null"),
		State ? *State->GetName() : TEXT("null"));
}

void UAutoCultivationController::SetActiveMantra(const UDA_Mantra* InMantra)
{
	ActiveMantra = InMantra;
}

void UAutoCultivationController::Tick(float DeltaTime)
{
	if (DeltaTime <= 0.0f)
	{
		return;
	}

	// Cap so a long pause does not overflow; anything past the resume delay reads the same.
	TimeSinceManualInput = FMath::Min(TimeSinceManualInput + DeltaTime, AutoResumeDelay + 1.0f);

	if (!bEnabled || !Aura || IsYieldingToPlayer())
	{
		return;
	}

	// TODO(M1): rules 1-4, 6 and 7 of the header comment at Realm 1 -- circulation toward the Mantra's preferred
	// direction up to AutoTargetStrength, Pulse charge to AutoChargeTarget when a Pure wisp is within AutoPulseRange
	// and Stability is above AutoStabilityFloor, no charge when an Impure wisp is nearer than the nearest Pure one,
	// never overcharge -- driving Aura->SetCirculateCW/CCW, BeginPulseCharge and ReleasePulse only, with every
	// threshold read from the stack (Aura->GetStack()->Get(AscensionProps::Auto*)).
	// TODO(M2): rule 5 -- Breakthrough attempts only at Stability >= AutoBreakthroughStability and
	// Purity > AutoBreakthroughPurity, through BeginBreakthroughCharge/ReleaseBreakthrough.
	// TODO(M5): rule 8 -- full efficiency when the player is present (System.AutoFullEfficiency).
}

void UAutoCultivationController::NotifyManualInput()
{
	// The pawn calls this BEFORE forwarding the input to the aura, so nothing is released here: a release now could
	// clear the very key the player just pressed. Auto simply stands aside; M1's Tick lets go of only the inputs Auto
	// itself was holding on the frame it starts yielding.
	if (bEnabled && !IsYieldingToPlayer())
	{
		UE_LOG(LogAscension, Verbose, TEXT("UAutoCultivationController: manual input; yielding for %.1f s."), AutoResumeDelay);
	}
	TimeSinceManualInput = 0.0f;
	// TODO(M1): release the inputs Auto was holding (tracked in its own flags) without touching the player's.
}

void UAutoCultivationController::SetEnabled(bool bInEnabled)
{
	if (bEnabled == bInEnabled)
	{
		return;
	}

	bEnabled = bInEnabled;

	if (!bEnabled)
	{
		ReleaseHeldInputs();
	}
	else
	{
		// Start yielded so toggling on never fires a Pulse on the same frame as the keypress.
		TimeSinceManualInput = 0.0f;
	}

	UE_LOG(LogAscension, Log, TEXT("UAutoCultivationController: %s."), bEnabled ? TEXT("enabled") : TEXT("disabled"));
}

bool UAutoCultivationController::IsYieldingToPlayer() const
{
	return TimeSinceManualInput < AutoResumeDelay;
}

FText UAutoCultivationController::GetStatusText() const
{
	if (!bEnabled)
	{
		return FText::GetEmpty();
	}

	// A new game starts with the Basic Mantra (charter 10.7); before a Mantra asset is bound that is the name shown.
	const FText MantraName = (ActiveMantra && !ActiveMantra->DisplayName.IsEmpty())
		? ActiveMantra->DisplayName
		: LOCTEXT("AutoDefaultMantra", "Basic Mantra");

	return FText::Format(LOCTEXT("AutoStatus", "Auto-cultivating ({0})"), MantraName);
}

int32 UAutoCultivationController::ApplyDefaultsToStack(UModifierStack* Stack) const
{
	if (!Stack)
	{
		UE_LOG(LogAscension, Warning, TEXT("UAutoCultivationController::ApplyDefaultsToStack: null stack."));
		return 0;
	}

	// Only the five Auto values with canonical names go through the stack; the two Breakthrough gates stay here (see DECISIONS).
	struct FAutoDefault
	{
		FName Name;
		float Value;
	};
	const FAutoDefault Defaults[] =
	{
		{ AscensionProps::AutoTargetStrength, AutoTargetStrength },
		{ AscensionProps::AutoChargeTarget, AutoChargeTarget },
		{ AscensionProps::AutoPulseRange, AutoPulseRange },
		{ AscensionProps::AutoStabilityFloor, AutoStabilityFloor },
		{ AscensionProps::AutoResumeDelay, AutoResumeDelay },
	};

	int32 Written = 0;
	for (const FAutoDefault& Default : Defaults)
	{
		// Check before create (charter 14.2 rule 2): a base already set by a row, a Realm override or the panel wins.
		if (!Stack->HasBase(Default.Name))
		{
			Stack->SetBase(Default.Name, Default.Value);
			++Written;
		}
	}

	return Written;
}

void UAutoCultivationController::ReleaseHeldInputs()
{
	if (!Aura)
	{
		return;
	}

	// Public input functions only (charter 14.2 rule 5). Releasing an input that is not held is a no-op on the aura.
	Aura->SetCirculateCW(false);
	Aura->SetCirculateCCW(false);
	Aura->SetLayerModifier(false);

	// TODO(M1): if Auto was mid-charge, ReleasePulse() here so a Pulse is never left charging without a hand on it.
}

#undef LOCTEXT_NAMESPACE

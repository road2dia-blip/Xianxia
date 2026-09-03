// Project Ascension -- UAuraComponent implementation (charter 7.1-7.3, 7.7, Section 13).

#include "Cultivation/AuraComponent.h"
#include "Cultivation/ModifierStack.h"
#include "AscensionLog.h"

UAuraComponent::UAuraComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
	PrimaryComponentTick.bStartWithTickEnabled = true;
}

ECirculationDirection UAuraComponent::GetCirculationDirection() const
{
	if (CirculationSigned > 0.0f)
	{
		return ECirculationDirection::Clockwise;
	}
	if (CirculationSigned < 0.0f)
	{
		return ECirculationDirection::Counterclockwise;
	}
	return ECirculationDirection::None;
}

float UAuraComponent::GetCirculationStrength() const
{
	return FMath::Abs(CirculationSigned);
}

float UAuraComponent::GetPressure() const
{
	// Charter 7.1: Pressure = PulseCharge x (1 + InnerDensity).
	return PulseCharge * (1.0f + InnerDensity);
}

void UAuraComponent::SetCirculateCW(bool bHeld)
{
	bCirculateCWHeld = bHeld;
	bCirculationHeld = bCirculateCWHeld && bCirculateCCWHeld;
	// TODO(M1): build/decay/brake integration of CirculationSigned toward +Max (charter 7.2) happens in TickComponent from these flags.
}

void UAuraComponent::SetCirculateCCW(bool bHeld)
{
	bCirculateCCWHeld = bHeld;
	bCirculationHeld = bCirculateCWHeld && bCirculateCCWHeld;
	// TODO(M1): build/decay/brake integration of CirculationSigned toward -Max (charter 7.2) happens in TickComponent from these flags.
}

void UAuraComponent::SetLayerModifier(bool bHeld)
{
	bLayerModifierHeld = bHeld;
	// TODO(M5): route Q/E to InnerCirculationSigned while held (charter 7.2 split circulation).
}

void UAuraComponent::BeginPulseCharge()
{
	// TODO(M1): enter Charging unless Recovering; charge over PulseChargeDuration; Overcharging after OverchargeGrace (charter 7.3).
	UE_LOG(LogAscension, Verbose, TEXT("UAuraComponent::BeginPulseCharge: not yet implemented (M1)."));
}

void UAuraComponent::ReleasePulse()
{
	// TODO(M1): ReleaseStrength = max(PulseMinReleaseStrength, PulseCharge x Stability scaling); broadcast OnPulseReleased; enter Releasing then Recovering (charter 7.3, 7.7).
	UE_LOG(LogAscension, Verbose, TEXT("UAuraComponent::ReleasePulse: not yet implemented (M1)."));
}

void UAuraComponent::DoubleTapPulse()
{
	// TODO(M3): Refinement Pulse at full charge when Ascension.System.RefinementPulse is unlocked (charter 7.3, Realm 2+).
	UE_LOG(LogAscension, Verbose, TEXT("UAuraComponent::DoubleTapPulse: not yet implemented (M3)."));
}

void UAuraComponent::BeginBreakthroughCharge()
{
	// TODO(M2): three-second compression charge when CultivationProgress >= ProgressRequired (charter 6.4).
	UE_LOG(LogAscension, Verbose, TEXT("UAuraComponent::BeginBreakthroughCharge: not yet implemented (M2)."));
}

void UAuraComponent::ReleaseBreakthrough()
{
	// TODO(M2): Minor Breakthrough roll via UBreakthroughLibrary; TODO(M3): Tribulation start from Layer 9 (charter 6.4, 6.5).
	UE_LOG(LogAscension, Verbose, TEXT("UAuraComponent::ReleaseBreakthrough: not yet implemented (M2)."));
}

void UAuraComponent::SetStack(UModifierStack* InStack)
{
	Stack = InStack;
}

float UAuraComponent::WrapPhase(float Phase)
{
	float Wrapped = FMath::Fmod(Phase, 1.0f);
	if (Wrapped < 0.0f)
	{
		Wrapped += 1.0f;
	}
	return Wrapped;
}

void UAuraComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	// Read everything first, write once at the end (charter 13 "write last").
	const float CirculationNow = CirculationSigned;
	const bool bHeldNow = bCirculationHeld;

	// Charter 7.1 / 13: FlowPhase is accumulated in code, never shader time. Circulation Held freezes the phase (charter 7.2).
	const float PhaseDelta = bHeldNow ? 0.0f : CirculationNow * DeltaTime;
	const float NewFlowPhase = WrapPhase(FlowPhase + PhaseDelta);

	// TODO(M1): integrate CirculationSigned (build/decay/brake from the stack rates), the Pulse phases, Stability recovery
	// and drains, RecoveryRemaining, and the D-0013 state tags. Nothing else changes at Milestone 0.

	FlowPhase = NewFlowPhase;
}

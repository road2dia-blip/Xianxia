// Project Ascension - Minor Breakthrough maths and seeded stream (charter Sections 6.4, 7.10, 10.7, 11.3).

#include "Cultivation/Breakthrough.h"
#include "AscensionLog.h"
#include "Internationalization/Text.h"

#define LOCTEXT_NAMESPACE "AscensionBreakthrough"

// ---------------------------------------------------------------------------
// FSeededStream
// ---------------------------------------------------------------------------
void FSeededStream::Initialize(int32 InSeed)
{
	Seed = InSeed;
	Position = 0;
	Stream.Initialize(InSeed);
	bSynced = true;
	SyncedSeed = Seed;
	SyncedPosition = 0;
}

void FSeededStream::Restore(int32 InSeed, int32 InPosition)
{
	Initialize(InSeed);
	// Replay the saved number of draws so the next draw is the one the saved game would have produced (charter 7.10).
	const int32 Replay = FMath::Max(0, InPosition);
	for (int32 Index = 0; Index < Replay; ++Index)
	{
		Stream.GetFraction();
	}
	Position = Replay;
	SyncedPosition = Replay;
}

void FSeededStream::SyncIfNeeded()
{
	if (!IsSynced())
	{
		// Seed/Position were set directly (save restore through reflection, or an edit in the debug panel).
		Restore(Seed, Position);
	}
}

float FSeededStream::NextFloat()
{
	SyncIfNeeded();
	const float Value = Stream.GetFraction();
	++Position;
	SyncedPosition = Position;
	return Value;
}

int32 FSeededStream::NextInt(int32 MaxExclusive)
{
	if (MaxExclusive <= 0)
	{
		return 0;
	}
	// One draw per call so Position stays a plain count of draws.
	const int32 Value = FMath::Min(static_cast<int32>(NextFloat() * static_cast<float>(MaxExclusive)), MaxExclusive - 1);
	return Value;
}

float FSeededStream::NextRange(float Min, float Max)
{
	return Min + (Max - Min) * NextFloat();
}

// ---------------------------------------------------------------------------
// UBreakthroughLibrary
// ---------------------------------------------------------------------------
float UBreakthroughLibrary::ComputeStabilityFactor(float Stability)
{
	return FMath::Clamp((Stability - BreakthroughFormula::StabilityFactorOffset) / BreakthroughFormula::StabilityFactorRange, 0.0f, 1.0f);
}

float UBreakthroughLibrary::ComputePurityFactor(float Purity, bool bPurityActive)
{
	if (!bPurityActive)
	{
		return 1.0f;	// Before Realm 2 Purity is fixed at 1.0 and hidden (charter 7.1, 7.10).
	}
	return FMath::Clamp((Purity - BreakthroughFormula::PurityFactorOffset) / BreakthroughFormula::PurityFactorRange, 0.0f, 1.0f);
}

float UBreakthroughLibrary::ComputeMinorChance(float Base, float Stability, float Purity, float MantraFactor, bool bPurityActive)
{
	const float Chance = Base * ComputeStabilityFactor(Stability) * ComputePurityFactor(Purity, bPurityActive) * MantraFactor;
	// A probability: clamped so a generous Mantra factor cannot exceed certainty (D-0023).
	return FMath::Clamp(Chance, 0.0f, 1.0f);
}

FText UBreakthroughLibrary::DescribeFailure(float Stability, float Purity, bool bPurityActive)
{
	FNumberFormattingOptions TwoDecimals;
	TwoDecimals.SetMinimumFractionalDigits(2).SetMaximumFractionalDigits(2);

	const FText StabilityText = FText::AsNumber(Stability, &TwoDecimals);
	const FText PurityText = FText::AsNumber(Purity, &TwoDecimals);

	// Stability is checked first: it is the stronger factor and the one the low-attention player hits (charter 6.4, 7.7).
	if (Stability < BreakthroughFormula::StabilityFailureThreshold)
	{
		return FText::Format(
			LOCTEXT("FailStability", "Breakthrough failed \u2014 Stability {0} was below {1}"),
			StabilityText,
			FText::AsNumber(BreakthroughFormula::StabilityFailureThreshold, &TwoDecimals));
	}

	if (bPurityActive && Purity < BreakthroughFormula::PurityFailureThreshold)
	{
		return FText::Format(
			LOCTEXT("FailPurity", "Breakthrough failed \u2014 Purity {0} \u2014 Impure Qi resisted condensation"),
			PurityText);
	}

	// Neither threshold was crossed: the roll itself failed. Still show the numbers so the failure is attributable.
	if (bPurityActive)
	{
		return FText::Format(
			LOCTEXT("FailRoll", "Breakthrough failed \u2014 the Dantian did not condense (Stability {0}, Purity {1})"),
			StabilityText,
			PurityText);
	}
	return FText::Format(
		LOCTEXT("FailRollNoPurity", "Breakthrough failed \u2014 the Dantian did not condense (Stability {0})"),
		StabilityText);
}

float UBreakthroughLibrary::SeededStreamNextFloat(FSeededStream& Stream)
{
	return Stream.NextFloat();
}

void UBreakthroughLibrary::SeededStreamRestore(FSeededStream& Stream, int32 Seed, int32 Position)
{
	Stream.Restore(Seed, Position);
}

#undef LOCTEXT_NAMESPACE

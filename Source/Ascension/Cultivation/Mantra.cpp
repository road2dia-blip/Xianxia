// Project Ascension -- Mantra implementation (charter Sections 9.1, 9.2, 11.1).

#include "Cultivation/Mantra.h"
#include "Cultivation/ModifierStack.h"
#include "AscensionLog.h"

// ---------------------------------------------------------------------------
// UMantraBehaviour -- native defaults do nothing; Blueprint subclasses override the hooks they need.
// ---------------------------------------------------------------------------
void UMantraBehaviour::OnActivated_Implementation(UAuraComponent* Aura)
{
	// TODO(M3): Stillness Mantra behaviour is the first to override this (charter 9.2, Milestone 3 Mantra page).
}

void UMantraBehaviour::OnDeactivated_Implementation(UAuraComponent* Aura)
{
	// TODO(M3): undo per-Mantra setup when the Mantra page swaps Mantras.
}

void UMantraBehaviour::OnTick_Implementation(UAuraComponent* Aura, float DeltaTime)
{
	// TODO(M3): Stillness' gentle inward pull during Circulation Held; TODO(M4): Fire God's drain while charging.
}

void UMantraBehaviour::OnWispCrossedShearBand_Implementation(AQiWisp* Wisp)
{
	// TODO(M5): Yin-Yang transformation of Impure Qi crossing the shear band (charter 9.2).
}

void UMantraBehaviour::OnWispAbsorbed_Implementation(AQiWisp* Wisp)
{
	// TODO(M5): Demonic Devouring's doubled Purity loss and Corruption accumulation (charter 9.2).
}

// ---------------------------------------------------------------------------
// UDA_Mantra
// ---------------------------------------------------------------------------
const FPrimaryAssetType UDA_Mantra::PrimaryAssetType(TEXT("Mantra"));

UDA_Mantra::UDA_Mantra()
{
}

FPrimaryAssetId UDA_Mantra::GetPrimaryAssetId() const
{
	return FPrimaryAssetId(PrimaryAssetType, GetFName());
}

FName UDA_Mantra::GetSourceId() const
{
	return MantraId.GetTagName();
}

void UDA_Mantra::ApplyToStack(UModifierStack* Stack) const
{
	if (!Stack)
	{
		UE_LOG(LogAscension, Warning, TEXT("UDA_Mantra::ApplyToStack on %s: null stack; nothing applied."), *GetName());
		return;
	}

	if (!MantraId.IsValid())
	{
		UE_LOG(LogAscension, Warning, TEXT("UDA_Mantra::ApplyToStack on %s: MantraId is not set; the stack needs a SourceId, nothing applied."), *GetName());
		return;
	}

	const FName SourceId = GetSourceId();

	// Charter 14.2 rule 2: check before create. Re-applying the same Mantra replaces its entries instead of stacking them.
	Stack->RemoveModifiersFromSource(SourceId);

	int32 Applied = 0;
	for (const FMantraModifier& Modifier : Modifiers)
	{
		if (Modifier.Property.IsNone())
		{
			UE_LOG(LogAscension, Warning, TEXT("UDA_Mantra::ApplyToStack on %s: a modifier has no Property name; skipped."), *GetName());
			continue;
		}

		FModifierEntry Entry;
		Entry.Property = Modifier.Property;
		Entry.Op = Modifier.Op;
		Entry.Value = Modifier.Value;
		Entry.Condition = Modifier.Condition;
		Entry.SourceId = SourceId;
		Stack->AddModifier(Entry);
		++Applied;
	}

	UE_LOG(LogAscension, Verbose, TEXT("UDA_Mantra::ApplyToStack: %s pushed %d modifier(s) as source %s."), *GetName(), Applied, *SourceId.ToString());
}

// Project Ascension -- UCultivationHUDWidget implementation (charter 8, 10.6, 11.2).

#include "UI/CultivationHUDWidget.h"
#include "Cultivation/CultivationState.h"
#include "Cultivation/CultivationSubsystem.h"
#include "Cultivation/AuraComponent.h"
#include "Cultivation/RealmLadder.h"
#include "Player/CultivationPawn.h"
#include "AscensionGameplayTags.h"
#include "AscensionLog.h"
#include "Engine/GameInstance.h"
#include "Engine/World.h"
#include "GameFramework/Pawn.h"
#include "InputAction.h"
#include "InputMappingContext.h"

#define LOCTEXT_NAMESPACE "CultivationHUD"

namespace
{
	FControlLegendEntry MakeLegendEntry(const FGameplayTag& RequiredSystem, const TCHAR* ActionName, const FText& Description)
	{
		FControlLegendEntry Entry;
		Entry.RequiredSystem = RequiredSystem;
		Entry.ActionName = FName(ActionName);
		Entry.Description = Description;
		return Entry;
	}
}

UCultivationHUDWidget::UCultivationHUDWidget(const FObjectInitializer& ObjectInitializer)
	: Super(ObjectInitializer)
{
	TechniqueSlots.Init(LOCTEXT("EmptySlot", "-"), UCultivationState::TechniqueSlotCount);

	// Charter 8, Cultivation context. Order is the legend order. Unavailable actions are filtered at refresh.
	LegendEntries.Add(MakeLegendEntry(AscensionTags::System_Circulation, TEXT("IA_Circulate_CW"), LOCTEXT("LegendCW", "Hold: build clockwise circulation")));
	LegendEntries.Add(MakeLegendEntry(AscensionTags::System_Circulation, TEXT("IA_Circulate_CCW"), LOCTEXT("LegendCCW", "Hold: build counterclockwise circulation")));
	LegendEntries.Add(MakeLegendEntry(AscensionTags::System_Circulation, TEXT(""), LOCTEXT("LegendHeld", "Hold both: stillness (Circulation Held)")));
	LegendEntries.Add(MakeLegendEntry(AscensionTags::System_Pulse, TEXT("IA_Pulse"), LOCTEXT("LegendPulse", "Hold: charge. Release: Pulse")));
	LegendEntries.Add(MakeLegendEntry(AscensionTags::System_LayerModifier, TEXT("IA_LayerModifier"), LOCTEXT("LegendLayer", "Hold: circulation drives the inner layer")));
	LegendEntries.Add(MakeLegendEntry(AscensionTags::System_Breakthrough, TEXT("IA_Breakthrough"), LOCTEXT("LegendBreakthrough", "Hold 3 s when Progress is full: attempt Breakthrough")));
	LegendEntries.Add(MakeLegendEntry(AscensionTags::System_AutoCultivation, TEXT("IA_AutoCultivate"), LOCTEXT("LegendAuto", "Toggle automatic cultivation")));
	LegendEntries.Add(MakeLegendEntry(AscensionTags::System_Techniques, TEXT("IA_Technique_1"), LOCTEXT("LegendTechnique1", "Technique slot 1")));
	LegendEntries.Add(MakeLegendEntry(AscensionTags::System_Techniques, TEXT("IA_Technique_2"), LOCTEXT("LegendTechnique2", "Technique slot 2")));
	LegendEntries.Add(MakeLegendEntry(AscensionTags::System_Techniques, TEXT("IA_Technique_3"), LOCTEXT("LegendTechnique3", "Technique slot 3")));
	LegendEntries.Add(MakeLegendEntry(AscensionTags::System_Techniques, TEXT("IA_Technique_4"), LOCTEXT("LegendTechnique4", "Technique slot 4")));
	LegendEntries.Add(MakeLegendEntry(FGameplayTag(), TEXT("IA_ExitMeditation"), LOCTEXT("LegendExit", "Exit to the body")));
	LegendEntries.Add(MakeLegendEntry(FGameplayTag(), TEXT("IA_Menu"), LOCTEXT("LegendMenu", "Cultivation menu")));
}

void UCultivationHUDWidget::RefreshFrom(const UCultivationState* State, const UAuraComponent* Aura)
{
	if (State)
	{
		RealmLayerText = MakeRealmLayerText(State);

		const FRealmLayerRow& Row = State->GetRow();
		Progress01 = Row.ProgressRequired > 0.0f ? FMath::Clamp(State->CultivationProgress / Row.ProgressRequired, 0.0f, 1.0f) : 0.0f;
		QiReserve = State->QiReserve;
		QiReserveMax = Row.QiReserveMax;
		bPurityVisible = State->IsSystemUnlocked(AscensionTags::System_Purity);

		// TODO(M3): read UDA_Mantra::DisplayName; until the Mantra assets exist the tag leaf ("Basic") names it.
		if (State->ActiveMantra.IsValid())
		{
			FString Leaf = State->ActiveMantra.GetTagName().ToString();
			int32 DotIndex = INDEX_NONE;
			if (Leaf.FindLastChar(TEXT('.'), DotIndex))
			{
				Leaf.RightChopInline(DotIndex + 1);
			}
			MantraName = FText::Format(LOCTEXT("MantraNameFmt", "{0} Mantra"), FText::FromString(Leaf));
		}
		else
		{
			MantraName = LOCTEXT("NoMantra", "No Mantra");
		}

		TechniqueSlots.SetNum(UCultivationState::TechniqueSlotCount);
		for (int32 Slot = 0; Slot < UCultivationState::TechniqueSlotCount; ++Slot)
		{
			const bool bSlotted = State->SlottedTechniques.IsValidIndex(Slot) && State->SlottedTechniques[Slot].IsValid();
			// TODO(M3): UDaoTechnique::DisplayName; the tag name stands in until Techniques exist.
			TechniqueSlots[Slot] = bSlotted ? FText::FromName(State->SlottedTechniques[Slot].GetTagName()) : LOCTEXT("EmptySlot", "-");
		}

		LastEventText = State->EventLog.Num() > 0 ? State->EventLog.Last().Message : FText::GetEmpty();

		// Stability and Purity persist on the state; the aura's live copies win while meditating (below).
		Stability = State->Stability;
		Purity = State->Purity;
	}

	if (Aura)
	{
		Stability = Aura->Stability;
		Purity = Aura->Purity;
		CirculationSigned = Aura->CirculationSigned;
		PulseCharge = Aura->PulseCharge;

		const ACultivationPawn* Pawn = Cast<ACultivationPawn>(Aura->GetOwner());
		bAutoCultivating = Pawn && Pawn->IsAutoCultivationRequested();
	}

	StateText = DescribeAuraState(Aura, State);
	if (bAutoCultivating)
	{
		// Charter 7.11: "the HUD shows 'Auto-cultivating (Basic Mantra)'"; a suffix, never a state of its own.
		StateText = FText::Format(LOCTEXT("AutoSuffixFmt", "{0} - Auto-cultivating ({1})"), StateText, MantraName);
	}

	BuildControlLegend(State);
	OnRefreshed();
}

void UCultivationHUDWidget::RefreshFromWorld()
{
	const UWorld* World = GetWorld();
	UGameInstance* GameInstance = World ? World->GetGameInstance() : nullptr;
	const UCultivationSubsystem* Subsystem = GameInstance ? GameInstance->GetSubsystem<UCultivationSubsystem>() : nullptr;
	const UCultivationState* State = Subsystem ? Subsystem->GetState() : nullptr;

	const APawn* Pawn = GetOwningPlayerPawn();
	const UAuraComponent* Aura = Pawn ? Pawn->FindComponentByClass<UAuraComponent>() : nullptr;

	RefreshFrom(State, Aura);
}

FText UCultivationHUDWidget::MakeRealmLayerText(const UCultivationState* State)
{
	if (!State)
	{
		return FText::GetEmpty();
	}

	FText RealmName;
	FRealmDefinition Definition;
	const UDA_RealmLadderConfig* Config = State->GetLadderConfig();
	if (Config && Config->GetRealmDefinition(State->Realm, Definition) && !Definition.DisplayName.IsEmpty())
	{
		RealmName = Definition.DisplayName;
	}
	else
	{
		RealmName = FText::Format(LOCTEXT("RealmFallbackFmt", "Realm {0}"), FText::AsNumber(State->Realm));
	}

	// Layers run 1..9 (charter 6.1), so the English ordinal is a three-way choice.
	const TCHAR* Suffix = TEXT("th");
	switch (State->Layer)
	{
	case 1: Suffix = TEXT("st"); break;
	case 2: Suffix = TEXT("nd"); break;
	case 3: Suffix = TEXT("rd"); break;
	default: break;
	}
	const FText Ordinal = FText::FromString(FString::Printf(TEXT("%d%s"), State->Layer, Suffix));

	// Charter 4: written as e.g. "Foundation Establishment, 4th Layer".
	return FText::Format(LOCTEXT("RealmLayerFmt", "{0}, {1} Layer"), RealmName, Ordinal);
}

FText UCultivationHUDWidget::FindKeyLabel(const UInputMappingContext* Context, FName ActionName)
{
	if (!Context || ActionName.IsNone())
	{
		return FText::GetEmpty();
	}

	for (const FEnhancedActionKeyMapping& Mapping : Context->GetMappings())
	{
		if (Mapping.Action && Mapping.Action->GetFName() == ActionName)
		{
			return Mapping.Key.GetDisplayName(false);
		}
	}
	return FText::GetEmpty();
}

FText UCultivationHUDWidget::DescribeAuraState(const UAuraComponent* Aura, const UCultivationState* State)
{
	// Display precedence documented on UAuraComponent (charter 13): the failure first, then the compression, then the
	// Pulse phase, then Held, then circulation, then the idle aura.
	if (State && State->BacklashRecoveryRemaining > 0.0f)
	{
		return LOCTEXT("StateBacklashRecovery", "Backlash recovery");
	}

	if (!Aura)
	{
		return LOCTEXT("StateMeditating", "Meditating");
	}

	// TODO(M2): "Breakthrough charging" when the aura exposes the three-second compression state (charter 6.4).

	switch (Aura->PulsePhase)
	{
	case EPulsePhase::Releasing:    return LOCTEXT("StateReleasing", "Releasing");
	case EPulsePhase::Overcharging: return LOCTEXT("StateOvercharging", "Overcharging");
	case EPulsePhase::Charging:     return LOCTEXT("StateCharging", "Charging");
	case EPulsePhase::Recovering:   return LOCTEXT("StateRecovering", "Recovering");
	case EPulsePhase::Idle:
	default:
		break;
	}

	if (Aura->bCirculationHeld)
	{
		return LOCTEXT("StateHeld", "Circulation Held");
	}

	switch (Aura->GetCirculationDirection())
	{
	case ECirculationDirection::Clockwise:        return LOCTEXT("StateCW", "Circulating clockwise");
	case ECirculationDirection::Counterclockwise: return LOCTEXT("StateCCW", "Circulating counterclockwise");
	case ECirculationDirection::None:
	default:
		break;
	}

	return LOCTEXT("StateMeditating", "Meditating");
}

void UCultivationHUDWidget::BuildControlLegend(const UCultivationState* State)
{
	ControlLegend.Reset();

	if (!LegendMappingContext)
	{
		UE_LOG(LogAscension, Verbose, TEXT("UCultivationHUDWidget: LegendMappingContext unset; the legend lists descriptions without key labels."));
	}

	for (const FControlLegendEntry& Entry : LegendEntries)
	{
		// Charter 8 / 11.2: an action whose system tag is not unlocked is never listed.
		if (Entry.RequiredSystem.IsValid())
		{
			if (!State || !State->IsSystemUnlocked(Entry.RequiredSystem))
			{
				continue;
			}
		}
		// TODO(M2): Breakthrough "appears only when first available" -- also require Progress readiness once Progress is live.

		const FText KeyLabel = FindKeyLabel(LegendMappingContext, Entry.ActionName);
		if (KeyLabel.IsEmpty())
		{
			ControlLegend.Add(Entry.Description);
		}
		else
		{
			ControlLegend.Add(FText::Format(LOCTEXT("LegendLineFmt", "{0} - {1}"), KeyLabel, Entry.Description));
		}
	}
}

#undef LOCTEXT_NAMESPACE

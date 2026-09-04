// Project Ascension -- UDebugPanelWidget implementation (charter 11.5).

#include "UI/DebugPanelWidget.h"
#include "Cultivation/CultivationSubsystem.h"
#include "Cultivation/CultivationState.h"
#include "Cultivation/ModifierStack.h"
#include "Cultivation/AuraComponent.h"
#include "Cultivation/QiFieldComponent.h"
#include "Cultivation/QiWisp.h"
#include "Cultivation/QiPreset.h"
#include "Cultivation/Tribulation.h"
#include "Player/CultivationPawn.h"
#include "AscensionGameplayTags.h"
#include "AscensionLog.h"
#include "Engine/GameInstance.h"
#include "Engine/World.h"

#define LOCTEXT_NAMESPACE "DebugPanel"

UDebugPanelWidget::UDebugPanelWidget(const FObjectInitializer& ObjectInitializer)
	: Super(ObjectInitializer)
{
}

// -- Resolution helpers -------------------------------------------------------------------------------------------------------------

UCultivationSubsystem* UDebugPanelWidget::GetSubsystem() const
{
	const UWorld* World = GetWorld();
	UGameInstance* GameInstance = World ? World->GetGameInstance() : nullptr;
	UCultivationSubsystem* Subsystem = GameInstance ? GameInstance->GetSubsystem<UCultivationSubsystem>() : nullptr;
	if (!Subsystem)
	{
		UE_LOG(LogAscension, Warning, TEXT("UDebugPanelWidget: UCultivationSubsystem unavailable."));
	}
	return Subsystem;
}

UCultivationState* UDebugPanelWidget::GetState() const
{
	UCultivationSubsystem* Subsystem = GetSubsystem();
	UCultivationState* State = Subsystem ? Subsystem->GetState() : nullptr;
	if (Subsystem && !State)
	{
		UE_LOG(LogAscension, Warning, TEXT("UDebugPanelWidget: UCultivationSubsystem has no state."));
	}
	return State;
}

ACultivationPawn* UDebugPanelWidget::GetCultivationPawn() const
{
	return Cast<ACultivationPawn>(GetOwningPlayerPawn());
}

// -- Charter 11.5 items -------------------------------------------------------------------------------------------------------------

void UDebugPanelWidget::SetRealmLayer(int32 Realm, int32 Layer)
{
	UCultivationSubsystem* Subsystem = GetSubsystem();
	if (!Subsystem)
	{
		return;
	}

	const bool bResolved = Subsystem->SetRealmLayer(Realm, Layer);
	UE_LOG(LogAscension, Log, TEXT("DebugPanel: SetRealmLayer(%d, %d) -> %s."), Realm, Layer, bResolved ? TEXT("row loaded, stack rebuilt") : TEXT("no ladder row resolved (DT_RealmLadder / DA_RealmLadderConfig missing?)"));
	// TODO(M2): re-expand the aura to the new Reach and refresh the HUD legend (charter 6.4, 8).
}

void UDebugPanelWidget::SetStability(float Value)
{
	UCultivationState* State = GetState();
	if (!State)
	{
		return;
	}

	const float Clamped = FMath::Clamp(Value, 0.0f, 1.0f);
	State->Stability = Clamped;

	// The aura holds the live copy while meditating (charter 7.7); keep both in step so the field shows the change.
	if (ACultivationPawn* Pawn = GetCultivationPawn())
	{
		if (UAuraComponent* Aura = Pawn->GetAura())
		{
			Aura->Stability = Clamped;
			Aura->OnStabilityChanged.Broadcast(Clamped);
		}
	}
	UE_LOG(LogAscension, Log, TEXT("DebugPanel: Stability set to %.3f."), Clamped);
}

void UDebugPanelWidget::SetPurity(float Value)
{
	UCultivationState* State = GetState();
	if (!State)
	{
		return;
	}

	const float Clamped = FMath::Clamp(Value, 0.0f, 1.0f);
	State->Purity = Clamped;

	if (ACultivationPawn* Pawn = GetCultivationPawn())
	{
		if (UAuraComponent* Aura = Pawn->GetAura())
		{
			Aura->Purity = Clamped;
		}
	}
	UE_LOG(LogAscension, Log, TEXT("DebugPanel: Purity set to %.3f."), Clamped);
}

void UDebugPanelWidget::SpawnWispPreset(UDA_QiPreset* Preset, float RadiusFraction, float Angle)
{
	if (!Preset)
	{
		UE_LOG(LogAscension, Warning, TEXT("DebugPanel: SpawnWispPreset called with no preset."));
		return;
	}

	ACultivationPawn* Pawn = GetCultivationPawn();
	UQiFieldComponent* Field = Pawn ? Pawn->GetQiField() : nullptr;
	if (!Field)
	{
		UE_LOG(LogAscension, Warning, TEXT("DebugPanel: no ACultivationPawn possessed; enter meditation first (pawn swap not yet implemented, M1)."));
		return;
	}

	const AQiWisp* Wisp = Field->SpawnWisp(Preset, RadiusFraction, Angle);
	UE_LOG(LogAscension, Log, TEXT("DebugPanel: SpawnWispPreset(%s, %.2f, %.1f) -> %s."),
		*Preset->GetName(), RadiusFraction, Angle, Wisp ? *Wisp->GetName() : TEXT("spawn failed"));
}

void UDebugPanelWidget::TriggerTribulation(TSubclassOf<UTribulationDefinition> Tribulation)
{
	// TODO(M3): start the Tribulation's Warning phase through the same path IA_Breakthrough takes at Layer 9 (charter 6.5).
	UE_LOG(LogAscension, Log, TEXT("DebugPanel: TriggerTribulation(%s) not yet implemented (M3)."),
		Tribulation ? *Tribulation->GetName() : TEXT("none"));
}

void UDebugPanelWidget::GrantInsight(FGameplayTag Dao, float Amount)
{
	UCultivationState* State = GetState();
	if (!State)
	{
		return;
	}

	FCultivationEvent Event;
	Event.EventTag = AscensionTags::Event_InsightGranted;
	Event.GameTime = GetWorld() ? GetWorld()->GetTimeSeconds() : 0.0f;
	Event.Value = Amount;

	if (Dao.IsValid())
	{
		float& Insight = State->DaoInsight.FindOrAdd(Dao);
		Insight = FMath::Max(0.0f, Insight + Amount);
		Event.SubjectId = Dao.GetTagName();
		Event.Message = FText::Format(LOCTEXT("InsightGrantedFmt", "Granted {0} Insight to {1} (debug)."), FText::AsNumber(Amount), FText::FromName(Dao.GetTagName()));
		UE_LOG(LogAscension, Log, TEXT("DebugPanel: GrantInsight(%s, %.2f) -> %.2f."), *Dao.ToString(), Amount, Insight);
	}
	else
	{
		// Charter 9.3: the small generic pool at Realms 1-2.
		State->GenericInsight = FMath::Max(0.0f, State->GenericInsight + Amount);
		Event.Message = FText::Format(LOCTEXT("GenericInsightGrantedFmt", "Granted {0} generic Insight (debug)."), FText::AsNumber(Amount));
		UE_LOG(LogAscension, Log, TEXT("DebugPanel: GrantInsight(generic, %.2f) -> %.2f."), Amount, State->GenericInsight);
	}

	State->PushEvent(Event);
}

void UDebugPanelWidget::ForceBreakthrough()
{
	// TODO(M2): run the Minor Breakthrough resolution with a forced success (charter 6.4); at Layer 9 hand over to TriggerTribulation.
	UE_LOG(LogAscension, Log, TEXT("DebugPanel: ForceBreakthrough not yet implemented (M2)."));
}

void UDebugPanelWidget::ToggleAuto()
{
	ACultivationPawn* Pawn = GetCultivationPawn();
	if (!Pawn)
	{
		UE_LOG(LogAscension, Warning, TEXT("DebugPanel: ToggleAuto needs a possessed ACultivationPawn; enter meditation first (pawn swap not yet implemented, M1)."));
		return;
	}

	const bool bNowOn = Pawn->ToggleAutoCultivation();
	UE_LOG(LogAscension, Log, TEXT("DebugPanel: ToggleAuto -> %s."), bNowOn ? TEXT("on") : TEXT("off"));
}

void UDebugPanelWidget::RunDeterminismSequence()
{
	// TODO(M1): drive the aura's public input functions with the scripted sequence and log UCultivationState::ComputeEventChecksum (charter 11.3, 14.2 rule 5).
	UE_LOG(LogAscension, Log, TEXT("DebugPanel: RunDeterminismSequence not yet implemented (M1)."));
}

FString UDebugPanelWidget::PrintModifierStack()
{
	UCultivationSubsystem* Subsystem = GetSubsystem();
	const UModifierStack* Stack = Subsystem ? Subsystem->GetStack() : nullptr;
	if (!Stack)
	{
		const FString Missing = TEXT("(no UModifierStack)");
		UE_LOG(LogAscension, Warning, TEXT("DebugPanel: PrintModifierStack -> %s"), *Missing);
		return Missing;
	}

	const FString Dump = Stack->DumpToString();
	UE_LOG(LogAscension, Log, TEXT("DebugPanel: effective ModifierStack:\n%s"), *Dump);
	return Dump;
}

#undef LOCTEXT_NAMESPACE

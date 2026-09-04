// Project Ascension -- UDebugOverlayWidget implementation (charter 7.1, 7.4, 10.6, 11.3).

#include "UI/DebugOverlayWidget.h"
#include "Cultivation/CultivationState.h"
#include "Cultivation/CultivationSubsystem.h"
#include "Cultivation/AuraComponent.h"
#include "Cultivation/QiFieldComponent.h"
#include "Cultivation/QiWisp.h"
#include "Cultivation/QiPreset.h"
#include "Cultivation/ModifierStack.h"
#include "Cultivation/RealmLadder.h"
#include "Engine/GameInstance.h"
#include "Engine/World.h"
#include "GameFramework/Pawn.h"

namespace
{
	template <typename TEnum>
	FString EnumName(TEnum Value)
	{
		const UEnum* Enum = StaticEnum<TEnum>();
		return Enum ? Enum->GetNameStringByValue(static_cast<int64>(Value)) : FString::FromInt(static_cast<int32>(Value));
	}

	FString TagLeaf(const FGameplayTag& Tag)
	{
		if (!Tag.IsValid())
		{
			return TEXT("(none)");
		}
		FString Name = Tag.GetTagName().ToString();
		int32 DotIndex = INDEX_NONE;
		if (Name.FindLastChar(TEXT('.'), DotIndex))
		{
			Name.RightChopInline(DotIndex + 1);
		}
		return Name;
	}

	const TCHAR* BoolText(bool bValue)
	{
		return bValue ? TEXT("true") : TEXT("false");
	}
}

UDebugOverlayWidget::UDebugOverlayWidget(const FObjectInitializer& ObjectInitializer)
	: Super(ObjectInitializer)
{
}

FString UDebugOverlayWidget::BuildDebugText(const UCultivationState* State, const UAuraComponent* Aura, const UQiFieldComponent* Field, const UModifierStack* Stack) const
{
	FString Out;
	Out.Reserve(4096);

	Out += TEXT("=== ASCENSION DEBUG OVERLAY (F1) ===\n");
	AppendAuraSection(Out, Aura);
	AppendStateSection(Out, State);
	AppendLadderSection(Out, State);
	AppendRngSection(Out, State);
	AppendWispSection(Out, Field);
	AppendEventSection(Out, State);
	if (bIncludeModifierStack)
	{
		AppendStackSection(Out, Stack);
	}
	return Out;
}

FString UDebugOverlayWidget::RefreshDebugText()
{
	const UWorld* World = GetWorld();
	UGameInstance* GameInstance = World ? World->GetGameInstance() : nullptr;
	const UCultivationSubsystem* Subsystem = GameInstance ? GameInstance->GetSubsystem<UCultivationSubsystem>() : nullptr;
	const UCultivationState* State = Subsystem ? Subsystem->GetState() : nullptr;
	const UModifierStack* Stack = Subsystem ? Subsystem->GetStack() : nullptr;

	const APawn* Pawn = GetOwningPlayerPawn();
	const UAuraComponent* Aura = Pawn ? Pawn->FindComponentByClass<UAuraComponent>() : nullptr;
	const UQiFieldComponent* Field = Pawn ? Pawn->FindComponentByClass<UQiFieldComponent>() : nullptr;

	const FString Text = BuildDebugText(State, Aura, Field, Stack);
	DebugText = FText::FromString(Text);
	return Text;
}

void UDebugOverlayWidget::AppendAuraSection(FString& Out, const UAuraComponent* Aura)
{
	Out += TEXT("\n-- AURA (charter 7.1) --\n");
	if (!Aura)
	{
		Out += TEXT("  (no UAuraComponent on the possessed pawn; outside meditation or pawn swap pending, M1)\n");
		return;
	}

	Out += FString::Printf(TEXT("  AuraReach              %.1f\n"), Aura->AuraReach);
	Out += FString::Printf(TEXT("  CirculationDirection   %s\n"), *EnumName(Aura->GetCirculationDirection()));
	Out += FString::Printf(TEXT("  CirculationStrength    %.3f\n"), Aura->GetCirculationStrength());
	Out += FString::Printf(TEXT("  CirculationSigned      %.3f\n"), Aura->CirculationSigned);
	Out += FString::Printf(TEXT("  InnerDensity           %.3f\n"), Aura->InnerDensity);
	Out += FString::Printf(TEXT("  OuterDensity           %.3f\n"), Aura->OuterDensity);
	Out += FString::Printf(TEXT("  InnerCirculationSigned %.3f\n"), Aura->InnerCirculationSigned);
	Out += FString::Printf(TEXT("  PulseCharge            %.3f\n"), Aura->PulseCharge);
	Out += FString::Printf(TEXT("  Stability              %.3f\n"), Aura->Stability);
	Out += FString::Printf(TEXT("  Purity                 %.3f\n"), Aura->Purity);
	Out += FString::Printf(TEXT("  Pressure               %.3f\n"), Aura->GetPressure());
	Out += FString::Printf(TEXT("  FlowPhase              %.4f\n"), Aura->FlowPhase);
	Out += FString::Printf(TEXT("  PulsePhase             %s\n"), *EnumName(Aura->PulsePhase));
	Out += FString::Printf(TEXT("  CirculationHeld        %s\n"), BoolText(Aura->bCirculationHeld));
	Out += FString::Printf(TEXT("  LayerModifierHeld      %s\n"), BoolText(Aura->bLayerModifierHeld));
	Out += FString::Printf(TEXT("  RecoveryRemaining      %.2f s\n"), Aura->RecoveryRemaining);
	Out += FString::Printf(TEXT("  Inputs: CW %s  CCW %s\n"), BoolText(Aura->IsCirculateCWHeld()), BoolText(Aura->IsCirculateCCWHeld()));
}

void UDebugOverlayWidget::AppendStateSection(FString& Out, const UCultivationState* State)
{
	Out += TEXT("\n-- CULTIVATION STATE --\n");
	if (!State)
	{
		Out += TEXT("  (UCultivationSubsystem has no state)\n");
		return;
	}

	Out += FString::Printf(TEXT("  Realm.Layer            %d.%d (%s)\n"), State->Realm, State->Layer, *EnumName(State->GetStage()));
	Out += FString::Printf(TEXT("  Progress               %.2f / %.2f\n"), State->CultivationProgress, State->GetRow().ProgressRequired);
	Out += FString::Printf(TEXT("  Stability (persisted)  %.3f\n"), State->Stability);
	Out += FString::Printf(TEXT("  Purity (persisted)     %.3f\n"), State->Purity);
	Out += FString::Printf(TEXT("  QiReserve              %.2f / %.2f\n"), State->QiReserve, State->GetRow().QiReserveMax);
	Out += FString::Printf(TEXT("  Corruption             %.3f\n"), State->Corruption);
	Out += FString::Printf(TEXT("  DeviationScar          %s\n"), BoolText(State->bDeviationScar));
	Out += FString::Printf(TEXT("  BacklashRecovery       %.1f s\n"), State->BacklashRecoveryRemaining);
	Out += FString::Printf(TEXT("  ActiveMantra           %s\n"), *State->ActiveMantra.ToString());
	Out += FString::Printf(TEXT("  SecondMantra           %s\n"), *State->SecondMantra.ToString());
	Out += FString::Printf(TEXT("  GenericInsight         %.2f\n"), State->GenericInsight);
	for (const TPair<FGameplayTag, float>& Pair : State->DaoInsight)
	{
		Out += FString::Printf(TEXT("  Insight[%s]  %.2f\n"), *TagLeaf(Pair.Key), Pair.Value);
	}
	Out += FString::Printf(TEXT("  UnlockedDaoNodes       %d\n"), State->UnlockedDaoNodes.Num());
	for (int32 Slot = 0; Slot < State->SlottedTechniques.Num(); ++Slot)
	{
		Out += FString::Printf(TEXT("  Technique[%d]           %s\n"), Slot + 1, *TagLeaf(State->SlottedTechniques[Slot]));
	}
}

void UDebugOverlayWidget::AppendLadderSection(FString& Out, const UCultivationState* State)
{
	Out += TEXT("\n-- LADDER ROW (charter 6.6) --\n");
	if (!State)
	{
		Out += TEXT("  (no state)\n");
		return;
	}
	Out += TEXT("  ");
	Out += URealmLadderLibrary::RowToString(State->GetRow());
	Out += TEXT("\n");
}

void UDebugOverlayWidget::AppendRngSection(FString& Out, const UCultivationState* State)
{
	Out += TEXT("\n-- SEEDED RNG (charter 7.10, 11.3) --\n");
	if (!State)
	{
		Out += TEXT("  (no state)\n");
		return;
	}
	Out += FString::Printf(TEXT("  Seed %d  Position %d\n"), State->RngSeed, State->RngPosition);
}

void UDebugOverlayWidget::AppendWispSection(FString& Out, const UQiFieldComponent* Field)
{
	Out += TEXT("\n-- QI FIELD / WISPS (charter 7.4) --\n");
	if (!Field)
	{
		Out += TEXT("  (no UQiFieldComponent on the possessed pawn)\n");
		return;
	}

	Out += FString::Printf(TEXT("  Wave: active %s  front %.1f   SpawnTimer %.2f s   ActiveWisps %d\n"),
		BoolText(Field->bWaveActive), Field->WaveFrontDistance, Field->SpawnTimer, Field->ActiveWisps.Num());

	int32 Index = 0;
	for (const TObjectPtr<AQiWisp>& Wisp : Field->ActiveWisps)
	{
		if (!Wisp)
		{
			Out += FString::Printf(TEXT("  [%02d] (null)\n"), Index++);
			continue;
		}
		const FQiWispData& D = Wisp->Data;
		Out += FString::Printf(TEXT("  [%02d] %s/%s %s  dist %.1f  ang %.1f  QiValue %.2f  Resist %.2f  Drain %.3f/s  PurityImpact %.3f\n"),
			Index, *TagLeaf(D.Condition), *TagLeaf(D.Nature), *EnumName(D.State),
			D.DistanceFromCenter, D.Angle, D.QiValue, D.Resistance, D.StabilityDrainRate, D.PurityImpact);
		Out += FString::Printf(TEXT("       absorb %.2f  drift %.1f  jitter %.2f  inward %.1f  spawned %.1f  preset %s\n"),
			D.AbsorptionProgress, D.DriftAngle, D.JitterAmplitude, D.InwardVelocity, D.SpawnTime,
			D.Preset ? *D.Preset->GetName() : TEXT("(none)"));
		Out += FString::Printf(TEXT("       visual: color (%.2f %.2f %.2f) bright %.2f noise %.2f flicker %.2f size %.2f\n"),
			D.Color.R, D.Color.G, D.Color.B, D.Brightness, D.Noise, D.Flicker, D.Size);
		if (D.InsightYield.Num() > 0)
		{
			Out += TEXT("       insight:");
			for (const TPair<FGameplayTag, float>& Pair : D.InsightYield)
			{
				Out += FString::Printf(TEXT(" %s=%.2f"), *TagLeaf(Pair.Key), Pair.Value);
			}
			Out += TEXT("\n");
		}
		++Index;
	}
}

void UDebugOverlayWidget::AppendEventSection(FString& Out, const UCultivationState* State)
{
	Out += TEXT("\n-- LAST 20 EVENTS (charter 10.6) --\n");
	if (!State)
	{
		Out += TEXT("  (no state)\n");
		return;
	}

	Out += FString::Printf(TEXT("  checksum %08X  (%d events)\n"), State->ComputeEventChecksum(), State->EventLog.Num());
	for (const FCultivationEvent& Event : State->EventLog)
	{
		Out += FString::Printf(TEXT("  %8.2f  %-22s %s"), Event.GameTime, *TagLeaf(Event.EventTag), *Event.Message.ToString());
		if (!Event.SubjectId.IsNone())
		{
			Out += FString::Printf(TEXT("  [%s]"), *Event.SubjectId.ToString());
		}
		if (Event.Value != 0.0f)
		{
			Out += FString::Printf(TEXT("  (%.3f)"), Event.Value);
		}
		Out += TEXT("\n");
	}
}

void UDebugOverlayWidget::AppendStackSection(FString& Out, const UModifierStack* Stack)
{
	Out += TEXT("\n-- MODIFIER STACK (charter 11.1) --\n");
	if (!Stack)
	{
		Out += TEXT("  (no UModifierStack)\n");
		return;
	}
	Out += Stack->DumpToString();
	if (!Out.EndsWith(TEXT("\n")))
	{
		Out += TEXT("\n");
	}
}

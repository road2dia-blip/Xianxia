// Project Ascension -- UCultivationSubsystem implementation (D-0010; charter 6.6, 10.7, 11.1).

#include "Cultivation/CultivationSubsystem.h"
#include "Engine/DataTable.h"
#include "Cultivation/CultivationState.h"
#include "Cultivation/ModifierStack.h"
#include "Cultivation/RealmLadder.h"
#include "Player/AscensionSettings.h"
#include "AscensionGameplayTags.h"
#include "AscensionLog.h"

void UCultivationSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);

	State = NewObject<UCultivationState>(this, TEXT("CultivationState"));
	Stack = NewObject<UModifierStack>(this, TEXT("ModifierStack"));

	// D-0010: the data asset references live on UAscensionSettings. D-0008: the assets may not exist yet at Milestone 0.
	const UAscensionSettings* Settings = GetDefault<UAscensionSettings>();
	if (Settings)
	{
		if (!Settings->LadderConfig.IsNull())
		{
			LadderConfig = Settings->LadderConfig.LoadSynchronous();
		}
		if (!Settings->LadderTable.IsNull())
		{
			LadderTable = Settings->LadderTable.LoadSynchronous();
		}
	}

	if (!LadderConfig)
	{
		UE_LOG(LogAscension, Warning, TEXT("UCultivationSubsystem: UAscensionSettings::LadderConfig is unset or failed to load (expected before Content/Python/ascension_m0_setup.py has run). System unlocks resolve to false."));
	}
	if (!LadderTable)
	{
		UE_LOG(LogAscension, Warning, TEXT("UCultivationSubsystem: UAscensionSettings::LadderTable is unset or failed to load (expected before Content/Python/ascension_m0_setup.py has run). Rows are computed from the config when it exists."));
	}

	State->SetLadderConfig(LadderConfig);
	ResetNewGame();
}

void UCultivationSubsystem::Deinitialize()
{
	State = nullptr;
	Stack = nullptr;
	LadderConfig = nullptr;
	LadderTable = nullptr;
	Super::Deinitialize();
}

bool UCultivationSubsystem::SetRealmLayer(int32 InRealm, int32 InLayer)
{
	if (!State || !Stack)
	{
		UE_LOG(LogAscension, Warning, TEXT("UCultivationSubsystem::SetRealmLayer: subsystem not initialised."));
		return false;
	}

	const int32 ClampedRealm = FMath::Clamp(InRealm, 1, URealmLadderLibrary::NumRealms);
	const int32 ClampedLayer = FMath::Clamp(InLayer, 1, URealmLadderLibrary::NumLayers);
	if (ClampedRealm != InRealm || ClampedLayer != InLayer)
	{
		UE_LOG(LogAscension, Warning, TEXT("UCultivationSubsystem::SetRealmLayer: %d.%d clamped to %d.%d (charter 6.1: nine Realms of nine Layers)."),
			InRealm, InLayer, ClampedRealm, ClampedLayer);
	}

	State->Realm = ClampedRealm;
	State->Layer = ClampedLayer;

	// The table is the source of truth (charter 6.1); the formula is the fallback while the asset does not exist (D-0008).
	bool bRowResolved = State->LoadRowFromTable(LadderTable);
	if (!bRowResolved && LadderConfig)
	{
		State->CurrentRow = URealmLadderLibrary::ComputeRow(LadderConfig, ClampedRealm, ClampedLayer);
		bRowResolved = true;
		UE_LOG(LogAscension, Log, TEXT("UCultivationSubsystem::SetRealmLayer: row R%dL%d computed from DA_RealmLadderConfig (DT_RealmLadder unavailable)."),
			ClampedRealm, ClampedLayer);
	}

	if (!bRowResolved)
	{
		UE_LOG(LogAscension, Warning, TEXT("UCultivationSubsystem::SetRealmLayer: no ladder table or config; R%dL%d keeps the default row values."),
			ClampedRealm, ClampedLayer);
	}

	PushRowToStack();
	UE_LOG(LogAscension, Log, TEXT("Realm/Layer set: %s"), *URealmLadderLibrary::RowToString(State->CurrentRow));
	return bRowResolved;
}

void UCultivationSubsystem::ResetNewGame()
{
	if (!State)
	{
		return;
	}

	// Charter 10.7: a new game starts at Realm 1 Layer 1 with the Basic Mantra (800 Reach comes from row R1L1).
	State->CultivationProgress = 0.0f;
	State->Stability = 1.0f;
	State->Purity = 1.0f;
	State->QiReserve = 0.0f;
	State->Corruption = 0.0f;
	State->bDeviationScar = false;
	State->BacklashRecoveryRemaining = 0.0f;
	State->ActiveMantra = AscensionTags::Mantra_Basic;
	State->SecondMantra = FGameplayTag();
	State->DaoInsight.Reset();
	State->GenericInsight = 0.0f;
	State->UnlockedDaoNodes.Reset();
	State->SlottedTechniques.Reset();
	State->SlottedTechniques.SetNum(UCultivationState::TechniqueSlotCount);
	State->RngSeed = FMath::Rand();
	State->RngPosition = 0;
	State->EventLog.Reset();

	if (Stack)
	{
		// TODO(M2): Mantra/Dao/scar modifiers are pushed by their owners; a new game starts with none.
		Stack->RemoveModifiersFromSource(NAME_None);
	}

	SetRealmLayer(1, 1);
}

void UCultivationSubsystem::PushRowToStack()
{
	if (!State || !Stack)
	{
		return;
	}

	const FRealmLayerRow& Row = State->CurrentRow;
	Stack->SetBase(AscensionProps::AuraReach, Row.AuraReach);
	Stack->SetBase(AscensionProps::DantianCapacity, Row.DantianCapacity);
	Stack->SetBase(AscensionProps::QiReserveMax, Row.QiReserveMax);
	Stack->SetBase(AscensionProps::ProgressRequired, Row.ProgressRequired);
	Stack->SetBase(AscensionProps::StabilityRecovery, Row.StabilityRecovery);
	Stack->SetBase(AscensionProps::MaxCirculationStrength, Row.MaxCirculationStrength);
	Stack->SetBase(AscensionProps::PulseChargeDuration, Row.PulseChargeDuration);
	Stack->SetBase(AscensionProps::PulseRecoveryDuration, Row.PulseRecoveryDuration);
	Stack->SetBase(AscensionProps::AmbientWispCount, static_cast<float>(Row.AmbientWispCount));
	Stack->SetBase(AscensionProps::AmbientSpawnInterval, Row.AmbientSpawnInterval);
	Stack->SetBase(AscensionProps::ImpureFraction, Row.ImpureFraction);
	Stack->SetBase(AscensionProps::MinorBreakthroughBaseChance, Row.MinorBreakthroughBaseChance);
	// TODO(M1): the non-row constants (RejectionThreshold, OverchargeGrace, PulseMinReleaseStrength, ...) are pushed from data by their systems.
	Stack->Rebuild();
}

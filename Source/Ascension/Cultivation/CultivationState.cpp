// Project Ascension -- UCultivationState implementation (charter 6.6, 10.6, 10.7, 11.2, 11.3).

#include "Cultivation/CultivationState.h"
#include "Engine/DataTable.h"
#include "Misc/Crc.h"
#include "Player/AscensionSaveGame.h"
#include "AscensionLog.h"

UCultivationState::UCultivationState()
{
	SlottedTechniques.SetNum(TechniqueSlotCount);
}

bool UCultivationState::LoadRowFromTable(const UDataTable* Table)
{
	if (!Table)
	{
		UE_LOG(LogAscension, Warning, TEXT("UCultivationState::LoadRowFromTable: null table; keeping row R%dL%d."), CurrentRow.Realm, CurrentRow.Layer);
		return false;
	}

	const FName RowName = URealmLadderLibrary::MakeRowName(Realm, Layer);
	static const FString Context(TEXT("UCultivationState::LoadRowFromTable"));
	const FRealmLayerRow* Row = Table->FindRow<FRealmLayerRow>(RowName, Context, /*bWarnIfRowMissing*/ false);
	if (!Row)
	{
		UE_LOG(LogAscension, Warning, TEXT("UCultivationState::LoadRowFromTable: row %s not found in %s."), *RowName.ToString(), *Table->GetName());
		return false;
	}

	CurrentRow = *Row;
	return true;
}

bool UCultivationState::IsSystemUnlocked(FGameplayTag SystemTag) const
{
	if (!LadderConfig || !SystemTag.IsValid())
	{
		return false;
	}

	// Charter 11.2: a system whose tag is not unlocked is not shown and not simulated. Unlocks accumulate up the ladder.
	const int32 RealmCount = FMath::Min(Realm, LadderConfig->Realms.Num());
	for (int32 Index = 0; Index < RealmCount; ++Index)
	{
		if (LadderConfig->Realms[Index].UnlockedSystems.HasTagExact(SystemTag))
		{
			return true;
		}
	}
	return false;
}

void UCultivationState::PushEvent(const FCultivationEvent& Event)
{
	EventLog.Add(Event);
	if (EventLog.Num() > EventLogCapacity)
	{
		EventLog.RemoveAt(0, EventLog.Num() - EventLogCapacity, EAllowShrinking::No);
	}
}

uint32 UCultivationState::ComputeEventChecksum() const
{
	// Deterministic, locale-independent rendering: tag | time | subject | value per event. Message (FText) is excluded
	// so localisation cannot change the checksum (charter 11.3 compares runs, not languages).
	FString Rendered;
	Rendered.Reserve(EventLog.Num() * 64);
	for (const FCultivationEvent& Event : EventLog)
	{
		Rendered += Event.EventTag.ToString();
		Rendered += TEXT("|");
		Rendered += FString::Printf(TEXT("%.4f"), Event.GameTime);
		Rendered += TEXT("|");
		Rendered += Event.SubjectId.ToString();
		Rendered += TEXT("|");
		Rendered += FString::Printf(TEXT("%.4f"), Event.Value);
		Rendered += TEXT(";");
	}
	return FCrc::StrCrc32(*Rendered);
}

void UCultivationState::ApplyToSave(UAscensionSaveGame* Save) const
{
	if (!Save)
	{
		UE_LOG(LogAscension, Warning, TEXT("UCultivationState::ApplyToSave: null save object."));
		return;
	}

	Save->Realm = Realm;
	Save->Layer = Layer;
	Save->Progress = CultivationProgress;
	Save->Purity = Purity;
	Save->Stability = Stability;
	Save->Reserve = QiReserve;
	Save->Corruption = Corruption;
	Save->bDeviationScar = bDeviationScar;
	Save->ActiveMantra = ActiveMantra;
	Save->SecondMantra = SecondMantra;
	Save->DaoInsight = DaoInsight;
	Save->UnlockedNodes = UnlockedDaoNodes;
	Save->SlottedTechniques = SlottedTechniques;
	Save->RngSeed = RngSeed;
	Save->RngPosition = RngPosition;
}

void UCultivationState::RestoreFromSave(const UAscensionSaveGame* Save)
{
	if (!Save)
	{
		UE_LOG(LogAscension, Warning, TEXT("UCultivationState::RestoreFromSave: null save object."));
		return;
	}

	Realm = FMath::Clamp(Save->Realm, 1, URealmLadderLibrary::NumRealms);
	Layer = FMath::Clamp(Save->Layer, 1, URealmLadderLibrary::NumLayers);
	CultivationProgress = FMath::Max(0.0f, Save->Progress);
	Purity = FMath::Clamp(Save->Purity, 0.0f, 1.0f);
	Stability = FMath::Clamp(Save->Stability, 0.0f, 1.0f);
	QiReserve = FMath::Max(0.0f, Save->Reserve);
	Corruption = FMath::Max(0.0f, Save->Corruption);
	bDeviationScar = Save->bDeviationScar;
	ActiveMantra = Save->ActiveMantra;
	SecondMantra = Save->SecondMantra;
	DaoInsight = Save->DaoInsight;
	UnlockedDaoNodes = Save->UnlockedNodes;
	SlottedTechniques = Save->SlottedTechniques;
	SlottedTechniques.SetNum(TechniqueSlotCount);
	RngSeed = Save->RngSeed;
	RngPosition = Save->RngPosition;

	// Transient per-session values are not saved (charter 10.7 lists none of these).
	BacklashRecoveryRemaining = 0.0f;
	EventLog.Reset();
}

void UCultivationState::SetLadderConfig(const UDA_RealmLadderConfig* InConfig)
{
	LadderConfig = InConfig;
}

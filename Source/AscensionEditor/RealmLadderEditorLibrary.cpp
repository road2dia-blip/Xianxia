// Project Ascension -- editor entry point for ladder regeneration (charter 6.1; D-0009).

#include "RealmLadderEditorLibrary.h"

#include "AscensionEditor.h"
#include "AssetRegistry/AssetRegistryModule.h"
#include "Cultivation/RealmLadder.h"
#include "Engine/DataTable.h"
#include "Misc/PackageName.h"
#include "UObject/Package.h"
#include "UObject/SavePackage.h"

namespace
{
	constexpr int32 ExpectedLadderRows = URealmLadderLibrary::NumRealms * URealmLadderLibrary::NumLayers; // 81 (charter 6.1)
}

const TCHAR* URealmLadderEditorLibrary::DefaultConfigAssetPath()
{
	return TEXT("/Game/Ascension/Data/DA_RealmLadderConfig");
}

const TCHAR* URealmLadderEditorLibrary::DefaultTableAssetPath()
{
	return TEXT("/Game/Ascension/Data/DT_RealmLadder");
}

bool URealmLadderEditorLibrary::RegenerateLadderTable(UDA_RealmLadderConfig* Config, UDataTable* Table, bool bSave)
{
	const int32 RowsWritten = FillTable(Config, Table, /*bLogRows*/ false);
	if (RowsWritten != ExpectedLadderRows)
	{
		return false;
	}

	UE_LOG(LogAscension, Display, TEXT("RegenerateLadderTable: %d rows written to %s from %s."),
		RowsWritten, *Table->GetPathName(), *Config->GetPathName());

	if (bSave)
	{
		return SaveTablePackage(Table);
	}
	return true;
}

int32 URealmLadderEditorLibrary::FillTable(const UDA_RealmLadderConfig* Config, UDataTable* Table, bool bLogRows)
{
	if (!Config)
	{
		UE_LOG(LogAscension, Error, TEXT("FillTable: Config is null. Create DA_RealmLadderConfig first (Content/Python/ascension_m0_setup.py)."));
		return -1;
	}
	if (!Table)
	{
		UE_LOG(LogAscension, Error, TEXT("FillTable: Table is null."));
		return -1;
	}

	UScriptStruct* RowStruct = FRealmLayerRow::StaticStruct();	// non-const: assignable to UDataTable::RowStruct whether it is TObjectPtr<UScriptStruct> or TObjectPtr<const UScriptStruct>
	if (Table->GetRowStruct() == nullptr && Table->GetRowMap().Num() == 0)
	{
		// A freshly created, never-typed table: adopt the ladder row struct.
		Table->RowStruct = RowStruct;
	}
	else if (Table->GetRowStruct() != RowStruct)
	{
		UE_LOG(LogAscension, Error, TEXT("FillTable: %s has row struct %s, expected %s. Refusing to overwrite a table of another type."),
			*Table->GetPathName(),
			Table->GetRowStruct() ? *Table->GetRowStruct()->GetName() : TEXT("(none)"),
			*RowStruct->GetName());
		return -1;
	}

	TArray<FRealmLayerRow> Rows;
	URealmLadderLibrary::GenerateLadderRows(Config, Rows);
	if (Rows.Num() != ExpectedLadderRows)
	{
		UE_LOG(LogAscension, Error, TEXT("FillTable: generator produced %d rows, expected %d. Table left unchanged."), Rows.Num(), ExpectedLadderRows);
		return -1;
	}

	Table->Modify();
	Table->EmptyTable();

	for (const FRealmLayerRow& Row : Rows)
	{
		const FName RowName = URealmLadderLibrary::MakeRowName(Row.Realm, Row.Layer);
		Table->AddRow(RowName, Row);
		if (bLogRows)
		{
			UE_LOG(LogAscension, Display, TEXT("%s"), *URealmLadderLibrary::RowToString(Row));
		}
	}

	Table->MarkPackageDirty();
	return Table->GetRowMap().Num();
}

bool URealmLadderEditorLibrary::SaveTablePackage(UDataTable* Table)
{
	if (!Table)
	{
		return false;
	}

	UPackage* Package = Table->GetOutermost();
	if (!Package || Package == GetTransientPackage())
	{
		UE_LOG(LogAscension, Error, TEXT("SaveTablePackage: %s is not in a saveable package."), *Table->GetPathName());
		return false;
	}

	const FString PackageName = Package->GetName();
	const FString FileName = FPackageName::LongPackageNameToFilename(PackageName, FPackageName::GetAssetPackageExtension());

	FSavePackageArgs SaveArgs;
	SaveArgs.TopLevelFlags = RF_Public | RF_Standalone;
	SaveArgs.SaveFlags = SAVE_None;
	SaveArgs.Error = GError;

	const bool bSaved = UPackage::SavePackage(Package, Table, *FileName, SaveArgs);
	if (bSaved)
	{
		UE_LOG(LogAscension, Display, TEXT("SaveTablePackage: saved %s -> %s"), *PackageName, *FileName);
	}
	else
	{
		UE_LOG(LogAscension, Error, TEXT("SaveTablePackage: failed to save %s -> %s"), *PackageName, *FileName);
	}
	return bSaved;
}

FString URealmLadderEditorLibrary::ToObjectPath(const FString& AssetPath)
{
	FString Path = AssetPath.TrimStartAndEnd();
	if (Path.IsEmpty())
	{
		return Path;
	}
	if (Path.Contains(TEXT(".")))
	{
		return Path;
	}
	return Path + TEXT(".") + FPackageName::GetShortName(Path);
}

UDA_RealmLadderConfig* URealmLadderEditorLibrary::LoadConfigAsset(const FString& AssetPath)
{
	const FString ObjectPath = ToObjectPath(AssetPath);
	UDA_RealmLadderConfig* Config = LoadObject<UDA_RealmLadderConfig>(nullptr, *ObjectPath);
	if (!Config)
	{
		UE_LOG(LogAscension, Error, TEXT("LoadConfigAsset: %s not found. The commandlet never creates the config; run Content/Python/ascension_m0_setup.py in the editor first, or pass -Config=<asset path>."), *ObjectPath);
	}
	return Config;
}

UDataTable* URealmLadderEditorLibrary::LoadOrCreateTableAsset(const FString& AssetPath, bool& bOutCreated)
{
	bOutCreated = false;

	const FString ObjectPath = ToObjectPath(AssetPath);
	const FString PackageName = FPackageName::ObjectPathToPackageName(ObjectPath);
	const FString AssetName = FPackageName::ObjectPathToObjectName(ObjectPath);

	if (PackageName.IsEmpty() || AssetName.IsEmpty() || !FPackageName::IsValidLongPackageName(PackageName))
	{
		UE_LOG(LogAscension, Error, TEXT("LoadOrCreateTableAsset: '%s' is not a valid long package path (expected e.g. /Game/Ascension/Data/DT_RealmLadder)."), *AssetPath);
		return nullptr;
	}

	if (FPackageName::DoesPackageExist(PackageName))
	{
		UDataTable* Existing = LoadObject<UDataTable>(nullptr, *ObjectPath);
		if (!Existing)
		{
			UE_LOG(LogAscension, Error, TEXT("LoadOrCreateTableAsset: package %s exists but %s could not be loaded as a UDataTable."), *PackageName, *ObjectPath);
		}
		return Existing;
	}

	UPackage* Package = CreatePackage(*PackageName);
	if (!Package)
	{
		UE_LOG(LogAscension, Error, TEXT("LoadOrCreateTableAsset: CreatePackage(%s) failed."), *PackageName);
		return nullptr;
	}
	Package->FullyLoad();

	UDataTable* Table = NewObject<UDataTable>(Package, *AssetName, RF_Public | RF_Standalone);
	if (!Table)
	{
		UE_LOG(LogAscension, Error, TEXT("LoadOrCreateTableAsset: NewObject<UDataTable>(%s) failed."), *ObjectPath);
		return nullptr;
	}
	Table->RowStruct = FRealmLayerRow::StaticStruct();
	FAssetRegistryModule::AssetCreated(Table);
	Table->MarkPackageDirty();

	bOutCreated = true;
	UE_LOG(LogAscension, Display, TEXT("LoadOrCreateTableAsset: created %s (RowStruct=%s)."), *ObjectPath, *FRealmLayerRow::StaticStruct()->GetName());
	return Table;
}

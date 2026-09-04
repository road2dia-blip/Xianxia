// Project Ascension -- the ladder commandlet (charter 6.1; D-0009).

#include "RealmLadderCommandlet.h"

#include "AscensionEditor.h"
#include "Cultivation/RealmLadder.h"
#include "Engine/DataTable.h"
#include "Misc/Parse.h"
#include "RealmLadderEditorLibrary.h"

URealmLadderCommandlet::URealmLadderCommandlet()
{
	IsClient = false;
	IsServer = false;
	IsEditor = true;
	LogToConsole = true;
	ShowErrorCount = true;
}

int32 URealmLadderCommandlet::Main(const FString& Params)
{
	UE_LOG(LogAscensionEditor, Display, TEXT("RealmLadder commandlet: params '%s'"), *Params);

	FString ConfigPath = URealmLadderEditorLibrary::DefaultConfigAssetPath();
	FString TablePath = URealmLadderEditorLibrary::DefaultTableAssetPath();
	FParse::Value(*Params, TEXT("Config="), ConfigPath);
	FParse::Value(*Params, TEXT("Table="), TablePath);
	const bool bNoSave = FParse::Param(*Params, TEXT("NoSave"));

	UDA_RealmLadderConfig* Config = URealmLadderEditorLibrary::LoadConfigAsset(ConfigPath);
	if (!Config)
	{
		return 1;
	}

	bool bCreated = false;
	UDataTable* Table = URealmLadderEditorLibrary::LoadOrCreateTableAsset(TablePath, bCreated);
	if (!Table)
	{
		return 1;
	}

	UE_LOG(LogAscensionEditor, Display, TEXT("RealmLadder commandlet: config %s, table %s (%s)."),
		*Config->GetPathName(), *Table->GetPathName(), bCreated ? TEXT("created") : TEXT("loaded"));

	const int32 RowsWritten = URealmLadderEditorLibrary::FillTable(Config, Table, /*bLogRows*/ true);
	const int32 ExpectedRows = URealmLadderLibrary::NumRealms * URealmLadderLibrary::NumLayers;
	if (RowsWritten != ExpectedRows)
	{
		UE_LOG(LogAscensionEditor, Error, TEXT("RealmLadder commandlet: expected %d rows, got %d."), ExpectedRows, RowsWritten);
		return 1;
	}
	UE_LOG(LogAscensionEditor, Display, TEXT("RealmLadder commandlet: %d rows written to %s."), RowsWritten, *Table->GetPathName());

	if (bNoSave)
	{
		UE_LOG(LogAscensionEditor, Display, TEXT("RealmLadder commandlet: -NoSave given; package left dirty and unsaved."));
		return 0;
	}

	if (!URealmLadderEditorLibrary::SaveTablePackage(Table))
	{
		return 1;
	}

	UE_LOG(LogAscensionEditor, Display, TEXT("RealmLadder commandlet: done."));
	return 0;
}

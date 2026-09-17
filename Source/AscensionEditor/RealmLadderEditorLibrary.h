// Project Ascension -- editor entry point for ladder regeneration (charter 6.1; D-0009; contract docs/SKELETON_M0.md "Source/AscensionEditor/").

#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "RealmLadderEditorLibrary.generated.h"

class UDA_RealmLadderConfig;
class UDataTable;

/**
 * URealmLadderEditorLibrary (charter 6.1: "a small editor utility (Blutility or C++ commandlet) that regenerates the
 * table from the config so that tuning is a config edit, not 81 manual edits"). RegenerateLadderTable is the
 * Blutility / Editor Utility Widget / Python face of the generator; URealmLadderCommandlet is the command-line face.
 * Both go through the single FillTable helper so a config edit regenerates identically from either path (D-0009).
 * The maths itself lives in the runtime module (URealmLadderLibrary::GenerateLadderRows); this class only moves the
 * rows into DT_RealmLadder and saves the package.
 */
UCLASS()
class ASCENSIONEDITOR_API URealmLadderEditorLibrary : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

	friend class URealmLadderCommandlet;

public:
	/**
	 * Regenerates every row of Table from Config (81 rows, R1L1..R9L9), marks the package dirty and, when bSave is
	 * true, saves it to disk. Returns false (and logs why) when either object is null, when the table's row struct is
	 * not FRealmLayerRow, when the generator did not produce exactly 81 rows, or when saving failed.
	 * (No CallInEditor: that specifier only produces a details-panel button for non-static, parameterless members.)
	 */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Editor")
	static bool RegenerateLadderTable(UDA_RealmLadderConfig* Config, UDataTable* Table, bool bSave);

	/** Default asset path of the ladder config (contract: "-Config=<asset path>" default). */
	static const TCHAR* DefaultConfigAssetPath();

	/** Default asset path of the ladder table (contract: "-Table=<asset path>" default). */
	static const TCHAR* DefaultTableAssetPath();

private:
	/**
	 * The shared fill logic. Empties Table, adds one row per generated FRealmLayerRow keyed by
	 * URealmLadderLibrary::MakeRowName, marks the package dirty. Logs every row with RowToString when bLogRows is set
	 * (the commandlet does; charter Milestone 0 evidence "print all 81 rows"). Returns the number of rows written,
	 * or -1 on failure. Does not save.
	 */
	static int32 FillTable(const UDA_RealmLadderConfig* Config, UDataTable* Table, bool bLogRows);

	/** Saves the package that owns Table with UPackage::SavePackage (RF_Public | RF_Standalone top-level flags). */
	static bool SaveTablePackage(UDataTable* Table);

	/** "/Game/A/B" -> "/Game/A/B.B"; a path that already names an object is returned unchanged. */
	static FString ToObjectPath(const FString& AssetPath);

	/** Loads the config asset; returns null (logged) when it does not exist. Never creates it. */
	static UDA_RealmLadderConfig* LoadConfigAsset(const FString& AssetPath);

	/**
	 * Loads the table asset, or creates it in a new package with RowStruct = FRealmLayerRow when the package does not
	 * exist. bOutCreated reports which happened. Returns null (logged) on failure.
	 */
	static UDataTable* LoadOrCreateTableAsset(const FString& AssetPath, bool& bOutCreated);
};

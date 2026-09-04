// Tools/StubCompile -- STUB of Engine/DataTable.h (model test only; see README.md).
#pragma once

#include "UObject/Object.h"

/** Base of every row struct. StaticStruct() here stands in for the per-struct one UHT generates. */
struct FTableRowBase
{
	FTableRowBase() = default;
	virtual ~FTableRowBase() = default;
	static UScriptStruct* StaticStruct() { return nullptr; }
	virtual void OnPostDataImport(const class UDataTable* InDataTable, const FName InRowName, TArray<FString>& OutCollectedImportProblems) { UE::Stub::Sink(InDataTable, InRowName, OutCollectedImportProblems); }
	virtual void OnDataTableChanged(const class UDataTable* InDataTable, const FName InRowName) { UE::Stub::Sink(InDataTable, InRowName); }
};

class UDataTable : public UObject
{
	UE_STUB_CLASS_BODY(UDataTable)

	/** Real UE 5: TObjectPtr<const UScriptStruct> RowStruct. */
	TObjectPtr<const UScriptStruct> RowStruct;
	bool bStripFromClientBuilds = false;
	bool bIgnoreExtraFields = false;
	bool bIgnoreMissingFields = false;

	const UScriptStruct* GetRowStruct() const { return RowStruct; }
	const TMap<FName, uint8*>& GetRowMap() const { return RowMap; }
	TMap<FName, uint8*>& GetRowMap() { return RowMap; }
	TArray<FName> GetRowNames() const { TArray<FName> Names; for (const TPair<FName, uint8*>& Pair : RowMap) { Names.Add(Pair.Key); } return Names; }

	template <class T>
	T* FindRow(FName RowName, const FString& ContextString, bool bWarnIfRowMissing = true) const
	{
		UE::Stub::Sink(RowName, ContextString, bWarnIfRowMissing);
		return nullptr;
	}
	uint8* FindRowUnchecked(FName RowName) const { UE::Stub::Sink(RowName); return nullptr; }
	template <class T>
	void GetAllRows(const FString& ContextString, TArray<T*>& OutRowArray) const { UE::Stub::Sink(ContextString, OutRowArray); }

	void EmptyTable() { RowMap.Reset(); }
	void RemoveRow(FName RowName) { RowMap.Remove(RowName); }
	void AddRow(FName RowName, const FTableRowBase& RowData) { UE::Stub::Sink(RowData); RowMap.Add(RowName, nullptr); }
	void AddRow(FName RowName, const uint8* RowData, const UScriptStruct* RowType) { UE::Stub::Sink(RowData, RowType); RowMap.Add(RowName, nullptr); }
	TArray<FString> CreateTableFromCSVString(const FString& InString) { UE::Stub::Sink(InString); return TArray<FString>(); }
	TArray<FString> CreateTableFromJSONString(const FString& InString) { UE::Stub::Sink(InString); return TArray<FString>(); }
	FString GetTableAsCSV() const { return FString(); }
	FString GetTableAsJSON() const { return FString(); }

private:
	TMap<FName, uint8*> RowMap;
};

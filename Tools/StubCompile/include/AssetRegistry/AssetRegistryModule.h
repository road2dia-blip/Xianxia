// Tools/StubCompile -- STUB of AssetRegistry/AssetRegistryModule.h (model test only; see README.md).
#pragma once

#include "UObject/Object.h"
#include "Modules/ModuleManager.h"

struct FAssetData
{
	FName PackageName;
	FName AssetName;
	UObject* GetAsset() const { return nullptr; }
	bool IsValid() const { return false; }
};

class IAssetRegistry
{
public:
	virtual ~IAssetRegistry() = default;
	virtual bool GetAssetsByPath(FName PackagePath, TArray<FAssetData>& OutAssetData, bool bRecursive = false, bool bIncludeOnlyOnDiskAssets = false) const { UE::Stub::Sink(PackagePath, OutAssetData, bRecursive, bIncludeOnlyOnDiskAssets); return false; }
	virtual FAssetData GetAssetByObjectPath(const FSoftObjectPath& ObjectPath, bool bIncludeOnlyOnDiskAssets = false) const { UE::Stub::Sink(ObjectPath, bIncludeOnlyOnDiskAssets); return FAssetData(); }
	virtual void SearchAllAssets(bool bSynchronousSearch) { UE::Stub::Sink(bSynchronousSearch); }
};

class FAssetRegistryModule : public IModuleInterface
{
public:
	static void AssetCreated(UObject* NewAsset) { UE::Stub::Sink(NewAsset); }
	static bool AssetDeleted(UObject* DeletedAsset) { UE::Stub::Sink(DeletedAsset); return true; }
	static bool AssetRenamed(const UObject* RenamedAsset, const FString& OldObjectPath) { UE::Stub::Sink(RenamedAsset, OldObjectPath); return true; }
	static void AssetsAdded(const TArray<FAssetData>& Assets) { UE::Stub::Sink(Assets); }
	IAssetRegistry& Get() const { static IAssetRegistry Registry; return Registry; }
	static IAssetRegistry& GetRegistry() { static IAssetRegistry Registry; return Registry; }
};

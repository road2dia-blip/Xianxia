// Tools/StubCompile -- STUB of Engine/DataAsset.h (model test only; see README.md).
#pragma once

#include "UObject/Object.h"

class UDataAsset : public UObject
{
	UE_STUB_CLASS_BODY(UDataAsset)
};

class UPrimaryDataAsset : public UDataAsset
{
	UE_STUB_CLASS_BODY(UPrimaryDataAsset)

	/** Real UE: overrides UObject::GetPrimaryAssetId to derive an id from the class/asset name. */
	virtual FPrimaryAssetId GetPrimaryAssetId() const override { return FPrimaryAssetId(); }
};

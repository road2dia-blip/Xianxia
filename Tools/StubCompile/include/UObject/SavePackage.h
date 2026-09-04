// Tools/StubCompile -- STUB of UObject/SavePackage.h (model test only; see README.md).
#pragma once

#include "UObject/Object.h"

/** Save flags (UObject/ObjectSaveContext.h / UObjectGlobals.h). */
enum ESaveFlags
{
	SAVE_None = 0x00000000,
	SAVE_NoError = 0x00000001,
	SAVE_FromAutosave = 0x00000002,
	SAVE_KeepDirty = 0x00000004,
	SAVE_KeepGUID = 0x00000008,
	SAVE_Async = 0x00000010,
};

struct FSavePackageArgs
{
	FOutputDevice* Error = nullptr;
	EObjectFlags TopLevelFlags = RF_NoFlags;
	uint32 SaveFlags = SAVE_None;
	bool bForceByteSwapping = false;
	bool bWarnOfLongFilename = true;
	bool bSlowTask = true;
};

inline bool UPackage::SavePackage(UPackage* InOuter, UObject* InAsset, const TCHAR* Filename, const FSavePackageArgs& SaveArgs)
{
	UE::Stub::Sink(InOuter, InAsset, Filename, SaveArgs);
	return true;
}

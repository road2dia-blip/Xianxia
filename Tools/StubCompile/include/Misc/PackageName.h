// Tools/StubCompile -- STUB of Misc/PackageName.h (CoreUObject; model test only, see README.md).
#pragma once

#include "UObject/Object.h"

class FPackageName
{
public:
	static FString LongPackageNameToFilename(const FString& InLongPackageName, const FString& InExtension = FString(TEXT(""))) { UE::Stub::Sink(InExtension); return InLongPackageName; }
	static bool TryConvertLongPackageNameToFilename(const FString& InLongPackageName, FString& OutFilename, const FString& InExtension = FString(TEXT(""))) { UE::Stub::Sink(InExtension); OutFilename = InLongPackageName; return true; }
	static FString FilenameToLongPackageName(const FString& InFilename) { return InFilename; }
	static const FString& GetAssetPackageExtension() { static const FString Ext(TEXT(".uasset")); return Ext; }
	static const FString& GetMapPackageExtension() { static const FString Ext(TEXT(".umap")); return Ext; }
	static FString GetShortName(const FString& LongName) { return LongName; }
	static FString GetShortName(const FName& LongName) { return LongName.ToString(); }
	static FString GetShortName(const TCHAR* LongName) { return FString(LongName); }
	static FString GetLongPackagePath(const FString& InLongPackageName) { return InLongPackageName; }
	static FString ObjectPathToPackageName(const FString& InObjectPath) { return InObjectPath; }
	static FString ObjectPathToObjectName(const FString& InObjectPath) { return InObjectPath; }
	static FString ObjectPathToSubObjectPath(const FString& InObjectPath) { return InObjectPath; }
	static bool IsValidLongPackageName(const FString& InLongPackageName, bool bIncludeReadOnlyRoots = false, FText* OutReason = nullptr) { UE::Stub::Sink(InLongPackageName, bIncludeReadOnlyRoots, OutReason); return true; }
	static bool IsValidObjectPath(const FString& InObjectPath, FText* OutReason = nullptr) { UE::Stub::Sink(InObjectPath, OutReason); return true; }
	static bool DoesPackageExist(const FString& LongPackageName, FString* OutFilename = nullptr, bool InAllowTextFormats = true) { UE::Stub::Sink(LongPackageName, OutFilename, InAllowTextFormats); return false; }
	static bool IsScriptPackage(const FString& InPackageName) { UE::Stub::Sink(InPackageName); return false; }
	static bool IsShortPackageName(const FString& PossiblyLongName) { UE::Stub::Sink(PossiblyLongName); return false; }
};

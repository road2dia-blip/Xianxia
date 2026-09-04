// Tools/StubCompile -- STUB of Engine/DeveloperSettings.h (DeveloperSettings module; model test only, see README.md).
#pragma once

#include "UObject/Object.h"

class UDeveloperSettings : public UObject
{
	UE_STUB_CLASS_BODY(UDeveloperSettings)

	virtual FName GetContainerName() const { return FName(TEXT("Project")); }
	virtual FName GetCategoryName() const { return FName(TEXT("Game")); }
	virtual FName GetSectionName() const { return SectionName; }
#if WITH_EDITOR
	virtual FText GetSectionText() const { return FText(); }
	virtual FText GetSectionDescription() const { return FText(); }
#endif

protected:
	FName CategoryName;
	FName SectionName;
};

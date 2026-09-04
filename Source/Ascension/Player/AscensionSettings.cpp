// Project Ascension -- UAscensionSettings implementation (D-0010).

#include "Player/AscensionSettings.h"

UAscensionSettings::UAscensionSettings()
{
	// Section name shown under Project Settings -> Game. The DisplayName meta on the UCLASS labels it "Ascension".
	SectionName = TEXT("Ascension");
}

FName UAscensionSettings::GetCategoryName() const
{
	return FName(TEXT("Game"));
}

const UAscensionSettings* UAscensionSettings::Get()
{
	return GetDefault<UAscensionSettings>();
}

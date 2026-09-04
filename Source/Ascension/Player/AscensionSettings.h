// Project Ascension -- UAscensionSettings: Project Settings -> Game -> Ascension (D-0010; charter 10.7, 11.5, 14 "Project Settings changed").

#pragma once

#include "CoreMinimal.h"
#include "Engine/DeveloperSettings.h"
#include "UObject/SoftObjectPtr.h"
#include "AscensionSettings.generated.h"

class UDA_RealmLadderConfig;
class UDataTable;
class UUserWidget;

/**
 * The project's data references, kept in Config/DefaultGame.ini under [/Script/Ascension.AscensionSettings]
 * (D-0010: "Developer Settings is how 'Project Settings changed' can point at data instead of code").
 * UCultivationSubsystem loads LadderConfig/LadderTable from here at Initialize; AAscensionPlayerController creates
 * the HUD, F1 overlay and F2 panel widgets from the class references (charter 10.6, 11.5). Autosave cadence and
 * manual slot count are charter 10.7 numbers ("every 2 minutes", "three manual slots") exposed for tuning.
 *
 * Milestone 0: declared and read. The binary assets the soft paths point at are created by the owner with
 * Content/Python/ascension_m0_setup.py (D-0008); every reader tolerates a null.
 */
UCLASS(config = Game, defaultconfig, meta = (DisplayName = "Ascension"))
class ASCENSION_API UAscensionSettings : public UDeveloperSettings
{
	GENERATED_BODY()

public:
	UAscensionSettings();

	// -- UDeveloperSettings -------------------------------------------------------------------------------------------

	/** Project Settings category: "Game". */
	virtual FName GetCategoryName() const override;

	/** The default object (config-loaded). */
	static const UAscensionSettings* Get();

	// -- Data (charter 6.1, 6.6) ----------------------------------------------------------------------------------------

	/** DA_RealmLadderConfig: the formula constants and the nine FRealmDefinitions (charter 6.6). */
	UPROPERTY(config, EditAnywhere, Category = "Ascension|Data")
	TSoftObjectPtr<UDA_RealmLadderConfig> LadderConfig;

	/** DT_RealmLadder: the generated 81-row table every Layer number is read from (charter 6.1). */
	UPROPERTY(config, EditAnywhere, Category = "Ascension|Data")
	TSoftObjectPtr<UDataTable> LadderTable;

	// -- UI classes (charter 10.6) ---------------------------------------------------------------------------------------

	/** WBP_CultivationHUD (parent UCultivationHUDWidget). Milestone 1. */
	UPROPERTY(config, EditAnywhere, Category = "Ascension|UI")
	TSoftClassPtr<UUserWidget> CultivationHUDClass;

	/** WBP_WorldHUD (parent UWorldHUDWidget). Milestone 1. */
	UPROPERTY(config, EditAnywhere, Category = "Ascension|UI")
	TSoftClassPtr<UUserWidget> WorldHUDClass;

	/** WBP_DebugOverlay (parent UDebugOverlayWidget), toggled with IA_DebugOverlay (F1 by default; charter 10.6). */
	UPROPERTY(config, EditAnywhere, Category = "Ascension|UI")
	TSoftClassPtr<UUserWidget> DebugOverlayClass;

	/** WBP_DebugPanel (parent UDebugPanelWidget), toggled with IA_DebugPanel (F2 by default; charter 11.5). */
	UPROPERTY(config, EditAnywhere, Category = "Ascension|UI")
	TSoftClassPtr<UUserWidget> DebugPanelClass;

	// -- Save (charter 10.7) ---------------------------------------------------------------------------------------------

	/** Autosave period in seconds (charter 10.7: "every 2 minutes"). */
	UPROPERTY(config, EditAnywhere, Category = "Ascension|Save", meta = (ClampMin = "10.0"))
	float AutosaveIntervalSeconds = 120.0f;

	/** Number of manual save slots (charter 10.7: "Three manual slots"). */
	UPROPERTY(config, EditAnywhere, Category = "Ascension|Save", meta = (ClampMin = "1", ClampMax = "9"))
	int32 ManualSaveSlots = 3;
};

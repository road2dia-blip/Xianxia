// Project Ascension -- the ladder commandlet (charter 6.1; D-0009; contract docs/SKELETON_M0.md "Source/AscensionEditor/").

#pragma once

#include "CoreMinimal.h"
#include "Commandlets/Commandlet.h"
#include "RealmLadderCommandlet.generated.h"

/**
 * URealmLadderCommandlet (charter 6.1, Milestone 0 scope "generate DT_RealmLadder and print all 81 rows"):
 *
 *   UnrealEditor-Cmd.exe <project>.uproject -run=RealmLadder [-Config=<asset path>] [-Table=<asset path>] [-NoSave]
 *
 * Loads DA_RealmLadderConfig (default /Game/Ascension/Data/DA_RealmLadderConfig; never created here), loads or
 * creates DT_RealmLadder (default /Game/Ascension/Data/DT_RealmLadder, RowStruct FRealmLayerRow), regenerates the
 * 81 rows through URealmLadderEditorLibrary's shared fill helper, logs every row with URealmLadderLibrary::RowToString,
 * and saves the package unless -NoSave is given. Returns 0 on success, 1 on any failure.
 */
UCLASS()
class ASCENSIONEDITOR_API URealmLadderCommandlet : public UCommandlet
{
	GENERATED_BODY()

public:
	URealmLadderCommandlet();

	// -- UCommandlet --
	virtual int32 Main(const FString& Params) override;
};

// Project Ascension -- AAscensionGameMode: default classes for the single-player game (charter 11.1 "Player/").

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "AscensionGameMode.generated.h"

/**
 * The project's game mode (Config/DefaultEngine.ini GlobalDefaultGameMode). It only sets the default pawn
 * (AAscensionCharacter, the Anchor body that walks the outer world; charter 10.1) and the player controller
 * (AAscensionPlayerController, which owns the meditation transition; charter 7.13, 10.2). No multiplayer, no
 * networking (charter 2.2): AGameModeBase is enough.
 *
 * A BP_AscensionGameMode subclass may point at BP_AscensionCharacter (mesh, animation) from Milestone 1; this class
 * carries no gameplay logic.
 */
UCLASS()
class ASCENSION_API AAscensionGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	AAscensionGameMode();
};

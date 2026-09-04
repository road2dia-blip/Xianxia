// Project Ascension -- AAscensionGameMode implementation.

#include "Player/AscensionGameMode.h"
#include "Player/AscensionCharacter.h"
#include "Player/AscensionPlayerController.h"

AAscensionGameMode::AAscensionGameMode()
{
	DefaultPawnClass = AAscensionCharacter::StaticClass();
	PlayerControllerClass = AAscensionPlayerController::StaticClass();
}

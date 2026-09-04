// Project Ascension -- UAscensionSaveGame implementation (charter 10.7).

#include "Player/AscensionSaveGame.h"

UAscensionSaveGame::UAscensionSaveGame()
{
	SaveVersion = CurrentSaveVersion;
	// Four Technique slots (charter 8: IA_Technique_1..4), empty until a Dao Technique is slotted (Milestone 3).
	SlottedTechniques.Init(FGameplayTag(), 4);
}

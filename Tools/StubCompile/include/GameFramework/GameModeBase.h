// Tools/StubCompile -- STUB of GameFramework/GameModeBase.h (model test only; see README.md).
#pragma once

#include "GameFramework/Actor.h"
#include "GameFramework/Pawn.h"
#include "GameFramework/PlayerController.h"

class AGameStateBase;
class APlayerState;
class AHUD;
class ASpectatorPawn;
class AGameSession;

class AInfo : public AActor
{
	UE_STUB_CLASS_BODY(AInfo)
};

class AGameModeBase : public AInfo
{
	UE_STUB_CLASS_BODY(AGameModeBase)

	TSubclassOf<APawn> DefaultPawnClass;
	TSubclassOf<APlayerController> PlayerControllerClass;
	TSubclassOf<AGameStateBase> GameStateClass;
	TSubclassOf<APlayerState> PlayerStateClass;
	TSubclassOf<AHUD> HUDClass;
	TSubclassOf<ASpectatorPawn> SpectatorClass;
	TSubclassOf<AGameSession> GameSessionClass;
	bool bStartPlayersAsSpectators = false;
	bool bPauseable = true;

	virtual void InitGame(const FString& MapName, const FString& Options, FString& ErrorMessage) { UE::Stub::Sink(MapName, Options, ErrorMessage); }
	virtual void StartPlay() {}
	virtual void RestartPlayer(AController* NewPlayer) { UE::Stub::Sink(NewPlayer); }
	virtual APawn* SpawnDefaultPawnFor(AController* NewPlayer, AActor* StartSpot) { UE::Stub::Sink(NewPlayer, StartSpot); return nullptr; }
	virtual UClass* GetDefaultPawnClassForController(AController* InController) { UE::Stub::Sink(InController); return DefaultPawnClass; }
	virtual AActor* ChoosePlayerStart(AController* Player) { UE::Stub::Sink(Player); return nullptr; }
};

// Tools/StubCompile -- STUB of GameFramework/PlayerController.h (model test only; see README.md).
#pragma once

#include "GameFramework/Controller.h"
#include "GameFramework/Pawn.h"

class ULocalPlayer;
class UPlayerInput;
class UUserWidget;
class AHUD;
class ACameraActor;
class APlayerCameraManager;

enum class EMouseLockMode : uint8
{
	DoNotLock,
	LockOnCapture,
	LockAlways,
	LockInFullscreen,
};

enum class EMouseCaptureMode : uint8
{
	NoCapture,
	CapturePermanently,
	CapturePermanently_IncludingInitialMouseDown,
	CaptureDuringMouseDown,
	CaptureDuringRightMouseDown,
};

/** Engine/Classes/GameFramework/PlayerController.h input mode data. */
struct FInputModeDataBase
{
	virtual ~FInputModeDataBase() = default;
};

struct FInputModeGameOnly : public FInputModeDataBase
{
	FInputModeGameOnly& SetConsumeCaptureMouseDown(bool InConsumeCaptureMouseDown) { UE::Stub::Sink(InConsumeCaptureMouseDown); return *this; }
};

struct FInputModeGameAndUI : public FInputModeDataBase
{
	FInputModeGameAndUI& SetLockMouseToViewportBehavior(EMouseLockMode InMouseLockMode) { UE::Stub::Sink(InMouseLockMode); return *this; }
	FInputModeGameAndUI& SetHideCursorDuringCapture(bool InHideCursorDuringCapture) { UE::Stub::Sink(InHideCursorDuringCapture); return *this; }
	FInputModeGameAndUI& SetWidgetToFocus(const void* InWidgetToFocus) { UE::Stub::Sink(InWidgetToFocus); return *this; }
};

struct FInputModeUIOnly : public FInputModeDataBase
{
	FInputModeUIOnly& SetLockMouseToViewportBehavior(EMouseLockMode InMouseLockMode) { UE::Stub::Sink(InMouseLockMode); return *this; }
	FInputModeUIOnly& SetWidgetToFocus(const void* InWidgetToFocus) { UE::Stub::Sink(InWidgetToFocus); return *this; }
};

class APlayerController : public AController
{
	UE_STUB_CLASS_BODY(APlayerController)

	TObjectPtr<UPlayerInput> PlayerInput;
	TObjectPtr<APlayerCameraManager> PlayerCameraManager;
	bool bShowMouseCursor = false;
	bool bEnableClickEvents = false;
	bool bEnableMouseOverEvents = false;

	virtual void SetupInputComponent() {}
	virtual void BeginPlay() override {}
	virtual void SetPawn(APawn* InPawn) { UE::Stub::Sink(InPawn); }
	ULocalPlayer* GetLocalPlayer() const { return nullptr; }
	void SetInputMode(const FInputModeDataBase& InData) { UE::Stub::Sink(InData); }
	void SetShowMouseCursor(bool bShow) { bShowMouseCursor = bShow; }
	bool ShouldShowMouseCursor() const { return bShowMouseCursor; }
	void SetViewTargetWithBlend(AActor* NewViewTarget, float BlendTime = 0.0f, int BlendFunc = 0, float BlendExp = 0.0f, bool bLockOutgoing = false) { UE::Stub::Sink(NewViewTarget, BlendTime, BlendFunc, BlendExp, bLockOutgoing); }
	AActor* GetViewTarget() const { return nullptr; }
	void ClientTravel(const FString& URL, int TravelType, bool bSeamless = false) { UE::Stub::Sink(URL, TravelType, bSeamless); }
	void SetPause(bool bPause) { UE::Stub::Sink(bPause); }
	bool IsPaused() const { return false; }
	void SetIgnoreMoveInput(bool bNewMoveInput) { UE::Stub::Sink(bNewMoveInput); }
	void SetIgnoreLookInput(bool bNewLookInput) { UE::Stub::Sink(bNewLookInput); }
	void FlushPressedKeys() {}
	AHUD* GetHUD() const { return nullptr; }
};

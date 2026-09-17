// Project Ascension -- AAscensionPlayerController implementation (charter 7.13, 8, 10.2, 10.6, 11.5).

#include "Player/AscensionPlayerController.h"
#include "Player/AscensionCharacter.h"
#include "Player/AscensionSettings.h"
#include "Player/CultivationPawn.h"
#include "Cultivation/CultivationSubsystem.h"
#include "Cultivation/CultivationState.h"
#include "AscensionGameplayTags.h"
#include "AscensionLog.h"
#include "Blueprint/UserWidget.h"
#include "Engine/GameInstance.h"
#include "Engine/LocalPlayer.h"
#include "Engine/World.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "InputAction.h"
#include "InputMappingContext.h"

#define LOCTEXT_NAMESPACE "AscensionPlayerController"

AAscensionPlayerController::AAscensionPlayerController()
{
	CultivationPawnClass = ACultivationPawn::StaticClass();
}

void AAscensionPlayerController::BeginPlay()
{
	Super::BeginPlay();

	ResolveInputAssetsFromSettings();

	// Charter 8: IMC_World is active outside meditation. The context swap on enter/exit (M1) is the only other place contexts change.
	MeditationState = EMeditationState::InWorld;
	if (!SetMappingContextActive(IMC_World, true))
	{
		UE_LOG(LogAscension, Warning, TEXT("AAscensionPlayerController::BeginPlay: IMC_World could not be added (unassigned here and in Project Settings -> Game -> Ascension -> Input, or no Enhanced Input subsystem). World controls are inactive."));
	}
}

void AAscensionPlayerController::ResolveInputAssetsFromSettings()
{
	const UAscensionSettings* Settings = UAscensionSettings::Get();
	if (!Settings)
	{
		return;
	}

	// Only fill what a Blueprint subclass (M1) did not assign. LoadSynchronous on a null soft path returns null, which is tolerated.
	if (!IMC_World && !Settings->WorldMappingContext.IsNull())
	{
		IMC_World = Settings->WorldMappingContext.LoadSynchronous();
		UE_CLOG(!IMC_World, LogAscension, Warning, TEXT("AAscensionPlayerController: WorldMappingContext %s failed to load."), *Settings->WorldMappingContext.ToString());
	}
	if (!IMC_Cultivation && !Settings->CultivationMappingContext.IsNull())
	{
		IMC_Cultivation = Settings->CultivationMappingContext.LoadSynchronous();
		UE_CLOG(!IMC_Cultivation, LogAscension, Warning, TEXT("AAscensionPlayerController: CultivationMappingContext %s failed to load."), *Settings->CultivationMappingContext.ToString());
	}
	if (!IA_DebugOverlay && !Settings->DebugOverlayAction.IsNull())
	{
		IA_DebugOverlay = Settings->DebugOverlayAction.LoadSynchronous();
		UE_CLOG(!IA_DebugOverlay, LogAscension, Warning, TEXT("AAscensionPlayerController: DebugOverlayAction %s failed to load."), *Settings->DebugOverlayAction.ToString());
	}
	if (!IA_DebugPanel && !Settings->DebugPanelAction.IsNull())
	{
		IA_DebugPanel = Settings->DebugPanelAction.LoadSynchronous();
		UE_CLOG(!IA_DebugPanel, LogAscension, Warning, TEXT("AAscensionPlayerController: DebugPanelAction %s failed to load."), *Settings->DebugPanelAction.ToString());
	}
}

void AAscensionPlayerController::SetupInputComponent()
{
	Super::SetupInputComponent();

	ResolveInputAssetsFromSettings();

	UEnhancedInputComponent* EnhancedInput = Cast<UEnhancedInputComponent>(InputComponent);
	if (!EnhancedInput)
	{
		UE_LOG(LogAscension, Error, TEXT("AAscensionPlayerController: the input component is not a UEnhancedInputComponent. Check Config/DefaultInput.ini DefaultInputComponentClass (charter 8)."));
		return;
	}

	// Debug toggles live on the controller so F1/F2 work in the world and in meditation alike (charter 10.6, 11.5).
	if (IA_DebugOverlay)
	{
		EnhancedInput->BindAction(IA_DebugOverlay, ETriggerEvent::Started, this, &AAscensionPlayerController::ToggleDebugOverlay);
		bDebugInputBound = true;
	}
	if (IA_DebugPanel)
	{
		EnhancedInput->BindAction(IA_DebugPanel, ETriggerEvent::Started, this, &AAscensionPlayerController::ToggleDebugPanel);
		bDebugInputBound = true;
	}
}

// -- Meditation ------------------------------------------------------------------------------------------------------------------

void AAscensionPlayerController::EnterMeditation()
{
	if (MeditationState != EMeditationState::InWorld)
	{
		UE_LOG(LogAscension, Log, TEXT("AAscensionPlayerController::EnterMeditation: ignored, state is not InWorld."));
		return;
	}

	// Charter 8: the body must be stationary. The character owns the rule; the controller only asks.
	if (const AAscensionCharacter* Body = Cast<AAscensionCharacter>(GetPawn()))
	{
		if (!Body->CanEnterMeditation())
		{
			UE_LOG(LogAscension, Log, TEXT("AAscensionPlayerController::EnterMeditation: refused, the Anchor body is moving."));
			return;
		}
	}

	// TODO(M1): the whole transition, in this order: MeditationState = Entering; AnchorPawn = GetPawn(); remove IMC_World and
	// add IMC_Cultivation (charter 8: IMC_Cultivation is active only in meditation); spawn CultivationPawnClass at the Anchor;
	// play the push-in (camera into the chest, Dantian glow, aura expanding from the body; charter 10.2, under two seconds);
	// possess it; set the Anchor's seated pose (10.4); swap the World HUD for the Cultivation HUD (10.6); MeditationState =
	// Meditating; PushControllerEvent(Event_EnterMeditation, ...). Nothing is swapped at Milestone 0: with no cultivation pawn
	// to possess, a context swap alone would strand the player without IA_ExitMeditation (bound on ACultivationPawn).
	UE_LOG(LogAscension, Log, TEXT("AAscensionPlayerController::EnterMeditation: not yet implemented (M1); the body is still and may meditate, state stays InWorld."));
}

void AAscensionPlayerController::ExitMeditation()
{
	if (MeditationState != EMeditationState::Meditating)
	{
		UE_LOG(LogAscension, Log, TEXT("AAscensionPlayerController::ExitMeditation: ignored, state is not Meditating."));
		return;
	}

	// TODO(M3): refuse while a Tribulation is in its Trial phase (charter 7.13, 8 "blocked during Tribulation Trial").
	// TODO(M1): cancel a Pulse in progress (charter 7.13 "Exiting mid-Pulse cancels it"); MeditationState = Exiting; remove
	// IMC_Cultivation and add IMC_World; play the reverse transition; re-possess AnchorPawn; destroy CultivationPawn; restore
	// the World HUD; autosave (charter 10.7); MeditationState = InWorld; PushControllerEvent(Event_ExitMeditation, ...).
	UE_LOG(LogAscension, Log, TEXT("AAscensionPlayerController::ExitMeditation: not yet implemented (M1)."));
}

bool AAscensionPlayerController::SetMappingContextActive(UInputMappingContext* Context, bool bActive)
{
	if (!Context)
	{
		return false;
	}

	ULocalPlayer* LocalPlayer = GetLocalPlayer();
	UEnhancedInputLocalPlayerSubsystem* InputSubsystem = LocalPlayer ? LocalPlayer->GetSubsystem<UEnhancedInputLocalPlayerSubsystem>() : nullptr;
	if (!InputSubsystem)
	{
		UE_LOG(LogAscension, Warning, TEXT("AAscensionPlayerController: no UEnhancedInputLocalPlayerSubsystem on the local player; cannot %s %s."),
			bActive ? TEXT("add") : TEXT("remove"), *Context->GetName());
		return false;
	}

	if (bActive)
	{
		if (!InputSubsystem->HasMappingContext(Context))
		{
			InputSubsystem->AddMappingContext(Context, MappingContextPriority);
		}
	}
	else
	{
		InputSubsystem->RemoveMappingContext(Context);
	}
	return true;
}

// Milestone 1 plumbing: unused until EnterMeditation/ExitMeditation stop being log-only stubs (see the TODO(M1) lines above),
// which is also why Cultivation/CultivationSubsystem.h, Cultivation/CultivationState.h and AscensionGameplayTags.h are included.
void AAscensionPlayerController::PushControllerEvent(const FGameplayTag& EventTag, const FText& Message)
{
	const UWorld* World = GetWorld();
	UGameInstance* GameInstance = World ? World->GetGameInstance() : nullptr;
	UCultivationSubsystem* Subsystem = GameInstance ? GameInstance->GetSubsystem<UCultivationSubsystem>() : nullptr;
	UCultivationState* State = Subsystem ? Subsystem->GetState() : nullptr;
	if (!State)
	{
		return;
	}

	FCultivationEvent Event;
	Event.EventTag = EventTag;
	Event.GameTime = World->GetTimeSeconds();
	Event.Message = Message;
	State->PushEvent(Event);
}

// -- Debug widgets ---------------------------------------------------------------------------------------------------------------

void AAscensionPlayerController::ToggleDebugOverlay()
{
	const UAscensionSettings* Settings = UAscensionSettings::Get();
	if (!Settings)
	{
		return;
	}
	ToggleDebugWidget(DebugOverlayWidget, Settings->DebugOverlayClass, TEXT("DebugOverlay (F1)"), 100);
}

void AAscensionPlayerController::ToggleDebugPanel()
{
	const UAscensionSettings* Settings = UAscensionSettings::Get();
	if (!Settings)
	{
		return;
	}
	const bool bVisible = ToggleDebugWidget(DebugPanelWidget, Settings->DebugPanelClass, TEXT("DebugPanel (F2)"), 101);
	ApplyInputModeForPanel(bVisible);
}

bool AAscensionPlayerController::ToggleDebugWidget(TObjectPtr<UUserWidget>& Widget, const TSoftClassPtr<UUserWidget>& WidgetClass, const TCHAR* DebugName, int32 ZOrder)
{
	if (!Widget)
	{
		if (WidgetClass.IsNull())
		{
			UE_LOG(LogAscension, Warning, TEXT("AAscensionPlayerController: %s class is unset in Project Settings -> Game -> Ascension (D-0010). Run Content/Python/ascension_m0_setup.py."), DebugName);
			return false;
		}

		UClass* LoadedClass = WidgetClass.LoadSynchronous();
		if (!LoadedClass)
		{
			UE_LOG(LogAscension, Warning, TEXT("AAscensionPlayerController: %s class %s failed to load."), DebugName, *WidgetClass.ToString());
			return false;
		}

		Widget = CreateWidget<UUserWidget>(this, LoadedClass);
		if (!Widget)
		{
			UE_LOG(LogAscension, Warning, TEXT("AAscensionPlayerController: CreateWidget failed for %s."), DebugName);
			return false;
		}

		Widget->AddToViewport(ZOrder);
		Widget->SetVisibility(ESlateVisibility::Visible);
		UE_LOG(LogAscension, Log, TEXT("AAscensionPlayerController: %s created and shown."), DebugName);
		return true;
	}

	const bool bNowVisible = !Widget->IsVisible();
	Widget->SetVisibility(bNowVisible ? ESlateVisibility::Visible : ESlateVisibility::Collapsed);
	UE_LOG(LogAscension, Log, TEXT("AAscensionPlayerController: %s %s."), DebugName, bNowVisible ? TEXT("shown") : TEXT("hidden"));
	return bNowVisible;
}

void AAscensionPlayerController::ApplyInputModeForPanel(bool bPanelVisible)
{
	// Charter 8: no cursor in the Cultivation Space except inside menus; the F2 panel is a menu-class tool.
	if (bPanelVisible)
	{
		FInputModeGameAndUI Mode;
		Mode.SetLockMouseToViewportBehavior(EMouseLockMode::DoNotLock);
		Mode.SetHideCursorDuringCapture(false);
		SetInputMode(Mode);
		SetShowMouseCursor(true);
	}
	else
	{
		SetInputMode(FInputModeGameOnly());
		SetShowMouseCursor(false);
	}
}

#undef LOCTEXT_NAMESPACE

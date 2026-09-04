// Project Ascension -- ACultivationPawn implementation (charter 7.11, 8, 10.2, 11.1).

#include "Player/CultivationPawn.h"
#include "Player/AscensionPlayerController.h"
#include "Cultivation/AuraComponent.h"
#include "Cultivation/QiFieldComponent.h"
#include "Cultivation/CultivationSubsystem.h"
#include "Cultivation/CultivationState.h"
#include "Cultivation/ModifierStack.h"
#include "AscensionGameplayTags.h"
#include "AscensionLog.h"
#include "Camera/CameraComponent.h"
#include "Components/SceneComponent.h"
#include "Engine/GameInstance.h"
#include "Engine/World.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "GameFramework/SpringArmComponent.h"
#include "InputAction.h"
#include "InputActionValue.h"
#include "InputMappingContext.h"

#define LOCTEXT_NAMESPACE "CultivationPawn"

ACultivationPawn::ACultivationPawn()
{
	// The aura and field components tick; the pawn itself has nothing to integrate (charter 11.1).
	PrimaryActorTick.bCanEverTick = false;

	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	RootComponent = Root;

	// Charter 10.2: fixed elevated three-quarter camera, no player rotation, no collision pull-in inside the Cultivation Space.
	CameraBoom = CreateDefaultSubobject<USpringArmComponent>(TEXT("CameraBoom"));
	CameraBoom->SetupAttachment(Root);
	CameraBoom->TargetArmLength = CameraBaseArmLength;
	CameraBoom->SetRelativeRotation(FRotator(CameraPitchDegrees, CameraYawDegrees, 0.0f));
	CameraBoom->bUsePawnControlRotation = false;
	CameraBoom->bInheritPitch = false;
	CameraBoom->bInheritYaw = false;
	CameraBoom->bInheritRoll = false;
	CameraBoom->bDoCollisionTest = false;

	Camera = CreateDefaultSubobject<UCameraComponent>(TEXT("Camera"));
	Camera->SetupAttachment(CameraBoom, USpringArmComponent::SocketName);
	Camera->bUsePawnControlRotation = false;

	Aura = CreateDefaultSubobject<UAuraComponent>(TEXT("Aura"));
	QiField = CreateDefaultSubobject<UQiFieldComponent>(TEXT("QiField"));
}

void ACultivationPawn::BeginPlay()
{
	Super::BeginPlay();

	// Charter 11.1: every rate the aura reads comes from the subsystem's ModifierStack.
	const UWorld* World = GetWorld();
	UGameInstance* GameInstance = World ? World->GetGameInstance() : nullptr;
	UCultivationSubsystem* Subsystem = GameInstance ? GameInstance->GetSubsystem<UCultivationSubsystem>() : nullptr;
	if (Subsystem && Aura)
	{
		Aura->SetStack(Subsystem->GetStack());
	}
	else
	{
		UE_LOG(LogAscension, Warning, TEXT("ACultivationPawn::BeginPlay: UCultivationSubsystem unavailable; the aura has no ModifierStack."));
	}

	// Camera framing from the Blueprint's values (the constructor used class defaults).
	if (CameraBoom)
	{
		CameraBoom->TargetArmLength = CameraBaseArmLength;
		CameraBoom->SetRelativeRotation(FRotator(CameraPitchDegrees, CameraYawDegrees, 0.0f));
	}
	// TODO(M1): scale CameraBoom->TargetArmLength with Aura->AuraReach so the camera pulls back as Reach grows (charter 10.2).
	// TODO(M1): create and bind UAutoCultivationController to Aura/QiField/State (charter 7.11).
}

void ACultivationPawn::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
	Super::SetupPlayerInputComponent(PlayerInputComponent);

	UEnhancedInputComponent* EnhancedInput = Cast<UEnhancedInputComponent>(PlayerInputComponent);
	if (!EnhancedInput)
	{
		UE_LOG(LogAscension, Error, TEXT("ACultivationPawn: the input component is not a UEnhancedInputComponent. Check Config/DefaultInput.ini DefaultInputComponentClass (charter 8)."));
		return;
	}

	// Held actions: Started -> true, Completed -> false. The payload keeps one handler per action (charter 7.2, 7.3).
	if (IA_Circulate_CW)
	{
		EnhancedInput->BindAction(IA_Circulate_CW, ETriggerEvent::Started, this, &ACultivationPawn::HandleCirculateCW, true);
		EnhancedInput->BindAction(IA_Circulate_CW, ETriggerEvent::Completed, this, &ACultivationPawn::HandleCirculateCW, false);
	}
	if (IA_Circulate_CCW)
	{
		EnhancedInput->BindAction(IA_Circulate_CCW, ETriggerEvent::Started, this, &ACultivationPawn::HandleCirculateCCW, true);
		EnhancedInput->BindAction(IA_Circulate_CCW, ETriggerEvent::Completed, this, &ACultivationPawn::HandleCirculateCCW, false);
	}
	if (IA_LayerModifier)
	{
		EnhancedInput->BindAction(IA_LayerModifier, ETriggerEvent::Started, this, &ACultivationPawn::HandleLayerModifier, true);
		EnhancedInput->BindAction(IA_LayerModifier, ETriggerEvent::Completed, this, &ACultivationPawn::HandleLayerModifier, false);
	}
	if (IA_Pulse)
	{
		EnhancedInput->BindAction(IA_Pulse, ETriggerEvent::Started, this, &ACultivationPawn::HandlePulseStarted);
		EnhancedInput->BindAction(IA_Pulse, ETriggerEvent::Completed, this, &ACultivationPawn::HandlePulseCompleted);
		// TODO(M3): Refinement Pulse -- a double-tap at full charge (charter 7.3, Realm 2+) forwards to Aura->DoubleTapPulse().
	}
	if (IA_Breakthrough)
	{
		EnhancedInput->BindAction(IA_Breakthrough, ETriggerEvent::Started, this, &ACultivationPawn::HandleBreakthroughStarted);
		EnhancedInput->BindAction(IA_Breakthrough, ETriggerEvent::Completed, this, &ACultivationPawn::HandleBreakthroughCompleted);
	}
	if (IA_AutoCultivate)
	{
		EnhancedInput->BindAction(IA_AutoCultivate, ETriggerEvent::Started, this, &ACultivationPawn::HandleAutoCultivate);
	}
	if (IA_Technique_1)
	{
		EnhancedInput->BindAction(IA_Technique_1, ETriggerEvent::Started, this, &ACultivationPawn::HandleTechnique, 1);
	}
	if (IA_Technique_2)
	{
		EnhancedInput->BindAction(IA_Technique_2, ETriggerEvent::Started, this, &ACultivationPawn::HandleTechnique, 2);
	}
	if (IA_Technique_3)
	{
		EnhancedInput->BindAction(IA_Technique_3, ETriggerEvent::Started, this, &ACultivationPawn::HandleTechnique, 3);
	}
	if (IA_Technique_4)
	{
		EnhancedInput->BindAction(IA_Technique_4, ETriggerEvent::Started, this, &ACultivationPawn::HandleTechnique, 4);
	}
	if (IA_ExitMeditation)
	{
		EnhancedInput->BindAction(IA_ExitMeditation, ETriggerEvent::Started, this, &ACultivationPawn::HandleExitMeditation);
	}
	if (IA_Menu)
	{
		EnhancedInput->BindAction(IA_Menu, ETriggerEvent::Started, this, &ACultivationPawn::HandleMenu);
	}

	// Debug toggles: the controller binds them for both contexts when it has them; bind here only as the fallback so
	// a single press is never processed twice.
	const AAscensionPlayerController* PC = Cast<AAscensionPlayerController>(GetController());
	const bool bControllerHasDebugInput = PC && PC->IsDebugInputBound();
	if (!bControllerHasDebugInput)
	{
		if (IA_DebugOverlay)
		{
			EnhancedInput->BindAction(IA_DebugOverlay, ETriggerEvent::Started, this, &ACultivationPawn::HandleDebugOverlay);
		}
		if (IA_DebugPanel)
		{
			EnhancedInput->BindAction(IA_DebugPanel, ETriggerEvent::Started, this, &ACultivationPawn::HandleDebugPanel);
		}
	}

	if (!IA_Circulate_CW || !IA_Circulate_CCW || !IA_Pulse || !IA_ExitMeditation)
	{
		UE_LOG(LogAscension, Warning, TEXT("ACultivationPawn: core input actions unassigned (IA_Circulate_CW %s, IA_Circulate_CCW %s, IA_Pulse %s, IA_ExitMeditation %s). Assign them on BP_CultivationPawn."),
			IA_Circulate_CW ? TEXT("ok") : TEXT("missing"), IA_Circulate_CCW ? TEXT("ok") : TEXT("missing"),
			IA_Pulse ? TEXT("ok") : TEXT("missing"), IA_ExitMeditation ? TEXT("ok") : TEXT("missing"));
	}
}

// -- Handlers -> aura entry points -------------------------------------------------------------------------------------------------

void ACultivationPawn::HandleCirculateCW(bool bHeld)
{
	NoteManualInput();
	if (Aura)
	{
		Aura->SetCirculateCW(bHeld);
	}
}

void ACultivationPawn::HandleCirculateCCW(bool bHeld)
{
	NoteManualInput();
	if (Aura)
	{
		Aura->SetCirculateCCW(bHeld);
	}
}

void ACultivationPawn::HandleLayerModifier(bool bHeld)
{
	NoteManualInput();
	if (Aura)
	{
		Aura->SetLayerModifier(bHeld);
	}
}

void ACultivationPawn::HandlePulseStarted()
{
	NoteManualInput();
	if (Aura)
	{
		Aura->BeginPulseCharge();
	}
}

void ACultivationPawn::HandlePulseCompleted()
{
	NoteManualInput();
	if (Aura)
	{
		Aura->ReleasePulse();
	}
}

void ACultivationPawn::HandleBreakthroughStarted()
{
	NoteManualInput();
	if (Aura)
	{
		Aura->BeginBreakthroughCharge();
	}
}

void ACultivationPawn::HandleBreakthroughCompleted()
{
	NoteManualInput();
	if (Aura)
	{
		Aura->ReleaseBreakthrough();
	}
}

void ACultivationPawn::HandleAutoCultivate()
{
	ToggleAutoCultivation();
}

void ACultivationPawn::HandleTechnique(int32 Slot)
{
	NoteManualInput();
	// TODO(M3): activate the UDaoTechnique slotted at UCultivationState::SlottedTechniques[Slot-1] (charter 8, 9.3).
	UE_LOG(LogAscension, Log, TEXT("ACultivationPawn: Technique slot %d not yet implemented (M3)."), Slot);
}

void ACultivationPawn::HandleExitMeditation()
{
	if (AAscensionPlayerController* PC = Cast<AAscensionPlayerController>(GetController()))
	{
		PC->ExitMeditation();
	}
}

void ACultivationPawn::HandleMenu()
{
	// TODO(M2): open the Cultivation menu (charter 10.6).
	UE_LOG(LogAscension, Log, TEXT("ACultivationPawn::HandleMenu: Cultivation menu not yet implemented (M2)."));
}

void ACultivationPawn::HandleDebugOverlay()
{
	if (AAscensionPlayerController* PC = Cast<AAscensionPlayerController>(GetController()))
	{
		PC->ToggleDebugOverlay();
	}
}

void ACultivationPawn::HandleDebugPanel()
{
	if (AAscensionPlayerController* PC = Cast<AAscensionPlayerController>(GetController()))
	{
		PC->ToggleDebugPanel();
	}
}

void ACultivationPawn::NoteManualInput()
{
	// TODO(M1): AutoController->NotifyManualInput() so Auto yields to the player and resumes after AutoResumeDelay (charter 7.11).
}

// -- Automatic cultivation ------------------------------------------------------------------------------------------------------------

bool ACultivationPawn::ToggleAutoCultivation()
{
	bAutoCultivationRequested = !bAutoCultivationRequested;

	const UWorld* World = GetWorld();
	UGameInstance* GameInstance = World ? World->GetGameInstance() : nullptr;
	UCultivationSubsystem* Subsystem = GameInstance ? GameInstance->GetSubsystem<UCultivationSubsystem>() : nullptr;
	if (UCultivationState* State = Subsystem ? Subsystem->GetState() : nullptr)
	{
		FCultivationEvent Event;
		Event.EventTag = AscensionTags::Event_AutoToggled;
		Event.GameTime = World->GetTimeSeconds();
		Event.Message = bAutoCultivationRequested
			? LOCTEXT("AutoOn", "Automatic cultivation on.")
			: LOCTEXT("AutoOff", "Automatic cultivation off.");
		Event.Value = bAutoCultivationRequested ? 1.0f : 0.0f;
		State->PushEvent(Event);
	}

	// TODO(M1): AutoController->bEnabled = bAutoCultivationRequested; the controller then drives Aura's entry points (charter 7.11).
	UE_LOG(LogAscension, Log, TEXT("ACultivationPawn: automatic cultivation %s (controller wiring not yet implemented, M1)."),
		bAutoCultivationRequested ? TEXT("requested") : TEXT("released"));
	return bAutoCultivationRequested;
}

#undef LOCTEXT_NAMESPACE

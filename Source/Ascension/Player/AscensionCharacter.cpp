// Project Ascension -- AAscensionCharacter implementation (charter 8, 10.1; UE 5 Third Person template structure, D-0002).

#include "Player/AscensionCharacter.h"
#include "Player/AscensionPlayerController.h"
#include "Camera/CameraComponent.h"
#include "Components/CapsuleComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/SpringArmComponent.h"
#include "GameFramework/Controller.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "InputAction.h"
#include "InputActionValue.h"
#include "InputMappingContext.h"
#include "AscensionLog.h"

AAscensionCharacter::AAscensionCharacter()
{
	// Template capsule and rotation settings (Third Person template, D-0002).
	GetCapsuleComponent()->InitCapsuleSize(42.0f, 96.0f);

	bUseControllerRotationPitch = false;
	bUseControllerRotationYaw = false;
	bUseControllerRotationRoll = false;

	// Template movement settings: face the movement direction, standard jump and walk values.
	UCharacterMovementComponent* Movement = GetCharacterMovement();
	Movement->bOrientRotationToMovement = true;
	Movement->RotationRate = FRotator(0.0f, 500.0f, 0.0f);
	Movement->JumpZVelocity = 700.0f;
	Movement->AirControl = 0.35f;
	Movement->MaxWalkSpeed = 500.0f;
	Movement->MinAnalogWalkSpeed = 20.0f;
	Movement->BrakingDecelerationWalking = 2000.0f;
	Movement->BrakingDecelerationFalling = 1500.0f;

	// Camera boom pulls in toward the character when there is a collision.
	CameraBoom = CreateDefaultSubobject<USpringArmComponent>(TEXT("CameraBoom"));
	CameraBoom->SetupAttachment(RootComponent);
	CameraBoom->TargetArmLength = 400.0f;
	CameraBoom->bUsePawnControlRotation = true;

	// Follow camera on the end of the boom; the boom already follows the controller orientation.
	FollowCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("FollowCamera"));
	FollowCamera->SetupAttachment(CameraBoom, USpringArmComponent::SocketName);
	FollowCamera->bUsePawnControlRotation = false;

	// The mannequin mesh and animation Blueprint are assigned on BP_AscensionCharacter (charter 10.4, Milestone 1).
}

void AAscensionCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
	Super::SetupPlayerInputComponent(PlayerInputComponent);

	UEnhancedInputComponent* EnhancedInput = Cast<UEnhancedInputComponent>(PlayerInputComponent);
	if (!EnhancedInput)
	{
		UE_LOG(LogAscension, Error, TEXT("AAscensionCharacter: the input component is not a UEnhancedInputComponent. Check Config/DefaultInput.ini DefaultInputComponentClass (charter 8)."));
		return;
	}

	// Every binding is to an assigned UInputAction asset; missing assets are logged, never replaced by key literals (charter 8).
	if (IA_Jump)
	{
		EnhancedInput->BindAction(IA_Jump, ETriggerEvent::Started, this, &ACharacter::Jump);
		EnhancedInput->BindAction(IA_Jump, ETriggerEvent::Completed, this, &ACharacter::StopJumping);
	}
	if (IA_Move)
	{
		EnhancedInput->BindAction(IA_Move, ETriggerEvent::Triggered, this, &AAscensionCharacter::Move);
	}
	if (IA_Look)
	{
		EnhancedInput->BindAction(IA_Look, ETriggerEvent::Triggered, this, &AAscensionCharacter::Look);
	}
	if (IA_EnterMeditation)
	{
		EnhancedInput->BindAction(IA_EnterMeditation, ETriggerEvent::Started, this, &AAscensionCharacter::EnterMeditation);
	}
	if (IA_Menu)
	{
		EnhancedInput->BindAction(IA_Menu, ETriggerEvent::Started, this, &AAscensionCharacter::Menu);
	}

	if (!IA_Move || !IA_Look || !IA_Jump || !IA_EnterMeditation || !IA_Menu)
	{
		UE_LOG(LogAscension, Warning, TEXT("AAscensionCharacter: one or more input actions are unassigned (IA_Move %s, IA_Look %s, IA_Jump %s, IA_EnterMeditation %s, IA_Menu %s). Assign them on BP_AscensionCharacter."),
			IA_Move ? TEXT("ok") : TEXT("missing"), IA_Look ? TEXT("ok") : TEXT("missing"), IA_Jump ? TEXT("ok") : TEXT("missing"),
			IA_EnterMeditation ? TEXT("ok") : TEXT("missing"), IA_Menu ? TEXT("ok") : TEXT("missing"));
	}
}

void AAscensionCharacter::Move(const FInputActionValue& Value)
{
	const FVector2D MovementVector = Value.Get<FVector2D>();

	if (Controller != nullptr)
	{
		// Forward/right relative to the control yaw only (template behaviour).
		const FRotator Rotation = Controller->GetControlRotation();
		const FRotator YawRotation(0.0f, Rotation.Yaw, 0.0f);

		const FVector ForwardDirection = FRotationMatrix(YawRotation).GetUnitAxis(EAxis::X);
		const FVector RightDirection = FRotationMatrix(YawRotation).GetUnitAxis(EAxis::Y);

		AddMovementInput(ForwardDirection, MovementVector.Y);
		AddMovementInput(RightDirection, MovementVector.X);
	}
}

void AAscensionCharacter::Look(const FInputActionValue& Value)
{
	const FVector2D LookAxisVector = Value.Get<FVector2D>();

	if (Controller != nullptr)
	{
		AddControllerYawInput(LookAxisVector.X);
		AddControllerPitchInput(LookAxisVector.Y);
	}
}

bool AAscensionCharacter::CanEnterMeditation() const
{
	const UCharacterMovementComponent* Movement = GetCharacterMovement();
	if (!Movement || !Movement->IsMovingOnGround())
	{
		return false;
	}
	return GetVelocity().SizeSquared2D() <= FMath::Square(StationarySpeedThreshold);
}

void AAscensionCharacter::EnterMeditation(const FInputActionValue& Value)
{
	AAscensionPlayerController* PC = Cast<AAscensionPlayerController>(GetController());
	if (!PC)
	{
		UE_LOG(LogAscension, Warning, TEXT("AAscensionCharacter::EnterMeditation: controller is not an AAscensionPlayerController."));
		return;
	}

	if (!CanEnterMeditation())
	{
		// Charter 8: "must be stationary". Milestone 1 shows this as the World HUD prompt rather than a log line.
		UE_LOG(LogAscension, Log, TEXT("AAscensionCharacter::EnterMeditation: refused, the body must be still on the ground (speed %.1f > %.1f)."),
			GetVelocity().Size2D(), StationarySpeedThreshold);
		return;
	}

	PC->EnterMeditation();
}

void AAscensionCharacter::Menu(const FInputActionValue& Value)
{
	// TODO(M2): open the Cultivation menu (Realm page first; charter 10.6).
	UE_LOG(LogAscension, Log, TEXT("AAscensionCharacter::Menu: Cultivation menu not yet implemented (M2)."));
}

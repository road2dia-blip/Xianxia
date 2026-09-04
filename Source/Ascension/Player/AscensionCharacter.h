// Project Ascension -- AAscensionCharacter: the Anchor body that walks the outer world (charter 4 "Anchor", 7.13, 8, 10.1, 10.4).

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "AscensionCharacter.generated.h"

class USpringArmComponent;
class UCameraComponent;
class UInputAction;
struct FInputActionValue;

/**
 * The world pawn: the UE 5 Third Person template character (D-0002) with the template's spring arm, follow camera
 * and movement settings, driven by Enhanced Input (charter 8: IA_Move, IA_Look, IA_Jump "template locomotion,
 * unchanged", plus IA_EnterMeditation and IA_Menu in IMC_World). No key literal appears here; every action is a
 * UInputAction asset assigned on the Blueprint subclass (charter 8 "rebindable through data").
 *
 * Entering meditation requires the body to be stationary (charter 8 "must be stationary"); CanEnterMeditation is the
 * single place that rule lives. When the player meditates this actor stays in the world as the Anchor (charter 7.13)
 * playing the seated pose (charter 10.4, Milestone 1).
 */
UCLASS(config = Game)
class ASCENSION_API AAscensionCharacter : public ACharacter
{
	GENERATED_BODY()

public:
	AAscensionCharacter();

	/** True when on the ground and (nearly) still: the charter 8 precondition for IA_EnterMeditation. */
	UFUNCTION(BlueprintPure, Category = "Ascension|Meditation")
	bool CanEnterMeditation() const;

	USpringArmComponent* GetCameraBoom() const { return CameraBoom; }
	UCameraComponent* GetFollowCamera() const { return FollowCamera; }

protected:
	// -- APawn ---------------------------------------------------------------------------------------------------------

	virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;

	// -- Input handlers (template locomotion + the two world actions of charter 8) ------------------------------------

	/** IA_Move (FVector2D): world-space movement relative to the control yaw. */
	void Move(const FInputActionValue& Value);

	/** IA_Look (FVector2D): controller yaw/pitch. */
	void Look(const FInputActionValue& Value);

	/** IA_EnterMeditation (Started): asks the controller to enter meditation when CanEnterMeditation. */
	void EnterMeditation(const FInputActionValue& Value);

	/** IA_Menu (Started): opens the Cultivation menu. Milestone 2 builds the menu. */
	void Menu(const FInputActionValue& Value);

	// -- Components (template) -------------------------------------------------------------------------------------------

	/** Camera boom positioning the camera behind the character. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Camera", meta = (AllowPrivateAccess = "true"))
	TObjectPtr<USpringArmComponent> CameraBoom;

	/** Follow camera. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Camera", meta = (AllowPrivateAccess = "true"))
	TObjectPtr<UCameraComponent> FollowCamera;

	// -- Input actions (assigned in BP_AscensionCharacter; created by the setup script under /Game/Ascension/Input) ------

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Input")
	TObjectPtr<UInputAction> IA_Move;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Input")
	TObjectPtr<UInputAction> IA_Look;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Input")
	TObjectPtr<UInputAction> IA_Jump;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Input")
	TObjectPtr<UInputAction> IA_EnterMeditation;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Input")
	TObjectPtr<UInputAction> IA_Menu;

	// -- Tunables ----------------------------------------------------------------------------------------------------------

	/** Horizontal speed (cm/s) at or below which the body counts as stationary for CanEnterMeditation (charter 8). Control feel, not a cultivation number. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Meditation", meta = (ClampMin = "0.0"))
	float StationarySpeedThreshold = 5.0f;
};

// Project Ascension -- ACultivationPawn: the meditation camera pawn that carries the aura and the Qi field
// (charter 3.3, 7.1-7.4, 7.11, 8, 10.2, 11.1 "CultivationPawn (meditation camera pawn)").

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Pawn.h"
#include "CultivationPawn.generated.h"

class USceneComponent;
class USpringArmComponent;
class UCameraComponent;
class UInputAction;
class UAuraComponent;
class UQiFieldComponent;

/**
 * The pawn possessed inside the Cultivation Space (charter 10.2). It owns the UAuraComponent and the
 * UQiFieldComponent and the fixed elevated three-quarter camera that pulls back as Reach grows. Its only job is to
 * translate the IMC_Cultivation actions of charter 8 into the aura's public entry points; it holds no cultivation
 * logic of its own, so UAutoCultivationController (charter 7.11) and the scripted determinism sequence (charter
 * 11.3) drive exactly the same functions this pawn does (charter 14.2 rule 5).
 *
 * Every action is a UInputAction asset assigned on BP_CultivationPawn; no key literal appears here (charter 8).
 * Held actions bind Started/Completed to Set*(true/false); one-shot actions bind Started.
 *
 * Milestone 0: components and bindings exist; the debug toggles forward to the controller; Techniques (M3), the menu
 * (M2), the Refinement double-tap trigger (M3) and the Auto controller (M1) are TODOs in the handlers.
 */
UCLASS()
class ASCENSION_API ACultivationPawn : public APawn
{
	GENERATED_BODY()

public:
	ACultivationPawn();

	// -- Components (charter 11.1) -----------------------------------------------------------------------------------------

	/** Root at the Dantian position; the aura, the field and the camera are all relative to it. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Pawn")
	TObjectPtr<USceneComponent> Root;

	/** Fixed elevated three-quarter framing (charter 10.2); arm length grows with Reach from Milestone 1. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Pawn")
	TObjectPtr<USpringArmComponent> CameraBoom;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Pawn")
	TObjectPtr<UCameraComponent> Camera;

	/** The primary mechanic (charter 5.1). */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Pawn")
	TObjectPtr<UAuraComponent> Aura;

	/** The wisps and the wave (charter 7.4). */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Pawn")
	TObjectPtr<UQiFieldComponent> QiField;

	// -- Accessors ---------------------------------------------------------------------------------------------------------------

	UFUNCTION(BlueprintPure, Category = "Ascension|Pawn")
	UAuraComponent* GetAura() const { return Aura; }

	UFUNCTION(BlueprintPure, Category = "Ascension|Pawn")
	UQiFieldComponent* GetQiField() const { return QiField; }

	// -- Automatic cultivation (charter 7.11) ---------------------------------------------------------------------------------

	/** IA_AutoCultivate and the F2 panel's "toggle Auto": flips the request flag and logs the event. M1 wires UAutoCultivationController. */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Pawn|Auto")
	bool ToggleAutoCultivation();

	UFUNCTION(BlueprintPure, Category = "Ascension|Pawn|Auto")
	bool IsAutoCultivationRequested() const { return bAutoCultivationRequested; }

protected:
	// -- APawn ---------------------------------------------------------------------------------------------------------------------

	virtual void BeginPlay() override;
	virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;

	// -- Input handlers (charter 8) -> UAuraComponent entry points ------------------------------------------------------------------

	void HandleCirculateCW(bool bHeld);
	void HandleCirculateCCW(bool bHeld);
	void HandleLayerModifier(bool bHeld);
	void HandlePulseStarted();
	void HandlePulseCompleted();
	void HandleBreakthroughStarted();
	void HandleBreakthroughCompleted();
	void HandleAutoCultivate();
	void HandleTechnique(int32 Slot);
	void HandleExitMeditation();
	void HandleMenu();
	void HandleDebugOverlay();
	void HandleDebugPanel();

	/** Charter 7.11: any cultivation input takes over from Auto mode. M1 forwards to UAutoCultivationController::NotifyManualInput. */
	void NoteManualInput();

	// -- Input actions (assigned on BP_CultivationPawn; created by the setup script under /Game/Ascension/Input) -----------------

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Input")
	TObjectPtr<UInputAction> IA_Circulate_CW;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Input")
	TObjectPtr<UInputAction> IA_Circulate_CCW;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Input")
	TObjectPtr<UInputAction> IA_Pulse;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Input")
	TObjectPtr<UInputAction> IA_LayerModifier;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Input")
	TObjectPtr<UInputAction> IA_Breakthrough;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Input")
	TObjectPtr<UInputAction> IA_AutoCultivate;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Input")
	TObjectPtr<UInputAction> IA_Technique_1;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Input")
	TObjectPtr<UInputAction> IA_Technique_2;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Input")
	TObjectPtr<UInputAction> IA_Technique_3;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Input")
	TObjectPtr<UInputAction> IA_Technique_4;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Input")
	TObjectPtr<UInputAction> IA_ExitMeditation;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Input")
	TObjectPtr<UInputAction> IA_Menu;

	/** Bound here only when the controller has not bound its own copy (AAscensionPlayerController::IsDebugInputBound). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Input")
	TObjectPtr<UInputAction> IA_DebugOverlay;

	/** Bound here only when the controller has not bound its own copy. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Input")
	TObjectPtr<UInputAction> IA_DebugPanel;

	// -- Camera framing (charter 10.2; presentation values, tunable on the Blueprint) --------------------------------------------

	/** Downward pitch of the three-quarter camera, degrees. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Camera")
	float CameraPitchDegrees = -55.0f;

	/** Yaw of the three-quarter camera, degrees. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Camera")
	float CameraYawDegrees = -30.0f;

	/** Initial arm length before Reach-driven pull-back (M1 scales it by the aura's AuraReach). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Camera", meta = (ClampMin = "100.0"))
	float CameraBaseArmLength = 1600.0f;

	// -- State ---------------------------------------------------------------------------------------------------------------------

	/** The Auto toggle (charter 7.11). Visible on the HUD as "Auto-cultivating (...)" from Milestone 1. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Pawn|Auto")
	bool bAutoCultivationRequested = false;
};

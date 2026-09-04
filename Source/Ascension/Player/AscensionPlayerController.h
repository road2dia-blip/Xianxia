// Project Ascension -- AAscensionPlayerController: input contexts, the meditation transition, and the debug widgets
// (charter 7.13, 8, 10.2, 10.6, 11.5).

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "Templates/SubclassOf.h"
#include "Cultivation/CultivationTypes.h"
#include "AscensionPlayerController.generated.h"

class UInputMappingContext;
class UInputAction;
class UUserWidget;
class ACultivationPawn;

/**
 * The single player controller. It owns the two Enhanced Input mapping contexts of charter 8 (IMC_World active
 * outside meditation, IMC_Cultivation active inside), the meditation state machine (charter 7.13: enter from a still
 * body, exit at any time except a Tribulation Trial), the pawn swap between the Anchor body and the ACultivationPawn
 * (charter 10.2), and the F1 debug overlay / F2 debug panel widgets (charter 10.6, 11.5) created from the classes in
 * UAscensionSettings.
 *
 * Milestone 0 implements the plumbing that is pure data flow: adding IMC_World at BeginPlay and creating/toggling the
 * debug widgets. EnterMeditation/ExitMeditation are log-only stubs: the context swap, the pawn swap, the camera
 * push-in transition and the HUD swap all arrive together in Milestone 1 (TODO(M1) in the bodies), because swapping
 * contexts without possessing an ACultivationPawn would leave the player with no controls and no way back.
 *
 * The four input properties (IMC_World, IMC_Cultivation, IA_DebugOverlay, IA_DebugPanel) are normally assigned on a
 * Blueprint subclass (BP_AscensionPlayerController, Milestone 1). At Milestone 0 the raw C++ class is the game mode's
 * controller, so any property left unassigned is filled from the UAscensionSettings soft references
 * (Config/DefaultGame.ini; D-0021) before use. This is what makes F1/F2 reachable in PIE on L_Test_Cultivation.
 *
 * The debug toggles are bound on the controller's own input component so they work in both contexts (as long as the
 * IMC maps IA_DebugOverlay/IA_DebugPanel); ACultivationPawn only binds its own copies when IsDebugInputBound() is
 * false, so a toggle is never processed twice.
 */
UCLASS()
class ASCENSION_API AAscensionPlayerController : public APlayerController
{
	GENERATED_BODY()

public:
	AAscensionPlayerController();

	// -- Meditation (charter 7.13, 10.2) --------------------------------------------------------------------------------

	/** IA_EnterMeditation. Milestone 0: checks the stationary gate and logs. M1: swap IMC_World -> IMC_Cultivation and possess the cultivation pawn with the transition. */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Meditation")
	void EnterMeditation();

	/** IA_ExitMeditation. Milestone 0: logs. M1: swap IMC_Cultivation -> IMC_World and return to the Anchor body. Blocked during a Tribulation Trial (M3). */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Meditation")
	void ExitMeditation();

	UFUNCTION(BlueprintPure, Category = "Ascension|Meditation")
	EMeditationState GetMeditationState() const { return MeditationState; }

	UFUNCTION(BlueprintPure, Category = "Ascension|Meditation")
	bool IsMeditating() const { return MeditationState == EMeditationState::Meditating; }

	// -- Debug widgets (charter 10.6 F1, 11.5 F2) -----------------------------------------------------------------------

	/** Show/hide the F1 overlay (UAscensionSettings::DebugOverlayClass), creating it on first use. */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Debug")
	void ToggleDebugOverlay();

	/** Show/hide the F2 panel (UAscensionSettings::DebugPanelClass), creating it on first use; shows the cursor while open. */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Debug")
	void ToggleDebugPanel();

	/** True when this controller bound IA_DebugOverlay/IA_DebugPanel itself (so the pawn must not bind them again). */
	UFUNCTION(BlueprintPure, Category = "Ascension|Debug")
	bool IsDebugInputBound() const { return bDebugInputBound; }

protected:
	// -- AActor / APlayerController -----------------------------------------------------------------------------------------

	virtual void BeginPlay() override;
	virtual void SetupInputComponent() override;

	// -- Mapping contexts (charter 8) -------------------------------------------------------------------------------------

	/** Active outside meditation: IA_Move, IA_Look, IA_Jump, IA_EnterMeditation, IA_Menu, IA_Technique_1..4. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Input")
	TObjectPtr<UInputMappingContext> IMC_World;

	/** Active only in meditation: the cultivation actions. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Input")
	TObjectPtr<UInputMappingContext> IMC_Cultivation;

	/** Priority given to whichever context is active (only one is ever added, so 0 is enough). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Input")
	int32 MappingContextPriority = 0;

	/** Optional controller-level binding of the F1 toggle so it works in both contexts. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Input")
	TObjectPtr<UInputAction> IA_DebugOverlay;

	/** Optional controller-level binding of the F2 toggle so it works in both contexts. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Input")
	TObjectPtr<UInputAction> IA_DebugPanel;

	// -- Meditation state ------------------------------------------------------------------------------------------------------

	/** InWorld, Entering, Meditating, Exiting (charter 3.3, 7.13). */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Meditation")
	EMeditationState MeditationState = EMeditationState::InWorld;

	/** Class spawned and possessed while meditating (BP_CultivationPawn from Milestone 1). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Meditation")
	TSubclassOf<ACultivationPawn> CultivationPawnClass;

	/** The Anchor body left in the world while meditating (charter 7.13), re-possessed on exit. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Meditation")
	TObjectPtr<APawn> AnchorPawn;

	/** The cultivation pawn possessed while meditating; null outside. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Meditation")
	TObjectPtr<ACultivationPawn> CultivationPawn;

	// -- Widgets -------------------------------------------------------------------------------------------------------------------

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Debug")
	TObjectPtr<UUserWidget> DebugOverlayWidget;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Debug")
	TObjectPtr<UUserWidget> DebugPanelWidget;

private:
	/**
	 * Fill any unassigned input property from the UAscensionSettings soft references (D-0021). Idempotent; called from
	 * SetupInputComponent and BeginPlay because the engine calls them in that order and each needs its own assets.
	 */
	void ResolveInputAssetsFromSettings();

	/** Add/remove a mapping context on the local player's Enhanced Input subsystem; logs and returns false when unavailable. */
	bool SetMappingContextActive(UInputMappingContext* Context, bool bActive);

	/** Push an Ascension.Event.* line into the cultivation state's event log (charter 10.6). */
	void PushControllerEvent(const FGameplayTag& EventTag, const FText& Message);

	/** Create-or-toggle helper shared by the two debug widgets. Returns the widget's new visibility. */
	bool ToggleDebugWidget(TObjectPtr<UUserWidget>& Widget, const TSoftClassPtr<UUserWidget>& WidgetClass, const TCHAR* DebugName, int32 ZOrder);

	/** Cursor / input mode follow the panel: GameAndUI with cursor while it is open, GameOnly otherwise. */
	void ApplyInputModeForPanel(bool bPanelVisible);

	bool bDebugInputBound = false;
};

// Project Ascension -- UWorldHUDWidget: C++ base of the outer-world HUD (charter 10.6 "World HUD").

#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "WorldHUDWidget.generated.h"

class UCultivationState;
class UInputMappingContext;

/**
 * The outer-world caption (charter 10.6: "Realm and Layer, Qi Reserve, prompt to meditate"). WBP_WorldHUD binds to
 * the mirrors; RefreshFrom copies them from UCultivationState and builds the prompt from the IMC_World key mapped to
 * IA_EnterMeditation (charter 8: rebindable through data, no key literals), or the "stand still" hint when the body
 * is moving (charter 8 "must be stationary").
 *
 * Milestone 0: the class. Milestone 1 authors WBP_WorldHUD and shows it outside meditation.
 */
UCLASS(Abstract, Blueprintable)
class ASCENSION_API UWorldHUDWidget : public UUserWidget
{
	GENERATED_BODY()

public:
	UWorldHUDWidget(const FObjectInitializer& ObjectInitializer);

	/** "Qi Sensing, 1st Layer". */
	UPROPERTY(BlueprintReadOnly, Category = "Ascension|HUD")
	FText RealmLayerText;

	/** Inner Qi / Qi Reserve (charter 4 naming rule). */
	UPROPERTY(BlueprintReadOnly, Category = "Ascension|HUD")
	float QiReserve = 0.0f;

	UPROPERTY(BlueprintReadOnly, Category = "Ascension|HUD")
	float QiReserveMax = 0.0f;

	/** "Press M to meditate" / "Stand still to meditate". */
	UPROPERTY(BlueprintReadOnly, Category = "Ascension|HUD")
	FText PromptText;

	/** Copy the mirrors from the state; bCanMeditate selects the prompt wording. State may be null. */
	UFUNCTION(BlueprintCallable, Category = "Ascension|HUD")
	void RefreshFrom(const UCultivationState* State, bool bCanMeditate);

	/** Resolve the state from UCultivationSubsystem and bCanMeditate from the owning AAscensionCharacter, then RefreshFrom. */
	UFUNCTION(BlueprintCallable, Category = "Ascension|HUD")
	void RefreshFromWorld();

	/** Presentation hook fired after every refresh. */
	UFUNCTION(BlueprintImplementableEvent, Category = "Ascension|HUD")
	void OnRefreshed();

protected:
	/** IMC_World, for the meditate prompt's key label. Assigned on WBP_WorldHUD. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|HUD")
	TObjectPtr<UInputMappingContext> PromptMappingContext;

	/** Asset name of the meditate action looked up in PromptMappingContext. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|HUD")
	FName EnterMeditationActionName = FName(TEXT("IA_EnterMeditation"));
};

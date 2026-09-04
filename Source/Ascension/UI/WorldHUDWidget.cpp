// Project Ascension -- UWorldHUDWidget implementation (charter 8, 10.6).

#include "UI/WorldHUDWidget.h"
#include "UI/CultivationHUDWidget.h"
#include "Cultivation/CultivationState.h"
#include "Cultivation/CultivationSubsystem.h"
#include "Cultivation/RealmLadder.h"
#include "Player/AscensionCharacter.h"
#include "Engine/GameInstance.h"
#include "Engine/World.h"
#include "InputMappingContext.h"

#define LOCTEXT_NAMESPACE "WorldHUD"

UWorldHUDWidget::UWorldHUDWidget(const FObjectInitializer& ObjectInitializer)
	: Super(ObjectInitializer)
{
}

void UWorldHUDWidget::RefreshFrom(const UCultivationState* State, bool bCanMeditate)
{
	if (State)
	{
		RealmLayerText = UCultivationHUDWidget::MakeRealmLayerText(State);
		QiReserve = State->QiReserve;
		QiReserveMax = State->GetRow().QiReserveMax;
	}

	if (bCanMeditate)
	{
		const FText KeyLabel = UCultivationHUDWidget::FindKeyLabel(PromptMappingContext, EnterMeditationActionName);
		PromptText = KeyLabel.IsEmpty()
			? LOCTEXT("PromptMeditate", "Meditate")
			: FText::Format(LOCTEXT("PromptMeditateKeyFmt", "Press {0} to meditate"), KeyLabel);
	}
	else
	{
		// Charter 8: entering meditation requires a stationary body.
		PromptText = LOCTEXT("PromptStandStill", "Stand still to meditate");
	}

	OnRefreshed();
}

void UWorldHUDWidget::RefreshFromWorld()
{
	const UWorld* World = GetWorld();
	UGameInstance* GameInstance = World ? World->GetGameInstance() : nullptr;
	const UCultivationSubsystem* Subsystem = GameInstance ? GameInstance->GetSubsystem<UCultivationSubsystem>() : nullptr;
	const UCultivationState* State = Subsystem ? Subsystem->GetState() : nullptr;

	const AAscensionCharacter* Body = Cast<AAscensionCharacter>(GetOwningPlayerPawn());
	const bool bCanMeditate = Body && Body->CanEnterMeditation();

	RefreshFrom(State, bCanMeditate);
}

#undef LOCTEXT_NAMESPACE

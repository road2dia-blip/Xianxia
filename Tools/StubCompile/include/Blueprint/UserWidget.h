// Tools/StubCompile -- STUB of Blueprint/UserWidget.h plus Components/Widget.h (UMG; model test only, see README.md).
#pragma once

#include "UObject/Object.h"

class APlayerController;
class APawn;
class UWorld;
class ULocalPlayer;
class UGameInstance;

enum class ESlateVisibility : uint8
{
	Visible,
	Collapsed,
	Hidden,
	HitTestInvisible,
	SelfHitTestInvisible,
};

class UVisual : public UObject
{
	UE_STUB_CLASS_BODY(UVisual)
};

class UWidget : public UVisual
{
	UE_STUB_CLASS_BODY(UWidget)

	void SetVisibility(ESlateVisibility InVisibility) { Visibility = InVisibility; }
	ESlateVisibility GetVisibility() const { return Visibility; }
	bool IsVisible() const { return Visibility == ESlateVisibility::Visible || Visibility == ESlateVisibility::HitTestInvisible || Visibility == ESlateVisibility::SelfHitTestInvisible; }
	void SetIsEnabled(bool bInIsEnabled) { UE::Stub::Sink(bInIsEnabled); }
	bool GetIsEnabled() const { return true; }
	void SetRenderOpacity(float InOpacity) { UE::Stub::Sink(InOpacity); }
	void SetToolTipText(const FText& InToolTipText) { UE::Stub::Sink(InToolTipText); }
	virtual UWorld* GetWorld() const override { return nullptr; }

private:
	ESlateVisibility Visibility = ESlateVisibility::Visible;
};

class UUserWidget : public UWidget
{
	UE_STUB_CLASS_BODY(UUserWidget)

	virtual bool Initialize() { return true; }
	virtual void NativeOnInitialized() {}
	virtual void NativePreConstruct() {}
	virtual void NativeConstruct() {}
	virtual void NativeDestruct() {}
	virtual void NativeTick(const struct FGeometry& MyGeometry, float InDeltaTime) { UE::Stub::Sink(&MyGeometry, InDeltaTime); }

	void AddToViewport(int32 ZOrder = 0) { UE::Stub::Sink(ZOrder); }
	bool AddToPlayerScreen(int32 ZOrder = 0) { UE::Stub::Sink(ZOrder); return true; }
	void RemoveFromParent() {}
	bool IsInViewport() const { return true; }
	APlayerController* GetOwningPlayer() const { return nullptr; }
	template <typename T>
	T* GetOwningPlayer() const { return nullptr; }
	APawn* GetOwningPlayerPawn() const { return nullptr; }
	template <typename T>
	T* GetOwningPlayerPawn() const { return nullptr; }
	ULocalPlayer* GetOwningLocalPlayer() const { return nullptr; }
	UGameInstance* GetGameInstance() const { return nullptr; }
	template <typename T>
	T* GetGameInstance() const { return nullptr; }
	void SetPositionInViewport(FVector2D Position, bool bRemoveDPIScale = true) { UE::Stub::Sink(Position, bRemoveDPIScale); }
	void SetDesiredSizeInViewport(FVector2D Size) { UE::Stub::Sink(Size); }
	void SetOwningPlayer(APlayerController* LocalPlayerController) { UE::Stub::Sink(LocalPlayerController); }
	void PlaySound(class USoundBase* SoundToPlay) { UE::Stub::Sink(SoundToPlay); }
};

struct FGeometry {};

/** Blueprint/UserWidget.h: CreateWidget<T>(Owner, Class, Name). Owner may be a world, player controller, game instance or widget. */
template <typename TWidgetType = UUserWidget, typename TOwnerType = UObject>
TWidgetType* CreateWidget(TOwnerType* OwningObject, TSubclassOf<UUserWidget> UserWidgetClass = TWidgetType::StaticClass(), FName WidgetName = NAME_None)
{
	UE::Stub::Sink(OwningObject, UserWidgetClass, WidgetName);
	return new TWidgetType();
}

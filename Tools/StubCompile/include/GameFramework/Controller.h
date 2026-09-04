// Tools/StubCompile -- STUB of GameFramework/Controller.h (model test only; see README.md).
#pragma once

#include "GameFramework/Actor.h"

class APawn;

class AController : public AActor
{
	UE_STUB_CLASS_BODY(AController)

	virtual FRotator GetControlRotation() const { return FRotator(); }
	virtual void SetControlRotation(const FRotator& NewRotation) { UE::Stub::Sink(NewRotation); }
	APawn* GetPawn() const { return nullptr; }
	template <typename T>
	T* GetPawn() const { return nullptr; }
	virtual void Possess(APawn* InPawn) { UE::Stub::Sink(InPawn); }
	virtual void UnPossess() {}
	bool IsLocalController() const { return true; }
	bool IsLocalPlayerController() const { return true; }
	bool IsPlayerController() const { return true; }
};

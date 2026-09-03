// Project Ascension -- UQiFieldComponent implementation (charter 7.3, 7.4, 11.5, Section 13).

#include "Cultivation/QiFieldComponent.h"
#include "Engine/World.h"
#include "GameFramework/Actor.h"
#include "Cultivation/AuraComponent.h"
#include "Cultivation/QiPreset.h"
#include "AscensionLog.h"

UQiFieldComponent::UQiFieldComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
	PrimaryComponentTick.bStartWithTickEnabled = true;
	WispClass = AQiWisp::StaticClass();
}

void UQiFieldComponent::BeginPlay()
{
	Super::BeginPlay();

	if (!Aura)
	{
		if (const AActor* Owner = GetOwner())
		{
			Aura = Owner->FindComponentByClass<UAuraComponent>();
		}
	}

	if (Aura)
	{
		Aura->OnPulseReleased.AddUniqueDynamic(this, &UQiFieldComponent::OnPulseReleased);
	}
	else
	{
		UE_LOG(LogAscension, Warning, TEXT("UQiFieldComponent on %s: no UAuraComponent found; Pulses will not reach the field."),
			*GetNameSafe(GetOwner()));
	}
}

void UQiFieldComponent::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	if (Aura)
	{
		Aura->OnPulseReleased.RemoveDynamic(this, &UQiFieldComponent::OnPulseReleased);
	}
	DespawnAll();
	Super::EndPlay(EndPlayReason);
}

AQiWisp* UQiFieldComponent::SpawnWisp(const UDA_QiPreset* Preset, float RadiusFraction, float AngleDegrees)
{
	UWorld* World = GetWorld();
	AActor* Owner = GetOwner();
	if (!World || !Owner || !Preset || !WispClass)
	{
		UE_LOG(LogAscension, Warning, TEXT("UQiFieldComponent::SpawnWisp: missing world, owner, preset or WispClass; nothing spawned."));
		return nullptr;
	}

	// Reach comes from the aura, which reads it from the ladder row through the stack (charter 6.6, 11.1).
	const float Reach = Aura ? Aura->AuraReach : 0.0f;
	if (Reach <= 0.0f)
	{
		UE_LOG(LogAscension, Warning, TEXT("UQiFieldComponent::SpawnWisp: AuraReach is %.1f; the wisp will sit at the centre."), Reach);
	}

	FActorSpawnParameters Params;
	Params.Owner = Owner;
	Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	AQiWisp* Wisp = World->SpawnActor<AQiWisp>(WispClass, Owner->GetActorLocation(), FRotator::ZeroRotator, Params);
	if (!Wisp)
	{
		UE_LOG(LogAscension, Warning, TEXT("UQiFieldComponent::SpawnWisp: SpawnActor failed for %s."), *GetNameSafe(WispClass));
		return nullptr;
	}

	Wisp->FieldCenter = Owner->GetActorLocation();
	Wisp->ApplyPreset(Preset);
	Wisp->SetFieldPosition(FMath::Clamp(RadiusFraction, 0.0f, 1.0f) * Reach, AngleDegrees);
	Wisp->Data.SpawnTime = World->GetTimeSeconds();
	ActiveWisps.Add(Wisp);

	UE_LOG(LogAscension, Log, TEXT("Wisp spawned: %s at %.2f Reach, %.1f deg (%d active)."),
		*Preset->GetName(), RadiusFraction, AngleDegrees, ActiveWisps.Num());
	return Wisp;
}

void UQiFieldComponent::DespawnAll()
{
	for (AQiWisp* Wisp : ActiveWisps)
	{
		if (IsValid(Wisp))
		{
			Wisp->Destroy();
		}
	}
	ActiveWisps.Reset();
}

void UQiFieldComponent::OnPulseReleased(float ReleaseStrength, bool bRefinement)
{
	// TODO(M1): start the inward wave at AuraReach travelling to the centre over PulseFlashDuration; apply the 7.3 impulse
	// to each wisp as the front passes it (force-as-wave, charter 13). bRefinement marks wisps Refining (M3).
	UE_LOG(LogAscension, Verbose, TEXT("UQiFieldComponent::OnPulseReleased(%.2f, %s): wave not yet implemented (M1)."),
		ReleaseStrength, bRefinement ? TEXT("refinement") : TEXT("normal"));
}

int32 UQiFieldComponent::CountByCondition(FGameplayTag Condition) const
{
	int32 Count = 0;
	for (const AQiWisp* Wisp : ActiveWisps)
	{
		if (IsValid(Wisp) && Wisp->Data.Condition.MatchesTagExact(Condition))
		{
			++Count;
		}
	}
	return Count;
}

float UQiFieldComponent::NearestDistanceByCondition(FGameplayTag Condition) const
{
	float Nearest = -1.0f;
	for (const AQiWisp* Wisp : ActiveWisps)
	{
		if (!IsValid(Wisp) || !Wisp->Data.Condition.MatchesTagExact(Condition))
		{
			continue;
		}
		if (Nearest < 0.0f || Wisp->Data.DistanceFromCenter < Nearest)
		{
			Nearest = Wisp->Data.DistanceFromCenter;
		}
	}
	return Nearest;
}

void UQiFieldComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	// TODO(M1): advance WaveFrontDistance while bWaveActive, drive every wisp (impulse decay, settle, drift, jitter,
	// Absorbing/Absorbed/Rejected), broadcast OnWispAbsorbed/OnWispRejected. TODO(M2): ambient spawning via SpawnTimer.
}

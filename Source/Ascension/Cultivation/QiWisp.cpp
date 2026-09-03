// Project Ascension -- AQiWisp implementation (charter 7.4, Section 13).

#include "Cultivation/QiWisp.h"
#include "Components/StaticMeshComponent.h"
#include "Cultivation/QiPreset.h"
#include "AscensionLog.h"

AQiWisp::AQiWisp()
{
	// Charter 7.4 / Section 13: wisps have no Tick; UQiFieldComponent drives them.
	PrimaryActorTick.bCanEverTick = false;
	PrimaryActorTick.bStartWithTickEnabled = false;

	Mesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Mesh"));
	RootComponent = Mesh;
	// Charter 2.2: no physics-driven Qi. The mesh is a visual only.
	Mesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	Mesh->SetGenerateOverlapEvents(false);
	Mesh->SetCastShadow(false);
}

void AQiWisp::ApplyPreset(const UDA_QiPreset* Preset)
{
	if (!Preset)
	{
		UE_LOG(LogAscension, Warning, TEXT("AQiWisp::ApplyPreset on %s: null preset; Data left unchanged."), *GetName());
		return;
	}

	// Straight value copies. Deliberately no `if (Condition == Impure)` anywhere (charter 7.4, Section 13).
	Data.Condition = Preset->Condition;
	Data.Nature = Preset->Nature;
	Data.QiValue = Preset->QiValue;
	Data.Resistance = Preset->Resistance;
	Data.StabilityDrainRate = Preset->StabilityDrainRate;
	Data.PurityImpact = Preset->PurityImpact;
	Data.InsightYield = Preset->InsightYield;
	Data.Color = Preset->Color;
	Data.Brightness = Preset->Brightness;
	Data.Noise = Preset->Noise;
	Data.Flicker = Preset->Flicker;
	Data.Size = Preset->Size;
	Data.Preset = Preset;

	// Fresh lifecycle.
	Data.State = EQiWispState::Free;
	Data.AbsorptionProgress = 0.0f;
	Data.DriftAngle = 0.0f;
	Data.JitterAmplitude = 0.0f;
	Data.InwardVelocity = 0.0f;

	if (Mesh)
	{
		Mesh->SetRelativeScale3D(FVector(Data.Size));
	}

	OnVisualStateChanged(Data.State);
}

void AQiWisp::SetFieldPosition(float Distance, float Angle)
{
	Data.DistanceFromCenter = FMath::Max(0.0f, Distance);
	Data.Angle = Angle;

	// Polar coordinates in the horizontal plane of the Cultivation Space floor disc (charter 10.2).
	float SinAngle = 0.0f;
	float CosAngle = 0.0f;
	FMath::SinCos(&SinAngle, &CosAngle, FMath::DegreesToRadians(Data.Angle));
	const FVector Offset(CosAngle * Data.DistanceFromCenter, SinAngle * Data.DistanceFromCenter, 0.0f);
	SetActorLocation(FieldCenter + Offset);
}

void AQiWisp::SetWispState(EQiWispState NewState)
{
	if (Data.State == NewState)
	{
		return;
	}
	Data.State = NewState;
	OnVisualStateChanged(Data.State);
}

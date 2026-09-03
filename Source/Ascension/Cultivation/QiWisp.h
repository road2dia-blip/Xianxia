// Project Ascension -- AQiWisp: a Qi Wisp is a data holder plus a mesh, with no Tick (charter 7.4, 11.1, Section 13).

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "GameplayTagContainer.h"
#include "Cultivation/CultivationTypes.h"
#include "QiWisp.generated.h"

class UStaticMeshComponent;
class UDA_QiPreset;

/**
 * Every runtime value of one wisp (charter 7.4 "Wisp data"). Filled from a UDA_QiPreset at spawn and driven by the
 * UQiFieldComponent each frame; the debug overlay prints every field for every active wisp (charter 10.6).
 * Every Pure/Impure difference is a value set here at spawn; nothing downstream branches on Condition (charter 13).
 */
USTRUCT(BlueprintType)
struct ASCENSION_API FQiWispData
{
	GENERATED_BODY()

	/** Ascension.Qi.Condition.* copied from the preset. Identity for counting and presets only. */
	UPROPERTY(BlueprintReadOnly, Category = "Ascension|Wisp")
	FGameplayTag Condition;

	/** Ascension.Qi.Nature.* copied from the preset. */
	UPROPERTY(BlueprintReadOnly, Category = "Ascension|Wisp")
	FGameplayTag Nature;

	/** Progress granted on absorption (charter 7.4). */
	UPROPERTY(BlueprintReadOnly, Category = "Ascension|Wisp")
	float QiValue = 0.0f;

	/** 0..1 resistance to the Pulse wave (charter 7.4, 7.5). */
	UPROPERTY(BlueprintReadOnly, Category = "Ascension|Wisp")
	float Resistance = 0.0f;

	/** Stability drained per second while Drawn (charter 7.5 Option B). */
	UPROPERTY(BlueprintReadOnly, Category = "Ascension|Wisp")
	float StabilityDrainRate = 0.0f;

	/** Purity change applied on absorption (charter 7.4). */
	UPROPERTY(BlueprintReadOnly, Category = "Ascension|Wisp")
	float PurityImpact = 0.0f;

	/** Insight granted on absorption per Dao id (charter 7.4). */
	UPROPERTY(BlueprintReadOnly, Category = "Ascension|Wisp")
	TMap<FGameplayTag, float> InsightYield;

	/** Free, Drawn, Absorbing, Absorbed, Rejected, Refining (charter 7.4 WispState). */
	UPROPERTY(BlueprintReadOnly, Category = "Ascension|Wisp")
	EQiWispState State = EQiWispState::Free;

	/** Distance from the Dantian in Unreal units (the wave hits the wisp when its front passes this distance, charter 7.3). */
	UPROPERTY(BlueprintReadOnly, Category = "Ascension|Wisp")
	float DistanceFromCenter = 0.0f;

	/** Polar angle in degrees around the Dantian, measured from the owner's +X axis in the horizontal plane. */
	UPROPERTY(BlueprintReadOnly, Category = "Ascension|Wisp")
	float Angle = 0.0f;

	/** 0..1 condensation progress once Absorbing (charter 7.4). */
	UPROPERTY(BlueprintReadOnly, Category = "Ascension|Wisp")
	float AbsorptionProgress = 0.0f;

	/** Bounded tangential drift angle produced by circulation (charter 7.2: "never an orbit"). */
	UPROPERTY(BlueprintReadOnly, Category = "Ascension|Wisp")
	float DriftAngle = 0.0f;

	/** Positional jitter amplitude (Impure jitters; charter 10.3). */
	UPROPERTY(BlueprintReadOnly, Category = "Ascension|Wisp")
	float JitterAmplitude = 0.0f;

	/** Current inward speed from the decaying Pulse impulse (charter 7.3). */
	UPROPERTY(BlueprintReadOnly, Category = "Ascension|Wisp")
	float InwardVelocity = 0.0f;

	/** World game time at spawn (fade-in over 1 s, Wood multiply timing; charter 7.4, 7.6). */
	UPROPERTY(BlueprintReadOnly, Category = "Ascension|Wisp")
	float SpawnTime = 0.0f;

	// Visual block (charter 7.4 "Visual: Color, Brightness, Noise, Flicker, Size"), copied from the preset.

	UPROPERTY(BlueprintReadOnly, Category = "Ascension|Wisp|Visual")
	FLinearColor Color = FLinearColor::White;

	UPROPERTY(BlueprintReadOnly, Category = "Ascension|Wisp|Visual")
	float Brightness = 1.0f;

	UPROPERTY(BlueprintReadOnly, Category = "Ascension|Wisp|Visual")
	float Noise = 0.0f;

	UPROPERTY(BlueprintReadOnly, Category = "Ascension|Wisp|Visual")
	float Flicker = 0.0f;

	UPROPERTY(BlueprintReadOnly, Category = "Ascension|Wisp|Visual")
	float Size = 1.0f;

	/** The preset this wisp was spawned from (for the overlay and for curves such as DrawResponseCurve). */
	UPROPERTY(BlueprintReadOnly, Category = "Ascension|Wisp")
	TObjectPtr<const UDA_QiPreset> Preset;
};

/**
 * A visible concentration of Qi (charter 4 "Qi Wisp"; 7.4 "A wisp is an actor with no Tick; the UQiFieldComponent
 * on the cultivator updates all active wisps each frame"). It holds an FQiWispData and a mesh, nothing more:
 * PrimaryActorTick.bCanEverTick is false in the constructor (charter 11.1, Section 13 known-good rules).
 * ApplyPreset copies preset values into Data without any branch on Condition or Nature (charter 7.4).
 * Presentation (material parameters from the visual block, absorption flash) is a BP_QiWisp subclass reacting to
 * OnVisualStateChanged (charter 11.1: Blueprint is presentation).
 */
UCLASS()
class ASCENSION_API AQiWisp : public AActor
{
	GENERATED_BODY()

public:
	AQiWisp();

	/** The single mesh of the wisp (charter 11.4: at most 30 wisp actors, one draw each). */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Wisp")
	TObjectPtr<UStaticMeshComponent> Mesh;

	/** Every runtime value (charter 7.4). Written only by ApplyPreset, SetFieldPosition, SetWispState and the field component. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Wisp")
	FQiWispData Data;

	/** World position of the Dantian this wisp belongs to; SetFieldPosition places the actor relative to it. Set by the field component at spawn. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ascension|Wisp")
	FVector FieldCenter = FVector::ZeroVector;

	/** Copy every preset value into Data and reset the lifecycle to Free. No branch on Condition or Nature (charter 7.4). */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Wisp")
	void ApplyPreset(const UDA_QiPreset* Preset);

	/** Record polar field coordinates and move the actor to FieldCenter + polar offset in the horizontal plane. */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Wisp")
	void SetFieldPosition(float Distance, float Angle);

	/** Change the lifecycle state and notify presentation. Called by the field component only (charter 7.4). */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Wisp")
	void SetWispState(EQiWispState NewState);

	/** Presentation hook: the BP_QiWisp subclass updates material/Niagara for the new state (charter 10.3). */
	UFUNCTION(BlueprintImplementableEvent, Category = "Ascension|Wisp")
	void OnVisualStateChanged(EQiWispState NewState);
};

// Project Ascension -- UDA_QiPreset: every value a Qi Wisp carries, keyed by (Condition, Nature) (charter 7.4, 7.5, 7.6).
// Header only: a preset is pure data; the wisp copies it at spawn and never branches on Condition or Nature.

#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "GameplayTagContainer.h"
#include "QiPreset.generated.h"

class UCurveFloat;

/**
 * A Qi preset (charter 7.4 "Every value comes from a preset: UDA_QiPreset assets keyed by (Condition, Nature).
 * The wisp never branches on Condition or Nature. Adding a nature is adding a preset.").
 *
 * Behavioural identity of a Condition (charter 7.5: Impure resists 0.7, drains Stability while Drawn, lowers Purity,
 * gives 1.5x Progress ...) and the one trait of a Nature (charter 7.6: Yin drawn faster by CCW circulation, Fire raises
 * Pressure while Drawn, Wood multiplies, Metal responds only above 0.8 charge ...) are all expressed as the plain
 * values below. The visual block feeds M_QiWisp so Pure / Impure / Corrupted / Refined stay readable at every scale
 * (charter 10.3). Assets live in /Game/Ascension/Data/QiPresets/ (charter 11.1, Appendix C: "DA_" prefix).
 */
UCLASS(BlueprintType)
class ASCENSION_API UDA_QiPreset : public UPrimaryDataAsset
{
	GENERATED_BODY()

public:
	/** Primary asset type "QiPreset", so the asset manager and the F2 panel can list presets (header only, so a function, not a static). */
	static FPrimaryAssetType GetPrimaryAssetTypeName()
	{
		return FPrimaryAssetType(TEXT("QiPreset"));
	}

	// -- Identity (charter 7.4 QiCondition / QiNature) ----------------------------------------------------------------

	/** Ascension.Qi.Condition.* (Pure, Impure, Corrupted, Refined). Identity only; never branched on by the wisp. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Qi|Identity", meta = (Categories = "Ascension.Qi.Condition"))
	FGameplayTag Condition;

	/** Ascension.Qi.Nature.* (Generic, Fire, Water, ...). Identity only; never branched on by the wisp. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Qi|Identity", meta = (Categories = "Ascension.Qi.Nature"))
	FGameplayTag Nature;

	/** Player-facing name, e.g. "Impure Fire Qi". Never "mana", "energy" or "MP" (charter 2.2). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Qi|Identity")
	FText DisplayName;

	// -- Absorption values (charter 7.4, 7.5) --------------------------------------------------------------------------

	/** Cultivation Progress granted on absorption (charter 7.4 QiValue). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Qi|Absorption")
	float QiValue = 1.0f;

	/** 0..1 resistance to the Pulse wave; Impure 0.7, Corrupted 0.85, Refined 0.05 (charter 7.5). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Qi|Absorption", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float Resistance = 0.0f;

	/** Stability drained per second while Drawn (charter 7.5 "Option B"). Zero for Pure. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Qi|Absorption")
	float StabilityDrainRate = 0.0f;

	/** Applied to Purity on absorption: negative for Impure, strongly negative for Corrupted (charter 7.4, 7.8). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Qi|Absorption")
	float PurityImpact = 0.0f;

	/** Dao Insight granted on absorption, keyed by Ascension.Dao.* id (charter 7.4 InsightYield, 9.3). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Qi|Absorption", meta = (Categories = "Ascension.Dao"))
	TMap<FGameplayTag, float> InsightYield;

	/** Progress multiplier applied to QiValue (Impure 1.5, Corrupted 3, Refined 2 per charter 7.5; Metal "very high" per 7.6). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Qi|Absorption")
	float ProgressMultiplier = 1.0f;

	// -- Nature traits as data (charter 7.6 "The trait is data (a curve or a couple of floats on the preset), not code") --

	/** Stability restored on absorption (Water, Refined). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Qi|Traits")
	float StabilityRestoreOnAbsorb = 0.0f;

	/** Purity restored on absorption (Life, Water). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Qi|Traits")
	float PurityRestoreOnAbsorb = 0.0f;

	/** Temporary Reach change on absorption (Void: negative). Applied through the ModifierStack, never directly. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Qi|Traits")
	float ReachDeltaOnAbsorb = 0.0f;

	/** Minimum Pulse charge (0..1) the wave must carry for this wisp to respond (Metal: 0.8). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Qi|Traits", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float MinPulseChargeToRespond = 0.0f;

	/** -1 (CCW, Yin), 0 (none), +1 (CW, Yang): the circulation direction that draws this wisp faster (charter 7.6). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Qi|Traits", meta = (ClampMin = "-1.0", ClampMax = "1.0"))
	float PreferredCirculationDirection = 0.0f;

	/** Pressure added while Drawn (Fire: positive, charges the next Pulse faster; Earth: negative, stabilises). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Qi|Traits")
	float PressureWhileDrawn = 0.0f;

	/** Wood: a wisp left Free spawns a small second wisp of the same preset (charter 7.6). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Qi|Traits")
	bool bMultiplies = false;

	/** Seconds Free before a multiplying wisp spawns its child. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Qi|Traits", meta = (EditCondition = "bMultiplies"))
	float MultiplyInterval = 0.0f;

	/** Maximum children a multiplying wisp may produce. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Qi|Traits", meta = (EditCondition = "bMultiplies"))
	int32 MultiplyCap = 0;

	/** Optional response curve: input = wave falloff fraction, output = impulse scale (Earth "slow to draw", Metal "instant above threshold"). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Qi|Traits")
	TObjectPtr<UCurveFloat> DrawResponseCurve;

	// -- Visual (charter 7.4 "Visual: Color, Brightness, Noise, Flicker, Size"; 10.3 condition looks) -----------------

	/** Base colour: pale (Pure), dark (Impure), black-violet (Corrupted), white-gold (Refined); tinted by Nature. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Qi|Visual")
	FLinearColor Color = FLinearColor::White;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Qi|Visual")
	float Brightness = 1.0f;

	/** Surface noise amount: steady for Pure, jittering for Impure. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Qi|Visual")
	float Noise = 0.0f;

	/** Flicker amount (Corrupted pulses). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Qi|Visual")
	float Flicker = 0.0f;

	/** Mesh scale of the wisp. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Qi|Visual")
	float Size = 1.0f;

	/** Primary asset id of type "QiPreset" (SKELETON_M0). */
	virtual FPrimaryAssetId GetPrimaryAssetId() const override
	{
		return FPrimaryAssetId(GetPrimaryAssetTypeName(), GetFName());
	}
};

// Project Ascension - the Realm ladder data model and generator (charter Sections 6.1, 6.2, 6.3, 6.6).
// UDA_RealmLadderConfig holds every formula constant; URealmLadderLibrary turns it into the 81 FRealmLayerRow
// rows of DT_RealmLadder. Tools/Ladder/generate_realm_ladder.py is the offline twin: same constants, same maths.

#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "Engine/DataTable.h"
#include "GameplayTagContainer.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "Templates/SubclassOf.h"
#include "Cultivation/CultivationTypes.h"
#include "RealmLadder.generated.h"

// Cultivation/Tribulation.h is forward-declared only, to avoid an include cycle (Tribulation reads the state, which reads the row).
class UTribulationDefinition;

/**
 * One Major Realm (charter 6.2 and 6.6 FRealmDefinition): identity, theme, what it unlocks, its responsibility, its
 * Tribulation, and per-Realm numeric overrides applied on top of the 6.3 formulas by property name.
 * The unlock lists are Gameplay Tag containers (charter 11.2: "The Realm definition's unlock lists are tag lists").
 */
USTRUCT(BlueprintType)
struct ASCENSION_API FRealmDefinition
{
	GENERATED_BODY()

	/** Stable id, e.g. "QiSensing". Never shown to the player. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Realm")
	FName RealmId;

	/** Player-facing name, e.g. "Qi Sensing" (provisional per charter 6.2). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Realm")
	FText DisplayName;

	/** One-line theme from charter table 6.2. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Realm")
	FText Theme;

	/** Tints the field and the Dantian (charter 10.3 "Realm theme colour"). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Realm")
	FLinearColor ThemeColor = FLinearColor::White;

	/** Ascension.System.* tags introduced by this Realm (charter 6.2 "New system unlocked"). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Realm")
	FGameplayTagContainer UnlockedSystems;

	/** Ascension.Qi.Nature.* tags introduced by this Realm (charter 6.2 "New Qi", 7.6). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Realm")
	FGameplayTagContainer UnlockedQiNatures;

	/** Ascension.Qi.Condition.* tags introduced by this Realm (charter 7.5). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Realm")
	FGameplayTagContainer UnlockedQiConditions;

	/** Mantra ids (the UDA_Mantra::MantraId tag names, e.g. "Ascension.Mantra.Basic") that become selectable here (charter 9.2). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Realm")
	TArray<FName> UnlockedMantras;

	/** Maximum Dao node depth purchasable at this Realm (charter 9.3 "Depth into a tree is gated by DaoNodeDepthUnlocked"). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Realm")
	int32 DaoNodeDepthUnlocked = 0;

	/** The Tribulation that guards the Major Breakthrough out of this Realm (charter 6.5, Appendix A). Set in later milestones. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Realm")
	TSubclassOf<UTribulationDefinition> Tribulation;

	/** Per-Realm numeric overrides by FRealmLayerRow property name (e.g. "AuraReach"), applied after the 6.3 formulas. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Realm")
	TMap<FName, float> Overrides;

	/** The "new responsibility" of this Realm (charter 6.2), shown on the Realm page. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Realm")
	FText Responsibility;

	/** The new system in one line (charter 6.5: "the new system's tutorial hint appears"). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Realm")
	FText NewSystemSummary;
};

/**
 * One of the 81 generated rows of DT_RealmLadder (charter 6.6 FRealmLayerRow, plus MaxCirculationStrength per 6.3).
 * Field order matches Tools/Ladder/generate_realm_ladder.py and Content/Ascension/Data/DT_RealmLadder.json.
 * Nothing else in the game stores per-Layer numbers; UCultivationState reads this row and feeds the UModifierStack.
 */
USTRUCT(BlueprintType)
struct ASCENSION_API FRealmLayerRow : public FTableRowBase
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ascension|Ladder")
	int32 Realm = 1;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ascension|Ladder")
	int32 Layer = 1;

	/** Aura radius in Unreal units (charter 6.3). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ascension|Ladder")
	float AuraReach = 800.0f;

	/** Qi units the Dantian can store (charter 6.3, 7.8). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ascension|Ladder")
	float DantianCapacity = 10.0f;

	/** Spendable Inner Qi maximum = Capacity x ReserveFraction (charter 6.3). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ascension|Ladder")
	float QiReserveMax = 6.0f;

	/** Cultivation Progress needed for the next Breakthrough (charter 6.3). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ascension|Ladder")
	float ProgressRequired = 8.0f;

	/** Base Stability recovery per second while meditating (charter 6.3, 7.7). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ascension|Ladder")
	float StabilityRecovery = 0.06f;

	/** Circulation strength cap; Mantras and Daos raise it through the stack (charter 6.3). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ascension|Ladder")
	float MaxCirculationStrength = 1.0f;

	/** Seconds to charge a Pulse from 0 to 1 (charter 6.3, 7.3). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ascension|Ladder")
	float PulseChargeDuration = 1.25f;

	/** Seconds of "Recovering" after a release (charter 6.3, 7.3). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ascension|Ladder")
	float PulseRecoveryDuration = 0.75f;

	/** Wisps the Cultivation Space keeps present at once (charter 6.3, 7.4). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ascension|Ladder")
	int32 AmbientWispCount = 5;

	/** Seconds between ambient spawns (D-0005). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ascension|Ladder")
	float AmbientSpawnInterval = 4.0f;

	/** Fraction of ambient spawns that are Impure (charter 6.3, D-0004). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ascension|Ladder")
	float ImpureFraction = 0.33f;

	/** Spawn weight per nature leaf name ("Generic", "Fire", ...) for every nature unlocked at this Realm (D-0006). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ascension|Ladder")
	TMap<FName, float> NatureWeights;

	/** Base Minor Breakthrough chance before Stability/Purity/Mantra factors (charter 6.3, 7.10). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ascension|Ladder")
	float MinorBreakthroughBaseChance = 0.9f;
};

/**
 * DA_RealmLadderConfig (charter 6.1, 6.3, 6.6): every ladder formula constant plus the nine FRealmDefinition entries.
 * Constant names and defaults are identical to the Python LadderConfig dataclass in Tools/Ladder/generate_realm_ladder.py;
 * they are doubles so the in-engine generator performs the same IEEE-754 arithmetic as the offline twin.
 * The nine Realms are filled in the constructor from charter table 6.2 so a freshly created asset is already complete.
 * Tuning is an edit here followed by a regeneration (commandlet -run=RealmLadder or URealmLadderEditorLibrary), never 81 manual edits.
 */
UCLASS(BlueprintType)
class ASCENSION_API UDA_RealmLadderConfig : public UPrimaryDataAsset
{
	GENERATED_BODY()

public:
	UDA_RealmLadderConfig();

	/** Aura Reach = BaseReach * RealmGrowth^(Realm-1) * (1 + LayerGrowth * (Layer-1)) (charter 6.3). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Ladder|Reach")
	double BaseReach = 800.0;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Ladder|Reach")
	double RealmGrowth = 1.9;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Ladder|Reach")
	double LayerGrowth = 0.06;

	/** Dantian Capacity = BaseCapacity * CapacityRealmGrowth^(Realm-1) * (1 + CapacityLayerGrowth * (Layer-1)) (charter 6.3). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Ladder|Capacity")
	double BaseCapacity = 10.0;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Ladder|Capacity")
	double CapacityRealmGrowth = 3.0;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Ladder|Capacity")
	double CapacityLayerGrowth = 0.1;

	/** Qi Reserve max = Capacity * ReserveFraction (charter 6.3). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Ladder|Capacity")
	double ReserveFraction = 0.6;

	/** Progress Required = BaseProgress * ProgressRealmGrowth^(Realm-1) * (1 + ProgressLayerGrowth * (Layer-1)) (charter 6.3). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Ladder|Progress")
	double BaseProgress = 8.0;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Ladder|Progress")
	double ProgressRealmGrowth = 2.2;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Ladder|Progress")
	double ProgressLayerGrowth = 0.25;

	/** Stability recovery per second = StabilityRecoveryBase + StabilityRecoveryPerRealm * Realm (charter 6.3). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Ladder|Stability")
	double StabilityRecoveryBase = 0.05;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Ladder|Stability")
	double StabilityRecoveryPerRealm = 0.01;

	/** Circulation cap at every Layer; Mantras and Daos raise it (charter 6.3). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Ladder|Circulation")
	double MaxCirculationStrength = 1.0;

	/** Pulse charge seconds = max(Floor, Base - PerRealm * (Realm-1)) (charter 6.3, D-0003). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Ladder|Pulse")
	double PulseChargeBase = 1.25;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Ladder|Pulse")
	double PulseChargePerRealm = 0.03;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Ladder|Pulse")
	double PulseChargeFloor = 0.9;

	/** Pulse recovery seconds = max(Floor, Base - PerRealm * (Realm-1)) (charter 6.3, D-0003). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Ladder|Pulse")
	double PulseRecoveryBase = 0.75;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Ladder|Pulse")
	double PulseRecoveryPerRealm = 0.02;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Ladder|Pulse")
	double PulseRecoveryFloor = 0.5;

	/** Ambient wisp count = AmbientCountBase + AmbientCountPerRealm * Realm + floor(Layer / AmbientCountLayerDivisor) (charter 6.3, D-0012). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Ladder|Ambient")
	int32 AmbientCountBase = 3;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Ladder|Ambient")
	int32 AmbientCountPerRealm = 2;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Ladder|Ambient", meta = (ClampMin = "1"))
	int32 AmbientCountLayerDivisor = 3;

	/** Ambient spawn interval seconds = max(Floor, Base - PerRealm * (Realm-1)) (D-0005). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Ladder|Ambient")
	double AmbientSpawnIntervalBase = 4.0;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Ladder|Ambient")
	double AmbientSpawnIntervalPerRealm = 0.25;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Ladder|Ambient")
	double AmbientSpawnIntervalFloor = 2.0;

	/** Impure fraction: linear Start (Realm 1) -> Peak (PeakRealm), then linear Peak -> End (Realm 9) (charter 6.3, D-0004). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Ladder|Impure")
	double ImpureFractionStart = 0.33;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Ladder|Impure")
	double ImpureFractionPeak = 0.5;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Ladder|Impure", meta = (ClampMin = "1", ClampMax = "9"))
	int32 ImpureFractionPeakRealm = 6;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Ladder|Impure")
	double ImpureFractionEnd = 0.30;

	/** Minor Breakthrough base chance = Base - PerLayer * (Layer-1) (charter 6.3, 7.10). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Ladder|Breakthrough")
	double MinorBreakthroughBase = 0.9;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Ladder|Breakthrough")
	double MinorBreakthroughPerLayer = 0.05;

	/** Nature weights: Generic always GenericNatureWeight; every nature unlocked at or below the Realm gets UnlockedNatureWeight (D-0006). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Ladder|Natures")
	double GenericNatureWeight = 1.0;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Ladder|Natures")
	double UnlockedNatureWeight = 0.5;

	/** The nine Major Realms in order (index 0 = Realm 1), filled from charter table 6.2 in the constructor. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Ladder|Realms")
	TArray<FRealmDefinition> Realms;

	/** Primary asset type "RealmLadderConfig" so the asset manager and UAscensionSettings can find it. */
	virtual FPrimaryAssetId GetPrimaryAssetId() const override;

	/** Copies the FRealmDefinition for a 1-based Realm; returns false when out of range. */
	UFUNCTION(BlueprintPure, Category = "Ascension|Ladder")
	bool GetRealmDefinition(int32 Realm, FRealmDefinition& OutDefinition) const;

	/** Primary asset type name shared with GetPrimaryAssetId. */
	static const FPrimaryAssetType PrimaryAssetType;
};

/**
 * The ladder generator (charter 6.1 "generated from a formula in a Data Asset plus per-Realm override rows"),
 * fully implemented at Milestone 0. ComputeRow reproduces Tools/Ladder/generate_realm_ladder.py exactly:
 * double arithmetic, floor division for the ambient count, max(floor, ...) for the two Pulse timings, the
 * two-segment Impure curve, the D-0006 nature-weight scheme, the same decimal rounding, then the Realm's Overrides
 * by property name. GenerateLadderRows produces the 81 rows in R1L1..R9L9 order.
 */
UCLASS()
class ASCENSION_API URealmLadderLibrary : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:
	/** Exactly nine Realms of nine Layers (charter 6.1). */
	static constexpr int32 NumRealms = 9;
	static constexpr int32 NumLayers = 9;

	/** One row from the formulas, rounded like the Python twin, with the Realm's Overrides applied. Realm/Layer are clamped to 1..9. */
	UFUNCTION(BlueprintPure, Category = "Ascension|Ladder")
	static FRealmLayerRow ComputeRow(const UDA_RealmLadderConfig* Config, int32 Realm, int32 Layer);

	/** All 81 rows (R1L1, R1L2, ... R9L9). OutRows is emptied first. */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Ladder")
	static void GenerateLadderRows(const UDA_RealmLadderConfig* Config, TArray<FRealmLayerRow>& OutRows);

	/** Row name "R{Realm}L{Layer}", the DT_RealmLadder row key. */
	UFUNCTION(BlueprintPure, Category = "Ascension|Ladder")
	static FName MakeRowName(int32 Realm, int32 Layer);

	/**
	 * Early (1-3), Middle (4-6), Late (7-9; charter 6.1) as one value per Layer: Layer 9 returns Peak (the charter's
	 * "also called Peak"; D-0025). Publishers of State.Layer.* must add both Layer.Late and Layer.Peak for Layer 9 (use IsPeak).
	 */
	UFUNCTION(BlueprintPure, Category = "Ascension|Ladder")
	static ERealmStage GetStage(int32 Layer);

	/** Layer 9 is Peak (charter 6.1). */
	UFUNCTION(BlueprintPure, Category = "Ascension|Ladder")
	static bool IsPeak(int32 Layer);

	/** One-line description of a row for logs and the change log. */
	UFUNCTION(BlueprintPure, Category = "Ascension|Ladder")
	static FString RowToString(const FRealmLayerRow& Row);

	/** Apply one (property name, value) override to a row. Returns false and logs when the name is not a row field. */
	UFUNCTION(BlueprintCallable, Category = "Ascension|Ladder")
	static bool ApplyOverride(UPARAM(ref) FRealmLayerRow& Row, FName Property, float Value);

	/** The Impure fraction curve alone (charter 6.3, D-0004), exposed for tests and tuning previews. */
	UFUNCTION(BlueprintPure, Category = "Ascension|Ladder")
	static float ComputeImpureFraction(const UDA_RealmLadderConfig* Config, int32 Realm);

	/** Python round(Value, Decimals): scale, round half to even, unscale. Used so rows match the committed JSON. */
	static double RoundToDecimals(double Value, int32 Decimals);

	/** Double-precision Impure fraction (the value the row rounds from); ComputeImpureFraction is its Blueprint face. */
	static double ComputeImpureFractionDouble(const UDA_RealmLadderConfig* Config, int32 Realm);
};

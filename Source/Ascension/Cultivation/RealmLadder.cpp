// Project Ascension - ladder generator and DA_RealmLadderConfig defaults (charter Sections 6.1, 6.2, 6.3, 6.6).
// Offline twin: Tools/Ladder/generate_realm_ladder.py. Change a constant in both places.

#include "Cultivation/RealmLadder.h"
#include "AscensionLog.h"

#define LOCTEXT_NAMESPACE "AscensionRealmLadder"

const FPrimaryAssetType UDA_RealmLadderConfig::PrimaryAssetType(TEXT("RealmLadderConfig"));

namespace
{
	/**
	 * Request a tag by name without erroring. This runs inside the CDO constructor: the GameplayTags manager exists
	 * by then (the GameplayTags module starts before ours), but a tag missing from Config/DefaultGameplayTags.ini
	 * would otherwise log an error per request. ErrorIfNotFound=false returns an empty tag instead; the tag audit
	 * in Milestone 0 verification reports any empty entry.
	 */
	FGameplayTag SafeTag(const TCHAR* TagName)
	{
		return FGameplayTag::RequestGameplayTag(FName(TagName), /*ErrorIfNotFound=*/false);
	}

	FGameplayTagContainer MakeTags(std::initializer_list<const TCHAR*> TagNames)
	{
		FGameplayTagContainer Container;
		for (const TCHAR* Name : TagNames)
		{
			const FGameplayTag Tag = SafeTag(Name);
			if (Tag.IsValid())
			{
				Container.AddTag(Tag);
			}
		}
		return Container;
	}

	TArray<FName> MakeNames(std::initializer_list<const TCHAR*> Names)
	{
		TArray<FName> Out;
		for (const TCHAR* Name : Names)
		{
			Out.Add(FName(Name));
		}
		return Out;
	}

	/** Leaf of a tag name: "Ascension.Qi.Nature.Fire" -> "Fire". Row NatureWeights are keyed by leaf (matches the JSON). */
	FName TagLeafName(const FGameplayTag& Tag)
	{
		FString Full = Tag.GetTagName().ToString();
		int32 DotIndex = INDEX_NONE;
		if (Full.FindLastChar(TEXT('.'), DotIndex))
		{
			Full.RightChopInline(DotIndex + 1);
		}
		return FName(*Full);
	}

	const TCHAR* const GenericNatureTagName = TEXT("Ascension.Qi.Nature.Generic");
}

// ---------------------------------------------------------------------------
// UDA_RealmLadderConfig
// ---------------------------------------------------------------------------
UDA_RealmLadderConfig::UDA_RealmLadderConfig()
{
	// Charter table 6.2, one entry per Major Realm. Names are provisional (the owner may rename them); the structure is not.
	// Theme colours are Milestone 0 placeholders for the "hint" names in the Python twin (see DECISIONS: Realm theme colours).
	Realms.Reset(URealmLadderLibrary::NumRealms);

	{
		FRealmDefinition& R = Realms.AddDefaulted_GetRef();
		R.RealmId = FName(TEXT("QiSensing"));
		R.DisplayName = LOCTEXT("Realm1Name", "Qi Sensing");
		R.Theme = LOCTEXT("Realm1Theme", "Learning to perceive. The aura is small and unsteady.");
		R.ThemeColor = FLinearColor(0.80f, 0.82f, 0.85f);	// PaleSilver
		R.UnlockedSystems = MakeTags({
			TEXT("Ascension.System.Circulation"), TEXT("Ascension.System.Pulse"), TEXT("Ascension.System.Stability"),
			TEXT("Ascension.System.BasicMantra"), TEXT("Ascension.System.Breakthrough"), TEXT("Ascension.System.Tribulation"),
			TEXT("Ascension.System.AutoCultivation"), TEXT("Ascension.System.DebugOverlay") });
		R.UnlockedQiNatures = MakeTags({ TEXT("Ascension.Qi.Nature.Generic") });
		R.UnlockedQiConditions = MakeTags({ TEXT("Ascension.Qi.Condition.Pure"), TEXT("Ascension.Qi.Condition.Impure") });
		R.UnlockedMantras = MakeNames({ TEXT("Ascension.Mantra.Basic"), TEXT("Ascension.Mantra.Stillness") });
		R.DaoNodeDepthUnlocked = 0;
		R.Responsibility = LOCTEXT("Realm1Responsibility", "Do not absorb Impure Qi carelessly.");
		R.NewSystemSummary = LOCTEXT("Realm1System", "Circulation, Pulse, Pure and Impure Qi, Stability, the Basic Mantra.");
	}
	{
		FRealmDefinition& R = Realms.AddDefaulted_GetRef();
		R.RealmId = FName(TEXT("QiCondensation"));
		R.DisplayName = LOCTEXT("Realm2Name", "Qi Condensation");
		R.Theme = LOCTEXT("Realm2Theme", "Compressing Qi into the Dantian.");
		R.ThemeColor = FLinearColor(0.45f, 0.60f, 0.95f);	// MoonBlue
		R.UnlockedSystems = MakeTags({
			TEXT("Ascension.System.Purity"), TEXT("Ascension.System.RefinementPulse"), TEXT("Ascension.System.DantianCapacity"),
			TEXT("Ascension.System.DaoUnlock"), TEXT("Ascension.System.Techniques") });
		R.UnlockedQiNatures = MakeTags({ TEXT("Ascension.Qi.Nature.Yin"), TEXT("Ascension.Qi.Nature.Yang") });
		R.DaoNodeDepthUnlocked = 1;
		R.Responsibility = LOCTEXT("Realm2Responsibility", "Manage Purity; Impure Qi now contaminates.");
		R.NewSystemSummary = LOCTEXT("Realm2System", "Purity meter, Refinement Pulse (hold, then double-tap), Dantian capacity, first Dao unlock.");
	}
	{
		FRealmDefinition& R = Realms.AddDefaulted_GetRef();
		R.RealmId = FName(TEXT("FoundationEstablishment"));
		R.DisplayName = LOCTEXT("Realm3Name", "Foundation Establishment");
		R.Theme = LOCTEXT("Realm3Theme", "Building a lasting base. Aura becomes coherent.");
		R.ThemeColor = FLinearColor(0.95f, 0.55f, 0.15f);	// EmberAmber
		R.UnlockedSystems = MakeTags({
			TEXT("Ascension.System.DensityLayers"), TEXT("Ascension.System.SecondMantraChoice"),
			TEXT("Ascension.System.DaoInsight"), TEXT("Ascension.System.AnchorDrift") });
		R.UnlockedQiNatures = MakeTags({ TEXT("Ascension.Qi.Nature.Fire"), TEXT("Ascension.Qi.Nature.Water") });
		R.UnlockedMantras = MakeNames({ TEXT("Ascension.Mantra.HeavenlyLight"), TEXT("Ascension.Mantra.FireGod") });
		R.DaoNodeDepthUnlocked = 2;
		R.Responsibility = LOCTEXT("Realm3Responsibility", "Density must be balanced; an over-dense inner layer rejects Qi.");
		R.NewSystemSummary = LOCTEXT("Realm3System", "Aura density layers (inner and outer), second Mantra choice, Dao Insight generation, Anchor drift.");
	}
	{
		FRealmDefinition& R = Realms.AddDefaulted_GetRef();
		R.RealmId = FName(TEXT("CoreFormation"));
		R.DisplayName = LOCTEXT("Realm4Name", "Core Formation");
		R.Theme = LOCTEXT("Realm4Theme", "Forming a Golden Core. The Dantian becomes a structure.");
		R.ThemeColor = FLinearColor(1.00f, 0.80f, 0.25f);	// GoldenCore
		R.UnlockedSystems = MakeTags({
			TEXT("Ascension.System.Core"), TEXT("Ascension.System.CirculationMomentum"), TEXT("Ascension.System.Keystone") });
		R.UnlockedQiNatures = MakeTags({ TEXT("Ascension.Qi.Nature.Wood"), TEXT("Ascension.Qi.Nature.Metal") });
		R.DaoNodeDepthUnlocked = 3;
		R.Responsibility = LOCTEXT("Realm4Responsibility", "The Core can crack; a cracked Core halves absorption until repaired by Pure Qi.");
		R.NewSystemSummary = LOCTEXT("Realm4System", "The Core (a persistent Dantian with its own stability), circulation momentum, Keystone Dao nodes.");
	}
	{
		FRealmDefinition& R = Realms.AddDefaulted_GetRef();
		R.RealmId = FName(TEXT("NascentSoul"));
		R.DisplayName = LOCTEXT("Realm5Name", "Nascent Soul");
		R.Theme = LOCTEXT("Realm5Theme", "A second self within.");
		R.ThemeColor = FLinearColor(0.30f, 0.80f, 0.55f);	// JadeGreen
		R.UnlockedSystems = MakeTags({
			TEXT("Ascension.System.SplitCirculation"), TEXT("Ascension.System.AutoFullEfficiency"),
			TEXT("Ascension.System.ThirdMantraChoice"), TEXT("Ascension.System.LayerModifier") });
		R.UnlockedQiNatures = MakeTags({ TEXT("Ascension.Qi.Nature.Earth") });
		R.UnlockedMantras = MakeNames({ TEXT("Ascension.Mantra.YinYang") });
		R.DaoNodeDepthUnlocked = 4;
		R.Responsibility = LOCTEXT("Realm5Responsibility", "Two layers must not oppose each other for long; opposition drains Stability.");
		R.NewSystemSummary = LOCTEXT("Realm5System", "Split circulation (inner and outer layers rotate independently), full-efficiency automatic cultivation, third Mantra choice.");
	}
	{
		FRealmDefinition& R = Realms.AddDefaulted_GetRef();
		R.RealmId = FName(TEXT("SoulTransformation"));
		R.DisplayName = LOCTEXT("Realm6Name", "Soul Transformation");
		R.Theme = LOCTEXT("Realm6Theme", "Refining the self. Impurity becomes a resource.");
		R.ThemeColor = FLinearColor(0.55f, 0.30f, 0.80f);	// VioletDusk
		R.UnlockedSystems = MakeTags({
			TEXT("Ascension.System.CorruptedQi"), TEXT("Ascension.System.DevouringMantra"), TEXT("Ascension.System.DaoExpression") });
		R.UnlockedQiNatures = MakeTags({ TEXT("Ascension.Qi.Nature.Life") });
		R.UnlockedQiConditions = MakeTags({ TEXT("Ascension.Qi.Condition.Corrupted") });
		R.UnlockedMantras = MakeNames({ TEXT("Ascension.Mantra.DemonicDevouring") });
		R.DaoNodeDepthUnlocked = 5;
		R.Responsibility = LOCTEXT("Realm6Responsibility", "Corrupted Qi can corrupt the Core; corruption is a persistent state with its own visual.");
		R.NewSystemSummary = LOCTEXT("Realm6System", "Corrupted Qi (high Insight at high risk), the Devouring Mantra, Dao Expression nodes.");
	}
	{
		FRealmDefinition& R = Realms.AddDefaulted_GetRef();
		R.RealmId = FName(TEXT("VoidRefinement"));
		R.DisplayName = LOCTEXT("Realm7Name", "Void Refinement");
		R.Theme = LOCTEXT("Realm7Theme", "Cultivating in emptiness. The aura becomes a domain.");
		R.ThemeColor = FLinearColor(0.20f, 0.15f, 0.50f);	// VoidIndigo
		R.UnlockedSystems = MakeTags({
			TEXT("Ascension.System.Domain"), TEXT("Ascension.System.RealmWaveLayers") });
		R.UnlockedQiNatures = MakeTags({ TEXT("Ascension.Qi.Nature.Void") });
		R.UnlockedMantras = MakeNames({ TEXT("Ascension.Mantra.VoidStillness") });
		R.DaoNodeDepthUnlocked = 6;
		R.Responsibility = LOCTEXT("Realm7Responsibility", "Void Qi reduces reach if absorbed carelessly; the domain can shrink.");
		R.NewSystemSummary = LOCTEXT("Realm7System", "The Domain: the Cultivation Space itself becomes the aura. Void Qi. Realm-scale wave layers.");
	}
	{
		FRealmDefinition& R = Realms.AddDefaulted_GetRef();
		R.RealmId = FName(TEXT("DaoIntegration"));
		R.DisplayName = LOCTEXT("Realm8Name", "Dao Integration");
		R.Theme = LOCTEXT("Realm8Theme", "Merging path and self.");
		R.ThemeColor = FLinearColor(0.95f, 0.95f, 1.00f);	// TwinWhite
		R.UnlockedSystems = MakeTags({
			TEXT("Ascension.System.DualMantra"), TEXT("Ascension.System.SecondKeystone"), TEXT("Ascension.System.DaoResonance") });
		R.UnlockedQiConditions = MakeTags({ TEXT("Ascension.Qi.Condition.Refined") });
		R.UnlockedMantras = MakeNames({ TEXT("Ascension.Mantra.Integration") });
		R.DaoNodeDepthUnlocked = 7;
		R.Responsibility = LOCTEXT("Realm8Responsibility", "Resonance can overload; uncontrolled overload causes Qi Deviation.");
		R.NewSystemSummary = LOCTEXT("Realm8System", "Dual active Mantras with conflict rules, a second Keystone, Dao resonance, Refined Qi.");
	}
	{
		FRealmDefinition& R = Realms.AddDefaulted_GetRef();
		R.RealmId = FName(TEXT("Ascension"));
		R.DisplayName = LOCTEXT("Realm9Name", "Ascension");
		R.Theme = LOCTEXT("Realm9Theme", "Transcending the mortal frame.");
		R.ThemeColor = FLinearColor(1.00f, 0.90f, 0.60f);	// HeavenGold
		R.UnlockedSystems = MakeTags({
			TEXT("Ascension.System.AscensionPulse"), TEXT("Ascension.System.FinalDaoNodes"), TEXT("Ascension.System.Endgame") });
		R.DaoNodeDepthUnlocked = 8;
		R.Responsibility = LOCTEXT("Realm9Responsibility", "Every action has a tenfold consequence; instability is catastrophic.");
		R.NewSystemSummary = LOCTEXT("Realm9System", "The Ascension Pulse (a field-wide contraction that consumes the domain), the final Dao nodes, the end state.");
	}
}

FPrimaryAssetId UDA_RealmLadderConfig::GetPrimaryAssetId() const
{
	return FPrimaryAssetId(PrimaryAssetType, GetFName());
}

bool UDA_RealmLadderConfig::GetRealmDefinition(int32 Realm, FRealmDefinition& OutDefinition) const
{
	if (!Realms.IsValidIndex(Realm - 1))
	{
		return false;
	}
	OutDefinition = Realms[Realm - 1];
	return true;
}

// ---------------------------------------------------------------------------
// URealmLadderLibrary
// ---------------------------------------------------------------------------
double URealmLadderLibrary::RoundToDecimals(double Value, int32 Decimals)
{
	// Python: round(Value, Decimals) - round half to even at the given decimal place.
	const double Scale = FMath::Pow(10.0, static_cast<double>(Decimals));
	return FMath::RoundHalfToEven(Value * Scale) / Scale;
}

double URealmLadderLibrary::ComputeImpureFractionDouble(const UDA_RealmLadderConfig* Config, int32 Realm)
{
	if (!Config)
	{
		return 0.0;
	}
	const int32 PeakRealm = FMath::Clamp(Config->ImpureFractionPeakRealm, 1, NumRealms);
	// Python impure_fraction(): two linear segments, Realm 1 -> PeakRealm and PeakRealm -> 9.
	if (Realm <= PeakRealm)
	{
		const double Denominator = static_cast<double>(PeakRealm - 1);
		const double T = Denominator > 0.0 ? static_cast<double>(Realm - 1) / Denominator : 1.0;
		return Config->ImpureFractionStart + (Config->ImpureFractionPeak - Config->ImpureFractionStart) * T;
	}
	const double Denominator = static_cast<double>(NumRealms - PeakRealm);
	const double T = Denominator > 0.0 ? static_cast<double>(Realm - PeakRealm) / Denominator : 1.0;
	return Config->ImpureFractionPeak + (Config->ImpureFractionEnd - Config->ImpureFractionPeak) * T;
}

float URealmLadderLibrary::ComputeImpureFraction(const UDA_RealmLadderConfig* Config, int32 Realm)
{
	return static_cast<float>(ComputeImpureFractionDouble(Config, Realm));
}

FRealmLayerRow URealmLadderLibrary::ComputeRow(const UDA_RealmLadderConfig* Config, int32 Realm, int32 Layer)
{
	FRealmLayerRow Row;
	if (!Config)
	{
		UE_LOG(LogAscension, Error, TEXT("URealmLadderLibrary::ComputeRow: Config is null; returning the default row."));
		return Row;
	}

	Realm = FMath::Clamp(Realm, 1, NumRealms);
	Layer = FMath::Clamp(Layer, 1, NumLayers);
	Row.Realm = Realm;
	Row.Layer = Layer;

	// generate_row() in the Python twin, in double precision, with identical rounding before storage.
	const double R = static_cast<double>(Realm - 1);
	const double L = static_cast<double>(Layer - 1);

	const double Reach = Config->BaseReach * FMath::Pow(Config->RealmGrowth, R) * (1.0 + Config->LayerGrowth * L);
	const double Capacity = Config->BaseCapacity * FMath::Pow(Config->CapacityRealmGrowth, R) * (1.0 + Config->CapacityLayerGrowth * L);
	const double Reserve = Capacity * Config->ReserveFraction;
	const double Progress = Config->BaseProgress * FMath::Pow(Config->ProgressRealmGrowth, R) * (1.0 + Config->ProgressLayerGrowth * L);
	const double Stab = Config->StabilityRecoveryBase + Config->StabilityRecoveryPerRealm * static_cast<double>(Realm);
	const double Charge = FMath::Max(Config->PulseChargeFloor, Config->PulseChargeBase - Config->PulseChargePerRealm * R);
	const double Recovery = FMath::Max(Config->PulseRecoveryFloor, Config->PulseRecoveryBase - Config->PulseRecoveryPerRealm * R);
	const int32 Divisor = FMath::Max(1, Config->AmbientCountLayerDivisor);
	const int32 Count = Config->AmbientCountBase + Config->AmbientCountPerRealm * Realm + (Layer / Divisor);	// floor division (D-0012)
	const double Interval = FMath::Max(Config->AmbientSpawnIntervalFloor, Config->AmbientSpawnIntervalBase - Config->AmbientSpawnIntervalPerRealm * R);
	const double Impure = ComputeImpureFractionDouble(Config, Realm);
	const double Chance = Config->MinorBreakthroughBase - Config->MinorBreakthroughPerLayer * L;

	Row.AuraReach = static_cast<float>(RoundToDecimals(Reach, 2));
	Row.DantianCapacity = static_cast<float>(RoundToDecimals(Capacity, 2));
	Row.QiReserveMax = static_cast<float>(RoundToDecimals(Reserve, 2));
	Row.ProgressRequired = static_cast<float>(RoundToDecimals(Progress, 2));
	Row.StabilityRecovery = static_cast<float>(RoundToDecimals(Stab, 4));
	Row.MaxCirculationStrength = static_cast<float>(Config->MaxCirculationStrength);
	Row.PulseChargeDuration = static_cast<float>(RoundToDecimals(Charge, 3));
	Row.PulseRecoveryDuration = static_cast<float>(RoundToDecimals(Recovery, 3));
	Row.AmbientWispCount = Count;
	Row.AmbientSpawnInterval = static_cast<float>(RoundToDecimals(Interval, 3));
	Row.ImpureFraction = static_cast<float>(RoundToDecimals(Impure, 4));
	Row.MinorBreakthroughBaseChance = static_cast<float>(RoundToDecimals(Chance, 4));

	// nature_weights(): every nature introduced at or below this Realm, in Realm order (D-0006).
	Row.NatureWeights.Reset();
	const FGameplayTag GenericTag = SafeTag(GenericNatureTagName);
	for (int32 RealmIndex = 0; RealmIndex < Realm && RealmIndex < Config->Realms.Num(); ++RealmIndex)
	{
		for (const FGameplayTag& NatureTag : Config->Realms[RealmIndex].UnlockedQiNatures)
		{
			const bool bGeneric = GenericTag.IsValid() ? NatureTag.MatchesTagExact(GenericTag) : (TagLeafName(NatureTag) == FName(TEXT("Generic")));
			Row.NatureWeights.Add(TagLeafName(NatureTag), static_cast<float>(bGeneric ? Config->GenericNatureWeight : Config->UnlockedNatureWeight));
		}
	}

	// Per-Realm overrides by property name, after the formula (charter 6.1 "plus per-Realm override rows").
	if (Config->Realms.IsValidIndex(Realm - 1))
	{
		for (const TPair<FName, float>& Override : Config->Realms[Realm - 1].Overrides)
		{
			ApplyOverride(Row, Override.Key, Override.Value);
		}
	}

	return Row;
}

void URealmLadderLibrary::GenerateLadderRows(const UDA_RealmLadderConfig* Config, TArray<FRealmLayerRow>& OutRows)
{
	OutRows.Reset(NumRealms * NumLayers);
	if (!Config)
	{
		UE_LOG(LogAscension, Error, TEXT("URealmLadderLibrary::GenerateLadderRows: Config is null; no rows generated."));
		return;
	}
	for (int32 Realm = 1; Realm <= NumRealms; ++Realm)
	{
		for (int32 Layer = 1; Layer <= NumLayers; ++Layer)
		{
			OutRows.Add(ComputeRow(Config, Realm, Layer));
		}
	}
	UE_LOG(LogAscension, Log, TEXT("URealmLadderLibrary: generated %d ladder rows from '%s'."), OutRows.Num(), *Config->GetName());
}

FName URealmLadderLibrary::MakeRowName(int32 Realm, int32 Layer)
{
	return FName(*FString::Printf(TEXT("R%dL%d"), Realm, Layer));
}

ERealmStage URealmLadderLibrary::GetStage(int32 Layer)
{
	if (Layer <= 3)
	{
		return ERealmStage::Early;
	}
	if (Layer <= 6)
	{
		return ERealmStage::Middle;
	}
	if (Layer <= 8)
	{
		return ERealmStage::Late;
	}
	return ERealmStage::Peak;
}

bool URealmLadderLibrary::IsPeak(int32 Layer)
{
	return Layer >= NumLayers;
}

bool URealmLadderLibrary::ApplyOverride(FRealmLayerRow& Row, FName Property, float Value)
{
	// Property names are the FRealmLayerRow field names (the same names the JSON columns use).
	static const FName NAME_AuraReach(TEXT("AuraReach"));
	static const FName NAME_DantianCapacity(TEXT("DantianCapacity"));
	static const FName NAME_QiReserveMax(TEXT("QiReserveMax"));
	static const FName NAME_ProgressRequired(TEXT("ProgressRequired"));
	static const FName NAME_StabilityRecovery(TEXT("StabilityRecovery"));
	static const FName NAME_MaxCirculationStrength(TEXT("MaxCirculationStrength"));
	static const FName NAME_PulseChargeDuration(TEXT("PulseChargeDuration"));
	static const FName NAME_PulseRecoveryDuration(TEXT("PulseRecoveryDuration"));
	static const FName NAME_AmbientWispCount(TEXT("AmbientWispCount"));
	static const FName NAME_AmbientSpawnInterval(TEXT("AmbientSpawnInterval"));
	static const FName NAME_ImpureFraction(TEXT("ImpureFraction"));
	static const FName NAME_MinorBreakthroughBaseChance(TEXT("MinorBreakthroughBaseChance"));
	static const FString NatureWeightPrefix(TEXT("NatureWeights."));

	if (Property == NAME_AuraReach) { Row.AuraReach = Value; return true; }
	if (Property == NAME_DantianCapacity) { Row.DantianCapacity = Value; return true; }
	if (Property == NAME_QiReserveMax) { Row.QiReserveMax = Value; return true; }
	if (Property == NAME_ProgressRequired) { Row.ProgressRequired = Value; return true; }
	if (Property == NAME_StabilityRecovery) { Row.StabilityRecovery = Value; return true; }
	if (Property == NAME_MaxCirculationStrength) { Row.MaxCirculationStrength = Value; return true; }
	if (Property == NAME_PulseChargeDuration) { Row.PulseChargeDuration = Value; return true; }
	if (Property == NAME_PulseRecoveryDuration) { Row.PulseRecoveryDuration = Value; return true; }
	if (Property == NAME_AmbientWispCount) { Row.AmbientWispCount = FMath::RoundToInt(Value); return true; }
	if (Property == NAME_AmbientSpawnInterval) { Row.AmbientSpawnInterval = Value; return true; }
	if (Property == NAME_ImpureFraction) { Row.ImpureFraction = Value; return true; }
	if (Property == NAME_MinorBreakthroughBaseChance) { Row.MinorBreakthroughBaseChance = Value; return true; }

	// "NatureWeights.<Nature>" sets one nature's weight, e.g. NatureWeights.Fire.
	const FString PropertyString = Property.ToString();
	if (PropertyString.StartsWith(NatureWeightPrefix))
	{
		Row.NatureWeights.Add(FName(*PropertyString.RightChop(NatureWeightPrefix.Len())), Value);
		return true;
	}

	UE_LOG(LogAscension, Warning, TEXT("URealmLadderLibrary::ApplyOverride: '%s' is not a ladder row property; override %.4f ignored for R%dL%d."),
		*PropertyString, Value, Row.Realm, Row.Layer);
	return false;
}

FString URealmLadderLibrary::RowToString(const FRealmLayerRow& Row)
{
	FString Natures;
	for (const TPair<FName, float>& Pair : Row.NatureWeights)
	{
		if (!Natures.IsEmpty())
		{
			Natures += TEXT(" ");
		}
		Natures += FString::Printf(TEXT("%s=%.2f"), *Pair.Key.ToString(), Pair.Value);
	}
	return FString::Printf(
		TEXT("%s Reach=%.2f Capacity=%.2f Reserve=%.2f Progress=%.2f StabRec=%.4f MaxCirc=%.2f Charge=%.3f Recov=%.3f Wisps=%d Spawn=%.3f Impure=%.4f BTbase=%.4f Natures=[%s]"),
		*MakeRowName(Row.Realm, Row.Layer).ToString(),
		Row.AuraReach, Row.DantianCapacity, Row.QiReserveMax, Row.ProgressRequired, Row.StabilityRecovery,
		Row.MaxCirculationStrength, Row.PulseChargeDuration, Row.PulseRecoveryDuration, Row.AmbientWispCount,
		Row.AmbientSpawnInterval, Row.ImpureFraction, Row.MinorBreakthroughBaseChance, *Natures);
}

#undef LOCTEXT_NAMESPACE

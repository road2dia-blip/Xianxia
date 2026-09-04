// Project Ascension -- Daos: EDaoNodeFamily, UDaoTechnique, FDaoNode, UDA_Dao (charter Sections 4, 9.3, 9.4, 9.5, 9.6, 11.1).

#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "GameplayTagContainer.h"
#include "Templates/SubclassOf.h"
#include "Cultivation/Mantra.h"
#include "Dao.generated.h"

class UAuraComponent;
class UQiFieldComponent;

/**
 * Node families of a Dao tree (charter 9.3): Technique grants an active ability (slots 1-4); Expression modifies a
 * Technique's behaviour or visual; Principle is a passive rule change; Insight ("Cultivation Insight") improves
 * interaction with a Qi nature, Mantra, aura state or Realm system; Keystone is the one identity-defining node with a
 * tradeoff, available at Realm 4. Mirrors the Ascension.Dao.Node.* tags.
 */
UENUM(BlueprintType)
enum class EDaoNodeFamily : uint8
{
	Technique	UMETA(DisplayName = "Technique"),
	Expression	UMETA(DisplayName = "Expression"),
	Principle	UMETA(DisplayName = "Principle"),
	Insight		UMETA(DisplayName = "Cultivation Insight"),
	Keystone	UMETA(DisplayName = "Keystone"),
};

/**
 * An active ability granted by a Dao Technique node (charter 4 "Technique", 9.3, 9.4). Bound to IA_Technique_1..4
 * through UCultivationState::SlottedTechniques; demonstrated on the Resonance Stone (charter 9.6), never in combat
 * (charter 2.2). QiCost is paid from the Qi Reserve (Inner Qi; charter 4). Activate is a BlueprintNativeEvent so the
 * ten Techniques of 9.4 can be C++ or Blueprint subclasses; it acts only through the aura's and field's public API.
 *
 * Milestone 0: base class only. Ember Pulse and Still Pool arrive in Milestone 3; the rest with their Daos.
 */
UCLASS(Blueprintable, Abstract)
class ASCENSION_API UDaoTechnique : public UObject
{
	GENERATED_BODY()

public:
	/** Ascension.Dao.Technique.* identity (D-0014). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Dao", meta = (Categories = "Ascension.Dao.Technique"))
	FGameplayTag TechniqueTag;

	/** Player-facing name shown in the Technique slot (charter 10.6). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Dao")
	FText DisplayName;

	/** Qi units spent from the Qi Reserve per activation (charter 7.8 "spendable on Techniques"). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Dao", meta = (ClampMin = "0"))
	float QiCost = 0.0f;

	/** Seconds before the Technique can be activated again. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Dao", meta = (ClampMin = "0"))
	float Cooldown = 0.0f;

	/** Perform the Technique. Returns true when it fired (cost paid, effect applied). Native default: false. */
	UFUNCTION(BlueprintNativeEvent, Category = "Ascension|Dao")
	bool Activate(UAuraComponent* Aura, UQiFieldComponent* Field);
	virtual bool Activate_Implementation(UAuraComponent* Aura, UQiFieldComponent* Field);
};

/**
 * One node of a Dao tree (charter 9.3). Costs that Dao's Insight; Depth is gated by FRealmDefinition::DaoNodeDepthUnlocked;
 * Prerequisites are NodeIds in the same Dao. Modifiers reuse FMantraModifier and are pushed to the UModifierStack with
 * SourceId = NodeId when purchased. Technique is set on Technique nodes; ResonanceTag (Ascension.Resonance.*) marks nodes
 * that resonate across Daos at Realm 8 (charter 9.5); GrantedTags are published to the state tags while the node is
 * owned (Keystone identity, Technique availability). Efficiency nodes must express the Dao's philosophy in
 * DisplayName/Description ("Fire Qi is drawn 30% faster", never "+10% cultivation speed"; charter 9.3).
 */
USTRUCT(BlueprintType)
struct ASCENSION_API FDaoNode
{
	GENERATED_BODY()

	/** Stable id unique within the Dao, e.g. "Fire.EmberPulse". Stored in UCultivationState::UnlockedDaoNodes. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ascension|Dao")
	FName NodeId;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ascension|Dao")
	FText DisplayName;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ascension|Dao", meta = (MultiLine = "true"))
	FText Description;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ascension|Dao")
	EDaoNodeFamily Family = EDaoNodeFamily::Principle;

	/** Tree depth, 1 = root tier. Purchasable only while Depth <= the Realm's DaoNodeDepthUnlocked (charter 9.3). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ascension|Dao", meta = (ClampMin = "1"))
	int32 Depth = 1;

	/** Dao Insight spent to purchase (charter 9.3). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ascension|Dao", meta = (ClampMin = "0"))
	float InsightCost = 0.0f;

	/** NodeIds that must be owned first. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ascension|Dao")
	TArray<FName> Prerequisites;

	/** Passive numeric effects, pushed to the stack with SourceId = NodeId while owned (charter 11.1). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ascension|Dao")
	TArray<FMantraModifier> Modifiers;

	/** The Technique granted (Technique family only). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ascension|Dao")
	TSubclassOf<UDaoTechnique> Technique;

	/** Ascension.Resonance.* family; two Daos each owning a node with the same tag resonate (Realm 8, charter 9.5). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ascension|Dao", meta = (Categories = "Ascension.Resonance"))
	FGameplayTag ResonanceTag;

	/** Tags published to the state while owned (e.g. Ascension.Dao.Keystone.FurnaceHeart) so conditions and UI can react. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ascension|Dao")
	FGameplayTagContainer GrantedTags;
};

/**
 * DA_Dao (charter 4 "Dao", 9.3 UDA_Dao, 9.4 the five Daos): a path of understanding with a tree of 12-16 nodes.
 * "The player's Dao investments are their class" (charter 3.1). Natures are the Ascension.Qi.Nature.* tags whose
 * absorption yields this Dao's Insight (charter 9.3, via UDA_QiPreset::InsightYield keyed by DaoId).
 * KeystoneNodeId names the single Keystone node (charter 9.3 "one per Dao"). Additional Daos are assets under
 * Content/Ascension/Data/Daos/, never new logic (charter 5 principle 9).
 *
 * Milestone 0: data model only. Dao of Fire and Dao of Water (ten nodes each, no Keystone) arrive in Milestone 3.
 */
UCLASS(BlueprintType)
class ASCENSION_API UDA_Dao : public UPrimaryDataAsset
{
	GENERATED_BODY()

public:
	UDA_Dao();

	/** Ascension.Dao.* identity; the key of UCultivationState::DaoInsight and of preset InsightYield maps. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Dao", meta = (Categories = "Ascension.Dao"))
	FGameplayTag DaoId;

	/** Player-facing name, e.g. "Dao of Fire". */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Dao")
	FText DisplayName;

	/** One line: what this path is about (charter 9.4 "Identity"), e.g. "Pressure, speed, risk." */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Dao")
	FText Identity;

	/** Ascension.Qi.Nature.* tags this Dao draws Insight from (charter 9.4 "Natures"). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Dao", meta = (Categories = "Ascension.Qi.Nature"))
	FGameplayTagContainer Natures;

	/** The node graph (charter 9.4: 12-16 nodes per Dao). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Dao")
	TArray<FDaoNode> Nodes;

	/** NodeId of the Keystone (charter 9.3 "one per Dao"); None until the Keystone is authored (Milestone 4). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ascension|Dao")
	FName KeystoneNodeId;

	/** Native lookup by NodeId; null when absent. */
	const FDaoNode* FindNode(FName NodeId) const;

	/** Blueprint-facing lookup: copies the node out and returns true when found. */
	UFUNCTION(BlueprintPure, Category = "Ascension|Dao")
	bool TryGetNode(FName NodeId, FDaoNode& OutNode) const;

	/** Primary asset type "Dao" so the Dao page can enumerate the trees. */
	virtual FPrimaryAssetId GetPrimaryAssetId() const override;

	/** Primary asset type name shared with GetPrimaryAssetId. */
	static const FPrimaryAssetType PrimaryAssetType;
};

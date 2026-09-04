// Project Ascension -- Dao implementation (charter Sections 9.3, 9.4, 9.6).

#include "Cultivation/Dao.h"
#include "AscensionLog.h"

// ---------------------------------------------------------------------------
// UDaoTechnique
// ---------------------------------------------------------------------------
bool UDaoTechnique::Activate_Implementation(UAuraComponent* Aura, UQiFieldComponent* Field)
{
	// TODO(M3): Ember Pulse and Still Pool are the first Techniques; they pay QiCost from the Qi Reserve, respect
	// Cooldown, act through the aura/field public API and show their Impact on the Resonance Stone (charter 9.6).
	UE_LOG(LogAscension, Verbose, TEXT("UDaoTechnique::Activate: %s has no native implementation yet (M3)."), *GetName());
	return false;
}

// ---------------------------------------------------------------------------
// UDA_Dao
// ---------------------------------------------------------------------------
const FPrimaryAssetType UDA_Dao::PrimaryAssetType(TEXT("Dao"));

UDA_Dao::UDA_Dao()
{
}

FPrimaryAssetId UDA_Dao::GetPrimaryAssetId() const
{
	return FPrimaryAssetId(PrimaryAssetType, GetFName());
}

const FDaoNode* UDA_Dao::FindNode(FName NodeId) const
{
	if (NodeId.IsNone())
	{
		return nullptr;
	}

	return Nodes.FindByPredicate([NodeId](const FDaoNode& Node)
	{
		return Node.NodeId == NodeId;
	});
}

bool UDA_Dao::TryGetNode(FName NodeId, FDaoNode& OutNode) const
{
	if (const FDaoNode* Node = FindNode(NodeId))
	{
		OutNode = *Node;
		return true;
	}
	return false;
}

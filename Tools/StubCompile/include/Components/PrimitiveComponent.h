// Tools/StubCompile -- STUB of Components/PrimitiveComponent.h (model test only; see README.md).
#pragma once

#include "Components/SceneComponent.h"

class UMaterialInterface;
class UMaterialInstanceDynamic;

class UPrimitiveComponent : public USceneComponent
{
	UE_STUB_CLASS_BODY(UPrimitiveComponent)

	bool CastShadow = true;
	bool bReceivesDecals = true;
	bool bRenderCustomDepth = false;

	void SetCollisionEnabled(ECollisionEnabled::Type NewType) { UE::Stub::Sink(NewType); }
	void SetCollisionProfileName(FName InCollisionProfileName, bool bUpdateOverlaps = true) { UE::Stub::Sink(InCollisionProfileName, bUpdateOverlaps); }
	void SetCollisionResponseToAllChannels(ECollisionResponse NewResponse) { UE::Stub::Sink(NewResponse); }
	void SetCollisionResponseToChannel(ECollisionChannel Channel, ECollisionResponse NewResponse) { UE::Stub::Sink(Channel, NewResponse); }
	void SetCollisionObjectType(ECollisionChannel Channel) { UE::Stub::Sink(Channel); }
	void SetGenerateOverlapEvents(bool bInGenerateOverlapEvents) { UE::Stub::Sink(bInGenerateOverlapEvents); }
	bool GetGenerateOverlapEvents() const { return false; }
	void SetCastShadow(bool NewCastShadow) { CastShadow = NewCastShadow; }
	void SetSimulatePhysics(bool bSimulate) { UE::Stub::Sink(bSimulate); }
	void SetEnableGravity(bool bGravityEnabled) { UE::Stub::Sink(bGravityEnabled); }
	void SetRenderCustomDepth(bool bValue) { bRenderCustomDepth = bValue; }
	void SetCustomDepthStencilValue(int32 Value) { UE::Stub::Sink(Value); }
	void SetMaterial(int32 ElementIndex, UMaterialInterface* Material) { UE::Stub::Sink(ElementIndex, Material); }
	UMaterialInterface* GetMaterial(int32 ElementIndex) const { UE::Stub::Sink(ElementIndex); return nullptr; }
	UMaterialInstanceDynamic* CreateDynamicMaterialInstance(int32 ElementIndex, UMaterialInterface* SourceMaterial = nullptr, FName OptionalName = NAME_None) { UE::Stub::Sink(ElementIndex, SourceMaterial, OptionalName); return nullptr; }
	UMaterialInstanceDynamic* CreateAndSetMaterialInstanceDynamic(int32 ElementIndex) { UE::Stub::Sink(ElementIndex); return nullptr; }
	void SetTranslucentSortPriority(int32 NewTranslucentSortPriority) { UE::Stub::Sink(NewTranslucentSortPriority); }
};

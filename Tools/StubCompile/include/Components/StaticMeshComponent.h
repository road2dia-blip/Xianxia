// Tools/StubCompile -- STUB of Components/StaticMeshComponent.h (model test only; see README.md).
#pragma once

#include "Components/PrimitiveComponent.h"

class UStaticMesh;

class UMeshComponent : public UPrimitiveComponent
{
	UE_STUB_CLASS_BODY(UMeshComponent)
};

class UStaticMeshComponent : public UMeshComponent
{
	UE_STUB_CLASS_BODY(UStaticMeshComponent)

	bool SetStaticMesh(UStaticMesh* NewMesh) { UE::Stub::Sink(NewMesh); return true; }
	UStaticMesh* GetStaticMesh() const { return nullptr; }
};

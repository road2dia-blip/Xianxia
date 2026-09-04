// Tools/StubCompile -- STUB of Engine/EngineTypes.h and Engine/EngineBaseTypes.h (model test only; see README.md).
#pragma once

#include "UObject/Object.h"

/** Engine/EngineBaseTypes.h */
enum ELevelTick : int
{
	LEVELTICK_TimeOnly = 0,
	LEVELTICK_ViewportsOnly = 1,
	LEVELTICK_All = 2,
	LEVELTICK_PauseTick = 3,
};

struct FTickFunction
{
	bool bCanEverTick = false;
	bool bStartWithTickEnabled = true;
	bool bTickEvenWhenPaused = false;
	bool bAllowTickOnDedicatedServer = true;
	float TickInterval = 0.0f;
	void SetTickFunctionEnable(bool bInEnabled) { UE::Stub::Sink(bInEnabled); }
	bool IsTickFunctionEnabled() const { return bCanEverTick; }
};

struct FActorTickFunction : public FTickFunction {};
struct FActorComponentTickFunction : public FTickFunction {};

namespace EEndPlayReason
{
	enum Type : int
	{
		Destroyed,
		LevelTransition,
		EndPlayInEditor,
		RemovedFromWorld,
		Quit,
	};
}

/** Engine/EngineTypes.h */
namespace ECollisionEnabled
{
	enum Type : int
	{
		NoCollision,
		QueryOnly,
		PhysicsOnly,
		QueryAndPhysics,
		ProbeOnly,
		QueryAndProbe,
	};
}

enum class ESpawnActorCollisionHandlingMethod : uint8
{
	Undefined,
	AlwaysSpawn,
	AdjustIfPossibleButAlwaysSpawn,
	AdjustIfPossibleButDontSpawnIfColliding,
	DontSpawnIfColliding,
};

enum class ESpawnActorScaleMethod : uint8
{
	OverrideRootScale,
	MultiplyWithRoot,
	SelectDefaultAtRuntime,
};

enum ECollisionChannel : int
{
	ECC_WorldStatic,
	ECC_WorldDynamic,
	ECC_Pawn,
	ECC_Visibility,
	ECC_Camera,
	ECC_PhysicsBody,
	ECC_Vehicle,
	ECC_Destructible,
	ECC_GameTraceChannel1,
	ECC_GameTraceChannel2,
};

enum class ECollisionResponse : uint8
{
	ECR_Ignore,
	ECR_Overlap,
	ECR_Block,
};

enum EAttachmentRule : int
{
	KeepRelative,
	KeepWorld,
	SnapToTarget,
};

struct FAttachmentTransformRules
{
	static const FAttachmentTransformRules KeepRelativeTransform;
	static const FAttachmentTransformRules KeepWorldTransform;
	static const FAttachmentTransformRules SnapToTargetNotIncludingScale;
	static const FAttachmentTransformRules SnapToTargetIncludingScale;
};
inline const FAttachmentTransformRules FAttachmentTransformRules::KeepRelativeTransform{};
inline const FAttachmentTransformRules FAttachmentTransformRules::KeepWorldTransform{};
inline const FAttachmentTransformRules FAttachmentTransformRules::SnapToTargetNotIncludingScale{};
inline const FAttachmentTransformRules FAttachmentTransformRules::SnapToTargetIncludingScale{};

struct FHitResult
{
	FVector Location;
	FVector ImpactPoint;
	FVector ImpactNormal;
	float Distance = 0.0f;
};

struct FTimerHandle
{
	bool IsValid() const { return false; }
	void Invalidate() {}
};

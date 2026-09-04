// Tools/StubCompile -- STUB of UObject/ObjectMacros.h: the reflection macros as no-ops (model test only; see README.md).
//
// UnrealHeaderTool is NOT emulated. UCLASS/USTRUCT/UENUM/UPROPERTY/UFUNCTION/UMETA/UPARAM expand to nothing, so their
// specifiers are never validated. GENERATED_BODY() also expands to nothing; the `Super` typedef and StaticClass() that
// UHT would generate are supplied by the stub base classes instead (each stub engine class declares `typedef Self Super;`,
// which a directly derived game class sees as its own Super -- correct for one level of game inheritance only).
#pragma once

#include "CoreMinimal.h"

#define UCLASS(...)
#define USTRUCT(...)
#define UENUM(...)
#define UINTERFACE(...)
#define UPROPERTY(...)
#define UFUNCTION(...)
#define UDELEGATE(...)
#define UMETA(...)
#define UPARAM(...)
#define GENERATED_BODY(...)
#define GENERATED_USTRUCT_BODY(...)
#define GENERATED_UCLASS_BODY(...)
#define GENERATED_UINTERFACE_BODY(...)
#define GENERATED_IINTERFACE_BODY(...)

/** Object flags (a real UE enum with ENUM_CLASS_FLAGS; here a plain enum with operator| so `RF_Public | RF_Standalone` stays an EObjectFlags). */
enum EObjectFlags : uint32
{
	RF_NoFlags = 0x00000000,
	RF_Public = 0x00000001,
	RF_Standalone = 0x00000002,
	RF_MarkAsNative = 0x00000004,
	RF_Transactional = 0x00000008,
	RF_ClassDefaultObject = 0x00000010,
	RF_ArchetypeObject = 0x00000020,
	RF_Transient = 0x00000040,
};
inline constexpr EObjectFlags operator|(EObjectFlags A, EObjectFlags B) { return static_cast<EObjectFlags>(static_cast<uint32>(A) | static_cast<uint32>(B)); }
inline constexpr EObjectFlags operator&(EObjectFlags A, EObjectFlags B) { return static_cast<EObjectFlags>(static_cast<uint32>(A) & static_cast<uint32>(B)); }

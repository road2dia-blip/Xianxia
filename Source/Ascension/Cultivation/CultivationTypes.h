// Project Ascension - shared cultivation enums and structs (charter Sections 6.1, 7.1, 7.3, 7.4, 9.1, 10.6, 11.3).
// Header only: no .cpp. Every type here is data shared by more than one cultivation system.

#pragma once

#include "CoreMinimal.h"
#include "GameplayTagContainer.h"
#include "CultivationTypes.generated.h"

/**
 * Lifecycle of a Qi Wisp inside the aura field (charter 7.4 "WispState").
 * The wisp never branches on Condition or Nature; it only moves through these states
 * as the UQiFieldComponent drives it (charter Section 13 known-good rules).
 */
UENUM(BlueprintType)
enum class EQiWispState : uint8
{
	/** Settled in the field, unaffected by any wave. */
	Free		UMETA(DisplayName = "Free"),
	/** Hit by a Pulse wave front and moving inward under a decaying impulse. */
	Drawn		UMETA(DisplayName = "Drawn"),
	/** Reached the Dantian threshold and condensing. */
	Absorbing	UMETA(DisplayName = "Absorbing"),
	/** Condensed into the Dantian; the actor is about to be recycled. */
	Absorbed	UMETA(DisplayName = "Absorbed"),
	/** Flung outward because Stability was below the rejection threshold (charter 7.5). */
	Rejected	UMETA(DisplayName = "Rejected"),
	/** Being refined by a Refinement Pulse on the way in (charter 7.3, Realm 2+). */
	Refining	UMETA(DisplayName = "Refining"),
};

/**
 * Operation of one modifier entry in the UModifierStack (charter 9.1 FMantraModifier.Op).
 * Resolution order when a property is rebuilt: Override (last wins) -> Add (sum) -> Multiply (product).
 */
UENUM(BlueprintType)
enum class EModifierOp : uint8
{
	Add			UMETA(DisplayName = "Add"),
	Multiply	UMETA(DisplayName = "Multiply"),
	Override	UMETA(DisplayName = "Override"),
};

/**
 * Cosmetic grouping of the nine Layers of a Realm (charter 6.1): 1-3 Early, 4-6 Middle, 7-9 Late, and Layer 9 is
 * also Peak. As a single value per Layer, URealmLadderLibrary::GetStage returns Peak for Layer 9 (D-0025); publishers of
 * Ascension.State.Layer.* must add both Layer.Late and Layer.Peak at Layer 9 (use IsPeak). Used by UI and by a few
 * Mantra conditions; adds no mechanics.
 */
UENUM(BlueprintType)
enum class ERealmStage : uint8
{
	Early	UMETA(DisplayName = "Early"),
	Middle	UMETA(DisplayName = "Middle"),
	Late	UMETA(DisplayName = "Late"),
	Peak	UMETA(DisplayName = "Peak"),
};

/**
 * Sign of CirculationSigned (charter 7.1 CirculationDirection: -1, 0, +1).
 * Clockwise is the Q input, Counterclockwise the E input (charter 8).
 */
UENUM(BlueprintType)
enum class ECirculationDirection : uint8
{
	None				UMETA(DisplayName = "None"),
	Clockwise			UMETA(DisplayName = "Clockwise"),
	Counterclockwise	UMETA(DisplayName = "Counterclockwise"),
};

/**
 * Pulse state machine phases (charter 7.3). Circulation keeps running underneath every phase
 * (charter Section 13: "Circulation keeps running underneath a Pulse").
 */
UENUM(BlueprintType)
enum class EPulsePhase : uint8
{
	Idle			UMETA(DisplayName = "Idle"),
	Charging		UMETA(DisplayName = "Charging"),
	Overcharging	UMETA(DisplayName = "Overcharging"),
	Releasing		UMETA(DisplayName = "Releasing"),
	Recovering		UMETA(DisplayName = "Recovering"),
};

/**
 * Where the player's consciousness is (charter 3.3, 7.13, 10.2): in the outer world as the Anchor body,
 * transitioning, or inside the Cultivation Space.
 */
UENUM(BlueprintType)
enum class EMeditationState : uint8
{
	InWorld		UMETA(DisplayName = "In World"),
	Entering	UMETA(DisplayName = "Entering Meditation"),
	Meditating	UMETA(DisplayName = "Meditating"),
	Exiting		UMETA(DisplayName = "Exiting Meditation"),
};

/**
 * Result of a Breakthrough input (charter 6.4, 6.5). A Major Breakthrough never rolls; it starts a Tribulation.
 */
UENUM(BlueprintType)
enum class EBreakthroughOutcome : uint8
{
	NotAttempted		UMETA(DisplayName = "Not Attempted"),
	Success				UMETA(DisplayName = "Success"),
	Failure				UMETA(DisplayName = "Failure"),
	TribulationStarted	UMETA(DisplayName = "Tribulation Started"),
};

/**
 * One entry of the last-20 event log shown on the debug overlay (charter 10.6) and hashed for the
 * determinism checksum (charter 11.3). Everything a HUD "last event line" needs is here.
 */
USTRUCT(BlueprintType)
struct ASCENSION_API FCultivationEvent
{
	GENERATED_BODY()

	/** Which event this is, from the Ascension.Event.* hierarchy (charter 11.2). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ascension|Events")
	FGameplayTag EventTag;

	/** World game time (seconds) at which the event happened. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ascension|Events")
	float GameTime = 0.0f;

	/** Human-readable line for the HUD and the debug overlay (Qi is always called Qi; charter 2.2 naming rule). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ascension|Events")
	FText Message;

	/** Optional subject: a wisp preset id, a Mantra id, a Dao node id, a row name. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ascension|Events")
	FName SubjectId;

	/** Optional magnitude: Qi absorbed, Stability lost, chance rolled, and so on. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ascension|Events")
	float Value = 0.0f;
};

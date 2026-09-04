// Project Ascension -- log category (contract docs/SKELETON_M0.md "Global rules": every UE_LOG goes through LogAscension).

#pragma once

#include "CoreMinimal.h"
#include "Logging/LogMacros.h"

/**
 * Project-wide log category. Charter 14: reports quote these lines as evidence, so keep messages attributable
 * (state, cause, number). Exported so the AscensionEditor module (commandlet, editor library) logs through the same
 * category in a modular editor build -- the engine uses the same pattern (e.g. CORE_API DECLARE_LOG_CATEGORY_EXTERN).
 */
ASCENSION_API DECLARE_LOG_CATEGORY_EXTERN(LogAscension, Log, All);

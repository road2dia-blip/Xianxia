// Project Ascension -- log category (contract docs/SKELETON_M0.md "Global rules": every UE_LOG goes through LogAscension).

#pragma once

#include "CoreMinimal.h"
#include "Logging/LogMacros.h"

/** Project-wide log category. Charter 14: reports quote these lines as evidence, so keep messages attributable (state, cause, number). */
DECLARE_LOG_CATEGORY_EXTERN(LogAscension, Log, All);

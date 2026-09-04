// Tools/StubCompile -- STUB of Subsystems/GameInstanceSubsystem.h (model test only; see README.md).
#pragma once

#include "Subsystems/Subsystem.h"

class UGameInstance;

class UGameInstanceSubsystem : public USubsystem
{
	UE_STUB_CLASS_BODY(UGameInstanceSubsystem)

	UGameInstance* GetGameInstance() const { return nullptr; }
};

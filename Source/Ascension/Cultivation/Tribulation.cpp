// Project Ascension -- UTribulationDefinition base implementation (charter Sections 6.5, Appendix A).

#include "Cultivation/Tribulation.h"
#include "AscensionLog.h"

bool UTribulationDefinition::EvaluateSuccess_Implementation(const UCultivationState* State, UAuraComponent* Aura, UQiFieldComponent* Field)
{
	// TODO(M3): the Coalescence subclass is the first to override this (Appendix A 1).
	return false;
}

bool UTribulationDefinition::EvaluateFailure_Implementation(const UCultivationState* State, UAuraComponent* Aura, UQiFieldComponent* Field)
{
	// TODO(M3): the Coalescence subclass checks Stability 0 here; the Trial timer is the caller's (charter 6.5).
	return false;
}

void UTribulationDefinition::OnTrialStarted_Implementation(const UCultivationState* State, UAuraComponent* Aura, UQiFieldComponent* Field)
{
	// TODO(M3): the Tribulation runner enters the Trial phase and blocks IA_ExitMeditation (charter 7.13).
	UE_LOG(LogAscension, Verbose, TEXT("UTribulationDefinition::OnTrialStarted: %s (base; no subclass behaviour yet)."), *GetName());
}

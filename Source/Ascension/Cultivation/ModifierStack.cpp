// Project Ascension - UModifierStack implementation (charter Sections 9.1, 11.1).

#include "Cultivation/ModifierStack.h"
#include "AscensionLog.h"

// ---------------------------------------------------------------------------
// Canonical property names
// ---------------------------------------------------------------------------
namespace AscensionProps
{
#define ASCENSION_DEFINE_PROP(Name) const FName Name(TEXT(#Name));
	ASCENSION_PROPERTY_NAMES(ASCENSION_DEFINE_PROP)
#undef ASCENSION_DEFINE_PROP

	const TArray<FName>& AllPropertyNames()
	{
		static const TArray<FName> Names = {
#define ASCENSION_LIST_PROP(Name) Name,
			ASCENSION_PROPERTY_NAMES(ASCENSION_LIST_PROP)
#undef ASCENSION_LIST_PROP
		};
		return Names;
	}
}

// ---------------------------------------------------------------------------
// Mutation
// ---------------------------------------------------------------------------
void UModifierStack::SetBase(FName Property, float Value)
{
	if (Property.IsNone())
	{
		UE_LOG(LogAscension, Warning, TEXT("UModifierStack::SetBase called with an empty property name; ignored."));
		return;
	}
	BaseValues.Add(Property, Value);
	bCacheDirty = true;
}

void UModifierStack::AddModifier(const FModifierEntry& Entry)
{
	if (Entry.Property.IsNone())
	{
		UE_LOG(LogAscension, Warning, TEXT("UModifierStack::AddModifier: entry from source '%s' has no property name; ignored."),
			*Entry.SourceId.ToString());
		return;
	}
	Modifiers.Add(Entry);
	bCacheDirty = true;
}

void UModifierStack::RemoveModifiersFromSource(FName SourceId)
{
	const int32 Removed = Modifiers.RemoveAll([SourceId](const FModifierEntry& Entry)
	{
		return Entry.SourceId == SourceId;
	});
	if (Removed > 0)
	{
		bCacheDirty = true;
	}
}

void UModifierStack::SetStateTags(const FGameplayTagContainer& Tags)
{
	CurrentStateTags = Tags;
	bCacheDirty = true;
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------
bool UModifierStack::EntryApplies(const FModifierEntry& Entry) const
{
	// An empty query is unconditional (charter 9.1: the condition is optional).
	return Entry.Condition.IsEmpty() || Entry.Condition.Matches(CurrentStateTags);
}

float UModifierStack::Resolve(FName Property) const
{
	// 1. Base (ladder row). Unknown properties resolve from 0 so a missing row field is loud in the dump, not a crash.
	const float* BasePtr = BaseValues.Find(Property);
	float Value = BasePtr ? *BasePtr : 0.0f;
	if (!BasePtr)
	{
		UE_LOG(LogAscension, Verbose, TEXT("UModifierStack: property '%s' has no base value; resolving from 0."), *Property.ToString());
	}

	// 2. Override: the last applicable override replaces the base.
	// 3. Add: sum of applicable adds.
	// 4. Multiply: product of applicable multipliers.
	bool bHasOverride = false;
	float OverrideValue = 0.0f;
	float AddSum = 0.0f;
	float MulProduct = 1.0f;

	for (const FModifierEntry& Entry : Modifiers)
	{
		if (Entry.Property != Property || !EntryApplies(Entry))
		{
			continue;
		}
		switch (Entry.Op)
		{
		case EModifierOp::Override:
			bHasOverride = true;
			OverrideValue = Entry.Value;
			break;
		case EModifierOp::Add:
			AddSum += Entry.Value;
			break;
		case EModifierOp::Multiply:
			MulProduct *= Entry.Value;
			break;
		default:
			break;
		}
	}

	if (bHasOverride)
	{
		Value = OverrideValue;
	}
	Value += AddSum;
	Value *= MulProduct;
	return Value;
}

void UModifierStack::CollectKnownProperties(TArray<FName>& OutNames) const
{
	OutNames.Reset();
	// Canonical names first (stable order for the dump), then anything else that was pushed.
	for (const FName& Name : AscensionProps::AllPropertyNames())
	{
		if (BaseValues.Contains(Name))
		{
			OutNames.Add(Name);
		}
	}
	for (const TPair<FName, float>& Pair : BaseValues)
	{
		OutNames.AddUnique(Pair.Key);
	}
	for (const FModifierEntry& Entry : Modifiers)
	{
		OutNames.AddUnique(Entry.Property);
	}
}

void UModifierStack::RebuildCache() const
{
	Cache.Reset();
	TArray<FName> Names;
	CollectKnownProperties(Names);
	for (const FName& Name : Names)
	{
		Cache.Add(Name, Resolve(Name));
	}
	bCacheDirty = false;
}

void UModifierStack::Rebuild()
{
	RebuildCache();
}

float UModifierStack::Get(FName Property) const
{
	if (bCacheDirty)
	{
		RebuildCache();
	}
	if (const float* Cached = Cache.Find(Property))
	{
		return *Cached;
	}
	// Not in the cache: no base and no modifier. Resolve (logs at Verbose) and remember the answer.
	const float Value = Resolve(Property);
	Cache.Add(Property, Value);
	return Value;
}

// ---------------------------------------------------------------------------
// Debug
// ---------------------------------------------------------------------------
FString UModifierStack::DumpToString() const
{
	if (bCacheDirty)
	{
		RebuildCache();
	}

	FString Out;
	Out += FString::Printf(TEXT("ModifierStack: %d base values, %d modifiers, state tags: %s\n"),
		BaseValues.Num(), Modifiers.Num(), *CurrentStateTags.ToStringSimple());

	TArray<FName> Names;
	CollectKnownProperties(Names);
	for (const FName& Name : Names)
	{
		const float* BasePtr = BaseValues.Find(Name);
		const float* Effective = Cache.Find(Name);
		Out += FString::Printf(TEXT("  %-32s base=%s effective=%.4f\n"),
			*Name.ToString(),
			BasePtr ? *FString::Printf(TEXT("%.4f"), *BasePtr) : TEXT("(none)"),
			Effective ? *Effective : Resolve(Name));

		for (const FModifierEntry& Entry : Modifiers)
		{
			if (Entry.Property != Name)
			{
				continue;
			}
			const TCHAR* OpName = TEXT("?");
			switch (Entry.Op)
			{
			case EModifierOp::Add:      OpName = TEXT("Add");      break;
			case EModifierOp::Multiply: OpName = TEXT("Multiply"); break;
			case EModifierOp::Override: OpName = TEXT("Override"); break;
			default: break;
			}
			Out += FString::Printf(TEXT("      %-8s %10.4f  from %-24s %s%s\n"),
				OpName,
				Entry.Value,
				*Entry.SourceId.ToString(),
				Entry.Condition.IsEmpty() ? TEXT("") : *FString::Printf(TEXT("if [%s] "), *Entry.Condition.GetDescription()),
				EntryApplies(Entry) ? TEXT("(active)") : TEXT("(inactive)"));
		}
	}
	return Out;
}

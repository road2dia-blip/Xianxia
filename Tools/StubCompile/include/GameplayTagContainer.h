// Tools/StubCompile -- STUB of GameplayTagContainer.h (GameplayTags module; model test only, see README.md).
#pragma once

#include "UObject/Object.h"

struct FGameplayTagContainer;

struct FGameplayTag
{
	FGameplayTag() = default;
	explicit FGameplayTag(FName InTagName) : TagName(InTagName) {}

	static FGameplayTag RequestGameplayTag(const FName& InTagName, bool ErrorIfNotFound = true) { UE::Stub::Sink(ErrorIfNotFound); return FGameplayTag(InTagName); }
	static const FGameplayTag& EmptyTag() { static const FGameplayTag Empty; return Empty; }
	static bool IsValidGameplayTagString(const FString& TagString, FText* OutError = nullptr, FString* OutFixedString = nullptr) { UE::Stub::Sink(TagString, OutError, OutFixedString); return true; }

	bool IsValid() const { return !TagName.IsNone(); }
	FName GetTagName() const { return TagName; }
	FString ToString() const { return TagName.ToString(); }
	bool MatchesTag(const FGameplayTag& TagToCheck) const { return TagName == TagToCheck.TagName; }
	bool MatchesTagExact(const FGameplayTag& TagToCheck) const { return TagName == TagToCheck.TagName; }
	bool MatchesAny(const FGameplayTagContainer& ContainerToCheck) const;
	bool MatchesAnyExact(const FGameplayTagContainer& ContainerToCheck) const;
	FGameplayTag RequestDirectParent() const { return FGameplayTag(); }
	FGameplayTagContainer GetGameplayTagParents() const;
	FGameplayTagContainer GetSingleTagContainer() const;

	bool operator==(const FGameplayTag& Other) const { return TagName == Other.TagName; }
	bool operator!=(const FGameplayTag& Other) const { return !(*this == Other); }

private:
	FName TagName;
};

struct FGameplayTagContainer
{
	FGameplayTagContainer() = default;
	explicit FGameplayTagContainer(const FGameplayTag& Tag) { AddTag(Tag); }

	static const FGameplayTagContainer& EmptyContainer() { static const FGameplayTagContainer Empty; return Empty; }

	void AddTag(const FGameplayTag& TagToAdd) { Tags.AddUnique(TagToAdd); }
	void AddTagFast(const FGameplayTag& TagToAdd) { Tags.Add(TagToAdd); }
	bool AddLeafTag(const FGameplayTag& TagToAdd) { AddTag(TagToAdd); return true; }
	bool RemoveTag(const FGameplayTag& TagToRemove, bool bDeferParentTags = false) { UE::Stub::Sink(bDeferParentTags); return Tags.Remove(TagToRemove) > 0; }
	void RemoveTags(const FGameplayTagContainer& TagsToRemove) { for (const FGameplayTag& Tag : TagsToRemove) { Tags.Remove(Tag); } }
	void AppendTags(const FGameplayTagContainer& Other) { for (const FGameplayTag& Tag : Other) { AddTag(Tag); } }
	void Reset(int32 Slack = 0) { Tags.Reset(Slack); }

	bool HasTag(const FGameplayTag& TagToCheck) const { return Tags.Contains(TagToCheck); }
	bool HasTagExact(const FGameplayTag& TagToCheck) const { return Tags.Contains(TagToCheck); }
	bool HasAny(const FGameplayTagContainer& Other) const { for (const FGameplayTag& Tag : Other) { if (HasTag(Tag)) { return true; } } return false; }
	bool HasAnyExact(const FGameplayTagContainer& Other) const { return HasAny(Other); }
	bool HasAll(const FGameplayTagContainer& Other) const { for (const FGameplayTag& Tag : Other) { if (!HasTag(Tag)) { return false; } } return true; }
	bool HasAllExact(const FGameplayTagContainer& Other) const { return HasAll(Other); }
	bool IsEmpty() const { return Tags.Num() == 0; }
	bool IsValid() const { return Tags.Num() > 0; }
	int32 Num() const { return Tags.Num(); }
	FGameplayTag First() const { return Tags.Num() > 0 ? Tags[0] : FGameplayTag(); }
	FGameplayTag Last() const { return Tags.Num() > 0 ? Tags.Last() : FGameplayTag(); }
	FGameplayTag GetByIndex(int32 Index) const { return Tags.IsValidIndex(Index) ? Tags[Index] : FGameplayTag(); }
	const TArray<FGameplayTag>& GetGameplayTagArray() const { return Tags; }
	FString ToString() const { return FString(); }
	FString ToStringSimple(bool bQuoted = false) const { UE::Stub::Sink(bQuoted); return FString(); }
	FGameplayTagContainer Filter(const FGameplayTagContainer& OtherContainer) const { UE::Stub::Sink(OtherContainer); return *this; }
	FGameplayTagContainer FilterExact(const FGameplayTagContainer& OtherContainer) const { UE::Stub::Sink(OtherContainer); return *this; }

	typename std::vector<FGameplayTag>::const_iterator begin() const { return Tags.begin(); }
	typename std::vector<FGameplayTag>::const_iterator end() const { return Tags.end(); }
	typename std::vector<FGameplayTag>::const_iterator CreateConstIterator() const { return Tags.begin(); }

	bool operator==(const FGameplayTagContainer& Other) const { return HasAllExact(Other) && Other.HasAllExact(*this); }
	bool operator!=(const FGameplayTagContainer& Other) const { return !(*this == Other); }

private:
	TArray<FGameplayTag> Tags;
};

inline bool FGameplayTag::MatchesAny(const FGameplayTagContainer& ContainerToCheck) const { return ContainerToCheck.HasTag(*this); }
inline bool FGameplayTag::MatchesAnyExact(const FGameplayTagContainer& ContainerToCheck) const { return ContainerToCheck.HasTagExact(*this); }
inline FGameplayTagContainer FGameplayTag::GetGameplayTagParents() const { return FGameplayTagContainer(); }
inline FGameplayTagContainer FGameplayTag::GetSingleTagContainer() const { return FGameplayTagContainer(*this); }

/** A serialised tag expression. The stub keeps only the shape of the API. */
struct FGameplayTagQuery
{
	FGameplayTagQuery() = default;

	static const FGameplayTagQuery& EmptyQuery() { static const FGameplayTagQuery Empty; return Empty; }
	static FGameplayTagQuery MakeQuery_MatchAnyTags(const FGameplayTagContainer& InTags) { UE::Stub::Sink(InTags); return FGameplayTagQuery(); }
	static FGameplayTagQuery MakeQuery_MatchAllTags(const FGameplayTagContainer& InTags) { UE::Stub::Sink(InTags); return FGameplayTagQuery(); }
	static FGameplayTagQuery MakeQuery_MatchNoTags(const FGameplayTagContainer& InTags) { UE::Stub::Sink(InTags); return FGameplayTagQuery(); }
	static FGameplayTagQuery MakeQuery_MatchTag(const FGameplayTag& InTag) { UE::Stub::Sink(InTag); return FGameplayTagQuery(); }

	bool Matches(const FGameplayTagContainer& Tags) const { UE::Stub::Sink(Tags); return true; }
	bool IsEmpty() const { return true; }
	void Clear() {}
	FString GetDescription() const { return FString(); }
	void SetUserDescription(const FString& Desc) { UE::Stub::Sink(Desc); }
	bool operator==(const FGameplayTagQuery& Other) const { UE::Stub::Sink(Other); return true; }
	bool operator!=(const FGameplayTagQuery& Other) const { return !(*this == Other); }
};

/** Global tag manager access used by some code paths; here for completeness. */
class UGameplayTagsManager
{
public:
	static UGameplayTagsManager& Get() { static UGameplayTagsManager Instance; return Instance; }
	FGameplayTag RequestGameplayTag(FName TagName, bool ErrorIfNotFound = true) const { UE::Stub::Sink(ErrorIfNotFound); return FGameplayTag(TagName); }
	bool IsValidGameplayTagString(const FString& TagString, FText* OutError = nullptr, FString* OutFixedString = nullptr) const { UE::Stub::Sink(TagString, OutError, OutFixedString); return true; }
	FGameplayTag AddNativeGameplayTag(FName TagName, const FString& TagDevComment = FString()) { UE::Stub::Sink(TagDevComment); return FGameplayTag(TagName); }
};

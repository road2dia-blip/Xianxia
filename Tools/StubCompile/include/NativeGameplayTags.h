// Tools/StubCompile -- STUB of NativeGameplayTags.h (GameplayTags module; model test only, see README.md).
#pragma once

#include "GameplayTagContainer.h"

/** A tag registered natively at static-init time. Converts to FGameplayTag like the engine's. Non-copyable, as in the engine. */
class FNativeGameplayTag
{
public:
	FNativeGameplayTag(const TCHAR* InTagName, const TCHAR* InDevComment = nullptr)
		: Tag(FGameplayTag::RequestGameplayTag(FName(InTagName), false))
	{
		UE::Stub::Sink(InDevComment);
	}
	FNativeGameplayTag(const FNativeGameplayTag&) = delete;
	FNativeGameplayTag& operator=(const FNativeGameplayTag&) = delete;

	operator FGameplayTag() const { return Tag; }
	FGameplayTag GetTag() const { return Tag; }

private:
	FGameplayTag Tag;
};

#define UE_DECLARE_GAMEPLAY_TAG_EXTERN(TagName) extern FNativeGameplayTag TagName;
#define UE_DEFINE_GAMEPLAY_TAG(TagName, Tag) FNativeGameplayTag TagName(TEXT(Tag));
#define UE_DEFINE_GAMEPLAY_TAG_COMMENT(TagName, Tag, Comment) FNativeGameplayTag TagName(TEXT(Tag), TEXT(Comment));
#define UE_DEFINE_GAMEPLAY_TAG_STATIC(TagName, Tag) static FNativeGameplayTag TagName(TEXT(Tag));

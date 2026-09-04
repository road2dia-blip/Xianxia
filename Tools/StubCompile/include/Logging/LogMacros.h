// Tools/StubCompile -- STUB of Logging/LogMacros.h (model test only; see README.md).
#pragma once

#include "CoreMinimal.h"

namespace ELogVerbosity
{
	enum Type : uint8
	{
		NoLogging = 0,
		Fatal,
		Error,
		Warning,
		Display,
		Log,
		Verbose,
		VeryVerbose,
		All = VeryVerbose,
	};
}

/** A log category. The real one is a class template generated per category; the stub only needs a distinct object. */
struct FLogCategoryStub
{
	explicit FLogCategoryStub(const TCHAR* InName = TEXT("")) : Name(InName) {}
	FName GetCategoryName() const { return Name; }
	bool IsSuppressed(ELogVerbosity::Type) const { return false; }
	FName Name;
};

namespace UE::Stub
{
	/** Type-checks a UE_LOG call: the category must be a log category and the format a TCHAR literal. Arguments are swallowed. */
	template <typename... TArgs>
	inline void LogCheck(const FLogCategoryStub& Category, ELogVerbosity::Type Verbosity, const TCHAR* Format, TArgs&&... Args)
	{
		Sink(Category, Verbosity, Format, std::forward<TArgs>(Args)...);
	}
}

#define DECLARE_LOG_CATEGORY_EXTERN(CategoryName, DefaultVerbosity, CompileTimeVerbosity) \
	extern FLogCategoryStub CategoryName; \
	static_assert(ELogVerbosity::DefaultVerbosity <= ELogVerbosity::All, "bad default verbosity"); \
	static_assert(ELogVerbosity::CompileTimeVerbosity <= ELogVerbosity::All, "bad compile-time verbosity")

#define DEFINE_LOG_CATEGORY(CategoryName) FLogCategoryStub CategoryName(TEXT(#CategoryName))

#define DEFINE_LOG_CATEGORY_STATIC(CategoryName, DefaultVerbosity, CompileTimeVerbosity) \
	static FLogCategoryStub CategoryName(TEXT(#CategoryName))

#define DECLARE_LOG_CATEGORY_CLASS(CategoryName, DefaultVerbosity, CompileTimeVerbosity) \
	static FLogCategoryStub CategoryName

#define UE_LOG(CategoryName, Verbosity, Format, ...) \
	do { UE::Stub::LogCheck(CategoryName, ELogVerbosity::Verbosity, Format __VA_OPT__(,) __VA_ARGS__); } while (0)

#define UE_CLOG(Condition, CategoryName, Verbosity, Format, ...) \
	do { if (Condition) { UE::Stub::LogCheck(CategoryName, ELogVerbosity::Verbosity, Format __VA_OPT__(,) __VA_ARGS__); } } while (0)

/** LogTemp exists in every UE module. */
inline FLogCategoryStub LogTemp(TEXT("LogTemp"));

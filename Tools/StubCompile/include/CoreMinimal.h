// Tools/StubCompile -- STUB of Unreal's Core layer for a clang syntax check (a model test, not an engine build).
//
// This file stands in for Unreal Engine's CoreMinimal.h. It provides just enough of the Core module's types and
// macros (containers, FName/FString/FText, math, logging, module interface) for `clang++ -fsyntax-only` to parse
// Source/**. Signatures follow UE 5.x as closely as is practical, but bodies are empty or trivial and nothing here
// is the real engine. See Tools/StubCompile/README.md for what this can and cannot prove.

#pragma once

#include <cstdint>
#include <cstddef>
#include <initializer_list>
#include <type_traits>
#include <utility>
#include <vector>

// ---------------------------------------------------------------------------------------------------------------------
// Fundamental types and macros
// ---------------------------------------------------------------------------------------------------------------------
typedef std::int8_t int8;
typedef std::int16_t int16;
typedef std::int32_t int32;
typedef std::int64_t int64;
typedef std::uint8_t uint8;
typedef std::uint16_t uint16;
typedef std::uint32_t uint32;
typedef std::uint64_t uint64;
typedef wchar_t TCHAR;
typedef wchar_t WIDECHAR;
typedef char ANSICHAR;

#define TEXT_PASTE(x) L##x
#define TEXT(x) TEXT_PASTE(x)

#define FORCEINLINE inline
#define UE_NODISCARD [[nodiscard]]
#define INDEX_NONE (-1)

#ifndef WITH_EDITOR
#define WITH_EDITOR 0
#endif
#ifndef WITH_EDITORONLY_DATA
#define WITH_EDITORONLY_DATA WITH_EDITOR
#endif

// Module export macros: empty for the stub (real builds define them per module through UBT).
#ifndef ASCENSION_API
#define ASCENSION_API
#endif
#ifndef ASCENSIONEDITOR_API
#define ASCENSIONEDITOR_API
#endif

// check/ensure family: evaluate the expression so it is type-checked, never abort.
#define check(expr) ((void)(expr))
#define checkf(expr, ...) ((void)(expr))
#define ensure(expr) (!!(expr))
#define ensureMsgf(expr, ...) (!!(expr))
#define ensureAlways(expr) (!!(expr))
#define verify(expr) ((void)(expr))

namespace UE::Stub
{
	/** Swallows any argument list so call sites are type-checked but nothing runs. */
	template <typename... TArgs>
	inline void Sink(TArgs&&...) {}
}

// ---------------------------------------------------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------------------------------------------------
template <typename T>
struct TIdentity
{
	typedef T Type;
};

template <typename T>
FORCEINLINE T&& Forward(typename std::remove_reference<T>::type& Obj) { return static_cast<T&&>(Obj); }
template <typename T>
FORCEINLINE T&& Forward(typename std::remove_reference<T>::type&& Obj) { return static_cast<T&&>(Obj); }
template <typename T>
FORCEINLINE typename std::remove_reference<T>::type&& MoveTemp(T&& Obj) { return static_cast<typename std::remove_reference<T>::type&&>(Obj); }

/** TArray::RemoveAt shrink policy (UE 5.4+). */
enum class EAllowShrinking : uint8
{
	No,
	Yes,
};

// ---------------------------------------------------------------------------------------------------------------------
// Containers (minimal; std::vector-backed, linear lookups; only the members our code calls)
// ---------------------------------------------------------------------------------------------------------------------
template <typename InElementType>
class TArray
{
public:
	typedef InElementType ElementType;

	TArray() = default;
	TArray(std::initializer_list<ElementType> InList) : Items(InList) {}
	TArray(const TArray&) = default;
	TArray(TArray&&) = default;
	TArray& operator=(const TArray&) = default;
	TArray& operator=(TArray&&) = default;

	int32 Num() const { return static_cast<int32>(Items.size()); }
	bool IsEmpty() const { return Items.empty(); }
	bool IsValidIndex(int32 Index) const { return Index >= 0 && Index < Num(); }

	ElementType& operator[](int32 Index) { return Items[static_cast<size_t>(Index)]; }
	const ElementType& operator[](int32 Index) const { return Items[static_cast<size_t>(Index)]; }

	ElementType& Last(int32 IndexFromTheEnd = 0) { return Items[Items.size() - 1 - static_cast<size_t>(IndexFromTheEnd)]; }
	const ElementType& Last(int32 IndexFromTheEnd = 0) const { return Items[Items.size() - 1 - static_cast<size_t>(IndexFromTheEnd)]; }

	int32 Add(const ElementType& Item) { Items.push_back(Item); return Num() - 1; }
	int32 Add(ElementType&& Item) { Items.push_back(std::move(Item)); return Num() - 1; }
	int32 AddUnique(const ElementType& Item)
	{
		for (int32 Index = 0; Index < Num(); ++Index)
		{
			if (Items[static_cast<size_t>(Index)] == Item) { return Index; }
		}
		return Add(Item);
	}
	ElementType& AddDefaulted_GetRef() { Items.emplace_back(); return Items.back(); }
	int32 AddDefaulted(int32 Count = 1) { Items.resize(Items.size() + static_cast<size_t>(Count)); return Num() - Count; }
	template <typename... TArgs>
	ElementType& Emplace_GetRef(TArgs&&... Args) { Items.emplace_back(std::forward<TArgs>(Args)...); return Items.back(); }
	void Append(const TArray& Other) { Items.insert(Items.end(), Other.Items.begin(), Other.Items.end()); }

	void Init(const ElementType& Element, int32 Number) { Items.assign(static_cast<size_t>(Number), Element); }
	void SetNum(int32 NewNum, EAllowShrinking = EAllowShrinking::Yes) { Items.resize(static_cast<size_t>(NewNum)); }
	void Reserve(int32 Number) { Items.reserve(static_cast<size_t>(Number)); }
	void Reset(int32 NewSize = 0) { Items.clear(); Items.reserve(static_cast<size_t>(NewSize)); }
	void Empty(int32 Slack = 0) { Items.clear(); Items.reserve(static_cast<size_t>(Slack)); }

	void RemoveAt(int32 Index, int32 Count = 1, EAllowShrinking = EAllowShrinking::Yes)
	{
		Items.erase(Items.begin() + Index, Items.begin() + Index + Count);
	}
	int32 Remove(const ElementType& Item)
	{
		return RemoveAll([&Item](const ElementType& Other) { return Other == Item; });
	}
	template <typename TPredicate>
	int32 RemoveAll(const TPredicate& Predicate)
	{
		int32 Removed = 0;
		for (size_t Index = 0; Index < Items.size();)
		{
			if (Predicate(Items[Index])) { Items.erase(Items.begin() + static_cast<std::ptrdiff_t>(Index)); ++Removed; }
			else { ++Index; }
		}
		return Removed;
	}

	template <typename TPredicate>
	ElementType* FindByPredicate(const TPredicate& Predicate)
	{
		for (ElementType& Item : Items) { if (Predicate(Item)) { return &Item; } }
		return nullptr;
	}
	template <typename TPredicate>
	const ElementType* FindByPredicate(const TPredicate& Predicate) const
	{
		for (const ElementType& Item : Items) { if (Predicate(Item)) { return &Item; } }
		return nullptr;
	}
	int32 Find(const ElementType& Item) const
	{
		for (int32 Index = 0; Index < Num(); ++Index) { if (Items[static_cast<size_t>(Index)] == Item) { return Index; } }
		return INDEX_NONE;
	}
	bool Contains(const ElementType& Item) const { return Find(Item) != INDEX_NONE; }

	ElementType* GetData() { return Items.data(); }
	const ElementType* GetData() const { return Items.data(); }

	// Range-for support.
	typename std::vector<ElementType>::iterator begin() { return Items.begin(); }
	typename std::vector<ElementType>::iterator end() { return Items.end(); }
	typename std::vector<ElementType>::const_iterator begin() const { return Items.begin(); }
	typename std::vector<ElementType>::const_iterator end() const { return Items.end(); }

private:
	std::vector<ElementType> Items;
};

template <typename KeyType, typename ValueType>
struct TPair
{
	KeyType Key;
	ValueType Value;
	TPair() = default;
	TPair(const KeyType& InKey, const ValueType& InValue) : Key(InKey), Value(InValue) {}
};

template <typename KeyType, typename ValueType>
class TMap
{
public:
	typedef TPair<KeyType, ValueType> ElementType;

	TMap() = default;
	TMap(const TMap&) = default;
	TMap& operator=(const TMap&) = default;

	int32 Num() const { return Pairs.Num(); }
	bool IsEmpty() const { return Pairs.Num() == 0; }
	void Reset() { Pairs.Reset(); }
	void Empty(int32 Slack = 0) { Pairs.Empty(Slack); }
	void Reserve(int32 Number) { Pairs.Reserve(Number); }

	ValueType& Add(const KeyType& Key, const ValueType& Value)
	{
		if (ValueType* Existing = Find(Key)) { *Existing = Value; return *Existing; }
		Pairs.Add(ElementType(Key, Value));
		return Pairs.Last().Value;
	}
	ValueType& Add(const KeyType& Key) { return FindOrAdd(Key); }
	ValueType& FindOrAdd(const KeyType& Key)
	{
		if (ValueType* Existing = Find(Key)) { return *Existing; }
		Pairs.Add(ElementType(Key, ValueType()));
		return Pairs.Last().Value;
	}
	ValueType* Find(const KeyType& Key)
	{
		for (ElementType& Pair : Pairs) { if (Pair.Key == Key) { return &Pair.Value; } }
		return nullptr;
	}
	const ValueType* Find(const KeyType& Key) const
	{
		for (const ElementType& Pair : Pairs) { if (Pair.Key == Key) { return &Pair.Value; } }
		return nullptr;
	}
	ValueType FindRef(const KeyType& Key) const
	{
		const ValueType* Found = Find(Key);
		return Found ? *Found : ValueType();
	}
	bool Contains(const KeyType& Key) const { return Find(Key) != nullptr; }
	int32 Remove(const KeyType& Key) { return Pairs.RemoveAll([&Key](const ElementType& Pair) { return Pair.Key == Key; }); }

	typename std::vector<ElementType>::iterator begin() { return Pairs.begin(); }
	typename std::vector<ElementType>::iterator end() { return Pairs.end(); }
	typename std::vector<ElementType>::const_iterator begin() const { return Pairs.begin(); }
	typename std::vector<ElementType>::const_iterator end() const { return Pairs.end(); }

private:
	TArray<ElementType> Pairs;
};

template <typename InElementType>
class TSet
{
public:
	typedef InElementType ElementType;

	TSet() = default;
	TSet(const TSet&) = default;
	TSet& operator=(const TSet&) = default;

	int32 Num() const { return Items.Num(); }
	bool IsEmpty() const { return Items.Num() == 0; }
	void Reset() { Items.Reset(); }
	void Empty(int32 Slack = 0) { Items.Empty(Slack); }
	void Add(const ElementType& Item) { Items.AddUnique(Item); }
	bool Contains(const ElementType& Item) const { return Items.Contains(Item); }
	int32 Remove(const ElementType& Item) { return Items.Remove(Item); }
	TArray<ElementType> Array() const { return Items; }

	typename std::vector<ElementType>::iterator begin() { return Items.begin(); }
	typename std::vector<ElementType>::iterator end() { return Items.end(); }
	typename std::vector<ElementType>::const_iterator begin() const { return Items.begin(); }
	typename std::vector<ElementType>::const_iterator end() const { return Items.end(); }

private:
	TArray<ElementType> Items;
};

// ---------------------------------------------------------------------------------------------------------------------
// Strings and names
// ---------------------------------------------------------------------------------------------------------------------
class FString
{
public:
	FString() = default;
	FString(const TCHAR* In) { if (In) { while (*In) { Chars.push_back(*In++); } } Chars.push_back(0); }
	FString(const FString&) = default;
	FString(FString&&) = default;
	FString& operator=(const FString&) = default;
	FString& operator=(FString&&) = default;
	FString& operator=(const TCHAR* In) { *this = FString(In); return *this; }

	/** Dereference to the null-terminated buffer (real UE: `*MyString`). */
	const TCHAR* operator*() const { static const TCHAR Empty = 0; return Chars.empty() ? &Empty : Chars.data(); }

	int32 Len() const { return Chars.empty() ? 0 : static_cast<int32>(Chars.size()) - 1; }
	bool IsEmpty() const { return Len() == 0; }
	void Reserve(int32 Count) { Chars.reserve(static_cast<size_t>(Count) + 1); }
	void Empty(int32 Slack = 0) { Chars.clear(); }
	void Reset(int32 NewReservedSize = 0) { Chars.clear(); }

	FString& operator+=(const TCHAR* In) { return Append(In); }
	FString& operator+=(const FString& In) { return Append(In); }
	FString& operator+=(TCHAR In) { AppendChar(In); return *this; }
	FString& Append(const TCHAR* In) { if (!Chars.empty()) { Chars.pop_back(); } if (In) { while (*In) { Chars.push_back(*In++); } } Chars.push_back(0); return *this; }
	FString& Append(const FString& In) { return Append(*In); }
	FString& AppendChar(TCHAR In) { if (!Chars.empty()) { Chars.pop_back(); } Chars.push_back(In); Chars.push_back(0); return *this; }

	bool FindLastChar(TCHAR InChar, int32& OutIndex) const
	{
		for (int32 Index = Len() - 1; Index >= 0; --Index)
		{
			if (Chars[static_cast<size_t>(Index)] == InChar) { OutIndex = Index; return true; }
		}
		OutIndex = INDEX_NONE;
		return false;
	}
	bool FindChar(TCHAR InChar, int32& OutIndex) const
	{
		for (int32 Index = 0; Index < Len(); ++Index)
		{
			if (Chars[static_cast<size_t>(Index)] == InChar) { OutIndex = Index; return true; }
		}
		OutIndex = INDEX_NONE;
		return false;
	}
	void RightChopInline(int32 Count, EAllowShrinking = EAllowShrinking::Yes) { *this = RightChop(Count); }
	FString RightChop(int32 Count) const { FString Out; for (int32 Index = Count; Index < Len(); ++Index) { Out.AppendChar(Chars[static_cast<size_t>(Index)]); } return Out; }
	FString LeftChop(int32 Count) const { FString Out; for (int32 Index = 0; Index < Len() - Count; ++Index) { Out.AppendChar(Chars[static_cast<size_t>(Index)]); } return Out; }
	FString Left(int32 Count) const { FString Out; for (int32 Index = 0; Index < Count && Index < Len(); ++Index) { Out.AppendChar(Chars[static_cast<size_t>(Index)]); } return Out; }
	FString Right(int32 Count) const { return RightChop(Len() - Count); }
	FString Mid(int32 Start, int32 Count = 0x7fffffff) const { return RightChop(Start).Left(Count); }
	bool StartsWith(const FString& InPrefix) const { return StartsWith(*InPrefix); }
	bool StartsWith(const TCHAR* InPrefix) const
	{
		int32 Index = 0;
		while (InPrefix && InPrefix[Index]) { if (Index >= Len() || Chars[static_cast<size_t>(Index)] != InPrefix[Index]) { return false; } ++Index; }
		return true;
	}
	bool EndsWith(const FString& InSuffix) const { return EndsWith(*InSuffix); }
	bool EndsWith(const TCHAR* InSuffix) const { FString Suffix(InSuffix); return Suffix.Len() <= Len() && RightChop(Len() - Suffix.Len()) == Suffix; }
	bool Contains(const TCHAR* SubStr) const { FString Sub(SubStr); for (int32 Start = 0; Start + Sub.Len() <= Len(); ++Start) { if (Mid(Start, Sub.Len()) == Sub) { return true; } } return false; }
	bool Contains(const FString& SubStr) const { return Contains(*SubStr); }
	FString TrimStartAndEnd() const
	{
		int32 Start = 0;
		int32 End = Len();
		while (Start < End && (Chars[static_cast<size_t>(Start)] == L' ' || Chars[static_cast<size_t>(Start)] == L'\t')) { ++Start; }
		while (End > Start && (Chars[static_cast<size_t>(End - 1)] == L' ' || Chars[static_cast<size_t>(End - 1)] == L'\t')) { --End; }
		return Mid(Start, End - Start);
	}
	FString ToLower() const { return *this; }
	FString ToUpper() const { return *this; }
	bool Equals(const FString& Other) const { return *this == Other; }

	bool operator==(const FString& Other) const { return Chars == Other.Chars || (IsEmpty() && Other.IsEmpty()); }
	bool operator!=(const FString& Other) const { return !(*this == Other); }
	bool operator==(const TCHAR* Other) const { return *this == FString(Other); }
	bool operator!=(const TCHAR* Other) const { return !(*this == Other); }

	/** printf-style formatting. Only the format type is checked (it must be a TCHAR literal); the arguments are swallowed. */
	template <typename... TArgs>
	static FString Printf(const TCHAR* Fmt, TArgs&&... Args) { UE::Stub::Sink(std::forward<TArgs>(Args)...); return FString(Fmt); }
	static FString FromInt(int32 Value) { UE::Stub::Sink(Value); return FString(); }
	static FString SanitizeFloat(double Value) { UE::Stub::Sink(Value); return FString(); }

private:
	std::vector<TCHAR> Chars;
};

inline FString operator+(const FString& Lhs, const FString& Rhs) { FString Out(Lhs); Out += Rhs; return Out; }
inline FString operator+(const FString& Lhs, const TCHAR* Rhs) { FString Out(Lhs); Out += Rhs; return Out; }
inline FString operator+(const TCHAR* Lhs, const FString& Rhs) { FString Out(Lhs); Out += Rhs; return Out; }

class FName
{
public:
	FName() = default;
	FName(const TCHAR* In) : Str(In) {}
	FName(const FString& In) : Str(In) {}
	FName(const FName&) = default;
	FName& operator=(const FName&) = default;

	FString ToString() const { return Str; }
	void ToString(FString& Out) const { Out = Str; }
	bool IsNone() const { return Str.IsEmpty(); }
	bool IsValid() const { return true; }

	bool operator==(const FName& Other) const { return Str == Other.Str; }
	bool operator!=(const FName& Other) const { return !(*this == Other); }
	bool operator==(const TCHAR* Other) const { return Str == Other; }
	bool operator!=(const TCHAR* Other) const { return !(Str == Other); }

private:
	FString Str;
};

inline const FName NAME_None;

// ---------------------------------------------------------------------------------------------------------------------
// Text (Internationalization/Text.h)
// ---------------------------------------------------------------------------------------------------------------------
struct FNumberFormattingOptions
{
	FNumberFormattingOptions& SetUseGrouping(bool) { return *this; }
	FNumberFormattingOptions& SetMinimumIntegralDigits(int32) { return *this; }
	FNumberFormattingOptions& SetMaximumIntegralDigits(int32) { return *this; }
	FNumberFormattingOptions& SetMinimumFractionalDigits(int32) { return *this; }
	FNumberFormattingOptions& SetMaximumFractionalDigits(int32) { return *this; }
};

class FText;

/**
 * What FText::Format accepts as an argument (real UE: FFormatArgumentValue). There is deliberately no FString or
 * TCHAR* constructor: the engine requires FText::FromString / FText::AsNumber, and so does this stub.
 */
struct FFormatArgumentValue
{
	FFormatArgumentValue(const FText&) {}
	FFormatArgumentValue(int32) {}
	FFormatArgumentValue(uint32) {}
	FFormatArgumentValue(int64) {}
	FFormatArgumentValue(uint64) {}
	FFormatArgumentValue(float) {}
	FFormatArgumentValue(double) {}
};

class FText
{
public:
	FText() = default;

	static const FText& GetEmpty() { static const FText Empty; return Empty; }
	static FText FromString(const FString& In) { FText Out; Out.Str = In; return Out; }
	static FText FromString(FString&& In) { FText Out; Out.Str = In; return Out; }
	static FText FromName(const FName& In) { return FromString(In.ToString()); }
	static FText AsCultureInvariant(const FString& In) { return FromString(In); }

	template <typename TNumber>
	static FText AsNumber(TNumber Value, const FNumberFormattingOptions* Options = nullptr)
	{
		static_assert(std::is_arithmetic<TNumber>::value, "FText::AsNumber takes a number");
		UE::Stub::Sink(Value, Options);
		return FText();
	}
	static FText AsPercent(double Value, const FNumberFormattingOptions* Options = nullptr) { UE::Stub::Sink(Value, Options); return FText(); }

	template <typename... TArgs>
	static FText Format(const FText& Fmt, TArgs&&... Args)
	{
		(void)std::initializer_list<int>{ (FFormatArgumentValue(std::forward<TArgs>(Args)), 0)... };
		return Fmt;
	}

	/** Stub of the LOCTEXT/NSLOCTEXT back end. */
	static FText StubLoc(const TCHAR* Namespace, const TCHAR* Key, const TCHAR* Literal) { UE::Stub::Sink(Namespace, Key); return FromString(FString(Literal)); }

	bool IsEmpty() const { return Str.IsEmpty(); }
	bool IsEmptyOrWhitespace() const { return Str.IsEmpty(); }
	FString ToString() const { return Str; }
	const FString& ToStringView() const { return Str; }
	bool EqualTo(const FText& Other) const { return Str == Other.Str; }

private:
	FString Str;
};

#define LOCTEXT(InKey, InTextLiteral) FText::StubLoc(TEXT(LOCTEXT_NAMESPACE), TEXT(InKey), TEXT(InTextLiteral))
#define NSLOCTEXT(InNamespace, InKey, InTextLiteral) FText::StubLoc(TEXT(InNamespace), TEXT(InKey), TEXT(InTextLiteral))
#define INVTEXT(InTextLiteral) FText::AsCultureInvariant(FString(TEXT(InTextLiteral)))

// ---------------------------------------------------------------------------------------------------------------------
// Math
// ---------------------------------------------------------------------------------------------------------------------
namespace EAxis
{
	enum Type
	{
		None,
		X,
		Y,
		Z,
	};
}

struct FVector2D
{
	double X = 0.0;
	double Y = 0.0;
	FVector2D() = default;
	FVector2D(double InX, double InY) : X(InX), Y(InY) {}
};

struct FVector
{
	double X = 0.0;
	double Y = 0.0;
	double Z = 0.0;

	FVector() = default;
	explicit FVector(double InF) : X(InF), Y(InF), Z(InF) {}
	FVector(double InX, double InY, double InZ) : X(InX), Y(InY), Z(InZ) {}

	static const FVector ZeroVector;
	static const FVector OneVector;
	static const FVector UpVector;
	static const FVector ForwardVector;
	static const FVector RightVector;

	FVector operator+(const FVector& V) const { return FVector(X + V.X, Y + V.Y, Z + V.Z); }
	FVector operator-(const FVector& V) const { return FVector(X - V.X, Y - V.Y, Z - V.Z); }
	FVector operator*(double Scale) const { return FVector(X * Scale, Y * Scale, Z * Scale); }
	FVector& operator+=(const FVector& V) { X += V.X; Y += V.Y; Z += V.Z; return *this; }
	bool operator==(const FVector& V) const { return X == V.X && Y == V.Y && Z == V.Z; }

	double Size() const { return 0.0; }
	double SizeSquared() const { return X * X + Y * Y + Z * Z; }
	double Size2D() const { return 0.0; }
	double SizeSquared2D() const { return X * X + Y * Y; }
	bool IsNearlyZero(double Tolerance = 1e-4) const { return SizeSquared() <= Tolerance * Tolerance; }
	FVector GetSafeNormal(double Tolerance = 1e-8) const { UE::Stub::Sink(Tolerance); return *this; }
};
inline const FVector FVector::ZeroVector(0.0, 0.0, 0.0);
inline const FVector FVector::OneVector(1.0, 1.0, 1.0);
inline const FVector FVector::UpVector(0.0, 0.0, 1.0);
inline const FVector FVector::ForwardVector(1.0, 0.0, 0.0);
inline const FVector FVector::RightVector(0.0, 1.0, 0.0);

struct FRotator
{
	double Pitch = 0.0;
	double Yaw = 0.0;
	double Roll = 0.0;

	FRotator() = default;
	FRotator(double InPitch, double InYaw, double InRoll) : Pitch(InPitch), Yaw(InYaw), Roll(InRoll) {}

	static const FRotator ZeroRotator;
	FVector Vector() const { return FVector(); }
	FRotator GetNormalized() const { return *this; }
};
inline const FRotator FRotator::ZeroRotator(0.0, 0.0, 0.0);

struct FMatrix
{
	FVector GetUnitAxis(EAxis::Type Axis) const { UE::Stub::Sink(Axis); return FVector(); }
	FVector GetScaledAxis(EAxis::Type Axis) const { UE::Stub::Sink(Axis); return FVector(); }
};

struct FRotationMatrix : public FMatrix
{
	explicit FRotationMatrix(const FRotator& Rot) { UE::Stub::Sink(Rot); }
};

struct FTransform
{
	FTransform() = default;
	static const FTransform Identity;
};
inline const FTransform FTransform::Identity;

struct FLinearColor
{
	float R = 0.0f;
	float G = 0.0f;
	float B = 0.0f;
	float A = 1.0f;

	FLinearColor() = default;
	FLinearColor(float InR, float InG, float InB, float InA = 1.0f) : R(InR), G(InG), B(InB), A(InA) {}

	static const FLinearColor White;
	static const FLinearColor Black;
	static const FLinearColor Transparent;
	static const FLinearColor Red;
	static const FLinearColor Green;
	static const FLinearColor Blue;
};
inline const FLinearColor FLinearColor::White(1.0f, 1.0f, 1.0f, 1.0f);
inline const FLinearColor FLinearColor::Black(0.0f, 0.0f, 0.0f, 1.0f);
inline const FLinearColor FLinearColor::Transparent(0.0f, 0.0f, 0.0f, 0.0f);
inline const FLinearColor FLinearColor::Red(1.0f, 0.0f, 0.0f, 1.0f);
inline const FLinearColor FLinearColor::Green(0.0f, 1.0f, 0.0f, 1.0f);
inline const FLinearColor FLinearColor::Blue(0.0f, 0.0f, 1.0f, 1.0f);

struct FColor
{
	uint8 R = 0, G = 0, B = 0, A = 255;
};

struct FMath
{
	// Same-type templates, as in UE (mixed float/double/int arguments are a compile error there too).
	template <typename T>
	static constexpr T Clamp(const T X, const T Min, const T Max) { return X < Min ? Min : (X > Max ? Max : X); }
	template <typename T>
	static constexpr T Max(const T A, const T B) { return A >= B ? A : B; }
	template <typename T>
	static constexpr T Min(const T A, const T B) { return A <= B ? A : B; }
	template <typename T>
	static constexpr T Abs(const T A) { return A >= T(0) ? A : -A; }
	template <typename T>
	static constexpr T Square(const T A) { return A * A; }
	template <typename T>
	static constexpr T Lerp(const T& A, const T& B, float Alpha) { return static_cast<T>(A + (B - A) * Alpha); }
	template <typename T>
	static constexpr T Sign(const T A) { return A > T(0) ? T(1) : (A < T(0) ? T(-1) : T(0)); }
	template <typename T>
	static constexpr bool IsNearlyEqual(T A, T B, T Tolerance = T(1e-4)) { return Abs(A - B) <= Tolerance; }
	template <typename T>
	static constexpr bool IsNearlyZero(T A, T Tolerance = T(1e-4)) { return Abs(A) <= Tolerance; }

	static float Pow(float A, float B) { UE::Stub::Sink(A, B); return 0.0f; }
	static double Pow(double A, double B) { UE::Stub::Sink(A, B); return 0.0; }
	static float Sqrt(float A) { return A; }
	static double Sqrt(double A) { return A; }
	static float Fmod(float X, float Y) { UE::Stub::Sink(X, Y); return 0.0f; }
	static double Fmod(double X, double Y) { UE::Stub::Sink(X, Y); return 0.0; }
	static float Sin(float A) { return A; }
	static float Cos(float A) { return A; }
	static double Sin(double A) { return A; }
	static double Cos(double A) { return A; }
	static void SinCos(float* OutSin, float* OutCos, float Value) { *OutSin = Value; *OutCos = Value; }
	static void SinCos(double* OutSin, double* OutCos, double Value) { *OutSin = Value; *OutCos = Value; }
	static float RoundHalfToEven(float F) { return F; }
	static double RoundHalfToEven(double F) { return F; }
	static float RoundHalfFromZero(float F) { return F; }
	static double RoundHalfFromZero(double F) { return F; }
	static int32 RoundToInt(float F) { return static_cast<int32>(F); }
	static int64 RoundToInt(double F) { return static_cast<int64>(F); }
	static int32 RoundToInt32(double F) { return static_cast<int32>(F); }
	static int32 FloorToInt(float F) { return static_cast<int32>(F); }
	static int64 FloorToInt(double F) { return static_cast<int64>(F); }
	static int32 FloorToInt32(double F) { return static_cast<int32>(F); }
	static int32 CeilToInt(float F) { return static_cast<int32>(F); }
	static int64 CeilToInt(double F) { return static_cast<int64>(F); }
	static int32 TruncToInt(float F) { return static_cast<int32>(F); }
	static int64 TruncToInt(double F) { return static_cast<int64>(F); }
	static float Floor(float F) { return F; }
	static double Floor(double F) { return F; }
	template <typename T>
	static constexpr T DegreesToRadians(T Degrees) { return Degrees * T(0.017453292519943295); }
	template <typename T>
	static constexpr T RadiansToDegrees(T Radians) { return Radians * T(57.29577951308232); }
	static int32 Rand() { return 0; }
	static float FRand() { return 0.0f; }
	static int32 RandRange(int32 Min, int32 Max) { UE::Stub::Sink(Max); return Min; }
	static float RandRange(float Min, float Max) { UE::Stub::Sink(Max); return Min; }
	static float FInterpTo(float Current, float Target, float DeltaTime, float InterpSpeed) { UE::Stub::Sink(Target, DeltaTime, InterpSpeed); return Current; }
	static float FInterpConstantTo(float Current, float Target, float DeltaTime, float InterpSpeed) { UE::Stub::Sink(Target, DeltaTime, InterpSpeed); return Current; }
	static float GetMappedRangeValueClamped(const FVector2D& InputRange, const FVector2D& OutputRange, float Value) { UE::Stub::Sink(InputRange, OutputRange); return Value; }
};

// Math/RandomStream.h
struct FRandomStream
{
	FRandomStream() = default;
	explicit FRandomStream(int32 InSeed) : Seed(InSeed) {}
	void Initialize(int32 InSeed) { Seed = InSeed; }
	void Reset() {}
	int32 GetInitialSeed() const { return Seed; }
	int32 GetCurrentSeed() const { return Seed; }
	float GetFraction() const { return 0.0f; }
	float FRand() const { return 0.0f; }
	int32 RandHelper(int32 A) const { return A; }
	int32 RandRange(int32 Min, int32 Max) const { UE::Stub::Sink(Max); return Min; }
	float FRandRange(float Min, float Max) const { UE::Stub::Sink(Max); return Min; }

private:
	int32 Seed = 0;
};

// Misc/DateTime.h
struct FTimespan
{
	double GetTotalSeconds() const { return 0.0; }
};

struct FDateTime
{
	FDateTime() = default;
	static FDateTime Now() { return FDateTime(); }
	static FDateTime UtcNow() { return FDateTime(); }
	FString ToString() const { return FString(); }
	FString ToIso8601() const { return FString(); }
	FTimespan operator-(const FDateTime&) const { return FTimespan(); }
};

// Misc/Crc.h
struct FCrc
{
	template <typename CharType>
	static uint32 StrCrc32(const CharType* Data, uint32 CRC = 0) { UE::Stub::Sink(Data); return CRC; }
	static uint32 MemCrc32(const void* Data, int32 Length, uint32 CRC = 0) { UE::Stub::Sink(Data, Length); return CRC; }
};

// Misc/Parse.h
struct FParse
{
	static bool Value(const TCHAR* Stream, const TCHAR* Match, FString& Value, bool bShouldStopOnSeparator = true) { UE::Stub::Sink(Stream, Match, Value, bShouldStopOnSeparator); return false; }
	static bool Value(const TCHAR* Stream, const TCHAR* Match, FName& Value) { UE::Stub::Sink(Stream, Match, Value); return false; }
	static bool Value(const TCHAR* Stream, const TCHAR* Match, int32& Value) { UE::Stub::Sink(Stream, Match, Value); return false; }
	static bool Value(const TCHAR* Stream, const TCHAR* Match, float& Value) { UE::Stub::Sink(Stream, Match, Value); return false; }
	static bool Value(const TCHAR* Stream, const TCHAR* Match, bool& Value) { UE::Stub::Sink(Stream, Match, Value); return false; }
	static bool Bool(const TCHAR* Stream, const TCHAR* Match, bool& OnOff) { UE::Stub::Sink(Stream, Match, OnOff); return false; }
	static bool Param(const TCHAR* Stream, const TCHAR* Param) { UE::Stub::Sink(Stream, Param); return false; }
};

// ---------------------------------------------------------------------------------------------------------------------
// Output devices and logging (Logging/LogMacros.h)
// ---------------------------------------------------------------------------------------------------------------------
class FOutputDevice
{
public:
	virtual ~FOutputDevice() = default;
	template <typename... TArgs>
	void Logf(const TCHAR* Fmt, TArgs&&... Args) { UE::Stub::Sink(Fmt, std::forward<TArgs>(Args)...); }
};

/** Real UE: GError is an FOutputDeviceError*; FSavePackageArgs::Error is an FOutputDevice*. */
inline FOutputDevice* GError = nullptr;
inline FOutputDevice* GLog = nullptr;
inline FOutputDevice* GWarn = nullptr;

#include "Logging/LogMacros.h"

// ---------------------------------------------------------------------------------------------------------------------
// Modules (Modules/ModuleInterface.h, Modules/ModuleManager.h)
// ---------------------------------------------------------------------------------------------------------------------
#include "Modules/ModuleInterface.h"

// Tools/StubCompile -- STUB of InputCoreTypes.h (InputCore module; model test only, see README.md).
#pragma once

#include "UObject/Object.h"

struct FKey
{
	FKey() = default;
	explicit FKey(const FName InName) : KeyName(InName) {}
	explicit FKey(const TCHAR* InName) : KeyName(InName) {}

	bool IsValid() const { return !KeyName.IsNone(); }
	FName GetFName() const { return KeyName; }
	FString ToString() const { return KeyName.ToString(); }
	FText GetDisplayName(bool bLongDisplayName = true) const { UE::Stub::Sink(bLongDisplayName); return FText::FromName(KeyName); }
	bool IsGamepadKey() const { return false; }
	bool IsMouseButton() const { return false; }
	bool IsAxis1D() const { return false; }
	bool IsAxis2D() const { return false; }
	bool IsModifierKey() const { return false; }
	bool operator==(const FKey& Other) const { return KeyName == Other.KeyName; }
	bool operator!=(const FKey& Other) const { return !(*this == Other); }

private:
	FName KeyName;
};

struct EKeys
{
	static const FKey Invalid;
	static const FKey AnyKey;
	static const FKey Q;
	static const FKey E;
	static const FKey B;
	static const FKey X;
	static const FKey M;
	static const FKey I;
	static const FKey One;
	static const FKey Two;
	static const FKey Three;
	static const FKey Four;
	static const FKey Tab;
	static const FKey F1;
	static const FKey F2;
	static const FKey LeftShift;
	static const FKey LeftControl;
	static const FKey SpaceBar;
	static const FKey Escape;
	static const FKey MouseX;
	static const FKey MouseY;
};
inline const FKey EKeys::Invalid(TEXT("None"));
inline const FKey EKeys::AnyKey(TEXT("AnyKey"));
inline const FKey EKeys::Q(TEXT("Q"));
inline const FKey EKeys::E(TEXT("E"));
inline const FKey EKeys::B(TEXT("B"));
inline const FKey EKeys::X(TEXT("X"));
inline const FKey EKeys::M(TEXT("M"));
inline const FKey EKeys::I(TEXT("I"));
inline const FKey EKeys::One(TEXT("One"));
inline const FKey EKeys::Two(TEXT("Two"));
inline const FKey EKeys::Three(TEXT("Three"));
inline const FKey EKeys::Four(TEXT("Four"));
inline const FKey EKeys::Tab(TEXT("Tab"));
inline const FKey EKeys::F1(TEXT("F1"));
inline const FKey EKeys::F2(TEXT("F2"));
inline const FKey EKeys::LeftShift(TEXT("LeftShift"));
inline const FKey EKeys::LeftControl(TEXT("LeftControl"));
inline const FKey EKeys::SpaceBar(TEXT("SpaceBar"));
inline const FKey EKeys::Escape(TEXT("Escape"));
inline const FKey EKeys::MouseX(TEXT("MouseX"));
inline const FKey EKeys::MouseY(TEXT("MouseY"));

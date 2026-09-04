// Tools/StubCompile -- STUB of UObject/Object.h plus the pieces of CoreUObject every engine header pulls in with it:
// UObject/Class.h (UClass, UScriptStruct, UEnum), UObject/ObjectPtr.h (TObjectPtr), UObject/UObjectGlobals.h
// (NewObject, Cast, GetDefault, LoadObject, IsValid, GetNameSafe), UObject/PrimaryAssetId.h, UObject/WeakObjectPtr.h
// and Delegates/DelegateCombinations.h. Model test only; see README.md.
#pragma once

#include "CoreMinimal.h"
#include "UObject/ObjectMacros.h"

class UObject;
class UClass;
class UWorld;
class UPackage;
class UStruct;
class UScriptStruct;
class UEnum;
class UFunction;
struct FObjectInitializer;

// ---------------------------------------------------------------------------------------------------------------------
// Stub helpers for class declarations
// ---------------------------------------------------------------------------------------------------------------------
/**
 * Every stub engine class uses this: a self-typedef named Super (so a game class derived from it resolves `Super` to
 * this class, as UHT would generate) and the two constructors UObject-derived classes need (default and FObjectInitializer).
 */
#define UE_STUB_CLASS_BODY(ClassName) \
public: \
	typedef ClassName Super; \
	ClassName() {} \
	explicit ClassName(const FObjectInitializer&) {} \
	virtual ~ClassName() override {}

// ---------------------------------------------------------------------------------------------------------------------
// TObjectPtr / TWeakObjectPtr
// ---------------------------------------------------------------------------------------------------------------------
template <typename T>
class TObjectPtr
{
public:
	TObjectPtr() = default;
	TObjectPtr(std::nullptr_t) {}
	TObjectPtr(T* InPtr) : Ptr(InPtr) {}
	template <typename U, typename = typename std::enable_if<std::is_convertible<U*, T*>::value>::type>
	TObjectPtr(const TObjectPtr<U>& Other) : Ptr(Other.Get()) {}
	TObjectPtr(const TObjectPtr&) = default;
	TObjectPtr& operator=(const TObjectPtr&) = default;
	template <typename U, typename = typename std::enable_if<std::is_convertible<U*, T*>::value>::type>
	TObjectPtr& operator=(const TObjectPtr<U>& Other) { Ptr = Other.Get(); return *this; }
	TObjectPtr& operator=(T* InPtr) { Ptr = InPtr; return *this; }
	TObjectPtr& operator=(std::nullptr_t) { Ptr = nullptr; return *this; }

	T* Get() const { return Ptr; }
	T* operator->() const { return Ptr; }
	T& operator*() const { return *Ptr; }
	operator T*() const { return Ptr; }
	explicit operator bool() const { return Ptr != nullptr; }
	bool operator!() const { return Ptr == nullptr; }

	bool operator==(std::nullptr_t) const { return Ptr == nullptr; }
	bool operator!=(std::nullptr_t) const { return Ptr != nullptr; }
	template <typename U>
	bool operator==(U* Other) const { return Ptr == Other; }
	template <typename U>
	bool operator!=(U* Other) const { return Ptr != Other; }
	template <typename U>
	bool operator==(const TObjectPtr<U>& Other) const { return Ptr == Other.Get(); }
	template <typename U>
	bool operator!=(const TObjectPtr<U>& Other) const { return Ptr != Other.Get(); }

private:
	T* Ptr = nullptr;
};

template <typename T>
class TWeakObjectPtr
{
public:
	TWeakObjectPtr() = default;
	TWeakObjectPtr(T* InPtr) : Ptr(InPtr) {}
	TWeakObjectPtr(const TObjectPtr<T>& InPtr) : Ptr(InPtr.Get()) {}
	T* Get() const { return Ptr; }
	bool IsValid() const { return Ptr != nullptr; }
	void Reset() { Ptr = nullptr; }
	T* operator->() const { return Ptr; }
	explicit operator bool() const { return Ptr != nullptr; }

private:
	T* Ptr = nullptr;
};

// ---------------------------------------------------------------------------------------------------------------------
// FPrimaryAssetId (UObject/PrimaryAssetId.h)
// ---------------------------------------------------------------------------------------------------------------------
struct FPrimaryAssetType
{
	FPrimaryAssetType() = default;
	FPrimaryAssetType(FName InName) : Name(InName) {}
	FPrimaryAssetType(const TCHAR* InName) : Name(InName) {}
	FName GetName() const { return Name; }
	bool IsValid() const { return !Name.IsNone(); }
	bool operator==(const FPrimaryAssetType& Other) const { return Name == Other.Name; }
	FString ToString() const { return Name.ToString(); }

private:
	FName Name;
};

struct FPrimaryAssetId
{
	FPrimaryAssetType PrimaryAssetType;
	FName PrimaryAssetName;

	FPrimaryAssetId() = default;
	FPrimaryAssetId(FPrimaryAssetType InType, FName InName) : PrimaryAssetType(InType), PrimaryAssetName(InName) {}
	bool IsValid() const { return PrimaryAssetType.IsValid() && !PrimaryAssetName.IsNone(); }
	FString ToString() const { return PrimaryAssetType.ToString() + TEXT(":") + PrimaryAssetName.ToString(); }
};

// ---------------------------------------------------------------------------------------------------------------------
// UObject and the reflection objects
// ---------------------------------------------------------------------------------------------------------------------
struct FObjectInitializer
{
	template <typename T>
	T* CreateDefaultSubobject(UObject* Outer, FName SubobjectName, bool bTransient = false) const { UE::Stub::Sink(Outer, SubobjectName, bTransient); return new T(); }
};

class UObject
{
public:
	typedef UObject Super;

	UObject() = default;
	explicit UObject(const FObjectInitializer&) {}
	virtual ~UObject() = default;

	/** UHT would generate StaticClass() per class; inheriting this one makes `AAnyClass::StaticClass()` resolve. */
	static UClass* StaticClass() { return nullptr; }
	UClass* GetClass() const { return nullptr; }

	FString GetName() const { return Name.ToString(); }
	FName GetFName() const { return Name; }
	FString GetPathName(const UObject* StopOuter = nullptr) const { UE::Stub::Sink(StopOuter); return Name.ToString(); }
	FString GetFullName() const { return Name.ToString(); }
	UObject* GetOuter() const { return nullptr; }
	UPackage* GetOutermost() const;
	UPackage* GetPackage() const;
	virtual UWorld* GetWorld() const { return nullptr; }
	bool HasAnyFlags(EObjectFlags Flags) const { UE::Stub::Sink(Flags); return false; }
	bool IsA(const UClass* SomeBase) const { UE::Stub::Sink(SomeBase); return true; }
	template <typename T>
	bool IsA() const { return true; }
	bool IsTemplate() const { return false; }
	virtual bool Modify(bool bAlwaysMarkDirty = true) { UE::Stub::Sink(bAlwaysMarkDirty); return true; }
	bool MarkPackageDirty() const { return true; }
	virtual void PostInitProperties() {}
	virtual void PostLoad() {}
	virtual void BeginDestroy() {}
	virtual FPrimaryAssetId GetPrimaryAssetId() const { return FPrimaryAssetId(); }

	/** Creates a subobject of a UObject-derived class (real UE: only legal inside a constructor). */
	template <typename TReturnType>
	TReturnType* CreateDefaultSubobject(FName SubobjectName, bool bTransient = false) { UE::Stub::Sink(SubobjectName, bTransient); return new TReturnType(); }
	template <typename TReturnType, typename TClassToConstructByDefault>
	TReturnType* CreateDefaultSubobject(FName SubobjectName, bool bTransient = false) { UE::Stub::Sink(SubobjectName, bTransient); return new TClassToConstructByDefault(); }
	template <typename TReturnType>
	TReturnType* CreateOptionalDefaultSubobject(FName SubobjectName, bool bTransient = false) { UE::Stub::Sink(SubobjectName, bTransient); return new TReturnType(); }

private:
	FName Name;
};

class UField : public UObject
{
	UE_STUB_CLASS_BODY(UField)
};

class UStruct : public UField
{
	UE_STUB_CLASS_BODY(UStruct)
	bool IsChildOf(const UStruct* SomeBase) const { UE::Stub::Sink(SomeBase); return true; }
	UStruct* GetSuperStruct() const { return nullptr; }
};

class UScriptStruct : public UStruct
{
	UE_STUB_CLASS_BODY(UScriptStruct)
};

class UClass : public UStruct
{
	UE_STUB_CLASS_BODY(UClass)
	UObject* GetDefaultObject(bool bCreateIfNeeded = true) const { UE::Stub::Sink(bCreateIfNeeded); return nullptr; }
	template <typename T>
	T* GetDefaultObject() const { return nullptr; }
	bool ImplementsInterface(const UClass* SomeInterface) const { UE::Stub::Sink(SomeInterface); return false; }
	bool HasAnyClassFlags(uint32 Flags) const { UE::Stub::Sink(Flags); return false; }
};

class UEnum : public UField
{
	UE_STUB_CLASS_BODY(UEnum)
	FString GetNameStringByValue(int64 Value) const { UE::Stub::Sink(Value); return FString(); }
	FText GetDisplayNameTextByValue(int64 Value) const { UE::Stub::Sink(Value); return FText(); }
	FString GetNameStringByIndex(int32 Index) const { UE::Stub::Sink(Index); return FString(); }
	int64 GetValueByName(FName InName) const { UE::Stub::Sink(InName); return 0; }
	int32 NumEnums() const { return 0; }
	static FString GetValueAsString(const TCHAR* EnumPath, int64 Value) { UE::Stub::Sink(EnumPath, Value); return FString(); }
};

struct FSavePackageArgs;

class UPackage : public UObject
{
	UE_STUB_CLASS_BODY(UPackage)
	/** Defined in the stub's UObject/SavePackage.h (real UE: declared here, FSavePackageArgs lives in SavePackage.h). */
	static bool SavePackage(UPackage* InOuter, UObject* InAsset, const TCHAR* Filename, const FSavePackageArgs& SaveArgs);
	void FullyLoad() {}
	bool IsDirty() const { return false; }
	void SetDirtyFlag(bool bIsDirty) { UE::Stub::Sink(bIsDirty); }
	bool IsFullyLoaded() const { return true; }
};

inline UPackage* UObject::GetOutermost() const { return nullptr; }
inline UPackage* UObject::GetPackage() const { return nullptr; }

class UInterface : public UObject
{
	UE_STUB_CLASS_BODY(UInterface)
};

/** Real UE: StaticStruct() is generated per USTRUCT. The stub supplies it on the reflected base structs only (FTableRowBase). */
template <typename TEnum>
UEnum* StaticEnum() { return nullptr; }
template <typename TStruct>
UScriptStruct* StaticStruct() { return nullptr; }

// ---------------------------------------------------------------------------------------------------------------------
// TSubclassOf (Templates/SubclassOf.h)
// ---------------------------------------------------------------------------------------------------------------------
template <typename T>
class TSubclassOf
{
public:
	TSubclassOf() = default;
	TSubclassOf(UClass* From) : Class(From) {}
	TSubclassOf(std::nullptr_t) {}
	template <typename U, typename = typename std::enable_if<std::is_convertible<U*, T*>::value>::type>
	TSubclassOf(const TSubclassOf<U>& From) : Class(From.Get()) {}
	TSubclassOf& operator=(UClass* From) { Class = From; return *this; }

	UClass* Get() const { return Class; }
	UClass* operator*() const { return Class; }
	UClass* operator->() const { return Class; }
	operator UClass*() const { return Class; }
	explicit operator bool() const { return Class != nullptr; }
	bool operator!() const { return Class == nullptr; }
	T* GetDefaultObject() const { return nullptr; }

private:
	UClass* Class = nullptr;
};

// ---------------------------------------------------------------------------------------------------------------------
// TSoftObjectPtr / TSoftClassPtr (UObject/SoftObjectPtr.h)
// ---------------------------------------------------------------------------------------------------------------------
struct FSoftObjectPath
{
	FSoftObjectPath() = default;
	FSoftObjectPath(const FString& InPath) : Path(InPath) {}
	FSoftObjectPath(const TCHAR* InPath) : Path(InPath) {}
	bool IsNull() const { return Path.IsEmpty(); }
	bool IsValid() const { return !Path.IsEmpty(); }
	FString ToString() const { return Path; }
	FString GetAssetPathString() const { return Path; }
	FString GetLongPackageName() const { return Path; }
	UObject* TryLoad() const { return nullptr; }
	UObject* ResolveObject() const { return nullptr; }

private:
	FString Path;
};

template <typename T>
class TSoftObjectPtr
{
public:
	TSoftObjectPtr() = default;
	TSoftObjectPtr(const FSoftObjectPath& InPath) : Path(InPath) {}
	TSoftObjectPtr(T* Object) { UE::Stub::Sink(Object); }
	bool IsNull() const { return Path.IsNull(); }
	bool IsValid() const { return false; }
	bool IsPending() const { return false; }
	T* Get() const { return nullptr; }
	T* LoadSynchronous() const { return nullptr; }
	const FSoftObjectPath& ToSoftObjectPath() const { return Path; }
	FString ToString() const { return Path.ToString(); }
	FString GetAssetName() const { return Path.ToString(); }
	FString GetLongPackageName() const { return Path.ToString(); }

private:
	FSoftObjectPath Path;
};

template <typename T>
class TSoftClassPtr
{
public:
	TSoftClassPtr() = default;
	TSoftClassPtr(const FSoftObjectPath& InPath) : Path(InPath) {}
	TSoftClassPtr(UClass* Class) { UE::Stub::Sink(Class); }
	bool IsNull() const { return Path.IsNull(); }
	bool IsValid() const { return false; }
	bool IsPending() const { return false; }
	UClass* Get() const { return nullptr; }
	UClass* LoadSynchronous() const { return nullptr; }
	const FSoftObjectPath& ToSoftObjectPath() const { return Path; }
	FString ToString() const { return Path.ToString(); }
	FString GetAssetName() const { return Path.ToString(); }

private:
	FSoftObjectPath Path;
};

// ---------------------------------------------------------------------------------------------------------------------
// Object globals (UObject/UObjectGlobals.h)
// ---------------------------------------------------------------------------------------------------------------------
/** Cast: a static_cast in the stub, so a cast between unrelated classes is a compile error (real Cast returns null instead). */
template <typename To, typename From>
To* Cast(From* Src) { return static_cast<To*>(Src); }
template <typename To, typename From>
To* Cast(const TObjectPtr<From>& Src) { return static_cast<To*>(Src.Get()); }
template <typename To, typename From>
To* CastChecked(From* Src) { return static_cast<To*>(Src); }
template <typename To, typename From>
To* CastChecked(const TObjectPtr<From>& Src) { return static_cast<To*>(Src.Get()); }
template <typename To, typename From>
To* ExactCast(From* Src) { return static_cast<To*>(Src); }

template <typename T>
T* NewObject(UObject* Outer = nullptr, FName Name = NAME_None, EObjectFlags Flags = RF_NoFlags, UObject* Template = nullptr, bool bCopyTransientsFromClassDefaults = false)
{
	UE::Stub::Sink(Outer, Name, Flags, Template, bCopyTransientsFromClassDefaults);
	return new T();
}
template <typename T>
T* NewObject(UObject* Outer, const UClass* Class, FName Name = NAME_None, EObjectFlags Flags = RF_NoFlags, UObject* Template = nullptr, bool bCopyTransientsFromClassDefaults = false)
{
	UE::Stub::Sink(Outer, Class, Name, Flags, Template, bCopyTransientsFromClassDefaults);
	return new T();
}

template <typename T>
const T* GetDefault() { static const T Default; return &Default; }
template <typename T>
const T* GetDefault(const UClass* Class) { UE::Stub::Sink(Class); return GetDefault<T>(); }
template <typename T>
T* GetMutableDefault() { static T Default; return &Default; }
template <typename T>
T* GetMutableDefault(const UClass* Class) { UE::Stub::Sink(Class); return GetMutableDefault<T>(); }

template <typename T>
T* LoadObject(UObject* Outer, const TCHAR* Name, const TCHAR* Filename = nullptr, uint32 LoadFlags = 0, UPackage* Sandbox = nullptr)
{
	UE::Stub::Sink(Outer, Name, Filename, LoadFlags, Sandbox);
	return nullptr;
}
inline UClass* LoadClass(UObject* Outer, const TCHAR* Name) { UE::Stub::Sink(Outer, Name); return nullptr; }
template <typename T>
UClass* LoadClass(UObject* Outer, const TCHAR* Name) { return LoadClass(Outer, Name); }

inline UPackage* CreatePackage(const TCHAR* PackageName) { UE::Stub::Sink(PackageName); return nullptr; }
inline UPackage* GetTransientPackage() { return nullptr; }
inline UObject* StaticFindObject(UClass* Class, UObject* InOuter, const TCHAR* Name, bool ExactClass = false) { UE::Stub::Sink(Class, InOuter, Name, ExactClass); return nullptr; }

inline bool IsValid(const UObject* Test) { return Test != nullptr; }
inline bool IsValidChecked(const UObject* Test) { return Test != nullptr; }
inline FString GetNameSafe(const UObject* Object) { return Object ? Object->GetName() : FString(TEXT("None")); }
inline FString GetPathNameSafe(const UObject* Object) { return Object ? Object->GetPathName() : FString(TEXT("None")); }
inline FString GetFullNameSafe(const UObject* Object) { return Object ? Object->GetFullName() : FString(TEXT("None")); }

// ---------------------------------------------------------------------------------------------------------------------
// Delegates (Delegates/DelegateCombinations.h). Dynamic delegates require an exact `void (UserClass::*)(Params...)`.
// ---------------------------------------------------------------------------------------------------------------------
template <typename... TParams>
class TStubMulticastDelegate
{
public:
	template <typename TUserClass>
	void AddDynamic(TUserClass* Object, void (TUserClass::*Func)(TParams...)) { UE::Stub::Sink(Object, Func); }
	template <typename TUserClass>
	void AddUniqueDynamic(TUserClass* Object, void (TUserClass::*Func)(TParams...)) { UE::Stub::Sink(Object, Func); }
	template <typename TUserClass>
	void RemoveDynamic(TUserClass* Object, void (TUserClass::*Func)(TParams...)) { UE::Stub::Sink(Object, Func); }
	template <typename TUserClass>
	void AddUObject(TUserClass* Object, void (TUserClass::*Func)(TParams...)) { UE::Stub::Sink(Object, Func); }
	template <typename TFunctor>
	void AddLambda(TFunctor&& Functor) { UE::Stub::Sink(Functor); }
	void RemoveAll(const void* Object) { UE::Stub::Sink(Object); }
	void Clear() {}
	bool IsBound() const { return false; }
	void Broadcast(TParams... Params) const { UE::Stub::Sink(Params...); }
};

template <typename TReturn, typename... TParams>
class TStubDelegate
{
public:
	template <typename TUserClass>
	void BindDynamic(TUserClass* Object, TReturn (TUserClass::*Func)(TParams...)) { UE::Stub::Sink(Object, Func); }
	template <typename TUserClass>
	void BindUObject(TUserClass* Object, TReturn (TUserClass::*Func)(TParams...)) { UE::Stub::Sink(Object, Func); }
	template <typename TFunctor>
	void BindLambda(TFunctor&& Functor) { UE::Stub::Sink(Functor); }
	void Unbind() {}
	bool IsBound() const { return false; }
	TReturn Execute(TParams... Params) const { UE::Stub::Sink(Params...); return TReturn(); }
	bool ExecuteIfBound(TParams... Params) const { UE::Stub::Sink(Params...); return false; }
};

#define DECLARE_DYNAMIC_MULTICAST_DELEGATE(Name) class Name : public TStubMulticastDelegate<> {};
#define DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(Name, T1, N1) class Name : public TStubMulticastDelegate<T1> {};
#define DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(Name, T1, N1, T2, N2) class Name : public TStubMulticastDelegate<T1, T2> {};
#define DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(Name, T1, N1, T2, N2, T3, N3) class Name : public TStubMulticastDelegate<T1, T2, T3> {};
#define DECLARE_DYNAMIC_MULTICAST_DELEGATE_FourParams(Name, T1, N1, T2, N2, T3, N3, T4, N4) class Name : public TStubMulticastDelegate<T1, T2, T3, T4> {};
#define DECLARE_DYNAMIC_MULTICAST_DELEGATE_FiveParams(Name, T1, N1, T2, N2, T3, N3, T4, N4, T5, N5) class Name : public TStubMulticastDelegate<T1, T2, T3, T4, T5> {};

#define DECLARE_MULTICAST_DELEGATE(Name) class Name : public TStubMulticastDelegate<> {};
#define DECLARE_MULTICAST_DELEGATE_OneParam(Name, T1) class Name : public TStubMulticastDelegate<T1> {};
#define DECLARE_MULTICAST_DELEGATE_TwoParams(Name, T1, T2) class Name : public TStubMulticastDelegate<T1, T2> {};
#define DECLARE_MULTICAST_DELEGATE_ThreeParams(Name, T1, T2, T3) class Name : public TStubMulticastDelegate<T1, T2, T3> {};
#define DECLARE_MULTICAST_DELEGATE_FourParams(Name, T1, T2, T3, T4) class Name : public TStubMulticastDelegate<T1, T2, T3, T4> {};

#define DECLARE_DYNAMIC_DELEGATE(Name) class Name : public TStubDelegate<void> {};
#define DECLARE_DYNAMIC_DELEGATE_OneParam(Name, T1, N1) class Name : public TStubDelegate<void, T1> {};
#define DECLARE_DYNAMIC_DELEGATE_TwoParams(Name, T1, N1, T2, N2) class Name : public TStubDelegate<void, T1, T2> {};
#define DECLARE_DELEGATE(Name) class Name : public TStubDelegate<void> {};
#define DECLARE_DELEGATE_OneParam(Name, T1) class Name : public TStubDelegate<void, T1> {};
#define DECLARE_DELEGATE_TwoParams(Name, T1, T2) class Name : public TStubDelegate<void, T1, T2> {};
#define DECLARE_DELEGATE_RetVal(R, Name) class Name : public TStubDelegate<R> {};
#define DECLARE_DELEGATE_RetVal_OneParam(R, Name, T1) class Name : public TStubDelegate<R, T1> {};

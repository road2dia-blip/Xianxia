# Tools/StubCompile — a model test, not a build

`check.sh` runs `clang++ -std=c++20 -fsyntax-only` over every `.cpp` under `Source/` against a set of **hand-written
stub headers** in `include/` that imitate the shape of the Unreal Engine 5.x API. It exists because this repository is
authored in a container with no Unreal Engine, no UnrealBuildTool (UBT) and no UnrealHeaderTool (UHT) (see
`docs/DECISIONS.md` D-0008). It is a **model test** in the sense of charter Section 14.2 rule 5: it checks our code
against a *model* of the engine, never against the engine. A green run is evidence that the code is well-formed C++
and internally consistent; it is **not** evidence that the project compiles under UBT, and no report may describe it
as a build or a compile result.

## Run it

```
Tools/StubCompile/check.sh        # PASS/FAIL per translation unit, then a summary; exit 1 on any failure
Tools/StubCompile/check.sh -v     # also echo each clang command
```

Requires `clang++` 18 or newer and Python 3 on `PATH` (`CLANGXX=/path/to/clang++` overrides the compiler).

What it does, in order:

1. `generate_stubs.py` writes an empty `<Header>.generated.h` into `generated/` for every header under `Source/`
   (UHT would generate the real ones), and removes stale ones. `generated/` and `logs/` are git-ignored.
2. Every `.cpp` under `Source/Ascension` is checked twice, with `WITH_EDITOR=0` and `WITH_EDITOR=1` (as UBT would for
   a game target and an editor target); every `.cpp` under `Source/AscensionEditor` once with `WITH_EDITOR=1`.
   Flags: `-std=c++20 -fsyntax-only -Wall -Wno-unused-parameter -Werror=return-type -fno-rtti -fno-exceptions`,
   include paths `include/`, `generated/`, `Source/Ascension`, `Source/AscensionEditor` (the same module-relative
   include layout the `Build.cs` files declare). Per-file clang output lands in `logs/`.
3. A few **textual** lints for UHT rules that are cheap to check by pattern (not by UHT): `#pragma once`;
   `CoreMinimal.h` first; in any header that declares a `UCLASS`/`USTRUCT`/`UENUM`, `<Header>.generated.h` is the
   last include and `GENERATED_BODY()` is present; every `BlueprintNativeEvent` has a `_Implementation` declaration
   and a definition in some `.cpp`; no `LOCTEXT`/`NSLOCTEXT`/`INVTEXT` literal uses "mana", "energy" or "MP"
   (charter 2.2).
4. A summary line: `N PASS, M FAIL of T translation-unit checks; E clang error(s); L lint failure(s)`.

## What it can catch

- Typos in identifiers, missing declarations, wrong member names, calls to functions that do not exist on our own
  classes, missing forward declarations, and use of a type through a forward declaration where the header was not
  included.
- Mismatched signatures between our own headers and `.cpp` files (the contract in `docs/SKELETON_M0.md` was
  written by several hands; this is the check that they agree), missing `override` targets, wrong `const`-ness.
- Comment and preprocessor accidents (the first run found a `*/` inside a doc comment that ended it early).
- Wrong include order for the rules in step 3, and forgotten `_Implementation` bodies.
- A subset of engine-API misuse where the stub is deliberately strict in the same way the engine is:
  `UE_LOG` without `TEXT()` or with an unknown verbosity; `FText::Format` with an `FString`/`TCHAR*` argument;
  `FMath::Clamp/Min/Max` with mixed argument types; Enhanced Input `BindAction` handlers whose signature does not
  match the payload; dynamic-delegate `AddDynamic`/`AddUniqueDynamic` with the wrong handler signature;
  `Cast<>` between unrelated classes (a compile error here; the engine would return null at runtime instead).
- Anything else ordinary C++ semantics reject.

## What it cannot catch

- **UHT rules.** `UCLASS`, `USTRUCT`, `UENUM`, `UPROPERTY`, `UFUNCTION`, `UMETA` and `GENERATED_BODY()` expand to
  nothing. Specifier validity (`BlueprintPure` on a void function, `CallInEditor` with parameters, `Categories`
  meta on a non-tag, `config` on a non-config class, Blueprint-incompatible property types such as `uint32` or
  const pointers, missing `UFUNCTION()` on a dynamic-delegate handler) is never checked. Every `.generated.h`
  is empty, so nothing that UHT would generate (`StaticClass()`, `Super`, `_Implementation` thunks, `execXxx`)
  exists except the small stand-ins the stub bases provide.
- **Real engine signatures.** The stubs were written from memory of UE 5.x to match what this code base calls.
  A member that exists in the stub with the wrong parameter list, or one the stub grants that the engine does not
  have, passes here and fails on the owner's machine. The stub's `TArray`/`TMap`/`TSet` are `std::vector`-backed
  approximations with only the members we use; `FString`/`FName`/`FText` likewise.
- **Transitive includes.** The stub headers approximate which engine header provides which type. The engine's real
  include graph is different, so an include that is "missing" in the engine can be satisfied here and vice versa.
- **Linking**, module boundaries and export macros (`ASCENSION_API` expands to nothing), `Build.cs`/`Target.cs`,
  the `.uproject`, plugins, config files, cooking, packaging.
- **Runtime behaviour** of any kind: nothing is executed. Constructors that call engine functions on null
  pointers, CDO-time tag lookups, and every gameplay body are never run.
- The `Super` stand-in supports **one** level of game-class inheritance from a stub engine class (each stub class
  declares `typedef Self Super;`). A game class deriving from another game class would resolve `Super` one level
  too high here; UHT generates the correct typedef in the real build.

## Maintaining the stubs

When a milestone starts using an engine API the stubs do not know, `check.sh` fails with an ordinary clang error in
the stub's namespace. Extend the matching header under `include/` with the smallest declaration that mirrors the
real signature (look it up; do not guess a wider one), and say so in the milestone report under "stub gaps filled".
Never weaken the check by excluding a file, deleting code, or loosening a deliberately strict stub.

Layout of `include/`: `CoreMinimal.h` (Core: containers, strings, text, math, logging, modules) →
`UObject/Object.h` (CoreUObject: reflection stand-ins, `TObjectPtr`, `TSubclassOf`, soft pointers, object globals,
delegates) → per-header engine classes under `Engine/`, `GameFramework/`, `Components/`, `Camera/`, `Subsystems/`,
`Kismet/`, `Blueprint/`, `Commandlets/`, `AssetRegistry/`, `Curves/`, plus `GameplayTagContainer.h`,
`NativeGameplayTags.h`, `InputAction.h`, `InputMappingContext.h`, `EnhancedInputComponent.h`,
`EnhancedInputSubsystems.h`, `InputActionValue.h`, `InputCoreTypes.h`. Headers such as `Math/RandomStream.h` or
`Templates/SubclassOf.h` that the engine ships as separate files are pass-throughs to where the stub keeps the type.

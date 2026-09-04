#!/usr/bin/env bash
# Tools/StubCompile/check.sh -- MODEL TEST: syntax-check every .cpp under Source/ with clang++ against stub Unreal headers.
#
# This is NOT an Unreal build. There is no UnrealBuildTool, no UnrealHeaderTool and no engine here; the headers under
# Tools/StubCompile/include are hand-written stand-ins. A PASS means "clang accepts this translation unit against our
# model of the engine API", nothing more. See Tools/StubCompile/README.md for exactly what it can and cannot catch.
#
# Usage: Tools/StubCompile/check.sh [-v]     (-v echoes the clang command per file)
# Exit code: 0 when every file passes and every textual lint passes; 1 otherwise.

set -u

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
SOURCE="$REPO/Source"
INCLUDE="$HERE/include"
GENERATED="$HERE/generated"
LOGDIR="$HERE/logs"
VERBOSE=0
[[ "${1:-}" == "-v" ]] && VERBOSE=1

CLANG="${CLANGXX:-clang++}"
if ! command -v "$CLANG" >/dev/null 2>&1; then
	echo "check.sh: $CLANG not found (need clang++ 18 or newer)"
	exit 1
fi

mkdir -p "$LOGDIR"
: > "$LOGDIR/last_run.log"

echo "== StubCompile model test (clang -fsyntax-only against stub headers; not a UE build) =="
echo "   compiler: $("$CLANG" --version | head -n 1)"

# 1. Regenerate the empty <Header>.generated.h stand-ins so the list always tracks the tree.
if ! python3 "$HERE/generate_stubs.py" --source "$SOURCE" --out "$GENERATED"; then
	echo "check.sh: generate_stubs.py failed"
	exit 1
fi

# 2. Compile every .cpp. Runtime module files see WITH_EDITOR=0; editor module files see WITH_EDITOR=1 (as UBT would
#    for a game target vs an editor target; the runtime module is also built with WITH_EDITOR=1 in editor builds, so
#    it is compiled a second time that way).
COMMON_FLAGS=(
	-std=c++20
	-fsyntax-only
	-x c++
	-Wall
	-Wno-unused-parameter
	-Wno-unused-private-field
	-Wno-unused-function
	-Wno-unused-variable
	-Werror=return-type
	-ferror-limit=50
	-fno-rtti
	-fno-exceptions
	-I"$INCLUDE"
	-I"$GENERATED"
	-I"$SOURCE/Ascension"
	-I"$SOURCE/AscensionEditor"
)

pass=0
fail=0
errors_total=0
failed_files=()

compile_one() {
	local file="$1"
	local with_editor="$2"
	local label="$3"
	local rel="${file#$REPO/}"
	local log="$LOGDIR/$(echo "$rel" | tr '/' '_')${label}.log"
	local cmd=("$CLANG" "${COMMON_FLAGS[@]}" "-DWITH_EDITOR=$with_editor" "-DWITH_EDITORONLY_DATA=$with_editor" "$file")
	if [[ $VERBOSE -eq 1 ]]; then
		echo "   \$ ${cmd[*]}"
	fi
	if "${cmd[@]}" >"$log" 2>&1; then
		local warnings
		warnings=$(grep -c 'warning:' "$log" || true)
		if [[ "$warnings" -gt 0 ]]; then
			echo "PASS  $rel$label  ($warnings warning(s), see $log)"
		else
			echo "PASS  $rel$label"
		fi
		pass=$((pass + 1))
	else
		local errs
		errs=$(grep -c 'error:' "$log" || true)
		[[ "$errs" -eq 0 ]] && errs=1
		echo "FAIL  $rel$label  ($errs error(s))"
		sed 's/^/      /' "$log" | grep -E 'error:|note:|^      \s+\^|^      [0-9]+ \|' | head -n 40
		fail=$((fail + 1))
		errors_total=$((errors_total + errs))
		failed_files+=("$rel$label")
	fi
	cat "$log" >> "$LOGDIR/last_run.log"
}

echo "-- Runtime module Source/Ascension (WITH_EDITOR=0) --"
while IFS= read -r file; do
	compile_one "$file" 0 ""
done < <(find "$SOURCE/Ascension" -name '*.cpp' | sort)

echo "-- Runtime module Source/Ascension (WITH_EDITOR=1, as in an editor build) --"
while IFS= read -r file; do
	compile_one "$file" 1 " [editor]"
done < <(find "$SOURCE/Ascension" -name '*.cpp' | sort)

echo "-- Editor module Source/AscensionEditor (WITH_EDITOR=1) --"
while IFS= read -r file; do
	compile_one "$file" 1 ""
done < <(find "$SOURCE/AscensionEditor" -name '*.cpp' | sort)

# 3. Textual lints for the few UnrealHeaderTool rules that are cheap to check without UHT. These are pattern checks
#    on the source text, not UHT; they catch the contract's include-order rules and forgotten _Implementation bodies.
echo "-- Textual lints (UHT-style rules checked by pattern, not by UHT) --"
lint_fail=0
lint() { echo "LINT-FAIL $1"; lint_fail=$((lint_fail + 1)); }

while IFS= read -r header; do
	rel="${header#$REPO/}"
	if ! grep -q '^#pragma once' "$header"; then
		lint "$rel: missing #pragma once"
	fi
	first_include=$(grep -m1 -E '^#include' "$header" | sed -E 's/^#include[[:space:]]*"([^"]+)".*/\1/')
	if [[ "$first_include" != "CoreMinimal.h" ]]; then
		lint "$rel: first #include is '$first_include', expected CoreMinimal.h"
	fi
	if grep -qE '^\s*(UCLASS|USTRUCT|UENUM)\s*\(' "$header"; then
		base=$(basename "$header" .h)
		last_include=$(grep -E '^#include' "$header" | tail -n 1 | sed -E 's/^#include[[:space:]]*"([^"]+)".*/\1/')
		if [[ "$last_include" != "$base.generated.h" ]]; then
			lint "$rel: declares a reflected type but the last #include is '$last_include', expected $base.generated.h"
		fi
		if ! grep -qE 'GENERATED_(BODY|USTRUCT_BODY|UCLASS_BODY)\(\)' "$header"; then
			lint "$rel: declares a reflected type without GENERATED_BODY()"
		fi
	elif grep -qE '\.generated\.h"' "$header"; then
		lint "$rel: includes a .generated.h but declares no UCLASS/USTRUCT/UENUM (UHT rejects this)"
	fi
	# Every BlueprintNativeEvent needs a <Name>_Implementation declaration in the header and a definition in a .cpp.
	while IFS= read -r fn; do
		[[ -z "$fn" ]] && continue
		if ! grep -qE "\b${fn}_Implementation\s*\(" "$header"; then
			lint "$rel: BlueprintNativeEvent $fn has no ${fn}_Implementation declaration"
		fi
		if ! grep -rqE "::${fn}_Implementation\s*\(" "$SOURCE" --include='*.cpp'; then
			lint "$rel: BlueprintNativeEvent $fn has no ${fn}_Implementation definition in any .cpp"
		fi
	done < <(awk '/UFUNCTION\(.*BlueprintNativeEvent/{getline; match($0, /[A-Za-z_][A-Za-z0-9_]*[[:space:]]*\(/); if (RSTART) { s = substr($0, RSTART, RLENGTH); sub(/[[:space:]]*\(/, "", s); print s } }' "$header")
done < <(find "$SOURCE" -name '*.h' | sort)

# Charter 2.2 / Appendix C wording rules, checked on user-facing text only (string literals inside LOCTEXT/NSLOCTEXT/INVTEXT).
while IFS= read -r hit; do
	lint "user-facing text uses a forbidden term (charter 2.2): $hit"
done < <(grep -rnoE '(LOCTEXT|NSLOCTEXT|INVTEXT)\([^)]*\b([Mm]ana|MP|[Ee]nergy)\b[^)]*\)' "$SOURCE" --include='*.cpp' --include='*.h' || true)

if [[ $lint_fail -eq 0 ]]; then
	echo "LINT  all textual lints passed"
fi

# 4. Summary.
total=$((pass + fail))
echo "== Summary: $pass PASS, $fail FAIL of $total translation-unit checks; $errors_total clang error(s); $lint_fail lint failure(s) =="
echo "   full clang output: $LOGDIR/last_run.log"
if [[ $fail -gt 0 ]]; then
	printf '   failed: %s\n' "${failed_files[@]}"
fi
echo "   (model test only: clang against stub headers, not UnrealBuildTool -- see Tools/StubCompile/README.md)"

if [[ $fail -gt 0 || $lint_fail -gt 0 ]]; then
	exit 1
fi
exit 0

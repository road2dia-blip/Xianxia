# Project Ascension — Standing Instructions

@docs/ASCENSION_CHARTER.md

The file imported above is **the charter** (Part A of the master prompt, Sections 1–15 plus Appendices A–C). It is authoritative for every session. Where the charter and any other prompt disagree, the charter wins. Read it in full before doing anything.

## Milestone discipline
- Work proceeds one milestone at a time (charter Section 12). The current milestone and its approval state are recorded at the top of `docs/CHANGELOG.md`. **Never begin the next milestone without the owner's explicit approval.** Never pull later work forward.
- Every milestone ends with a report in the charter's Section 14.1 format, saved as `docs/MILESTONE_<n>_REPORT.md`, a `docs/CHANGELOG.md` entry, and a commit whose message names the milestone.
- Every interpretation the charter did not decide gets a numbered entry in `docs/DECISIONS.md` (`D-0001`, `D-0002`, …). Prefer the smaller reading.

## Repository facts
- `docs/ASCENSION_CHARTER.md` — the charter (do not edit without a DECISIONS entry).
- `docs/KICKOFF.md` — delivery notes and the original kickoff message.
- `docs/MILESTONE_0_PLAN.md` — the pre-plan the kickoff asked for; `docs/MILESTONE_0_REPORT.md` — the Milestone 0 report.
- `docs/SKELETON_M0.md` — the concrete class/file contract for the Milestone 0 C++ skeleton (what exists, where, and why).
- `docs/OWNER_FIRST_RUN.md` — what the owner must run once in the Unreal Editor to materialise the binary assets this repo cannot contain.
- `Source/Ascension/` (runtime module) and `Source/AscensionEditor/` (editor module: ladder commandlet and editor library).
- `Content/Ascension/` — all project assets live here (charter Appendix C). Binary `.uasset`/`.umap` files are created in-editor by `Content/Python/ascension_m0_setup.py`; text sources (ladder CSV/JSON) are committed.
- `Tools/Ladder/generate_realm_ladder.py` — offline twin of the in-engine ladder generator. Run `python3 Tools/Ladder/generate_realm_ladder.py` after changing a constant, and mirror the constant in `DA_RealmLadderConfig`.
- `Tools/StubCompile/` — a **model test**, not a build: syntax-checks the C++ against stub headers with clang. It cannot prove the code compiles under Unreal Build Tool.

## Environment notes (Claude Code remote container)
- There is **no Unreal Engine** in this container: no editor, no UBT, no MCP, no packaging, no screenshots. Compile results, editor state, and runtime behaviour can only be confirmed on the owner's machine. Reports must say exactly what was and was not verified (charter Section 14).
- Available here: clang 18, g++ 13, cmake, Python 3.11, Node 22. Use them for generators, stub checks, and docs only.

## Binding conventions (summary; the charter is the source)
- Naming per charter Appendix C (`U`/`A`/`F`/`E` prefixes, `DA_`, `DT_`, `BP_`, `WBP_`, `M_`/`MI_`, `NS_`/`NE_`, `MS_`, `IA_`/`IMC_`, `L_`, `A_`/`AS_`, `CR_`). Gameplay Tags root `Ascension.`
- Never use "Law" as a progression term; never call Qi "mana", "energy", or "MP" in user-facing text.
- No external downloads, no third-party plugins, no networking, no combat, no inventory.
- Every gameplay number reads from the ladder row or the `ModifierStack`; no system reads a raw constant.
- Commit at the end of every milestone. Never force-push. Never rewrite history.

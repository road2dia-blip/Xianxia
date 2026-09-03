# Project Ascension — Delivery Notes and Kickoff Message

> Source: `Project_Ascension_Full_Game_Master_Prompt.md` (preamble and Part B). Kept for reference; the charter itself lives in `docs/ASCENSION_CHARTER.md`.


---

## HOW TO USE THIS DOCUMENT (read before sending anything)

This document is written in two parts that are meant to be delivered differently.

**Part A — The Standing Charter (Sections 1–14).** Save this as `CLAUDE.md` in the root of the new Unreal project folder, or as `/docs/ASCENSION_CHARTER.md` referenced from `CLAUDE.md`. Claude Code reads `CLAUDE.md` automatically at the start of every session, so the charter stays in force across sessions without being re-pasted. It contains the vision, terminology, rules, data model, realm ladder, mechanics, architecture, and reporting standards.

**Part B — The Kickoff Message (Section 15).** Send this as the first chat message after the charter is in place. It tells Claude which milestone to start on and how to stop.

Do not paste Parts A and B together as one message. A single fifteen-thousand-word message is worse than a charter plus a short instruction: it crowds the context that Claude needs for tool results, and it gets summarized away as the session grows. A `CLAUDE.md` is re-read every session and is never summarized.

**Gate before you begin.** This document assumes the aura-circulation prototype in `/Game/MCP_Test/AuraCirculation` has been played through Stage 7 (inward draw and absorption) and that the answer to the question "does establishing circulation and releasing an inward Pulse feel like cultivation?" is *yes* or *yes with tuning notes*. If the answer is *no* or *uncertain*, do not start this build. Fix the prototype first. Milestone 1 of this document re-validates the loop in the new project regardless, but it cannot rescue a loop that never felt right.

**Recommended session procedure.**
```
cd "<path to new project>"
claude --model claude-fable-5-1
/status         (confirm Fable)
/mcp            (confirm unreal-mcp connected, if using MCP for editor operations)
```
Then send the Kickoff Message. Approve one milestone at a time. Every milestone ends with a report in the format of Section 14 and a stop. Play every milestone yourself before approving the next. The implementation agent cannot hold keys; you are the only source of evidence about feel.

---

# PART B — THE KICKOFF MESSAGE

Send this as the first chat message once the charter above is in `CLAUDE.md` (or referenced from it) and `/status` shows Fable 5.1.

```text
You are starting Project Ascension under the charter in CLAUDE.md. Read the whole charter before doing anything. It is authoritative; where it and any earlier prompt disagree, the charter wins.

Context: the aura-circulation prototype in the MCP_UE5_Prototype sandbox (/Game/MCP_Test/AuraCirculation) has been played and validated through inward draw and absorption. Its known-good decisions are listed in charter Section 13 and must be kept. Its assets may be read for reference but are not to be migrated; the new project rebuilds them properly under the Section 11 architecture.

Begin with Milestone 0 only.

Before creating anything, report:
- The template you will use and why.
- The Unreal version and the engine plugins you will enable.
- Whether you will use Unreal MCP for editor operations, direct file/asset generation, or both, and what each will be used for.
- The full folder and C++ class skeleton you intend to create.
- The Section 6.3 formula constants you will put in DA_RealmLadderConfig and a preview of rows 1.1, 1.9, 2.1, 4.1, 7.1, 9.9.
- Any part of the charter you cannot implement with the available tools, and the smallest substitute you propose.

Wait for my approval of that plan. Then execute Milestone 0, produce the Section 14.1 report, commit, and stop.

Do not begin Milestone 1 until I approve Milestone 0. Do not pull any later milestone's work forward. If anything in the charter is ambiguous, state your interpretation in DECISIONS.md and proceed with the smaller reading.
```

---


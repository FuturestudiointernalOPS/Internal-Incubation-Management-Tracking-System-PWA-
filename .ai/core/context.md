# Context Manager — Confidence Checks and Read Budget

> Version: 1.0 | Role: load the minimum information required, in strict order. Never more.

## 1. The Confidence Check

Before any file read, the runtime evaluates exactly one question:

> **Do I already know enough to continue with confidence?**

"Enough" means: the remaining uncertainty cannot change the next action, OR the next action is to ask the user a question.

### 1.1 Confidence Sources (cheapest first)

| Priority | Source | Scope | Cost |
|---|---|---|---|
| 1 | Conversation context | What's been said this session. | 0 |
| 2 | Session state block | `files_inspected`, previously answered `questions`, `objective`, `stage`. | 0 |
| 3 | Project memory (Phase 3) | MEMORY.md, PROJECT.md — reusable knowledge. | Low |
| 4 | Current file | The file already being worked on, if any. | Low |

If any combination of these confirms sufficient understanding → `confidence: sufficient`. Continue with zero reads.

This is the default expectation. Guessing what an unfamiliar file contains is cheaper than reading the file. Being wrong triggers a correction — which is still cheaper than premature reading.

## 2. Read Budget Ladder

When confidence is insufficient, consume the ladder in strict order. **Stop immediately** when the gap is closed.

| Step | Action | Cost | Gated By | Purpose |
|---|---|---|---|---|
| 1 | Re-read conversation context + state block | 0 | None | Always first — extract maximum signal from what's already known. |
| 2 | Read project memory (Phase 3) | Low | Phase 3 ready | Reuse known architecture decisions, patterns, schemas. |
| 3 | Read the current file (or the file named in the task) | Low | File must be reasonably known/discoverable | Understand the local context of the change. |
| 4 | Read directly related files (imports, parent components, same module) | Medium | Medium+ level | Expand to related artifacts when local context is insufficient. |
| 5 | Repository search — targeted grep/find | Medium | Heavy level, or explicit user directive | Locate artifacts when their existence is unknown. |
| 6 | Full repository analysis (broad reading) | High | Heavy level AND all prior steps exhausted | Last resort. Almost never needed. |

### 2.1 Ladder Rules

1. **Strict order.** Never jump to a later step while an earlier step could resolve the gap.
2. **One at a time.** Read one unit, re-check confidence, proceed only if still insufficient.
3. **Cache.** Every file read is recorded in `files_inspected`. Never re-read within the session.
4. **Ceiling.** The ladder ceiling is set by the workload level:
   - Light: Step 3 maximum.
   - Medium: Step 4 maximum.
   - Heavy: Step 6 maximum.
5. **Escalation.** If a gap cannot be closed within the level's ceiling: ask the user. Do not silently escalate.

## 3. Read Discipline

### 3.1 What counts as a "read"

- Reading a file.
- Running grep / find_path against the repository.
- Inspecting a database schema (Phase 2).
- Reviewing git history (Phase 2 — Forensic skill).

### 3.2 What does NOT count as a read

- Summarizing the conversation context (it's already in memory).
- Checking the state block (it's already loaded).
- Checking skill metadata (already loaded on workflow start).
- Asking the user a question.

### 3.3 Anti-patterns (must never happen)

- "While I'm here" reads — reading a file not required by the current step of the ladder.
- Exploratory grepping — searching without a specific, ladder-justified question.
- Pre-loading files "in case they're needed later."
- Re-reading a file already in `files_inspected` — even if context suggests it may have changed; ask the user.

## 4. Confidence Update Protocol

After every read:

1. Re-evaluate: *do I now know enough?*
2. Update `confidence` in the state block.
3. If still insufficient and the ladder ceiling permits: proceed to next step.
4. If still insufficient and the ceiling is reached: record the gap in `questions`, transition `active → waiting`, ask the user.

## 5. Token Rules (reinforced)

| Rule | Rationale |
|---|---|
| Every read must be justifiable by ladder position + workload level. | Prevents expensive "just in case" loading. |
| No speculative reads. | If you don't need it *now*, don't read it. |
| Files in `files_inspected` are never re-read. | Eliminates the most common token waste in coding sessions. |
| The cheapest sufficient source always wins. | Conversation context costs 0 tokens (it's already in the context window). Use it. |

## 6. Debug Traces

```
[DEBUG] confidence: insufficient — reason: <one line>
[DEBUG] context: <file|grep> (ladder step <N>, budget: <level>) — reason: <one line>
[DEBUG] context: none (confidence sufficient)
[DEBUG] context: ceiling reached (ladder step <N>, level <level>) — reason: asking user
[DEBUG] context: cached (<file> already in files_inspected) — skipped
```

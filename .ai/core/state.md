# Session State — Schema, Lifecycle, and Preservation

> Version: 1.0 | Role: preserve workflow state across the session.
> Rebuild nothing. Reset only when routing demands it.

## 1. State Block Schema

The runtime maintains exactly one state block per session. It lives in session context — not persisted to disk in Phase 1.

```yaml
session:
  workflow: null | <name>           # currently active skill name
  status: idle | created | active | waiting | completed | archived
  objective: <one line>            # what are we trying to achieve (active workflow)
  stage: null | <stage-name>       # current stage of the active skill's workflow
  level: null | light | medium | heavy
  files_inspected: [paths]         # files already read this session — never revisit
  skills_loaded: [names]           # skills already loaded — never reload
  chain: [names] | null            # remaining skills in a chain (head = active)
  questions: [strings]             # outstanding clarifications a workflow is Waiting on
  confidence: sufficient | insufficient
  debug: off | on
```

### 1.1 Field Descriptions

- `workflow`: the skill currently executing, or `null` if no task is in progress.
- `status`: must always respect the lifecycle (next section).
- `objective`: one concise line capturing the goal. For forensic: the question being answered. For bug: the defect being resolved.
- `stage`: name of the skill's current stage (e.g. `inspect`, `locate`, `plan`, `implement`, `verify`). `null` when idle or between stages.
- `level`: workload level as determined by the router.
- `files_inspected`: accumulate. Never remove entries. A guard against re-reading.
- `skills_loaded`: accumulates across the session (unless a new task archives the current one — then the new workflow's skill list replaces it).
- `chain`: only populated when the router computed a skill chain. Head of the list is the active skill. When a skill completes and the chain is non-empty, pop the head and activate the next.
- `questions`: when `status: waiting`, the blocking question lives here. A Continuation that answers a recorded question transitions `waiting → active`.
- `confidence`: evaluated by the context manager; updated before each read decision.
- `debug`: `off` by default; toggled by an explicit user request or set programmatically.

## 2. Workflow Lifecycle

```
idle → Created → Active ⇄ Waiting → Completed → Archived
```

### 2.1 Transition Rules

| From | To | Trigger | Side effects |
|---|---|---|---|
| `idle` | `created` | New Task / Scope Change classified; skill selected. | Populate `workflow`, `objective`, `stage` (first stage of skill), `level`. |
| `created` | `active` | First stage execution begins. | `status` → `active`. |
| `active` | `waiting` | Workflow cannot proceed without a user answer, evidence, or decision. | Record the blocking question in `questions`. |
| `waiting` | `active` | Continuation or Correction resolves the recorded question. | Remove the resolved question from `questions`. Resume from the recorded `stage`. |
| `active` | `completed` | Workflow's stop conditions are met (defined by the skill, Phase 2). | `stage` → `null`. |
| `completed` | `archived` | Immediately on completion, OR when a New Task / Scope Change supersedes this workflow. | All fields reset for the next workflow (but `files_inspected`, `skills_loaded`, and conversation context persist). |
| `waiting` | `archived` | New Task / Scope Change forces closure. | Archive with note. `questions` cleared. |
| `created` / `active` / `waiting` | `archived` | New Task or Scope Change classified. | Current workflow archived; new state block populated for the new workflow. |

### 2.2 Archival Protocol

When a workflow is archived:

1. The workflow's objective and outcome are noted in the conversation context (not persisted to disk in Phase 1; see `MEMORY.md` in Phase 3 for durable archival).
2. `workflow`, `objective`, `stage`, `level`, `chain`, `questions` are reset for the new task.
3. `files_inspected` and `skills_loaded` are preserved — they amortize across the session.
4. `confidence` and `debug` are preserved unless overridden.

## 3. Preservation Rules by Classification

| Classification | State behavior |
|---|---|
| **Continuation** | State unchanged except `stage` advances (if the workflow progresses). Never reset. Never re-derive. |
| **Correction** | State unchanged. Correction is applied to the current artifact; no stage reset. |
| **New Task** | Archive current workflow (if any). Create new state block for the new workflow. `files_inspected` and `skills_loaded` carry forward. |
| **Scope Change** | Same as New Task, plus explicit annotation that conversation context was preserved. |
| **Unknown** | State frozen. Nothing archived, loaded, or reset. The one clarifying question is not recorded as a `questions` entry (the system is not Waiting — it hasn't started work). |

## 4. Chain Execution

When `chain` is non-empty:

1. The active skill is `chain[0]` (head).
2. When the head skill reaches `completed`, pop it from `chain`.
3. If the chain has a next entry, activate it: `workflow = chain[0]`, `status = created`, `stage = first stage`.
4. Continue until chain is empty, then archive normally.

## 5. Cross-Session Persistence (Phase 3)

In Phase 1, state is session-scoped only. A new conversation starts with an empty state block. This is expected.

Phase 3 (`MEMORY.md`) provides durable storage for reusable decisions, architecture notes, and known facts. Session state itself (the active workflow, stage, etc.) is intentionally not persisted — it is specific to a session's task. Only *conclusions* and *knowledge* survive across sessions.

## 6. Debug Traces

```
[DEBUG] state: session initialized    (on first load)
[DEBUG] workflow: <name> <from> → <to>
[DEBUG] state: stage "<from>" → "<to>"
[DEBUG] state: stage preserved (unchanged)
[DEBUG] workflow: <name> archived (reason: <new_task|scope_change>)
[DEBUG] chain: [<head> completed] → [<next> activated]
[DEBUG] chain: done (empty)
[DEBUG] debug: on | off
```

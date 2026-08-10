# Router — Deterministic Classification and Workflow Selection

> Version: 1.0 | Role: routing only.
> The router classifies, selects, and budgets. It never performs engineering reasoning.

## 1. Inputs

Every routing decision uses only three inputs:

1. The current session state block (`core/state.md` §1).
2. The incoming message text.
3. Loaded skill metadata (Phase 2), if any skills are already in `skills_loaded`.

No other context is consulted during routing. This keeps routing cheap and deterministic.

## 2. Classification Rules (evaluate in order; first match wins)

| Priority | Rule ID | Signal | Result |
|---|---|---|---|
| 1 | R1 — Continuation | Message refers to the current objective or workflow without introducing new scope. Signals: anaphoric references ("it", "that", "this"), elaboration, "finish this", "what next?", or a direct action on the current artifact. | **Continuation** |
| 2 | R2 — Correction | Message names an existing artifact, an earlier output, or the current work and prescribes a specific substitution. Signals: "use X instead of Y", "change that to…", "should be…", "no, …". | **Correction** |
| 3 | R3 — Scope Change | Message shifts the goal away from the current workflow type while acknowledging the current context. Signals: implementation → investigation, building → refactoring, "instead, …", "actually, …", a clear domain shift mid-session. | **Scope Change** |
| 4 | R4 — New Task | Message names a new deliverable or goal with no connection to the current workflow, or no workflow is currently active (`workflow: null`). | **New Task** |

If the message is ambiguous (could match more than one rule equally well): result is **Unknown**. Ask exactly one clarifying question. Do not load anything.

| U1 — Unknown | Message cannot be confidently classified. | **Unknown** — ask one question, freeze state, load nothing. |

**Key invariant:** R1 and R2 must never trigger loading. R3 and R4 trigger completion + archiving of the current workflow, then new workflow creation.

## 3. Workload Grading

After classification (New Task / Scope Change only), grade the task by scope:

| Level | Signal | Ladder Ceiling |
|---|---|---|
| **Light** | Single artifact, mechanical change, bounded scope; e.g. renaming, minor UI tweak, typo fix. | Steps 1–3 |
| **Medium** | Multiple artifacts within one workflow, moderate complexity; e.g. building a feature touching 2–5 files. | Steps 1–4 |
| **Heavy** | Design, investigation, cross-cutting change spanning many files or systems; e.g. forensic analysis, new architecture module. | Steps 1–6 |

Continuation and Correction inherit the existing level from session state. Never re-grade them.

## 4. Workflow Selection (Phase 2 interface — designed, not yet active)

When no skills directory exists yet (Phase 1), skip this section. When `.ai/skills/` contains files:

### 4.1 Skill Metadata Format

Every skill file must begin with a YAML front-matter block, delimited by `---`:

```yaml
name: Feature
purpose: Implement new functionality.
trigger: [build, create, implement, add, new feature, module]
workflow_weight: medium
can_chain: [database, review]
```

Fields:
- `name`: human-readable skill name.
- `purpose`: one-sentence description.
- `trigger`: list of keywords/phrases; lowest-weight match wins.
- `workflow_weight`: `light` | `medium` | `heavy` — the default workload level for this skill. Overridable by the task description.
- `can_chain`: list of other skill `name` values this skill can compose with, in preferred order.

### 4.2 Discovery

At routing time, scan `.ai/skills/*.md`. Parse front-matter. Match `trigger` lists against the message text (case-insensitive substring / keyword match). Disambiguation: prefer the skill with the most triggers matched; tie-break alphabetically. If no triggers match: **Unknown**.

### 4.3 Chaining

If the primary skill's `can_chain` lists other skills whose triggers also match the task description, build a chain: `[primary, chain-1, chain-2, …]` in `can_chain` order. The workflow executes sequentially through the chain. Chaining is optional — it activates only when the task description clearly spans the secondary skill's domain.

### 4.4 No Hardcoding

The router must not contain a hardcoded skill list. Skills are discovered from the filesystem. Adding a skill requires no router change.

## 5. Decision Record (every classification produces this)

Every routing decision yields exactly one structured record:

```
decision: <continuation | correction | new_task | scope_change | unknown>
rule: <R1 | R2 | R3 | R4 | U1>
workflow: <current-name> | <new-name> | null
stage: <unchanged | reset | <stage-name>>
level: <light | medium | heavy | inherited>
load: nothing | skills:[<names>] | context:steps[<indices>]
chain: [<names>] | null
reason: <one-line explanation>
```

## 6. Token Optimization

- Continuation / Correction: load nothing. Zero reads. Zero re-planning.
- New Task / Scope Change: load only matched skill(s) — one pass at metadata + body.
- Context loading: follows the ladder in `core/context.md`. Every read must be justified by the current level.
- Cache: files listed in `files_inspected` are never re-read within the session.

## 7. Debug Traces

In debug mode, the router emits:

```
[DEBUG] classify: <result> (rule: <ID>)  [reason: <one line>]
[DEBUG] workload: <level> (new) | inherited (<level>)
[DEBUG] skills: discovered [<names>]
[DEBUG] skills: loaded [<names>]
[DEBUG] skills: chained [<ordered names>]
```

## 8. Non-Responsibilities

The router must never:
- Decide *how* to implement anything.
- Read files (other than skill metadata discovery) to answer engineering questions.
- Apply corrections or execute workflow stages.
- Flag to load a skill that is already in `skills_loaded`.

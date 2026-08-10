# Self-Test — Runtime Verification Suite

> Version: 1.0 | Run before Phase 2.
> A test passes when the decision record, state transitions, and debug trace match the expected output exactly.

## How to Run

1. Enable debug mode (`debug: on` in state block, or "enable debug mode").
2. Start each test case from the specified initial state.
3. Feed the message to the runtime.
4. Compare the routing decision record, state block, and debug traces against the expected output.
5. All tests must pass in order before Phase 2 (Skills) begins.

Pass condition: every field in the decision record and state block matches **without deviation**.

---

## T1 — Continuation

**Initial state:**
```
workflow: feature, status: active, stage: inspect, level: light, objective: "Add export button"
```
**Message:** "Rename the button."

**Expected:**
```
decision: continuation
rule: R1
workflow: feature (unchanged)
stage: inspect (unchanged)
level: inherited (light)
load: nothing
reason: message refers to current artifact within current workflow
```

**State transition:** none (no stage advancement — the correction implicitly advances to a refine action on the current stage; stage preserved). `confidence: sufficient`.

**Debug trace:**
```
[DEBUG] classify: continuation (rule: R1)  [reason: message refers to current artifact within current workflow]
[DEBUG] workload: inherited (light)
[DEBUG] skills: none loaded
```
**Assertion:** zero context reads. No `[DEBUG] context:` lines.

---

## T2 — Correction

**Initial state:**
```
workflow: feature, status: active, stage: implement, level: medium, objective: "Build student list"
```
**Message:** "Use Student instead of Teacher."

**Expected:**
```
decision: correction
rule: R2
workflow: feature (unchanged)
stage: implement (unchanged)
level: inherited (medium)
load: nothing
reason: message prescribes a substitution on current work
```

**State transition:** none. Stage preserved. Correction applied to current artifact.

**Debug trace:**
```
[DEBUG] classify: correction (rule: R2)  [reason: message prescribes a substitution on current work]
[DEBUG] workload: inherited (medium)
[DEBUG] skills: none loaded
```
**Assertion:** zero context reads.

---

## T3 — New Task

**Initial state:**
```
workflow: bug-fix, status: active, stage: locate, level: medium, objective: "Fix login error"
```
**Message:** "Build the Attendance module."

**Expected:**
```
decision: new_task
rule: R4
workflow: bug-fix → completed → archived — then: feature (created)
stage: reset → first stage of feature skill
level: medium
load: skills:[feature]
chain: null (unless can_chain triggers)
reason: message names new deliverable unrelated to current workflow
```

**State:**
- Old workflow archived; `files_inspected` and `skills_loaded` carry forward.
- New: `workflow: feature`, `status: created`, `objective: "Build Attendance module"`, `stage: (first stage)`.

**Debug trace:**
```
[DEBUG] classify: new_task (rule: R4)  [reason: message names new deliverable unrelated to current workflow]
[DEBUG] workflow: bug-fix active → completed
[DEBUG] workflow: bug-fix completed → archived (reason: new_task)
[DEBUG] skills: discovered [feature, bug-fix, forensic, database]  (if Phase 2 active; skip in Phase 1)
[DEBUG] skills: loaded [feature]
```
**Assertion:** old workflow cleanly archived before new one starts.

---

## T4 — Scope Change

**Initial state:**
```
workflow: feature, status: active, stage: implement, level: medium, objective: "Build report UI"
```
**Message:** "Investigate why attendance disappeared."

**Expected:**
```
decision: scope_change
rule: R3
workflow: feature → completed → archived — then: forensic (created)
stage: reset → first stage of forensic skill
level: heavy
load: skills:[forensic]
chain: null
reason: message shifts from implementation to investigation
```

**State:** Conversation context preserved (not cleared). `debug` and `files_inspected` carry forward.

**Debug trace:**
```
[DEBUG] classify: scope_change (rule: R3)  [reason: message shifts from implementation to investigation]
[DEBUG] workflow: feature active → completed
[DEBUG] workflow: feature completed → archived (reason: scope_change)
[DEBUG] skills: loaded [forensic]
[DEBUG] workload: heavy (new)
```

---

## T5 — Unknown Task

**Initial state:** `idle` (empty session state).
```
workflow: null, status: idle, objective: null, stage: null, level: null
```
**Message:** "Fix it."

**Expected:**
```
decision: unknown
rule: U1
workflow: null
stage: null
level: null
load: nothing
chain: null
reason: no active workflow, no referent — ambiguous
```

**State:** Frozen. Nothing archived, loaded, or reset.

**Debug trace:**
```
[DEBUG] classify: unknown (rule: U1)  [reason: no active workflow, no referent — ambiguous]
[DEBUG] state: frozen (unknown classification) — awaiting clarification
```
**Assertion:** the runtime asks exactly one clarifying question and does not load anything.

---

## T6 — Multiple Chained Skills

**Initial state:** `idle` (empty session).
**Message:** "Build Student Registration with database migration and review."

**Scenario (Phase 2):** Skill discovery finds matching triggers for feature and database. Feature's `can_chain` lists `[database, review]`, but `review` does not exist yet in `.ai/skills/` — discovery only chains to existing skills. Chain computed as `[feature, database]`.

**Expected:**
```
decision: new_task
rule: R4
workflow: feature (created)
stage: first stage of feature
level: medium
load: skills:[feature, database]
chain: [feature, database]
reason: task spans feature and database domains
```

**Chain behavior:** When feature reaches Completed, database activates. When database reaches Completed, the chain is empty → archived. `review` joins the chain automatically once the Review skill is added — no router change required.

**Debug trace:**
```
[DEBUG] classify: new_task (rule: R4)  [reason: task spans feature and database domains]
[DEBUG] skills: chained [feature, database]
[DEBUG] workflow: feature idle → created
```

---

## T7 — Context Confidence — Sufficient

**Initial state:**
```
workflow: feature, status: active, stage: implement, level: medium,
files_inspected: ["src/components/Form.tsx"], skills_loaded: ["feature"],
objective: "Add validation to form"
```
**Message:** "Add validation to the form we just inspected."

**Expected:**
```
decision: continuation
rule: R1
workflow: feature (unchanged)
stage: implement (might advance to next sub-step)
load: nothing
```

**Confidence check:** Sources 1–2 (conversation + state) confirm the form file is already inspected. `confidence: sufficient`.

**Debug trace:**
```
[DEBUG] classify: continuation (rule: R1)
[DEBUG] confidence: sufficient (source: state — Form.tsx in files_inspected)
[DEBUG] context: none (confidence sufficient)
```
**Assertion:** exactly zero reads.

---

## T8 — Context Confidence — Insufficient, Ladder Order

**Initial state:**
```
workflow: bug-fix, status: active, stage: root-cause, level: medium,
files_inspected: [], objective: "Fix report crash"
```
**Message:** "The report says login fails."

**Expected:**
```
decision: continuation
rule: R1
workflow: bug-fix (unchanged)
stage: root-cause (unchanged)
load: context — ladder steps 1→2→3→4 until gap closes
```

**Confidence flow:**
1. Step 1: conversation + state → insufficient (no files seen yet).
2. Step 2: project memory (skip in Phase 1) → n/a.
3. Step 3: read current / named file → if report code is locatable, read it. If it closes the gap → stop.
4. Step 4: read related files (imports of the report file, login module) → if needed. At Medium level, step 4 is the ceiling.
5. If gap remains after step 4: transition to `waiting`, ask user.

**Debug trace (example):**
```
[DEBUG] classify: continuation (rule: R1)
[DEBUG] confidence: insufficient (source: no files inspected yet)
[DEBUG] context: src/pages/report.tsx (ladder step 3, budget: medium) — reason: file named in task
[DEBUG] confidence: sufficient (source: read report.tsx)
```
**Assertion:** no jump past step 4 at Medium level. Each read is recorded in `files_inspected`. Reads stop the moment confidence becomes sufficient.

---

## T9 — Token Optimization (Continuation after full load)

**Initial state:**
```
workflow: feature, status: active, stage: implement, level: medium,
files_inspected: ["src/pages/dashboard.tsx", "src/components/Table.tsx", "src/utils/format.ts"],
skills_loaded: ["feature"],
objective: "Build dashboard table"
```
**Message:** "Change the label to 'Save'."

**Expected:**
```
decision: continuation
rule: R1
workflow: feature (unchanged)
stage: implement (unchanged)
load: nothing
```

**Debug trace:**
```
[DEBUG] classify: continuation (rule: R1)
[DEBUG] confidence: sufficient (source: state — all context already loaded)
[DEBUG] context: none (confidence sufficient)
```
**Assertion:** zero reads, zero loads, zero re-plans, zero skill reloads. The absence of `[DEBUG] context:` and `[DEBUG] skills:` lines in the debug trace is itself an assertion.

---

## T10 — Workflow Preservation (Waiting → Active)

**Initial state:**
```
workflow: database, status: waiting, stage: plan, level: medium,
questions: ["confirm FK policy: cascade or restrict?"],
objective: "Design migration for user preferences table"
```
**Message:** "Use soft deletes."

**Expected:**
```
decision: continuation (answering open question)
rule: R1
workflow: database
stage: plan (unchanged — resume planning with new information)
level: inherited (medium)
load: nothing
```

**State transition:** `waiting → active`; `questions` cleared.

**Debug trace:**
```
[DEBUG] classify: continuation (rule: R1)  [reason: answers recorded question about FK policy]
[DEBUG] workflow: database waiting → active
[DEBUG] questions: resolved "confirm FK policy: cascade or restrict?"
```
**Assertion:** workflow resumes cleanly. No archival, no reload, no re-planning.

---

## T11 — New Task Forces Completion of Waiting Workflow

**Initial state:**
```
workflow: database, status: waiting, stage: plan,
questions: ["confirm FK policy"],
objective: "Design migration"
```
**Message:** "Build the attendance UI."

**Expected:**
```
decision: new_task
rule: R4
workflow: database waiting → completed → archived → feature created
```

**State:** Database workflow archived (with note: "archived incomplete — superseded"). Feature workflow created.

**Debug trace:**
```
[DEBUG] classify: new_task (rule: R4)
[DEBUG] workflow: database waiting → completed
[DEBUG] workflow: database completed → archived (reason: new_task — superseded)
[DEBUG] workflow: feature idle → created
```
**Assertion:** no workflow left in `waiting` state when superseded.

---

## Acceptance Criteria

1. All 11 test cases produce the exact expected decision record.
2. Zero reads occur for T1, T2, T9 (continuations and corrections with sufficient context).
3. No transition ever leaves a workflow `active` or `waiting` without a defined path to `completed` → `archived`.
4. Every New Task or Scope Change cleanly archives the current workflow before starting a new one.
5. Router decisions are fully reproducible from `session state + message` alone — no external dependencies.
6. T10 and T11 together prove the Waiting state is not an infinite state: it resolves or is superseded.
7. T8 proves ladder order is enforced (never skips steps, never exceeds ceiling).
8. Debug traces are deterministic: re-running the same test with the same state produces identical output.

### Phase Status

- **Phase 1 (Runtime):** PASSED. Router, state, and context modules verified against T1–T11 (T3/T4/T6 partial — no skills directory).
- **Phase 2 (Skills):** ACTIVE. `.ai/skills/` contains `feature`, `bug-fix`, `forensic`, `database`. T3, T4, and T6 are now fully executable. T6 exercises the dynamic discovery chain (`[feature, database]`).
- All tests above must pass before Phase 3 (Project Intelligence).

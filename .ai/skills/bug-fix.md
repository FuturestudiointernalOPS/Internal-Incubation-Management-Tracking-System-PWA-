---
# Metadata — drives router discovery and chaining.
# Chain links activate only if the target skill exists in .ai/skills/ and its triggers match.
name: Bug Fix
purpose: Resolve software defects.
trigger: [bug, error, crash, broken, defect, issue, fails, not working, fix]
workflow_weight: medium
can_chain: [review, database, forensic]
---

# Bug Fix — Resolve Software Defects

**Purpose**
Resolve software defects.

**Triggers**
Task describes a defect, failing behavior, or error. (The `trigger` metadata drives routing.)

**Workflow**
Stages execute in order. Never skip or reorder.

1. **Understand issue** — Reproduce or capture the failure. Record expected vs actual behavior. If no reproduction steps → ask.
2. **Locate affected code** — Follow the context ladder (`core/context.md`) to find where the observed behavior originates.
3. **Identify root cause** — Explain the failure mechanism with evidence. Never guess. If unconfirmable → Waiting, ask.
4. **Implement fix** — Smallest fix that addresses the root cause. Prefer existing patterns.
5. **Verify** — Re-run the failing scenario. Run the relevant build/tests. Confirm no regression.

**Stop Conditions**
- Root cause confirmed, fix applied, failing scenario passes → Completed → Archived.
- Root cause unconfirmed → Waiting (record what evidence is missing).
- Failure reveals an architecture problem rather than a defect → Scope Change candidate — report and ask.

**Output Template** (full template in Phase 4)
```
Bug Fix Report
- Symptom
- Root cause
- Fix applied
- Verification
```

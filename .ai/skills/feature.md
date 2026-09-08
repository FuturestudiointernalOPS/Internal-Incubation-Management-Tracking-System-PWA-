---
# Metadata — drives router discovery and chaining.
# Chain links activate only if the target skill exists in .ai/skills/ and its triggers match.
name: Feature
purpose: Implement new functionality.
trigger: [build, create, implement, add, feature, new feature, module, page, form, table]
workflow_weight: medium
can_chain: [database, review]
---

# Feature — Implement New Functionality

**Purpose**
Implement new functionality.

**Triggers**
Task asks for a new capability, module, page, form, or behavior. (The `trigger` metadata drives routing.)

**Workflow**
Stages execute in order. Never skip or reorder.

1. **Understand requirement** — Restate in one line. Note constraints, inputs, outputs. If ambiguous → Waiting, ask.
2. **Inspect existing implementation** — Follow the context ladder (`core/context.md`). Find the module and extension points. Never invent structure.
3. **Plan** — Name the files to touch and the change per file. Smallest change that satisfies the requirement.
4. **Implement** — Apply the plan. Prefer existing patterns, components, and utilities. Do not refactor beyond the requirement.
5. **Verify** — Check against the requirement. Run the relevant build/tests. Fix defects found; re-verify.

**Stop Conditions**
- Requirement met, verified, all checks pass → Completed → Archived.
- Blocked on missing information → Waiting (record the question in `questions`).
- Requirement impossible without inventing architecture → stop, report the constraint, ask.

**Output Template** (full template in Phase 4)
```
Implementation Report
- Requirement
- Files changed
- Approach
- Verification results
- Open questions
```

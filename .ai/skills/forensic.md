---
# Metadata — drives router discovery and chaining.
# Chain links activate only if the target skill exists in .ai/skills/ and its triggers match.
name: Forensic Investigation
purpose: Investigate incidents without making assumptions.
trigger: [investigate, investigate why, why did, disappeared, incident, forensic, logs, root cause analysis]
workflow_weight: heavy
can_chain: [database]
---

# Forensic — Investigate Incidents Without Assumptions

**Purpose**
Investigate incidents without making assumptions.

**Triggers**
Task asks to determine *why* something happened, or to investigate an incident. (The `trigger` metadata drives routing.)

**Golden rule:** Do not modify code unless explicitly requested.

**Workflow**
Stages execute in order. Never skip or reorder.

1. **Gather evidence** — Define the question. Collect reports, reproductions, timestamps. No assumptions.
2. **Inspect logs** — Follow the context ladder (`core/context.md`). Look for errors and events around the incident window.
3. **Inspect database** — If relevant: check state changes, records, timestamps.
4. **Review Git history** — If available: find the change that introduced the behavior.
5. **Build timeline** — Order events: what happened, when, and what changed.
6. **Determine root cause** — The only conclusion consistent with all evidence. Conflicting evidence → state the conflict; do not pick a side.
7. **Produce findings** — Report evidence, timeline, root cause, and confidence level.
8. **Recommend actions** — Suggest next steps. Implement code changes only if explicitly requested.

**Stop Conditions**
- Root cause determined with supporting evidence, findings delivered → Completed → Archived.
- Evidence insufficient → Waiting (record the missing evidence).
- User requests fixes → chain into bug-fix/feature only after explicit request.

**Output Template** (full template in Phase 4)
```
Forensic Report
- Incident
- Evidence gathered
- Timeline
- Root cause
- Confidence
- Recommended actions
```

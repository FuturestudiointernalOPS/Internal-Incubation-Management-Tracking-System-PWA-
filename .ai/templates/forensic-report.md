---
name: Forensic Report
purpose: Report an incident investigation.
used_by: forensic
---

# Forensic Report

**Purpose:** Standard output for incident investigation. Produced at the forensic skill's Completed stop condition.

**When to use:** After an investigation — never before evidence is gathered.

## Structure

```text
# Forensic Report — <incident>

## Incident
<What was observed, when, where.>

## Question
<The question being investigated, one line.>

## Evidence Gathered
- <source> — <fact>   (logs, DB state, git history, timestamps, files)

## Timeline
<Ordered events: what happened, when, what changed.>

## Root Cause
<The only conclusion consistent with all evidence.>

## Confidence
<high | medium | low> — <what would raise it>

## Alternatives Considered
<Hypotheses and why rejected.>

## Recommended Actions
<Next steps. Code changes only if explicitly requested.>
```

## Rules

- Evidence over assumption. Every claim traceable to a source.
- Conflicting evidence → state the conflict; do not pick a side.
- No code modified unless the user explicitly requested it.
- Never fabricate logs, timestamps, or history.

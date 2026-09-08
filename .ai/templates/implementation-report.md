---
name: Implementation Report
purpose: Report a completed feature or implementation.
used_by: feature
---

# Implementation Report

**Purpose:** Standard output for completed implementation work. Produced at the feature skill's Completed stop condition.

**When to use:** After implementing a feature/module. One report per completed task.

## Structure

```text
# Implementation Report — <task>

## Requirement
<One line: what was asked.>

## Files Changed
- <path> — <one-line purpose>

## Approach
<What was done and why. Name patterns/components reused.>

## Verification
<Commands run and results. Tests added/passed. What was NOT verified.>

## Deviations
<From the plan, if any, and why. "None" if none.>

## Open Questions
<Follow-ups, if any. "None" if none.>
```

## Rules

- Cite real file paths. No invented files.
- The Verification section reports only what was actually run.
- Never report invented APIs, database fields, or behavior.
- Keep to one page unless complexity demands more.

---
name: Bug Fix Report
purpose: Report a resolved defect.
used_by: bug-fix
---

# Bug Fix Report

**Purpose:** Standard output for resolved defects. Produced at the bug-fix skill's Completed stop condition.

**When to use:** After a defect is fixed and verified.

## Structure

```text
# Bug Fix Report — <issue>

## Symptom
<Expected vs actual behavior.>

## Reproduction
<Steps or scenario that triggered it.>

## Root Cause
<Evidence-based explanation of the failure mechanism.>

## Fix Applied
<Files changed and approach. Smallest fix that addresses the root cause.>

## Verification
<Failing scenario re-run. Build/tests run. Regression check.>
```

## Rules

- Root cause must be confirmed, not guessed (bug-fix skill stage 3).
- Report only verification that was actually run.

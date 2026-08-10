---
name: Review Report
purpose: Report a code review.
used_by: review
---

# Review Report

**Purpose:** Standard output for code review. Produced by the review skill — add `.ai/skills/review.md` to activate (see ADOPTION.md).

**When to use:** Reviewing an existing implementation or change.

## Structure

```text
# Review Report — <scope>

## Scope Reviewed
<Files or change reviewed.>

## Summary
<Overall assessment, 2–3 sentences.>

## Findings
### <Category: correctness | maintainability | readability | security | performance | type safety | architectural consistency>
- **<severity: blocker | major | minor | nit>** <path> — <issue> → <suggested fix>

## Positive Notes
<What is done well.>

## Verdict
<approve | approve with changes | needs rework>
```

## Rules

- Cite file paths for every finding.
- Distinguish objective issues from preferences.
- Measure against STANDARDS.md and PROJECT.md — never invent standards.

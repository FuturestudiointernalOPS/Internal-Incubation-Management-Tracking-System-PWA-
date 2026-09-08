---
name: Database Migration Plan
purpose: Plan a schema or migration change.
used_by: database
---

# Database Migration Plan

**Purpose:** Standard output for database changes. Produced at the database skill's Completed stop condition.

**When to use:** Before any schema/migration change. Also produced when the task is advisory (plan only).

## Structure

```text
# Database Migration Plan — <change>

## Change Summary
<What changes and why.>

## Schema Before → After
<Table/column-level diff. Name every table and column touched.>

## Constraints & Indexes
<Added, changed, or dropped. Name them.>

## Impact Analysis
<Who reads and writes the affected data. Breaking changes. Performance notes.>

## Migration Steps
<Ordered, idempotent (IF NOT EXISTS / IF EXISTS), gen_random_uuid, TIMESTAMPTZ.>

## Data Backfill
<If any: source → target mapping.>

## Rollback Plan
<How to revert safely.>

## Flags
<Destructive operations (DROP, data loss) — require explicit approval.>
```

## Rules

- Match the existing migration style (STANDARDS.md §6; unique migration numbers — MEMORY.md known issue #1).
- Never invent columns or tables; verify against `supabase/migrations/`.
- Every destructive step must be flagged for explicit approval.

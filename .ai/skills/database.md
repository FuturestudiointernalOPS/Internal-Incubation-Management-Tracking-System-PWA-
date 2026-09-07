---
# Metadata — drives router discovery and chaining.
# Chain links activate only if the target skill exists in .ai/skills/ and its triggers match.
name: Database
purpose: Handle schema, migrations, and database changes.
trigger: [database, schema, migration, table, column, foreign key, constraint, index, seed]
workflow_weight: medium
can_chain: [review]
---

# Database — Schema, Migrations, and Database Changes

**Purpose**
Handle schema, migrations, and database changes.

**Triggers**
Task involves the database: schema, tables, columns, relationships, migrations, or data. (The `trigger` metadata drives routing.)

**Workflow**
Stages execute in order. Never skip or reorder.

1. **Inspect schema** — Understand current tables, columns, types, constraints. Follow the context ladder (`core/context.md`).
2. **Review relationships** — Map foreign keys and referential behavior (cascade / restrict / set null). Ambiguity → ask.
3. **Evaluate impact** — Who reads and writes the affected data? What breaks if it changes?
4. **Review migrations** — Check existing migration patterns and order. Match them; never invent a new pattern.
5. **Recommend implementation** — Produce the migration plan. Apply changes only if explicitly requested.

**Stop Conditions**
- Plan produced, impact evaluated, and (if requested) applied and verified → Completed → Archived.
- Relationship or impact ambiguity → Waiting (record the question).
- Plan requires data loss or a destructive change → stop, report, get explicit approval first.

**Output Template** (full template in Phase 4)
```
Database Migration Plan
- Change
- Schema before → after
- Impact
- Migration steps
- Rollback
```

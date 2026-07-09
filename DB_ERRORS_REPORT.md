# Database Errors Report — Sprint 2

> Errors identified during testing on Sprint-2-Track-* branches.
> To be fixed by the engineering team.

---

## 1. `kpi_progress.kpi_name` NOT NULL violation

**Error:**
```
null value in column "kpi_name" of relation "kpi_progress" violates not-null constraint
```

**Root cause:** The `kpi_progress` table has a `kpi_name` column with a `NOT NULL` constraint, but the INSERT query in `src/lib/kpi-progress.js` does not include `kpi_name`. The query specifies `kpi_id, program_id, linked_sessions, ...` but omits `kpi_name`.

**Fix:** Either:
- Add `kpi_name` to the INSERT query (if the value is available in the code)
- OR remove the `NOT NULL` constraint from `kpi_name`

```sql
-- Option 1: Make kpi_name nullable
ALTER TABLE kpi_progress ALTER COLUMN kpi_name DROP NOT NULL;

-- Option 2: Add a default value
ALTER TABLE kpi_progress ALTER COLUMN kpi_name SET DEFAULT '';
```

**File(s):** `src/lib/kpi-progress.js` (INSERT into kpi_progress)

---

## 2. `v2_sessions.status` does not exist

**Error:**
```
column "status" does not exist
```

**Root cause:** The SQL query in `src/app/api/pm/programs/route.js` (line 86) references `WHERE status != 'archived'` and `CASE WHEN status = 'completed'` on the `v2_sessions` table, but this table has no `status` column.

**Current `v2_sessions` columns:** `id`, `program_id`, `week_number`, `type`, `title`, `teacher_id`, `start_at`, `created_at`

**Fix:** Either update the query to not reference `status`, or add the column to the table.

**File(s):** `src/app/api/pm/programs/route.js`

---

## 3. `error_logs.user_name` does not exist

**Error:**
```
column "user_name" of relation "error_logs" does not exist
```

**Root cause:** The code in `src/app/api/errors/route.js` inserts/updates the `user_name` column in `error_logs`, but it was never added to the table.

**Fix:**
```sql
ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS user_name TEXT;
```

**File(s):** `src/app/api/errors/route.js`, `src/lib/reportError.js`

---

## 4. `task_audit_logs` missing columns

**Error:**
```
column "user_id" of relation "task_audit_logs" does not exist
```

**Root cause:** The `task_audit_logs` table was created with `user_cid` instead of `user_id`, and is missing `field_name` and `metadata` columns. The code in `src/app/api/tasks/route.js` (INSERT at line 901) references these columns.

**Current `task_audit_logs` columns:** `id`, `task_id`, `user_cid`, `action`, `old_value`, `new_value`, `created_at`

**Fix:**
```sql
ALTER TABLE task_audit_logs ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE task_audit_logs ADD COLUMN IF NOT EXISTS field_name TEXT;
ALTER TABLE task_audit_logs ADD COLUMN IF NOT EXISTS metadata TEXT;
```

**File(s):** `src/app/api/tasks/route.js`

---

## 5. `v2_programs.materials` does not exist

**Error:**
```
column "materials" of relation "v2_programs" does not exist
```

**Root cause:** The INSERT in `src/app/api/pm/programs/route.js` references `materials` but the column doesn't exist in `v2_programs`. This column exists only at runtime (schema drift).

**Fix:**
```sql
ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS materials TEXT;
```

**File(s):** `src/app/api/pm/programs/route.js`, `src/app/admin/programs/new/page.js`

---

## 6. `v2_knowledge_bank.timestamp` does not exist

**Error:**
```
column "timestamp" does not exist (table: v2_knowledge_bank)
```

**Root cause:** The query `ORDER BY timestamp DESC` references a column that doesn't exist in `v2_knowledge_bank`.

**Current columns:** `id`, `title`, `description`, `url`, `is_archived`, `created_at`

**Fix:**
```sql
ALTER TABLE v2_knowledge_bank ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW();
```
Or replace `timestamp` with `created_at` in the query.

**File(s):** `src/app/api/knowledge/route.js`

---

## 7. `families.is_archived` does not exist

**Error:**
```
column "is_archived" does not exist (table: families)
```

**Root cause:** The query `ORDER BY is_archived ASC` references a column that doesn't exist in `families`.

**Fix:**
```sql
ALTER TABLE families ADD COLUMN IF NOT EXISTS is_archived INTEGER DEFAULT 0;
```

**File(s):** `src/app/api/families/route.js`

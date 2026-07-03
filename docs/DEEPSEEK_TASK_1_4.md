# DeepSeek work order — Sprint 01 / M1 / Ticket 1.4 — Task Assignment Workflow

Reply language: **English**. Codebase: Next.js (App Router), Postgres via `db.execute({ sql, args })` (Turso/libsql-style, `?` placeholders, `NOW()`/`CURRENT_TIMESTAMP`). Do **not** redesign UI. Reuse existing components/APIs/styles. Every user-facing string must exist in **English AND French**.

## Canonical model (do NOT invent a new one)

The accept/decline workflow already runs on the **`task_assignments`** table + route `src/app/api/tasks/assignments/route.js`. This is canonical. Task creation (`src/app/api/tasks/route.js` POST, ~L449) already inserts a pending `task_assignments` row when `assigned_to !== creator` and leaves `tasks.assigned_to = NULL` until acceptance. Keep this pattern. Do not touch the blocker/standup/audit code.

Assignment row shape used by existing code: `task_assignments(id, task_id, assigner_id, assignee_id, status, created_at, responded_at)`, `status ∈ {'pending','accepted','declined'}`.

---

## T1 — Create the missing migration (mechanical, flash)

`task_assignments` has **no CREATE statement anywhere** in the repo (it only exists ad-hoc in the live DB). Add a reproducible migration.

Create `src/migrations/005_task_assignments.sql`:

```sql
-- Task assignment workflow (Ticket 1.4). Idempotent.
CREATE TABLE IF NOT EXISTS task_assignments (
  id           SERIAL PRIMARY KEY,
  task_id      INTEGER NOT NULL,
  assigner_id  TEXT NOT NULL,
  assignee_id  TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','accepted','declined')),
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_task_assignments_assignee
  ON task_assignments (assignee_id, status);
CREATE INDEX IF NOT EXISTS idx_task_assignments_task
  ON task_assignments (task_id);
```

Do not run it. Just add the file.

**Acceptance:** file exists, valid SQL, `IF NOT EXISTS` everywhere.

---

## T2 — Route PATCH assignment through the pending workflow (judgment — follow exactly)

In `src/app/api/tasks/route.js`, the PATCH/PUT handler (~L698–741, block `// ─── ASSIGNMENT MANAGEMENT ───`) currently sets `assigned_to` **directly** when `assigned_to` changes. That violates the spec ("No task should automatically become another user's responsibility without acceptance").

Change: when `assigned_to !== undefined` **and** the new assignee is a real user **different from both the current `assigned_to` and the acting `user_id`**:
- Do **NOT** push `assigned_to` into `updateFields` (leave the task's `assigned_to` unchanged until acceptance).
- Instead insert a pending row (mirror the POST logic at ~L449):
  ```
  INSERT INTO task_assignments (task_id, assigner_id, assignee_id) VALUES (?, ?, ?)
  ```
  guard against duplicates: skip insert if a `pending` row already exists for that `(task_id, assignee_id)`.
- Send the existing "New Task Assignment" `v2_notifications` insert to the assignee (reuse the pattern from POST, not the inline `fetch` currently there).

Keep the existing behaviour for **un-assign** (new `assigned_to` falsy → clear directly, that's fine) and for **self-assign** (assignee === user_id → set directly, no pending needed).

**Acceptance:** assigning via edit no longer flips `tasks.assigned_to` immediately; a pending `task_assignments` row is created + assignee notified; un-assign still works; no regression to the standup/audit code around it.

---

## T3 — Reassignment (judgment — follow exactly)

Spec 1.4 requires **Reassignment** with history preserved. Add to `src/app/api/tasks/assignments/route.js` a `reassign` action in the POST handler.

Body: `{ assignment_id, action: "reassign", new_assignee_id }`.
Only the **assigner** (or a super_admin) may reassign. Logic:
1. Load the assignment; the old row stays in the table (history preserved — do NOT delete/mutate its assigner/assignee).
2. Mark the old row `status='declined'` **only if it was pending** (so it drops out of the old assignee's pending list). If it was already accepted, insert a new pending row without altering the accepted one, and clear `tasks.assigned_to` back to NULL.
3. Insert a new pending row `(task_id, assigner_id=<caller>, assignee_id=new_assignee_id)`.
4. Notify the new assignee ("New Task Assignment") via `v2_notifications`.

**Acceptance:** old assignment rows remain queryable (history), new assignee gets a pending assignment, only assigner/super_admin can reassign.

---

## T4 — Show assigner name, not raw id (mechanical, flash)

In `src/app/api/tasks/assignments/route.js` GET, the query returns `ta.*` only. Join the assigner's name so the UI can show it:

```
SELECT ta.*, t.title AS task_title, t.project_id,
       c.name AS assigner_name
FROM task_assignments ta
JOIN tasks t     ON ta.task_id = t.id
LEFT JOIN contacts c ON c.cid = ta.assigner_id
WHERE ...
```

Then in `src/app/developer/assigned-tasks/page.js` (~L196) replace the `User ${a.assigner_id.substring(0,8)}...` fallback with `a.assigner_name || 'Unknown'`.

**Acceptance:** pending card shows the assigner's real name.

---

## T5 — French translations (mechanical, flash)

All assignment-facing strings must exist EN + FR. Files: `src/translations/en.js` + `src/translations/fr.js` (mirror the existing structure/keys — inspect first, do not invent a new namespace).

Add keys for: "Assigned Tasks", "Pending Review", "You must accept or decline these assignments before they appear in your workload.", "Assigned by:", "Accept", "Decline", "No assigned tasks", "When someone assigns a task to you, it will appear here.", "New Task Assignment", "Assignment Accepted", "Assignment Declined".

Wire the strings in `src/app/developer/assigned-tasks/page.js` through the existing translation hook (check how sibling pages consume translations — reuse that exact mechanism; if the page currently hardcodes English, use the same `t()`/context the rest of the app uses).

**Acceptance:** switching app language to FR translates the assigned-tasks page + assignment notifications.

---

## Out of scope for you (Claude handles / later)
- Consolidating/removing the legacy `/api/tasks/assignment-action` route (G2) — leave it untouched.
- The project-mode-only assignee dropdown (G6) — do not change TaskManager UI this round.

## Global rules
- `--no-auto-commits`. After each batch, `git status`; do not stage unrelated files.
- Do not modify blocker, standup, carry-over, or audit-trail logic.
- Preserve backward compatibility. No new dependencies. No UI redesign.
</content>

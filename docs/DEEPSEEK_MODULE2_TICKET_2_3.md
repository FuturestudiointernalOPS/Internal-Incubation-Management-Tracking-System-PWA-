# DeepSeek Work Order — Module 2, Ticket 2.3 (Blocker Management)

**Model:** `deepseek-v4-pro` (judgment-level — a real auth bug + a DB migration + duplicated UI to extend, not mechanical).
**Reviewer:** Claude reviews every diff before merge. Do not push, do not merge — produce a diff for review.
**Spec source:** `docs/Sprint_1_Operations_OS_Engineering_Specification_v1.0.pdf`, pages 18-25 (Module 2 — Weekly Accountability). Business Rules 13-29, Ticket 2.3 acceptance criteria, Self-Testing Checklist. Treat the spec as ground truth over this document's paraphrase.

Context this builds on: Tickets 2.1 (Weekly Standup) and 2.2 (Weekly Retro) are already shipped (`src/app/staff/op-report/page.js`, `src/app/api/op-reports/route.js`, `src/app/api/tasks/route.js`). The real, live blocker backend is `src/app/api/blockers/route.js` + table `blockers` (Postgres, live schema confirmed below). Do not touch `src/app/api/standups/*` or `src/app/api/retros/*` — confirmed dead code, unreferenced by any live page, leave untouched.

---

## 0. Business Rules governing this ticket (verbatim from spec)

> 18. Blockers may only be created from within the Weekly Retro.
> 19. The Weekly Retro should present two primary actions for each task: Mark as Completed and Add Blocker.
> 20. Creating a blocker requires Title, Description, Priority, optional Reference URL, and Supporting Notes.
> 21. A task may have multiple blockers.
> 22. Only the blocker owner may resolve a blocker.
> 23. Users with administrative privileges may view and discuss blockers but may not resolve them.
> 24. A task with unresolved blockers cannot be completed.
> 25. If a parent task contains subtasks with unresolved blockers, the parent task cannot be completed.

Case study detail on the creation modal: *"A Blocker modal opens, capturing Blocker Title, Description, Priority, an optional Reference URL, and Supporting Notes."* Example: Title, Description, Priority: High, Reference URL: resend.com/domains, Notes: "Waiting for Infrastructure Team."

Resolution rule, stated explicitly in the case study: *"Only the user who originally created the blocker may resolve it. Super Admins, Project Managers, Department Heads, and Supervisors may all view blockers, comment, and assist, but may not resolve another user's blocker."*

---

## 1. Critical bug — fix first, this is a real authorization hole

File: `src/app/api/blockers/route.js`, `PUT` handler, ~line 208-229.

```js
const isBlockerCreator = !resolved_by || resolved_by === blocker.user_id;
const isTaskOwner = resolved_by && resolved_by === taskOwnerId;
if (!isBlockerCreator && !isTaskOwner) { /* 403 */ }
```

Two separate problems:

1. **`!resolved_by` makes `isBlockerCreator` true when `resolved_by` is simply omitted from the request body.** Any authenticated caller can resolve any blocker by sending `{ id, status: "resolved" }` with no `resolved_by` field. This bypasses Rule 22 entirely — it is not a theoretical edge case, it is the default behavior for a client that just forgets the field.
2. **The `isTaskOwner` fallback lets someone other than the blocker's creator resolve it**, directly contradicting Rule 22 ("only the blocker owner") and Rule 23 (explicitly: admins/supervisors "may not resolve another user's blocker" — the spec does not carve out an exception for task owners either).

**Fix:**
```js
if (!resolved_by || resolved_by !== blocker.user_id) {
  return NextResponse.json(
    { success: false, error: "Only the blocker creator can mark it as resolved" },
    { status: 403 },
  );
}
```
Remove the `isTaskOwner` branch and the `taskOwnerRes` query entirely — they're now dead. Keep the rest of the resolve logic (setting `resolved_at`, `resolved_by`, checking for remaining active blockers, reverting task to `in_progress`, audit log) unchanged.

---

## 2. Missing fields — DB migration + backend + both frontend forms

### 2.a Live schema today (confirmed via direct query against the Supabase DB)

```
blockers: id, task_id, user_id, user_name, title, description, severity, status, resolved_at, resolved_by, created_at
```

No `reference_url`, no notes/supporting-notes column. Rule 20 requires Title, Description, Priority, optional Reference URL, Supporting Notes. `title`/`description` already exist; `severity` already exists and can serve as "Priority" (values: low/medium/high/critical — confirm current options, keep the column name `severity`, just label it "Priority" in the UI, no need to rename the column). Missing: Reference URL and Supporting Notes.

**Migration required.** Add a new file `src/migrations/blocker_reference_notes.sql`:
```sql
ALTER TABLE blockers ADD COLUMN IF NOT EXISTS reference_url TEXT;
ALTER TABLE blockers ADD COLUMN IF NOT EXISTS notes TEXT;
```
This repo has no migration runner — every prior migration file in `src/migrations/` was applied by hand once, against the live DB, using `DATABASE_URL` from `.env.local`. Do the same here: write the `.sql` file for the repo record, then actually run it against the live database (a small Node script with the `pg` package and `DATABASE_URL` from `.env.local` works — same pattern used elsewhere in this project). Confirm with a follow-up `information_schema.columns` query that both columns exist before moving on. Do not skip the live-apply step — a migration file that only exists on disk and was never run against the database is not done.

### 2.b Backend: `src/app/api/blockers/route.js`, `POST` handler

Currently accepts `{ task_id, user_id, user_name, title, description, severity }`. Add `reference_url` and `notes` (both optional — spec says Reference URL is optional; Supporting Notes appears required in the modal description but not flagged "optional" like the URL is, so validate `title`, `description`, and `severity` as required at minimum, `reference_url` and `notes` optional — match the existing validation style already in this handler for `task_id`/`user_id`/`title`).

Insert them into the `INSERT INTO blockers (...)` statement. Also improve the Super Admin notification (currently references the task by raw numeric ID, not title, and doesn't include an explicit date — spec: *"The Super Admin receives a notification containing the user, task, blocker title, and date raised."*). Use `getTaskTitleById` from `src/lib/db/queries/tasks.js` (already used elsewhere in this codebase, e.g. `retros/submit`) to resolve the task's title for the notification message instead of the raw `task_id`.

### 2.c Frontend: two separate blocker-creation forms need the same fields added

There are two independent, duplicated "add blocker" inputs in this codebase — both currently only capture a single free-text field mapped to `title`, with no description/priority/URL/notes at all:

1. `src/components/tasks/TaskManager.js` — state `blockerTitle`, function `handleAddBlocker` (~line 375-392), input UI (~line 2107-2128).
2. `src/app/staff/op-report/page.js` — state `newBlockerModal`/`newBlockerDesc`, inline creation UI inside the blocker modal (~line 3470-3540 range, look for `newBlockerDesc` and the POST to `/api/blockers`).

**Do not build a new shared component from scratch** — extend each of these two forms in place with the same four additional fields: Description (textarea), Priority (select: Low/Medium/High/Critical, matching whatever `severity` values the backend already expects — check `src/app/api/blockers/route.js`'s default `"medium"` and any existing severity-to-color mapping in `TaskManager.js`/`op-report/page.js` for the exact value set before inventing new ones), Reference URL (optional url input), Supporting Notes (textarea). Keep both forms visually consistent with their surrounding UI (don't redesign the modal chrome, just add the missing fields inside it, per the "don't redesign the UI" instruction in the spec).

Also update the blocker **display** in both files — currently only `b.title` is rendered in the existing-blockers list. Add a way to see the description/priority/reference URL/notes for an existing blocker (can be a simple expand-on-click or just render them inline under the title — your call on the minimal UI that fits the existing visual style, but the data must be visible somewhere, not just captured and hidden).

---

## 3. Missing enforcement — parent task blocked by subtask's unresolved blocker (Rule 25)

File: `src/app/api/tasks/route.js`, `PUT` handler, completion check ~line 667-685:
```js
if (status === "completed") {
  const activeBlockers = await db.execute({
    sql: "SELECT id, title FROM blockers WHERE task_id = ? AND status = 'active'",
    args: [parseInt(id)],
  });
  ...
}
```
This only checks the task's **own** blockers. Rule 25: *"If a parent task contains subtasks with unresolved blockers, the parent task cannot be completed."* There is currently no check for blockers on a task's subtasks when completing that task as a parent.

**Fix:** when the task being completed has subtasks (i.e., it's a parent — check however `parent_task_id` relationships are already queried elsewhere in this file, e.g. the subtask-cascade block further down at ~line 928), also query for active blockers where `task_id IN (SELECT id FROM tasks WHERE parent_task_id = ?)`. If any exist, block completion the same way the direct-blocker check does — return the same shape of response (`hasActiveBlockers: true`, `blockers: [...]`) so the frontend fix from Ticket 2.2 (which already knows how to surface `hasActiveBlockers` responses) handles this case automatically without needing a frontend change. Combine both checks (own blockers + subtasks' blockers) into one response if both exist — don't make the frontend call twice.

Also re-examine the auto-complete-subtasks-when-parent-completes block (~line 928-932, `UPDATE tasks SET status = 'completed' ... WHERE parent_task_id = ?`). This currently force-completes every subtask when a parent completes, without checking each subtask's own blockers — which would be a contradiction if you've just made parent-completion conditional on subtasks having no active blockers (if the new check above passes, by definition no subtask has an active blocker at that moment, so this cascade becomes safe — but confirm that logic actually holds after your change, don't leave two blocker checks that can disagree with each other).

---

## 4. Explicitly out of scope — do not touch

- Rule 18 ("Blockers may only be created from within the Weekly Retro") — `TaskManager.js` is also used on `src/app/admin/projects/[id]/page.js` and `src/app/staff/projects/[id]/page.js`, where users can currently add blockers outside of Retro. **Do not remove that capability.** The Module 2 Definition of Done requires "existing functionality has been preserved" and removing a working feature from project pages is a product decision, not something to make unilaterally in this ticket. Just make sure wherever blocker creation happens, it uses the upgraded field set from §2.
- `src/app/api/standups/*`, `src/app/api/retros/*`, `src/app/developer/retro/page.js` — dead code, confirmed unreferenced, leave alone.
- Tickets 2.4 (Carry-over), 2.5 (Weekly Reports), 2.6 (Operational Metrics) — separate tickets, not this work order.

---

## 5. i18n (Business Rule 29)

Every new label/placeholder/validation message you add (Description, Priority, Reference URL, Supporting Notes, and any new error text) must use `t("namespace.key")` with real entries added to both `src/locales/en/*.json` and `src/locales/fr/*.json`. Check `src/locales/en/staff.json` / `fr/staff.json` first (`opReport.*` namespace already has blocker-related keys from the 2.2 work — reuse the namespace, don't create a parallel one) and whatever namespace `TaskManager.js` currently draws from for its existing blocker strings.

---

## 6. End-to-end test plan — run against local dev, report actual results

Use `staff1@impactos.staging` / `ImpactOS2026!`.

1. Run the migration against the live DB, confirm both new columns exist via a schema query.
2. From Weekly Retro, click Add Blocker on a task. Confirm the modal/form now shows Title, Description, Priority, Reference URL (optional), Supporting Notes. Submit with all fields filled — confirm the created blocker persists `reference_url` and `notes` (check via `GET /api/blockers?task_id=...`).
3. Submit with Reference URL left empty — confirm it still succeeds (optional field).
4. Try to resolve a blocker as a *different* user than its creator (simulate by calling `PUT /api/blockers` with `resolved_by` set to some other user id, or omitted entirely) — confirm you now get a 403 in both cases, not a silent success. This is the critical regression test for §1.
5. Resolve as the actual creator — confirm it succeeds, task reverts to `in_progress` when it was the last active blocker.
6. Create a parent task with a subtask, add an active blocker to the subtask only (not the parent), attempt to complete the parent — confirm it's blocked and the blocker is surfaced (reusing the Ticket 2.2 UI), not silently rejected or silently allowed.
7. Resolve the subtask's blocker, retry completing the parent — confirm it now succeeds.
8. Confirm existing "Add Blocker" on `staff/projects/[id]` and `admin/projects/[id]` still works (regression check per §4).
9. Run `npm run build` — must pass with no errors.

Report actual output for each step — not "should work."

---

## 7. Definition of done

- [ ] Resolve-authority bug fixed: omitted `resolved_by` no longer grants resolution; only exact creator match succeeds; `isTaskOwner` bypass removed.
- [ ] `blockers` table has `reference_url` and `notes` columns, live in the actual database (not just the migration file).
- [ ] Both blocker-creation forms (`TaskManager.js`, `op-report/page.js`) capture and persist Title, Description, Priority, optional Reference URL, Supporting Notes.
- [ ] Blocker display surfaces the new fields somewhere, not just the title.
- [ ] Parent task completion blocked when any subtask has an active blocker; response shape matches the existing `hasActiveBlockers` contract so Ticket 2.2's UI handles it without changes.
- [ ] Super Admin notification on blocker creation includes task title (not raw ID) and reads clearly with a date.
- [ ] Existing blocker creation on project pages still works (not removed).
- [ ] All new strings use `t()` with real en/fr entries.
- [ ] `npm run build` passes.
- [ ] E2E plan in §6 executed with real results reported.

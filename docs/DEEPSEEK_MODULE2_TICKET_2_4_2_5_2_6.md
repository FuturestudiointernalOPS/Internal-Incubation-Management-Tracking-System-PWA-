# DeepSeek Work Order — Module 2, Tickets 2.4 (Carry-over), 2.5 (Weekly Reports), 2.6 (Operational Metrics)

**Model:** `deepseek-v4-pro` for §1 (Carry-over — it's a real data-loss bug fix, judgment required). `deepseek-v4-flash` is fine for §2/§3 (mostly additive, lower-risk extension work) if you want to split the batches; otherwise run everything on `-pro`.
**Reviewer:** Claude reviews every diff before merge. Do not push, do not merge — produce a diff for review.
**Spec source:** `docs/Sprint_1_Operations_OS_Engineering_Specification_v1.0.pdf`, pages 18-25. Business Rules 13-29, Tickets 2.4/2.5/2.6 acceptance criteria, Self-Testing Checklist.

Builds on: Tickets 2.1/2.2/2.3 already shipped. Live implementation surface is `src/app/staff/op-report/page.js` (~3700 lines), `src/app/api/tasks/route.js`, `src/app/api/blockers/route.js`, `src/app/api/op-reports/route.js`, `src/app/api/admin/analytics/route.js`. `src/app/api/standups/*`, `src/app/api/retros/*`, `src/app/developer/retro/page.js` remain confirmed dead code — do not touch.

---

## §1 — Ticket 2.4: Carry-over Tasks (fix a real data-loss bug)

### The problem, concretely

Business Rule 27 + the case study: *"every unfinished task from the previous week automatically appears as a Carry-over Task — preserving its subtasks, assignment, comments, attachments, history, and blockers."*

There are **two separate places** in `src/app/staff/op-report/page.js` that carry a task forward, and **both clone the task into a brand-new row** (`POST /api/tasks` with a new id, tagging `carried_over_from_task_id` back to the old one) instead of preserving the same task:

1. The per-task **"Continue" button** (~line 3292-3327): `PUT` old task to `status: "carried_over"`, then `POST` a new task cloning only `title, description, project_id, category, status, start_date, end_date`. It does not touch subtasks, blockers, comments, resources, or `assigned_to` at all.
2. The **"Create Weekly Standup" pre-fill flow** (~line 545-589, `handleSubmit` for `reportType === "standup"`): for rows flagged `is_carryover: true`, it also `POST`s a brand-new task per carried-over row. This path does re-parent cloned subtasks to their newly-cloned parent within the same batch (via `idMapping`), but still does not migrate blockers, comments, resources, or `assigned_to`.

Because `blockers.task_id`, `v2_task_comments.task_id`, and `task_resources.task_id` all point at the **old** task id, and that old task now sits in `status = 'carried_over'` — a real "closed" status — a task carried forward loses every blocker, comment, and attachment it had, silently, with no error and no warning to the user. This is a data-loss bug in a live workflow, not just a spec-compliance gap.

`tasks` table also has an `assigned_to` column, `priority`, and `link` columns that neither clone payload includes — assignment and priority are silently dropped too.

### The fix

Don't invent a new UI. Add one shared, transactional operation — a small helper (a new function in `src/lib/db/queries/tasks.js`, following that file's existing "pure extraction, SQL byte-identical" pattern, or a new `POST /api/tasks/carry-over` route if you'd rather keep it server-side and callable from both UI spots — your call, but **do not implement the logic twice**) that does, for one task id:

1. Clone the task row (keep the full existing field set from both current clone payloads, and add the ones currently missing: `assigned_to`, `priority`, `link`) into a new row for the target week/year, `carried_over_from_task_id` = old id.
2. `UPDATE blockers SET task_id = <newId> WHERE task_id = <oldId>`
3. `UPDATE v2_task_comments SET task_id = <newId> WHERE task_id = <oldId>`
4. `UPDATE task_resources SET task_id = <newId> WHERE task_id = <oldId>`
5. For subtasks: `UPDATE tasks SET parent_task_id = <newId> WHERE parent_task_id = <oldId>` — this replaces the ad-hoc `idMapping` re-parenting currently only present in the standup pre-fill path; the "Continue" button path currently does nothing for subtasks at all, so this also fixes that path.
6. Set the old task's status to `carried_over` (already done in the button path; add it to the standup pre-fill path too if missing).

Wrap steps 1-6 in a single transaction if the `db` wrapper supports one (check `src/lib/db.js` — if there's no transaction helper, at minimum perform the writes in that order and log clearly on partial failure; don't leave it silently half-migrated).

Replace both existing call sites (the "Continue" button's two `fetch` calls, and the standup pre-fill loop's per-row `POST`) to go through this one shared operation instead of duplicating the clone-and-forget logic.

### What "automatic" means here (Rule 27)

The pre-fill-on-"Create Weekly Standup" path already surfaces unfinished tasks from the previous week without the user having to search for them — that satisfies "automatically appears" reasonably well within this app's existing "Create Weekly Standup" gesture (Rule 13 already requires one explicit action to start a new week; carry-over riding on that action, rather than firing with zero user action at all, is consistent with the existing architecture and is not something to redesign here). Just make sure both paths use the fixed, non-data-losing operation from above.

---

## §2 — Ticket 2.5: Weekly Reports

The "Weekly Summary" tab in `src/app/staff/op-report/page.js` (`reportType === "summary"`, roughly lines 2260-3110) is already a substantial, mostly-complete implementation: it computes planned/completed/carried-over counts, blocker created/resolved/active counts, a full task table, a blockers section, carry-over section, and a per-project breakdown — all derived live from `tasks`/`blockers`/`projects.assignments`, which already satisfies Rule 26 ("no duplicate data entry" — nothing here is manually re-typed).

**Your job is verification + gap-filling, not a rewrite.** Check the existing tab against each Ticket 2.5 sub-requirement and fix only what's actually missing:

- Weekly Summary — present (Phase 1 card, ~line 2269-2370).
- Completed Tasks — present (task table, filterable by status — confirm it's clearly distinguishable, not buried).
- Outstanding Tasks — confirm the existing task table actually surfaces *not-yet-completed* tasks distinctly (not just a flat list) — if it's not visually separated from completed ones, add that distinction; don't rebuild the table.
- Blockers — present (~line 2663+).
- Carry-over — present (~line 2875+).
- Productivity Summary — check whether there's an actual "productivity" framing (e.g., completion rate for the week, tasks/day) or just raw counts. If it's only raw counts with no rate/summary framing, add a small productivity line (e.g., completion percentage for the week) reusing the same numbers already computed in the Phase 1 card — don't fetch anything new for this.

Confirm historical weeks remain viewable through this tab (navigate `weekInfo` to a past week, confirm the summary recomputes correctly for that week rather than always showing the current week) — this is how "historical reports preserved" (Rule 26 / Ticket 2.5 AC) is satisfied in this architecture: reports are recomputed on demand from immutable historical task/blocker data, not stored as separate frozen snapshots. That's an acceptable, existing pattern — don't build a snapshot-storage system, just confirm the recompute-from-history path actually works for arbitrary past weeks.

i18n: this tab already uses `t()` extensively — if you add or change any label (e.g. the productivity line), use the existing `staff.opReport.*` namespace and add real `en`/`fr` entries, same as prior tickets.

---

## §3 — Ticket 2.6: Operational Metrics

`src/app/api/admin/analytics/route.js` already computes, across ALL users/all time: task status breakdown, blocker status breakdown, `completionRate`, `carryoverRate`, active-user count, and current-week standup/retro submission counts. Consumed by `src/app/admin/projects/page.js`.

Missing against Ticket 2.6's explicit list (Completion Rate ✓ already there, Carry-over Rate ✓ already there):

1. **Blocker Rate** — not present. Add a meaningful rate, not just the raw counts already returned: e.g. `blockerRate = blockers.total > 0 ? round(blockers.active / blockers.total * 100) : 0` (percentage of all blockers ever raised that are still unresolved), computed the same way `carryoverRate` already is in this file — follow that exact pattern.
2. **Resolution Time** — not present at all. Add average blocker resolution time: `SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)))::int AS avg_resolution_seconds FROM blockers WHERE status = 'resolved'`. Return it in a unit that makes sense for a dashion (hours, e.g. `Math.round(avg_seconds / 3600)`), not raw seconds.
3. **Weekly Productivity (trend)** — this endpoint is a single all-time snapshot with no per-week breakdown. Add a per-week series for at least the last 8 weeks: tasks completed per week, grouped by `created_week`/`created_year` (or `completed_at` if that's more accurate for "when was it actually finished" — check which makes more sense given `completed_at` already exists as a column and is more accurate than `created_week` for a *productivity* metric specifically). Return as an array the frontend can plot, e.g. `[{ week, year, completed }, ...]`.

Extend `src/app/admin/projects/page.js` (wherever it currently renders the existing analytics fields) to display these three new metrics — reuse whatever stat-card/chart pattern is already there for `completionRate`/`carryoverRate`, don't introduce a new visual language for just these three.

This route is already gated `requireAuth(["super_admin"])` — leave that as-is, don't broaden or narrow it.

---

## §4 — Explicitly out of scope

- `src/app/api/standups/*`, `src/app/api/retros/*`, `src/app/developer/retro/page.js` — dead code, leave alone.
- Any change to how blocker creation/resolution works (Ticket 2.3, already shipped) beyond the FK-migration needed for carry-over in §1.
- Building a persisted/frozen "report" storage layer for §2 — recompute-on-demand is the existing, intentional pattern here.

---

## §5 — i18n (Rule 29)

Any new label you add (§2's productivity line, §3's new metric labels in the admin page) must use `t()` with real `en`/`fr` entries in the appropriate existing namespace (`staff.opReport.*` for §2, whatever namespace `admin/projects/page.js` already draws from for its analytics section for §3).

---

## §6 — End-to-end test plan

Use `staff1@impactos.staging` / `ImpactOS2026!` for §1/§2, `superadmin@impactos.staging` / `ImpactOS2026!` for §3.

1. Create a task with a blocker, a comment, and a file attachment. Carry it over via the "Continue" button. Confirm: the new (current-week) task has the same blocker, comment, and attachment attached (query `GET /api/blockers?task_id=<newId>`, and whatever endpoints back comments/resources) — and the *old* task now has none of them.
2. Create a parent task with a subtask, both unfinished. Trigger carry-over via "Create Weekly Standup" pre-fill for a new week. Confirm the new week's cloned parent and cloned subtask are correctly re-linked (`parent_task_id` on the new subtask points at the new parent, not the old one).
3. Confirm a task with `assigned_to` set retains that assignment after carry-over.
4. Open Weekly Summary for the current week — confirm Completed/Outstanding/Blockers/Carry-over/Productivity all show sensible data. Navigate to a past week's summary — confirm it recomputes correctly for that week, not the current one.
5. As super admin, `GET /api/admin/analytics` — confirm response now includes `blockerRate`, `avgResolutionHours` (or whatever you name it), and a weekly productivity array with at least a few weeks of data (seed more completed tasks across different weeks if the test data doesn't already span multiple weeks).
6. Confirm the admin page renders the three new metrics without layout breakage.
7. `npm run build` — must pass.

Report actual output for each step.

---

## §7 — Definition of done

- [ ] Carry-over no longer loses blockers, comments, attachments, or assignment — verified via §6.1-6.3, not assumed.
- [ ] Both carry-over trigger points (button + standup pre-fill) go through one shared operation, not duplicated logic.
- [ ] Weekly Summary tab confirmed to cover all six Ticket 2.5 sub-sections; gaps filled without a rewrite.
- [ ] `/api/admin/analytics` returns blocker rate, average resolution time, and a weekly productivity series.
- [ ] Admin page displays the three new metrics.
- [ ] New strings use `t()` with real en/fr entries.
- [ ] `npm run build` passes.
- [ ] E2E plan in §6 executed with real results reported, not "should work."

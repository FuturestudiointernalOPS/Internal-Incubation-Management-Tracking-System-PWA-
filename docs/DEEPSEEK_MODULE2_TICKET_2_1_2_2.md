# DeepSeek Work Order — Module 2, Tickets 2.1 (Weekly Standup) + 2.2 (Weekly Retro)

**Model:** `deepseek/deepseek-v4-pro` (judgment-level task — UX/business-logic gaps, not mechanical). Pass `--chat-language English`.
**Reviewer:** Claude will review every diff before merge. Do not push, do not merge — produce a diff for review.
**Spec source:** `docs/Sprint_1_Operations_OS_Engineering_Specification_v1.0.pdf`, pages 18-25 (Module 2 — Weekly Accountability). Business Rules 13-29 quoted below where relevant — treat them as ground truth, not this document's paraphrase.

---

## 0. Mandatory context — read before touching anything

The spec says: *"This module already exists within the platform. Your responsibility is not to redesign the workflow... Extend existing functionality rather than rebuilding it. Do not redesign the user interface. Reuse existing pages, components, APIs, services, and database structures."*

**The real, live implementation is `src/app/staff/op-report/page.js` (~3600 lines).** It handles both Weekly Standup and Weekly Retro as two tabs (`reportType` state = `"standup"` | `"retro"` | `"summary"`), backed by `src/app/api/op-reports/route.js` (table `v2_op_reports`, discriminated by `report_type` column), plus `src/app/api/tasks/route.js` and `src/app/api/blockers/route.js`.

**Do NOT touch or build on these — they are dead code, unreferenced by any live page, confirmed via full-repo grep:**
- `src/app/api/standups/current/route.js`
- `src/app/api/standups/submit/route.js`
- `src/app/api/retros/current/route.js`
- `src/app/api/retros/submit/route.js`
- `src/app/developer/retro/page.js`

They look like a plausible second implementation and it is easy to accidentally "fix" them thinking they're in scope. They are not wired to any navigation link or live route. Leave them untouched — deleting them is a separate cleanup decision for later, not part of this ticket.

**One more live file in scope:** `src/app/developer/standup/page.js` (~730 lines). This is the page currently shown to the `developer` role. It only implements Standup — there is no Retro tab anywhere in the developer role's navigation, meaning Ticket 2.2 is entirely unimplemented for that role today.

---

## 1. Decision already made (do not re-litigate)

Instead of building a second Retro implementation for the `developer` role, **the `developer` role will be routed to the exact same `/staff/op-report` page** used by `staff`. This is the reuse-faithful choice per the spec's explicit instruction.

**Required changes:**
1. In `src/components/dashboard/UnifiedDashboard.js` and `src/components/layout/DashboardLayout.js`, find every place that routes `role === "developer"` to `/developer/standup` and change the target to `/staff/op-report` (same query params pattern already used for staff, e.g. `?tab=standup` / `?tab=retro` if present — check `DashboardLayout.js` lines ~347-348, ~540-542, ~997 and `UnifiedDashboard.js` lines ~850, ~971-972, ~1093, ~1130 for the exact conditional branches).
2. Turn `src/app/developer/standup/page.js` into a redirect, not a deletion (preserves old bookmarks/deep links): replace its contents with a minimal client component that calls `router.replace("/staff/op-report")` on mount. Do not delete the file or the route.
3. Verify `/api/op-reports` and `/api/tasks` have no `role === "staff"`-only gating that would reject a `developer` user (checked already: `requireAuth()` on those routes has no role restriction — confirm this is still true after your changes, don't introduce one).

---

## 2. Ticket 2.1 — Weekly Standup

File: `src/app/staff/op-report/page.js`

### 2.1.a — Already working, do not change
- One Weekly Standup per week + duplicate prevention: `hasCurrentWeekStandup` check (~line 981) already disables/hides the create button when a standup exists for the current week. **Leave this logic as-is.**
- Auto-reopen current week: `weekInfo` state initializes to `getCurrentWeek()` and `fetchReport()` loads it on mount. **Leave this logic as-is.**

### 2.1.b — Bug to fix: previous Standups are NOT read-only

Business Rule 28: *"Historical Weekly Standups and Weekly Retros become read-only."* Ticket 2.1 acceptance criterion: *"Previous Standups are read-only."*

Currently, in the Standup history table (~line 1128 onward), each past week's row has a button labeled **"Edit Standup"** (~line 1281, hardcoded English) which calls `setWeekInfo({week: report.week_number, year: report.year})`, populates `taskRows` from that week's tasks, and opens `showStandupModal` — the exact same editable modal used for the current week. There is no check anywhere comparing `report.week_number/report.year` against the current operational week before allowing this. A user can fully edit and resubmit a closed week's standup.

**Fix:** Before opening the modal for a past week, determine if `report.week_number === currentWeek.week && report.year === currentWeek.year`. If it is NOT the current week:
- Open the modal/view in a read-only mode: disable all inputs, hide "Add Task" / "Save" / "Submit" controls.
- Change the button label from "Edit Standup" to a "View" label (use i18n — see §4).
- Do not call any mutating endpoint (`POST /api/op-reports`, `POST /api/tasks`, `PUT /api/tasks`) while in this read-only mode.

If a `readOnly` prop/flag doesn't already exist on the relevant modal/form component, add one (simple boolean, threaded through to disable inputs and hide action buttons — do not build a separate second modal component, extend the existing one).

---

## 3. Ticket 2.2 — Weekly Retro

File: `src/app/staff/op-report/page.js`

### 3.1 — Critical bug: task completion fails silently when blockers are active

Spec (case study): *"Sarah selects Mark as Completed. The system first checks for unresolved blockers. If none exist, the task completes immediately. If blockers remain, the system displays each one and asks the user to confirm whether it has been resolved. If any blocker remains unresolved, the task cannot be completed."*

Business Rule 24: *"A task with unresolved blockers cannot be completed."*

The backend already enforces this correctly: `PUT /api/tasks` (`src/app/api/tasks/route.js`, ~line 667) checks for active blockers on the task and, if any exist and `force_complete` was not passed, returns:
```json
{ "success": false, "error": "This task has active blockers. Please confirm completion or resolve the blocker before proceeding.", "hasActiveBlockers": true, "blockers": [...] }
```
(This used to crash with an unhandled exception due to a double `req.json()` read — already fixed by Claude, build verified clean. Not your job to touch this backend logic.)

**The frontend never reads this response.** The Retro tab's per-task completion toggle (the round checkbox button, ~line 1750-1836) does:
```js
await fetch("/api/tasks", { method: "PUT", ... body: JSON.stringify({ id: task.id, status: newStatus }) });
fetchTasks();
```
It never checks `data.success` or `data.hasActiveBlockers`. Result: clicking complete on a blocked task spins, silently does nothing (task stays incomplete), and the user gets zero explanation. This directly fails Ticket 2.2's acceptance criterion "Completion workflow operational."

**Fix required:**
1. Parse the JSON response from the `PUT /api/tasks` call.
2. If `data.success === false && data.hasActiveBlockers`, do not treat this as an error toast-and-forget. Surface the blockers returned in `data.blockers` to the user — reuse the existing blocker modal/UI already present on this page (`blockerModal` state, ~line 3400+) rather than building a new one. The user must be able to see the blocker title(s) and get to the resolve action from there.
3. Only after the user has resolved the blocker(s) (via the existing `PUT /api/blockers` resolve action already on this page) should a retry of the completion succeed naturally (no active blockers left → backend allows it). Do not silently pass `force_complete: true` to bypass this — that would violate Business Rule 24. `force_complete` exists in the API for a deliberate "confirm anyway" UX the spec allows for edge cases, but the default path here must respect the block.
4. Apply the identical fix to the subtask cascade-completion call in the same handler (~line 1777-1801, `Promise.all(task.subtasks.map(...))`) — each subtask PUT must also be checked, not fired-and-forgotten.

### 3.2 — Dead code to remove

`reconciledTasks` state (declared `useState({})` at ~line 188) and its setter `setReconciledTasks` are never called anywhere in the file. The block in `handleSubmit` (~lines 624-650) that reads `Object.entries(reconciledTasks)` is therefore unreachable — it always sees an empty object and never executes. This is dead code masquerading as working reconciliation logic.

**Fix:** Remove the dead block (~lines 624-650) and the unused `reconciledTasks` state declaration. The real, working completion mechanism is the per-task checkbox button fixed in §3.1 — do not try to revive or repurpose the dead block, just delete it. If removing it changes indentation/control flow of the surrounding `if (data.success)` block, keep the rest of that block (`notify(...)`, `fetchReport()`, `fetchHistory()`, `fetchTasks()`) intact.

### 3.3 — Already working, do not change
- Weekly tasks/subtasks displayed automatically in Retro: tasks are filtered by `created_week`/`created_year` matching the report's week (~line 1604), subtasks rendered nested. **Leave as-is.**
- Standup data reflected correctly in Retro: both tabs key off the same `week_number`/`year` and the same `tasks` table. **Leave as-is.**

### 3.4 — Do NOT do (out of scope, belongs to Ticket 2.3)
- Do not rebuild the blocker creation modal fields (Title/Description/Priority/Reference URL/Supporting Notes per Business Rule 20). The current modal only captures a single free-text title. This is real, but it's Ticket 2.3 (Blocker Management) scope, owned separately — leave `src/app/api/blockers/route.js` and the blocker-creation form fields untouched.
- Do not implement the parent-task-blocked-by-subtask-blocker check (Business Rule 25). Confirmed missing in `src/app/api/tasks/route.js` (the completion check at ~line 667 only looks at the task's own blockers, not its subtasks' blockers) — this is explicitly a Ticket 2.3 acceptance criterion, not 2.1/2.2. Flag it in your summary but do not fix it.
- Do not touch the blocker-resolution authority logic in `src/app/api/blockers/route.js` (who can resolve) — also Ticket 2.3 scope.

---

## 4. i18n — mandatory for every string you touch (Business Rule 29)

Every user-visible string in code you modify must use `t("namespace.key")`, with a matching key added to **both** `src/locales/en/*.json` and `src/locales/fr/*.json`. Check `src/locales/en/staff.json` / `src/locales/fr/staff.json` first — most `op-report` page strings already live under the `staff.*` namespace, reuse it. Specific hardcoded strings you will encounter while making the above fixes (non-exhaustive — audit the surrounding lines you touch too):
- `"Create New Standup"` (~line 1101)
- `"Edit Standup"` (~line 1281) — becomes conditional Edit/View label per §2.1.b
- Any new label/message you add for the blocker-surfacing UX in §3.1 (e.g. "This task has active blockers", "Resolve blocker to continue") — do not hardcode, add proper `en`/`fr` keys.

Do not do a blanket i18n sweep of the entire 3600-line file — that's a much larger, separate task. Only the strings in code paths you actually modify for this ticket.

---

## 5. End-to-end test plan (run against local dev server, report actual results — do not assume)

Use staging test users (from project CLAUDE.md): `staff1@impactos.staging` / `ImpactOS2026!` and `developer@impactos.staging` / `ImpactOS2026!`, password same for both.

**Standup (2.1):**
1. Log in as staff1. If no standup exists for current week, "Create New Standup" is visible and enabled. Create one.
2. Reload the page. Button is now disabled/hidden; the just-created standup's data loads automatically (auto-reopen).
3. Attempting to create a second standup for the same week must be blocked (button disabled, or if forced via direct API call, `/api/op-reports` upsert must update not duplicate — this already works, just confirm).
4. Open a *previous* week's standup from the history table (needs a fixture with a past week — create one with a manually adjusted `week_number` if needed, or use an existing seeded row). Confirm: fields are disabled, no save/submit control usable, label says "View" not "Edit".
5. Log in as developer. Confirm landing on `/staff/op-report` (not `/developer/standup`), and standup tab behaves identically to steps 1-4.

**Retro (2.2):**
6. As staff1, with a task that has NO blockers: open Retro tab for the current week, click the completion toggle. Task marks completed, UI reflects it, no errors.
7. Create a task, add a blocker to it via the existing blocker action, then try to mark that task completed from Retro. Confirm: task is NOT marked completed, and the UI now shows the blocker(s) to the user (not a silent no-op, not a raw JSON error, not a 500).
8. Resolve the blocker via the existing resolve action, then retry marking the task completed. Confirm it now succeeds.
9. Repeat step 5's role check for Retro: developer role reaches the same Retro tab at `/staff/op-report?tab=retro` (or however the tab param works) and sees the same behavior as staff.
10. Regression: confirm Weekly Standup workflow (steps 1-4) still passes after your Retro changes — same file, don't let one break the other.
11. Run `npm run build` — must complete with no errors before you consider this done.

Report actual console output / screenshots / API responses for each step, not "should work."

---

## 6. Definition of done for this work order

- [ ] Developer role routed to `/staff/op-report`; `/developer/standup` redirects there without breaking old links.
- [ ] Past-week Standups are genuinely read-only (inputs disabled, no mutating call possible).
- [ ] Retro completion toggle surfaces active-blocker responses to the user instead of failing silently; works for both direct task completion and subtask cascade.
- [ ] Dead `reconciledTasks` block removed.
- [ ] All touched strings use `t()` with real `en`/`fr` entries.
- [ ] `npm run build` passes.
- [ ] E2E test plan in §5 executed with real results reported, not assumed.
- [ ] No changes made to any file listed in §0 as dead code, and no changes made to the §3.4 out-of-scope items.

# Venture OS — Sprint 3, Track 3 (Venture Execution & Collaboration)

**Branch: `Sprint-3-Track-1`. Do NOT push to `dev` or `main`. Push only to `Sprint-3-Track-1` when done and locally tested.**

Covers Tickets **3.1-3.7** from the Sprint 3 Venture OS spec (pages 17-21): Venture Workspace, Venture Tasks, Weekly Standups, Weekly Retros, Venture Blockers, Venture Calendar, Venture Progress.

Depends on: Track 1 (`ventures`, `venture_members` — live), the Milestone/Action Plan schema from Track 2 (`venture_milestones`, `venture_action_plans` — live). Heavily reuses the existing Operations OS task engine — **do not build a second task system.**

## 0. MANDATORY — auth pattern

Same rule as every prior Venture OS batch: every route must check the caller is an active `venture_members` row for the `venture_id` in question (or a privileged role: `staff, program_manager, super_admin, developer`), else `404`. Use `getSession()` from `@/lib/auth`. This has been the #1 recurring bug across Track 1 and must not recur here. Reuse or import the shared helper if one already exists from Track 2 (`src/lib/ventureAuth.js` — check before writing a new one).

## 1. Schema — already migrated, do not modify shape

`src/migrations/venture_os_track3_execution.sql` already applied to the shared dev database.

```sql
-- Existing `tasks` table (Operations OS) gets a nullable venture_id:
ALTER TABLE tasks ADD COLUMN venture_id UUID REFERENCES ventures(id) ON DELETE SET NULL;
-- Existing `blockers` table (Operations OS) gets nullable venture_id + venture_retro_id:
ALTER TABLE blockers ADD COLUMN venture_id UUID REFERENCES ventures(id) ON DELETE SET NULL;
ALTER TABLE blockers ADD COLUMN venture_retro_id UUID REFERENCES venture_retros(id) ON DELETE SET NULL;

CREATE TABLE venture_standups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  year INTEGER NOT NULL,
  top_priorities TEXT,
  expected_deliverables TEXT,
  weekly_priorities TEXT,
  created_by TEXT REFERENCES contacts(cid),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(venture_id, week_number, year)
);

CREATE TABLE venture_retros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  year INTEGER NOT NULL,
  completed_tasks TEXT,
  outstanding_tasks TEXT,
  carry_forward_notes TEXT,
  created_by TEXT REFERENCES contacts(cid),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(venture_id, week_number, year)
);
```

Note on why standups/retros are new tables instead of reusing `v2_standups`/`v2_retros` directly: those existing tables are **per-user** weekly check-ins (columns are `user_id, week_number, year`, no project/team scoping). Business rules 28/29 require **one standup/retro per venture per week** (team-level, not per-person). Overloading the individual-scoped tables would break their existing Operations OS behavior, so `venture_standups`/`venture_retros` are new tables with the same field shape/spirit as their Operations OS counterparts. `tasks` and `blockers`, by contrast, are genuinely reusable as-is (they already support `parent_task_id` for subtasks, `assigned_to`, `status`) — just add `venture_id` to scope them, do not create `venture_tasks`/`venture_blockers` duplicate tables.

## 2. Business rules in scope (24-35 in the doc)

- Venture Tasks reuse the existing Operations OS task engine (`tasks` table, now venture-scoped via `venture_id`).
- Parent Tasks may contain multiple subtasks (`parent_task_id`, already exists).
- Team members must accept assigned tasks (check how `assigned_to` + acceptance currently works in the existing task routes — reuse that flow, don't invent a new "acceptance" status if one already exists).
- One Weekly Standup / one Weekly Retro exists per venture per week (`UNIQUE(venture_id, week_number, year)` already enforces this at the DB level — surface the resulting unique-violation as a clean 409, don't let it bubble as a raw 500).
- Blockers may only be created from the Weekly Retro (`venture_retro_id` must be set on creation — reject blocker creation with no `venture_retro_id`).
- Only the creator of a Blocker may mark it resolved (check `blockers.user_id === session.cid` before allowing a resolve action, same pattern as the existing Operations OS blocker resolution — check how that's enforced today in the existing blocker routes and mirror it exactly).
- Tasks with unresolved blockers cannot be completed; Parent Tasks cannot complete while child tasks remain blocked (check task-completion route for existing blocker-check logic and extend it to also cover venture-scoped tasks — same rule, same code path if possible).
- Incomplete tasks automatically carry forward into the following week's Standup (check how Operations OS carryover works today — `carried_over_from_task_id` column exists on `tasks`, reuse it).
- English and French required everywhere.

## 3. API

Reuse existing task/blocker route files if they already export handlers generic enough to add a `venture_id` filter — check `src/app/api/tasks/` and `src/app/api/blockers/` (or wherever they live) before writing new ones. Where existing routes are user/project-scoped only and can't cleanly take a `venture_id` filter, add new venture-scoped endpoints instead of hacking the shared ones:

- `GET /api/ventures/[id]/tasks` (list, optional `?status=` filter) + `POST /api/ventures/[id]/tasks` (create — sets `venture_id`) + reuse existing task update/complete/accept endpoints if they work generically by task id (they likely do — check).
- `GET /api/ventures/[id]/standups` (list by week) + `POST /api/ventures/[id]/standups` (create current week — 409 if one already exists for that venture+week).
- `GET /api/ventures/[id]/retros` (list by week) + `POST /api/ventures/[id]/retros` (create current week — 409 if duplicate).
- `GET /api/ventures/[id]/blockers` (list) + `POST /api/ventures/[id]/blockers` (create — requires `venture_retro_id`) + `PATCH /api/ventures/[id]/blockers` (body `{id, action: "resolve"}` — only the creator, else 403).
- `GET /api/ventures/[id]/calendar` — aggregation endpoint: union of venture tasks (with due dates), `venture_milestones` (target_date), and any venture-linked follow-ups, returned as a flat list of `{type, title, date}` items. Read-only, no new table.
- `GET /api/ventures/[id]/progress` — aggregation endpoint: task completion %, milestone progress avg, weekly standup/retro submission streak. Read-only, no new table.

Mutation access: any active venture member (founder or team_member) — same as Track 2, not founder-restricted.

## 4. UI

Extend `src/app/participant/ventures/[id]/page.js` with new tabs: **Tasks** (parent/subtask list, kanban-or-list is fine, assignment/accept/complete), **Standups** (current week form + history), **Retros** (current week form + carry-forward display + blocker creation entry point), **Calendar** (simple list/agenda view is enough, no need for a full calendar widget), **Progress** (task completion %, milestone avg, simple stat tiles — reuse whatever stat-tile component Module 2's admin dashboard already uses).

Reuse `useI18n()` for every string. Match existing dark-theme conventions (`bg-white/5`, CSS vars — do not reintroduce the opacity bug already fixed once).

## 5. i18n

Extend `src/locales/en/venture.json` / `fr/venture.json` (same namespace as Track 1/2) with `venture.tasks.*`, `venture.standups.*`, `venture.retros.*`, `venture.blockers.*`, `venture.calendar.*`, `venture.progress.*` — keys as needed for the UI above, mirror EN/FR.

## 6. Explicitly out of scope

- Do not modify existing Operations OS behavior for non-venture tasks/blockers/standups/retros — `venture_id IS NULL` rows must behave exactly as before.
- Track 4 (Documents), Track 5 (Coaching/KPIs) — other work orders.
- Investment Readiness / Venture Reports — Sprint 4, held back.

## 7. Self-testing checklist

- [ ] Create venture task with subtask → both scoped to `venture_id`, parent/child relationship works.
- [ ] Create second Standup for same venture+week → 409, not a raw 500.
- [ ] Create Retro, then create a Blocker referencing that retro's id → succeeds; attempt to create a Blocker with no `venture_retro_id` → rejected.
- [ ] Resolve a Blocker as its creator → succeeds; attempt as a different venture member → 403.
- [ ] Complete a task with an unresolved blocker → rejected; resolve blocker, then complete → succeeds.
- [ ] Complete a parent task while a child task is still blocked → rejected.
- [ ] Calendar endpoint returns tasks + milestones combined, sorted by date.
- [ ] **Auth**: non-member gets 404 on every new venture-scoped GET endpoint (curl-test with an unrelated participant account).
- [ ] Existing (non-venture) Operations OS tasks/blockers/standups/retros still work exactly as before (regression check — create/complete a plain non-venture task).
- [ ] EN/FR complete, no missing-key fallback text.
- [ ] `npm run build` passes clean.

## 8. Definition of done

Track 3 is complete when venture teams execute work through the same task engine as Operations OS (just venture-scoped), one standup/retro per venture per week is enforced, blockers can only originate from a retro and only their creator resolves them, task completion respects the blocker-lock rules, calendar/progress aggregate correctly, existing non-venture Operations OS behavior is unchanged, EN/FR complete, `npm run build` clean.

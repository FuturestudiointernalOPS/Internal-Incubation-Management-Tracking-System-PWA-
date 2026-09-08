# Venture OS — Sprint 3, Track 5 (Coaching, KPIs & Investment Readiness — Tickets 4.1-4.4 only)

**Branch: `Sprint-3-Track-1`. Do NOT push to `dev` or `main`. Push only to `Sprint-3-Track-1` when done and locally tested.**

Covers Tickets **4.1-4.4** from the spec, pages 27-31: Venture Coaching Management, Venture KPI Management, Advisor Management, Follow-up Meetings. **Tickets 4.5 (Investment Readiness Assessment) and 4.6 (Venture Reports & Analytics), pages 32-34, are explicitly held back for Sprint 4 in the spec — do not build them, not even a UI shell, unless separately asked.**

Depends only on: Venture Profile schema from Track 1 (`ventures` — live) and the existing Program OS Follow-up/Calendar/Notification architecture (`v2_followups` — reused, not rebuilt).

## 0. MANDATORY — auth pattern

Same rule as every prior Venture OS batch: every route checks the caller is an active `venture_members` row for the `venture_id` (or a privileged role: `staff, program_manager, super_admin, developer`), else `404`. Additionally: an `advisor`-scoped user (if the codebase has a distinct `advisor` role — check `src/lib/auth.js`'s role list; if there's no dedicated `advisor` role today, treat this as a role assignable via `venture_advisors` regardless of the base account role, e.g. a `staff` or `teacher` account can be assigned as an advisor) should only see/manage coaching data for ventures where they have an active `venture_advisors` row, **unless** they also hold a privileged role — rule 47 ("each Advisor should have access only to ventures assigned to them unless additional permissions are granted").

## 1. Schema — already migrated, do not modify shape

`src/migrations/venture_os_track5_coaching.sql` already applied.

```sql
CREATE TABLE venture_advisors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  advisor_contact_id TEXT NOT NULL REFERENCES contacts(cid),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  assigned_by TEXT REFERENCES contacts(cid),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at TIMESTAMPTZ,
  UNIQUE(venture_id, advisor_contact_id)
);

CREATE TABLE venture_coaching_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  advisor_contact_id TEXT REFERENCES contacts(cid),
  session_date TIMESTAMPTZ,
  notes TEXT,
  observations TEXT,
  recommendations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Global, reusable KPI definitions (business rule 49) + per-venture assignment:
CREATE TABLE venture_kpi_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT,
  auto_calc_source TEXT, -- null | 'customer_interviews' | 'milestones' | 'tasks'
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT REFERENCES contacts(cid),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE venture_kpi_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  kpi_definition_id UUID NOT NULL REFERENCES venture_kpi_definitions(id) ON DELETE CASCADE,
  target_value NUMERIC,
  current_value NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(venture_id, kpi_definition_id)
);

-- Existing v2_followups (Program OS) gets a nullable venture_id — reused as-is:
ALTER TABLE v2_followups ADD COLUMN venture_id UUID REFERENCES ventures(id) ON DELETE SET NULL;
```

## 2. Business rules in scope (46-53, reconstructed from ticket text — see doc §Track 5 for full sourcing note)

- Future Studio may assign one or multiple Venture Advisors to a Venture (`venture_advisors`, `is_primary` flags the primary one — only one row per venture should have `is_primary=true`, enforce in application logic since a partial unique index on a boolean is awkward in plain SQL here).
- Each Advisor has access only to ventures assigned to them unless additional permissions granted (see §0).
- Coaching becomes part of the Venture Timeline; nothing deleted (`venture_coaching_sessions` — no DELETE route).
- KPIs must be configurable by Future Studio and reusable across ventures — not hardcoded (`venture_kpi_definitions` is the reusable catalog; only privileged roles create/edit/disable definitions).
- KPIs update automatically based on venture activities wherever applicable (`auto_calc_source` — for Phase 1, implement auto-calc for at least one source, e.g. `'customer_interviews'` → `current_value = COUNT(*) FROM venture_customer_interviews WHERE venture_id = ?`, `'milestones'` → average of `venture_milestones.progress`. Others can stay manual-entry for now — don't over-build).
- Every Follow-up remains part of the Venture Timeline (`v2_followups` rows with `venture_id` set, read via existing follow-up query patterns plus the new filter).
- Follow-up scheduling auto-updates Advisor Calendar and Venture Calendar (reuse whatever calendar-sync logic `v2_followups` already triggers — check existing follow-up creation route for calendar-write side effects and confirm they still fire when `venture_id` is set; don't build a second calendar sync).
- EN/FR everywhere.

## 3. API

- `GET /api/ventures/[id]/advisors` (list active) + `POST /api/ventures/[id]/advisors` (assign — privileged roles only: `staff, program_manager, super_admin`) + `PATCH /api/ventures/[id]/advisors` (body `{id, action: "remove"}` or `{id, is_primary: true}` — privileged roles only).
- `GET /api/ventures/[id]/coaching-sessions` (list, advisor-scoped per §0) + `POST /api/ventures/[id]/coaching-sessions` (create — caller must be an active advisor for this venture, or privileged).
- `GET /api/venture-kpi-definitions` (global catalog, all authenticated staff-ish roles can read; only privileged roles can `POST`/`PATCH` to create/edit/disable — this is NOT venture-scoped, it's a global catalog, so it does not need the venture-membership check from §0, just a role check).
- `GET /api/ventures/[id]/kpis` (list assignments + current values, auto-calculating where `auto_calc_source` is set) + `POST /api/ventures/[id]/kpis` (assign a KPI definition to this venture with a target — privileged or founder) + `PATCH /api/ventures/[id]/kpis` (body `{id, current_value}` — manual update for KPIs with no `auto_calc_source`).
- `GET /api/ventures/[id]/followups` (list, filtered `venture_id`) — reuse existing follow-up creation route if it can accept an optional `venture_id` in its body rather than writing a parallel POST endpoint; only add a new POST route here if the existing one truly can't be extended cleanly.

## 4. UI

Extend `src/app/participant/ventures/[id]/page.js` with: **Advisors** tab (founder/privileged view — list assigned advisors, primary badge; assignment UI likely lives on the admin/staff side instead — check `src/app/admin/` for an existing staff-assignment UI pattern and mirror it for advisor assignment rather than building venture-side self-service assignment, since Future Studio assigns advisors, not founders), **Coaching** tab (session history, notes/recommendations, visible to founders + assigned advisors), **KPIs** tab (assigned KPIs with progress bars/current-vs-target, founder can request new KPI assignment from the global catalog).

Admin-side: `src/app/admin/venture-kpis/page.js` (or extend an existing KPI admin page if one exists — check `src/app/admin/` for `kpi` naming first) for Future Studio to manage the global `venture_kpi_definitions` catalog (create/edit/disable).

Reuse `useI18n()`, match dark-theme conventions.

## 5. i18n

Extend `venture` namespace with `venture.advisors.*`, `venture.coaching.*`, `venture.kpis.*` (title, assignKpi, target, current, autoCalculated, manualEntry).

## 6. Explicitly out of scope

- Ticket 4.5 (Investment Readiness Assessment) and 4.6 (Venture Reports & Analytics) — Sprint 4, do not build even a UI shell unless separately asked.
- Full Investor OS integration — Sprint 4.
- Track 2/3/4 features.

## 7. Self-testing checklist

- [ ] Assign an advisor to a venture as staff → succeeds; attempt as a participant → rejected.
- [ ] Assign a second advisor and mark them primary → only one `is_primary=true` row per venture at any time.
- [ ] Create a coaching session as the assigned advisor → succeeds; as an advisor NOT assigned to this venture → rejected (404, per §0); as a founder → check if founders should read-only view (yes) vs create (no, advisor-only per rule).
- [ ] Create a global KPI definition as staff → succeeds; assign it to a venture with a target → succeeds; if `auto_calc_source='customer_interviews'`, confirm `current_value` reflects the real interview count from Track 2's `venture_customer_interviews` table.
- [ ] Manually update a KPI with no `auto_calc_source` → persists.
- [ ] Create a follow-up with `venture_id` set → appears in venture's followup list, still appears correctly wherever Program OS follow-ups are normally surfaced (regression check).
- [ ] **Auth**: non-member/non-advisor gets 404 or empty list as appropriate on every new endpoint.
- [ ] EN/FR complete, no missing-key fallback text.
- [ ] `npm run build` passes clean.

## 8. Definition of done

Track 5 (Tickets 4.1-4.4) is complete when Future Studio can assign/manage Venture Advisors with scoped access, advisors can run structured coaching sessions with permanent history, Venture KPIs are configurable/reusable/auto-calculated where applicable, follow-up meetings reuse the existing Program OS engine with venture scoping, EN/FR complete, `npm run build` clean, and the two held-back tickets (4.5/4.6) remain untouched.

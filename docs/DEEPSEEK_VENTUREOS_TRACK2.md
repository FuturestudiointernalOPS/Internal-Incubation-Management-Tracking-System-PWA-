# Venture OS — Sprint 3, Track 2 (Venture Development Workspace)

**Branch: `Sprint-3-Track-1`. Do NOT push to `dev` or `main`. Push only to `Sprint-3-Track-1` when done and locally tested.**

Covers Tickets **2.1-2.6** from the Sprint 3 Venture OS spec (pages 12-21): Business Model, Customer Discovery, Validation Workspace, Product Market Fit, Venture Milestones, Action Plans.

Depends only on the Venture Profile schema from Track 1 (`ventures` table — already live). Nothing here depends on Track 3/4/5.

## 0. MANDATORY — auth pattern (read before writing any route)

Every prior batch of Venture OS work (Track 1 Phase A and Phase B) shipped with **membership-check gaps**: routes returned data to any authenticated user regardless of whether they belonged to the venture. Every one of these bugs was found in review and had to be fixed after the fact. Do not repeat this. For **every** new API route in this track:

- Import `{ requireAuth, getSession }` from `@/lib/auth`.
- Call `requireAuth([...roles])` first.
- Call `const session = await getSession()` to get `{ cid, role }`.
- If `session.role === "participant"`: the caller must be an **active member** of the `venture_id` in question (`SELECT 1 FROM venture_members WHERE venture_id = ? AND contact_id = ? AND removed_at IS NULL`). If not a member, return `404` (not 403 — don't leak existence of ventures they're not part of), matching the pattern already used in `src/app/api/ventures/[id]/route.js`.
- Roles `staff, program_manager, super_admin, developer` bypass the membership check (org-wide oversight — same pattern as Track 1).
- `teacher` role: read-only, same membership rule as participant (a teacher is not automatically a venture member).

Write a single shared helper if you want (e.g. `src/lib/ventureAuth.js` exporting `checkVentureAccess(db, ventureId, session)`), reused across all 6 tickets' routes, instead of copy-pasting the check six times with six chances to typo it.

## 1. Schema — already migrated, do not modify shape

`src/migrations/venture_os_track2_workspace.sql` has already been written AND applied to the shared dev database. Do not create a competing migration. If something you need is missing, surface it as a note in your final report rather than silently altering a table.

```sql
CREATE TABLE venture_business_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  business_model_canvas JSONB DEFAULT '{}', -- key_partners, key_activities, key_resources, value_propositions, customer_relationships, channels, customer_segments, cost_structure, revenue_streams
  lean_canvas JSONB DEFAULT '{}', -- problem, solution, key_metrics, unique_value_proposition, unfair_advantage, channels, customer_segments, cost_structure, revenue_streams
  revenue_streams TEXT,
  cost_structure TEXT,
  key_partners TEXT,
  updated_by TEXT REFERENCES contacts(cid),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(venture_id)
);

CREATE TABLE venture_customer_interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  customer_segment TEXT,
  interviewee_name TEXT,
  interview_date DATE,
  notes TEXT,
  insights TEXT,
  created_by TEXT REFERENCES contacts(cid),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE venture_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  validation_type TEXT NOT NULL, -- problem | solution | product
  status TEXT NOT NULL DEFAULT 'in_progress', -- not_started | in_progress | validated | invalidated
  notes TEXT,
  created_by TEXT REFERENCES contacts(cid),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE venture_pmf_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  customer_feedback TEXT,
  improvements TEXT,
  pmf_progress INTEGER DEFAULT 0, -- 0-100
  created_by TEXT REFERENCES contacts(cid),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE venture_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_date DATE,
  progress INTEGER NOT NULL DEFAULT 0, -- 0-100
  status TEXT NOT NULL DEFAULT 'not_started', -- not_started | in_progress | completed
  created_by TEXT REFERENCES contacts(cid),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE venture_action_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES venture_milestones(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium', -- low | medium | high
  deadline DATE,
  owner_contact_id TEXT REFERENCES contacts(cid),
  status TEXT NOT NULL DEFAULT 'open', -- open | in_progress | done
  created_by TEXT REFERENCES contacts(cid),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## 2. Business rules in scope (quoted from spec, numbered 14-23 in the doc)

- Every development workspace belongs to one Venture.
- Founders may update business information continuously (business model, canvas — no lock-after-submit).
- Business Models remain editable (it's a singleton per venture — `UNIQUE(venture_id)` — always upsert, never insert-only).
- Customer Discovery records remain preserved (never hard-delete an interview).
- Validation history should never be deleted (status changes create new rows or just update status — either is fine, but never delete).
- Milestones remain configurable; contribute to venture progress.
- PMF should support continuous refinement (repeated assessments over time, not a single form).
- Historical business decisions should remain available (interviews, validations, PMF assessments are append/history style, not overwritten in place — business_models is the one exception, singleton by design).
- All interfaces must support English and French.

## 3. API — use `createHandler` (see `src/lib/api/createHandler.js`) where practical, otherwise raw try/catch is acceptable (Track 1 used raw try/catch throughout and it was functionally fine — just don't skip the auth checks in §0)

- `GET /api/ventures/[id]/business-model` + `PUT /api/ventures/[id]/business-model` — singleton row per venture, `PUT` upserts (`INSERT ... ON CONFLICT (venture_id) DO UPDATE`).
- `GET /api/ventures/[id]/interviews` (list) + `POST /api/ventures/[id]/interviews` (create) — no PUT/DELETE needed for Phase 1 (append-only per business rule).
- `GET /api/ventures/[id]/validations` (list, all types) + `POST /api/ventures/[id]/validations` (create) + `PATCH /api/ventures/[id]/validations` (body `{id, status, notes}` — update status, e.g. `in_progress` → `validated`).
- `GET /api/ventures/[id]/pmf` (list, most recent first) + `POST /api/ventures/[id]/pmf` (create new assessment — never update an old one).
- `GET /api/ventures/[id]/milestones` (list) + `POST /api/ventures/[id]/milestones` (create) + `PATCH /api/ventures/[id]/milestones` (body `{id, ...fields}` — update progress/status/target_date).
- `GET /api/ventures/[id]/action-plans` (list, optional `?milestone_id=` filter) + `POST /api/ventures/[id]/action-plans` (create) + `PATCH /api/ventures/[id]/action-plans` (body `{id, ...fields}` — update status/priority/deadline/owner).

Mutation access (`POST`/`PUT`/`PATCH` on all of the above): any active venture member (founder OR team_member) may create/update — this is a working *team* workspace, not founder-exclusive like Track 1's roster management. Only `GET` needs the membership-or-privileged-role check from §0; the same check applies to mutations too (member-or-privileged), just without the founder-only restriction Track 1 used for its roster routes.

## 4. UI

Extend `src/app/participant/ventures/[id]/page.js` (already has a tabbed layout from Track 1 Phase B — Profil/Paramètres/Fondateurs/Équipe/Tableau De Bord/Historique) with new tabs:

- **Business Model** tab — canvas form (9 fields: key partners, key activities, key resources, value propositions, customer relationships, channels, customer segments, cost structure, revenue streams) plus a simpler Lean Canvas toggle/section if time allows; single save button (upsert).
- **Customer Discovery** tab — list of interviews (segment, interviewee, date, notes/insights) + "+ Add Interview" form.
- **Validation** tab — three sections (Problem / Solution / Product), each showing current status + notes + a way to add a new validation entry or update status.
- **Product Market Fit** tab — list of past PMF assessments (most recent first) + "+ New Assessment" form (feedback, improvements, progress slider/input 0-100).
- **Milestones** tab — list of milestones with progress bars, target dates, status; "+ Add Milestone" form; inline progress/status edit.
- **Action Plans** tab — list grouped by milestone (or "unassigned"), showing priority/deadline/owner/status; "+ Add Action" form with optional milestone link.

Reuse `useI18n()` for every string — no hardcoded English. Follow existing dark-theme conventions from Track 1 (`bg-white/5` cards, CSS vars) — do not reintroduce the opacity/CSS-variable rendering bug that was already fixed once in Module 2's admin dashboard chart.

## 5. i18n

New keys under the existing `venture` namespace (`src/locales/en/venture.json` and `fr/venture.json`) — do not create a second namespace file, extend the existing one. Needed keys (English — mirror in French): `venture.businessModel.*` (title, keyPartners, keyActivities, keyResources, valuePropositions, customerRelationships, channels, customerSegments, costStructure, revenueStreams, save), `venture.discovery.*` (title, addInterview, segment, interviewee, date, notes, insights), `venture.validation.*` (title, problem, solution, product, status, notStarted, inProgress, validated, invalidated, addEntry), `venture.pmf.*` (title, addAssessment, feedback, improvements, progress), `venture.milestones.*` (title, addMilestone, targetDate, progress, status, notStarted, inProgress, completed), `venture.actionPlans.*` (title, addAction, priority, low, medium, high, deadline, owner, status, open, done).

## 6. Explicitly out of scope for this track

- Anything in Track 1 (already done), Track 3 (Execution/Standups/Blockers — reuses Operations OS task engine, different developer), Track 4 (Document Vault), Track 5 (Coaching/KPIs/Advisors).
- Do not touch `families`, `v2_teams`, `v2_groups`, or the existing Operations OS task/standup/retro/blocker tables.
- Investment Readiness Assessment / Venture Reports & Analytics — explicitly held back for Sprint 4 in the spec, do not build.

## 7. Self-testing checklist (do this before reporting done)

- [ ] Create/edit business model canvas → persists, upsert works (edit twice, second edit doesn't create duplicate row).
- [ ] Add customer interview → appears in list, never deletable via UI.
- [ ] Add validation entries for problem/solution/product, update status → persists, old entries not deleted.
- [ ] Add PMF assessment twice → both appear in history, most recent first.
- [ ] Create milestone, update progress/status → persists.
- [ ] Create action plan linked to a milestone, and one unassigned → both work, filter by milestone_id works.
- [ ] **Auth**: a participant who is NOT a member of venture X gets 404 on every one of the 6 new GET endpoints for venture X (test with a second, unrelated participant account — don't just check the UI, curl the API directly).
- [ ] **Auth**: a participant who IS a team_member (not founder) of venture X CAN create/edit workspace data (unlike Track 1's roster, this is not founder-only).
- [ ] staff/super_admin can access any venture's workspace read data without being a member.
- [ ] English and French both render with no missing-key fallback text.
- [ ] `npm run build` passes clean.

## 8. Definition of done

Track 2 is complete when a venture team can document and continuously refine their business model, record customer discovery/validation/PMF history without ever losing prior entries, track milestones and link action plans to them, every route enforces the membership check from §0, everything is bilingual, and `npm run build` is clean. Report back with exact files touched/created and the self-testing checklist results — same format as prior Track 1 reports.

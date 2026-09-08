# Vinance 3 — Refinement Progress Log

Implementation phases for the Journey-first Venture OS refinement. Each phase
is regression-contained: additive schema only, superset API responses,
contract tests, i18n en+fr. See `docs/venture-os-legacy-map.md` for the
canonical vs legacy table map.

## Decisions (locked)

- **Milestone approval authority (Phase 3 progression engine):** only the
  Venture's assigned **Lead Manager** and **Super Admin** may mark a milestone
  approved/completed. Coaches/facilitators review tasks and submissions but
  do not advance milestones. Manual staff overrides, where allowed, are
  logged events.
- Founders never see locked roadmap content (journey stages) — staff decide
  what is released (implemented in Phase 2).

## Phase 1 — Canonical Journey Core ✅ delivered
- `src/lib/ventureStatuses.js` — canonical status vocabulary (single source
  of truth; no stored-value renames).
- `src/lib/ventureDuplication.js` + routes
  `/journey/duplicate`, `/milestones/duplicate`, `/tasks/duplicate`
  (structure-only, independent rows, statuses reset, history never copied).
- Journey manager UI duplicate button (bilingual).
- Read layer normalized: progress counts canonical terminal-success set
  (`done | accepted | completed`); tasks route uses canonical board columns +
  shared review-gated completion set.
- Legacy quarantine documented (`docs/venture-os-legacy-map.md`).
- Contract tests: `venture-statuses`, `venture-duplication`, `venture-progress`.

## Phase 2 — Three Perspectives, One Model ✅ delivered (core)
- **Venture perspective:** journey API hides locked ("upcoming") stages from
  non-staff viewers (`guided` mode) — founders only see what staff activated.
- **Manager perspective:** per-stage "{done} of {total} milestones complete"
  in the Journey manager; visibility copy explains member gating.
- **Coach perspective:** sessions carry operational context
  (`journey_stage_id`, `milestone_ref`, `task_id`) through lib + API.
- **Venture History:** read-only assembly endpoint
  `GET /api/ventures/[id]/venture-history` (events + staff notes + session
  records + review decisions; reviewer masked for non-staff) and admin page
  `/admin/ventures/[id]/history`.
- **Dashboard MVP trim:** KPI Summary card (admin venture dashboard) and
  Progress Summary metric card (founder dashboard) removed; modules intact.
- Contract tests: `notification-context`.

### Notification hardening (low-noise pass, delivered)
- Additive columns: `template_key`, `params`, `dedupe_key`, `seen_at`, `read_at`
  on `v2_notifications` (legacy rows/consumers untouched; title/message remain
  the display fallback until the Phase-2 UI renders templates through i18n).
- Producers are now idempotent: every Venture-facing event carries a
  `dedupe_key`, so a retried request can never double-notify (noise control).
- Seen ≠ read: opening the inbox stamps `seen_at`; opening an item sets
  `read_at` via PATCH read.
- Deep-link registry (`src/lib/notificationLinks.js`): entity context →
  staff/member destination route; legacy rows degrade to no link.
- **Deferred on purpose:** the transactional outbox + async relay. It needs
  producer transactions restructured (disruption), so it waits until the
  producers are revisited wholesale. Dedupe covers the noise risk meanwhile.

### Journey template library (delivered)
- `POST /journey/save-template`: save the Venture's ENTIRE journey (stages +
  bound milestones + top-level tasks) as an independent, structure-only
  template (`venture_journey_templates` + stage/milestone/task children).
- `POST /journey/apply-journey-template`: fresh journey (first stage active,
  rest locked) + fresh milestones/tasks; 409 if stages already exist.
- `GET /api/journey-templates`: library listing with structural counts.
- Journey Manager UI: "Save as Template" button + combined template picker
  (journey templates vs operating-plan templates).
- Latent bug fixed: task copies now use SERIAL ids via RETURNING (the
  duplication path previously inserted explicit UUIDs into an integer id
  column — would have failed on a real database).

## Phase 2 — in progress (first slice delivered)

### Contextual notes slice
- `venture_notes.attachments` (JSONB, additive): notes carry text + links +
  files next to the object they describe.
- Notes API: `GET ?scope_type=&scope_id=` returns exactly one object's notes
  (additive; default unchanged); POST stores attachments.
- **Security fix:** `isGlobal()` in the notes route was accidentally `async`
  and never awaited — every gate treated non-global users as global (founders
  could read/create internal notes). Now synchronous; the documented
  staff-only semantics are actually enforced (contract-tested).

### Notes UI + founder readiness view (delivered)
- New reusable `ScopedNotes` component (list + create + delete + attachments)
  wired onto every Journey stage in the manager panel (staff-only via the
  notes API; text + links + files per object).
- Founder Investment tab now shows "Your Venture progression" — the
  roadmap-derived readiness (overall %, journey/milestone/task/deliverable
  components, milestones/tasks done counts) so founders see exactly what is
  being evaluated (bilingual).

Remaining Phase 2 work: personal home (My Calendar / My Notifications
breadcrumb UI / My Attention) and notes wiring on milestone/task screens
(component is ready to drop in).

## Phase 3 — Progression engine (delivered)

### Milestone approval gating (doc §12, decision: Lead Manager + Super Admin)
- New milestone status `locked`; sequential release inside each Journey
  stage: first milestone available, every following one locked until the
  previous is completed. Enforced on create (bound milestones), journey
  template apply, and journey-stage duplication.
- Completion authority: only the Venture's assigned Lead Manager (active
  `lead_manager` assignment) or a Super Admin may mark a milestone
  `completed` — coaches/facilitators/staff get 403; other transitions
  (under_review, changes_requested, …) keep the existing flow.
- Completing a milestone auto-unlocks the next locked milestone in the same
  stage (cascade), records `MILESTONE_COMPLETED` history, and notifies
  founders with entity context (`milestone-completed:{id}` dedupe).
- Founders never see locked milestones: the guided journey response hides
  them (and recomputes milestone counts) — unreleased work is invisible.
- Engine: `src/lib/ventureMilestoneEngine.js`; vocabulary extended in
  `ventureStatuses.js`; contract tests in `venture-milestone-gating.test.js`.

Remaining Phase 3 work: reports/timeline consumption of the engine data and
full-loop UI polish (manager approval affordance on milestone screens is the
next visible piece).

## Manager & Coach model — Phase 1 delivered (coach identity & delivery)

Following the Program-layer blueprint: a Venture session coach is a PLATFORM
USER (contact) — Future Studio staff or an invited external coach.
- `venture_sessions.coach_contact_id` (additive soft ref); legacy catalog
  rows keep working via `coach_name` fallback.
- `src/lib/ventureCoach.js` resolves identity: explicit contact id wins;
  legacy catalog coach matches to a contact by email; unmatched → null
  (graceful, no delivery).
- `src/lib/ventureNotify.js` `notifyVentureCoach`: in-app notification with
  entity context + dedupe and email through the centralized provider.
- Sessions route: creation stores the resolved coach contact; coaches are
  notified (in-app + email) on create/update/cancel/reschedule — founders'
  delivery untouched.
- `GET /api/calendar?personal=1`: personal mode scopes Venture events to the
  caller's assignments ∪ coach sessions (coach sees own non-facing sessions);
  default mode byte-identical.
- Contract tests: `venture-coach-delivery.test.js` (9).

### Phase 1 completion — coach invite-by-email + Phase 2 first surface
- `POST /api/ventures/[id]/coach-invite` (`inviteCoachByEmail` in
  `ventureCoach.js`): the Venture mirror of the Program facilitator invite —
  email analysis (invalid / existing / new / already_assigned), existing
  Future Studio staff assigned as-is (account role untouched), external
  coaches created with the NARROW 'facilitator' role (never 'staff'; access
  comes from the assignment row), venture assignment with responsibility
  (default facilitator) + scope, activation/login email, token hashing,
  CRM timeline + Venture history. `preview: true` reports without writing.
- Personal staff home `/staff/me` (Manager & Coach Phase 2 first surface):
  My Calendar (personal=1), My Notifications (drill-down chips + deep links
  via the notification registry), My Ventures (assignments with
  responsibility labels → staff venture pages). Bilingual.
- Coach suite now 14 tests (invite paths included).

### Phase 2 completion — attention block, personal-home nav, locale repair
- **Manager attention block live:** `AttentionWidget` on the admin Venture
dashboard (`/admin/ventures/[id]/dashboard`) — journey-report counts (overdue
open tasks, tasks awaiting review, upcoming sessions, milestones awaiting
approval) + current active journey + journey progress. Staff surface only;
founder dashboards untouched.
- **Nav entry:** `MY DASHBOARD → /staff/me` beside `MY VENTURES` for
staff/program-manager with ≥1 active Venture assignment — wired in BOTH nav
assembly paths (role fallback + responsibilities path, guarded against
duplicate ids).
- **Critical fix:** `en/venture.json` + `fr/venture.json` were INVALID JSON
since the template-library commit (an extra `}` closed the `venture` object
prematurely; `JSON.parse` failed, so the `next build` import graph would have
broken). Structure repaired. Also moved the `personal` keys out of
`venture.manager.*` to `venture.personal.*` (the path `/staff/me` actually
calls) and added `venture.attention.*` (EN+FR). `npm run i18n:parity`: 0
missing.

## Phase 3 (Manager & Coach) — reports slice delivered
- `venture_reports` (additive) + `src/lib/ventureReports.js` + endpoints
  GET/POST/PATCH `/api/ventures/[id]/progress-reports`: Manager composes a
  typed, period-based report (current journey/milestone, completed/
  outstanding items, support delivered, challenges, recommendation); submits
  for Super Admin review (draft → submitted → reviewed/archived); founders
  denied, staff-with-assignment read-only; history events recorded.
- Contract tests: `venture-reports.test.js`.
- **Deferred (staged):** review/scope hardening (submission & task reviews
  limited by assignment scope) and general milestone/task PATCH tightening —
  behavior-changing; needs its own pass with per-capability rollout.

## Phase 3 — Readiness & Reporting Intelligence ✅ delivered (data layer)
- `src/lib/ventureReadiness.js` — roadmap-derived Investment Readiness over
  the whole defined progression (journeys 30 / milestones 30 / tasks 25 /
  deliverables 15, renormalized over defined components). Live counts: adding
  milestones/tasks later automatically participates.
- `GET /api/ventures/[id]/investment-readiness` — additive cutover: legacy
  document-checklist payload keys untouched, `roadmap_readiness` added.
- `GET /api/ventures/[id]/journey-report` — read-only operating report over
  the canonical spine (journey progression, milestones/tasks by status,
  overdue open work, submission reviews, sessions, support assignments).
  Staff-only.
- Contract tests: `venture-readiness-report`.

## Deferred follow-ups (product/screen decisions needed)
- Milestone/task duplicate buttons on their admin screens (endpoints live).
- Journey-context fields in the sessions admin form (API/lib live).
- Reports page integration of `journey-report` (a "Journey progression"
  section/tab) and Investment-tab switch to `roadmap_readiness` — planned
  cutover; legacy keys stay until consumers are flipped.
- Timeline default view remains on existing project-timeline data; a
  roadmap-native view can be derived from journey-report once UI work starts.
- Operational dashboard lists (outstanding tasks / pending reviews / overdue)
  on the two monolith pages; legacy Journey tools re-homing.
- The three pre-existing broken test suites (`ventures/api`,
  `startup-profile`, `ventures.test`) predate Vinance 3 and remain unfixed
  (unrelated to these phases).

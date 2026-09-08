# Vinance 3 — Refinement Progress Log

Implementation phases for the Journey-first Venture OS refinement. Each phase
is regression-contained: additive schema only, superset API responses,
contract tests, i18n en+fr. See `docs/venture-os-legacy-map.md` for the
canonical vs legacy table map.

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
- Contract tests: `venture-journey-gating`.

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

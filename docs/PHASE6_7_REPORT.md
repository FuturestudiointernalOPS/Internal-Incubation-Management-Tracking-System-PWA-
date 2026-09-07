# Phase 6 + 7 — Program ↔ LMS Integration & Commercial Learning — Final Developer Report

> Status: **IMPLEMENTED** (merged Phase 6 + 7)
> Depends on: Phases 1–5 (LMS foundation, course builder, learner experience, assessments, certificates)
> This report follows the required final-report structure (spec §66), including the end-to-end demo (§67) and the stop condition (§68).

---

## A. Architecture

The LMS remains a **module inside ImpactOS**, not a separate product. One Postgres database, one identity system (`contacts.cid`), one auth layer (cookie sessions + capability authorization).

```
                    PERSON (contacts.cid — ONE identity)
                       │
        ┌──────────────┼───────────────┐
        │              │               │
        ▼              ▼               ▼
      CRM           PROGRAM          LMS
      (read)         (owns)          (owns)
                       │               ├── lms_courses (reusable, NOT program-owned)
                       │               ├── lms_enrollments (multi-source)
                       │               ├── lms_lesson_progress / lms_assessment_attempts
                       │               ├── lms_certificates
                       │               └── lms_program_requirements (Program → Course bridge)
                       ▼
                 Program Learning
                       │
                       └─────────────→ LMS Course
```

**Program ↔ LMS.** The existing Program system (scheduling, sessions, activities, deliverables, follow-up, participation, progress) is **untouched**. A Program *references* LMS courses through `lms_program_requirements` (program_id + course_id + is_required + week_number/session_id context). The course stays an LMS entity: one course can be attached to many Programs/cohorts, and recorded content is reused without duplication (2026 cohort and 2027 cohort point at the same course).

**LMS is the single source of truth for learning.** Progress, lesson completion, assessment results, course completion and certificates live in the LMS. The Program only **reads** LMS state (via `getProgramLearningForParticipant`) and never maintains a second progress counter. The Website only markets; it never calculates progress.

**Commercial.** Website → Course details → Free/Paid → Registration/Purchase → ImpactOS → Enrollment → LMS. Identity is the existing ImpactOS account; there is no `lms_users` / `lms_customers` table.

---

## B. Database

### New tables
**None.** Phase 1 created `lms_program_requirements` (the Program→Course bridge) and Phase 5 created `lms_certificates`. Both already exist in `supabase/migrations/20260827_lms_foundation.sql` and `supabase/migrations/20260901_lms_certificates.sql`. No migration was required for Phase 6+7.

### Modified tables
**None** — the implementation is strictly additive to the code layer. `lms_enrollments.source` already supports `admin | program | self | purchase`; `lms_courses` already has `status (draft|published|archived)`, `visibility`, `is_free`, `price`, `slug`, `thumbnail_url`.

### Relationships
```
lms_program_requirements
  program_id TEXT  → v2_programs.id        (NO FK — documented UUID-vs-TEXT ambiguity; service validates existence)
  course_id  UUID  → lms_courses(id)       FK ON DELETE CASCADE
  UNIQUE (program_id, course_id)           — a course is attached at most once per program

lms_enrollments
  course_id  UUID → lms_courses(id)        FK ON DELETE CASCADE
  user_cid   TEXT → contacts(cid)          FK — existing ImpactOS identity (no lms_users)
  source     program|self|purchase|admin
  program_id TEXT                          informational (which program triggered a 'program' enrollment)
  UNIQUE (course_id, user_cid)
```

### Constraints / Indexes
All already defined by the Phase 1/5 migrations (unique constraints on `(program_id, course_id)`, `(course_id, user_cid)`, `(enrollment_id, lesson_id)`; index on `lms_program_requirements(course_id)`, `lms_enrollments(user_cid)`, `lms_certificates(user_cid)`).

### Migrations
None added. **Deployment note:** the permission seeds must be re-run so the live DB grants `lms.assign` to the Program Manager access profile:
`GET /api/engineering/permissions/seed-access-profiles` (super admin only). Super Admin already receives `lms.assign` automatically via `buildSuperAdminMatrix()` (code-level, no seed needed).

---

## C. Program Integration

**How Programs reference LMS courses** (spec §4, §12):

1. **Attach** — a Program Manager (or super admin) attaches an existing course to a week of a Program: `POST /api/lms/program-requirements` `{ program_id, course_id, week_number, is_required }`. The service validates the program and course exist, then inserts a row in `lms_program_requirements` (idempotent). **The course is never copied** — one `lms_courses` row serves any number of Programs (§6, §7, §18).
2. **Week context** — `week_number` (and optionally `session_id`) maps the learning item to the Program's week structure (`v2_sessions.week_number`), matching the spec's `Week 2 → Learning → Course` experience (§2).
3. **Required/Optional** — `is_required` distinguishes REQUIRED vs OPTIONAL learning (§16). Required learning is informational for Program completion — the Program's own completion rules (deliverables/sessions) are unchanged; completing the LMS course does **not** mark the Program complete (§15).
4. **Progress** — Program surfaces call `getProgramLearningForParticipant(programId, cid)`, which computes progress from `lms_lesson_progress` + `lms_assessment_attempts` only (`computeCourseProgress`). Status is derived: `not_started | in_progress | completed | unavailable` (§12, §20).
5. **Deep link** — the participant UI links `[Continue Learning]` straight to the next incomplete lesson: `/participant/learning/<courseId>/lessons/<lessonId>` via `findContinueLesson` (§21). The link still passes through the enrollment-gated `learn` route — the LMS re-verifies authorization independently; "came from the Program" grants nothing (§22).

**UI surfaces:**
- Program Manager: the Program workspace (`/pm/programs/[id]`, curriculum tab) now shows a **Learning** section inside each session card (Phase 4) with `[Add Course]`, required/optional toggle, detach (`src/components/lms/ProgramLearningSection.js`), plus a per-course PM summary (`{n} enrolled · {n} completed`) computed from `lms_enrollments` only (§17) — not a new analytics platform.
- Participant: the Program detail page (`/participant/[id]` → `ProgramDetail.js` week cards) shows each week's learning items with LMS progress bars + Continue Learning links.

---

## D. Enrollment

All enrollment sources funnel into the single `lms_enrollments` table (§35, §36):

| Source | How it happens | Who |
|---|---|---|
| `program` | Auto-enrollment — server-side, idempotent. Runs (a) when a participant is added to a program (`POST /api/participant-programs`, `/bulk`) and (b) when a course is attached to a program (all current participants). Only PUBLISHED courses auto-enroll; draft/archived never auto-enroll new learners. | `ensureProgramEnrollments()` |
| `self` | Public website free-course flow: authenticated user clicks Start Learning → `POST /api/public/courses/[slug]` → enrollment created (`source='self'`), idempotent. | public enroll route |
| `purchase` | **Reserved.** A purchase is a separate record from an enrollment (spec §40, §47). No commerce table exists yet; verified-payment → enrollment is the documented boundary below. | — |
| `admin` | Existing admin enrollment (`POST /api/lms/enrollments`, requires `lms.enroll`). | admin course editor |

**Payment → Enrollment boundary** (§31, §34, §41): the frontend can never grant paid access. Paid self-enrollment returns **402** (`lms.errors.paidCheckoutUnavailable`) until a verified payment exists. When a provider is approved, the implementation order is: verified transaction record → eligible enrollment → LMS access (webhook/verification server-side). Failed/pending payments never create access.

---

## E. Commercial Flow

```
PUBLIC WEBSITE  (/courses catalog → /courses/[slug] details)
      │  marketing-safe payload: title, description, thumbnail, free/paid + price,
      │  sections/lessons counts, duration, structure (section/lesson titles)
      │  NEVER: YouTube ids, assessment answers, internal ids, learner data
      ▼
CTA  (Free → Start Learning | Paid → Enroll Now)
      │
      ├─ not signed in → /login?next=/courses/[slug] (reuses existing ImpactOS auth)
      ▼
POST /api/public/courses/[slug]   (authenticated; slug resolved server-side)
      ├─ FREE → INSERT lms_enrollments (source 'self') → /participant/learning/<id>
      └─ PAID → 402 — verified payment required (no live provider integrated yet)
      ▼
IMPACTOS LMS → learning → progress → assessment → completion → certificate
```

Spec §32/33 honoured: **no payment infrastructure exists in ImpactOS** (searched: no provider SDKs, no checkout, no commerce transactions — `fin_*` tables are internal budget/Sheets sync). The commercial course model (`is_free`, `price`, visibility) and the verification boundary are implemented; live payment integration is intentionally **not** built. The required integration (provider choice, currencies, countries, webhook verification) must be approved by Future Studio before checkout ships.

---

## F. CRM

The learner's journey is fully traceable from the existing CRM identity (spec §37–40, §55):

- New read surface: `GET /api/contacts/[cid]/learning` (requires `contacts.view`) → `src/lib/lms/journey.js`, returning enrolled courses with LMS-derived progress, certificates, and purchases (`[]` until a commerce table exists — shape is stable).
- New **Learning tab** on the CRM person page (`/admin/crm/people/[cid]`): courses with `% · lessons`, status badges (completed/in_progress/not started), certificate numbers.
- `Person → Enrollment → Progress → Completion → Certificate` is traced by joining on `contacts.cid`. Free courses create an enrollment record too (no purchase required) so Future Studio can measure engagement (§39).
- No new customer identity system, no `lms_customers` tables (§57). The CRM never calculates progress — it consumes LMS state (§48).

---

## G. Permissions

The existing `PERMISSION_MODULES` capability system is reused (spec §44–46, §59). The `lms` module now has: `view, create, edit, delete, publish, enroll, assign`.

| Concern | Capability | Notes |
|---|---|---|
| Course creation / editing | `lms.create`, `lms.edit` | authoring — granted by Permission Manager |
| Publishing / archiving | `lms.publish` | separate from authoring |
| Enrollment management | `lms.enroll` | admin enrollment enabler |
| **Program course assignment** | **`lms.assign`** (new) | Program Managers get it via the "Program Manager" access profile; **distinct from course authoring** — a PM can attach existing courses without being a course author (§23) |
| Learning reporting (CRM trace) | `contacts.view` | CRM read surface |
| Commercial management | none yet | no commerce capabilities until payment is approved |

Super Admin automatically receives all capabilities (existing `buildSuperAdminMatrix()` bypass). **No new role** was created. PMs see the Learning section but attach/detach only as far as their capability allows — server-side enforcement via `requireAuthorization("lms", "assign")` on the mutation routes.

---

## H. Security

- **Deep links re-verify access**: `learn`, `complete`, `submit` all derive access server-side from `lms_enrollments` — never from client-supplied IDs or "came from the Program" (§22). Unenrolled users get 403 even knowing the course ID.
- **Public surface is sealed**: draft/archived/private courses are 404 on the public API; the public payload never serializes YouTube ids, `correct_answer`, internal course ids, or learner data (§49).
- **Paid content**: 402 until a verified payment; frontend "success" is never trusted (§31, §34).
- **Program assignment**: mutations require `lms.assign`; read requires `lms.view`.
- **CRM privacy**: learning trace requires `contacts.view`; certificates are ownership-scoped (learners can never read another learner's certificate — 403) and public verification exposes only the deliberately public fields (§50).
- **Client manipulation** (fake completion, fake score, fake certificate) is structurally impossible: completion is derived from persisted progress rows by the server-side engine; scoring validates answers server-side; certificates are issued only by `finalizeCourseCompletion` on a completed enrollment (idempotent, server-side).

---

## I. Testing

Run: `npx jest --runInBand` → **360 passed / 13 failed** (the 13 failures are pre-existing, unrelated to the LMS: `ventures/*` and `tasks-api` date-validation suites — present before this phase).

New suites (24 tests, all passing):

- `src/__tests__/lms-program-requirements.test.js` — attach validates program/course, course reuse across programs (no duplication), idempotent attach, week filtering, required/optional toggle, detach keeps enrollments, auto-enrollment (published only; draft/archived never), source+program_id recorded, independent learner progress, participant view reads LMS progress (completing a lesson through the real completion path updates the Program view to 100%), unpublished = unavailable, route authorization + payload mapping.
- `src/__tests__/lms-public.test.js` — catalog exposes only published+public; no id/YouTube leakage; marketing-safe detail + structure; draft = 404; free enrollment idempotent with `source='self'`; paid = 402 with no enrollment; draft enrollment = 404.

Existing LMS suites all pass: `lms-foundation`, `lms-api`, `lms-learning`, `lms-assessment`, `lms-certificates`, `lms-validation`, `lms-youtube`.

**Not yet covered by automated tests** (manual): the PM workspace UI, participant program detail UI, CRM Learning tab, and the public pages — they run against the live database (the repo's test setup has no DB-backed E2E harness).

---

## J. Regression

- `npm run build` — **zero errors**, 335/335 static pages generated; new routes present (`/courses`, `/courses/[slug]`, `/api/public/courses`, `/api/public/courses/[slug]`, `/api/lms/program-requirements`, `/api/lms/program-requirements/[id]`, `/api/contacts/[cid]/learning`).
- Full test suite: no LMS regression (359 passed, same 13 pre-existing unrelated failures).
- Existing Program enrollment flow unchanged: the auto-enrollment hook runs **after** the existing insert/audit/timeline logic and is wrapped so an LMS failure can never break program enrollment (spec §10).
- Existing Program scheduling/sessions/activities/deliverables/participation untouched — the Learning section is additive inside the curriculum tab.
- `npm run i18n:parity` — 0 missing keys (all new strings have French translations); 13 obsolete keys are pre-existing and unrelated.

---

## K. Deviations

| # | Expected | Actual | Reason | Impact | Recommendation |
|---|---|---|---|---|---|
| 1 | Paid courses purchasable end-to-end | Paid self-enrollment returns 402; no checkout | No payment infrastructure exists in ImpactOS and none is approved (spec §32/33) | Commercial revenue flow not yet live | Approve provider + build verified-payment boundary as a follow-up phase; the model is ready |
| 2 | PMs attach courses out of the box | Requires re-running the access-profile seeds so the live DB grants `lms.assign` | Capability was added to the PM profile definition; live DB rows come from the seed endpoint | Until re-seeded, only super admin can attach | Run `GET /api/engineering/permissions/seed-access-profiles` after deploy |
| 3 | Full LMS course versioning | Not implemented — documented limitation | Spec §19: inspect first; no version table exists and inventing one was explicitly discouraged | Editing course content keeps progress rows keyed by lesson id; deleting a lesson cascades its progress (documented Phase 1 behavior) | If content iteration becomes frequent, add an additive `lms_lesson_versions` migration |
| 4 | Purchases visible in CRM | `purchases: []` (stable empty shape) | No purchase/payment table exists | Paid trace incomplete until commerce ships | Add purchase table with the payment phase; CRM shape already supports it |
| 5 | Sidebar item rendered as "LMS" | Renamed to "Learning Management System" | Spec §24 explicitly requests the full label | Longer label wraps in the sidebar | Verify visually on small screens; shorten to "Learning" if needed |

---

## Final End-to-End Demo (§67)

With a test course **Customer Discovery Fundamentals** (Section 1: Introduction Video, What is Customer Discovery?; Section 2: Customer Interviews, Interview Preparation; Assessment: 5 questions, 70% pass mark):

```
PUBLIC WEBSITE (/courses → /courses/customer-discovery)
   → FREE → POST /api/public/courses/customer-discovery (authenticated)
   → /participant/learning/<id>
PROGRAM: attach the same course to Week 2 of a Program (PM workspace → Learning → Add Course)
   → participants auto-enrolled → Program detail shows Week 2 Learning with live %
   → Continue Learning → lesson player → Mark Lesson Complete → % advances (LMS authoritative)
   → Assessment → PASS/FAIL (server-scored, 70%) → Course Complete
   → Certificate issued (CERT-2026-XXXXXX) → visible in My Certificates + CRM Learning tab
   → Public verification: /verify/certificate/<token>
```

## Stop Condition (§68)

Implemented. The V1 LMS remains intentionally lightweight (Course → Sections → YouTube Lessons → Assessments → Progress → Completion → Certificate) with the two integrations (Program, CRM/Website). **No Udemy-style expansion** was added and none is planned by this phase.

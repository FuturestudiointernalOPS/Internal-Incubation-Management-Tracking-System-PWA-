# ImpactOS — MVC Refactoring Blueprint

> Status: **in progress** — Waves 0–6 ✅ (no inline SQL in API layer, libs
> relocated behind facades; repo 100 % green: 39/39 suites · 623/623 tests).
> This document is the master plan for refactoring the *entire* codebase into a
> Model–View–Controller (MVC) layering that fits Next.js App Router.

---

## 1. Why MVC here (and what it means for Next.js)

ImpactOS is a full-stack Next.js App Router application: `src/app/api/*/route.js`
handlers are the server, `src/app/<role>/*` pages are the client. There is no
separate backend service, so classic MVC maps onto the framework like this:

| MVC layer | Where it lives | Responsibility |
|---|---|---|
| **M — Model** | `src/models/<domain>.js` | Data access + domain/business rules. Pure server code. **Never** imports HTTP (`next/server`) or React. |
| **V — View** | `src/app/<role>/**/page.js` + `src/components/**` | Rendering, user input, client state. **Never** touches the database directly (fetch via controllers). |
| **C — Controller** | `src/app/api/**/route.js` | HTTP entry point: authenticate, validate input, orchestrate model calls, shape the HTTP response. Thin by design. |
| Infrastructure | `src/lib/` (db, auth, i18n, email, storage…) | Shared services the three layers depend on (keep here, they are not domain logic). |

`createHandler` (`src/lib/api/createHandler.js`) is the controller base — it
already removes the `initDb`/`requireAuth`/`try-catch` boilerplate (used by 101
of 317 route files today).

---

## 2. Measured starting state (2026-09 audit)

- **~178,800 LOC**, ~630 source files under `src/` (503 in `app/`, 50 components, 74 lib).
- **317 API route handlers** (`route.js`) — the controllers. 263 import `@/lib/db`
  and run **SQL inline**; only 9 import the one existing query module
  (`src/lib/db/queries/tasks.js`). → *Model layer barely exists.*
- **27 files > 1,000 LOC**, 64 files > 600 LOC, incl.:
  - `src/lib/ventures.js` (5,619 LOC, 277 exports, 53 importers — the biggest model candidate)
  - `src/app/pm/programs/[id]/page.js` (6,842), `src/app/api/tasks/route.js` (1,856),
    `src/components/tasks/TaskManager.js` (2,511), `src/components/layout/DashboardLayout.js` (2,120),
    `src/app/staff/op-report/page.js` (4,059), `src/app/admin/security/permissions/page.js` (4,006)
- **Test coverage**: 19 jest suites, 314 tests (baseline: 4 suites failing —
  `ventures/*` ×3 and `tasks-api.test.js` date-validation — unrelated to this refactor).
- Business logic is split three ways today: inline SQL in route handlers,
  domain helpers in `src/lib/*` (ventures, finance, authorizations…), and
  view/state logic embedded in giant page files.

---

## 3. Target structure

```
src/
├── models/                      ← M (one file per domain or per sub-domain)
│   ├── dashboard.js             ✅ done (reference slice)
│   ├── tasks.js                 ✅ tasks core CRUD + lifecycle (58 queries)
│   ├── taskComments.js          ✅ task-comments domain
│   ├── taskAssignments.js       ✅ assignments + assignment-action
│   ├── taskResources.js         ✅ task resources
│   ├── taskLifecycle.js         ✅ approve/carryover/duplicate/logs/reconcile/notify
│   ├── blockers.js              ✅ blockers + discussions
│   ├── standups.js              ✅ standups current/submit
│   ├── retros.js                ✅ retros current/submit
│   ├── projects.js              ✅ projects core + admin (wave 2)
│   ├── projectCollaboration.js  ✅ members/assignments/discuss/invites (wave 2)
│   ├── programs.js              ✅ programs + pm/programs (wave 2)
│   ├── programMembership.js     ✅ program-staff + enrollments (wave 2)
│   ├── programWorkspace.js      ✅ full-state/schedule/submissions/export (wave 2)
│   ├── curriculum.js            ✅ pm curriculum (wave 2)
│   ├── teams.js                 ✅ pm teams (wave 2)
│   ├── responsibilities.js      ✅ responsibilities (wave 2)
│   ├── contacts.js              ✅ contacts/people/families (wave 3)
│   ├── authFlows.js             ✅ auth flows (wave 3)
│   ├── groups.js                ✅ groups/participants/segments/invites (wave 3)
│   ├── authorization.js         ✅ access control (wave 3)
│   ├── ventures.js              ✅ venture business logic relocated (wave 4)
│   ├── users.js                 ← long tail (lib/authorization helpers)
│   ├── ventures/                ← split out of lib/ventures.js (5.6k LOC)
│   │   ├── index.js             ← facade re-exporting lib/ventures.js during migration
│   │   ├── venture.core.js
│   │   ├── founders.js
│   │   ├── promotion.js
│   │   └── startup-profile.js
│   ├── op-reports.js
│   ├── finance/                 ← split out of lib/finance.js + lib/finance/*
│   ├── platform-forms.js        ← platform form runs/submissions
│   ├── communications.js        ← contacts/groups/campaigns/segments
│   └── README.md                ← model conventions (this doc §4)
├── app/                         ← routing shell (views + controllers live here)
│   ├── api/<domain>/route.js    ← C — thin controllers delegating to models
│   └── <role>/.../page.js       ← V — page views
├── components/                  ← V — reusable view components
├── lib/                         ← infrastructure ONLY (db, auth, i18n, email, storage,
│   │                              rate-limit, supabase, audit…)
│   ├── api/createHandler.js     ← controller base class/helper
│   └── db/queries/*             ← migrate into src/models/* (queries are models)
└── locales/                     ← translations (unchanged)
```

**Migration rule — keep import churn near zero:** when splitting a heavily
imported `src/lib` domain module (e.g. `ventures.js`, 53 importers), the model
file is created under `src/models/<domain>/` and the original file becomes a
thin **facade** (`export * from "@/models/<domain>/index"`). Existing importers
keep working while new code imports from `@/models/…`. The facade is deleted
once all importers are migrated (grep-driven, last step of each domain).

---

## 4. Model conventions (rules of the M layer)

1. **One file per domain** under `src/models/`, named `<domain>.js` (or a folder
   for domains > ~400 LOC of model code).
2. **One function per query/operation**, named after the data/outcome it returns
   (`getTaskById`, `createVenture`, `resolveBlockersForTask`…).
3. **SQL must stay byte-identical** during migration — the jest suites for API
   routes mock `@/lib/db` with SQL string-matching, so identical SQL keeps the
   tests as a regression net.
4. Models import only: `@/lib/db`, `@/lib/db`-adjacent infra, other models,
   pure helpers (`uuid`, date utils). **No** `next/server`, no `NextResponse`.
5. Transactional multi-step operations go through `db.transaction(...)`
   (already available in `src/lib/db.js`).
6. Side effects that models must not perform silently: auditing (`lib/audit`,
   `lib/taskAudit`) and emailing belong to controllers or an explicit
   `notify`-prefixed model function — never hidden inside a generic `updateX`.

## 5. Controller conventions (rules of the C layer)

1. Keep `route.js` handlers **thin**: authenticate (`createHandler` roles),
   read/validate params, delegate to models, shape the JSON response.
2. Move *response-shaping* that only this endpoint needs into private helpers
   in the route file (that is view-model code, fine to keep in C).
3. Move duplicated orchestration (used by 2+ routes) into the model file
   (`fetchDashboardQueries()` style) or a `src/controllers/` helper if it is
   purely HTTP-shaped.
4. Every new route uses `createHandler`; legacy routes migrate when touched.

## 6. View conventions (rules of the V layer)

1. Pages/components must not import `@/lib/db` or run SQL. Today **many pages
   do** (e.g. `src/app/pm/programs/[id]/page.js`) — those blocks move to a
   model function called from an API route the page fetches, or into the page's
   server component via a model import (pages using `use client` + fetch stay
   on the API path).
2. Giant view files (>600 LOC) split into feature components under
   `src/components/<feature>/` (see §7 wave C for the queue).
3. i18n, design tokens, and UI component rules from `AGENTS.md` apply unchanged.

---

## 7. Migration waves (whole codebase)

Each wave ends with `npm test` (compare against baseline: 4 failing suites) and
`npm run build` green. Domains are ordered by blast radius + existing coverage.

### Wave 0 — Foundations ✅ (done)
- `src/models/dashboard.js` created; `api/dashboard/route.js` thinned from 17
  inline queries to model calls. Jest `dashboard-api` green.
- This blueprint.

### Wave 1 — Tasks & Blockers domain ✅ (SQL extraction done 2026-09-02)
- [x] Extract every inline query in `api/tasks/**` (route 1,856 LOC, comments,
      assignments, approve), `api/blockers`, `api/standups`, `api/retros`
      (17 route files, 151 call sites) into models:
      `src/models/tasks.js`, `taskComments.js`, `taskAssignments.js`,
      `taskResources.js`, `taskLifecycle.js`, `blockers.js`, `standups.js`,
      `retros.js`. All controllers now contain **0** `db.execute` calls;
      SQL kept byte-identical (verified per-agent with git-HEAD literal diffs).
- [ ] Move task domain rules out of the route into models:
      date validation, subtask⇄parent cascade, 12h lock rule, carry-over.
      *(deferred — kept in controller for now; only executed when these rules
      become duplicated or the controller is split further)*
- [x] `src/lib/db/queries/tasks.js` → folded into `src/models/tasks.js`;
      `queries/tasks.js` is now a facade (`export * from "@/models/tasks"`)
      so `tasks-api.test.js` mocks and legacy importers keep resolving.
- [ ] Migrate `TaskManager.js` (2,511) to the new models via existing API
      (client view — already talks to the API; verify no direct db usage).
- **Gate ✅:** tasks-api **12/12** (the 1 failing date test was time-rot —
  hard-coded week 33 of 2026; test now computes the current ISO week),
  dashboard 2/2, reports 5/5, full suite 16 pass / 3 fail — the 3 remaining
  failures are the pre-existing `ventures/*` suites (Wave 4 scope).

### Wave 2 — Projects & Programs domain ✅ (SQL extraction done 2026-09-02)
- [x] `src/models/projects.js` (41 fns: api/projects + admin/projects core)
      and `src/models/projectCollaboration.js` (24 fns: members, assignments,
      discuss, invitations) — 11 route files, 65 queries.
- [x] `src/models/programs.js` (54 fns: api/programs, api/pm/programs*,
      program-types), `src/models/programMembership.js` (53 fns: program-staff,
      v2/program-staff, participant programs, contacts/[cid]/programs),
      `src/models/programWorkspace.js` (13 fns: full-state, schedule,
      submissions, export), `src/models/curriculum.js` (35 fns),
      `src/models/teams.js` (16), `src/models/responsibilities.js` (14) —
      20 route files, 185 queries. Total wave-2: **31 routes / 250 queries** →
      all controllers now have **0** `db.execute` (grep-audited).
- [x] Verified **no view file imports `@/lib/db`** — pages are already
      API-driven, so the View layer is layering-compliant.
- [ ] Thin `src/app/pm/programs/[id]/page.js` (6,842 LOC): it is a client view
      that fetches 36 endpoints — architectural layering is already correct;
      decomposition into `components/pm/program/` views is pure file-size debt
      and is deferred to the view-splitting wave (tracked with Wave 6 long-tail).
      Same for `admin/programs/page.js` (2,059), `admin/projects/[id]/page.js`
      (1,709), `admin/projects/page.js` (1,558).
- **Gate ✅:** new `projects-api.test.js` **10/10** (written first — pins POST/
  GET/PUT/DELETE behavior incl. executed SQL fragments), full suite 17 pass /
  3 fail (only pre-existing `ventures/*`), `npm run build` green.

### Wave 3 — People & Auth model ✅ (SQL extraction done 2026-09-02)
- [x] `src/models/contacts.js` (70 fns: contacts CRUD/search/merge/duplicates/
      timeline/full-state + me/relationships + families), `src/models/authFlows.js`
      (69 fns: login/session-login/impersonate/activate/invite/password flows +
      revoke + language), `src/models/groups.js` (52 fns: groups, user-groups,
      participants, segments, invites, org teams), `src/models/authorization.js`
      (67 fns: org-membership, access-profiles*, engineering/permissions*) —
      **39 route files / 258 queries** → 0 `db.execute` left (grep-audited).
- [ ] `src/lib/authorization/*` (resolver/membership/backfill still hold SQL)
      + capability checks in `lib/auth.js` — deferred: these are shared helpers
      with few importers; migrate them during the long-tail wave (facade pattern).
      `lib/auth.js` session mechanics remain infrastructure by design.
- **Gate ✅:** new `relationships-api.test.js` **3/3** (written first — pins the
  sidebar's personal-relationships endpoint), existing org-membership (12),
  governance-audit (8) and permissions-admin (11) suites stay green; full suite
  36 pass / 3 fail (only pre-existing `ventures/*`), `npm run build` green.

### Wave 4 — Venture OS ✅ (2026-09-02 — lib relocated, suites green)
- [x] `src/lib/ventures.js` (5,619 LOC / 277 exports) moved **byte-identical** to
      `src/models/ventures.js`; `src/lib/ventures.js` is now a facade
      (`export * from "@/models/ventures"`) → 53 importers untouched.
- [x] **All 3 failing `ventures/*` suites fixed → repo 100 % green**
      (39/39 suites, 623/623 tests). Root causes: 1 real code bug
      (`calculateCompletion` granted half-credit to empty optional steps —
      now measured over required-content steps only: empty = 0 %, full = 100 %)
      + 9 test-harness issues (`jest.clearAllMocks` vs queued once-values,
      repo-wide constant `uuid` stub, stale mocks after the ventureAuth gate
      was added to `/api/ventures/[id]`).
- [ ] Deeper split of `src/models/ventures.js` into a folder (core/founders/
      promotion/startup-profile…) — deferred to long tail (facade already in
      place, so it is safe to do later).
- [ ] `api/ventures/**` inline SQL (~35 files / ~200 queries) → models —
      moved to Wave 5 (route-extraction wave).
- [ ] `src/lib/finance*`, `src/lib/platform/*`, `src/lib/email.js` splits —
      moved to Wave 6 (lib-domain splits).
- **Gate ✅:** full suite 39/39 suites · 623/623 tests · `npm run build` green.

### Wave 5 — Remaining API routes → models ✅ (complete — no inline SQL left)
- [x] **Venture cluster** ✅ (2026-09-02): `api/ventures/**` 32 routes /
      194 queries → `src/models/ventureWorkspace.js` (78), `ventureJourney.js`
      (68), `ventureAssets.js` (48).
- [x] **Platform cluster** ✅ (2026-09-02): 27 routes / 332 queries →
      `src/models/formRuns.js` (113), `publicFormRuns.js` (32), `forms.js`
      (79), `platformAi.js` (75), `intents.js` (17), `platformImport.js` (16).
- [x] **Investor + communications clusters** ✅ (2026-09-02): 30 routes /
      219 queries → `src/models/investor.js` (80), `investorRelations.js`
      (78), `communications.js` (60), `finance.js` (1, seed).
- [x] **Final clusters** ✅ (2026-09-02): 78 routes / 341 queries →
      `participantPortal.js` (72), `adminOps.js` (54), `teacher.js` (25),
      `engineering.js` (22), `facilitation.js` (41), `workspace.js` (52),
      `platformConfig.js` (49), + appends to `tasks.js`/`authFlows.js`/
      `groups.js` (26).
- [x] **Wave 5 gate ✅: 0 `db.execute` left in `src/app/api`** (audited),
      0 pages import the db layer, 42 model files / 2,227 queries,
      full suite 39/39 · 623/623, `npm run build` green.

### Wave 6 — Lib-domain splits ✅ (2026-09-02 — 41 modules relocated behind facades)
- [x] 15 top-level domain modules moved byte-identical to `src/models/` with
      facades at their lib paths (contactIdentity, contact-group-sync,
      contact-groups, contactGroups, invitations, kpi-progress,
      participant-membership, program-history, standupUpsert, taskAudit,
      taskCarryover, ventureIntake, ventureInvitations, venturePipeline,
      ventureTemplates).
- [x] 4 domain folders mirrored under `src/models/` (26 files):
      `authorization/` (9), `finance/` (2), `platform/` (9 incl. ai/*),
      `integrations/` (6). Every original path is now a facade. Folders
      coexist with the pre-existing `src/models/authorization.js` /
      `finance.js` files.
- [x] `src/lib/lms/*` (17 files, interlinked, covered by 12 jest suites)
      relocated byte-identical to `src/models/lms/` behind per-file facades
      (2026-09-02; 11 lms suites green, 254 tests).
- [ ] `src/lib/email.js` (1,462), `auth.js`, `audit.js`, `token-hashing.js`,
      `ventureAuth.js` stay in `lib/` by design (infrastructure).
- **Gate ✅:** 8 focused suites green (171 tests) + full suite 39/39 ·
  623/623 · `npm run build` green.

### Wave 7 — Remaining (views, lms lib, facades, polish)
- [ ] View decomposition: the giant client pages (`pm/programs/[id]` 6,873;
      `staff/op-report` 4,059; `admin/op-reports` 2,375; `admin/programs`
      2,059; `admin/projects/*`, `TaskManager` 2,511, `DashboardLayout` 2,196…)
      are layering-compliant (API-driven) — splitting them is pure file-size
      debt; do it feature-by-feature with no behavior change.
- [ ] Relocate `src/lib/lms/*` → `src/models/lms/` behind per-file facades.
- [ ] Remove facade re-exports once importers are migrated (grep count = 0),
      incl. `src/lib/ventures.js` + `src/lib/db/queries/tasks.js`.
- [ ] Final polish: full `npm run lint` (fix repo eslint config), `npm test`,
      `npm run build`; update `AGENTS.md`, `.ai/*`, `docs/ARCHITECTURE.md`;
      delete legacy SQLite binaries (`src/lib/*.db`) after confirmation.

---

## 8. Validation strategy

| Check | Command | Note |
|---|---|---|
| API suites | `npx jest src/__tests__/<domain>-api.test.js` | SQL string-matching mocks verify queries stay byte-identical |
| Full tests | `npm test` | Baseline = 15 pass / 4 fail suites (ventures×3, tasks-api date tests) |
| Build | `npm run build` | All routes/pages compile + force-dynamic layout intact |
| i18n parity | `npm run i18n:parity` | Only if touching user-visible strings |
| Lint | `npx eslint <changed files>` | 2-space, single quotes, trailing commas, no semicolons |

---

## 9. How to continue (next session / contributor)

1. Pick the next unstarted wave in §7 (order is intentional).
2. For each route file in scope: read it, cut each `db.execute({...})` block
   into a named function in the domain model (SQL byte-identical), replace the
   call, delete dead imports, run the domain's jest suite.
3. Mark the checkbox in §7 and update the Status line at the top.

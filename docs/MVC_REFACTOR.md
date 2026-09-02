# ImpactOS — MVC Refactoring Blueprint

> Status: **in progress** — Wave 0 ✅ + Wave 1 ✅ (SQL extraction) delivered.
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
│   ├── projects.js              ← Wave 2
│   ├── programs.js              ← Wave 2
│   ├── users.js                 ← contacts / sessions / people
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

### Wave 2 — Projects & Programs domain
- [ ] `src/models/projects.js` (queries from `api/projects`, `api/dashboard`
      already done, project members, teams, responsibilities).
- [ ] `src/models/programs.js` (from `api/pm/programs` 711, `api/programs`,
      program-staff, program-types, curriculum, full-state 575).
- [ ] Thin `src/app/pm/programs/[id]/page.js` (6,842 LOC): every data block →
      model + API route; page keeps only view composition (this is the largest
      single file in the repo — split into `components/pm/program/` views).

### Wave 3 — People & Auth model
- [ ] `src/models/users.js`: sessions/contacts queries duplicated across
      `api/auth`, `api/me`, `api/contacts` (133 inline `FROM contacts`),
      `api/admin`, invitations, families, groups, org-membership.
- [ ] `src/models/authorization.js`: from `src/lib/authorization/*` + auth
      capability checks (leave `lib/auth.js` session mechanics in place — it is
      infrastructure).

### Wave 4 — Venture OS
- [ ] Split `src/lib/ventures.js` (5,619 LOC, 277 exports) into
      `src/models/ventures/*` behind a facade (53 importers → zero breakage).
      Fix the 3 failing `ventures/*` test suites during the move.
- [ ] Same for `src/lib/finance*`, `src/lib/platform/*`, `src/lib/email.js`
      (1,391 — split template building from transport).

### Wave 5 — Reporting & Op-reports
- [ ] `src/models/op-reports.js`, `src/models/reports.js` from
      `api/op-reports` (318), `api/reports`, `api/standups`, and the two giant
      pages `staff/op-report/page.js` (4,059) and `admin/op-reports/page.js`
      (2,375): keep table/filter/export views, move aggregation SQL to models.

### Wave 6 — Remaining domains + long tail
- communications (contacts/groups/campaigns/segments/families),
  platform forms & runs (`api/platform/*`), participant, investor (incl.
  `lib/finance` pipeline), messaging, crm, intelligence.
- Long tail: thin the remaining 19 route files > 400 LOC and all 27 files > 1,000 LOC.

### Wave 7 — Delete facades & final polish
- [ ] Remove facade re-exports once importers migrated (grep count = 0).
- [ ] Full `npm run lint`, `npm test`, `npm run build`; update `AGENTS.md`,
      `.ai/*`, `docs/ARCHITECTURE.md` + this doc's status; delete legacy
      SQLite binaries (`src/lib/*.db`) after confirmation.

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

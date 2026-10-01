# Layer split — View → Controller → Service → Repository

> Status: **authorization + finance complete; programs models done; controller
> frontier complete (after a correction — see slice 26)**. Slices 1–9 finished
> authorization (service layer HTTP-free), 10–11 finished finance, 12–13 covered
> programs, 14 contacts, 15 ventures, 17–18 LMS (learning, then checkout), 19
> workspace, 20 ventures (plan import), 21 platform (Run report), 22 the CRM
> decision helpers, 23 the first controller sweep, 24 the Journey
> stage/archive/template engine, 25 the archive + duplication engines, 26 the
> controller leftovers the first sweep's grep missed (multiline `db\n.execute`
> chains, `runSafeQuery`/`runQuery` wrappers) + milestone ordering, 27 the access
> facts (service + store; `ventureAuth` is left with no SQL and no `db`
> parameter), 28 the permission engine and the milestone progression engine
> (service + store; the `db` threading through `canManageMilestones` /
> `syncMilestoneFromWork` is gone), 29 the assignment-scope layer and the
> operating-plan access helpers, 30 the roadmap readiness engine and the Venture
> notification helpers, 31 the venture progress reports, 32 the Venture coach
> identity/invitation layer, 33–36 the first `ventures.js` domains out of the
> monolith (activity/history/notifications, the startup-profile wizard,
> founders/co-founders, the Data-bank verification), 37–38 the projects
> controller (workspace, then collaboration), 39–55 the next `ventures.js`
> domains (milestones & deliverables, tasks/dependencies/comments/attachments,
> project timeline & dependencies, reports & project analytics, coach & mentor
> management, mentoring sessions & scheduling, knowledge hub & learning,
> mentor feedback & analytics, investment readiness, investor matching, pitch deck
> & data room, the fundraising pipeline, investment analytics, administration &
> system config, the notification centre, audit logs & security, then external
> integrations & public APIs). The
> remaining mixed model modules are itemised in §4. This document is the running
> log. Update it
> at the end of every slice.

Related docs: [`MVC_REFACTOR.md`](MVC_REFACTOR.md) (the SQL-to-models wave plan),
[`SERVER_LAYERS.md`](SERVER_LAYERS.md) (the request path as it stands),
[`ARCHITECTURE.md`](ARCHITECTURE.md).

---

## 1. The target

We are moving to four layers, with a hard rule on each:

```text
View            src/app/<role>/**/page.js · src/components/**
   │            renders, collects input — never touches the database
   ▼
Controller      src/app/api/**/route.js
   │            authenticates, validates, shapes the HTTP answer — no decisions, no SQL
   ▼
Service         src/services/<domain>/**        ← NEW
   │            decides ("may they?", "what runs next?") — no SQL
   ▼
Repository      src/models/<domain>/**
   │            one function per query — no decisions, no HTTP
   ▼
Database        src/lib/db.js  (direct Postgres pool)
```

Infrastructure (`src/lib/**`: db engine, i18n, email, storage, logger) sits
beside all of this and is not a domain layer.

### Naming decisions (and the deviations from the original sketch)

| Proposal | Decision here | Why |
|---|---|---|
| `src/repositories/**` | **keep `src/models/**`** as the repository layer | `AGENTS.md` and ~250 importers already say "all SQL lives in `src/models`". Renaming would be pure churn for zero behaviour. A second data-access folder would be two homes for the same thing — rejected. |
| `src/services/**` | **adopted** | New home for use-case/decision code. This is the layer that did not exist. |
| `src/types/**` | **deferred** | The project is JavaScript with no static typing (`jsconfig.json`, no TS dependency). Introducing a type layer is a separate decision, tracked in §4. |
| `src/lib/supabase/{client,server}.ts` | **not created** | Data access is a direct Postgres pool. The Supabase client (`src/lib/supabase.js`) is peripheral (storage/admin), not the data path and not the auth path. Repositories call the pool. |

### The one rule that makes the split worth it

> A service must never run SQL.

If a service runs SQL, its decision cannot be tested without a database, and it
becomes the module this split exists to break up. This is enforced by a test
(§6), not by convention.

### Two compatibility mechanisms

When a symbol moves, existing importers must keep working. Two devices are used,
both temporary and both deleted once `grep` finds no importer:

- **Model facades** — `src/models/authorization/<module>.js` becomes
  `export * from "@/services/…"`. Used for `resolver`, `scope`,
  `contextGrantReadiness`, `eligibility-admin`, `context`, `contextGrants`,
  `programAssignments`. Cost: a documented (shim-only) model→service edge.
- **Aggregating lib facades** — `src/lib/authorization/<module>.js` re-exports
  **both** the repository and the service (e.g. `eligibility`, `membership`).
  Used where the SQL stays in `models` and only the decision moved. This one
  creates **no** cross-layer edge, so it is preferred.

---

## 2. What is done

### Slice 1 — the authorization context

The decision module decided access **and** ran SQL **and** imported HTTP
(`src/models/authorization/resolver.js`, 583 LOC). Now split:

| Layer | File | What it holds |
|---|---|---|
| **Service** | `src/services/authorization/context.js` | Resolve effective access, merge grants/groups/profile/restrictions, gate on eligibility, `authorize`, `can`, `requireAuthorization`, the context cache, the row-shaping helpers. |
| **Service barrel** | `src/services/authorization/index.js` | Public entry point of the authorization service. |
| **Repository** | `src/models/authorization/contextReads.js` | The 8 reads, one function per query, SQL byte-identical. No decisions, no HTTP. |
| **Facade** | `src/models/authorization/resolver.js` | `export * from "@/services/authorization/context"`. |

### Slice 2 — the readiness report

`buildContextGrantReadiness` decided, ran two inline statements, and reached
into the resolver (the model→service edge slice 1 created). Now:

| Layer | File | What it holds |
|---|---|---|
| **Service** | `src/services/authorization/contextGrantReadiness.js` | The report — drift and impact computation. Asks the context service, not the model. |
| **Repository** | `src/models/authorization/contextGrantReadinessReads.js` | The two reads (contact row, sentinel-granted capabilities). |
| **Facade** | `src/models/authorization/contextGrantReadiness.js` | `export * from "@/services/…"`. |

### Slice 3 — the scope engine

`src/models/authorization/scope.js` decided record scope and ran six statements.
Now:

| Layer | File | What it holds |
|---|---|---|
| **Service** | `src/services/authorization/scope.js` | `resolveScopeIds` (policy dispatch), `resolveVentureScopeId`, `isWithinScope`, `isContactWithinStaffedPrograms`, the fail-closed rules. Re-exports the pure catalogue. |
| **Repository** | `src/models/authorization/scopeReads.js` | The four policy reads + the venture-id lookup + the shared-programme probe. |
| **Facade** | `src/models/authorization/scope.js` | `export * from "@/services/…"`. The pure catalogue stays in `./scope-catalog`. |

### Slice 4 — eligibility and membership decisions

Both modules mixed a pure decision with their queries. Now:

| Layer | File | What it holds |
|---|---|---|
| **Service** | `src/services/authorization/eligibility.js` | `evaluateEligibility` (the pure eligibility decision). |
| **Repository** | `src/models/authorization/eligibility.js` | The schema, the one-time seeds, the vocabulary (`MODULE_TO_FEATURE`, defaults). |
| **Service** | `src/services/authorization/membership.js` | `isEffectiveMembership`, `selectEffectiveGroups`, `applyMembershipAction`, `getEffectiveGroupsAndHistory`, `getEffectiveGroupsForUser`. |
| **Repository** | `src/models/authorization/membership.js` | Schema, one-time bootstrap, raw reads (`getMembershipRowsForUser`, `getMembership`, `isGroupProtected`, …), vocabulary (`INTERNAL_GROUP`, `MEMBERSHIP_ACTIONS`, `normalizeGroupName`). |

`src/lib/authorization/{eligibility,membership}.js` aggregate both layers, so
**no** cross-layer edge was created for these two.

### Slice 5 — eligibility administration

`src/models/authorization/eligibility-admin.js` held the eligibility vocabulary
and validators but also ran three statements, and reached into the eligibility
decision from the model layer. Now:

| Layer | File | What it holds |
|---|---|---|
| **Service** | `src/services/authorization/eligibilityAdmin.js` | The vocabulary (`FEATURE_KEYS`, `ROLE_CATALOG`, `ELIGIBILITY_IDENTITIES`, …), `validateEligibilityChanges`, `validateCapabilitiesWithinEligibility`, `assertTemplateCapsEligible`, `findTemplatesGrantingFeature`. |
| **Repository** | `src/models/authorization/eligibilityAdminReads.js` | The profile-capability read and the templates-granting read. The third read (eligibility rows for a role + groups) reuses `contextReads.getFeatureEligibilityRows` — no second copy of that statement. |
| **Facade** | `src/models/authorization/eligibility-admin.js` | `export * from "@/services/…"`. |

This move **removed the last real model→service edge**: the eligibility decision
is now asked for by another service (`./eligibility`), not by a model.

### Slice 6 — the scoped-access guard

`src/models/authorization/context.js` held the scoped decision path
(`requireScopedAccess`) and its three per-resource assignment resolvers, all
running their own SQL, and imported its decisions through the infrastructure
facade. Now:

| Layer | File | What it holds |
|---|---|---|
| **Service** | `src/services/authorization/scopedAccess.js` | `resolveContextAssignment` (program / project / venture), `requireScopedAccess`, the 401/403/500 answers. Imports `getAuthorizationContext` / `requireAuthorization` from `./context` — the same layer — instead of through the facade. |
| **Repository** | `src/models/authorization/contextAssignmentReads.js` | The program-staff, contact-role, project-member and venture-member lookups. |
| **Facade** | `src/models/authorization/context.js` | `export * from "@/services/…"`. |

Importing the sibling service instead of the facade also **avoids an import
cycle** the move would otherwise create (the facade tree re-exports this module).

### Slice 7 — the context-grant reconcile

The most sensitive module of the domain — it **writes** capability grants, not
just reads. `src/models/authorization/contextGrants.js` (626 LOC) held the grant
plan, the justification resolution and the reconcile orchestration, all running
their own SQL. Now:

| Layer | File | What it holds |
|---|---|---|
| **Service** | `src/services/authorization/contextGrants.js` | `SUPPORTED_CONTEXT_ROLES`, `contextGrantSentinel`, `planContextGrantChanges`, `resolveContextDesiredCaps`, `resolveContextJustification`, `syncContextGrantsForUser`, `syncAllContextGrants`, `syncContextGrantsOnConnect`, `syncAllContextGrantsEverywhere`, `revokeAllContextGrants`. No SQL. |
| **Repository** | `src/models/authorization/contextGrantsStore.js` | Every statement: the provenance schema, the reads that justify a grant, and the writes that apply/revoke it. This is the one repository module that also **writes** — the mechanism owns the rows it creates. |
| **Facade** | `src/models/authorization/contextGrants.js` | `export * from "@/services/…"`. Four suites `jest.mock` this exact path; a facade keeps those mocks intercepting. |

Its cache invalidator now imports the sibling `./context` service dynamically
(was `./resolver`); two suites' stubs moved to that path.

### Slice 8 — the program-assignment derivation (domain complete)

`src/models/authorization/programAssignments.js` held the per-assignment
capability derivation and expiry next to its SQL. Now:

| Layer | File | What it holds |
|---|---|---|
| **Service** | `src/services/authorization/programAssignments.js` | `UNCONFIGURED_LEVEL`, `resolveAssignmentCapabilityLevel`, `deriveFacilitatorDesiredCaps`, `deriveAssignmentsExpiry`, `assignmentsForRole`. No SQL. |
| **Repository** | `src/models/authorization/programAssignmentReads.js` | `listActiveProgramAssignments`, `listProgramAssignmentContacts`, `loadAssignmentLookups`, and the tolerant read for the optional profile column (`executeWithOptionalProfileColumn`). `isProgramEnded` stays here as a shared pure predicate the read uses. |
| **Facade** | `src/models/authorization/programAssignments.js` | Re-exports **both** the reads and the service. |

`src/models/authorization/programAssignmentBackfill.js` now imports the level
decision from the service explicitly, and the two services that consume the
derivation split their imports across the reads and the service.

### Slice 9 — the HTTP boundary (finishing the domain)

The last thing tying the domain to HTTP: `requireAuthorization` and
`requireScopedAccess` lived in the services and built `NextResponse` objects
themselves. They now return a **decision value**, and one boundary module owns
the response:

| Layer | File | What it holds |
|---|---|---|
| **Service** | `src/services/authorization/context.js` → `evaluateAuthorization` | `{ allowed, status, errorKey }` — no HTTP. |
| **Service** | `src/services/authorization/scopedAccess.js` → `evaluateScopedAccess` | the scoped decision, built on `evaluateAuthorization`. |
| **HTTP boundary** | `src/server/authz/responses.js` | `requireAuthorization` / `requireScopedAccess`: map a decision to `null \| NextResponse`. This is the **only** place left where an authorization decision meets HTTP. |

Every existing caller keeps its exact contract (`if (authError) return
 authError;`) — the barrel re-exports the boundary functions from their new
 home, so no route changed. The services are now provably HTTP-free: a guard
 test fails if any file under `src/services/**` imports `next/server`.

**Unchanged throughout:** the SQL (byte-identical), the wave/round-trip
structure, the merge semantics, the fail-closed rules, and every returned field.

### Verification

| Check | Result |
|---|---|
| Full suite `npm test` | **228 suites, 3015 tests, all passed** |
| `npx eslint .` | 0 errors (6 pre-existing warnings elsewhere) |
| `npm run build` | green |
| Cold-resolution round trips | unchanged (3 waves — pinned by `db-sequencing.test.js`) |

### Domain 2 — finance (slice 10)

The first slice outside authorization. `src/models/finance/ingest.js` (415 LOC)
brought the finance sheets in: it **parsed** them (sheet → budget lines and
transactions) *and* ran the sync's SQL (the data-source lookup, BEGIN/COMMIT/
ROLLBACK, the upserts, the status/log writes). Now:

| Layer | File | What it holds |
|---|---|---|
| **Service** | `src/services/finance/ingest.js` | The three sheet parsers and the sync orchestration (`ingestFromSheet`, `syncDataSource`). No SQL. |
| **Repository** | `src/models/finance/ingestStore.js` | Every statement: the lookups, the transaction control, the upserts, the sync-log and data-source status updates. |
| **Facade** | `src/models/finance/ingest.js` | `export * from "@/services/…"` (the sync route reaches it via `@/lib/finance/ingest`). |

**Unchanged:** the SQL (byte-identical), the parsing rules, the transaction
boundaries and the returned counts.

**Finance slice 11 — the reads/aggregation.** `src/models/finance/queries.js`
(395 LOC) resolved the data source, aggregated the figures and ran the SQL in the
same module. The resolution and aggregation (`resolveDataSource`, `getSummary`,
`getMonthly`, `getTransactions`, `getBudgetLines`, `insertTransaction`,
`getDataSources`) moved to `src/services/finance/queries.js`; every statement to
`src/models/finance/queriesStore.js`. **The finance domain is now complete.**

### Domain 3 — programs (slice 12)

`src/models/kpi-progress.js` (279 LOC) computed an objective's completion rate
*inside* the loop that read its rows. The rate and the cache policy now live in
`src/services/programs/kpiProgress.js`; every statement (objectives, active
participants, deliverables, approved submissions, cache clear/rewrite, last-
calculated read) in `src/models/kpiProgressStore.js`. The rate is unchanged:
approved (participant × deliverable) pairs, counted once each, over active
participants × linked deliverables.

The rest of the programs domain was already repository-shaped: `programs.js`,
`programMembership.js`, `curriculum.js`, `teams.js` and `programWorkspace.js` are
one-function-per-query modules with no decision mixed in. What still carries
programs logic is the **controllers**.

**Programs slice 13 — the manager-change controller.**
`PUT /api/pm/programs/[id]/manager` did the domain work itself (the unchanged
check, the dangling-cid guard, the write, the reconciliation of both sides).
That work moved to `src/services/programs/programManager.js`
(`changeProgramManager` → `{ status, errorKey, body }`). The route keeps what a
controller owns: the `programs.edit` gate, the two-ways-in repair policy,
validation and response shaping.

### Domain 4 — contacts / CRM (slice 14)

`src/models/contact-group-sync.js` (304 LOC) resolved the contact, decided the
fill-only writes and ran three reconciliation statements. The decisions now live
in `src/services/contacts/contactGroupSync.js`; every statement in
`src/models/contactGroupSyncStore.js`. The file is a re-export facade (the
full-state route reaches it via `@/lib/contact-group-sync`).

**Not changed:** the idempotent, additive, fill-only semantics; the one-run-per-
window reconciliation guard; the byte-identical SQL.

### Domain 5 — ventures (slice 15)

`src/models/ventureDocumentTypes.js` (319 LOC) mixed the decisions (seed only
when empty, fall back to the built-in set, unique code, delete guards, who may
manage) into the functions that ran the SQL. Now: decisions in
`src/services/ventures/ventureDocumentTypes.js`, every statement in
`src/models/ventureDocumentTypesStore.js`, both re-exported by the
`ventureDocumentTypes.js` facade. The injectable `database` argument the tests
rely on is threaded through unchanged.

**A test caught a real regression here** (a missing `if (!ventureId) return []`
guard) — proof the suites are doing their job on a move like this.

### Domain 6 — LMS (slice 17)

`src/models/lms/learning.js` (680 LOC) — the learner experience: structure and
progress loads, enrollment access, lesson completion, assessment submission and
certificate finalisation, all mixing the decision with the statements. Now: the
decisions in `src/services/lms/learning.js`, every statement in
`src/models/lms/learningStore.js`, the model file a re-export facade. The pure
`computeCourseProgress` / `findContinueLesson` moved with the service; the
injectable fake database the suite uses still drives both layers.

One suite pinned the payload's SOURCE file (`lms-section-resource-learner-files`);
it now reads the service instead of the model — same assertion, new home.

**LMS slice 18 — the paid checkout.** `src/models/lms/checkout.js` (514 LOC)
resolved the price, decided what a run sells, captured the registration, granted
the course access and minted the access/resume links — all in the same functions
that ran the SQL. Now: the decisions in `src/services/lms/checkout.js`, every
statement in `src/models/lms/checkoutStore.js`, the model file a re-export
facade (reached by the LMS routes and the public checkout through
`@/lib/lms/checkout`).

The public surface is preserved: the pure insert/read wrappers
(`findContactForPurchase`, `insertPurchaseContact`, `insertPurchaseEnrollment`) and
the re-exported registration writes (`recordPaymentEvent`, `markRegistrationPaid`,
`setEmailState`, `setAccessState`) keep their names.

Two suites pinned the SOURCE file and were repointed, same assertion, new home:
`lms-access-token-schema` now reads the store (it asserts the access INSERT omits
the invite-only `token_type`), and `login-next-redirect` reads the service (it
asserts the setup-password link carries `next`).

**Unchanged:** the SQL (byte-identical), the server-side price, the neutral
answers to strangers, the window/link rules, and every returned field.

---

### Domain 7 — workspace (slice 19)

`src/models/workspace.js` (792 LOC) is largely a repository: one statement per
function. Exactly one function mixed a decision with its SQL —
`getCalendarVentureSessions`, which DERIVED a person's Venture scope (membership
∪ active staff assignment), expanded the codes to the internal ids and chose the
"no scope" sentinel, then ran three statements in the same body. Now: the
derivation in `src/services/workspace/calendar.js`, the three statements in
`src/models/workspaceCalendarStore.js`. The `workspace.js` file keeps its
repository functions and re-exports the moved one — the model-level shim device,
because the file is not otherwise a facade.

The characterisation suite (`venture-session-calendar`) drives the function
through the fake database unchanged; it now reads the service in its header.

**Unchanged:** the SQL (byte-identical), the scope semantics, the sentinel and
the coach leg.

---

### Domain 8 — ventures, plan import (slice 20)

`src/models/venturePlanImport.js` (1225 LOC) is the biggest mixed module left:
it interpreted an uploaded tracker into a proposal, validated it against the
platform, kept the draft and turned an approved draft into journey rows —
resolving owners, choosing the first-journey status and running the SQL in the
same functions.

| Layer | File | What it holds |
|---|---|---|
| **Service** | `src/services/ventures/planImport.js` | The prompt shaping, `normalizeJourneys`, `deriveProposalDates`, `validateDependencyRefs`, owner resolution, the interpretation and the plain-language correction, the draft decisions (supersede, recompute stats) and the whole `applyPlanImport` orchestration (first-journey rule, orders, labels, edges, change log). |
| **Repository** | `src/models/venturePlanImportStore.js` | Every statement: the owner lookups, the existing-programme reads, the draft CRUD, and the structural writes. |
| **Facade** | `src/models/venturePlanImport.js` | `export * from` + `export { default } from` the service. |

**Keeping the transaction in service hands without running SQL there.** The two
multi-statement operations must stay in ONE transaction, and one of them (apply)
needs the in-transaction `MAX(stage_order)` to decide the first journey's status.
Rather than move that decision into a store that owns the transaction (which the
rule forbids), the store exposes `runInTransaction(fn)` — the same
"`db` as a parameter" device `src/lib/ventureJourneys.js` already uses — and every
statement that runs inside a transaction takes its `query` runner as the first
argument. The service still writes no SQL: it calls store functions.

The `initDb()` the module used to call defensively is gone: the plan-import
controller already initialises the database, like every other migrated service's
controller.

**Unchanged:** the SQL (byte-identical, same statement order), the transaction
boundaries, the single statement per structure write, every returned field, and
the guarded, once-only apply.

---

### Domain 9 — platform, Run report (slice 21)

`src/models/platform/ai/report.js` (489 LOC) shaped the prompt, parsed and
validated the model's answer, and read/wrote the stored report in the same
functions. Now: the decisions in `src/services/platform/report.js`, every
statement in `src/models/platform/ai/reportStore.js`, the model file a re-export
facade. The on-demand table guard (`ensureSubmissionReportsTable`, memoised) moved
with the statements — the suite resets the module registry to re-check it.

**`models/platform/ai/email-personalize.js` is pure** — no imports, no SQL, no
HTTP. It is the service-side shaping already, so there is nothing to split; the
files that call it as a library keep importing it (`@/lib/platform/ai/email-personalize`).

**Unchanged:** the SQL (byte-identical), the prompt text, the parsing bounds, the
report key and every returned field.

### Domain 4 (cont.) — the CRM decision helpers (slice 22)

Five CRM/platform modules were checked; only the genuine `decision + SQL` helpers
were split, each keeping its model file as a re-export shim:

| Module | Function | Service + store |
|---|---|---|
| `models/communications.js` | `listMessagesForScope` (the visibility policy) | `services/communications/messageScope.js` + `models/messageScopeStore.js` |
| `models/contacts.js` | `findContactByEmail` (normalise + empty-input guard) | `services/contacts/contactLookup.js` + `models/contactLookupStore.js` |
| `models/groups.js` | `upsertV2ParticipantActiveWithFallback` (the no-constraint fallback) | `services/contacts/participantSync.js` + `models/participantSyncStore.js` |
| `models/formRuns.js` | `listFormRunsPage` (the page + its matching total) | `services/platform/formRunList.js` + `models/formRunListStore.js` |

**Unchanged:** the SQL (byte-identical), the assembled visibility clauses, the
fallback path, the window-count/fallback total and the response shapes.

**Checked and NOT split (repository shaping, per the `countApprovedSubmissions`
precedent):** `countNonDraftSubmissionsByRunId`'s two branches and
`buildRunListFilter`/`countFormRuns` in `formRuns.js`; every conditional query in
`forms.js`. Each only adds a filter or picks a clause — no decision plus SQL in one
function.

---

### Domain 10 — the controller frontier: inline SQL (slice 23)

30 `src/app/api/**/route.js` files still ran `db.execute`/`db.transaction` inline
(the ~290 that import `@/lib/db` only for `initDb` were never SQL); 22 of them sat
under `ventures/`. Each statement is now extracted into the model that owns its
data — `models/ventureWorkspace.js` for the workspace reads/writes,
`models/workspaceCalendarStore.js` for the transverse calendar,
`models/ventureJourney.js` for the Journey stage CRUD — the controller keeping
only auth, validation and response shaping. **No route file runs SQL any more.**

Gate `npm run build` and the 228 suites are unchanged, which is the point: the
SQL travels byte-identical, one function per query, and behaviour does not move.

Two corrections to the original inventory:

- `platform/form-runs` was counted, but runs **no** SQL: the only `db.execute`
in it was a comment documenting the removed raw-SQL `migrate` action.
- `ventures/[id]/journey` was assumed done; it was not. Its stage CRUD (add,
edit, activate, lock, reset, milestone hold) and its three roadmap reads
(milestones, deliverable evidence, task counts) are now functions in
`models/ventureJourney.js`, under the section the file had already reserved.

**Unchanged:** every statement (byte-identical, same order), the progressive
fallbacks (milestones → legacy columns; tasks → without the archive filter;
deliverable evidence reported as unavailable instead of silently empty), the
author flags and the sealed/unsealed projection.

---

### Domain 11 — the Journey stage/archive/template engine (slice 24)

`src/lib/ventureJourneys.js`, `src/lib/ventureJourneyArchive.js` and
`src/lib/ventureJourneyTemplates.js` decided **and** ran their own SQL, behind a
`db`-as-first-argument API. The decisions now live in
`src/services/ventures/journey.js`; every statement in
`src/models/ventureJourneyStore.js`; the three `src/lib` files are re-export
facades. The `db` argument is gone from the call sites (the store imports its
own db), so the eight journey routes dropped it — nothing else changed.

| Layer | File | What it holds |
|---|---|---|
| **Service** | `src/services/ventures/journey.js` | The stage read fallback, the ordered swap, the re-serialised delete, the filed-work guard, the template naming/first-stage/continued-numbering decisions and the counters. |
| **Repository** | `src/models/ventureJourneyStore.js` | The stage table guard + CRUD, the archive/restore/cascade-delete statements, and the template library save/apply statements — the transaction `query` runner as first argument. |
| **Facades** | `src/lib/ventureJourneys.js`, `src/lib/ventureJourneyArchive.js`, `src/lib/ventureJourneyTemplates.js` | `export` from the service, unchanged names. |

**Keeping the transaction in service hands without running SQL there.** The
swap, the cascade delete and the template copies must each stay in ONE
transaction; the store exposes `runInTransaction(fn)` and every statement inside
it takes its `query` runner as the first argument — the same device the plan
import established (slice 20). The service still writes no SQL.

**One documented cross-layer edge:** the store's `milestoneHasFiledWork` borrows
the db for `@/lib/ventureArchive`'s probe (that module is not migrated yet), the
same kind of temporary edge as `models/authorization/contextGrantReadiness`.

**Unchanged:** the SQL (byte-identical, statement order, argument order — two
suites pin the exact insert arg positions), the transaction boundaries, the
`Template has no stages.` behaviour inside the apply transaction, the archive
"never blocked" rule and the delete block reason.

---

### Domain 12 — the archive + duplication engines (slice 25)

`src/lib/ventureArchive.js` (milestone/task soft delete) and
`src/lib/ventureDuplication.js` (independent structure copies) decided and ran
their SQL in the same functions, behind `db`-as-first-argument APIs. Same
recipe: decisions in `src/services/ventures/archive.js` and
`src/services/ventures/duplication.js`, statements in
`src/models/ventureArchiveStore.js` and `src/models/ventureDuplicationStore.js`,
the two `src/lib` files reduced to re-export facades, and the `db` argument
dropped from the four archive/duplicate routes.

**The Journey edge is closed.** Domain 11 left a temporary store→lib edge (the
Journey store borrowing the db for `ventureArchive`'s probe). Now that the
probe is a service decision, `services/ventures/journey.js` imports
`milestoneHasFiledWork` from `services/ventures/archive` — service → service,
no store→lib edge left.

**Unchanged:** the SQL (byte-identical, argument order — `venture-duplication.test.js`
pins the exact insert arg positions and the re-parenting through `copy-N` ids),
the transaction boundaries, the status resets (`upcoming` / `not_started` /
`backlog`), the filed-work guard and the collision-safe stage re-serialisation.

---

### Domain 13 — milestone ordering + the controller leftovers (slice 26)

Two things in one slice. **Milestone ordering**: `src/lib/ventureMilestoneOrder.js`
moved to `src/services/ventures/milestoneOrder.js` (the normalise-then-swap
decision) over `src/models/ventureMilestoneOrderStore.js` (the read + the two
writes), the `src/lib` file a facade and the reorder route no longer passing `db`.

**The controller leftovers** the slice-23 sweep missed are extracted too — see
"Controller frontier" in §4 for the correction, the eleven call sites and the
audit command that finds them. `models/authorization.js` and `models/investor.js`
gained named list functions where a route used to hand raw SQL to
`runSafeQuery` / `runQuery`.

**Unchanged:** the SQL (byte-identical), the ordered-swap semantics, the
resilient degrade-to-empty behaviour of the permissions reads, and the
executive-dashboard response shape.

---

### Domain 14 — the Venture access facts (slice 27)

`src/lib/ventureAccessFacts.js` answered (and cached) the two questions every
Venture screen asks — the Venture's own row and the viewer's relationship to it —
while running its SQL inline. The cache decision (share the PROMISE, never
remember a failure, a 10 s window) now lives in
`src/services/ventures/accessFacts.js`; the two statements in
`src/models/ventureAccessStore.js`; the `src/lib` file a facade.

**`src/lib/ventureAuth.js` is now SQL-free.** It had no statement of its own —
everything went through the access facts — so once those moved, its five
`db` parameters had nothing left to feed. They are gone: `requireVentureAccess(id)`,
`isStaffActorForVenture(id, session)`, `hasActiveVentureAssignment(code, cid)`,
`resolveVentureLifecycle(id)` and `requireOperationalVentureAccess({ ventureId,
… })` no longer take a db, and the ~107 call sites across 36 route files dropped
it (leaving an unused `db` import behind in 30 of them, now removed).

**Unchanged:** the SQL (byte-identical), the cached-promise semantics, the
permission answers, and every guard's verdict.

---

### Domain 15 — the permission engine + the milestone engine (slice 28)

`src/lib/venturePermissions.js` evaluated capability against the matrix while
running its SQL, and `src/lib/ventureMilestoneEngine.js` decided availability,
authority and milestone status the same way. Both are now service + store:
`services/ventures/permissions.js` over `models/venturePermissionStore.js`, and
`services/ventures/milestoneEngine.js` over
`models/ventureMilestoneEngineStore.js` (which also owns the dependency guard
and the held-statuses constants, right beside the SQL they belong to). The two
`src/lib` files are re-export facades.

**The db threading is gone.** `hasVentureCapability`, `canManageMilestones`,
`syncMilestoneFromWork`, `activateDueStages`, `completeStageIfAllMilestonesDone`,
`assertBookableMilestone` — none take a db any more, and neither does the engine's
`resolveVentureCode`. `canDefineDeliverables` lost its (unused) db too; the
permission service reads the identity store, and the engine service reads the
permission service (service → service, no store→lib edge).

**Two source-pinning suites were repointed** (same assertion, new home): the
dependency-guard check in `venture-dependencies` and in
`staging-venture-progression` now read `models/ventureMilestoneEngineStore.js`.
The suites that injected a db double into the engine or the permission checks
now drive the module mock instead — the same pattern the plan-import suites use.

**Unchanged:** every statement (byte-identical, including the guard and the
sweep ordering), the authority answer, the availability rules and the status
derivations.

---

### Domain 16 — assignment scope + operating-plan access (slice 29)

`src/lib/ventureScope.js` (assignment scope matching for review actions) and
`src/lib/ventureOperatingPlans.js` (operating-plan access + the plan template
library) decided and ran their SQL. Now: `services/ventures/scope.js` over
`models/ventureScopeStore.js`, and `services/ventures/operatingPlans.js` over
`models/ventureOperatingPlanStore.js`; both `src/lib` files are re-export
facades.

**Db threading gone again.** `getAssignmentScopes`, `resolveTaskContext`,
`listTaskScopeContexts`, `resolveVentureCode` (scope form), `resolvePlanAccess`,
`allowsPlanAction`, `listPlanTemplates`, `createTemplateFromPlan` and
`applyTemplateToVenture` no longer take a db, so `canReviewDeliverable` lost its
(unused) db too. Seventeen routes plus `ventureDeliverables.js` and `ventures.js`
dropped the argument (and twelve of them their now-unused `db` import).

**Unchanged:** the SQL (byte-identical), the scope-match rules, the
fail-closed/allow-on-error postures, the write-requires-venture-wide rule and the
structure-only template copy.

---

### Domain 17 — readiness + notifications (slice 30)

`src/lib/ventureReadiness.js` (the weighted roadmap score) and
`src/lib/ventureNotify.js` (founder / coach / Lead-Manager delivery) decided and
ran their reads inline. Now: `services/ventures/readiness.js` over
`models/ventureReadinessStore.js`, and `services/ventures/notify.js` over
`models/ventureNotifyStore.js`; both `src/lib` files are re-export facades.

`computeRoadmapReadiness`, `notifyAndEmailVentureFounders`, `notifyVentureCoach`
and `notifyVentureLeadManagers` take no db, so the three importing routes
dropped it (`investment-readiness`, `sessions`, `…/submissions`). The three
notify functions share one `renderEmailHtml` instead of three copies of the same
markup — the only behavioural-neutral tidy-up in the move.

**Unchanged:** the SQL (byte-identical), the readiness weights and the
renormalisation, the audience rules (founders / one coach / every active Lead
Manager), the dedupe suffixes and the per-recipient isolation.

---

### Domain 18 — venture progress reports (slice 31)

`src/lib/ventureReports.js` validated report input and shaped the portfolio rows
while running its SQL. The validation and the mapping now live in
`src/services/ventures/reports.js`; every statement in
`src/models/ventureReportStore.js`; the `src/lib` file a facade. The two
importing routes (`progress-reports`, `journey-reports`) dropped the db argument.
The `venture-label-surfaces` source-pinning suite was repointed to the service
(same assertion, new home).

---

### Domain 19 — the Venture coach identity/invitation layer (slice 32)

`src/lib/ventureCoach.js` resolved a Venture's coach contact and invited coaches
while running its SQL. The decisions now live in `services/ventures/coach.js`,
every statement in `models/ventureCoachStore.js`; the `src/lib` file is a facade.
`resolveCoachContact` and `inviteCoachByEmail` take no db, so the `sessions` and
`coach-invite` routes dropped it (both routes no longer import the db at all).

**Unchanged:** the SQL, the coach-contact resolution and the invitation payload.

---

### Domain 20 — the `ventures.js` monolith: activity, history, notifications (slice 33)

`src/lib/ventures.js` is the largest module of the split (5.8k lines, ~219
exported functions, ~11 domains), so it is taken **domain by domain**. Each domain
extracts to its own `models/<x>Store.js` + `services/ventures/<x>.js`, and
`src/lib/ventures.js` becomes a barrel that re-exports them, keeping the public
surface (`@/lib/ventures`) intact for the many importers.

**Domain 1 — activity, history and notifications.** The three streams every
Venture write path feeds: the activity log (`logVentureActivity`), the
institutional history (`addVentureHistory`) and the in-app inbox
(`createVentureNotification`, `notifyVentureFounders`). The decisions — how a
notification's context columns are assembled, the dedupe probe and the founder
audience — now live in `services/ventures/activity.js`; every statement in
`models/ventureActivityStore.js`; and `src/lib/ventures.js` re-exports the four
functions. The internal `await import("./ventures")` call sites inside the file
keep working through the barrel; the routes that import them from
`@/lib/ventures` are untouched.

**Unchanged:** the SQL (byte-identical), the notification column order, the
dedupe keys (including the `sa:` suffix) and the founder/`sa` audience.

---

### Domain 21 — the `ventures.js` monolith: the startup-profile wizard (slice 34)

**Domain 2.** The 6-step startup-profile wizard: its per-step validation rules
and completion weighting (pure), the profile/progress readers and writers, the
document upsert, and the edit/read access checks. Everything moves to
`services/ventures/profile.js`; every statement to
`models/ventureProfileStore.js`; `src/lib/ventures.js` re-exports the whole
surface (constants included) so the wizard page, its two routes and the
dashboard route are untouched. `submitStartupProfile` now imports the activity
helpers from the sibling `services/ventures/activity` instead of dynamically
importing the monolith — the barrel was only needed before the split.

**Unchanged:** the SQL (byte-identical), the step keys and column names, the
completion weights, the access rules (super-admin, founder by email, founder
member, delegated staff by assignment) and the document file-type allow-list.

---

### Domain 22 — the `ventures.js` monolith: founders & co-founders (slice 35)

**Domain 3.** The founder roster: the role catalogue and labels, the manage
check, the roster read, invitation / re-invitation, role and detail edits,
removal (with the last-owner guards), ownership transfer and suspension /
reactivation. The decisions move to `services/ventures/founders.js`; every
statement to `models/ventureFoundersStore.js`; `src/lib/ventures.js` re-exports
the whole surface so the five founder routes and the admin page are untouched.
The three activity log calls (`FOUNDER_REMOVED`, `OWNERSHIP_TRANSFERRED`,
`USER_SUSPENDED`/`USER_REACTIVATED`) now import the sibling
`services/ventures/activity` instead of dynamically importing the monolith.

**Unchanged:** the SQL (byte-identical), the role list, the last-owner / ownership
transfer guards, the suspension rules and the append-only `ownership_history`
write.

---

### Domain 23 — the `ventures.js` monolith: verification (the Data bank) (slice 36)

**Domain 4.** The whole compliance-file domain: the verification record and its
items, the founder submission / reviewer sign-off (approve/reject/suspend, per
item or whole) / resubmission flows, the document uploads, the document-version
history and the comments. Decisions move to
`services/ventures/verification.js`; every statement to
`models/ventureVerificationStore.js`; `src/lib/ventures.js` re-exports the whole
surface so the verification routes and the staff Venture page are untouched. The
three activity log calls now import the sibling service, and the document-type
model imports moved with the domain (they were used nowhere else).

**Unchanged:** the SQL (byte-identical), the required/upload-backed
missing-document gate, the `resolveVentureCode`-gated sign-off rule, the status
transitions and the version-numbering rule (first upload = version 1).

---

### Domain 24 — the controller frontier: `api/projects` (slice 37)

**The first slice on the controller layer itself.** The model modules are now
split, so the remaining domain logic is the orchestration inside
`src/app/api/**/route.js` (§4, "Controllers are the new frontier"). This slice
takes the projects domain, `services/projects` did not exist.

`src/app/api/projects/route.js` (389 lines, four verbs) drops to an HTTP shell:
`initDb`, the capability / object-access guards, request validation, and the
response envelope. The use cases move to `services/projects/workspace.js` —
what a project action *does*:

- **the portfolio access rule** — which roles see every project, and the 403 a
  non-portfolio caller gets when they ask for somebody else's rows
  (`seesWholeProjectPortfolio`, `resolveProjectListFilter`); the same rule was
  inlined three times in the route (GET, PUT, DELETE);
- **lead resolution** — `resolveCreateLeads` (single id folded into the list, the
  first lead becomes the legacy `owner_id`) and `resolveUpdateLeads`
  (`undefined` ≠ `[]`: not sent leaves the leads alone, sent-empty removes them);
- **the meta merge** — `hasProjectMetaChanges` + `mergeProjectMeta` compose the
  `meta` JSON over what is stored, so only the keys a request mentions change;
- **the write order** — create → lead members → notifications; update → lead
  re-sync; delete members → delete project.

The one piece of SQL-shaped text the route used to hold — the dynamic `SET`
fragment — moves to a pure repository builder, `projectUpdateClause` in
`models/projects.js`, so **no SQL text crosses back into the service layer**.
It keeps key order, so the built statement is byte-identical.

`services/projects/index.js` is the new barrel. `npm test` (228 suites),
`npx eslint` (0 errors) and `npm run build` are green; `projects-api.test.js`
was the characterisation net and is unmodified — its SQL-substring mocks confirm
the statements are byte-identical.

**Deliberately left:** the `projects/*` siblings (`assignments`, `discuss`,
`invitations`, `members`) still held their own orchestration at this point — done
next, in slice 38.

---

### Domain 24 (cont.) — the controller frontier: the project collaboration routes (slice 38)

The rest of the projects domain: `members` (list / invite / remove),
`assignments` (the grouped dropdown), `discuss` (message + fan-out),
`invitations` (list) and `invitations/respond` (accept / decline / cancel).
These routes had no characterisation test, so the slice wrote one first
(`src/__tests__/projects-collaboration-api.test.js`, 27 tests over the decision
paths), then moved the use cases to `services/projects/collaboration.js`:

- **the invite / re-invite sequence** — any pending invitation for the same
  person is declined before the new one is written, so nobody sits on two live
  invitations;
- **the assignments grouping** — the own-scope rule, the three reads that fail
  OPEN (a failing dropdown is empty, never a 500) and the deduplicated union;
- **the discussion fan-out** — the owner, then every member (sender excepted,
  each person once), then @mentions resolved by name, all deduplicated; the
  fan-out fails SOFT so a notification problem cannot lose the message;
- **the invitation response rules** — only the inviter cancels (resolved to a cid
  first, so a namesake cannot), only the invitee accepts/declines, and the accept
  flow joins the project then tells the inviter.

The shared own-scope rule is extracted once (`resolveOwnScope`) and
`resolveProjectListFilter` from slice 37 now delegates to it.

**Source-pin repointed:** `security-lot6-hardening` pinned the cancel rule's
source line (`String(session.cid) === String(inviterCid)`) inside the route; the
same assertion now reads it in its new home, the service. The invariant is
unchanged.

`npm test` (229 suites, 3135 tests), `npx eslint` (0 errors) and
`npm run build` are green. The projects domain is now controller-clean.

---

### Domain 25 — the controller frontier: the task action routes (slice 39)

Opens the tasks domain, which the earlier audit listed as not started. The
domain has eleven routes; this slice takes the six that carry real decisions and
leaves `tasks/route.js` (1698 lines) and the remaining small routes for the next
steps.

**A shared decision is promoted first.** The "who may see the whole portfolio"
rule (the `super_admin` / `staff` / `program_manager` list, and the own-scope
filter built on it) was copy-pasted across projects, tasks, contacts and
invitations. It now lives once in `services/authorization/listingScope.js`
(`PORTFOLIO_ROLES`, `seesWholePortfolio`, `resolveListingScope`); the projects
services from slices 37–38 delegate to it and re-export their old names, so
nothing else changed.

Moved to `services/tasks/*`, one route at a time, each keeping its existing test
or gaining a new characterisation net (`tasks-actions-api.test.js`, 31 tests):

- **`carryover`** → `services/tasks/carryover.js` — the ownership rule, the chain
  walk (clone the newest OPEN copy), the completed/archived guard (409) and the
  idempotency guard, plus the migration order (clone → blockers → comments →
  resources → subtasks → flip). `carryover-api.test.js` was the net and is
  untouched.
- **`approve`** → `services/tasks/approval.js` — approve links the task to its
  project, reject demotes it to standalone, and the schema-drift branch (the
  approval table missing) is preserved as a 200 "not available" answer.
- **`reconcile`** → `services/tasks/reconcile.js` — the retro batch: the
  own-scope check, the three allowed outcomes, and the per-row "Not your task"
  that never fails the whole batch.
- **`assignments`** → `services/tasks/assignments.js` — the list scope, and
  accept/decline/reassign with the contact-group gate.
- **`assignment-action`** → `services/tasks/assignmentAction.js` — the assigned
  person's accept/decline/complete, including ancestor completion on finish.

**On the audit trail.** `logAuditEvent` / `logTaskEvent` are part of the action
— their ordering after the write is load-bearing — so they move with the use
case into the service, not into the route. The service layer is allowed to
import `lib/**` infrastructure (`SERVER_LAYERS.md`), and this keeps the
controllers thin, which is the point of the phase. The only rule that would
forbid it is the model-layer one ("models must not audit silently"); a service
is not a model.

**Source-pin repointed:** `security-lot3-admin-authz` pinned the carry-over
ownership message inside the route; the same assertion now reads the service.

`npm test` (230 suites, 3183 tests), `npx eslint` (0 errors) and
`npm run build` are green.

**Left for the next slices:** `tasks/route.js` (the 1698-line monolith),
`tasks/{comments,duplicate,resources,logs,notify-deadlines}`.

---

### Domain 25 (cont.) — the controller frontier: the task sub-resource routes (slice 40)

Finishes every task route except the monolith. The five share one decision, so
it is extracted first: **may this caller touch this task?** — a portfolio role,
or the task's owner, assignee or supervisor. It becomes
`services/tasks/access.js` (`ownsTask`, `canAccessTask`), used by comments,
resources, logs and duplication; the carry-over service from slice 39 drops its
private copy and imports it.

Moved to `services/tasks/*`, each with a new characterisation net
(`tasks-subresources-api.test.js`, 44 tests):

- **`comments`** → `services/tasks/comments.js` — list/post with the
  owner+assignee+@mention fan-out, and the author-only edit/delete. The sender
  identity is resolved in the CONTROLLER (it is authentication data, and the
  `security-lot3` pin reads it there), and passed in already resolved.
- **`resources`** → `services/tasks/resources.js` — add/remove, gated through the
  owning task's access rule.
- **`duplicate`** → `services/tasks/duplicate.js` — the copy plus its subtasks,
  stamped with the current week (the local week-number helper moves with it).
- **`logs`** → `services/tasks/logs.js` — the assignment trail, task-access gated.
- **`notify-deadlines`** → `services/tasks/deadlines.js` — the cron reminder; the
  `CRON_SECRET` gate stays in the controller (authentication, not domain).

`npm test` (231 suites, 3258 tests), `npx eslint` (0 errors) and
`npm run build` are green.

**Left:** `tasks/route.js` alone — the 1698-line monolith, the final tasks slice.

---

### Domain 25 — the `ventures.js` monolith: milestones & deliverables (slice 39)

**Domain 5.** The milestone read, the deliverables of a milestone, and the
deliverable create / update — including the evidence-submission and review
workflow and the milestone progress recount. Decisions move to
`services/ventures/deliverables.js`; every statement to
`models/ventureDeliverablesStore.js`; `src/lib/ventures.js` re-exports the five
functions. The critical `deliverable-update-sql` suite (one assignment per
column, `status` once, canonical `progress` column) still passes byte-for-byte.

**Unchanged:** the SQL (byte-identical), the allowed-column list, the Map-based
approval workflow and the progress percentage.

---

### Domain 26 — the `ventures.js` monolith: tasks, dependencies, comments, attachments (slice 40)

**Domain 6.** The Kanban task layer: the task list and row, create / update /
delete, the task-to-task dependency graph (cycle guard + `db.transaction`
replace + block-state sync + release), and the comments and attachments.
Decisions move to `services/ventures/tasks.js`; every statement to
`models/ventureTasksStore.js` (which owns `runInTransaction` and the two
cursor-taking edge writes); `src/lib/ventures.js` re-exports the whole surface.
The task-column normalizers (`dateOrNull` / `textOrNull` / `cidOrNull`) and the
status vocabulary left the monolith with the domain.

**Unchanged:** the SQL (byte-identical, including the `SELECT id, status`
block-state read and the quoted completed-status list), the cycle refusal as a
whole, and the manual-block-preserving rule.

---

### Domain 27 — the `ventures.js` monolith: project timeline & dependencies (slice 41)

**Domain 7.** The project progress roll-up (weighted milestones/tasks/
deliverables), the timeline rows and their Gantt arrangement, the delay
detection summary, and the generic dependency edges. Decisions move to
`services/ventures/timeline.js`; every statement to
`models/ventureTimelineStore.js`; `src/lib/ventures.js` re-exports the six
functions. `services/ventures/planImport.js` (which calls `addDependency`) still
imports it through the barrel — unchanged.

**Unchanged:** the SQL (byte-identical), the 40/40/20 weighting, the per-status
progress mapping, the overdue/delay rules and the transitive cycle refusal.

---

### Domain 28 — the `ventures.js` monolith: reports & project analytics (slice 42)

**Domain 8.** The analytics roll-up (summary, KPIs, chart data), the milestone
and task report queries, the team-productivity report and the CSV-friendly
export rows. Decisions move to `services/ventures/analytics.js`; every statement
to `models/ventureAnalyticsStore.js` (which owns the dynamic task-report
filters); `src/lib/ventures.js` re-exports the five functions so the reports
route is untouched.

**Unchanged:** the SQL (byte-identical), the 40/40/20 completion weighting, the
health penalty, the productivity score and the trend aggregation.

---

### Domain 29 — the `ventures.js` monolith: coach & mentor management (slice 43)

**Domain 9.** The coach catalog (list / read / create / update / delete) and the
per-Venture assignment layer (list, assign with the active/primary/duplicate
rules, scoped removal with its activity log). Decisions move to
`services/ventures/coaches.js`; every statement to
`models/ventureCoachesStore.js`; `src/lib/ventures.js` re-exports the eight
functions so the coaches/coaching routes are untouched. (Distinct from the
`coach`/`ventureCoachStore` pair of slice 32, which backs the coach identity and
invitation layer; the exports catalog `coaches` keeps the two apart.)

**Unchanged:** the SQL (byte-identical), the JSON wrapping of the multi-value
columns, the assignability rules and the removal scope.

---

### Domain 30 — the `ventures.js` monolith: mentoring sessions & scheduling (slice 44)

**Domain 10.** The session catalogue (list / read with notes, attendance and
action items), the double-booking check, the create / update / cancel /
reschedule / delete flow (with the legacy-column fallbacks and the scheduling
floor), the notes, the attendance upsert and the action items. Decisions move to
`services/ventures/sessions.js`; every statement to
`models/ventureSessionsStore.js`; `src/lib/ventures.js` re-exports the twelve
functions. The `isUnknownColumnError` / `SESSION_MIN_LEAD_MINUTES` imports left
the monolith with the domain.

**Unchanged:** the SQL (byte-identical, including the two fallback INSERTs and
the three literal-action activity rows), the overlap rules, the scheduling floor
and the action-item scope.

---

### Domain 31 — the `ventures.js` monolith: knowledge hub & learning (slice 45)

**Domains 11–12** (ENHANCEMENTS 3.3 + 3.4, taken together). The knowledge
resource catalogue (list / read with bookmark+progress, create / update / delete,
categories), the bookmarks and per-user progress, the recommended and
personalized recommendations, the learning activity history, the learning paths
and their assignments. Decisions move to `services/ventures/knowledge.js`; every
statement to `models/ventureKnowledgeStore.js`; `src/lib/ventures.js` re-exports
the whole surface (constants included).

**Unchanged:** the SQL (byte-identical, including the `ANY($1)` resource-id
read), the resource-type allow-list, the recommendation scoring/reasons and the
completion/streak maths.

---

### Domain 32 — the `ventures.js` monolith: mentor feedback & analytics (slice 46)

**Domain 13** (ENHANCEMENT 3.5). The founder-to-coach feedback (submit with its
session gate, read, list, delete), the coach-analytics recalculation it triggers,
and the mentor / session / feedback analytics views. Decisions move to
`services/ventures/feedback.js`; every statement to
`models/ventureFeedbackStore.js`; `src/lib/ventures.js` re-exports the seven
functions.

**Unchanged:** the SQL (byte-identical), the session-status gate, the rating
range and the analytics formulas (attendance, cancellation, satisfaction,
engagement).

---

### Domain 33 — the `ventures.js` monolith: investment readiness (slice 47)

**Domain 14** (ENHANCEMENT 4.1). The 10-category readiness score (fixed weights
over the Venture's existing data), the stored assessment / scores / history, and
the recommendations generated for weak categories. Decisions move to
`services/ventures/investmentReadiness.js`; every statement to
`models/ventureInvestmentReadinessStore.js`; `src/lib/ventures.js` re-exports the
whole surface.

**Unchanged:** the SQL (byte-identical, including the pre-existing
`countVentureVerificationDocuments` call that carries a placeholder but no bound
args — preserved verbatim), the category weights, the level thresholds and the
recommendation templates/priority.

---

### Domain 34 — the `ventures.js` monolith: investor matching (slice 48)

**Domain 15** (ENHANCEMENT 4.2). The investor catalogue (list / read / create),
the match score (industry, stage, readiness, traction, team), the stored matches
and the scoped match-status updates with their history. Decisions move to
`services/ventures/investorMatching.js`; every statement to
`models/ventureInvestorMatchingStore.js`; `src/lib/ventures.js` re-exports the
seven functions.

**Unchanged:** the SQL (byte-identical), the score weights/reasons, the
strengths/weaknesses and the status side-effects.

---

### Domain 35 — the `ventures.js` monolith: pitch deck & data room (slice 49)

**Domain 16** (ENHANCEMENT 4.3). The document catalogue (list / read with
versions, upload with the duplicate guard and the schema-compat ALTERs, update
with versioning, delete) and the secure sharing (create link, scoped revoke,
access logs, shares). Decisions move to `services/ventures/documents.js`; every
statement to `models/ventureDocumentsStore.js`; `src/lib/ventures.js` re-exports
the nine functions.

**Unchanged:** the SQL (byte-identical), the visibility filter, the duplicate
rule, the version numbering and the share token/expiry.

---

### Domain 36 — the `ventures.js` monolith: fundraising pipeline (slice 50)

**Domain 17** (ENHANCEMENT 4.4). The opportunity catalogue (list / read with its
stage history, activities and notes), the create with its input guards and
initial stage row, the update with stage-change tracking, the delete, the notes
and activities, and the pipeline analytics. Decisions move to
`services/ventures/fundraising.js`; every statement to
`models/ventureFundraisingStore.js`; `src/lib/ventures.js` re-exports the whole
surface.

**Unchanged:** the SQL (byte-identical), the amount/close-date guards, the
stage-change tracking and the win-rate maths.

---

### Domain 37 — the `ventures.js` monolith: investment analytics (slice 51)

**Domain 18** (ENHANCEMENT 4.5). The full investment analytics aggregation
(readiness, match, pipeline, data room, funnel, monthly activity and funding
trends) and the export summary derived from it. Decisions move to
`services/ventures/investmentAnalytics.js`; every statement to
`models/ventureInvestmentAnalyticsStore.js`; `src/lib/ventures.js` re-exports the
two functions.

**Unchanged:** the SQL (byte-identical), the per-section safe fallbacks and the
engagement/win rates. **This closes the 4.x investment family.**

---

### Domain 38 — the `ventures.js` monolith: administration & system config (slice 52)

**Domain 19** (ENHANCEMENT 5.1). The system settings (grouped + typed), the
feature flags, the roles, the platform info and the admin-activity log. Decisions
move to `services/ventures/systemAdmin.js`; every statement to
`models/ventureSystemAdminStore.js`; `src/lib/ventures.js` re-exports the nine
functions so the admin Ventures route is untouched. (Distinct from
`@/models/ventureAdmin`, which backs Super-Admin Venture creation.)

**Unchanged:** the SQL (byte-identical), the typed setting values, the flag/role
activity actions and the platform-version fallbacks.

---

### Domain 39 — the `ventures.js` monolith: notification centre (slice 53)

**Domain 20** (ENHANCEMENT 5.2). The in-app notification catalogue (send with its
delivery log, list, read, archive, delete, unread count), the templates with their
variable rendering and the per-user preferences. Decisions move to
`services/ventures/notifications.js`; every statement to
`models/ventureNotificationsStore.js`; `src/lib/ventures.js` re-exports the
thirteen functions. (Distinct from the `notify`/`ventureNotifyStore` pair of
slice 30, which backs founder/coach/Lead-Manager delivery.)

**Unchanged:** the SQL (byte-identical), the recipient/status filters, the
template rendering and the default preferences.

---

### Domain 40 — the `ventures.js` monolith: audit logs & security (slice 54)

**Domain 21** (ENHANCEMENT 5.3). The append-only audit log (write with a safe
failure, filtered query, stats), the security events (query, resolve, stats), the
admin session management (list, revoke one, bulk revoke) and the login history
(query, stats). Decisions move to `services/ventures/auditSecurity.js`; every
statement to `models/ventureAuditStore.js`; `src/lib/ventures.js` **imports**
then re-exports the twelve functions, because `logAuditEvent` is still called by
the domains left in the file (an `export … from` introduces no local binding).
The `hashToken` import left the monolith with the domain; the
`security-login-history` source-pinning suite was repointed to the service (same
assertion, new home).

**Unchanged:** the SQL (byte-identical), the filters, the token hashing, the
non-blocking audit write and the login-stat keys.

---

### Domain 41 — the `ventures.js` monolith: external integrations & public APIs (slice 55)

**Domain 22** (ENHANCEMENT 5.4). The integration providers/configs, the API keys
(mint with the one-time secret, list, revoke, rotate) and the webhooks (with the
HTTPS/event guards) plus their delivery logs; every mutation writes an audit
event. Decisions move to `services/ventures/integrations.js`; every statement to
`models/ventureIntegrationsStore.js`; `src/lib/ventures.js` re-exports the
thirteen functions. The `crypto` import and the key-id/secret/hash helpers left
the monolith with the domain.

**Unchanged:** the SQL (byte-identical), the provider check, the key id/secret/
hash scheme, the HTTPS + event guards.

---

## 3. Left aside on purpose (deferred, with reasons)

1. **Model facades** (`resolver`, `scope`, `contextGrantReadiness`,
   `eligibility-admin`, `context`, `contextGrants`, `programAssignments`) create
   shim-only model→service edges; they are deleted once nothing imports them.
2. **`models/authorization/programAssignmentBackfill.js` imports the level
   decision from the service** — a backfill (data work) that needs a decision;
   it stays in models for now.
3. **`server/authz/guards.js`** (`requireProjectAccess`, `requireProgramFacilitator`,
   `requireAssignmentAccess`, …) still queries models and builds its own
   responses. It is the *other* authorization boundary; splitting it the same way
   is follow-up work, not a mixed module.
4. **No type layer** (see §4).

---

## 4. What remains

### Authorization domain — done

Every module that mixed a decision with its queries is split (slices 1–8), and
the domain is now HTTP-free at the service layer (slice 9). What is left is
cleanup, not layering:

| Item | Status |
|---|---|
| Facades (§3.1) | shim-only re-exports, deleted when unused |
| `server/authz/guards.js` (§3.3) | its own boundary work, same recipe |
| Decision tests | `authorize`, `evaluateAuthorization` and the derivation are now testable without a database or HTTP |

### Other domains — not started

| Domain | Service to create | Notes |
|---|---|---|
| Finance | `services/finance/*` | ✅ **complete** (slices 10–11) |
| Programs | `services/programs/*` | ✅ **models done** (slice 12) · ⏳ controller orchestration started (slice 13) |
| Contacts / CRM | `services/contacts/*` | ⏳ **started** — sync (slice 14) + the decision helpers (slice 22) |
| Ventures | `services/ventures/*` | ✅ **models done** — document types (slice 15) + plan import (slice 20); `ventureAssets`/`ventureMemberAccess` checked and fine |
| Workspace | `services/workspace/*` | ✅ **models done** (slice 19) — the Venture-session calendar source; the rest of `workspace.js` is a repository |
| Tasks / projects | `services/tasks/*`, `services/projects/*` | ⏳ **projects controller done** (slices 37–38); **tasks nearly done** (slices 39–40) — every task route except `tasks/route.js` is controller-clean; the error-prone monolith remains |
| LMS / platform / integrations | `services/<domain>/*` | ⏳ **LMS + platform started** — learner experience (slice 17), checkout (slice 18), Run report (slice 21); registrations/email-personalize checked (no split needed) |

#### Remaining mixed model modules (the actual backlog)

After re-checking each candidate: a module only counts here if a **single
function** both computes a decision and runs SQL. Every candidate named in the
earlier backlog has now been re-checked and either split or cleared — the table is
empty:

| Module | Domain | What mixes | Test net |
|---|---|---|---|
| _(none left at the model layer)_ | — | — | — |

Done: `models/lms/learning.js` → `services/lms/learning.js` + `models/lms/learningStore.js` (slice 17); `models/lms/checkout.js` → `services/lms/checkout.js` + `models/lms/checkoutStore.js` (slice 18); `models/workspace.js` (the Venture-session calendar source) → `services/workspace/calendar.js` + `models/workspaceCalendarStore.js` (slice 19); `models/venturePlanImport.js` → `services/ventures/planImport.js` + `models/venturePlanImportStore.js` (slice 20); `models/platform/ai/report.js` → `services/platform/report.js` + `models/platform/ai/reportStore.js` (slice 21); the CRM helpers of slice 22 (see §2).

**Checked and NOT mixed — no work needed (fourth pass, slice 22):**

- `models/platform/ai/email-personalize.js` — pure: no imports, no SQL, no HTTP.
- `models/forms.js` and `models/formRuns.js` — `countNonDraftSubmissionsByRunId`,
  `buildRunListFilter`, `countFormRuns` and every `forms.js` query only add a
  filter or choose a clause: repository shaping, not a decision.

**Checked and NOT mixed — no work needed (third pass):**

- `models/participantPortal.js` (764) — re-checked function by function: every one
  wraps exactly one statement. The conditional getters
  (`getParticipantProgramAssignments`, `getSubmissionsByParticipantOrTeam`, the
  ritual `…ByUserAndWeek` reads) only add a WHERE filter — repository shaping, not
  a decision. The "portal state assembly" named in the backlog lives in the
  participant controllers (the new frontier), not in this module.

**Checked and NOT mixed — no work needed (second pass):**

- `models/lms/registrations.js` (746) — a repository: one statement per function. Its two
  decision-shaped functions (`listRegistrationsToReview`, `getRegistrationStats`) run **no SQL**;
  they compose repository reads. Its pure helpers (`paymentAmountMultiplier`, `toProviderAmount`,
  `normalizeRegistrationEmail`, …) are used BY the repository (`listRegistrationsByEmail`), so they
  cannot move to the service without a shared pure module — they stay where they are.

**Checked and NOT mixed — no work needed:**

- `models/authorization/investorScope.js` — delegates to other models' reads; runs no SQL itself.
- `models/ventureAssets.js` (416, 47 q) — a pure repository: one statement per function; the `isFounderFor*` names return ROWS, the decision lives in the controller.
- `models/ventureMemberAccess.js` (84) — thin reads returning booleans; its policy is already a separate pure function.
- `models/intelligence.js` — aggregation reads plus light formatting.
- Pure modules: `platform/roles.js`, `authorization/capability-catalog.js`,
  `lms/constants.js`, `lms/scoring.js`, `lib/programProgress.js`,
  `ventureChangeLog.js`, `authorization/eligibility-defaults.js`.

> **Controllers are the new frontier.** Once the model modules are split, the
> remaining domain logic is the orchestration inside `src/app/api/**/route.js`.
> The recipe is the same, one route at a time: keep auth/validation/shaping in the
> route, move the decision into `services/<domain>/`, keep the route's existing
> test mocks working.

#### Controller frontier — the inline-SQL inventory (slices 23 + 26)

**A correction on the slice-23 audit.** Slice 23 concluded "no route runs SQL"
from a grep for `db\.execute` — which does not match a call chained across lines
(`await db\n  .execute(...)`), nor a wrapper such as `runSafeQuery(sql)` /
`runQuery(sql)` with the SQL text in the route. Slice 26 re-audited with patterns
that catch both and found **eleven more call sites in eight routes**, all now
extracted. The reliable audit is:

```sh
grep -rnE "\.(execute|transaction|batch)\(" src/app/api --include=route.js
grep -rnE "(runSafeQuery|runQuery|safeQuery)\(" src/app/api --include=route.js
grep -rlnE "(SELECT|INSERT INTO|UPDATE [a-z_]+ SET|DELETE FROM)" src/app/api --include=route.js
```

The first two must be empty. The third still fires on three deliberate items:
`campaigns/route.js` + `campaigns/[id]/route.js` (inline SQL in **RETIRED,
unreachable** code — `RETIRED = true` 403s first, and it calls `db.batch`, which
the db module does not define, so re-enabling would throw); `attendance` and
`submissions` (a controller-assembled WHERE **fragment** handed to a model — the
same repository-shaping class as `buildRunListFilter`, slice 22); and
`migrate/phase5` (the sanctioned migration endpoint, which executes the
statements of a `.sql` file, like the other `/api/migrate/phaseN` routes).

Slice 26 extracted: `ventures/[id]/deliverables` (2) → `getVentureDbIdByCodeOrId`,
`getVentureMilestoneForDeliverables`; `milestones/reorder` (1) →
`getVentureDbIdByCodeOrId`; `verification` (2) and
`verification/documents/[docId]/versions` (1) → `isActiveVentureMember`;
`platform/import/execute` (4) → `findContactByCidForImport`,
`findContactByLowerEmailForImport`, `findContactByPhoneForImport`,
`selectAllContactsForImport`; `engineering/permissions` (10) → eight named list
functions in `models/authorization.js`; `investor/executive-dashboard` (8) →
eight named functions in `models/investor.js`. SQL byte-identical throughout.

Slice 23 extracted **30 route files** (22 under `src/app/api/ventures/`); these
are the ones it covered, SQL byte-identical, one function per query, the
controller keeping its auth/validation/shaping. Most functions live in
`models/ventureWorkspace.js`;

| Route | Model functions |
|---|---|
| `ventures/assigned` | `listVenturesAssignedToStaff` |
| `ventures/[id]/my-access` | `getVentureCodeByIdOrCode`, `listActiveVentureAssignmentsForAccess` |
| `ventures/[id]/history` | `isActiveVentureMember` |
| `ventures/[id]/venture-history` | `getVentureDbIdByCodeOrId`, `listVentureHistoryEvents/Notes/ReviewDecisions/SessionNotes` |
| `ventures/[id]/coach-invite` | `getVentureNameByIdOrCode` |
| `ventures/[id]/staff-assignments` | `getVentureCodeForAssignment`, `getLiveContactByCid`, `findDuplicateVentureAssignment` |
| `ventures/[id]/progress` | `countVentureTasksWithCompletedStatuses` |
| `ventures/[id]/members` | `getVentureByCode`, `listVentureMembersWithContacts`, `findVentureMemberByEmail`, `getVentureDisplayNameByCode`, `getVentureMemberById`, `getVentureMemberContactId`, `archiveVentureMember`, `updateVentureMemberFields` |
| `ventures/[id]/milestones` (+ `archive`, `duplicate`) | `listVentureMilestonesByDbId`, `ventureJourneyStageExists`, `insertVentureMilestone`, `getVentureMilestoneBeforeUpdate`, `getVentureIdAndCode`, `updateVentureMilestoneFields/ValueFields`, `getVentureMilestoneTitleAndStage`, `listMilestonesForArchive` |
| `ventures/[id]/tasks` (+ `archive`, `duplicate`, `[taskId]/submissions`) | `hasApprovedTaskSubmission`, `listTasksForArchive`, `getVentureTaskById`, `listVentureTaskSubmissions`, `getNextTaskSubmissionVersion`, `insertTaskSubmission`, `setVentureTaskInProgress`, `getTaskSubmission`, `reviewTaskSubmission`, `setVentureTaskStatus`, `getMilestoneJourneyStageId` |
| `ventures/[id]/submissions/review-queue` | `selectVentureReviewQueue` |
| `ventures/[id]/notes` | `getVentureCodeByDbId`, `getInternalNotesViewPermission`, `listActiveStaffAssignmentsByCode`, `listVentureNotes`, `insertVentureNote`, `getVentureNote`, `archiveVentureNote` |
| `ventures/[id]/operating-plans` (+ `[planId]`, `[planId]/sections`) | `listVentureOperatingPlans`, `insertVentureOperatingPlan`, `getVentureOperatingPlan`, `listVenturePlanSections`, `listVenturePlanLinks`, `updateVentureOperatingPlan`, `ventureOperatingPlanExists`, `archiveVentureOperatingPlan`, `liveVenturePlanExists`, `venturePlanSectionExists`, `insertVenturePlanLink`, `insertVenturePlanSection`, `updateVenturePlanSection`, `getVenturePlanLink`, `deleteVenturePlanLink`, `deleteVenturePlanSection` |
| `ventures/[id]/journey/apply-template` | `getActiveVenturePlanTemplate`, `listVenturePlanTemplateSections`, `countVentureJourneyStages`, `insertJourneyStageFromTemplate` |
| `ventures/[id]/journey-report` | `getVentureDbIdByCodeOrId`, `listVentureStagesForReport(Legacy)`, `listVentureMilestonesForReport`, `listVentureTaskDeadlinesForReport`, `listVentureReviewedSubmissionsForReport`, `listVentureSessionsForReport`, `listVentureStaffAssignmentsForReport`, `listVentureSubmitedDeliverablesForReport`, `listVentureEvidencedDeliverablesForReport` |
| `ventures/[id]/calendar` | `getVentureDbIdForCalendar`, `listVentureActionPlansWithDeadlines`, `listVentureCoachingFollowUpDates`, `listVentureCoachingSessionsForCalendar`, `listVentureFacingSessionsForCalendar`, `listVentureMilestonesWithTargetDates`, `listVentureTasksWithDueDates` |
| `ventures/[id]/dashboard` | `getVentureDashboardInfo`, `listVentureMemberRecipients`, `selectInternalNotificationFeed`, `selectVentureNotificationFeed`, `listVentureActivityLog`, `listVentureDocumentsForDashboard(Legacy)`, `listVentureMeetings`, `listVentureKpiSummary`, `countVentureAdvisors`, `countVentureCoachingSessions`, `countVentureActiveCoachAssignments` |
| `ventures/[id]/sessions` | `getVentureByCode`, `getVentureDbIdByCodeOrId`, `getVentureIdAndCode` |
| `ventures/[id]/journey` | `listJourneyMilestonesByStage(Legacy)`, `listJourneyDeliverablesByMilestoneIds`, `listJourneyTaskStatusesByMilestoneIds(Legacy)`, `getJourneyTemplateName`, `countJourneyStagesByVenture`, `insertJourneyStage`, `updateJourneyStageFields`, `activateJourneyStage`, `lockJourneyStage`, `holdJourneyStageMilestones`, `resetJourneyStage` |

Outside `ventures/`, the same wave covered `api/calendar`
(`models/workspaceCalendarStore.js`: `selectCalendarVentureScope`,
`selectCoachedVentureIds`, `selectVentureIdsByCodes`,
`selectCalendarVentureSessions/Tasks/Milestones/JourneyStages`),
`venture-permissions/responsibilities` and `venture-plan-templates`.
`platform/form-runs` needed nothing (no SQL — see above).

Two source-pinning suites were repointed (same assertion, new home):
`identity-gate-bridge` (history membership probe) and `venture-label-surfaces`
(the members company-name query).

### Project-wide, still open (from `MVC_REFACTOR.md`)

- The "0 inline SQL in controllers" gate holds again after the slice-26
  correction: the first sweep (slice 23) missed chained/wrapper call sites; those
  are extracted too. The only SQL-shaped text left in routes is the RETIRED
  (unreachable) campaign code, the two controller-assembled WHERE fragments, and
  the sanctioned `/api/migrate/phaseN` endpoint — see the frontier section, with
  the audit command that actually finds them.
- `src/lib/ventureJourneys.js`, `ventureJourneyArchive.js`,
  `ventureJourneyTemplates.js` (slice 24), `ventureArchive.js`,
  `ventureDuplication.js` (slice 25), `ventureMilestoneOrder.js` (slice 26),
  `ventureAccessFacts.js` (slice 27, which left `ventureAuth.js` pure),
  `venturePermissions.js`, `ventureMilestoneEngine.js` (slice 28),
  `ventureScope.js` and `ventureOperatingPlans.js` (slice 29), `ventureReadiness.js`
  and `ventureNotify.js` (slice 30), `ventureReports.js` (slice 31) and
  `ventureCoach.js` (slice 32) are done — all facades over `services/ventures/*`.
  `ventures.js` (5.8k lines) is being emptied domain by domain: its
  activity/history/notification domain is out (slice 33), its startup-profile
  wizard is out (slice 34), its founders/co-founders domain is out (slice 35),
  its Data-bank verification domain is out (slice 36), its milestones &
  deliverables domain is out (slice 39), its tasks/dependencies/comments/
  attachments domain is out (slice 40), its project timeline & dependencies
  domain is out (slice 41) and its reports & project analytics domain is out
  (slice 42) and its coach & mentor management domain is out (slice 43), and its
  mentoring sessions & scheduling domain is out (slice 44), and its knowledge hub
  & learning domain is out (slice 45), and its mentor feedback & analytics domain
  is out (slice 46), and its investment readiness domain
  is out (slice 47), and its investor matching domain
  is out (slice 48), and its pitch deck & data room domain
  is out (slice 49), and its fundraising pipeline domain
  is out (slice 50), and its investment analytics domain
  is out (slice 51), and its administration & system config domain
  is out (slice 52), and its notification centre domain
  is out (slice 53), and its audit logs & security domain
  is out (slice 54), and its external integrations & public APIs
  domain is out (slice 55), all
  re-exported through the barrel. A
  long tail of
  `src/lib` modules still
  holds SQL (the remaining domains of `ventures.js`, plus the
  non-venture ones `auth.js`, `email.js`, `audit.js`, `token-hashing.js`,
  `request-context.js`, `lms/coaching.js`) — the next repository-extraction
  targets, one module at a time, tracked in `MVC_REFACTOR.md`.
- Giant page files (>600 LOC) still need splitting into feature components.

### Deferred decision: typing

Not started and not required by this split. When revisited, the options are:
(a) JSDoc type annotations on the service/repository boundaries, (b) a real
TypeScript migration (project-wide, its own programme), or (c) nothing. Until a
decision is recorded, new modules stay plain JavaScript.

---

## 5. Rules (the contract for every new slice)

1. **Services decide; repositories read/write.** No SQL outside `src/models/**`
   (existing rule, unchanged). No decisions inside a new repository module.
2. **Services never run SQL** — enforced by
   `src/__tests__/server/services-boundaries.test.js`.
3. **New repositories never import HTTP** (`next/server`, `NextResponse`) —
   pinned by the same suite.
4. **Behaviour is invariant.** SQL stays byte-identical (the endpoint suites
   match on query text). Round-trip/wave counts stay identical (pinned by
   `db-sequencing.test.js`).
5. **Public surfaces only grow.** Moving a symbol leaves a facade at its old
   path for one release; delete it only once `grep` finds no importer.
6. **Prefer the aggregating lib facade** over a model facade when the SQL stays
   in `models` — it creates no cross-layer edge.
7. **No new dependency** to reach a layer.

---

## 6. How to run the next slice (recipe)

1. Pick one module that mixes decisions with reads.
2. Write/extend the characterisation test first — the decision paths, not the
   implementation.
3. Copy the SQL **verbatim** into a repository module (one function per query,
   named after the data). Do not reformat, reorder or "improve" it.
4. Move the decision logic into the matching service module; import the
   repository reads; delete the SQL from the original.
5. Keep every old import path working — model facade or aggregating lib facade.
6. Run `npm test`, `npx eslint .`, `npm run build`. **The build catches direct
   imports the unit suites miss** (a route importing a moved symbol directly
   fails only at build time).
7. Update §2/§3/§4 of this document, then delete the facades once nothing
   imports them.

---

## 7. Guardrails

| Guard | File | Fails when |
|---|---|---|
| No SQL in `src/services/**` | `src/__tests__/server/services-boundaries.test.js` | a service contains `db.execute` or imports the pool |
| No HTTP in `src/services/**` | same suite | a service imports `next/server` or references `NextResponse` |
| The HTTP boundary owns refusals | same suite | `@/server/authz` stops exporting `requireAuthorization` / `requireScopedAccess`, they disappear from the `@/models/authorization` barrel, or they reappear in the service layer |
| No HTTP in the new repositories | same suite | the split stores (`contextReads`, `contextGrantReadinessReads`, `scopeReads`, `eligibilityAdminReads`, `contextAssignmentReads`, `contextGrantsStore`, `programAssignmentReads`, `learningStore`, `checkoutStore`, `workspaceCalendarStore`, `venturePlanImportStore`, `platform/ai/reportStore`, `contactLookupStore`, `participantSyncStore`, `messageScopeStore`, `formRunListStore`) import `next/server` / use `NextResponse` |
| Decision surface intact | same suite | a renamed/removed export breaks the service barrel or the resolver facade |
| No SQL in `server/authz` | `src/__tests__/server/authz-boundaries.test.js` | (pre-existing) authorization policy runs inline SQL |
| Auth/authz import directions | `src/__tests__/server/auth-boundaries.test.js` | (pre-existing) |

# Layer split — View → Controller → Service → Repository

> Status: **authorization + finance complete; programs models done; the
> controller frontier complete**. Slices 1–9 finished authorization (service
> layer HTTP-free), 10–11 finished finance, 12–13 covered programs, 14 contacts,
> 15 ventures, 17–18 LMS (learning, then checkout), 19 workspace, 20 ventures
> (plan import), 21 platform (Run report), 22 the CRM decision helpers, 23 the
> controller frontier: every route file that still ran inline SQL now reads
> through its model, so **no `src/app/api/**/route.js` executes SQL**, 24 the
> Journey stage/archive/template engine (service + store, its three `src/lib`
> modules now facades). The remaining mixed model modules are itemised in §4.
> This document is the running log. Update it at the end of every slice.

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
| Tasks / projects | `services/tasks/*`, `services/projects/*` | ⬜ not started |
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

#### Controller frontier — the inline-SQL inventory (slice 23) — COMPLETE

Measured at the start: **30 route files** ran `db.execute`/`db.transaction`
inline (the ~290 that only import `@/lib/db` for `initDb` are *not* SQL); 22 of
the 30 sat under `src/app/api/ventures/`. **All are extracted; a route file runs
no SQL today.** Verify with
`grep -rn "db\\.execute\\|db\\.transaction" src/app/api --include=route.js`:
the only hit left is a comment in `platform/form-runs` recording the removed
raw-SQL `migrate` action.

SQL is byte-identical, one function per query, the controller keeping its
auth/validation/shaping. Most functions live in `models/ventureWorkspace.js`;

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

- The "0 inline SQL in controllers" gate now holds: 30 route files once ran inline
  SQL, all 30 read through their models. Both `/admin` and the API suite stay green.
- `src/lib/ventureJourneys.js` and its `ventureJourneyArchive`/`ventureJourneyTemplates`
  siblings are done (slice 24) — they are facades over `services/ventures/journey`.
  A long tail of `src/lib` modules still holds SQL (the biggest: `ventures.js`,
  `ventureMilestoneEngine.js`, `ventureDuplication.js`, `ventureArchive.js`,
  `ventureReports.js`, `ventureOperatingPlans.js`, `ventureReadiness.js`,
  `venturePermissions.js`, `ventureCoach.js`, `ventureNotify.js`) — the next
  repository-extraction targets, one module at a time, tracked in
  `MVC_REFACTOR.md`.
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

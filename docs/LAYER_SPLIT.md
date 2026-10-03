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
> controller (workspace, then collaboration), 39–64 the next `ventures.js`
> domains (milestones & deliverables, tasks/dependencies/comments/attachments,
> project timeline & dependencies, reports & project analytics, coach & mentor
> management, mentoring sessions & scheduling, knowledge hub & learning,
> mentor feedback & analytics, investment readiness, investor matching, pitch deck
> & data room, the fundraising pipeline, investment analytics, administration &
> system config, the notification centre, audit logs & security, then external
> integrations & public APIs, system monitoring, health & reporting, then the core
> schema bootstrap, intake, then the core record — **`ventures.js` is now a
> barrel**), then the non-venture `src/lib` tail — which is now **completely clear
> of SQL** (token hashing, task audit, access profiles + responsibilities, LMS
> coaching, then the email delivery log). Its CRM controller frontier has since
> begun — contact groups, user groups, the registry feed, then the contact
> alternative emails, then the group members, then the directory search, then the
> duplicate flags, then the contact timeline, then the contact merge, then the
> contacts list read, then the soft-delete, then the registration, then the
> contact update — **the CRM controller frontier is complete**. The
> Communications controller frontier has since begun (campaigns, internal
> messages, announcements, follow-ups and events). The
> submissions controller frontier has since begun and is now complete (the submit
> path, the review, the list read, the score write). The platform frontier has
> since begun — the `form-runs` email/report-document cluster (slice 95), then
> the platform wave (slices 96–111): the import preview/execute/review-flag
> routes, the two seeds, the AI form generation, the template personalizer, the
> advisory analysis, the evaluation scoreboard, the form-runs scoring engine, the
> review workflow, the forms/collections controllers, the whole `form-runs`
> action vocabulary (respondent write path, run lifecycle, email actions,
> messaging actions, link/document/run actions, then the PUT/DELETE verbs) and
> the remaining platform controllers (notifications, integrations, investor-run,
> evaluation-config, report-file).
> The remaining mixed model modules are itemised in §4. This document is the
> running log. Update it at the end of every slice.

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

### Domain 25 (cont.) — the controller frontier: `tasks/route.js`, the read path (slice 41)

The monolith's first pass. `tasks/route.js` (1698 lines, five verbs) is too large
and too entangled to move in one go, so it is done verb by verb, reads first.

The **GET** handler moves to `services/tasks/query.js` (`listTasks`). The route's
GET drops to an HTTP shell; what moved is the whole read decision:

- the scoping — a non-super-admin asking for another user's tasks is refused; a
  non-portfolio caller is forced to their own tasks and a foreign assignee filter
  is refused; a task looked up by id is still access-checked, so the id path is
  not an IDOR;
- the SQL scope choice (`self` / `user` / `assigned`) — the statement itself is
  still assembled in `@/models/tasks` (`getTasksByFilters`), so no SQL text enters
  the service;
- the brief short-circuit, and the batch enrichment (blockers, subtasks,
  resources, comment counts) that replaces the N+1 fan-out.

The route keeps `STAFF_SIDE_ROLES` (POST/PUT still gate `supervisor_id` on it,
and `security-lot10` pins it there). Eight now-unused model imports left the
route with the handler.

New characterisation net: `tasks-query-api.test.js` (10 tests) — the model layer
is mocked, so it asserts the decisions, not the SQL. It immediately earned its
keep: a portfolio caller with **no** filter is scoped to their own tasks
(`scope: "self"`), not unscoped, which the first draft of the test had wrong.
`tasks-api.test.js` (POST/PUT) and `security-lot10` are unchanged and green.

`npm test` (232 suites, 3297 tests), `npx eslint` (0 errors) and
`npm run build` are green.

**Left:** the monolith's write paths — POST, PUT, DELETE, PATCH.

---

### Domain 25 (cont.) — the controller frontier: `tasks/route.js`, delete & patch (slice 42)

The monolith's two short write paths.

- **DELETE** → `services/tasks/remove.js` (`deleteTaskRecord`): the access rule
  (owner / assignee / supervisor / Super Admin), the lock guard (with its
  `locked: true` body), the carry-over protection (a standup commitment cannot be
  deleted), and the dependant-first order (blockers → subtasks → task) with the
  audit and the best-effort standup rebuild.
- **PATCH** → `services/tasks/assignments.js` (`respondToPendingAssignment`):
  accepting or declining a pending assignment, located by assignment id or by
  task id + session user, assignee-only, with the assigner notification and the
  audit.

Ten now-unused model imports left the route. New characterisation net
`tasks-mutations-api.test.js` (12 tests); `tasks-api.test.js`, `tasks-query-api`
and `security-lot10` are unchanged and green.

`npm test` (233 suites, 3313 tests), `npx eslint` (0 errors) and
`npm run build` are green.

**Left:** the two large write paths — POST and PUT.

---

### Domain 25 (cont.) — the controller frontier: `tasks/route.js`, creation (slice 43)

The monolith's first large write path. **POST** → `services/tasks/create.js`
(`createTaskRecord`): the create-scope rule (a non-privileged caller is pinned to
themselves — note its role list is WIDER than the portfolio list, it includes
`team`), the parent project/category inheritance with the "General" fallback, the
closed-project guard, the date rules, the owner defaulting, the Super-Admin
assignment block, the contact-group gate, the pending-assignment path, and the
follow-on effects (parent cascade, audit trail, sub-task notification, standup
upsert, parent deadline stretch).

The four date helpers move to `services/tasks/dates.js` (`getWeekNumber`,
`isValidDateStr`, `todayStr`, `isCurrentWeek`), shared by the create service and
the update handler. `tasks-api.test.js` (POST/PUT) is **unmodified** and green —
or the extraction was faithful; the two compatibility facades it mocks
(`@/lib/standupUpsert`, `@/lib/db/queries/tasks`) are imported by the service so
those mocks keep applying.

New characterisation net `tasks-create-api.test.js` (9 tests). It earned its
keep twice: the creation scope's role list genuinely differs from the portfolio
one, and an unassigned project task defaults to the project owner **as a pending
assignment** (not a direct assignee), which the first draft had wrong.

**Source-pin repointed:** `security-lot10` pinned the create-side supervisor gate
on the route; it now reads the service, same intent (staff-side roles only). The
`const STAFF_SIDE_ROLES` assertion stays on the route (PUT still uses it).

`npm test` (234 suites, 3331 tests), `npx eslint` (0 errors) and
`npm run build` are green.

**Left:** PUT — the last and largest path.

---

### Domain 25 (final) — the controller frontier: `tasks/route.js`, update (slice 44)

The monolith's last and largest path. **PUT** → `services/tasks/update.js`
(`updateTaskRecord`): the access rule and the finer status rule, the lock guards,
the completion guards (blockers need `force_complete`; a completed task cannot
be flipped to carried-over), the field assembly (including dropping
`completed_at` when a completed task reopens), project revalidation on change,
the assignment branches (un-assign / self-assign / pending assignment with the
contact-group gate), schedule drift detection, and the parent/subtask cascade,
carry-over ancestor walk, reschedule increment and audits.

With this, `src/app/api/tasks/route.js` is a 309-line HTTP shell (down from
1698): it keeps only auth, field-presence checks, the call into the service and
the response envelope. **Every `@/models/**` import left the route** — the model
access now lives entirely in `services/tasks/*`.

`tasks-api.test.js` (which covers PUT's dates, cascade, carry-over safety and
project reset) is **unmodified** and green — the strongest evidence the move was
faithful. New characterisation net `tasks-update-api.test.js` (13 tests) for the
branches the existing suite did not reach (lock, strict-owner, blockers flag, the
assignment branches). It caught a real defect the extraction introduced — a
missing import in the pending-assignment branch — which `npm test` alone had not
seen because that branch was untested; `npx eslint` flagged it and the new test
now pins it.

**Source-pin repointed:** `security-lot10`'s "supervisor is a management field"
block now reads both services (the `const STAFF_SIDE_ROLES` left the route with
PUT, which was its last user).

`npm test` (235 suites, 3346 tests), `npx eslint` (0 errors) and
`npm run build` are green. **The `tasks/route.js` monolith is done.**

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

### Domain 42 — the `ventures.js` monolith: system monitoring, health & reporting (slice 56)

**Domain 23** (ENHANCEMENT 5.5, the last ENHANCEMENT block). The health checks
(run with per-component probes and record, latest, history, overall), the
metrics, the system status, the alerts stats, the jobs, the queues, the storage /
database / cache / API probes and the generated reports. Decisions move to
`services/ventures/monitoring.js`; every statement to
`models/ventureMonitoringStore.js`; `src/lib/ventures.js` re-exports the nineteen
functions.

**Unchanged:** the SQL (byte-identical), the probe thresholds, the env reads, the
aggregation maths and the report period/summary. **The ENHANCEMENT blocks are now
all out** — only the original core (schema, ids, create/read/update) remains.

---

### Domain 43 — the `ventures.js` core: schema bootstrap (slice 57)

Start of the original core. `ensureVentureSchema` kept the Venture tables up to
date with a fixed, idempotent list of `ADD COLUMN IF NOT EXISTS` migrations plus
two `name`/`company_name` backfills and a permission-catalog seed. It decides
nothing (the list is data), so it moves wholesale to
`services/ventures/schema.js`; the three statements go to
`models/ventureSchemaStore.js` (the migration runner keeps the bare-string
`db.execute(sql)` form). `src/lib/ventures.js` re-exports it. The
`my-ventures-name` source-pinning assertion for the self-heal UPDATE was
repointed to the store (same assertion, new home).

**Unchanged:** every migration string (byte-identical), the bare-string execute
form, the two backfills and the seeding order.

---

### Domain 44 — the `ventures.js` core: intake (slice 58)

**Workflow B (Direct Startup Registration).** The Venture id scheme, the
promotion-member resolution, the company-info validation, the duplicate check and
the Venture / founder creation (with the `company_name` schema fallback).
Decisions move to `services/ventures/intake.js`; every statement to
`models/ventureIntakeStore.js` (the two create-Venture INSERT forms stay
separate); `src/lib/ventures.js` re-exports the six functions. The `uuidv4`
import and the `VENTURE_ID_PREFIX` left the monolith with the domain.

**Unchanged:** the SQL (byte-identical), the id format, the validation rules, the
duplicate conflicts and the company_name fallback.

---

### Domain 45 — the `ventures.js` core: record (slice 59)

**The last slice of the monolith.** The assembled Venture read (row + founders +
members + activity + history + progress), the rename/update with the
name↔company_name mirroring, and the lead change (clear the previous lead,
promote the new one, append the ownership history, mirror the roles, refresh the
context grants). Decisions move to `services/ventures/record.js`; every statement
to `models/ventureRecordStore.js` (the members read delegates to
`@/models/ventureMembers` with its own `db`); `src/lib/ventures.js` re-exports the
three functions. The `my-ventures-name` source-pinning assertion was
repointed to the service (same assertion, new home).

**`src/lib/ventures.js` is now a barrel** — 412 lines, zero `db.execute`, no `db`
import; every public name resolves to `src/services/ventures/*`. The monolith
started this session at ~5 800 lines. **Unchanged:** the SQL (byte-identical),
the id normalization, the mirrored columns and the lead-change sequence.

---

### Domain 46 — the non-venture `src/lib` tail: token hashing (slice 60)

First of the non-venture tail. `src/lib/token-hashing.js` kept a pure
`hashToken` (crypto only) next to the token_hash column self-heal (a fixed list
of `IF NOT EXISTS` statements). The self-heal moves to
`services/platform/tokenHash.js` over `models/tokenHashStore.js`; the `src/lib`
file keeps `hashToken` (pure infrastructure) and re-exports the self-heal. The
`request-context.js` "SQL" the audit flagged is only a comment — it stays pure.

**Unchanged:** the hashing, every migration string (byte-identical, bare-string
execute form), the once-per-process cache and the retry-on-failure reset.

---

### Domain 47 — the non-venture `src/lib` tail: task audit log (slice 61)

`src/lib/audit.js` wrote lifecycle events and decided whether a task is locked
(older than 6 days). The decisions move to `services/tasks/auditLog.js`; every
statement to `models/taskAuditLogStore.js`; `src/lib/audit.js` is a facade. The
many importers (routes, services and `models/platform/integrations.js`) keep
working unchanged.

**Unchanged:** the SQL (byte-identical), the non-blocking write and the 6-day
lock rule.

---

### Domain 48 — the non-venture `src/lib` tail: access profiles + responsibilities (slice 62)

`src/lib/auth.js` was already a facade except for its last six functions: the
effective Access-Profile resolution and the responsibilities domain. They were
held back only from *merging* with the parallel implementations in
`models/authorization.js` / `models/responsibilities.js`; relocating them (with no
merge) changes nothing. They move to
`services/authorization/accessProfiles.js` over
`models/accessProfilesStore.js`; `src/lib/auth.js` re-exports them, so the
~250 importers are untouched.

**Unchanged:** the SQL (byte-identical), the resolution order (explicit → role
default → legacy), the capability-map shape and the seed-before-read. **Not
merged** with the parallel implementations.

---

### Domain 49 — the non-venture `src/lib` tail: LMS coaching requests (slice 63)

`src/lib/lms/coaching.js` was the last real implementation under `src/lib/lms/`
(the other files there are already facades). The learner coaching-request queue
(enrollment-derived access, server-side program resolution, the one-open-request
rule, the staff decision and the notification fan-out) moves its decisions to
`services/lms/coaching.js`; every statement to `models/lms/coachingStore.js`;
`src/lib/lms/coaching.js` is a facade and `services/lms/index.js` re-exports it.

**Unchanged:** the SQL (byte-identical), the access/enrollment rule, the
duplicate-request behaviour and the never-throwing notifications.

---

### Domain 50 — the non-venture `src/lib` tail: email delivery log (slice 64)

**The last SQL in `src/lib`.** `src/lib/email.js` (2 011 lines) is mostly pure
infrastructure — env/config, the Resend + Gmail transports, the template engine,
the copy builders and the name/email resolvers — which the doc says belongs in
`src/lib`. Its one SQL cluster (the `platform_email_log` and
`password_setup_tokens` self-heals, the log reads, the recipient idempotency
probe, the activation history, the status/bounce/Resend records, the tracked-send
record and the per-form stats) moves to `services/email/log.js` over
`models/emailLogStore.js` (which keeps the bare-string DDL form).

`src/lib/email.js` imports the three functions its senders call
(`recordStandaloneSend`, `getEmailLogRow`, `recordEmailResult`) as local
bindings — an `export … from` introduces no binding — and re-exports the public
surface. The senders and the transport stay in the lib, so there is no cycle
(the email service never imports the lib).

**Unchanged:** every SQL string (byte-identical), the once-per-process schema
caches, the safe-status set, the dedupe rule and the stat shaping.

**`src/lib` now holds no `db.execute` at all** (`request-context.js` only
mentions it in a comment).

---

### Domain 51 — the CRM controller frontier: contact groups (slice 65)

First slice of the CRM controller layer. `src/app/api/groups/route.js` decided
the group create/update use-cases inline: the `GRP-…` registration-id generation
and the schema self-heal (on a "does not exist" error, add the missing `families`
columns once, then retry once). Both move to `services/contacts/groups.js`
(`createContactGroup` / `updateContactGroup`); the route keeps auth, the program
scope guard and the response envelope, and reads `getGroups` / `deleteGroup` /
`getFamilyProgramId` from the model directly (GET/DELETE carry no decision).

**Unchanged:** the registration-id shape, the fast-path-then-self-heal-then-retry
order, the "No fields to update" refusal and every statement (byte-identical).

---

### Domain 52 — the CRM controller frontier: user groups (slice 66)

`src/app/api/user-groups/route.js` decided the group-membership use-cases
inline. The GET fallback chain (`user_groups` table first, then the legacy
`contacts.group_name`) and the join/leave orchestration — write the raw edge,
drop the caller's cached authorization context (freshness), then keep the
membership layer in sync with history, only when the edge is new / present — move
to `services/contacts/userGroups.js` (`listUserGroups` / `joinUserGroup` /
`leaveUserGroup`). The route keeps auth, body validation, the protected-group
guard and the response envelope.

**Unchanged:** the SQL (byte-identical), the fallback order, the
sync-only-if-missing rule, the freshness invalidation and the end-never-delete
membership rule.

---

### Domain 53 — the CRM controller frontier: the registry feed (slice 67)

`src/app/api/contacts/full-state/route.js` assembled the Personnel Dashboard feed
inline: the PM-scoped reads (assigned programs → scoped contacts/participants/
families/teams) or the global registry, the enrolled-participant merge, the
group-name uppercase normalization, the FUTURE STUDIO synthetic family, the
invitation/token status and the activation EMAIL status roll-up. All of it moves
to `services/contacts/registryFeed.js` (`buildRegistryFeed({ pmId, statusFilter
})`); the route keeps initDb, the capability guard, the request scope resolution
(and its 403) and the response envelope.

**Unchanged:** the read set and batching, the case-insensitive participant merge,
the synthetic-family id, the password-hash strip and the activation-status
precedence (`sent` wins for `lastSentAt`).

---

### Domain 54 — the Programs controller frontier (slices 68–72, 76)

The programs domain's **route** layer, taken one route at a time. Slice 13 had
only the manager-change repair; this wave takes the lifecycle, the workspace
bundle, the weekly reports, the exports and the teams. `services/programs/*`
grew from one decision module (`programManager.js`) to six.

**Slice 68 — `pm/programs`, the program lifecycle** →
`services/programs/workspace.js` (`listProgramRecords`, `createProgramRecord`,
`updateProgramRecord`, `deleteProgramRecord`). The list read with its completion
index (four weighted blocks, computed in JS, capped at 100%), the duplicate-name
rule, the date rules, the segment assignment + participant sync, the default
objectives, the quick-archive shortcut, the manager-change notification and the
protected-data guard all move; the route keeps `requireAuth` (GET/PUT bare, POST
`[staff, super_admin]`), the `programs.*` capabilities, the `wave: "content"`
record scope (PUT/DELETE) and the response envelope.

New characterisation net `programs-api.test.js` (13 tests); no SQL moved, so the
existing suites are untouched.

**Slice 69 — `pm/full-state`, the program bundle** →
`services/programs/fullState.js` (`buildProgramFullState`). The fourteen-read
bundle assembly, the materials/attachment de-double-stringify, the
participant/facilitator/staff merge, the optional metrics block and the
calendar-day normalisation move; the route keeps the assigned-PM /
`requireProgramFacilitator` gate. `db-sequencing-audit` (one wave, ≤ 15
statements) is unchanged and green.

**Slice 70 — `pm/export`** → `services/programs/export.js`
(`buildProgramExport`). The export-type vocabulary, each type's filename and the
serialisation (CSV, Excel, iCalendar, client-PDF JSON) move; the route keeps the
`reports.export` capability, the `wave: "content"` scope and the header shaping.

**Slice 71 — `pm/reports`, the weekly reports** →
`services/programs/weeklyReports.js` (`listWeeklyReportsForSession`,
`saveWeeklyReport`). The own-scope filter, the KPI-name lookup and the
status → score mapping move; the route keeps `requireAuth`, the
`requireAssignmentAccess` gate (GET) and the `programs.edit` + `wave: "content"`
gates (POST).

**Slice 72 — `pm/teams`, the program teams** → `services/programs/teams.js`
(`listProgramTeams`, `createTeamWithMembers`, `applyTeamPatch`). The
credential-stripping rule, the cryptographic credential generation, the member
classification/linking and the credential e-mails move; the route keeps the
management / `programs.view` / assignment gate (GET), the `programs.edit` +
`wave: "groups"` gates and the team resolution that feeds the scope check
(PATCH/DELETE).

**Source-pin repointed:** `security-request-origin-and-scope` pinned the
credential generator inside `pm/teams/route.js`; the same assertion now reads it
in `services/programs/teams.js` (and still asserts the org-team route generates
inline). `program-scope-coverage` and `identity-gate-bridge` are unchanged — the
auth, capability and scope guards stayed on the routes.

**Slice 76 — `pm/curriculum`, the session/requirement controller** →
`services/programs/curriculum.js` (`runCurriculumAction`, `updateCurriculum`,
`deleteCurriculumItem`, plus the two scope resolvers). The whole action
vocabulary (add_session with its conflict guard, add_requirement,
send_reminder, toggle_status / toggle_deliverable, assign_team, anchor_material,
the legacy weekly report), the field update with its schedule-conflict guard,
the legacy full update and the per-type delete cascade move; the route keeps
`programs.edit`, the `wave: "content"` scope and the response envelope, and asks
the service which RECORD's program authorises the action (the record is resolved
from the row, never the body). **No `@/models` import remains in the route.**
New characterisation net `curriculum-api.test.js`.

`npm test` (237 suites, 3399 tests), `npx eslint` (0 errors) and `npm run build`
are green. **The Programs controller frontier is complete.**

---

### Domain 55 — the CRM controller frontier: contact alternative emails (slice 73)

The `/api/contact-emails` route (list / add / remove a contact's alternative
emails) carried its own authorization rule inline: a bare role check that let any
staff-side caller manage **every** contact in the database. That rule is
**AUTHZ-CRM-1** and it now lives in `services/contacts/alternativeEmails.js`
(`canManageContactEmails(session, targetCid)`): yourself, Super Admin, or a
staff/program-manager **who shares a programme the target is staffed on** (a
contact→programme predicate, read through `services/authorization/scope`);
everyone else is refused.

The route keeps `initDb`, `requireAuth`, the query/body validation, the
contact-exists 404 (POST), the refuse→403 mapping and the delegation to
`@/lib/contactIdentity`; it no longer decides who may act. The alternative-email
reads/writes themselves are unchanged (and never become the login credential).

**Source-pin repointed:** `security-request-origin-and-scope` pinned the
shared-programme predicate inside the route; the same assertion now reads it in
`services/contacts/alternativeEmails.js` (the route still asserts the predicate is
consulted, via `canManageContactEmails`).

---

### Domain 56 — the CRM controller frontier: group members (slice 74)

`/api/group-members` (add / list a v2 team's members) was the **last route still
reading through the Supabase client** — `supabase.from("v2_groups")` /
`v2_group_members` inline. Its reads and writes now go through `@/models/groups`
(`getGroupProgramId`, `getParticipantGroupPrograms`, `insertGroupMember`,
`getGroupMembers`, `getGroupMemberParticipants`), and the decisions — resolving
the group's program and the one-team-per-program rule — moved to
`services/contacts/groupMembers.js`. The route keeps
`requireAuth(["staff", "super_admin"])`, the validation, the record-scope guard
(`requireProgramScope({ programId, wave: "groups" })`) and the response envelope.

**Behaviour kept:** the 404 on an unknown group, the 400 "Participant already
assigned to a team in this program.", the GET `group_id is required` guard and
the `members` payload (each membership with its participant row nested under
`v2_participants`).

**Test repointed:** `security-lot7-program-scope` used to mock `@/lib/supabase`
and assert `__builder.insert`; it now mocks the model functions (adding the five
group-member reads/writes) and asserts `insertGroupMember`. `src/lib/supabase.js`
is **not** dead — the storage layer (`src/lib/storage.js`) still uses it; only the
routes are now Supabase-free.

---

### Domain 57 — the CRM controller frontier: the directory-search pool (slice 75)

`/api/contacts/search` chose its pool inline: for a requested program it checked
whether the caller was a participant (`isParticipantInProgram`) or a
venture-founder in that program (`isVentureFounderInProgram`) and, if so, ran the
program-scoped query; otherwise it fell through to the capability-gated global
directory. That decision now lives in `services/contacts/directorySearch.js`
(`contactSearchPattern`, `searchProgramPoolForMember`, `searchGlobalDirectory`).
The route keeps both capability gates (`contacts.view`), the `q` length guard and
the envelope.

**Source-pin repointed:** `identity-gate-bridge` pinned the two membership
predicates inside the route; the same assertion now reads them in the service
(the route still asserts the `contacts.view` gate).

---

### Domain 58 — the CRM controller frontier: the duplicate-flag queue (slice 77)

`/api/contacts/duplicates` shaped the pending candidate-duplicate queue and clamped
its page size inline. Those rules — the 200/500 page-size clamp, the
`contact_a`/`contact_b` identity shaping and the "dismiss only a still-pending
flag" outcome — now live in `services/contacts/duplicateFlags.js`
(`resolveDuplicateFlagLimit`, `listPendingDuplicateFlags`,
`dismissPendingDuplicateFlag`). The route keeps the `super_admin` auth, the
`contacts.view` / `contacts.edit` gates and the envelope.

---

### Domain 59 — the CRM controller frontier: the contact timeline (slice 78)

`/api/contacts/[cid]/timeline` carried its own scope rule: a participant or
founder may only read their OWN timeline, and a program manager sees the
non-program events plus their programs' events. That rule — plus the scoped read
assembled with the contact identity and the event append — now lives in
`services/contacts/timeline.js` (`mayReadContactTimeline`, `listContactTimeline`,
`addContactTimelineEvent`). The route keeps both capability gates
(`contacts.view` / `contacts.edit`), the pagination parsing, the required-field
check and the envelope.

---

### Domain 60 — the CRM controller frontier: the contact merge (slice 79)

`/api/contacts/merge` (POST) and `/api/contacts/merge/preview` (GET) carried the
merge orchestration inline: the reassignment of the duplicate's program
enrollments, venture memberships and timeline events, the survivor's context-grant
reconciliation (so a merged founder keeps working access), the merge timeline
event, the soft-delete that frees the duplicate's email, the flag resolution and
— for the preview — the three counts and the summary. That all moves to
`services/contacts/merge.js` (`mergeContacts`, `previewContactMerge`). The routes
keep the `super_admin` auth, the `contacts.delete` / `contacts.view` gates, the
required-parameter checks and the envelope.

---

### Domain 61 — the CRM controller frontier: the contacts list read (slice 80)

`/api/contacts` (the personnel registry, 649 lines and four verbs) is taken
verb by verb. This slice is the **GET**: the query selection (own record only for
a caller without `contacts.view`, the archived set for a Super Admin on
`?status=archived`, a single cid, the Super-Admin directory, else the
staff/PM window), the self-lookup guard that refuses a foreign cid, and the row
enrichment (the participant/assignment cid sets, the invitation status and the
`is_participant` / `has_assignment` flags) now live in
`services/contacts/registryRead.js` (`readRegistryContacts`). The route keeps
`requireAuth`, the `contacts.view` capability and the envelope.

**Source-pin repointed:** `identity-gate-bridge` pinned
`getContactByCid(cidFilter || session.cid)` inside the route; the same assertion
now reads it in the service (the route still asserts the `contacts.view` gate).

---

### Domain 62 — the CRM controller frontier: the contacts soft-delete (slice 81)

The `/api/contacts` **DELETE** recorded the actor and ran the soft-delete inline.
The rule — never remove the row, always record the session as the actor, and free
the e-mail with a unique placeholder that keeps the original address for audit —
now lives in `services/contacts/deletion.js` (`softDeleteRegistryContact`). The
route keeps the `contacts.delete` capability, the required-cid check and the
envelope.

---

### Domain 63 — the CRM controller frontier: the contact registration (slice 82)

The `/api/contacts` **POST** (single or bulk registration) carried the whole
create use-case inline — the role normalization (a privileged caller may choose;
everyone else is capped at the self-service set), the status defaulting, the
unusable-password rule, the invitation firing, the program enrollment with the
facilitator-conflict guard, the access-request notification and the
duplicate-phone detection. That now lives in `services/contacts/registration.js`
(`registerContacts`). The route keeps the optional-auth `contacts.create`
capability, the role-assign and org-membership gates, the all-failed → 400
mapping and the envelope.

**Source-pin repointed:** `security-lot10` pinned
`program_id: session ? contact.program_id || null : null` inside the route; the
same assertion now reads it in the service.

---

### Domain 64 — the CRM controller frontier: the contact update (slice 83)

The `/api/contacts` **PUT** built the SET clause inline and ran the program sync
in the route. The rules — the capability-gated `role` column, the archive intent
(server clock + session actor), the field normalization, the branch between a
role promotion, a `program_ids` replacement and a single `program_id` ensure, the
membership application with its audit, and the approval-time notification purge —
now live in `services/contacts/update.js` (`buildContactUpdate`,
`planContactProgramSync`, `findMissingProgram`, `applyContactProgramMembership`,
`completeContactUpdate`). The route keeps the `contacts.edit` capability, the
`org_membership` gate, the facilitator-conflict guard (which answers HTTP), the
program-not-found 404 and the envelope.

**Source-pin repointed:** `security-lot3` pinned
`...(canAssignRole ? ["role"] : [])` inside the route; the same assertion now
reads it in the service (the route still resolves `canAssignRole`).

**The `/api/contacts` controller is now four thin verbs** — GET / POST / PUT /
DELETE delegating to `registryRead` / `registration` / `update` / `deletion`.
That closes the CRM controller frontier: every CRM route is a thin controller.

---

### Domain 65 — the LMS / platform controller frontier (slices 84–85)

**Slice 84 — `lms/registrations/[id]`, the registration team actions** →
`services/lms/registrations.js` (`applyRegistrationAction`). The four team
actions and their rules move: retry-access (replay the access step, then hand
over a FRESH one-time link), resend-email, refund at the provider with an
optional same-step access revocation (refunding and revoking stay two separate
decisions), and revoke-access (only for a refunded registration, leaving a
journal line). The route keeps `lms.edit` and the response envelope. New
characterisation net `lms-registrations-review.test.js`; the fake-database
`lms-checkout` suite still drives refund/revoke end to end.

**Slice 85 — `platform/ai/evaluate-submission`, the AI evaluation** →
`services/platform/evaluation.js` (`handleEvaluationPost`,
`getEvaluationResult`). The client-driven batch model (claim an expiry-stamped
row so two processes never double-evaluate, evaluate with bounded concurrency,
release, record failures for a targeted retry), the progress counts and the
single evaluation (with the `force` re-evaluate) move; the route keeps the
`runs.*` capability split — `runs.view` for watching progress, `runs.review` for
evaluating (it can auto-approve). `withTimeout` now clears its timer so a
finished batch leaves no dangling handle. New characterisation net
`platform-evaluation-api.test.js`.

`npm test` (239 suites, 3440 tests), `npx eslint` (0 errors) and `npm run build`
are green. **`platform/form-runs` (2691 lines) and the rest of the platform
AI/import/seed routes are the remaining heavy controllers.**

---

### Domain 66 — the Communications controller frontier: campaigns (slice 86)

The two `/api/campaigns` controllers (retired behind `RETIRED = true`, kept
re-enableable) still ran their own SQL: the step-sequence and target-contact
multi-row inserts (`db.batch`) and the three-table delete cascade. Those
statements moved to `@/models/communications` (`insertCampaignSteps`,
`insertCampaignContacts`, `deleteCampaignCascade`), and the decisions — the wait
(days / hours / minutes) collapsed into the stored `delay_hours`, and the additive
audience sync (keep the sent records, insert the new identities as pending, drop
the ones no longer listed while still pending) — moved to
`services/communications/campaigns.js` (`campaignStepRows`, `addCampaignSteps`,
`addCampaignContacts`, `syncCampaignAudience`). The routes keep the
`staff`/`super_admin` gate, the name-required check, the retirement 403 and the
envelope.

**With this, no `src/app/api/**/route.js` runs SQL at all** — the anti-SQL audit
(`grep … '\.execute|\.transaction|\.batch\('`) returns nothing across the API
surface.

---

### Domain 67 — the Communications controller frontier: internal messages (slice 87)

`/api/internal-comms` (488 lines) was the biggest communications controller: it
carried the message-scope engine inline — the program-member resolution
(participants, staff, PM, assistants, legacy contacts), the group-member
resolution (`__staff__` or a family, plus the family's program), the three-wave
user scope (contact / groups / programs, then the membership + family-name
lookups, then the program's families) and the direct-message "share a program"
rule. Those now live in `services/communications/internalComms.js` alongside the
three use-cases — the inbox (`readMessageInbox`, feeding the `messageScope`
policy), the send (`sendInternalMessage`, with the sender-identity,
broadcast-to-all and program/group-scope guards and the recipient notification
fan-out) and the read marking (`markMessagesRead`, with the
conversation-participant guard). The route keeps `messaging.view` /
`messaging.send`, the own-inbox 403 and the envelope; the scope decisions return
`{ denied: { error, status } }`.

---

### Domain 68 — the Communications controller frontier: announcements (slice 88)

`/api/announcements` (280 lines, four verbs) carried its decisions inline: the
feed selection (active vs all, and the audience), the publish (the author always
taken from the session, the notification fan-out to all or to a group), and the
author-or-Super-Admin ownership rule for edit and archive. Those now live in
`services/communications/announcements.js` (`listAnnouncementFeed`,
`publishAnnouncement`, `updateAnnouncement`, `archiveAnnouncement`). The route
keeps the `internal_comms.create_announcements` / `internal_comms.moderate` gates,
the required-field checks and the envelope.

**Unchanged:** `identity-in-writes` still drives POST and asserts the write's
author is the session — it now reaches the model through the service.

---

### Domain 69 — the Communications controller frontier: follow-ups & events (slices 89–90)

**Slice 89 — `/api/followups`** → `services/communications/followups.js`
(`ensureFollowupSchema`, `createFollowup`, `updateFollowupRecord`). Creating a
follow-up now owns its two side effects — the calendar-event derivation (`end =
start + duration`, the truncated title) and the `pending_followup` submission
move, both non-blocking — plus the update. The route keeps the `createHandler`
role gate, the facilitator program/team guard (which answers HTTP) and the
required-field checks.

**Slice 90 — `/api/events`** → `services/communications/events.js` (`createEvent`).
The event-create now owns the participant notification (the composed date /
location message). The route keeps the role gates and the envelope.

With these, every communications controller is thin — campaigns, internal
messages, announcements, follow-ups and events.

---

### Domain 70 — the submissions controller frontier: the submit (slice 91)

`/api/submissions` (674 lines, four verbs) is the venture deliverable-submission
controller. This slice is the **POST**: the self-service identity binding
(participant/member bound to their own cid and an active membership; team
sessions bound to their own team and program; every other role denied), the
program-completion view-only gate, the file-url resolution, the
deliverable/document id derivation and the version computation all moved to
`services/ventures/submissions.js` (`createSubmissionRecord`). The route keeps
`requireAuth`, the safe migrations and the envelope.

**Source-pin repointed:** `identity-gate-bridge` pinned `body.participant_id =
session.cid` and `body.team_id = session.cid` inside the route; those assertions
now read them in the service (the route still pins the GET own-scope
`participant_id = session.cid`).

---

### Domain 71 — the submissions controller frontier: the review (slice 92)

The **PATCH** turns a submission's review from a decision into a new state. The
business rules (written feedback for a revision, a reason for a rejection), the
**role lock** (once a final decision exists, only the role camp that made it may
change it), the review write (score preserved when not resent), the follow-up
scheduling (calendar event + follow-up record), the participant notification, the
team propagation and the KPI recalculation all moved to
`services/ventures/submissions.js` (`applySubmissionReview`), and the facilitator
record-scope check to `isSubmissionWithinFacilitatorScope`. The route keeps
`requireAuth`, the `assignments.grade` assignment guard (which answers HTTP), the
role-lock column migration and the envelope.

---

### Domain 72 — the platform controller frontier: the Run-detail read (slice 93)

`src/app/api/platform/form-runs/route.js` (2691 lines) is the platform monolith;
this slice takes its **read path** — the run screen. The `GET ?id=` assembly
moves to `services/platform/formRuns.js` (`buildRunDetail`): the
auto-close-on-open rule, the one-wave bundle (assignments, submissions, reviews,
evaluations, email logs, activation logs, the form's fields and the report file),
the respondent enrichment (real email and name, `account_created` /
`account_status`, the activation history built from the email log and the token
state) and the anonymous presentation rule. `enrichAssignments` moves with it and
is re-exported (the POST assign/unassign actions still call it). The route keeps
the capabilities, the branch routing and the deferred `scheduleResultSweep` (the
`after` trigger is HTTP infrastructure).

**Source-pin repointed:** `run-report-file` now reads `report_file` /
`runReportFileDescriptor` in the service (same assertion, new home).
`db-sequencing-audit` is unchanged — the run detail is still 12 statements in 5
waves.

`npm test` (239 suites, 3452 tests), `npx eslint` (0 errors) and `npm run build`
are green. **The write half of `form-runs` (the POST action vocabulary) and the
remaining platform AI/import/seed routes are the next slices.**
the role-lock column migration and the envelope.

---

### Domain 73 — the submissions controller frontier: the list read (slice 93)

The **GET** scopes the read: the team-entity binding (a team session may only
read its own team), the own-scope fallback (no program context → a non-management
session lists only its own rows) and the facilitator scope filter (their assigned
teams, deny-closed when they have none), plus the UI row shaping and the
version-history grouping. Those moved to `services/ventures/submissions.js`
(`bindSubmissionTeamScope`, `applyOwnSubmissionScope`,
`needsFacilitatorSubmissionScope`, `resolveFacilitatorSubmissionScope`,
`formatSubmissionRows`, `groupSubmissionVersions`). The route keeps `requireAuth`,
the `assignments.view` assignment guard (which answers HTTP) and the envelope.

**Source-pin repointed:** `identity-gate-bridge` pinned the own-scope
`participant_id = session.cid` inside the route; the assertion now pins
`applyOwnSubmissionScope` in the service instead.

---

### Domain 74 — the submissions controller frontier: the score write (slice 94)

The last verb, the **PUT**: the two score columns' migrations, the score /
evaluation payload shaping (integer score, JSON-encoded evaluation) and the
branch between “one submission by id” and “every submission of a participant in a
program” all moved to `services/ventures/submissions.js`
(`saveSubmissionScore`). The route keeps the `[staff, super_admin, program_manager]`
gate, the `requireProgramScope` record-scope guard (which answers HTTP), the
program resolution and the envelope.

That closes the submissions controller frontier — `/api/submissions` went from
674 to 265 lines, four thin verbs over one service.

---

### Domain 75 — the platform controller frontier: the form-runs emails & report document (slice 95)

The second slice of the platform monolith `form-runs`, after the Run-detail read
(93): the decision/result email and document cluster.
`sendDecisionEmailForSubmission` (the run→form→default template chain, the group
gate, the duplicate-recipient sentinel), `buildResultDocument` (the answer
rebuild, the weighted score with the human overrides, the composed-report brief —
Output Instruction *or* attached document — and the PDF renderer selection),
`sendResultEmailForSubmission`, the scheduled `dispatchScheduledResultEmails` and
`logTimeline` move to `services/platform/formRuns.js`, together with the
`formatResultAnswer` / `isFounderFitResultRun` helpers. The route keeps
`scheduleResultSweep` and `processReviewInternal` — both use the `next/server`
`after` — and imports the moved functions from the service.

**Source-pins repointed**, same assertions, new home (the service):
`result-email-founder-fit`, `result-email-schedule`, `result-pdf-on-approval`,
`run-output-instruction` and `run-report-file`. `db-sequencing-audit` is
unchanged.

`npm test` (240 suites, 3468 tests), `npx eslint` (0 errors) and `npm run build`
are green. **`processReviewInternal` and the rest of the `form-runs` POST action
vocabulary are the next platform slices.**

---

### Domain 76 — the platform controller frontier (slices 96–111)

With the model layer clear (§4), the platform controllers carried the last
domain logic. This wave thins them route by route; each keeps its `initDb`, its
capability/role gate, its body parsing and its response envelope, and delegates
the decision to `services/platform/*`.

**Slice 96 — `/api/platform/import/{preview,execute,review-flags}`** →
`services/platform/import.js`. The preview's file parse (RFC-4180 aware via
`parseCSVRows`) and the column→question fuzzy match (`fuzzyMatchColumns`,
word-overlap ≥ 0.4, a question claimed once) move, as does the execute's
lookup-first contact resolution (`resolveContact`: crm-id → email → phone →
name; a name-only match is `uncertain` and never silently merged), the
label-aware applicant-email resolution and the whole row loop (dedupe by run +
submitter, the batch/file-hash idempotency, the review-flag persistence). The
review-flag read/write moves too. `import/preview` went from 227 to 34 lines,
`import/execute` from 377 to 29.

**Slice 97 — `/api/platform/seed/{founder-assessment,investor-application}`** →
`services/platform/seed.js`. The Founder Fit Score seed (its 8 scored sections ×
questions, the weight config, the profile fields, the conditional logic and the
publish snapshot) and the Investor intake seed (form + run behind the
single-active-investor guard) move. The CSRF `requireSameOrigin(req)` stays on
the founder-assessment GET and the `super_admin` gate stays on both routes.
**Source-pin repointed:** `investor-application-intake` now reads the seed
strings in the service (same assertion, new home).

**Slice 98 — `/api/platform/ai/generate-all`** →
`services/platform/formGeneration.js` (`generateFormWithFramework`). The design
prompt, the normalisation (field defaults, default rating options, sequential
numbering, evaluation weights rebalanced to 100) and the three-step persist with
the orphaned-form cleanup move. `generate-all` went from 166 to 37 lines.

**Slice 99 — `/api/platform/ai/personalize-template`** →
`services/platform/personalize.js` (`personalizeTemplate`). The two-tier
personalizer — a full-body rewrite validated against the draft's tag skeleton,
then a deterministic segment splice, with the allowed-variable set and the
language lock — moves. The route keeps the `runs.edit` / `forms.edit`
capability. **Source-pin repointed:** `ai-template-specs` now reads the prompt
contract in the service.

**Slice 100 — `/api/platform/ai/analyze`** → `services/platform/analysis.js`
(`analyzeSubmissionForRun`). The advisory summary/analysis, its run+form context
load and the usage journal move; the `runs.view` gate and the health probe stay
in the route.

**Slice 101 — `/api/platform/ai/evaluation-scores`** →
`services/platform/evaluationScores.js` (`getEvaluationScoreboard`). The run →
form resolution, the score-boundary filter, the dynamic filterable-field
derivation and the respondent shaping (answers keyed by the form's own question
labels, real name/email resolution) move; the `runs.view` gate stays.

**Slice 102 — the `form-runs` scoring engine** → `services/platform/scoring.js`
(`calculateSubmissionScores`). The self-contained scoring decision (the run's
config first, then the form's; the per-section percentage; the weighted overall
and the ranking label) moves out of the route, which now imports it. This is the
first piece of the heavy `form-runs` write half; the POST action vocabulary
remains.

**Slice 103 — `processReviewInternal`** → `services/platform/formRuns.js`. The
approval/rejection workflow behind the `review` and `bulk_review` actions moves
as one function: the idempotency guard, the "also send the AI result PDF"
evaluation gate (refusing the WHOLE action as a 409 *before* any side effect),
the dimension-override write, the status transition, the decision email, the
result-PDF send, the `REVIEW_COMPLETED` automation and the synchronous
program/group sync. The service is HTTP-free, so the two HTTP-boundary pieces
are **injected by the controller**: `after` (the `next/server` deferred-task
hook) and `scheduleResultSweep`. The route now imports the function and passes
both; its `review` and `bulk_review` handlers are pure orchestration (capability
→ validate → call → shape). **Source-pins repointed**, same assertions, new home
(the service): `result-pdf-on-approval` (the gate order and the single build
site) and `result-email-schedule` (the post-approval sweep). The controller
still owns the `runs.review` capability, the request parsing and the response
envelope.

**Slice 104 — `/api/platform/forms` and `/api/platform/collections`** →
`services/platform/forms.js` and `services/platform/collections.js`. The Forms
decisions move: the version-snapshot fallback for a published-but-empty form
(only when it was not edited since the publish), the publish (snapshot + version
bump), the create, the **FK-safe builder save** (sections upserted, fields
re-pointed to null when their section is going away, deletions last) and the
permanent-delete cascade. The Collections decisions move too: the list + the
recursive tree, the slug, the parent-reference guard and the audit trail. The
single-active-Investor guard becomes `guardInvestorIntake`, called by both write
paths in the route. **Source-pin repointed:** `investor-application-intake` now
reads the guard in the route + the assertion in the service.

New characterisation nets `platform-import-api.test.js` (the fuzzy match, the
run→form resolution, the row loop, the flag guards), `platform-scoring.test.js`
(config precedence, the weighted overall, the ranking, the unanswered-question
rule) and `platform-forms-collections.test.js` (the snapshot fallback, the
FK-safe save, the investor guard, the collections tree/slug). `npm test` (242
suites, 3499 tests), `npx eslint` (0 errors) and `npm run build` are green.

**Slices 105–109 — the rest of the `form-runs` POST action vocabulary** →
`services/platform/formRuns.js`. The remaining write half leaves the controller,
grouped by cohesion:

- **105 — the respondent write path** (`submitResponse`, `manualAddRespondent`):
  the active/deadline/auto-close gate, the multiple-submissions rule, the
  submission limit, the frozen decided response, the scoring, the AI evaluation
  (per-submission guard on a re-save) and the submission automation.
- **106 — the run lifecycle** (`changeRunStatus`, `isValidRunStatus`,
  `launchRun`, `assignRunTargets`, `unassignRun`): the valid-status set, the
  slug-before-launch rule and the multi-target assignment insert/skip decision.
- **107 — the email actions** (`retryFailedEmails`, `markEmailsCancelled`,
  `sendResultEmails`): the manual-retry log-state rules, the never-touch-a-sent
  pair rule and the result-email loop.
- **108 — the messaging actions** (`sendManualMessages`, `sendActivationMessages`):
  the recipient/name resolution, the approved-only and already-active skips and
  the force-resend flag.
- **109 — the link/document/run actions** (`regeneratePublicLink`,
  `regenerateRunReport`, `deleteSubmission`, `createRun`): the slug rotation with
  its legacy-column retry, the report re-roll + timeline entry, the submission
  cascade and the run creation with its slug, assignments and automation.

The `review` / `bulk_review` handlers stay thin over `processReviewInternal`,
injecting `after` and `scheduleResultSweep`. The controller keeps every
capability gate (`runs.create` / `runs.edit` / `runs.review` / `runs.delete`),
the `x-cron-secret` check, the request parsing and the response envelope. The
route drops from 1621 to 828 lines.

**Source-pins repointed**, same assertions, new homes (the service):
`platform-ai-evaluate-once` (the re-save evaluation guard), `run-output-instruction`
(the one PDF sender reached from many actions) and `result-pdf-on-approval`
(the sender call sites, after the bulk actions moved). `npm test` (242 suites,
3499 tests), `npx eslint` (0 errors) and `npm run build` are green.

**Slice 110 — the `form-runs` `PUT` and `DELETE` verbs** →
`services/platform/formRuns.js` (`updateRunMetadata`, `archiveRun`). The
metadata write's Output-Instruction rule (a string, bounded by
`MAX_OUTPUT_INSTRUCTION`, stored trimmed — blank means "no instruction, default
report") and the archive cascade (email/review/evaluation logs cleared first,
then the report document's stored OBJECT, then the run) leave the controller.
`form-runs` is now a pure controller: every verb delegates to the service.
**Source-pin repointed:** `run-output-instruction` now reads the bounded/trimmed
instruction in the service (same assertion, new home). `npm test` (243 suites,
3530 tests), `npx eslint` (0 errors) and `npm run build` are green. **The whole
`form-runs` route is now a thin controller over `services/platform/formRuns.js`.**

New characterisation net `platform-form-runs-actions.test.js` exercises the
extracted decisions with the repository mocked — the run-status vocabulary, the
assignment audience allowlist, the Output-Instruction rules, the submit run gate
and the pre-side-effect review guards (idempotency, the "PDF needs an
evaluation" refusal) — so the workflow is covered behaviourally and not only by
the source-pins (`npm test` 244 suites, 3548 tests).

**Slice 111 — the remaining platform controllers** →
`services/platform/{notifications,integrations,investorIntake,evaluationConfig,reportFiles}.js`.
The last thin-but-deciding platform routes move: the notification list +
mark-one/mark-all, the calendar/Notion health probes and sync vocabulary (sync /
unsync / sync-all, with the required-id and unknown-action refusals), the
Investor Run reference + public URL (404 when unconfigured), the form
evaluation-framework read/save/remove and the Run report-file attach/read/detach
(validate before any byte is read or written, the replace-then-remove ordering,
the signed read link that never hands out the storage path, and "detach = row
first, object after"). The gates stay in the routes: `settings.view` for the
health reads, `super_admin`/`program_manager` for the syncs, `runs.edit`/`runs.view`
for the report file and the session (no capability) for notifications.
**Source-pins repointed:** `run-report-file` (the signed link is now minted in
the service) and `investor-application-intake` (the run resolution is now in the
service). New characterisation net `platform-misc-controllers.test.js`. `npm
test` (243 suites, 3530 tests), `npx eslint` (0 errors) and `npm run build` are
green.

---

### Domain 77 — the resource guards' decision boundary (slice 112)

`server/authz/guards.js` (`requireProjectAccess`, `requireProgramFacilitator`,
`enforceFacilitatorProgramAccess`, `assertNoParticipantFacilitatorConflict`,
`requireAssignmentAccess`) was the last module that both decided and built its
own HTTP answers. The DECISIONS move to
`services/authorization/resourceGuards.js`, answering the same
`{ allowed, status, errorKey }` shape as the rest of the authorization service;
`guards.js` becomes a thin mapper (decision → response) that imports nothing but
the HTTP layer and the service. The public guard signatures are unchanged, so no
route changes. The existing `authz-boundaries` net (44 assertions over every
guard's 401/403/404/409/500 path) now exercises the service through the guards,
and `services-boundaries` still proves the new module is HTTP-free.

`npm test` (243 suites, 3532 tests), `npx eslint` (0 errors) and `npm run build`
are green.

---

### Domain 78 — the last `db` threading (slice 113)

`listVentureMembers` was the only repository read that still took the pool as its
first argument, which forced the Ventures dashboard controller to import the raw
pool just to pass it through. The read now uses the module-level pool like every
other model; the dashboard and `ventureRecordStore` call it without the argument,
and no `src/app/api/**/route.js` imports the raw pool any longer (only `initDb`).

`npm test` (243 suites, 3532 tests), `npx eslint` (0 errors) and `npm run build`
are green.

---

### Domain 79 — the permission-matrix read (slice 114)

`GET /api/engineering/permissions` was the largest remaining controller. Its read
assembly moves to `services/authorization/permissionMatrix.js`
(`preparePermissionReads`, `readPermissionMatrix`): the table view's enriched users
(explicit profile or role default, groups merged from the user_groups table and
the legacy group column, responsibilities), the module catalog with its
role/group/profile defaults, and one user's effective-permissions matrix with the
"who has access and why" explanation. The service answers `{ status, body }`; the
route keeps the `permissions.view_matrix` gate, `initDb`, the query parsing and
the envelope. The PUT (the grant/revoke/… writes) stays for a later slice.

`npm test` (244 suites, 3550 tests), `npx eslint` (0 errors) and `npm run build`
are green.

### Domain 79 — the permission writes (slice 115)

The `PUT` of the same controller follows. Its action switch (grant / revoke /
restrict / unrestrict, the role and group defaults, the profile / role /
supervisor / status changes, the Super Admin promotion and demotion) and the
eligibility boundary on a grant move to
`services/authorization/permissionWrites.js` (`applyPermissionChange`), together
with the audit record each write leaves. The route keeps the
`permissions.assign_capabilities` gate, the session, the required-field
validation and the ROLE gate on promote/remove (a role change is never a
capability grant, so it stays in the HTTP boundary). The service answers
`{ status, body }` and imports the same `@/lib/auth` / `@/lib/authorization`
facades the controller used, so the route-level test mocks keep intercepting.
The controller is now thin over two services.

`npm test` (244 suites, 3552 tests), `npx eslint` (0 errors) and `npm run build`
are green.

### Domain 79 (cont.) — the permission center view (slice 116)

The last controller of the domain is thin over two services, but the screen it
renders was a single 4 884-line `"use client"` file holding eight unrelated
views. It is now a 1 159-line shell over eight modules under
`src/components/permissions/permission-center/`.

**Read this one differently from the slices above: no code crossed a layer
boundary.** Nothing moved out of the View layer, no service gained a caller, no
route changed. This is a same-layer decomposition, so the usual "the controller
is now thin" measure does not apply — what changed is that eight views can now
be read, changed and tested without reading the other seven.

| Module | Holds |
|---|---|
| `AccessProfilesView.js` | the profile editor (largest single view) |
| `EligibilityView.js` | the eligibility decisions screen |
| `AuditView.js` | the audit history, its filters, its detail drawer |
| `GovernanceView.js` | the membership overview |
| `ResponsibilitiesView.js` / `ResponsibilityAccessView.js` | the responsibility registry and its access screen |
| `AccessExplanationPanel.js` / `CapabilityWhyModal.js` | the "who has access and why" surfaces |
| `shared/buildEditableModules.js` | the module/capability builder, used by the shell *and* the editor |

**The public surface is unchanged, deliberately.** `PermissionCenter.js` still
exports `PermissionManager` as its default and `GovernanceView` by name, because
`ContextScopeView.js` imports the latter from `./PermissionCenter` and sits
outside this phase's corridor. The shim keeps re-exporting the name; it stopped
owning the code, not the contract.

**The part worth keeping for the next slice.** Splitting a component silently
disarms every test that pinned a string against the file it used to live in. The
guards here are source-text guards, so that failure mode is invisible by
construction: a suite asserting `toContain("WhyDrawer")` against the shim keeps
passing when `WhyDrawer` has moved three files away. A guard was added for it
(`permission-center-extraction-integrity.test.js`) and it found **22 such pins**
across the two extractions — all still green at the time.

Two lessons from that guard are recorded here because they are not specific to
this slice:

- **A guard must inspect the same region the behavioural guards inspect.** Its
  first version walked `permission-center/` with a flat `readdirSync` and silently
  excluded `shared/` once the first shared module landed — a second, private
  definition of "the surface" that disagreed with the one the tests use. There is
  now one definition (`readPermissionCenterSurface`), and a test pins that the
  surface still contains what the guard assumes.
- **A guard that fails open is worse than no guard.** Its pin resolver silently
  skipped any assertion written as `expect(read(center))` — a call, not an
  identifier — so the alias indirection hid a pin it was supposed to catch. I had
  written in a commit message that the guard would catch it; it would not have.
  It is now checked by canary, and the canary is the part to keep.

**Unchanged throughout:** the rendered markup, the HTTP calls, the SQL, every
`t()` key, the tab routing, and both export names. Each extraction was verified as
a multiset over the shim plus its new file — identical line count, one line lost
to the `export` keyword and one gained.

`npm test` (257 suites, 3932 tests), `npx eslint .` (0 errors, 5 pre-existing
warnings elsewhere) and `npm run build` are green.

### Domain 80 — the dashboard overview (slice 116)

`GET /api/dashboard`, the largest controller after the permission matrix. Its
aggregation moves to `services/dashboard/overview.js` (`buildDashboardOverview`,
`getDashboardKpiSummary`): the IDOR-safe scope resolution, the parallel read
bundle, the calendar assembly (tasks spanning their date range, programs,
sessions, venture sessions, deliverables, events) and the summary / attention /
quick-access shaping — each widget guarded by its `allSettled` status so one
failure never takes the page down. The route keeps `initDb`, the `requireAuth`
gate (and the `super_admin` KPI shortcut), the session and the envelope.
`dashboard-api.test.js` still passes over the moved code — its assertions are on
the SQL the models run.

`npm test` (251 suites, 3660 tests), `npx eslint` (0 errors) and `npm run build`
are green.

---

### Domain 81 — the model facades are gone (slice 117)

The eight compatibility facades that §3 held back are now deleted — every
importer points straight at the service (or the reads store):
`models/authorization/{resolver,scope,contextGrantReadiness,eligibility-admin,context,contextGrants,programAssignments,programScopeReadiness}.js`.
The lib shims (`lib/authorization/{resolver,context,scope,eligibility-admin}.js`)
now re-export the service directly, and the `models/authorization` barrel takes
the decision surface from
`@/services/authorization/{context,scopedAccess,eligibilityAdmin}`.
`programAssignments` (which also re-exported its reads store) splits cleanly:
callers take the reads from `models/authorization/programAssignmentReads` and the
decisions from `services/authorization/programAssignments`. The
`services-boundaries` façade assertion now reads the lib façade.

Two model→service edges survive and stay listed in §3:
`programAssignmentBackfill.js` and `models/authorization/contactContexts.js`
(it needs `resolveScopeIds`).

`npm test` (252 suites, 3675 tests), `npx eslint` (0 errors) and `npm run build`
are green.

---

### Domain 82 — the LMS checkout settlement and reconciliation (slice 118)

Two decisions the paid-course path still kept in its controllers:

1. **The verified-payment rule was written twice.** The payer's own `verify`
   (`api/public/checkout`) and the Kkiapay notification (`api/webhooks/kkiapay`)
   each re-implemented "check the amount against the price we recorded, mark
   paid, grant access, send the receipt, journal it" — with comments already
   warning the two must never diverge. The rule now lives once in
   `services/lms/checkout.js` as `settleVerifiedPayment(...)`, returning
   `{ ok: true, fulfillment, delivery }` or
   `{ ok: false, reason: "amount_mismatch" }`. Both controllers call it and keep
   only their envelope; the journal field values are passed in so each path still
   records the value the provider actually reported (the notification its own
   `event`, the verify its `verified` answer), keeping the audit trail identical.

2. **The reconciliation sweep was a lib module.** `lib/lms/checkoutReconcile.js`
   — the safety net that replays a failed access step and re-verifies a success
   we could not confirm — is now `services/lms/checkoutReconcile.js`; the lib
   path is a facade. The two importers (`api/lms/registrations`,
   `api/lms/checkout-reconcile`) and the cron test keep resolving unchanged.

The behaviour net is the existing `lms-checkout.test.js`: it drives both the
notification and the payer's own verify through the shared settlement — the
falsified-amount refusal that journals and grants nothing, and the receipt that
still goes out when the access step fails.

`npm test` (253 suites, 3689 tests), `npx eslint` (0 errors) and `npm run build`
are green.

---

### Domain 83 — the investor relationship workspaces and meetings (slice 119)

`api/investor/relationships` and `api/investor/relationships/meetings` were the
largest remaining investor controllers after the due-diligence, campaigns and
pipeline slices. Their decisions move to `services/investor/relationships.js`
(the own-scope binding of a workspace — the id comes from the request — the list
scope, and the create/update orchestration with its timeline entries and the
best-effort introduction notification) and
`services/investor/relationshipMeetings.js` (the own-scope binding of a
workspace's meetings, the creation with its scheduled timeline entry, and the
completion cascade — the completed timeline entry plus the workspace
`next_action` seeded from the first action item). Every statement stays in
`@/models/investorRelations`; both routes keep only `initDb`, the
capability/role gate and the envelope.

`security-lot2-investor-scope.test.js` still drives the route end to end over the
same mocked models, and a focused `investor-relationships.test.js` pins the moved
decisions.

`npm test` (254 suites, 3717 tests), `npx eslint` (0 errors) and `npm run build`
are green.

---

### Domain 84 — the rest of the investor portal (slice 120)

The remaining `api/investor/**` controllers that still held a decision, after
slices 119:

- **`evaluation`** — the own-scope binding of a pipeline (the id comes from the
  request) and the write dispatch by `type` (founder vs risk) move to
  `services/investor/evaluation.js`.
- **`decisions`** — the profile resolution (no profile = an empty page), the
  valid decision types, the own-scope binding and the decision→stage table move
  to `services/investor/decisions.js`.
- **`organizations`** — an organization is visible only to its members (or
  management), the listing is scoped to the caller's own profile, and only an
  administrator OF THAT organization may add or re-role a member — in
  `services/investor/organizations.js`.
- **`watchlist`**, **`preferences`**, **`meetings`** — the toggle, the profile
  guard, and the "a self-service caller must name a venture, or the query returns
  every investor's meetings" rule move to `watchlist.js`, `preferences.js` and
  `meetings.js`.
- **`dashboard`** — the recommendation scoring (industry 30 / country 25 /
  stage 20 / ticket 15 / readiness 10) and its ordering, plus the block assembly,
  move to `services/investor/dashboard.js`, with a pure `scoreVentures` helper.
- **`executive-dashboard`** and **`admin-overview`** — the two super-admin
  aggregations move to `services/investor/executiveDashboard.js` and
  `adminOverview.js` (no decision beyond a row's shape; the `requireAuth`
  super-admin gate stays at the boundary).
- **`setup-password`** — the required fields, the length rule, the setup-token
  lookup and its expiry move to `services/investor/setupPassword.js`.

`register` is a retired 410 with no decision, so it is left as-is. The routes
keep only `initDb`, the capability/role gate and the envelope; every statement
stays in `@/models/investor*`. A focused `investor-portal.test.js` pins the moved
decisions, and the existing `security-lot2-investor-scope.test.js` keeps driving
the routes end to end over the same mocked models.

`npm test` (255 suites, 3775 tests), `npx eslint` (0 errors) and `npm run build`
are green.

---

### Domain 85 — the public registration surfaces (slice 121)

`api/public/register` and `api/public/group-info` are the two public LMS
surfaces still holding a decision:

- **`register`** — the group lookup with its families→v2_groups fallback, the
  "an existing email is NOT proof of ownership, so an anonymous form must never
  rewrite an account's credentials" rule, the same-program facilitator/participant
  conflict guard, and the canonical membership sync move to
  `services/lms/publicRegistration.js` as `registerParticipantViaGroupLink`. Field
  presence and the password length stay in the controller, which is where
  validation belongs.
- **`group-info`** — the same group resolution plus the program registration
  window move to `buildPublicGroupInfo`.

Every statement stays in `@/models/platformConfig`; both controllers keep only
`initDb` and the envelope (the role-conflict response shape stays at the
boundary). A focused `lms-public-registration.test.js` pins the moved decisions,
and the static guard in `security-p0-regressions.test.js` now points at the
service (the invariant is unchanged, only its home moved).

`npm test` (256 suites, 3785 tests), `npx eslint` (0 errors) and `npm run build`
are green.

---

### Domain 86 — the webhook decisions: Resend and Kkiapay (slice 122)

Two webhook controllers still held a real decision:

- **`api/webhooks/resend`** — the Svix signature check (constant-time, and any
  of several candidates during secret rotation), the freshness window that stops
  a captured delivery from being replayed, and the event → status map move to
  `services/email/resendWebhook.js` (`processResendWebhook`, with a pure
  `verifySvixSignature`). The controller keeps the secret, the header reads and
  the envelope; the append to the log stays in `services/email/log`.
- **`api/webhooks/kkiapay`** — the notification STATE MACHINE moves to
  `services/lms/checkoutWebhook.js` (`processPaymentNotification`): an unknown
  reference is journaled and never creates a registration, a duplicate on an
  already-paid registration does nothing, an explicit failure is recorded, and
  anything else is handed to the server-side verification and then the shared
  `settleVerifiedPayment`. The controller keeps `initDb`, the provider, the
  signature verification, the payload parsing and the response shape; the
  outcome is a discriminated value.

The two static guards that pinned the rules now point at the services
(`security-lot6-hardening.test.js` for the Resend signature/freshness), and two
focused suites pin the moved decisions (`email-resend-webhook.test.js`,
`lms-payment-notification.test.js`). The end-to-end `lms-checkout.test.js`
(34 cases) keeps driving the Kkiapay route unchanged.

Assessed and deliberately left at the controller, because they hold no business
decision: the `api/lms/registrations` action dispatch (`link-run` vs
`reconcile` — the work already lives in the services), `api/gmail-v1-test` (a
self-labelled temporary diagnostic), `api/integrations/**`,
`api/public/course-match` and `api/webhooks/route.js` (already delegate).

`npm test` (258 suites, 3803 tests), `npx eslint` (0 errors) and `npm run build`
are green.

---

### Domain 87 — the ops reports controller frontier (slice 123)

`GET`/`POST /api/op-reports` still decided four things in the controller. They
move to `services/dashboard/opReports.js`:

- **who may read whose reports** — only a `super_admin` reads beyond their own;
  another user's `user_id` is a 403 and issues no read at all (`listReports`);
- **the upsert** — a report already stored for the same user + week + year + type
  is updated in place, anything else is inserted (`saveReport`);
- **the field-merge rule** — an update may touch a fixed set of columns, and an
  empty `projects_tasks` never erases the stored (auto-generated) task list;
- **the workspace** — a NEW report from an intern lands in `interns`, everyone
  else in `main`.

The service reads and writes through `@/models/adminOps` and answers
`{ status, body }`; the controller keeps `initDb`, the `reports.create`
capability gate for POST, the session read and the response envelope. The
response shapes are unchanged.

`op-reports.test.js` (13 cases) pins the moved decisions with the repository
mocked — the refusal, the self-scoped read, the super-admin read, the
required-field 400, create vs update, the intern/main split, the
`lastInsertRowid` fallback and both `projects_tasks` merge paths.

`npm test` (259 suites, 3818 tests), `npx eslint` (0 errors) and `npm run build`
are green.

---

### Domain 88 — the KPI controller frontier (slice 124)

Two surfaces: the strategic-KPI CRUD (`POST`/`PUT`/`DELETE /api/kpis`) and the
objective-progress read (`GET /api/kpi-progress`,
`POST /api/kpi-progress/recalculate`).

- **`api/kpis`** — the three use-cases move to `services/dashboard/kpis.js`:
  resolving which programme a KPI belongs to (so the scope gate is asked about
  the right one, for the handlers that receive only a KPI id) and the write
  itself, with the default target (80) owned in one place and reported back for
  the audit entry. The controller keeps `initDb`, the roles gate, the
  validation, the `requireProgramScope` gate (`wave: "groups"` — the coverage
  census still sees it), `logAuditEvent` and the envelope. The three handlers'
  repeated preamble (roles gate, validation, scope gate, audit) is factored into
  local helpers, so the file shrank from 149 to 120 lines.
  `program-scope-wiring.test.js` (which drives the real handlers) and
  `program-scope-coverage.test.js` (which reads the route source) both still
  pass unchanged.
- **`api/kpi-progress`** — the read decisions move to
  `services/dashboard/kpiProgress.js` (`getKpiProgress`, `recalculateAndSummarize`):
  the schema-drift fallback (`source: "unavailable"`), the on-the-fly
  recalculation when the cache is empty (and its `source` label), the plain
  average, and the measurable-only average for the recalculation summary. The
  recalculation engine itself stays in `services/programs/kpiProgress`. Both
  routes keep their `createHandler` wrapper; only the decisions left the
  handlers.

`kpi-progress.test.js` (8 cases) and `kpis-service.test.js` (6 cases) pin the
moved decisions with the repository and the recalculation mocked.

`npm test` (261 suites, 3836 tests), `npx eslint` (0 errors) and `npm run build`
are green.

---

### Domain 89 — the user-administration controller frontier (slice 125)

Three surfaces: `POST /api/admin/approve-user`, `POST /api/admin/reject-user`
and `GET /api/admin/pending-users`. Their work moves to
`services/dashboard/userAdmin.js`:

- **approve-user** — the existence (404) and status (400) checks, the ROLE rule
  (only a Super Admin may name an arbitrary role; anyone else is limited to the
  approvable set, so approval can never mint a Super Admin), the 24 h
  password-setup token stored hashed, the setup email, the audit entry (actor
  from the SESSION) and the notification clearing;
- **reject-user** — the same shape for rejection;
- **pending-users** — the read and the grouping by group name.

The controller keeps `initDb`, the token-column bootstrap, the capability gate,
 the base URL (from the request headers) and the envelope. The setup token is
still never returned to the caller.

Two source-level security contracts were repointed (invariant unchanged):
`security-lot3-admin-authz.test.js` now reads the role rule and the audit actor
from the service, and `security-lot6-hardening.test.js` reads the rejection
actor there too. `admin-user-admin.test.js` (13 cases) pins the moved decisions,
including a route-level case proving the audit actor comes from the session and
the token is not echoed.

`npm test` (262 suites, 3851 tests) is green. The full `npx eslint` / `npm run
build` were momentarily red on an unrelated in-progress edit of
`src/app/pm/programs/[id]/page.js` (V1), not on this slice; the slice's own files
lint clean.

---

### Domain 90 — the admin analytics and admin project controller frontiers (slice 126)

Two families in one slice.

**Admin analytics** (`admin/analytics`, `admin/analytics/users`) →
`services/dashboard/adminAnalytics.js`: the week/date framing (a single shared
`getWeekNumber` helper in `services/dashboard/weeks.js`), the derived rates
(carry-over, blocker, completion, average resolution hours), and the per-user
aggregation with its batched reads and safe fallbacks.

**Admin projects** (`admin/projects/**`) → four services:
- `adminProjects.js` — the batched list aggregation (with the totals) and the
  detail assembly (tasks with their blockers/subtasks/resources, the team union,
  the timeline, the completion rate and timeline health);
- `adminProjectUpdates.js` — the weekly narrative upsert;
- `adminProjectApprovals.js` — the tolerant read, the validation, the
  OBJECT-LEVEL check (the bodied request must belong to the project in the URL),
  the approve/reject write, the task linking and the requester notification;
- `adminProjectReports.js` — the auto-generated weekly report.

The controllers keep `initDb`, the role checks, `requireProjectAccess` and the
envelope. One source-level security contract was repointed here (invariant
unchanged): `security-lot3-admin-authz.test.js` now reads the approval
object-level check from the approvals service; `security-lot9-admin-scope.test.js`
kept driving the real route (the scope guard stayed in the controller).

`admin-analytics.test.js` (5 cases) and `admin-projects.test.js` (20 cases) pin
the moved decisions.

`npm test` (264 suites, 3888 tests) is green. The full `npx eslint` / `npm run
build` were momentarily red on an unrelated in-progress edit of
`src/app/pm/programs/[id]/page.js` (V1); this slice's own files lint clean.

---

### Domain 91 — the bulk-upload controller frontier (slice 127)

`POST /api/admin/bulk-upload` decided the CSV parse, the protected-group
detection, the per-row validation (required fields, email shape, phone
uniqueness), the role boundary (an importer without the role-assignment
capability may only create self-service roles), the upsert, the rollback on a
database failure and the completion notification. Those move to
`services/dashboard/bulkImport.js` (`parseContactCsv`, `csvWantsInternalGroup`,
`importContacts`), which parses with `papaparse`, hashes with
`@/server/auth/password` and reads/writes through `@/models/**`. The controller
keeps `initDb`, the three capability gates, the protected-group boundary (it
parses first, then asks) and the envelope.

One source-level security contract was repointed (invariant unchanged):
`security-lot3-admin-authz.test.js` now reads `IMPORTABLE_ROLES` from the
service while `const canAssignRole = !assignRoleError` stays on the route.
`admin-bulk-import.test.js` (15 cases) pins the moved decisions.

`npm test` (265 suites, 3905 tests) and `npm run build` are green. `npx eslint`
is red only on the unrelated in-progress `src/app/pm/programs/[id]/page.js`
(V1); this slice's files lint clean.

---

### Domain 92 — the admin venture-create controller frontier (slice 128)

`POST /api/admin/ventures/create` decided the input validation, the duplicate
handling, the founder INVITATION (never a fabricated account or a written
membership), the recorded delivery outcome and the activity entry. Those move to
`services/dashboard/adminVentures.js` (`createVentureWithFounderInvite`), which
writes through `@/models/ventureAdmin` and `@/models/ventureMemberInvitations`,
mails through `@/lib/email` and reads the app URL through `@/lib/appUrl`. The
controller keeps the super-admin `createHandler` gate and the envelope.

Assessed and deliberately left at the controller (no business decision):
`api/admin/ventures` (a type/action dispatch over `@/lib/ventures`),
`api/admin/run-migration` (a sanctioned, super-admin-only migration runner whose
statements are data) and `api/admin/fix-participant` (a self-labelled temporary
diagnostic).

The existing `ventures/admin-venture-create.test.js` (7 cases) drives the route
unchanged.

`npm test` (265 suites, 3907 tests) is green. The full `npx eslint` / `npm run
build` were momentarily red on the unrelated in-progress
`src/app/pm/programs/[id]/page.js` (V1); this slice's files lint clean.

---

### Domain 93 — the remaining compatibility façades (slice 129, CH-4)

The last chantier: the pure re-export shims kept alive only so importers would
not have to change. **68 single-target façades** were removed by a mechanical
codemod that rewrote every import site (absolute `@/...` **and** relative) to the
module the façade pointed at, then deleted the shim — **61 under `src/lib/**`**
(the LMS family, the platform family, the authorization/access façades, finance,
contacts, tasks, the ventures façades, `audit`…) and **7 under `src/models/**`**
(the model façades pointing at a service). No reference to a removed façade
remains (a scan resolves every import, relative included).

**Multi-target façades were left in place** — they re-export several modules, so a
mechanical per-symbol rewrite is not safe: `@/lib/auth`, `@/lib/ventures`,
`@/lib/authorization/membership`, `@/lib/authorization/eligibility`,
`@/models/authorization/index`, `@/models/kpi-progress`,
`@/models/ventureDocumentTypes`, `@/models/lms/index`. They cost nothing at
runtime and can be split in a later pass.

Three suites needed a touch because they mocked a removed façade:
`services-boundaries.test.js` now requires the authorization services directly;
`tasks-api`, `tasks-create-api` and `tasks-update-api` mocked
`@/lib/db/queries/tasks` (gone), so their `@/models/tasks` mock is now complete
(`...requireActual` / merged) and the real functions still run against the
suite's fake database.

`npm test` (265 suites, 3907 tests) is green; `npx eslint` reports **0 errors**
in the tree. The full build was momentarily red on the unrelated in-progress
`src/app/pm/programs/[id]/page.js` (V1).
### View split — the Venture Journey panel (task B7)

Not a layer move: the **view** side of the ventures lane (Fiche 2). The staff
Journey manager `src/components/ventures/JourneyManagerPanel.js` (2 617 → 1 761
lines) and the founder Journey tab
`src/components/ventures/workspace/tabs/JourneyPlaybookTabs.js` (654 → 515) are
split into 16 files under `src/components/ventures/journey/` (15
components and one pure helper module). Code is
moved verbatim; each block receives the parent's values as props of the same
name, the parent keeps every state and every write. Public exports are
unchanged (`JourneyManagerPanel`, `{ JourneyTab, BusinessModelTab }` — the
latter re-exported). The `@/lib/ventureStatuses` usages stay in both parents
(`journey-status-lexicon.test.js`). Commits `8a6d3559`, `58e9f5b8` on
`ventures-b7`; the full inventory is in `docs/VENTURES_LANE.md`.

`npm test` (3552 tests), `npx eslint` (0 errors) and `npm run build` are green.

### Ventures lane — controllers and big services (task L2)

The ventures lane (Fiche 2). Decisions leave eight controllers for 12 new
modules in `src/services/ventures/` (listed in its `index.js`): session
booking rules, booking targets, calendar authority and notices; the journey
read assembly and stage actions; roster follow-ups; the task board and status
gates; deliverable review; the Venture dashboard aggregate; milestone
completion settling; the plan-import flow. The routes keep the HTTP boundary
and their response contracts: `sessions` 555 → 234, `journey` 445 → 247,
`members` 383 → 284, `tasks` 330 → 230, `deliverables` 309 → 243,
`dashboard` 307 → 38, `milestones` 306 → 221, `plan-import` 284 → 217.
Services import the same facades the controllers used, so route-level
`jest.mock`s keep intercepting. Five big services are split into folders with
the original file kept as a same-surface barrel: `planImport` (1 178),
`milestoneEngine` (548), `journey` (520), `verification` (487), `profile` (441).
`submissions` stays whole (`identity-gate-bridge.test.js` reads its source) and
`schema` is one DDL function. Branch `ventures-l2`; the slice-by-slice log is in
`docs/VENTURES_LANE.md`.

`npm test` (3631 tests), `npx eslint` (0 errors) and `npm run build` are green.

Follow-up (the lane's component and service leftovers). `JourneyManagerPanel.js`
1 761 → 1 399 lines: six presentational parts in
`src/components/ventures/journey/`. `PlanReview.js` 958 → 503 lines: five parts in
`src/components/ventures/plan-import/`. `submissions.js` becomes a same-surface
barrel over `src/services/ventures/submissions/` (five parts), and `schema.js` a
barrel over `src/services/ventures/schema/` (seven parts concatenated in the
original order). `identity-gate-bridge.test.js` was repointed at the new submission
part (same assertions). The parent components keep all state and writes; the moved
blocks are verbatim (translated keys and class names counted identical before and
after). `npm test`, `npx eslint` (0 errors) and `npm run build` are green. Log in
`docs/VENTURES_LANE.md`.


### Programs lane — the lifecycle, curriculum and participant services (task C)

The programs lane (Fiche 3). Three big services are split by concern, each keeping
its public entry point as a same-surface barrel so the routes and their tests are
untouched:

- `services/programs/workspace.js` (790) → `programList.js` (the list read and its
  completion index), `programCreate.js` (slug, duplicate/date rules, defaults,
  audit), `programUpdate.js` (archive shortcut, field update, segment sync),
  `programDelete.js` (the protected-data guard) and `programV2.js` (the v2 create /
  directory / whitelisted update), with a `programShared.js` helper. `workspace.js`
  (22) is now the barrel.
- `services/programs/curriculum.js` (539) → `curriculumSchema.js` (the self-healing
  schema steps), `curriculumShared.js` (version snapshot + KPI refresh),
  `curriculumScope.js` (which record's program authorises the action),
  `curriculumActions.js` (the POST vocabulary), `curriculumUpdate.js` and
  `curriculumDelete.js`. `curriculum.js` (26) is the barrel.
- `services/programs/participant.js` (402 → 189): the pure assembly moves to
  `participantCurriculum.js` (weeks and lock state), `participantMetrics.js`
  (completion / attendance / KPI achievement) and `participantResources.js`.

Admin V16: the two remaining monoliths are split too. `NewProgramForm.js`
1 346 → 491 with ten parts under `src/components/admin/programs/new-form/` (six
form sections, the asset-loading hook, the network actions, the toast, the
template selector, constants). `EditProgramModal.js` 1 491 → 709 with eight parts
under `src/components/admin/programs/edit-modal/`. The moved blocks are verbatim:
the translated-key multisets and the API-URL surfaces were counted identical
before and after, and the build is green.

`npm test` is green except `venture-assignment-columns.test.js`, an in-progress
change of the ventures lane (a concurrent writer), unrelated to this task.
`npx eslint` 0 errors on the touched scope; `npm run build` green.

### Operations lane — the field assembly, blockers, attendance and reviews (task F)

The internal-operations lane (Fiche 6). The tasks/projects controllers were
already decision-clean (slices 37–44); this lane finishes the half that was
left: the PUT field assembly is split, and the blockers / attendance / review
controllers are lightened.

**The field assembly.** `services/tasks/updateFields.js` (426) becomes a
same-surface barrel over `services/tasks/updateFields/` — `patch` (the SET
accumulator), `descriptive` (link/priority, title/description, status, project
and context), `intent`, `assignment` (the three branches) and `schedule` (the
drift detection and the date rules). `update.js` and its suites are unchanged.

**Blockers** → `services/tasks/blockers.js` (`listBlockers`,
`createBlockerForTask`, `updateBlockerRecord`, `deleteBlockerRecord`,
`listBlockerDiscussions`, `postBlockerDiscussion`): the read scope (own /
supervised / Super Admin), the create permission and the closed-status guard,
the resolve ownership with the task revert, the delete ownership and the
discussion fan-out. `blockers/route.js` 373 → 166; `blockers/discuss/route.js`
116 → 71.

**Attendance** → the new `services/operations/attendance.js`: the idempotent
schema steps, the write plan (facilitator team scope, foreign-program batch
guard, the ±1 day window), the idempotent mark upsert and the read scope
(facilitator team filter, summary/list). The route keeps `requireAuth`, the
assignment guard (which answers HTTP), the own-scope binding and the envelope.
`attendance/route.js` 258 → 213.

**Facilitator reviews** → the new
`services/operations/facilitatorReviews.js`: the read scope, the submit assembly
(the 16 values and the respond-to-changes branch) and the PM-decision ownership
rule. The route keeps the role list, the assignment guard and the envelope.
`facilitator-reviews/route.js` 256 → 144.

New service domain `services/operations/` (barrel `index.js`), and `blockers`
is added to the `services/tasks` barrel. The route-level contracts the source-pin
suites hold (`facilitator-capability-coverage`, `identity-gate-bridge`,
`authz-scope-enforcement`) are untouched: the guards, their capability keys and
the own-scope literal stay in the routes. New behaviour nets:
`blockers-api.test.js` (13), `attendance-api.test.js` (7) and
`facilitator-reviews-api.test.js` (9).

`npm test`, `npx eslint` (0 errors) and `npm run build` are green.

---

## 3. Left aside on purpose (deferred, with reasons)

1. **Model facades** — **deleted** (slice 117): `resolver`, `scope`,
   `contextGrantReadiness`, `eligibility-admin`, `context`, `contextGrants`,
   `programAssignments`, `programScopeReadiness`. Two model→service edges
   remain: `programAssignmentBackfill.js` (item 2) and
   `models/authorization/contactContexts.js`, which calls the scope service for
   `resolveScopeIds`.
2. **`models/authorization/programAssignmentBackfill.js` imports the level
   decision from the service** — a backfill (data work) that needs a decision;
   it stays in models for now.
3. **No type layer** (see §4).

`server/authz/guards.js` was the *other* authorization boundary; it is now split
(slice 112) — see §2, Domain 77.

---

## 4. What remains

### Authorization domain — done

Every module that mixed a decision with its queries is split (slices 1–8), and
the domain is now HTTP-free at the service layer (slice 9). What is left is
cleanup, not layering:

| Item | Status |
|---|---|
| Facades (§3.1) | shim-only re-exports, deleted when unused |
| `server/authz/guards.js` | ✅ split (slice 112) — the decisions live in `services/authorization/resourceGuards.js` |
| Decision tests | `authorize`, `evaluateAuthorization`, the derivation and the resource guards are now testable without HTTP |

### Other domains — not started

| Domain | Service to create | Notes |
|---|---|---|
| Finance | `services/finance/*` | ✅ **complete** (slices 10–11) |
| Programs | `services/programs/*` | ✅ **controller frontier complete** (slices 13, 68–72, 76) — lifecycle, workspace bundle, exports, weekly reports, teams, curriculum — and the big services are now split (lifecycle, curriculum, participant); the admin form/editor components are split too (see §2, Programs lane, task C) |
| Contacts / CRM | `services/contacts/*` | ✅ **controller frontier complete** — sync (slice 14), the decision helpers (slice 22), groups (65), user groups (66), the registry feed (67), alternative emails (73), group members (74, retiring the last Supabase route), directory search (75), duplicate flags (77), timeline (78), merge (79) and the `/api/contacts` registry controller — list read (80), soft-delete (81), registration (82), update (83). |
| Ventures | `services/ventures/*` | ✅ **models done** — document types (slice 15) + plan import (slice 20); `ventureAssets`/`ventureMemberAccess` checked and fine |
| Workspace | `services/workspace/*` | ✅ **models done** (slice 19) — the Venture-session calendar source; the rest of `workspace.js` is a repository |
| Tasks / projects | `services/tasks/*`, `services/projects/*` | ✅ **both domains controller-clean** — projects (slices 37–38), tasks (slices 39–44, including the `tasks/route.js` monolith) |
| LMS / platform / integrations | `services/<domain>/*` | ⏳ **started** — LMS learner experience (17), checkout (18), Run report (21) and the registration team actions (84); platform AI evaluation (85), the `form-runs` Run-detail read (93), the `form-runs` email/report-document cluster (95), the import routes (96), the seeds (97), the AI form generation (98), the template personalizer (99), the advisory analysis (100), the evaluation scoreboard (101), the form-runs scoring engine (102), the review workflow (103), the forms/collections controllers (104) and the rest of the `form-runs` POST vocabulary — the respondent write path, the run lifecycle, the email actions, the messaging actions, the link/document/run actions (105–109), the PUT/DELETE verbs (110) and the remaining platform controllers — notifications, integrations, investor-run, evaluation-config, report-file (111) — **`/api/platform/form-runs` is now a thin controller over `services/platform/formRuns.js`**; the checkout settlement is now shared once (`settleVerifiedPayment`) and the reconciliation sweep moved from lib into the service (slice 118) — and the two big services are now split into same-surface barrels (`learning/` eight parts, `checkout/` seven parts, see §7, Lead lane) |
| Communications | `services/communications/*` | ✅ **controller frontier complete** — message scope (earlier), campaigns (86), internal messages (87), announcements (88), follow-ups and events (89–90) |
| Submissions | `services/ventures/submissions.js` | ✅ **controller frontier complete** — the submit POST (91), the review PATCH (92), the list GET (93) and the score PUT (94) |
| Participant | `services/participant/*` | ✅ **domain complete, and now split** — assignments, home, progress, follow-ups, full state, rituals, timeline, submissions; `home.js` (499) and `progress.js` (416) became same-surface barrels over `home/` + `progress/` on a shared `participant/rules.js` (see §7, Lead lane) |
| Investor | `services/investor/*` | ✅ **domain complete, and now split** — diligence, campaigns, pipeline, relationships, evaluation, decisions, organisations, watchlist, preferences, meetings, dashboards, aggregators, password; `diligence.js` (337) became a same-surface barrel over `diligence/` (see §7, Lead lane) |
| Dashboard & ops admin | `services/dashboard/*` | ✅ **aggregators complete, and now split** — `overview.js` (498) became a same-surface barrel over `overview/` (dates, calendar, attention, projects, kpi, build) |

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
  **`ventures.js` (5.8k lines at the start of the wave) is now a barrel**: all
  23 domains (activity/history/notifications → system monitoring, slices 33–56)
  plus the core (schema, intake, record, slices 57–59) are out, re-exported
  through `src/lib/ventures.js` over `services/ventures/*` and
  `models/venture*Store.js`. **The non-venture `src/lib` tail is done too** —
  `auth.js`, `audit.js`, `token-hashing.js`, `lms/coaching.js` and `email.js` were
  split, and `request-context.js` never held SQL (only a comment). **`src/lib`
  now contains no `db.execute` outside `db.js` itself.** The next frontier is the
  remaining controller-heavy routes and the giant page files below.
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

### Domain 94 — the platform services: the formRuns/import/seed/report split (slice 130, 2026-10-02)

The four oversized platform SERVICE files are now thin barrels at the same path
over cohesive modules in a sibling folder (the `PermissionCenter.js` +
`permission-center/` convention). No code crossed a layer: same-layer
decomposition, public surfaces byte-identical, imports and tests unchanged.

- **`formRuns.js` (2 260) → `formRuns/`**: `detail` (the Run-detail read and
  `enrichAssignments`), `resultEmails` (`logTimeline`, the decision/result
  senders and the scheduled dispatcher), `review` (`processReviewInternal`),
  `lifecycle` (status vocabulary, launch, assignments), `submitters` (the submit /
  manual-add / email-correction path), `sends` (retry/cancel/bulk/manual/activation
  sends) and `actions` (slug rotation, submission delete, report re-roll, run
  create/metadata/archive). Each module declares exactly the imports it uses;
  `review`/`submitters`/`sends`/`actions` import `resultEmails` directly, never
  through the barrel, so there is no cycle. Non-exported helpers stay with their
  only caller.
- **`report.js` (426) → `report/`**: `prompt` (the guardrails, the identity and
  prompt helpers and the parser) and `store` (the stored-report reuse and the one
  `getOrCreateSubmissionReport` entry point). `MODEL`/`nonEmptyString` live once
  in `prompt`; the barrel re-exports only the original public names, so nothing
  new leaks.
- **`import.js` (609) → `import/`**: `preview` (parse + fuzzy match),
  `execute` (contact resolution + the row loop) and `reviewFlags`.
- **`seed.js` (535) → `seed/`**: `founderAssessment` and `investorApplication`.

The `readSurface` concatenation is sort-order-sensitive, so the module names
carrying ordering-pinned calls were chosen to keep the pins true: `review` sorts
before `sends` (so the `await sendDecisionEmailForSubmission(` call the review
gate must precede is first found in `review`), and `resultEmails` sorts before
`submitters` (so the loud run/form-context read is found before the
respondent-email correction's own).

Verification: `npx eslint src/services/platform` → 0 errors; the 13 platform /
source-pin suites → 13 suites, 200 tests green (same as before); the DB budgets
(`db-sequencing-audit`, `db-roundtrip-budget`) → 2 suites, 9 tests green.

---

### Domain 95 — the platform VIEWS and the public/intents controllers (slice 131, 2026-10-02)

The same lane's remaining size debt: the two oversized platform screens and the
last two deciding controllers.

- **`src/app/platform/runs/page.js` (V2) 2 925 → 2 391.** The inline modals and
  panels move to module-scope components in `src/components/platform/runs/`:
  `ReviewModal`, `ManualAddModal`, `MessageComposerModal`, `ExportOptionsModal`,
  `RunDetailHeader`, `EvalProgressPanel`, `RunTabs`, `DashboardStats`,
  `RunsToolbar`, `CreateRunModal`, `DatePickerModal`. The page keeps state, data
  fetching, handlers and orchestration; the rendered markup is unchanged. (The
  control at column 0 rule matters here: a component created during a render
  remounts its inputs every keystroke — the editors stay module-scope.)
- **`src/app/platform/forms/page.js` (V6) 1 979 → 886.** The list, the builder
  (palette/canvas/field), the config panels, the template editor and the three
  modals move to `src/components/platform/forms/` (`TemplateEditor`,
  `TemplatesPanel`, `FormsListView`, `BuilderHeader`, `ScoringPanel`,
  `WorkflowPanel`, `EvaluationFrameworkPanel`, `FormCanvas`, …).
- **The `intents` controllers** (`/api/intents`, `/api/intents/[id]`,
  `/api/intents/[id]/tasks`) → `services/platform/intents.js`. The visibility,
  ownership, responsible-exists, Contact-Group and progress decisions leave the
  three routes, which keep `requireAuth`, `initDb`, the parsing and the envelope.
- **`/api/s/public-submit` (502 → ~140)** →
  `services/platform/publicSubmit.js` (`submitPublicResponse`). The run-by-slug
  resolution, the deadline/auto-close, the paid-run consent gate, the IP rate
  limit, the identity read from the form's own labels, the duplicate idempotency,
  the submission limit, the draft upgrade, the checkout capture and the
  post-submission automation/evaluation leave the route. The route keeps the
  HTTP boundary: the schema self-heal, the payload-size guard, the capture cookie
  and the injected `after` hook.

The source-pin suites now read a module's whole SURFACE via
`src/__tests__/helpers/sourceSurface.js` (base file + same-named folder), so a
pin cannot go vacuously green once the code moves into a sibling file.

Verification: `npx eslint src/services/platform src/app/api/intents
src/app/api/s/public-submit/route.js src/app/platform/runs/page.js
src/components/platform/runs src/app/platform/forms/page.js
src/components/platform/forms` → 0 errors; `lms-checkout`, the platform suites,
`server/services-boundaries`, `route-catalog-contract` and the two security lots
→ green.

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

### Communications — reprise L8 / B1 / B6

Les décisions d'accès des suivis et la distribution des opérations de notifications
sont dans `src/services/communications/`. Les routes conservent authentification,
validation et sérialisation HTTP. La messagerie interne est séparée en résolution
du périmètre, lecture, envoi et marquage lu, derrière les mêmes exports publics.

La coquille et le chat gardent leurs points d'entrée publics ; leurs blocs de rendu
sont extraits vers `src/components/layout/shell/` et
`src/components/messaging/chat/`. Aucun layout de section n'est modifié.
Le périmètre exact et les responsabilités sont documentés dans
`src/services/communications/README.md`.

### Communications — le découpage du modèle et le marquage lu (tâche G, 2026-10-02)

`models/communications.js` (812) devient un barillet de même surface au même
chemin, au-dessus de modules cohésifs dans `models/communications/` : `scope`
(résolution des destinataires et du périmètre), `messages` (lectures/écritures
des messages et le marquage lu), `announcements`, `followups`, `campaigns` et
`events`. Le SQL est déplacé **à l'identique** ; importateurs et tests gardent le
même chemin `@/models/communications`.

Le marquage lu est corrigé : `updateMessagesReadByIds(messageIds, plan)` remplace
l'ancienne mise à jour filtrée par les seuls identifiants. Le service résout le
plan de visibilité de l'appelant (`resolveMessageVisibilityPlan`, le même plan que
la boîte de réception) et le dépôt ré-applique le prédicat de visibilité, de sorte
qu'un identifiant que l'appelant ne peut pas lister met à jour zéro ligne. La
branche « conversation » reste limitée au couple expéditeur/destinataire et le
refus de participation est inchangé. Épinglé par
`communications-read-scope.test.js` (3) et `internal-comms-read.test.js` (2).

Conformité coquille/chat : les libellés d'invitation, d'affectation et de thème
passent par `t()` (`common.projectInvitation`, `common.taskAssignment`,
`common.invitedToJoin`, `common.assignedTask`, `common.aProject`, `common.aTask`,
`common.theme.*`, `common.accept`, `common.decline`, `common.user`, `common.menu`)
dans les deux locales ; les boutons de refus perdent `bg-slate-600`/`text-white`
au profit de `bg-surface-3`/`--text-primary` ; les deux champs de fichier du chat
passent de `text-slate-400` à `--text-tertiary`. Le rendu des blocs reste identique.

`npm test` (298 suites, 4 695 tests), `npm run lint` (0 erreur) et
`npm run build` sont verts.

### Lead — les six gros services découpés (couloirs réservés, 2026-10-02)

Les six plus gros services des couloirs réservés au lead deviennent des
**barillets de même surface** : le fichier `foo.js` reste à son chemin et
réexporte le même contenu public, les décisions sont regroupées dans `foo/` par
concern. Aucun importateur (route, page, test) ne change de chemin.

| Service | Avant | Après | Modules |
|---|---|---|---|
| `lms/learning.js` | 601 | 41 | `learning/` : `structure`, `progress`, `enrollmentProgress`, `completion`, `catalog`, `lessons`, `assessments`, `enrollments` |
| `lms/checkout.js` | 582 | 39 | `checkout/` : `runCourse`, `identity`, `accessToken`, `fulfillment`, `capture`, `resume`, `settlement` |
| `participant/home.js` | 499 | 18 | `rules.js` (partagé) + `home/` : `metrics`, `actions`, `calendar`, `build` |
| `participant/progress.js` | 416 | 16 | `progress/` : `program`, `summary`, `build` |
| `dashboard/overview.js` | 498 | 21 | `overview/` : `dates`, `calendar`, `attention`, `projects`, `kpi`, `build` |
| `investor/diligence.js` | 337 | 35 | `diligence/` : `json`, `status`, `questions`, `read`, `workspaceActions`, `requestActions`, `followUpActions`, `dispatch` |

**Les règles de décision partagées sont sorties, pas dupliquées.**
`isUnlockedSession` et `resolveDeliverableWeek` étaient importés par `progress`
depuis `home` : ils vivent maintenant dans `participant/rules.js`, et les deux
écrans les lisent. `home.js` et `progress.js` les réexportent, donc la surface
publique et le barillet `@/services/participant` sont inchangés — les deux vues ne
peuvent plus diverger sur la semaine courante.

**Vérification.** Chaque fonction déplacée est **byte-identique** à l'originale
(module normalisé : lignes trimées, commentaires et `export` retirés) — contrôle
mécanique sur les 20 fonctions de `learning`, les 12 de `participant`, les 9 de
`diligence` et les helpers de `overview` (plus un diff ligne à ligne des deux
blocs de statistiques qui étaient en ligne). Le seul réécriture est
`overview/`: les blocs « stats de tâches », « stats de blockers » et « projets
quick-access », qui étaient **en ligne** dans `buildDashboardOverview`, deviennent
`summarizeTaskStats`, `summarizeBlockers` et `buildQuickAccessProjects` ; le
défaut de lecture (`Promise.allSettled`) retombe sur la même valeur nulle qu'avant
(`summarizeTaskStats([], todayStr)`), donc un widget en échec ne change rien. Le
`Promise.allSettled` et chaque test `fulfilled` restent en place à l'identique.

**Le bug que le découpage a révélé.** `checkout/identity.js` importait
`normalizeRegistrationEmail` depuis `@/models/lms/checkoutStore` au lieu de
`@/models/lms/registrations` : le symbole était `undefined`, donc
`findContactForPurchase` levait, `fulfillment` rattrapait, et **9 tests de
`lms-checkout.test.js` voyaient `access: "failed"`** au lieu de `granted`. ESLint
ne le voit pas (pas de `no-undef` sur ce motif) et les tests unitaires ne le
voient pas quand le modèle est simulé. Le contrôle qui l'attrape : la provenance
statique de chaque import nommé sur `src/**` (« ce module exporte-t-il vraiment
ce symbole ? », en suivant les barillets et `export *`). Elle est désormais verte
sur tout `src/` — le seul signal restant est un faux positif hors périmètre
(`components/permissions/ContextScopeView.js`, `default as GovernanceView`).

**Tests textuels repointés.** `lms-section-resource-learner-files.test.js` et
`login-next-redirect.test.js` lisaient le contenu de `learning.js` et
`checkout.js` ligne à ligne ; ils lisent désormais la surface concaténée
(`readSurface`) via `src/__tests__/helpers/sourceSurface.js`, donc ils épinglent
toujours le même texte, sur le barillet + ses modules. Mêmes assertions.

**Audit des couloirs réservés.** Plus aucune route n'appelle une autre route
(`grep 'from "@/app/api'` → 0 dans `src/app/api`), le calendrier et les workspaces
sont déjà des contrôleurs fins (`services/workspace/calendar.js`), et
`op-reports`, `kpis`, `kpi-progress`, `activity`, `dashboard` et les 18 routes
`api/admin/**` ne portent plus de décision. Restent en contrôleurs, volontairement :
`admin/run-migration` (DDL d'un runner temporaire), `admin/fix-participant`
(réparation ponctuelle, CID codé en dur) et `admin/tasks` (agrégation de blockers
par lot — mise en forme pure). `npm test` (298 suites, 4 754 tests),
`npx eslint .` (0 erreur, 16 avertissements préexistants) et `npm run build` sont
verts.

---

## Slice 130 — CH-4 : dissolution des façades pures (2026-10-02)

Le domaine 93 avait supprimé les 68 façades à **cible unique** et laissé les
**cibles multiples**,jugées non réécrivables mécaniquement. Ce slice termine le
travail : `@/lib/ventures` (106 importateurs), `@/lib/ventureMilestoneEngine`
(21), `@/models/contacts` (19), `@/models/groups` (14),
`@/lib/authorization/membership` (9), `@/models/ventureDocumentTypes` (8),
`@/models/kpi-progress` (6), `@/lib/authorization/eligibility` (4) et les dix
façades `@/lib/venture*` restantes sont supprimées — **18 fichiers**.

Le codemod ne se contente plus d'une cible : il résout le **propriétaire réel de
chaque symbole** et réécrit le site d'import en conséquence, quel que soit sa
forme — `import { … }`, `const { … } = require(…)`, `await import(…)`,
`require(…)` en espace de noms, et **factory `jest.mock`** (une factory qui
mélangeait deux modules devient une factory par module). Les commentaires
d'en-tête qui promettaient « re-exported through the compatibility facade »
ont été réécrits : ils décrivent un fichier qui n'existe plus.

Trois contrôles ont trouvé ce que les 298 suites ne voyaient pas, et sont
maintenus dans la routine :

| Contrôle | Ce qu'il attrape | Exemple du slice |
|---|---|---|
| provenance des imports nommés | un module importé n'existant plus | `Could not locate module @/models/contacts` |
| diff de surface (avant/après par fichier) | un symbole **perdu** | `getIntegrationProviders` supprimé de `api/integrations/route.js` (vu par ESLint : `no-undef`, pas par Jest) |
| table des propriétaires | un symbole pointant vers le **mauvais** module | `logAuditEvent` réécrit vers `ventures/integrations` au lieu de `ventures/auditSecurity` |

Le piège récurrent est le **mock mélangé** : une factory
`jest.mock("@/models/contacts", () => ({ ...jest.requireActual(…), x: jest.fn() }))`
répartie mécaniquement perd son spread, et la moitié réellement mockée
disparaît — les tests repassaient quand même tant que la fonction non mockée
n'était pas appelée. Les factories ont été recomposées en
`...jest.requireActual("<module 1>"), ...jest.requireActual("<module 2>")`, et les
espaces de noms reconstitués (`{ ...orgTeams, ...v2Groups }`). Deux suites ont
dû apprendre les deux formes d'appel du pool (`execute({ sql, args })` et
`execute(sql)` du runner de migration).

**Trois surfaces restent, volontairement :** `@/lib/auth` (301 importateurs) n'est
pas une façade pure — six fonctions y sont encore implémentées, retenues parce
qu'elles ont une seconde implémentation parallèle sur les mêmes tables ;
`@/models/authorization/index` et `@/models/lms/index` sont des barillets **de
même surface** (un point d'entrée sur les modules d'un même dossier), pas des
facades inter-couches ; `@/models/communications` appartient à un autre couloir.

Gates du slice : `npm test` 298 suites / 4 754 tests, `npx eslint .` 0 erreur
(16 avertissements préexistants), `npm run build` vert. Le journal destiné aux
stagiaires est en `docs/REPARTITION_STAGIAIRES.md` § 4.8.

## Slice 131 — PM program workspace : le page d'écran (2026-10-03)

Première tranche d'une série consacrée à la **taille des écrans** (la couche V),
distincte de la répartition des couches. Cible : `src/app/pm/programs/[id]/page.js`,
2 450 lignes, qui avait grandi en absorbant le workspace entier (onglets, modales,
44 gestionnaires, 55 handlers). Découpage **latéral, même couche** : aucune
requête déplacée, aucun contrat d'API touché, aucun état déplacé hors de la page.

| Fichier | Lignes | Rôle |
|---|---|---|
| `page.js` | 719 | l'état, les deux lectures, la config, la composition |
| `actions/` (9 fabriques) | 1 800 | les écritures, une par préoccupation |
| `useAttendanceMarks.js` | 58 | l'effet de chargement des présences |
| `WorkspaceContent.js` | 224 | le contenu des onglets |
| `WorkspaceModals.js` | 389 | les 13 modales |

Le **parent garde tout l'état et toutes les écritures**, comme le contrat l'exige :
chaque fabrique est sans état et sans SQL, lue dans un objet unique. Deux objets
sont construits à la main dans la page — `values` (état, setters, lectures) puis
`ctx` (`values` + tous les handlers, les fabriques déversées **avant** pour qu'un
nom commun reste un handler) — et les deux blocs de rendu lisent `ctx`, chacun
listant **ses** dépendances dans sa propre signature (69 et 114 noms). C'est ce
qui fait tomber les ~230 lignes de simple réacheminement de props : elles sont
maintenant dans le bloc qui en a besoin, pas dans la page.

Trois pièges réels de ce slice :

| Piège | Symptôme | Résolution |
|---|---|---|
| passant des `ref` pendant le render | ESLint `react-hooks/refs` : *cannot access refs during render* | pas de fabrique pour la config ; `saveConfig` reste dans la page, seul `readConfigFields` était à déplacer |
| objets fusionnés dans le désordre | `const ctx = { ...handlers, ...state }` en TSDZ — les fabriques référencées avant leur déclaration | `values` d'abord, `ctx` ensuite, spreads testés par un ordre explicite |
| sur-indentation des corps extraits | 4 espaces au lieu de 2 dans les 9 fabriques | l'outillage de découpe dédupliquait `[id]` de sa propre liste de fichiers (`glob` y lit une classe de caractères) : les neuf modules ont été vérifiés **verbatim** contre l'original, puis réalignés |

Les blocs de markup ont eux aussi été comparés **octet pour octet** à l'original
(`/tmp/opencode/pmws/verify2.cjs`) avant remontage : une découpe « à l'œil » d'un
extrait de 250 lignes est une réécriture silencieuse.

**Le contrôle qui manque d'habitude** — `src/__tests__/program-workspace-wiring.test.js`
(3 tests) : rien ne relie les trois côtés au niveau des types, et aucune suite ne
rend cet écran. Un nom qui n'atteint plus son bloc est donc invisible — la fabrique
reçoit `undefined`, ou le composant lit un champ absent ; ESLint ne voit rien non
plus, chaque nom étant déclaré quelque part. La suite épingle le câblage : les
paramètres de chaque fabrique doivent être des clés de `values`, chaque nom lu par
un bloc doit être une valeur ou un handler retourné, et l'ordre des spreads de
`ctx` est vérifié. Mutation testée (retrait d'une clé de `values`) : le suite
échoue bien, puis passe après restauration.

Gates du slice : `npm test` 299 suites / 4 757 tests, `npm run lint` 0 erreur
(16 avertissements préexistants), `npm run build` vert. Suite : la page `runs`
(2 391 lignes).

## Slice 132 — Plateforme runs : le page d'écran (2026-10-03)

Deuxième tranche de la série sur la **taille des écrans**. Cible :
`src/app/platform/runs/page.js`, 2 391 lignes — l'écran le plus long du dépôt
après PM. Elle avait déjà été découpée en « rounds » successifs (onze onglets,
modales et panneaux vivent dans `components/platform/runs/`) : ce qui restait
donc dans le fichier était la **colonne vertébrale** — l'état, les lectures, les
effets, 57 gestionnaires et quatre gros blocs de JSX.

| Fichier | Lignes | Rôle |
|---|---|---|
| `page.js` | 1 432 | l'état, les lectures, les effets, la composition |
| `actions/` (11 fabriques) | 1 518 | les écritures, une par préoccupation |
| `RunListView.js` | 114 | tableau de bord, barre d'outils, table, création |
| `RunResponsesPanel.js` | 180 | filtres, table des réponses, sélection, menu bulk |
| `RunAdminTabs.js` | 171 | les cinq onglets d'administration |
| `RunDetailModals.js` | 137 | review, ajout manuel, composeur, export |

54 gestionnaires déplacés, 1 029 lignes de corps vérifiées **verbatim**, et 236
lignes de markup comparées octet pour octet (`/tmp/opencode/runs/verify_actions.cjs`,
`verify_views.cjs`). Même contrat que slice 131 : le parent garde l'état et les
lectures, chaque fabrique est sans état, et `values` puis `ctx` (spreads des
fabriques d'abord) relient les trois côtés.

Quatre pièges réels, tous diagnostiqués par le build ou par le compilateur :

| Piège | Symptôme | Résolution |
|---|---|---|
| `values` de 249 noms | « c'est juste un sac à variables vidé dans un autre fichier » — le page devient illisible | assumé, comme en slice 131 : `values` est la frontière, et le test de câblage interdit qu'un nom s'y glisse sans être lu par quelqu'un (le builder échoue si une valeur n'est lue par ni une vue ni une fabrique) |
| `ref` passant pendant le render | ESLint `react-hooks/refs` sur `filterRowRef`, `bulkAbortRef`, `retryAbortRef` | `runBulkApprove` et `runRetryEmails` **restent dans la page** (ils lisent ces refs) et passent en props explicites ; jamais via `ctx` |
| valeur dérivée lisant un handler déplacé | `ReferenceError: Cannot access 'eR' before initialization` au prerender | `trackingFilterValue` est une lecture pure de l'état des filtres : elle reste dans la page. Une valeur dérivée ne peut pas vivre au-dessus du câblage qui instancie la fabrique qui la retourne |
| imports laissés derrière | `Parsing error: Identifier 'React' has already been declared` | le pruneur d'imports tourne sur le corps **après** coupure des handler et des vues, jamais avant |

Deux autres pièges, cette fois dans l'outillage de découpe :

- l'import par défaut devient nomné si le script écrit `import { X }` pour un
  module `export default` : ESLint est vert, `npm test` est vert, **seul le build
  échoue** (`Export X doesn't exist in target module`). C'est le seul filet.
- un pin de test qui lit le chemin de la page devient *vacuement* vert quand le
  code migre : `run-report-file.test.js` lisait la page seule, son aiguille
  `/api/platform/form-runs/report-file` ayant rejoint `actions/runSettings.js`. Le
  helper lit maintenant `page + actions/ + components/` (300 suites vertes, la
  garde est plus large qu'avant, pas plus lâche).

**Le contrôle qui manque** — `src/__tests__/platform-runs-wiring.test.js` (5 tests) :
paramètres de fabrique ⊂ `values`, noms lus par un bloc ⊂ valeurs ∪ handlers,
refs et handlers de batch hors de `values` et en props, ordre des spreads de `ctx`,
et `values` sans nom fantôme. Mutation testée (retrait de `selectedRun` de
`values`) : 2 tests tombent, puis tout repasse après restauration.

Gates du slice : `npm test` 300 suites / 4 762 tests, `npm run lint` 0 erreur
(16 avertissements préexistants), `npm run build` vert. Suite : le rapport
opérationnel staff (1 800 lignes).

## Slice 133 — Rapport opérationnel staff : le page d'écran (2026-10-03)

Troisième tranche de la série sur la **taille des écrans**. Cible :
`src/app/staff/op-report/page.js`, 1 800 lignes. Le dossier
`components/staff/op-report/` comptait déjà une vingtaine de petites vues, mais
le page gardait la colonne vertébrale : 42 gestionnaires, 11 helpers de module,
les gestionnaires de brouillon et deux gros blocs de JSX.

| Fichier | Lignes | Rôle |
|---|---|---|
| `page.js` | 672 | l'état, les lectures, les effets, les brouillons, la composition |
| `readers.js` | 215 | les 11 helpers purs de portée module |
| `useOpReportNav.js` | 47 | les trois gestionnaires de navigation (header) |
| `actions/` (12 fabriques) | 1 276 | les écritures, une par préoccupation |
| `ReportContent.js` | 216 | la vue stand-up, retro ou résumé de semaine |
| `OpReportModals.js` | 125 | les quatre modales |

42 gestionnaires déplacés, 44 corps vérifiés **verbatim** et 211 lignes de markup
comparées octet pour octet (`/tmp/opencode/oprep/verify.cjs`, en lecture seule :
il ne régénère rien, donc une retouche manuelle après la génération est attrapée
au lieu d'être écrasée). `surface.cjs` rejoue l'inventaire des 132 noms que
l'écran déclarait avant et exige que chacun reste atteignable — page, `readers`,
handler retourné ou `ctx` de bloc.

Cinq pièges réels :

| Piège | Symptôme | Résolution |
|---|---|---|
| hook de brouillons extrait | ESLint `react-hooks/exhaustive-deps` (6 avertissements) parce que les setters d'un `useState` multiple n'ont pas d'identité stable | les brouillons **restent dans la page** ; seuls les trois gestionnaires du header partent, dans un hook sans état |
| paramètre compté comme lu à tort | `no-unused-vars` sur `userId`, `getWeekNumber` : une déclaration locale (`const userId = user?.cid`) ou un paramètre de fonction imbriquée masquait la lecture du nom de la page | l'analyse de lectures exclut ce qu'une déclaration imbriquée masque, sinon la fabrique réclame un paramètre qu'elle n'utilise pas |
| `keptText` incluant les imports | 18 imports morts laissés dans le page (aucun plus utilisé) | le texte de référence exclut les lignes d'import : un import n'est jamais une preuve d'usage |
| `import { getCurrentWeek as getCurrentWeek }` | ESLint vert, build vert, mais du bruit dans chaque module | le rétrécissement d'import réutilise la forme d'origine quand les noms sont identiques |
| vérification verbatim tautologique | `dedent(...).slice(0, 0) || original` comparait toujours `original` à lui-même : 44 « vérifications » vertes sans rien vérifier | le vérificateur compare le corps dé-indenté ré-indenté de deux espaces, et un test de mutation (un `notify` → `notifY`) le fait tomber |

**Le contrôle** — `src/__tests__/op-report-wiring.test.js` (5 tests) : paramètres de
fabrique ⊂ `values` ∪ handlers retournés ∪ noms du hook, noms lus par un bloc ⊂
valeurs ∪ handlers, chaque spread de `ctx` présent, `values` sans nom fantôme et
sans `draftTimerRef`, et l'ownership des spreads (un paramètre rendu par une autre
fabrique doit arriver par `...cetteFabriqueResult`). Mutation testée sur trois
coups : clé de `values` retirée, spread de `ctx` retiré, `orphanKey` ajouté — 3
tests tombent ; puis le spread de `notify` retiré d'un appel de fabrique — le
test d'ownership seul tombe (c'est lui qui l'attrape).

Gates du slice : `npm test` 301 suites / 4 767 tests, `npm run lint` 0 erreur
(16 avertissements préexistants), `npm run build` vert. Suite : `src/lib/email.js`
(1 626 lignes).

## Slice 134 — `src/lib/email.js` : le service d'email (2026-10-03)

Quatrième tranche de la série sur la **taille des fichiers**, mais plus un écran :
1 627 lignes de service d'email dans `src/lib/email.js`. Ici le découpage n'a pas
d'états à partager ni de composants à extraire — c'est un **monolithe de module** :
61 déclarations de portée module, deux transports, un moteur de template, onze
points d'entrée publics et 27 fichiers qui importent `@/lib/email`.

Le découpage garde la convention du dépôt : `src/lib/email.js` reste le point
d'entrée (une façade de 81 lignes), l'implémentation vit dans `src/lib/email/`,
un module par préoccupation. Aucun des 27 importateurs n'est touché.

| Module | Lignes | Rôle |
|---|---|---|
| `email.js` (façade) | 81 | la surface publique, rien d'autre |
| `config.js` | 56 | les constantes lues dans l'environnement |
| `resend.js` | 44 | le transport Resend |
| `gmail.js` | 122 | le transport Google Workspace (MIME, pièces jointes, OAuth) |
| `templates.js` | 163 | copy par défaut, `{{variable}}`, templates conçus |
| `addresses.js` | 272 | adresse, nom, langue : toute décision pure de destinataire |
| `send.js` | 85 | le choix de fournisseur (primaire, repli, erreur) |
| `delivery.js` | 137 | envoi + journal de livraison |
| `senders/accounts.js` | 293 | invitation, connexion, bienvenue, mot de passe |
| `senders/ventures.js` | 175 | invitations venture (membre, fondateur) |
| `senders/workflow.js` | 105 | décision, confirmation |
| `senders/results.js` | 281 | copy du résultat et livraison du PDF |

Le graphe est un **DAG** vérifié par tri topologique : `config → gmail/resend →
send → delivery → senders/*`, plus `templates` et `addresses` en feuilles. Un
cycle est impossible par construction ici (une seule exception au programme
ci-dessous), mais il est **détecté** : `templates.js` qui importerait
`delivery.js` fait tomber la génération.

Chaque déclaration part **verbatim**, bloc de commentaire compris : la plage de
lignes du monolithe bouge d'un bloc, donc laisser le commentaire derrière
l'aurait supprimé du dépôt. 207 contrôles en lecture seule
(`/tmp/opencode/email/verify.cjs` — il ne régénère rien, donc une retouche
manuelle après la génération est attrapée).

Cinq pièges réels :

| Piège | Symptôme | Résolution |
|---|---|---|
| nom privé lu par un autre module | ESLint : 12 avertissements `no-unused-vars` sur des `const`/`function` que d'autres modules importent | seule dérogation à l'identique : le mot-clé `export` est ajouté devant la définition lue ailleurs. Réordonner ou renommer une constante dans un modulecassait tous ses consommateurs sans erreur ici |
| `sections` du fichier devenues fausses | les invitations étaient sous le bandeau `TEMPLATE ENGINE` : les bandeaux décrivent l'ordre de lecture d'un jour, pas les frontières | le module d'un nom vient d'un `PLAN` explicite, jamais du fichier |
| specificateur nu | `./addresses` devient `addresses` : un module sans préfixe `./` ou `@/` est un paquet. `npm run lint` **vert**, `npm run build` **vert** | garde dans le générateur : tout specificateur doit être relatif ou aliasé. Seul `npm test` l'a vu |
| import dupliqué | `import { X } from "./config"` émis sept fois dans `gmail.js` | l'entrée d'un import n'est poussée qu'à sa création |
| pin de test devenu vide | `result-email-founder-fit.test.js` lisait `src/lib/email.js` : ses 15 pins passaient sur une façade de 81 lignes, la copy ayant migré dans `senders/results.js` | le test lit `readSurface("src/lib/email.js")` — le helper concatène la façade **et** le dossier `email/`, donc le pin suit la copy (15 tests verts) |

**Le contrôle** — `src/__tests__/email-module-surface.test.js` (4 tests) : tout
nom importé de `@/lib/email` est exporté par la façade ; tout nom exporté est
défini par exactement un module (sauf le journal de livraison, réexporté depuis
`@/services/email/log`) ; le graphe est acyclique ; aucun module n'importe un
nom qu'il n'utilise pas. Mutation testée : `sendDecisionEmail` retiré de la
façade → 1 test tombe ; `templates.js` important `delivery.js` → le test
d'acyclicité tombe (`delivery.js → templates.js → delivery.js`).

Gates du slice : `npm test` 302 suites / 4 771 tests, `npm run lint` 0 erreur
(16 avertissements préexistants), `npm run build` vert.

## Slice 135 — Panneau Venture Journey : le page d'écran (2026-10-03)

Cinquième tranche de la série sur la **taille des écrans**. Cible :
`src/components/ventures/JourneyManagerPanel.js`, 1 399 lignes — le plus gros
fichier de composant du dépôt avant ce slice. Le dossier `journey/` comptait déjà
22 petites vues (stage, milestone, deliverable, session, inbox…), mais le panneau
gardait la colonne vertébrale : 66 gestionnaires, 52 valeurs d'état, 5 lectures et
un `return` de 202 lignes de JSX.

| Fichier | Lignes | Rôle |
|---|---|---|
| `JourneyManagerPanel.js` | 384 | l'état, les lectures, `setStages`, la composition |
| `journey/actions/stageWrites.js` | 223 | créer, éditer, dupliquer, patcher, les deux flux template |
| `journey/actions/journeyBulk.js` | 239 | sélecteurs, sélection, bulk archive/restore/delete, confirmation |
| `journey/actions/milestones.js` | 279 | ajouter, éditer, déplacer, dupliquer un jalon, son menu |
| `journey/actions/deliverables.js` | 271 | lignes de livrable, preuve soumise, revue |
| `journey/actions/booking.js` | 163 | la réservation de session et sa note |
| `journey/actions/reports.js` | 100 | composer un rapport de progression, l'envoyer |
| `journey/actions/submissions.js` | 70 | lire les soumissions d'un jalon, décider |
| `journey/actions/labels.js` | 61 | les helpers purs : statut, date, textarea qui grandit |
| `journey/JourneyManagerModals.js` | 67 | les trois modales : template, sauvegarde, ajout |
| `journey/JourneyStageList.js` | 242 | le spinner, l'état vide, ou les cartes de jalon |

Les 125 déclarations du plan se répartissent ainsi : 52 `useState` et 5 lectures
restent dans le panneau, 66 gestionnaires partent, et deux déclarations restent
parce qu'elles doivent voir l'état lui-même — `setStages` (l'adaptateur qui publie
une écriture dans sa propre lecture) et la destructure `stages, access,
templateSource, milestoneAuthority, deliverablesUnavailable`. Les huit fabriques
sont ordonnées par **tri topologique** : `stageWrites → journeyLabels →
reportWrites → submissionWrites → milestoneWrites → deliverableWrites →
sessionBooking → journeySelection`. Aucune ne lit une fabrique placée plus bas —
`milestoneWrites` a besoin de `fmtDate` (labels) et de `loadMilestoneSubmissions`
(submissions), `journeySelection` a besoin de `openReportComposer` (reports) et de
`patchMilestone` (milestones) : l'ordre tombe du graphe, pas de la main.

Chaque corps part **verbatim**, bloc de commentaire compris : la plage de lignes
du monolithe bouge d'un bloc, donc laisser le commentaire derrière l'aurait
supprimé du dépôt. 125 déclarations (toutes les `const` du composant, commentaire
de tête compris) et les 494 chaînes littérales ou morceaux de gabarit du
monolithe — 155 distincts — sont comparés octet pour octet par 7 contrôles en
lecture seule (`/tmp/opencode/journey/verify.cjs` : il ne régénère rien, donc une
retouche manuelle après la génération est attrapée au lieu d'être écrasée).

Les deux blocs gardent leurs accolades : `<JourneyStageList ctx={ctx} />` rend
exactement ce que rendait le `{ loading ? … : … }` qu'il remplace — un fragment ne
crée pas de nœud DOM.

Cinq pièges réels :

| Piège | Symptôme | Résolution |
|---|---|---|
| nom de fabrique masqué par un état | la fabrique `milestoneSubmissions` était appelée par le panneau… où `const [milestoneSubmissions, setMilestoneSubmissions] = useState({})` déclarait le même nom : l'import était mort, l'appel levait « not a function » au premier rendu | garde dans le générateur : un nom de fabrique ne peut être ni un nom du panneau ni un import du module. La fabrique s'appelle `submissionWrites` |
| paramètre du composant oublié dans `values` | `ventureId` n'est pas une déclaration, c'est le paramètre du panneau : les fabriques lisaient `undefined` et toutes les URL devenaient `/api/ventures/undefined/journey` — ESLint **vert**, build **vert** | l'inventaire des valeurs part du paramètre du composant, pas seulement de ses déclarations. C'est le vérificateur indépendant qui l'a trouvé, pas les tests |
| icône importée *et* reçue en paramètre | `journeyBulk` declarait `Play`, `Lock`, `RotateCcw`… à la fois dans son `import` et dans sa signature : `SyntaxError: Identifier 'Play' has already been declared` | une fabrique **réimporte** ce que la portée module avait ; elle ne **reçoit** que ce que le panneau détient. Même règle pour les blocs, qui importent les composants qu'ils rendent |
| `Set.add(...noms)` n'ajoute qu'un nom | l'analyse de lectures gardait `kind` mais perdait `rawId`, `action`, `step` : les paramètres déstructurés d'un handler passaient pour des lectures libres | `Set.prototype.add` prend **un** argument ; l'ajout passe par une boucle explicite |
| lecture d'un membre optionnel comptée comme un nom | `editing?.deliverables` leakait `deliverables` comme paramètre orphelin | Babel distingue `OptionalMemberExpression` de `MemberExpression` : les deux sont traités |

**Le contrôle** — `src/__tests__/journey-wiring.test.js` (9 tests) : paramètres de
fabrique ⊂ `values` ∪ handlers retournés, et l'appel doit étaler le spread qui les
porte ; chaque nom lu par un bloc est une valeur ou un handler retourné ; **tout
nom libre du markup d'un bloc est listé dans sa signature** (analyse AST, pas
regex) ; `ctx` porte chaque fabrique et se termine par `...values,` ; `values`
sans nom fantôme, **sans handler qui masquerait un résultat** et sans nom que le
panneau ne déclare pas ; les fabriques sans état ni lecture ; le panneau rend bien
les deux blocs. Mutation testée sur dix coups
(`/tmp/opencode/journey/mutate.cjs`) : **10/10 attrapés**, suite verte ensuite.

Un pin voisin a dû suivre le déplacement : `journey-status-lexicon.test.js`
affirmait que `JourneyManagerPanel.js` importe `@/lib/ventureStatuses` — le
vocabulaire a migré dans `actions/labels.js` et `actions/deliverables.js`. Le pin
lit maintenant **la surface** (panneau + ses deux fabriques) : l'intention — un
seul vocabulaire, aucune carte locale — reste vérifiée là où le code vit.

Gates du slice : `npm test` 303 suites / 4 780 tests, `npm run lint` 0 erreur
(16 avertissements préexistants), `npm run build` vert.

## Slice 136 — Éditeur de profils d'accès : le page d'écran (2026-10-03)

Sixième tranche de la série sur la **taille des écrans**. Cible :
`src/components/permissions/permission-center/AccessProfilesView.js`, 1 318 lignes.
Le dossier `permission-center/` comptait déjà 11 vues extraites, mais l'éditeur de
profils gardait la colonne vertébrale : 34 valeurs d'état, 2 lectures, 2
chargementeurs, 3 effets, un `return` de 530 lignes de JSX et 32 gestionnaires de
haut en bas — le seul écran où l'on pouvait encore « créer / dupliquer / renommer /
désactiver / supprimer », « assigner un rôle par défaut », « le brouillon des
capacités » et « sectionner le catalogue » dans un même fichier.

| Fichier | Lignes | Rôle |
|---|---|---|
| `AccessProfilesView.js` | 409 | l'état, les lectures, les 2 chargeurs, les 3 effets, le retour anticipé, la composition |
| `profiles/actions/profileList.js` | 240 | créer, dupliquer, activer/désactiver, supprimer, renommer |
| `profiles/actions/capsDraft.js` | 181 | le brouillon, la revue, la sauvegarde, les confirmations |
| `profiles/actions/catalogSections.js` | 110 | les sections, l'éligibilité, les capacités éditables |
| `profiles/actions/roleDefaults.js` | 98 | poser/retirer un rôle par défaut |
| `profiles/actions/profileSelection.js` | 56 | le sélecteur → sélection, et le lien profond `?profile=<id>` |
| `profiles/ProfileDetail.js` | 435 | le détail : impact, brouillon, matrice des capacités |
| `profiles/ProfileDialogs.js` | 70 | les quatre modales |
| `profiles/ProfileCreateForm.js` | 68 | le formulaire de création |
| `profiles/ProfileNotices.js` | 66 | les trois avis : fait, échec, refus d'éligibilité |
| `profiles/ProfilePicker.js` | 53 | le sélecteur de profil |

Les 68 déclarations du plan se répartissent ainsi : 34 `useState` et 2 lectures
restent dans le panneau, 32 gestionnaires partent. Cinq gestionnaires restent
malgré tout, parce qu'ils voient l'état lui-même : les deux chargeurs
mémoïsés (`fetchProfiles`, `selectProfile`, les deux seuls `useCallback` du
fichier) et les trois dérivées (`availableModules`, `changesCount`,
`selectedIsDefaultFor`). Les 3 `useEffect` — l'impact du profil sélectionné, la
présélection par lien profond, le nettoyage des capacités stockées — ne
bougent pas : un effet déplacé dans une fabrique s'exécuterait au mauvais moment
de l'ordre des hooks.

Les cinq fabriques sont ordonnées par **tri topologique** : `profileSelection →
profileList → roleDefaultWrites → capsDraft → catalogSections`. Aucune ne lit une
fabrique placée plus bas — ici le graphe est plat, `spreads: none` partout : chaque
fabrique ne lit que `values`. Les deux gestionnaires que le panneau nomme encore
(`computeChanges`, `defaultRolesFor`) sont **destructurés du résultat** de
`capsDraftResult`, pas d'un `ctx` partiel : un `ctx` construit deux fois serait
une deuxième source de vérité.

Chaque corps part **verbatim**, bloc de commentaire compris : la plage de lignes
du monolithe bouge d'un bloc, donc laisser le commentaire derrière l'aurait
supprimé du dépôt. 68 déclarations et les chaînes littérales ou morceaux de
gabarit du monolithe sont comparés octet pour octet par 9 contrôles en lecture
seule (`/tmp/opencode/profiles/verify.cjs` : il ne régénère rien, donc une
retouche manuelle après la génération est attrapée au lieu d'être écrasée).

**Une seule phrase a dû être réécrite**, et le vérificateur l'exige au lieu de la
lâcher : le commentaire de `computeChanges` disait « `availableModules` is defined
later in the component body », ce qui est devenu faux au moment où les
dérivées ont changé de place. Il dit maintenant que la vérité du registre arrive
en paramètre. Le vérificateur connaît le couple avant/après, exige que la
remplacement apparaisse **exactement une fois** et que l'ancien texte disparaisse
de toute la surface : la dérogation est écrite, pas concédée.

Cinq pièges réels — dont un que **ni ESLint ni le build ne pouvaient voir** :

| Piège | Symptôme | Résolution |
|---|---|---|
| **retour anticipé au milieu du câblage** | dans le monolithe, `changesCount` et `selectedIsDefaultFor` étaient calculés **après** `if (loading) { return … }`. La première version générée les nommait dans `values`, construit **avant** ce retour : lecture dans la zone morte temporelle, `ReferenceError: Cannot access 'changesCount' before initialization` **au premier rendu** — ESLint vert, build vert, 304 suites vertes | câblage étagé : `values` sans ces deux noms, quatre fabriques, `const { computeChanges, defaultRolesFor } = capsDraftResult`, le retour anticipé, puis les deux dérivées, puis `catalogSections({ …values, selectedIsDefaultFor })`, puis `ctx`. Les deux noms voyagent sur `ctx`, entre les handlers et `...values`. Un contrôle du vérificateur et un test du suite refusent désormais qu'un nom soit lu avant sa déclaration, quel que soit le nom |
| fabrique qui retourne ce que personne ne lit | `isChanged`, `editableModules`, `allSections`… étaient retournés alors qu'ils ne servaient qu'à l'intérieur de leur propre fabrique. Un nom exporté et non lu ressemble à un câblage : il masque une écriture mal rangée | le générateur **trimme** chaque retour aux noms que l'autre côté consomme (paramètre de fabrique, prop de bloc, lecture du panneau) et **lève** si un retour ne trouve aucun lecteur. Le suite vérifie la même propriété dans l'autre sens |
| nom de fabrique masqué par un état | la fabrique `roleDefaults` était appelée par le panneau… où `const [roleDefaults, setRoleDefaults] = useState({})` déclarait le même nom : l'import était mort, l'appel levait « not a function » | garde dans le générateur : un nom de fabrique ne peut être ni un nom du panneau ni un import du module. La fabrique s'appelle `roleDefaultWrites` |
| effet ou hook aspiré par une fabrique | `persistCaps`, `saveChanges`, `confirmSave` appelaient `setSaving` puis un `useApi` de rafraîchissement : déplacés tels quels dans `capsDraft.js`, l'ordre des hooks changeait | une fabrique **ne appelle aucun hook** : les deux `useCallback` et les trois `useEffect` restent dans le panneau, qui garde les deux chargeurs ; le contrôle le refuse explicitement |
| déclaration et boucle séparées | `const editableCaps = […]` est suivi d'une boucle `for` qui la remplit : couper entre les deux produisait `editableCaps is not defined` | la boucle est coupée avec sa déclaration, et le générateur refuse une plage qui commence dans une déclaration et finit dans une autre |

Les cinq blocs gardent leurs accolades : `<ProfileDetail ctx={ctx} />` rend
exactement ce que rendait le `{selectedProfile && ( … )}` qu'il remplace — un
fragment ne crée pas de nœud DOM.

**Le contrôle** — `src/__tests__/access-profiles-wiring.test.js` (11 tests) :
paramètres de fabrique ⊂ ce que déclare le panneau ∪ `values` ∪ handlers
retournés, et l'appel doit étaler le spread qui les porte (ou nommer
explicitement la dérivée du panneau) ; chaque prop d'un bloc est portée par
`ctx` ; **`ctx` porte les cinq fabriques dans l'ordre d'appel**, puis ses deux
propres noms, puis `...values,` en dernier ; `values` sans nom fantôme, **sans
handler qui masquerait un résultat** et sans nom que le panneau ne déclare pas ;
une fabrique **sans retour mort** ; tout nom libre du markup d'un bloc est listé
dans sa signature (analyse AST, pas regex) ; chaque fabrique appelée **une seule
fois** ; le panneau garde son paramètre, ses 2 `useCallback`, ses 3 `useEffect`,
et son retour anticipé **avant** les deux dérivées. Mutation testée sur quinze
coups (`/tmp/opencode/profiles/mutate.cjs`) : **15/15 attrapés**, suite verte
ensuite.

Trois pins voisins ont dû suivre le déplacement, et ils ne lisent pas tous la même
chose. `ui2-profiles`, `ui3-followups` et `ui4-definitions` lisaient
`AccessProfilesView.js` en entier : `reason: reason.trim() || undefined` est parti
dans `capsDraft.js`, `PendingChangesList` et `impactAffects` dans `ProfileDetail.js`,
`catalogUnavailable` et le garde `moduleCatalog && visibleSections.length === 0`
aussi, `assignRoleDefault` et l'URL des défauts dans `roleDefaults.js`. Ces
assertions lisent maintenant **la surface** (le panneau + ses dix modules), donc une
copie plantée ailleurs échoue encore. Les assertions qui décrivent le panneau lui-même
— la présélection par lien profond, `setModuleCatalog(data.modules || {})`,
`availableModules`, l'URL de l'impact — **restent sur le panneau** : c'est là
qu'elles sont vraies, et les relire ailleurs affaiblirait le pin.

Gates du slice : `npm test` 304 suites / 4 791 tests, `npm run lint` 0 erreur
(16 avertissements préexistants), `npm run build` vert.

## Slice 137 — Plateforme runs : les hooks contrôleurs du page d'écran (2026-10-03)

Suite du slice 132 (`page.js` de la plateforme runs, laissée à 1 432 lignes). La
page garde son rôle d'orchestrateur, mais la colonne vertébrale — l'état, les
lectures et les gros calculs — part dans quatre hooks contrôleurs, et la vue
détail dans un composant. Décision actée au slice précédent : pour un écran à
colonne vertébrale lourde, on extrait un **hook contrôleur** plutôt que de laisser
1 400 lignes dans un seul fichier.

| Fichier | Lignes | Rôle |
|---|---|---|
| `page.js` | 776 | orchestration : composition des hooks, `openRun`, `runList`, `values`/`ctx`, rendu |
| `RunDetailView.js` | 71 | la vue détail : en-tête, onglets et composition des panneaux/modales |
| `useRunsReferenceData.js` | 147 | état + lectures de référence (formulaires, contacts, groupes, programmes, statistiques) |
| `useRunDerivedData.js` | 432 | calculs dérivés purs (réponses, filtres, doublons, emails, activation, statistiques) |
| `useRunResponseFilters.js` | 127 | la combinaison de filtres de la table et tout ce qu'elle mémorise avec elle |
| `useRunBulkActions.js` | 228 | état + les deux opérations par lots (approbation, renvoi d'emails) et les lots d'activation/résultat |

Deux points de conception méritent d'être notés.

**Le hook de filtres déplace de la logique rendue, pas seulement de l'état.** Le
`respFilterKey` et les trois enregistrements clés (`respPageState`,
`selectionState`, `duplicatesKey`) sont inséparables : le reset *est* la
comparaison de clés, exécutée pendant le rendu (§4.3). Les garder ensemble dans
`useRunResponseFilters` évite qu'un futur changement de la page casse la
propriété de sûreté — une sélection cachée ne doit jamais pouvoir être
approuvée/exportée. `resetFilters()` rejoue exactement la suite d'écritures de
`openRun`, avec la même capture de la clé en cours.

**Le hook des lots lit `openRun` par une ref, pas par paramètre.** `runBulkApprove`
et `runRetryEmails` doivent rafraîchir l'exécution ouverte, mais `openRun` est
défini *après* le hook (qui, lui, doit être appelé tôt pour que `openRun` puisse
appeler `resetBulk()`). La ref `openRunRef` est renseignée dans un
`useEffect(…, [openRun])` : une affectation directe pendant le rendu est refusée
par `react-hooks/refs` (« Cannot access refs during render »).

Le test de câblage `src/__tests__/platform-runs-wiring.test.js` a suivi : `BLOCKS`
inclut désormais `RunDetailView.js`, et la liste `values` continue de nommer
chaque valeur — y compris celles désormais destructurées des hooks — si bien que
la vérification « pas de nom fantôme » reste vraie sans modification.

Gates du slice : `npm test` 304 suites / 4 791 tests, `npx eslint` 0 erreur sur
les six fichiers, `npm run build` vert.

## Slice 138 — Éditeur d'accès individuel : le markup de la vue (2026-10-03)

Septième tranche de la série sur la **taille des écrans**, et première de la
Phase 1. Cible : `src/components/permissions/permission-center/PersonAccessScreen.js`,
1 145 lignes. L'écran garde toute sa colonne vertébrale — 18 valeurs d'état, la
garde `createLatestGuard`, les 3 effets, les lectures et les écritures
(`selectUser`, `saveProfileOverride`, `applyQuickAction`, `handleQuickAction`,
`refreshUserPerms`) — mais son markup part dans une vue qui ne lit qu'un objet
`ctx`. Même recette que le slice 132/137 : le rendu ne décide de rien, il reçoit
tout.

| Fichier | Lignes | Rôle |
|---|---|---|
| `PersonAccessScreen.js` | 551 | l'état, les 3 effets, les lectures/écritures, la construction de `ctx`, la composition |
| `person-access/PersonAccessView.js` | 699 | le markup : états de chargement/échec, remplacement de profil, la grille CRUD, le bloc d'exceptions, les modales |

**La liste de `ctx` n'est pas devinée.** Un script lit l'AST : il prend
l'expression `superAdminAction` et le `return` de `PersonAccessScreen`, calcule
leurs identifiants libres (référencés mais liés hors du sous-arbre), puis les
classe en trois tas — 22 imports (composants, icônes, helpers), la portée
module ; **42 clés `ctx`** (état, dérivées, gestionnaires), la portée composant ;
et les locaux des callbacks (`section`, `modKey`, `cap`…) qui restent dans la
vue. `superAdminAction` déménage avec le markup : il ne lit que des noms de
`ctx`. La découpe est donc exhaustive par construction, pas relue à la main.

Deux pins voisins ont été repointés, pas affaiblis. `ui2-people` et
`ui7-access-clarity` lisaient le fichier de l'éditeur pour des chaînes qui
vivaient dans le markup (`visibleFeatures={personFeatures}`,
`LEVEL_CHIP_ACTIVE`, `{selectedUser && !userPerms && (`, `<Skeleton`…). Le
markup ayant changé de fichier, ces assertions lisent maintenant **la surface**
(`readPermissionCenterSurface()`, qui inclut tout `permission-center/`), donc
une copie plantée ailleurs échoue encore. Les pins de logique — `createLatestGuard`,
`.begin()`, `isCurrent(token)`, `setUserPerms(null)` — **restent sur
`PersonAccessScreen.js`**, qui garde l'état et la garde.

**Le nouveau contrôle** — `src/__tests__/person-access-wiring.test.js` (3 tests) :
chaque nom que la vue destructure de `ctx` est une clé que l'écran met vraiment
dans `ctx` ; chaque clé de `ctx` est un nom que `PersonAccessScreen` déclare
(pas de clé fantôme) ; et l'écran rend bien `<PersonAccessView ctx={ctx} />`.

Gates du slice : `npm test` 305 suites / 4 794 tests, `npx eslint` 0 erreur,
`npm run build` vert.

## Slice 139 — Onglet d'aperçu des runs : les sous-panneaux de la vue (2026-10-03)

Huitième tranche de la série sur la **taille des écrans**, deuxième de la Phase 1.
Cible : `src/components/platform/runs/OverviewTab.js`, 970 lignes. Particularité :
c'était déjà un composant **purement présentationnel** — aucune valeur d'état,
aucun effet, aucun accès données, seulement **109 props** et ~900 lignes de JSX.
Il n'y avait donc pas de colonne vertébrale à garder : c'est la vue elle-même
qu'on découpe. `OverviewTab` devient une composition de 15 lignes qui passe ses
`props` à quatre sous-panneaux, chacun ne lisant qu'un objet `ctx`.

| Fichier | Lignes | Rôle |
|---|---|---|
| `OverviewTab.js` | 15 | la composition : rend les quatre sous-panneaux et leur passe `props` |
| `OverviewStats.js` | 38 | la rangée de cartes de statut (total, soumis, approuvé, rejeté, révision, brouillons, en retard) |
| `OverviewFilters.js` | 311 | la recherche du run, les puces de filtres actifs, les éditeurs en ligne (score, champ, suivi), l'ajout de filtre, la barre de sélection/actions |
| `OverviewResponsesTable.js` | 292 | le tableau des réponses (colonnes e-mail, score IA, e-mails, statut, compte, paiement, actions) + la timeline |
| `OverviewRunModals.js` | 313 | les modales : approbation groupée, envoi/renvoi d'activation, confirmation et aperçu du PDF de résultat, progressions, résumés |

**La liste de `ctx` n'est pas devinée.** Un script lit l'AST et, pour chaque
tranche de lignes (les quatre blocs JSX frères), calcule les identifiants
référencés mais liés hors de la tranche : les liaisons de portée module deviennent
des imports, celles de la portée composant deviennent des clés `ctx`, et les
locaux des callbacks (`statCard`, `fieldValueText`, `filter`, `option`…) restent
dans le sous-panneau. `t` est traité à part : chaque sous-panneau appelle
`useI18n()` lui-même. L'union des quatre listes fait **109 clés = exactement les
109 paramètres d'origine** ; la découpe est donc exhaustive par construction.

Deux garde-fous ajoutés à `src/__tests__/platform-runs-wiring.test.js` : chaque
clé que les sous-panneaux destructurent de `ctx` est une prop que
`RunResponsesPanel` passe réellement à `<OverviewTab>` (pas de nom fantôme,
puisque le JSX ne connecte rien au niveau du type) ; et `OverviewTab` rend bien
`<OverviewStats ctx={props} />` et ses trois voisins.

Gates du slice : `npm test` 305 suites / 4 796 tests, `npx eslint` 0 erreur,
`npm run build` vert.

## Slice 140 — Modale de rapport hebdo PM : les sections du formulaire (2026-10-03)

Neuvième tranche de la série sur la **taille des écrans**, troisième de la
Phase 1. Cible : `src/components/pm/program-workspace/PmReportModal.js`,
1 043 lignes. Comme l'onglet d'aperçu des runs (slice 139), c'était déjà un
composant **purement présentationnel** — aucune valeur d'état, aucun effet,
seulement `useI18n` et **39 props**. Le long formulaire est découpé par section
métier ; la modale ne garde que la coquille (racine cliquable, en-tête collant,
pied avec Annuler/Soumettre) et compose sept sous-panneaux.

| Fichier | Lignes | Rôle |
|---|---|---|
| `PmReportModal.js` | 66 | la coquille : racine, en-tête, pied, composition des sept sections |
| `PmReportOverviewSection.js` | 124 | semaine : statut, note globale, sujet principal |
| `PmReportAssignmentSection.js` | 167 | suivi d'assignation : donnée ?, KPI(s), objectif, résultat attendu |
| `PmReportParticipationSection.js` | 180 | participation : assiduité, niveau, participants à surveiller, remarquables |
| `PmReportDeliverySection.js` | 137 | livraison : qualité, compréhension, défis |
| `PmReportIssuesSection.js` | 158 | problèmes : a-t-il eu des soucis ?, types, attention super-admin, note |
| `PmReportNextWeekSection.js` | 86 | semaine prochaine : programme sur la bonne voie, ajustements |
| `PmReportNotesSection.js` | 166 | notes libres du PM + pièce jointe (lien ou PDF) |

**La liste de `ctx` n'est pas devinée.** Un script lit l'AST et, pour chaque
tranche de lignes (un frère JSX du conteneur `space-y-8`), calcule les
identifiants référencés mais liés hors de la tranche : la portée module donne les
imports (seule la section Notes utilise `X`), la portée composant donne les clés
`ctx`, et les locaux des callbacks restent dans la section. `t` est traité à
part : chaque section appelle `useI18n()`. L'union des sept listes fait **36
clés** ; les 3 props restantes (`isSaving`, `onClosePMReportModal`,
`onSubmitPMReport`) ne vivent que dans l'en-tête et le pied, gardés par la coquille.

Deux garde-fous ajoutés à `src/__tests__/program-workspace-wiring.test.js` :
chaque clé que les sections destructurent de `ctx` est une prop que
`WorkspaceModals` passe réellement à `<PmReportModal>` ; et `PmReportModal` rend
bien les sept `<PmReport…Section ctx={props} />`.

Gates du slice : `npm test` 305 suites / 4 798 tests, `npx eslint` 0 erreur,
`npm run build` vert.

## Slice 141 — Vue de profil : le markup de la vue (2026-10-03)

Dixième tranche de la série sur la **taille des écrans**, quatrième de la
Phase 1. Cible : `src/components/dashboard/ProfileView.js`, 909 lignes. Contrairement
aux slices 139/140, l'écran a une vraie colonne vertébrale : état (`useState`),
sept lectures `useApi`, la session (`useSessionUser`), des gestionnaires et deux
retours précoces (chargement, erreur). On applique donc la recette du slice 138 :
le markup part dans une vue qui ne lit qu'un `ctx`, l'écran garde tout le reste.

| Fichier | Lignes | Rôle |
|---|---|---|
| `ProfileView.js` | 430 | l'état, les lectures, la session, les gestionnaires, les retours chargement/erreur, la construction de `ctx` |
| `profile-view/ProfileViewContent.js` | 504 | le markup : en-tête, avatar, coordonnées, préférences, langue, e-mails alternatifs, photo, programmes, historique, groupe |

**La liste de `ctx` n'est pas devinée.** Un script lit l'AST, prend le `return`
principal de `ProfileView` et calcule ses identifiants libres : la portée module
donne les imports, la portée composant donne les **35 clés `ctx`**, et les locaux
des callbacks (`email`, `entry`, `event`, `program`, `submission`) restent dans la
vue. Les imports du parent sont ensuite élagués à ce qu'il utilise encore
(`AlertCircle`, `RefreshCw`, `useState`/`useMemo`, `useI18n`, `profile-options`,
`useApi`, `useSessionUser`) ; le reste part dans la vue.

Deux pièges du transfert : un composant utilisé seulement en forme pointée
(`<motion.div>`) échappe au balayage des `JSXIdentifier` — il faut le rattraper
sinon `motion` n'est pas importé ; et les imports relatifs de la vue se
réécrivent (`./profile-view/InfoRow` → `./InfoRow`) puisqu'elle vit dans le
sous-dossier.

Nouveau contrôle — `src/__tests__/profile-view-wiring.test.js` (3 tests) : chaque
nom que la vue destructure de `ctx` est une clé que l'écran déclare ; chaque clé
de `ctx` est lue par la vue (pas de clé morte) ; et l'écran rend bien
`<ProfileViewContent ctx={ctx} />`.

Gates du slice : `npm test` 306 suites / 4 801 tests, `npx eslint` 0 erreur,
`npm run build` vert.

## Slice 142 — Coquille du tableau de bord : les hooks contrôleurs du shell (2026-10-03)

Onzième tranche de la série sur la **taille des écrans**, cinquième de la
Phase 1. Cible : `src/components/layout/DashboardLayout.js`, 1 187 lignes — la
coquille partagée par **tous les rôles**, donc blast radius maximal. Ici,
extraire le seul markup ne suffit pas : la logique du composant fait à elle
seule ~822 lignes. On sort donc la logique dans **deux hooks contrôleurs**, par
préoccupation, sans déplacer une ligne de comportement.

| Fichier | Lignes | Rôle |
|---|---|---|
| `DashboardLayout.js` | 586 | la composition : état d'UI, session, `initAuth`, PM programs, relations, venture assignments, `commonProps`, le markup et le wrapper `PermissionProvider` |
| `shell/useDashboardBadges.js` | 415 | l'inbox et les badges : annonces épinglées, notifications, messages non lus, approbations en attente, invitations, affectations, soumissions PM, l'accordéon des compteurs et les effets (poll, foreground, refresh) |
| `shell/useDashboardNavigation.js` | 307 | le sidebar : `buildAccessNav` + icônes, branche personnelle pilotée par les relations, porte « My Learning », console Venture, accordéon `activePathIds`/`openMenus`/`toggleMenu` |

**Le découpage suit les dépendances.** `useDashboardBadges({ effectiveCaps,
pathname })` est appelé juste après `usePermissions()` ; l'effet `initAuth` du
parent consomme ses fetchers et ses setters, ce qui est stable (les fetchers
sont des `useCallback([])`). `useDashboardNavigation({ pathname, role, user,
effectiveCaps, pmPrograms, ventureAssignCount, relationships })` est appelé
après les lectures de relations : il possède aussi le `useApi` de la porte
apprenant (`PERSONAL_ROLES.includes(sessionRole)`) et rend `activeRole`, si
bien que le parent n'a plus besoin de `shellRole` ni de `PERSONAL_ROLES`. Les
constantes et helpers (`SEEN_KEYS`, marques de lecture, `NOTIFICATIONS_*`,
`NAV_ICONS`, `attachIcons`, `shellRole`, `PERSONAL_ROLES`, `pickLmsEnrollment`)
partent avec leur hook ; seul `NOTIFICATIONS_PREVIEW` reste, car il n'habille
que le JSX du parent.

Le transfert a déplacé les blocs à l'identique par plages de lignes, puis on a
ajusté les dépendances : `setNotifications`/`setUnreadCount` rejoignent les deps
de `initAuth` (setters stables), `activeRole` celle du `useMemo` de nav, et
`role`/`user.role` en sortent (redondants). Les tests qui lisent la source du
shell ont été repointés vers les hooks : `notification-badge` verse
`useDashboardBadges`, `ui5-one-dashboard` et `login-landing` vers
`useDashboardNavigation`.

Nouveau contrôle — `src/__tests__/dashboard-shell-wiring.test.js` (4 tests) :
chaque valeur que le parent destructure de `useDashboardBadges` /
`useDashboardNavigation` est une clé rendue par le hook, et chaque hook reçoit
exactement les arguments attendus.

Gates du slice : `npm test` 307 suites / 4 805 tests, `npx eslint` 0 erreur,
`npm run build` vert.

## Slice 143 — Formulaires plateforme : la vue d'écran (2026-10-03)

Douzième tranche de la série sur la **taille des écrans**, sixième de la
Phase 1. Cible : `src/app/platform/forms/page.js`, 886 lignes. Particularité :
l'écran a **deux `return`** — la liste des formulaires (dans un `if
(!showBuilder)`) et le constructeur — et le gros des sous-panneaux existait
déjà (`FormsListView`, `CreateFormModal`, `BuilderHeader`, `FormCanvas`…). On
sort donc les deux retours, verbatim, dans une vue qui branche sur
`showBuilder`.

| Fichier | Lignes | Rôle |
|---|---|---|
| `page.js` | 790 | l'état, les lectures `useApi`, tous les gestionnaires (publication, sections/champs, scoring, workflow, modèles, évaluation IA), la construction de `ctx` |
| `components/platform/forms/PlatformFormsView.js` | 299 | la liste (grille + modales création/archive) et le constructeur (en-tête + panneaux + palette + canevas + modale republish) |

La vue est placée sous `src/components/platform/forms/` pour rester dans la
**surface** que lit `result-email-schedule.test.js`
(`readSurface("…/forms/page.js", "src/components/platform/forms")`) : les pins
`<ResultDelayEditor`, `updateTemplate("result", "delay_minutes", …)` et
`function TemplateEditor(` restent donc couverts.

Le calcul de `ctx` par AST donne 93 clés — les identifiants libres des deux
retours. Un piège : `showBuilder` n'apparaît que dans la **condition** `if
(!showBuilder)` (hors des sous-arbres des `return`), il faut donc l'ajouter à
la main — 94 clés au total. La vue ayant désormais besoin de `showBuilder`, le
`const [showBuilder, setShowBuilder]` du parent reste lu (plus d'avertissement
`no-unused-vars`).

Nouveau contrôle — `src/__tests__/forms-view-wiring.test.js` (3 tests) : chaque
nom que la vue destructure de `ctx` est une clé que l'écran déclare ; chaque clé
de `ctx` est lue par la vue ; et l'écran rend `<PlatformFormsView ctx={ctx} />`.

Gates du slice : `npm test` 308 suites / 4 808 tests, `npx eslint` 0 erreur,
`npm run build` vert.

## Slice 144 — Import plateforme : la vue d'écran (2026-10-03)

Treizième tranche de la série sur la **taille des écrans**, septième de la
Phase 1. Cible : `src/app/admin/platform/import/page.js`, 852 lignes. Le wizard
d'import (dépôt/aperçu/mapping/exécution) n'a qu'un `return` mais il pèse à lui
seul ~527 lignes, contre ~233 pour l'état et les gestionnaires. On sort donc le
markup dans une vue, en déplaçant aussi la constante `STEPS` et les imports
d'icônes/`framer-motion`/`Link` qui ne servaient qu'au rendu.

| Fichier | Lignes | Rôle |
|---|---|---|
| `page.js` | 338 | l'état du wizard, les lectures (`fetchForms`/`fetchRuns`), la lecture de fichier, `handlePreview`/`handleExecute`, `simpleHash`/`parseTextToRows`, la construction de `ctx` |
| `components/admin/platform/import/ImportView.js` | 587 | l'en-tête, les indicateurs d'étape, les panneaux des quatre étapes et les animations `motion`/`AnimatePresence` |

`ctx` compte **28 clés**. Le piège du transfert : un composant utilisé en forme
pointée à racine **minuscule** (`<motion.div>`) échappe au balayage naïf des
`JSXMemberExpression` — il faut enregistrer la racine quel que soit sa casse,
sinon `motion` n'est pas importé dans la vue. Le script de calcul de `ctx` a
donc été corrigé (il excluait à tort les identifiants en minuscules).

Nouveau contrôle — `src/__tests__/import-view-wiring.test.js` (3 tests) : chaque
nom lu par la vue est une clé de `ctx` ; chaque clé de `ctx` est lue ; l'écran
rend `<ImportView ctx={ctx} />`.

Gates du slice : `npm test` 309 suites / 4 811 tests, `npx eslint` 0 erreur,
`npm run build` vert.

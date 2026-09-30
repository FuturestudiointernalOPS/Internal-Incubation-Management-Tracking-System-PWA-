# Layer split — View → Controller → Service → Repository

> Status: **in progress**. Slices 1–7 delivered: the authorization decision, the
> readiness report, the scope engine, the eligibility decision, the membership
> decisions, the eligibility-administration validators, the scoped-access guard
> and the context-grant reconcile (2026-09-30). This document is the running log:
> what is done, what was left aside on purpose, and what remains. Update it at the
> end of every slice.

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
  `contextGrantReadiness`, `eligibility-admin`, `context`, `contextGrants`. Cost:
  a documented (shim-only) model→service edge.
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

**Unchanged throughout:** the SQL (byte-identical), the wave/round-trip
structure, the merge semantics, the fail-closed rules, and every returned field.

### Verification

| Check | Result |
|---|---|
| Full suite `npm test` | **228 suites, 2967 tests, all passed** |
| `npx eslint .` | 0 errors (6 pre-existing warnings elsewhere) |
| `npm run build` | green |
| Cold-resolution round trips | unchanged (3 waves — pinned by `db-sequencing.test.js`) |

---

## 3. Left aside on purpose (deferred, with reasons)

1. **`requireAuthorization` still builds the HTTP refusal response.** Returning
   a 401/403 answer is controller work. Changing it now would touch the return
   shape every gated endpoint depends on. Called out in a comment at the top of
   `services/authorization/context.js`.
2. **`src/server/authz/guards.js`** shapes HTTP answers in the policy layer; the
   response shaping belongs in controllers.
3. **Model facades** (`resolver`, `scope`, `contextGrantReadiness`,
   `eligibility-admin`, `context`, `contextGrants`) create shim-only
   model→service edges; they are deleted once nothing imports them.
4. **`requireScopedAccess` still builds the HTTP refusal answers** in the service
   — same deferral as `requireAuthorization` (§3.1).
5. **No type layer** (see §4).

---

## 4. What remains

### Authorization domain

| Module | Problem | Planned home |
|---|---|---|
| `models/authorization/programAssignments.js` (371 LOC) | `deriveFacilitatorDesiredCaps`, `deriveAssignmentsExpiry` + reads | service + reads |
| `server/authz/guards.js` | guards shape HTTP answers | response shaping → controllers |

### Other domains — not started

| Domain | Service to create | Notes |
|---|---|---|
| Finance | `services/finance/*` | logic currently in `lib/finance*` + `models/finance/*` |
| Ventures | `services/ventures/*` | largest domain (`lib/ventures.js`, ~5.6k LOC) |
| Tasks / projects / programs | `services/tasks/*`, `services/projects/*` | orchestration currently in controllers |
| LMS / platform / integrations | `services/<domain>/*` | |

### Project-wide, still open (from `MVC_REFACTOR.md`)

- ~290 route files still import the db layer; the "0 inline SQL in controllers"
  gate is not met. This is a **repository-extraction** backlog, independent of
  this split.
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
| No HTTP in the new repositories | same suite | `contextReads`, `contextGrantReadinessReads`, `scopeReads`, `eligibilityAdminReads`, `contextAssignmentReads` or `contextGrantsStore` import `next/server` / use `NextResponse` |
| Decision surface intact | same suite | a renamed/removed export breaks the service barrel or the resolver facade |
| No SQL in `server/authz` | `src/__tests__/server/authz-boundaries.test.js` | (pre-existing) authorization policy runs inline SQL |
| Auth/authz import directions | `src/__tests__/server/auth-boundaries.test.js` | (pre-existing) |

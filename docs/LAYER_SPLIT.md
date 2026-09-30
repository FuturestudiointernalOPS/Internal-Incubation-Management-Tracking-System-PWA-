# Layer split — View → Controller → Service → Repository

> Status: **in progress**. First slice delivered: the authorization context
> (2026-09-30). This document is the running log: what is done, what was left
> aside on purpose, and what remains. Update it at the end of every slice.

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
(§5), not by convention.

---

## 2. What is done — slice 1: the authorization context

The authorization decision module was the clearest violation in the codebase: it
decided access **and** ran SQL **and** imported HTTP
(`src/models/authorization/resolver.js`, 583 LOC). It is now split.

| Layer | File | What it holds |
|---|---|---|
| **Service** (new) | `src/services/authorization/context.js` | The decision: resolve a person's effective access, merge grants/groups/profile/restrictions, gate on eligibility, `authorize`, `can`, `requireAuthorization`, the context cache, and the pure row-shaping helpers. |
| **Service barrel** (new) | `src/services/authorization/index.js` | Public entry point of the authorization service. |
| **Repository** (new) | `src/models/authorization/contextReads.js` | The 8 reads the decision needs, one function per query, SQL byte-identical to what was inline before. No decisions, no HTTP. |
| **Facade** (kept) | `src/models/authorization/resolver.js` | Now `export * from "@/services/authorization/context"`. Keeps every existing import path and every `jest.mock` on that path working. Delete once `grep` finds no importer. |

**Unchanged on purpose:** the SQL, the wave/round-trip structure (still three
waves for a cold resolution), the merge semantics, the super-admin rules, the
cache TTL, and every returned field.

**Why this module first:** it is the most load-bearing decision in the product,
it already had the strongest test net, and it was the worst layering offender.

### Verification of slice 1

| Check | Result |
|---|---|
| Targeted suites (9 suites: resolver, sequencing, gates, boundaries…) | 257 passed |
| Full suite `npm test` | **228 suites, 2955 tests, all passed** |
| `npx eslint .` | 0 errors (6 pre-existing warnings elsewhere) |
| `npm run build` | green |
| Round-trip count for a cold resolution | unchanged (3 waves — pinned by `db-sequencing.test.js`) |

---

## 3. Left aside on purpose (deferred, with reasons)

These are known and intentionally **not** done in slice 1:

1. **`requireAuthorization` still builds the HTTP refusal response.** Returning
   a 401/403 answer is controller work. Changing it now would touch the return
   shape every gated endpoint depends on, so it is deferred until controllers
   are split. It is called out in a comment at the top of the service module.
2. **One real model→service edge was created:**
   `src/models/authorization/contextGrantReadiness.js` asks the service for a
   resolved context. Before the split this was model→model. It is a facade-free
   direct dependency and should be resolved by migrating that readiness report
   into the service layer (it is decision logic) — next slice.
3. **`src/models/authorization/{eligibility,scope,membership,context}.js` still
   mix decisions with reads.** They are the next candidates; see §4.
4. **No type layer.** See §4.

---

## 4. What remains

### Authorization domain — remaining slices

| Module | Problem | Planned home |
|---|---|---|
| `models/authorization/contextGrantReadiness.js` | decision + reads; imports the service | `services/authorization/contextGrantReadiness.js` |
| `models/authorization/eligibility.js` | eligibility evaluation (decision) + schema/seed reads | `services/authorization/eligibility.js` + `models/authorization/eligibilityReads.js` |
| `models/authorization/scope.js` | scope resolution (decision) + reads | `services/authorization/scope.js` + reads |
| `models/authorization/context.js` | `requireScopedAccess` (guard) lives in models | `services/authorization/context.js` |
| `models/authorization/membership.js` | group resolution rules + reads | `services/authorization/membership.js` + reads |
| `server/authz/guards.js` | guard shapes HTTP answers | move response shaping to controllers; keep the decision in the service |

### Other domains — not started

| Domain | Service to create | Notes |
|---|---|---|
| Permissions (roles / profiles / eligibility UI) | `services/authorization/*` | same domain as above; the UI already sits in one place (`components/permissions/`) |
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
   (existing rule, unchanged). No decisions inside `src/models/**`.
2. **Services never run SQL** — enforced by
   `src/__tests__/server/services-boundaries.test.js`.
3. **Repositories never import HTTP** (`next/server`, `NextResponse`) — pinned
   for the new repository module by the same suite.
4. **Behaviour is invariant.** SQL stays byte-identical (the endpoint suites
   match on query text). Round-trip/wave counts stay identical (pinned by
   `db-sequencing.test.js`).
5. **Public surfaces only grow.** Moving a symbol leaves a re-export facade at
   its old path for one release; delete it only once `grep` finds no importer.
6. **No new dependency** to reach a layer.

---

## 6. How to run the next slice (recipe)

1. Pick one module that mixes decisions with reads.
2. Write/extend the characterisation test first — the decision paths, not the
   implementation.
3. Copy the SQL **verbatim** into a new repository module (one function per
   query, named after the data). Do not reformat, reorder or "improve" it.
4. Move the decision logic into the matching service module; import the
   repository reads; delete the SQL from the original.
5. Replace the original file with `export * from "<new path>"` (facade).
6. Run `npm test`, `npx eslint .`, `npm run build`.
7. Update §2/§3/§4 of this document, then delete the facade once nothing imports
   it.

---

## 7. Guardrails

| Guard | File | Fails when |
|---|---|---|
| No SQL in `src/services/**` | `src/__tests__/server/services-boundaries.test.js` | a service contains `db.execute` or imports the pool |
| No HTTP in the new repository | same suite | the repository imports `next/server` / uses `NextResponse` |
| Decision surface intact | same suite | a renamed/removed export breaks the service barrel or the facade |
| No SQL in `server/authz` | `src/__tests__/server/authz-boundaries.test.js` | (pre-existing) authorization policy runs inline SQL |
| Auth/authz import directions | `src/__tests__/server/auth-boundaries.test.js` | (pre-existing) |

# Server layers — where code goes

The request path, and what each layer is allowed to know about:

```text
app/**/route.js  (controllers: auth, validation, orchestration, response shape)
        │
        ▼
application layer — decisions and policy, no SQL
   ├── server/auth/**   authentication: "who is calling?"
   ├── server/authz/**  authorization guards: "may they do this, to this?"
   └── services/**      use-case / decision code — the new service layer
        │               (one folder per domain as it migrates)
        ▼
models/**        data access: one named function per query, all SQL lives here
        │
        ▼
lib/db.js        the pool (pg); no ORM
```

**Where a new decision goes:** `src/services/<domain>/`. It may read through
`models/**`; it must never run SQL and never import `lib/db`. The split is
documented — and its backlog tracked — in [LAYER_SPLIT.md](LAYER_SPLIT.md).

## Import rules

| Layer | May import | Must never import |
|---|---|---|
| `app/**` (pages, components) | `server/**`, `models/**` via controllers, `lib/**` | `lib/db` directly |
| `app/api/**/route.js` | `server/**`, `services/**`, `models/**`, `lib/api` | — (still no inline SQL) |
| `services/**` | `models/**`, `server/auth/**`, `lib/**` (infra) | `lib/db` directly, `app/**`, `components/**` |
| `server/auth/**` | `lib/**` (infra), `models/**` | `server/authz/**`, `app/**`, `components/**` |
| `server/authz/**` | `server/auth/**`, `models/**`, `lib/**` | `server/auth/**` is *not* allowed to import it back |
| `models/**` | `lib/db`, other models, pure helpers | `next/server`, `NextResponse`, `server/**`, UI |

These are enforced by tests, not by convention:
`src/__tests__/server/auth-boundaries.test.js` and
`src/__tests__/server/authz-boundaries.test.js` fail if a forbidden import appears,
if SQL shows up in `server/authz`, or if `bcrypt` is imported outside
`server/auth/password.js`.

## Authentication vs authorization

| Question | Layer | Examples |
|---|---|---|
| Who is calling? | `server/auth` | session lifecycle, cookie, password hashing, `requireSession`, `requireAuth` |
| May they do this? | `server/authz` | capabilities, program/project scope, ownership, `requireAssignmentAccess` |

`requireAuth(allowedRoles)` is the coarse "is this account the right *kind* of user"
gate. Anything resource-specific belongs in `server/authz` — a capability, a scope
or a membership check — and runs after an identity exists.

## The rules that matter when moving code

1. **SQL is copied verbatim.** API suites match query text, and several callers
   depend on the *shape* of a failure, so a moved query must not be reformatted,
   reordered, or "improved".
2. **Error semantics travel with the code.** Some lookups fail *open* (a
   participant/facilitator conflict probe that errors returns "no conflict" so
   enrolment is never blocked); others fail *closed* (a permission level that
   cannot be read is 0, never a grant). Keep the comment that says which, and why.
3. **Public surfaces only grow.** A symbol that used to be exported keeps being
   exported, for one release: that is why `src/lib/auth.js` is a facade that
   re-exports both halves from their new homes.
4. **One function per query, named after the outcome.** Models can shape rows
   (snake_case → the shape guards already expect) but never make decisions.
5. **No new dependency is added to reach a layer.** `server/authz` calls models
   directly; models never call services.

   *Known exceptions while the layer split is in progress* (tracked in
   [LAYER_SPLIT.md](LAYER_SPLIT.md)): the `resolver`, `scope`,
   `contextGrantReadiness`, `eligibility-admin`, `context` and `contextGrants`
   model files are **temporary re-export facades** to `services/authorization/*`.
   They hold no logic and are removed as the split completes.

## State of the migration

| Area | Home | Status |
|---|---|---|
| Session, cookie, password, guards | `server/auth/**` + `models/sessions.js` | ✅ moved |
| Capabilities vocabulary | `server/authz/capabilities.js` | ✅ moved |
| Program access resolution + resource guards | `server/authz/{programAccess,guards}.js` + `models/authorization/accessQueries.js` | ✅ moved |
| Authorization reads (project membership, assignment probes, team scope, supervision) + the permission audit write | `models/authorization/accessQueries.js` | ✅ moved |
| Runtime schema self-heal + default grants (role capabilities, Access Profiles, responsibilities catalogue) | `models/authorization/bootstrap.js` | ✅ moved |
| Authorization context decision (resolve/merge/authorize) + its 8 reads | `services/authorization/context.js` + `models/authorization/contextReads.js` | ✅ moved (slice 1 of the layer split — see [LAYER_SPLIT.md](LAYER_SPLIT.md)) |
| Readiness / impact report + its 2 reads | `services/authorization/contextGrantReadiness.js` + `models/authorization/contextGrantReadinessReads.js` | ✅ moved (slice 2) |
| Scope engine (policy dispatch, `isWithinScope`) + its 6 reads | `services/authorization/scope.js` + `models/authorization/scopeReads.js` | ✅ moved (slice 3) |
| Eligibility decision | `services/authorization/eligibility.js` | ✅ moved (slice 4) — schema/seeds/vocabulary stay in `models/authorization/eligibility.js` |
| Membership decisions (effective groups, lifecycle) | `services/authorization/membership.js` | ✅ moved (slice 4) — schema/bootstrap/raw reads/vocabulary stay in `models/authorization/membership.js` |
| Eligibility-change validation (`eligibility-admin`) | `services/authorization/eligibilityAdmin.js` + `models/authorization/eligibilityAdminReads.js` | ✅ moved (slice 5) — model file is a re-export facade |
| Scoped-access guard (`requireScopedAccess`) + its 4 assignment reads | `services/authorization/scopedAccess.js` + `models/authorization/contextAssignmentReads.js` | ✅ moved (slice 6) — model file is a re-export facade |
| Context-grant reconcile (plan, justification, sync) + every statement | `services/authorization/contextGrants.js` + `models/authorization/contextGrantsStore.js` | ✅ moved (slice 7) — model file is a re-export facade; the store both reads and writes |
| Effective access-profile resolution, responsibilities domain | still `src/lib/auth.js` (6 functions, 8 SQL statements) | ⏸ **blocked on a decision** — see below |

Two overlaps are **known and deliberately left alone** until a decision is made,
because merging them would change behaviour and is not a pure move:

- `getUserGroups` (`lib/auth.js`) vs `getUserGroupNames` (`models/authorization.js`).
- responsibilities functions (`lib/auth.js`) vs `models/responsibilities.js`.
- `getUserEffectiveProfile` / `getAccessProfileCapabilities` (`lib/auth.js`) vs the
  access-profile readers in `models/authorization.js`.

## Known defect, pinned by a test but not fixed

`seedDefaultResponsibilities()` memoises its work, and its comment says a failure
clears the memo "so the next call retries instead of the process caching a broken
state". It does not: the inner seeding function RESOLVES with `{ success: false }`
instead of throwing, so the `.catch` that clears the memo never runs, and a failed
seed stays failed until the process restarts. A real retry needs the inner
function to throw — a behaviour change, so it awaits an explicit decision.
`src/__tests__/authorization-bootstrap.test.js` pins today's behaviour and says so.

## Migrating a batch (recipe)

1. Write the characterisation test first — the guards' decision paths
   (401/403/404/409), not the implementation.
2. Move the code by line range, not by retyping, so the SQL is byte-identical:
   assert the boundaries before extracting, and diff the SQL statement sets
   afterwards.
3. Keep `src/lib/auth.js` re-exporting anything moved.
4. `npm test` (all suites), `npx eslint .` (0 errors), `npm run build`.
5. Delete the facade entries only once `grep` finds no importer.

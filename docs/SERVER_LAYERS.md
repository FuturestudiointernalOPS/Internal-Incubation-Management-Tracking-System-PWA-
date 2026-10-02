# Server layers — where code goes

The request path, and what each layer is allowed to know about:

```text
app/**/route.js  (controllers: auth, validation, orchestration, response shape)
        │
        ▼
services/**      (application decisions — policy, no SQL, no NextResponse)
   └── <feature> business services (contacts first; more features as they migrate)
        │
        ▼
server/**        (cross-cutting auth + authz)
   ├── auth/     authentication: "who is calling?"
   └── authz/    authorization:  "may they do this, to this?"
        │
        ▼
models/**        data access: one named function per query, all SQL lives here
        │
        ▼
lib/db.js        the pool (pg); no ORM
```

`server/auth` and `server/authz` remain the shared identity/capability seams.
Feature-specific decisions (role/status gates beyond a capability check,
registry assembly, merge orchestration, fill-only sync windows) live under
`services/<feature>/` once extracted from a fat route.

## Import rules

| Layer | May import | Must never import |
|---|---|---|
| `app/**` (pages, components) | `server/**`, `services/**` via controllers, `models/**` via controllers, `lib/**` | `lib/db` directly |
| `app/api/**/route.js` | `server/**`, `services/**`, `models/**`, `lib/api` | inline SQL |
| `services/**` | `models/**`, `server/auth/**`, `server/authz/**` (or `lib/auth` façades), `lib/**` infra (email, invitations, token-hashing) | `lib/db`, `next/server`, `NextResponse`, `app/**`, `components/**` |
| `server/auth/**` | `lib/**` (infra), `models/**` | `server/authz/**`, `app/**`, `components/**` |
| `server/authz/**` | `server/auth/**`, `models/**`, `lib/**` | `server/auth/**` is *not* allowed to import it back |
| `models/**` | `lib/db`, other models, pure helpers | `next/server`, `NextResponse`, `server/**`, `services/**`, UI |

These are enforced by tests, not by convention:
`src/__tests__/server/auth-boundaries.test.js`,
`src/__tests__/server/authz-boundaries.test.js`, and
`src/__tests__/server/services-boundaries.test.js` fail if a forbidden import
appears, if SQL shows up in `services/**` or `server/authz`, or if `bcrypt` is
imported outside `server/auth/password.js`.

## Authentication vs authorization

| Question | Layer | Examples |
|---|---|---|
| Who is calling? | `server/auth` | session lifecycle, cookie, password hashing, `requireSession`, `requireAuth` |
| May they do this? | `server/authz` | capabilities, program/project scope, ownership, `requireAssignmentAccess` |
| What should happen next? | `services/<feature>` | role/status normalization, registry assembly, merge steps, reconcile windows |

`requireAuth(allowedRoles)` is the coarse "is this account the right *kind* of user"
gate. Anything resource-specific belongs in `server/authz` — a capability, a scope
or a membership check — and runs after an identity exists. Once those gates pass,
feature decisions move into `services/**`.

## Contacts migration (corridor 5)

| Concern | Home | Status |
|---|---|---|
| Create / update / list / delete decisions | `services/contacts/{createContacts,updateContact,listContacts,deleteContact}.js` | ✅ |
| Full-state registry assembly | `services/contacts/fullState.js` | ✅ |
| Merge + search decisions | `services/contacts/{mergeContacts,searchContacts}.js` | ✅ |
| Contact ↔ program/group sync (decisions + debounce) | `services/contacts/contactGroupSync.js` | ✅ |
| Contact ↔ program/group sync SQL | `models/contactGroupSyncStore.js` | ✅ |
| Facade for form-runs | `lib/contact-group-sync.js` → service | ✅ preserved |

## The rules that matter when moving code

1. **SQL is copied verbatim.** API suites match query text, and several callers
   depend on the *shape* of a failure, so a moved query must not be reformatted,
   reordered, or "improved".
2. **Error semantics travel with the code.** Some lookups fail *open* (a
   participant/facilitator conflict probe that errors returns "no conflict" so
   enrolment is never blocked); others fail *closed* (a permission level that
   cannot be read is 0, never a grant). Keep the comment that says which, and why.
3. **Public surfaces only grow.** A symbol that used to be exported keeps being
   exported, for one release: that is why `src/lib/auth.js` and
   `src/lib/contact-group-sync.js` are façades that re-export from their new homes.
4. **One function per query, named after the outcome.** Models can shape rows
   (snake_case → the shape guards already expect) but never make decisions.
5. **No new dependency is added to reach a layer.** `services/**` and
   `server/authz` call models directly; models never call services.
6. **Services return `{ status, body }` (or `{ ok, error, data }` for helpers),
   never `NextResponse`.** Controllers map that to the HTTP response.

## State of the migration

| Area | Home | Status |
|---|---|---|
| Session, cookie, password, guards | `server/auth/**` + `models/sessions.js` | ✅ moved |
| Capabilities vocabulary | `server/authz/capabilities.js` | ✅ moved |
| Program access resolution + resource guards | `server/authz/{programAccess,guards}.js` + `models/authorization/accessQueries.js` | ✅ moved |
| Authorization reads (project membership, assignment probes, team scope, supervision) + the permission audit write | `models/authorization/accessQueries.js` | ✅ moved |
| Runtime schema self-heal + default grants (role capabilities, Access Profiles, responsibilities catalogue) | `models/authorization/bootstrap.js` | ✅ moved |
| Contacts decisions (CRUD, full-state, merge, search, group-sync) | `services/contacts/**` | ✅ moved |
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
3. Keep façades (`src/lib/auth.js`, `src/lib/contact-group-sync.js`, …)
   re-exporting anything moved.
4. `npm test` (all suites), `npx eslint .` (0 errors), `npm run build`.
5. Delete the facade entries only once `grep` finds no importer.

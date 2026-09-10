# ImpactOS — Phase 5c (Strict Venture Gate — No Fallback)

Status: the transitional fallback is **removed**. The venture gate decides with
**capability + scope only**; the old role arrays and the old membership helper
are no longer consulted on converted routes.

## The gate

```
Super Admin bypass (resolver)
  → CAPABILITY  ventures.view (reads) / ventures.edit (writes)
  → SCOPE       venture_own — active membership OR active staff assignment
  → ALLOW
```

Every denial is explicit and diagnosable:

| `X-Authz-Decision` | Status | Payload `missing` |
|---|---|---|
| `unauthenticated` | 401 | — |
| `capability-missing` | 403 | `{ capability: "ventures.view" }` |
| `out-of-scope` | 403 | `{ capability, scope: "venture_own" }` |
| `system-failure` | 500 | — |
| *(allow)* | 200 | `super-admin` / `capability+scope` |

## Keys (grants) — who can do what

| Profile | ventures.view | ventures.edit | Effect |
|---|---|---|---|
| Super Admin Default | ✔ (all) | ✔ | unscoped (resolver bypass) |
| Staff Default (venture manager) | ✔ | ✔ | only ventures they belong to / are assigned to |
| Program Manager | ✔ | ✔ | same |
| Founder | ✔ | ✔ | only their own ventures |
| Everyone else | — | — | no venture surfaces (participants/learners/instructors live in their own contexts) |

Writes are scope-checked on **every** write route, including the two that used
to check capability only (`PUT /api/ventures`, `PATCH /api/ventures/[id]`), so
`ventures.edit` can never open an unscoped write.

## What would fail? (ask before you test)

```
GET /api/engineering/permissions/venture-strict-audit     (requires permissions.view_matrix)
```

Read-only. For every person attached to a venture it reports:

- `viewAllowed` / `editAllowed` — what the strict gate decides **today**
- `missing: ["ventures.view"]` / `["ventures.edit"]` — the key to grant
- `scopeCount` — how many ventures the scope policy resolves for them
- summaries: `viewMissing`, `editMissing`

If the audit shows an empty `viewMissing` for people who should work, strict
mode is ready for them.

## Coverage census (how far the migration is)

```
node scripts/authz-venture-coverage.mjs
```

Exits 1 while any venture route file still uses the old gate.

| Bucket | Meaning |
|---|---|
| NEW SYSTEM (scoped) | uses `requireVentureScopedAccess` |
| OLD GATE (legacy) | still calls `requireAuth` / `requireVentureAccess` — to convert |
| NO VENTURE GATE | SA-only or custom guard — verify individually |

Current: **13 scoped**, 39 legacy, 21 no-gate (of 73 route files).

## Staging steps

1. Re-run the profile seed so the keys land: `GET /api/engineering/permissions/seed-access-profiles`.
2. Open the audit endpoint and grant anything that is genuinely missing.
3. Walk the converted screens as: Super Admin, a Staff/venture-manager, a
   Founder, and someone with no venture link (must be refused **explicitly**).
4. Keep converting the remaining legacy files until the census reads 0, then
   delete `requireVentureAccess` from the venture API entirely.

## Rollback

One commit: `git revert` the strict-gate commit restores the previous helper.
There is no data migration — grants live in `access_profiles` and are additive.

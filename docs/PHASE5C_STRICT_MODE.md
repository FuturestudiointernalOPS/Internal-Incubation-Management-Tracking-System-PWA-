# ImpactOS — Phase 5c (Strict Mode & Venture Coverage)

Status: strict mode + coverage census shipped. **Default is parity (fallback
active)** — nothing changes until `AUTHZ_VENTURE_STRICT=1` is set.

## Why this exists

The transitional fallback keeps old behaviour during the migration, but a
fallback that is always taken means the NEW system is never actually exercised.
Strict mode turns the fallback off so staging proves, route by route, that the
canonical gate decides on its own.

## Strict mode

```
AUTHZ_VENTURE_STRICT=1     # staging only, until clean
```

| Mode | Behaviour |
|---|---|
| off (default) | capability + scope → allow; otherwise the ORIGINAL role-array + membership check decides (parity, logs `[VentureScope] legacy fallback used …`) |
| on | capability + scope → allow; otherwise **deny** with `X-Authz-Decision: capability-or-scope-denied` and a payload naming exactly what is missing |

Denial payload in strict mode:

```json
{ "success": false,
  "error": "errors.insufficientPermissions",
  "missing": { "capability": "ventures.view", "scope": "venture_own" },
  "strict": true }
```

Super Admin bypass is unaffected (it is resolver semantics, not the fallback).

### How to read any request

| `X-Authz-Decision` | Meaning |
|---|---|
| `super-admin` | SA bypass |
| `capability+scope` | decided by the NEW system — this is the goal |
| `legacy-fallback` | allowed only by the OLD gate (logged) — convert/grant before removing the fallback |
| `capability-or-scope-denied` | strict mode denial — the payload says what to grant |
| `legacy-role-denied` / `legacy-not-a-member` | old-path denials (non-strict mode) |

## Coverage census

```
node scripts/authz-venture-coverage.mjs
```

Prints the census, exits 1 while any venture route still uses the old gate.

Current state (73 route files):

| Bucket | Count | Meaning |
|---|---|---|
| NEW SYSTEM (scoped) | 13 | use `requireVentureScopedAccess` |
| OLD GATE (legacy) | 39 | still call `requireAuth` / `requireVentureAccess` directly |
| NO VENTURE GATE | 21 | no venture gate found (SA-only or custom guards) — verify individually |

## Rollout sequence

1. **Staging, strict OFF** — confirm the 13 converted routes still work
   (`X-Authz-Decision: legacy-fallback` tells you who still needs grants).
2. **Staging, strict ON** — the denials list exactly what is missing. Grant via
   profiles (`ventures.view` for Staff / venture-manager, Founder owns
   `venture_own`) or fix the route. Repeat until no denial remains for a normal
   working day.
3. **Convert the remaining 39 legacy files** (census drives this to zero), then
   remove the fallback from the helper and delete this flag.
4. **Production** — only after staging is clean; production flips last, never
   before its grants exist.

## Safety notes

- Strict mode is read **per call** from the environment, so it can be flipped
  without a code change and takes effect immediately.
- The fallback path is untouched when strict is off — that is today's parity.
- The census is read-only; it never edits files.

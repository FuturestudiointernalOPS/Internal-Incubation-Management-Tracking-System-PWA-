# ImpactOS — Phase 5b Brief (Venture Scope Pilot)

Status: predicate fixed, capability grants + Founder profile seeded, and TWO
route files converted to the canonical gate with a **transitional legacy
fallback**. Staging risk is bounded by the fallback (exact prior behavior);
production untouched.

## Corrected order (approved)

The original order (seam → grants → founder profile) was wrong: no seeded
profile held `ventures.view`, so flipping a route first would have locked out
staff/PM/teachers and founders. Corrected order, as executed:

```
1. fix the predicate  →  2. grant the capability  →  3. convert the pilot  →  4. fill the founder profile
```

## 1 — Predicate fix (`7a9e4209`, 5b-1)

`venture_own` now matches `requireVentureAccess()` exactly:

| Source | Rule |
|---|---|
| `venture_members` | active membership (`user_cid` or `contact_id`, `removed_at IS NULL`) |
| `venture_staff_assignments` | active delegated staff assignment (`status = 'active'`) |

Plus `resolveVentureScopeId()` normalizes a route's UUID to the canonical VNT
code (fail-soft: unresolvable → predicate simply won't match → deny).
Without the UNION, delegated staff would have lost access the moment a route
stopped using `requireVentureAccess`.

## 2 — Grants (5b-2)

| Profile | Added | Why |
|---|---|---|
| Staff Default | `ventures.view` | operational staff manage ventures |
| Program Manager | `ventures.view` | PM oversight of venture-producing programs |
| Founder (NEW profile) | `ventures.view` only | P1 identity; minimal by design — scope does the rest |
| All others | — | **no** non-SA profile receives `ventures.edit` (write-expansion guard, test-locked) |

`role_defaults`: `founder → Founder`. Safe because there is **no
`role_capabilities('founder')` seed** — the mapping only adds, never narrows.
`ventures` feature eligibility already includes `founder` (P1).

**Known side effect (cosmetic, intended-ish):** the admin sidebar's Ventures
item is capability-gated (`NAV_CAPABILITY_REQUIREMENTS.ventures`), so Staff and
Program Manager users will now SEE that nav item. Server remains authoritative;
if that is unwanted, remove `ventures.view` from the two profile seeds.

Registry: `venture:founder` gap filled → maps to the Founder profile (metadata
only — no consumer applies it yet).

## 3 — Pilot routes (5b-3)

| File | Capability | Legacy fallback roles |
|---|---|---|
| `api/ventures/[id]/blockers/route.js` | `view` (GET), `edit` (POST/PATCH) | `ROLES` / `ALLOWED` (unchanged) |
| `api/ventures/[id]/business-model/route.js` | `view` (GET), `edit` (PUT) | `ROLES` / `ALLOWED` (unchanged) |

Gate: `requireVentureScopedAccess()` (`src/lib/ventureScopedAccess.js`):

```
Super Admin bypass (resolver) → capability → scope (venture_own)
   ↓ denied
TRANSITIONAL legacy fallback: role array (original 403/401) →
                              requireVentureAccess (original 404)
```

**Removal trigger (must not become permanent):** once grants + the founder
mapping are live on staging and the fallback log
(`[VentureScope] legacy fallback used …`) shows no traffic across a full
usage cycle, delete the fallback — the canonical gate then stands alone.
The legacy pair is only allowed to exist inside the helper; the route files
are contract-tested to contain none.

## Behavior guarantees

- Anyone the legacy arrays admit today keeps exactly the same outcome (including
  the derived `founder` role case) — verified by unit tests for both denial
  shapes (403 + 404) and the Super Admin bypass.
- No write surface was opened: pilot writes need `ventures.edit`, which no
  non-SA profile holds, so writers still resolve through the fallback.
- `requireOperationalVentureAccess` (archived-venture rules) is untouched.
- No production change; no schema change; no resolver change.

## Open decisions

1. Participant Default: grant `ventures.view`? (parity for participant+venture-member cases before fallback removal — currently covered by the fallback)
2. Instructor / Developer / admin role parity grants (same question)
3. `ventures.edit` grants for founders (requires scope-enforced write routes first — the two edit-capability routes have no record scope today)
4. Remaining registry gaps: facilitator / team_member / learner
5. `team_own` predicate (v2_teams mapping)

## Rollback

Revert the Phase 5b commits (`7a9e4209` + the 5b-2/5b-3 commits). No schema,
no data migration; profiles/grants are additive seeds and the routes revert to
their legacy gates.

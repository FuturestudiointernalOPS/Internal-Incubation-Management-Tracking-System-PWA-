# ImpactOS — Phase 6 (Context → Profile Application)

Status: **implemented**. The Context Roles registry is no longer metadata only —
an active venture relationship now grants what the registry maps. The resolver,
the gates and the scope engine are untouched.

## The problem this closes

The identity correction stopped mutating `contacts.role` when someone joins a
venture. That is correct, but it left a gap:

```
Member joins Venture X as founder
  → venture_members row (scope resolves)          ✔
  → but NO profile grants ventures.view           ✘
  → the strict gate refuses: missing ventures.view
```

The audit endpoint showed exactly this for a real staging account ("Gwin Test":
`scopeCount 1`, `missing: ["ventures.view"]`).

## Prerequisite — feature eligibility (the second gate)

Granting the capability is necessary but **not sufficient**: `authorize()`
checks eligibility first and fails closed.

```
eligible?  → no   → DENY (even with the capability)
eligible?  → yes  → capability level ≥ minLevel → allow
```

`ventures` eligibility was `["super_admin","staff","program_manager","investor","founder"]`
— a baseline **Member** was not eligible, so a member-baseline founder would
have been refused *after* receiving the grant (the grant would have looked
inert). Phase 6 therefore also:

- adds `"member"` to `FEATURE_ELIGIBILITY_DEFAULTS.ventures` and to
  `RESPONSIBILITY_FEATURE_ROLES.ventures` (kept in exact sync by a test), and
- seeds that one missing row per database through the
  `eligibility-ventures-member-v1` migration (insert-only — an admin edit is
  never overwritten).

Eligibility stays a **ceiling**: a plain Member has no `ventures.*` capability
and no scope, so nothing opens by itself. Removing `member` from the
Eligibility tab (Permission Center) disables the whole mechanism on purpose.

## What Phase 6 does

```
active venture_members row (member_type = 'founder' OR role founder/co-founder)
        ↓
Context Roles registry: venture:founder → "Founder" profile
        ↓
profile capabilities (ventures.view, ventures.edit)
        ↓
ADDITIVE individual grants in user_capabilities
   granted_by = "ctx:venture:founder"        (attributable)
   mirrored in context_applied_grants        (provenance)
        ↓
+ capability   from the grant
+ scope        from the relationship (venture_own, unchanged)
= access
```

Baseline identity is never touched. Nothing is downgraded — grants merge with
profile/group capabilities by `MAX()` in the resolver.

## Rules (locked)

| Rule | Behaviour |
|---|---|
| Additive only | Grants never lower an existing level; the resolver's max-merge decides |
| Manual grants win | A row with a different `granted_by` is never overwritten and never removed |
| Reversible | When the last founder relationship ends, or the mapping is cleared/disabled, the applied rows are removed — and only those |
| Attributable | Every applied row carries `granted_by = ctx:<context>:<role>` and a provenance row with the justifying venture codes |
| No resolver change | Scope stays the authority on *where*; these grants answer *whether* |

## Where it is applied (write paths)

| Path | File |
|---|---|
| Venture creation (official pipeline) | `src/models/venturePipeline.js` |
| Member added / removed / role updated | `src/app/api/ventures/[id]/members/route.js` |
| Lead founder change | `src/lib/ventures.js` (`changeVentureLead`) |
| Contact merge (survivor inherits relationships) | `src/app/api/contacts/merge/route.js` |
| Backfill / drift repair (idempotent) | `GET /api/engineering/permissions/sync-context-grants` |

Suspension uses the separate `venture_founders` table and does not affect
`venture_members`, so it neither grants nor revokes here (documented, unchanged).

## Running it

```
GET /api/engineering/permissions/sync-context-grants      (requires permissions.view_matrix)
```

Response reports what changed:

```json
{ "success": true, "evaluated": 2, "applied": ["ventures.view","ventures.edit"],
  "revoked": [], "changes": 2,
  "results": [{ "cid": "USR_…", "profile": "Founder", "ventures": ["VNT-…"],
                "applied": ["ventures.view","ventures.edit"], "revoked": [], "reason": "mapped" }] }
```

Then re-check `GET /api/engineering/permissions/venture-strict-audit` —
`viewMissing` should be empty for founders.

## Replacing a profile (how a Super Admin changes what founders get)

1. Permission Center → **Profiles** → edit the profile the registry points at
   (currently "Founder"), or
2. Permission Center → **Context & Scope → Context Roles** → point
   `venture:founder` at a different profile, then re-run the sync endpoint.

Either way the next reconcile (or the next membership write) applies the new
capability set. Removing/disabling the mapping revokes what Phase 6 applied.

## Tests

`src/__tests__/phase6-context-grants.test.js` (11 tests): pure planner
(apply / manual-wins / same-level skip / level change / revoke) and the full
apply → idempotent re-run → revoke cycle against a fake database.

## Still manual-first (deliberately)

- `venture:team_member`, `program:facilitator`, `lms:learner` mappings are
  **NULL** in the registry — those roles apply nothing until Product decides
  their profiles (visible as gaps in the Context Roles tab).
- Program/investor contexts are **not** applied automatically yet; only
  `venture:founder` is wired. Adding one is a registry row + a relationship
  query in `src/models/authorization/contextGrants.js`.

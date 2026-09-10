# ImpactOS — Phase 5 Brief (Scope Engine)

Status: **engine core implemented and verifiable — deliberately NOT enforced on
any route yet.** No effective access changed in this phase.

## The three authorization questions

| Layer | Question | Where it lives |
|---|---|---|
| Eligibility | May this identity ever access the feature? | `feature_eligibility` + resolver |
| Capability | Does this person hold the action? | resolver (cached context) |
| **Scope** | **Which RECORDS may it operate on?** | **this engine — authoritative assignment rows** |

Contract (from the product directive): the scope decision comes from the actual
data-layer predicate reading assignment data — **never** from cache freshness,
never from client state. A failed cache invalidation cannot grant scope,
because the engine never reads the capability cache at all.

## Files

| File | Role |
|---|---|
| `src/models/authorization/scope-catalog.js` | pure vocabulary + decision composition (no db — safe for client components) |
| `src/models/authorization/scope.js` | data-layer predicates (`resolveScopeIds`, `isWithinScope`) |
| `src/lib/authorization/scope{,-catalog}.js` | facades (repo convention) |
| `src/app/api/engineering/permissions/scope-check/route.js` | read-only verification bench |

## Decision contract (fail-closed)

```
capability first (resolver authoritative)
  → policy supported  (unknown/unimplemented → DENY)
  → within scope      (error / no rows / empty id → DENY)
  → ALLOW
```

Machine reasons: `capability-missing`, `policy-unsupported`, `out-of-scope`,
`allowed`.

## Policy catalogue

| Policy | Resource | Source (authoritative rows) | State |
|---|---|---|---|
| `venture_own` | venture | `venture_members` active membership (`user_cid` or `contact_id`, `removed_at IS NULL`) | implemented |
| `program_assigned` | program | `v2_program_staff` (email-tolerant) UNION `participant_programs` | implemented |
| `learning_own` | course | `lms_enrollments` (own, `status <> 'suspended'`) | implemented |
| `team_own` | team | `v2_teams` mapping not resolved yet | **pending — resolves to DENY, never hidden** |

The Permission Center → Scope Policies tab now renders this same catalogue
(shared module, no duplicated vocabulary) with honest implemented/pending
badges.

## Verification bench

```
GET /api/engineering/permissions/scope-check?policy=venture_own&cid=<user>&resource_id=<record>
  requires permissions.view_matrix
  → { implemented, within_scope, resolved_count, resolved_ids }
```

This is the dry-run tool that lets us verify the directive's example before any
enforcement: David with `journey.edit` assigned to AgriNova + TechBridge →
`AgriNova: true`, `FinTechCo: false`.

## Explicitly NOT done (next gates)

1. **No route enforces scope yet.** The first enforcement seam (bounded
   conversion to capability + scope) is a behavior change and needs explicit
   approval. Recommended first seam: founder venture surfaces on `venture_own`.
2. **Founder profile gap** (registry: venture:founder → no default) is filled
   only after the first seam exists — per the approved manual-first policy.
3. **`team_own` predicate** — needs a `v2_teams` mapping decision.
4. Application policy (auto-apply registry mapping at membership creation)
   remains **manual-first**: nothing applies profiles automatically.
5. Cache invalidation: nothing to invalidate yet (no consumer). The first seam
   must document its own freshness story (assignment predicates are read
   live per request — no caching is introduced by this engine).

## Tests

`src/__tests__/phase5-scope-engine.test.js` (15 tests): decision order,
catalogue integrity, predicate SQL (assignment sources + suspended exclusion +
soft-delete exclusion), fail-closed matrix (empty id / no rows / unsupported
policy / db error), and the bench endpoint's gating + honest unimplemented
reporting.

## Rollback

Revert the Phase 5 commit. Nothing consumes the engine, so behavior is
identical before and after; the verification endpoint and view are additive.

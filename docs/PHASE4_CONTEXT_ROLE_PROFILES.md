# ImpactOS — Phase 4 Brief (Context Role → Profile Registry)

Status: registry implemented (table + seed + API + Permission-Center tab).
**Governance-only — the resolver does not read the registry, so no effective
access changed in this phase.**

## Why this exists

The identity correction (Phases 0–3) established that Founder, Investor,
Participant, Facilitator, Learner, … are **contextual relationships** layered
on the three baseline identities (Super Admin / Staff / Member) — never global
roles. What was still missing was one place to answer:

> "When someone holds role X inside context Y, which profile should seed their
> capabilities?"

This registry is that place. It keeps capability authorization (grantable
atoms), profile bundling, and context membership as three separate concepts.

## Data model

`context_role_profiles` — created lazily by
`ensureContextRoleProfilesSchema()` (no migration required; same self-healing
pattern as `feature_eligibility`).

| Column | Meaning |
|---|---|
| `context` | `program` \| `venture` \| `lms` \| `investor` |
| `role_key` | lowercase identifier (`founder`, `team_member`, `program_manager`, `facilitator`, `participant`, `learner`, `investor`) |
| `profile_id` | → `access_profiles.id` (nullable = unmapped, shown as a visible gap) |
| `is_active` | governance flag (does not gate resolution — nothing consumes the row yet) |
| `notes` | why the mapping / gap exists (data) |
| unique | `(context, role_key)` |

No FK to `access_profiles` on purpose: the table must be creatable before
profiles are seeded, and writes validate profile existence in the controller.

## Seed matrix (INSERT … DO NOTHING — admin edits always win)

| Context | Role | Seeded profile | Rationale |
|---|---|---|---|
| program | participant | Participant Default | mirrors existing role default |
| program | program_manager | Program Manager | mirrors existing role default |
| program | facilitator | — (gap) | access resolves per program from `v2_program_staff.permissions` today |
| venture | founder | — (gap) | needs a scope-aware profile (`venture_own`) — Phase 5 |
| venture | team_member | — (gap) | no profile mapping exists today |
| lms | learner | — (gap) | learning access is enrollment-derived (`lms_enrollments`) |
| investor | investor | Mentor | mirrors existing role default |

Unmapped rows stay visible (`— no default —`), never hidden.

## Surfaces

- API: `GET /api/engineering/permissions/context-roles` (`permissions.view_matrix`)
  → registry + mapped profile name + informational holder counts + profile list.
  `PUT` (`permissions.assign_capabilities`) → upsert one mapping + audit entry
  (`context_role_profile_updated`, optional reason).
- UI: Permission Center → **Context Roles** tab (edit profile / active / notes
  per row, optional reason, save per row).
- Model: `src/models/authorization/contextRoleProfiles.js` — pure constants +
  SQL. `getContextRoleProfile(context, roleKey)` is the resolution helper
  future phases will consume.

## Safety properties (locked by tests)

- `src/__tests__/phase4-context-roles.test.js` asserts the write path does
  **not** call `invalidateAllAuthorizationContexts()` — the registry is inert
  until a phase deliberately wires it in.
- Seed integrity: known contexts, valid keys, unique pairs, profile names must
  exist in `seedDefaultAccessProfiles()`, unmapped roles must carry notes.
- No resolver, gate, cache, or profile-resolution code was modified.

## What a consuming phase must add (Phase 5 / 6)

1. Scope predicates (record-level "where") before any membership-driven profile
   application — the registry must never be applied without scope.
2. Cache invalidation on registry writes and on membership-apply paths.
3. An application policy decision (auto-apply at membership creation vs. manual
   assignment) — deliberately NOT decided in this phase.
4. Filling the four registry gaps (facilitator / founder / team member /
   learner) once scope-aware profiles exist.

## Rollback

Revert the Phase 4 commit; the table is additive and unread — dropping
`context_role_profiles` restores the exact prior behavior (no consumer exists).

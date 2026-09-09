# ImpactOS — Identity, Context & Membership Architecture Correction
## Impact Analysis & Migration Plan (Discovery Deliverable — READ ONLY)

**Status:** Investigation/validation complete. No implementation performed.
**Date:** 2026-09-09 · **Branch evidence base:** G/Ventures @ post-Phase-2 commits
**Product decision under validation:** exactly **three global baseline identities**
(Super Admin · Staff · Member); everything else = contextual membership/role/profile.

> Architectural rule: joining a context **adds a relationship; it never overwrites
> the baseline identity**. "If this person stops participating in this context,
> should their global identity change?" → NO ⇒ contextual.

---

## A. Current-State Map — where `contacts.role` is used

### A.1 The column itself

`contacts.role` = single-valued global role string on the person row (staging:
participant ×5, member ×2, staff ×1, founder ×1, super_admin ×1, facilitator ×1).
`contacts.access_profile_id` = single global profile pointer. Session role =
`contacts.role` (`getSession`), so **the whole authorization path keys on one
global value per person today**.

### A.2 Usage classification

| Usage class | Where | Examples |
|---|---|---|
| **True baseline identity** | auth.js session; resolver SA bypass; admin layout (SA/dev); authorization.js promote/demote (super_admin/staff) | `contacts.role='super_admin'|'staff'` |
| **Contextual role stored as global role** (anti-pattern to remove) | participant/founder/investor/facilitator mutations + allowlists | see C |
| **Legacy authorization gates** | 276/386 route files `requireAuth([roles])`; role_capabilities fallback (roles: admin, developer, investor, program_manager, staff, teacher, team); eligibility-defaults legacy role lists | see D |
| **UI / navigation** | ROLE_ACCESS role masks (incl. developer/teacher/crm/finance contexts); PATH_CONTEXT_ROLES; PERSONAL_ROLES; context switcher | sidebar role selection |
| **Business rules** | "Staff cannot be Participant" style checks; venture founder guards | see C |
| **Context checks (healthy — the future spine)** | ventureAuth (venture_members / venture_staff_assignments), facilitation (v2_program_staff / v2_teams.handler), program scope lookups | membership-table driven |

**Headline:** the global role is doing 5 jobs. Only the first two (baseline identity,
promotion) belong to it; the rest must move to contexts.

---

## B. Identity Migration Map

| CURRENT value / concept | Verified source | TARGET |
|---|---|---|
| `member` | registration/identity resolver default | **Member** (baseline) |
| `staff` | staff invites/admin ops | **Staff** (baseline) |
| `super_admin` | authorization.js promote | **Super Admin** (baseline) |
| `participant` | role mutation on approval + `participant_programs` row | **Member + Program A (role participant)** — membership row already exists (incl. lifecycle fields) |
| `founder` | role mutation (guarded) + `venture_members(is_owner, lead_founder)` | **Member + Venture X founder/owner** — membership row exists |
| `investor` | role mutation + investor relations tables | **Member + Investor context** — existing investor tables are the base |
| `facilitator` | creation writes role 'facilitator' + v2_program_staff row | **Member/Staff + Program role facilitator** — membership row exists |
| `coach` | no global role; v2_teams.handler / v2_program_staff / venture coach tables | **Member/Staff + contextual coach** (program/venture) |
| `program_manager` | legacy role + `v2_programs.assigned_pm_id` + profile 11 | **Staff (or Member, per business rule) + Program assignment** |
| `developer` | role string + role_capabilities + /developer section + Developer Intern profile seed | **Staff + Developer profile/responsibility** (platform-level, not program) |
| `teacher` | role string + allowlists (78 files) + role_capabilities | **Legacy program-teaching role → Program staff role** (decision needed) |
| `team` | role string + role_capabilities + tasks eligibility row | **Contextual team membership** (v2_teams + member links) |
| `admin` | ghost role in 23+ allowlists + role_capabilities | **Remove** (map to SA or caps) |
| `verification_officer` | stray reference | Remove/investigate |

Note: eligibility-defaults, `ALL_FEATURE_ROLES`, `responsibilities.allowed_roles`,
nav masks and the 7-identity UI set all carry *some* of these values today — each
must converge on the 3-baseline + contextual model.

---

## C. Mutation Inventory — every write that changes `contacts.role`

| # | Site | Write | Guard | Replacement contextual write |
|---|---|---|---|---|
| 1 | models/adminOps.js (approve-user / platform approval) | `UPDATE contacts SET status='approved', role=?` (participant) | — | `participant_programs` row (exists) + **stop role write** |
| 2 | models/venturePipeline.js (venture approval) | `UPDATE contacts SET role='founder' … AND role NOT IN ('super_admin','staff','admin','program_manager')` | already protects baselines | `venture_members(is_owner=TRUE, role=founder)` (exists) + **stop role write** |
| 3 | models/investorRelations.js ×2 | `SET role='investor'` (+ NOT IN guard on 2nd) | protects SA/staff/admin | investor context tables + **stop role write** |
| 4 | models/authorization.js (promote/demote) | `SET role='super_admin'` / `'staff'` / `role=?` (+ role history) | admin action | **KEEP — true identity operation**, attach audit |
| 5 | models/platform/automation.js | `SET role=?, status='approved'` | — | map to membership write per source |
| 6 | Creation sites (role baked at INSERT): facilitation.js, ventureCoach.js (`role='facilitator'`), formRuns.js (`member`), contactIdentity.js (`member`), investorRelations.js (`investor`), platformConfig/Import (`participant`) | | | creation should default **member**; context rows carry the role |

**Founder/investor guards already encode the correct instinct** (never clobber
Staff/SA) — the correction extends that principle to *all* baselines.

---

## D. Authorization Impact — routes depending on roles converting global→contextual

Route-file dependence (file mentions, incl. allowlists/caps/business logic):

| Role | Route files | Role | Route files |
|---|---|---|---|
| participant | 53 | program_manager | 100 |
| founder | 34 | developer | 60 |
| facilitator | 19 | teacher | 78 |
| investor | 25 | team | 12 |

Layers affected:
1. **Session role** (single) — the core: multi-context requires the session/context
   resolver to supply the *active context* (pathname/context param + membership
   lookups) instead of one global role.
2. **`requireAuth([roles])` allowlists** (subset of 276 role-only files) — must
   migrate per route to capability checks + membership/context checks.
3. **role_capabilities fallback** (developer/teacher/team/admin) — profile-less
   legacy path must be retired for contextual roles.
4. **role_access_profile_defaults** — contextual rows (participant, program_manager,
   investor) become *contextual defaults* (context-role → profile) rather than
   global-role defaults.
5. **Eligibility defaults / allowed_roles / nav masks** — vocabulary convergence.
6. **Healthy context checks to preserve & extend** — ventureAuth (venture_members,
   venture_staff_assignments), facilitation scope (v2_program_staff, v2_teams),
   program participant scope. These become the context/scope source; they are the
   reason this correction is additive, not a rewrite.

---

## E. Migration Plan (proposed — for approval, NOT executed)

Principles: additive first; no destructive change; resolver core untouched;
every step revertible; contexts reuse existing tables (participant_programs,
v2_program_staff, v2_teams, venture_members, lms_enrollments, investor tables).

1. **Schema (additive):**
   - `contacts.role` retained as the *baseline* column; add
     `contacts.baseline_role` alias only if a clean cut is preferred (optional).
   - `user_responsibilities` += `program_id`, `venture_id` (contextualize).
   - New small registry: `context_role_profiles (context_type, role, profile_id)`
     — maps contextual roles to configurable profiles (Permission-Center driven).
   - Investor/venture/team contexts: reuse existing tables; add missing context
     fields only where proven absent.
2. **Data:** no backfill needed for participants/founders/facilitators (rows
   already exist). Reclassify legacy role values read-only; leave current rows
   until read-path migration proves zero dependency (non-destructive).
3. **Code — context resolution (the key change):** introduce a session
   **active-context resolver** that augments (never replaces) baseline identity:
   baseline identity (member/staff/SA) + active membership context from
   pathname/parameter → contextual role(s). Interim compatibility bridge:
   derive legacy role values from memberships so existing allowlists keep
   working while they migrate (flag-gated).
4. **Authorization:** migrate role allowlists → `requireAuthorization` +
   membership-context checks, phase by phase (Permission-Center governance
   backlog); contextual roles feed the future scope engine (P4) via the same
   membership tables.
5. **Stop role mutation:** replace writes in §C rows 1,2,3,5,6 with membership
   writes; keep row 4 (identity promotion) with audit.
6. **UI:** member workspace for all baselines; context switcher lists active
   memberships; nav = baseline nav + contextual entries; staff-cannot-be-
   participant enforced as a membership business rule.
7. **Tests:** acceptance matrix (§28 of the directive) as integration tests on
   staging fixtures; regression suite must stay green per phase.
8. **Rollback:** each step = own commit; mutation-stop behind flag; membership
   rows already exist so no data-loss path; restore = flag off + revert.

---

## F. Multi-Context Test Plan (Member + Participant + Facilitator + Founder + Coach + Learner)

Fixture "Sarah": contacts.role = **member** (baseline), plus rows in
participant_programs (Program A, participant), v2_program_staff (Program B,
facilitator), venture_members ×2 (Venture X founder/is_owner; Venture Y
product-lead), venture coach row (Venture Z), lms_enrollments (course C).

Assertions (integration, staging):
1. Baseline remains `member` through every join/leave/role change.
2. Each context independently grants/revokes its surface (Program A access
   independent of Venture X access; membership removal never touches
   contacts.role).
3. Same capability granted in two contexts applies per-context scope (e.g.,
   `sessions.view` → own sessions only) — exercised via context resolver +
   (later) scope predicates.
4. Collision tests: staff→participant rejected (business rule); role change in
   one context does not leak to another; leave-venture removes founder surface
   only.
5. Legacy bridge test: while allowlists still exist, the derived legacy role
   equals the *active context's* expectation; no cross-context bleed.
6. Eligibility + resolver regression suite stays green under the context
   resolver (cache key must include context).

---

## G. Product decisions still required (before implementation)

1. `teacher` fate: program-contextual staff role (recommended) vs retirement.
2. `program_manager` for external Members: allowed by business rule, or
   Staff-only for MVP? (Directive allows "if business rules allow".)
3. Legacy `contacts.role` values of already-contextualized users: keep as
   read-only legacy hint (recommended) vs backfill to member + flags.
4. Context-role → profile registry: approve `context_role_profiles` concept so
   contextual roles stay configurable (Permission-Center compatible).
5. Investor context representation: reuse existing investor tables as the
   context source (recommended).
6. Sequencing: this correction before or interleaved with Permission-Center
   governance work (recommended: context resolver + mutation-stop first;
   allowlist migration follows in governance phases).

---

**STOP.** No implementation performed. Awaiting Product review/approval of the
model, decisions in §G, and explicit go-ahead before any schema/data/code change.

# ImpactOS — Authorization Current State & Consolidation Plan

> Status: audit (Phase 1–3) + correctness pass (Phase 4) committed.
> This document is the **current-state map** for the permission system. It records
> what is implemented, what coexists, and what migration remains — so no future
> change has to rediscover it.
>
> Companion documents (per-phase detail): `PHASE5_SCOPE_ENGINE.md`,
> `PHASE5B_VENTURE_PILOT.md`, `PHASE5C_STRICT_MODE.md`,
> `PHASE6_CONTEXT_GRANT_APPLICATION.md`, `PHASE3_LMS_RETIRED_GOVERNANCE.md`,
> `IDENTITY_*.md`, `PRODUCTION_TEST.md`.

---

## 1. The model as implemented

```
IDENTITY            contacts.role — platform identity only
                    (super_admin | developer | admin | staff | program_manager |
                     team | facilitator | participant | investor | member)
    │
ELIGIBILITY         feature_eligibility — a CEILING, never a grant.
    │               Fail closed: no row / eligible = 0 → deny.
    │               Super Admin bypasses.
    │
BASE CAPS           access_profile_capabilities for the resolved profile
    │               (user override → role default → role_capabilities legacy)
    │
GROUP CAPS          group_capabilities for the effective groups
    │
PERSONAL GRANTS     user_capabilities (may carry expires_at, granted_by)
    │
MAX-MERGE           effective = MAX(base, group, grants)
    │
BLOCKS              user_capability_restrictions DELETE the capability.
    │               A block is not a level reduction — re-granting does not
    │               bypass it; only removing the block does.
    │
SCOPE               scope.js predicates read authoritative assignment rows
    │               (not the capability cache). Fail closed on any uncertainty.
    ▼
EFFECTIVE PERMISSION
```

Canonical resolution path: `src/models/authorization/resolver.js`
(`resolveAuthorizationContext` → `authorize` → `requireAuthorization` / `can`).
Pure merge semantics: `mergeEffectiveCapabilities` (max-merge then block-remove).
Explanation surface: `buildPermissionExplanation`.

**Rule that must not regress:** blocks beat grants, and a block removes the
capability rather than lowering it. Locked by
`src/__tests__/authorization-resolver.test.js`.

---

## 2. Current-state map

| Concept | Status | Where |
|---|---|---|
| Identity vs contextual responsibility | IMPLEMENTED | `docs/IDENTITY_*.md`; role is no longer mutated by venture/program membership |
| Eligibility / ceiling | IMPLEMENTED | `models/authorization/eligibility.js`, `eligibility-defaults.js`, admin at `.../permissions/eligibility` |
| Reusable permission sets | IMPLEMENTED (as **Access Profiles / templates**) | `access_profiles` + `access_profile_capabilities`; UI: Permission Center → Profiles |
| Role → profile defaults | IMPLEMENTED | `role_access_profile_defaults` |
| Group grants | IMPLEMENTED | `group_capabilities` + `membership.js` |
| Personal grants | IMPLEMENTED | `user_capabilities` |
| Explicit blocks | IMPLEMENTED | `user_capability_restrictions` |
| CRUD capabilities | IMPLEMENTED | `capability-catalog.js` |
| Business capabilities | PARTIAL | `programs.publish`, `projects.archive`, `runs.review` exist; some are declared-but-unrouted (documented in `route-catalog-contract.test.js`) |
| Central capability registry | IMPLEMENTED | `PERMISSION_MODULES` (auth.js) + `CAPABILITY_CATALOG`; consistency locked by `route-catalog-contract.test.js` |
| Deterministic precedence | IMPLEMENTED | `mergeEffectiveCapabilities` |
| Permission-source explanation | IMPLEMENTED | `buildPermissionExplanation` + Permission Center explanation panel |
| Privileged capability identification | IMPLEMENTED | per-capability `risk` + `capabilityRisk()`; passive badge in the UI |
| Record/context scope | PARTIAL | `venture_own` enforced; `program_assigned` / `learning_own` predicates implemented but not enforced as policies (equivalent enforcement exists — see §4); `team_own` deliberately unimplemented → DENY |
| Backend enforcement | IN PROGRESS | ~190 handlers on the central gate; census below |
| Frontend authorization | IMPLEMENTED | nav/button gating reads effective permissions |
| Auditability | PARTIAL | `permission_audit_log`; previous/new values now captured on all individual/role/group writes (was grants only) |
| Regression coverage | IMPLEMENTED | 113 suites / 1527 tests green |

### Identity categories

The established direction (`Platform Owner | Internal Staff | Everyone Else`)
maps onto the existing role values; assigning a contextual responsibility must
**never** rewrite `contacts.role`. Where a route still keys behaviour on the
role *label* rather than the relationship, that is treated as a defect (§4).

---

## 3. Conflicts: old and new coexisting (Phase 3)

| # | Old mechanism | New mechanism | Authoritative today | Plan |
|---|---|---|---|---|
| 1 | Legacy per-venture permissions: `venture_permission_matrix`, `venture_responsibilities`, `venture_scope_types`; `hasVentureCapability()`; screens `/admin/ventures/permissions` + `/admin/ventures/[id]/permissions`; APIs `api/venture-permissions/{matrix,responsibilities,scopes}`; tables `venture_staff_assignments` | `ventures.*` capabilities + `requireVentureScopedAccess` (capability + `venture_own` scope) | **Both, per path.** Converted routes use the new gate; `members`, `notes`, `sessions`, `my-access` still call `hasVentureCapability`; the legacy admin screens still write the legacy tables | Bridge, don't delete — §5 |
| 2 | Retired LMS capabilities `lms.enroll`, `lms.publish`, `lms.assign` | `lms.view/create/edit/delete` | New: the six original sites were migrated to `lms.edit`; the LMS section-resource routes that had **reintroduced** `lms.assign` are migrated in this pass | DONE — `phase3-retired-lms.test.js` + `route-catalog-contract.test.js` lock it |
| 3 | Hardcoded role arrays (`requireAuth([...])`, `createHandler({roles})`, module-level `ROLE` constants) | `requireAuthorization(module, capability)` | Mixed — 276 handlers are category D | Migrate when the route's decision is genuinely authorization — §6 |
| 4 | `session.role === "..."` branching | relationship-driven resolution | Mixed — 39 occurrences; 26 files | Classify per site; not every branch is authorization |
| 5 | Facilitator per-program permission levels (`v2_program_staff.permissions`, `facilitator_default_permissions`) | capability + scope model | Legacy-level gate, assignment-derived | §7 |
| 6 | Legacy role-based `role_capabilities` fallback | access profiles | New, with the legacy fallback preserved for profile-less users | Keep (zero-loser), documented in the resolver |

### Venture consolidation strategy (the migration problem)

**Do not remove the legacy mechanism yet.** Evidence:

- **Production data depends on it.** `migrations/sync_permission_config_from_staging.sql`
  carries hundreds of `venture_permission_matrix` / `venture_responsibilities`
  rows, and `src/lib/venturePermissions.js` seeds the same tables. The matrix is
  live configuration, not dead scaffolding.
- **It is still enforced.** `hasVentureCapability()` is called by
  `api/ventures/[id]/members`, `.../notes`, `.../sessions`, `.../my-access`
  (and covered by `src/__tests__/ventures/permissions.test.js`).
- **It is still editable.** `/admin/ventures/permissions` and
  `/admin/ventures/[id]/permissions` are reachable from the venture detail page
  (`admin/ventures/[id]/page.js:263,270`). Their APIs are gated on the retired
  `["super_admin","developer","admin"]` role list, not on capabilities.
- **The two disagree in model, not just syntax.** The legacy model is
  *(responsibility × area × action)* on a global matrix plus per-venture staff
  assignments; the capability model is *(capability × scope)* with per-person
  and per-group grants and an audit trail. `venture_staff_assignments` is read by
  the **new** scope predicate too, so the two share one data source but not one
  evaluator.

Staged strategy (each step independently reversible):

1. **Freeze writes through the legacy screens.** Point their guards at the
   central gate (`permissions.view_matrix` / `permissions.assign_capabilities`)
   so the legacy configuration becomes capability-governed and audited, without
   changing what it stores. *(Not done — its admin APIs are category D today.)*
2. **Record the mapping.** Produce a read-only report of
   `(responsibility, area, action) → capability` for every matrix row, plus
   which live members hold which responsibility, so the equivalence is reviewable
   before anything is enforced.
3. **Bridge the remaining evaluator calls.** Convert `members`, `notes`,
   `sessions`, `my-access` from `hasVentureCapability()` to
   `requireVentureScopedAccess` **only after** step 2 shows every current holder
   keeps their access through capabilities (mirroring how
   `api/engineering/permissions/venture-strict-audit` was used for the pilot).
4. **Only then** retire the legacy screens/tables — after the census script
   (`scripts/authz-venture-coverage.mjs`) reads zero legacy gates and the audit
   endpoint shows no one loses access.

Rollback at every step: the conversion is code-level, and the legacy tables are
left untouched until step 4.

---

## 4. Scope: what is enforced, what is equivalent, what is missing

| Policy | Predicate | Enforced by a route? | Notes |
|---|---|---|---|
| `venture_own` | implemented | **YES** | `src/lib/ventureScopedAccess.js`, 29 route files |
| `program_assigned` | implemented | No policy call site | Equivalent enforcement exists as the assignment machinery (`requireAssignmentAccess` + `getFacilitatorTeamScope`) on the delivery surfaces. A record policy is deliberately **not** applied to directory reads: Staff/PM hold `programs.view` as a global capability, so a strict policy would remove the program directory from them. That is a product decision, not a bug fix. |
| `learning_own` | implemented | No policy call site | Equivalent enforcement is stronger: every learner route derives access from `lms_enrollments` server-side (`getLearnerCourse`, `completeLesson`, `assertAssessmentAccess`), and refuses suspended/absent enrollments. |
| `team_own` | **not** implemented | — | Resolves to DENY by design. Never replace this with an inferred scope. |

Relationship-derived scoping was tightened in this pass where the code keyed
scope on the platform **role label** instead of the relationship — see §8.

---

## 5. Authorization coverage census

~685 exported handlers across ~400 route files. Classification follows the
task's categories A–E.

| Category | Meaning | Count |
|---|---|---|
| A | Intentionally public | ~46 (login/register, public course catalogue, invite-token acceptance, client error reporter, cron/secret endpoints) |
| B | Token/secret secured | included above (reminder + overdue crons compare a shared secret; password-setup tokens) |
| C | Other trusted mechanism | 168 (venture scope 53, other helpers 44, `requireVentureAccess` 36, investor self-service 26, project access 9) |
| D | Legacy/custom authorization | 276 |
| E | **Missing authorization** | **5 → 1 remaining** |

### Category E — resolved in this pass

| Endpoint | Was | Now |
|---|---|---|
| `GET /api/invites` | **Unauthenticated**. `SELECT *` returned live invite **tokens** (the credential that mints a participant account), so anyone could enumerate unexpired invites. The sibling POST was already gated. | `requireAuthorization("programs", "view")`, denial returned **before** the read |
| `GET /api/platform/ai/evaluation-config` | Unauthenticated read of a form's scoring framework while PUT/DELETE required `forms.edit` | `requireAuthorization("forms", "view")` |
| `GET /api/platform/integrations/calendar` | Unauthenticated integration health (provider identity, configured, provider error text) | `requireAuthorization("settings", "view")` |
| `GET /api/platform/integrations/notion` | Unauthenticated config disclosure (which env vars are set) | `requireAuthorization("settings", "view")` |
| `POST /api/errors` | Unauthenticated write to the error log | **Left public, intentionally (category A).** It is the browser error reporter (`src/lib/reportError.js`, `AppErrorBoundary`) and must work on logged-out pages. Residual risk is log flooding, not data disclosure. |

### Category D — the migration backlog (not a bug list)

276 handlers use a legacy mechanism. They are **not** by definition wrong.
Grouped by mechanism:

- **Hardcoded role arrays** — 54 handlers (`program-staff`, `admin/*`,
  `security/*`, `ventures/route.js` GET/PUT, …).
- **`requireAuth([...])` call sites** — 91.
- **`session.role ===` branching** — 39 (26 files).
- **Bare `requireAuth()` / `createHandler(fn)`** — ~137 (authenticated, but no
  capability decision — some are correct: profile/photo, own-scope reads).
- **Legacy mounted guards** — role array + `requireVentureAccess` and friends.

Highest-value consolidation candidates (duplicates of checks the central system
already expresses): the `venture-permissions/*` admin APIs (same domain as the
fully capability-driven `engineering/permissions/*`), `superadmin/standard-types`
vs `permissions.assign_capabilities`, and `platform/seed/venture-application`
(fixed role list) vs the `forms`/`runs` capabilities already used by its
`platform/ai` siblings.

**Rule for each:** classify before converting. Authorization → centralise.
Navigation/UI, business rules, relationship resolution, and intentional public
behaviour → leave alone.

---

## 6. Retired permissions

`lms.assign`, `lms.enroll`, `lms.publish` are retired. The six original
enforcement sites were migrated to `lms.edit` (Option A in
`PHASE3_LMS_RETIRED_GOVERNANCE.md`). The LMS section-resource feature then
**reintroduced** `lms.assign` in three route files (five call sites) — which
zeroed out the capability, since no profile grants a retired key. They are
migrated to `lms.edit` in this pass.

Locked by `scripts/phase3-lms-retired-scan.mjs` (0 enforcement sites, 0 grant
sources) and two jest contracts: `phase3-retired-lms.test.js` and
`route-catalog-contract.test.js`.

---

## 7. Facilitator per-program permission levels

The vocabulary (`FACILITATOR_CAPABILITY_KEYS`), `PERMISSION_MODULES.facilitator`
and `CAPABILITY_CATALOG.facilitator` are kept in exact sync by
`facilitator-capability-coverage.test.js`, which also locks the enforcement
census:

- **Level-based, per program:** `attendance.record`, `attendance.view`,
  `participants.view`, `sessions.conduct`, `assignments.grade`,
  `assignments.view`.
- **Assignment-only (the level is not consulted yet):** `participants.manage`,
  `assignments.review`, `sessions.record`, `progress.view`, `groups.view`,
  `groups.manage`, and `reviews.submit` (no route call site at all).

**Why not flipped in this pass:** `getFacilitatorPermissionLevel()` answers `0`
for a capability key an assignment row does not carry. `facilitator_default_permissions`
and the JSON written by the bulk-invite flow are derived from
`buildFullFacilitatorPermissions()`, which was **missing `reviews.submit`**
(now fixed) — but historical `v2_program_staff.permissions` rows may omit keys.
Flipping a route to level-based enforcement before backfilling those rows would
deny existing facilitators. Required order:

```
1. backfill v2_program_staff.permissions + v2_programs.facilitator_default_permissions
   to carry the full FACILITATOR_CAPABILITY_KEYS vocabulary
2. verify with the per-program permission editor that each facilitator's levels
   are what the program intends
3. flip the assignment-only sites to level-based enforcement, one commit each
4. regression-test each site (deny / allow / no-scope)
```

---

## 8. Correctness fixes in this pass

| Defect | Impact | Fix |
|---|---|---|
| `PATCH /api/submissions` — team-scope guard only ran when `teamIds.length > 0` | A facilitator with **no** assigned teams skipped the record check and could grade any submission in the program (the GET path already denied) | Empty scope now denies, mirroring GET. Regression-tested both ways |
| `GET /api/calendar` — program scope keyed on `session.role === "facilitator"` | Since taking a facilitator assignment no longer mutates `contacts.role`, a `member` acting as facilitator fell through to "no restriction" and read **every** program's events (fail-open) | Scope derived from the assignment/enrollment relationships; no relationship → no program-scoped events. Management keeps the unscoped view |
| `GET /api/sessions` without `program_id` | Listed every program's sessions to any non-management session | Contextual callers must scope to a program |
| `POST /api/attendance` — gate read `records[0].program_id`, each row inserted its own | A batch could write attendance into a program that was never authorized | Every row must belong to the authorized program |
| `getLearnerCourses` missing `status <> 'suspended'` | A suspended learner saw a course in My Learning that every open would 403 | Filter aligned with `learnerHasEnrollments` and the `learning_own` predicate |
| Retired `lms.assign` reintroduced on section resources | Governance breach + the capability resolved to nobody | Migrated to `lms.edit` |
| `set_group_default` wrote no audit record | Group permission changes were the only untraceable write | Audited, with previous + new value |
| Grants/revokes/blocks recorded no previous value | "What changed" was unanswerable | Prior state is read before every write; both sides recorded |

---

## 9. Open decisions (product / deploy)

| # | Decision | Where it blocks |
|---|---|---|
| D1 | Grant `lms.edit` to the profiles that should publish/enroll/attach (currently **nobody** holds it, so only Super Admin can) | `docs/PRODUCTION_TEST.md` §3; migrate the facilitator backfill in §7 |
| D2 | Enforce the where-it-applies rule for **program writes** — DONE and unconditional (§12.4). The remaining work is converting three banner-protected legacy routes so coverage is complete (§12.6) | §4, §12 |
| D3 | Resolve `team_own` (`v2_teams` mapping) or keep the fail-closed DENY permanently | `scope-catalog.js` |
| D4 | Grant `assignments.review` per facilitator. `reviews.submit` is now **enforced** (done, §11) | §7, §11 |
| D5 | The relationship re-derive and the readiness report now have a screen (§11). The venture strict audit and the access-profile seeding remain API-only | `docs/PHASE6_CONTEXT_GRANT_APPLICATION.md` |
| D6 | Capture the audit filters the API already supports (`actor`, `target`, `capability`, `target_cid`) in the audit screen | Permission Center |
| D7 | Repoint the programme-manager role default at the new portfolio template — a deliberate click in Operations, which reads the impact first. Nothing is repointed at boot | §12.7 |
| D8 | `CONTEXT_GRANTS_SECRET_KEY` must be set and the sweep scheduled for the belt-and-braces withdrawal (expiry already covers the cutoff without it) | §11 |

---

## 10. Verification

```
npx jest --runInBand          # 113 suites / 1527 tests
npm run lint                  # 0 errors
npm run build                 # zero build errors
node scripts/authz-venture-coverage.mjs   # venture migration census
node scripts/phase3-lms-retired-scan.mjs  # retired-capability census
```

New/updated regression suites:

- `src/__tests__/authz-endpoint-hardening.test.js` — the four category-E gates.
- `src/__tests__/authz-scope-enforcement.test.js` — submissions/calendar/sessions/attendance.
- `src/__tests__/lms-learner-suspended.test.js` — suspended enrollment exclusion.
- `src/__tests__/facilitator-capability-coverage.test.js` — vocabulary sync + enforcement census.
- `src/__tests__/permissions-admin-api.test.js` — audit previous/new values.

---

## 11. Assignment-derived program access (IMPLEMENTED)

A facilitator and a program manager hold their program access because of the
assignment they have on a **particular program**, and only while that program
runs. This section records how that is implemented and what it deliberately
leaves to a product decision.

### The chain

```
v2_program_staff (role = facilitator)          ─┐
v2_programs.assigned_pm_id                     ─┼→ ACTIVE assignment rows
v2_program_staff (role = program_manager)      ─┘   (ended programs excluded)
        │
        ├─ facilitator     → the per-assignment TICK LEVELS decide which
        │                    capabilities the assignment really grants; the
        │                    union (strongest level) across programs becomes the
        │                    grant
        ├─ program_manager → the Context Roles registry → the narrow
        │                    "Assigned Program Manager" template
        │
        ├─ EXPIRY          → the LATEST program end date. The resolver already
        │                    ignores expired grants, so access dies on its own
        │                    at the program's end even if nothing ever sweeps
        │
        └─ grant rows      → user_capabilities, stamped
                             granted_by = ctx:program:<role>, mirrored in
                             context_applied_grants for provenance
```

Files: `src/models/authorization/programAssignments.js` (derivation),
`contextGrants.js` (application, now context-generic),
`programAssignmentBackfill.js` (one-time repair), `contextGrantReadiness.js`
(the report).

### Why nothing was blocked for people already in production

Four separate safeguards, each covering a different way the change could have
removed access:

| Safeguard | What it prevents |
|---|---|
| Grants are **additive** and merge by MAX, exactly like the venture founder mechanism | A grant can only ever add a capability; nothing is downgraded |
| **Eligibility rows** seeded insert-only for `facilitator` and `member` on the programs feature | The grant would be **inert** (eligibility is checked first and fails closed) |
| An entry the tick list never carried resolves to **granted** | Reading an absent entry as denied would have stripped access from every existing facilitator |
| A **tick-list backfill** writes the level each assignment already implied | The enforcement step cannot deny a facilitator who is working today |

And the delivery itself: the reconcile runs **on connect** (the screen shell
loads the permission matrix on every signed-in page), so an existing facilitator
or program manager receives their assignment-derived grants the first time they
open the app — without any manual step.

### Removability

| The administrator wants | Mechanism | Why it holds |
|---|---|---|
| Remove ONE access for a particular person (facilitator or program manager) | An explicit **block** from the People screen | Blocks are applied by the resolver **after** the merge, so the next reconcile re-applying the relationship grant cannot resurrect it. Locked by a regression test |
| Remove an access for one facilitator **in one program** | Set that entry to 0 in the program's facilitator assignment | The per-program tick list is consulted at request level (attendance, participants, sessions, grading, review submission) |

### Duration

| Mechanism | Effect |
|---|---|
| `user_capabilities.expires_at` = latest program end date | Instant cutoff at the program's end date; no job required |
| `POST /api/engineering/permissions/context-grants-sweep?key=CONTEXT_GRANTS_SECRET_KEY` | Withdraws the grant rows outright once the assignment stops being active (completed / archived / past end date). Also the backfill. Recommended daily |
| `GET /api/engineering/permissions/sync-context-grants` | The manual re-derive, now surfaced as the **Operations** screen |

### The screens (Permission Center → Operations)

Two portfolio-wide jobs, previously reachable only by typing a URL:

1. **Re-derive access from relationships** — behind a confirmation, reports what
   was applied/withdrawn per context.
2. **Who would lose access** (read-only) — per person: what is applied, what the
   next run would change, the expiry, and the capabilities they hold today that
   their **assignment does not justify**. That last list is the input to decision
   D7.

### Deliberately NOT done

- **Program route scope enforcement** (`program_assigned` on program writes).
  Staff and program managers hold program capabilities portfolio-wide **by
  template**, so enforcing record scope without first narrowing those templates
  would remove the program directory from them. The readiness report is the
  measurement that makes the narrowing safe; the two must move together, as a
  product decision (D2 + D7).
- **Six facilitator capabilities remain assignment-only**: `participants.manage`,
  `assignments.review`, `sessions.record`, `progress.view`, `groups.view`,
  `groups.manage`. Their routes are gated on role allowlists that never admit a
  facilitator, or no route exists — wiring them means *loosening* or *adding* a
  route, which is a product decision, not an enforcement fix. The census in
  `src/__tests__/facilitator-capability-coverage.test.js` keeps the gap explicit.
- **Venture and team surfaces** — out of scope for this pass, as agreed.

---

## 12. The program-scope program (DONE, except three exempt legacy routes)

The goal: a staff member or programme manager reaches the programmes they were
given, not the whole catalogue — and the people who genuinely run the portfolio
keep running it.

### Why it is a programme rather than a change

Enforcing the where-it-applies rule for programmes is a **removal**. Today a
capability holder reaches every programme. The rule restricts them to the ones
they are attached to through a relationship. Three things make that unsafe to
ship in one move, and each has a step here.

| # | Step | Status |
|---|---|---|
| 1 | **Measure.** Report unmanaged programmes and the people attached to nothing | **DONE** (§12.1) |
| 2 | **Repair the data.** Record a manager for every running programme | **DONE** — action shipped, the administrator works the list (§12.2) |
| 3 | **Split the template.** Separate portfolio-wide powers from assignment-derived ones | **DONE** — template created and inert; the repoint is a deliberate click (§12.3) |
| 4 | **Enforce the rule.** | **DONE** — the guard is unconditional; there is no switch (§12.4) |
| 5 | **Say what it means operationally** — unmanaged programs, and the repair path | **DONE** (§12.5) |
| 6 | **Account for coverage** | **DONE** — the census is a test (§12.6); converting the three exempt legacy routes remains |

### 12.1 Measure

`GET /api/engineering/permissions/program-scope-readiness` (read-only). Two
findings, because both are invisible from either side alone:

- **Unmanaged programmes** — a running programme with no manager recorded can
  never be matched by the rule, so enforcing it first would make that programme
  unreachable to everyone except the portfolio identity. A manager recorded only
  as a staff row counts as managed; an **ended** programme is not a defect.
- **People attached to nothing** — a holder whose template grants programme
  editing but who is attached to no running programme loses **all** programme
  access. That count is the number that decides whether the rule can be switched
  on at all.

The report is template-based (a handful of queries, not a per-person resolution
loop), so its cost does not grow with the number of people.

### 12.2 Repair the data

`PUT /api/pm/programs/[id]/manager` records who manages a programme — the action
that clears the worklist. It reconciles the assignment-derived access of **both**
sides: the new manager receives it, the previous manager loses what that
programme alone justified. Gated on `programs.edit`, because changing who runs a
programme is a programme write. A reconcile failure never loses the recorded
relationship: the assignment is the source of truth and the next connect (or the
sweep) re-derives from it.

The programme workspace shows the manager read-only, which is why this action
lives in the Operations screen rather than being a form field.

### 12.3 Split the template

The seeded programme-manager template bundles **three** jobs and applies them by
identity label:

| Bundle | Content | Verdict |
|---|---|---|
| Programme management | see / create / edit / publish **every** programme | belongs to the identity (portfolio) |
| Venture work | see **and edit** ventures | `edit` removed — that is the venture responsibility, already granted inside the venture's own boundary |
| CRM work | see people **and create** people | `create` removed — that is CRM work |
| plus | projects, reports, messaging, courses | kept |

**Both READs stay on purpose.** Programme screens read participant records and
touch venture-producing programmes, so removing the read would break working
screens; removing the WRITE is what takes away a job belonging to another
responsibility.

A new **"Program Manager (Portfolio)"** template carries the trimmed set. It is
**inert**: it is created at boot (additive, changes nobody), and nothing resolves
to it until the role default is repointed — deliberately, from Templates, after
reading the impact report. `removals[]` names exactly which capabilities the
repoint would stop granting and how many people each affects, so the decision is
made with the numbers in view rather than from a description.

### 12.4 The guard — enforced unconditionally

The record-scope guard adds the WHERE to whatever the route already decided the
WHAT to be:

```
Super Admin     -> allow (resolver semantics: unscoped authority)
capability      -> only when the caller passes one, so routes that authorise by
                   role list get scope without a competing second decision
program_staffed -> the program must be one they are STAFFED on
```

`program_staffed` is a scope policy of its own, separate from `program_assigned`
on purpose: the latter includes a learner's ENROLLMENT, which is right for "may
this person see this program" and wrong for "may this person change it". Being
enrolled never authorises editing.

There is **no rollout switch**. One existed briefly and was removed, for a reason
worth recording: it made "read the report first" the only thing standing between
the measurement and the action, which is not a control. A rule that only applies
when somebody remembers to enable it does not protect anything, and the switch's
own default (every domain off) meant the requirement was never actually in force.

Denials are explicit and diagnosable, mirroring the venture gate:
`X-Authz-Decision: out-of-scope | capability-missing | unresolvable`, with
`missing = { scope: "program_staffed", wave }` so a refusal names both the rule and
the domain that applied it. A **missing program id is a denial**, never a pass: an
action that cannot be attributed to a program cannot be scope-checked. A bulk
action requires **every** id in scope — one out-of-scope id refuses the whole
request, because a partial write is harder to see and to undo than a refusal.

### 12.5 What enforcing it means operationally

Stated plainly, because both are real consequences rather than defects:

1. **A program whose manager nobody recorded can never be matched**, so only
   Super Admin can write to it. That is what the readiness report's unmanaged
   worklist is for.
2. **The repair action must not be blocked by the rule it repairs.** Nobody is
   staffed on an unmanaged program by definition, so the manager-assign action has
   two ways in: staffed on the program (the ordinary case), or holding the
   permission-console authority — because changing who manages a program IS an
   access change, since it decides who receives the assignment-derived grants. A
   staff member holding only `programs.edit` still cannot touch a program they are
   not staffed on, so the rule is intact.

A wave is a GROUPING, not a gate. It survives as vocabulary because the census,
the report and the screen all need to describe the same three domains.

### 12.6 Coverage — where the rule does not reach

`src/__tests__/program-scope-coverage.test.js` is the census, and it is now the
whole of what remains. It fails if:

- a wired surface loses its guard, or a **new** write surface is added to a domain
  without one;
- a file is wired for the **wrong** domain;
- an exempt file gains a guard or loses its banner (either invalidates the
  "partial" claim);
- a domain is declared without an entry in the census.

Which surfaces are wired, and which stay open:

| Wired (the guard is consulted) | Not wired |
|---|---|
| `api/pm/programs` (PUT, DELETE) | `api/v2/groups` — **live**, banner-protected |
| `api/participant-programs` (POST, DELETE) | `api/v2/kpis` — **live**, banner-protected |
| `api/participant-programs/bulk` (POST) | invitation acceptance (intentional) |
| `api/invites` (POST) | side-effect enrolments (intentional) |
| `api/groups` (POST, PUT, DELETE) | |
| `api/kpis` (POST, PUT, DELETE) | |

For the id-only handlers (group and KPI PUT/DELETE) the owning program is read
first, because a write that cannot be attributed to a program is refused rather
than guessed at.

### 12.6.1 What was removed, and what must NOT be

`api/v2/invites` (both the collection and its `[token]` acceptance route) was
verified unused — no fetch, no import anywhere — and **removed**. The census now
asserts the files are gone and that nothing calls them, so a reintroduction fails
loudly instead of quietly reopening a bypass.

**`api/v2/groups` and `api/v2/kpis` were NOT removed, and must not be**, despite
their in-file banner being out of date about who still calls them. They are live:

| Route | Called by |
|---|---|
| `api/v2/groups` | `admin/programs/[id]/groups/[groupId]`, `components/pm/FacilitatorsPanel` |
| `api/v2/kpis` | `admin/programs` (list, create, weights), `pm/programs/[id]` (create, delete) |

Converting those callers is therefore a BEHAVIOUR change, not a rename, and it
needs two decisions first:

1. **KPI weights have no V1 equivalent.** The V1 KPI route creates and updates a
   title/target only; weight redistribution exists solely in the V2 route. The
   weights feature must be ported before those callers move.
2. **The group writers do not hold the V1 route's permission.** `api/groups`
   requires the capability-assignment authority, which staff and program managers
   do not hold; the V2 route admits them. Moving the callers without deciding the
   gate would remove group management from them.

So the remaining work is two conversions with a decision each — not a deletion.

### 12.7 The template split has its click

Creating the trimmed portfolio template changed nobody, and the repoint was left
to the Templates screen — which meant the most consequential removal in the whole
programme had no purpose-built action. There is one now: it **reads the impact
first** (which capabilities stop being granted and how many people hold them),
confirms, writes, and reports **what it took away** rather than only that it
succeeded. It refuses to overwrite a default an administrator set by hand, is
idempotent, and audits the previous and new template.

The fifth scope policy is rendered too. `program_staffed` was added to the shared
catalogue for the write side of the program question, but the governance screen
still listed four rows, so the catalogue advertised a rule nobody could see.

### 12.8 Contract coverage

| Suite | Locks |
|---|---|
| `program-scoped-access.test.js` | enforcement applies on every call (no gate to be off by accident); a missing program id denies; enrollment never confers scope; Super Admin is unscoped; an infrastructure failure is a 500 |
| `program-scope-wiring.test.js` | the guard through REAL route handlers, both shapes: a program id from the body, and one resolved from the record first |
| `program-scope-coverage.test.js` | the census above, plus the "partial" claim staying honest |
| `program-scope-cutover.test.js` | the template split: impact before write, refusal of a hand-set default, the removal report, the audit record |
| `program-manager-assignment.test.js` | the repair path's two ways in, and that a staff member with only `programs.edit` is still refused |
| `program-assignment-grants.test.js` | the derivation, its expiry, and its tolerance of a database without the optional profile column |

### 12.9 What remains, and it is not code

1. **Work the repair list** — give every running program a manager (Operations →
   Programme access → Assign manager). Until then, writes to those programs are
   Super-Admin-only.
2. **Review the impact** — the report lists everyone holding program editing who
   is staffed on nothing, and which capabilities the portfolio repoint would
   remove.
3. **Repoint the role default** at the trimmed portfolio template, using the
   action in the same panel (it shows the impact before it writes).
4. **Decide the two conversions** in §12.6.1 — port the KPI weights to the V1
   route, and settle which capability should govern group writes. Both are product
   decisions; the routes themselves are live and must not be deleted first.

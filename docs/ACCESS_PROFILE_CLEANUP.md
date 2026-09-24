# Access Profiles & Rules — Cleanup Analysis

**Status: PHASES 1–3 IMPLEMENTED**, plus the capability-loss guard on assignment (§4b).
Phases 4–5 are **not** started.
**Measured:** production database, 2026-09-24, read-only SELECTs.
**Audience:** Super Admin / product owner + the engineer who picks up the rest.

---

## 0. Executive summary

The single most important finding: **the enforcement layer already behaves the way
you want.** Assigning an access profile to a person gives them that profile's
capabilities, and it does **not** touch their global role. That is already true in
production today — verified in code, not assumed.

What is broken is the layer *around* enforcement:

| # | Defect | Impact |
|---|---|---|
| 1 | The **profile editor** refuses to show capabilities unless the profile is bound to a role | You cannot author a standalone profile at all — this is the block you hit |
| 2 | The **delete guard** blocks on *role defaults* and ignores *assigned people* | The exact inverse of the required rule; and `ON DELETE SET NULL` silently strips those people |
| 3 | The **"who is affected" count** ignores context bindings | A live profile reports "0 users" and looks dead |
| 4 | **`role_capabilities`** still silently supplies staff access | The biggest source-of-truth breach: staff's real capabilities are invisible on the Templates screen |
| 5 | Assigning a profile shows **no before/after diff** | An empty or thinner profile silently strips every capability the person had (the `Dev Interns` case) |

Recommendation: this is **three small fixes + one guard + one decision**, not an
architecture rebuild. Details in §11 and §13.

---

## 1. Current profile sources (Q1)

| Store | Rows (prod) | Role | Live? |
|---|---|---|---|
| `access_profiles` | 15 | The profile record (name, description, is_active) | ✅ authoritative |
| `access_profile_capabilities` | 239 | What a profile grants (module + capability + level) | ✅ authoritative |
| `role_access_profile_defaults` | 7 | Which profile a **global role** gets by default | ✅ live, secondary |
| `context_role_profiles` | 7 | Which profile a **context role** seeds (program/venture/lms/investor) | ✅ live, indirect |
| `contacts.access_profile_id` | 1 | The **individual** override | ✅ live, highest precedence |
| `contact_roles.access_profile_id` | 0 | Supposed individual override on the context layer | ❌ **dead — never read** |
| `v2_program_staff.access_profile_id` | — | Legacy program-staff override | ⚠️ legacy |

**Four stores can bind a profile to a person.** Only three are read by the resolver.

## 2. Current rule sources (Q2)

| Source | Kind | Used by |
|---|---|---|
| `feature_eligibility` | **data** — the ceiling | `src/models/authorization/eligibility.js`, resolver |
| `FEATURE_ELIGIBILITY_DEFAULTS` | **hardcoded** in `src/models/authorization/eligibility-defaults.js` | Boot seed only (never overwrites an admin edit) |
| `RESPONSIBILITY_FEATURE_ROLES` | **hardcoded** — must mirror the defaults above | `responsibilities` screen |
| `responsibilities.allowed_roles` (JSON) | **data** — workflow allowlist | Workflow screens |
| `role_capabilities` | **data** — legacy capability fallback | Resolver, when no profile resolves |
| `user_capabilities` / `user_capability_restrictions` | **data** — per-person grant/deny | Resolver merge |
| `group_capabilities` | **data** | Resolver merge — **0 rows on production** |
| `MODULE_TO_FEATURE` | **hardcoded** in `eligibility.js` | The module → feature bridge |

**Measured rule vocabulary (production):** 53 rows, **all `identity_type = 'role'`** —
there are **zero group-eligibility rows** on production. 12 feature keys:
`communication, crm, finance, investors, knowledge, lms, operations, programs,
reports, security, settings, ventures`. Two of them (`security`, `settings`) carry an
explicit **deny** row — the deny mechanism is in active use.

> ⚠️ **Loophole to verify:** `authorize()` (`resolver.js:457-459`) only enforces the
> eligibility ceiling when `MODULE_TO_FEATURE[module]` is defined. A module with **no**
> feature mapping skips the ceiling entirely and is governed by capability level alone.
> Any module added to the registry without a `MODULE_TO_FEATURE` entry silently
> bypasses eligibility.

## 3. Role ↔ profile relationships (Q3)

Stored in `role_access_profile_defaults` — 7 rows on production:

| Role | Default profile |
|---|---|
| `super_admin` | Super Admin Default |
| `program_manager` | Program Manager |
| `teacher` | Instructor |
| `mentor` | Mentor |
| `investor` | Mentor |
| `participant` | Participant Default |
| `founder` | Founder |

**Not bound:** `staff`, `member`, `facilitator`, `team`.

And a **UI/data mismatch** — the Profiles screen's "Default for" dropdown is built from
`ELIGIBILITY_IDENTITIES` (`src/models/authorization/eligibility-admin.js:83-86`):

| | Roles |
|---|---|
| Offered in the dropdown | `super_admin, staff, member, participant, facilitator, investor, founder` |
| Actually bound in the DB | `super_admin, program_manager, teacher, mentor, investor, participant, founder` |
| **Pickable but unbound** | `staff, member, facilitator` |
| **Bound but not pickable** | `program_manager, teacher, mentor` |

The Profiles screen uses `eligData.roles` only (`PermissionCenter.js:1247-1254`) and
**ignores `eligData.extraRoles`** — which the Rules screen does consume. That is why
"some roles show in one place and not the other".

## 4. Individual assignment mechanism (Q4)

**Resolver precedence** (`src/models/authorization/resolver.js:293-331`):

```
1. contacts.access_profile_id   → if set AND the profile is_active = 1   ("user")
2. role_access_profile_defaults → for the person's global role           ("role")
3. role_capabilities            → legacy fallback                        ("legacy")
```

Then capabilities are merged (`resolver.js:360`):

```
mergeEffectiveCapabilities(baseCaps, groupCaps, grants, restrictions)
```

**A profile override REPLACES the role default. It never adds to it.**

The global role (`contacts.role`) is **never written** by the assignment path —
`src/app/api/access-profiles/assign/route.js` writes only `access_profile_id`.

**Can an individual have multiple profiles?** **No.** `contacts.access_profile_id` is a
single value. Additive access is available through a different mechanism
(`user_capabilities` grants), not through a second profile.

**Can an individual have additional capabilities on top of a profile?** **Yes** —
`user_capabilities` is merged additively. 12 rows on production: **9 manual** Super
Admin grants and **3 seeded** by the context layer
(`granted_by = 'ctx:program:program_manager'`). The 3 context rows carry `expires_at`,
and `fetchUserGrants` filters on it (`resolver.js:126-130`) — they **expired on
2026-09-11** and are already inactive.

> Two different lifetimes for the same idea: **context grants expire, profile
> capabilities never do.** Worth a decision.

### 4b. The capability-loss guard on assignment (defect #5 — implemented)

Assigning a profile **replaces** the base capability layer. That makes an empty
profile catastrophic and silent: `Dev Interns` (0 capabilities) assigned to a
staff member drops them from 28 capabilities to **0**, with no warning.

The eligibility check does not catch it — `assertTemplateCapsEligible` only
rejects a profile that grants *more* than the person is eligible for. An empty
profile trivially passes.

**Contract now in force** (`PUT /api/access-profiles/assign`):

| Request | Result |
|---|---|
| `{ user_cid, profile_id }` and nothing is lost | 200 — assign |
| `{ user_cid, profile_id }` and the profile is **empty** | **409** `profile_assignment_empty_profile` |
| `{ user_cid, profile_id }` and capabilities would be removed | **409** `profile_assignment_removes_capabilities` |
| any of the above `+ confirm: true` | 200 — assign |

The 409 body carries `loss`: `currentSource` (`profile` / `role_default` / `legacy`),
`currentCount`, `newCount`, `removedCount`, `gainedCount` and a capped `removed`
list. The current base layer is read through `getCurrentBaseCapabilities()`,
which mirrors the resolver's precedence exactly, so the diff cannot drift from
what the resolver will actually do.

## 5. Capability source (Q5)

| Layer | Source |
|---|---|
| Base | profile capabilities — **or** `role_capabilities` if no profile resolves |
| Groups | `group_capabilities` (0 rows prod) |
| Personal grants | `user_capabilities` (additive) |
| Personal blocks | `user_capability_restrictions` (subtractive, wins) |
| Ceiling | `feature_eligibility` (per global role + groups) |

Final gate (`resolver.js:447-460`):

```js
const featureKey = MODULE_TO_FEATURE[module];
if (featureKey && ctx.eligibility?.[featureKey] !== true) return false;
return Number(ctx.effective?.[module]?.[capability] ?? 0) >= minLevel;
```

**Eligibility comes from the global role (+ groups). It never comes from the profile.**
That is deliberate and is the ceiling that makes individual profiles safe.

## 6. Duplicated / conflicting sources (Q6)

| Concept | Source A | Source B (conflict) |
|---|---|---|
| Staff capabilities | `role_capabilities` (28 rows) — **the real source today** | "Staff Default" profile (35 caps) — unused, unbound |
| Investor access | `role_capabilities` (3) | `Mentor` profile via role default |
| Profile reach | `contacts.access_profile_id` + role defaults | `context_role_profiles` (ignored by the count) |
| Individual override | `contacts.access_profile_id` | `contact_roles.access_profile_id` (dead) |
| Rules | `feature_eligibility` (data) | `FEATURE_ELIGIBILITY_DEFAULTS` + `RESPONSIBILITY_FEATURE_ROLES` (hardcoded, must stay in sync) |

## 7. Legacy / unused structures (Q7)

| Item | Evidence | Verdict |
|---|---|---|
| `contact_roles.access_profile_id` | 5 rows in `contact_roles`, **0** with a profile set; resolver never reads it | Dead column — retire or wire up |
| `group_capabilities` | 0 rows | Unused in practice |
| `role_capabilities` | 107 rows; staff/PM/participant/etc. still resolve through it | **Legacy but load-bearing** — cannot drop yet |
| `context_role_profiles` row `program/facilitator` | `profile_id IS NULL` | Unconfigured mapping |
| `v2_program_staff.access_profile_id` | Legacy path kept as first choice in `resolveProgramAssignment` | Legacy |
| `_bak_20260916_*` (6 tables), `_backup_contact_roles_20260819` | Present on production | Migration backups — do not drop without confirming |
| Profiles with **0 people and no role binding** (9) | `Program Manager (Portfolio)`, `Assigned Program Manager`, `Dev Interns`, `Staff Default`, `Operations Manager`, `Project Owner`, `Investor Access`, `Finance Assistant`, `learner` | Dead config as measured by the count — but see §8, two of these are actually reachable via context |

## 8. Why the UI says a profile must be a default role profile (Q8)

Exact cause:

- Copy: `engineering.permissions.profileNoRolesHint` — `src/locales/en/engineering.json:424`
- Rendered: `src/components/permissions/PermissionCenter.js:2150`
- Cause: `src/components/permissions/matrixHelpers.js:253-259`

```js
export function filterSectionsByRoleEligibility(sections, roles, isEligible) {
  if (!roles || roles.length === 0) return [];   // ← the whole block
  ...
}
```

The editor builds its feature list from **the eligibility of the roles the profile is
bound to**. No role bound → `visibleSections = []` → nothing to tick → the message.

**The backend never had this requirement.** `PUT /api/access-profiles`
(`src/app/api/access-profiles/route.js:304-318`) applies the eligibility ceiling **only
when the profile is a role default** — a role-less profile saves fine, with any
capabilities.

> **So the fix is confined to the front-end editor.** Nothing in the resolver, the save
> path, or the assignment path requires a role binding.

A second, correct-but-invisible guard: `assertTemplateCapsEligible` at assignment time
(`assign/route.js:64-68`) validates the profile against **the assignee's** role + groups,
and refuses the assignment if it exceeds their ceiling. This is the real safety net.

## 9. What must change for independent profiles (Q9)

1. **Editor**: build the feature list from the **capability registry** (all features),
   not from the bound roles' eligibility. Keep eligibility as a *warning* — show
   "assignable to: staff, program_manager" computed from who is eligible — instead of
   using it as a *filter*.
2. **Copy**: replace `profileNoRolesHint` / `profileNoRolesEmpty` with a message that
   reflects the real model ("this profile is ready — assign it to people").
3. **Save path**: keep the ceiling check for role-bound profiles; for standalone
   profiles, warn at save time using the capabilities' features instead of skipping the
   check silently.
4. **Assignment**: make manual assignment the primary path on the person's screen
   (it already works — it just isn't presented as the main road).
5. **Role defaults**: demote in the UI to "optional fallback for everyone with this
   role" — a convenience, never a prerequisite.
6. **Role dropdown**: consume `extraRoles` so `program_manager`, `teacher`, `mentor`
   become re-bindable.

## 10. Safe deletion (Q10)

**Required rule:**

```
Super Admin requests delete
        ↓
assigned to nobody?  →  allow
assigned to ≥1 person? →  BLOCK + "N people still use this profile, remove it first"
```

**Current behaviour** (`src/app/api/access-profiles/route.js:363-417`) — inverted:

| Check | Line | Behaviour |
|---|---|---|
| Role defaults | `:384-393` | ❌ **blocks** |
| Assigned people | `:395-396` | ⚠️ only **counts** them |
| Delete | `:402` | ⚠️ **proceeds anyway**, audit note reads `with N users still assigned` |

And `contacts.access_profile_id` is `REFERENCES access_profiles(id) ON DELETE SET NULL`
(`src/migrations/access_profiles.sql:46`) — so deleting an in-use profile **silently
drops those people to their role default**, with no message and no error.

**Implemented (defect #2).** The three refusals now share one structured shape —
`profile_in_use_assignments` / `profile_in_use_context` / `profile_in_use_role_default` —
each carrying the counts and the names/roles involved, so the screen can explain
*why*. `countProfileUsers()` and `listProfileAssignedNames()` are scoped to live
contacts, matching the displayed impact number exactly, and
getProfileImpactCounts() reports `contextBindings` separately from people.

## 11. Proposed single source of truth (Q11)

| Concept | Single source | Everything else becomes |
|---|---|---|
| A profile and its capabilities | `access_profiles` + `access_profile_capabilities` | read-only consumers |
| Who has which profile | **`contacts.access_profile_id`** (individual) with `role_access_profile_defaults` as a declared, labelled fallback | — |
| What a class of person may reach | `feature_eligibility` — **kept separate on purpose** | ceiling, never a grant |
| Additional per-person capabilities | `user_capabilities` (additive) | — |
| Blocking | `user_capability_restrictions` | — |

**Explicitly not merged:** eligibility (ceiling) and capabilities (grant). Merging them
would make `define once → read everywhere` false in the other direction — every grant
would silently raise its own ceiling.

**Deprecate:** `role_capabilities`. It is the biggest hidden divergence — staff's real
28 capabilities are invisible on the Templates screen. Every role must have a default
profile before it can be retired.

**Decide:** `contact_roles.access_profile_id` — retire the column, or make it the
context-scoped assignment. Do not leave it dead.

## 12. Exact inventory (Q12)

**Tables:** `access_profiles`, `access_profile_capabilities`,
`role_access_profile_defaults`, `context_role_profiles`, `role_capabilities`,
`feature_eligibility`, `user_capabilities`, `user_capability_restrictions`,
`group_capabilities`, `responsibilities`, `user_responsibilities`, `contact_roles`,
`contacts.access_profile_id`, `v2_program_staff.access_profile_id`.

**Models (`src/models/authorization/`):** `resolver.js`, `eligibility.js`,
`eligibility-admin.js`, `eligibility-defaults.js`, `index.js`, `backfill.js`,
`contextRoleProfiles.js`, `contextGrants.js`, `programAssignmentBackfill.js`,
`programScopeReadiness.js`, `context.js`, `authorization.js` (`getProfileImpactCounts`
`:762`, `countProfileUsers` `:269`, `deleteAccessProfile` `:285`).

**Routes:** `/api/access-profiles` (GET/POST/PUT/**DELETE**),
`/api/access-profiles/assign`, `/api/access-profiles/role-defaults`,
`/api/engineering/permissions` (+ `/eligibility`, `/impact`, `/context-roles`,
`/seed`, `/seed-access-profiles`).

**Components:** `PermissionCenter.js` (the whole Profiles screen; the coupling is
`:1741-1757`), `matrixHelpers.js:253-259`, `profileBadges.js`, `EntitlementRollup.js`,
`IndividualAccessScreen.js`, `PeopleView.js`, `CatalogView.js`,
`src/app/admin/access/page.js` (per-person summary), `PermissionShell.js`,
`permissionNav.js`.

**Locales (both `en` + `fr`):** retired `profileNoRolesHint` + `profileNoRolesEmpty`
(they told the admin to bind a role first — the copy *was* the defect); added
`profileStandaloneHint`, `profileNoConfigurableFeatures`, `impactContextBindings`,
`deleteProfile*`, `deleteBlocked*`, `assignImpactTitle`, `assign*Confirm`,
`assignLossHint`, `assignLossMore`, `assignCancelled`.
A parity test (`access-profile-cleanup-ui.test.js`) fails if a key is missing from
either locale or if the French text is identical to the English.

**Guardrails that must not regress:** boot seeds `seedDefaultAccessProfiles()` and
`ensureRetiredRoleCleanup()` (`src/lib/auth.js`, `backfill.js`) — they can re-create
rows after a manual cleanup.

## 13. Database changes (Q13)

**None required for the core fix.** §1 (editor) and §2 (delete guard) are code-only.

Optional / later, each needing its own approval:

| Change | Why | Risk |
|---|---|---|
| Extend `getProfileImpactCounts` to count `context_role_profiles` holders | The count currently under-reports | Read-only, low |
| Retire `contact_roles.access_profile_id` | Dead column | Low, after confirming 0 non-null |
| Backfill a default profile for `staff`, `member`, `facilitator`, `team` | Prerequisite to retiring `role_capabilities` | **HIGH** — binding a thin profile to `staff` would strip the 28 legacy caps from *every* staff user |
| Drop `role_capabilities` | True single source | **HIGH** — do last, only after the backfill above is verified |
| Drop `_bak_*` backup tables | Tidy | Medium — confirm the migration is settled first |

## 14. Risks & migration considerations (Q14)

1. **Decoupling the editor from eligibility can let an admin build an unusable
   profile.** A standalone profile whose features the target role is not eligible for
   will be *refused at assignment time* (`assign/route.js:64-68`). Mitigation: warn in
   the editor with the computed list of roles the profile is assignable to.
2. **The `staff` foot-gun.** `staff` has no profile default today, so staff access comes
   from `role_capabilities`. Binding *any* profile to `staff` switches all staff users
   onto it. Never use a role default to reach one person.
3. **Silent permission loss on delete** — fixed in §10: the delete is now refused while
   anything references the profile, on both the assigned-people and context paths.
4. **Production ↔ staging divergence.** `migrations/sync_permission_config_from_staging.sql`
   binds `staff → Staff Default`, but **production has no such row**. One of the two is
   not the intended truth — confirm before treating either as authoritative. The same
   file maps `investor → Mentor`, while other references expect `Investor Access`.
5. **Backups present** (`_bak_20260916_*`) — evidence a bulk permission rewrite already
   happened. Do not drop without confirming the rewrite is settled.
6. **`ventures.id` is `integer` on production, `uuid` on staging** — a standing,
   unrelated divergence; keep it out of this change.
7. **i18n:** every new or changed string needs keys in both `en/` and `fr/`.
8. **Scope discipline:** `venture_permission_matrix`, `venture_responsibilities`,
   `startup_profile_*` are separate domains — leave them alone.

---

## Appendix — measured on production, 2026-09-24

```
access_profiles                    15
access_profile_capabilities       239
role_access_profile_defaults        7
role_capabilities                 107
feature_eligibility                53   (all identity_type = 'role'; 0 group rows)
context_role_profiles               7   (1 with NULL profile: program/facilitator)
user_capabilities                  12   (9 manual, 3 context-seeded — the 3 expired)
user_capability_restrictions        2
group_capabilities                  0
responsibilities                   12
user_responsibilities               1
contacts                          580   (1 with a profile override → Josias Hinnakou, role staff)
contact_roles                       5   (0 with access_profile_id)
```

### Blast radius — who a change can actually reach

| How people resolve their access | People |
|---|---|
| Role default profile | **565** |
| Legacy `role_capabilities` fallback | **13** |
| Individual profile override | **1** |

Of the 13 on the legacy path, only **3 staff** actually receive anything from
`role_capabilities` — `facilitator` (5), `member` (2), `applicant` (2) and
`intern` (1) have **no rows at all** in that table, so they receive nothing.

Consequences:

- **The single riskiest action is binding a profile to the `staff` role** — it flips
  all 4 staff off `role_capabilities` at once. Reach one person with an individual
  assignment instead.
- **`Participant Default` reaches 563 people** — the largest lever in the system.
- **The `Program Manager` profile (44 capabilities) reaches exactly 1 person.**
- Only **2 accounts** (`super_admin`) can open the Permission Center at all, so every
  phases 1–3b change is visible to 2 people and changes access for **nobody**.

Profiles with no role binding **and** no assignee — 9:
`Program Manager (Portfolio)` (13 caps), `Assigned Program Manager` (3),
`Dev Interns` (0), `Staff Default` (35), `Operations Manager` (15), `Project Owner` (10),
`Investor Access` (7), `Finance Assistant` (4), `learner` (0).

> Note: `Assigned Program Manager` **is** reachable via
> `context_role_profiles` → `program/program_manager`, yet the impact count reports 0.
> That is defect #3 in §0.

---

## Recommended phasing

| Phase | Work | Size | DB change | Status |
|---|---|---|---|---|
| **1** | Decouple the editor + fix the copy | Small, UI-only | None | ✅ **done** |
| **2** | Fix the delete guard + report context bindings | Small | None | ✅ **done** |
| **3** | Consume `extraRoles` in the role dropdown | Small | None | ✅ **done** |
| **3b** | Capability-loss guard on assignment (§4b) | Small | None | ✅ **done** |
| **4** | Give `staff`/`member`/`facilitator`/`team` explicit default profiles, then retire `role_capabilities` | Medium | **Yes — high risk** | not started |
| **5** | Decide: profile-scoped eligibility, and/or multiple profiles per person | Large — needs an ADR | **Yes** | not started |

Phases 1–3b deliver the workflow you described (create → configure → assign to one
person, role unchanged) with **no database change and no effect on any user's
existing access**. Verification for the completed phases:

- `npx jest` — 164 suites / 2136 tests passing (30 of them new contracts)
- `npm run lint` — 0 errors (4 pre-existing warnings in `src/lib/hooks/useApi.js`)
- `npm run build` — clean

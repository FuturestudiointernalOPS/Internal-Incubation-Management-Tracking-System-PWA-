# ImpactOS — Phase 3 Brief (Retired-LMS Governance)

Status: inventory + freeze contract committed. Canonical mapping below awaits
Product ratification (Decision 5 gate) — no enforcement changes made.

## Inventory (scan + contract-locked)

6 enforcement sites across 5 files still guard on retired capabilities;
**0 grant sources** write them (retirement backfill + scan + jest freeze all
enforce "no new grants"):

| # | Site | Handler | Retired cap |
|---|---|---|---|
| 1 | `api/lms/courses/[id]/enrollments/route.js` | GET (course learner roster) | `lms.enroll` |
| 2 | `api/lms/enrollments/route.js` | POST (admin enroll learner by cid/email) | `lms.enroll` |
| 3 | `api/lms/courses/[id]/publish/route.js` | POST (publish/unpublish course) | `lms.publish` |
| 4 | `api/lms/program-requirements/route.js` | POST/DELETE (course↔program requirements) | `lms.assign` |
| 5–6 | `api/lms/program-requirements/[id]/route.js` | PATCH + DELETE | `lms.assign` |

Tooling: `scripts/phase3-lms-retired-scan.mjs` (inventory, exits 1 on new
grants) · `src/__tests__/phase3-retired-lms.test.js` (freeze — fails loudly if
a site migrates or a grant appears without updating this contract).

## Canonical mapping — PRODUCT RATIFICATION REQUIRED

The catalog's live LMS capabilities are `view / create / edit / delete`.
Two mapping philosophies:

**Option A (recommended — no catalog change, smallest surface):**
| Retired cap site | Canonical gate |
|---|---|
| Course learner roster GET (#1) | `lms.edit` (roster is course management) |
| Admin enroll POST (#2) | `lms.edit` |
| Publish POST (#3) | `lms.edit` (course lifecycle) |
| Program-requirements ×3 (#4–6) | `lms.edit` |

Holds for every current holder today: PM is the default non-SA holder of LMS
capabilities; SA/staff pass via their own grants. Consequence: anyone who can
`lms.edit` a course can roster/publish/assign — acceptable for MVP but coarse
(loses the retired caps' granularity, which is why they were retired: legacy
role-based grants).

**Option B — add canonical fine-grained caps to the catalog:**
`lms.manage_learners` (rosters + enrollments), `lms.publish_course` (lifecycle),
`lms.assign_requirements` (program requirements) — then migrate each site to
its cap, seed profiles, and only then delete the retired entries (Phase 6).
More accurate governance; more work (catalog + seeds + Permission-Center
displays + migration).

**Option C — leave retired gates in place** until Phase 6 removes them
entirely (no canonical replacement). Simplest now; the sites keep a
governance gap (retired caps can only be held by legacy holders, so NEW
staff/PMs created after the retirement backfill can never enroll/publish —
a functional gap that grows with time).

## Recommendation

**A now, with a note for B:** migrate the six sites to `lms.edit` in the same
phase-gate style as the watchlist (each site = contract-locked commit), which
removes the growing functional gap immediately; revisit B if fine-grained
LMS governance becomes a product requirement (it belongs with the
Permission-Center catalog work in Phase 3/4 UI).

## Stop condition

No enforcement changes made yet. Proceed with A, B, or C on your word.

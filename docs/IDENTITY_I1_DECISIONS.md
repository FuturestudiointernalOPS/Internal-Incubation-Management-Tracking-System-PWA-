# ImpactOS — Phase I1 Decision Brief (Identity/Context Correction)

Status: awaiting Product decisions. No implementation before these are answered.

## Context

ImpactOS moves to **three global baseline identities** (Super Admin · Staff ·
Member). Everything else (Participant, Founder, Investor, Facilitator, Coach,
Learner, Program Manager, Developer, Teacher, Team…) becomes a contextual
membership/role/profile. Phase I1 froze the current reality (see
`IDENTITY_CONTEXT_MIGRATION.md` and `identity-role-writes.test.js` — 6 known
`contacts.role` mutation sites, 2 of them already baseline-guarded).

## Decisions required (recommendation in italics)

### D1 — Teacher
The `teacher` role string is referenced in ~78 route files, has
`role_capabilities` rows and its own nav mask, but **no user holds it on
staging** (contacts.role values: participant/member/staff/founder/super_admin/
facilitator). It behaves like a program-teaching context.
*Option A (recommended):* treat Teacher as a **contextual Program staff role**
(teacher = staff/member + program staff row with role 'teacher'), retire the
global role string in phases I4–I6.
*Option B:* retire Teacher entirely and use Facilitator/Coach vocabulary only.
*Option C:* keep Teacher global for now (carries the conflation forward).

### D2 — External Program Managers
Can a person whose baseline is **Member** (not Staff) manage a Program?
*Option A (recommended):* Staff-only for MVP — Program Manager is a Staff
responsibility; external Members may hold program roles (facilitator/coach)
but not the PM assignment. Simple, matches "PM = internal operator" intent.
*Option B:* allow Member + PM when explicitly assigned (business rule per
program). More flexible, needs an eligibility rule + PM profile for Members.

### D3 — Existing contextual role values in `contacts.role`
Real accounts already carry `participant`/`founder`/`facilitator`/`investor`
as their role value (staging: participant ×5, founder ×1, facilitator ×1).
When we stop mutating the column (I2):
*Option A (recommended):* keep existing values as **read-only legacy hints**
for the MVP transition; the baseline is *derived* (participant/founder/
facilitator/investor ⇒ baseline member) until surfaces migrate; backfill to
`member` only at I6 after zero-dependency proof.
*Option B:* immediate backfill to `member` + rely fully on membership rows
(faster cleanliness, higher regression risk in this MVP window).
*Option C:* per-person manual review (small N, but slows the correction).

### D4 — Founder/investor "owner" marker
Founder and investor rows already exist in membership/context tables
(`venture_members.is_owner`; investor relations tables). Confirm these tables
are the canonical context source and `contacts.role` stops being the marker.
*Recommended:* yes — approve D3A so the column is not erased, just no longer
authoritative.

## Gate

I2 begins only after D1–D3 are answered. Answers default to **A** if none
given, but explicit confirmation is preferred.

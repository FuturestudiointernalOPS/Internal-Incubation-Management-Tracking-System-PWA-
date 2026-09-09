# ImpactOS — Phase I6D Brief (Legacy Cleanup + Closing Report)

Status: executed on staging. 7 rows reclassified, 0 contextual roles remain,
memberships untouched, acceptance matrix re-green. Rollback-ready.

## Part 1 — Backfill (executed)

`scripts/i6d-legacy-backfill.mjs` (inventory → before-image → apply → verify;
rollback SQL written to `scratch/` before every write):

| Step | Result |
|---|---|
| Inventory | 7 candidates: participant ×5, founder ×1, facilitator ×1 (matches the I1 evidence set) |
| Before-image | `scratch/i6d-before-2026-09-09-13-34-02.json` (full rows) |
| Rollback file | `scratch/i6d-rollback-2026-09-09-13-34-02.sql` (per-row UPDATEs restoring original roles) |
| Applied | 7 rows → `member`; **remaining contextual roles: 0** ✅ |
| Membership integrity | Every backfilled contact keeps its rows — participant_programs, v2_program_staff (the facilitator has staff=1), venture_members (the founder has ventures=1) |
| Derivation check | Each contact's derived legacy role resolves correctly (participant ×5, founder ×1, member ×1 for the soft-deleted pending row) |
| Post-backfill matrix | `i6c-acceptance-matrix --cleanup` → **15/15 passed**, synthetic fixtures removed |

Only the `role` column changed; nothing was deleted. Super Admin/Staff/baseline
rows untouched (tool refuses staff-family roles by design).

## Part 2 — Flag recommendation

| Flag | Recommendation | Rationale |
|---|---|---|
| `IDENTITY_STOP_ROLE_MUTATION` | **Default ON (staging now)** | Context joins no longer have any authorization dependency on the stored role write (I6C scan: 0 unexplained gates). All join flows write membership rows. |
| `IDENTITY_DERIVE_LEGACY_ROLE` | **ON on staging**, keep required until the watchlist migrates | The still-watchlisted legacy lists (contacts directory, teacher area, teams, upload, PM-teams…) read `session.role`; derivation keeps those surfaces working for the reclassified accounts until each list is converted with its own downstream gate (governance backlog). |

Ops action (staging host env, not in repo): set both flags to `1`, then ask the
7 affected users to re-login (existing sessions keep their old role copy until
expiry). Retirement of the flag plumbing itself belongs to the governance phase
that migrates the watchlist.

## Part 3 — Final status of the identity correction program

| Mini-phase | Deliverable | State |
|---|---|---|
| I1 freeze | mutation-site inventory tests + decision briefs | ✅ |
| I2 stop the erasing | mutation-stop + legacy derivation (flag-gated) | ✅ |
| I3 context surfaces | `/api/workspaces` fidelity, baseline chip, learner/venture contexts | ✅ |
| I4 active-context nav | switcher hat detection, single surface map | ✅ |
| I5 facilitator bridge | 5 handlers → assignment gates | ✅ |
| I6A venture/investor bridge | 4 handlers → membership gates; 19-file deferral watchlist | ✅ |
| I6B PM console + hardening | pm/* bridged (model scope membership-keyed), own-scope on attendance/submissions GET | ✅ |
| I6C proof | 0 unexplained role gates (scan) + Sarah matrix 15/15 on staging | ✅ |
| **I6D cleanup** | **7 legacy rows → member; staging matches the 3-baseline model** | ✅ |

**Staging now matches the architecture:** every `contacts.role` is one of
super_admin / staff / member. Multi-context users (e.g. the former founder and
facilitator accounts) keep their surfaces through membership rows + derivation.

## Remaining work (out of this program's scope — governance backlog)

1. Watchlist migration (20 deferred lists): each needs its documented downstream
   gate built first (recipes in the I6A/I6B briefs) — Permission-Center
   governance phases.
2. New defect queue from 6A analysis: unauthenticated `platform/ai` GETs,
   `ventures/[id]/history` unbound `db` (500 for staff/PM/teacher), `teams` GET
   own-team enforcement, `contacts` GET cidFilter, teacher-report identity
   derivation, v2/teacher full-state cid binding.
3. Investor capability eligibility must become context-aware before
   member-baseline investors can use investor OS writes.
4. PM-console `pm/teams` GET scoping; `submissions` POST membership rework.
5. Product confirmation recorded: developer roster-mutation delta (6A),
   teacher-as-program-staff (D1A), PM Staff-only (D2A).

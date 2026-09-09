# ImpactOS — Phase I5 Brief (Legacy Facilitator-Gate Bridge)

Status: implemented, staging-safe, flag-free (server-side enforcement alignment,
no behavior regression for today's holders). Committed per phase-gate.

## What I5 did

The facilitator surface's security decision was already the **program assignment**
(`requireAssignmentAccess` → `v2_program_staff`/`contact_roles` + capability +
team scope). The raw `requireAuth([...roles])` pre-filter in front of it was a
legacy second gate that denied the multi-context user the model is built for:
a **Member** (baseline) who holds a facilitator assignment could never reach the
assignment gate because their session role (`member`) was not in the list.

Conversion rule applied per handler:

```text
requireAuth([staff, super_admin, program_manager, teacher, facilitator])
        ↓
requireAuth()                          ← authentication only
        ↓
(downstream) requireAssignmentAccess / hasProgramManagementAccess
        ↓                             ← unchanged, still the security decision
```

Every handler converted this way is one where the downstream code already runs
the assignment/capability/scope chain for **every non-management session** — so
today's holders (staff/PM/teacher/SA via bypass or capability, role-facilitators
via assignment) keep exactly the access they had, and unassigned sessions stay
denied at the same gate they were denied at before.

## Converted handlers (bare requireAuth + assignment gate)

| Route file | Handler | Why safe |
|---|---|---|
| `api/attendance/route.js` | POST | Every non-management session already passed `requireAssignmentAccess(attendance.record)` + team scope; body carries `program_id`. |
| `api/facilitator-reviews/route.js` | GET | Non-management sessions already read own-only (`onlyOwn`), management bypasses via `hasProgramManagementAccess`. |
| `api/facilitator-reviews/route.js` | POST | Non-management sessions already passed `requireAssignmentAccess(program_id)` before creating a review. |
| `api/participants/route.js` | GET | `program_id` absent → empty payload; present → management/capability pass, everyone else assignment (`participants.view`) + team scope. |
| `api/submissions/route.js` | PATCH | Program resolved server-side from the submission row, then assignment (`assignments.grade`) + team-scope check for every non-management session. |

Already-converted precedent (I5 keeps the same pattern): `api/sessions`,
`api/followups` (no role pre-filter at all).

## Deliberately deferred (documented in contract test)

| Route file | Handler | Why deferred |
|---|---|---|
| `api/attendance/route.js` | GET | Participant/team/staff reads keyed on role with no program context — unscoped model read for listed roles. Converting requires model-level own-scope enforcement (hardening phase). |
| `api/submissions/route.js` | POST | Participant/team **self-service** submit — role list doubles as the eligibility rule; needs membership-equivalent check first. |
| `api/submissions/route.js` | GET | Legacy-trust read (role = scope). Needs model-level scoping before the pre-filter can go. |
| `api/facilitator-reviews/route.js` | PUT | Global-only list `[SA, PM, staff]` — no contextual roles; untouched by the correction. |
| `api/participants/route.js` | POST | Global-only list `[staff, SA]` — untouched. |
| `api/pm/full-state`, `api/pm/programs` | — | PM console allowlists still include `facilitator`/`teacher` (legacy over-grant toward the PM console). **Needs a product decision** before change: should program staff see PM console state? Until then, listed on the backlog watchlist. |

## What can break / regression protection

- **Broader surface for members?** Only members who hold a real program
  assignment (verified against `v2_program_staff`/`contact_roles` for the exact
  program in the request) gain access — the same access role-facilitators had.
- **Staff/PM/teacher/SA access changes?** No — management bypass list and
  capability paths are untouched; staff access still flows through capabilities
  where it did.
- **Contract lock:** `identity-gate-bridge.test.js` scans the four files and
  fails if a converted handler regrows a role list, a deferred list disappears
  without updating the contract, or the completed pattern (`sessions`,
  `followups`) regresses. Full suite green; lint 0 errors on touched files.

## Backlog (next phases)

1. Attendance GET + submissions GET/POST: add model-level own-scope enforcement,
   then drop the role pre-filters (hardening work — separate phase).
2. PM console allowlists (`pm/*`): product decision on program-staff visibility.
3. Remaining contextual-role allowlists outside the facilitator surface
   (founder/investor/team/teacher routes) — same bridge pattern per context
   type, with the Permission-Center governance backlog.

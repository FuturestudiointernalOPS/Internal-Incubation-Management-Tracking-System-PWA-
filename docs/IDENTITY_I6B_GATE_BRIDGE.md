# ImpactOS — Phase I6B Brief (PM Console Alignment + Trust-Read Hardening)

Status: implemented, staging-safe. Committed per mini-phase gate.

## Part 1 — PM console alignment (default-A: PM console = Staff-operated)

Analysis showed the `/api/pm/*` endpoints are **legitimately consumed by the
facilitator console** (`pm/programs?my_facilitator=1`, `pm/full-state?id=`),
so "remove facilitator from pm/*" would have broken the facilitator surface.
The correct move was the bridge — with one product note:

| File | Change | Downstream decision (unchanged) |
|---|---|---|
| `api/pm/full-state` GET | role list → bare `requireAuth()` | Already gated for every non-management session: assigned PM of the program OR `requireProgramFacilitator` (program assignment). |
| `api/pm/programs` GET | role list → bare `requireAuth()` | Model now scopes **every non-management, non-staff session** to its own `v2_program_staff` facilitator assignments (was: role-keyed on `role === "facilitator"` only). Unassigned sessions get an empty list. |
| `api/pm/programs` PUT | role list → bare `requireAuth()` | `requireAuthorization("programs","edit")` below was already the decision (its comment said so). |
| `api/pm/programs` POST / DELETE | untouched | Global-only / capability-only. |
| `api/pm/teams` GET | **deferred** (watchlist) | Still lists `teacher`; teams of any program with no scoping; consumer is PM-page only. Needs program-context scoping before conversion. |

**Result:** a baseline Member holding a facilitator assignment now gets their
own "my programs" console list and program workspace — the multi-context
facilitator story works end-to-end. Teacher is removed from the two converted
lists implicitly (no list left); `pm/teams` keeps teacher until scoped.

## Part 2 — Hardening the legacy-trust reads (own-scope, server-enforced)

Both endpoints previously let listed roles read by **client-chosen ids** with no
program context (role = scope). New shape:

| File | Change | New server-side rules |
|---|---|---|
| `api/attendance` GET | role list → bare `requireAuth()` | With `program_id`: assignment (`attendance.view`) + team scope (unchanged, now also admits member+assignment). Without `program_id`: non-management/non-staff sessions get `participant_id` **forced to `session.cid`** (own rows only). |
| `api/submissions` GET | role list → bare `requireAuth()` | With `program_id`: assignment (`assignments.view`) + team scope for non-management/non-staff/**non-team** sessions (was: role-keyed on `facilitator` only — participant over-read closed, member+assignment admitted). Without `program_id`: same sessions get `participant_id` forced to `session.cid`. Staff/management/team-entity reads unchanged. |
| `api/submissions` POST | **deferred** | Participant/team self-service + staff/PM **on-behalf** create flows share the list; bridging needs membership validation rework (watchlist). |

Consumers verified before hardening: every attendance GET caller passes
`program_id`; submissions GET callers are facilitator/PM pages (program_id or
management) and the team entity page (team_id + program_id) — none hit the new
own-scope fallback paths, so no UI regression is expected. Participants never
GET submissions (they POST through ProgramDetail); participant attendance GET
calls were not found in any page (the participant list entry was vestigial).

## Deliberate deltas (documented)

1. `pm/programs` PUT now lets any session holding `programs.edit` through
   (e.g. developer with the capability) — previously the role list pre-denied.
   Consistent with the capability's own comment; no developer on staging.
2. `pm/programs` GET: participant/team sessions reaching the endpoint get an
   empty list unless they hold a facilitator assignment (previously denied
   outright at the role gate). No data exposure.
3. `submissions` GET: participant sessions with `program_id` are now denied
   unless assigned (previously: unscoped read with caller-chosen
   `participant_id` — the over-read this hardening closes). No live consumer
   found for that path.
4. `attendance` GET / `submissions` GET: unassigned members/participants
   without `program_id` can only read their own rows (attendance: typically
   none; submissions: their own).

## What was NOT changed

- No resolver change, no DB change, no production, no flag flip.
- `pm/teams` GET, `submissions` POST, attendance POST logic, all I6A
  deferrals — contract-locked in `identity-gate-bridge.test.js`.

## Validation

- Contract suite updated: attendance/submissions/pm converts locked (bare
  counts, machinery presence, own-scope markers); pm/* facilitator/teacher
  lists locked-out; watchlist extended (pm/teams, submissions POST).
- Full suite 871/871 green; eslint 0 errors on touched files.

## Backlog note (next hardening candidates, from 6A defect log)

platform/ai unauth GETs · ventures/[id]/history unbound `db` · teams GET
own-team scope · contacts GET cidFilter · teacher-reports session-derived
identity · v2/teacher/full-state cid binding.

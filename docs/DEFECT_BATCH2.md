# ImpactOS — Defect Queue Batch 2 (teacher-identity binding)

Status: implemented, lint/suite green, staging-safe (no data changes).

## Fixes

| # | File | Defect | Fix |
|---|---|---|---|
| 1 | `api/teacher/reports/route.js` GET+POST (V1) | POST trusted **client-supplied** `teacher_id`/`teacher_name` — any listed role could file weekly reports as any teacher; GET returned **every teacher's reports** for a program/week | Teacher-role sessions: POST identity **derived from the session** (body values ignored); GET filtered to own reports. Staff/SA keep the internal full view + on-behalf entry. |
| 2 | `api/v2/teacher/reports/route.js` GET+POST (V2 shim) | Same two defects | Same fix. |
| 3 | `api/v2/teacher/full-state/route.js` GET | Caller-chosen `cid` — any listed role could load **any teacher's workspace** (programs, teams, pending submissions, sessions) | Teacher sessions: `cid` **bound to `session.cid`** (param ignored). SA keeps cross-teacher inspection for admin review. |

Notes:

- **No live consumers** were found for any of the three endpoints (the /teacher
  area now only contains reviews + sessions pages), so the bindings cannot
  break an existing UI. The V2 shim headers claim "actively used by V1 pages" —
  that claim is stale for these routes; the security fix is applied in both V1
  and V2 shims to avoid leaving a hole in either.
- The weekly-report identity convention is the contact cid (same key as the
  program's `assigned_assistant_id` and the full-state handler lookups), so
  session-cid binding is semantically correct.
- Role allowlists are untouched — the three files remain on the I6A/B
  watchlist (their conversion to membership gates is separate backlog work).

## Validation

- eslint: 0 problems on all three files.
- Full suite 871/871 green; zero-dependency scan still 0 unclassified.
- No resolver change, no DB change, no production.

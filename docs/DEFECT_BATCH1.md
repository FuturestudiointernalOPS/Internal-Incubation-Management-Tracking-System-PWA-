# ImpactOS — Defect Queue Batch 1 (from the I6A discovery log)

Status: implemented, lint/suite green, staging-safe (no data changes).

## Fixes

| # | File | Defect | Fix |
|---|---|---|---|
| 1 | `api/ventures/[id]/history/route.js` | Unbound `db` reference → **guaranteed 500** for every staff/PM/teacher request (2 pre-existing lint errors) | `import db, { initDb } from "@/lib/db"` — the venture-assignment gate now evaluates: assigned staff/PM/teacher pass, unassigned get 404 (instead of 500). Founder path stays watchlisted (allowlist-only, no membership check — documented deferral). |
| 2 | `api/platform/ai/evaluate-submission/route.js` GET | **Completely unauthenticated** — returned evaluation rows for any `submission_id` and `has_evaluation` for any `form_id` | Same gate as the POST that produces the data (`super_admin/admin/program_manager/teacher`); no UI consumer existed for the open read, so no caller breaks. |
| 3 | `api/platform/ai/analyze/route.js` GET | Health probe unauthenticated (minor — only reports whether an AI key is configured) | Requires an authenticated session, consistent with the sibling `platform/ai` GET (which already session-checked and was NOT a defect). |
| 4 | `api/teams/route.js` GET | "Own team only" existed only in comments — a team-entity session could read **any team + member emails** by passing another `team_id` | Team-role sessions are now bound server-side: `team_id` forced to `session.cid` (the entity's own `v2_teams.id`); a foreign `team_id` → 404. Staff/PM/SA unscoped reads unchanged. |
| 5 | `api/contacts/route.js` GET | `cidFilter` over-read: participant/founder sessions could fetch **any contact's full record** by cid | Participant/founder sessions may now only read their own record — a foreign `cid` param → 403; self-cid lookup preserved. Staff/teacher/PM/SA cid lookups unchanged. |

## Non-defects verified (from the 6A log)

- `platform/ai` GET: already session-checked; returns provider-health only.
- `analyze` GET health payload contains no data (now session-gated anyway).
- The remaining log items (teacher-report client-supplied identity, v2/teacher
  full-state `cid` binding, `submissions` POST membership rework, `pm/teams`
  scoping) stay queued — they are watchlist-conversion work, not isolated
  defects.

## Validation

- eslint: 0 errors on all five touched files (the two historical `db` lint
  errors are gone with fix #1).
- Full suite 871/871 green; zero-dependency scan still 0 unclassified.
- No resolver change, no DB change, no production.

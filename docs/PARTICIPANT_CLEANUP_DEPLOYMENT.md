# Participant Cleanup — Deployment & Verification Checklist

Apply in this exact order. Every step is on staging first.

## 1. Before anything: snapshot

- Take a full DB snapshot/backup before applying the schema-changing migrations
  (especially 4b submissions and 4c feedback — they widen a column type and
  drop a foreign key).

## 2. Apply the schema migrations

All migrations are combined into ONE file — run it once:

`supabase/migrations/20260819_participant_cleanup_all.sql`

It performs, in order, inside a single transaction:
1. `contact_roles` assignment columns + backfill + index
2. `v2_attendance.participant_id` -> `contacts.cid`
3. `v2_submissions.participant_id` UUID -> TEXT + backfill (FK dropped)
4. `v2_feedback.participant_id` UUID -> TEXT + backfill (FK dropped)
5. `participant_programs.screening_status`

The reader code changes (exports, feedback names, full-state, participant
dashboard) assume this has run. Do not deploy the code without the
migration, or exports/names will come back empty.

## 3. Verify the data

- `SELECT COUNT(*) FROM v2_attendance WHERE participant_id NOT IN (SELECT cid FROM contacts);`
  → should be 0.
- Same check for `v2_submissions` and `v2_feedback`.
- Participant dashboard shows the correct program for every form-collected
  participant.
- PM export "participants" row count matches the participants view.
- Feedback still shows participant names.

## 4. Cut over the fallback (when ready)

- Once reconciliation counts match, set
  `DISABLE_LEGACY_PARTICIPANT_FALLBACK=true` to make `participant_programs`
  strictly authoritative.
- Watch logs for missing participants; flip back if needed.

## 5. Verify the changed API contract

- `POST /api/participants` now returns `participant.id = contacts.cid`
  (previously `v2_participants.id`). Confirm no client still expects the old
  UUID.
- Team counts in `pm/export?type=teams` now come from `contacts.v2_team_id` —
  verify against real teams.

## 6. Tracked pre-existing drift (separate ticket, not part of cleanup)

- `pm/export?type=submissions` uses `vsb.requirement_id` while
  `v2_submissions` has `deliverable_id`.
- `pm/export?type=attendance` references `va.program_id`, `va.date`,
  `va.week_number` which may not exist on the dynamically-created table.
- Fix these after the cleanup is verified, using the real staging schema.

## 7. Remaining legacy reads/writes (intentionally kept — review after 30–60 days)

Reads:
- `api/group-members` (Supabase `v2_group_members → v2_participants` relation;
  group membership, separate concept).
- `api/facilitators/invite-bulk` conflict check (unions `v2_participants` —
  intentional until retirement).
- `pm/full-state` / `participant/programs` were cleaned; no fallback remains.

Writes (offline tools only, annotated):
- `scripts/fix-participant-assignment.mjs`
- `scripts/migrations/repair_group_assignments.mjs`
- `scripts/migrations/seed_demo_all.mjs`
- `api/admin/fix-participant` (diagnostic endpoint, super_admin only)

## 8. Onboarding gate

Only start onboarding participants after steps 1–5 pass.

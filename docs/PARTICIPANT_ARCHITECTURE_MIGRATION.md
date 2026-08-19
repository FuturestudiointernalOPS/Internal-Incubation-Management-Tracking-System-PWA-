# Participant Architecture Migration — Status

This note tracks the phased cleanup of the participant/program data model.
Goal: make `participant_programs` the single source of truth for
`Person -> Program` membership and move program activity off `v2_participants`.

## Completed

### Phase 1 — Participant/Program reconciliation
- Added `reconcileParticipantPrograms()` in `src/lib/contact-group-sync.js`.
- It backfills `participant_programs` from the remaining legacy sources
  (`v2_participants` and `contacts.program_id`), additively and idempotently.
- It is invoked by the existing `reconcileProgramGroups()` (which already runs
  on `contacts/full-state` self-heal).
- No readers were changed, no legacy tables/fields were removed, no data was
  deleted.

### Phase 2 — Membership source of truth
- Added `src/lib/participant-membership.js` with
  `getParticipantProgramIds()` and `isParticipantInProgram()`.
- `participant_programs` is now authoritative; the legacy sources
  (`contacts.program_id`, `contacts.group_name`, `v2_participants`) are kept
  only as a silent fallback for un-reconciled records.
- Switched these readers to the shared helper: `api/participant/home`,
  `assignments`, `programs`, `progress`, and `programs/[id]`.

### Phase 3 — Stop unnecessary legacy writes
- Removed the `v2_participants` write from `api/participants` POST,
  `api/invites/[token]` POST, and `api/pm/programs` PUT.
- Removed the `contacts.program_id`/`program_name` write from
  `api/pm/programs` PUT.
- All three now write `participant_programs` only.

### Phase 4a — Attendance normalization
- Added `supabase/migrations/20260819_normalize_attendance_participant_ids.sql`
  to normalize `v2_attendance.participant_id` to `contacts.cid` (idempotent,
  guarded). The write path already uses `contacts.cid`.

### Phase 4b — Submissions/Assignments normalization
- Added `supabase/migrations/20260819_normalize_submissions_participant_ids.sql`.
  This is a schema change: `v2_submissions.participant_id` widened UUID -> TEXT
  and its FK to `v2_participants` dropped, then backfilled to `contacts.cid`.
- Existing reader joins already tolerate `contacts.cid`, so no JS reader changes
  were required in this phase.
- Irreversible step: take a DB snapshot before applying.

### Phase 4c — Feedback normalization
- Added `supabase/migrations/20260819_normalize_feedback_participant_ids.sql`
  (same guarded schema change: UUID -> TEXT + FK drop + backfill).
- Updated `api/feedback` GET to join `contacts` instead of `v2_participants`
  for the participant name.

### Phase 4d — KPI/Progress counts
- Updated participant counts from `v2_participants` to `participant_programs` +
  active `contacts` (excluding facilitators) in:
  - `scripts/seed_kpi_progress.js`
  - `api/investor/venture-kpis`
  - `api/pm/curriculum` (send_reminder count)

### Phase 5 — Verify CRM / Forms / Email / Invitations / Automation
- Confirmed (no change needed): Forms, Email, Notifications, Login/session, and
  Groups already use `participant_programs` / `contacts.cid` (or are unrelated).
- Stopped the remaining legacy `contacts.program_id` writes on form approval in
  `automation.js` (existing-contact UPDATE and new-contact INSERT) and in
  `contact-group-sync.js` `fillGroupAndProgram`.
- `group_name` writes remain (group membership is a separate concept).

### Phase 6 — Reports and internal tools
- Repointed `api/pm/export` (participants, attendance, submissions, teams) from
  `v2_participants` to `participant_programs` + `contacts`.
- Repointed `api/contacts/full-state` PM registry from `v2_participants` to
  `participant_programs` + `contacts`.
- Deferred: `api/group-members` (group roster, uses a Supabase
  `v2_group_members`->`v2_participants` relation). Group membership is a
  separate concept and needs separate review before touching.

## Remaining (not yet done)

- Phase 7 — End-to-end testing.
- Phase 8 — Legacy retirement (review only, after 30-60 days of real usage).

## Legacy structures intentionally kept for now

- `v2_participants` — still read by several dashboards/exports and referenced
  by activity tables. It is kept read-only during migration and must NOT be
  removed until every reader and FK is repointed and verified.
- `contacts.program_id` / `contacts.group_name` — legacy membership fields.
  Kept for backward compatibility; only new writes are being stopped in later
  phases.

## Post-audit fix punch-list

Grouped into 4 phases after the dependency audit.

### Fix Phase 1 — Complete write-side consolidation (DONE)
- `api/programs` PUT: removed `contacts.program_id`/`program_name` and
  `v2_participants` writes; keeps `participant_programs`.
- `api/participants` POST: removed `contacts.program_id`/`program_name` write.
- `contact-group-sync.js` `reconcileProgramGroups`: removed `contacts.program_id`
  backfill (step 1 program_id + step 3 facilitator link).

### Fix Phase 2 — Restore data completeness (DONE)
- Added `supabase/migrations/20260819_add_screening_status_to_participant_programs.sql`
  (adds `screening_status` to `participant_programs`).
- `api/participants` POST now persists `screening_status` into
  `participant_programs`.
- `api/participants` GET and `pm/full-state` now return the real
  `screening_status` (replacing the hardcoded 'approved').
- `bio`/`cv_url` left in `v2_participants` (unused; no writer/reader).

### Fix Phase 3 — Complete read-side migration (DONE)
- `api/contacts/full-state`: primary scoped query now resolves program
  membership through `participant_programs` (kept `group_name` for group
  membership).
- `pm/full-state`: removed the dead `v2_participants` name join for submissions.
- `api/participant/programs`: submissions/attendance queries now match
  `contacts.cid` directly (removed the `v2_participants` fallback joins).
- `participant-membership.js`: legacy fallback is now gated behind
  `DISABLE_LEGACY_PARTICIPANT_FALLBACK=true` so it can be removed after
  reconciliation is verified.

### Fix Phase 4 — Deployment ordering, verification, retirement prep (DONE)
- Added `docs/PARTICIPANT_CLEANUP_DEPLOYMENT.md` with the exact apply order,
  verification queries, fallback cutover, and remaining legacy inventory.
- Annotated the offline scripts that still write `v2_participants`
  (`fix-participant-assignment.mjs`, `repair_group_assignments.mjs`,
  `seed_demo_all.mjs`, `enable_rls.mjs`).
- Pre-existing export drift (submissions `requirement_id` vs `deliverable_id`,
  attendance columns) is tracked as a separate ticket in the checklist.

## Next review

After 30–60 days of real usage, review the remaining legacy reads/writes in
`docs/PARTICIPANT_CLEANUP_DEPLOYMENT.md` section 7 and decide what to retire.

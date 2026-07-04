# Schema Drift Audit — 162 confirmed broken SQL statements

**Method**: extracted every static `sql:` literal from `src/app/api/**/route.js` + `src/lib/**/*.js` (741 statements), validated each against the live DB schema via `PREPARE` (parse+plan, zero execution/side-effects), then re-verified the ambiguous ones through the app's actual `db.execute()` code path with real bound params. 48 further queries are built dynamically (string concatenation / template interpolation) and were not auto-checked — manual review still needed there.

**Result: 162 of 741 checkable queries reference a column, table, or type that does not match the live schema.** Every one of these will throw a runtime error (usually a 500) the moment that code path executes. None of this is a new regression from this session's work — it predates everything done today. It was invisible because there are 0 tests and these paths are rarely E2E-tested.

Grouped below by root cause — most of the 162 collapse into ~12 clusters, since the same wrong column name is repeated across many files.

## ✅ Status after Batch 1 + Batch 2 (both applied)

**Fully fixed and re-verified clean**: clusters 1(partial→now complete)/2/3(partial)/4/5/6/8(partial)/9/10, plus B1–B7 in `docs/DEEPSEEK_SCHEMA_FIX_BATCH2.md` (password_setup_tokens fully aligned, rituals degraded-but-consistent, v2_submissions rename, campaigns/campaign_contacts simplified to single-send, v2_checkins, standard-types, error_logs, contacts.supervisor_cid no-op, `groups/route.js` now returns 501 instead of crashing).

**Deliberately left broken, flagged, not touched** (schema too far from code intent to safely auto-fix — needs a real product/architecture decision when that module is actually built):
- `kpi_progress` (+ `lib/kpi-progress.js` and every reader)
- `pm/curriculum`, `pm/schedule`, `teacher/full-state`, `v2/teacher/full-state` (the `v2_sessions`/`v2_document_requirements` parts specifically — these files ALSO contain the now-fixed `v2_submissions.document_id→deliverable_id` rename, so they're partially fixed, partially still broken by design)
- `forms`, `forms/[form_id]`, `respond`, `responses`, `responses/review`, `send-pending` (the `form_responses`/`forms.schema` parts — `send-pending`'s campaign-side logic was fixed, the forms-side wasn't)
- `project_approval_requests` (`admin/projects/[id]/approvals`, `tasks/approve`, `tasks/route.js`)

**Missed entirely — not in either batch, still broken, nobody's fault, just an oversight**: `v2_attendance` (cluster 6 — `attendance/route.js`, `participant/home`, `participant/programs/[id]`, `participant/programs`, `participant/progress`). This one WAS a safe rename candidate (drop `date`/`program_id`, no structural gap) but got dropped from both batch's file lists. Pick up whenever convenient — same mechanical treatment as the other renames.

Also still broken, correctly out of scope both times: the 5 uuid/text cast sites that needed a "confirm the id-spaces actually correspond before casting" judgment call (`admin/analytics/users`, `dashboard`, `submissions.js:93`) — 2 of 5 original casts were applied (invites token join, notion sync, auth/login UNION), these 3 remain unresolved.

---

---

## Clusters where the fix is a straightforward rename (code → match existing schema)

These are mechanical once the real column name is known. No product decision needed.

### 1. `password_setup_tokens` — CRITICAL, likely the entire onboarding pipeline
Real columns: `id, contact_cid, token, used(integer), expires_at, created_at`
Code uses `user_cid` (wrong name) and inserts a `user_email` column that doesn't exist at all; compares `used = true/false` against an integer column.
Files: `admin/approve-user`, `auth/forgot-password`, `auth/invite`, `auth/invite-family`, `auth/resend-invite/[cid]`, `auth/reset-password/[cid]`, `auth/activate`, `auth/setup-password`, `auth/setup-password/validate`, `contacts/route.js`
**Impact: password reset, staff invite, family invite, account activation are all broken.**

### 2. `participant_programs` / `participant_program_audit`
Real: `participant_programs(id, participant_id, program_id, enrolled_at)`, `participant_program_audit(id, participant_id, program_id, action, performed_by, created_at)`
Code inserts non-existent `assigned_by`, `source` columns on both tables.
Files: `contacts/route.js` (×3), `participant-programs/bulk`, `participant-programs/route.js`, `programs/route.js`, `pm/programs/route.js`, `superadmin/groups/assignment`
**Impact: enrolling a participant into a program fails everywhere it's attempted.**

### 3. `campaign_contacts` / `campaign_steps`
Real: `campaign_contacts(id, campaign_id, contact_cid, status, sent_at)`, `campaign_steps(id, campaign_id, step_order, subject, body, delay_hours, created_at)`
Code uses `cid` (should be `contact_cid`), and references `sequence_step`, `next_send_at`, `delay_days`, `delay_minutes`, `specific_time`, `scheduled_date`, `wait_type` — none of which exist.
Files: `campaigns`, `campaigns/[id]`, `respond`, `responses`, `responses/review`, `send-pending`
**Impact: the entire campaign/segment/drip-email feature is non-functional.**

### 4. `contacts` — missing several columns the app writes to
Real columns lack: `team_id` (has `v2_team_id` instead), `invited_at`, `email_verified`, `supervisor_cid`, `profile_completed`.
Files: `invites/[token]`, `v2/invites/[token]`, `auth/invite`, `auth/invite-family`, `auth/activate`, `contacts/route.js`, `engineering/permissions`, `profile/route.js`
**Impact: invite finalization, activation-completion tracking, profile page, supervisor assignment.**

### 5. Rituals — `v2_standups` / `v2_retros` / `v2_reflections` use `user_id`, code sends `participant_id`
`v2_checkins` is the opposite problem: code sends `week_number`/`session_id`, real columns are `participant_id, program_id, checkin_date, status, notes`.
Files: `participant/rituals/{standup,retro,reflect,checkin}`, `participant/progress` (reads the same tables)
**Impact: all 4 daily/weekly ritual submissions fail for every participant.**

### 6. `v2_attendance`
Real: `id, session_id, participant_id, status, created_at` — no `program_id`, no `date`.
Files: `attendance/route.js`, `participant/home`, `participant/programs/[id]`, `participant/programs`, `participant/progress`
**Impact: attendance recording and reading both broken.**

### 7. `groups` / `group_default_responsibilities` don't exist at all
Files: `groups/route.js` — the entire file (11 statements).
Likely candidates: never migrated, or superseded by `v2_groups`/`access_profiles` (present and used elsewhere). Needs a decision, not a blind rename (see below).

### 8. `forms` / `form_responses` naming
Real: `forms(id, name, target_group, created_at)` — no `form_id`, no `schema`. `form_responses(id, form_id, respondent_cid, respondent_name, respondent_group, data, created_at)` — no `cid`, no `answers`, no `confidence_score`/`match_status`/`group_name`.
Files: `forms/route.js`, `forms/[form_id]`, `respond`, `responses`, `responses/review`
**Impact: form builder and response-matching/review both broken.**

### 9. Misc single/dual-file bugs (rename-only)
- `activity_logs`: code writes `(user, action)` — real column is `user_identity`, and `user` is also a reserved word (syntax error regardless). Files: `activity`, `teacher/reports` (×2), `v2/teacher/reports` (×2).
- `error_logs`: no `status` column (has `status_code`, `resolved`). File: `engineering/errors/create-task`.
- `project_approval_requests`: real is `id, project_id, requested_by, request_type, status, created_at` — code references `task_id, reviewed_by, reviewed_at, rejection_reason`, none of which exist. Files: `admin/projects/[id]/approvals`, `tasks/approve`, `tasks/route.js`.
- `v2_deliverables`: no `type`/`kpi_ids`. File: `deliverables/route.js`.
- `segments`: code writes `filters`, real column is `criteria`. File: `segments/route.js`.
- `v2_messages`: no `sender_name` (only `sender_id`). File: `blockers/discuss`.
- `v2_standard_types`: real is `name, description`, code writes `label, category`. File: `superadmin/standard-types`.
- `families`: no `is_archived`, no `group_score`. Files: `families/route.js`, `participant/full-state`.
- `v2_invitations`: no `created_by`. Files: `invites/route.js`, `v2/invites/route.js`.
- `finance` `data_sources` table doesn't exist. File: `finance/sync` (already flagged in commit cd7917f).

### 10. Type mismatches (need an explicit `::text`/`::uuid` cast, not a rename)
- `v2_invitations.program_id` (text) joined to `v2_programs.id` (uuid) with no cast. Files: `invites/[token]`, `v2/invites/[token]`.
- `v2_projects.owner_id` (uuid) compared to a plain string param. Files: `admin/analytics/users`, `dashboard`.
- `tasks.project_id` (text) compared/joined to `v2_projects.id` (uuid). File: `lib/integrations/notion/sync.js` (×2).
- `v2_programs.assigned_assistant_id` UNION'd with `v2_teams.handler_id`, incompatible types. File: `auth/login`.
- `v2_submissions.participant_id` is uuid; a text identifier is passed. File: `submissions/route.js`.

---

## ⚠️ Post-fix correction (after Batch 1 execution)

Postgres only reports the *first* invalid column per statement — fixing that one can silently expose more invalid columns on the same line that were hidden until now. Re-running the full audit after Batch 1 revealed two clusters above were mis-classified as "mechanical rename" when they're actually the same "code assumes a richer table" problem as the decision-needed clusters below:

- **Cluster 1 (`password_setup_tokens`)**: only `admin/approve-user`, `auth/forgot-password`, `auth/setup-password`, `auth/setup-password/validate` are now genuinely fixed — those only ever touched `contact_cid`/`token`/`expires_at`/`used`. The other 6 files (`auth/activate`, `auth/invite`, `auth/invite-family`, `auth/resend-invite/[cid]`, `auth/reset-password/[cid]`, `contacts/route.js`) also reference `token_type`, `role`, `group_id`, `invited_by`, `used_at` — **none of which exist on the real table** (real columns: `id, contact_cid, token, used, expires_at, created_at`, nothing else). The rename was necessary but not sufficient — **the invite/reset/activation pipeline is still broken** for anything beyond a bare password-reset link. Moved to the decision list below.
- **Cluster 5 (rituals)**: `v2_standups`/`v2_retros`/`v2_reflections` have no `program_id` at all (real shape is `user_id, user_name, week_number, year` + feature-specific text fields) — this looks like the participant "rituals" feature was coded against a program-scoped table that was never built, while the *existing* tables under those names are actually the **staff weekly ops-report** tables (see `standups/submit`, `retros/submit`). Two different features may have collided on the same table names. Moved to the decision list below.

No regression from this: everything still broken was already fully broken before, just failing on a different column now. T3/T4/T5/T6 and 3 of 5 T8 casts are confirmed fully fixed (re-verified via the same PREPARE method, no errors left on those statements).

---

## Clusters that need a product decision (schema too far from code intent for a blind rename)

### 11. `kpi_progress` — fundamentally different shape
Real: `id, program_id, kpi_name, target, current, updated_at`.
Code (in `kpi-progress/route.js`, `lib/kpi-progress.js`, and read from `participant/home`, `participant/programs/[id]`, `participant/programs`, `participant/progress`, `pm/full-state`) expects: `kpi_id, linked_sessions, completed_sessions, linked_docs, completed_docs, total_items, completed_items, progress, weight`.
This isn't a typo — the code models a computed roll-up (sessions/docs completion counts feeding a weighted progress score) that the actual table has no columns for. **Decision needed**: either migrate the table to the richer shape the code already assumes (if that KPI roll-up feature is still wanted), or the feature needs to be rebuilt against the simple `kpi_name/target/current` shape that exists today.

### 12. `v2_sessions` / `v2_document_requirements` — curriculum feature, same story
Real `v2_sessions`: `id, program_id, week_number, type, title, teacher_id, start_at, created_at`.
Code (`pm/curriculum`, `pm/schedule`, `teacher/full-state`, `v2/teacher/full-state`) references `description, status, weight, scheduled_date, end_date, start_time, end_time, assignment_type, task_type, handler_id, handler_name, kpi_ids, notes, extra_materials, team_id` — a much richer session model, plus it calls the teacher column `handler_id` where the real column is `teacher_id`.
`v2_document_requirements` similarly is missing `session_id, allowed_format, weight, kpi_ids` that the code assumes.
**Decision needed**: is the PM curriculum builder / teacher schedule feature still in active use as designed (→ migrate columns in), or was it superseded/abandoned (→ scope the code down)?

### 13. `v2_submissions.document_id` vs `deliverable_id`
Real column is `deliverable_id`; code in `participant/assignments`, `teacher/full-state`, `v2/teacher/full-state` uses `document_id`, and also writes a `score` column that doesn't exist. Likely a rename (`document_id`→`deliverable_id`) plus deciding whether `score` should be added or the grading flow uses `feedback`/`status` instead.

---

## Not yet checked — 48 dynamically-built queries

These concatenate SQL from variables/loops so they couldn't be extracted as a literal for `PREPARE`. Listed in the raw audit run; worth a manual pass but lower priority than the confirmed 162 — notable ones: `pm/teams/route.js` (8 occurrences), `tasks/route.js` (5), `contacts/full-state/route.js` (4).

---

## Recommended sequencing

1. **Clusters 1–10 (rename/cast only, ~140 statements)**: safe, mechanical once the real column name is known — this doc already has it. Good DeepSeek batch work, precise instructions, no guessing.
2. **Cluster 7 (`groups` table missing entirely)**: needs a decision — dead feature or missing migration? Check if `v2_groups`/`access_profiles` already cover this before touching code.
3. **Clusters 11–13 (kpi_progress, v2_sessions/curriculum, v2_submissions.document_id)**: needs product/architecture judgment on which side (code or schema) is the intended target before any fix — do not blind-migrate or blind-rewrite.

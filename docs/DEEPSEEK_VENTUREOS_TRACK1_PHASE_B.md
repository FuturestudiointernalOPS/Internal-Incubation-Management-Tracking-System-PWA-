# Venture OS — Sprint 3, Track 1, Phase B

**Branch: `Sprint-3-Track-1`. Do NOT push to `dev` or `main`. Push only to `Sprint-3-Track-1` when done and locally tested.**

Do this AFTER Phase A is merged locally (needs `ventures` + `venture_members` tables and `src/app/api/ventures/route.js` to exist — from `docs/DEEPSEEK_VENTUREOS_TRACK1_PHASE_A.md`). Covers Tickets **1.3 (Founder Management)**, **1.4 (Team Management)**, **1.5 (Venture Dashboard)**, **1.7 (Program History)**.

## 1. Schema — already exists, no new migration needed

`venture_members` (from Phase A migration, `src/migrations/venture_os_track1_foundation.sql`) already has everything both 1.3 and 1.4 need: `member_type` ('founder' | 'team_member'), `role`, `permissions`, `invited_by`, `joined_at`, `removed_at` (soft delete). **Founders and team members are the same table with a different `member_type`** — do not create a second table for one of them.

`participant_programs` and `participant_program_audit` (`src/migrations/multi_program_support.sql`) already track which programs a contact went through and when — reuse this for Ticket 1.7, don't build a parallel history table.

## 2. Business rules in scope (quoted from spec)

- Every Venture must have at least one Founder (enforced already at creation in Phase A — this phase must not allow removing the last remaining founder).
- Team members may be added or removed by authorized users.
- Program history must remain linked to the Venture.
- Historical founder information must remain preserved.
- All interfaces must support English and French.

## 3. API

Extend `src/app/api/ventures/[id]/route.js` (created in Phase A) or add `src/app/api/ventures/[id]/members/route.js` — pick whichever keeps `route.js` files under a reasonable size, but do not duplicate the venture-ownership check logic in two files; factor it into a small helper if you split.

- `GET /api/ventures/[id]/members` — list active members (`removed_at IS NULL`), joined with `contacts` for name/email, split into `founders` (`member_type='founder'`) and `team_members` (`member_type='team_member'`) in the response shape, or return one flat array with `member_type` and let the frontend split it — either is fine, just be consistent with what the frontend in §4 expects.
- `POST /api/ventures/[id]/members` — add a member. Body: `{ contact_id, member_type, role, permissions, invited_by }`. Reject if `contact_id` already has a non-removed row for this venture (the `UNIQUE(venture_id, contact_id)` constraint will throw — catch it and return a clean 409, don't leak the raw Postgres constraint error).
- `PATCH /api/ventures/[id]/members` (or `/members/[memberId]`) — update `role`/`permissions` for an existing member, or soft-remove (`removed_at = NOW()`). **Before allowing a removal**, check: if `member_type='founder'` and this is the last non-removed founder for the venture, reject with a clear error — "every venture must have at least one founder." This is the one business rule this phase must not skip.
- Auth: only existing venture members (any type, non-removed) or `staff/super_admin` may view/manage a venture's members. A participant who isn't a member of the venture must get 403/404, not a silent empty list — same "don't trust client-supplied ids" principle as Phase A.

Ticket 1.5 — Venture Dashboard. Add `GET /api/ventures/[id]/dashboard` returning: the venture row, founder/team counts, a `progress` placeholder (if Track 2/3 tables — milestones/action items — don't exist yet on this branch, just return `null`/`0` for progress rather than inventing fake numbers; note this in your report so whoever picks up Track 2 knows where to wire real progress in), and up to 5 most recent `venture_members` rows (as an "activity" feed proxy — `joined_at` desc). Do not build a generic cross-module notifications integration for this — that's more than Ticket 1.5 asks for ("Notifications" in the ticket means surfacing anything already relevant, e.g. pending member invites, not a new notification channel).

Ticket 1.7 — Program History. Add `GET /api/ventures/[id]/history` returning:
- The venture's own `program_id` → joined `v2_programs` row (name, dates, deliverables) if set — this is "Previous Programs."
- For each current/past founder (from `venture_members` where `member_type='founder'`, including removed ones — history must show people who left too), their `participant_programs` rows joined to `v2_programs` — this is the closest existing data to "Team Formation History."
- `graduated_at` / `graduation_notes` from the venture row directly — this is "Graduation Information."
- Don't invent a `deliverables` submission model for the venture itself — `v2_programs.deliverables` (jsonb, already exists) is the program's deliverable list; just surface it, don't build a new one.

## 4. UI

Extend `src/app/participant/ventures/[id]/page.js` (from Phase A) with additional sections/tabs — do not create a second competing venture-detail page:

- **Founders tab**: list current founders (name from contacts join, role), "+ Add Founder" (search existing contacts by name/email — reuse whatever contact-search pattern already exists elsewhere, e.g. check `src/app/admin/projects/page.js`'s member-add modal for a pattern to copy rather than inventing a new one), remove button per founder (disabled/hidden if they're the last founder — the API will reject it anyway, but don't let the UI dead-end the user with no explanation; show why the button is disabled).
- **Team tab**: same list/add/remove pattern for `member_type='team_member'`.
- **Dashboard tab or section**: venture overview card, founder count, team count, current business_stage, a small "recent activity" list from `/dashboard`'s activity feed.
- **History tab or section**: program name/dates it came from, founders' program history list, graduation info if `graduated_at` is set (otherwise show nothing / a neutral "not yet graduated" state — don't show an empty error state).

Update `src/app/admin/ventures/page.js` (from Phase A) if useful, but this is optional for Phase B — the admin list view doesn't strictly need founders/dashboard/history detail, a link into the participant-facing detail page is enough for staff/admin to inspect a venture.

Reuse `useI18n()` — add new keys to `src/locales/{en,fr}/venture.json` (already created in Phase A): founders, teamMembers, addFounder, addTeamMember, remove, removeLastFounderError, dashboard, recentActivity, programHistory, previousProgram, graduationInfo, notYetGraduated, searchContacts, noFoundersYet, noTeamMembersYet.

## 5. Explicitly out of scope

- Milestones / Action Plans (that's Track 2/3's schema — Phase B just leaves a `null` placeholder for progress, doesn't build it).
- Anything under Tracks 2, 3, 4, 5.
- Changing the "last founder" rule, the `venture_members` shape, or anything from Phase A.

## 6. Self-testing checklist

- [ ] Add a founder → appears in founders list, `member_type='founder'` in DB.
- [ ] Add a team member → appears in team list, `member_type='team_member'`.
- [ ] Attempt to remove the only founder → rejected with clear error, not a 500.
- [ ] Remove a founder when 2+ exist → succeeds, `removed_at` set, row still exists (not hard-deleted).
- [ ] Removed founder still shows up in Program History's "Team Formation History" (soft-delete preserves history — verify this explicitly, it's the whole point of `removed_at` instead of `DELETE`).
- [ ] Dashboard loads with correct founder/team counts.
- [ ] History shows the originating program (if `program_id` was set at creation) and its deliverables.
- [ ] A participant who is not a member of the venture gets 403/404 from `/members`, `/dashboard`, `/history` — not data.
- [ ] English and French both render with no missing-key fallback text.
- [ ] `npm run build` passes clean.

## 7. Definition of done

Track 1 Phase B is complete when founders and team members can be added/removed (with the last-founder rule enforced), the dashboard shows a real overview, program history is surfaced from existing data, everything is bilingual, and `npm run build` is clean. Report back with exact files touched/created and the self-testing checklist results — same format as prior Module 2 reports.

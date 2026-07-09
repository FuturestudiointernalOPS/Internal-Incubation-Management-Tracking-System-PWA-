# Venture OS — Sprint 3, Track 1, Phase A

**Branch: `Sprint-3-Track-1`. Do NOT push to `dev` or `main`. Push only to `Sprint-3-Track-1` when done and locally tested.**

Covers Tickets **1.1 (Venture Creation)**, **1.2 (Venture Profile)**, **1.6 (Venture Settings)** from the Sprint 3 Venture OS spec (`docs/Sprint_3_Venture_OS_Engineering_Specification_v1_0.pdf`, pages 6-11). This is the root schema/foundation every other Sprint 3 track (Track 2-5, other developers) depends on — get the contract right, don't improvise field names beyond what's specified here.

## 0. Investigation already done — do not redo

The codebase has **no existing Venture/Startup/Founder concept** (confirmed: zero DB tables, zero API routes, only a couple of dead/mock UI fragments — `src/components/dashboard/ProfileView.js:413` "Startup Profile" card is dead code reading from a 501-stub route, and `src/app/admin/programs/[id]/groups/[groupId]/page.js` "Venture Workspace" is a non-functional mock with no backing PATCH endpoint). Three *different* existing tables (`families`, `v2_teams`, frozen `v2_groups`) each loosely resemble "a group of people," but none has founders/mission/vision/industry/stage, and grafting Venture fields onto any of them risks breaking their current live features (family shared-login, team-scoped login). Decision made: **new dedicated tables**, referencing existing entities rather than duplicating them.

## 1. Schema — already migrated, do not modify shape

`src/migrations/venture_os_track1_foundation.sql` has already been written AND applied to the dev database. Do not create a competing migration. If a column is missing for something you need, ask (surface it as a note in your final report) rather than silently altering the table.

```sql
CREATE TABLE ventures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- active | paused | graduated | archived
  description TEXT,
  mission TEXT,
  vision TEXT,
  industry TEXT,
  sector TEXT,
  business_stage TEXT NOT NULL DEFAULT 'idea', -- idea | validation | mvp | growth | scale
  website TEXT,
  social_media JSONB DEFAULT '{}',
  visibility TEXT NOT NULL DEFAULT 'private', -- private | public | invite_only
  branding JSONB DEFAULT '{}',
  language TEXT DEFAULT 'en',
  program_id UUID REFERENCES v2_programs(id),
  origin_team_id TEXT REFERENCES v2_teams(id),
  is_archived INTEGER NOT NULL DEFAULT 0,
  graduated_at TIMESTAMPTZ,
  graduation_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE venture_members (
  id SERIAL PRIMARY KEY,
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL REFERENCES contacts(cid),
  member_type TEXT NOT NULL DEFAULT 'team_member', -- founder | team_member
  role TEXT,
  permissions TEXT NOT NULL DEFAULT 'edit', -- edit | read
  invited_by TEXT REFERENCES contacts(cid),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at TIMESTAMPTZ,
  UNIQUE(venture_id, contact_id)
);
```

`venture_members` is shared ground with Phase B (founder/team roster management) — Phase A only needs to **insert the creating user as the first founder** on venture creation (business rule: every venture must have ≥1 founder). Do not build the full add/remove-member UI in this phase — that's Phase B.

## 2. Business rules in scope for this phase (quoted from spec)

- Every Venture must have at least one Founder.
- Every Venture belongs to Future Studio.
- Every Venture has one Venture Profile.
- Every Venture has one Business Stage.
- Venture status should remain configurable.
- All interfaces must support English and French.

## 3. API — use `createHandler` (see `src/lib/api/createHandler.js`), not raw try/catch

New file: `src/app/api/ventures/route.js`

- `GET` — list ventures. Query params: `program_id` (optional filter), `contact_id` (optional — ventures where this contact is a member, via join to `venture_members` where `removed_at IS NULL`). Roles allowed: `participant, staff, program_manager, super_admin, teacher, developer`. A `participant` calling without `contact_id` should only ever see ventures they're a member of — filter server-side by their own session cid, don't trust a client-supplied `contact_id` for a participant role (staff/PM/super_admin may query any contact_id or none for "all ventures").
- `POST` — create a venture. Body: `{ name, description, mission, vision, industry, sector, business_stage, website, social_media, program_id, origin_team_id, created_by }`. Only `name` required (matches Ticket 1.1 acceptance: "Venture created successfully" with minimal friction — profile fields can be filled in later via PUT, per Ticket 1.2's "Profile editable"). After insert, also insert a row into `venture_members` for `created_by` with `member_type='founder'`, `role=null`, `permissions='edit'` — this satisfies the "≥1 founder" rule at creation time. Do this as two sequential `db.execute` calls (no transaction helper exists in this codebase — confirmed convention, see any existing multi-step route like `src/app/api/tasks/carryover/route.js` if present on `dev`, otherwise just sequential awaits like `src/app/api/families/route.js`).
- `PUT` — update venture profile/settings fields (id required; only provided fields updated — partial update, same pattern as `src/app/api/projects` PUT). Covers both Ticket 1.2 (profile fields) and Ticket 1.6 (status, business_stage, visibility, branding, language) in one endpoint — don't build two separate PUT routes for what's one row.
- Activation: "Venture Activation" (Ticket 1.1) is just `status: 'active'` via the same PUT — don't build a separate `/activate` endpoint.

New file: `src/app/api/ventures/[id]/route.js`
- `GET` — single venture by id, joined with founder count / member count (`SELECT COUNT(*) FILTER (WHERE member_type='founder' AND removed_at IS NULL)` etc.) for later dashboard use, but for Phase A just return the venture row plus `founder_count`.

## 4. UI

New page: `src/app/participant/ventures/page.js` — list view (cards) of ventures the logged-in participant is a member of, "+ Create Venture" button opening a modal (name + optional description/industry/business_stage — keep the creation modal minimal per Ticket 1.1, don't cram every profile field into the creation step) that POSTs to `/api/ventures`.

New page: `src/app/participant/ventures/[id]/page.js` — Venture Profile + Settings view/edit form (mission, vision, industry, sector, business_stage select, website, social_media as a few labeled URL inputs — twitter/linkedin/instagram is enough, don't build a dynamic key-value editor). Settings section (can be the same page, a second tab/section): status select, visibility select, language select, branding (just a single "brand color" input is enough — don't build a full branding kit). Save via `PUT /api/ventures`.

Reuse `DashboardLayout` (see `src/app/participant/dashboard/page.js` for the wrapper convention) and `useI18n()` for every string — no hardcoded English.

Admin-side oversight (staff/super_admin should be able to see all ventures, not build one, mirroring how `src/app/admin/projects/page.js` lists all projects): extend the existing admin nav minimally — a new `src/app/admin/ventures/page.js` listing all ventures (name, business_stage, status, founder count, program) with a link into each. Read-mostly for Phase A; full admin edit isn't required yet.

## 5. i18n

New locale namespace file: `src/locales/en/venture.json` and `src/locales/fr/venture.json`, registered in the i18n loader the same way every other namespace file is (check `src/lib/i18n.js` or wherever the namespace list is declared — search for how `staff.json`/`admin.json` get registered and follow the identical pattern; do not invent a different loading mechanism).

Needed keys (English — mirror in French): venture.title, venture.createVenture, venture.namePlaceholder, venture.description, venture.mission, venture.vision, venture.industry, venture.sector, venture.businessStage, venture.stages.idea/validation/mvp/growth/scale, venture.website, venture.socialMedia, venture.status, venture.statuses.active/paused/graduated/archived, venture.visibility, venture.visibilityOptions.private/public/inviteOnly, venture.branding, venture.brandColor, venture.language, venture.save, venture.founders, venture.founderCount, venture.noVentures, venture.myVentures.

## 6. Explicitly out of scope for this phase (Phase B, or another track)

- Founder roster add/remove/role-change UI (Ticket 1.3) — Phase B.
- Team member add/remove UI (Ticket 1.4) — Phase B.
- Venture Dashboard aggregation (progress summary, notifications) (Ticket 1.5) — Phase B.
- Program History display (Ticket 1.7) — Phase B.
- Anything in Tracks 2-5 (Development Workspace, Execution, Documents, Coaching/KPIs) — other developers.
- Do not touch `families`, `v2_teams`, `v2_groups`, or their existing routes/pages.

## 7. Self-testing checklist (do this before reporting done)

- [ ] Create venture with only a name → succeeds, creator becomes a founder (`venture_members` row with `member_type='founder'`).
- [ ] Create venture with full profile → all fields persisted.
- [ ] Edit venture profile fields → persisted, unspecified fields untouched (partial update).
- [ ] Edit venture settings (status/business_stage/visibility/language/branding) → persisted.
- [ ] Participant role sees only their own ventures on the list page; cannot see another participant's venture by guessing an id in the URL for `GET /api/ventures/[id]` if not a member — confirm this is actually enforced server-side, not just hidden client-side.
- [ ] Admin ventures list shows all ventures across all participants.
- [ ] English and French both render with no missing-key fallback text.
- [ ] `npm run build` passes clean.

## 8. Definition of done

Track 1 Phase A is complete when a participant can create a venture, see it in their list, edit its full profile and settings, staff/admin can see all ventures read-only, everything is bilingual, and `npm run build` is clean. Report back with exact files touched/created and the self-testing checklist results — same format as prior Module 2 reports.

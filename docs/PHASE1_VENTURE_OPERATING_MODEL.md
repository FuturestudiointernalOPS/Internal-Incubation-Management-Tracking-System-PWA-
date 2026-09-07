# PHASE 1 — Venture Operating Workspace Consolidation: Blueprint & Migration Proof

> Status: **READ-ONLY BLUEPRINT — no code, schema, permission, API or UI changes were made.**
> This document is the Phase 1 deliverable of the "ImpactOS — Venture Operating Workspace Consolidation" ticket (§43, §38, §52 of the implementation brief).
> Evidence was gathered by direct code inspection of `src/app`, `src/components`, `src/lib`, `src/api` and `src/migrations`, plus runtime-verified claims where noted.

---

## 1. Purpose and Method

Phase 1 proves the architecture and migration path BEFORE any implementation. It delivers:

- A. Route map (current → target)
- B. Data map with canonical/legacy/duplicate classification
- C. Duplication report
- D. Security report
- E. Migration proposal (non-destructive)
- The 10-section report required by §52

No destructive steps are proposed inside this phase. Production behavior is unchanged.

---

## 2. Current Architecture (summary of the three surfaces)

Three experiences exist today over partially overlapping models:

1. **Super Admin / Venture Operations** — `/admin/ventures` list, Venture hub (`/admin/ventures/[id]` with 16 inline tabs + 7 quick actions), 21 sub-routes, global Venture OS admin, global permission matrix UI, manual registration page.
2. **Venture / Founder** — `/participant/ventures/[id]` with nav `Dashboard · Journey · KPIs · Investment · Profile · Team · Settings`; Journey currently shows a staff-configured milestone timeline + a secondary "work tools" card (Business Model, Discovery, Validation, PMF, legacy Milestones, Documents).
3. **Coach / Venture Support (partial)** — no dedicated Coach workspace exists yet; staff access Venture work via the staff console (`/staff/ventures`, `/staff/ventures/[id]`) showing roles, read panes, internal notes, operating plans and the Journey manager.

Capabilities already exist across Journey stages, milestones, tasks, sessions, coaches/advisors, documents, verification, investment readiness, fundraising/investors, reports, calendar feed, notifications, permissions and team/founders — but as partially overlapping modules with several competing data models.

---

## 3. Route Map (current → target)

Legend — Status: `ACTIVE` (live, used) · `DOORWAY` (hub tab that only links to a sub-route) · `LEGACY` (older model, superseded) · `DEAD` (no live consumer) · `DUAL` (competing with another model).

### 3.1 Super Admin hub (`/admin/ventures/[id]/page.js`)

| Hub tab | Purpose today | Data source | Target destination (proposal) |
|---|---|---|---|
| Overview (default) | Company details + wizard checklist + recent activity | `GET /api/ventures/[id]` payload | Profile (company identity) — activity moves to Activity |
| Dashboard | Doorway → full dashboard page | shared payload | Dashboard (operational attention view) |
| Investment | Doorway | shared payload | Investment Readiness |
| Timeline / Reports / Feedback / Sessions / Coaches / Knowledge | Doorway cards | shared payload | Timeline / Reports stay; Feedback→Reports/Sessions; Sessions→Journey/Calendar; Coaches→Journey/Team; Knowledge→Journey resources/library |
| Milestones / Tasks | Doorway cards (tiles hardcoded 0) | shared payload | Journey (milestones/tasks live inside Journey) |
| Founders | Roster summary | `venture.founders` | Team |
| Verification | Status summary | profile_progress tiles | Verification (stays distinct) |
| Activity | Internal feed w/ actor names | raw `venture_activity_log` (via shared GET) | Activity (internal audit surface, staff-only by role) |
| Profile Wizard | Progress view + link to founder wizard | `venture.history` | Founder Profile (SA keeps progress view) |
| Team Management | Summary tiles only (no CRUD) | founders payload | Team |

Quick actions today: Edit, Permissions (GLOBAL), Staff (assignments), Notes, Operating Plan, Journey.

### 3.2 Super Admin sub-routes (all `ACTIVE`)

| Route | Purpose | API | Data model | Target destination |
|---|---|---|---|---|
| `/dashboard` | Operational widget hub | `/api/ventures/[id]/dashboard` (SHARED w/ founder, role-branched) | ~16 tables | Dashboard |
| `/journey` | JourneyManagerPanel (staff config) | `…/journey` GET/POST/PATCH; `…/journey/apply-template` | `venture_journey_stages`, `venture_plan_templates(+sections)` | Journey (config surface) |
| `/operating-plan` | Staff plan engine | `…/operating-plans…`, `/api/venture-plan-templates…` | `venture_operating_plans`, `venture_plan_sections`, `venture_plan_links`, templates | Journey configuration |
| `/milestones` | Legacy milestone module | `…/milestones` | `venture_milestones` (**DUAL DDL**) | Journey |
| `/tasks` | Kanban | `…/tasks` | `venture_tasks` + comments/attachments/activity/reviews | Journey |
| `/timeline` | Gantt/Progress/Delays | `…/timeline?view=…` | milestones/tasks/deliverables/dependencies | Timeline |
| `/reports` | Execution reports + CSV | `…/reports` | `venture_milestones`, `venture_tasks`, `venture_deliverables` | Reports |
| `/analytics` | Investment KPIs + CSV | `…/analytics` | investment/fundraising/investor tables | Reports / Investment Readiness |
| `/investment` | Readiness score + run assessment | `…/investment` GET/POST | `investment_assessments`, recommendations | Investment Readiness |
| `/fundraising` | Pipeline CRUD | `…/fundraising` | `fundraising_opportunities`, stage_history, activities, notes | Investment Readiness |
| `/investors` | Matchmaking | `…/investors` | `venture_investors`, matches, match_history | Investment Readiness |
| `/feedback` | Mentor feedback analytics | `…/feedback` | `venture_mentor_feedback`, sessions/coaches analytics | Reports / Sessions |
| `/sessions` | New session model (staff) | `…/sessions` | `venture_sessions` + notes/attendance/action_items | Journey / Calendar (canonical session model) |
| `/coaches` | Coach catalog + assignments | `…/coaches` | `venture_coaches`, `venture_coach_assignments` (**wiring anomaly**, see §5) | Journey / Team |
| `/documents` | Data Room + shares/logs | `…/documents…` (+ reviews, permissions, versions) | `venture_documents`, versions, shares, access_logs, reviews, permissions | Journey resources / Documents |
| `/notes` | Internal staff memos | `…/notes` | `venture_notes` | Internal operational context (unchanged) |
| `/verification` | Compliance workflow | `…/verification…` | `venture_verifications` + items/documents/history/reviews/comments | Verification (stays distinct) |
| `/founders` | Founder roster mgmt | `…/founders…` (+ transfer-ownership, suspend/reactivate) | `venture_founders` | Team |
| `/edit` | Profile edit | `GET/PATCH /api/ventures/[id]` | `ventures` | Profile |
| `/permissions` | Staff assignments per Venture | `/api/ventures/[id]/staff-assignments` | `venture_staff_assignments` | Journey / Team (assignments) |

Global pages: `/admin/ventures` (list/approve), `/admin/ventures/admin` (Venture OS settings/features/roles/system/logs), `/admin/ventures/register` (manual intake), `/admin/ventures/permissions` (GLOBAL responsibility+matrix UI — platform-level, never moves inside a Venture).

### 3.3 Founder workspace (`/participant/ventures/[id]`)

| Section | Today | Target (unchanged from consolidation) |
|---|---|---|
| Dashboard | Status cards, Journey position, Upcoming, Venture-facing activity, notifications, progress | Dashboard (attention + calendar) |
| Journey | Staff-configured milestone timeline (expandable items) + work-tools card | Journey (full operating workspace incl. tasks/submissions/sessions per milestone) |
| KPIs | Standalone | Standalone (untouched) |
| Investment | Investment Readiness tab | Investment Readiness |
| Profile / Team / Settings | Profile w/ country+socials; merged Team; Settings (no Branding) | Unchanged |

### 3.4 Staff workspace (`/staff/ventures/[id]`)

Roles panes, milestones/tasks/sessions read panes, internal notes (`VentureNotesPanel`), OperatingPlanPanel, JourneyManagerPanel. Target: evolves into the Coach/Venture Support surface (My Ventures, attention, reviews, sessions) — no separate data model.

---

## 4. Data Map — Canonical / Legacy / Duplicate / Migration Candidate

Verified from `src/lib/ventures.js ensureVentureSchema`, `src/migrations/*.sql`, `src/lib/ventureJourneys.js`, route SQL.

| Entity (tables) | Verdict | Evidence notes | Target |
|---|---|---|---|
| `ventures` | CANONICAL | single source of Venture identity | unchanged |
| `venture_journey_stages` | CANONICAL (new) | staff-configured, ordered, never seeded; template-fed | **Spine container** |
| `venture_milestones` | **DUAL / MIGRATION CANDIDATE** | two DDLs: `016_venture_milestones.sql` (SERIAL, VNT-code key, `due_date/priority/owner_cid/assigned_members/display_order`) vs `venture_os_track2_workspace.sql` (UUID PK, `target_date/progress/status`); `ensureVentureSchema` only partially reconciles | single canonical milestone under Journey |
| `venture_deliverables` / `venture_deliverable_reviews` | LEGACY / DEAD | 016-era; lib fns exist but **no live API route** (deliverable actions = 405) | revive as canonical Submission/Deliverable model or map to task reviews |
| `venture_tasks` | CANONICAL (rich) | `milestone_id`, `parent_task_id`, assigned, due, priority, checklist, labels, template_id, requirement_type; + `venture_task_comments`, `venture_task_attachments`, `venture_task_activity`, `venture_task_reviews` | Task layer under Milestone (unchanged, bound tighter) |
| `venture_sessions` + notes/attendance/action_items | ACTIVE (admin UI) | newer staff model; **absent from founder calendar feed** | **canonical session candidate** |
| `venture_coaching_sessions` | ACTIVE (founder) + LEGACY | feeds founder calendar/dashboard; legacy advisor-keyed | bridge/migrate into canonical session model |
| `venture_coaches`, `venture_coach_assignments`, `venture_coach_activity` | ACTIVE (admin) | newer catalog model; GET returns catalog not per-Venture assignments (wiring anomaly §5) | canonical coach/support catalog |
| `venture_advisors` | LEGACY (founder) | founder advisors API + dashboard counts; contact-keyed; separate from coaches model | bridge to support model; display-only vocabulary |
| `venture_staff_assignments` | CANONICAL | responsibility + scope per Venture | unchanged; scope binds to Journey objects later |
| `venture_responsibilities`, `venture_permission_matrix`, `venture_scope_types` | CANONICAL (GLOBAL) | no per-Venture overrides; configurable names | unchanged (preserved) |
| `venture_operating_plans`, `venture_plan_sections`, `venture_plan_links` | ACTIVE (staff-only) | founders 404 | Journey configuration engine |
| `venture_plan_templates` + sections | ACTIVE | journey apply-template source (structure only) | canonical journey template source |
| `venture_playbook_templates`/stages, `venture_milestone_templates`, `venture_task_templates`, `venture_playbook_instances` | LEGACY | separate template family w/ snapshot instances | read-only legacy or migration candidate |
| `venture_notes` | ACTIVE (internal) | staff-only; 404 to founders; scope-filtered | internal context (unchanged) |
| `venture_documents`, versions, shares, access_logs, reviews, permissions | CANONICAL | shared founder/admin API; review loop exists; no per-milestone requirement model | Journey resources/deliverables (link to items) |
| `venture_verifications` + items/documents/history/reviews/comments | ACTIVE | founder-submit vs reviewer statuses | stays distinct |
| `venture_founders` vs `venture_members` | **DUAL (people)** | founders (role, ownership) vs members (team); admin roster vs founder Team tab | unify presentation under Team; preserve both tables (data safety) |
| `venture_activity_log`, `venture_history` | ACTIVE (internal) | raw rows incl. actor; GET `/api/ventures/[id]` returns them to members (**privacy gap §6**) | internal-only at API layer; Venture-facing feed separately |
| `venture_audit_logs` | ACTIVE | platform audit surface | unchanged |
| `v2_notifications` | ACTIVE | member-addressed rows + internal `'sa'` copies | unchanged; add Venture-facing email layer |
| `calendar` | DERIVED (no table) | `/calendar` merges tasks + milestones + action plans + coaching sessions + follow-ups | keep derivation; add canonical session/deadline relationships |
| `venture_kpi_definitions/assignments` | ACTIVE | auto-calc sources: interviews/milestones/tasks | unchanged (dependency guard) |
| `startup_profiles` + docs | ACTIVE | founder wizard + hub progress + verification/readiness inputs | unchanged (founder-owned) |
| Email | N/A | `lib/email.js`: Gmail (googleapis, `GMAIL_*`, sender `info@futurestudio.bj`) + Resend fallback (`RESEND_FROM_EMAIL`), provider env `EMAIL_PRIMARY_PROVIDER`/`DECISION_EMAIL_PROVIDER` | reuse for Venture-facing emails |

---

## 5. Duplication Report

### 5.1 Models
1. **Milestones — two DDLs** (016 vs track2 workspace). One canonical shape must be chosen; all consumers inventoried (reports, timeline, KPIs auto-calc, calendar, admin page, founder milestone tool, playbook snapshots).
2. **Sessions — two stacks**: `venture_sessions` (admin Sessions UI) vs `venture_coaching_sessions` (founder calendar/dashboard + legacy founder Coaching). Admin-created sessions are invisible to founders today.
3. **Coach/Support — two worlds**: `venture_coaches`+`venture_coach_assignments` (admin) vs `venture_advisors` (founder) + `venture_staff_assignments` (responsibility/scope). Vocabulary and data both diverge.
4. **People**: `venture_founders` (roster/ownership) vs `venture_members` (team) — presentation should merge (Team), tables preserved.
5. **Templates — three families**: operating-plan templates (canonical for journey), playbook/milestone/task templates + playbook instances (legacy), journey stage engine (no template yet beyond plan templates).
6. **Reviews**: task reviews (`venture_task_reviews`), document reviews (`venture_document_reviews`), verification reviews, legacy deliverable reviews (dead) — normalized review pattern needed for submissions.

### 5.2 UI
- Hub: 10 of 16 tabs are DOORWAY cards to sub-routes (duplicated chrome).
- Hub "Activity" tab and hub "Overview" sidebar both render recent activity (same rows).
- "Team Management" tab = summary tiles duplicating "Founders" tab content; no CRUD.
- Founder Journey previously held nested module chips (Business Model/Discovery/Validation/PMF/Milestones/Documents) — partially retired; legacy tools remain reachable via work-tools card until their content binds to milestones.
- Staff read panes (milestones/tasks/sessions) partially duplicate admin sub-pages.

### 5.3 APIs
- `/api/ventures/[id]/dashboard` is genuinely SHARED (founder + admin) with server-side role branching — keep, extend carefully.
- `/api/ventures/[id]/milestones` + `/tasks` + `/documents` + `/verification` + `/coaching`(legacy) shared by both surfaces — reuse.
- `…/operating-plans`, `…/notes`, `…/journey` writes are staff-instrument APIs (founder 404/read-only) — reuse.
- Deliverable actions (`create_deliverable|get_deliverables|update_deliverable…`) exist in lib but have **no route** → DEAD; candidates for the canonical submission API.
- Admin coaches GET returns global catalog (`listCoaches`) while `getVentureAssignments` is imported but never invoked → "Assigned" tab mislabeled; remove passes a `venture_coaches.id` as an `assignment_id`. Must be fixed or retired during unification.

---

## 6. Security Report

Severity: HIGH = fix before new experiences; MEDIUM = fix with consolidation; LOW = hygiene.

| # | Finding | Evidence | Severity | Fix target phase |
|---|---|---|---|---|
| S1 | `GET /api/ventures/[id]` returns raw `activity` (20 rows incl. `actor_name`) + full `history` to any Venture-access holder; founders only hide it client-side | `getVentureById` (`src/lib/ventures.js` L668–699) | HIGH | Phase 2 |
| S2 | Investment/Fundraising/Investors POST mutations gated only by `requireVentureAccess` — a Venture member can run assessments, mutate pipeline, generate matches | route files verified (no capability helper) | HIGH | Phase 2 |
| S3 | Admin analytics/reports/feedback endpoints likewise lack capability gating (read-level) | cluster route review | MEDIUM | Phase 2 |
| S4 | Task "official completion" is founder-possible; review (`add_review`) role-gated but not scope/assignment-gated; document reviewers = role-list (`REVIEWER_ROLES`) with TODO comment "scope to actual assigned advisor" | tasks route + document reviews route | MEDIUM | Phase 2 |
| S5 | Founder-visible calendar merges coaching rows with no actor leak, but internal/staff activity vs Venture-facing distinction lives only in the dashboard route allowlist — no general event-level internal/venture-facing flag | calendar + dashboard routes | MEDIUM | Phase 2/4 |
| S6 | Coach "Assigned" tab mislabels catalog as assignments (data-integrity/wiring, not a privilege leak) | coaches route | LOW | Phase 2 |
| S7 | Frontend-only hiding remnants (e.g., founder UI strips internal fields from shared payloads; module tools still reachable while hidden) | participant page | MEDIUM | Phase 2 |
| S8 | Admin hub Activity shows actor names — correct for staff, but hub payload is shared; ensure internal branch never returns to members after S1 fix | hub page | MEDIUM | Phase 2 |
| S9 | Email content/none today for Venture events; notification `'sa'` copies are the only staff stream — keep them internal | `notifyVentureFounders` | LOW | Phase 4 |

---

## 7. Gap Analysis (current vs target spine)

Target spine: `Venture → Journey → Milestone → Task → Submission → Review → Completion` + Sessions/Support + Calendar + Notifications.

| Gap | Current reality | What prevents the target |
|---|---|---|
| Journey not a spine | `venture_journey_stages` exist but link to nothing (no milestone/task/session/doc binding) | no FK/join columns; milestone/task modules run parallel |
| Milestone schema ambiguity | two DDLs | cannot safely add relationships until canonical shape chosen |
| Task↔milestone exists, milestone↔journey doesn't | tasks have `milestone_id` | journey linkage missing |
| Deliverable/Submission flow dead or split | legacy deliverables (no route) + task reviews + document reviews | no canonical submission entity under task/milestone |
| Sessions disconnected | `venture_sessions` (staff) vs `venture_coaching_sessions` (founder); neither links to journey/milestone/task | no canonical session model with relationships |
| Coach workspace absent | staff console partial; advisors legacy | no "my attention" surface |
| Calendar fragmented | derived feed; sessions not in it | canonical event model absent |
| Activity split by route only | dashboard allowlist exists; shared `GET /ventures/[id]` still raw | no general internal/venture-facing filter layer |
| Emails | providers ready; no Venture event emails | no event hooks/email templates |

---

## 8. Canonical Decisions & Migration Proposal (non-destructive)

Each decision lists the recommended option and open questions for sign-off.

### D1 — Milestone canonical schema
- **Recommendation:** canonical row = `venture_milestones` keyed on internal `ventures(id)` UUID with: `title, description, objective, start_date, target_date, status, progress, display_order, journey_stage_id (NEW FK), template_id, created/updated`. Legacy `due_date/priority/owner_cid/assigned_members` either migrated into canonical columns (`target_date`, `priority`, `owner_cid`) or carried compatibly; `priority/owner_cid` added if still consumed.
- Status vocabulary mapping: `not_started|in_progress|submitted|under_review|changes_requested|completed|blocked` (single set) — map existing values onto it; keep `progress` for founder display.
- Steps: (1) inventory consumers (reports, timeline, calendar, KPIs, playbook instances, admin page, founder tool); (2) add `journey_stage_id` + new columns as nullable; (3) dual-write/backfill; (4) switch readers; (5) keep 016 columns write-compatible until consumers retire. **No drop.**

### D2 — Session canonical model
- **Recommendation:** evolve `venture_sessions` into canonical (add `journey_stage_id`, `milestone_id`, `task_id`, `venture_support_id` (assignment), `preparation_notes`, `status` incl. rescheduled/cancelled/no_show, attendance, action items) and **switch the founder calendar/dashboard feed to it**; bridge `venture_coaching_sessions` as read-source/history (founder legacy Coaching UI migrates in Phase 3). Alternative: keep both but feed calendar from both — rejected (duplication rule).
- Open question: what happens to historical `venture_coaching_sessions` rows on founder surfaces (map by advisor→support assignment or show as history only).

### D3 — Coach/Support world
- **Recommendation:** canonical = configurable `venture_responsibilities` + `venture_staff_assignments` (responsibility+scope) + `venture_coaches` catalog for people metadata; `venture_coach_assignments` fixed or folded into `venture_staff_assignments` (assignments that carry responsibility + coach catalog id); `venture_advisors` becomes a read bridge for founder surfaces until Phase 3 migrates vocabulary.
- Fix coaches GET anomaly (return real per-Venture assignments).
- Open question: keep `venture_coaches` catalog + assignments, or collapse into contacts + `venture_staff_assignments` entirely (recommended direction: single assignment table, catalog optional for directory views).

### D4 — Journey ↔ Milestone binding
- **Recommendation:** Journey stages remain the staff-configured spine container; milestones gain `journey_stage_id` (D1). Stage detail aggregates its milestones; milestone detail aggregates tasks, sessions, documents, reviews, support. The current "journey item = expandable stage" founder view evolves to stage→milestone→task drill-down (§6/§17 of brief).
- Open question: one level (stage = item) vs two levels (stage contains milestones) — brief examples use stage→milestone; confirm.

### D5 — Deliverables/Submissions & Reviews
- **Recommendation:** canonical submission model = tasks carry `requirement_type`/`required_deliverable_type` + instructions (fields partially exist: `requirement_type`, templates); submissions = new `venture_task_submissions` (or revive `venture_deliverables` renamed) with version history; reviews reuse `venture_task_reviews` semantics (accept/reject/revision_requested) extended to submissions; document reviews remain for Data Room docs. Configure "review required" per task/milestone (data-driven), founder cannot self-approve.
- Open question: adopt `venture_deliverables` as the table (rename/repurpose) vs new table — recommendation: repurpose `venture_deliverables` (already FK to milestone in 016) to avoid a new table.

### D6 — Templates
- **Recommendation:** operating-plan templates stay canonical for Journey structure (existing apply-template); legacy playbook/milestone/task template family marked read-only legacy (used by playbook instances only); no new template system.

### D7 — Calendar/events
- **Recommendation:** no new table. Extend the derived feed with sessions (canonical D2), milestone deadlines, task deadlines, review due items; keep single event derivation consumed by Founder/Coach/SA views with role filtering. Event rows carry `context_type/context_id` + `internal|venture_facing` flag.

### D8 — Activity/privacy
- **Recommendation:** service-layer split: `GET /api/ventures/[id]` returns Venture-facing summary only; internal activity/history moves to staff-only endpoints (or role-branched field on existing route with internal fields stripped server-side for non-staff). Dashboard allowlist generalized into the event/activity service used by all founder surfaces.

### D9 — Notifications/Email
- **Recommendation:** notifications stay `v2_notifications` (+ `'sa'` internal stream untouched). Add event hooks (Phase 4) emitting Venture-facing events; email via existing `lib/email.js` providers (Gmail default `info@futurestudio.bj`, Resend fallback) with centralized config; no second abstraction.

### Migration order (all non-destructive)
1. Schema: add nullable columns/links (milestone `journey_stage_id`; sessions links; tasks submission columns). 2. Backfill from legacy where possible. 3. Feature-flag readers. 4. Ship API gates + privacy fix (S1–S4). 5. Migrate consumers surface-by-surface (admin milestones/tasks under Journey first, founder next, coach last). 6. Retire only what has zero references (dead deliverable routes, mislabeled coaches tab after rewrite). Rollback = flags off; nothing dropped.

---

## 9. API Impact

| Class | APIs |
|---|---|
| REUSE unchanged | `/ventures/[id]` (GET/PATCH base), `/journey`, `/operating-plans`, `/notes`, `/verification`, `/documents*`, `/members`, `/staff-assignments`, `/kpis`, `/investment-readiness`, `/startup-profile`, global permission APIs |
| REUSE + role-branch/trim | `/dashboard` (extend Venture-facing feed), `/milestones`, `/tasks`, `/calendar`, `/coaching`(legacy bridge), `/advisors`(bridge) |
| MODIFY (add gates) | `/investment` POST, `/fundraising` POST/PATCH, `/investors` POST, `/analytics`, `/reports`, `/feedback` — capability + scope checks (matrix action per area) |
| MODIFY (privacy) | `GET /api/ventures/[id]` internal fields to staff-only; any shared consumer of raw activity |
| CONSOLIDATE | coach/advisor APIs onto canonical assignments (D3); session APIs onto canonical model (D2); legacy coaching API becomes read bridge |
| NEW (only where justified) | submission/review endpoints under task (D5) — otherwise reuse task review APIs; Venture-facing email triggers (Phase 4) |
| DEPRECATE (after zero consumers) | deliverable dead lib actions (if not repurposed), coaches catalog-as-assigned behavior |

---

## 10. Permission Impact

- **No change to the architecture**: GLOBAL matrix (responsibility × area × action) → Venture assignment → scope → effective access.
- Preserve: unconditional Super Admin/developer/admin bypass; plain staff w/o assignment = no Venture access; Venture responsibility never grants `/admin`.
- Extension (Phase 2/3): matrix areas/actions already cover needed verbs (`view/create/edit/delete/comment/upload/review/approve/assign/schedule/manage/configure`); bind assignment **scope refs to Journey objects** (milestone/task/session) so milestone-scoped support access works; journey authoring stays `operating_plan` area (venture-wide) until item-level scope exists.
- Fix: capability-gate the previously un-gated cluster (S2/S3) using existing helpers (`hasVentureCapability`/`allowsPlanAction` pattern).

---

## 11. UI / Navigation Plan (current → target)

Ticket §32 mapping applied:

| Existing | Target |
|---|---|
| Milestones, Tasks | Journey |
| Sessions | Journey / Calendar |
| Coaches | Journey / Team (assignments) |
| Fundraising, Investors | Investment Readiness |
| Analytics | Reports / Investment Readiness |
| Feedback | Sessions / Reports |
| Operating Plan | Journey configuration |
| Founders, Team Management | Team |
| Knowledge | Journey resources / shared learning |
| Notes | Internal operational context |
| Profile Wizard | Founder Profile (SA keeps progress view) |
| Dashboard, Timeline, Reports, Verification, Activity | unchanged as distinct views |

**Target navigations:**
- Super Admin hub: Dashboard · Journey · Investment Readiness · Timeline · Reports · Verification · Activity · Profile · Team (+ global Settings areas outside the Venture).
- Founder: Dashboard · Journey · Investment Readiness · Profile · Team · Settings (KPIs preserved where it is; calendar inside Dashboard).
- Coach/Support (new): My Ventures → Venture view (responsibility/scope/attention/assigned work/reviews/sessions).
- Redirect policy: every removed doorway tab/sub-route gets a server- or client-side redirect to its target destination; deep links preserved.

---

## 12. Backward Compatibility Plan

1. All removed/merged tabs redirect; no 404s for existing bookmarks.
2. Founder routes (`/participant/ventures/[id]`, wizard) keep working through Phases 2–3; founder legacy tools remain reachable until their content binds to Journey items.
3. Shared APIs keep their response contracts during Phase 2 (additive fields only; privacy fix ships as role-branch that preserves staff payloads).
4. Playbook/instance snapshots, KPIs auto-calc sources (interviews/milestones/tasks), verification, and Forms/Runs intake remain untouched.
5. Email provider config centralized; new sends opt-in per scenario.
6. Data integrity: migration backups (JSON snapshots) taken before each schema step; feature flags allow instant rollback.

---

## 13. Implementation Sequence (Phases 2–4, after sign-off)

- **Phase 2 — Canonical Core Spine + Security Baseline:** D1–D8 schema evolution (nullable, non-destructive), canonical session/coach/milestone wiring, task→submission→review state machine, capability gates (S2/S3), privacy fix (S1), scope refs to Journey objects.
- **Phase 3 — Three Role Experiences:** Super Admin hub consolidation + Journey operating workspace; Founder Dashboard/Journey/Submission experience; new Coach/Support workspace; Team/Profile/Investment Readiness placement; redirects.
- **Phase 4 — Calendar/Events + Notifications/Email + Final Security & Acceptance:** canonical derived events across roles; Venture-facing notifications + email (existing provider abstraction); API-level authorization test suite; final nav cleanup + acceptance criteria (§49 of brief) run per role.

---

## 14. Sign-off Checklist (decisions needed before Phase 2)

1. [ ] D1 milestone canonical schema + status vocabulary (incl. treatment of legacy `due_date/priority/owner_cid`)
2. [ ] D2 canonical session model + treatment of `venture_coaching_sessions` history
3. [ ] D3 coach/advisor consolidation (single assignment table vs catalog+assignments)
4. [ ] D4 Journey spine depth (stage-only vs stage→milestone two-level)
5. [ ] D5 submission model (repurpose `venture_deliverables` vs new table) + review-required configuration
6. [ ] D6 template families (operating-plan templates canonical; playbook family read-only legacy)
7. [ ] D7 calendar derivation scope + internal/venture-facing event flag
8. [ ] D8 activity split (server-side role branch on `GET /ventures/[id]`)
9. [ ] D9 email scenario scope for Phase 4
10. [ ] Order of UI retirement for founder legacy module chips (bind content before removal)

---

*End of Phase 1 blueprint. Nothing was modified; next step is sign-off, then Phase 2 begins with the approved canonical decisions.*

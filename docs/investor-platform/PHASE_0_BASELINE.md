# Investor Platform — Phase 0 baseline

Historical pre-integration report. The current replacement is
[PHASE_0_REBASELINE.md](PHASE_0_REBASELINE.md), which accounts for `interns`.

Owner: Christelle FAGBEHOURO (working solo). Date: 5 November 2026.
Reference: *Investor Platform: Developer Handover and Build Guide*, Draft v2,
5 November 2026, especially sections 7–13 and References A–E.
Audited checkout: `venture-A`, commit `13a54d5fd`.

Update: Phase 1 implementation was subsequently requested by the user; see
`PHASE_1_PROGRESS.md`. Phase 0 statements below describe the initial audit.
Its browser runs and owner sign-off have not been retrospectively marked passed.

## Status and evidence boundaries

Phase 0 is **in progress, not approved**. This is a source audit, a staging
metadata check and a review of 18 user-provided desktop screenshots. It is not
an authenticated browser test, a completed security audit or a release sign-off.
No product source, database schema, application rows, flags or emails were changed.
No White-Label files were changed. No build or development server was started.

Follow-up: `PHASE_0_COMPATIBILITY_REVIEW.md` records the second read-only audit,
confirmed constraints/grants/RLS, additional source risks and the proposed
non-destructive integration approach. `LOCAL_VALIDATION.md` explains how to log in
locally without sharing credentials. Metadata evidence is retained in
`STAGING_METADATA_2026-11-05.json` (no personal records).

Local verification completed: 3 existing Jest suites passed, 20 tests total:
`investor-pipeline.test.js`, `investor-dashboard-profile-query.test.js`,
`security-lot2-investor-scope.test.js`. Models/database are mocked in these suites;
they establish a limited automated baseline, not staging correctness or v2 compliance.
The pipeline suite deliberately pins the old investment cascade that Phase 5 changes.
Executed serially with a 384 MiB Node heap limit and reduced scheduling priority.
The checklist CSV passed a structural check (29 unique actions, two NOT_RUN columns).
No application code changed, so full lint/build were not run for this documentation
and read-only audit-query change. The four new files passed a whitespace check.

Evidence labels: **source** = implementation inspected; **screenshot** = supplied
image; **schema** = metadata read from staging; **pending** = execution still needed.
An existing function or table does not establish that its complete flow works.

## Existing implementation: reuse map

| Area | Evidence in this checkout | What to preserve / verify |
|---|---|---|
| Application and intake | `src/services/platform/seed/investorApplication.js`, `src/services/platform/investorIntake.js`; `/api/platform/seed/investor-application`, `/api/platform/investor-run` | Existing form/run and approval automation. Do not reactivate retired public registration. Trace a synthetic submission end to end. |
| Provisioning | `src/models/investorRelations/provisioningAndProfile.js`, `provisionInvestorFromApproval` | Reuse the investor profile and preferences creation, including failure reporting. |
| Activation and login | `src/services/investor/setupPassword.js`; `/api/investor/setup-password`, `/api/auth/setup-password`, `/api/auth/login`, `/api/auth/session-login` | Trace which activation link the application actually sends; preserve password/session behaviour. No activation email sent during this audit. |
| Identity and own scope | `src/models/authorization/investorSelfService.js`, `src/models/authorization/investorScope.js` | Investor profile is an entitlement; preserve contextual access and own-resource checks. Do not replace identity with an investor role string. |
| Dashboard | `src/app/investor/dashboard/page.js`, `/api/investor/dashboard`, `src/services/investor/dashboard.js`, `src/models/investor/dashboardsAndKpis.js` | Cache-first data loading; three current tabs; partial best-effort recommendation/campaign/relationship blocks. Add safe output shaping later. |
| Discovery | `/api/investor/ventures`, `src/models/investor/venturesAndUpdates.js`, `VentureFilters.js`, `VentureGrid.js` in `src/components/investor/dashboard-page/` | Venture directory, search, industry/country/stage filters. Funding inputs exist in the UI but are ignored by this endpoint/model. |
| Recommendations | `src/services/investor/dashboard.js`, `scoreVentures` | Current weights 30/25/20/15 + readiness bonus. Guide requires mode-specific weights and no readiness bonus. |
| Pipeline | `/api/investor/pipeline`, `src/services/investor/pipeline.js`, `src/models/investor/diligenceAndPipeline.js`, `PipelineTab.js` | Preserve current stage machine and own-scope reads. Review both pipeline and decisions entry points for future confirmation enforcement. |
| Watchlist and comparison | `/api/investor/watchlist`, `src/services/investor/watchlist.js`, `WatchlistTab.js`, `ComparisonBar.js`, `ComparisonModal.js` | Keep saves/removals and comparison of up to four ventures; restrict returned and displayed data in Phase 1. |
| Relationships and diligence | `/api/investor/relationships`, `/api/investor/diligence`, `src/services/investor/relationships.js`, `src/services/investor/diligence/` | Reuse workspaces, requests and ownership helpers; map introduction approval onto these. |
| Meetings | `/api/investor/meetings`, `/api/investor/relationships/meetings`, `src/services/investor/relationshipMeetings.js` | Existing relationship meeting GET is own-scoped; POST/PUT are super-admin-only. Investor slot negotiation is an extension, not demonstrated today. |
| Messaging | `src/components/messaging/MessagingChat.js`, `src/models/communications/messages.js`, `src/services/communications/messageScope.js` | Existing conversations, read markers and unread UI. Approval-gated investor/venture pair, routing to founders and six-hour reminders need verification/design. |
| Profile and preferences | `/investor/profile`, `/api/investor/profile`, `/api/investor/preferences`, `src/services/investor/preferences.js` | Existing investor-specific profile exists; supplied sidebar instead opens `/participant/profile`. Preserve profile/preferences editing. |
| Flags and settings | `src/migrations/028_admin_config.sql`, `src/models/ventureSystemAdminStore.js`, `src/services/ventures/systemAdmin.js` | Reuse `feature_flags` and `system_settings`. Existing default for `is_enabled` is TRUE: new investor flags must explicitly start FALSE. Check server enforcement and permissions. |
| Error register | `src/models/adminOps/reportsAndErrors.js`, `insertErrorLog`; provisioning failure reporter above | Reuse reporting, avoid silent swallowed secondary failures and never expose raw database errors to investors. |
| Languages and visual kit | `src/locales/{en,fr}/investor*.json`, `DESIGN_SYSTEM.md`, shared `stf-*` and UI components | Extend existing translations and components; do not build a second theme or language engine. |

## Findings to resolve in later phases

| ID | Finding and evidence | Planned phase / verification |
|---|---|---|
| INV-001 | Dashboard directly renders `<ParticipantDashboardHome />`. That component unconditionally renders participant welcome, four programme KPIs, command calendar and announcement link; its investor condition only guards additional blocks. Matches screenshots 11:46:31–11:46:53. | Phase 2: approved investor layout; keep any required existing actions reachable. |
| INV-002 | Discover selects `business_stage` and cross-investor `investor_interest_count`; dashboard returns recommendations and raw model rows without a shared allowlist. Watchlist includes completion and other-investor counts. | Phase 1 priority: endpoint-by-endpoint output allowlist and visibility enforcement. Source-confirmed exposure paths; authenticated network proof pending. |
| INV-003 | Dashboard profile uses `ip.*`; staging profile includes `review_notes` and `qualification_score`. Service returns profile unchanged. | Phase 1: exclude internal review fields from self-service DTO; verify raw HTTP response. Do not put actual review values in reports. |
| INV-004 | Search filters producing zero results fall back to recommendations (`ventures.length > 0 ? ventures : recommendations`). Exceptions in mutation/search flows are swallowed. | Phase 2: separate initial/results/empty/error states; make failures understandable. |
| INV-005 | UI sends funding bounds but Discover controller/model do not use them. Watchlist/campaign/workspace queries still join `v2_programs` while discovery reads `ventures`. | Phase 0/1: trace venture identifiers and relationship/campaign links; never guess IDs or replace links destructively. Phase 2/3: make filter contract honest. |
| INV-006 | Intro modal submission changes pipeline stage to `meeting_requested`; `introMessage` is not forwarded to `addToPipeline`. No independent request/review flow is wired here. | Phase 3: reuse what exists after schema compatibility review, add real request tracking without losing current action. |
| INV-007 | `addOrUpdatePipeline` immediately records a decision and executes investment cascades when stage becomes `invested`; stats count that stage directly. | Phase 5: studio confirmation gate, duplicate/retry protection, reconcile metrics; owner decides legacy treatment. |
| INV-008 | Dashboard, Watchlist and Compare include hardcoded English; Compare/Watchlist display readiness and other-investor interest. | Phase 1: stop forbidden data on server. Phase 2: translated, permitted fields and accessible components. |
| INV-009 | Screenshots 11:47:56–11:48:25 show participant profile/program history and facilitator identity. This can reflect a legitimate multi-context account; the screenshot alone does not prove unauthorized access. | Audit navigation using a synthetic investor-only account and a multi-context account separately. Do not change the user's actual role. |
| INV-010 | Screenshot 11:48:41 exposes internal Google configuration names and a documentation path to the user. | Record UX defect; later use a plain translated availability message, preserving diagnostic detail server-side. |
| INV-011 | Existing `catch (_) {}` blocks ignore secondary failures. Several API handlers return `error.message`. | Later phases: Errors register integration and safe user errors; preserve successful primary actions. |
| INV-012 | Staging has newer investor tables absent from the inspected source wiring, with incompatible-looking identifier types (below). | Resolve ownership/migration provenance and FK compatibility before fixtures or additive migrations. Never drop or rename to align them. |

Priorities above are audit triage, not user-tested severity scores. No actual
confidential field values were read or copied in this audit.

## Staging metadata check — 5 November 2026

`.env.local` project reference was checked without printing credentials:
`mbpaxrfhqqclzyiefuab` (documented staging). Metadata-only SQL:
`scripts/db-audit/investor-phase0-schema.sql`, executed with the existing
`run-readonly.mjs` runner. Session reported read-only ON; 3 statements succeeded,
0 skipped, 165 column rows returned. No application rows were selected and no
runtime `initDb()` was invoked. Deployment/site identity still needs browser verification.

Confirmed reusable tables: `investor_profiles`, `investor_preferences`,
`investment_pipeline`, `investor_watchlist`, `investment_decisions`,
`fundraising_campaigns`, `relationship_workspaces`, `relationship_meetings`,
`feature_flags`, `system_settings`.

Some Phase 1/3/6 structures already exist in staging:

- `investor_profiles.visibility_mode`, `investor_type`, `source`, `approved_at`,
  `last_login_at`, `is_test`, terms fields and `invitation_id`.
- `investor_activity_log`, `introduction_requests`, `investor_invitations`.
- Meeting additions including `start_at`, `timezone`, `video_link`, `outcome_code`
  and confirmation/reminder timestamps.

Important type mismatches requiring investigation:

| Existing parent/key | New structure/key | Observation |
|---|---|---|
| `investor_profiles.id`: UUID | `investor_activity_log.investor_id`: bigint | Cannot assume these are directly joinable. |
| `investor_profiles.id`: UUID | `introduction_requests.investor_id`: bigint | Same issue. |
| `investment_pipeline.id`: UUID | `introduction_requests.pipeline_id`: bigint | Same issue. |
| `relationship_workspaces.id`: UUID | `introduction_requests.workspace_id`: bigint | Same issue. |
| `ventures` referenced by UUID in current investment tables | New activity/introduction `venture_id`: text | Determine canonical identity resolution before use. |

This query does not verify constraints, triggers, RLS, data integrity, deployed
code version or complete table coverage. Similar tables under other names may
exist. Presence is not proof of working logging, deduplication or immutability.
Do not seed financial operations into these structures until compatibility is established.

## Phase 0 exit checklist

- [x] Read v2 guide; record owner, branch and source baseline.
- [x] Review supplied desktop screenshots and inspect core source entry points.
- [x] Check staging reference and selected schema in read-only mode.
- [x] Prepare synthetic scenario specification and repeatable baseline checklist.
- [ ] Verify deployed staging site uses the intended commit and database.
- [ ] Resolve schema provenance/type mappings; inspect constraints/triggers and existing flag values safely.
- [x] Inspect selected constraints, triggers, RLS, browser-role grants and matching flag keys (second audit); provenance and remediation remain open.
- [ ] Prepare synthetic accounts/data through compatible existing flows with outbound messages contained.
- [ ] Execute every baseline action twice with synthetic accounts, retaining evidence.
- [ ] Capture all investor screens at 360/768/1280 px, in EN and FR.
- [ ] Product owner approves baseline and demo data. Phase 1 may then start.

The supplied images contain personal details: keep originals private and use
synthetic/redacted captures for shared reports. They document desktop appearance,
not successful writes, mobile usability or secure API responses.

## Delivery sequence after approval

1. Foundation: explicit safe DTOs and mode checks on every investor endpoint,
   immutable server events with repeat-view deduplication, existing disabled flags,
   translation scaffolding and settings. Reuse compatible schema.
2. Approved dashboard wireframes and screens, then implementation and five-person test.
3. Studio deal-flow publication/deck controls and introduction review.
4. Existing messaging extension and timezone-aware scheduling/email flow.
5. Investment confirmation and reconciled studio metrics; no speculative finance numbers.
6. Invitations, inactive NDA until legally approved, onboarding, bilingual review,
   internal rollout then investor pilot and general release.

External decisions: investor testers; timeline; founder visibility; permitted studio
message readers; venture message recipients; time-to-close start; legacy investment
handling; approved EN/FR NDA. No later-phase implementation is claimed here.

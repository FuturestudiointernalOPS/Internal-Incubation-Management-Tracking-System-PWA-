# Investor Platform — revised Phase 0 after interns

Owner: Christelle FAGBEHOURO (solo). Updated: 5 November 2026.
Branch: `venture-A`. Reference checkout: `3708d517c`, integrating `origin/interns`
at `83a83243b`. Product reference: Developer Handover and Build Guide, Draft v2.

**Status: source/metadata baseline refreshed; browser baseline and approval pending.**
This supersedes the source-absence statements in the original Phase 0 audit.
Existing screenshots describe the earlier UI; they cannot validate the imported code.

## Revised inventory

| Area | Existing evidence | Assessment |
|---|---|---|
| Application/approval | `services/platform/seed/investorApplication.js`, `services/platform/formRuns/review.js`, `models/investorRelations/provisioningAndProfile.js` | Reuse the existing intake and activation flow; synthetic execution pending. All source paths in this table are under `src/`. |
| Contextual identity | `models/authorization/investorSelfService.js`, `investorScope.js` | Keep profile entitlement and own-resource checks, not a new global role. |
| Dashboard | `/api/investor/dashboard`, `services/investor/dashboard.js` | Imported mode-aware recommendations and pipeline/watchlist DTOs. Local profile gate retained; campaign/relationship projection tightened in this revision. |
| Discovery | `/api/investor/ventures`, `models/investor/venturesAndUpdates.js` | Imported filter occurred after pagination; now corrected in shared count/list SQL. |
| Activity | `services/investor/activity.js`, `models/investor/activityLog.js` | Present; UUID compatibility, rolling deduplication and secondary error reporting repaired locally. Full interaction coverage pending. |
| Visibility control | `/api/investor/visibility`, `services/investor/visibility.js` | Present; studio-only check strengthened and old value read server-side. Actual studio UI/use still to test. |
| Deal flow/decks | `services/investor/dealFlow.js`, corresponding routes/pages | Present; live list now requires amount/currency/published deck and excludes archived ventures. File and watermark enforcement still to test. |
| Introductions/invitations | `services/investor/introductions.js`, `invitations.js` | Present, not missing. Non-activity UUID/BIGINT links remain unresolved. |
| Scheduling/investment | `services/investor/scheduling.js`, `investment.js` | Present, not certified. Type compatibility, approvals, timezone, emails and bypasses require tests. |
| Studio reporting | `services/investor/metrics.js`, `models/investor/metrics.js` | Present. Log projections corrected for canonical identity and actor/test snapshots; all other formulas remain to reconcile. |
| Feature switches | Existing `feature_flags`, local model/service and disabled seed migration | Profile gate wired; seed unapplied, imported behaviours not all flag-gated. |
| Profile/language | Profile GET/POST, `services/investor/profilePrivacy.js`, `/api/auth/language`, `lib/i18n.js` | Reuse existing EN/FR account preference; reads expose it as preferred_language without a second preference store. |
| Participant UI | `/investor/dashboard`, `ParticipantDashboardHome.js` | Shared participant block still present. Redesign is Phase 2, not delivered here. |

New table provenance is now identified: `migrations/investor_os_expansion.sql`
and `src/models/investor/expansionSchema.js`. Do not create a competing expansion.
Their presence does not solve BIGINT references to the current UUID parents.

## Refreshed staging evidence

Verified `.env.local` project reference: `mbpaxrfhqqclzyiefuab`, without printing
credentials. Reran `scripts/db-audit/investor-phase0-integrity.sql` using the existing
read-only runner: nine statements succeeded, read-only ON; 243 selected columns,
16 constraints, six RLS states, zero policies/custom triggers on those tables,
84 browser-role grants and no matching investor flag keys.

Evidence: `STAGING_METADATA_2026-11-05.json`, revision after merge. No personal
records selected; configuration flag rows queried but none matched. No migration,
fixture, session or email created by the re-audit.

Direct access remains unresolved: RLS disabled and broad anon/authenticated grants
on the six selected tables. Public REST exposure was not tested; no public leak is
claimed. Next.js DTOs cannot protect an independently exposed database API.

## Validation and remaining gate

The integrated checkout initially passed **15 suites / 1,192 tests** before new
corrections. Final corrected-source results are in `PHASE_1_REBASELINE.md`.
These mocked/static tests do not replace authenticated staging/browser execution.

The 29-action `BASELINE_CHECKLIST.csv` retains NOT_RUN for both browser passes.
The user has investor/admin credentials; dedicated synthetic fixtures are not yet
confirmed. Follow `LOCAL_VALIDATION.md`, keeping passwords private.

- [x] Reinspect integrated source, identify reusable modules and schema provenance.
- [x] Refresh selected staging metadata without SQL writes.
- [x] Establish an integrated automated regression baseline.
- [x] Retain synthetic data plan and two-pass checklist.
- [ ] Verify deployed site/version/database in the browser.
- [ ] Prepare synthetic accounts/ventures with contained outbound email.
- [ ] Execute all 29 actions twice; retain sanitized evidence.
- [ ] Test 360/768/1280 px, EN/FR, keyboard/zoom, errors and slow connections.
- [ ] Validate each raw endpoint response and direct database/storage access.
- [ ] Obtain owner approval of baseline/demo data.

The user requested Phase 1 development while these checks remain open. That
authorization is not recorded as evidence that any manual action passed.

# Investor Platform — Phase 1 progress

Historical first slice. The current replacement is
[PHASE_1_REBASELINE.md](PHASE_1_REBASELINE.md), which accounts for `interns`.

Owner: Christelle FAGBEHOURO. Branch: `venture-A`. Date: 5 November 2026.
Status: **started — first implementation slice, not complete or released**.

The user requested Phase 1 implementation. The outstanding Phase 0 browser
baseline and owner review remain open; this request is not recorded as proof
that those tests passed. No change is activated on staging or production.

## Implemented in this slice

- Reused the existing `feature_flags` store: named switches are read server-side
  through a model, with decisions in a service. Missing keys are off; only the
  database boolean true enables a switch. No cache delays a toggle.
- Added an explicit own-profile allowlist instead of relying on model `SELECT *`.
  It retains the existing editable fields, approval status, preference arrays and
  ticket bounds. Internal review notes, reviewer identity, qualification scores,
  compliance documents and unknown future columns are excluded.
- Integrated that projection into `/api/investor/profile` GET and POST and the
  `profile` block of `/api/investor/dashboard`, behind `investor_profile_privacy_v1`.
  The rest of the dashboard is unchanged. This is **not** a complete safe dashboard DTO.
- Kept privileged profile PUT and its authorization separate from self-service.
  Kept contextual Member access, own-user binding and the existing identity writer's
  flag guard. No investor role was assigned by this work.
- Profile GET/POST and dashboard success/error responses are private/no-store.
  Their unexpected errors use the existing translated `errors.somethingWrong` key,
  rather than exposing raw database errors. No new translation or UI is needed.
- Flag read failures do not revert to unrestricted data. POST resolves the switch
  before any save, avoiding a flag-store failure after a successful mutation.

Files: `src/models/investor/featureFlags.js`,
`src/services/investor/featureFlags.js`, `src/services/investor/profilePrivacy.js`,
the two route controllers above, and `src/__tests__/investor-profile-privacy.test.js`.

## Additive migration prepared, not executed

`src/migrations/20261105_investor_phase1_feature_flags.sql` only inserts ten
explicitly disabled switches into the existing flag store. Re-running preserves
operator choices using `ON CONFLICT DO NOTHING`. No table/column deletion, rename,
type change, existing-record update or automatic request-time migration is added.
It depends on the existing `028_admin_config.sql` flag table.

Only **profilePrivacy** is consumed by an implementation in this slice. The
remaining names reserve switches for subsequent work; they do not implement
visibility, audit, introductions, messaging, meetings or NDA acceptance.
Do not enable reserved flags to simulate readiness.

With the profile switch off or absent, the legacy profile payload is preserved,
including its existing confidentiality issue. This is an explicit rollback path,
**not** a claim that profiles are already protected on a deployed environment.
Direct Supabase grants/RLS are also outside this slice and remain unresolved.

## Verification

- 12 targeted existing/new Jest suites passed: **1,138 tests** including service/model
  boundary checks. The new suite has **31 tests** covering allowlists, read/update/create
  responses, contextual Member access, authorization denials, flag toggles/failures,
  null/nested/malformed data and admin payload compatibility.
- Tests mock database/auth dependencies: no staging records, sessions or emails created.
- EN/FR generic error key existence checked.
- Migration reviewed as insert-only, ten unique keys, all explicitly FALSE,
  no overwrite of existing flags. It has not been exercised on PostgreSQL.
- Targeted ESLint on all six changed/new JavaScript files passed with zero errors
  and zero warnings; whitespace checks passed.
- Full repository lint was attempted serially on one CPU with a 512 MiB heap,
  55-second limit and resource guards. It was stopped after 28 seconds by the
  75°C temperature guard: **not validated**. The child process was terminated.
- Full build was **not started** after that thermal stop. Compilation and the
  complete repository lint remain release checks; no green build is claimed.

## Phase 1 remaining work

1. Full allowlisted output contracts for ventures, watchlist, campaigns, relationship
   workspaces, diligence/documents, search, comparison, recommendations and exports.
   Fix alternate KPI/profile mutation response paths as part of that coverage.
2. Studio-managed visibility control and enforcement on every relevant read/write,
   including guessed venture IDs and data already in pipeline/watchlist.
3. Resolve the pre-existing UUID/bigint mismatch additively, with verified identity
   mapping and no guessed historical backfill.
4. Compatible immutable server event storage and logging: own actions, server timestamps,
   30-minute repeat-view deduplication, no staff/test metrics, Errors-register handling
   for secondary failures. No logging endpoint accepting browser-invented events.
5. Remaining profile language/source/date fields and metric settings, plus translated
   studio controls using the existing component kit and i18n system.
6. Verify and remediate direct-database protections with regression coverage; Next.js
   response projection does not protect an independently exposed Supabase table.
7. Apply reviewed additive changes to the confirmed test target, run the real baseline
   and inspect raw responses for each mode. Complete the phase exit gate before rollout.

The dashboard redesign is Phase 2 and is not included here.

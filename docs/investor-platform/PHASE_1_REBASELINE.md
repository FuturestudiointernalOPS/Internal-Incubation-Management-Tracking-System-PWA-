# Investor Platform — revised Phase 1 after interns

Latest implementation and acceptance status: see
[PHASE_1_FINALIZATION.md](PHASE_1_FINALIZATION.md). Neither local tests nor design
work on Phase 2 substitute for the still-open staging acceptance gate.

Owner: Christelle FAGBEHOURO (solo). Updated: 5 November 2026.
Branch: `venture-A`; reference `3708d517c` after integrating `interns`.
**Status: corrections implemented locally; phase gate not passed.**
This supersedes the initial Phase 1 progress report's inventory of available code.

## Implemented corrections and reuse

- Reused the imported visibility, DTO, activity, deal-flow and metrics modules,
  the local profile gate, existing feature store and EN/FR infrastructure.
- Search count/list share a SQL visibility predicate applied before pagination.
  Deal-flow-only requires a live entry, positive amount, currency and published deck;
  studio-stage filtering is ignored in that mode. Limits/offsets are validated, totals
  describe all matching results, and clients cannot choose mode by URL parameter.
- Live deal lists resolve code/UUID venture references and exclude archived/no-deck
  records. Venture cards use the venture identity rather than a numeric deal row ID.
- Dashboard campaign/relationship/meeting blocks have explicit field projections;
  raw internal notes, assignees and other-investor interest counts are omitted.
  Invalid modes narrow to deal-flow-only. All-endpoint DTO coverage remains open.
- Visibility changes require internal studio identity in both controller and service,
  plus the existing capability check. The previous mode is read after locking the
  profile, never trusted from `old_mode`. Missing profiles return 404. Revised dashboard,
  search and visibility routes authorize before expansion maintenance.
- Activity preserves legacy BIGINT columns: numeric IDs still work; canonical UUID
  investor/related references are snapshotted in server-owned metadata. No retyping,
  deletion or guessed historical mapping. Activity reads use canonical identity with
  numeric fallback. Caller metadata cannot override those references/test snapshots.
- Repeat venture views use a stable actor/venture lock and a rolling thirty-minute
  DB check under READ COMMITTED. Query follows lock acquisition. Other actions remain
  distinct. A duplicate/no-insert returns null rather than a fictional event ID.
- Activity failures enter the existing Errors register; register failures are safely
  logged. Both stay secondary and never reject the primary action. No raw SQL errors
  or arbitrary metadata are written to the user response.
- Activity-derived metrics use canonical IDs and exclude snapshotted staff/test traffic;
  staff actor type is determined server-side. This does not certify exclusions or
  accuracy of every separate capital/profile/meeting statistic.
- Reused `contacts.language`, the existing header switch, browser fallback and
  `/api/auth/language`. Own-profile/dashboard reads expose the canonical preference
  as `preferred_language`; no duplicate language store or UI was built.
- Prior own-profile GET/POST/dashboard privacy projection remains behind
  `investor_profile_privacy_v1`. No flag was activated during this revision.

These repair imported paths already present in `interns`. Imported expansion
behaviour is not uniformly controlled by the local reserved switches; full flag
coverage remains an open requirement, not a completed claim.

## Additive migration status

Prepared, **not applied**:

1. `20261105_investor_phase1_feature_flags.sql`: ten explicitly disabled switches,
   insert-only, repeatable without overwriting operator choices.
2. `20261105_investor_activity_integrity.sql`: append-only UPDATE/DELETE/TRUNCATE
   rejection triggers, two supporting indexes and default time-to-close setting.
   No rows/columns are dropped, renamed, retyped or backfilled. Existing numeric and
   UUID identities remain intact. The setting is preparation, not a claim that all
   configurable metric clock starts are implemented.

The activity identity fix uses existing metadata and needs no new identity columns.
The trigger migration needs actual PostgreSQL validation; it does not itself remove
broad browser grants or guarantee that only server requests can append. No schema,
data, credentials, flags or production configuration were changed by tools.

## Validation

Initial integrated baseline: 15 suites / 1,192 tests passed.
Corrected foundation/search tests cover UUID storage, canonical metadata, repeat-view
lock/query order, secondary errors, server-read old mode, studio-only mode changes,
visibility before pagination, totals, invalid pagination and hidden response fields.
Final bounded checks: **17 suites / 1,229 tests passed**. Targeted ESLint on
the 16 changed/new JavaScript files passed; one unused catch-variable warning
was then corrected and the affected file was rechecked. `git diff --check` passed.
Checks ran serially with one CPU, a 384 MiB heap, memory/temperature guards and
a 55-second limit per process. No global build was started.

Database/auth dependencies are mocked or source-inspected: actual PostgreSQL lock
concurrency, triggers, raw staging API responses, browser UI, email and Supabase REST
access remain unverified. No complete build is claimed; the earlier global lint was
stopped at 75°C. Checks on this machine must stay serial and resource-bounded.

## Remaining work before Phase 1 approval

- Complete safe raw and mutation-response DTOs on legacy pipeline, KPI/venture-KPI,
  diligence/documents, standalone campaign and export endpoints; verify admin boundaries.
- Enforce approved investor context/mode on every guessed-ID read/write and test
  investor-only and multi-context accounts without taking away legitimate studio access.
- Complete event hooks: successful login, detail views, watchlist, comparison and
  historical mode changes must be traced end to end. A repaired writer is not proof
  that each interaction emits one event.
- Finish feature-switch coverage without silently disabling imported working actions.
  Disabled profile privacy retains the legacy issue until a reviewed test activation.
- Verify additive migration and direct database/storage protections. Introduction,
  meeting and investment BIGINT links remain separate compatibility work.
- Verify UI consumers and stale cache snapshots against DTOs; a removed metric must
  not appear as a fake zero. A redesigned frontend has not been delivered here.
- Reconcile metric exclusions/settings and profile lifecycle dates using synthetic data.
- Complete both browser baseline passes, both modes' network inspections and owner review.

Neither phase is marked approved. Phase 2 has not started. No migration, build,
deployment or production promotion success is implied by unit-test counts.

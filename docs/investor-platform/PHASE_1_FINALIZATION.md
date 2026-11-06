# Phase 1 — implementation handover and validation gate

Owner: Christelle FAGBEHOURO. Branch: `venture-A`. Date: 5 November 2026.
Reference: Investor Platform Developer Handover and Build Guide, Draft v2.

**Implementation extended; final staging acceptance is blocked, not passed.**
The user declined to supply private test-account access. No passwords were requested
in chat or recorded, no sessions were fabricated and no investor/admin impersonation
was used. This document does not convert that refusal into approval or a test pass.

## Work completed locally in this extension

- Added the server-side `withInvestorPrivacy` boundary. It reads switches and the
  approved profile before running a mutation, retains original controller/service
  authentication and ownership checks, fails closed on configuration errors and
  shapes both read and mutation responses. Management retains its existing contract.
- The boundary covers dashboard, discovery, deal flow, legacy pipeline, campaign
  list, relationships, diligence, diligence documents, relationship meetings,
  meetings, decision list, KPI/venture-KPI, update and evaluation reads. There are
  **15 route files** covered; some expose several guarded methods.
- Explicit contracts exclude studio notes, review fields, other-investor activity,
  internal narratives and metrics. Own private notes and authorized requested files
  keep their identifiers. Internal KPI/update/evaluation payloads are not forwarded.
  These changes use the disabled `investor_visibility_v1` switch and are not active
  simply because the code exists.
- Added an explicit studio identity plus capability boundary for seven global
  investor administration/reporting routes. Investor module view permission alone
  must not grant cross-investor reporting. No production account role was changed.
- Added activity-switch-controlled hooks for both successful login controllers,
  watchlist additions/removals and newly inserted pipeline entries. The pipeline
  insertion marker stays server-side rather than leaking into API results.
- Added `/api/investor/interactions` for verified venture-view and compare intents.
  The server validates approved context, mode, visible canonical IDs and a limit
  of four distinct comparison ventures. It accepts no arbitrary event type, actor,
  amount or timestamp. The existing detail/compare actions call it without blocking
  their primary UI action. Repeat views use the rolling writer already implemented.
- Reused the canonical active founder records for founder count and countries in
  discovery, recommendations and deal flow. No founder name/contact information or
  new data entry is introduced. The seven referenced schema columns were confirmed
  in a metadata-only staging query; no founder/contact values were selected.
- Retained the previous fixes for pagination/visibility, UUID-compatible activity,
  rolling deduplication, Errors-register fallback, private responses, account-language
  reuse and studio-only mode changes.

## Regression evidence

The expanded test run initially found six failing founder-landing cases. Their old
expectations predated the imported founder portal. The resolver and `next.config.mjs`
were unchanged by this work; existing rewrites map `/founder/ventures/:path*` to the
participant venture implementation. Tests were updated to the established founder
URL contract, including the multiple-venture landing; runtime routes were not changed.

Validation covers legacy privacy gates, permitted/forbidden fields, approved vs
pending/suspended users, staff boundaries, failure-before-mutation behaviour, event
intents and aliases, existing login/provisioning flows and service/model boundaries.
Final expanded run: **25 suites / 1,347 tests passed**. Targeted lint on all
50 changed/new JavaScript files passed with zero errors and zero warnings; the
subsequently adjusted founder test was rechecked separately. Whitespace checks
passed. These checks include both login controllers and the new response/event guards.

The checks use mocked auth/data or source inspection. They do not demonstrate real
PostgreSQL locking, trigger rejection, email delivery, browser rendering or complete
cross-context access safety. No full build is claimed; checks stay serial and bounded
because the workstation previously reached the thermal cutoff during global lint.

## Gate still required to finish Phase 1

1. Review and exercise the prepared additive flag/integrity migrations on an isolated
   representative PostgreSQL target. They remain unapplied; no history is deleted,
   columns renamed/retyped or credentials altered.
2. Review direct Supabase table/storage access. Broad browser grants and inactive RLS
   remain observed risks; an HTTP projection cannot fix a separate database API.
3. Inspect every raw response under both modes with approved, pending, suspended,
   investor-only and multi-context test users, including IDs guessed from other accounts.
4. Execute both browser baseline passes and confirm no legacy action/cache consumer
   breaks when the new switches are activated. No fake zero should replace hidden data.
5. Reconcile actual event rows, staff/test exclusions, lifecycle dates and metric settings.
   Check old same-stage pipeline updates and all deployed intake paths rather than
   assuming unit-tested helpers establish exact event coverage.
6. Record owner sign-off. Migration preparation and local tests are not release approval.

No migration or switch was applied to staging/production. Old public contracts remain
when the visibility/profile switches are absent or off; this is rollback compatibility,
not deployed confidentiality protection. Later introduction/meeting/investment type
mismatches and their imported flags are not silently declared resolved.

## Phase 2 started as design work

Open `phase2-wireframes.html` locally. It is a standalone synthetic-data design
prototype, with no database/auth/network integration. It provides EN/FR, width
controls for 360/768/1280 px, the five planned tabs and normal/loading/empty/error/
partial/offline/pending states. Introductions/Meetings are explicitly later-phase
previews; NDA remains disabled. Button feedback stays inside the page.

JavaScript syntax was checked; 70 tab/state/language combinations plus width/mode
switching were exercised in jsdom. That verifies interaction logic, not pixels,
accessibility compliance or browser performance. No exported PDF or screenshot is
claimed. Phase 2 application UI is not implemented before wireframe review.

Review requests: approve the block order and mobile navigation; confirm the tab
structure; decide which existing calendar/reminder actions must remain reachable;
review chart placement and empty/error states. The chart is above the tabs on
desktop and collapsible below the tabs on mobile, following the guide.

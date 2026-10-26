# ImpactOS White-Label OS — Solo Work Plan and Progress Report

**Prepared by:** Christelle FAGBEHOURO  
**Updated:** 26 October 2026  
**Working branch:** `white_label_os`  
**Confirmed scope:** Programmes, LMS and Venture  
**Delivery capacity:** Christelle working alone

## Executive overview

The first Programmes backend foundations are implemented locally. They prepare
client organisations, access rules, preserved history and controlled Future Studio
supervision while reusing existing programme records and sessions.

**No client portal is released. Client activation remains blocked.** This protects
Future Studio while the remaining access paths and client experience are completed.
No migration has been applied to production or staging. Three additive migrations
have passed repeated application on an isolated database containing fictional data.

## Completed locally

| Work | What it provides | Evidence and limits |
|---|---|---|
| Scope and operating rules | Only Programmes, LMS and Venture; suspended clients are denied access; solo delivery. | Recorded decisions guide implementation. |
| Initial review and baseline | Existing code, routes and database structure reviewed to identify reuse and isolation gaps. | Earlier schema assessment was read-only; production is not a test environment. |
| Organisation foundation | Client organisations, memberships, contracts, enabled modules, roles and permissions. | First additive migration; existing business records are preserved. |
| Initial Programmes read services | Authorised list and detail with pagination, search and a limited set of fields. | Guarded client list/detail endpoints and a translated portal are implemented locally; client activation remains blocked. |
| History protection | Preserve ended access, audit changes and enforce references within the same organisation. | Second additive migration; synthetic PostgreSQL checks passed. |
| Controlled supervision | Future Studio can consult one client's programmes only with an explicit temporary read mandate; every permitted consultation is recorded. | Third additive migration and two read-only API routes. No mandate management screen or export access yet. |
| Client access experience | Separate `/o/select` entry, organisation selection, server-controlled session changes and translated programme list/detail. | Private responses, stale-context rejection and tab invalidation are tested; no client activation or browser pilot yet. |
| First internal boundaries | Canonical programme queries plus the PM workspace, KPI reads, schedule, submission lists and five programme export types exclude client programmes. | Actual repository SQL tested with fictional data; other indirect and child-object paths still require review. |
| Synthetic verification | Three migrations applied twice each; legacy compatibility, ownership, history, audit and mandate expiry checked. | Temporary local PostgreSQL only; not a full staging clone or an end-to-end client pilot. |
| Management preview | Standalone French/English interactive preview with fictional organisations, programme cards, suspension and simulated supervision. | Offline demonstration only; no backend connection. See [HTML preview](../presentations/white-label-demo/ImpactOS_White_Label_Demo.html). |
| Selected regression checks | Three separate runs passed: 13 suites / 3,113 tests in total. | Targeted checks, not the entire test suite; the latest workspace checks are reported separately below. |

The latest internal workspace increment passed **37 tests in four suites**.
The actual repository queries were also exercised on a temporary PostgreSQL 16
fixture: all fourteen workspace blocks and five programme export types excluded
client programmes, while equivalent Future Studio reads retained their output.
Calendars, submission lists, assigned programmes and KPI reads passed the same
checks. Missing or excluded programmes stop before automatic KPI updates.

Global lint passed with **zero errors and 264 warnings**. Full compilation
remains **unvalidated**. The first attempt reached the configured 1,280 MiB Node
heap limit. A final attempt at 2,048 MiB did not finish within the 180-second
limit and was terminated by the monitoring runner. Both attempts used an
unavailable local database address with runtime schema maintenance disabled;
neither targeted production. No higher-memory retry was launched.

Evidence can be reproduced using the
[workspace regression suite](../../src/__tests__/organization-programs-workspace.test.js)
and the [isolated migration runner](../../scripts/white-label/test-programs-migrations.py).
The latter must only run against its dedicated fictional-data container.
These results are not a complete staging validation or a real-client pilot.

## Latest implementation and verification

The client entry and its APIs are now implemented locally. Organisation selection
is checked against current server-side memberships and permissions. A stale tab
cannot select an organisation through its URL or reuse programme responses from
the shared browser cache. Suspended organisations and revoked access are denied.
Internal programme guards check ownership before privileged-role shortcuts.

Two recent regression runs passed: **16 suites / 258 tests** and **10 suites /
3,091 tests**. Native PostgreSQL fixtures also exercised context changes, stale
sessions, audit, supervision, programme workspace queries and aggregate reads.
These are targeted checks, not an exhaustive security certification.

With authorisation, database metadata was read from `.env.local` inside a
read-only transaction. No business records were exported or modified. An isolated
reconstruction of **308 tables, 3,472 columns and 793 constraints** accepted all
three migrations twice while preserving fictional legacy records. It excludes
source triggers, functions, RLS policies and non-constraint indexes: it is not a
complete staging clone or a real-client validation.

The earlier lint and compilation results above are historical.

### Pre-push verification — 26 October 2026

- Targeted regression run: **15 suites / 203 tests passed**, including organisation
  access, client context, portal rendering, workspace, curriculum and team scope.
- Global `npm run lint`: **zero errors, 267 warnings**.
- Full compilation remains unvalidated. The last attempt was interrupted when
  the user requested pushing without compilation. It used an unavailable local
  database address with runtime schema maintenance disabled. Production readiness
  is not claimed. Future push requests must not trigger compilation.
- Only White-Label source, tests, verification tooling and documentation are
  included. Unrelated local changes are excluded from these commits.

## Work in progress

| Activity | Remaining work |
|---|---|
| Programmes isolation | Review child objects, indirect queries, dashboards, exports, files and background operations; close gaps before activating clients. |
| Verification | Complete compilation, full isolated-environment validation and an end-to-end browser pilot; representative table/constraint compatibility has passed. |
| Access experience | Chooser and server-controlled session changes are implemented and covered by targeted tests; complete the browser pilot and deployment review. |
| Progress reporting | Keep completed evidence distinct from planned work; re-estimate delivery after the first usable client journey. |

## Remaining delivery sequence

| Stage | Status | Completion condition |
|---|---|---|
| Complete isolated environment and representative fixtures | Partly complete | Temporary synthetic database works; representative staging validation and restoration checks remain. |
| Organisation and access foundation | Implemented locally; not deployed | Migration, identity and permissions reviewed against the representative target. |
| Supervision and internal separation | In progress | All relevant Programmes access paths reviewed; mandate administration procedure defined. |
| First client Programmes experience | Implemented locally; not deployed | Organisation selection, guarded list/detail endpoints and translated screens exist; browser pilot and launch review remain. |
| Invitations and delegated administration | Pending | Bounded roles, acceptance, removal and revocation verified. |
| Controlled programme changes | Pending | Each new write checked for ownership, history and legacy compatibility. |
| LMS, then Venture | Pending | Reuse existing modules with separately verified ownership, shared content and client results. |
| Files, exports and communications | Pending | Documents, download links, recipients and jobs remain within the authorised client. |
| Full fictional-client pilot | Pending | Two clients plus Future Studio; annual history, suspension, offboarding, performance and restoration evidence. |
| Real-client onboarding | Pending | Authorised review of evidence and remaining risks, launch decision and monitored deployment. |

## Requirements before client activation

- A representative isolated environment; `.env.local` is identified as production
  and must not be used for migration or fixture writes.
- Complete internal/client separation on the paths exposed by the pilot.
- A working client journey with server-controlled organisation context.
- Tests for two fictional clients, suspension, expired contracts, removed access
  and older browser tabs.
- A documented support-mandate procedure and deployment/recovery arrangements.
- An authorised launch review. Solo implementation and testing do not provide an
  independent security review.

Annual cohort history, shared LMS courses across organisations and their separate
results still need implementation-specific validation before those features open.
No delivery date or percentage is claimed without an approved solo baseline.

## Solo working method

Work in small increments, reuse existing modules and preserve existing data.
Run one heavy verification at a time to reduce local memory pressure. Record the
tests and environment actually used before marking work complete. LMS and Venture
follow Programmes. When a team is assigned, reassess capacity and use the team plan
as a reference; its original staffing and calendar are not solo commitments.

The management PDF dated 22 October, if circulated, remains a historical snapshot.
This Markdown report records subsequent implementation progress.

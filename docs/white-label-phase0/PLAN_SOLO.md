# ImpactOS White-Label OS — Solo Work Plan and Progress Report

**Prepared by:** Christelle FAGBEHOURO

**Updated:** 29 October 2026

**Working branch:** `white_label_os`

**Confirmed offer:** Programmes, LMS and Venture

**Delivery capacity:** Christelle working alone

## Executive overview

The core client **Programme management journey is implemented locally**: programme
creation/editing, separate annual cohorts, enrollments, session scheduling and
closure with retained history. It reuses existing programme records, session
records, contacts, authentication cookies and shared interface components.

**Client activation remains blocked. This is not a production release.** The work
has not applied migrations to the real application database. Some Programme
operational features and the complete isolation/browser validation remain pending.
Initial read-only LMS and assigned-Venture organisation surfaces are implemented
locally but are not open to clients; the Venture schema and complete data boundary
still need validation.

## Completed locally

| Work | Result | Limit |
|---|---|---|
| Scope and operating rules | Programmes, LMS and Venture only; suspended clients have no access; solo delivery. | Team estimates are not solo commitments. |
| Organisation foundation | Organisations, memberships, contracts, modules and bounded roles. | Configuration/provisioning is not yet self-service. |
| History and supervision | Preserved access history, audit and explicit temporary Future Studio read mandates. | Existing supervision covers programme list/detail, not the new full workspace. |
| Client entry and home | Organisation selection, server-controlled context changes, client home and module cards; private reads and old-tab checks. | Browser pilot still required; no client LMS or Venture access is enabled. |
| Organisation branding | Display name, HTTPS logo and accessible primary colour with safe fallbacks; explicit editor capability and private update route. | Synthetic tests only; staging review and deployment remain pending. |
| Programme management | Search, pagination, create/edit and protection against overwriting another person's changes. | New management roles must be assigned explicitly; old read-only roles stay read-only. |
| Annual cohorts | Separate cohorts per year, dates and closure. | Earlier cohorts are retained, not reset for a new year. |
| Enrollments | Search eligible existing organisation members, enroll, complete or withdraw. | Account creation/invitations and participant-specific journeys remain separate work. |
| Scheduled sessions | Reuse existing sessions, linked to a cohort; title, description, week, UTC start and duration. | Facilitator assignment, attendance, assignments, meeting links, reminders and communications are not included yet. |
| LMS organisation reads | Course ownership, explicit cross-organisation licences, separate enrollment/attempt/certificate scopes, role capabilities, and a private read-only catalogue/own-learning endpoint and portal. | Client role provisioning, course-content playback, staging migration and browser proof are not complete; no client LMS access is enabled. |
| Venture assigned reads | Platform backfill for legacy ownership, explicit `assigned.read` capability and a private read-only list of the member's active assignments in the current organisation. | The schema varies between deployments; verify the real staging schema, assignment semantics, migration and full data graph before enabling access. No detail, write or client provisioning flow is included. |
| Closure safeguards | End enrollments and sessions before closing a cohort; close cohorts before closing a programme. Closed history remains readable. | No portal deletion or reopening of closed records. |
| Client authentication | Client and supervision Programme handlers avoid general schema initialisation and token backfill. | Other legacy application paths still require review. |
| Initial internal boundaries | Platform-only programme reads, selected dashboards/workspace reads and five internal export types. | Not an exhaustive review of all indirect APIs and jobs. |
| Management preview | Standalone bilingual HTML demonstration remains available. | Offline simulation; it does not demonstrate all new management forms or prove backend isolation. |

The detailed local scope, rights matrix, migration order and remaining gaps are in
[Programme delivery handover](PROGRAMMES_DELIVERY_2026-10-29.md).

The organisation branding editor and branded client header are implemented
locally. The organisation home presents module cards and opens only modules that
the server reports as permitted. LMS and assigned-Venture reads are implemented
locally behind explicit role capabilities. The Venture endpoint returns only
ventures owned by the active organisation where the member has an active
membership or staff assignment; legacy records default to Future Studio.
The feature adds an explicit `organization_admin.branding.edit` capability, a
private update route and an additive migration. Branding and portal changes have
passed focused automated tests and the six-migration synthetic PostgreSQL run.
They still need staging browser testing and have not been applied to a live
application database. Client activation remains blocked.

## Latest verification — 29 October, after merge

- White-label and organisation suites: **142 tests passed across 11 suites**.
- Isolation/internal-boundary suites: **150 tests passed across 9 suites**;
  authorization route/scope census: **47 tests passed across 5 suites**.
- Venture conflict-resolution suites: **11 tests passed across 2 suites**.
- `useApi` behavior suite: **21 tests passed**.
- Six additive migrations applied twice in an offline, synthetic PostgreSQL 16
  database. Programme management, supervision, workspace, client-context and
  branding audit/capability checks passed.
- LMS regression and client portal: **527 tests passed across 42 suites**.
- Ten white-label/LMS/Venture migrations applied twice in isolated PostgreSQL 16;
  legacy LMS backfill, licensed enrollment, separate assessment attempts,
  certificate scope, immutable course ownership, Venture backfill and assigned
  member/staff read checks passed.
- Initial Venture access, service, repository, context and portal checks:
  **55 tests passed across 5 suites**. Venture migration acceptance passed in
  the isolated synthetic PostgreSQL runner.
- `npm run i18n:parity` completed successfully.
- Targeted ESLint: **zero errors, five warnings**. This is not a full-repository
  lint result; the warnings include existing hook diagnostics and the deliberate
  full-page navigation when the active organisation changes.
- Full `npm run lint`, `npm run build`, full staging-schema validation and the
  browser pilot remain unvalidated after the merge.

PostgreSQL checks run one disposable container at a time, without network or host
data mounts, limited to **one CPU and 384 MiB**. Containers are stopped afterwards.
No migration or fixture write targets `.env.local`, which is identified as production.

The merge of `origin/interns` into `white_label_os` was committed as
`26524454`. White-label changes remain uncommitted in the worktree and are not
included in that merge commit. The pre-merge stash remains as `stash@{0}` because
repository checks show five missing stash blobs and six zero-byte loose objects.
The current locale/helper files were restored, and one missing branding test was
reconstructed as a focused test; the exact original blob versions cannot be
verified from available packs. Keep the stash; do not apply it again or drop it.
Full repository recovery needs a known-good copy of those blobs or a verified
backup/clone.

## Work in progress and remaining work

| Area | Current status | Completion requirement |
|---|---|---|
| Organisation home and branding | Implemented locally | Validate brand editing, safe fallbacks, switching and enabled-module routing in the staging browser. |
| Core Programme management | Implemented locally | Final review and a complete browser journey on isolated staging. |
| Internal/client isolation | In progress | Check all relevant indirect APIs, existing DB policies/triggers, exports, files and jobs before activation. |
| Local isolation review | Partial | Dedicated client Programme/branding boundary and selected platform-only Programme surfaces reviewed and tested. Participant Knowledge Bank reads are now limited to `program.note_id` with focused tests; legacy APIs, files/links, invitations, jobs and staging verification remain. |
| Programme operational features | Pending | Review facilitator allocation, attendance, assignments and other operations before exposing them to clients. |
| Organisation/member onboarding | Pending | Controlled provisioning, invitations, delegated roles and removal/revocation journeys. |
| Supervision administration | Pending | Mandate administration procedure/UI and an agreed boundary for the new workspace. |
| Global verification | Incomplete | Complete lint, build and staging-schema checks on a suitable environment; no green-build claim yet. |
| Full fictional-client pilot | Pending | Two clients plus Future Studio; browser flows, expiry, revocation, annual history, performance and recovery. |
| LMS | Initial read-only slice implemented locally | Assign roles through an approved provisioning path, apply migrations to verified staging, exercise both role journeys in a browser, and finish the indirect-access review. |
| Venture | Initial assigned-read slice implemented locally | Validate migration and schema compatibility on isolated staging; inventory related data and legacy routes; then run a two-organisation browser pilot before any client enablement. |
| Real-client opening | Blocked by preparation safeguards | Authorised review of complete evidence, launch decision and monitored deployment. |
| Repository recovery | Blocked on a verified source copy | Five stash blobs are missing and cannot be reconstructed byte-for-byte from current packs; preserve the stash until a backup/clone can be checked. |

## Next solo sequence

1. Preserve the stash and resolve repository object-integrity concerns; keep the
   restored white-label changes out of the merge commit until reviewed.
2. Agree the first pilot's functional boundary and finish the full internal/client
   isolation review, including the original database behavior not represented by
   the synthetic reconstruction.
3. Validate the client home, branding, Programme management and recovery flows
   in a browser against isolated staging with two fictional client organisations.
4. Complete lint, compilation, staging-schema and deployment/recovery checks on a
   machine or runner that can support them safely.
5. Implement only the onboarding and Programme operations selected for the pilot;
   open no client access until all activation gates are reviewed and cleared.
6. Validate LMS and Venture migrations, roles and read journeys on isolated
   staging; keep both client modules closed until the complete isolation review.

Annual cohort/enrollment/session history and initial LMS/Venture tenant
boundaries are locally tested. LMS course-content playback, client role
provisioning, Venture schema validation and related data isolation, client file
access, offboarding and restoration still need implementation or validation. No
delivery percentage or launch date is claimed without a reviewed solo baseline.

## Solo working method

Reuse existing modules, preserve data and work in reviewable increments. Run one
heavy check at a time. Record the environment and results actually observed.
Christelle's implementation and tests do not replace an independent security
review. If a team is assigned, reassess capacity before using the team calendar.

The management PDF dated 22 October remains a historical snapshot. This Markdown
report and the dated handover describe subsequent local progress.

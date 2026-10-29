# White-Label Programmes — Local implementation handover

Prepared by Christelle FAGBEHOURO · Updated 29 October 2026 · Branch `white_label_os`

## Delivery scope

The separate client portal now includes an organisation home, organisation
branding, programme creation and editing, annual cohorts, cohort enrollments
and scheduled sessions. It reuses existing contacts, authentication cookies,
programme records, session records and UI components. Existing internal
operations and existing read-only client role ceilings are preserved. New
management rights require explicit assignment of a new role.

**This is a local implementation, not a production launch.** No migration or
fixture has been applied to the real application database. The original database
lock still refuses client activation and client programme creation. Do not remove
that lock to demonstrate this increment on production.

## What a client can do

1. Open `/o/select`, authenticate through the existing login and choose an
   organisation they are currently authorised to access. The organisation home
   shows module cards; only modules enabled by the server are open. In the
   current delivery, LMS and Venture are not available to client organisations.
   Programmes use
   `/o/[organisation-code]/programs` and `/o/[organisation-code]/programs/[programme-id]`,
   including direct links and browser navigation. The URL cannot select
   or broaden their organisation context.
2. View the organisation's display name, logo and accessible primary colour.
   A member with the explicit `organization_admin.branding.edit` capability can
   update those settings; unsafe logos and low-contrast colours fall back safely.
3. Search and paginate the organisation's programmes. An explicitly authorised
   organisation programme editor can create a programme.
4. Open a programme, edit its basic details and create separate annual cohorts.
   A 2028 cohort does not replace the 2027 cohort or its enrollments.
5. Open a cohort's scheduled sessions. Authorised managers can schedule and edit
   sessions with a title, description, programme week, UTC start and duration.
   The list displays dates in the viewer's browser timezone. Meeting links,
   facilitator allocation, attendance, assignments, reminders and emails are
   outside this increment; no external communication is sent.
6. An organisation programme editor can search active organisation members and
   enroll them in a cohort. Programme coordinators can consult and close existing
   enrollments in their assigned programmes, without an organisation-wide member
   directory. The portal does not create accounts or send invitations yet.
7. Close enrollments and sessions, then close the cohort and finally the programme.
   Closing a cohort with active enrollments or unfinished sessions is refused.
   Closing a programme with open cohorts is refused. Completed/archived records
   remain available as history and cannot be reopened or deleted through the portal.

An existing membership and an explicit programme role are prerequisites. Merely
being enrolled in a cohort does not grant internal platform roles, LMS access or
Venture access. Client invitations and participant-specific learning journeys are
separate delivery work.

## Access rights

| Role | Programme list / cohort / session metadata | Create programmes | Edit programme, cohort and session | Enrollment names and history | Organisation directory / new enrollment |
|---|---|---|---|---|---|
| Existing `org_admin` template | Within its organisation | No | No | No | No |
| Existing `program_manager` template | Assigned programmes | No | No | No | No |
| New `organization_program_editor` template | Within its organisation | Yes | Yes, while open | Yes | Yes, active eligible members only |
| New `program_coordinator` template | Assigned programmes | No | Yes, while open | Assigned programmes; may end existing enrollments | No |
| Internal Future Studio identities | No implicit client-portal access | No | No | No | No |

All rows still require an active organisation, current signed contract, enabled
Programmes module, valid session and active membership/role. An explicit view deny
wins over a management role. Positive grants cannot exceed the template's ceiling.
Suspension denies all client access, including reads. A platform/global role is
never a client-management bypass.

The existing Future Studio supervision APIs still provide the previously bounded
programme list/detail with a current, explicit temporary read mandate and recorded
usage. They do not yet expose the new cohort, session and enrollment workspace or
provide administration/invitation screens. A read mandate does not authorise writes.
The branding migration separately grants `org_admin` the `organization_admin.branding.edit`
capability; it does not grant that role write access to Programmes.

## Safeguards implemented

- Client authentication uses a dedicated read-only lookup. Browsing `/api/org/**`
  and the supervised Programme endpoints no longer runs the general `initDb`,
  internal session cache or lazy token-hash backfill. Other legacy application
  paths are outside that statement.
- Every mutation requires same-origin evidence, JSON input, a freshness header,
  validated identifiers and an explicit management capability. An organisation ID
  in a URL/body never becomes ownership authority.
- Writes lock the authenticated session and programme. Context changes serialize
  against the same session. Access is reread before success is released; failure
  rolls back business changes and audit together.
- Revisions reject stale edits. The programme revision is read in a new statement
  after acquiring the programme lock, avoiding a stale joined revision after waiting.
- Composite database references bind programme, cohort, session and membership
  to the same organisation. Session links point to existing `v2_sessions` records;
  annual enrollments remain separate from internal `participant_programs` to
  avoid automatic internal role/group reconciliation.
- Closed history, ownership, cohort year and association identity are protected.
  Audits record actor, request, changes and relevant revisions. No tokens or
  credentials are included in audit events.
- Lists are bounded and paginated. The simple viewer receives cohort counts and
  session metadata; enrollment names require management access. Contact email,
  phone, credentials, private files and internal notes are not returned.
- New tables deny direct browser-role access. This is not a claim that every
  existing root-table RLS policy or internal API has been exhaustively validated.

## Additive migrations and order

1. `20261023_white_label_programs_foundation.sql`
2. `20261023_white_label_programs_history.sql`
3. `20261023_white_label_programs_supervision.sql`
4. `20261029_white_label_programs_management.sql`
5. `20261029_white_label_programs_sessions.sql`
6. `20261029_white_label_branding.sql`

The new migrations add tables, indexes, references, safeguards and the explicit
branding capability for the existing `org_admin` template. They do not delete
business rows, rename existing columns, rewrite legacy owners, broaden existing
Programme permissions or unlock client activation. They are not registered in
runtime schema maintenance. Deployment is a separately reviewed operation.

The branding increment adds a logo URL, display name and accessible primary colour
for an organisation. The context API returns these values; only a member with the
explicit `organization_admin.branding.edit` capability sees the editor. The schema,
route and UI are local code only and have not yet been applied or validated on staging.

## Verification

Latest targeted verification after merging `origin/interns` into
`white_label_os` (merge commit `26524454`):

- White-label and organisation suites: **142 tests passed across 11 suites**.
- Isolation and internal-boundary suites: **150 tests passed across 9 suites**;
  authorization route/scope census: **47 tests passed across 5 suites**.
- Venture merge-conflict suites: **11 tests passed across 2 suites**.
- `useApi` hook suite: **21 tests passed**. The resolution preserves
  `cache: false`/`no-store` behavior and caches only successful responses while
  retaining the hook's established HTTP-error reporting contract.
- Six additive migrations applied twice in an offline, synthetic PostgreSQL 16
  container. Branding audit/capability/deletion protections and programme
  management, supervision, workspace and client-context checks passed.
- `npm run i18n:parity` completed successfully.
- Targeted ESLint completed with **zero errors and five warnings**. This was not
  a full-repository lint run; the warnings include existing hook diagnostics and
  the intentional full-page navigation used when switching organisation.
- `npm run build`, full `npm run lint`, staging browser testing and a full
  staging-schema validation have **not** been completed after the merge.

These are local automated checks, not staging or production evidence. No
migration or fixture was applied to the live application database.

The local isolation review confirms the dedicated client route boundary, scoped
Programme SQL, audited writes and selected platform-only internal readers. It
does **not** close the full indirect-API, file/link, invitation, notification,
job or existing-trigger review. See
[menaces et recette](RECETTE_ET_MENACES.md) for what was checked and what
remains blocked. The review found and fixed a legacy participant-resource
scope issue: the detail service now returns only the non-archived knowledge
note explicitly linked through `program.note_id`, and attachments for that
note only. If a programme has no linked note, it returns no Knowledge Bank
resources. Focused model/service tests cover the query and wiring; verify this
change on staging before client participant access.

The additional representative reconstruction uses the earlier read-only metadata
export: 308 tables, 3,472 columns and 793 constraints, with synthetic records only.
It excludes original triggers, functions, RLS policies and non-constraint indexes.
It is not a full staging clone, a performance test or a backup-restoration exercise.

Reproduce on an installed Docker image, one check at a time:

```bash
python3 scripts/white-label/run-isolated-programs.py --output /tmp/wl-programmes.json
# Optional, using a previously authorised metadata-only catalog export:
python3 scripts/white-label/run-isolated-programs.py --metadata /path/to/metadata.json --output /tmp/wl-representative.json
```

Both modes require the existing `postgres:16-alpine` image, create a database
without network or host data mounts, and limit PostgreSQL to one CPU / 384 MiB.
They never read `.env.local`. Source metadata and generated local reports must not
be committed or sent as customer/business data.

## Remaining launch requirements

- Validate the entire exposed client journey in a real browser on an isolated
  staging environment, including authentication, two client organisations,
  organisation switching and branding, revocation, old tabs, all new management
  forms and restored browser pages.
- Complete the internal/client audit of indirect APIs, public links, files,
  exports, background jobs and existing database triggers/RLS policies before
  unlocking activation. Root-list isolation alone is insufficient.
- Provide controlled organisation/member provisioning, invitations and support
  mandate administration. Extend supervision to the new workspace only after
  agreeing its field and permission boundaries.
- Review facilitator assignment, attendance and other operational Programme
  features before exposing them. Do not route client users to legacy internal
  screens as a shortcut.
- Complete compilation, deployment/recovery checks and the authorised launch
  review. No production-readiness certification or delivery percentage is claimed.

LMS and Venture remain separate future increments. This delivery does not activate
those modules or grant their internal access to client accounts.

## Repository integration note

The merge of `origin/interns` into `white_label_os` is recorded as
`26524454`. The white-label implementation and this handover remain local
worktree changes and are not part of that merge commit. The pre-merge snapshot
is still retained in `stash@{0}`. Repository checks find five missing blobs
referenced by that stash and six zero-byte loose-object files, including one
unreferenced empty object. The missing stash content corresponds to the English
and French common locales, the branding helper, and two branding test files.
Current worktree versions exist for the locale and helper; one test was
reconstructed. The original stash versions cannot be verified from the available
object packs. Do not apply the stash again or drop it. Full recovery needs a
known-good copy of those exact blobs or a verified backup/clone.

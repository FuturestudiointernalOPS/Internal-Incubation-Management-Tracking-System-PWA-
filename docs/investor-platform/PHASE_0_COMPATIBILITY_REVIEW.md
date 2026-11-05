# Investor Platform — compatibility and access review

Date: 5 November 2026. Owner: Christelle FAGBEHOURO. Branch: `venture-A`.
Status: investigated, changes not applied; Phase 0 remains open.

## What the second staging audit confirms

Reproducible query: `scripts/db-audit/investor-phase0-integrity.sql`.
Machine-readable evidence: `STAGING_METADATA_2026-11-05.json` in this directory.
Target reference checked in the previous audit: `mbpaxrfhqqclzyiefuab`.
9 statements succeeded, session read-only ON, no personal records selected.
The selected `feature_flags` keys are configuration records, not user data.

| Check | Observed result | Implication |
|---|---|---|
| Core ownership | `investment_pipeline.investor_id` and `relationship_workspaces.investor_id` reference UUID `investor_profiles.id`; workspace pipeline reference is UUID too | These are the identities to preserve in the current code. |
| New introductions | Only a primary key constraint was returned for `introduction_requests`; investor, pipeline and workspace references are bigint | No matching foreign keys establish links to the existing UUID parents. Do not assume a usable integration. |
| New activity log | Only a primary key constraint was returned for `investor_activity_log`; investor reference is bigint | Existing profile UUIDs cannot simply be inserted into this field. |
| New invitations | Only a primary key constraint was returned for `investor_invitations` | Acceptance/provisioning integration needs independent verification. |
| Row-level protections | RLS disabled on all six selected tables; no RLS policies returned | Application authorization is not backed by row-level protection on these tables. |
| Browser database privileges | `anon` and `authenticated` each have SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES and TRIGGER on every selected table | Review direct Supabase access before treating these records as private or immutable. |
| Custom table triggers | None returned on the six selected tables | No custom append-only trigger was found on the activity log. This is not a full function/privilege audit. |
| New behaviour switches | No rows matched `%investor%`, `investment_module` or `data_room` | The audited keys are not provisioned here. Other names/settings may exist; table presence does not mean new behaviours are flag-gated. |

The six tables are `investor_profiles`, `investment_pipeline`,
`relationship_workspaces`, `investor_activity_log`, `introduction_requests` and
`investor_invitations`. This is a selected audit, not all database objects.

These grants plus inactive RLS are a significant access-control finding. They do
**not**, alone, prove a public internet leak: Supabase REST schema exposure,
credentials/roles used by clients and deployed gateway configuration have not
been tested. No unauthenticated record read or write was attempted. Keep this
finding open until direct-access controls are validated; hiding fields in Next.js
responses would not protect a separate database API that bypasses Next.js.

## Source findings beyond the initial dashboard audit

| Surface | Source evidence | Required later check |
|---|---|---|
| `/api/investor/kpis` GET | Authenticates investor self-service, then returns all `venture_kpis` rows for a supplied venture ID | Future safe-field/mode policy must cover this endpoint; changing only dashboard and Discover is insufficient. |
| `/api/investor/venture-kpis` GET | Returns programme completion, participant count and investment count | These do not match the v2 investor field allowlist. Trace consumers before changing the response. |
| `/api/investor/profile` GET and POST | Model selects `ip.*` or uses `RETURNING *`; controller returns profile directly | Strip internal review fields on reads and mutation responses, preserving expected editable fields. |
| `/api/investor/profile` POST | Calls `upgradeContactRoleToInvestor`; model is guarded by existing `stopRoleMutationEnabled()` | Verify actual identity flag state. Do not overwrite a multi-context account's baseline role to solve navigation. |
| `/api/investor/decisions` POST | `recordDecision` records an investment decision and changes pipeline stage | Phase 5 must also gate this alternate investment path; guarding pipeline POST alone leaves a bypass. |
| Login UI | `src/app/login/page.js` calls `/api/auth/session-login`, sets the session and honours a safe local `next` destination | Use real login, not browser localStorage impersonation or forged cookies. |
| Existing demo seed | `scripts/create_investors.mjs` uses a shared fixed password, directly writes role/profile/preferences and calls runtime initialization | Do not execute it as the Phase 0 pilot. It bypasses the required intake flow and does not prove activation. |
| Existing diagnostic script | `scripts/check_investor.mjs` selects named contacts and notifications and calls `initDb()` | Do not use it as a metadata-only audit. |
| Outbound email guard | `src/lib/email/send.js` blocks placeholder primary recipients using `isPlaceholderEmail`; `.invalid` addresses are blocked | Useful existing safeguard, but not a complete mail sandbox: separate notifications/admin recipients must also be contained. |

## Proposed compatibility approach — for review, not a migration

1. Establish provenance of the existing new tables: search other approved
   branches/deployment history and ask who installed them. A table without a
   migration in this checkout is not proof that it is unused. Do not merge branches
   or drop, rename, reset or retype those tables to make the code fit.
2. Preserve existing UUID primary keys and their core relationships. Reuse the
   venture identity resolver for code/UUID resolution; never cast a UUID to bigint.
3. If no compatible implementation/mapping exists, propose additive UUID reference
   columns on the new tables, with appropriate validated foreign keys. Retain all
   existing bigint fields and records. Backfill only when an explicit, verified
   mapping exists; unmapped historical rows must remain distinguishable. This is
   an option requiring review, not an applied schema decision.
4. Audit actual Supabase client use, roles and REST exposure. Design least-privilege
   grants/RLS for server-owned activity and private investor resources. Keep the
   legitimate server and self-service flows working; do not revoke access globally
   without understanding dependencies.
5. Make new investor flags explicit and off by default using the existing flag
   infrastructure. Their absence must not silently enable new features.
6. Confirm server-written log immutability, event idempotency and the 30-minute
   repeat-view rule with synthetic fixtures on an isolated test target. A primary
   key alone does not guarantee append-only storage.

Security-policy changes need explicit review and regression coverage; they must
not be hidden inside a new UI migration. No remediation above was applied.

## Automated baseline extension

Seven additional existing suites passed: **94 tests**, database/models mocked:

- `investor-application-intake.test.js`
- `investor-portal.account.test.js`
- `investor-portal.test.js`
- `investor-relationships.test.js`
- `investor-ventures-directory.test.js`
- `investor-home-routing.test.js`
- `messaging-mode.test.js`

Together with the prior three suites (20 tests): **10 suites, 114 passing tests**.
They were run serially in two batches with a 384 MiB heap limit and reduced
scheduling priority. They do not establish a working deployed intake, a secure
Supabase API, a real email delivery or browser usability. No product implementation
was changed, and no full compilation was started.

## Remaining Phase 0 evidence

The user confirms possession of existing investor and administrator credentials;
passwords stay with the user. Whether dedicated synthetic accounts already exist
is still unconfirmed. Follow `LOCAL_VALIDATION.md` for a non-destructive first
browser pass. Keep all 29 checklist run statuses NOT_RUN until each action is
actually observed; do not replace browser evidence with unit-test results.

Product-owner approval of baseline/demo data is still required before Phase 1,
as specified in section 7 of the supplied v2 build guide.

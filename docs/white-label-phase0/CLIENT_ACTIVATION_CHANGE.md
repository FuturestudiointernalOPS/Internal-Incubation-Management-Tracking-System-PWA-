# White-label client activation — 19 November 2026

At the owner's explicit request, the migration
`supabase/migrations/20261119_white_label_client_activation.sql` removes the
blanket preparation refusals of client activation and client-owned programme
creation. This supersedes the earlier instruction to retain that blanket lock;
it does not assert that the outstanding isolation review has been completed.

## Scope

- An authorised database operation can set a client organisation to `active`.
- The existing client Programme flow can create client-owned programmes when
  its normal access conditions are met.
- Organisation identity and programme ownership remain immutable. Existing
  triggers, audit, foreign keys, RLS and application access checks are retained.
- Access still requires active membership, suitable capabilities, an applicable
  contract and an enabled module. Suspension still denies client access.
- No organisation is automatically activated; no role, contract, module,
  membership or historical business record is changed.

## Application status — 20 November 2026

At the owner's request, all nine white-label migrations were applied and committed
in a single transaction on staging project `mbpaxrfhqqclzyiefuab`, selected from
`.env.local` after checking its project reference. The read-only preflight found
no organisation tables; the deployment inventory found 17 organisation tables
with RLS enabled. No production connection was used.

Applied in dependency order:

1. `20261023_white_label_programs_foundation.sql`
2. `20261023_white_label_programs_history.sql`
3. `20261023_white_label_programs_supervision.sql`
4. `20261029_white_label_programs_management.sql`
5. `20261029_white_label_programs_sessions.sql`
6. `20261029_white_label_branding.sql`
7. `20261029_white_label_lms_ownership.sql`
8. `20261029_white_label_venture_ownership.sql`
9. `20261119_white_label_client_activation.sql`

The LMS/Venture ownership migrations assign previously unowned legacy records
to Future Studio. LMS uniqueness constraints are replaced with organisation-scoped
unique indexes and the grant checks are expanded to cover the three modules.
No historical business record is deleted. The migrations create the Future Studio
platform organisation and role templates, but no client organisation, client
account, contract, membership or role assignment was provisioned.

Deployment transport: `scripts/white-label/apply-staging.mjs --apply`. It is
restricted to the confirmed staging project, does not run runtime initialization,
and rolls back the whole operation on failure. File hashes and the deployment
inventory were recorded locally in `/tmp/white-label-staging-deployment.json`.
Do not replay the foundation alone: it reinstates the old preparation lock.

No compilation or automated tests were run, as requested. Deployment success and
the inventory are not evidence of complete isolation or browser acceptance.
The outstanding isolation review, browser validation and onboarding work
documented in `PLAN_SOLO.md` remain outstanding.

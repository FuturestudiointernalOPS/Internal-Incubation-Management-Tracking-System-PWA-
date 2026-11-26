# White-label staging test access

## Current status — 29 October 2026

The owner confirmed that `.env.local` points to staging on this workstation.
The read-only check
`node scripts/db-audit/run-readonly.mjs scripts/db-audit/white-label-staging-preflight.sql .env.local`
returned 11 contacts and 3 ventures. It found none of the required
organisation tables, so the white-label database migrations have not been
applied. No MTN organisation or test account has been created.

There is no self-service client organisation/account provisioning flow yet.
The white-label preparation migration also deliberately prevents a client
organisation from becoming active until the isolation review is approved.
Creating only a contact/password would not grant access to the client portal.
Do not disable the migration guard or write client fixtures to staging to work
around this restriction.

## What must happen before login can be tested

1. Complete and approve the bidirectional tenant-isolation and internal-access
   reviews.
2. Define and review the follow-up migration that enables client activation;
   apply the migrations only to a verified staging project. Do not manually
   drop or disable the preparation trigger.
3. Implement or approve a controlled provisioning path for the organisation,
   membership, contract, module and role/capability assignments. This flow
   must create the test user's password as a hash and use a non-deliverable
   test address such as `mtn-tester@example.invalid`.
4. Provision the fictional MTN organisation and a least-privilege test account
   through that approved path; enable only the module being tested.
5. Start the local app against the verified staging environment and sign in.
   The client portal begins at `/o/select`.

Until these gates are complete, there are no valid MTN credentials to provide,
and the client portal cannot be tested end to end. The existing frontend can be
reviewed in code, but this staging database cannot authenticate a client
organisation yet.

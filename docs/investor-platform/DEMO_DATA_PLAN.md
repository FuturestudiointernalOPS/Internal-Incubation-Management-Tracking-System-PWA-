# Synthetic staging scenarios — preparation only

Owner: Christelle FAGBEHOURO. Date: 5 November 2026.
No accounts or rows have been created by this plan. This is a fixture specification,
not an executable seed. Existing UUID/bigint mappings must be resolved first.

## Accounts

| Alias | Purpose | Language / timezone |
|---|---|---|
| INV-DEMO-DEAL | Approved investor-only context; target default Deal flow only | EN / Africa/Porto-Novo |
| INV-DEMO-FULL | Approved investor-only context; target Full pipeline | EN / Europe/Paris |
| INV-DEMO-EMPTY | Approved first-time investor, no pipeline/watchlist | EN / Africa/Porto-Novo |
| INV-DEMO-FR | Approved French-speaking investor | FR / America/Montreal |
| INV-DEMO-MULTI | Member/facilitator with an approved investor context | FR / Africa/Porto-Novo |
| STUDIO-DEMO | Internal reviewer with explicit relevant permissions | EN / Africa/Porto-Novo |
| FOUNDER-DEMO-A/B | Synthetic founders linked to separate ventures | FR / Africa/Porto-Novo |

Use reserved `example.invalid` addresses and generated secrets stored outside Git.
Mark test accounts for metrics exclusion when supported. Do not relabel real accounts.
Use the existing approval/provisioning/activation flow; do not invent a parallel identity.
Phase 0 records the current behaviour; proposed modes are target scenarios if not yet wired.

## Ventures

| Alias | Industry / country | Target deal-flow scenario |
|---|---|---|
| DEMO-PAY | Fintech / Benin | Live raise with synthetic amount, logo and sample deck |
| DEMO-AGRI | Agritech / Togo | Live raise with synthetic amount, logo and sample deck |
| DEMO-HEALTH | Health / Senegal | Live raise with synthetic amount, logo and sample deck |
| DEMO-EDU | Education / Benin | Outside deal flow |
| DEMO-ENERGY | Energy / Ghana | Outside deal flow |
| DEMO-LOGISTICS | Logistics / Benin | Outside deal flow |

Use only fabricated descriptions, founders, country values, logos and deck content.
Record returned canonical IDs in a private local fixture manifest, never assume IDs
or conflate programmes and ventures. Reuse existing campaign structures where compatible.

## Relationships and phase-specific extensions

- Baseline: at least two own pipeline entries and one saved venture; another investor's
  entries for negative access checks; a preference set with no recommendation matches.
- Phase 3: pending, approved, declined and withdrawn introduction examples; public decline
  reason distinct from an internal note; founder sees nothing before approval.
- Phase 4: one proposed, one confirmed future and one past meeting; different timezones;
  unread and read conversations; cancellation/reschedule and six-hour email deduplication.
- Phase 5: one pending, one rejected and one confirmed investment, using fabricated amounts;
  reconcile all cascades and totals, including duplicate confirmations and retries.
- Phase 6: invitation/expiry examples, first-run checklist and versioned NDA disabled by default.

These later scenarios do not imply their features exist today. Record unavailable flows
as NOT_AVAILABLE rather than bypassing approval or directly fabricating successful events.

## Execution safeguards and evidence

Verify staging reference and deployed version before provisioning. Contain outgoing
email/calendar delivery with an existing sandbox/test transport or local substitute
before exercising approval, investment or notifications. No real recipients, no copied
production data. Never enable global new flags merely to create fixtures.

Retain screenshots at 360/768/1280 px in EN/FR, sanitized response field names,
and both independent passes of `BASELINE_CHECKLIST.csv`. Record browser, commit,
fixture aliases and date for every run. Failures remain failures in the baseline;
unit tests cannot substitute for this evidence. Owner approves baseline/demo data
before Phase 1. Preserve fixture history without destructive cleanup.

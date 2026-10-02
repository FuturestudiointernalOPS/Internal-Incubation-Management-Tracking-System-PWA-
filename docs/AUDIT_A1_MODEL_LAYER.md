# Audit A1 — do model modules mix decision and query?

> Read-only audit (CH-5, task **A1**). It answers one question: **does any file
> under `src/models/**` both decide and run SQL in the same function?** A model
> that does cannot be tested without a database, which is exactly what the layer
> split set out to fix.
>
> Companion documents: [`GUIDE_DECOUPAGE_COUCHES.md`](GUIDE_DECOUPAGE_COUCHES.md)
> (the method), [`LAYER_SPLIT.md`](LAYER_SPLIT.md) (the journal),
> [`PLAN_DE_TRAVAIL_STAGIAIRES.md`](PLAN_DE_TRAVAIL_STAGIAIRES.md) (the task
> catalogue). Measured on branch `A`, 2026-10-02.

## 1. Method

1. Every file under `src/models/**` was measured; the **19 files over 600 lines**
   were taken as the scope (the same list the task names).
2. Each file was split into its top-level functions. A function was flagged as a
   **candidate** when its body contains both SQL (`SELECT` / `INSERT` / `UPDATE` /
   `DELETE` / `ALTER` / `CREATE`) **and** a code-level conditional (`if`, `switch`
   or a ternary outside a string).
3. Every candidate was then read by hand and classified:
   - **finding** — the conditional is a *business rule* (a product, permission,
     validation or lifecycle decision) sitting next to the SQL;
   - **accepted** — the conditional only *shapes the request* (a WHERE fragment,
     an optional column, an argument default) or is an empty-list / schema guard.

Step 2 is a heuristic (a mechanical scan cannot read intent); step 3 is what the
verdicts rest on. 76 candidates were produced; the vast majority are request
shaping.

## 2. Verdict

**The model layer is not fully clean.** Eight functions still decide and query in
one place. The four modules the task names explicitly (`authorization`,
`authorization/backfill`, `platform/automation`, `investorRelations`) all appear,
plus four more.

Files **clean** (no function mixes a business rule with SQL): `curriculum.js`,
`contacts.js`, `forms.js`, `formRuns.js`, `groups.js`, `participantPortal.js`,
`platformAi.js`, `programs.js`, `tasks.js`, `ventureWorkspace.js`, `workspace.js`,
`adminOps.js`, `communications.js` (outside `listFollowups`).

## 3. Findings — decision mixed with query

| # | Function | The decision, and why it is not data access | Where it belongs |
|---|---|---|---|
| 1 | `authorization.js` → `getCurrentBaseCapabilities` | The **base-capability precedence**: an active profile override wins, else the role's default profile, else the legacy `role_capabilities` rows. The four SELECTs only feed that rule. | `services/authorization` (the resolver already owns the same precedence) |
| 2 | `communications.js` → `listFollowups` | The **visibility rule**: a participant sees only their own follow-ups, other non-super-admin staff see the ones they assigned plus legacy rows. Mixed into the SELECT's WHERE assembly. | `services/communications` |
| 3 | `investor.js` → `listInvestmentPipeline` | Picks one of **three query variants by caller role**, and encodes a **security scope** ("a non-management session may only read its OWN rows for the venture"). The comment records it as a fix for a leak, so the rule is load-bearing. | `services/investor/pipeline` |
| 4 | `investorRelations.js` → `listRelationshipWorkspaces` | **Scope on the profile, not the role string** — a baseline member holding an investor profile must take the investor branch, not the unfiltered admin branch. A leak fix living with the SQL. | `services/investor/relationships` |
| 5 | `investorRelations.js` → `provisionInvestorFromApproval` | The **provisioning rule**: skip when there is no cid, ensure the schema, create-or-update the profile, and only then write the preference fields. | `services/investor` |
| 6 | `lms/registrations.js` → `createRegistration` | **Input validation** (`throw new LmsError(..., 400)` on a missing name/email) sits inside the INSERT wrapper. Validation is a decision the controller/service should own. | `services/lms` |
| 7 | `platform/automation.js` → `RULES` (+ `syncCrmContact`, `sendAcknowledgementForSubmission`) | The **automation rule engine**: the `condition`/`action` pairs decide whether to email, notify or sync (e.g. "a PAID Execution sends NO email on submission", the run→form→default acknowledgement flag) and then run the SQL to do it. | `services/platform/automation` |
| 8 | `authorization/backfill.js` → `ensureFeatureKeyAlignment` | A **key alignment/dedup rule** (which of two rows survives, and the re-key) applied while writing. | `services/authorization` |

## 4. Accepted — reviewed and left in place

These matched the scan but make no product decision, so they stay in the models:

- **WHERE builders** — `forms.findMaxSubmissionVersion` / `listSubmissions`,
  `groups.querySegmentContacts` / `getOrgTeams` / `getProgramParticipants` /
  `getFamilyGroupRowsByProgram` / `getV2GroupRowsByProgram`, `tasks.getAdminTaskRows` /
  `getAdminBlockerRows`, `workspace.getCalendarTasksWithDates`, `investor.buildVentureSearchQuery`,
  `investorRelations.listInvestorMeetingEvents` / `listInvestorsByApprovalStatus` /
  `listFundraisingCampaigns`, `ventureWorkspace.listVenturesWithCounts` /
  `listVenturesAssignedToStaff`, `participantPortal.getParticipantProgramAssignments`,
  `communications.listFollowups`'s *filter* branches, `lms/registrations.listPaymentEvents`.
  The conditional adds `AND col = ?`; no rule is encoded.
- **Argument shaping** — `adminOps.insertOpReport`, `forms.createPlatformForm` /
  `createPlatformFormField` / `createPlatformCollection`, `programs.createV2Program` /
  `createProgram` / `saveProgramAsTemplate` / `createProgramFromTemplate`,
  `platformAi.*`, `communications.createAnnouncement`, `lms/registrations.recordPaymentEvent`,
  `investor.createInvestmentDecision`. Booleans become `1/0`, options become JSON.
- **Guards** — empty-batch early returns (`participantPortal.*Bulk*`), and the
  schema-bootstrap memo guards (`lms/registrations.ensureCheckoutSchema`,
  `investorRelations.ensureInvestorProfileSchema`, `workspace.ensureNotificationLinkColumn`).
- **Seed/backfill routines** — `authorization/backfill.ensure*Backfill`: the
  `if (profile)` is a guard around idempotent `INSERT ... ON CONFLICT DO NOTHING`
  seeds, not a product rule. (`ensureFeatureKeyAlignment`, which *does* decide, is
  finding #8.)
- **False positives** — `investorRelations.asText` (a pure formatter; the SQL the
  scan saw came from a neighbouring function).

## 5. Limitations

- The scope is the models **over 600 lines**; a mixing function in a smaller model
  would not appear here.
- Classification is a reading, not a proof: reasonable reviewers could move a
  borderline case (#3's variant selection, the backfill routines) to either column.

## 6. Recommended follow-up

Each finding is a small, independent slice in the usual shape (README recipe):
move the rule into the matching `services/<domain>/**`, keep the SQL in the model,
leave a behaviour test. None changes an HTTP response. They are **not** on the
critical path of the current view splits and can be scheduled after them.

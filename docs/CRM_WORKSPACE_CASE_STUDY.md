# ImpactOS — CRM Workspace: Super Admin Case Study

> **Scenario:** an inbound partnership offer arrives (MTN wants to explore a
> partnership). As **Super Admin** you run it through the CRM end to end:
> organization → person → lead → score/qualification → activities & tasks →
> opportunity through a pipeline → segment → automation → timeline.
>
> **Where:** the `/crm` workspace. From the admin sidebar, open
> **CRM → Dashboard** (`/admin/crm`) and use the **CRM Workspace** quick link,
> or open `/crm` directly.
>
> **Status:** every step below is done from the screen. The console
> workarounds of the first version of this case study are no longer needed.
> What was verified, and how, is in [§ 14](#14-how-this-was-verified).

---

## 0. Before you start

1. Sign in as the Super Admin.
2. After a database wipe, run **Permission Center → Seed** once so the `crm`
   module rows are applied to the profiles again.
3. Open **`/crm`**. The hub shows: People, Leads, Opportunities, Activities,
   Pipelines, Segments, Automations, Organizations, Timeline (+ Forms,
   Messages; Membership needs `org_membership.view`).

If the cards do not appear, your effective capabilities lack `crm.view` — check
`/api/me/permissions`.

Action buttons follow the capability their endpoint checks:

| Action | Capability |
|---|---|
| New organization / lead / opportunity / segment, link a person | `crm.create` |
| Score, qualify, move a stage, edit a segment, log an activity | `crm.edit` |
| Edit an organization | `crm.edit` |
| Delete an organization or a segment, remove a person ↔ organization link | `crm.delete` |
| Automations (all of it), create/edit pipelines and stages | `crm.manage` |

---

## 1. Create the organization

`/crm/organizations` → **New Organization** → name (required), type, website,
industry, description → save. The organization appears in the table.

On a row, the pencil edits the organization (`crm.edit`) and the bin deletes it
after confirmation (`crm.delete`, Super Admin). The deletion is a soft delete:
the leads, opportunities and links that point to it are kept.

## 2. Have a person, and link them to the organization

The CRM **People** page (`/crm/contacts`) is a read-only directory. Create the
person in `/admin/communications/contacts` → **Add contact**.

Back on `/crm/organizations`, the **People** button of a row opens the people
linked to that organization. **Link a person**: choose the person, the
relationship type (works for, founded, advises, represents, invested in,
partners with, other) and an optional title. The bin icon removes a link — the
person and the organization are both kept.

## 3. Create the lead

`/crm/leads` → **New Lead**:

| Field | Notes |
|---|---|
| Lead Title (required) | e.g. `MTN Strategic Partnership` |
| Linked to (required) | an **organization** or a **person** — the API refuses a lead without one |
| Lead type | partnership, investor, program, ecosystem, client, sponsor, mentor, other |
| Source | free text, e.g. `inbound` |
| Description | free text |

Attach the lead to the **person** if you want it on their timeline: timeline
events are written to the attached person, not to the organization.

## 4. Score and qualify the lead

`/crm/leads` → the lead → **Intelligence & Qualification**.

- **Calculate** computes the score from what is recorded and lists what it is
  made of (see the rules below).
- **Adjust** sets the score by hand (0–100) with a reason.
- **Evaluate** sets the qualification: Not Assessed / In Review / Qualified /
  Unqualified, with a reason.

Bands: **Priority ≥ 80**, **High ≥ 60**, **Medium ≥ 30**, **Low < 30**.

### Computed score rules

Rule-based and additive, capped at 100 (`src/services/crm/leadScoring.js`):

| Rule | Points |
|---|---|
| Qualification | Qualified 30 · In Review 15 |
| Lead status | Converted 25 · Qualified 20 · Engaged 15 · Nurturing 10 · Contacted 5 |
| Profile completeness | 5 each: organization linked, person linked, source, description |
| Recorded activities | 5 per activity or task, up to 20 |
| Positive outcomes | 5 per activity with a positive outcome, up to 10 |
| Recent activity | 10 if the last one is within 14 days · 5 within 30 days |

Every change of score — computed or manual — is written to the score history
and raises `lead.score_changed`. Qualifying raises `lead.qualified` /
`lead.disqualified`; reassigning raises `lead.assigned`.

## 5. Log an activity and create a task

Lead or opportunity detail → **Activities → Add Activity**: type (Call, Email,
Meeting, Note, Follow-Up, **Task**, Other), title, date, outcome, notes.

A **Task** creates a native ImpactOS task; it is read-only in the CRM panel.
`/crm/activities` is the global feed, filterable by type. The **Next Action**
card shows the earliest upcoming task or meeting.

## 6. Create the opportunity

`/crm/opportunities` → **New Opportunity**: name, pipeline, what it is linked to
(organization, person or **lead**), value, currency, probability, expected close
date, description. It starts on the first open stage of the chosen pipeline.

The page shows Active / Won / Lost / Weighted Value (value × probability).

## 7. Move the deal through the pipeline

`/crm/opportunities/[id]` → click a stage pill. Each move is appended to
**Stage History**. Won/Lost comes from the stage's kind; a **Lost Reason**
appears when lost.

## 8. Manage the pipelines

`/crm/pipelines` lists the pipelines; expanding one shows its stages, with
probability and the won/lost colour. With `crm.manage`:

- **New Pipeline** — name and description.
- On an expanded pipeline: **Add Stage**, **Edit Pipeline**,
  **Activate / Deactivate**.
- On a stage: the arrows move it earlier or later; the pencil edits its name
  and probability; **Retire / Restore** hides it from, or returns it to, the
  stage pills.

A stage is added at the **end** of the pipeline, then moved where it belongs.
Reordering only changes the order: deals stay on their stage and the stage
history is kept. The kind of a stage (open / won / lost) is chosen at creation
and not changed afterwards, because it decides how the deals already on it are
counted.

## 9. Create a segment

`/crm/segments` → **New Segment**: name, description, entity type (Lead or
Opportunity) and **conditions**. A record belongs to the segment when all the
conditions hold; no condition means every record.

| Entity | Fields |
|---|---|
| Lead | status, lead type, qualification, score, source |
| Opportunity | status, value, probability, currency, stage |

**View records** on a segment card lists the leads or opportunities that match
right now. A segment is a saved filter, not a stored list.

## 10. Create an automation rule

`/crm/automations` → **New Rule**: name, description, entity type, trigger,
then conditions and actions. The triggers follow the entity type:

| Entity | Trigger | Raised when |
|---|---|---|
| Lead | `lead.qualified` / `lead.disqualified` | the qualification is set |
| Lead | `lead.score_changed` | the score is computed or adjusted |
| Lead | `lead.assigned` | the owner changes |
| Opportunity | `opportunity.created` | an opportunity is created |
| Opportunity | `opportunity.stage_changed` | it moves to another stage |
| Opportunity | `opportunity.won` / `opportunity.lost` | the move closes the deal |


- **Conditions** — same builder as segments; the rule only runs when they hold.
- **Actions**, run in order — *Create a task* (title, priority), *Add a note to
  the record* (title, note), *Change the status*.

Use **Enable / Disable** on the rule, and the clock icon for its **execution
log** (success / failed / skipped, with the record and the error if any).

**Live test:** enable a rule on `lead.qualified` with a *Create a task* action,
qualify the lead (step 4), then open the rule's execution log. The same works
on a deal: a rule on `opportunity.won`, then move the opportunity to its Won
stage (step 7).

## 11. Timeline and membership

- `/crm/timeline` → pick the person → their events by year, filterable by
  module. A lead attached to the person appears as `lead_created`.
- `/crm/membership` (needs `org_membership.view`) → read-only roster.

---

## 12. State at the end of the case study

| Object | Where to verify |
|---|---|
| 1 organization, 1 person linked to it | `/crm/organizations` → People |
| 1 lead, scored and qualified | `/crm/leads` → detail |
| 2 activities (call + task), 1 native task | `/crm/activities` |
| 1 opportunity with stage history | `/crm/opportunities/[id]` |
| 1 segment listing its records | `/crm/segments` → View records |
| 1 automation rule with executions | `/crm/automations` → execution log |
| Person timeline with CRM events | `/crm/timeline` |

## 13. Findings of the first run — status

| # | Finding | Status |
|---|---|---|
| — | "New Organization" opened nothing; organization, lead and opportunity lists always empty | Fixed |
| 1 | Lead form could not succeed (no person / organization sent) | Fixed |
| 2 | "New Opportunity" linked to a page that does not exist | Fixed — form in a dialog |
| 3 | No screen to manage pipelines | Added (create, edit, activate, stages) |
| 4 | Segment conditions, automation conditions/actions, execution log | Added |
| 5 | No screen to link a person to an organization | Added |
| 6 | Segment / automation buttons not capability-gated | Fixed |
| 7 | Score was manual only | Computed score added; manual adjustment kept |
| 8 | `needs_review` vs `in_review` | Aligned on `in_review` |
| 9 | Super Admin had no link to `/crm` | Quick link on `/admin/crm` |
| — | No screen to edit or delete an organization | Added |
| — | Stages could not be reordered | Added |
| — | Automations had no opportunity trigger | Added (created, stage changed, won, lost) |

Still open:

- Automation and segment endpoints still answer some errors as plain English
  sentences rather than translation keys.

## 14. How this was verified

- **Screen tests** (jsdom, API mocked) — `src/__tests__/crm-workspace-ui.test.js`
  and `src/__tests__/crm-workspace-management-ui.test.js` click the buttons,
  fill the forms and assert the request that leaves the page.
- **Decision tests** — `src/__tests__/crm-lead-scoring.test.js` covers the
  score rules and segment membership.
- **Route tests** (models mocked) — `src/__tests__/crm-pipeline-events-api.test.js`
  covers the events a stage move raises and the validation of a reorder.
- `npm run lint`, `npm test` and `npm run build` pass.

**Not yet done:** a run of this case study in a browser against the staging
database. The screens were not exercised against the real API or real data, so
do that run before promoting — it is the pass that would catch a mismatch
between a form and the database (a constraint, a column, a seeded pipeline).

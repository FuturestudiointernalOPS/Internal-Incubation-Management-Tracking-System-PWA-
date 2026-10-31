# ImpactOS — New CRM: Super Admin Case Study

> **Scenario:** an inbound partnership offer arrives (MTN wants to explore a
> partnership). You are the **Super Admin**. You run it through the new CRM
> end to end: organization → person → lead → score/qualification → activities &
> tasks → opportunity through a pipeline → segment → automation → timeline.
>
> **Where:** the staging site, logged in as `gclud79@gmail.com`. The new CRM is
> the `/crm` workspace. Open **`/crm` directly** — the admin sidebar's
> CRM → Dashboard still goes to the old `/admin/crm` overview.
>
> **Honesty note:** every step below was checked against the shipped code. Two
> steps **cannot be done from the UI today** (the lead form and the "New
> Opportunity" button are broken) — the case study shows the exact workaround
> and records them as fixes to make.

---

## 0. Before you start

1. Sign in on staging as the Super Admin.
2. Go to **Permission Center → Seed** once (you just wiped the database), so the
   `crm` module rows are applied to the profiles again.
3. Open **`/crm`**. You should see the workspace hub with the cards: **People,
   Leads, Opportunities, Activities, Pipelines, Segments, Automations,
   Organizations, Timeline** (+ Forms, Messages; Membership needs
   `org_membership.view`).

> If the cards don't appear: your effective capabilities lack `crm.view`
> (re-run the seed, or check `/api/me/permissions`).

---

## 1. Create the Organization

**Path:** `/crm` → **Organizations** card → **New Organization**

| Field | Example |
|---|---|
| Organization name (required) | `E2E-MTN Benin` |
| Type | Company / NGO / School / Investment Fund / Government / Other |
| Website URL | `https://mtn.example` |
| Industry or sector | `Telecoms` |
| Short description | `Inbound partnership lead — case study` |

**Save.** The org appears in the table (name / type / industry / website link).

*Expected state:* 1 organization. *(Edit/delete and contact-linking have no UI
yet — API only.)*

---

## 2. Have a Person to attach

**Path:** the CRM **People** page (`/crm/contacts`) is a **read-only directory**
— it cannot create people. Create the person in the classic contacts screen:
`/admin/communications/contacts` → **Add contact** (name, email, role
`member`). Note the person's email; you'll need the `cid` only if you attach a
lead to the person instead of the organization.

---

## 3. Create the Lead — ⚠️ UI is broken, use the 30-second workaround

**Path:** `/crm/leads` → **New Lead** → the modal has only **Lead Title**.
Submitting fails: the API requires the lead to be attached to a **person or an
organization** (`crm.leads.targetRequired`), and the shipped form never sends
either. **Known bug #1.**

**Workaround (works today):** stay logged in on the staging site, open your
browser DevTools → Console, and paste:

```js
// 1) Grab the organization you created in step 1
const orgs = (await (await fetch('/api/crm/organizations')).json()).organizations;
const orgId = orgs[0].id;

// 2) Create the lead attached to it
const lead = await (await fetch('/api/crm/leads', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'MTN Strategic Partnership',
    organization_id: orgId,
    lead_type: 'partnership',
    status: 'new',
    source: 'inbound',
    description: 'Inbound partnership offer — Super Admin case study'
  })
})).json();
console.log(lead);   // keep lead.lead.id for later steps
```

Refresh `/crm/leads`: the lead appears in the table (Lead Title, Status,
Qualification, Owner) and is searchable.

> *To also exercise the person timeline later, repeat the call with
> `contact_cid: '<the person cid>'` instead of `organization_id` — timeline
> events are written to the attached **person**, not the organization.*

---

## 4. Score and qualify the lead (UI works)

**Path:** `/crm/leads` → click the lead → detail page.

- **Adjust Lead Score** — enter **Score (0–100)** + **Reason / Notes**.
  Bands: **Priority ≥ 80**, **High ≥ 60**, **Medium ≥ 30**, **Low < 30**.
  Scoring is **manual** today (no computed score).
- **Evaluate Lead** — **Qualification State**: Not Assessed / In Review /
  Qualified / Unqualified (Disqualified) + reason.

These actions record events the automation engine listens to:
`lead.score_changed`, `lead.qualified`, `lead.disqualified`, `lead.assigned`.

*Expected state:* the lead shows your score band and qualification; the
Relationships block shows the organization and you as Owner.

---

## 5. Log the activity — and create a real task (UI works)

**Path:** lead (or opportunity) detail → **Activity panel → Add Activity**.

| Field | Values |
|---|---|
| Type | Call, Email, Meeting, Note, Follow-Up, **Task**, Other |
| Title | "What happened or what needs to happen?" |
| Date | the activity date |
| Outcome | No Outcome, Positive, Neutral, Negative, No Response, Rescheduled, Completed (hidden for Task) |
| Notes | free text |

- Add a **Call** ("First call with MTN procurement", Outcome: *Positive*).
- Add a **Task** ("Send partnership deck by Friday") — this creates a **native
  ImpactOS task** (it lives in the platform's task modules; it is read-only in
  the CRM panel).

**Path:** `/crm/activities` shows the global feed, filterable by **Type**
(All Types, Call, Email, Meeting, Note, Follow-Up, Task, Other).

*Expected state:* 2 activities; 1 native task; the lead's **Next Action** card
shows the upcoming task.

---

## 6. Create the Opportunity — ⚠️ the button is dead, use the workaround

**Path:** `/crm/opportunities` → the **"New Opportunity"** button links to
`/crm/opportunities/new`, **which does not exist (404)**. **Known bug #2.**

**Workaround (works today)** — same Console:

```jsproceed

// 1) Pick a pipeline (3 seeded pipelines of 7 stages each)
const pipelines = (await (await fetch('/api/crm/pipelines')).json()).pipelines;
const pipelineId = pipelines[0].id;

// 2) Create the opportunity on its first stage
const opp = await (await fetch('/api/crm/opportunities', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'MTN rollout — Phase 1',
    pipeline_id: pipelineId,
    organization_id: orgId,          // reuse the id from step 3
    value: 15000000,
    currency: 'XOF',
    probability: 40,
    expected_close_date: '2026-12-15',
    description: 'Created during the Super Admin case study'
  })
})).json();
console.log(opp);   // keep opp.opportunity.id
```

(Attaching it to the **lead** instead: pass `lead_id`.)

Refresh `/crm/opportunities`: metric cards (**Active / Won / Lost / Weighted
Value** — Value × Probability), the deal row (Pipeline & Stage, Value,
Probability, Status, Owner).

---

## 7. Move the deal through the pipeline (UI works)

**Path:** `/crm/opportunities/[id]` → click a **stage pill** to move the deal
(the current stage is disabled). Every move is appended to **Stage History**
(From → To, changer, date). **Won/Lost is derived from the terminal stage
flags** — the terminal stages are the green/red pills; a **Lost Reason** field
appears when lost.

Follow it through: *Contacted → Qualified → Proposal → Negotiation → Won (or
Lost)*. Watch the `/crm/opportunities` metrics move ("Weighted Value" changes as
probability × value updates).

---

## 8. Review the pipelines (read-only)

**Path:** `/crm/pipelines` → accordion of the **3 seeded pipelines × 7 stages**
each, with per-stage probability and green/red terminal (`won`/`lost`) flags,
plus an *Inactive* tag on disabled ones.

*Editing* (create pipeline, add/edit stages) has **no UI** — the APIs exist
(`crm.manage`) but no screen calls them. **Gap #3.**

---

## 9. Create a Segment (limited today)

**Path:** `/crm/segments` → **New Segment** → **Name**, **Description**,
**Entity Type** (Lead or Opportunity) → save.

Today a segment is a **labelled container**: the footer says *"Condition builder
will be available in a future update"*. The page lists segment cards — not the
matched records yet. **Deferred feature.**

---

## 10. Create an Automation rule (limited today)

**Path:** `/crm/automations` → **New Rule** → **Name**, **Description**,
**Entity Type** (Lead / Opportunity), **Trigger Event**:
`lead.qualified`, `lead.disqualified`, `lead.score_changed`, `lead.assigned`.

- Save, then use the **Enable/Disable** toggle.
- The footer says *"Condition and Action builder will be available in a future
  update. For now, actions trigger unconditionally."* The engine underneath
  already supports conditions and actions (`create_task`,
  `add_timeline_event`, `update_field`) — but there is no UI yet, and the
  **execution log is API-only**.

**Live test:** with the rule enabled, go back to the lead and change the score /
qualification (step 4). The engine fires and records an execution (visible via
`GET /api/crm/automations/[id]`).

---

## 11. Timeline and Membership

- **`/crm/timeline`** → pick the **person** (contact) you attached a lead to →
  their timeline grouped by year, filterable by module (All, Forms, Programs,
  Ventures, Investors, Communications, System). The lead you attached to the
  person appears as a `lead_created` event.
- **`/crm/membership`** (needs `org_membership.view`) → read-only view: group
  tabs, filters (membership status, role, account status), columns and a detail
  modal (Person, Membership, history events). Write actions (Add Member, Renew,
  Deactivate) are not exposed in this screen.

---

## 12. State at the end of the case study

| Object | Where to verify |
|---|---|
| 1 organization | `/crm/organizations` |
| 1 lead, scored + qualified | `/crm/leads` → detail |
| 2 activities (call + task), 1 native task | `/crm/activities`, task modules |
| 1 opportunity moving stages, with stage history | `/crm/opportunities/[id]` |
| 1 segment (container) | `/crm/segments` |
| 1 automation rule enabled, executions recorded | `/crm/automations` |
| Person timeline with CRM events | `/crm/timeline` |

---

## 13. What is broken or missing (fix list for the team)

| # | Finding | Impact |
|---|---|---|
| 1 | **Lead create form cannot succeed** — it never sends `contact_cid`/`organization_id`, and the API requires one (`crm.leads.targetRequired`) | Blocks the main CRM entry point from the UI |
| 2 | **"New Opportunity" button 404s** — links to `/crm/opportunities/new`, no page exists | Blocks opportunity creation from the UI |
| 3 | Pipeline management has no UI (create/edit/stages) | Admin can only review |
| 4 | Segment conditions and automation conditions/actions are deferred; executions have no UI | Features are placeholders for now |
| 5 | No UI to link a contact to an organization (relationship types exist in code) | Relationships only via API |
| 6 | Automations/Segments buttons are not capability-gated client-side | A `crm.view`-only user sees buttons the API (403) rejects |
| 7 | Score is manual; no computed scoring | By design for now |
| 8 | Lead qualification state mismatch: list uses `needs_review`, the panel uses `in_review` | Inconsistent filter values |
| 9 | Sidebar (Super Admin) never links `/crm` — CRM → Dashboard opens `/admin/crm` | The new workspace is URL-only for the SA |

---

*End of case study. Everything marked "UI works" was verified against the
shipped components; the two workarounds exist because the UI paths are broken,
not because the workflow is designed that way.*

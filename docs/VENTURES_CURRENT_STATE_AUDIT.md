# ImpactOS — Ventures Module: Current-State Audit & Requirements Discovery

**Mode:** read-only. No application code, schema, or data was modified. No
migrations, no sample records, no permission changes.
**Date:** 2026-10-23 · **Audited HEAD:** `3952cdd1` → `b1f2dadf` (an external
commit adding `src/migrations/054_venture_data_room_grants.sql` landed during the
audit; nothing else moved).
**Evidence base:** current source, git history, and **read-only** queries against
the **staging** database (`.env.audit-staging`; never `.env.local`, which points
at the production-looking project). Production was **not** queried.
**Tags:** `[V]` verified in code and/or staging data · `[I]` inferred from code ·
`[U]` unverified (would need runtime click-through).

> **Missing reference document.** The document named *“ImpactOS: Ventures Module
> — Business Analysis and Data Requirements — Consolidated Working Document”* is
> **not in this repository**. Section G therefore compares the implementation
> against (a) the information flow and category list in your brief and (b) the
> two venture documents that do exist: `docs/VENTURE_SETUP_AUDIT.md` and
> `docs/VENTURE_IDENTITY_PHASE0.md`. Please provide the consolidated document to
> make the comparison exact.

> **Staging footprint at audit time** `[V]`: 3 ventures (all
> `business_stage = 'idea'`), 2 journey stages, 7 milestones, 27 tasks, 28
> deliverables, 12 deliverable reviews, 2 sessions, 12 Data Room document types,
> 2 documents, 2 founder memberships, **0** `venture_founders` rows, **0**
> business-model rows, **0** KPI rows, **0** updates, **0** written reports, **0**
> standups, **0** notifications. The schema and code paths are verified; high
> usage volumes are not.

---

## Section A — Executive Summary

**What the module is today.** The Ventures module has become a credible
**work-execution system**: Super Admin creates a venture and invites a founder;
the founder accepts and gets an owned membership; staff define a journey,
milestones, tasks and deliverables; founders submit evidence; managers review it;
sessions are booked; the Data Room holds and versions documents. Permissions are
capability + record-scope based, and the computed journey report already
assembles operational facts live.

**What it is not yet.** It is **not a business-performance system**. There is no
structured initial baseline, no periodic business reporting, no financial,
customer, employment or impact data, and no reliable way to compare ventures on
performance. The profile is thin, partly unreachable, and internally
inconsistent.

**Most important recent changes** `[V]`:
- **Data Room became the readiness engine** (2026-10-21 → 10-23): grants,
  versions, reviews, access logs, completeness calculation; "Stage & Evidence"
  score added; a readiness card was deliberately removed with a "no figure" note.
- **Progress/readiness unified on live work**: approved deliverables drive
  percentages; analytics reads the Data Room; the old profile-completion figure
  was retired from the list.
- **Identity Phase 0**: `ventures.id` (UUID on staging) is the stored reference;
  `VNT-…` remains the access key; readers flipped; writer sweep largely done; the
  **storage conversion was NOT run**.
- **Company status vocabulary** centralized: `prospect | active | paused |
  graduated | archived` (legacy `pending → prospect`).
- Journey UI consolidation and several dashboard/profile edits.

**Key findings** (details in C–F):
1. **No baseline exists** — verified again against the live schema: the 33
   `ventures` columns contain no financial figure, no `as_of`, no period, no
   headcount. Financials live only as Data Room documents (`[V]`).
2. **The profile is much thinner than the business categories** — no problem /
   solution / value proposition / target customer / product maturity / 90-day
   objective / pricing / sales channels / delivery model / year founded / legal
   structure / city / address / team size (`[V]`).
3. **Several collected fields are unreachable or silently erased** — business
   model is API-only; `north_star`, `logo_url`, `visibility`, `language`,
   `programme_type` have no UI; a founder profile save writes `country`,
   `registration_status` and `north_star` as **NULL** (`[V]`).
4. **Readiness is fragmented** — four live readiness numbers plus one retired
   engine; the admin Reports page shows **three different "completion" values**
   (14 %, 18 %, 17 % on the same venture) (`[V]`).
5. **Two founder/team paths are broken** — the founder "Invite Member" UI is
   commented out; the admin "Invite Founder" writes an unconsumed legacy ledger
   and sends no email (`[V]`).
6. **Several datasets are collected but invisible** — weekly standups/retros,
   session attendance, venture updates and milestone activity have no screen
   (or no writer) (`[V]`).
7. **A mature core is reusable**: journey stages, sessions, Data Room versions,
   deliverable reviews and written reports already form a time series that
   recurring reporting can use **without** founders re-entering data (`[V]`).

**Decisions blocking progress** (Section H): profile scope, baseline object,
reporting periods, KPI history, one readiness definition, rejected-evidence
rule, null-vs-zero semantics, stage vocabulary, founder roster, employment
definitions, impact indicators, investor field source.

---

## Section B — Verified Current Capabilities

| Capability | Status | Evidence |
|---|---|---|
| Super Admin creates a venture (name + founder email) | **Working** `[V]` | `/admin/ventures` modal; `POST /api/admin/ventures/create`; `services/dashboard/adminVentures.js`; writes `ventures` + `venture_origins`; duplicate-name 409 |
| Founder invitation + acceptance | **Working** `[V]` | `venture_member_invitations` (7-day token); `/venture-invite/[token]`; creates contact + `venture_members` membership; first founder becomes owner/lead |
| Founder edits the venture profile | **Working with defects** `[V]` | `ProfileTab` → `PUT /api/ventures`; `ventures.edit` + `venture_own`; **silently nulls `country`, `registration_status`, `north_star`** |
| Founder invites team members | **Disabled** `[V]` | Invite button/modal commented out in `components/ventures/workspace/tabs/MembersTabs.js`; backend exists |
| Admin "Invite Founder" (secondary path) | **Broken** `[V]` | `/api/ventures/[id]/founders` writes `venture_founders` + token; no email sent, no acceptance consumer; staging has 0 rows vs 2 founder memberships |
| Journey stages / milestones / tasks / deliverables | **Working** `[V]` | `venture_journey_stages`, `venture_milestones`, `venture_tasks`, `venture_deliverables`, reviews; statuses derived by `services/ventures/milestoneEngine/*` |
| Founder evidence submission + manager review | **Working** `[V]` | `PATCH /api/ventures/[id]/deliverables {action}`; review inbox; reviews append; **evidence itself has no versions** |
| Sessions (booking, memos, reschedule/cancel) | **Working** `[V]` | `venture_sessions` + notes/action items; `sessionAuthority`; founder books only the current released milestone |
| Session attendance | **No UI writer** `[V]` | Action exists (`record_attendance`), no component calls it and the table has 0 rows |
| Data Room (documents, versions, reviews, grants) | **Working** `[V]` | `venture_documents` + `venture_data_room_requirements` + `_grants` + versions/access logs; `computeDataRoomCompleteness` |
| Computed journey report | **Working** `[V]` | `GET /api/ventures/[id]/journey-report`; live SQL; staff-only |
| Written progress/closing reports | **Working** `[V]` | `venture_reports` (draft → submitted → reviewed → archived), free-text `reporting_period` |
| Permissions (capability + scope + matrix) | **Working, uneven** `[V]` | `requireVentureScopedAccess` everywhere; matrix cells read only by notes, Data Room, milestone authority, session scheduling, `/my-access`; most routes use coarse `ventures.view/edit` |
| Company status vocabulary | **Working, display gaps** `[V]` | `lib/ventureCompanyStatus.js`; badge maps only 3 states (prospect/graduated → "Active"); `en/venture.json` lacks `prospect` |
| Identity Phase 0 (readers) | **Landed** `[V]` | Readers join on `ventures.id`; `OR` bridges gone; writer sweep largely complete; **storage conversion not run** |
| Weekly standups / retros | **Collected, invisible** `[V]` | `venture_standups` / `venture_retros`; fetched by loaders, never rendered; POST only (no edit) |
| Venture updates (monthly/quarterly) | **Investor-only** `[V]` | `venture_updates`; written/read only through investor APIs; 0 rows |
| Notification / activity history | **Working (audit)** `[V]` | `venture_activity_log`, `venture_history`, `venture_change_log`, `venture_audit_logs`; not a reporting source |

**Navigation:** the admin venture list is in the sidebar (Super Admin → Ventures
→ All Ventures). The staff console appears only with assignments; participants
get "My Ventures" only as venture members. **11 admin venture sub-pages**
(analytics, coaches, feedback, fundraising, investors, knowledge, notes,
sessions, tasks, history, dashboard) have **no inbound links** — URL-only `[V]`.

---

## Section C — Venture Profile Matrix

Legend: **IMPL** implemented · **PARTIAL** · **MISSING** · **UNREACHABLE**
(stored/collected but no UI or no consumer) · **UNVERIFIED**.

Storage is `ventures.*` unless stated. Permissions: “edit” = `ventures.edit` +
`venture_own` scope; Super Admin bypasses.

### C.1 Venture identity

| Field | Status | Collection point | Storage | Validation | Permissions | Usage / evidence |
|---|---|---|---|---|---|---|
| Name | IMPL | Admin create; founder profile; admin edit | `company_name` + mirrored `name` | non-empty `company_name` (`PATCH` 400) | edit | Every header/list; mirroring in `record.js` |
| Description | IMPL | Founder profile | `description` | none | edit | Profile view, admin list |
| Mission / Vision | IMPL | Founder profile | `mission`, `vision` | none | edit | Read-only view; weighted in setup score |
| Industry | PARTIAL | Founder datalist; admin select | `industry` (free text) | none server-side; admin select lower-cases vs Title-Case options | edit | Header meta, admin list; NULL on all staging ventures |
| Sector | PARTIAL | Founder profile | `sector` | none; no taxonomy | edit | Read-only view |
| Country / code | PARTIAL | Founder `CountrySelect` | `country`, `country_code` | none | edit | Header meta; **form omits `country` → founder save writes NULL** |
| City / operating address | MISSING | — | — | — | — | Only in the dead wizard |
| Website | IMPL | Founder/admin | `website` | none server-side | edit | Read-only view |
| Logo | UNREACHABLE | Admin loader only | `logo_url` | none | — | No UI reads it; header paints an initial |
| Social links | IMPL | Founder profile | `social_media` jsonb | browser `type=url` only | edit | Read-only view |
| Year founded | MISSING | — | — | — | — | Dead wizard only |
| Company status | IMPL | Admin edit; lifecycle route | `status` | central vocabulary; lifecycle pause/resume/archive | founders' writes stripped | Badge (with display gaps) |
| Visibility | UNREACHABLE | payload only (`private`) | `visibility` | none | — | Displayed nowhere |
| Language | UNREACHABLE | payload only (`en`) | `language` | none | — | Displayed nowhere |
| Branding | PARTIAL | forced `{color:"#f60"}` on save | `branding` jsonb | none | — | Header tile only |
| North star (90-day objective) | UNREACHABLE | none | `north_star` | none | — | No input; every founder save writes NULL |
| Programme type | UNREACHABLE | none | `programme_type` | none | — | API-write only, zero readers |

### C.2 Business description

| Field | Status | Evidence |
|---|---|---|
| Problem, solution, value proposition | **MISSING** | No columns; only `description` / `mission` / `vision` |
| Product / service description | **MISSING** as a distinct field | `description` is the only narrative |
| Target customers / ICP | **MISSING** | Only per-interview `customer_segment` in `venture_customer_interviews` (no UI) |
| Market / competitive advantage | **MISSING** | — |
| Product maturity | **MISSING** | `v2_teams.maturity_stage` exists but is unrelated and unread |
| Primary 90-day objective | **UNREACHABLE** | `north_star` exists, no UI, written NULL |

### C.3 Business model

| Field | Status | Storage / evidence |
|---|---|---|
| Business model / lean canvas | **UNREACHABLE (API-only)** | `venture_business_models.business_model_canvas`, `lean_canvas`; `PUT /api/ventures/[id]/business-model` has **zero UI callers**; 0 rows |
| Revenue model / streams | PARTIAL | `revenue_model` (not writable/read), `revenue_streams` (API only) |
| Cost structure | UNREACHABLE | `.cost_structure` (API only) |
| Partners | PARTIAL | `.key_partners` (API only); `venture_advisors` is the real support table |
| Pricing, sales channels, delivery model | **MISSING** | — |

### C.4 Business stage

| Aspect | Status | Detail |
|---|---|---|
| Field | IMPL | `business_stage` text, default `idea`, **no CHECK constraint**; staging stores only `idea` |
| Collection | IMPL / PARTIAL | Founder select (DB options) vs admin select (hardcoded different list) |
| History | PARTIAL | `venture_activity_log` / `venture_history` record that the venture changed, not old→new; `venture_change_log` excludes the profile |
| Influence | IMPL | Data Room requirement levels, evidence %, dashboard score, investment readiness, investor matching, knowledge recos; **not** journey/milestones/KPIs |
| Distinctness | IMPL | Product maturity absent; investment readiness = Data Room (plus a stage blend); fundraising separate |

**Verified vocabulary drift** `[V]`:
- Founder form + DB options: `idea, validation, mvp, growth, scale`
- Admin edit/list: `idea, validation, early_traction, growth, scaling`
- Admin list display maps `mvp` → "Idea"; scoring knows only the second list.

### C.5 Legal / corporate

| Field | Status | Detail |
|---|---|---|
| Registration status | PARTIAL | Founder select (`Not registered / Registered / Pending registration`); **absent from the form model → wiped to NULL on save** |
| Registration number | PARTIAL | Admin edit only; no format validation; duplicate check only in dead intake |
| Legal structure | **MISSING** | Dead wizard only |
| Registered / operating address | **MISSING** | Country only; no city/address |
| Licences | **Document-only** | Data Room `legal_corporate` + verification items (`business_registration`, `legal_documents`, `founder_identity`, `financial_documents`) |
| Structured corporate record | **MISSING** | No legal-entity table; cap table/statuts exist only as documents |

### C.6 Founder and team

| Item | Status | Detail |
|---|---|---|
| Canonical roster | **`venture_members`** `[V]` | 2 founder rows; used by counts and setup score |
| Legacy roster | `venture_founders` | 0 rows; written only by the broken admin invite; `equity_share` never read |
| Founder title/role | **Conflict** | `/founders` uses 19 snake_case titles; `/members` PATCH accepts only `{member, founder, admin, lead}`; the Team tab sends display labels → **400** |
| Ownership / lead | IMPL | `is_owner`, `lead_founder`; first founder wins; transfer route exists |
| Team size | **MISSING** | Dead wizard only |
| Advisors / mentors / support staff | IMPL (separate) | `venture_advisors`, `venture_coaches`, `venture_staff_assignments` (2 lead-manager rows) |
| Founder bio / photo | **MISSING** as venture-facing | Only personal `contacts.image` |

**Fields missing entirely:** problem · solution · value proposition · target
customer/ICP · market/competitive advantage · product maturity · 90-day
objective · pricing · sales channels · delivery model · year founded · legal
structure · registered/operating address · city · team size · structured
licences.

**Collected but unreachable:** business-model canvas/lean canvas/revenue
streams/cost structure/key partners · `north_star` · `logo_url` · `visibility` ·
`language` · `programme_type` · `ventures.stage`, `owner_id`,
`graduation_notes` · `v2_teams.maturity_stage` · startup-profile wizard store ·
venture-options write API · founder Team invite · `venture_founders.equity_share`.

---

## Section D — Initial Baseline Matrix

**Conclusion `[V]`:** ImpactOS captures **no structured initial baseline**. A
venture is a mutable profile plus a document vault. No financial, customer,
employment or impact figure is stored as a dated, validated, historical record.

| Metric | Collected? | Storage | Structured? | Date/period | History | Validation | Derivable from |
|---|---|---|---|---|---|---|---|
| Monthly revenue | No | — | — | — | — | — | No (`finance_transactions` is program-level, no `venture_id`) |
| Operating expenditure | No | — | — | — | — | — | No |
| Cash balance | No | — | — | — | — | — | No |
| Funding target | Partial | `fundraising_campaigns.target_raise`; `v2_programs.funding_requirement` (text, NULL) | Semi | campaign dates only | No | No | Campaign rows only |
| Funding received | Partial | `fundraising_campaigns.current_raised` | Yes | No as-of | No | No | Incremented on pipeline `invested` — **committed, not disbursed** |
| Funding sources | Partial | `fundraising_opportunities` | Semi | expected close date | `fundraising_stage_history` | No | Yes (pipeline/opportunity rows) |
| Currency | Partial | campaign/opportunity | Yes | — | — | — | No `ventures.currency` |
| Reporting date (`as_of`) | **No** | — | — | — | — | — | — |
| Active customers | No | — | — | — | — | — | No (interviews ≠ customers) |
| Active users | No | — | — | — | — | — | No |
| Leads / sales | No (venture-linked) | CRM leads/opportunities **have no venture FK** | Yes but unlinked | — | — | — | Not reliably |
| Employees (headcount) | No | membership roster only | Semi | `joined_at` | soft delete | No | Founder count only; **not employees** |
| FTE / part-time / seasonal | **No** | — | — | — | — | — | No |
| Founders (separate) | Yes | `venture_members.member_type='founder'` | Yes | `joined_at` | Partial | Invite flow | Yes |
| Gender / youth | No (per venture) | `contacts.gender`, `contacts.dob` (mostly empty) | Column only | — | — | — | Unreliable |
| Beneficiaries / jobs / women-led / local suppliers / formalization | No | Data Room `impact_sustainability` docs; journey stage names | Document-only | — | — | Document review only | No |
| Generic KPI values | Mechanism only | `venture_kpis` (`UNIQUE(venture_id,kpi_key)`, `kpi_value` TEXT) | Semi | **none** | **overwrite** | No | N/A |
| Narrative monthly/quarterly update | Mechanism | `venture_updates` | Narrative | `created_at` | Append | No | No |
| Progress report per stage | Mechanism | `venture_reports` | Narrative + JSON lists | **free-text `reporting_period`** | Append | Staff submit | No |
| Financials as documents | Yes | `venture_documents` (category `financials_projections`) | **doc only** | upload date | Versions | Review | No extraction |

### The seven baseline questions, by category

**A. Financial position** — (1) Not collected `[V]`. (2) Only documents and
API-only free text. (3) Narrative/documents. (4) No reporting date anywhere. (5)
No history. (6) Reviewed only as a document, never as a figure. (7) Not
derivable for revenue/opex/cash; funding **target vs received** is distinguished
only inside campaigns, and "received" actually means *committed at pipeline
stage invested*.

**B. Customers & market** — (1) No counts `[V]`. (2) Interviews/PMF/validations
are qualitative logs. (3) Structured per interaction, not per period. (4) Only
per-interview dates. (5) No metric series. (6) No validation. (7) Not derivable;
CRM is not venture-linked.

**C. Employment** — (1) Roster only; no headcount `[V]`. (2) Membership
invitations. (3) Membership rows, not employment. (4) `joined_at` only. (5) Soft
delete, no count snapshot. (6) No validation. (7) Founder count yes; employee
headcount/FTE **no** — the system does not distinguish collaborators, employees,
part-time or seasonal.

**D. Impact** — (1) No structured indicator `[V]`. (2) Data Room documents and
narrative reports. (3) Document/narrative. (4) Only free-text period. (5) Reports
append; no indicator series. (6) Staff submit only. (7) Not derivable.

---

## Section E — Existing Operational and Reporting Data

| Category | Source of truth | Workflow / permissions | History | Reuse for recurring reporting |
|---|---|---|---|---|
| Journey stages | `venture_journey_stages` | Admin `/journey`; founder Journey tab; `GET/PATCH …/journey`; stage transitions gated by `operating_plan` | `completed_at`; `venture_change_log` | **High** — real start/target/completed dates; deterministic close |
| Milestones | `venture_milestones` | Journey panel; `milestones.*` matrix cells | No `completed_at`; only created/updated/archived | **Medium** — on-time delivery not computable |
| Tasks | `venture_tasks` (+ dependencies, submissions, reviews) | Admin tasks board; `…/tasks`; founder "my work" | Versioned submissions + append-only reviews; **no `completed_at`** | **Medium** |
| Deliverables | `venture_deliverables` + reviews | Created by Lead Manager; founder submits; manager reviews | Reviews append; **evidence overwritten, no version/submitted_at** | **Medium** |
| Sessions | `venture_sessions` + notes/action items/attendance | Booking screens; `sessionAuthority` | Append; attendance UPSERT | **High** (cadence); **Low** for attendance (no UI writes it) |
| Standups / retros | `venture_standups`, `venture_retros` | API only; fetched but **never rendered**; POST only (409 on duplicate) | One row per ISO week — genuine series | **High in principle, latent today** |
| Venture updates | `venture_updates` | Investor APIs only | Append; typed by period | **High shape** (monthly/quarterly), but no venture-side authoring |
| Blockers | shared `blockers` with `venture_id` | `GET/POST/PATCH …/blockers`; **POST requires retro + task** | Raised/resolved timestamps | **Medium** |
| Data Room | `venture_documents` + requirements + grants + versions | Founder manages; LM reviews; coach scoped; investor granted subset | Versions append; review on parent row; audit events | **High** — one completeness formula with null semantics |
| Verification (parallel) | `venture_verifications` + items + documents | Admin verification screens | Item statuses; history empty | **Medium** — second coverage model |
| Computed journey report | live SQL (`journey-report`) | Staff-only; admin Reports tab, timeline, attention widget | None (computed) | **High** — already assembles operational facts |
| Written reports | `venture_reports` | Manager authors; draft→submitted→reviewed→archived; portfolio `/admin/journey-reports` | Append | **High** — add period start/end + duplicate guard |
| Notifications | `v2_notifications`, `venture_notifications` | Event-driven | Append; read_at | **Low** for reporting |

**Bottom line:** weekly/monthly/quarterly operational reporting can be produced
today from Data Room, journey/milestone/task counts, sessions and written reports
**without founders re-entering data**. The blockers are missing timestamps and
four collected-but-invisible datasets.

---

## Section F — Calculations and Indicators

| # | Indicator | Formula (summary) | Implementation | Consumers | Main issue |
|---|---|---|---|---|---|
| 1 | Venture setup score | 26 non-uniform weights over 14 inputs; capped 100; computed on read; not enforced | `api/ventures/[id]/progress` | Admin health summary; founder/staff history | Mixes profile with activity; unreachable inputs cap it below 100; any upload earns document points |
| 2 | Personal profile completion | 5 mandatory booleans | `api/profile` | Login gate | Distinct from venture completion (correct) |
| 3 | Milestone status (derived) | Deliverables + tasks combine; rejected/submitted/all-approved | `milestoneEngine/status.js` | Lists, journey | Derived **and** stored; `null` ≠ `not_started` |
| 4 | Roadmap readiness | 30 % journeys + 30 % milestones + 25 % tasks + 15 % deliverables (partial means) | `services/ventures/readiness.js` | Investment page, journey report, growth tabs | Returns **0** when every component is null; filing evidence can lower it |
| 5 | Data Room readiness | Required categories only; verified 1, rejected 0.5, else 0; `null` if none required | `dataRoom/access.js` + batch | Ventures list, intelligence, investor matching | Rejected document *raises* the score; verified non-required ignored |
| 6 | Verification readiness | Active required document types; verified 1, rejected 0.5 | `models/ventureReadiness.js` | Verification gauge | **Different tables and denominator from #5** |
| 7 | Stage + Evidence score | 0.4 × stage + 0.6 × Data Room | `services/ventures/dashboard.js` | Admin dashboard | A fourth "readiness" number |
| 8 | Venture analytics | 40/40/20 milestone-completed/tasks/deliverables; health penalty; productivity | `services/ventures/analytics.js` | Admin Reports | **Three different completion numbers on one page** |
| 9 | 10-category investment readiness | Weighted assessments, stored | `services/ventures/investmentReadiness.js` | None (route retired) | Dead endpoint; reads the dead wizard |
| 10 | Journey-report numbers | Stage % strict; header % roadmap; overdue by due date | `journey-report` route | Admin Reports, staff timeline | Two percentages, two formulas on one screen |
| 11 | Lead-manager dashboard KPIs | Counts by assignment | `services/ventures/leadManagerDashboard.js` | `/staff` lead home | Milestone read lacks `is_archived` filter |
| 12 | Intelligence metrics | `ready_count/ready_percent`; overdue | `models/intelligence.js` | `/admin/intelligence` | Denominator includes archived and unmeasurable ventures |
| 13 | Investor `completion_index` / `funding_requirement` | Read from `v2_programs` | `models/investor/dashboardsAndKpis.js` | Investor cards/campaigns | **0/3 staging ventures exist in `v2_programs` → NULL → rendered 0 % / $0** |
| 14 | Program `completion_index` | Sessions/docs/report weeks/submissions | `services/programs/programList.js` | Admin metrics, investor KPI | A **program** metric wearing a venture label |
| 15 | Venture KPI widgets | current/target; auto-calc from milestones/tasks | `dashboard.js`, `ventureJourney/kpis.js` | Venture dashboard | Tasks auto-calc uses `status='done'` only; milestones include archived; no history |
| 16 | Business performance | **No calculation exists** | — | — | Confirmed by search |

**Explicit answers**
- **Same metric computed differently?** Yes — readiness (4 live + 1 retired),
  completion (3 formulas on one page), milestone progress (3 ways), investor
  `completion_index` (a program metric).
- **Zero/missing consistency?** No — Data Room/verification return `null`;
  founder dashboard, investor cards, `ready_percent` and `overall_percent`
  coerce to `0`; a read failure can look like "not ready".
- **Archived / rejected / incomplete?** Archived is excluded almost everywhere
  **except** lead-manager milestones; rejected earns 0.5 in documents but 0 in
  roadmap deliverables; `under_review` counts 0 consistently; unassigned/empty
  components are renormalised in roadmap but counted in analytics.
- **Safe to reuse as-is:** personal completion, `computeDataRoomCompleteness`
  (correct null semantics), derived milestone status, overdue/awaiting-review
  counts.
- **Needs a business decision before change:** everything in Section H.

---

## Section G — Gap Analysis

### G.1 Against the intended information flow

**Venture Identity → Initial Baseline → Recurring Reports → Operational
Execution → KPIs → Venture Dashboard → Portfolio Reports**

| Stage | Supported today? | Assessment |
|---|---|---|
| Venture Identity | **Partially** | Name/description/industry/country/website/social/registration status exist; many business-identity fields missing; two fields wiped on save |
| Initial Baseline | **No** | No structured baseline at all |
| Recurring Reports | **Partially** | Written reports exist with a free-text period; standups exist but are invisible; updates are investor-only |
| Operational Execution | **Yes** | Journey/milestones/tasks/deliverables/sessions/Data Room are real and reusable |
| KPIs | **Mechanism only** | `venture_kpis` exists; no period, no history, no definitions, no UI |
| Venture Dashboard | **Partially** | Work dashboard is strong; business/performance dashboard does not exist; readiness numbers conflict |
| Portfolio Reports | **Partially** | Computed/written journey reports and admin analytics exist; no comparable business-performance view |

### G.2 Finding classification

| Ref | Finding | Classification | Evidence |
|---|---|---|---|
| P1 | No problem/solution/value-proposition fields | **Not implemented** | no columns |
| P2 | No target-customer/ICP field | **Not implemented** | only per-interview `customer_segment` |
| P3 | No product maturity, 90-day objective, pricing, channels, delivery model | **Not implemented** | no columns |
| P4 | No year founded, legal structure, address/city | **Not implemented** | dead wizard only |
| P5 | Founder save nulls `country`, `registration_status`, `north_star` | **Implemented but unreliable** (data loss) | `ventureScreenModel.js` vs `ventureScreenHelpers.js` |
| P6 | `north_star`, `logo_url`, `visibility`, `language`, `programme_type` unreachable | **Inaccessible or disconnected** | no UI/consumer |
| P7 | Business-model fields API-only | **Inaccessible or disconnected** | `business-model` route, 0 callers |
| P8 | Business-stage vocabularies disagree; `mvp` displays as "Idea" | **Implemented but unreliable** | DB/founder vs admin lists |
| P9 | Founder role/title conflict → 400 on Team tab | **Implemented but unreliable** | `/members` whitelist vs UI labels |
| P10 | Two founder rosters; admin invite sends no email | **Implemented but unreliable** | `venture_founders` vs `venture_members` |
| P11 | Founder team invite disabled | **Inaccessible or disconnected** | commented-out component |
| B1 | No baseline (financial/customer/employment/impact) | **Not implemented** | live schema scan |
| B2 | Funding target/received exists only in campaigns; "received" = committed | **Implemented but incomplete** | `fundraising_campaigns` |
| B3 | No `as_of` or reporting period anywhere; KPI rows overwrite | **Not implemented** | schema |
| B4 | Financials only as documents | **Implemented but incomplete** | Data Room category |
| O1 | Standups/retros collected but not rendered | **Inaccessible or disconnected** | loaders only |
| O2 | Attendance collected but no UI writer | **Inaccessible or disconnected** | 0 rows; action unused |
| O3 | Venture updates investor-only | **Inaccessible or disconnected** | investor APIs |
| O4 | Milestone/task lack `completed_at` | **Implemented but incomplete** | schema |
| O5 | Deliverable evidence has no versions | **Implemented but incomplete** | reviews only |
| O6 | Blockers require a retro + task | **Implemented but incomplete** | `POST /blockers` |
| C1 | Four live readiness numbers + 1 retired | **Implemented but unreliable** | Section F |
| C2 | Three completion formulas on one page | **Implemented but unreliable** | Section F #8 |
| C3 | Data Room vs verification readiness disagree | **Implemented but unreliable** | Section F #5/#6 |
| C4 | Rejected evidence treated differently (0.5 vs 0) | **Requires business clarification** | F |
| C5 | Null vs 0 coerced inconsistently | **Requires business clarification** | F |
| C6 | Investor `completion_index`/`funding_requirement` read programs | **Implemented but unreliable** | `v2_programs` join |
| C7 | Lead-manager milestone counts include archived | **Implemented but unreliable** | model query |
| A1 | 11 admin venture sub-pages URL-only | **Inaccessible or disconnected** | no inbound links |
| A2 | Journey-reports portfolio has no navigation | **Inaccessible or disconnected** | no nav node |
| A3 | Startup wizard dead; "0/6" widget | **Inaccessible or disconnected** | no writer/route |
| A4 | Feature flags inert | **Implemented but incomplete** | no gate reads them |
| A5 | Participant page loads unused venture data | **Implemented but incomplete** | dead reads |
| N1 | Current profile/template "do not rebuild" (create, invite, membership, Data Room engine) | **Working as intended** | Section B |
| N2 | Production schema/data differences (`ventures.id` type) | **Cannot be verified from available evidence** | production not queried |

---

## Section H — Recommended Decisions

| # | Decision | Why it matters | Evidence |
|---|---|---|---|
| D1 | **Approve the Venture Profile scope** — required vs optional vs conditional for the categories in C; decide whether to add problem/solution/value proposition/target customer/product maturity/90-day objective/pricing/channels/delivery model/year founded/legal structure/city/address/team size | The profile is the anchor for every later metric and report | Section C |
| D2 | **Decide the baseline model** — an immutable baseline record (`as_of`, currency, source, one per venture) vs. the first row of a monthly series | Without a fixed day-one record, no progress or cohort comparison is possible; putting it in `ventures` columns would be silently overwritten | D |
| D3 | **Decide the reporting cadence and period model** — monthly / quarterly / stage-based; real `period_start`/`period_end` with a uniqueness rule per venture+period | Current `reporting_period` is free text and cannot be aggregated or charted | E, F |
| D4 | **Decide KPI governance and history** — who defines metrics, units, and whether history is append-only | `venture_kpis` overwrites (unique key) and has no period; no trend is possible today | D, E |
| D5 | **Choose ONE investment-readiness definition** and retire or merge the second engine | Four numbers disagree on staging; the admin dashboard and the investment page answer differently | F #4–#9 |
| D6 | **Choose the rejected-evidence rule** (0.5 vs 0) and apply it to documents *and* deliverables | Today rejection raises document readiness and lowers deliverable readiness | F |
| D7 | **Decide null-vs-zero semantics** and how aggregates treat "not measurable" | "0 % ready" currently conflates *not ready* with *no data* | F |
| D8 | **Approve one business-stage vocabulary and migration mapping** (`mvp→validation/mvp`, `early_traction`, `scaling→scale`) | The same venture displays differently to founder, admin and reports | C.4 |
| D9 | **Declare `venture_members` the single roster**; decide the fate of `venture_founders` and of the founder team invite | Counts and permissions can disagree; an admin invite creates an orphan | C.6 |
| D10 | **Define employment** — headcount vs FTE, founders vs employees, part-time/seasonal | Any employment baseline or impact metric depends on it | D |
| D11 | **Choose impact indicators** and their verification/period model (or defer explicitly) | The product is impact-oriented; today impact is documents only | D |
| D12 | **Decide the investor-field source** — move `completion_index`/`funding_requirement` to the venture/Data Room, or stop rendering them as 0 | Investor cards currently show 0 %/$0 for ventures that exist | F #13 |
| D13 | **Decide what to do with parked surfaces** — 11 URL-only admin pages, the dead wizard, the journey-reports portfolio | Either expose them, delete them, or document them as internal | G A1–A5 |

---

## Section I — Recommended Next Steps

1. **Provide the consolidated business analysis document.** It is not in the
   repository; Section G currently compares against the flow in your brief and
   the two existing venture docs.
2. **Ratify D1–D5** (profile scope, baseline model, reporting period, KPI
   governance, one readiness definition). No schema or UI work before these are
   settled.
3. **Produce a data-requirements specification** from the ratified decisions:
   field-level matrix (required/optional/conditional), baseline record shape,
   reporting period model, KPI definitions and formulas — reviewed by Future
   Studio, not implemented.
4. **Freeze the current calculations** as "known behaviour" during the design
   period, and decide which figures appear where (one label → one formula).
5. **Only then authorise implementation**, in this order: profile fields →
   baseline record → reporting period + KPI history → dashboard/portfolio views
   → cleanup of the dead/duplicate surfaces.
6. **Re-run this audit after implementation** against staging with the same
   read-only method, so the next comparison is like-for-like.

**Explicitly not done:** no code, schema, migration, data or permission changes;
no runtime click-through; no production queries; no proposed requirement treated
as approved.

---

## Appendix — Method, boundaries and what could not be verified

**Method.** Six parallel read-only passes: (1) lifecycle/permissions,
(2) profile fields against live `information_schema`, (3) baseline/financial/
impact, (4) operational/reporting reuse, (5) calculations, (6) git history and
dead/duplicate features. Every finding cites a file, route, table or commit.

**Not verified** (needs your environment):
- Runtime click-through and redirect behaviour; real email delivery.
- Production data/schema — production is untouched and reportedly differs on
  `ventures.id` type (INTEGER vs UUID).
- Whether the manual backfills (`backfill:founder-ledger`,
  `db:venture-identity`) have been run against either database.
- Whether the 11 URL-only admin pages are deliberately parked or simply unlinked.
- Whether team members actually use the editable profile tab in practice.

**Reference documents used:** `docs/VENTURE_SETUP_AUDIT.md`,
`docs/VENTURE_IDENTITY_PHASE0.md`, `docs/HANDOVER_VENTURES.md`,
`docs/VENTURES_LANE.md`, `docs/venture-os-legacy-map.md`.

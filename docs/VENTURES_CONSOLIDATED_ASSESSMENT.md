# ImpactOS Ventures — Consolidated Current-State & Reporting Readiness Assessment

**Mode:** read-only discovery and assessment. No application code, schema, data, permissions, APIs, calculations or UIs were modified. No migrations, no sample records, no production queries.
**Date:** 2026-10-26 · **Database evidence:** staging (`mbpaxrfhqqclzyiefuab`) queried read-only via `.env.audit-staging`. `.env.local` was not used (it points at the production-looking project: 588 contacts / 5 ventures).
**Consolidates and supersedes for reading:** `docs/VENTURES_CURRENT_STATE_AUDIT.md` (2026-10-23) and `docs/VENTURES_REPORTING_READINESS_ASSESSMENT.md` (2026-10-26). The earlier `docs/VENTURE_SETUP_AUDIT.md` remains as a source document; its findings are revalidated here.
**Evidence tags:** `[V]` verified in source and/or live staging · `[I]` inferred from code · `[U]` unverified (needs runtime click-through or production data).
**Reference document:** the *“ImpactOS: Ventures Module — Business Analysis and Data Requirements — Consolidated Working Document”* is **not in this repository**. The comparison uses the 12 categories and the intended information flow in the brief.

---

## 0. Verification basis (live staging, 2026-10-26)

| Fact | Value |
|---|---|
| Contacts / ventures | **11 / 3** |
| Ventures by stage / status | all `idea` / all `active`; `industry`, `country`, `registration_status` = NULL on all 3 |
| Founder memberships / legacy founders ledger | 2 / **0** |
| Journey stages / milestones / tasks / deliverables / reviews | 2 / 7 / 27 / 28 / 14 |
| Sessions / attendance | 2 / **0** |
| Standups / retros / written reports / updates | 0 / 0 / 0 / 0 |
| KPIs / KPI definitions / KPI assignments | 0 / 0 / 0 |
| Data Room documents / versions / document types / requirements / grants | 2 / 2 / 12 / 11 / 0 |
| Document review statuses | 1 `verified` (JPG, `legal_corporate`), 1 `rejected` (XLSX, `company_overview`) |
| Verifications / items / verification documents | 2 / 12 / 0 |
| Fundraising campaigns / opportunities / investment decisions | 0 / 0 / 0 |
| CRM leads / opportunities / activities | 0 / 1 / 0 |
| Public base tables | **308** |
| `ventures.id` / `ventures.venture_id` | `uuid` / `text` (nullable) |
| Period columns in the venture domain | **two free-text only**: `venture_reports.reporting_period`, `venture_kpi_assignments.period` |
| `as_of` / `baseline` / `ocr` / `ai_` / `source` / `confidence` / `currency` (venture domain) | **absent** |
| `crm_*` tables with `venture_id` | **0 of 13** |

**Interpretation limit:** schema and code paths are verified; staging holds almost no reporting data, so **reporting behaviour cannot be validated here** — only capability.

**Scoring basis.** Each bullet in the 12 reporting categories is one requirement → **120 lines** (14+6+9+12+10+13+11+9+11+9+10+6). Equal weight per line (no priority weights were supplied; this is an assumption). Credits per requirement per measure: 1 / 0.5 / 0.
- **S** existing structured capability
- **DE** document-assisted with extraction **existing today**
- **DP** document-assisted **potential** (not achieved)
- **D** reaches an existing venture dashboard/report
- **E2E** captured/obtained + reviewed + historically preserved + usable today

**Limitations:** requirements overlap across categories (revenue in 4 and 5; employment in 3, 4, 9; impact in 4 and 10) and are not deduplicated; **DP is potential, never a capability claim**; per-requirement statuses are an assessment from code evidence, not a measurement; two working summaries differed by ≤1 from row-level sums and the row-level sums are used.

---

# PART I — CURRENT STATE

## 1. Venture lifecycle and permissions

### 1.1 The one live creation path

| Step | Who | Screen / endpoint | What is collected |
|---|---|---|---|
| 1 | Super Admin | `/admin/ventures` → “Add a Venture” → `POST /api/admin/ventures/create` | **Company name + founder email only** |
| 2 | Founder | `/venture-invite/[token]` | Full name + password (password only for a new account) |
| 3 | Founder, later and optionally | Venture → Profile tab | the profile fields in §2 |

`[V]` The retired `POST /api/ventures` returns `410 LEGACY_FLOW_RETIRED`; the self-service intake service has no production caller. Creation writes `ventures` (`status='active'`, `business_stage='idea'`, `industry=NULL`), a `venture_origins` row (`source_type='admin'`), and a `venture_member_invitations` row (7-day token). On acceptance, the contact is resolved/created (`role='member'`), `venture_members` gets `member_type='founder'`, and the **first founder becomes owner/lead**.

### 1.2 Roles and access

- **Super Admin:** `/admin/ventures/[id]` hub tabs (dashboard, journey, investment, reports, Data Room, activity, profile, team). **11 admin sub-pages have no inbound links** (analytics, coaches, feedback, fundraising, investors, knowledge, notes, sessions, tasks, history, dashboard) `[V]`.
- **Lead Manager:** `/staff/ventures/[id]` (overview, journey, projects, investment, tasks, sessions, notes, Data Room, **profile read-only**) `[V]`.
- **Founder:** `/participant/ventures/[id]` (Dashboard, Journey, Investment, Data Room, Profile, Team) `[V]`.
- **Enforcement:** capability + record scope (`venture_own`) is used nearly everywhere; the fine-grained permission matrix (13 areas × 12 actions; 205 staging cells) is actually read only by notes, Data Room, milestone authority, session scheduling and `/my-access` `[V]`.

### 1.3 What works / partial / unreachable

**Works `[V]`:** creation + invitation + acceptance; founder profile editing (with defects, §2); journey/milestones/tasks/deliverables; deliverable submission + review; sessions (booking/memo/reschedule); Data Room (upload/version/review/grants); computed journey report; written reports; permissions.

**Partial `[V]`:** team management (founders cannot invite; admin founders invite sends no email and has no acceptance consumer; two founder rosters); deliverable evidence is overwritten (no versions); tasks/milestones lack `completed_at`; session attendance has a write action but no UI caller; standups/retros are fetched but never rendered; venture updates are investor-API-only.

**Unreachable `[V]`:** 11 admin sub-pages (URL-only); startup-profile wizard (tab unreachable, `/ventures/[id]/wizard` missing, “0/6” widget permanently zero); business-model/interviews/validations/PMF/KPIs/operating-plans APIs with no UI; `north_star`, `logo_url`, `visibility`, `language`, `programme_type` have no UI; journey-reports portfolio has no navigation.

### 1.4 Duplicate / competing implementations `[V]`

| Concern | Canonical today | Drift |
|---|---|---|
| Founder roster | `venture_members` | `venture_founders` legacy ledger (0 rows) written only by the broken admin invite |
| Name | `company_name` | `name` mirrored at runtime |
| Company status | `lib/ventureCompanyStatus.js` (`prospect/active/paused/graduated/archived`) | badge maps only 3 states; `prospect` missing from locale |
| Business stage | Two stored spellings: founder/DB `idea/validation/mvp/growth/scale` vs admin `early_traction/scaling`; admin list shows `mvp` as “Idea” | no constraint; no history |
| Document systems | Data Room (`venture_documents` + requirements + grants) | Data bank/verification (second model); legacy `/documents` vault (no UI caller); dead wizard documents |
| Readiness | Data Room completeness | four live formulas + one retired (see §5) |
| Reports | computed `/journey-report` | written `venture_reports` (different vocabulary, free-text period) |
| Invitations | `venture_member_invitations` (works, email) | `venture_founders.invitation_token` (no consumer) |

---

## 2. Venture Profile Matrix

Legend: **IMPL** · **PARTIAL** · **MISSING** · **UNREACHABLE** (stored but no UI/consumer). Storage `ventures.*` unless stated. Edit = `ventures.edit` + `venture_own` scope.

### A. Venture identity

| Field | Status | Collection | Storage | Validation | Usage / evidence |
|---|---|---|---|---|---|
| Name | IMPL | Admin create; founder profile; admin edit | `company_name` + mirrored `name` | non-empty `company_name` only | Every list/header `[V]` |
| Description | IMPL | Founder profile | `description` | none | Profile view, admin list `[V]` |
| Mission / vision | IMPL | Founder profile | `mission`, `vision` | none | Read-only view; weighted in setup score `[V]` |
| Industry | PARTIAL | Founder datalist; admin select | `industry` (free text) | none server-side; admin lowers case vs Title-Case options | Header/list; NULL on all staging rows `[V]` |
| Sector | PARTIAL | Founder profile | `sector` | none; no taxonomy | Read-only `[V]` |
| Country / code | PARTIAL | Founder `CountrySelect` | `country`, `country_code` | none | **Founder save writes `country` NULL** (form model omits it) `[V]` |
| City / operating address | MISSING | — | — | — | Dead wizard only `[V]` |
| Website | IMPL | Founder/admin | `website` | none server-side | Read-only `[V]` |
| Logo | UNREACHABLE | Admin loader only | `logo_url` | none | **No UI reads it** `[V]` |
| Social links | IMPL | Founder profile | `social_media` jsonb | browser URL type only | Read-only `[V]` |
| Year founded | MISSING | — | — | — | Dead wizard only `[V]` |
| Company status | IMPL | Admin edit; lifecycle route | `status` | central vocabulary; founders' writes stripped | Badge (display gaps) `[V]` |
| Visibility | UNREACHABLE | payload only (`private`) | `visibility` | none | displayed nowhere `[V]` |
| Language | UNREACHABLE | payload only (`en`) | `language` | none | displayed nowhere `[V]` |
| Branding | PARTIAL | forced `{color:"#f60"}` on save | `branding` jsonb | none | header tile only `[V]` |
| North star (90-day objective) | UNREACHABLE | none | `north_star` | none | **every founder save writes NULL** `[V]` |
| Programme type | UNREACHABLE | none | `programme_type` | none | API-write only `[V]` |

### B. Business description

| Field | Status | Evidence |
|---|---|---|
| Problem / solution / value proposition | **MISSING** | No columns; only `description`/`mission`/`vision` `[V]` |
| Products and services | **MISSING** as a distinct field | Data Room `product_technology` only `[V]` |
| Target customers / ICP | **MISSING** | per-interview `customer_segment` API-only `[V]` |
| Market / competitive advantage | **MISSING** | Data Room `market_traction`/pitch deck only `[V]` |
| Product maturity | **MISSING** | `v2_teams.maturity_stage` unrelated/unread `[V]` |
| Primary 90-day objective | **UNREACHABLE** | `north_star` no UI `[V]` |

### C. Business model

| Field | Status | Storage / evidence |
|---|---|---|
| Business model / lean canvas | **UNREACHABLE (API-only)** | `venture_business_models`; 0 rows; zero UI callers `[V]` |
| Revenue model / streams | PARTIAL | `revenue_streams` API-only; `revenue_model` not writable/read `[V]` |
| Cost structure / partners | PARTIAL | API-only `[V]` |
| Pricing, channels, delivery model | **MISSING** | — `[V]` |

### D. Business stage

| Aspect | Status | Detail |
|---|---|---|
| Field | IMPL | `business_stage` text, default `idea`, **no CHECK**; staging stores only `idea` `[V]` |
| Collection | IMPL/PARTIAL | founder select (DB options) vs admin select (hardcoded, different) `[V]` |
| History | PARTIAL | activity/history logs record that the venture changed, not old→new `[V]` |
| Influence | IMPL | Data Room requirement levels, evidence %, dashboard score, investment readiness, investor matching, knowledge recos; **not** journey/milestones/KPIs `[V]` |
| Distinctness | IMPL | product maturity absent; investment readiness = Data Room (+ stage blend); fundraising separate `[V]` |

**Vocabulary drift `[V]`:** founder/DB `idea, validation, mvp, growth, scale` vs admin `idea, validation, early_traction, growth, scaling`; `mvp` renders as “Idea” on the admin list.

### E. Legal / corporate

| Field | Status | Detail |
|---|---|---|
| Registration status | PARTIAL | founder select; **wiped to NULL on save** `[V]` |
| Registration number | PARTIAL | admin edit only; no format/duplicate validation `[V]` |
| Legal structure | **MISSING** | dead wizard only `[V]` |
| Registered/operating address | **MISSING** | country only `[V]` |
| Licences | **Document-only** | Data Room `legal_corporate` + verification items `[V]` |
| Corporate record / cap table | **MISSING** as structure | documents only `[V]` |

### F. Founder and team

| Item | Status | Detail |
|---|---|---|
| Canonical roster | **`venture_members`** `[V]` | 2 founder rows; used by counts/setup score |
| Legacy roster | `venture_founders` | 0 rows; written only by broken admin invite `[V]` |
| Founder title/role | **Conflict** | 19 snake_case titles vs `{member,founder,admin,lead}`; Team tab sends labels → **400** `[V]` |
| Lead/owner | IMPL | `is_owner`/`lead_founder`; transfer route `[V]` |
| Team size / employment | **MISSING** | dead wizard only `[V]` |
| Advisors/mentors/support | IMPL (separate) | `venture_advisors`, `venture_coaches`, `venture_staff_assignments` `[V]` |
| Founder bio/photo | **MISSING** venture-facing | personal `contacts.image` only `[V]` |

**Missing entirely:** problem · solution · value proposition · target customer/ICP · market/competitive advantage · product maturity · 90-day objective · pricing · sales channels · delivery model · year founded · legal structure · registered/operating address · city · team size · structured licences.
**Collected but unreachable:** business-model fields · north star · logo · visibility · language · programme type · `ventures.stage`/`owner_id`/`graduation_notes` · `v2_teams.maturity_stage` · startup-profile store · venture-options write API · founder team invite · `venture_founders.equity_share`.

---

## 3. Initial Business Baseline

**Conclusion `[V]`:** the system captures **no structured baseline** — no financial figure, no dated starting position, no history. Financials exist only as Data Room documents.

| Metric | Collected? | Storage | Structured? | Date/period | History | Validation | Derivable from |
|---|---|---|---|---|---|---|---|
| Monthly revenue | No | — | — | — | — | — | No (`finance_transactions` is program-level, no `venture_id`) |
| Operating expenditure | No | — | — | — | — | — | No |
| Cash balance | No | — | — | — | — | — | No |
| Funding target | Partial | `fundraising_campaigns.target_raise`; `v2_programs.funding_requirement` | Semi | campaign dates only | No | No | Campaign rows only |
| Funding received | Partial | `fundraising_campaigns.current_raised` | Yes | No as-of | No | No | Incremented on pipeline `invested` — **committed, not disbursed** |
| Funding sources | Partial | `fundraising_opportunities` | Semi | expected close | stage history | No | Pipeline/opportunity rows |
| Currency | Partial | campaign/opportunity | Yes | — | — | — | No `ventures.currency` |
| `as_of` | **No** | — | — | — | — | — | — |
| Active customers | No | — | — | — | — | — | No (interviews ≠ customers) |
| Active users | No | — | — | — | — | — | No |
| Leads / sales | No (venture-linked) | CRM has no `venture_id` | Yes but unlinked | — | — | — | Not reliably |
| Employees (headcount) | No | membership roster only | Semi | `joined_at` | soft delete | No | Founder count only |
| FTE / part-time / seasonal | **No** | — | — | — | — | — | No |
| Founders (separate) | Yes | `venture_members.member_type='founder'` | Yes | `joined_at` | Partial | Invite flow | Yes |
| Gender / youth | No (per venture) | `contacts.gender/dob` mostly empty | Column only | — | — | — | Unreliable |
| Impact indicators | No | Data Room `impact_sustainability` docs | Document-only | — | — | doc review | No |
| KPI values | Mechanism only | `venture_kpis` (`kpi_value` TEXT, unique per key) | Semi | **none** | **overwrite** | No | N/A |
| Narrative monthly/quarterly updates | Mechanism | `venture_updates` (investor-only) | Narrative | `created_at` | append | No | No |
| Progress report per stage | Mechanism | `venture_reports` | Narrative + JSON | **free text** | append | staff submit | No |
| Financial documents | Yes | `venture_documents` (`financials_projections`) | **doc only** | upload date | versions | review | No extraction |

**The seven baseline questions**
- **Financial:** not collected; only documents/free text; no period; no history; document review only; not derivable (funding target vs received distinguished only in campaigns, and “received” = committed).
- **Customers/market:** no counts; qualitative logs; per-interview dates; no series; no validation; not derivable (CRM unlinked).
- **Employment:** roster only; membership ≠ employment; `joined_at`; no count snapshot; no validation; founder count yes, headcount/FTE no.
- **Impact:** no structured indicator; documents only; free-text period; reports append but no indicator series; staff submit only; not derivable.

## 4. Existing Operational and Reporting Data

| Category | Source of truth | Workflow / permissions | History | Reuse for reporting |
|---|---|---|---|---|
| Journey stages | `venture_journey_stages` | admin `/journey`; founder Journey tab; transitions gated by `operating_plan` | `completed_at`; change log | **High** — real start/target/completed dates; deterministic close |
| Milestones | `venture_milestones` | journey panel; `milestones.*` cells | no `completed_at`; created/updated/archived only | **Medium** — on-time delivery not computable |
| Tasks | `venture_tasks` + submissions/reviews | admin board; founder “my work” | versioned submissions; append-only reviews; **no `completed_at`** | **Medium** |
| Deliverables | `venture_deliverables` + reviews | LM defines; founder submits; LM reviews | reviews append; **evidence overwritten, no version/submitted_at** | **Medium** |
| Sessions | `venture_sessions` + notes/action items | booking screens; `sessionAuthority` | append; attendance UPSERT | **High** cadence; **Low** attendance (no UI writer) |
| Standups / retros | `venture_standups`, `venture_retros` | API only; fetched but **never rendered**; POST only | one row per ISO week | **High in principle, latent** |
| Venture updates | `venture_updates` | investor APIs only | append; typed by period | **High shape**, no venture-side authoring |
| Blockers | shared `blockers` with `venture_id` | POST requires retro + task | raised/resolved timestamps | **Medium** |
| Data Room | `venture_documents` + requirements + grants + versions | founder manages; LM reviews; coach scoped; investor granted subset | versions append; review on parent; audit events | **High** — one completeness formula with null semantics |
| Verification (parallel) | `venture_verifications` + items + docs | admin screens | item statuses; history empty | **Medium** — second coverage model |
| Computed journey report | live SQL | staff-only | computed | **High** — assembles operational facts |
| Written reports | `venture_reports` | manager authors; draft→submitted→reviewed→archived | append; no versions | **High** — add period + duplicate guard |
| Notifications | `v2_notifications`, `venture_notifications` | event-driven | append/read_at | **Low** |

**Bottom line:** weekly/monthly/quarterly *operational* reporting is possible today from Data Room, journey/task counts, sessions and written reports without founders re-entering data. Blockers: missing timestamps, snapshot-only KPIs, and four datasets collected but invisible (attendance, standups, updates, milestone activity).

---

## 5. Calculations and Indicators

| # | Indicator | Formula (summary) | Implementation | Consumers | Main issue |
|---|---|---|---|---|---|
| 1 | Venture setup score | 26 non-uniform weights over 14 inputs; cap 100; computed on read; not enforced | `api/ventures/[id]/progress` | admin health; founder/staff history | mixes profile with activity; unreachable inputs cap it below 100; any upload earns points |
| 2 | Personal profile completion | 5 mandatory booleans | `api/profile` | login gate | distinct from venture (correct) |
| 3 | Milestone status (derived) | deliverables + tasks combine | `milestoneEngine/status.js` | lists, journey | derived **and** stored; `null` ≠ `not_started` |
| 4 | Roadmap readiness | 30 % journeys + 30 % milestones + 25 % tasks + 15 % deliverables (partial means, renormalised) | `services/ventures/readiness.js` | investment page, journey report, growth tabs | returns **0** when all null; filing evidence can lower it |
| 5 | Data Room readiness | required categories only; verified 1, rejected 0.5, else 0; `null` if none required | `dataRoom/access.js` + batch | ventures list, intelligence, investor matching | rejected document *raises* score; verified non-required ignored |
| 6 | Verification readiness | active required document types; verified 1, rejected 0.5 | `models/ventureReadiness.js` | verification gauge | **different tables/denominator from #5** |
| 7 | Stage + Evidence | 0.4 × stage + 0.6 × Data Room | `services/ventures/dashboard.js` | admin dashboard | fourth “readiness” number |
| 8 | Venture analytics | 40/40/20 milestone/task/deliverable; health penalty; productivity | `services/ventures/analytics.js` | admin reports | three completion numbers on one page |
| 9 | 10-category investment readiness | weighted assessments, stored | `services/ventures/investmentReadiness.js` | none (route retired) | dead endpoint; reads dead wizard |
| 10 | Journey-report numbers | stage % strict; header % roadmap; overdue by due date | `journey-report` route | admin reports, staff timeline | two percentages, two formulas |
| 11 | Lead-manager KPIs | counts by assignment | `leadManagerDashboard.js` | `/staff` lead home | milestone read lacks archive filter |
| 12 | Intelligence metrics | ready/total; overdue | `models/intelligence.js` | `/admin/intelligence` | denominator includes archived/unmeasurable |
| 13 | Investor `completion_index`/`funding_requirement` | read from `v2_programs` | `investor/dashboardsAndKpis.js` | investor cards/campaigns | 0/3 staging ventures exist there → NULL → 0 %/$0 |
| 14 | Program `completion_index` | sessions/docs/report weeks/submissions | `programs/programList.js` | admin metrics, investor KPI | a **program** metric wearing a venture label |
| 15 | Venture KPI widgets | current/target; auto-calc milestones/tasks | `dashboard.js`, `ventureJourney/kpis.js` | venture dashboard | task auto-calc uses `status='done'` only; milestones include archived; no history |
| 16 | Business performance | **no calculation exists** | — | — | confirmed |

**Explicit answers:** same metric computed differently? **Yes** — readiness (4 live + 1 retired), completion (3 on one page), milestone progress (3 ways), investor `completion_index` (program metric). Zero/missing consistent? **No** — Data Room/verification return `null`; other screens coerce to `0`. Archived/rejected/incomplete? Archived excluded almost everywhere **except** lead-manager milestones; rejected = 0.5 in documents but 0 in roadmap deliverables; `under_review` = 0 consistently. Safe to reuse: personal completion, Data Room completeness (with the 0.5 decision), derived milestone status, overdue/awaiting counts.

---

# PART II — REPORTING READINESS

## 6. Requirement Coverage Matrix

Legend — **Status:** S=Supported · P=Partially · DocD=Document-dependent · Calc=Calculable · M=Missing · U=Unverified. **Doc:** could a business document contain it. **AI:** existing extraction today (N unless stated). **VD/PR:** venture dashboard / portfolio report today. **Credits:** S / DE / DP / D / E2E.

### 6.1 Business Profile and Business Model (14)

| # | Requirement | Status | Primary source | Doc | AI | VD/PR | S | DE | DP | D | E2E | Gap → action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1.1 | Identity and description | S | `ventures.name/company_name`, `description`, `mission/vision` | Y | N | P/P | 1 | 0 | 1 | .5 | 0 | no review/version; not on dashboard → summary + versioning |
| 1.2 | Industry and sector | P | `industry`, `sector`, `venture_option_values` | Y | N | P/P | .5 | 0 | 1 | .5 | 0 | free text drift → validate against options |
| 1.3 | Location, website, social | P | `country`, `country_code`, `website`, `social_media` | Y | N | P/N | .5 | 0 | 1 | .5 | 0 | country nulled on save; no city/address → fix + add address |
| 1.4 | Year founded, company status | P | `status` + lifecycle; **no year** | Y | N | P/P | .5 | 0 | 1 | .5 | 0 | add year; status history |
| 1.5 | Problem/solution/value proposition | DocD | `venture_business_models.lean_canvas` (API-only) | Y | N | N/N | .5 | 0 | 1 | 0 | 0 | no UI → expose lean canvas/three fields |
| 1.6 | Products and services | DocD | `description`; Data Room `product_technology` | Y | N | P/N | 0 | 0 | 1 | .5 | 0 | add product/service record |
| 1.7 | Target customers/profiles | DocD | `venture_customer_interviews.customer_segment` (API) | Y | N | N/N | .5 | 0 | 1 | 0 | 0 | add ICP/segments |
| 1.8 | Market/competitive advantage | DocD | Data Room `market_traction`, pitch deck | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | add market/competition block |
| 1.9 | Business model/revenue model | P | `venture_business_models` (API-only) | Y | N | N/N | .5 | 0 | 1 | 0 | 0 | build editor; version rows |
| 1.10 | Pricing and revenue streams | P | `revenue_streams` (API); no pricing | Y | N | N/N | .5 | 0 | 1 | 0 | 0 | add pricing/unit economics |
| 1.11 | Sales channels/delivery model | P | canvas `channels` (API); no delivery | Y | N | N/N | .5 | 0 | 1 | 0 | 0 | add fields + UI |
| 1.12 | Partners and cost structure | P | `key_partners`, `cost_structure` (API) | Y | N | N/N | .5 | 0 | 1 | 0 | 0 | UI or capture via import |
| 1.13 | Stage and product maturity | P | `business_stage`; 3 vocabularies; no maturity | Y | N | P/P | .5 | 0 | 1 | .5 | 0 | one vocabulary; add maturity/history |
| 1.14 | Primary 90-day objective | P | `north_star` (no UI); journey objective; XLSX import | Y | **P** | P/N | .5 | 1 | 1 | .5 | 0 | expose north star; keep reviewed import |

### 6.2 Registration and Legal (6)

| # | Requirement | Status | Primary source | Doc | AI | VD/PR | S | DE | DP | D | E2E | Gap → action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2.1 | Registration status | P | `registration_status` (nulled on save) | Y | N | P/N | .5 | 0 | 1 | .5 | 0 | fix form; require doc when Registered |
| 2.2 | Legal structure | M | dead wizard only | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | add field + validation |
| 2.3 | Registration number/date/address | P | `registration_number` (admin only); no date/address | Y | N | P/N | .5 | 0 | 1 | .5 | 0 | add fields; founder input; format check |
| 2.4 | Licences and permits | DocD | Data Room `legal_corporate`; Data bank `legal_documents` | Y | N | P/N | .5 | 0 | 1 | .5 | 0 | add licence metadata register |
| 2.5 | Corporate/compliance info | DocD | Data Room/due diligence docs; no entity/cap table | Y | N | P/P | .5 | 0 | 1 | .5 | 0 | corporate record or document-only decision |
| 2.6 | Supporting docs in Data Room | S | `venture_documents` + versions + requirements + grants | — | N | P/P | 1 | 0 | 1 | .5 | **1** | keep; extraction later if needed |

### 6.3 Founders and Team (9)

| # | Requirement | Status | Primary source | Doc | AI | VD/PR | S | DE | DP | D | E2E | Gap → action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 3.1 | Founder identities and roles | P | `venture_members` + `contacts`; role conflict | Y | N | Y/P | .5 | 0 | 1 | 1 | 0 | reconcile roles; one roster; fix invite |
| 3.2 | Lead founder | S | `is_owner`/`lead_founder`; `ownership_history` | Y | N | Y/N | 1 | 0 | 1 | 1 | 0 | expose in portfolio |
| 3.3 | Management team | P | `venture_members`; founder invite disabled | Y | N | Y/P | .5 | 0 | 1 | 1 | 0 | enable invite; employment type |
| 3.4 | Team size | P | roster count; no headcount/FTE | Y | N | Y/P | .5 | 0 | 1 | 1 | 0 | add headcount/FTE |
| 3.5 | FT/PT/seasonal | M | — | Y | N | N/N | 0 | 0 | .5 | 0 | 0 | employment type |
| 3.6 | Employment by gender | M | `contacts.gender` not venture-scoped | Y | N | N/N | 0 | 0 | .5 | 0 | 0 | demographics + consent |
| 3.7 | Youth employment | M | `contacts.dob` not venture-scoped | Y | N | N/N | 0 | 0 | .5 | 0 | 0 | age band |
| 3.8 | Advisors and mentors | S | `venture_advisors`, `venture_coaches` | Y | N | P/N | 1 | 0 | 1 | .5 | 0 | widget shape bug → return lists |
| 3.9 | Changes in founders/management/workforce | P | `removed_at`, `ownership_history`, logs | P | N | P/N | .5 | 0 | 0 | .5 | 0 | append-only people-change log |

### 6.4 Initial Business Baseline (12)

| # | Requirement | Status | Primary source | Doc | AI | VD/PR | S | DE | DP | D | E2E | Gap → action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 4.1 | Revenue | M | no field; finance program-level | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | immutable baseline + series |
| 4.2 | Operating expenditure | M | — | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | same |
| 4.3 | Cash balance | M | — | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | same |
| 4.4 | Funding received to date | Calc | campaigns/decisions (committed) | Y | N | P/P | .5 | 0 | 1 | .5 | 0 | funding ledger (committed vs disbursed) |
| 4.5 | Funding sources | P | opportunities/campaigns | Y | N | P/P | .5 | 0 | 1 | .5 | 0 | funding-round history |
| 4.6 | Active customers | M | no field; CRM unlinked | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | baseline + monthly series |
| 4.7 | Active users | M | no field | P | N | N/N | 0 | 0 | .5 | 0 | 0 | metric/import |
| 4.8 | Employment | P | roster only | Y | N | P/P | .5 | 0 | 1 | .5 | 0 | employment block |
| 4.9 | Impact measures | M | no indicator table | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | define indicators + baseline |
| 4.10 | Supporting evidence | S | Data Room financial/market/impact | — | N | P/P | 1 | 0 | 1 | .5 | **1** | link evidence to metrics |
| 4.11 | Source and validation status | P | document-level review only | P | N | P/N | .5 | 0 | 1 | .5 | 0 | per-value source/as-of/validator |
| 4.12 | Historical baselines per intervention | M | no cohort model | P | N | N/N | 0 | 0 | .5 | 0 | 0 | immutable baseline per intervention |

### 6.5 Financial Performance (10)

| # | Requirement | Status | Primary source | Doc | AI | VD/PR | S | DE | DP | D | E2E | Gap → action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 5.1 | Revenue | M | — | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | period series |
| 5.2 | Operating expenditure | M | — | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | period series |
| 5.3 | Cash balance | M | — | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | period series |
| 5.4 | Funding received in period | P | opportunities `closed_won`; stage history | Y | N | P/P | .5 | 0 | 1 | .5 | 0 | dated funding events |
| 5.5 | Funding history and sources | P | opportunities + stage history | Y | N | P/P | .5 | 0 | 1 | .5 | 0 | funding-round history |
| 5.6 | Funding commitments | Calc | stage/amount/probability | Y | N | P/P | .5 | 0 | 1 | .5 | 0 | signed commitment rows |
| 5.7 | Financial explanations | P | `venture_reports.summary/challenges` | Y | N | P/P | .5 | 0 | 1 | .5 | 0 | tie commentary to period figures |
| 5.8 | Reporting currency | P | campaign/opportunity only | Y | N | P/N | .5 | 0 | 1 | .5 | 0 | currency per figure/venture |
| 5.9 | Reporting date and period | P | free-text period; no as_of | Y | N | P/P | .5 | 0 | 1 | .5 | 0 | real start/end |
| 5.10 | Financial statements/documents | S | Data Room `financials_projections` | — | N | P/P | 1 | 0 | 1 | .5 | **1** | keep; extraction later |

### 6.6 Customers, Sales, Market Traction (13)

| # | Requirement | Status | Primary source | Doc | AI | VD/PR | S | DE | DP | D | E2E | Gap → action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 6.1 | Active customers | M | no field; CRM unlinked | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | baseline + monthly |
| 6.2 | New and lost customers | M | — | Y | N | N/N | 0 | 0 | .5 | 0 | 0 | movement series |
| 6.3 | Active users | M | — | P | N | N/N | 0 | 0 | .5 | 0 | 0 | analytics integration |
| 6.4 | Leads | P | `crm_leads` (no venture_id) | Y | N | N/N | .5 | 0 | 1 | 0 | 0 | link CRM to venture |
| 6.5 | Sales conversions | P | CRM qualification/opportunities (no FK) | Y | N | N/N | .5 | 0 | 1 | 0 | 0 | same |
| 6.6 | Sales pipeline and value | P | `crm_opportunities` (no FK) | Y | N | N/N | .5 | 0 | 1 | 0 | 0 | same |
| 6.7 | Customer feedback | P | `venture_pmf_assessments` (API) | Y | N | N/N | .5 | 0 | 1 | 0 | 0 | survey module |
| 6.8 | Discovery interviews | P | `venture_customer_interviews` (API) | Y | N | N/N | .5 | 0 | 1 | 0 | 0 | UI; extract insights |
| 6.9 | Pilots initiated/completed | M | — | Y | N | N/N | 0 | 0 | .5 | 0 | 0 | pilot tracker |
| 6.10 | Letters of intent | DocD | Data Room `market_traction` | Y | N | P/N | .5 | 0 | 1 | .5 | 0 | LOI register |
| 6.11 | Waitlists/early sign-ups | M | — | P | N | N/N | 0 | 0 | .5 | 0 | 0 | metric/import |
| 6.12 | Pilot-to-paid conversion | M | — | P | N | N/N | 0 | 0 | .5 | 0 | 0 | conversion tracking |
| 6.13 | Market research/evidence | P | Data Room + interviews | Y | N | P/N | .5 | 0 | 1 | .5 | 0 | research index |

### 6.7 Product and Business Development (11)

| # | Requirement | Status | Primary source | Doc | AI | VD/PR | S | DE | DP | D | E2E | Gap → action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 7.1 | Product development progress | S | journey/milestones/tasks/deliverables; analytics | Y | N | Y/P | 1 | 0 | 1 | 1 | 0 | product milestone type; portfolio roll-up |
| 7.2 | Product maturity | P | `business_stage`; PMF/validations (API) | Y | N | P/N | .5 | 0 | 1 | .5 | 0 | maturity enum + history |
| 7.3 | MVP progress | P | `business_stage='mvp'`; work plan | Y | N | P/N | .5 | 0 | 1 | .5 | 0 | MVP scope checklist |
| 7.4 | Product milestones/launches | P | milestones; no type/launched_at | Y | N | Y/P | .5 | 0 | 1 | 1 | 0 | launch fields |
| 7.5 | New products/services | DocD | business model API; no register | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | product/service records |
| 7.6 | Business model changes | P | business model API; no versions | Y | N | N/N | .5 | 0 | 1 | 0 | 0 | versioned snapshots |
| 7.7 | New partnerships | P | `key_partners` API; CRM orgs unlinked | Y | N | N/N | .5 | 0 | 1 | 0 | 0 | partner records/CRM link |
| 7.8 | Market expansion | DocD | `country` only | P | N | N/N | 0 | 0 | .5 | 0 | 0 | markets/regions list |
| 7.9 | Commercial development | DocD | no venture-linked pipeline | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | venture commercial pipeline |
| 7.10 | Major achievements | P | `venture_reports.completed_items` | Y | N | P/P | .5 | 0 | 1 | .5 | 0 | structured achievements |
| 7.11 | Challenges and business changes | P | reports `challenges`; blockers; change log | Y | N | P/P | .5 | 0 | 1 | .5 | 0 | challenge/change register |

### 6.8 Funding and Fundraising (9)

| # | Requirement | Status | Primary source | Doc | AI | VD/PR | S | DE | DP | D | E2E | Gap → action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 8.1 | Funding received to date | Calc | campaigns/decisions (committed) | Y | N | N/P | .5 | 0 | 1 | 0 | 0 | funding ledger with dates/source |
| 8.2 | Funding sources | P | opportunities/campaigns | Y | N | N/P | .5 | 0 | 1 | 0 | 0 | source dimension |
| 8.3 | New funding in a period | Calc | decision dates/stage history | Y | N | N/N | .5 | 0 | 1 | 0 | 0 | period query + ledger |
| 8.4 | Funding commitments | P | expected/probability | Y | N | P/P | .5 | 0 | 1 | .5 | 0 | commitment record |
| 8.5 | Fundraising progress | S | stages + history; admin page | Y | N | P/P | 1 | 0 | 1 | .5 | 0 | portfolio progress |
| 8.6 | Funding requirement | P | campaign target; legacy program field | Y | N | P/P | .5 | 0 | 1 | .5 | 0 | move target to venture; currency |
| 8.7 | Intended use of funding | DocD | documents only | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | use-of-funds lines |
| 8.8 | Funding status | S | campaign status + stage | Y | N | P/P | 1 | 0 | 1 | .5 | 0 | status history |
| 8.9 | Supporting documents | S | Data Room fundraising/financial | — | N | P/P | 1 | 0 | 1 | .5 | **1** | link docs to funding records |

### 6.9 Employment and Job Creation (11)

| # | Requirement | Status | Primary source | Doc | AI | VD/PR | S | DE | DP | D | E2E | Gap → action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 9.1 | Full-time employment | DocD | no employment model; roster only | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | employment baseline |
| 9.2 | Part-time | DocD | same | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | same |
| 9.3 | Seasonal | DocD | same | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | same |
| 9.4 | Founder count | S | `venture_members.member_type='founder'` | Y | N | Y/N | 1 | 0 | 1 | 1 | **1** | one roster; reconcile ledger |
| 9.5 | Employment by gender | DocD | `contacts.gender` only | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | records + consent |
| 9.6 | Youth employment | DocD | `contacts.dob` only | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | age band |
| 9.7 | Jobs created | DocD | no jobs table | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | jobs ledger + baseline |
| 9.8 | Jobs supported | DocD | same | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | same |
| 9.9 | Workforce changes vs baseline | DocD | no baseline/period series | P | N | N/N | 0 | 0 | .5 | 0 | 0 | baseline + monthly series |
| 9.10 | Supporting employment evidence | P | generic docs + types | Y | N | P/P | .5 | 0 | 1 | .5 | 0 | employment category + link |
| 9.11 | Headcount vs FTE | DocD | dead wizard `team_size` only | Y | N | P/N | 0 | 0 | 1 | .5 | 0 | headcount + FTE |

### 6.10 Impact and Sustainability (9)

| # | Requirement | Status | Primary source | Doc | AI | VD/PR | S | DE | DP | D | E2E | Gap → action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 10.1 | Customers/beneficiaries reached | P | manual KPI only | Y | N | N/N | .5 | 0 | 1 | 0 | 0 | indicator + period + source |
| 10.2 | Women-led/co-founded | P | `contacts.gender` (unreliable) | P | N | N/N | .5 | 0 | .5 | 0 | 0 | flag with consent; surface |
| 10.3 | Jobs created and supported | DocD | no jobs table | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | jobs indicators |
| 10.4 | Gender/youth impact | DocD | no disaggregation | P | N | N/N | 0 | 0 | .5 | 0 | 0 | define indicators |
| 10.5 | Local suppliers/SMEs | DocD | no supplier data | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | procurement records |
| 10.6 | Formalisation/compliance progress | P | `registration_status` + verification | Y | N | P/P | 1 | 0 | 1 | .5 | 0 | dated compliance milestones |
| 10.7 | SDG indicators | DocD | no taxonomy | P | N | N/N | 0 | 0 | .5 | 0 | 0 | SDG mapping |
| 10.8 | Environmental impact | DocD | no metrics | P | N | N/N | 0 | 0 | .5 | 0 | 0 | environmental indicators |
| 10.9 | Supporting evidence | S | Data Room `impact_sustainability` | — | N | P/P | 1 | 0 | 1 | .5 | **1** | make required; link to indicators |

### 6.11 Strategic Progress, Risks, Support (10)

| # | Requirement | Status | Primary source | Doc | AI | VD/PR | S | DE | DP | D | E2E | Gap → action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 11.1 | Business objectives | P | journey/milestone objectives; `north_star` no UI | Y | N | P/N | .5 | 0 | 1 | .5 | 0 | venture objectives register |
| 11.2 | Progress against objectives | P | work progress; no objective link | Y | N | P/N | .5 | 0 | 1 | .5 | 0 | objective KPIs; one formula |
| 11.3 | Key achievements | P | `venture_reports.completed_items` | Y | N | P/P | .5 | 0 | 1 | .5 | 0 | structured achievements |
| 11.4 | Significant challenges | P | reports `challenges`; blockers | Y | N | P/P | .5 | 0 | 1 | .5 | 0 | challenge register |
| 11.5 | Business/operational risks | P | blockers; investor `risk_assessments` | Y | N | P/N | .5 | 0 | 1 | .5 | 0 | venture risk register |
| 11.6 | Material changes | P | change/history/activity logs | Y | N | P/N | .5 | 0 | 1 | .5 | 0 | materiality + events |
| 11.7 | Support required | DocD | no field | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | support request (type/urgency) |
| 11.8 | Support provided | P | reports `support_delivered`; assignments | Y | N | P/N | .5 | 0 | 1 | .5 | 0 | support-delivery log |
| 11.9 | Next-period priorities | P | standups (invisible); action plans | Y | N | N/N | .5 | 0 | 1 | 0 | 0 | surface standups/report section |
| 11.10 | Strategic outlook | P | `venture_updates` (investor-only) | Y | N | N/N | .5 | 0 | 1 | 0 | 0 | venture-side authoring |

### 6.12 Business Continuity and Venture Status (6)

| # | Requirement | Status | Primary source | Doc | AI | VD/PR | S | DE | DP | D | E2E | Gap → action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 12.1 | Company status | S | `ventures.status` + lifecycle + `is_archived` | Y | N | Y/P | 1 | 0 | 1 | 1 | **1** | fix badge/labels; status history |
| 12.2 | Operating status | P | conflated with company status | Y | N | Y/P | .5 | 0 | 1 | 1 | 0 | add operating status + reason |
| 12.3 | Revenue-generating status | U | no field; form data unlinked | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | add flag + revenue period |
| 12.4 | Business continuity | DocD | no model | P | N | N/N | 0 | 0 | .5 | 0 | 0 | continuity checklist |
| 12.5 | Material events | P | activity/history/change logs | Y | N | P/N | .5 | 0 | 1 | .5 | 0 | material-event record |
| 12.6 | Inactivity or closure | P | `paused`/`archived`; no reason/date | Y | N | P/P | .5 | 0 | 1 | .5 | 0 | last-activity + closure fields |

### 6.13 Coverage totals

| Cat | Req | S | DE | DP | D | E2E |
|---|---:|---:|---:|---:|---:|---:|
| 1 Business Profile & Model | 14 | 6.5 (46 %) | 1 (7 %) | 14 (100 %) | 3.5 (25 %) | 0 |
| 2 Registration & Legal | 6 | 3 (50 %) | 0 | 6 (100 %) | 2.5 (42 %) | 1 (17 %) |
| 3 Founders & Team | 9 | 4 (44 %) | 0 | 6.5 (72 %) | 5 (56 %) | 0 |
| 4 Initial Baseline | 12 | 3 (25 %) | 0 | 11 (92 %) | 2.5 (21 %) | 1 (8 %) |
| 5 Financial Performance | 10 | 4 (40 %) | 0 | 10 (100 %) | 3.5 (35 %) | 1 (10 %) |
| 6 Customers & Traction | 13 | 3.5 (27 %) | 0 | 10.5 (81 %) | 1 (8 %) | 0 |
| 7 Product & Development | 11 | 4.5 (41 %) | 0 | 10.5 (96 %) | 4 (36 %) | 0 |
| 8 Funding & Fundraising | 9 | 5.5 (61 %) | 0 | 9 (100 %) | 2.5 (28 %) | 1 (11 %) |
| 9 Employment & Jobs | 11 | 1.5 (14 %) | 0 | 10.5 (96 %) | 2 (18 %) | 1 (9 %) |
| 10 Impact & Sustainability | 9 | 3 (33 %) | 0 | 7 (78 %) | 1 (11 %) | 1 (11 %) |
| 11 Strategy, Risks, Support | 10 | 4.5 (45 %) | 0 | 10 (100 %) | 3.5 (35 %) | 0 |
| 12 Continuity & Status | 6 | 2.5 (42 %) | 0 | 5.5 (92 %) | 3 (50 %) | 1 (17 %) |
| **Total** | **120** | **45.5 (37.9 %)** | **1 (0.8 %)** | **110.5 (92.1 %)** | **34 (28.3 %)** | **7 (5.8 %)** |

**Answer:** **No — existing functionality does not reach 70 %.** Structured 37.9 %, dashboard 28.3 %, end-to-end 5.8 %. Only document *potential* reaches 92.1 %, and it is not achieved.

---

## 7. Document-First Workflow Assessment

| Step | Current state | Evidence |
|---|---|---|
| 1. Submission (upload PDF, keep original) | **Partial** | private bucket, 10 MB cap, single file, PDF/DOC/DOCX/XLS/XLSX/PPT/images; version 1 written; **no reporting period** |
| 2. Association (venture + period) | **Partial** | venture + 11 categories + per-venture requirement levels; **no period/as_of**; no 12-category taxonomy |
| 3. Access (authorised reader) | **Works** | Super Admin full; 1-hour signed URLs; inline view; PDF/image/DOCX/XLSX preview |
| 4. AI analysis | **Missing** | DeepSeek exists, but no path from a venture document to a prompt |
| 5. Structured extraction | **Partial infra / Missing pipeline** | `unpdf` only for platform run-report files; XLSX/CSV plan import; **no OCR**; no PDF table parsing; no extraction on venture documents |
| 6. Review and validation | **Partial** | document-level `uploaded→under_review→verified/rejected`; **no value-level** validation; prior notes overwritten |
| 7. Historical reporting/corrections | **Missing** | no period model; `venture_kpis` overwrite; reports unversioned; no value history |
| 8. Dashboard/management reporting | **Partial** | readiness uses document statuses; no extracted figure reaches a dashboard |

**Hard limits:** no OCR; no PDF table parsing; no period model; no value provenance; no value history; no document→AI path; 10 MB; synchronous AI, no queue; DeepSeek 20 k cap; upload hardening gaps; schema drift.

---

## 8. Dashboard Readiness by Category

| Category | Readiness | What exists | Missing |
|---|---|---|---|
| 1 Business Profile & Model | **Low–Medium** | identity/stage/status; profile page | most identity fields; period; summary dashboard |
| 2 Registration & Legal | **Medium** | legal docs + review; verification | structured entity/licence record |
| 3 Founders & Team | **Medium** | roster/lead/advisors | employment model; invite; one roster |
| 4 Initial Baseline | **Low** | documents only | baseline object/period/validation |
| 5 Financial Performance | **Low–Medium** | financial documents | figures/currency/period/history |
| 6 Customers & Traction | **Low** | interviews/PMF APIs; unlinked CRM | venture-linked leads/sales/customers |
| 7 Product & Development | **Medium** | execution progress | product metrics/maturity; `completed_at` |
| 8 Funding & Fundraising | **Medium** | campaigns/opportunities; admin page | period/portfolio; committed≠received |
| 9 Employment & Jobs | **Low** | founder count | headcount/FTE/type/gender/youth/jobs |
| 10 Impact & Sustainability | **Low** | impact documents | indicators/SDG/environment |
| 11 Strategy, Risks, Support | **Medium** | reports/blockers/logs | objective/risk/challenge registers; period |
| 12 Continuity & Status | **Medium–High** | status/lifecycle/archive | operating status; closure reason/date |

**Architecture verdict:** operational spine + Data Room are reusable; the business reporting layer does not exist. Dashboards are hardcoded, have no period selector/comparison, and most portfolio metrics are single-venture routes.

# PART III — CONSOLIDATED GAP AND RISK REGISTER

Classification: **NI** not implemented · **II** implemented but incomplete · **IR** implemented but unreliable · **ID** inaccessible/disconnected · **BC** requires business clarification · **WI** working as intended · **CV** cannot verify from available evidence.

| # | Gap / risk | Class | Severity | Evidence |
|---|---|---|---|---|
| G1 | No reporting-period model (`period_start/end`, `as_of`) in the venture domain | NI | **Critical** | only two free-text period columns `[V]` |
| G2 | No document → structured data pipeline for venture documents | NI | **Critical** | no caller extracts `venture_documents` `[V]` |
| G3 | No value-level provenance (`source`, `confidence`, `extracted_at`, `validated_by/at`, `currency`) | NI | **Critical** | absent from all venture tables `[V]` |
| G4 | No reporting-value history; KPIs overwrite; reports unversioned | NI | **Critical** | `venture_kpis` upsert; `venture_reports` in-place `[V]` |
| G5 | No initial baseline (financial/customer/employment/impact) | NI | **Critical** | 33 `ventures` columns hold no figures `[V]` |
| G6 | No 12-category taxonomy; 11 Data Room categories + separate Data bank types | NI | High | `lib/dataRoom.js`, `venture_document_types` `[V]` |
| G7 | No OCR — scanned PDFs yield empty text | NI | High | no OCR dependency `[V]` |
| G8 | No PDF table/financial-statement parsing | NI | High | `unpdf` linear text only `[V]` |
| G9 | CRM not venture-linked — no `venture_id` on any `crm_*` table | NI | High | live column check, 0/13 `[V]` |
| G10 | No employment/impact model (headcount, FTE, jobs, gender, youth, SDG, environment) | NI | High | no fields/tables `[V]` |
| G11 | Four readiness formulas + one retired | IR | High | `dataRoom/access.js`, `ventureReadiness.js`, `dashboard.js`, `readiness.js` `[V]` |
| G12 | Three completion formulas on the same Reports page | IR | High | analytics 14 %, roadmap 18 %, strict 17 % `[V]` |
| G13 | Null vs zero inconsistency | BC/IR | High | Data Room returns `null`; other screens coerce to `0` `[V]` |
| G14 | Two document-readiness engines with different tables/denominators | IR | High | §5 #5/#6 `[V]` |
| G15 | Investor `completion_index`/`funding_requirement` read `v2_programs` → 0/$0 | IR | Medium | `investor/dashboardsAndKpis.js` `[V]` |
| G16 | No portfolio batch endpoint; most metrics single-venture | NI | High | `[V]` |
| G17 | No period selector or period comparison anywhere | NI | High | `[V]` |
| G18 | Dashboards hardcoded / not configurable | II | Medium | fixed components `[V]` |
| G19 | No requirement due dates; no overdue/incomplete submission detection | NI | Medium | Data Room has `expires_at` only `[V]` |
| G20 | Review history thin; prior decisions/notes overwritten | II | Medium | only latest `review_notes` `[V]` |
| G21 | Reports self-reviewed; no independent approver | II | Medium | `venture_reports.status` set by author `[V]` |
| G22 | Tasks/milestones lack `completed_at` | II | Medium | schema `[V]` |
| G23 | Collected but invisible: attendance (no UI writer), standups/retros (not rendered), updates (investor-only) | ID | Medium | `[V]` |
| G24 | People paths: founder invite broken, team invite disabled, two rosters, role-vocabulary 400s | IR/ID | Medium | §1, §2 `[V]` |
| G25 | Upload hardening: extension-OR-MIME, no AV, public buckets elsewhere | IR | Medium | `docs/SECURITY_AUDIT_REGISTER.md` UPLOAD-1 `[V]` |
| G26 | Schema drift/type anomalies (`venture_kpi_definitions.venture_id` integer; `venture_reports.id` integer; `is_archived` integer; duplicate columns) | IR | Medium | live schema `[V]` |
| G27 | AI constraints: DeepSeek only, 20 k reference cap, synchronous, no queue, JSON not schema-validated | II | Medium | `src/lib/deepseek.js` `[V]` |
| G28 | 10 MB cap; multi-page scans may exceed | II | Low–Medium | `DATA_ROOM_MAX_FILE_MB` `[V]` |
| G29 | Staging has no reporting data → behaviour unverified | CV | Evidence limit | 0 reports/updates/KPIs `[V]` |
| G30 | Founder profile save nulls `country`, `registration_status`, `north_star` | IR | High | `ventureScreenModel.js` vs `ventureScreenHelpers.js` `[V]` |
| G31 | Business-stage vocabulary drift; `mvp` displays as “Idea” | IR | High | three lists `[V]` |
| G32 | Business-model/interviews/validations/PMF/KPIs APIs have no UI | ID | Medium | zero UI callers `[V]` |
| G33 | Dead startup wizard; “0/6” widget; route missing | ID | Medium | `[V]` |
| G34 | 11 admin venture sub-pages URL-only; journey-reports portfolio unlinked | ID | Medium | `[V]` |
| G35 | Working as intended (do not rebuild): creation/invite/acceptance, personal identity model, Data Room engine, operational spine, derived milestone status, personal profile gate | WI | — | §1, §4 `[V]` |
| G36 | Production schema/data differences (`ventures.id` type, data volumes) | CV | Unknown | production not queried `[U]` |

---

# PART IV — DECISIONS REQUIRED

| # | Decision | Why it matters | Evidence |
|---|---|---|---|
| D1 | **Define the Venture Profile scope** (required / optional / conditional) and add the missing business fields (problem, solution, value proposition, target customers, product maturity, 90-day objective, pricing, channels, delivery model, year founded, legal structure, address, team size) | The profile anchors every later metric and report | §2 |
| D2 | **Choose the baseline model**: an immutable baseline record (`as_of`, currency, source, one per venture) vs. the first row of a monthly series | Without a fixed day-one record, no progress or cohort comparison is possible; `ventures` columns would be silently overwritten | §3 |
| D3 | **Define the reporting cadence and period model** (monthly / quarterly / stage-based; real start/end; uniqueness per venture+period) | Current `reporting_period` is free text and cannot be aggregated | §3, §5 |
| D4 | **Define KPI governance and history** (who defines, units, append-only history) | `venture_kpis` overwrites; no trend possible | §5 |
| D5 | **Choose ONE investment-readiness definition**; retire/merge the second document-readiness engine | Four numbers disagree; the admin dashboard and the investment page answer differently | §5 |
| D6 | **Choose the rejected-evidence rule** (0.5 vs 0) and apply it to documents *and* deliverables | Rejection raises document readiness and lowers deliverable readiness today | §5 |
| D7 | **Define null-vs-zero semantics** and how aggregates treat “not measurable” | “0 % ready” conflates *not ready* with *no data* | §5 |
| D8 | **Approve one business-stage vocabulary + migration mapping** (`mvp`, `early_traction`, `scaling`) | Same venture displays differently to founder/admin/reports | §2 |
| D9 | **Declare `venture_members` the single roster**; decide the fate of `venture_founders` and the team invite | Counts/permissions can disagree; an admin invite creates an orphan | §1, §2 |
| D10 | **Define employment** (headcount vs FTE; founders vs employees; part-time/seasonal) | Any employment baseline or impact metric depends on it | §3 |
| D11 | **Choose impact indicators** and their verification/period model (or defer explicitly) | Impact is currently documents only | §3 |
| D12 | **Decide the investor-field source** (move `completion_index`/`funding_requirement` to the venture/Data Room or stop rendering 0) | Investor cards show 0 %/$0 for ventures that exist | §5 |
| D13 | **Decide what to do with parked surfaces** (11 URL-only admin pages, dead wizard, journey-reports portfolio) | Either expose, delete or document them | §1 |
| D14 | **Decide the document-first scope**: text PDFs + spreadsheets only, or scans/OCR included | Determines extraction architecture, cost and the achievable coverage | §7 |
| D15 | **Approve the extraction trust model**: AI output is always a *proposal* until a named reviewer validates it; corrections append rather than overwrite | Prevents unvalidated figures reaching dashboards | §7 |

---

# PART V — RECOMMENDED NEXT STEPS

## A. Reuse as-is
- Data Room: private storage, versions, review states, grants, access logs, per-venture requirement levels.
- Operational spine: journey stages, milestones, tasks, deliverable reviews, sessions.
- Written progress reports as the narrative layer.
- The **plan-import pattern** (`propose → correct → apply`) as the model for document extraction.
- `unpdf` text extraction, `read-excel-file`/`papaparse` spreadsheet import, the DeepSeek adapter with guardrails/chunking.

## B. Repair before extending
- One readiness definition; one completion formula; consistent null vs zero; retire the second document-readiness engine.
- Fix the founder profile save (country / registration status / north star); founder invite; team invite; role vocabulary; roster split.
- Add `completed_at` to milestones/tasks; version `venture_reports`; independent review; investor `v2_programs` reads; upload hardening.

## C. Minimum changes to support the reporting framework (the ≥70 % path)
1. **Period model** — `period_start`, `period_end`, `as_of`, `currency`; unique per venture + period; required on every report.
2. **Taxonomy** — the 12 categories + sub-indicators; per-venture applicability (reuse the Data Room requirement pattern).
3. **Extraction pipeline** — on upload: text extraction with `ok/empty/failed`; classification; AI extraction via DeepSeek with chunking; persist proposals; decide OCR scope.
4. **Valued store** — append-only `(venture, indicator, period, value, currency, source document/version, confidence, review_status, validated_by/at)`; corrections as new rows; evidence drill-down.
5. **Review workflow** — proposed → reviewed → validated/rejected, with the original document one click away; distinguish AI-extracted from validated in every read.
6. **Dashboard/portfolio read layer** — one definition per indicator; period selector/comparison; missing ≠ zero; batch portfolio endpoint; overdue detection against real due dates.

## D. Defer
- OCR for scans (if the first scope is text PDFs + spreadsheets), external accounting/product-analytics integrations, SDG/environmental taxonomy depth, automated reminders, e-signature, independent second-reviewer workflow.

## E. Sequence
1. Ratify D1–D5 (profile, baseline, period, KPI, one readiness definition) and D14–D15 (document scope/trust model).
2. Approve the 12-category taxonomy and per-venture applicability.
3. Design (not implement) the period + valued store and the extraction workflow.
4. Build extraction on text PDFs/spreadsheets; add OCR only if evidence demands it.
5. Wire review, dashboards and portfolio reports.
6. **Re-run this assessment with the same method**; only then claim a coverage figure.

---

## Appendix — Evidence index and limits

**Verified live (2026-10-26):** counts and schema in §0; 308 public tables; no `as_of`/`baseline`/`ocr`/`ai_`/`source`/`confidence`/`currency` in the venture domain; two free-text period columns; `crm_*` has no `venture_id`; `ventures.id` uuid / `venture_id` text; 3 ventures all `idea`/`active`; 2 Data Room documents (1 verified, 1 rejected); 0 reports/updates/KPIs/fundraising/decisions. `[V]`

**Source documents used:** `docs/VENTURE_SETUP_AUDIT.md`, `docs/VENTURE_IDENTITY_PHASE0.md`, `docs/HANDOVER_VENTURES.md`, `docs/VENTURES_LANE.md`, `docs/venture-os-legacy-map.md`, `docs/WS5_DATA_ROOM_AUDIT.md`, `docs/SECURITY_AUDIT_REGISTER.md`.

**Not verified:** runtime click-through and redirects; real email delivery; production schema/data (production not queried); reporting behaviour (staging has no reporting rows); whether the manual backfills (`backfill:founder-ledger`, `db:venture-identity`) have run.

**What this assessment did not do:** no code, schema, migration, data, permission, API, calculation or UI change; no sample records; no production access; no proposed requirement treated as approved.

*End of consolidated assessment.*

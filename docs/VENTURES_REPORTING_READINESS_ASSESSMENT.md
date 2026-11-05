# ImpactOS Ventures — Current System Capability and Reporting Readiness Assessment

**Mode:** read-only. No application code, schema, data, permissions, APIs, calculations or UIs were modified. No migrations or sample records were created.
**Date:** 2026-10-26 · **Target:** staging (`mbpaxrfhqqclzyiefuab`), queried read-only via `.env.audit-staging`.
**Evidence tags:** `[V]` verified in source and/or live staging data · `[I]` inferred from code paths · `[U]` unverified (needs runtime click-through or production data).
**Reference document:** the *“ImpactOS: Ventures Module — Business Analysis and Data Requirements — Consolidated Working Document”* is **not in this repository**. The comparison below uses the 12 categories and the intended flow in your brief, plus the two venture documents in the repo (`docs/VENTURE_SETUP_AUDIT.md`, `docs/VENTURE_IDENTITY_PHASE0.md`).

### Live staging facts (verified by SQL, 2026-10-26)

| Fact | Value |
|---|---|
| Contacts / ventures | **11 / 3** |
| Ventures by stage / status | all `idea` / all `active`; `industry`, `country`, `registration_status` = NULL on all 3 |
| Founder memberships | 2 (`venture_members`); `venture_founders` = **0** |
| Journey / milestones / tasks / deliverables / reviews | 2 / 7 / 27 / 28 / 14 |
| Sessions / attendance | 2 / **0** |
| Standups / retros / written reports / updates | 0 / 0 / 0 / 0 |
| KPIs / KPI definitions / KPI assignments | 0 / 0 / 0 |
| Data Room documents / versions / document types / requirements / grants | 2 / 2 / 12 / 11 / 0 |
| Document statuses | 1 `verified` (JPG, `legal_corporate`), 1 `rejected` (XLSX, `company_overview`) |
| Verifications / items / verification documents | 2 / 12 / 0 |
| Fundraising campaigns / opportunities / investment decisions | 0 / 0 / 0 |
| CRM leads / opportunities / activities | 0 / 1 / 0 |
| Public base tables | **308** |

**Interpretation limit:** the schema and code paths can be verified, but staging contains almost no reporting data — so **reporting behaviour cannot be validated** here, only capability. `.env.local` was not used (it points at the production-looking project: 588 contacts / 5 ventures).

---

## Coverage method (stated before the numbers)

**Requirement unit.** Each bullet in Section 4 of your brief = one requirement. That gives **120 requirement lines** (14 + 6 + 9 + 12 + 10 + 13 + 11 + 9 + 11 + 9 + 10 + 6).

**Weights.** **Equal weight per line.** No priority weights were supplied, so none were invented. This is an assumption: a category with 14 lines counts more than one with 6.

**Credit (0 / 0.5 / 1) per requirement, per measure:**

| Measure | 1 | 0.5 | 0 |
|---|---|---|---|
| **S — existing structured capability** | working records + workflow + UI/API | field/partial workflow, missing UI, validation or history | absent |
| **DE — document-assisted, extraction exists today** | the platform can already extract/obtain it from documents | partial extraction | none (upload alone = 0) |
| **DP — document-assisted potential** | a normal business document could contain it and extraction could be built | only some ventures/partly | no |
| **D — dashboard today** | shown in an existing venture dashboard/report | admin list/detail/raw record only | no |
| **E2E — end-to-end today** | captured/obtained + reviewed + historically preserved + usable | — | not all four |

**Limitations (explicit):**
- Requirements overlap across categories (revenue appears in 4 and 5; employment in 3, 4 and 9; impact in 4 and 10). They are **not deduplicated**; the 120-line denominator slightly over-weights those topics.
- **DE is 1/120** because the only existing file→content extraction in the venture domain is the XLSX plan import (and `unpdf` text extraction exists only for platform run-report files, not venture documents).
- **DP is a potential measure, not capability.** It is shown because you asked for it, but it must never be read as "supported".
- Per-requirement statuses and credits are an **assessment** from code inspection, not a measurement. Two per-category summary rows differed from their row-level sums by ≤1; the row-level sums are used here and the difference does not change any conclusion.
- Data-population claims use the live staging figures above.

---

## Section A — Executive Summary

**Answer to the final question: No — not with existing functionality.**

| Measure | Numerator / denominator | Coverage |
|---|---|---|
| **Existing structured capability** | 45.5 / 120 | **37.9 %** |
| **Document-assisted with existing extraction** | 1 / 120 | **0.8 %** |
| **Document-assisted potential (not achieved)** | 110.5 / 120 | **92.1 %** |
| **Dashboard capability** | 34 / 120 | **28.3 %** |
| **End-to-end capability** | 7 / 120 | **5.8 %** |

**Why it fails today:**
1. **No reporting period and no reporting-value store.** The only period primitives in the entire venture domain are two free-text columns (`venture_reports.reporting_period`, `venture_kpi_assignments.period`). `venture_kpis` overwrites on `(venture_id, kpi_key)`; there is no history table. `[V]`
2. **No document intelligence.** Data Room upload/version/review works, but **no venture document is ever parsed**; there is no OCR, no PDF table parsing, and no AI path from a stored file to a prompt. The only extraction precedent is the run-report attachment path (`unpdf` → `platform_run_report_files.extracted_text`) and the XLSX plan import. `[V]`
3. **No provenance.** There is no `source`, `confidence`, `extracted_at`, `validated_by/at`, `as_of` or `currency` column anywhere in the venture domain. Extracted vs validated cannot be represented. `[V]`
4. **Business data simply is not modelled.** Financials, customers, employment, impact and baseline live only in documents (or nowhere). Financials are a Data Room category, not figures. `[V]`
5. **Dashboards cannot carry it.** They are hardcoded, have no period selector/comparison, and most portfolio views exist only as single-venture routes. Four readiness formulas and three completion formulas disagree. `[V]`

**What the 92.1 % potential means.** The information Future Studio wants is *plausibly present in documents* for ~92 % of the requirement lines (financial statements, business plans, payroll, impact reports, board decks). That is the headroom for a document-first design — **not** current capability. The **0.8 %** DE and **5.8 %** E2E scores show that the pipeline that turns those documents into usable data does not exist.

**Reaching 70 %.** A target of ≥70 % *end-to-end* is plausible **only after** the minimum build in Section F (period model, 12-category taxonomy, extraction pipeline, valued store with provenance, review, dashboard/portfolio reads). It must then be re-measured; this assessment does not claim it today. A target of ≥70 % *document potential* is already true on paper but is not a capability claim.

---

## Section B — Requirement Coverage Matrix

Legend — **Status:** S=Supported · P=Partially · DocD=Document-dependent · Calc=Calculable · M=Missing · U=Unverified.
**Doc:** Y/P/N — could a business document contain it? **AI:** existing extraction today (N unless stated).
**VD/PR:** venture dashboard / portfolio report today (Y/P/N). **Credits:** S / DE / DP / D / E2E.
Sources are verified staging/code names.

### 1 (A) Business Profile and Business Model — 14 requirements

| # | Requirement | Status | Primary source | Doc | AI | VD/PR | S | DE | DP | D | E2E | Gap → action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1.1 | Identity and description | S | `ventures.name/company_name` + `description`/`mission`/`vision`; profile API | Y | N | P/P | 1 | 0 | 1 | .5 | 0 | No review/version; not on dashboard → show summary, version edits |
| 1.2 | Industry and sector | P | `ventures.industry/sector` + `venture_option_values` | Y | N | P/P | .5 | 0 | 1 | .5 | 0 | Free text, vocabulary drift → validate against options |
| 1.3 | Location, website, social | P | `country/country_code/website/social_media` | Y | N | P/N | .5 | 0 | 1 | .5 | 0 | `country` nulled on founder save; no city/address → fix form, add address |
| 1.4 | Year founded, company status | P | `ventures.status` + `/lifecycle`; **no year_founded** | Y | N | P/P | .5 | 0 | 1 | .5 | 0 | Add year; record status history |
| 1.5 | Problem / solution / value proposition | DocD | `venture_business_models.lean_canvas` (API-only) | Y | N | N/N | .5 | 0 | 1 | 0 | 0 | No UI → expose lean canvas or three fields |
| 1.6 | Products and services | DocD | `description`; Data Room `product_technology` | Y | N | P/N | 0 | 0 | 1 | .5 | 0 | No product/service record → add list |
| 1.7 | Target customers / profiles | DocD | `venture_customer_interviews.customer_segment` (API-only); lean canvas | Y | N | N/N | .5 | 0 | 1 | 0 | 0 | No ICP field → add segments/ICP |
| 1.8 | Market / competitive advantage | DocD | No field; Data Room `market_traction`, pitch deck | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | Add market/competition block |
| 1.9 | Business model / revenue model | P | `venture_business_models` (API-only, 0 rows) | Y | N | N/N | .5 | 0 | 1 | 0 | 0 | No UI/history → build editor, version rows |
| 1.10 | Pricing and revenue streams | P | `revenue_streams` (API); **no pricing** | Y | N | N/N | .5 | 0 | 1 | 0 | 0 | Add pricing/unit economics |
| 1.11 | Sales channels and delivery model | P | `business_model_canvas.channels` (API); no delivery field | Y | N | N/N | .5 | 0 | 1 | 0 | 0 | Add fields + UI |
| 1.12 | Partners and cost structure | P | `key_partners`, `cost_structure` (API-only) | Y | N | N/N | .5 | 0 | 1 | 0 | 0 | Build UI or capture via plan import |
| 1.13 | Business stage and product maturity | P | `business_stage`; 3 vocabularies; **no maturity** | Y | N | P/P | .5 | 0 | 1 | .5 | 0 | One vocabulary; add maturity + stage history |
| 1.14 | Primary 90-day objective | P | `north_star` (no UI); journey `objective`; XLSX plan import | Y | **P** | P/N | .5 | 1 | 1 | .5 | 0 | Expose `north_star`; keep reviewed plan import |

### 2 (B) Business Registration and Legal Status — 6

| # | Requirement | Status | Primary source | Doc | AI | VD/PR | S | DE | DP | D | E2E | Gap → action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2.1 | Registration status | P | `ventures.registration_status` (nulled on save) | Y | N | P/N | .5 | 0 | 1 | .5 | 0 | Fix form payload; require doc when Registered |
| 2.2 | Legal structure | M | Dead wizard only | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | Add field + validation |
| 2.3 | Registration number, date, address | P | `registration_number` (admin only); no date/address | Y | N | P/N | .5 | 0 | 1 | .5 | 0 | Add fields, founder input, format check |
| 2.4 | Licences and permits | DocD | Data Room `legal_corporate`; Data bank `legal_documents` | Y | N | P/N | .5 | 0 | 1 | .5 | 0 | File-only → add licence metadata register |
| 2.5 | Corporate / compliance info | DocD | Data Room/Due diligence docs; no entity/cap table | Y | N | P/P | .5 | 0 | 1 | .5 | 0 | Add corporate record or accept document-only |
| 2.6 | Supporting documents in Data Room | S | `venture_documents` + versions + requirements + grants | — | N | P/P | 1 | 0 | 1 | .5 | **1** | Keep; add extraction/index only if required |

### 3 (C) Founders and Team — 9

| # | Requirement | Status | Primary source | Doc | AI | VD/PR | S | DE | DP | D | E2E | Gap → action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 3.1 | Founder identities and roles | P | `venture_members` + `contacts`; role vocab conflict | Y | N | Y/P | .5 | 0 | 1 | 1 | 0 | Reconcile roles; one roster; fix invite |
| 3.2 | Lead founder | S | `is_owner`/`lead_founder`; `ownership_history` | Y | N | Y/N | 1 | 0 | 1 | 1 | 0 | Expose owner in portfolio |
| 3.3 | Management team | P | `venture_members`; founder invite disabled | Y | N | Y/P | .5 | 0 | 1 | 1 | 0 | Enable invite; add employment type |
| 3.4 | Team size | P | Roster count only; no headcount/FTE | Y | N | Y/P | .5 | 0 | 1 | 1 | 0 | Add headcount/FTE block |
| 3.5 | Full-time / part-time / seasonal | M | — | Y | N | N/N | 0 | 0 | .5 | 0 | 0 | Add employment type |
| 3.6 | Employment by gender | M | `contacts.gender` not venture-scoped | Y | N | N/N | 0 | 0 | .5 | 0 | 0 | Add employment demographics (consent) |
| 3.7 | Youth employment | M | `contacts.dob` not venture-scoped | Y | N | N/N | 0 | 0 | .5 | 0 | 0 | Add age band |
| 3.8 | Advisors and mentors | S | `venture_advisors`, `venture_coaches`, assignments | Y | N | P/N | 1 | 0 | 1 | .5 | 0 | Dashboard widget shape bug → return lists |
| 3.9 | Changes in founders/management/workforce | P | `removed_at`, `ownership_history`, change logs | P | N | P/N | .5 | 0 | 0 | .5 | 0 | Add append-only people-change log |

### 4 (D) Initial Business Baseline — 12

| # | Requirement | Status | Primary source | Doc | AI | VD/PR | S | DE | DP | D | E2E | Gap → action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 4.1 | Revenue | M | No field; finance is program-level | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | Add immutable baseline + series |
| 4.2 | Operating expenditure | M | — | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | Same |
| 4.3 | Cash balance | M | — | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | Same |
| 4.4 | Funding received to date | Calc | Campaigns `current_raised`; decisions | Y | N | P/P | .5 | 0 | 1 | .5 | 0 | Committed ≠ disbursed → funding ledger |
| 4.5 | Funding sources | P | Opportunities/campaigns | Y | N | P/P | .5 | 0 | 1 | .5 | 0 | Add funding-round/source history |
| 4.6 | Active customers | M | No field; CRM unlinked | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | Add baseline + monthly series |
| 4.7 | Active users | M | No field | P | N | N/N | 0 | 0 | .5 | 0 | 0 | Add metric/import |
| 4.8 | Employment | P | Roster only | Y | N | P/P | .5 | 0 | 1 | .5 | 0 | Employment block |
| 4.9 | Impact measures | M | No indicator table | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | Define indicators + baseline |
| 4.10 | Supporting evidence | S | Data Room financial/market/impact categories | — | N | P/P | 1 | 0 | 1 | .5 | **1** | Link evidence to baseline metrics |
| 4.11 | Source and validation status | P | Document-level review only | P | N | P/N | .5 | 0 | 1 | .5 | 0 | Add per-value source/as-of/validator |
| 4.12 | Historical baselines per intervention | M | No cohort/intervention model | P | N | N/N | 0 | 0 | .5 | 0 | 0 | Add immutable baseline per intervention |

### 5 (E) Financial Performance — 10

| # | Requirement | Status | Primary source | Doc | AI | VD/PR | S | DE | DP | D | E2E | Gap → action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 5.1 | Revenue | M | — | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | Period series |
| 5.2 | Operating expenditure | M | — | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | Period series |
| 5.3 | Cash balance | M | — | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | Period series |
| 5.4 | Funding received during a period | P | Opportunities `closed_won`; stage history | Y | N | P/P | .5 | 0 | 1 | .5 | 0 | Add dated funding events |
| 5.5 | Funding history and sources | P | Opportunities + stage history | Y | N | P/P | .5 | 0 | 1 | .5 | 0 | Funding-round history |
| 5.6 | Funding commitments | Calc | Opportunity stage/amount/probability | Y | N | P/P | .5 | 0 | 1 | .5 | 0 | Add signed commitment rows |
| 5.7 | Financial explanations | P | `venture_reports.summary/challenges`; updates | Y | N | P/P | .5 | 0 | 1 | .5 | 0 | Tie commentary to period figures |
| 5.8 | Reporting currency | P | Campaign/opportunity only | Y | N | P/N | .5 | 0 | 1 | .5 | 0 | Add currency per figure/venture |
| 5.9 | Reporting date and period | P | `reporting_period` free text; no as_of | Y | N | P/P | .5 | 0 | 1 | .5 | 0 | Real `period_start/end` |
| 5.10 | Financial statements and documents | S | Data Room `financials_projections`; Data bank | — | N | P/P | 1 | 0 | 1 | .5 | **1** | Keep; extraction later |

### 6 (F) Customers, Sales, Market Traction — 13

| # | Requirement | Status | Primary source | Doc | AI | VD/PR | S | DE | DP | D | E2E | Gap → action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 6.1 | Active customers | M | No field; CRM unlinked | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | Baseline + monthly |
| 6.2 | New and lost customers | M | — | Y | N | N/N | 0 | 0 | .5 | 0 | 0 | Movement series |
| 6.3 | Active users | M | — | P | N | N/N | 0 | 0 | .5 | 0 | 0 | Analytics integration |
| 6.4 | Leads | P | `crm_leads` (no venture_id) | Y | N | N/N | .5 | 0 | 1 | 0 | 0 | Link CRM to venture |
| 6.5 | Sales conversions | P | CRM qualification/opportunities (no FK) | Y | N | N/N | .5 | 0 | 1 | 0 | 0 | Same |
| 6.6 | Sales pipeline and value | P | `crm_opportunities`/pipelines (no FK) | Y | N | N/N | .5 | 0 | 1 | 0 | 0 | Same |
| 6.7 | Customer feedback | P | `venture_pmf_assessments` (API); interviews | Y | N | N/N | .5 | 0 | 1 | 0 | 0 | Survey module |
| 6.8 | Customer discovery interviews | P | `venture_customer_interviews` (API-only) | Y | N | N/N | .5 | 0 | 1 | 0 | 0 | Build UI; extract insights |
| 6.9 | Pilots initiated/completed | M | — | Y | N | N/N | 0 | 0 | .5 | 0 | 0 | Pilot tracker |
| 6.10 | Letters of intent | DocD | Data Room `market_traction` | Y | N | P/N | .5 | 0 | 1 | .5 | 0 | LOI register |
| 6.11 | Waitlists / early sign-ups | M | — | P | N | N/N | 0 | 0 | .5 | 0 | 0 | Add metric/import |
| 6.12 | Pilot-to-paid conversion | M | — | P | N | N/N | 0 | 0 | .5 | 0 | 0 | Conversion tracking |
| 6.13 | Market research and evidence | P | Data Room `market_traction`; interviews | Y | N | P/N | .5 | 0 | 1 | .5 | 0 | Research index |

### 7 (G) Product and Business Development — 11

| # | Requirement | Status | Primary source | Doc | AI | VD/PR | S | DE | DP | D | E2E | Gap → action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 7.1 | Product development progress | S | Journey/milestones/tasks/deliverables; analytics | Y | N | Y/P | 1 | 0 | 1 | 1 | 0 | Product milestone type; portfolio roll-up |
| 7.2 | Product maturity | P | `business_stage`; PMF/validations (API) | Y | N | P/N | .5 | 0 | 1 | .5 | 0 | Maturity enum + history |
| 7.3 | MVP progress | P | `business_stage='mvp'`; work plan | Y | N | P/N | .5 | 0 | 1 | .5 | 0 | MVP scope checklist |
| 7.4 | Product milestones and launches | P | Milestones; no type/launched_at | Y | N | Y/P | .5 | 0 | 1 | 1 | 0 | Add launch fields |
| 7.5 | New products/services | DocD | Business model API; no register | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | Product/service records |
| 7.6 | Business model changes | P | Business model API; no versions | Y | N | N/N | .5 | 0 | 1 | 0 | 0 | Versioned snapshots |
| 7.7 | New partnerships | P | `key_partners` API; CRM orgs unlinked | Y | N | N/N | .5 | 0 | 1 | 0 | 0 | Partner records / CRM link |
| 7.8 | Market expansion | DocD | `country` only | P | N | N/N | 0 | 0 | .5 | 0 | 0 | Markets/regions list |
| 7.9 | Commercial development | DocD | No venture-linked pipeline | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | Venture commercial pipeline |
| 7.10 | Major achievements | P | `venture_reports.completed_items` | Y | N | P/P | .5 | 0 | 1 | .5 | 0 | Structured achievements |
| 7.11 | Challenges and business changes | P | Reports `challenges`; blockers; change log | Y | N | P/P | .5 | 0 | 1 | .5 | 0 | Challenge/change register |

### 8 (H) Funding and Fundraising — 9

| # | Requirement | Status | Primary source | Doc | AI | VD/PR | S | DE | DP | D | E2E | Gap → action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 8.1 | Funding received to date | Calc | Campaigns/decisions (committed) | Y | N | N/P | .5 | 0 | 1 | 0 | 0 | Funding ledger with dates/source |
| 8.2 | Funding sources | P | Opportunities/campaigns | Y | N | N/P | .5 | 0 | 1 | 0 | 0 | Source dimension |
| 8.3 | New funding during a period | Calc | Decision dates/stage history | Y | N | N/N | .5 | 0 | 1 | 0 | 0 | Period query + ledger |
| 8.4 | Funding commitments | P | Opportunities expected/probability | Y | N | P/P | .5 | 0 | 1 | .5 | 0 | Commitment record |
| 8.5 | Fundraising progress | S | Opportunity stages + history; admin page | Y | N | P/P | 1 | 0 | 1 | .5 | 0 | Portfolio progress |
| 8.6 | Funding requirement | P | Campaign `target_raise`; legacy program field | Y | N | P/P | .5 | 0 | 1 | .5 | 0 | Move target to venture; currency |
| 8.7 | Intended use of funding | DocD | Documents only | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | Use-of-funds lines |
| 8.8 | Funding status | S | Campaign status + opportunity stage | Y | N | P/P | 1 | 0 | 1 | .5 | 0 | Status history |
| 8.9 | Supporting documents | S | Data Room fundraising/financial categories | — | N | P/P | 1 | 0 | 1 | .5 | **1** | Link docs to funding records |

### 9 (I) Employment and Job Creation — 11

| # | Requirement | Status | Primary source | Doc | AI | VD/PR | S | DE | DP | D | E2E | Gap → action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 9.1 | Full-time employment | DocD | No employment model; roster only | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | Employment baseline (headcount/FTE/type) |
| 9.2 | Part-time | DocD | Same | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | Same |
| 9.3 | Seasonal | DocD | Same | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | Same |
| 9.4 | Founder count | S | `venture_members.member_type='founder'` | Y | N | Y/N | 1 | 0 | 1 | 1 | **1** | One roster; reconcile ledger |
| 9.5 | Employment by gender | DocD | `contacts.gender` only | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | Employment records + consent |
| 9.6 | Youth employment | DocD | `contacts.dob` only | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | Age band |
| 9.7 | Jobs created | DocD | No jobs table | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | Jobs ledger + baseline |
| 9.8 | Jobs supported | DocD | Same | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | Same |
| 9.9 | Workforce changes vs baseline | DocD | No baseline/period series | P | N | N/N | 0 | 0 | .5 | 0 | 0 | Baseline + monthly series |
| 9.10 | Supporting employment evidence | P | Generic docs + document types | Y | N | P/P | .5 | 0 | 1 | .5 | 0 | Employment category + link |
| 9.11 | Headcount vs FTE | DocD | Dead wizard `team_size` only | Y | N | P/N | 0 | 0 | 1 | .5 | 0 | Headcount + FTE fields |

### 10 (J) Impact and Sustainability — 9

| # | Requirement | Status | Primary source | Doc | AI | VD/PR | S | DE | DP | D | E2E | Gap → action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 10.1 | Customers/beneficiaries reached | P | Manual KPI only; no metric | Y | N | N/N | .5 | 0 | 1 | 0 | 0 | Indicator + period + source |
| 10.2 | Women-led / co-founded | P | `contacts.gender` (unreliable) | P | N | N/N | .5 | 0 | .5 | 0 | 0 | Flag with consent; surface |
| 10.3 | Jobs created and supported | DocD | No jobs table | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | Jobs indicators |
| 10.4 | Gender/youth impact | DocD | No disaggregation | P | N | N/N | 0 | 0 | .5 | 0 | 0 | Define indicators |
| 10.5 | Local suppliers and SMEs | DocD | No supplier data | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | Procurement records |
| 10.6 | Formalisation/compliance progress | P | `registration_status` + verification | Y | N | P/P | 1 | 0 | 1 | .5 | 0 | Dated compliance milestones |
| 10.7 | SDG indicators | DocD | No taxonomy | P | N | N/N | 0 | 0 | .5 | 0 | 0 | SDG mapping |
| 10.8 | Environmental impact | DocD | No metrics | P | N | N/N | 0 | 0 | .5 | 0 | 0 | Environmental indicators |
| 10.9 | Supporting evidence | S | Data Room `impact_sustainability` | — | N | P/P | 1 | 0 | 1 | .5 | **1** | Make required; link to indicators |

### 11 (K) Strategic Progress, Risks, Support — 10

| # | Requirement | Status | Primary source | Doc | AI | VD/PR | S | DE | DP | D | E2E | Gap → action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 11.1 | Business objectives | P | Journey/milestone objectives; `north_star` no UI | Y | N | P/N | .5 | 0 | 1 | .5 | 0 | Venture objectives register |
| 11.2 | Progress against objectives | P | Work progress; no objective link | Y | N | P/N | .5 | 0 | 1 | .5 | 0 | Objective KPIs; one formula |
| 11.3 | Key achievements | P | `venture_reports.completed_items` | Y | N | P/P | .5 | 0 | 1 | .5 | 0 | Structured achievements |
| 11.4 | Significant challenges | P | Reports `challenges`; blockers | Y | N | P/P | .5 | 0 | 1 | .5 | 0 | Challenge register |
| 11.5 | Business/operational risks | P | Blockers; investor `risk_assessments` | Y | N | P/N | .5 | 0 | 1 | .5 | 0 | Venture risk register |
| 11.6 | Material changes | P | Change/history/activity logs | Y | N | P/N | .5 | 0 | 1 | .5 | 0 | Materiality + events |
| 11.7 | Support required | DocD | No field | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | Support request (type/urgency) |
| 11.8 | Support provided | P | Reports `support_delivered`; assignments | Y | N | P/N | .5 | 0 | 1 | .5 | 0 | Support-delivery log |
| 11.9 | Next-period priorities | P | Standups (invisible); action plans | Y | N | N/N | .5 | 0 | 1 | 0 | 0 | Surface standups/report section |
| 11.10 | Strategic outlook | P | `venture_updates` (investor-only) | Y | N | N/N | .5 | 0 | 1 | 0 | 0 | Venture-side authoring |

### 12 (L) Business Continuity and Venture Status — 6

| # | Requirement | Status | Primary source | Doc | AI | VD/PR | S | DE | DP | D | E2E | Gap → action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 12.1 | Company status | S | `ventures.status` + lifecycle + `is_archived` | Y | N | Y/P | 1 | 0 | 1 | 1 | **1** | Fix badge/labels; status history |
| 12.2 | Operating status | P | Conflated with company status | Y | N | Y/P | .5 | 0 | 1 | 1 | 0 | Add operating status + reason |
| 12.3 | Revenue-generating status | U | No field; form data unlinked | Y | N | N/N | 0 | 0 | 1 | 0 | 0 | Add flag + revenue period |
| 12.4 | Business continuity | DocD | No model | P | N | N/N | 0 | 0 | .5 | 0 | 0 | Continuity checklist |
| 12.5 | Material events | P | Activity/history/change logs | Y | N | P/N | .5 | 0 | 1 | .5 | 0 | Material-event record |
| 12.6 | Inactivity or closure | P | `paused`/`archived`; no reason/date | Y | N | P/P | .5 | 0 | 1 | .5 | 0 | Last-activity + closure fields |

### Per-category coverage

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

*Row-level sums are used; two working summaries differed by ≤1. The difference changes no conclusion.*

---

## Section C — Document Workflow Assessment

| Step | Current state | Evidence |
|---|---|---|
| 1. Submission (upload PDF, keep original) | **Partial** | Private bucket `deliverable-evidence`, 10 MB cap (configurable), single file per request, PDF/DOC/DOCX/XLS/XLSX/PPT/PPTX/images; `venture_documents` + version 1 written. No reporting-period field. |
| 2. Association (venture + period) | **Partial** | Venture + 11 Data Room categories + per-venture requirement levels; **no period/as_of**; the only period field is free-text on `venture_reports`. No 12-category taxonomy. |
| 3. Access (authorised reader) | **Works** | `resolveDataRoomViewer` (Super Admin full), 1-hour signed URLs, `GET …/data-room/[docId]/file`, in-app preview for PDF/images/DOCX/XLSX. |
| 4. AI analysis of the document | **Missing** | DeepSeek adapter exists (`src/lib/deepseek.js`), used for run reports/form evaluation/plan import; **no path from a venture document to a prompt**. |
| 5. Structured extraction | **Partial infra / Missing pipeline** | `unpdf` text extraction exists only for platform run-report files (`platform_run_report_files.extracted_text`); XLSX/CSV import exists for plan import. **No OCR**, no PDF table/financial-statement parsing, no extraction on `venture_documents`. |
| 6. Review and validation | **Partial** | Document-level `uploaded → under_review → verified/rejected` with version binding; **no value-level** validation; prior review notes overwritten. |
| 7. Historical reporting / corrections | **Missing** | No period model; `venture_kpis` overwrite; `venture_reports` has no versions; no reporting-value history. |
| 8. Dashboard / management reporting | **Partial** | Readiness uses document *statuses*; dashboards read journey/tasks/fundraising. No figure extracted from a document reaches any dashboard. |

**Hard limits today:** no OCR (a scanned PDF extracts as empty); no PDF table parsing; no period model; no value-level provenance (`source`, `confidence`, `validated_at`); no history for reported values; no document→AI path for venture documents; 10 MB cap; synchronous AI with no queue; DeepSeek 20 k reference cap; upload checks are extension-OR-MIME with no malware scan (public buckets remain elsewhere).

---

## Section D — Dashboard Readiness Assessment

| Category | Readiness | What exists | What is missing |
|---|---|---|---|
| 1 Business Profile & Model | **Low–Medium** | Identity, stage, status on list/header; profile page | Most identity fields missing/unreachable; no period; no summary dashboard |
| 2 Registration & Legal | **Medium** | Data Room legal docs + review; verification checklist | No structured entity/legal record; no licence metadata |
| 3 Founders & Team | **Medium** | Founder/lead/advisor data; team widget | No employment model; invite broken; two rosters |
| 4 Initial Baseline | **Low** | Nothing but documents | No baseline object, no period, no validation |
| 5 Financial Performance | **Low–Medium** | Financial documents with review | No figures, currency, period, history |
| 6 Customers & Traction | **Low** | Interviews/PMF APIs; CRM exists but unlinked | No venture-linked leads/sales/customers |
| 7 Product & Development | **Medium** | Journey/milestone/task/deliverable progress | No product metric/maturity; no completed_at |
| 8 Funding & Fundraising | **Medium** | Campaign/opportunity/stage history; admin fundraising page | No period/portfolio roll-up; committed ≠ received |
| 9 Employment & Jobs | **Low** | Founder count only | No headcount/FTE/type/gender/youth/jobs |
| 10 Impact & Sustainability | **Low** | Data Room impact documents | No indicators, SDG, environment, disaggregation |
| 11 Strategy, Risks, Support | **Medium** | Written reports, blockers, change logs | No objective/risk/challenge registers; period-free |
| 12 Continuity & Status | **Medium–High** | Company status + lifecycle + archive | No operating/revenue-generating status; no closure reason/date |

**Architecture verdict:** the operational spine and Data Room are genuinely reusable; the **business reporting layer does not exist**. Dashboards are hardcoded; no period selector/comparison; no portfolio batch endpoint (most metrics are single-venture routes); `null` vs `0` is inconsistent; four readiness and three completion formulas disagree.

---

## Section E — Gap and Risk Register

| # | Gap / risk | Severity | Evidence |
|---|---|---|---|
| G1 | **No reporting period model** (`period_start/end`, `as_of`) anywhere in the venture domain | **Critical** | Only `venture_reports.reporting_period` and `venture_kpi_assignments.period`, both free text `[V]` |
| G2 | **No document → structured data pipeline** (no extraction on venture documents) | **Critical** | No caller extracts `venture_documents`; `unpdf` used only for run-report files `[V]` |
| G3 | **No value-level provenance** (`source`, `confidence`, `extracted_at`, `validated_by`) | **Critical** | No such columns in 10 inspected venture tables `[V]` |
| G4 | **No reporting-value history** — KPIs overwrite; reports unversioned | **Critical** | `venture_kpis` upsert; `venture_reports` in-place update `[V]` |
| G5 | **No initial baseline** (financial/customer/employment/impact) | **Critical** | 33 `ventures` columns contain no figures `[V]` |
| G6 | **No 12-category taxonomy**; 11 Data Room categories + separate Data bank types | High | `lib/dataRoom.js`, `venture_document_types` `[V]` |
| G7 | **No OCR** — scanned PDFs yield empty text | High | No tesseract/vision dependency `[V]` |
| G8 | **No PDF table/financial-statement parsing** | High | `unpdf` returns linear text `[V]` |
| G9 | **CRM not venture-linked** — no `venture_id` on any `crm_*` table | High | Live column check `[V]` |
| G10 | **No employment/impact model** (headcount/FTE/jobs/gender/youth/SDG/environment) | High | No fields/tables `[V]` |
| G11 | **Four readiness formulas** (Data Room, Data bank, Stage & Evidence, Roadmap) + one retired | High | `dataRoom/access.js`, `ventureReadiness.js`, `dashboard.js`, `readiness.js` `[V]` |
| G12 | **Three completion formulas** on the same Reports page | High | analytics 14 %, roadmap 18 %, strict stage 17 % `[V]` |
| G13 | **Null vs zero inconsistency** | High | Data Room returns `null`; dashboards/API coerce to `0` `[V]` |
| G14 | **Two document-readiness engines disagree** (2 tables, 2 denominators) | High | §11 of current-state audit `[V]` |
| G15 | **Investor cards read `v2_programs`** → NULL → 0 %/$0 | Medium | `models/investor/dashboardsAndKpis.js` `[V]` |
| G16 | **No portfolio batch endpoint** — most metrics single-venture | High | journey-report/analytics/progress only per venture `[V]` |
| G17 | **No period selector/comparison** anywhere | High | dashboard audit `[V]` |
| G18 | **Dashboards hardcoded / not configurable** | Medium | fixed components `[V]` |
| G19 | **No requirement due dates / overdue detection** for venture reports | Medium | Data Room has `expires_at` only; no scheduler `[V]` |
| G20 | **Review history thin** — prior decisions/notes overwritten | Medium | only latest `review_notes` on row `[V]` |
| G21 | **Reports self-reviewed** — no independent approver field | Medium | `venture_reports.status` set by the author `[V]` |
| G22 | **Tasks/milestones lack `completed_at`** | Medium | schema check `[V]` |
| G23 | **Collected but invisible:** attendance (0 rows, no UI writer), standups/retros (0 rows, not rendered), updates (investor-only) | Medium | `[V]` |
| G24 | **People paths:** founder invite broken, team invite disabled, two rosters, role-vocabulary 400s | Medium | `[V]` |
| G25 | **Upload hardening:** extension-OR-MIME, no AV, public buckets elsewhere | Medium | `docs/SECURITY_AUDIT_REGISTER.md` UPLOAD-1 `[V]` |
| G26 | **Schema drift/type anomalies:** `venture_kpi_definitions.venture_id` integer vs uuid; `venture_reports.id` integer; `is_archived` integer; duplicate columns (`name`/`company_name`, `storage_path`/`file_url`, `version_number`/`version`) | Medium | Live schema `[V]` |
| G27 | **AI constraints:** DeepSeek only, 20 k reference cap, synchronous, no queue, JSON not schema-validated | Medium | `src/lib/deepseek.js`, AI services `[V]` |
| G28 | **10 MB cap** — multi-page scans may exceed | Low–Medium | `DATA_ROOM_MAX_FILE_MB` `[V]` |
| G29 | **Staging has no reporting data** — behaviour unverified, only capability | Evidence limitation | 0 reports/updates/KPIs `[V]` |

---

## Section F — Recommended Next Steps

### Reuse as-is
- Data Room: private storage, versions, review states, grants, access logs, requirement levels.
- Operational spine: journey stages, milestones, tasks, deliverable reviews, sessions (real dates and statuses).
- Written progress reports (`venture_reports`) as the narrative layer.
- The **plan-import pattern** (`propose → correct → apply`, `venture_plan_imports`) — the closest existing analogue to “extract, propose, human-validate”.
- `unpdf` text extraction, `readelf`/`papaparse` spreadsheet import, the DeepSeek adapter with system guardrails and chunking.

### Repair before extending
- One readiness definition; one completion formula; consistent `null` vs `0`; retire the second document-readiness engine.
- Fix founder profile saves (country/registration status/north star), the founder invite path, team invite, role vocabulary, founder roster (declare `venture_members` canonical).
- Add `completed_at` to milestones/tasks; version `venture_reports`; add independent review; fix investor `v2_programs` reads; upload hardening.

### Minimum changes to support the reporting framework (the ≥70 % path)
1. **Period model:** `period_start`, `period_end`, `as_of`, `currency`; uniqueness per venture + period; required on every report.
2. **Taxonomy:** the 12 categories + sub-indicators; per-venture applicability (reuse `venture_data_room_requirements` pattern).
3. **Extraction pipeline:** on upload → text extraction with `ok/empty/failed`; document classification into categories; AI extraction via DeepSeek with chunking; persist proposals; **decide OCR scope** (text PDFs/spreadsheets first is the cheapest route).
4. **Valued store:** append-only `(venture, indicator, period, value, currency, source_document/version, confidence, review_status, validated_by/at)`; corrections as new rows; evidence drill-down.
5. **Review workflow:** proposed → reviewed → validated/rejected, with the original document one click away; distinguish AI-extracted from validated in every read.
6. **Dashboard/portfolio read layer:** one definition per indicator; period selector/comparison; missing ≠ zero; batch portfolio endpoint; overdue/incomplete detection based on real due dates.

### Defer
- OCR for scans (if the initial scope is text PDFs + spreadsheets), external accounting/product-analytics integrations, SDG/environmental taxonomy depth, automated reminder scheduling, e-signature, independent second-reviewer workflow.

### Sequence
1. Ratify the decisions (profile scope, baseline object, period model, KPI governance, one readiness definition).
2. Approve the 12-category taxonomy and the per-venture applicability model.
3. Build the period + valued store (schema design only in the next step).
4. Build extraction on text PDFs/spreadsheets; add OCR later if evidence demands it.
5. Wire review + dashboard/portfolio reads.
6. Re-run this assessment with the same method; only then claim a coverage number.

---

## Appendix — Verification log and limits

- **Live staging verification (2026-10-26):** 11 contacts, 3 ventures (all `idea`/`active`), 2 documents (1 verified JPG `legal_corporate`, 1 rejected XLSX `company_overview`), 12 document types, 11 Data Room requirements, 2 founder memberships, 0 `venture_founders`, 7 milestones, 27 tasks, 28 deliverables, 14 reviews, 2 sessions, 0 attendance, 0 standups/retros, 0 reports/updates/KPIs, 0 fundraising, 0 investment decisions, 0 CRM leads, 1 CRM opportunity. 308 public tables. `ventures.id` uuid; `ventures.venture_id` text (nullable). No `as_of`/`baseline`/`ocr`/`ai_` columns anywhere in the venture domain; only two free-text period columns. `[V]`
- **Not verified:** runtime click-through, real email delivery, production schema/data (production not queried), and reporting behaviour (staging has no reporting rows).
- **No implementation occurred.** No code, schema, data, permission or UI change; no migration; no sample records.

*End of assessment.*

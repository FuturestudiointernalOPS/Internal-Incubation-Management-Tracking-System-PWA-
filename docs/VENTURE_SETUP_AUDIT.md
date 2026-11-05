# Audit — One-Time Venture Setup in ImpactOS

**Mode:** read-only. No code, schema, or data was changed by this audit.
**Method:** full source inspection of the Ventures slice — creation route, invitation
acceptance, profile editors, schema bootstrap, migrations, models, services,
completion calculators, and the screens that consume them.

**Verification limits.** The findings are source-verified, not runtime-verified: no
database introspection was performed and no click-through was done. Where a
behaviour is inferred from a code path rather than observed, the finding says so.

---

## 1. What actually happens when a Venture is created

There is exactly one live creation path. `POST /api/ventures` is retired and returns
`410 LEGACY_FLOW_RETIRED` (`src/app/api/ventures/route.js:111-124`). The self-service
intake service (`services/ventures/intake.createVenture`) has no caller in production
code — only tests.

| Step | Who | Screen / endpoint | What is collected |
|---|---|---|---|
| 1 | Super Admin | `POST /api/admin/ventures/create` | Company name, founder email — that is all |
| 2 | Founder | `/venture-invite/[token]` | Full name, password (password only if they have no account) |
| 3 | Founder, later and optionally | Venture → Profile tab | The venture profile fields in Deliverable A |

### Step 1 — creation

`createAdminVenture` (`src/models/ventureAdmin.js:59-65`) inserts:

```
venture_id     generated  VNT-XXXXXXXX (8 hex chars)
name           = company name
company_name   = company name
industry       = NULL
business_stage = 'idea'
status         = 'active'
created_by     = admin cid
created_at / updated_at = now
```

Plus a `venture_origins` row with `source_type = 'admin'`. No founder record, no
membership, no profile — deliberately (`ventureAdmin.js:6-15`).

Duplicate rule: case-insensitive company name only. Registration number and founder
email are not checked on this path (they are in the retired intake path only).

### Step 2 — invitation

A `venture_member_invitations` row (status `pending`, token hash, 7-day expiry) and an
email. The venture is not touched. `createVentureMemberInvitation` resolves the venture
code to the internal UUID before storing (`ventureMemberInvitations.js:178-196`).

On acceptance (`ventureMemberInvitations.js:360-475`):

- identity resolved by email via `resolvePersonIdentity` — matched, conflict (refused),
  or created;
- a new contact is created as `role = 'member'`, `status = 'pending'` (or `active` if a
  password was set);
- a `venture_members` row: `member_type='founder'`, `role='founder'`, `permissions='edit'`;
- the first founder becomes `lead_founder` + `is_owner`;
- `contact_roles` history appended; capability grants applied.

The legacy `venture_founders` table is not written here — it is reconciled later from
members (`models/ventureFounderLedger.js`).

---

## Deliverable A — Existing field inventory

Legend — **Status:** ✅ implemented · 🟡 partial · ⛔ missing · ❓ unverified.

### Category 1 — Venture identity and general information

| Label | Internal | Type | Req. | Collected from | Storage | Notes / finding |
|---|---|---|---|---|---|---|
| Company name | `company_name` (+ mirrored `name`) | text | **Required** | Admin, at creation | `ventures` | ✅ Created and editable. Two columns for one concept; `updateVenture` mirrors them (`record.js:143-156`). |
| Venture ID | `venture_id` | text | System | Generated | `ventures` | ✅ Displays as `VNT-…`; not user-editable. URL/API key only. |
| Venture name (edit) | `name` | text | Required in form | Founder | `ventures` | ✅ Profile tab (`ProfileSettingsTabs.js:18-21`). |
| Description | `description` | textarea | Optional | Founder | `ventures` | ✅ Profile tab, admin edit, and the retired intake. |
| Mission | `mission` | textarea | Optional | Founder | `ventures` | 🟡 Editable, never displayed outside the editor; not needed by any consumer. |
| Vision | `vision` | textarea | Optional | Founder | `ventures` | 🟡 Same. |
| North star | `north_star` | text | Optional | — | `ventures` | ⛔ Allowed by `updateVenture`, **no UI anywhere**; never written. |
| Website | `website` | url | Optional | Founder | `ventures` | 🟡 No URL validation on `PUT`. Admin edit uses `type="url"` (browser only). |
| Logo | `logo_url` | text/url | Optional | Admin only | `ventures` | 🟡 In the admin edit form's shape but **not rendered**; no founder UI. |
| Social media | `social_media` JSONB | object | Optional | Founder | `ventures` | ✅ Four fields in Profile tab: LinkedIn, Instagram, X, Facebook. Free-text URLs, no validation. |
| Company status | `status` | select | Optional | Admin | `ventures` | 🟡 Admin edit only; founders cannot change it (lifecycle guard, `api/ventures/route.js:166-176`). |
| Visibility | `visibility` | select | Optional | — | `ventures` | ⛔ Column + payload, **no UI**. Sent back unchanged on every founder save. |
| Language | `language` | text | Optional | — | `ventures` | ⛔ Column + payload, **no UI**. |
| Branding colour | `branding` JSONB | text | Optional | — | `ventures` | ⛔ Column + payload, **no UI**. |
| Programme type | `programme_type` | text | Optional | — | `ventures` | ⛔ Allowed field, no UI, no writer. |

### Category 2 — Business description, product and service

| Label | Internal | Type | Req. | Storage | Finding |
|---|---|---|---|---|---|
| Description | `description` | text | Optional | `ventures` | 🟡 The only narrative field actually collected. |
| Problem / solution / value proposition | — | — | — | — | ⛔ Missing. Only available as JSON inside `venture_business_models.lean_canvas`, which has no UI. |
| Product / service description | — | — | — | — | ⛔ Missing as a distinct field. |
| Product maturity | — | — | — | — | ⛔ Missing (see Category 5). |

### Category 3 — Industry, market and target customers

| Label | Internal | Type | Req. | Storage | Finding |
|---|---|---|---|---|---|
| Industry | `industry` | free text + datalist | Optional | `ventures` | 🟡 13 seeded options in `venture_option_values`; free text allowed, so values drift. NULL on admin creation. |
| Sector | `sector` | free text | Optional | `ventures` | 🟡 No list, no validation. |
| Country | `country` | text | Optional | `ventures` | 🟡 Founder uses `CountrySelect` → writes `country_code` + `country`. |
| Country code | `country_code` | ISO code | Optional | `ventures` | 🟡 Stable value; legacy rows may have a country name only. |
| Target customer segment | `customer_segment` | text | Optional | `venture_customer_interviews` | ⛔ Per-interview only; no UI. |
| Market size / TAM / ICP | — | — | — | — | ⛔ Missing. |

### Category 4 — Business model and revenue model

| Label | Internal | Type | Req. | Storage | Finding |
|---|---|---|---|---|---|
| Business Model Canvas | `business_model_canvas` | JSONB | Optional | `venture_business_models` | ⛔ API only. `PUT /api/ventures/[id]/business-model` exists; no component calls it. |
| Lean Canvas | `lean_canvas` | JSONB | Optional | same | ⛔ API only. |
| Revenue streams | `revenue_streams` | text | Optional | same | ⛔ API only. |
| Cost structure | `cost_structure` | text | Optional | same | ⛔ API only. |
| Key partners | `key_partners` | text | Optional | same | ⛔ API only. |
| Pricing / unit economics | — | — | — | — | ⛔ Missing entirely. |

### Category 5 — Business stage and product maturity

| Label | Internal | Type | Req. | Storage | Finding |
|---|---|---|---|---|---|
| Business stage | `business_stage` | select | Defaulted (`idea`), not enforced | `ventures` | 🟡 Three vocabularies in use — see risk R1. |

Vocabulary drift, verified:

| Source | Values |
|---|---|
| DB / `venture_option_values` seed | `idea, validation, mvp, growth, scale` |
| Founder Profile tab (`ventureMeta.STAGES`) | `idea, validation, mvp, growth, scale` |
| Admin list + admin edit | `idea, validation, early_traction, growth, scaling` |

A founder can save `mvp` (a value the admin edit screen cannot display) and an admin can
save `early_traction` (a value the founder editor cannot display). Both are stored as
free text.

Product maturity / TRL / launch status: ⛔ missing.

### Category 6 — Legal registration and corporate information

| Label | Internal | Type | Req. | Collected from | Storage | Finding |
|---|---|---|---|---|---|---|
| Registration number | `registration_number` | text | Optional (no conditional rule) | Admin only | `ventures` | 🟡 Not in the founder editor. No format validation, no duplicate check on this path. |
| Registration status | `registration_status` | select: Not registered / Registered / Pending registration | Optional | Founder | `ventures` | 🟡 Collected; never used to require a registration number or a legal document. |
| Legal structure | `legal_structure` | text | — | — | — | ⛔ Only in the dead wizard (step 2). |
| Year founded | `year_founded` | number | — | — | — | ⛔ Dead wizard only. |
| Business Registration | verification item | upload | Required (default type) | Founder | `venture_verifications` + items + documents | ✅ Available via the Data bank. Separate from the profile. |
| Legal Documents | verification item | upload | Required | Founder | same | ✅ |
| Founder Identity | verification item | upload | Required | Founder | same | ✅ |
| Financial Documents | verification item | upload | Required | Founder | same | ✅ (document, not structured figures) |
| Email / Phone verification | verification item | external | Optional | Founder | same | ✅ |
| Cap table, statuts, shareholding | — | — | — | — | Data Room documents only | 🟡 No structured corporate record. |

### Category 7 — Founder and team information

| Label | Internal | Type | Req. | Collection point | Storage | Finding |
|---|---|---|---|---|---|---|
| Founder email | `email` | email | Required | Admin, at creation | invitation → `contacts` → `venture_members` | ✅ Validated by regex at creation. |
| Founder full name | `name` | text | Required in acceptance form | Invite acceptance | `contacts.name`; `venture_member_invitations.name` | ✅ |
| Password | — | password ≥ 6 | Conditional (new account) | Invite acceptance | `contacts.password` (hash) | ✅ |
| Founder phone | `phone` | text | Optional | Personal profile | `contacts.phone` | 🟡 Not venture-specific; `venture_founders.phone` exists in the legacy ledger only. |
| Founder title | `title` | text | Optional | Legacy ledger | `venture_founders.title` | 🟡 Not captured in the invite flow; no UI to set it. |
| Venture role | `role` | select | Required when inviting | Admin founders screen | `venture_founders.role`, `venture_members.role` | 🟡 Two rosters (R3). |
| Ownership | `is_owner`, `lead_founder` | boolean | System | Acceptance / transfer | both tables | ✅ First founder becomes owner. |
| Member type | `member_type` | `founder` / `team_member` | Required | Invitation | `venture_members`, invitations | ✅ |
| Team member email | `email` | email | Required to invite | Staff only | invitation → membership | 🟡 Founder-facing "Invite Member" is commented out (`MembersTabs.js:17-78`). |
| Team size | `team_size` | number | — | — | — | ⛔ Dead wizard only. No headcount field anywhere. |
| Founder bio / photo / LinkedIn | — | — | — | — | personal `contacts.image` only | ⛔ No venture-facing founder profile. |

### Category 8 — Operating location and geographic coverage

| Label | Internal | Type | Storage | Finding |
|---|---|---|---|---|
| Country of operation | `country` / `country_code` | text / ISO | `ventures` | 🟡 Single country only. |
| City | `city` | — | — | ⛔ Dead wizard only. |
| Venture address | `address` | — | — | ⛔ Only `contacts.address` (personal) exists. |
| Operating regions / markets served | — | — | — | ⛔ Missing. |

### Categories 9–13 — Baseline financial, customer, employment, funding, impact

Verified by full-tree search: there is no column, table, model or route that captures
any of these.

| Required item | Collected? | Evidence |
|---|---|---|
| Initial revenue | ⛔ No | No match for `monthly_revenue`, `initial_revenue`, `revenue_amount` |
| Initial cash position | ⛔ No | No `cash_position` / `starting_cash` |
| Initial operating expenditure | ⛔ No | No `opex` field |
| Initial headcount / employment | ⛔ No | No `headcount` / `employee_count` |
| Initial active customers | ⛔ No | No field |
| Initial active users | ⛔ No | No field |
| Previous funding received | ⛔ No | Only forward-looking `fundraising_campaigns.target_raise` / `current_raised` (admin-created), not history |
| Initial impact indicators | ⛔ No | No `impact_metrics` / `impact_indicators` / `social_impact` |
| Business stage as a baseline | 🟡 Current value only, overwritten in place; no history |
| Initial milestones / objectives | 🟡 The Journey is created after setup, by staff or plan import |

The only generic numeric store is `venture_kpis` (`kpi_key`, `kpi_label`, `kpi_value`,
`trend`), written by investor tooling, not by venture setup, and with no historical rows.

### Category 14 — Initial objectives, milestones and priorities

| Object | Fields | Who creates it | Finding |
|---|---|---|---|
| Journey stage | `name, description, objective, target_date, start_date, stage_order, status` | Staff (Journey Manager) or plan import | 🟡 Not part of founder onboarding |
| Milestone | `title, description, objective, start_date, target_date, priority, owner_cid/name, support_name, status, display_order` | Staff / import | 🟡 |
| Task | `title, description, status, priority, due_date, assigned_cid/name, definition_of_done, support_name, source_ref` | Staff / import | 🟡 |
| Deliverable | `title, status, approval_status, assigned_*`, evidence URL | Staff / import | 🟡 |

`north_star` is the natural home for a founder-declared objective and it has no UI.

### Category 15 — Additional onboarding information found

| Item | Storage | Finding |
|---|---|---|
| Provenance | `venture_origins` | ✅ System-written on creation; not user-facing. |
| Data Room requirements | `venture_documents`, `venture_document_types`, `venture_data_room_requirements` | ✅ Separate mechanism; 11 categories with a stage-based required/recommended/conditional matrix (`src/lib/dataRoom.js`). |
| Investment readiness | Data Room completeness (`services/ventures/dataRoom/readiness`) | ✅ This is the number on the Ventures list. |
| Legacy startup profile wizard | `startup_profiles`, `startup_profile_progress`, `startup_profile_documents` | 🟡 Unreachable — see R4. |

---

## Deliverable B — Data relationship map

```
contacts (personal identity, cid)
   └─1:N─ venture_members (contact_id, venture_id UUID, member_type, role, permissions)
              └─N:1─ ventures (id UUID, venture_id code)
                        ├─ venture_origins           (1:1, provenance)
                        ├─ venture_journey_stages    (1:N)
                        │     └─ venture_milestones  (1:N)
                        │           ├─ venture_tasks (1:N)
                        │           └─ venture_deliverables
                        ├─ venture_business_models   (1:1)
                        ├─ venture_verifications     (1:1) → items → documents
                        ├─ venture_documents         (Data Room)
                        └─ venture_kpis              (1:N, key/value/trend)

venture_member_invitations ──(acceptance)──> creates contact + membership
venture_founders (legacy ledger, keyed on the VNT code, reconciled from members)
startup_profiles (dead: one row per venture, five JSON steps)
```

| Relationship | Cardinality | Key | Notes |
|---|---|---|---|
| Personal profile → membership | 1 : N | `venture_members.contact_id → contacts.cid` | One permanent personal identity; membership is the relationship. Correct model. |
| Venture → membership | 1 : N | `venture_members.venture_id → ventures.id` (UUID) | Child tables key on the internal UUID since the Phase-0 refactor. |
| Venture → code | 1 : 1 | `ventures.venture_id` | Code is the URL/API key, never the stored reference. |
| Invitation → membership | 1 : 1 | token → contact → membership | Invite ≠ member until acceptance. |
| `venture_founders` | 1 : N (parallel) | `venture_id → ventures.venture_id` (code) | Legacy ledger, reconciled from members. Two sources for "who is a founder". |
| Venture → startup profile | 1 : 1 | `startup_profiles.venture_id` | Table written by nothing. |
| Venture → journey | 1 : N stages | `venture_journey_stages.venture_id → ventures.id` | Independent of setup. |
| Venture → Data Room | 1 : N documents | `venture_documents.venture_id` | Separate readiness engine. |

**Personal vs venture vs relationship vs baseline.** The correct split already exists
conceptually:

- **Personal:** `contacts` (name, email, phone, address, DOB, gender, language, photo)
  + `contact_emails` + `contact_roles`.
- **Venture:** `ventures` (identity, description, industry, sector, stage, country,
  registration, links).
- **Relationship:** `venture_members` (member_type, role, permissions, owner/lead,
  joined/removed).
- **Baseline:** does not exist.

Duplication found: `venture_founders` duplicates name/email/phone/title/role/ownership
that `contacts` + `venture_members` already hold. `ventures.name` duplicates
`company_name`.

---

## Deliverable C — Baseline audit

**Conclusion: ImpactOS does not capture a baseline. Not partially — at all.**

| Metric | Captured? | Storage | Historical value preserved? |
|---|---|---|---|
| Revenue | No | — | — |
| Cash position | No | — | — |
| Operating expenditure | No | — | — |
| Employment / headcount | No | — | — |
| Active customers | No | — | — |
| Active users | No | — | — |
| Previous funding | No | — | — |
| Business stage at onboarding | Only the current value | `ventures.business_stage` | No — overwritten in place |
| Initial milestones / objectives | Not at onboarding | journey tables | Journey is a separate instrument |
| Impact indicators | No | — | — |

**What exists instead:** a normal editable profile (`ventures` columns) plus documents in
the Data Room (including a "Financials & Projections" category). A document is evidence,
not a structured baseline: it cannot be charted, compared, or preserved as "the position
on day one".

There is no `captured_at` / `as_of_date` / `source` concept anywhere, so even a later
baseline would need a dedicated record to be distinguishable from an ordinary profile
edit. **Recommendation (not implemented):** one immutable baseline row per venture plus a
baseline-metrics table, written once at setup, never updated in place.

---

## Section 7 — Profile completion

There are three different completeness numbers, and only one is real.

### 1. Personal profile completion — real, enforced

`GET /api/profile` (`src/app/api/profile/route.js:67-81`) marks incomplete unless all of
these are present: **name, email, phone, country, language**. On login, an incomplete
profile redirects to the role's profile page (`src/app/login/page.js:66-76`). This is
personal, not venture, completion.

### 2. Venture setup score — real, computed on read, not enforced

`GET /api/ventures/[id]/progress` (`route.js:52-100`). Weights:

| Input | Points |
|---|---|
| `name` | 10 |
| `description` | 10 |
| `mission` | 5 |
| `vision` | 5 |
| `industry` | 10 |
| `sector` | 5 |
| `business_stage` | 5 |
| `website` | 5 |
| founders: 1 → 8, ≥2 → 15 | 15 |
| documents: 5 each, max 15 | 15 |
| business model row exists | 10 |
| customer discovery: 1 → 3, ≥2 → 5 | 5 |
| validations: 1 → 2, ≥3 → 5 | 5 |
| PMF assessment exists | 5 |

Capped at 100. Observations:

- It mixes profile completeness with activity (documents, interviews, validations, PMF).
  It is not a "required fields" measure.
- Several optional fields are weighted (mission, vision, sector, website) and several
  collected fields are ignored (`registration_number`, `country`, `logo`, social links).
- A brand-new admin-created venture with an accepted founder scores 23
  (name 10 + stage 5 + one founder 8).
- Recalculated on every read from live data — never stored — so it cannot go stale.
  Not enforced by the backend: no write is blocked by a low score.

### 3. Legacy "startup profile wizard" — dead

- Six-step wizard with validators and completion maths in
  `services/ventures/profile/wizard.js`.
- API routes exist: `GET/PATCH /api/ventures/[id]/startup-profile`,
  `POST .../submit`.
- No UI calls them. The only reference to the wizard is `VentureWizardTab`, which is not
  in the admin detail `TABS` list (`VentureDetailView.js:97-115`) and pushes to
  `/ventures/[id]/wizard`, a route that does not exist.
- `startup_profiles` is created only by old migration files, not by the runtime schema
  bootstrap — so a fresh database may not have the table at all.
- Consequence: the admin Profile tab still renders a 6-step "wizard progress" widget
  reading `venture.history` for `PROFILE_WIZARD_INIT`. It is permanently `0/6`.
- `getVentureById` still returns `profile_progress` from the dead
  `startup_profile_progress` table.

### 4. Data Room completeness — separate and healthy

Investor-facing readiness is Data Room completeness
(`services/ventures/dataRoom/readiness`), surfaced as `readiness_percent` on
`GET /api/ventures`. Correctly kept distinct from the setup score. No overlap problem
here.

---

## Deliverable D — Gap analysis, prioritised

### P0 — Misleading or broken user-visible behaviour

| # | Gap | Business consequence | Recommended correction |
|---|---|---|---|
| D1 | Admin Profile tab shows a permanently `0/6` "startup profile wizard" progress | A super admin reads "this venture has done nothing" when it may be fully set up | Remove the widget and the `PROFILE_WIZARD_INIT` reads, or wire the wizard. Removal is the honest fix. |
| D2 | `north_star`, `visibility`, `language`, `branding`, `logo_url` are sent on every founder save but have no UI | Silent writes of stale defaults; the payload promises fields the product does not collect | Either expose them or drop them from `ventureToPayload`. |
| D3 | "Invite Member" is commented out on the founder side | Founders cannot add their own team; only staff can | Decide and document; if intentional, say so in the UI. |
| D4 | Stage vocabulary drift (R1) | Same venture reads MVP for the founder and blank for the admin; reports group inconsistently | One list, served from `venture_option_values`, with a migration mapping `early_traction→validation/mvp` and `scaling→scale`. |

### P1 — Missing information the business needs at setup

| # | Gap | Consequence | Recommendation |
|---|---|---|---|
| D5 | No baseline capture at all (Deliverable C) | No "day one" position; every later metric is unanchored; cannot show progress or compare cohorts | Add an immutable baseline record at setup (proposal only — not built). |
| D6 | No legal structure, year founded, city/registered address | Cannot tell an incorporated company from an idea; legal onboarding is document-only | Add structured fields; make them conditional on `registration_status`. |
| D7 | No target customers / market segment | Investor matching and the market study rely on free text | Add segment + ICP fields; optionally seed from a controlled list. |
| D8 | No business model / revenue model in setup | `venture_business_models` exists but is unreachable; pricing is not captured anywhere | Either surface the existing API in setup or retire it. |
| D9 | No product maturity / team size | Cannot segment ventures by maturity or employment | Add both; team size is also the employment baseline. |
| D10 | No previous funding history | The only funding data is forward-looking campaigns; "amount raised to date" is unanswerable | Add funding history to the baseline record. |
| D11 | Impact indicators absent | The platform is an impact investor product; no structured impact data exists | Define indicators with Layer Two — do not block setup on them. |

### P2 — Data quality and integrity

| # | Gap | Consequence | Recommendation |
|---|---|---|---|
| D12 | `PUT /api/ventures` validates nothing except non-empty company name on PATCH | An API caller can store an invalid URL, an unknown stage, a bad country code | Whitelist enums, validate URLs/country codes at the service boundary. |
| D13 | `industry` is free text with a datalist | "Fintech", "fintech", "FinTech" become three industries | Store a code, render a label. |
| D14 | `registration_number` is not deduplicated and is founder-invisible | Duplicate companies; founders cannot correct their own registration | Add duplicate check + expose to founder with format guidance. |
| D15 | Two founder rosters (`venture_founders` vs `venture_members`) | Counts and permissions can disagree; the ledger depends on a reconcile | Declare `venture_members` canonical; retire the ledger from reads or keep it purely as an audit trail. |
| D16 | Two name columns (`name` / `company_name`) | Any writer that touches only one drifts | Keep the mirror in one function (already done) and prefer `company_name` everywhere. |
| D17 | `funding_requirement` and `completion_index` are read from `v2_programs` in investor queries | For venture-only rows they are NULL; investor cards lose the readiness/funding figures | Read them from the venture/Data Room, not the legacy program join. |

### Not gaps (verified working — do not redesign)

- Venture creation + invitation + acceptance flow (identity resolved, never fabricated).
- Personal identity model (`contacts` + `contact_emails` + `contact_roles`) — one identity
  per person, correctly reused.
- Invitation ≠ membership semantics.
- Data Room completeness engine and its separation from setup.
- Journey/task/deliverable status engine.
- Founder-facing personal profile gate on login.

---

## Deliverable E — Proposed one-time setup matrix

**Verified current** = exists and works today. **Proposed** = recommendation, not
implemented.

### Retain as-is

| Field | Why |
|---|---|
| Company name | Required, validated, unique |
| Founder email (invite) | Required, correct ownership model |
| Founder name + password on acceptance | Correct, minimal |
| Description | The only narrative we have |
| Website, social links, logo | Optional branding |
| Industry, sector | Keep, but convert to controlled values |
| Country + country code | Keep; add coverage later |
| Business stage | Keep, unify vocabulary |
| Registration status | Keep, and use it to drive conditions |

### Correct or relocate

| Field | Correction |
|---|---|
| `registration_number` | Move into the founder setup (admin retains override) |
| `north_star` | Expose as "90-day objective" in setup, or remove the column |
| Mission / vision | Keep optional; do not weight them in a completion score |
| `visibility` / `language` / `branding` | Remove from the save payload until there is UI |
| `venture_founders` | Treat as audit-only; all reads go through `venture_members` |
| Stage vocabularies | One source: `venture_option_values` |
| Setup score | Rebuild around required fields, not activity; exclude documents/interviews |

### Add at setup (essential)

| Field | Type | Required | Condition |
|---|---|---|---|
| Legal structure | select | Conditional | Always asked; required if registered |
| Year founded | number | Optional | — |
| City + operating address | text | Required | — |
| Product / service summary | text | Required | — |
| Target customer segment | select + text | Required | — |
| Business model | select (B2B/B2C/B2B2C/marketplace/other) | Required | — |
| Revenue model | select (subscription/transaction/licence/other) | Required | — |
| Product maturity | select (concept/prototype/live) | Required | — |
| Team size (incl. founders) | number | Required | ≥1 |
| Registration number | text | Conditional | `registration_status = Registered` |

### Add as a baseline block (one-time, immutable)

| Field | Type | Required | Condition |
|---|---|---|---|
| `as_of_date` | date | Required | — |
| Monthly revenue | number | Conditional | Stage ≠ idea |
| Cash on hand | number | Conditional | Stage ≠ idea |
| Monthly operating cost | number | Conditional | Stage ≠ idea |
| Active customers | number | Conditional | Stage ≠ idea |
| Active users | number | Optional | — |
| Employees (paid) | number | Required | — |
| Funding received to date | number | Required (0 allowed) | — |
| Funding sources | text / list | Optional | If amount > 0 |
| Impact indicators | key/value list | Optional | Deferred to Layer Two |

### Keep optional

Mission, vision, website, social links, logo, sector, second country, founder bios.

### Collect later, not at setup

Detailed financial model, cap table, unit economics, KPI history, impact measurement,
product analytics, customer interviews, PMF assessments, validations.

### Explicitly do not create

- A second personal account per venture. The model is correct today: one `contacts` row,
  N memberships.
- A parallel "venture profile" table. `ventures` is the venture; the gap is fields and a
  baseline record, not a new entity.

---

## Risks if changes proceed without decisions

1. **Stage vocabulary (R1)** — any new required-stage validation will reject existing rows
   (`early_traction`, `scaling`, `mvp`). Migrate first.
2. **Baseline immutability** — if baseline is added as ordinary `ventures` columns, it will
   be silently overwritten by the profile editor on the next save.
3. **Completion score** — if required fields are added without rebuilding the score,
   ventures will read 100% while missing the new required data, or read low forever
   because optional fields are weighted.
4. **Dead wizard removal** — removing `startup_profiles` reads touches `getVentureById`,
   the admin profile tab, and `services/ventures/investmentReadiness` (already retired).
   Safe, but must be done in one pass.
5. **Founder editor validation** — adding server validation to `PUT /api/ventures` may
   reject existing rows that hold legacy values for `industry` / `business_stage` /
   `country`. Validate on change, not on read.

---

## Short-form risk register

- **R1 — Stage vocabulary drift.** Three lists, one column, free text. Affects admin list,
  admin edit, founder editor, reports, investor filters.
- **R2 — Two name columns.** `name` / `company_name`, mirrored in one function only.
- **R3 — Two founder rosters.** `venture_members` (canonical) vs `venture_founders`
  (legacy ledger, reconciled lazily).
- **R4 — Dead wizard surfaces.** `startup_profiles` / `startup_profile_progress` are read
  but never written; the admin "wizard progress" widget is permanently `0/6`; the
  `/ventures/[id]/wizard` route does not exist.
- **R5 — No baseline.** See Deliverable C.
- **R6 — Validation gaps.** `PUT /api/ventures` accepts unvalidated strings.
- **R7 — Investor figures.** `funding_requirement` / `completion_index` live on
  `v2_programs`, so venture-only rows read NULL in investor views.

---

## What this audit did not do

No fields implemented, no flow modified, no migration, no production data touched, no
Layer-Two or KPI design, and no new tables created.

**Next decision needed:** approve (a) the required/optional/conditional split in
Deliverable E, and (b) whether the baseline is a structured one-time record — before any
of it is built.

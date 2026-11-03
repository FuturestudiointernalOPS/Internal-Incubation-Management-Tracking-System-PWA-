/**
 * Venture reporting — the data foundation for stages, data capture and
 * calculations (Phase 1: static profile, founders, team, baseline, settings).
 *
 * One part of the Venture schema bootstrap; concatenated, in order, by
 * `../schema.js`. ADDITIVE ONLY: nothing here touches an existing table.
 *
 * Key convention (deliberate): every new table carries BOTH
 *   - `venture_uuid` — the internal UUID used for joins and referential integrity
 *   - `venture_code` — the human `VNT-…` code shown in the UI
 * Existing tables keep their current keys untouched.
 */

export default [
// ─── Stage thresholds (editable, effective-dated, per business model) ───────
`CREATE TABLE IF NOT EXISTS venture_stage_settings (
  id SERIAL PRIMARY KEY,
  setting_key TEXT NOT NULL,
  business_model TEXT NOT NULL DEFAULT 'default',
  setting_value NUMERIC NOT NULL,
  value_type TEXT NOT NULL DEFAULT 'number',
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (setting_key, business_model, effective_from)
)`,
"CREATE INDEX IF NOT EXISTS idx_vss_key ON venture_stage_settings (setting_key, business_model, effective_from DESC)",

// ─── Money bands (flow and cash) ───────────────────────────────────────────
`CREATE TABLE IF NOT EXISTS venture_band_settings (
  id SERIAL PRIMARY KEY,
  band_kind TEXT NOT NULL CHECK (band_kind IN ('flow','cash')),
  band_code TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  low NUMERIC,
  high NUMERIC,
  midpoint NUMERIC,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE (band_kind, band_code, effective_from)
)`,
"CREATE INDEX IF NOT EXISTS idx_vbs_kind ON venture_band_settings (band_kind, sort_order)",

// ─── Static profile — one row per version ──────────────────────────────────
`CREATE TABLE IF NOT EXISTS venture_static_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_uuid UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  venture_code TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  effective_from DATE NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  legal_name TEXT,
  trade_name TEXT,
  founding_date DATE,
  registration_status TEXT,
  registration_country TEXT,
  pays_taxes BOOLEAN,
  social_protection BOOLEAN,
  sector TEXT,
  business_model TEXT,
  problem_statement TEXT,
  ideal_customer_profile TEXT,
  countries_of_operation TEXT[],
  north_star_name TEXT,
  north_star_definition TEXT,
  north_star_unit TEXT,
  reporting_currency TEXT NOT NULL DEFAULT 'XOF',
  accounting_basis TEXT CHECK (accounting_basis IN ('cash','accrual')),
  vat_included BOOLEAN,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  superseded_at TIMESTAMPTZ,
  superseded_by TEXT,
  superseded_reason TEXT,
  UNIQUE (venture_uuid, version)
)`,
"CREATE UNIQUE INDEX IF NOT EXISTS idx_vsp_current ON venture_static_profile (venture_uuid) WHERE is_current",

// ─── Founders ──────────────────────────────────────────────────────────────
`CREATE TABLE IF NOT EXISTS venture_founder (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_uuid UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  venture_code TEXT NOT NULL,
  contact_id TEXT REFERENCES contacts(cid) ON DELETE SET NULL,
  name TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('female','male','other','undisclosed')),
  date_of_birth DATE,
  role TEXT,
  employment_type TEXT CHECK (employment_type IN ('full_time','part_time')),
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
)`,
"CREATE INDEX IF NOT EXISTS idx_vf_venture ON venture_founder (venture_uuid) WHERE is_current",

// ─── Team snapshot (per reporting period) ──────────────────────────────────
`CREATE TABLE IF NOT EXISTS venture_team_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_uuid UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  venture_code TEXT NOT NULL,
  reporting_period DATE NOT NULL,
  women_employees INTEGER NOT NULL DEFAULT 0,
  men_employees INTEGER NOT NULL DEFAULT 0,
  under35_women INTEGER NOT NULL DEFAULT 0,
  under35_men INTEGER NOT NULL DEFAULT 0,
  full_time_employees INTEGER NOT NULL DEFAULT 0,
  part_time_employees INTEGER NOT NULL DEFAULT 0,
  part_time_days NUMERIC NOT NULL DEFAULT 0,
  full_time_founders INTEGER NOT NULL DEFAULT 0,
  part_time_founders INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (venture_uuid, reporting_period)
)`,

// ─── Baseline — locked; superseded with a reason ───────────────────────────
`CREATE TABLE IF NOT EXISTS venture_baseline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_uuid UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  venture_code TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fte NUMERIC,
  paying_customers INTEGER,
  cash_mode TEXT CHECK (cash_mode IN ('exact','band')),
  cash_value NUMERIC,
  cash_band TEXT,
  outside_financing_mode TEXT CHECK (outside_financing_mode IN ('exact','band')),
  outside_financing_value NUMERIC,
  outside_financing_band TEXT,
  is_locked BOOLEAN NOT NULL DEFAULT TRUE,
  superseded_at TIMESTAMPTZ,
  superseded_by TEXT,
  superseded_reason TEXT,
  created_by TEXT
)`,
"CREATE UNIQUE INDEX IF NOT EXISTS idx_vb_active ON venture_baseline (venture_uuid) WHERE superseded_at IS NULL",

// ─── Glossary ──────────────────────────────────────────────────────────────
`CREATE TABLE IF NOT EXISTS venture_glossary (
  id SERIAL PRIMARY KEY,
  term TEXT NOT NULL UNIQUE,
  definition_en TEXT NOT NULL,
  definition_fr TEXT NOT NULL,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
)`,

// ─── Seed: stage thresholds (studio-editable placeholders) ─────────────────
`INSERT INTO venture_stage_settings (setting_key, business_model, setting_value, value_type, effective_from) VALUES
 ('consecutive_months_required','default',3,'months','2026-11-01'),
 ('min_customer_growth_monthly','default',5,'percent','2026-11-01'),
 ('min_monthly_retention_early_traction','default',50,'percent','2026-11-01'),
 ('min_monthly_retention_growth','default',50,'percent','2026-11-01'),
 ('min_ltv_cac','default',3,'number','2026-11-01'),
 ('validation_min_interviews','default',10,'count','2026-11-01'),
 ('early_traction_min_paying_customers','default',5,'count','2026-11-01'),
 ('growth_min_paying_customers','default',15,'count','2026-11-01'),
 ('scaling_sustained_growth_months','default',6,'months','2026-11-01'),
 ('scaling_min_monthly_retention','default',70,'percent','2026-11-01'),
 ('scaling_min_non_founder_fte','default',5,'count','2026-11-01'),
 ('review_flag_months','default',3,'months','2026-11-01')
 ON CONFLICT (setting_key, business_model, effective_from) DO NOTHING`,

// ─── Seed: traffic light + reporting schedule (studio-editable) ────────────
// The §11 thresholds and the due date of every submission. Both live in the
// SAME settings table, so the settings screen is one screen and one concept.
`INSERT INTO venture_stage_settings (setting_key, business_model, setting_value, value_type, effective_from) VALUES
 ('traffic_runway_green_months','default',9,'months','2026-11-01'),
 ('traffic_runway_amber_months','default',4,'months','2026-11-01'),
 ('traffic_growth_green_pct','default',5,'percent','2026-11-01'),
 ('traffic_growth_amber_pct','default',0,'percent','2026-11-01'),
 ('traffic_milestones_green_pct','default',80,'percent','2026-11-01'),
 ('traffic_milestones_amber_pct','default',50,'percent','2026-11-01'),
 ('reporting_monthly_due_day','default',5,'day','2026-11-01'),
 ('reporting_monthly_due_minute','default',540,'minute','2026-11-01'),
 ('reporting_quarterly_due_day','default',10,'day','2026-11-01'),
 ('reporting_quarterly_due_minute','default',540,'minute','2026-11-01'),
 ('reporting_utc_offset_minutes','default',0,'minute','2026-11-01')
 ON CONFLICT (setting_key, business_model, effective_from) DO NOTHING`,

// ─── Seed: bands (flow F0–F8, cash C0–C7) ──────────────────────────────────
`INSERT INTO venture_band_settings (band_kind, band_code, sort_order, low, high, midpoint, effective_from) VALUES
 ('flow','F0',0,0,0,0,'2026-11-01'),
 ('flow','F1',1,1,50000,25000.5,'2026-11-01'),
 ('flow','F2',2,50001,100000,75000.5,'2026-11-01'),
 ('flow','F3',3,100001,250000,175000.5,'2026-11-01'),
 ('flow','F4',4,250001,500000,375000.5,'2026-11-01'),
 ('flow','F5',5,500001,1000000,750000.5,'2026-11-01'),
 ('flow','F6',6,1000001,2500000,1750000.5,'2026-11-01'),
 ('flow','F7',7,2500001,5000000,3750000.5,'2026-11-01'),
 ('flow','F8',8,5000001,6250001.25,5625001.125,'2026-11-01'),
 ('cash','C0',0,0,0,0,'2026-11-01'),
 ('cash','C1',1,1,500000,250000.5,'2026-11-01'),
 ('cash','C2',2,500001,1000000,750000.5,'2026-11-01'),
 ('cash','C3',3,1000001,2500000,1750000.5,'2026-11-01'),
 ('cash','C4',4,2500001,5000000,3750000.5,'2026-11-01'),
 ('cash','C5',5,5000001,10000000,7500000.5,'2026-11-01'),
 ('cash','C6',6,10000001,25000000,17500000.5,'2026-11-01'),
 ('cash','C7',7,25000001,31250001.25,28125001.125,'2026-11-01')
 ON CONFLICT (band_kind, band_code, effective_from) DO NOTHING`,

// ─── Seed: glossary (studio must confirm the wording) ──────────────────────
// `paying_customer` is defined as a STOCK AT MONTH END on purpose: the monthly
// form asks for the closing count and churn is `start + new − end`. A definition
// saying "paid at some point during the month" would describe a different number.
`INSERT INTO venture_glossary (term, definition_en, definition_fr) VALUES
 ('mrr','Monthly recurring revenue from subscriptions, excluding one-off income.','Revenu récurrent mensuel des abonnements, hors revenus ponctuels.'),
 ('paying_customer','A customer whose paid subscription is active at the end of the reporting month. Free trials and pilots that have not converted to paid are excluded.','Un client dont l''abonnement payant est actif à la fin du mois de référence. Les essais gratuits et les pilotes non convertis sont exclus.'),
 ('active_user','A person who used the product at least once during the reporting month.','Une personne ayant utilisé le produit au moins une fois pendant le mois de référence.'),
 ('fte','Full-time employees + (part-time days worked ÷ 20) + full-time founders.','Employés à temps plein + (jours travaillés à temps partiel ÷ 20) + fondateurs à temps plein.'),
 ('churn_rate','Lost customers divided by paying customers at the start of the month. Lost = paying at start + new − paying at end.','Clients perdus divisés par les clients payants en début de mois. Perdus = payants en début + nouveaux − payants en fin.'),
 ('retention','1 − churn rate: the share of paying customers who stayed during the month.','1 − taux d''attrition : la part des clients payants restés pendant le mois.'),
 ('arpu','MRR divided by paying customers at the end of the month.','MRR divisé par les clients payants à la fin du mois.'),
 ('ltv','ARPU × customer lifetime, where lifetime = 1 ÷ churn rate. Not applicable when churn is zero.','ARPU × durée de vie client, où durée de vie = 1 ÷ taux d''attrition. Non applicable si l''attrition est nulle.')
 ON CONFLICT (term) DO NOTHING`,

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2 — monthly reporting (raw submission) + calculated metrics
// ═══════════════════════════════════════════════════════════════════════════

// The founder's monthly submission. Append-only in spirit: a correction after
// validation creates version N+1 rather than overwriting the validated row, so
// the numbers a KPI was built from can always be reproduced.
//
// Money is stored as a TRIPLE — the mode, the exact value, the band code — for
// every money field, because the founder may answer either way and the answer
// must keep saying which it was.
`CREATE TABLE IF NOT EXISTS venture_monthly_report (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_uuid UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  venture_code TEXT NOT NULL,
  reporting_period DATE NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','validated','rejected')),

  mrr_mode TEXT CHECK (mrr_mode IN ('exact','band')),
  mrr_value NUMERIC,
  mrr_band TEXT,
  other_revenue_mode TEXT CHECK (other_revenue_mode IN ('exact','band')),
  other_revenue_value NUMERIC,
  other_revenue_band TEXT,
  expenses_mode TEXT CHECK (expenses_mode IN ('exact','band')),
  expenses_value NUMERIC,
  expenses_band TEXT,
  cash_mode TEXT CHECK (cash_mode IN ('exact','band')),
  cash_value NUMERIC,
  cash_band TEXT,

  financing_received BOOLEAN NOT NULL DEFAULT FALSE,
  active_users INTEGER,
  paying_customers INTEGER,
  new_paying_customers INTEGER,
  full_time INTEGER,
  part_time INTEGER,
  part_time_days NUMERIC,
  full_time_founders INTEGER,
  north_star_value NUMERIC,
  narrative TEXT,

  submitted_at TIMESTAMPTZ,
  submitted_by TEXT,
  validated_at TIMESTAMPTZ,
  validated_by TEXT,
  rejected_at TIMESTAMPTZ,
  rejected_by TEXT,
  rejection_reason TEXT,
  superseded_at TIMESTAMPTZ,
  superseded_by TEXT,
  superseded_reason TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (venture_uuid, reporting_period, version)
)`,

// Exactly ONE validated report per venture and period may be live at a time.
// A corrected month supersedes the old row IN THE SAME TRANSACTION that
// validates the new one, so this index can never see two "truths".
"CREATE UNIQUE INDEX IF NOT EXISTS idx_vmr_one_validated ON venture_monthly_report (venture_uuid, reporting_period) WHERE status = 'validated' AND superseded_at IS NULL",

// ...and at most one report may be OPEN (draft or awaiting validation). A
// rejected row is closed and does not block the founder's correction.
"CREATE UNIQUE INDEX IF NOT EXISTS idx_vmr_one_open ON venture_monthly_report (venture_uuid, reporting_period) WHERE status IN ('draft','submitted')",

"CREATE INDEX IF NOT EXISTS idx_vmr_venture_period ON venture_monthly_report (venture_uuid, reporting_period DESC)",

// The calculated layer. The dashboard reads ONLY this table (spec §12), which
// is why every value here can be re-derived from the raw report at any time.
// `status` is three-valued on purpose: a missing input is `not_applicable`
// (never 0), and a non-burning venture is `self_sustaining` (never Infinity).
`CREATE TABLE IF NOT EXISTS venture_metrics_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_uuid UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  venture_code TEXT NOT NULL,
  reporting_period DATE NOT NULL,
  metric_key TEXT NOT NULL,
  value NUMERIC,
  value_low NUMERIC,
  value_high NUMERIC,
  is_approximate BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'computed'
    CHECK (status IN ('computed','not_applicable','self_sustaining')),
  source_report_id UUID REFERENCES venture_monthly_report(id) ON DELETE CASCADE,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (venture_uuid, reporting_period, metric_key)
)`,

"CREATE INDEX IF NOT EXISTS idx_vmm_venture_metric ON venture_metrics_monthly (venture_uuid, metric_key, reporting_period DESC)",

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 3 — the evidence the stage rules point at
// ═══════════════════════════════════════════════════════════════════════════

// The event log (spec §7). Some facts happen at a moment in time — a pilot was
// signed, an MVP went live — and belong in no monthly form. Each carries a
// date, and where the spec demands it, EVIDENCE.
//
// `evidence` holds ONE value that is either an external link (`https://…`) or a
// private storage path; `isExternalEvidenceLink()` tells them apart, so a
// reviewer is never asked to guess which it is.
//
// Deliberately NOT `venture_timeline_events`: that is a free-form timeline used
// by the journey feature. These events are typed, validated and read by the
// stage engine, so they need their own narrow shape.
`CREATE TABLE IF NOT EXISTS venture_event_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_uuid UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  venture_code TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'pilot_signed','mvp_launched','pilot_converted',
    'financing_received','new_market','status_change','stage_change'
  )),
  event_date DATE NOT NULL,
  title TEXT,
  description TEXT,
  customer_name TEXT,
  amount_mode TEXT CHECK (amount_mode IN ('exact','band')),
  amount_value NUMERIC,
  amount_band TEXT,
  financing_type TEXT CHECK (financing_type IN ('grant','equity','debt')),
  source TEXT,
  market_description TEXT,
  status_from TEXT,
  status_to TEXT,
  evidence TEXT,
  evidence_name TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
)`,

"CREATE INDEX IF NOT EXISTS idx_vel_venture ON venture_event_log (venture_uuid, event_date DESC)",

// Customer-discovery interviews ALREADY have a table, dated and named. The
// studio asked for each one to carry a document or a link, so the evidence
// lives where the interview already lives rather than in a second list.
"ALTER TABLE IF EXISTS venture_customer_interviews ADD COLUMN IF NOT EXISTS evidence TEXT",
"ALTER TABLE IF EXISTS venture_customer_interviews ADD COLUMN IF NOT EXISTS evidence_name TEXT",

// Per-MONTH acquisition channels. The Growth criterion needs "the same channel
// brought customers in each of the last N months", which a quarterly list can
// never prove.
"ALTER TABLE IF EXISTS venture_monthly_report ADD COLUMN IF NOT EXISTS channels TEXT[]",

// ─── The currency a report was FILED IN ─────────────────────────────────────
// The Venture's reporting currency is a CURRENT setting; the money in a report
// is a historical fact. Stamping it on the row is what lets the studio change
// the currency tomorrow without re-labelling figures already reported.
"ALTER TABLE IF EXISTS venture_monthly_report ADD COLUMN IF NOT EXISTS currency TEXT",
"ALTER TABLE IF EXISTS venture_quarterly_report ADD COLUMN IF NOT EXISTS currency TEXT",
"ALTER TABLE IF EXISTS venture_event_log ADD COLUMN IF NOT EXISTS currency TEXT",
"ALTER TABLE IF EXISTS venture_baseline ADD COLUMN IF NOT EXISTS currency TEXT",

// ── Quarterly report (spec §9) ─────────────────────────────────────────────
// Only what cannot be derived: the monthly figures already answer customers,
// revenue, retention and runway, so the quarterly form asks the STAGE-SPECIFIC
// questions and nothing else.
`CREATE TABLE IF NOT EXISTS venture_quarterly_report (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_uuid UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  venture_code TEXT NOT NULL,
  reporting_period DATE NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','validated','rejected')),

  team_confirmed BOOLEAN,
  mvp_milestones_planned INTEGER,
  mvp_milestones_hit INTEGER,
  pilots_signed INTEGER,
  pilots_converted INTEGER,
  channels TEXT[],
  sales_marketing_mode TEXT CHECK (sales_marketing_mode IN ('exact','band')),
  sales_marketing_value NUMERIC,
  sales_marketing_band TEXT,
  open_deals INTEGER,
  sales_cycle_days INTEGER,
  top3_share_band TEXT CHECK (top3_share_band IN ('under_30','30_60','over_60')),
  expansion_mode TEXT CHECK (expansion_mode IN ('exact','band')),
  expansion_value NUMERIC,
  expansion_band TEXT,
  churned_mode TEXT CHECK (churned_mode IN ('exact','band')),
  churned_value NUMERIC,
  churned_band TEXT,
  narrative TEXT,

  submitted_at TIMESTAMPTZ,
  submitted_by TEXT,
  validated_at TIMESTAMPTZ,
  validated_by TEXT,
  rejected_at TIMESTAMPTZ,
  rejected_by TEXT,
  rejection_reason TEXT,
  superseded_at TIMESTAMPTZ,
  superseded_by TEXT,
  superseded_reason TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (venture_uuid, reporting_period, version)
)`,

"CREATE UNIQUE INDEX IF NOT EXISTS idx_vqr_one_validated ON venture_quarterly_report (venture_uuid, reporting_period) WHERE status = 'validated' AND superseded_at IS NULL",

"CREATE UNIQUE INDEX IF NOT EXISTS idx_vqr_one_open ON venture_quarterly_report (venture_uuid, reporting_period) WHERE status IN ('draft','submitted')",

"CREATE INDEX IF NOT EXISTS idx_vqr_venture_period ON venture_quarterly_report (venture_uuid, reporting_period DESC)",

// Same calculated layer as the monthly one, for the quarter's own figures
// (CAC, LTV:CAC, burn multiple, NRR, pilot-to-paid, MVP on-time).
`CREATE TABLE IF NOT EXISTS venture_metrics_quarterly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_uuid UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  venture_code TEXT NOT NULL,
  reporting_period DATE NOT NULL,
  metric_key TEXT NOT NULL,
  value NUMERIC,
  value_low NUMERIC,
  value_high NUMERIC,
  is_approximate BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'computed'
    CHECK (status IN ('computed','not_applicable')),
  source_report_id UUID REFERENCES venture_quarterly_report(id) ON DELETE CASCADE,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (venture_uuid, reporting_period, metric_key)
)`,

"CREATE INDEX IF NOT EXISTS idx_vmq_venture_metric ON venture_metrics_quarterly (venture_uuid, metric_key, reporting_period DESC)",

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 5 — the stage decision (spec §4.2, §4.3)
// ═══════════════════════════════════════════════════════════════════════════

// A promotion is PROPOSED, never applied silently. The snapshot holds the
// numbers that justified it, so the decision can be audited years later even
// after the underlying reports have been corrected.
`CREATE TABLE IF NOT EXISTS venture_stage_proposal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_uuid UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  venture_code TEXT NOT NULL,
  from_stage TEXT NOT NULL,
  to_stage TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','superseded')),
  progress NUMERIC,
  snapshot JSONB,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  decided_by TEXT,
  rejection_reason TEXT
)`,

// One open proposal per Venture: a second evaluation must not queue a duplicate.
"CREATE UNIQUE INDEX IF NOT EXISTS idx_vsp_one_pending ON venture_stage_proposal (venture_uuid) WHERE status = 'pending'",

"CREATE INDEX IF NOT EXISTS idx_vsp_venture ON venture_stage_proposal (venture_uuid, created_at DESC)",

// The permanent record of every stage a Venture has held. `ventures.business_stage`
// is the CURRENT value; this is the history behind it.
`CREATE TABLE IF NOT EXISTS venture_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_uuid UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  venture_code TEXT NOT NULL,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  progress NUMERIC,
  snapshot JSONB,
  decided_by TEXT,
  decided_at TIMESTAMPTZ DEFAULT NOW()
)`,

"CREATE INDEX IF NOT EXISTS idx_vsh_venture ON venture_stage_history (venture_uuid, decided_at DESC)",
];

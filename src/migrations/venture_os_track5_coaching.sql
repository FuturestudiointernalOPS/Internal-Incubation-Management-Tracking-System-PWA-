-- Sprint 3 Track 5: Coaching, KPIs & Investment Readiness (Tickets 4.1-4.4 only —
-- 4.5 Investment Readiness Assessment and 4.6 Venture Reports are held back for
-- Sprint 4, do not build).
-- Reuses v2_followups pattern (adds venture_id) instead of a new meeting engine.

CREATE TABLE IF NOT EXISTS venture_advisors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  advisor_contact_id TEXT NOT NULL REFERENCES contacts(cid),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  assigned_by TEXT REFERENCES contacts(cid),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at TIMESTAMPTZ,
  UNIQUE(venture_id, advisor_contact_id)
);

CREATE TABLE IF NOT EXISTS venture_coaching_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  advisor_contact_id TEXT REFERENCES contacts(cid),
  session_date TIMESTAMPTZ,
  notes TEXT,
  observations TEXT,
  recommendations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- KPI definitions are global/reusable (business rule 49: "not hardcoded, reusable
-- across ventures"); per-venture assignment is a separate table.
CREATE TABLE IF NOT EXISTS venture_kpi_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT,
  auto_calc_source TEXT, -- null | 'customer_interviews' | 'milestones' | 'tasks' ... maps to a query the API knows how to auto-compute
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT REFERENCES contacts(cid),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS venture_kpi_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  kpi_definition_id UUID NOT NULL REFERENCES venture_kpi_definitions(id) ON DELETE CASCADE,
  target_value NUMERIC,
  current_value NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(venture_id, kpi_definition_id)
);

ALTER TABLE v2_followups ADD COLUMN IF NOT EXISTS venture_id UUID REFERENCES ventures(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_followups_venture ON v2_followups(venture_id);

CREATE INDEX IF NOT EXISTS idx_vadv_venture ON venture_advisors(venture_id);
CREATE INDEX IF NOT EXISTS idx_vcoach_venture ON venture_coaching_sessions(venture_id);
CREATE INDEX IF NOT EXISTS idx_vkpiassign_venture ON venture_kpi_assignments(venture_id);

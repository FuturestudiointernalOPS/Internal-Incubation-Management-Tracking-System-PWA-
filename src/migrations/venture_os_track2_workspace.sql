-- Sprint 3 Track 2: Venture Development Workspace
-- Business Model, Customer Discovery, Validation, PMF, Milestones, Action Plans
-- Depends on: ventures (venture_os_track1_foundation.sql)

CREATE TABLE IF NOT EXISTS venture_business_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  business_model_canvas JSONB DEFAULT '{}', -- key_partners, key_activities, key_resources, value_propositions, customer_relationships, channels, customer_segments, cost_structure, revenue_streams
  lean_canvas JSONB DEFAULT '{}', -- problem, solution, key_metrics, unique_value_proposition, unfair_advantage, channels, customer_segments, cost_structure, revenue_streams
  revenue_streams TEXT,
  cost_structure TEXT,
  key_partners TEXT,
  updated_by TEXT REFERENCES contacts(cid),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(venture_id)
);

CREATE TABLE IF NOT EXISTS venture_customer_interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  customer_segment TEXT,
  interviewee_name TEXT,
  interview_date DATE,
  notes TEXT,
  insights TEXT,
  created_by TEXT REFERENCES contacts(cid),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS venture_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  validation_type TEXT NOT NULL, -- problem | solution | product
  status TEXT NOT NULL DEFAULT 'in_progress', -- not_started | in_progress | validated | invalidated
  notes TEXT,
  created_by TEXT REFERENCES contacts(cid),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS venture_pmf_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  customer_feedback TEXT,
  improvements TEXT,
  pmf_progress INTEGER DEFAULT 0, -- 0-100
  created_by TEXT REFERENCES contacts(cid),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS venture_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_date DATE,
  progress INTEGER NOT NULL DEFAULT 0, -- 0-100
  status TEXT NOT NULL DEFAULT 'not_started', -- not_started | in_progress | completed
  created_by TEXT REFERENCES contacts(cid),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS venture_action_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES venture_milestones(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium', -- low | medium | high
  deadline DATE,
  owner_contact_id TEXT REFERENCES contacts(cid),
  status TEXT NOT NULL DEFAULT 'open', -- open | in_progress | done
  created_by TEXT REFERENCES contacts(cid),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vbm_venture ON venture_business_models(venture_id);
CREATE INDEX IF NOT EXISTS idx_vci_venture ON venture_customer_interviews(venture_id);
CREATE INDEX IF NOT EXISTS idx_vv_venture ON venture_validations(venture_id);
CREATE INDEX IF NOT EXISTS idx_vpmf_venture ON venture_pmf_assessments(venture_id);
CREATE INDEX IF NOT EXISTS idx_vm_venture ON venture_milestones(venture_id);
CREATE INDEX IF NOT EXISTS idx_vap_venture ON venture_action_plans(venture_id);
CREATE INDEX IF NOT EXISTS idx_vap_milestone ON venture_action_plans(milestone_id);

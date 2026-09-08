-- =============================================================================
-- Investor OS — Due Diligence: Founder Evaluation & Risk Assessment
-- =============================================================================

-- 1. Founder Evaluations
CREATE TABLE IF NOT EXISTS founder_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID NOT NULL REFERENCES investment_pipeline(id) ON DELETE CASCADE,
    founder_name TEXT NOT NULL,
    role TEXT,
    experience_score INTEGER DEFAULT 0 CHECK (experience_score BETWEEN 0 AND 10),
    leadership_score INTEGER DEFAULT 0 CHECK (leadership_score BETWEEN 0 AND 10),
    domain_expertise_score INTEGER DEFAULT 0 CHECK (domain_expertise_score BETWEEN 0 AND 10),
    overall_rating INTEGER DEFAULT 0 CHECK (overall_rating BETWEEN 0 AND 10),
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_founder_evals_pipeline ON founder_evaluations(pipeline_id);

-- 2. Risk Assessments
CREATE TABLE IF NOT EXISTS risk_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID NOT NULL REFERENCES investment_pipeline(id) ON DELETE CASCADE,
    risk_category TEXT NOT NULL CHECK (risk_category IN ('market', 'product', 'financial', 'operational', 'legal')),
    risk_description TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    mitigation TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'mitigated', 'accepted')),
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(pipeline_id, risk_category)
);

CREATE INDEX IF NOT EXISTS idx_risk_assessments_pipeline ON risk_assessments(pipeline_id);

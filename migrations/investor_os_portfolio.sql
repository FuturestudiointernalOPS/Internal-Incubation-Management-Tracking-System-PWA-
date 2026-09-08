-- =============================================================================
-- Investor OS — Portfolio data tables (Track 4)
-- =============================================================================

-- 1. Founder/Venture Updates
CREATE TABLE IF NOT EXISTS venture_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venture_id UUID NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    update_type TEXT NOT NULL DEFAULT 'general'
        CHECK (update_type IN ('monthly', 'quarterly', 'product', 'business', 'general')),
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venture_updates_venture ON venture_updates(venture_id);
CREATE INDEX IF NOT EXISTS idx_venture_updates_type ON venture_updates(update_type);

-- 2. Venture KPIs
CREATE TABLE IF NOT EXISTS venture_kpis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venture_id UUID NOT NULL,
    kpi_key TEXT NOT NULL,
    kpi_label TEXT NOT NULL,
    kpi_value TEXT NOT NULL,
    trend TEXT DEFAULT 'stable' CHECK (trend IN ('up', 'down', 'stable')),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(venture_id, kpi_key)
);

CREATE INDEX IF NOT EXISTS idx_venture_kpis_venture ON venture_kpis(venture_id);

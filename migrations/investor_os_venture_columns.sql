-- =============================================================================
-- Investor OS — Add venture metadata columns to v2_programs
-- =============================================================================

ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS business_stage TEXT;
ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS funding_requirement TEXT;
ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS completion_index NUMERIC DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_v2_programs_industry ON v2_programs(industry);
CREATE INDEX IF NOT EXISTS idx_v2_programs_country ON v2_programs(country);

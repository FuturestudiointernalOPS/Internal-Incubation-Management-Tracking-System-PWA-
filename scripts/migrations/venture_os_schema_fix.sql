-- =============================================================================
-- IMPACTOS — VENTURE OS SCHEMA FIX
-- Adds missing columns to the ventures table if they don't exist.
-- This handles the case where the table was created before the correct DDL.
-- =============================================================================

-- Add venture_id column if missing
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS venture_id TEXT;
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS registration_number TEXT;
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS business_stage TEXT;
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Make venture_id unique if it's not already
CREATE UNIQUE INDEX IF NOT EXISTS idx_ventures_venture_id_unique ON ventures(venture_id);

-- Ensure name column is populated from company_name for backward compat
UPDATE ventures SET company_name = name WHERE company_name IS NULL AND name IS NOT NULL;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_ventures_company_name ON ventures(company_name);
CREATE INDEX IF NOT EXISTS idx_ventures_status ON ventures(status);

-- Venture founders columns
ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS invitation_token TEXT;
ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS invitation_sent_at TIMESTAMP;
ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS invitation_accepted_at TIMESTAMP;
ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- Ensure venture_founders has email column (might be missing in old schema)
ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS name TEXT;

-- Venture members columns
ALTER TABLE venture_members ADD COLUMN IF NOT EXISTS joined_at TIMESTAMP DEFAULT NOW();

-- Add startup profile tables
CREATE TABLE IF NOT EXISTS startup_profiles (
    id SERIAL PRIMARY KEY,
    venture_id TEXT NOT NULL UNIQUE REFERENCES ventures(venture_id) ON DELETE CASCADE,
    step_1_data JSONB DEFAULT '{}'::jsonb,
    step_2_data JSONB DEFAULT '{}'::jsonb,
    step_3_data JSONB DEFAULT '{}'::jsonb,
    step_4_data JSONB DEFAULT '{}'::jsonb,
    step_5_data JSONB DEFAULT '{}'::jsonb,
    is_submitted BOOLEAN DEFAULT FALSE,
    submitted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS startup_profile_progress (
    id SERIAL PRIMARY KEY,
    venture_id TEXT NOT NULL UNIQUE REFERENCES ventures(venture_id) ON DELETE CASCADE,
    current_step INTEGER NOT NULL DEFAULT 1,
    completion_percentage INTEGER NOT NULL DEFAULT 0,
    last_completed_step INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT FALSE,
    last_updated TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS startup_profile_documents (
    id SERIAL PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size BIGINT,
    file_type TEXT,
    file_url TEXT NOT NULL,
    uploaded_by TEXT,
    uploaded_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(venture_id, document_type, file_name)
);

CREATE INDEX IF NOT EXISTS idx_startup_profiles_venture_id ON startup_profiles(venture_id);
CREATE INDEX IF NOT EXISTS idx_startup_profile_progress_venture_id ON startup_profile_progress(venture_id);
CREATE INDEX IF NOT EXISTS idx_startup_profile_docs_venture_id ON startup_profile_documents(venture_id);

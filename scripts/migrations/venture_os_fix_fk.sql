-- Fix: Add proper UNIQUE constraint on ventures.venture_id (needed for FK references)
-- A unique INDEX is not enough — PostgreSQL requires a UNIQUE CONSTRAINT for foreign keys.

-- First, drop existing unique index if we're replacing it
DROP INDEX IF EXISTS idx_ventures_venture_id_unique;

-- Add the UNIQUE constraint (creates its own index automatically)
ALTER TABLE ventures ADD CONSTRAINT ventures_venture_id_key UNIQUE (venture_id);

-- Now create the tables that reference ventures(venture_id)
CREATE TABLE IF NOT EXISTS startup_profiles (
    id SERIAL PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
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
    venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
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

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_startup_profiles_venture_id ON startup_profiles(venture_id);
CREATE INDEX IF NOT EXISTS idx_startup_profile_progress_venture_id ON startup_profile_progress(venture_id);
CREATE INDEX IF NOT EXISTS idx_startup_profile_docs_venture_id ON startup_profile_documents(venture_id);

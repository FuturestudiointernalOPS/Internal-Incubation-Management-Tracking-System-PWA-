-- =============================================================================
-- IMPACTOS — VENTURE OS STARTUP PROFILE WIZARD
-- Enhancement 1.2 — Startup Profile Wizard
-- =============================================================================

-- Startup profiles (stores all wizard step data as flexible JSONB)
CREATE TABLE IF NOT EXISTS startup_profiles (
    id SERIAL PRIMARY KEY,
    venture_id TEXT NOT NULL UNIQUE REFERENCES ventures(venture_id) ON DELETE CASCADE,
    step_1_data JSONB DEFAULT '{}'::jsonb,  -- Startup Identity
    step_2_data JSONB DEFAULT '{}'::jsonb,  -- Business Information
    step_3_data JSONB DEFAULT '{}'::jsonb,  -- Founder Information
    step_4_data JSONB DEFAULT '{}'::jsonb,  -- Team Information
    step_5_data JSONB DEFAULT '{}'::jsonb,  -- Supporting Documents
    is_submitted BOOLEAN DEFAULT FALSE,
    submitted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_startup_profiles_venture_id ON startup_profiles(venture_id);

-- Startup profile progress tracking
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

CREATE INDEX IF NOT EXISTS idx_startup_profile_progress_venture_id ON startup_profile_progress(venture_id);

-- Startup profile documents (uploaded file metadata)
CREATE TABLE IF NOT EXISTS startup_profile_documents (
    id SERIAL PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,  -- business_registration, pitch_deck, business_plan, financial_docs, other
    file_name TEXT NOT NULL,
    file_size BIGINT,
    file_type TEXT,
    file_url TEXT NOT NULL,
    uploaded_by TEXT,
    uploaded_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(venture_id, document_type, file_name)
);

CREATE INDEX IF NOT EXISTS idx_startup_profile_docs_venture_id ON startup_profile_documents(venture_id);
CREATE INDEX IF NOT EXISTS idx_startup_profile_docs_type ON startup_profile_documents(document_type);

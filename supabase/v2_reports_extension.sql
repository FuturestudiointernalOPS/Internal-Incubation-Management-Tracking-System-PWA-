-- V2 Reports Extension (Non-destructive)
-- Isolated reporting system for Stand-ups and Retros

CREATE TABLE IF NOT EXISTS reports_v2 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('standup', 'retro')),
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, week_start, type) -- Ensure only one report of each type per user per week
);

CREATE TABLE IF NOT EXISTS report_blocks_v2 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES reports_v2(id) ON DELETE CASCADE,
    context_type TEXT NOT NULL CHECK (context_type IN ('personal', 'program')),
    program_id UUID, -- NULL for personal blocks
    
    current_state TEXT,
    challenge TEXT,
    
    todo JSONB DEFAULT '[]'::jsonb, -- Array of strings for standup
    retro_status JSONB DEFAULT '[]'::jsonb, -- Array of objects {task, completed} for retro
    
    what_worked TEXT,
    what_failed TEXT,
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indices for isolated performance
CREATE INDEX IF NOT EXISTS idx_reports_v2_user_week ON reports_v2(user_id, week_start);
CREATE INDEX IF NOT EXISTS idx_report_blocks_v2_report_id ON report_blocks_v2(report_id);

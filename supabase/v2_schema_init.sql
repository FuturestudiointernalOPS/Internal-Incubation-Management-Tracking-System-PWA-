-- Initial Schema for Version 2 (Incubation Lifecycle Management)
-- Strict isolation via program_id

--------------------------------------------------------------------------------
-- 1. MASTER PROGRAMS (TEMPLATES)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS v2_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    duration_weeks INTEGER NOT NULL DEFAULT 13,
    duration_days INTEGER NOT NULL DEFAULT 0,
    topics JSONB DEFAULT '[]'::jsonb, -- Weekly/Daily curriculum
    outcomes TEXT,
    deliverables JSONB DEFAULT '[]'::jsonb, -- List of expected submission types
    resources JSONB DEFAULT '[]'::jsonb, -- PDF links, external tools
    assigned_pm_id TEXT, -- User ID of the Project Manager
    feedback_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

--------------------------------------------------------------------------------
-- 2. EXECUTABLE PROJECTS (PROGRAM INSTANCES)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS v2_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES v2_programs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active', -- Active, Completed, Paused
    type TEXT NOT NULL DEFAULT 'Incubation',
    concept_note TEXT,
    concept_note_url TEXT,
    mission_vision TEXT,
    mission_url TEXT,
    kpis TEXT,
    kpis_url TEXT,
    topics TEXT, -- Specific adjustment for this instance
    schedule_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_v2_projects_program_id ON v2_projects(program_id);

--------------------------------------------------------------------------------
-- 3. PARTICIPANTS & ENROLLMENTS
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS v2_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES v2_programs(id) ON DELETE CASCADE,
    user_id TEXT, -- Link to Auth User ID
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    bio TEXT,
    cv_url TEXT,
    screening_status TEXT DEFAULT 'pending', -- pending, accepted, rejected, interview
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_v2_participants_program_id ON v2_participants(program_id);

--------------------------------------------------------------------------------
-- 4. GROUPS (TEAMS)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS v2_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES v2_programs(id) ON DELETE CASCADE,
    project_id UUID REFERENCES v2_projects(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    project_description TEXT,
    demo_link TEXT,
    resources_link TEXT,
    pitch_deck_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS v2_group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES v2_groups(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES v2_participants(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member', -- member, lead
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(group_id, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_v2_groups_program_id ON v2_groups(program_id);

--------------------------------------------------------------------------------
-- 5. CONTENT & GATING (SESSIONS, DELIVERABLES, SUBMISSIONS)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS v2_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES v2_programs(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL,
    type TEXT NOT NULL, -- Masterclass, Workshop
    title TEXT NOT NULL,
    teacher_id TEXT, -- User ID of the assigned staff/teacher
    start_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS v2_deliverables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES v2_programs(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    due_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS v2_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES v2_programs(id) ON DELETE CASCADE,
    group_id UUID REFERENCES v2_groups(id) ON DELETE CASCADE,
    participant_id UUID REFERENCES v2_participants(id) ON DELETE CASCADE,
    deliverable_id UUID NOT NULL REFERENCES v2_deliverables(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, revision_requested
    feedback TEXT,
    teacher_id TEXT, -- User ID of the reviewer
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_v2_submissions_program_id ON v2_submissions(program_id);
CREATE INDEX IF NOT EXISTS idx_v2_submissions_group_id ON v2_submissions(group_id);

--------------------------------------------------------------------------------
-- 6. PROGRESS & FEEDBACK
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS v2_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_id UUID NOT NULL REFERENCES v2_participants(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES v2_programs(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL,
    completion_percentage DECIMAL(5,2) DEFAULT 0.00,
    status TEXT DEFAULT 'locked', -- locked, current, completed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(participant_id, program_id, week_number)
);

CREATE TABLE IF NOT EXISTS v2_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES v2_programs(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES v2_participants(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL,
    learnings TEXT,
    accomplishments TEXT,
    suggestions TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_v2_progress_program_id ON v2_progress(program_id);
CREATE INDEX IF NOT EXISTS idx_v2_feedback_program_id ON v2_feedback(program_id);

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
    start_date DATE,
    end_date DATE,
    feedback_enabled BOOLEAN DEFAULT true,
    grading_mode TEXT NOT NULL DEFAULT 'graded' CHECK (grading_mode IN ('graded', 'review', 'followup')),
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
    notion_page_id TEXT,
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

--------------------------------------------------------------------------------
-- 7. USERS & AUTHENTICATION
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contacts (
    cid TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    address TEXT,
    dob TEXT,
    gender TEXT,
    mother_name TEXT,
    group_name TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'participant',
    password TEXT NOT NULL,
    program_id TEXT,
    program_name TEXT,
    image TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    deleted INTEGER NOT NULL DEFAULT 0,
    language TEXT DEFAULT 'en',
    v2_team_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS user_sessions (
    token TEXT PRIMARY KEY,
    user_cid TEXT NOT NULL REFERENCES contacts(cid) ON DELETE CASCADE,
    role TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_cid);

--------------------------------------------------------------------------------
-- 8. TASKS & BLOCKERS
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    project_id INTEGER,
    category TEXT,
    created_week INTEGER NOT NULL,
    created_year INTEGER NOT NULL,
    carried_over_from_task_id INTEGER,
    parent_task_id INTEGER,
    start_date DATE,
    end_date DATE,
    assigned_to TEXT,
    first_scheduled_start_date DATE,
    first_scheduled_end_date DATE,
    reschedule_count INTEGER DEFAULT 0,
    completed_at TIMESTAMP WITH TIME ZONE,
    notion_page_id TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

CREATE TABLE IF NOT EXISTS blockers (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'active',
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_blockers_task_id ON blockers(task_id);
CREATE INDEX IF NOT EXISTS idx_blockers_status ON blockers(status);

--------------------------------------------------------------------------------
-- 9. OPERATIONAL REPORTS (STANDUPS & RETROS)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS v2_op_reports (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL DEFAULT '',
    user_role TEXT NOT NULL DEFAULT 'staff',
    report_type TEXT NOT NULL,
    week_number INTEGER NOT NULL,
    year INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    -- Legacy standup fields
    weekly_priorities TEXT,
    key_deliverables TEXT,
    risks_blockers TEXT,
    additional_notes TEXT,
    -- Structured standup fields
    top_priorities TEXT,
    expected_deliverables TEXT,
    projects_tasks TEXT,
    has_dependencies INTEGER,
    dependency_note TEXT,
    has_blockers INTEGER,
    blocker_description TEXT,
    needs_support INTEGER,
    support_note TEXT,
    -- Retro fields
    completed_work TEXT,
    unfinished_tasks TEXT,
    challenges TEXT,
    wins TEXT,
    carryover_items TEXT,
    week_status TEXT,
    retro_notes TEXT,
    had_blockers INTEGER,
    blocker_type TEXT,
    blocker_desc TEXT,
    major_achievement TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_op_reports_user_week ON v2_op_reports(user_id, week_number, year, report_type);

--------------------------------------------------------------------------------
-- 10. KNOWLEDGE BANK
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS v2_knowledge_bank (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    url TEXT NOT NULL DEFAULT '[]',
    is_archived INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS v2_knowledge_attachments (
    id SERIAL PRIMARY KEY,
    note_id INTEGER NOT NULL REFERENCES v2_knowledge_bank(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_knowledge_attachments_note_id ON v2_knowledge_attachments(note_id);

--------------------------------------------------------------------------------
-- 11. TEAMS
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS v2_teams (
    id TEXT PRIMARY KEY,
    program_id UUID NOT NULL REFERENCES v2_programs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    handler_id TEXT,
    handler_name TEXT,
    password TEXT NOT NULL,
    team_username TEXT NOT NULL UNIQUE,
    group_name TEXT,
    leader_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_v2_teams_program_id ON v2_teams(program_id);

--------------------------------------------------------------------------------
-- 12. KPIs, EVENTS, DOCUMENTS, FOLLOWUPS
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS v2_kpis (
    id SERIAL PRIMARY KEY,
    program_id UUID NOT NULL REFERENCES v2_programs(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    target_value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_v2_kpis_program_id ON v2_kpis(program_id);

CREATE TABLE IF NOT EXISTS v2_events (
    id SERIAL PRIMARY KEY,
    program_id UUID NOT NULL REFERENCES v2_programs(id) ON DELETE CASCADE,
    team_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    event_type TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    location TEXT,
    created_by TEXT,
    participant_id TEXT,
    external_calendar_id TEXT,
    external_calendar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_v2_events_program_id ON v2_events(program_id);

--------------------------------------------------------------------------------
-- 7b. ERROR LOGS (Developer Tool)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS error_logs (
    id SERIAL PRIMARY KEY,
    message TEXT NOT NULL,
    stack TEXT,
    url TEXT,
    user_id TEXT,
    user_agent TEXT,
    severity TEXT DEFAULT 'error' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    status_code INTEGER,
    method TEXT,
    endpoint TEXT,
    request_body TEXT,
    resolved BOOLEAN DEFAULT false,
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON error_logs(resolved);
CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at);

CREATE TABLE IF NOT EXISTS v2_document_requirements (
    id SERIAL PRIMARY KEY,
    program_id UUID NOT NULL REFERENCES v2_programs(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    is_completed INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_v2_documents_program_id ON v2_document_requirements(program_id);

CREATE TABLE IF NOT EXISTS v2_followups (
    id SERIAL PRIMARY KEY,
    program_id UUID NOT NULL REFERENCES v2_programs(id) ON DELETE CASCADE,
    week_number INTEGER,
    session_id INTEGER,
    comment TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_v2_followups_program_id ON v2_followups(program_id);

--------------------------------------------------------------------------------
-- 13. AUDIT & ACTIVITY LOGS
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL DEFAULT '',
    action TEXT NOT NULL,
    details TEXT,
    metadata TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);

CREATE TABLE IF NOT EXISTS task_assignment_log (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL,
    project_id INTEGER,
    actor_id TEXT NOT NULL,
    target_user_id TEXT,
    action_type TEXT NOT NULL,
    previous_state TEXT,
    new_state TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_task_log_task_id ON task_assignment_log(task_id);

CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    user_identity TEXT NOT NULL,
    action TEXT NOT NULL,
    module TEXT,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);

--------------------------------------------------------------------------------
-- 14. PROGRAM STAFF ASSIGNMENTS
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS v2_program_staff (
    id SERIAL PRIMARY KEY,
    program_id UUID NOT NULL REFERENCES v2_programs(id) ON DELETE CASCADE,
    staff_id TEXT NOT NULL,
    role TEXT DEFAULT 'staff',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(program_id, staff_id)
);

CREATE INDEX IF NOT EXISTS idx_v2_program_staff_program ON v2_program_staff(program_id);

--------------------------------------------------------------------------------
-- 15. WEEKLY REPORTS (TEACHER/PM)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS v2_weekly_reports (
    id SERIAL PRIMARY KEY,
    program_id UUID NOT NULL REFERENCES v2_programs(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL,
    teacher_id TEXT,
    teacher_name TEXT,
    reception_score TEXT,
    progress_notes TEXT,
    student_reception TEXT,
    action_taken TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(program_id, week_number, teacher_id)
);

CREATE INDEX IF NOT EXISTS idx_v2_weekly_reports_program ON v2_weekly_reports(program_id);

--------------------------------------------------------------------------------
-- 16. MESSAGING & NOTIFICATIONS
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS v2_messages (
    id SERIAL PRIMARY KEY,
    sender_id TEXT NOT NULL,
    recipient_id TEXT,
    target_type TEXT DEFAULT 'individual',
    target_id TEXT,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    priority TEXT DEFAULT 'normal',
    is_read INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_v2_messages_sender ON v2_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_v2_messages_recipient ON v2_messages(recipient_id);

CREATE TABLE IF NOT EXISTS v2_notifications (
    id SERIAL PRIMARY KEY,
    recipient_id TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'message',
    is_read INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_v2_notifications_recipient ON v2_notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_v2_notifications_unread ON v2_notifications(recipient_id, is_read);

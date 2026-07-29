-- =============================================================================
-- IMPACTOS — VENTURE OS PROJECT TIMELINE & PROGRESS TRACKING
-- Enhancement 2.4 — Timeline & Progress
-- =============================================================================

-- Task/Milestone dependencies
CREATE TABLE IF NOT EXISTS venture_dependencies (
    id SERIAL PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
    source_type TEXT NOT NULL,
    source_id INTEGER NOT NULL,
    target_type TEXT NOT NULL,
    target_id INTEGER NOT NULL,
    dependency_type TEXT DEFAULT 'finish_to_start',
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(venture_id, source_type, source_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_dependencies_source ON venture_dependencies(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_dependencies_target ON venture_dependencies(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_dependencies_venture ON venture_dependencies(venture_id);

-- Timeline events (for Gantt rendering)
CREATE TABLE IF NOT EXISTS venture_timeline_events (
    id SERIAL PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    reference_type TEXT,
    reference_id INTEGER,
    title TEXT NOT NULL,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    progress INTEGER DEFAULT 0,
    status TEXT,
    parent_id INTEGER,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timeline_events_venture ON venture_timeline_events(venture_id);

-- =============================================================================
-- IMPACTOS — VENTURE OS COACH & MENTOR MANAGEMENT
-- Enhancement 3.1 — Coach & Mentor Management
-- =============================================================================

CREATE TABLE IF NOT EXISTS venture_coaches (
    id SERIAL PRIMARY KEY,
    coach_type TEXT NOT NULL DEFAULT 'coach',
    full_name TEXT NOT NULL,
    photo_url TEXT,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    organization TEXT,
    biography TEXT,
    years_experience INTEGER,
    areas_of_expertise JSONB DEFAULT '[]'::jsonb,
    industries JSONB DEFAULT '[]'::jsonb,
    languages JSONB DEFAULT '[]'::jsonb,
    availability TEXT DEFAULT 'available',
    timezone TEXT DEFAULT 'UTC',
    linkedin_url TEXT,
    website_url TEXT,
    status TEXT DEFAULT 'active',
    created_by TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venture_coaches_type ON venture_coaches(coach_type);
CREATE INDEX IF NOT EXISTS idx_venture_coaches_status ON venture_coaches(status);
CREATE INDEX IF NOT EXISTS idx_venture_coaches_email ON venture_coaches(email);

CREATE TABLE IF NOT EXISTS venture_coach_assignments (
    id SERIAL PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
    coach_id INTEGER NOT NULL REFERENCES venture_coaches(id) ON DELETE CASCADE,
    coach_type TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'active',
    assigned_by TEXT,
    assignment_date TIMESTAMP DEFAULT NOW(),
    notes TEXT,
    UNIQUE(venture_id, coach_id)
);

CREATE INDEX IF NOT EXISTS idx_coach_assignments_venture ON venture_coach_assignments(venture_id);
CREATE INDEX IF NOT EXISTS idx_coach_assignments_coach ON venture_coach_assignments(coach_id);

CREATE TABLE IF NOT EXISTS venture_coach_availability (
    id SERIAL PRIMARY KEY,
    coach_id INTEGER NOT NULL REFERENCES venture_coaches(id) ON DELETE CASCADE,
    day_of_week INTEGER,
    start_time TIME,
    end_time TIME,
    date DATE,
    is_available BOOLEAN DEFAULT TRUE,
    note TEXT,
    UNIQUE(coach_id, date, day_of_week, start_time)
);

CREATE INDEX IF NOT EXISTS idx_coach_availability_coach ON venture_coach_availability(coach_id);

CREATE TABLE IF NOT EXISTS venture_coach_activity (
    id SERIAL PRIMARY KEY,
    coach_id INTEGER REFERENCES venture_coaches(id) ON DELETE SET NULL,
    venture_id TEXT REFERENCES ventures(venture_id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    actor_cid TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coach_activity_coach ON venture_coach_activity(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_activity_venture ON venture_coach_activity(venture_id);

-- =============================================================================
-- IMPACTOS — VENTURE OS MENTORING SESSIONS & SCHEDULING
-- Enhancement 3.2 — Mentoring Sessions & Scheduling
-- =============================================================================

CREATE TABLE IF NOT EXISTS venture_sessions (
    id SERIAL PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    session_type TEXT NOT NULL DEFAULT 'coaching',
    coach_id INTEGER REFERENCES venture_coaches(id) ON DELETE SET NULL,
    coach_name TEXT,
    founder_cid TEXT,
    founder_name TEXT,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    timezone TEXT DEFAULT 'UTC',
    location TEXT,
    meeting_link TEXT,
    status TEXT DEFAULT 'scheduled',
    agenda TEXT,
    recording_url TEXT,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_venture ON venture_sessions(venture_id);
CREATE INDEX IF NOT EXISTS idx_sessions_coach ON venture_sessions(coach_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON venture_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_start ON venture_sessions(start_time);

CREATE TABLE IF NOT EXISTS venture_session_notes (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES venture_sessions(id) ON DELETE CASCADE,
    note_type TEXT DEFAULT 'shared',
    content TEXT NOT NULL,
    author_cid TEXT,
    author_name TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_notes_session ON venture_session_notes(session_id);

CREATE TABLE IF NOT EXISTS venture_session_attendance (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES venture_sessions(id) ON DELETE CASCADE,
    participant_cid TEXT NOT NULL,
    participant_name TEXT,
    participant_type TEXT,
    status TEXT DEFAULT 'pending',
    timestamp TIMESTAMP DEFAULT NOW(),
    UNIQUE(session_id, participant_cid)
);

CREATE INDEX IF NOT EXISTS idx_session_attendance_session ON venture_session_attendance(session_id);

CREATE TABLE IF NOT EXISTS venture_session_action_items (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES venture_sessions(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    owner_cid TEXT,
    owner_name TEXT,
    priority TEXT DEFAULT 'medium',
    due_date TIMESTAMP,
    status TEXT DEFAULT 'pending',
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_action_items_session ON venture_session_action_items(session_id);

CREATE TABLE IF NOT EXISTS venture_session_activity (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES venture_sessions(id) ON DELETE CASCADE,
    venture_id TEXT REFERENCES ventures(venture_id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    actor_cid TEXT,
    actor_name TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_activity_session ON venture_session_activity(session_id);
CREATE INDEX IF NOT EXISTS idx_session_activity_venture ON venture_session_activity(venture_id);

-- =============================================================================
-- IMPACTOS — VENTURE OS KNOWLEDGE HUB & LEARNING RESOURCES
-- Enhancement 3.3 — Knowledge Hub
-- =============================================================================

CREATE TABLE IF NOT EXISTS knowledge_categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS knowledge_resources (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    resource_type TEXT NOT NULL,
    category_id INTEGER REFERENCES knowledge_categories(id) ON DELETE SET NULL,
    category_name TEXT,
    url TEXT,
    content TEXT,
    file_url TEXT,
    file_size BIGINT,
    file_type TEXT,
    estimated_minutes INTEGER,
    author_name TEXT,
    author_cid TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    view_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'published',
    is_featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resources_category ON knowledge_resources(category_id);
CREATE INDEX IF NOT EXISTS idx_resources_type ON knowledge_resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_resources_status ON knowledge_resources(status);
CREATE INDEX IF NOT EXISTS idx_resources_featured ON knowledge_resources(is_featured);

CREATE TABLE IF NOT EXISTS knowledge_bookmarks (
    id SERIAL PRIMARY KEY,
    resource_id INTEGER NOT NULL REFERENCES knowledge_resources(id) ON DELETE CASCADE,
    user_cid TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(resource_id, user_cid)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON knowledge_bookmarks(user_cid);

CREATE TABLE IF NOT EXISTS knowledge_progress (
    id SERIAL PRIMARY KEY,
    resource_id INTEGER NOT NULL REFERENCES knowledge_resources(id) ON DELETE CASCADE,
    user_cid TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    last_viewed_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(resource_id, user_cid)
);

CREATE INDEX IF NOT EXISTS idx_progress_user ON knowledge_progress(user_cid);

CREATE TABLE IF NOT EXISTS knowledge_activity (
    id SERIAL PRIMARY KEY,
    resource_id INTEGER REFERENCES knowledge_resources(id) ON DELETE SET NULL,
    user_cid TEXT,
    action TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_activity_user ON knowledge_activity(user_cid);

INSERT INTO knowledge_categories (name, slug, description, display_order) VALUES
    ('Funding', 'funding', 'Fundraising, grants, and investment strategies', 1),
    ('Marketing', 'marketing', 'Branding, growth, and customer acquisition', 2),
    ('Sales', 'sales', 'Sales strategies and pipeline management', 3),
    ('Legal', 'legal', 'Legal compliance, contracts, and IP', 4),
    ('Finance', 'finance', 'Financial management and planning', 5),
    ('Technology', 'technology', 'Tech stack, development, and architecture', 6),
    ('Operations', 'operations', 'Business operations and processes', 7),
    ('HR', 'hr', 'People management and company culture', 8),
    ('Product', 'product', 'Product development and management', 9),
    ('Growth', 'growth', 'Scaling and business development', 10)
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- IMPACTOS — VENTURE OS MENTOR PERFORMANCE, FEEDBACK & ANALYTICS
-- Enhancement 3.5 — Feedback & Analytics
-- =============================================================================

CREATE TABLE IF NOT EXISTS venture_mentor_feedback (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES venture_sessions(id) ON DELETE CASCADE,
    venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
    coach_id INTEGER REFERENCES venture_coaches(id) ON DELETE SET NULL,
    founder_cid TEXT,
    rating_overall INTEGER NOT NULL CHECK (rating_overall >= 1 AND rating_overall <= 5),
    rating_communication INTEGER CHECK (rating_communication >= 1 AND rating_communication <= 5),
    rating_expertise INTEGER CHECK (rating_expertise >= 1 AND rating_expertise <= 5),
    rating_availability INTEGER CHECK (rating_availability >= 1 AND rating_availability <= 5),
    rating_helpfulness INTEGER CHECK (rating_helpfulness >= 1 AND rating_helpfulness <= 5),
    comments TEXT,
    is_anonymous BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(session_id, coach_id)
);

CREATE INDEX IF NOT EXISTS idx_feedback_coach ON venture_mentor_feedback(coach_id);
CREATE INDEX IF NOT EXISTS idx_feedback_session ON venture_mentor_feedback(session_id);
CREATE INDEX IF NOT EXISTS idx_feedback_venture ON venture_mentor_feedback(venture_id);

CREATE TABLE IF NOT EXISTS venture_mentor_analytics (
    id SERIAL PRIMARY KEY,
    coach_id INTEGER NOT NULL UNIQUE REFERENCES venture_coaches(id) ON DELETE CASCADE,
    coach_type TEXT NOT NULL,
    average_rating DECIMAL(3,2) DEFAULT 0,
    sessions_completed INTEGER DEFAULT 0,
    attendance_rate DECIMAL(5,2) DEFAULT 0,
    cancellation_rate DECIMAL(5,2) DEFAULT 0,
    assigned_ventures INTEGER DEFAULT 0,
    completed_action_items INTEGER DEFAULT 0,
    mentoring_hours DECIMAL(8,2) DEFAULT 0,
    founder_satisfaction DECIMAL(3,2) DEFAULT 0,
    engagement_score DECIMAL(5,2) DEFAULT 0,
    last_calculated TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mentor_analytics_coach ON venture_mentor_analytics(coach_id);

CREATE TABLE IF NOT EXISTS venture_feedback_activity (
    id SERIAL PRIMARY KEY,
    feedback_id INTEGER REFERENCES venture_mentor_feedback(id) ON DELETE SET NULL,
    coach_id INTEGER REFERENCES venture_coaches(id) ON DELETE SET NULL,
    venture_id TEXT REFERENCES ventures(venture_id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    actor_cid TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);

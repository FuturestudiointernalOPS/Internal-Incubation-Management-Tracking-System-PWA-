-- =============================================================================
-- IMPACTOS — VENTURE OS COACH & MENTOR MANAGEMENT
-- Enhancement 3.1 — Coach & Mentor Management
-- =============================================================================

-- Coaches table (includes both coaches and advisors)
CREATE TABLE IF NOT EXISTS venture_coaches (
    id SERIAL PRIMARY KEY,
    coach_type TEXT NOT NULL DEFAULT 'coach', -- 'coach' or 'advisor'
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
    availability TEXT DEFAULT 'available', -- available | busy | on_leave | inactive
    timezone TEXT DEFAULT 'UTC',
    linkedin_url TEXT,
    website_url TEXT,
    status TEXT DEFAULT 'active', -- active | inactive
    created_by TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venture_coaches_type ON venture_coaches(coach_type);
CREATE INDEX IF NOT EXISTS idx_venture_coaches_status ON venture_coaches(status);
CREATE INDEX IF NOT EXISTS idx_venture_coaches_email ON venture_coaches(email);

-- Coach-Venture assignments
CREATE TABLE IF NOT EXISTS venture_coach_assignments (
    id SERIAL PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
    coach_id INTEGER NOT NULL REFERENCES venture_coaches(id) ON DELETE CASCADE,
    coach_type TEXT NOT NULL, -- 'coach' or 'advisor'
    is_primary BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'active', -- active | completed | removed
    assigned_by TEXT,
    assignment_date TIMESTAMP DEFAULT NOW(),
    notes TEXT,
    UNIQUE(venture_id, coach_id)
);

CREATE INDEX IF NOT EXISTS idx_coach_assignments_venture ON venture_coach_assignments(venture_id);
CREATE INDEX IF NOT EXISTS idx_coach_assignments_coach ON venture_coach_assignments(coach_id);

-- Coach availability calendar
CREATE TABLE IF NOT EXISTS venture_coach_availability (
    id SERIAL PRIMARY KEY,
    coach_id INTEGER NOT NULL REFERENCES venture_coaches(id) ON DELETE CASCADE,
    day_of_week INTEGER, -- 0=Sun, 1=Mon, etc.
    start_time TIME,
    end_time TIME,
    date DATE, -- specific date override
    is_available BOOLEAN DEFAULT TRUE,
    note TEXT,
    UNIQUE(coach_id, date, day_of_week, start_time)
);

CREATE INDEX IF NOT EXISTS idx_coach_availability_coach ON venture_coach_availability(coach_id);

-- Coach activity log
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

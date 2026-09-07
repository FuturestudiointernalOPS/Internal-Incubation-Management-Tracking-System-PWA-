-- =============================================================================
-- IMPACTOS — VENTURE OS KNOWLEDGE HUB & LEARNING RESOURCES
-- Enhancement 3.3 — Knowledge Hub
-- =============================================================================

-- Knowledge categories
CREATE TABLE IF NOT EXISTS knowledge_categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Knowledge resources
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
CREATE INDEX IF NOT EXISTS idx_resources_title ON knowledge_resources USING gin(to_tsvector('english', title));

-- Bookmarks
CREATE TABLE IF NOT EXISTS knowledge_bookmarks (
    id SERIAL PRIMARY KEY,
    resource_id INTEGER NOT NULL REFERENCES knowledge_resources(id) ON DELETE CASCADE,
    user_cid TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(resource_id, user_cid)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON knowledge_bookmarks(user_cid);

-- Progress / completion tracking
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

-- Activity log
CREATE TABLE IF NOT EXISTS knowledge_activity (
    id SERIAL PRIMARY KEY,
    resource_id INTEGER REFERENCES knowledge_resources(id) ON DELETE SET NULL,
    user_cid TEXT,
    action TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_activity_user ON knowledge_activity(user_cid);

-- Seed default categories
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

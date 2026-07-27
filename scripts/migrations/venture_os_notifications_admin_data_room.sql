-- =============================================================================
-- IMPACTOS — VENTURE OS NOTIFICATION CENTER & COMMUNICATION
-- Enhancement 5.2 — Notification Center
-- =============================================================================

CREATE TABLE IF NOT EXISTS venture_notifications (
    id SERIAL PRIMARY KEY,
    recipient_id TEXT NOT NULL,
    recipient_type TEXT DEFAULT 'user',
    venture_id TEXT REFERENCES ventures(venture_id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'system',
    title TEXT NOT NULL,
    body TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'unread',
    priority TEXT DEFAULT 'normal',
    source TEXT,
    source_id TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    read_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_venture_notifications_recipient ON venture_notifications(recipient_id, status);
CREATE INDEX IF NOT EXISTS idx_venture_notifications_type ON venture_notifications(type);
CREATE INDEX IF NOT EXISTS idx_venture_notifications_created ON venture_notifications(created_at DESC);

CREATE TABLE IF NOT EXISTS venture_notification_templates (
    id SERIAL PRIMARY KEY,
    template_key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'system',
    title_template TEXT NOT NULL,
    body_template TEXT,
    channels JSONB DEFAULT '["in_app"]'::jsonb,
    variables JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS venture_notification_preferences (
    id SERIAL PRIMARY KEY,
    user_cid TEXT NOT NULL UNIQUE,
    email TEXT,
    phone TEXT,
    preferences JSONB DEFAULT '{}'::jsonb,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    digest_frequency TEXT DEFAULT 'realtime',
    language TEXT DEFAULT 'en',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS venture_notification_delivery_logs (
    id SERIAL PRIMARY KEY,
    notification_id INTEGER REFERENCES venture_notifications(id) ON DELETE CASCADE,
    channel TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    error_message TEXT,
    delivered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO venture_notification_templates (template_key, name, type, title_template, body_template, channels, variables) VALUES
    ('welcome', 'Welcome Notification', 'system', 'Welcome to {{platform_name}}', 'Hello {{user_name}}, welcome to {{platform_name}}!', '["in_app","email"]', '["platform_name","user_name"]'),
    ('venture_created', 'Venture Created', 'system', 'Venture Created Successfully', 'Your venture "{{company_name}}" has been created ({{venture_id}}).', '["in_app","email"]', '["company_name","venture_id"]'),
    ('milestone_completed', 'Milestone Completed', 'project', 'Milestone Completed', 'Milestone "{{milestone_title}}" has been completed.', '["in_app"]', '["milestone_title"]'),
    ('task_assigned', 'Task Assigned', 'project', 'New Task Assigned', 'You have been assigned to task "{{task_title}}".', '["in_app","email"]', '["task_title"]'),
    ('session_scheduled', 'Session Scheduled', 'mentoring', 'Mentoring Session Scheduled', 'A {{session_type}} session has been scheduled for {{date}}.', '["in_app","email"]', '["session_type","date"]'),
    ('session_reminder', 'Session Reminder', 'mentoring', 'Session Starting Soon', 'Your {{session_type}} session starts in 15 minutes.', '["in_app","email"]', '["session_type"]'),
    ('feedback_received', 'Feedback Received', 'mentoring', 'New Feedback Received', 'You received a {{rating}}/5 rating from a mentoring session.', '["in_app"]', '["rating"]'),
    ('investment_score_updated', 'Investment Score Updated', 'investment', 'Investment Score Updated', 'Your investment readiness score is now {{score}}%.', '["in_app"]', '["score"]'),
    ('investor_match', 'Investor Match', 'investment', 'New Investor Match', 'You have a new investor match with {{investor_name}} ({{score}}% match).', '["in_app","email"]', '["investor_name","score"]'),
    ('document_shared', 'Document Shared', 'investment', 'Document Shared', 'Document "{{document_title}}" has been shared with {{recipient_email}}.', '["in_app"]', '["document_title","recipient_email"]'),
    ('verification_approved', 'Verification Approved', 'verification', 'Verification Approved', 'Your {{category}} verification has been approved.', '["in_app","email"]', '["category"]'),
    ('verification_rejected', 'Verification Rejected', 'verification', 'Verification Rejected', 'Your {{category}} verification was rejected. Reason: {{reason}}.', '["in_app","email"]', '["category","reason"]'),
    ('deadline_approaching', 'Deadline Approaching', 'project', 'Deadline Approaching', 'Task "{{task_title}}" is due in {{days}} day(s).', '["in_app","email"]', '["task_title","days"]'),
    ('announcement', 'Announcement', 'announcements', '{{title}}', '{{message}}', '["in_app","email"]', '["title","message"]')
ON CONFLICT (template_key) DO NOTHING;

-- =============================================================================
-- IMPACTOS — VENTURE OS ADMINISTRATION & SYSTEM CONFIGURATION
-- Enhancement 5.1 — Admin & System Configuration
-- =============================================================================

CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    setting_key TEXT NOT NULL UNIQUE,
    setting_value TEXT,
    setting_type TEXT DEFAULT 'string',
    category TEXT DEFAULT 'general',
    description TEXT,
    is_encrypted BOOLEAN DEFAULT FALSE,
    updated_by TEXT,
    updated_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feature_flags (
    id SERIAL PRIMARY KEY,
    flag_key TEXT NOT NULL UNIQUE,
    flag_name TEXT NOT NULL,
    description TEXT,
    is_enabled BOOLEAN DEFAULT TRUE,
    category TEXT DEFAULT 'general',
    updated_by TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_roles (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    permissions JSONB DEFAULT '{}'::jsonb,
    is_system_role BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_activity_logs (
    id SERIAL PRIMARY KEY,
    admin_cid TEXT NOT NULL,
    admin_name TEXT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_admin ON admin_activity_logs(admin_cid);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON admin_activity_logs(action);

INSERT INTO system_settings (setting_key, setting_value, setting_type, category, description) VALUES
    ('platform_name', 'ImpactOS', 'string', 'general', 'Platform display name'),
    ('platform_logo_url', '', 'string', 'branding', 'Platform logo URL'),
    ('platform_favicon_url', '', 'string', 'branding', 'Platform favicon URL'),
    ('organization_name', 'Future Studio', 'string', 'organization', 'Organization name'),
    ('default_timezone', 'UTC', 'string', 'localization', 'Default timezone'),
    ('default_language', 'en', 'string', 'localization', 'Default language'),
    ('default_currency', 'USD', 'string', 'localization', 'Default currency'),
    ('default_country', '', 'string', 'localization', 'Default country'),
    ('max_file_upload_size_mb', '50', 'integer', 'storage', 'Maximum file upload size in MB'),
    ('allowed_file_types', 'pdf,png,jpg,jpeg,doc,docx,xls,xlsx,ppt,pptx', 'string', 'storage', 'Comma-separated allowed file extensions'),
    ('password_min_length', '8', 'integer', 'authentication', 'Minimum password length'),
    ('session_timeout_minutes', '480', 'integer', 'authentication', 'Session timeout in minutes'),
    ('maintenance_mode', 'false', 'boolean', 'general', 'Enable maintenance mode'),
    ('invitation_expiration_hours', '72', 'integer', 'authentication', 'Invitation link expiration in hours')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO feature_flags (flag_key, flag_name, description, category, is_enabled) VALUES
    ('knowledge_hub', 'Knowledge Hub', 'Enable the Knowledge Hub module', 'learning', TRUE),
    ('investment_module', 'Investment Module', 'Enable investment readiness and investor matching', 'investment', TRUE),
    ('mentoring', 'Mentoring', 'Enable mentoring sessions and coach management', 'mentoring', TRUE),
    ('projects', 'Projects', 'Enable project management features', 'projects', TRUE),
    ('notifications', 'Notifications', 'Enable notification system', 'system', TRUE),
    ('analytics', 'Analytics', 'Enable analytics and reporting', 'analytics', TRUE),
    ('data_room', 'Data Room', 'Enable secure document sharing', 'investment', TRUE),
    ('fundraising_pipeline', 'Fundraising Pipeline', 'Enable fundraising opportunity tracking', 'investment', TRUE)
ON CONFLICT (flag_key) DO NOTHING;

-- =============================================================================
-- IMPACTOS — VENTURE OS FUNDRAISING PIPELINE
-- Enhancement 4.4 — Fundraising Pipeline
-- =============================================================================

CREATE TABLE IF NOT EXISTS fundraising_opportunities (
    id SERIAL PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
    investor_id INTEGER,
    investor_name TEXT,
    investor_email TEXT,
    stage TEXT NOT NULL DEFAULT 'prospect',
    expected_amount DECIMAL(14,2),
    currency TEXT DEFAULT 'USD',
    probability INTEGER DEFAULT 10,
    expected_close_date DATE,
    owner_cid TEXT,
    owner_name TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    next_action TEXT,
    next_action_date TIMESTAMP,
    notes_summary TEXT,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fundraising_venture ON fundraising_opportunities(venture_id);
CREATE INDEX IF NOT EXISTS idx_fundraising_stage ON fundraising_opportunities(stage);

CREATE TABLE IF NOT EXISTS fundraising_stage_history (
    id SERIAL PRIMARY KEY,
    opportunity_id INTEGER NOT NULL REFERENCES fundraising_opportunities(id) ON DELETE CASCADE,
    previous_stage TEXT,
    new_stage TEXT NOT NULL,
    probability INTEGER,
    changed_by TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stage_history_opp ON fundraising_stage_history(opportunity_id);

CREATE TABLE IF NOT EXISTS fundraising_activities (
    id SERIAL PRIMARY KEY,
    opportunity_id INTEGER NOT NULL REFERENCES fundraising_opportunities(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    activity_date TIMESTAMP DEFAULT NOW(),
    completed BOOLEAN DEFAULT FALSE,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fundraising_activities_opp ON fundraising_activities(opportunity_id);

CREATE TABLE IF NOT EXISTS fundraising_notes (
    id SERIAL PRIMARY KEY,
    opportunity_id INTEGER NOT NULL REFERENCES fundraising_opportunities(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    author_cid TEXT,
    author_name TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fundraising_notes_opp ON fundraising_notes(opportunity_id);

-- =============================================================================
-- IMPACTOS — VENTURE OS PITCH DECK & DATA ROOM MANAGEMENT
-- Enhancement 4.3 — Data Room
-- =============================================================================

CREATE TABLE IF NOT EXISTS venture_documents (
    id SERIAL PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    document_type TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',
    file_name TEXT NOT NULL,
    file_size BIGINT,
    file_type TEXT,
    file_url TEXT NOT NULL,
    thumbnail_url TEXT,
    current_version INTEGER DEFAULT 1,
    is_pitch_deck BOOLEAN DEFAULT FALSE,
    uploaded_by TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venture_documents_venture ON venture_documents(venture_id);
CREATE INDEX IF NOT EXISTS idx_venture_documents_type ON venture_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_venture_documents_pitch ON venture_documents(is_pitch_deck);

CREATE TABLE IF NOT EXISTS venture_document_versions (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES venture_documents(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    file_name TEXT NOT NULL,
    file_size BIGINT,
    file_url TEXT NOT NULL,
    uploaded_by TEXT,
    change_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(document_id, version)
);

CREATE INDEX IF NOT EXISTS idx_doc_versions_document ON venture_document_versions(document_id);

CREATE TABLE IF NOT EXISTS venture_document_shares (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES venture_documents(id) ON DELETE CASCADE,
    venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
    share_token TEXT NOT NULL UNIQUE,
    shared_with_email TEXT,
    shared_with_name TEXT,
    access_type TEXT DEFAULT 'read',
    password_hash TEXT,
    expires_at TIMESTAMP,
    max_downloads INTEGER,
    download_count INTEGER DEFAULT 0,
    is_revoked BOOLEAN DEFAULT FALSE,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_shares_token ON venture_document_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_doc_shares_document ON venture_document_shares(document_id);

CREATE TABLE IF NOT EXISTS venture_document_access_logs (
    id SERIAL PRIMARY KEY,
    share_id INTEGER REFERENCES venture_document_shares(id) ON DELETE CASCADE,
    document_id INTEGER NOT NULL REFERENCES venture_documents(id) ON DELETE CASCADE,
    venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
    access_type TEXT NOT NULL,
    viewer_email TEXT,
    viewer_name TEXT,
    ip_address TEXT,
    user_agent TEXT,
    duration_seconds INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_access_logs_document ON venture_document_access_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_access_logs_share ON venture_document_access_logs(share_id);

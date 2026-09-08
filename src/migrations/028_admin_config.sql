-- =============================================================================
-- IMPACTOS — VENTURE OS ADMINISTRATION & SYSTEM CONFIGURATION
-- Enhancement 5.1 — Admin & System Configuration
-- =============================================================================

-- System settings (key-value store)
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

-- Feature flags
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

-- Role definitions
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

-- Admin activity logs
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

-- Seed default settings
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

-- Seed default feature flags
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

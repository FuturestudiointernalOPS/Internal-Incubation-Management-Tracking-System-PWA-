-- =============================================================================
-- IMPACTOS — VENTURE OS AUDIT LOGS & SECURITY
-- Enhancement 5.3 — Audit Logs & Security
-- =============================================================================

-- Audit log (immutable, append-only event store)
CREATE TABLE IF NOT EXISTS venture_audit_logs (
    id SERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    actor_cid TEXT NOT NULL,
    actor_name TEXT,
    actor_role TEXT,
    venture_id TEXT,
    entity_type TEXT,
    entity_id TEXT,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    user_agent TEXT,
    session_id TEXT,
    severity TEXT DEFAULT 'info', -- info | warning | error | critical
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venture_audit_logs_event_type ON venture_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_venture_audit_logs_actor ON venture_audit_logs(actor_cid);
CREATE INDEX IF NOT EXISTS idx_venture_audit_logs_venture ON venture_audit_logs(venture_id);
CREATE INDEX IF NOT EXISTS idx_venture_audit_logs_created ON venture_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_venture_audit_logs_severity ON venture_audit_logs(severity);

-- Security events (suspicious activities, alerts)
CREATE TABLE IF NOT EXISTS venture_security_events (
    id SERIAL PRIMARY KEY,
    event_type TEXT NOT NULL, -- failed_login | suspicious_login | account_lockout | password_changed | role_changed | permission_change | api_abuse | export_generated
    actor_cid TEXT,
    actor_name TEXT,
    target_cid TEXT,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    user_agent TEXT,
    country TEXT,
    device TEXT,
    browser TEXT,
    os TEXT,
    severity TEXT DEFAULT 'warning', -- info | warning | critical
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_by TEXT,
    resolved_at TIMESTAMP,
    resolution_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venture_security_events_type ON venture_security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_venture_security_events_actor ON venture_security_events(actor_cid);
CREATE INDEX IF NOT EXISTS idx_venture_security_events_severity ON venture_security_events(severity);
CREATE INDEX IF NOT EXISTS idx_venture_security_events_created ON venture_security_events(created_at DESC);

-- User sessions (extends existing user_sessions with richer fields)
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS device TEXT;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS browser TEXT;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS os TEXT;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS logout_time TIMESTAMP;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS session_status TEXT DEFAULT 'active'; -- active | expired | revoked

-- Trusted devices
CREATE TABLE IF NOT EXISTS venture_trusted_devices (
    id SERIAL PRIMARY KEY,
    user_cid TEXT NOT NULL,
    device_name TEXT,
    device_type TEXT,
    browser TEXT,
    os TEXT,
    ip_address TEXT,
    fingerprint TEXT,
    is_trusted BOOLEAN DEFAULT FALSE,
    last_used_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_cid, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_venture_trusted_devices_user ON venture_trusted_devices(user_cid);

-- Login history
CREATE TABLE IF NOT EXISTS venture_login_history (
    id SERIAL PRIMARY KEY,
    user_cid TEXT,
    user_name TEXT,
    user_email TEXT,
    action TEXT NOT NULL, -- login | logout | login_failed | password_change
    ip_address TEXT,
    user_agent TEXT,
    device TEXT,
    browser TEXT,
    os TEXT,
    country TEXT,
    city TEXT,
    is_success BOOLEAN DEFAULT TRUE,
    failure_reason TEXT,
    session_id TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venture_login_history_user ON venture_login_history(user_cid);
CREATE INDEX IF NOT EXISTS idx_venture_login_history_action ON venture_login_history(action);
CREATE INDEX IF NOT EXISTS idx_venture_login_history_created ON venture_login_history(created_at DESC);

-- Failed login tracking (for lockout detection)
CREATE TABLE IF NOT EXISTS venture_failed_logins (
    id SERIAL PRIMARY KEY,
    identifier TEXT NOT NULL, -- email or cid
    ip_address TEXT,
    attempted_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venture_failed_logins_identifier ON venture_failed_logins(identifier);
CREATE INDEX IF NOT EXISTS idx_venture_failed_logins_ip ON venture_failed_logins(ip_address);

-- Seed default security notification templates
INSERT INTO venture_notification_templates (template_key, name, type, title_template, body_template, channels, variables) VALUES
    ('new_login', 'New Login Detected', 'security', 'New login from {{device}}', 'A new login was detected from {{device}} in {{country}} ({{ip_address}}). If this was not you, please secure your account.', '["in_app","email"]', '["device","country","ip_address"]'),
    ('suspicious_login', 'Suspicious Login Alert', 'security', '⚠️ Suspicious login detected', 'We detected a suspicious login attempt from {{ip_address}} ({{country}}). If this was you, please verify your account security.', '["in_app","email"]', '["ip_address","country"]'),
    ('password_changed', 'Password Changed', 'security', 'Your password was changed', 'Your account password was changed successfully. If you did not make this change, contact support immediately.', '["in_app","email"]', '[]'),
    ('session_revoked', 'Session Revoked', 'security', 'Session revoked: {{device}}', 'Your session on {{device}} ({{ip_address}}) has been revoked.', '["in_app"]', '["device","ip_address"]'),
    ('security_alert', 'Security Alert', 'security', 'Security alert: {{alert_type}}', '{{description}}', '["in_app","email"]', '["alert_type","description"]'),
    ('account_locked', 'Account Locked', 'security', 'Account temporarily locked', 'Your account has been temporarily locked due to multiple failed login attempts. Try again in 15 minutes.', '["in_app","email"]', '[]'),
    ('role_changed', 'Role Changed', 'security', 'Your role was updated', 'Your account role has been changed to {{new_role}}.', '["in_app","email"]', '["new_role"]')
ON CONFLICT (template_key) DO NOTHING;

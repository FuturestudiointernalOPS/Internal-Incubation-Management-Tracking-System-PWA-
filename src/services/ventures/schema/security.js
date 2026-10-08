/**
 * Verification, audit & security, user sessions, devices and login history.
 *
 * One part of the Venture schema bootstrap; concatenated, in order, by
 * `../schema.js`. Statement order across parts is significant.
 */

export default [
// Verification tables
"CREATE TABLE IF NOT EXISTS venture_verifications (id SERIAL PRIMARY KEY, venture_id TEXT NOT NULL UNIQUE REFERENCES ventures(venture_id) ON DELETE CASCADE, status TEXT NOT NULL DEFAULT 'draft', submitted_at TIMESTAMP, reviewed_by TEXT, reviewed_at TIMESTAMP, reviewer_notes TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())",
"CREATE TABLE IF NOT EXISTS venture_verification_items (id SERIAL PRIMARY KEY, verification_id INTEGER NOT NULL REFERENCES venture_verifications(id) ON DELETE CASCADE, category TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', notes TEXT, reviewed_by TEXT, reviewed_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW(), UNIQUE(verification_id, category))",
"CREATE TABLE IF NOT EXISTS venture_verification_documents (id SERIAL PRIMARY KEY, verification_id INTEGER NOT NULL REFERENCES venture_verifications(id) ON DELETE CASCADE, category TEXT NOT NULL, document_type TEXT NOT NULL, file_name TEXT NOT NULL, file_size BIGINT, file_type TEXT, file_url TEXT NOT NULL, uploaded_by TEXT, uploaded_at TIMESTAMP DEFAULT NOW())",
"CREATE TABLE IF NOT EXISTS venture_verification_document_versions (id SERIAL PRIMARY KEY, document_id INTEGER NOT NULL REFERENCES venture_verification_documents(id) ON DELETE CASCADE, version_number INTEGER NOT NULL, file_name TEXT NOT NULL, file_size BIGINT, file_type TEXT, file_url TEXT NOT NULL, version_notes TEXT, uploaded_by TEXT, uploaded_at TIMESTAMP DEFAULT NOW(), UNIQUE(document_id, version_number))",
"CREATE INDEX IF NOT EXISTS idx_venture_verification_document_versions_doc ON venture_verification_document_versions(document_id)",
"CREATE TABLE IF NOT EXISTS venture_verification_history (id SERIAL PRIMARY KEY, verification_id INTEGER NOT NULL REFERENCES venture_verifications(id) ON DELETE CASCADE, action TEXT NOT NULL, previous_status TEXT, new_status TEXT, actor_cid TEXT, actor_name TEXT, notes TEXT, metadata JSONB DEFAULT '{}'::jsonb, created_at TIMESTAMP DEFAULT NOW())",
"CREATE TABLE IF NOT EXISTS venture_verification_reviews (id SERIAL PRIMARY KEY, verification_id INTEGER NOT NULL REFERENCES venture_verifications(id) ON DELETE CASCADE, reviewer_cid TEXT NOT NULL, reviewer_name TEXT, decision TEXT NOT NULL, notes TEXT, created_at TIMESTAMP DEFAULT NOW())",
"CREATE TABLE IF NOT EXISTS venture_verification_comments (id SERIAL PRIMARY KEY, verification_id INTEGER NOT NULL REFERENCES venture_verifications(id) ON DELETE CASCADE, author_type TEXT NOT NULL, author_cid TEXT, author_name TEXT, message TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW())",
// Audit & Security tables (Enhancement 5.3)
"CREATE TABLE IF NOT EXISTS venture_audit_logs (id SERIAL PRIMARY KEY, event_type TEXT NOT NULL, actor_cid TEXT NOT NULL, actor_name TEXT, actor_role TEXT, venture_id TEXT, entity_type TEXT, entity_id TEXT, description TEXT, metadata JSONB DEFAULT '{}'::jsonb, ip_address TEXT, user_agent TEXT, session_id TEXT, severity TEXT DEFAULT 'info', created_at TIMESTAMP DEFAULT NOW())",
"CREATE INDEX IF NOT EXISTS idx_venture_audit_logs_event_type ON venture_audit_logs(event_type)",
"CREATE INDEX IF NOT EXISTS idx_venture_audit_logs_actor ON venture_audit_logs(actor_cid)",
"CREATE INDEX IF NOT EXISTS idx_venture_audit_logs_created ON venture_audit_logs(created_at DESC)",
"CREATE TABLE IF NOT EXISTS venture_security_events (id SERIAL PRIMARY KEY, event_type TEXT NOT NULL, actor_cid TEXT, actor_name TEXT, target_cid TEXT, description TEXT, metadata JSONB DEFAULT '{}'::jsonb, ip_address TEXT, user_agent TEXT, country TEXT, device TEXT, browser TEXT, os TEXT, severity TEXT DEFAULT 'warning', is_resolved BOOLEAN DEFAULT FALSE, resolved_by TEXT, resolved_at TIMESTAMP, resolution_notes TEXT, created_at TIMESTAMP DEFAULT NOW())",
"CREATE INDEX IF NOT EXISTS idx_venture_security_events_type ON venture_security_events(event_type)",
"CREATE INDEX IF NOT EXISTS idx_venture_security_events_severity ON venture_security_events(severity)",
"CREATE INDEX IF NOT EXISTS idx_venture_security_events_created ON venture_security_events(created_at DESC)",
"ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS device TEXT",
"ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS browser TEXT",
"ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS os TEXT",
"ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS ip_address TEXT",
"ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS country TEXT",
"ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP",
"ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS logout_time TIMESTAMP",
"ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS session_status TEXT DEFAULT 'active'",
"ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS token_hash TEXT",
"CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash) WHERE token_hash IS NOT NULL",
"CREATE TABLE IF NOT EXISTS venture_trusted_devices (id SERIAL PRIMARY KEY, user_cid TEXT NOT NULL, device_name TEXT, device_type TEXT, browser TEXT, os TEXT, ip_address TEXT, fingerprint TEXT, is_trusted BOOLEAN DEFAULT FALSE, last_used_at TIMESTAMP DEFAULT NOW(), created_at TIMESTAMP DEFAULT NOW(), UNIQUE(user_cid, fingerprint))",
"CREATE TABLE IF NOT EXISTS venture_login_history (id SERIAL PRIMARY KEY, user_cid TEXT, user_name TEXT, user_email TEXT, action TEXT NOT NULL, ip_address TEXT, user_agent TEXT, device TEXT, browser TEXT, os TEXT, country TEXT, city TEXT, is_success BOOLEAN DEFAULT TRUE, failure_reason TEXT, session_id TEXT, created_at TIMESTAMP DEFAULT NOW())",
"CREATE INDEX IF NOT EXISTS idx_venture_login_history_user ON venture_login_history(user_cid)",
"CREATE INDEX IF NOT EXISTS idx_venture_login_history_created ON venture_login_history(created_at DESC)",
"CREATE TABLE IF NOT EXISTS venture_failed_logins (id SERIAL PRIMARY KEY, identifier TEXT NOT NULL, ip_address TEXT, attempted_at TIMESTAMP DEFAULT NOW())",
"CREATE INDEX IF NOT EXISTS idx_venture_failed_logins_identifier ON venture_failed_logins(identifier)",
];

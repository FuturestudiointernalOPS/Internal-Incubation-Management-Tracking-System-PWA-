/**
 * VENTURE SCHEMA BOOTSTRAP.
 *
 * Keeps the Venture tables up to date: a fixed, idempotent list of
 * `ADD COLUMN IF NOT EXISTS` migrations (plus two `name`/`company_name`
 * backfills), then seeds the configurable Venture permission catalog.
 *
 * There is no per-request decision here — the migration list is data. Every
 * statement is in `@/models/ventureSchemaStore`; nothing here runs SQL.
 *
 * Re-exported unchanged through `@/lib/ventures` (the module it came from) —
 * see docs/LAYER_SPLIT.md.
 */

import {
  runVentureMigration,
  syncVentureNameToCompanyName,
  syncVentureCompanyNameToName,
} from "@/models/ventureSchemaStore";

/**
 * Ensure venture schema is up to date.
 * Adds missing columns safely using ALTER TABLE IF NOT EXISTS.
 * This is safe to call on every request; it's a no-op if columns exist.
 */
export async function ensureVentureSchema() {
  const migrations = [
    // Ventures table columns
    "ALTER TABLE ventures ADD COLUMN IF NOT EXISTS company_name TEXT",
    "ALTER TABLE ventures ADD COLUMN IF NOT EXISTS registration_number TEXT",
    "ALTER TABLE ventures ADD COLUMN IF NOT EXISTS industry TEXT",
    "ALTER TABLE ventures ADD COLUMN IF NOT EXISTS business_stage TEXT",
    "ALTER TABLE ventures ADD COLUMN IF NOT EXISTS description TEXT",
    "ALTER TABLE ventures ADD COLUMN IF NOT EXISTS website TEXT",
    "ALTER TABLE ventures ADD COLUMN IF NOT EXISTS logo_url TEXT",
    "ALTER TABLE ventures ADD COLUMN IF NOT EXISTS created_by TEXT",
    "ALTER TABLE ventures ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()",
    "ALTER TABLE ventures ADD COLUMN IF NOT EXISTS venture_id TEXT",
    // Venture founders columns
    "ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS phone TEXT",
    "ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS title TEXT",
    "ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS invitation_token TEXT",
    "ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS invitation_sent_at TIMESTAMP",
    "ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS invitation_accepted_at TIMESTAMP",
    "ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()",
    "ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS email TEXT",
    "ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS name TEXT",
    // Missing venture_founders columns
    "ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'",
    "ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()",
    // Legacy column fixes
    "ALTER TABLE venture_founders ALTER COLUMN contact_id DROP NOT NULL",
    // Venture members columns
    "ALTER TABLE venture_members ADD COLUMN IF NOT EXISTS joined_at TIMESTAMP DEFAULT NOW()",
    // Ensure name column is nullable (legacy constraint issue)
    "ALTER TABLE ventures ALTER COLUMN name DROP NOT NULL",
    // Fix missing venture_history columns
    "ALTER TABLE venture_history ADD COLUMN IF NOT EXISTS metadata JSONB",
    "ALTER TABLE venture_history ADD COLUMN IF NOT EXISTS created_by TEXT",
    // Fix missing venture_activity_log columns
    "ALTER TABLE venture_activity_log ADD COLUMN IF NOT EXISTS actor_cid TEXT",
    "ALTER TABLE venture_activity_log ADD COLUMN IF NOT EXISTS actor_name TEXT",
    "ALTER TABLE venture_activity_log ADD COLUMN IF NOT EXISTS details JSONB",
    // Founder management columns
    "ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'founder'",
    "ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS is_owner BOOLEAN DEFAULT FALSE",
    "ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP",
    "ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS suspended_by TEXT",
    "ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS invitation_expires_at TIMESTAMP",
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
    // External Integrations & API tables (Enhancement 5.4)
    "CREATE TABLE IF NOT EXISTS integration_providers (id SERIAL PRIMARY KEY, provider_key TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT, icon TEXT, is_available BOOLEAN DEFAULT TRUE, config_schema JSONB, created_at TIMESTAMP DEFAULT NOW())",
    "INSERT INTO integration_providers (provider_key, name, description, config_schema) SELECT 'google_calendar', 'Google Calendar', 'Sync events and availability with Google Calendar', '{\"type\":\"object\",\"properties\":{\"client_id\":{\"type\":\"string\"},\"client_secret\":{\"type\":\"string\"},\"redirect_uri\":{\"type\":\"string\"},\"calendar_id\":{\"type\":\"string\"}}}'::jsonb WHERE NOT EXISTS (SELECT 1 FROM integration_providers WHERE provider_key='google_calendar')",
    "INSERT INTO integration_providers (provider_key, name, description, config_schema) SELECT 'google_drive', 'Google Drive', 'Access and store documents in Google Drive', '{\"type\":\"object\",\"properties\":{\"client_id\":{\"type\":\"string\"},\"client_secret\":{\"type\":\"string\"},\"redirect_uri\":{\"type\":\"string\"}}}'::jsonb WHERE NOT EXISTS (SELECT 1 FROM integration_providers WHERE provider_key='google_drive')",
    "INSERT INTO integration_providers (provider_key, name, description, config_schema) SELECT 'microsoft_outlook', 'Microsoft Outlook', 'Sync email, calendar and contacts with Outlook', '{\"type\":\"object\",\"properties\":{\"tenant_id\":{\"type\":\"string\"},\"client_id\":{\"type\":\"string\"},\"client_secret\":{\"type\":\"string\"}}}'::jsonb WHERE NOT EXISTS (SELECT 1 FROM integration_providers WHERE provider_key='microsoft_outlook')",
    "INSERT INTO integration_providers (provider_key, name, description, config_schema) SELECT 'slack', 'Slack', 'Receive notifications and updates in Slack channels', '{\"type\":\"object\",\"properties\":{\"webhook_url\":{\"type\":\"string\"},\"channel\":{\"type\":\"string\"},\"bot_token\":{\"type\":\"string\"}}}'::jsonb WHERE NOT EXISTS (SELECT 1 FROM integration_providers WHERE provider_key='slack')",
    "INSERT INTO integration_providers (provider_key, name, description, config_schema) SELECT 'zoom', 'Zoom', 'Create and manage Zoom meetings', '{\"type\":\"object\",\"properties\":{\"client_id\":{\"type\":\"string\"},\"client_secret\":{\"type\":\"string\"},\"account_id\":{\"type\":\"string\"}}}'::jsonb WHERE NOT EXISTS (SELECT 1 FROM integration_providers WHERE provider_key='zoom')",
    "INSERT INTO integration_providers (provider_key, name, description, config_schema) SELECT 'microsoft_teams', 'Microsoft Teams', 'Collaborate and schedule meetings via Teams', '{\"type\":\"object\",\"properties\":{\"tenant_id\":{\"type\":\"string\"},\"client_id\":{\"type\":\"string\"},\"client_secret\":{\"type\":\"string\"}}}'::jsonb WHERE NOT EXISTS (SELECT 1 FROM integration_providers WHERE provider_key='microsoft_teams')",
    "CREATE TABLE IF NOT EXISTS integration_configs (id SERIAL PRIMARY KEY, provider TEXT NOT NULL, label TEXT, venture_id TEXT REFERENCES ventures(venture_id) ON DELETE CASCADE, config JSONB DEFAULT '{}'::jsonb, credentials_encrypted TEXT, status TEXT DEFAULT 'disconnected', last_sync_at TIMESTAMP, created_by TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW(), UNIQUE(venture_id, provider))",
    "CREATE INDEX IF NOT EXISTS idx_integration_configs_provider ON integration_configs(provider)",
    "CREATE INDEX IF NOT EXISTS idx_integration_configs_venture ON integration_configs(venture_id)",
    "CREATE INDEX IF NOT EXISTS idx_integration_configs_status ON integration_configs(status)",
    "CREATE TABLE IF NOT EXISTS api_keys (id SERIAL PRIMARY KEY, key_id TEXT NOT NULL UNIQUE, key_hash TEXT NOT NULL, name TEXT NOT NULL, description TEXT, scopes JSONB DEFAULT '[]'::jsonb, created_by TEXT NOT NULL, expires_at TIMESTAMP, last_used_at TIMESTAMP, is_active BOOLEAN DEFAULT TRUE, allowed_ips JSONB DEFAULT '[]'::jsonb, rate_limit INTEGER DEFAULT 100, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())",
    "CREATE INDEX IF NOT EXISTS idx_api_keys_key_id ON api_keys(key_id)",
    "CREATE INDEX IF NOT EXISTS idx_api_keys_created_by ON api_keys(created_by)",
    "CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active)",
    "CREATE TABLE IF NOT EXISTS webhooks (id SERIAL PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL, secret TEXT, events JSONB DEFAULT '[]'::jsonb, venture_id TEXT REFERENCES ventures(venture_id) ON DELETE CASCADE, is_active BOOLEAN DEFAULT TRUE, retry_count INTEGER DEFAULT 3, timeout_ms INTEGER DEFAULT 10000, last_triggered_at TIMESTAMP, last_status TEXT, failure_count INTEGER DEFAULT 0, created_by TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())",
    "CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(is_active)",
    "CREATE INDEX IF NOT EXISTS idx_webhooks_venture ON webhooks(venture_id)",
    "CREATE TABLE IF NOT EXISTS webhook_delivery_logs (id SERIAL PRIMARY KEY, webhook_id INTEGER REFERENCES webhooks(id) ON DELETE CASCADE, event_type TEXT NOT NULL, payload JSONB, response_status INTEGER, response_body TEXT, duration_ms INTEGER, status TEXT DEFAULT 'pending', attempt INTEGER DEFAULT 1, error_message TEXT, created_at TIMESTAMP DEFAULT NOW())",
    "CREATE INDEX IF NOT EXISTS idx_webhook_delivery_webhook ON webhook_delivery_logs(webhook_id)",
    "CREATE INDEX IF NOT EXISTS idx_webhook_delivery_status ON webhook_delivery_logs(status)",
    "CREATE INDEX IF NOT EXISTS idx_webhook_delivery_created ON webhook_delivery_logs(created_at DESC)",
    "CREATE TABLE IF NOT EXISTS api_usage_logs (id SERIAL PRIMARY KEY, api_key_id INTEGER, endpoint TEXT NOT NULL, method TEXT, ip_address TEXT, response_status INTEGER, duration_ms INTEGER, user_agent TEXT, created_at TIMESTAMP DEFAULT NOW())",
    "CREATE INDEX IF NOT EXISTS idx_api_usage_logs_key ON api_usage_logs(api_key_id)",
    "CREATE INDEX IF NOT EXISTS idx_api_usage_logs_created ON api_usage_logs(created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_api_usage_logs_ip ON api_usage_logs(ip_address)",
    // System Monitoring tables (Enhancement 5.5)
    "CREATE TABLE IF NOT EXISTS system_health_checks (id SERIAL PRIMARY KEY, component TEXT NOT NULL, status TEXT NOT NULL, response_time_ms INTEGER, message TEXT, details JSONB DEFAULT '{}'::jsonb, checked_at TIMESTAMP DEFAULT NOW())",
    "CREATE INDEX IF NOT EXISTS idx_system_health_checks_component ON system_health_checks(component)",
    "CREATE INDEX IF NOT EXISTS idx_system_health_checks_status ON system_health_checks(status)",
    "CREATE INDEX IF NOT EXISTS idx_system_health_checks_checked ON system_health_checks(checked_at DESC)",
    "CREATE TABLE IF NOT EXISTS system_metrics (id SERIAL PRIMARY KEY, metric_name TEXT NOT NULL, metric_value DOUBLE PRECISION NOT NULL, unit TEXT, tags JSONB DEFAULT '{}'::jsonb, recorded_at TIMESTAMP DEFAULT NOW())",
    "CREATE INDEX IF NOT EXISTS idx_system_metrics_name ON system_metrics(metric_name)",
    "CREATE INDEX IF NOT EXISTS idx_system_metrics_recorded ON system_metrics(recorded_at DESC)",
    "CREATE TABLE IF NOT EXISTS system_alerts (id SERIAL PRIMARY KEY, alert_type TEXT NOT NULL, severity TEXT NOT NULL, title TEXT NOT NULL, message TEXT, metric_name TEXT, metric_value DOUBLE PRECISION, threshold DOUBLE PRECISION, status TEXT DEFAULT 'open', acknowledged_by TEXT, acknowledged_at TIMESTAMP, resolved_by TEXT, resolved_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW())",
    "CREATE INDEX IF NOT EXISTS idx_system_alerts_type ON system_alerts(alert_type)",
    "CREATE INDEX IF NOT EXISTS idx_system_alerts_severity ON system_alerts(severity)",
    "CREATE INDEX IF NOT EXISTS idx_system_alerts_status ON system_alerts(status)",
    "CREATE INDEX IF NOT EXISTS idx_system_alerts_created ON system_alerts(created_at DESC)",
    "CREATE TABLE IF NOT EXISTS system_reports (id SERIAL PRIMARY KEY, report_type TEXT NOT NULL, title TEXT NOT NULL, period_start DATE NOT NULL, period_end DATE NOT NULL, summary TEXT, data JSONB DEFAULT '{}'::jsonb, generated_by TEXT, file_url TEXT, created_at TIMESTAMP DEFAULT NOW())",
    "CREATE INDEX IF NOT EXISTS idx_system_reports_type ON system_reports(report_type)",
    "CREATE INDEX IF NOT EXISTS idx_system_reports_period ON system_reports(period_start, period_end)",
    "CREATE TABLE IF NOT EXISTS job_history (id SERIAL PRIMARY KEY, job_name TEXT NOT NULL, job_type TEXT NOT NULL, status TEXT NOT NULL, started_at TIMESTAMP, completed_at TIMESTAMP, duration_ms INTEGER, payload JSONB DEFAULT '{}'::jsonb, result JSONB DEFAULT '{}'::jsonb, error_message TEXT, retry_count INTEGER DEFAULT 0, max_retries INTEGER DEFAULT 3, created_by TEXT, created_at TIMESTAMP DEFAULT NOW())",
    "CREATE INDEX IF NOT EXISTS idx_job_history_name ON job_history(job_name)",
    "CREATE INDEX IF NOT EXISTS idx_job_history_status ON job_history(status)",
    "CREATE INDEX IF NOT EXISTS idx_job_history_created ON job_history(created_at DESC)",
    "CREATE TABLE IF NOT EXISTS queue_statistics (id SERIAL PRIMARY KEY, queue_name TEXT NOT NULL, current_size INTEGER DEFAULT 0, processed_count INTEGER DEFAULT 0, failed_count INTEGER DEFAULT 0, average_wait_ms INTEGER, average_process_ms INTEGER, recorded_at TIMESTAMP DEFAULT NOW())",
    "CREATE INDEX IF NOT EXISTS idx_queue_statistics_name ON queue_statistics(queue_name)",
    "CREATE INDEX IF NOT EXISTS idx_queue_statistics_recorded ON queue_statistics(recorded_at DESC)",
    // ─── Phase 1 — Venture Foundation (additive only) ───
    // venture_members: single founder/member model (lead/owner/suspend/soft-delete)
    "ALTER TABLE venture_members ADD COLUMN IF NOT EXISTS contact_id TEXT",
    "ALTER TABLE venture_members ADD COLUMN IF NOT EXISTS member_type TEXT DEFAULT 'team_member'",
    "ALTER TABLE venture_members ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member'",
    "ALTER TABLE venture_members ADD COLUMN IF NOT EXISTS permissions TEXT DEFAULT 'edit'",
    "ALTER TABLE venture_members ADD COLUMN IF NOT EXISTS invited_by TEXT",
    "ALTER TABLE venture_members ADD COLUMN IF NOT EXISTS removed_at TIMESTAMP",
    "ALTER TABLE venture_members ADD COLUMN IF NOT EXISTS lead_founder BOOLEAN DEFAULT FALSE",
    "ALTER TABLE venture_members ADD COLUMN IF NOT EXISTS is_owner BOOLEAN DEFAULT FALSE",
    "ALTER TABLE venture_members ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP",
    "ALTER TABLE venture_members ADD COLUMN IF NOT EXISTS suspended_by TEXT",
    "ALTER TABLE venture_members ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()",
    // venture_member_invitations: a founder adds a member by email; the person
    // only joins after opening the emailed link (invite ≠ member)
    "CREATE TABLE IF NOT EXISTS venture_member_invitations (id SERIAL PRIMARY KEY, venture_id TEXT NOT NULL, email TEXT NOT NULL, name TEXT, member_type TEXT NOT NULL DEFAULT 'team_member', role TEXT, contact_id TEXT, invited_by TEXT, token TEXT, token_hash TEXT, status TEXT NOT NULL DEFAULT 'pending', expires_at TIMESTAMPTZ, accepted_at TIMESTAMPTZ, responded_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW())",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_vmi_token_hash ON venture_member_invitations(token_hash) WHERE token_hash IS NOT NULL",
    "CREATE INDEX IF NOT EXISTS idx_vmi_venture_status ON venture_member_invitations(venture_id, status)",
    "CREATE INDEX IF NOT EXISTS idx_vmi_email ON venture_member_invitations(LOWER(email))",
    // venture_milestones: runtime columns the code already reads/writes
    "ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0",
    "ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS target_date TIMESTAMP",
    // v2_teams: promotion columns the promote route already writes
    "ALTER TABLE v2_teams ADD COLUMN IF NOT EXISTS venture_id TEXT",
    "ALTER TABLE v2_teams ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMP",
    // ventures: canonical origin/profile columns
    "ALTER TABLE ventures ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES v2_programs(id)",
    "ALTER TABLE ventures ADD COLUMN IF NOT EXISTS origin_team_id TEXT",
    "ALTER TABLE ventures ADD COLUMN IF NOT EXISTS graduated_at TIMESTAMP",
    "ALTER TABLE ventures ADD COLUMN IF NOT EXISTS graduation_notes TEXT",
    "ALTER TABLE ventures ADD COLUMN IF NOT EXISTS north_star TEXT",
    "ALTER TABLE ventures ADD COLUMN IF NOT EXISTS country TEXT",
    "ALTER TABLE ventures ADD COLUMN IF NOT EXISTS country_code TEXT",
    "ALTER TABLE ventures ADD COLUMN IF NOT EXISTS registration_status TEXT",
    "ALTER TABLE ventures ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'private'",
    "ALTER TABLE ventures ADD COLUMN IF NOT EXISTS social_media JSONB",
    "ALTER TABLE ventures ADD COLUMN IF NOT EXISTS branding JSONB",
    "ALTER TABLE ventures ADD COLUMN IF NOT EXISTS language TEXT",
    "ALTER TABLE ventures ADD COLUMN IF NOT EXISTS sector TEXT",
    "ALTER TABLE ventures ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE",
    // platform_form_submissions: submission → invitation link (Venture pipeline provenance)
    "ALTER TABLE platform_form_submissions ADD COLUMN IF NOT EXISTS invitation_id INTEGER",
    "CREATE INDEX IF NOT EXISTS idx_form_submissions_invitation ON platform_form_submissions(invitation_id)",
    // venture_origins: 1:1 CRM provenance for every venture
    "CREATE TABLE IF NOT EXISTS venture_origins (id SERIAL PRIMARY KEY, venture_id TEXT NOT NULL UNIQUE REFERENCES ventures(venture_id) ON DELETE CASCADE, source_type TEXT NOT NULL DEFAULT 'legacy', program_id TEXT, cohort_id TEXT, team_id TEXT, participant_cid TEXT, invited_by_cid TEXT, form_id INTEGER, run_id INTEGER, submission_id INTEGER, invitation_id INTEGER, approved_by_cid TEXT, approved_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW())",
    "CREATE INDEX IF NOT EXISTS idx_venture_origins_source ON venture_origins(source_type)",
    "CREATE INDEX IF NOT EXISTS idx_venture_origins_program ON venture_origins(program_id)",
    "CREATE INDEX IF NOT EXISTS idx_venture_origins_team ON venture_origins(team_id)",
    // venture_option_values: configurable taxonomies (stages, industry/sector, ...)
    "CREATE TABLE IF NOT EXISTS venture_option_values (id SERIAL PRIMARY KEY, option_type TEXT NOT NULL, value TEXT NOT NULL, label TEXT, sort_order INTEGER DEFAULT 0, is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT NOW(), UNIQUE(option_type, value))",
    // Seed default taxonomies (idempotent; staff can edit via Venture Setup later)
    "INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'business_stage', 'idea', 'Idea', 1 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='business_stage' AND value='idea')",
    "INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'business_stage', 'validation', 'Validation', 2 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='business_stage' AND value='validation')",
    "INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'business_stage', 'mvp', 'MVP', 3 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='business_stage' AND value='mvp')",
    "INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'business_stage', 'growth', 'Growth', 4 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='business_stage' AND value='growth')",
    "INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'business_stage', 'scale', 'Scale', 5 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='business_stage' AND value='scale')",
    "INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'industry', 'Fintech', 'Fintech', 1 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='industry' AND value='Fintech')",
    "INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'industry', 'Healthtech', 'Healthtech', 2 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='industry' AND value='Healthtech')",
    "INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'industry', 'Edtech', 'Edtech', 3 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='industry' AND value='Edtech')",
    "INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'industry', 'Cleantech', 'Cleantech', 4 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='industry' AND value='Cleantech')",
    "INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'industry', 'SaaS', 'SaaS', 5 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='industry' AND value='SaaS')",
    "INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'industry', 'E-commerce', 'E-commerce', 6 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='industry' AND value='E-commerce')",
    "INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'industry', 'Agritech', 'Agritech', 7 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='industry' AND value='Agritech')",
    "INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'industry', 'Logistics', 'Logistics', 8 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='industry' AND value='Logistics')",
    "INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'industry', 'AI / ML', 'AI / ML', 9 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='industry' AND value='AI / ML')",
    "INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'industry', 'Blockchain', 'Blockchain', 10 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='industry' AND value='Blockchain')",
    "INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'industry', 'Media & Entertainment', 'Media & Entertainment', 11 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='industry' AND value='Media & Entertainment')",
    "INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'industry', 'Real Estate', 'Real Estate', 12 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='industry' AND value='Real Estate')",
    "INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'industry', 'Other', 'Other', 13 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='industry' AND value='Other')",
    // platform_form_run_invitations: tracked invitations into the Venture Run
    // (Phase 3 — Invitations & Team Promotion)
    "CREATE TABLE IF NOT EXISTS platform_form_run_invitations (id SERIAL PRIMARY KEY, run_id INTEGER, contact_cid TEXT, email TEXT NOT NULL, source_type TEXT NOT NULL DEFAULT 'external', program_id TEXT, cohort_id TEXT, team_id TEXT, invited_by_cid TEXT, token TEXT, token_hash TEXT, expires_at TIMESTAMP, used_at TIMESTAMP, status TEXT NOT NULL DEFAULT 'sent', created_at TIMESTAMP DEFAULT NOW(), UNIQUE(token))",
    "CREATE INDEX IF NOT EXISTS idx_run_invitations_token_hash ON platform_form_run_invitations(token_hash)",
    "CREATE INDEX IF NOT EXISTS idx_run_invitations_email ON platform_form_run_invitations(email)",
    "CREATE INDEX IF NOT EXISTS idx_run_invitations_status ON platform_form_run_invitations(status)",
    // ─── Phase 5 — Configurable Venture Operating Model (additive) ───
    // Reusable playbook templates (Future Studio defines, Ventures execute snapshots)
    "CREATE TABLE IF NOT EXISTS venture_playbook_templates (id SERIAL PRIMARY KEY, name TEXT NOT NULL, description TEXT, is_active BOOLEAN DEFAULT TRUE, created_by TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())",
    "CREATE TABLE IF NOT EXISTS venture_playbook_template_stages (id SERIAL PRIMARY KEY, template_id INTEGER NOT NULL REFERENCES venture_playbook_templates(id) ON DELETE CASCADE, stage_order INTEGER NOT NULL, name TEXT NOT NULL, description TEXT, objective TEXT, completion_criteria TEXT, created_at TIMESTAMP DEFAULT NOW(), UNIQUE(template_id, stage_order))",
    "CREATE TABLE IF NOT EXISTS venture_milestone_templates (id SERIAL PRIMARY KEY, name TEXT NOT NULL, description TEXT, expected_outcome TEXT, default_due_days INTEGER, is_active BOOLEAN DEFAULT TRUE, created_by TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())",
    "CREATE TABLE IF NOT EXISTS venture_task_templates (id SERIAL PRIMARY KEY, milestone_template_id INTEGER REFERENCES venture_milestone_templates(id) ON DELETE SET NULL, name TEXT NOT NULL, description TEXT, requirement_type TEXT NOT NULL DEFAULT 'activity', is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT NOW())",
    "CREATE TABLE IF NOT EXISTS venture_playbook_stage_milestones (id SERIAL PRIMARY KEY, stage_id INTEGER NOT NULL REFERENCES venture_playbook_template_stages(id) ON DELETE CASCADE, milestone_template_id INTEGER NOT NULL REFERENCES venture_milestone_templates(id) ON DELETE CASCADE, sort_order INTEGER DEFAULT 0, UNIQUE(stage_id, milestone_template_id))",
    // Per-venture playbook instance — a SNAPSHOT; template edits never rewrite it
    "CREATE TABLE IF NOT EXISTS venture_playbook_instances (id SERIAL PRIMARY KEY, venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE, template_id INTEGER NOT NULL REFERENCES venture_playbook_templates(id), assigned_by TEXT, assigned_at TIMESTAMP DEFAULT NOW(), UNIQUE(venture_id))",
    "CREATE TABLE IF NOT EXISTS venture_playbook_instance_stages (id SERIAL PRIMARY KEY, instance_id INTEGER NOT NULL REFERENCES venture_playbook_instances(id) ON DELETE CASCADE, template_stage_id INTEGER, stage_order INTEGER NOT NULL, name TEXT NOT NULL, description TEXT, objective TEXT, completion_criteria TEXT, status TEXT NOT NULL DEFAULT 'locked', completed_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW(), UNIQUE(instance_id, stage_order))",
    // Snapshot provenance on execution tables + task requirement types
    "ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS template_id INTEGER",
    "ALTER TABLE venture_tasks ADD COLUMN IF NOT EXISTS template_id INTEGER",
    "ALTER TABLE venture_tasks ADD COLUMN IF NOT EXISTS requirement_type TEXT DEFAULT 'activity'",
    // Task reviews (accept / reject / revision requested) with history
    "CREATE TABLE IF NOT EXISTS venture_task_reviews (id SERIAL PRIMARY KEY, task_id INTEGER NOT NULL REFERENCES venture_tasks(id) ON DELETE CASCADE, reviewer_cid TEXT, reviewer_name TEXT, decision TEXT NOT NULL, comments TEXT, created_at TIMESTAMP DEFAULT NOW())",
    "CREATE INDEX IF NOT EXISTS idx_venture_task_reviews_task ON venture_task_reviews(task_id)",
    // ─── Phase 2 — Canonical Core Spine (additive, non-destructive) ───
    // Milestones become Journey-bound units of progress (journey stage parent).
    // Columns are nullable so existing milestones are untouched until staff bind
    // them to a Journey stage. owner_cid/priority keep the legacy 016 concepts
    // available without depending on which milestone DDL created the table.
    "ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS journey_stage_id UUID",
    "ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS objective TEXT",
    "ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS start_date DATE",
    "ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS display_order INTEGER",
    "ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS priority TEXT",
    "ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS owner_cid TEXT",
    "CREATE INDEX IF NOT EXISTS idx_vm_journey_stage ON venture_milestones(journey_stage_id) WHERE journey_stage_id IS NOT NULL",
    // Task review-required flag + optional required deliverable type (D5).
    "ALTER TABLE venture_tasks ADD COLUMN IF NOT EXISTS review_required BOOLEAN DEFAULT FALSE",
    "ALTER TABLE venture_tasks ADD COLUMN IF NOT EXISTS required_deliverable_type TEXT",
    // Sessions become Journey-connected and can be marked Venture-facing (D2/D7).
    // Soft refs (TEXT/UUID without FK) keep both legacy venture_milestones DDLs
    // compatible — no type mismatch risk.
    "ALTER TABLE venture_sessions ADD COLUMN IF NOT EXISTS journey_stage_id UUID",
    "ALTER TABLE venture_sessions ADD COLUMN IF NOT EXISTS milestone_ref TEXT",
    "ALTER TABLE venture_sessions ADD COLUMN IF NOT EXISTS task_id INTEGER",
    "ALTER TABLE venture_sessions ADD COLUMN IF NOT EXISTS preparation_notes TEXT",
    "ALTER TABLE venture_sessions ADD COLUMN IF NOT EXISTS venture_facing BOOLEAN DEFAULT FALSE",
    // A session always belongs to a milestone; it may additionally be attached
    // to one of that milestone's deliverables (soft ref — no FK, like
    // milestone_ref itself).
    "ALTER TABLE venture_sessions ADD COLUMN IF NOT EXISTS deliverable_id TEXT",
    // Documents the participants need for a session (a deck to review, a brief
    // to read), attached while booking. Rows store [{path,name,size}]; the files
    // live in the private evidence bucket under a `sessions/` prefix and are
    // signed on read, so only people with Venture access can open them.
    "ALTER TABLE venture_sessions ADD COLUMN IF NOT EXISTS materials JSONB",
    // Task submissions (D5): append-only versions; founder submits, staff
    // reviews (approved | changes_requested); official task completion requires
    // an approved submission when review_required = TRUE.
    "CREATE TABLE IF NOT EXISTS venture_task_submissions (id SERIAL PRIMARY KEY, task_id INTEGER NOT NULL REFERENCES venture_tasks(id) ON DELETE CASCADE, version INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'submitted', file_url TEXT, file_name TEXT, file_type TEXT, file_size BIGINT, notes TEXT, submitted_by TEXT, submitted_by_name TEXT, reviewed_by TEXT, review_decision TEXT, review_comment TEXT, reviewed_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW(), UNIQUE(task_id, version))",
    "CREATE INDEX IF NOT EXISTS idx_vts_task ON venture_task_submissions(task_id, version)",
    // KPI library extension (Phase 5 — formula/frequency/measurement)
    "ALTER TABLE venture_kpi_definitions ADD COLUMN IF NOT EXISTS formula TEXT",
    "ALTER TABLE venture_kpi_definitions ADD COLUMN IF NOT EXISTS frequency TEXT",
    "ALTER TABLE venture_kpi_definitions ADD COLUMN IF NOT EXISTS measurement_method TEXT",
    "ALTER TABLE venture_kpi_definitions ADD COLUMN IF NOT EXISTS default_target NUMERIC",
    // ─── Phase P1 — Configurable Venture Permissions (additive) ───
    // Responsibilities are configurable, contextual assignments (names are
    // editable from the UI; the stable code is what assignments/matrix use).
    "CREATE TABLE IF NOT EXISTS venture_responsibilities (id SERIAL PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT, is_active BOOLEAN DEFAULT TRUE, created_by TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())",
    "ALTER TABLE venture_responsibilities ADD COLUMN IF NOT EXISTS created_by TEXT",
    "CREATE TABLE IF NOT EXISTS venture_scope_types (id SERIAL PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT, is_active BOOLEAN DEFAULT TRUE, sort_order INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT NOW())",
    // Platform GLOBAL matrix (responsibility x area x action). Seed = agreed defaults.
    // Permission profiles belong to the RESPONSIBILITY, never to an individual
    // Venture. Assignments + scope decide where a profile applies.
    "CREATE TABLE IF NOT EXISTS venture_permission_matrix (id SERIAL PRIMARY KEY, responsibility_code TEXT NOT NULL, area TEXT NOT NULL, action TEXT NOT NULL, allowed BOOLEAN DEFAULT FALSE, updated_by TEXT, updated_at TIMESTAMP DEFAULT NOW(), UNIQUE(responsibility_code, area, action))",
    // NOTE: per-Venture overrides are intentionally NOT part of the model — the
    // global matrix is the single source of truth for every Venture.
    // venture_staff_assignments is the ONLY per-Venture access data (who, which
    // responsibility, which scope).
    // Staff assignments: assignment-ROW based. A person may hold several
    // responsibilities on the same Venture (no (venture,staff) uniqueness) and
    // different responsibilities across Ventures. Access is per assignment.
    "CREATE TABLE IF NOT EXISTS venture_staff_assignments (id SERIAL PRIMARY KEY, venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE, staff_contact_id TEXT NOT NULL, responsibility_code TEXT NOT NULL, scope_type TEXT NOT NULL DEFAULT 'venture_wide', scope_ref_type TEXT, scope_ref_id TEXT, assigned_by TEXT, notes TEXT, status TEXT NOT NULL DEFAULT 'active', created_at TIMESTAMP DEFAULT NOW(), removed_at TIMESTAMP)",
    "CREATE INDEX IF NOT EXISTS idx_vsa_venture ON venture_staff_assignments(venture_id, status)",
    "CREATE INDEX IF NOT EXISTS idx_vsa_staff ON venture_staff_assignments(staff_contact_id, status)",
    // ─── Phase P4 — Internal Venture Notes (staff-only; founders never) ───
    "CREATE TABLE IF NOT EXISTS venture_notes (id SERIAL PRIMARY KEY, venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE, author_cid TEXT, author_name TEXT, title TEXT NOT NULL, body TEXT NOT NULL, scope_ref_type TEXT, scope_ref_id TEXT, is_archived BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())",
    "CREATE INDEX IF NOT EXISTS idx_venture_notes_venture ON venture_notes(venture_id, is_archived)",
    // Legacy marker from the trial: identifies notes that were auto-filed from a
    // session. The memo now lives on the session ONLY — the milestone record is
    // the manager's own writing, never a copy — so nothing writes this column any
    // more. It is kept so trial-era rows stay identifiable and a fresh database
    // matches an existing one.
    "ALTER TABLE venture_notes ADD COLUMN IF NOT EXISTS source_session_id INTEGER",
    // ─── Phase P4b — Venture Operating Plans (Lead Manager instrument) ───
    "CREATE TABLE IF NOT EXISTS venture_operating_plans (id SERIAL PRIMARY KEY, venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE, name TEXT NOT NULL, objective TEXT, status TEXT NOT NULL DEFAULT 'draft', created_by TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())",
    "CREATE INDEX IF NOT EXISTS idx_vop_venture ON venture_operating_plans(venture_id)",
    "CREATE TABLE IF NOT EXISTS venture_plan_sections (id SERIAL PRIMARY KEY, plan_id INTEGER NOT NULL REFERENCES venture_operating_plans(id) ON DELETE CASCADE, title TEXT NOT NULL, objective TEXT, instructions TEXT, sort_order INTEGER DEFAULT 0, status TEXT NOT NULL DEFAULT 'not_started', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())",
    "CREATE INDEX IF NOT EXISTS idx_vps_plan ON venture_plan_sections(plan_id)",
    // Links a plan section to existing Venture objects (milestone/task/document/session/note).
    "CREATE TABLE IF NOT EXISTS venture_plan_links (id SERIAL PRIMARY KEY, section_id INTEGER NOT NULL REFERENCES venture_plan_sections(id) ON DELETE CASCADE, ref_type TEXT NOT NULL, ref_id TEXT NOT NULL, label TEXT, created_by TEXT, created_at TIMESTAMP DEFAULT NOW(), UNIQUE(section_id, ref_type, ref_id))",
    "CREATE INDEX IF NOT EXISTS idx_vpl_section ON venture_plan_links(section_id)",
    // ─── Phase P5 — Reusable Operating-Plan Templates (structure only) ───
    "CREATE TABLE IF NOT EXISTS venture_plan_templates (id SERIAL PRIMARY KEY, name TEXT NOT NULL, description TEXT, is_active BOOLEAN DEFAULT TRUE, created_by TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())",
    "CREATE TABLE IF NOT EXISTS venture_plan_template_sections (id SERIAL PRIMARY KEY, template_id INTEGER NOT NULL REFERENCES venture_plan_templates(id) ON DELETE CASCADE, title TEXT NOT NULL, objective TEXT, instructions TEXT, sort_order INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT NOW())",
    "CREATE INDEX IF NOT EXISTS idx_vpts_template ON venture_plan_template_sections(template_id)",
    // ─── Vinance 3 Phase 1 — notification entity context (drill-down) ───
    // Soft refs (nullable TEXT) so every producer can record WHERE the
    // notification happened (venture → journey → milestone → task/session).
    // Old rows simply have NULL context and degrade gracefully.
    "ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS entity_venture_id TEXT",
    "ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS entity_journey_stage_id TEXT",
    "ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS entity_milestone_id TEXT",
    "ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS entity_task_id TEXT",
    "ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS entity_session_id TEXT",
    // Vinance 3 — notification hardening (template keys + params for local
    // rendering, seen/read lifecycle, dedupe keys for idempotent producers).
    // All nullable: legacy rows and existing consumers are untouched.
    "ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS template_key TEXT",
    "ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS params JSONB",
    "ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS dedupe_key TEXT",
    "ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS seen_at TIMESTAMPTZ",
    "ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ",
    "CREATE INDEX IF NOT EXISTS idx_notif_dedupe ON v2_notifications(recipient_id, dedupe_key) WHERE dedupe_key IS NOT NULL",
    // ─── Vinance 3 — Journey template library (Save-as-Template) ───
    // Structure-only copies of an entire Venture Journey (stages + milestones
    // + top-level tasks). Independent from Venture rows by design: templates
    // are reusable blueprints, never a live view of the Venture.
    "CREATE TABLE IF NOT EXISTS venture_journey_templates (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, description TEXT, created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
    "CREATE TABLE IF NOT EXISTS venture_journey_template_stages (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), template_id UUID NOT NULL REFERENCES venture_journey_templates(id) ON DELETE CASCADE, name TEXT NOT NULL, description TEXT, objective TEXT, stage_order INTEGER NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(template_id, stage_order))",
    "CREATE TABLE IF NOT EXISTS venture_journey_template_milestones (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), stage_id UUID NOT NULL REFERENCES venture_journey_template_stages(id) ON DELETE CASCADE, title TEXT NOT NULL, description TEXT, objective TEXT, priority TEXT DEFAULT 'medium', display_order INTEGER DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
    "CREATE TABLE IF NOT EXISTS venture_journey_template_tasks (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), milestone_id UUID NOT NULL REFERENCES venture_journey_template_milestones(id) ON DELETE CASCADE, title TEXT NOT NULL, description TEXT, priority TEXT DEFAULT 'medium', labels JSONB DEFAULT '[]', checklist JSONB DEFAULT '[]', review_required BOOLEAN DEFAULT FALSE, required_deliverable_type TEXT, display_order INTEGER DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
    // Vinance 3 Phase 2 — contextual notes: attachments (text/links/files)
    "ALTER TABLE venture_notes ADD COLUMN IF NOT EXISTS attachments JSONB",
    // Vinance 3 Phase 1 (coach identity) — sessions know WHO the coach is as
    // a platform user (Future Studio staff or invited external coach). Soft
    // ref: legacy venture_coaches rows keep working via coach_name fallback.
    "ALTER TABLE venture_sessions ADD COLUMN IF NOT EXISTS coach_contact_id TEXT",
    // Vinance 3 Phase 3 — typed Venture Progress Reports (Manager → Super Admin)
    "CREATE TABLE IF NOT EXISTS venture_reports (id SERIAL PRIMARY KEY, venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE, title TEXT NOT NULL, reporting_period TEXT, summary TEXT, current_journey TEXT, current_milestone TEXT, completed_items JSONB DEFAULT '[]'::jsonb, outstanding_items JSONB DEFAULT '[]'::jsonb, support_delivered TEXT, challenges TEXT, recommendation TEXT, status TEXT NOT NULL DEFAULT 'draft', created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), submitted_at TIMESTAMPTZ)",
    "CREATE INDEX IF NOT EXISTS idx_venture_reports_venture ON venture_reports(venture_id, status)",
    // A report BELONGS to a journey. The period-based report stays valid, but
    // "every journey needs a report" needs a real reference — `current_journey`
    // is free text and can never be queried. Existing rows keep this NULL and are
    // never back-filled by guessing at their free text.
    "ALTER TABLE venture_reports ADD COLUMN IF NOT EXISTS journey_stage_id UUID",
    // 'progress' (interim, any time) or 'closing' (the journey's final report).
    // A journey has at most ONE closing report; extra interim reports are
    // allowed and LABELLED, never blocked.
    "ALTER TABLE venture_reports ADD COLUMN IF NOT EXISTS report_kind TEXT",
    // Milestone & task archiving (soft delete). Archived rows stay in the
    // database forever (history preserved) but are hidden from default lists.
    "ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ",
    "ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS archived_by TEXT",
    "ALTER TABLE venture_tasks ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE venture_tasks ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ",
    "ALTER TABLE venture_tasks ADD COLUMN IF NOT EXISTS archived_by TEXT",
  ];

  for (const sql of migrations) {
    try {
      await runVentureMigration(sql);
    } catch (_) {
      // Table might not exist yet; that's ok
    }
  }

  // Copy name -> company_name for any existing rows
  try {
    await syncVentureNameToCompanyName();
  } catch (_) {}

  // …and the other way, for rows where BOTH are set but the legacy `name`
  // drifted. Renames used to write only company_name (the profile screens), so a
  // Venture created by an intake Run kept that Run's name in `name` and every
  // surface still reading it (the founder's My Ventures card) showed the Run
  // instead of the company. company_name is the canonical label.
  try {
    await syncVentureCompanyNameToName();
  } catch (_) {}

  // Seed the configurable Venture permission catalog (idempotent — only when empty)
  try {
    const { seedVenturePermissions } = await import("@/lib/venturePermissions");
    await seedVenturePermissions();
  } catch (_) {}
}

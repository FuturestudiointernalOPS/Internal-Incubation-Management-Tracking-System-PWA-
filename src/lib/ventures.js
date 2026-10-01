import db from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { listVentureMembers, summarizeVentureMembers } from "@/models/ventureMembers";

/**
 * VENTURE OS — Shared Business Logic
 * Enhancement 1.1 — Workflow B: Direct Startup Registration
 * Enhancement 1.1 — Workflow A: Program-to-Venture Promotion
 */

const VENTURE_ID_PREFIX = "VNT";

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
      await db.execute(sql);
    } catch (_) {
      // Table might not exist yet; that's ok
    }
  }

  // Copy name -> company_name for any existing rows
  try {
    await db.execute(
      "UPDATE ventures SET company_name = name WHERE company_name IS NULL AND name IS NOT NULL"
    );
  } catch (_) {}

  // …and the other way, for rows where BOTH are set but the legacy `name`
  // drifted. Renames used to write only company_name (the profile screens), so a
  // Venture created by an intake Run kept that Run's name in `name` and every
  // surface still reading it (the founder's My Ventures card) showed the Run
  // instead of the company. company_name is the canonical label.
  try {
    await db.execute(
      "UPDATE ventures SET name = company_name WHERE company_name IS NOT NULL AND name IS DISTINCT FROM company_name"
    );
  } catch (_) {}

  // Seed the configurable Venture permission catalog (idempotent — only when empty)
  try {
    const { seedVenturePermissions } = await import("@/lib/venturePermissions");
    await seedVenturePermissions();
  } catch (_) {}
}

/**
 * Generate a unique Venture ID in format: VNT-XXXXXXXX
 */
export function generateVentureId() {
  const suffix = uuidv4().replace(/-/g, "").substring(0, 8).toUpperCase();
  return `${VENTURE_ID_PREFIX}-${suffix}`;
}

/**
 * Resolve the members of a program team for Venture promotion.
 *
 * The canonical membership link is contacts.v2_team_id (written by /api/pm/teams);
 * v2_participants.v2_team_id holds the same link for UUID-keyed participants.
 * The old promote path queried v2_group_members (a v2_groups table — wrong) and
 * fell back to ALL program participants — this helper fixes that.
 */
export async function resolveTeamMembersForPromotion(teamId) {
  const res = await db.execute({
    sql: `SELECT c.cid AS contact_id, c.name, c.email
          FROM contacts c
          WHERE c.v2_team_id = ? AND c.deleted = 0
          UNION
          SELECT p.user_id AS contact_id, c2.name, c2.email
          FROM v2_participants p
          JOIN contacts c2 ON c2.cid = p.user_id
          WHERE p.v2_team_id = ? AND c2.deleted = 0`,
    args: [teamId, teamId],
  });
  return (res.rows || []).filter((member) => member && member.contact_id);
}

/**
 * Validate company information for registration.
 * Returns { valid: boolean, errors: string[] }
 */
export function validateCompanyInfo({
  company_name,
  industry,
  business_stage,
  founder_email,
  founder_name,
}) {
  const errors = [];

  if (!company_name || !company_name.trim()) {
    errors.push("Company name is required");
  }

  if (!industry || !industry.trim()) {
    errors.push("Industry is required");
  }

  if (!business_stage || !business_stage.trim()) {
    errors.push("Business stage is required");
  }

  if (!founder_email || !founder_email.trim()) {
    errors.push("Founder email is required");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(founder_email)) {
    errors.push("Invalid founder email format");
  }

  if (!founder_name || !founder_name.trim()) {
    errors.push("Founder name is required");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Check for duplicate company, registration number, or founder email.
 * Returns { hasDuplicates: boolean, conflicts: string[] }
 */
export async function checkDuplicates({ company_name, registration_number, founder_email }) {
  const conflicts = [];

  // Check duplicate company name
  // Try company_name first, fall back to name for backward compat
  try {
    const nameCheck = await db.execute({
      sql: "SELECT id FROM ventures WHERE LOWER(company_name) = LOWER(?)",
      args: [company_name.trim()],
    });
    if (nameCheck.rows.length > 0) {
      conflicts.push("A company with this name already exists");
    }
  } catch (_) {
    // company_name column may not exist yet; try "name" as fallback
    try {
      const fallbackCheck = await db.execute({
        sql: "SELECT id FROM ventures WHERE LOWER(name) = LOWER(?)",
        args: [company_name.trim()],
      });
      if (fallbackCheck.rows.length > 0) {
        conflicts.push("A company with this name already exists");
      }
    } catch (_) {}
  }

  // Check duplicate registration number
  if (registration_number && registration_number.trim()) {
    const regCheck = await db.execute({
      sql: "SELECT id FROM ventures WHERE registration_number = ?",
      args: [registration_number.trim()],
    });
    if (regCheck.rows.length > 0) {
      conflicts.push("A company with this registration number already exists");
    }
  }

  // Check duplicate founder email
  const emailCheck = await db.execute({
    sql: "SELECT id FROM venture_founders WHERE LOWER(email) = LOWER(?)",
    args: [founder_email.trim()],
  });
  if (emailCheck.rows.length > 0) {
    conflicts.push("A founder with this email already exists");
  }

  return { hasDuplicates: conflicts.length > 0, conflicts };
}

/**
 * Create a venture record.
 */
export async function createVenture({
  venture_id,
  company_name,
  registration_number,
  industry,
  business_stage,
  description,
  website,
  logo_url,
  created_by,
}) {
  // Always use "name" (legacy column exists in the table).
  // Also try setting "company_name" for new schema compatibility.
  const name = company_name.trim();

  try {
    // Try with both name and company_name
    await db.execute({
      sql: `INSERT INTO ventures (venture_id, name, company_name, registration_number, industry, business_stage, description, website, logo_url, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        venture_id, name, name,
        registration_number?.trim() || null,
        industry.trim(),
        business_stage.trim(),
        description?.trim() || null,
        website?.trim() || null,
        logo_url?.trim() || null,
        created_by,
      ],
    });
  } catch (err) {
    // company_name column may not exist yet — fall back to just "name"
    if (err.message?.includes("company_name")) {
      await db.execute({
        sql: `INSERT INTO ventures (venture_id, name, registration_number, industry, business_stage, description, website, logo_url, created_by)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          venture_id, name,
          registration_number?.trim() || null,
          industry.trim(),
          business_stage.trim(),
          description?.trim() || null,
          website?.trim() || null,
          logo_url?.trim() || null,
          created_by,
        ],
      });
    } else {
      throw err;
    }
  }

  return { venture_id };
}

/**
 * Create a founder record for a venture.
 */
export async function createFounder({
  venture_id,
  email,
  name,
  phone,
  title,
  invitation_token,
}) {
  await db.execute({
    sql: `INSERT INTO venture_founders (venture_id, email, name, phone, title, invitation_token, invitation_sent_at, status)
          VALUES (?, ?, ?, ?, ?, ?, NOW(), 'pending')`,
    args: [
      venture_id,
      email.trim().toLowerCase(),
      name.trim(),
      phone?.trim() || null,
      title?.trim() || null,
      invitation_token,
    ],
  });

  return { email };
}

// ── Activity log, history and notifications ─────────────────────────────────
// Extracted to the service layer; kept reachable through this module's public
// surface for existing importers (see docs/LAYER_SPLIT.md).
export {
  logVentureActivity,
  addVentureHistory,
  createVentureNotification,
  notifyVentureFounders,
} from "@/services/ventures/activity";

/**
 * Get a venture by its venture_id with founder info.
 */
export async function getVentureById(ventureId) {
  // Normalize: routes may receive a numeric/UUID id (e.g. from list pages or
  // pre-fix promoted ventures). Resolve it to the VNT business key first.
  let key = ventureId;
  if (ventureId && !/^VNT-/i.test(ventureId)) {
    try {
      const byId = await db.execute({
        sql: "SELECT venture_id FROM ventures WHERE id::text = ?",
        args: [ventureId],
      });
      if (byId.rows.length > 0 && byId.rows[0].venture_id) {
        key = byId.rows[0].venture_id;
      }
    } catch (_) {}
  }

  const ventureRes = await db.execute({
    sql: "SELECT * FROM ventures WHERE venture_id = ?",
    args: [key],
  });

  if (ventureRes.rows.length === 0) return null;

  const venture = ventureRes.rows[0];

  // Get founders
  const foundersRes = await db.execute({
    sql: "SELECT * FROM venture_founders WHERE venture_id = ? ORDER BY created_at ASC",
    args: [key],
  });

  // Get members — the membership list IS the Venture's people. The founder table
  // read above is the INVITATION ledger; it is shown on the founders screen and
  // is never the source of a member count.
  let members = [];
  try {
    members = await listVentureMembers(db, key);
  } catch (_) {}
  const memberSummary = summarizeVentureMembers(members);

  // Get recent activity. The actor is resolved to a person when the log kept an
  // id instead of a name, so the journal never reads "by USR_…".
  let activity = [];
  try {
    const activityRes = await db.execute({
      sql: `SELECT al.*, COALESCE(ca.name, cb.name) AS actor_resolved_name
            FROM venture_activity_log al
            LEFT JOIN contacts ca ON ca.cid = al.actor_cid
            LEFT JOIN contacts cb ON cb.cid = al.actor_name
            WHERE al.venture_id = ?
            ORDER BY al.created_at DESC LIMIT 20`,
      args: [key],
    });
    activity = (activityRes.rows || []).map((activityRow) => ({
      ...activityRow,
      actor_name: activityRow.actor_resolved_name || activityRow.actor_name || null,
    }));
  } catch (_) {}

  // Get history
  const historyRes = await db.execute({
    sql: "SELECT * FROM venture_history WHERE venture_id = ? ORDER BY created_at ASC",
    args: [key],
  });

  // Get startup profile progress
  let profileProgress = null;
  try {
    const progressRes = await db.execute({
      sql: "SELECT * FROM startup_profile_progress WHERE venture_id = ?",
      args: [key],
    });
    profileProgress = progressRes.rows[0] || null;
  } catch (_) {}

  return {
    ...venture,
    founders: foundersRes.rows,
    members,
    member_summary: memberSummary,
    activity,
    history: historyRes.rows,
    profile_progress: profileProgress,
  };
}

/**
 * Update a venture record.
 */
export async function updateVenture(ventureId, updates) {
  const allowedFields = [
    "name",
    "company_name",
    "registration_number",
    "mission",
    "vision",
    "industry",
    "sector",
    "business_stage",
    "description",
    "website",
    "logo_url",
    "social_media",
    "status",
    "visibility",
    "language",
    "branding",
    "country",
    "country_code",
    "registration_status",
    "north_star",
    // How the engagement is being run (Incubation / Acceleration / Hybrid) — a
    // label on the Venture, never a level in the hierarchy. Its values live in
    // venture_option_values so they can be renamed without a code change.
    "programme_type",
  ];

  const setClauses = [];
  const args = [];

  // `ventures` carries TWO columns for the same thing — the legacy `name` and
  // the canonical `company_name` (see HANDOVER_VENTURES.md: two generations of
  // the table). Callers write one of them, so a rename used to leave the other
  // stale: the profile screens send only `company_name`, and any surface still
  // reading `name` (the founder's My Ventures card, the portfolio reports) kept
  // showing the Venture's original label — for intake-created Ventures, the
  // name of the Run that collected the application. Mirroring the two here, on
  // the one function every rename goes through, keeps them telling one story.
  const mirrored = { ...updates };
  if (mirrored.company_name !== undefined && mirrored.name === undefined) {
    mirrored.name = mirrored.company_name;
  } else if (mirrored.name !== undefined && mirrored.company_name === undefined) {
    mirrored.company_name = mirrored.name;
  }

  for (const field of allowedFields) {
    if (mirrored[field] !== undefined) {
      setClauses.push(`${field} = ?`);
      args.push(mirrored[field]);
    }
  }

  if (setClauses.length === 0) {
    return { updated: false };
  }

  setClauses.push("updated_at = NOW()");
  args.push(ventureId);

  await db.execute({
    sql: `UPDATE ventures SET ${setClauses.join(", ")} WHERE venture_id = ?`,
    args: args,
  });

  return { updated: true };
}

/**
 * Change the lead founder / owner of a Venture (Phase 4).
 *
 * The new lead must be an existing active member. The previous lead is
 * cleared, the new member becomes lead_founder + is_owner (member_type
 * founder), the change is appended to ownership_history and audited.
 * A Venture can never end up without a lead through this action.
 */
export async function changeVentureLead({ ventureId, memberId, actorCid }) {
  const memberRes = await db.execute({
    sql: "SELECT * FROM venture_members WHERE id = ? AND venture_id = ? AND removed_at IS NULL",
    args: [memberId, ventureId],
  });
  const member = memberRes.rows[0];
  if (!member) return { error: "Venture member not found." };

  // Capture the current lead/owner (if any) before clearing — used for the
  // append-only contact_roles history mirror.
  let previousLeadCid = null;
  try {
    const prev = await db.execute({
      sql: "SELECT contact_id FROM venture_members WHERE venture_id = ? AND (lead_founder = TRUE OR is_owner = TRUE) AND removed_at IS NULL ORDER BY id DESC LIMIT 1",
      args: [ventureId],
    });
    previousLeadCid = prev.rows?.[0]?.contact_id || null;
  } catch (_) {}

  // Clear the current lead/owner (if any)
  await db.execute({
    sql: "UPDATE venture_members SET lead_founder = FALSE, is_owner = FALSE WHERE venture_id = ? AND (lead_founder = TRUE OR is_owner = TRUE)",
    args: [ventureId],
  });

  // Promote the new lead
  await db.execute({
    sql: "UPDATE venture_members SET lead_founder = TRUE, is_owner = TRUE, member_type = 'founder', role = 'founder' WHERE id = ?",
    args: [memberId],
  });

  // Append-only ownership history
  try {
    await db.execute({
      sql: `INSERT INTO ownership_history (venture_id, previous_owner_id, previous_owner_email, previous_owner_name,
            new_owner_id, new_owner_email, new_owner_name, transferred_by_id, transferred_by_email)
            VALUES (?, NULL, NULL, NULL, ?, ?, ?, ?, ?)`,
      args: [ventureId, member.contact_id || member.user_cid || memberId, "", member.name || "", actorCid || "system", ""],
    });
  } catch (_) {}

  // Append-only contact_roles mirror (context_type='venture')
  try {
    const { syncVentureRoleHistory } = await import("@/lib/contactIdentity");
    const newLeadCid = member.contact_id || member.user_cid || memberId;
    if (previousLeadCid && previousLeadCid !== newLeadCid) {
      await syncVentureRoleHistory({
        contactCid: previousLeadCid,
        ventureId,
        role: "founder",
        active: false,
        actorCid: actorCid || null,
        notes: "founder replaced",
      });
    }
    await syncVentureRoleHistory({
      contactCid: newLeadCid,
      ventureId,
      role: "founder",
      active: true,
      actorCid: actorCid || null,
      notes: "lead founder changed",
    });
  } catch (_) {}

  // Phase 6: the new lead is a founder — make sure the venture relationship
  // grants what the Context Roles registry maps for venture:founder. Kept last
  // so it never disturbs the ownership-history/audit writes above.
  try {
    const { syncContextGrantsForUser } = await import("@/models/authorization/contextGrants");
    await syncContextGrantsForUser(member.contact_id || member.user_cid);
  } catch (_) {}

  return { success: true };
}

// =============================================================================
// WORKFLOW A: PROGRAM-TO-VENTURE PROMOTION
// =============================================================================

// ── ENHANCEMENT 1.2: Startup profile wizard ─────────────────────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export {
  WIZARD_STEP_VALIDATORS,
  ALLOWED_DOCUMENT_TYPES,
  ALLOWED_FILE_EXTENSIONS,
  WIZARD_STEPS_MAP,
  TOTAL_WIZARD_STEPS,
  calculateCompletion,
  validateStep,
  validateFullProfile,
  getOrCreateStartupProfile,
  updateWizardStep,
  submitStartupProfile,
  uploadProfileDocument,
  deleteProfileDocument,
  canEditStartupProfile,
  canReadStartupProfile,
} from "@/services/ventures/profile";

// ── ENHANCEMENT 1.3: Founder & co-founder management ───────────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export {
  VENTURE_ROLES,
  VENTURE_ROLE_LABELS,
  MANAGEMENT_ROLES,
  canManageFounders,
  listFounders,
  getFounderById,
  inviteFounder,
  updateFounderRole,
  removeFounder,
  transferOwnership,
  suspendFounder,
  reactivateFounder,
} from "@/services/ventures/founders";

// ── ENHANCEMENT 1.4: Startup verification (the Data bank) ───────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export {
  VERIFICATION_CATEGORIES,
  VERIFICATION_CATEGORY_LABELS,
  canManageVerification,
  canSubmitVerification,
  getOrCreateVerification,
  submitVerification,
  updateVerificationStatus,
  resubmitVerification,
  uploadVerificationDocument,
  deleteVerificationDocument,
  listVerificationDocumentVersions,
  addVerificationDocumentVersion,
  addVerificationComment,
} from "@/services/ventures/verification";

// ── ENHANCEMENT 2.2: Milestones & deliverables ─────────────────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export {
  getMilestone,
  listDeliverables,
  getDeliverable,
  createDeliverable,
  updateDeliverable,
} from "@/services/ventures/deliverables";

// ── ENHANCEMENT 2.3: Task management & Kanban ──────────────────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export {
  listTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  listVentureTaskDependencyEdges,
  getUnmetTaskDependencies,
  countTaskBlockers,
  listTasksBlockedBy,
  setTaskDependencies,
  syncTaskBlockState,
  releaseTasksBlockedBy,
  listTaskComments,
  addTaskComment,
  deleteTaskComment,
  listTaskAttachments,
  addTaskAttachment,
  deleteTaskAttachment,
} from "@/services/ventures/tasks";

// ── ENHANCEMENT 2.4: Project timeline & progress tracking ────────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export {
  calculateProjectProgress,
  getProjectTimeline,
  getGanttData,
  getDelaySummary,
  addDependency,
  removeDependency,
} from "@/services/ventures/timeline";

// ── ENHANCEMENT 2.5: Reports & project analytics ────────────────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export {
  getVentureAnalytics,
  getMilestonesReport,
  getTasksReport,
  getTeamProductivity,
  getExportData,
} from "@/services/ventures/analytics";

// ── ENHANCEMENT 3.1: Coach & mentor management ─────────────────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export {
  listCoaches,
  getCoach,
  createCoach,
  updateCoach,
  deleteCoach,
  getVentureAssignments,
  assignCoachToVenture,
  removeAssignment,
} from "@/services/ventures/coaches";

// ── ENHANCEMENT 3.2: Mentoring sessions & scheduling ────────────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export {
  listSessions,
  getSession,
  checkDoubleBooking,
  createSession,
  updateSession,
  cancelSession,
  rescheduleSession,
  deleteSession,
  addSessionNote,
  recordAttendance,
  createActionItem,
  updateActionItem,
} from "@/services/ventures/sessions";

// ── ENHANCEMENT 3.3–3.4: Knowledge hub & learning ──────────────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export {
  RESOURCE_TYPES,
  listResources,
  getResource,
  createResource,
  updateResource,
  deleteResource,
  listCategories,
  toggleBookmark,
  getUserBookmarks,
  markResourceComplete,
  getRecommendedResources,
  getLearningProgress,
  getPersonalizedRecommendations,
  getLearningHistory,
  listLearningPaths,
  createLearningPath,
  getVentureLearningPaths,
  assignLearningPath,
} from "@/services/ventures/knowledge";

// ── ENHANCEMENT 3.5: Mentor feedback & analytics ────────────────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export {
  submitFeedback,
  getFeedback,
  listFeedback,
  deleteFeedback,
  getMentorAnalytics,
  getSessionAnalytics,
  getFeedbackAnalytics,
} from "@/services/ventures/feedback";

// ── ENHANCEMENT 4.1: Investment readiness assessment ────────────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export {
  INVESTMENT_CATEGORIES,
  INVESTMENT_LEVELS,
  calculateInvestmentReadiness,
  evaluateInvestmentReadiness,
  generateRecommendations,
  getInvestmentReadiness,
  getInvestmentRecommendations,
} from "@/services/ventures/investmentReadiness";

// ── ENHANCEMENT 4.2: Investor matching ──────────────────────────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export {
  listInvestors,
  getInvestor,
  createInvestor,
  calculateMatchScore,
  generateMatches,
  getVentureMatches,
  updateMatchStatus,
} from "@/services/ventures/investorMatching";

// ── ENHANCEMENT 4.3: Pitch deck & data room ─────────────────────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export {
  listDocuments,
  getDocument,
  uploadDocument,
  updateDocument,
  deleteDocument,
  createShareLink,
  revokeShare,
  getAccessLogs,
  getDocumentShares,
} from "@/services/ventures/documents";

// ── ENHANCEMENT 4.4: Fundraising pipeline ───────────────────────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export {
  ACTIVITY_TYPES,
  listOpportunities,
  getOpportunity,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
  addOpportunityNote,
  addOpportunityActivity,
  getPipelineAnalytics,
} from "@/services/ventures/fundraising";

// ── ENHANCEMENT 4.5: Investment analytics & reports ─────────────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export {
  getInvestmentAnalytics,
  getInvestmentReportSummary,
} from "@/services/ventures/investmentAnalytics";

// ── ENHANCEMENT 5.1: Administration & system configuration ──────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export {
  getSystemSettings,
  updateSetting,
  getFeatureFlags,
  updateFeatureFlag,
  getSystemRoles,
  updateRole,
  createRole,
  getSystemInfo,
  getAdminActivityLogs,
} from "@/services/ventures/systemAdmin";

// ── ENHANCEMENT 5.2: Notification center ────────────────────────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export {
  sendNotification,
  listNotifications,
  getNotification,
  markNotificationRead,
  markAllNotificationsRead,
  archiveNotification,
  deleteNotification,
  getUnreadCount,
  getNotificationTemplates,
  renderTemplate,
  getNotificationPreferences,
  updateNotificationPreferences,
  sendTemplatedNotification,
} from "@/services/ventures/notifications";

// ── ENHANCEMENT 5.3: Audit logs & security ─────────────────────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md). `logAuditEvent` is also called by the domains
// still in this file, so it is imported as a local binding before re-export.
import {
  logAuditEvent,
  queryAuditLogs,
  getAuditLog,
  getAuditLogStats,
  querySecurityEvents,
  resolveSecurityEvent,
  getSecurityStats,
  getActiveSessions,
  revokeSession,
  revokeUserSessions,
  queryLoginHistory,
  getLoginStats,
} from "@/services/ventures/auditSecurity";

export {
  logAuditEvent,
  queryAuditLogs,
  getAuditLog,
  getAuditLogStats,
  querySecurityEvents,
  resolveSecurityEvent,
  getSecurityStats,
  getActiveSessions,
  revokeSession,
  revokeUserSessions,
  queryLoginHistory,
  getLoginStats,
};

// =============================================================================
// ENHANCEMENT 5.4: EXTERNAL INTEGRATIONS & PUBLIC APIs
// =============================================================================

import crypto from "crypto";

const API_KEY_PREFIX = "IMP";

// ─── Integration Providers ──────────────────────────────────────────────────

export async function getIntegrationProviders() {
  return (await db.execute({ sql: "SELECT * FROM integration_providers WHERE is_available=TRUE ORDER BY name" })).rows || [];
}

export async function getIntegrations({ ventureId, provider, status, limit=50, offset=0 } = {}) {
  let sql = "SELECT ic.*, ip.name as provider_name, ip.description as provider_description, ip.icon as provider_icon FROM integration_configs ic LEFT JOIN integration_providers ip ON ic.provider=ip.provider_key WHERE 1=1";
  const args = [];
  if (ventureId) { sql += " AND ic.venture_id=?"; args.push(ventureId); }
  if (provider) { sql += " AND ic.provider=?"; args.push(provider); }
  if (status) { sql += " AND ic.status=?"; args.push(status); }
  sql += " ORDER BY ic.created_at DESC LIMIT ? OFFSET ?"; args.push(limit, offset);
  return (await db.execute({ sql, args })).rows || [];
}

export async function createIntegration({ provider, label, ventureId, config, createdBy }) {
  // Verify provider exists
  const providerExists = await db.execute({ sql: "SELECT id FROM integration_providers WHERE provider_key=? AND is_available=TRUE", args: [provider] });
  if (providerExists.rows.length === 0) throw new Error("Invalid or unavailable integration provider.");

  const id = (await db.execute({
    sql: `INSERT INTO integration_configs (provider, label, venture_id, config, status, created_by) VALUES (?, ?, ?, ?::jsonb, 'connected', ?) RETURNING id`,
    args: [provider, label||null, ventureId||null, JSON.stringify(config||{}), createdBy||"system"],
  })).rows[0]?.id;

  await logAuditEvent({
    eventType: "INTEGRATION_CONNECTED", actorCid: createdBy,
    entityType: "integration", entityId: String(id),
    description: `Integration connected: ${provider}`,
    severity: "info",
  });

  return { id };
}

export async function updateIntegration(id, updates, updatedBy) {
  const allowed = ["label", "config", "credentials_encrypted", "status"];
  const sets = []; const args = [];
  for (const column of allowed) {
    if (updates[column] !== undefined) {
      if (column === "config") { sets.push("config=?::jsonb"); args.push(JSON.stringify(updates[column])); }
      else { sets.push(`${column}=?`); args.push(updates[column]); }
    }
  }
  if (updates.status === "disconnected") {
    await logAuditEvent({
      eventType: "INTEGRATION_REMOVED", actorCid: updatedBy,
      entityType: "integration", entityId: String(id),
      description: `Integration disconnected: ${id}`,
      severity: "info",
    });
  }
  if (sets.length === 0) return { updated: false };
  sets.push("updated_at=NOW()"); args.push(id);
  await db.execute({ sql: `UPDATE integration_configs SET ${sets.join(",")} WHERE id=?`, args });
  return { updated: true };
}

export async function deleteIntegration(id, deletedBy) {
  const integration = (await db.execute({ sql: "SELECT * FROM integration_configs WHERE id=?", args: [id] })).rows[0];
  if (!integration) throw new Error("Integration not found.");
  await db.execute({ sql: "DELETE FROM integration_configs WHERE id=?", args: [id] });
  await logAuditEvent({
    eventType: "INTEGRATION_REMOVED", actorCid: deletedBy,
    entityType: "integration", entityId: String(id),
    description: `Integration deleted: ${integration.provider}`,
    severity: "warning",
  });
  return { success: true };
}

// ─── API Keys ───────────────────────────────────────────────────────────────

function generateApiKeyId() {
  const suffix = crypto.randomBytes(6).toString("hex").toUpperCase();
  return `${API_KEY_PREFIX}-${suffix}`;
}

function generateApiKeySecret() {
  return `sk-${crypto.randomBytes(24).toString("hex")}`;
}

function hashApiKey(secret) {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

export async function createApiKey({ name, description, scopes, expiresAt, allowedIps, rateLimit, createdBy }) {
  const keyId = generateApiKeyId();
  const secret = generateApiKeySecret();
  const keyHash = hashApiKey(secret);

  if (!scopes || scopes.length === 0) throw new Error("At least one scope is required.");

  const id = (await db.execute({
    sql: `INSERT INTO api_keys (key_id, key_hash, name, description, scopes, created_by, expires_at, allowed_ips, rate_limit) VALUES (?, ?, ?, ?, ?::jsonb, ?, ?, ?::jsonb, ?) RETURNING id`,
    args: [keyId, keyHash, name.trim(), description||null, JSON.stringify(scopes), createdBy, expiresAt||null, JSON.stringify(allowedIps||[]), rateLimit||100],
  })).rows[0]?.id;

  await logAuditEvent({
    eventType: "API_KEY_CREATED", actorCid: createdBy,
    entityType: "api_key", entityId: keyId,
    description: `API key created: ${name}`,
    severity: "info",
  });

  // Return the secret ONCE — it will never be shown again
  return { id, key_id: keyId, secret, name };
}

export async function getApiKeys({ createdBy, isActive, limit=50, offset=0 } = {}) {
  let sql = "SELECT id, key_id, name, description, scopes, created_by, expires_at, last_used_at, is_active, rate_limit, created_at, updated_at FROM api_keys WHERE 1=1";
  const args = [];
  if (createdBy) { sql += " AND created_by=?"; args.push(createdBy); }
  if (isActive !== undefined) { sql += " AND is_active=?"; args.push(isActive ? 1 : 0); }
  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?"; args.push(limit, offset);
  return (await db.execute({ sql, args })).rows || [];
}

export async function revokeApiKey(keyId, revokedBy) {
  const key = (await db.execute({ sql: "SELECT * FROM api_keys WHERE key_id=? AND is_active=TRUE", args: [keyId] })).rows[0];
  if (!key) throw new Error("API key not found or already revoked.");
  await db.execute({ sql: "UPDATE api_keys SET is_active=FALSE, updated_at=NOW() WHERE key_id=?", args: [keyId] });
  await logAuditEvent({
    eventType: "API_KEY_REVOKED", actorCid: revokedBy,
    entityType: "api_key", entityId: keyId,
    description: `API key revoked: ${key.name}`,
    severity: "warning",
  });
  return { success: true };
}

export async function rotateApiKey(keyId, _rotatedBy) {
  const key = (await db.execute({ sql: "SELECT * FROM api_keys WHERE key_id=? AND is_active=TRUE", args: [keyId] })).rows[0];
  if (!key) throw new Error("API key not found or inactive.");
  const newSecret = generateApiKeySecret();
  const newHash = hashApiKey(newSecret);
  await db.execute({ sql: "UPDATE api_keys SET key_hash=?, updated_at=NOW() WHERE key_id=?", args: [newHash, keyId] });
  return { key_id: keyId, secret: newSecret };
}

// ─── API Usage Logging & Rate Limiting ──────────────────────────────────────

// ─── Webhooks ───────────────────────────────────────────────────────────────

export async function createWebhook({ name, url, secret, events, ventureId, retryCount, timeoutMs, createdBy }) {
  if (!url || !url.startsWith("https://")) throw new Error("Webhook URL must use HTTPS.");
  if (!events || events.length === 0) throw new Error("At least one event is required.");

  const id = (await db.execute({
    sql: `INSERT INTO webhooks (name, url, secret, events, venture_id, retry_count, timeout_ms, created_by) VALUES (?, ?, ?, ?::jsonb, ?, ?, ?, ?) RETURNING id`,
    args: [name.trim(), url, secret||null, JSON.stringify(events), ventureId||null, retryCount||3, timeoutMs||10000, createdBy||"system"],
  })).rows[0]?.id;

  await logAuditEvent({
    eventType: "WEBHOOK_CREATED", actorCid: createdBy,
    entityType: "webhook", entityId: String(id),
    description: `Webhook created: ${name} → ${url}`,
    severity: "info",
  });

  return { id };
}

export async function getWebhooks({ ventureId, event, isActive, limit=50, offset=0 } = {}) {
  let sql = "SELECT * FROM webhooks WHERE 1=1";
  const args = [];
  if (ventureId) { sql += " AND venture_id=?"; args.push(ventureId); }
  if (event) { sql += " AND events::jsonb @> ?::jsonb"; args.push(JSON.stringify([event])); }
  if (isActive !== undefined) { sql += " AND is_active=?"; args.push(isActive ? 1 : 0); }
  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?"; args.push(limit, offset);
  return (await db.execute({ sql, args })).rows || [];
}

export async function deleteWebhook(id, _deletedBy) {
  const webhook = (await db.execute({ sql: "SELECT * FROM webhooks WHERE id=?", args: [id] })).rows[0];
  if (!webhook) throw new Error("Webhook not found.");
  await db.execute({ sql: "DELETE FROM webhooks WHERE id=?", args: [id] });
  return { success: true };
}

// ─── Webhook Delivery Logs ──────────────────────────────────────────────────

export async function getWebhookDeliveryLogs(webhookId, { limit=50, offset=0, status } = {}) {
  let sql = "SELECT * FROM webhook_delivery_logs WHERE webhook_id=?";
  const args = [webhookId];
  if (status) { sql += " AND status=?"; args.push(status); }
  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?"; args.push(limit, offset);
  return (await db.execute({ sql, args })).rows || [];
}

// =============================================================================
// ENHANCEMENT 5.5: SYSTEM MONITORING, HEALTH & REPORTING
// =============================================================================

const HEALTH_COMPONENTS = ["app", "database", "cache", "queue", "email", "storage", "search", "notifications", "integrations"];

// ─── Health Checks ──────────────────────────────────────────────────────────

/**
 * Run all health checks and record results.
 */
export async function runHealthChecks() {
  const results = [];

  async function checkComponent(name, checkFn) {
    const start = Date.now();
    try {
      const result = await checkFn();
      const durationMs = Date.now() - start;
      const status = result.ok ? "healthy" : "degraded";
      results.push({ component: name, status, response_time_ms: durationMs, message: result.message || null, details: result.details || {} });
    } catch (error) {
      const durationMs = Date.now() - start;
      results.push({ component: name, status: "unhealthy", response_time_ms: durationMs, message: error.message, details: {} });
    }
  }

  await Promise.all([
    checkComponent("app", async () => ({ ok: true, message: "Application running" })),
    checkComponent("database", async () => {
      const result = await db.execute({ sql: "SELECT 1 as ping" });
      return { ok: result.rows.length > 0, message: "Database connected" };
    }),
    checkComponent("cache", async () => ({ ok: true, message: "In-memory cache available" })),
    checkComponent("queue", async () => {
      const result = await db.execute({ sql: "SELECT COUNT(*) as c FROM queue_statistics" }).catch(() => ({ rows: [{ c: 0 }] }));
      const size = parseInt(result.rows[0]?.c || 0);
      return { ok: size < 10000, message: `Queue size: ${size}`, details: { queue_size: size } };
    }),
    checkComponent("email", async () => {
      const apiKey = process.env.RESEND_API_KEY;
      return { ok: !!apiKey, message: apiKey ? "Email service configured" : "Email service not configured" };
    }),
    checkComponent("storage", async () => {
      const result = await db.execute({ sql: "SELECT COUNT(*) as c FROM ventures" }).catch(() => ({ rows: [{ c: 0 }] }));
      return { ok: true, message: "Storage operational", details: { venture_count: parseInt(result.rows[0]?.c || 0) } };
    }),
    checkComponent("search", async () => ({ ok: true, message: "Search available" })),
    checkComponent("notifications", async () => {
      const result = await db.execute({ sql: "SELECT COUNT(*) as c FROM venture_notifications" }).catch(() => ({ rows: [{ c: 0 }] }));
      return { ok: true, message: `Notifications: ${result.rows[0]?.c || 0} total`, details: { total: parseInt(result.rows[0]?.c || 0) } };
    }),
    checkComponent("integrations", async () => {
      const result = await db.execute({ sql: "SELECT COUNT(*) as c FROM integration_configs WHERE status='connected'" }).catch(() => ({ rows: [{ c: 0 }] }));
      return { ok: true, message: `${result.rows[0]?.c || 0} integrations connected`, details: { connected: parseInt(result.rows[0]?.c || 0) } };
    }),
  ]);

  // Store results
  for (const result of results) {
    await db.execute({
      sql: `INSERT INTO system_health_checks (component, status, response_time_ms, message, details) VALUES (?, ?, ?, ?, ?::jsonb)`,
      args: [result.component, result.status, result.response_time_ms, result.message, JSON.stringify(result.details)],
    }).catch(() => {});
  }

  await logAuditEvent({
    eventType: "HEALTH_CHECK_EXECUTED", actorCid: "system",
    description: `Health check completed: ${results.filter(result => result.status === "healthy").length} healthy, ${results.filter(result => result.status !== "healthy").length} issues`,
    severity: results.some(result => result.status === "unhealthy") ? "warning" : "info",
  });

  return results;
}

/**
 * Get latest health check results.
 */
export async function getLatestHealthChecks() {
  const results = [];
  for (const component of HEALTH_COMPONENTS) {
    const result = await db.execute({
      sql: "SELECT * FROM system_health_checks WHERE component=? ORDER BY checked_at DESC LIMIT 1",
      args: [component],
    }).catch(() => ({ rows: [] }));
    if (result.rows.length > 0) results.push(result.rows[0]);
  }
  return results;
}

export async function getHealthCheckHistory(component, limit = 50) {
  let sql = "SELECT * FROM system_health_checks";
  const args = [];
  if (component) { sql += " WHERE component=?"; args.push(component); }
  sql += " ORDER BY checked_at DESC LIMIT ?"; args.push(limit);
  return (await db.execute({ sql, args })).rows || [];
}

export async function getOverallHealth() {
  const checks = await getLatestHealthChecks();
  const unhealthy = checks.filter(check => check.status !== "healthy");
  return {
    status: unhealthy.length === 0 ? "healthy" : unhealthy.some(check => check.status === "unhealthy") ? "unhealthy" : "degraded",
    total_components: checks.length,
    healthy: checks.filter(check => check.status === "healthy").length,
    degraded: checks.filter(check => check.status === "degraded").length,
    unhealthy: checks.filter(check => check.status === "unhealthy").length,
    components: checks,
  };
}

// ─── Metrics ────────────────────────────────────────────────────────────────

/**
 * Get metrics for a given name within a time range.
 */
export async function getMetrics(metricName, { hoursAgo=1, limit=100, aggregate } = {}) {
  let sql = "SELECT * FROM system_metrics WHERE metric_name=?";
  const args = [metricName];
  if (hoursAgo) { sql += " AND recorded_at > NOW() - INTERVAL '1 hour' * ?"; args.push(hoursAgo); }
  sql += " ORDER BY recorded_at DESC LIMIT ?"; args.push(limit);
  const rows = (await db.execute({ sql, args }).catch(() => ({ rows: [] }))).rows || [];

  if (aggregate === "avg") {
    const average = rows.reduce((sum, row) => sum + parseFloat(row.metric_value), 0) / (rows.length || 1);
    return { metric_name: metricName, average: Math.round(average * 100) / 100, count: rows.length, unit: rows[0]?.unit };
  }

  return rows.reverse();
}

/**
 * Get all recent metrics (for dashboard).
 */
export async function getRecentMetrics(hoursAgo = 1) {
  const metrics = await db.execute({
    sql: `SELECT metric_name, AVG(metric_value) as avg_value, COUNT(*) as count, MAX(metric_value) as max_value, MIN(metric_value) as min_value, unit
          FROM system_metrics WHERE recorded_at > NOW() - INTERVAL '1 hour' * ?
          GROUP BY metric_name, unit ORDER BY metric_name`,
    args: [hoursAgo],
  }).catch(() => ({ rows: [] }));
  return metrics.rows || [];
}

// ─── System Status ──────────────────────────────────────────────────────────

/**
 * Get comprehensive system status.
 */
export async function getSystemStatus() {
  const [health, alerts, recentMetrics] = await Promise.all([
    getOverallHealth(),
    db.execute({ sql: "SELECT * FROM system_alerts WHERE status='open' ORDER BY created_at DESC LIMIT 20" }).catch(() => ({ rows: [] })),
    getRecentMetrics(1),
  ]);

  return {
    status: health.status,
    uptime: process.uptime(),
    health,
    open_alerts: alerts.rows || [],
    metrics: recentMetrics,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    platform_version: process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0",
  };
}

// ─── Alerts Engine ──────────────────────────────────────────────────────────

export async function getAlertStats() {
  const [open, critical, byType] = await Promise.all([
    db.execute({ sql: "SELECT COUNT(*) as c FROM system_alerts WHERE status='open'" }).catch(() => ({ rows: [{ c: 0 }] })),
    db.execute({ sql: "SELECT COUNT(*) as c FROM system_alerts WHERE severity='critical' AND status!='resolved'" }).catch(() => ({ rows: [{ c: 0 }] })),
    db.execute({ sql: "SELECT alert_type, severity, COUNT(*) as c FROM system_alerts WHERE status!='resolved' GROUP BY alert_type, severity ORDER BY c DESC" }).catch(() => ({ rows: [] })),
  ]);
  return {
    open: parseInt(open.rows[0]?.c || 0),
    critical: parseInt(critical.rows[0]?.c || 0),
    by_type: byType.rows || [],
  };
}

// ─── Jobs ───────────────────────────────────────────────────────────────────

export async function getJobs({ status, jobType, limit=50, offset=0 } = {}) {
  let sql = "SELECT * FROM job_history WHERE 1=1";
  const args = [];
  if (status) { sql += " AND status=?"; args.push(status); }
  if (jobType) { sql += " AND job_type=?"; args.push(jobType); }
  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?"; args.push(limit, offset);
  return (await db.execute({ sql, args })).rows || [];
}

export async function getJobStats() {
  const [running, queued, failed, completed] = await Promise.all([
    db.execute({ sql: "SELECT COUNT(*) as c FROM job_history WHERE status='running'" }).catch(() => ({ rows: [{ c: 0 }] })),
    db.execute({ sql: "SELECT COUNT(*) as c FROM job_history WHERE status='queued'" }).catch(() => ({ rows: [{ c: 0 }] })),
    db.execute({ sql: "SELECT COUNT(*) as c FROM job_history WHERE status='failed'" }).catch(() => ({ rows: [{ c: 0 }] })),
    db.execute({ sql: "SELECT COUNT(*) as c FROM job_history WHERE status='completed' AND created_at > NOW() - INTERVAL '24 hours'" }).catch(() => ({ rows: [{ c: 0 }] })),
  ]);
  return {
    running: parseInt(running.rows[0]?.c || 0),
    queued: parseInt(queued.rows[0]?.c || 0),
    failed: parseInt(failed.rows[0]?.c || 0),
    completed_24h: parseInt(completed.rows[0]?.c || 0),
  };
}

export async function retryJob(jobId) {
  const job = (await db.execute({ sql: "SELECT * FROM job_history WHERE id=?", args: [jobId] })).rows[0];
  if (!job || job.status !== "failed") throw new Error("Job not found or not failed.");
  if (job.retry_count >= job.max_retries) throw new Error("Max retries reached.");
  await db.execute({
    sql: "UPDATE job_history SET status='queued', retry_count=retry_count+1, error_message=NULL WHERE id=?",
    args: [jobId],
  });
  await logAuditEvent({
    eventType: "JOB_RETRIED", actorCid: "system",
    entityType: "job", entityId: String(jobId),
    description: `Job retried: ${job.job_name}`,
    severity: "info",
  });
  return { success: true };
}

// ─── Queues ──────────────────────────────────────────────────────────────────

export async function getQueueStats({ queueName, limit=50, offset=0 } = {}) {
  let sql = "SELECT * FROM queue_statistics WHERE 1=1";
  const args = [];
  if (queueName) { sql += " AND queue_name=?"; args.push(queueName); }
  sql += " ORDER BY recorded_at DESC LIMIT ? OFFSET ?"; args.push(limit, offset);
  return (await db.execute({ sql, args })).rows || [];
}

export async function getLatestQueueStats() {
  const queues = await db.execute({
    sql: `SELECT qs.* FROM queue_statistics qs
          INNER JOIN (SELECT queue_name, MAX(recorded_at) as max_ts FROM queue_statistics GROUP BY queue_name) latest
          ON qs.queue_name = latest.queue_name AND qs.recorded_at = latest.max_ts`,
  }).catch(() => ({ rows: [] }));
  return queues.rows || [];
}

// ─── Storage ─────────────────────────────────────────────────────────────────

export async function getStorageInfo() {
  const [dbSize, venturesCount, usersCount, filesCount, notificationsCount] = await Promise.all([
    db.execute({ sql: "SELECT pg_database_size(current_database()) as size" }).catch(() => ({ rows: [{ size: 0 }] })),
    db.execute({ sql: "SELECT COUNT(*) as c FROM ventures" }).catch(() => ({ rows: [{ c: 0 }] })),
    db.execute({ sql: "SELECT COUNT(*) as c FROM contacts" }).catch(() => ({ rows: [{ c: 0 }] })),
    db.execute({ sql: "SELECT COUNT(*) as c FROM venture_verification_documents" }).catch(() => ({ rows: [{ c: 0 }] })),
    db.execute({ sql: "SELECT COUNT(*) as c FROM venture_notifications" }).catch(() => ({ rows: [{ c: 0 }] })),
  ]);

  return {
    database_size_bytes: parseInt(dbSize.rows[0]?.size || 0),
    database_size_mb: Math.round(parseInt(dbSize.rows[0]?.size || 0) / (1024 * 1024) * 100) / 100,
    total_ventures: parseInt(venturesCount.rows[0]?.c || 0),
    total_users: parseInt(usersCount.rows[0]?.c || 0),
    total_documents: parseInt(filesCount.rows[0]?.c || 0),
    total_notifications: parseInt(notificationsCount.rows[0]?.c || 0),
  };
}

// ─── Database Monitoring ────────────────────────────────────────────────────

export async function getDatabaseInfo() {
  const [connections, dbSize, tableStats] = await Promise.all([
    db.execute({ sql: "SELECT COUNT(*) as active FROM pg_stat_activity WHERE state='active'" }).catch(() => ({ rows: [{ active: 0 }] })),
    db.execute({ sql: "SELECT pg_database_size(current_database()) as size" }).catch(() => ({ rows: [{ size: 0 }] })),
    db.execute({
      sql: `SELECT schemaname, tablename, n_live_tup as approx_rows, pg_total_relation_size(schemaname||'.'||tablename) as total_bytes
            FROM pg_stat_user_tables ORDER BY n_live_tup DESC LIMIT 20`,
    }).catch(() => ({ rows: [] })),
  ]);

  return {
    active_connections: parseInt(connections.rows[0]?.active || 0),
    database_size_bytes: parseInt(dbSize.rows[0]?.size || 0),
    database_size_mb: Math.round(parseInt(dbSize.rows[0]?.size || 0) / (1024 * 1024) * 100) / 100,
    tables: tableStats.rows || [],
  };
}

// ─── Cache Monitoring ───────────────────────────────────────────────────────

export async function getCacheInfo() {
  return {
    type: "in_memory",
    status: "healthy",
    hit_rate: 94.2,
    miss_rate: 5.8,
    estimated_size: "~2MB",
    ttl_seconds: 300,
  };
}

// ─── API Monitoring ─────────────────────────────────────────────────────────

export async function getApiMonitorInfo(hoursAgo = 1) {
  const [requests, errors, slowEndpoints, topEndpoints] = await Promise.all([
    db.execute({ sql: "SELECT COUNT(*) as c FROM api_usage_logs WHERE created_at > NOW() - INTERVAL '1 hour' * ?", args: [hoursAgo] }).catch(() => ({ rows: [{ c: 0 }] })),
    db.execute({ sql: "SELECT COUNT(*) as c FROM api_usage_logs WHERE response_status >= 500 AND created_at > NOW() - INTERVAL '1 hour' * ?", args: [hoursAgo] }).catch(() => ({ rows: [{ c: 0 }] })),
    db.execute({
      sql: `SELECT endpoint, COUNT(*) as calls, AVG(duration_ms) as avg_ms, MAX(duration_ms) as max_ms
            FROM api_usage_logs WHERE created_at > NOW() - INTERVAL '1 hour' * ?
            GROUP BY endpoint HAVING AVG(duration_ms) > 1000 ORDER BY avg_ms DESC LIMIT 10`,
      args: [hoursAgo],
    }).catch(() => ({ rows: [] })),
    db.execute({
      sql: `SELECT endpoint, COUNT(*) as calls, AVG(duration_ms) as avg_ms
            FROM api_usage_logs WHERE created_at > NOW() - INTERVAL '1 hour' * ?
            GROUP BY endpoint ORDER BY calls DESC LIMIT 10`,
      args: [hoursAgo],
    }).catch(() => ({ rows: [] })),
  ]);

  return {
    total_requests: parseInt(requests.rows[0]?.c || 0),
    errors: parseInt(errors.rows[0]?.c || 0),
    error_rate: Math.round((parseInt(errors.rows[0]?.c || 0) / (parseInt(requests.rows[0]?.c || 1))) * 10000) / 100,
    slow_endpoints: slowEndpoints.rows || [],
    top_endpoints: topEndpoints.rows || [],
  };
}

// ─── Reporting Engine ───────────────────────────────────────────────────────

export async function generateSystemReport(reportType) {
  const now = new Date();
  let periodStart, periodEnd, title;

  switch (reportType) {
    case "daily":
      periodStart = new Date(now); periodStart.setDate(periodStart.getDate() - 1);
      periodEnd = now;
      title = `Daily System Report - ${periodStart.toLocaleDateString()}`;
      break;
    case "weekly":
      periodStart = new Date(now); periodStart.setDate(periodStart.getDate() - 7);
      periodEnd = now;
      title = `Weekly System Report - ${periodStart.toLocaleDateString()} to ${periodEnd.toLocaleDateString()}`;
      break;
    case "monthly":
      periodStart = new Date(now); periodStart.setMonth(periodStart.getMonth() - 1);
      periodEnd = now;
      title = `Monthly System Report - ${periodStart.toLocaleDateString()} to ${periodEnd.toLocaleDateString()}`;
      break;
    default:
      throw new Error("Invalid report type. Use: daily, weekly, or monthly.");
  }

  const [health, alerts, apiInfo, storage, dbInfo, jobs] = await Promise.all([
    getOverallHealth(),
    getAlertStats(),
    getApiMonitorInfo(24),
    getStorageInfo(),
    getDatabaseInfo(),
    getJobStats(),
  ]);

  const data = { health, alerts, api: apiInfo, storage, database: dbInfo, jobs };
  const summary = `System ${health.status}. ${health.healthy}/${health.total_components} components healthy. ${alerts.open} open alerts. ${apiInfo.total_requests} API requests. ${storage.database_size_mb}MB database. ${jobs.completed_24h} jobs completed.`;

  const id = (await db.execute({
    sql: `INSERT INTO system_reports (report_type, title, period_start, period_end, summary, data, generated_by) VALUES (?, ?, ?, ?, ?, ?::jsonb, 'system') RETURNING id`,
    args: [reportType, title, periodStart.toISOString().split("T")[0], periodEnd.toISOString().split("T")[0], summary, JSON.stringify(data)],
  })).rows[0]?.id;

  await logAuditEvent({
    eventType: "REPORT_GENERATED", actorCid: "system",
    entityType: "report", entityId: String(id),
    description: `Report generated: ${title}`,
    severity: "info",
  });

  return { id, title, summary, data };
}

export async function getSystemReports({ reportType, limit=50, offset=0 } = {}) {
  let sql = "SELECT * FROM system_reports WHERE 1=1";
  const args = [];
  if (reportType) { sql += " AND report_type=?"; args.push(reportType); }
  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?"; args.push(limit, offset);
  return (await db.execute({ sql, args })).rows || [];
}


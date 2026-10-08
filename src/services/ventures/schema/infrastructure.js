/**
 * External integrations, API keys, webhooks and system monitoring.
 *
 * One part of the Venture schema bootstrap; concatenated, in order, by
 * `../schema.js`. Statement order across parts is significant.
 */

export default [
// Retired integration objects — idempotent drops that converge an EXISTING
// database with the current shape. The service catalogue (integration_providers
// / integration_configs) and the Notion sync (notion_page_id) are gone; these
// statements remove them on the first self-heal and are no-ops afterwards.
"DROP TABLE IF EXISTS integration_configs",
"DROP TABLE IF EXISTS integration_providers",
"ALTER TABLE platform_form_submissions DROP COLUMN IF EXISTS notion_page_id",
// API keys & webhooks (Enhancement 5.4)
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
];

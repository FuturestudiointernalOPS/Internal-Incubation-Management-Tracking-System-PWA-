-- =============================================================================
-- IMPACTOS — VENTURE OS SYSTEM MONITORING, HEALTH & REPORTING
-- Enhancement 5.5 — System Monitoring, Health & Reporting
-- =============================================================================

-- Health check results (point-in-time health snapshots for each component)
CREATE TABLE IF NOT EXISTS system_health_checks (
    id SERIAL PRIMARY KEY,
    component TEXT NOT NULL, -- app | database | cache | queue | email | storage | search | notifications | integrations
    status TEXT NOT NULL, -- healthy | degraded | unhealthy
    response_time_ms INTEGER,
    message TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    checked_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_health_checks_component ON system_health_checks(component);
CREATE INDEX IF NOT EXISTS idx_system_health_checks_status ON system_health_checks(status);
CREATE INDEX IF NOT EXISTS idx_system_health_checks_checked_at ON system_health_checks(checked_at DESC);

-- Time-series metrics (arbitrary numerical measurements)
CREATE TABLE IF NOT EXISTS system_metrics (
    id SERIAL PRIMARY KEY,
    metric_name TEXT NOT NULL,
    metric_value DOUBLE PRECISION NOT NULL,
    unit TEXT,
    tags JSONB DEFAULT '{}'::jsonb,
    recorded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_metrics_name ON system_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_system_metrics_recorded_at ON system_metrics(recorded_at DESC);

-- Generated alerts (triggered by threshold violations or system events)
CREATE TABLE IF NOT EXISTS system_alerts (
    id SERIAL PRIMARY KEY,
    alert_type TEXT NOT NULL, -- cpu_high | memory_high | db_down | queue_overflow | email_failure | storage_full | api_error_spike | slow_response | system_alert
    severity TEXT NOT NULL, -- critical | warning | info
    title TEXT NOT NULL,
    message TEXT,
    metric_name TEXT,
    metric_value DOUBLE PRECISION,
    threshold DOUBLE PRECISION,
    status TEXT DEFAULT 'open', -- open | acknowledged | resolved
    acknowledged_by TEXT,
    acknowledged_at TIMESTAMP,
    resolved_by TEXT,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_alerts_type ON system_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_system_alerts_severity ON system_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_system_alerts_status ON system_alerts(status);
CREATE INDEX IF NOT EXISTS idx_system_alerts_created_at ON system_alerts(created_at DESC);

-- System reports (daily, weekly, monthly, and on-demand reports)
CREATE TABLE IF NOT EXISTS system_reports (
    id SERIAL PRIMARY KEY,
    report_type TEXT NOT NULL, -- daily | weekly | monthly | incident | performance | availability
    title TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    summary TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    generated_by TEXT,
    file_url TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_reports_type ON system_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_system_reports_period_start ON system_reports(period_start);
CREATE INDEX IF NOT EXISTS idx_system_reports_period_end ON system_reports(period_end);
CREATE INDEX IF NOT EXISTS idx_system_reports_created_at ON system_reports(created_at DESC);

-- Background job execution history
CREATE TABLE IF NOT EXISTS job_history (
    id SERIAL PRIMARY KEY,
    job_name TEXT NOT NULL,
    job_type TEXT NOT NULL,
    status TEXT NOT NULL, -- running | completed | failed | queued | retrying
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    duration_ms INTEGER,
    payload JSONB DEFAULT '{}'::jsonb,
    result JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_history_name ON job_history(job_name);
CREATE INDEX IF NOT EXISTS idx_job_history_type ON job_history(job_type);
CREATE INDEX IF NOT EXISTS idx_job_history_status ON job_history(status);
CREATE INDEX IF NOT EXISTS idx_job_history_created_at ON job_history(created_at DESC);

-- Queue monitoring snapshots
CREATE TABLE IF NOT EXISTS queue_statistics (
    id SERIAL PRIMARY KEY,
    queue_name TEXT NOT NULL,
    current_size INTEGER DEFAULT 0,
    processed_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    average_wait_ms INTEGER,
    average_process_ms INTEGER,
    recorded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_queue_statistics_name ON queue_statistics(queue_name);
CREATE INDEX IF NOT EXISTS idx_queue_statistics_recorded_at ON queue_statistics(recorded_at DESC);

-- Seed default alerts (resolved seed data to pre-populate known alert types)
INSERT INTO system_alerts (alert_type, severity, title, message, status) VALUES
    ('cpu_high', 'warning', '[Seed] CPU Usage Alert', 'CPU usage exceeded configured threshold', 'resolved'),
    ('memory_high', 'warning', '[Seed] Memory Usage Alert', 'Memory usage exceeded configured threshold', 'resolved'),
    ('db_down', 'critical', '[Seed] Database Unreachable', 'Database connection failed or timed out', 'resolved'),
    ('queue_overflow', 'warning', '[Seed] Queue Overflow Detected', 'Job queue has exceeded maximum capacity', 'resolved'),
    ('email_failure', 'warning', '[Seed] Email Delivery Failure', 'SMTP server returned an error for outbound email', 'resolved'),
    ('storage_full', 'critical', '[Seed] Storage Capacity Critical', 'Disk storage has reached critical usage level', 'resolved'),
    ('api_error_spike', 'warning', '[Seed] API Error Rate Spike', 'API endpoint error rate exceeded acceptable threshold', 'resolved'),
    ('slow_response', 'warning', '[Seed] Slow Response Time Detected', 'Component response time exceeded configured threshold', 'resolved'),
    ('system_alert', 'info', '[Seed] General System Alert', 'A general system event was detected', 'resolved')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- IMPACTOS — VENTURE OS EXTERNAL INTEGRATIONS & PUBLIC APIS
-- Enhancement 5.4 — External Integrations & Public APIs
-- =============================================================================

-- Integration providers reference table (metadata for available integrations)
CREATE TABLE IF NOT EXISTS integration_providers (
    id SERIAL PRIMARY KEY,
    provider_key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    is_available BOOLEAN DEFAULT TRUE,
    config_schema JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Integration configurations (connected third-party services)
CREATE TABLE IF NOT EXISTS integration_configs (
    id SERIAL PRIMARY KEY,
    provider TEXT NOT NULL,
    label TEXT,
    venture_id TEXT REFERENCES ventures(venture_id) ON DELETE CASCADE,
    config JSONB DEFAULT '{}'::jsonb,
    credentials_encrypted TEXT,
    status TEXT DEFAULT 'disconnected', -- disconnected | connected | error
    last_sync_at TIMESTAMP,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(venture_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_integration_configs_provider ON integration_configs(provider);
CREATE INDEX IF NOT EXISTS idx_integration_configs_venture ON integration_configs(venture_id);
CREATE INDEX IF NOT EXISTS idx_integration_configs_status ON integration_configs(status);

-- API keys for external access
CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    key_id TEXT NOT NULL UNIQUE, -- Format: IMP-XXXXXXXX
    key_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    scopes JSONB DEFAULT '[]'::jsonb,
    created_by TEXT NOT NULL,
    expires_at TIMESTAMP,
    last_used_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    allowed_ips JSONB DEFAULT '[]'::jsonb,
    rate_limit INTEGER DEFAULT 100,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_key_id ON api_keys(key_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_created_by ON api_keys(created_by);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);

-- Webhook endpoints
CREATE TABLE IF NOT EXISTS webhooks (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    secret TEXT,
    events JSONB DEFAULT '[]'::jsonb,
    venture_id TEXT REFERENCES ventures(venture_id),
    is_active BOOLEAN DEFAULT TRUE,
    retry_count INTEGER DEFAULT 3,
    timeout_ms INTEGER DEFAULT 10000,
    last_triggered_at TIMESTAMP,
    last_status TEXT,
    failure_count INTEGER DEFAULT 0,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_is_active ON webhooks(is_active);
CREATE INDEX IF NOT EXISTS idx_webhooks_venture_id ON webhooks(venture_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_created_by ON webhooks(created_by);

-- Webhook delivery logs (delivery tracking)
CREATE TABLE IF NOT EXISTS webhook_delivery_logs (
    id SERIAL PRIMARY KEY,
    webhook_id INTEGER REFERENCES webhooks(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB,
    response_status INTEGER,
    response_body TEXT,
    duration_ms INTEGER,
    status TEXT DEFAULT 'pending', -- pending | success | failed | retrying
    attempt INTEGER DEFAULT 1,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_delivery_logs_webhook ON webhook_delivery_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_logs_status ON webhook_delivery_logs(status);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_logs_created ON webhook_delivery_logs(created_at DESC);

-- API usage logs (rate limiting and usage tracking)
CREATE TABLE IF NOT EXISTS api_usage_logs (
    id SERIAL PRIMARY KEY,
    api_key_id INTEGER,
    endpoint TEXT NOT NULL,
    method TEXT,
    ip_address TEXT,
    response_status INTEGER,
    duration_ms INTEGER,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_logs_key ON api_usage_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_created ON api_usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_ip ON api_usage_logs(ip_address);

-- Seed default integration providers
INSERT INTO integration_providers (provider_key, name, description, icon, is_available, config_schema) VALUES
    ('google_calendar', 'Google Calendar', 'Sync venture milestones, sessions, and deadlines with Google Calendar', 'google-calendar', TRUE,
     '{"type":"object","properties":{"calendar_id":{"type":"string"},"sync_direction":{"type":"string","enum":["bidirectional","import","export"],"default":"bidirectional"},"auto_sync":{"type":"boolean","default":true}}}'::jsonb),
    ('google_drive', 'Google Drive', 'Attach files and manage documents directly from Google Drive', 'google-drive', TRUE,
     '{"type":"object","properties":{"root_folder_id":{"type":"string"},"auto_backup":{"type":"boolean","default":false}}}'::jsonb),
    ('microsoft_outlook', 'Microsoft Outlook', 'Sync venture events and email notifications with Outlook calendar', 'microsoft-outlook', TRUE,
     '{"type":"object","properties":{"calendar_id":{"type":"string"},"sync_direction":{"type":"string","enum":["bidirectional","import","export"],"default":"bidirectional"},"auto_sync":{"type":"boolean","default":true}}}'::jsonb),
    ('slack', 'Slack', 'Post notifications and updates to Slack channels', 'slack', TRUE,
     '{"type":"object","properties":{"workspace":{"type":"string"},"channel":{"type":"string"},"notify_on":{"type":"array","items":{"type":"string"},"default":["milestone","task_update","announcement","session"]}}}'::jsonb),
    ('zoom', 'Zoom', 'Create and manage Zoom meetings for venture sessions and events', 'zoom', TRUE,
     '{"type":"object","properties":{"default_duration":{"type":"integer","default":60},"auto_record":{"type":"boolean","default":false},"default_settings":{"type":"object","properties":{"mute_on_entry":{"type":"boolean","default":true},"waiting_room":{"type":"boolean","default":true}}}}}'::jsonb),
    ('microsoft_teams', 'Microsoft Teams', 'Create Teams meetings and post updates to channels', 'microsoft-teams', TRUE,
     '{"type":"object","properties":{"tenant_id":{"type":"string"},"team_id":{"type":"string"},"channel_id":{"type":"string"},"notify_on":{"type":"array","items":{"type":"string"},"default":["milestone","announcement","session"]}}}'::jsonb)
ON CONFLICT (provider_key) DO NOTHING;

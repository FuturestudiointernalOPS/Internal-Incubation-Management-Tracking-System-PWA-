-- =============================================================================
-- IMPACTOS — VENTURE OS NOTIFICATION CENTER & COMMUNICATION
-- Enhancement 5.2 — Notification Center
-- =============================================================================

-- Notifications (existing v2_notifications may be used, we extend with a venture-specific table)
CREATE TABLE IF NOT EXISTS venture_notifications (
    id SERIAL PRIMARY KEY,
    recipient_id TEXT NOT NULL,
    recipient_type TEXT DEFAULT 'user', -- user | venture | all
    venture_id TEXT REFERENCES ventures(venture_id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'system',
    title TEXT NOT NULL,
    body TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'unread', -- unread | read | archived | dismissed
    priority TEXT DEFAULT 'normal', -- low | normal | high | urgent
    source TEXT,
    source_id TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    read_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_venture_notifications_recipient ON venture_notifications(recipient_id, status);
CREATE INDEX IF NOT EXISTS idx_venture_notifications_type ON venture_notifications(type);
CREATE INDEX IF NOT EXISTS idx_venture_notifications_created ON venture_notifications(created_at DESC);

-- Notification templates
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

-- User notification preferences
CREATE TABLE IF NOT EXISTS venture_notification_preferences (
    id SERIAL PRIMARY KEY,
    user_cid TEXT NOT NULL UNIQUE,
    email TEXT,
    phone TEXT,
    preferences JSONB DEFAULT '{}'::jsonb,
    -- { "type": { "in_app": true, "email": false, "sms": false }, ... }
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    digest_frequency TEXT DEFAULT 'realtime', -- realtime | hourly | daily | weekly
    language TEXT DEFAULT 'en',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Delivery logs
CREATE TABLE IF NOT EXISTS venture_notification_delivery_logs (
    id SERIAL PRIMARY KEY,
    notification_id INTEGER REFERENCES venture_notifications(id) ON DELETE CASCADE,
    channel TEXT NOT NULL, -- in_app | email | sms | push
    status TEXT DEFAULT 'pending', -- pending | sent | failed | delivered
    error_message TEXT,
    delivered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Seed default templates
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

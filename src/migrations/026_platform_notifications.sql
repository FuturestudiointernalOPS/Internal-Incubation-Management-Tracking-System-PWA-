-- =============================================================================
-- MODULE 5 — PLATFORM NOTIFICATIONS TABLE
-- In-app notifications for platform users
-- =============================================================================

CREATE TABLE IF NOT EXISTS platform_notifications (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  action_url TEXT,
  type TEXT DEFAULT 'info',
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_notif_user ON platform_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_notif_read ON platform_notifications(user_id, read);

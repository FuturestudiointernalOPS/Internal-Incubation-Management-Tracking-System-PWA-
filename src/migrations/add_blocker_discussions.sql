-- Ticket 1.9 / Blocker Discussions
-- Adds blocker_id to v2_messages so blocker discussions integrate with Messages

ALTER TABLE v2_messages ADD COLUMN IF NOT EXISTS blocker_id INTEGER REFERENCES blockers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_v2_messages_blocker_id ON v2_messages(blocker_id);

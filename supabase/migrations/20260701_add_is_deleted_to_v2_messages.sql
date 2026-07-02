-- Add soft-delete support to v2_messages (M7 Messagerie Interne)
ALTER TABLE v2_messages ADD COLUMN IF NOT EXISTS is_deleted INTEGER DEFAULT 0;

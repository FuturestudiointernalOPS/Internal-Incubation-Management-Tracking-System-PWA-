-- Migration: Message Attachments (Ticket 4.1 Module 4)
-- Adds attachment_url and attachment_name columns to v2_messages
-- Supports Documents, Images, and Reference URLs in messages.

ALTER TABLE v2_messages ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE v2_messages ADD COLUMN IF NOT EXISTS attachment_name TEXT;

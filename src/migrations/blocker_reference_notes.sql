-- Migration: add reference_url and notes columns to blockers table
-- Ticket: Module 2, Ticket 2.3 — Blocker Management
-- Rules: 20 (blocker fields), applied against live Supabase DB

ALTER TABLE blockers ADD COLUMN IF NOT EXISTS reference_url TEXT;
ALTER TABLE blockers ADD COLUMN IF NOT EXISTS notes TEXT;

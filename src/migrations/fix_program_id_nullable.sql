-- Run this SQL in your Supabase Dashboard SQL Editor
-- Fix: Remove NOT NULL constraint from v2_projects.program_id
-- so internal projects can be created without linking to a program.

ALTER TABLE v2_projects ALTER COLUMN program_id DROP NOT NULL;

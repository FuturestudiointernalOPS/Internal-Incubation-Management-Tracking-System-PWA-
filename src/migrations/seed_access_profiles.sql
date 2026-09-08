-- =============================================================================
-- SEED DEFAULT ACCESS PROFILES
-- =============================================================================
-- Creates default profiles for every existing role, plus common staff profiles.
-- Run AFTER access_profiles.sql
-- =============================================================================

BEGIN;

-- ─── 1. UPSERT DEFAULT PROFILES ───

-- Super Admin: full access to everything
INSERT INTO access_profiles (name, description)
VALUES ('Super Admin Default', 'Full system access — all modules, all capabilities')
ON CONFLICT (name) DO NOTHING;

-- Staff Base: general staff baseline
INSERT INTO access_profiles (name, description)
VALUES ('Staff Default', 'Standard staff access — projects, messaging, reports')
ON CONFLICT (name) DO NOTHING;

-- Participant: limited to their programs
INSERT INTO access_profiles (name, description)
VALUES ('Participant Default', 'Participant access — own programs, assignments, messaging')
ON CONFLICT (name) DO NOTHING;

-- Developer: engineering-focused
INSERT INTO access_profiles (name, description)
VALUES ('Developer', 'Engineering access — tasks, standups, retros, projects')
ON CONFLICT (name) DO NOTHING;

-- Developer Intern: restricted engineering access
INSERT INTO access_profiles (name, description)
VALUES ('Developer Intern', 'Restricted engineering access — own tasks, standups, retros')
ON CONFLICT (name) DO NOTHING;

-- Program Manager: program oversight + reporting
INSERT INTO access_profiles (name, description)
VALUES ('Program Manager', 'Program management — programs, participants, reports, communications')
ON CONFLICT (name) DO NOTHING;

-- Project Owner: project-level access
INSERT INTO access_profiles (name, description)
VALUES ('Project Owner', 'Project management — own projects, tasks, team reporting')
ON CONFLICT (name) DO NOTHING;

-- Operations Manager: ops + finance + CRM
INSERT INTO access_profiles (name, description)
VALUES ('Operations Manager', 'Operations — programs, finance, CRM, reports')
ON CONFLICT (name) DO NOTHING;

-- Teacher/Instructor: program delivery
INSERT INTO access_profiles (name, description)
VALUES ('Instructor', 'Program delivery — programs, grading, communication')
ON CONFLICT (name) DO NOTHING;

-- Finance Assistant: finance-only access
INSERT INTO access_profiles (name, description)
VALUES ('Finance Assistant', 'Finance operations — view/create/edit finance data')
ON CONFLICT (name) DO NOTHING;

-- Mentor: limited program + messaging access
INSERT INTO access_profiles (name, description)
VALUES ('Mentor', 'Mentor access — participant progress, messaging')
ON CONFLICT (name) DO NOTHING;

-- ─── 2. MAP ROLES TO DEFAULT PROFILES ───

-- Insert role→profile defaults (only if role doesn't have a mapping yet)
INSERT INTO role_access_profile_defaults (role_name, access_profile_id)
SELECT 'super_admin', id FROM access_profiles WHERE name = 'Super Admin Default'
ON CONFLICT (role_name) DO NOTHING;

INSERT INTO role_access_profile_defaults (role_name, access_profile_id)
SELECT 'staff', id FROM access_profiles WHERE name = 'Staff Default'
ON CONFLICT (role_name) DO NOTHING;

INSERT INTO role_access_profile_defaults (role_name, access_profile_id)
SELECT 'participant', id FROM access_profiles WHERE name = 'Participant Default'
ON CONFLICT (role_name) DO NOTHING;

INSERT INTO role_access_profile_defaults (role_name, access_profile_id)
SELECT 'developer', id FROM access_profiles WHERE name = 'Developer'
ON CONFLICT (role_name) DO NOTHING;

INSERT INTO role_access_profile_defaults (role_name, access_profile_id)
SELECT 'program_manager', id FROM access_profiles WHERE name = 'Program Manager'
ON CONFLICT (role_name) DO NOTHING;

INSERT INTO role_access_profile_defaults (role_name, access_profile_id)
SELECT 'teacher', id FROM access_profiles WHERE name = 'Instructor'
ON CONFLICT (role_name) DO NOTHING;

INSERT INTO role_access_profile_defaults (role_name, access_profile_id)
SELECT 'admin', id FROM access_profiles WHERE name = 'Staff Default'
ON CONFLICT (role_name) DO NOTHING;

INSERT INTO role_access_profile_defaults (role_name, access_profile_id)
SELECT 'investor', id FROM access_profiles WHERE name = 'Mentor'
ON CONFLICT (role_name) DO NOTHING;

INSERT INTO role_access_profile_defaults (role_name, access_profile_id)
SELECT 'mentor', id FROM access_profiles WHERE name = 'Mentor'
ON CONFLICT (role_name) DO NOTHING;

COMMIT;

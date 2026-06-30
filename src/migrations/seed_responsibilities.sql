-- =============================================================================
-- SEED DEFAULT RESPONSIBILITIES
-- =============================================================================
-- Run AFTER responsibilities.sql
-- =============================================================================

BEGIN;

-- Core responsibilities
INSERT INTO responsibilities (name, key, description, icon) VALUES
  ('Engineering', 'engineering', 'Engineering operations — tasks, standups, retros, error logs', 'Wrench'),
  ('Program Management', 'program_management', 'Program oversight — programs, participants, submissions', 'Briefcase'),
  ('Project Ownership', 'project_ownership', 'Project management — projects, tasks, team reporting', 'Rocket'),
  ('Operations', 'operations', 'Internal operations — workspace, reports, CRM', 'Settings'),
  ('Communications', 'communications', 'Messaging, campaigns, contacts, forms', 'Send'),
  ('Finance', 'finance', 'Financial operations — budgets, reports', 'BarChart3'),
  ('Reporting', 'reporting', 'Reports and analytics', 'BarChart3'),
  ('Knowledge Base', 'knowledge_base', 'Knowledge management', 'Library'),
  ('Intelligence', 'intelligence', 'Business intelligence and trends', 'TrendingUp'),
  ('User Management', 'user_management', 'User administration — personnel, permissions', 'Users'),
  ('System Settings', 'system_settings', 'System configuration', 'Settings')
ON CONFLICT (key) DO NOTHING;

-- Assign default responsibilities to roles (for backward compatibility)
-- Super Admin gets everything
INSERT INTO user_responsibilities (user_cid, responsibility_id, assigned_by)
SELECT cid, r.id, 'seed'
FROM contacts, responsibilities r
WHERE role = 'super_admin'
  AND r.key IN ('engineering', 'program_management', 'project_ownership', 'operations',
                'communications', 'finance', 'reporting', 'knowledge_base',
                'intelligence', 'user_management', 'system_settings')
ON CONFLICT DO NOTHING;

-- Staff get core responsibilities
INSERT INTO user_responsibilities (user_cid, responsibility_id, assigned_by)
SELECT cid, r.id, 'seed'
FROM contacts, responsibilities r
WHERE role = 'staff'
  AND r.key IN ('engineering', 'project_ownership', 'communications', 'reporting')
ON CONFLICT DO NOTHING;

-- Developer gets engineering + project ownership
INSERT INTO user_responsibilities (user_cid, responsibility_id, assigned_by)
SELECT cid, r.id, 'seed'
FROM contacts, responsibilities r
WHERE role = 'developer'
  AND r.key IN ('engineering', 'project_ownership')
ON CONFLICT DO NOTHING;

-- Program Manager gets program management + communications + reporting
INSERT INTO user_responsibilities (user_cid, responsibility_id, assigned_by)
SELECT cid, r.id, 'seed'
FROM contacts, responsibilities r
WHERE role = 'program_manager'
  AND r.key IN ('program_management', 'communications', 'reporting')
ON CONFLICT DO NOTHING;

-- Teacher gets program management + communications
INSERT INTO user_responsibilities (user_cid, responsibility_id, assigned_by)
SELECT cid, r.id, 'seed'
FROM contacts, responsibilities r
WHERE role = 'teacher'
  AND r.key IN ('program_management', 'communications')
ON CONFLICT DO NOTHING;

-- Admin gets operations + user management + system settings
INSERT INTO user_responsibilities (user_cid, responsibility_id, assigned_by)
SELECT cid, r.id, 'seed'
FROM contacts, responsibilities r
WHERE role = 'admin'
  AND r.key IN ('operations', 'user_management', 'system_settings', 'reporting')
ON CONFLICT DO NOTHING;

COMMIT;

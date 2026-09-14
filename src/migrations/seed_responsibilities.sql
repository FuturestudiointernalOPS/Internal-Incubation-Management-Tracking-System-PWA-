-- =============================================================================
-- SEED DEFAULT RESPONSIBILITIES
-- =============================================================================
-- Run AFTER responsibilities.sql
-- FEATURES = the dashboard sections; responsibilities mirror them.
-- =============================================================================

BEGIN;

-- Core responsibilities (one per dashboard section)
INSERT INTO responsibilities (name, key, description, icon) VALUES
  ('CRM', 'crm', 'People, contacts, timeline, membership, duplicates', 'Users'),
  ('Communication', 'communication', 'Messaging, announcements, forms — outreach suite', 'Send'),
  ('Programs', 'programs', 'Program oversight — programs, participants, submissions', 'Briefcase'),
  ('Ventures', 'ventures', 'Venture management — portfolio and registrations', 'Rocket'),
  ('Investors', 'investors', 'Investor management — records, reviews, campaigns', 'TrendingUp'),
  ('Finance', 'finance', 'Financial operations — budgets, reports', 'BarChart3'),
  ('Operations', 'operations', 'Internal operations — projects, tasks, standups, retros', 'Settings'),
  ('Reports', 'reports', 'Reports and analytics', 'BarChart3'),
  ('Knowledge', 'knowledge', 'Knowledge management', 'Library'),
  ('LMS', 'lms', 'Course management — create and maintain courses', 'GraduationCap'),
  ('Security', 'security', 'User administration — personnel, permissions', 'Users'),
  ('Settings', 'settings', 'System configuration and engineering operations', 'Settings')
ON CONFLICT (key) DO NOTHING;

-- Assign default responsibilities to roles (for backward compatibility)
-- Super Admin gets everything
INSERT INTO user_responsibilities (user_cid, responsibility_id, assigned_by)
SELECT cid, r.id, 'seed'
FROM contacts, responsibilities r
WHERE role = 'super_admin'
  AND r.key IN ('crm', 'communication', 'programs', 'ventures', 'investors',
                'finance', 'operations', 'reports', 'knowledge', 'lms',
                'security', 'settings')
ON CONFLICT DO NOTHING;

-- Staff get core responsibilities
INSERT INTO user_responsibilities (user_cid, responsibility_id, assigned_by)
SELECT cid, r.id, 'seed'
FROM contacts, responsibilities r
WHERE role = 'staff'
  AND r.key IN ('crm', 'operations', 'reports', 'settings')
ON CONFLICT DO NOTHING;

-- Developer gets operations + settings
INSERT INTO user_responsibilities (user_cid, responsibility_id, assigned_by)
SELECT cid, r.id, 'seed'
FROM contacts, responsibilities r
WHERE role = 'developer'
  AND r.key IN ('operations', 'settings')
ON CONFLICT DO NOTHING;

-- Program Manager gets programs + crm + reports
INSERT INTO user_responsibilities (user_cid, responsibility_id, assigned_by)
SELECT cid, r.id, 'seed'
FROM contacts, responsibilities r
WHERE role = 'program_manager'
  AND r.key IN ('programs', 'crm', 'reports')
ON CONFLICT DO NOTHING;

-- Teacher gets programs + crm
INSERT INTO user_responsibilities (user_cid, responsibility_id, assigned_by)
SELECT cid, r.id, 'seed'
FROM contacts, responsibilities r
WHERE role = 'teacher'
  AND r.key IN ('programs', 'crm')
ON CONFLICT DO NOTHING;

-- Admin gets operations + security + settings + reports
INSERT INTO user_responsibilities (user_cid, responsibility_id, assigned_by)
SELECT cid, r.id, 'seed'
FROM contacts, responsibilities r
WHERE role = 'admin'
  AND r.key IN ('operations', 'security', 'settings', 'reports')
ON CONFLICT DO NOTHING;

COMMIT;

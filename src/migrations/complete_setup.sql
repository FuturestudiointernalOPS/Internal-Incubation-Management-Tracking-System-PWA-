-- =============================================================================
-- COMPLETE SETUP — Run this entire block once in Supabase SQL Editor
-- All statements use IF NOT EXISTS to prevent errors on re-run
-- =============================================================================

-- ─── 1. Authorization Tables ───
CREATE TABLE IF NOT EXISTS role_capabilities (
    id SERIAL PRIMARY KEY,
    role TEXT NOT NULL,
    module TEXT NOT NULL,
    capability TEXT NOT NULL,
    access_level INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(role, module, capability)
);

CREATE TABLE IF NOT EXISTS group_capabilities (
    id SERIAL PRIMARY KEY,
    group_name TEXT NOT NULL,
    module TEXT NOT NULL,
    capability TEXT NOT NULL,
    access_level INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(group_name, module, capability)
);

CREATE TABLE IF NOT EXISTS user_capabilities (
    id SERIAL PRIMARY KEY,
    user_cid TEXT NOT NULL REFERENCES contacts(cid) ON DELETE CASCADE,
    module TEXT NOT NULL,
    capability TEXT NOT NULL,
    access_level INTEGER NOT NULL DEFAULT 1,
    granted_by TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_cid, module, capability)
);

CREATE TABLE IF NOT EXISTS user_capability_restrictions (
    id SERIAL PRIMARY KEY,
    user_cid TEXT NOT NULL REFERENCES contacts(cid) ON DELETE CASCADE,
    module TEXT NOT NULL,
    capability TEXT NOT NULL,
    restricted_by TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_cid, module, capability)
);

CREATE TABLE IF NOT EXISTS permission_audit_log (
    id SERIAL PRIMARY KEY,
    actor_cid TEXT NOT NULL,
    actor_name TEXT,
    target_cid TEXT NOT NULL,
    target_name TEXT,
    action TEXT NOT NULL,
    module TEXT,
    capability TEXT,
    previous_value TEXT,
    new_value TEXT,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── 2. Multi-Group Membership Table ───
CREATE TABLE IF NOT EXISTS user_groups (
    id SERIAL PRIMARY KEY,
    user_cid TEXT NOT NULL REFERENCES contacts(cid) ON DELETE CASCADE,
    group_name TEXT NOT NULL,
    role_in_group TEXT DEFAULT 'member',
    assigned_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_cid, group_name)
);

-- ─── 3. Tasks: Priority Column ───
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium';

-- Only add constraint if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_priority_check') THEN
    ALTER TABLE tasks ADD CONSTRAINT tasks_priority_check
      CHECK (priority IN ('critical', 'high', 'medium', 'low'));
  END IF;
END $$;

-- ─── 4. Error Logs: Enhanced Columns ───
ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS page TEXT;
ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS action_attempted TEXT;
ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS task_id INTEGER;
ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS user_role TEXT;
ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS occurrence_count INTEGER DEFAULT 1;
ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS fingerprint TEXT;

-- ─── 5. Update Severity Constraint ───
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'error_logs_severity_check') THEN
    ALTER TABLE error_logs DROP CONSTRAINT error_logs_severity_check;
  END IF;
END $$;

ALTER TABLE error_logs ADD CONSTRAINT error_logs_severity_check
  CHECK (severity IN ('info', 'warning', 'error', 'critical', 'fatal'));

-- ─── 6. Indexes ───
CREATE INDEX IF NOT EXISTS idx_perm_audit_actor ON permission_audit_log(actor_cid);
CREATE INDEX IF NOT EXISTS idx_perm_audit_target ON permission_audit_log(target_cid);
CREATE INDEX IF NOT EXISTS idx_perm_audit_created ON permission_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_user_caps_lookup ON user_capabilities(user_cid, module, capability);
CREATE INDEX IF NOT EXISTS idx_user_restr_lookup ON user_capability_restrictions(user_cid, module, capability);
CREATE INDEX IF NOT EXISTS idx_role_caps_lookup ON role_capabilities(role, module, capability);
CREATE INDEX IF NOT EXISTS idx_group_caps_lookup ON group_capabilities(group_name, module, capability);
CREATE INDEX IF NOT EXISTS idx_user_groups_cid ON user_groups(user_cid);
CREATE INDEX IF NOT EXISTS idx_user_groups_name ON user_groups(group_name);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_priority ON tasks(assigned_to, priority);
CREATE INDEX IF NOT EXISTS idx_error_logs_task_id ON error_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_category ON error_logs(category);
CREATE INDEX IF NOT EXISTS idx_error_logs_fingerprint ON error_logs(fingerprint);

-- ─── 7. Assign testerp@gmail.com to Intern group ───
INSERT INTO user_groups (user_cid, group_name, assigned_by)
SELECT cid, 'FUTURE STUDIO INTERNS', 'admin'
FROM contacts
WHERE email = 'testerp@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM user_groups WHERE user_cid = contacts.cid AND group_name = 'FUTURE STUDIO INTERNS'
  );

UPDATE contacts SET group_name = 'FUTURE STUDIO INTERNS'
WHERE email = 'testerp@gmail.com'
  AND (group_name IS NULL OR group_name = '' OR group_name = 'unassigned');

-- ─── 8. Merge Existing Duplicate Errors ───
UPDATE error_logs e
SET occurrence_count = sub.cnt,
    fingerprint = sub.fingerprint
FROM (
  SELECT MIN(id) as keep_id, COUNT(*) as cnt,
         message || '|' || COALESCE(page, 'unknown') as fingerprint
  FROM error_logs
  GROUP BY message, page
  HAVING COUNT(*) > 1
) sub
WHERE e.id = sub.keep_id;

DELETE FROM error_logs
WHERE id NOT IN (
  SELECT MIN(id) FROM error_logs GROUP BY message, page
);


-- ─── 9. Task Link Column ───
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS link TEXT;

-- ─── 10. Access Profiles System ───
CREATE TABLE IF NOT EXISTS access_profiles (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS access_profile_capabilities (
    id SERIAL PRIMARY KEY,
    profile_id INTEGER NOT NULL REFERENCES access_profiles(id) ON DELETE CASCADE,
    module TEXT NOT NULL,
    capability TEXT NOT NULL,
    access_level INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(profile_id, module, capability)
);

CREATE TABLE IF NOT EXISTS role_access_profile_defaults (
    id SERIAL PRIMARY KEY,
    role_name TEXT NOT NULL UNIQUE,
    access_profile_id INTEGER NOT NULL REFERENCES access_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS access_profile_id INTEGER REFERENCES access_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profile_caps_lookup ON access_profile_capabilities(profile_id, module, capability);

-- ─── 11. Responsibilities System ───
CREATE TABLE IF NOT EXISTS responsibilities (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    key TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    icon TEXT DEFAULT '',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_responsibilities (
    id SERIAL PRIMARY KEY,
    user_cid TEXT NOT NULL REFERENCES contacts(cid) ON DELETE CASCADE,
    responsibility_id INTEGER NOT NULL REFERENCES responsibilities(id) ON DELETE CASCADE,
    assigned_by TEXT,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_cid, responsibility_id)
);

CREATE INDEX IF NOT EXISTS idx_user_resp_cid ON user_responsibilities(user_cid);
CREATE INDEX IF NOT EXISTS idx_user_resp_id ON user_responsibilities(responsibility_id);

-- ─── 12. Groups Master Table with Defaults ───
CREATE TABLE IF NOT EXISTS groups (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    access_profile_id INTEGER REFERENCES access_profiles(id) ON DELETE SET NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS group_default_responsibilities (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    responsibility_id INTEGER NOT NULL REFERENCES responsibilities(id) ON DELETE CASCADE,
    UNIQUE(group_id, responsibility_id)
);

CREATE INDEX IF NOT EXISTS idx_group_defaults_group ON group_default_responsibilities(group_id);

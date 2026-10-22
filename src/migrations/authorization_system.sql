-- =============================================================================
-- AUTHORIZATION SYSTEM: Roles, Groups, Capabilities, Permissions
-- =============================================================================
-- This migration adds the complete authorization layer:
--   1. group_capabilities — default permissions per group
--   2. user_capabilities — individual permission grants (with optional expiry)
--   3. user_capability_restrictions — individual permission denials
--   4. permission_audit_log — immutable audit trail for all permission changes
--
-- The legacy role_capabilities table is NOT created: a role names a default
-- PROFILE, and that profile carries the base capabilities.
-- =============================================================================

BEGIN;

-- 1. Group Capabilities (default permissions for each group)
CREATE TABLE IF NOT EXISTS group_capabilities (
    id SERIAL PRIMARY KEY,
    group_name TEXT NOT NULL,
    module TEXT NOT NULL,
    capability TEXT NOT NULL,
    access_level INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(group_name, module, capability)
);

-- 2. Individual Permission Grants (positive overrides)
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

-- 3. Individual Permission Restrictions (negative overrides)
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

-- 4. Permission Audit Log
CREATE TABLE IF NOT EXISTS permission_audit_log (
    id SERIAL PRIMARY KEY,
    actor_cid TEXT NOT NULL,
    actor_name TEXT,
    target_cid TEXT NOT NULL,
    target_name TEXT,
    action TEXT NOT NULL,  -- 'granted', 'revoked', 'restricted', 'unrestricted', 'role_changed', 'group_changed'
    module TEXT,
    capability TEXT,
    previous_value TEXT,
    new_value TEXT,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_perm_audit_actor ON permission_audit_log(actor_cid);
CREATE INDEX IF NOT EXISTS idx_perm_audit_target ON permission_audit_log(target_cid);
CREATE INDEX IF NOT EXISTS idx_perm_audit_created ON permission_audit_log(created_at);

-- 6. Indexes for fast permission resolution
CREATE INDEX IF NOT EXISTS idx_user_caps_lookup ON user_capabilities(user_cid, module, capability);
CREATE INDEX IF NOT EXISTS idx_user_restr_lookup ON user_capability_restrictions(user_cid, module, capability);

CREATE INDEX IF NOT EXISTS idx_group_caps_lookup ON group_capabilities(group_name, module, capability);

COMMIT;

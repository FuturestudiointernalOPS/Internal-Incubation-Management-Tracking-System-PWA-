-- =============================================================================
-- ACCESS PROFILES — Reusable permission templates separate from roles
-- =============================================================================
-- This migration adds:
--   1. access_profiles — named profiles (e.g. "Developer Intern", "Operations Manager")
--   2. access_profile_capabilities — what each profile can do
--   3. role_access_profile_defaults — which profile each role gets by default
--   4. contacts.access_profile_id — optional per-user override
-- =============================================================================

BEGIN;

-- 1. Access Profiles
CREATE TABLE IF NOT EXISTS access_profiles (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Profile Capabilities (same structure as role_capabilities)
CREATE TABLE IF NOT EXISTS access_profile_capabilities (
    id SERIAL PRIMARY KEY,
    profile_id INTEGER NOT NULL REFERENCES access_profiles(id) ON DELETE CASCADE,
    module TEXT NOT NULL,
    capability TEXT NOT NULL,
    access_level INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(profile_id, module, capability)
);

CREATE INDEX IF NOT EXISTS idx_profile_caps_lookup ON access_profile_capabilities(profile_id, module, capability);

-- 3. Role → Default Access Profile mapping
CREATE TABLE IF NOT EXISTS role_access_profile_defaults (
    id SERIAL PRIMARY KEY,
    role_name TEXT NOT NULL UNIQUE,
    access_profile_id INTEGER NOT NULL REFERENCES access_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Optional per-user access profile override
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS access_profile_id INTEGER REFERENCES access_profiles(id) ON DELETE SET NULL;

COMMIT;

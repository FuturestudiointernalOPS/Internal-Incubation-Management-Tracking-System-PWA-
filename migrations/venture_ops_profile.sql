-- =============================================================================
-- VENTURE OPS CONTRIBUTOR — a delegable profile (ADDITIVE ONLY)
-- Create + edit in LMS, Programs and Ventures. Nothing else: no delete, no
-- security, no settings, no finance, no permission administration.
--
-- Idempotent. Mirrors `ensureVentureOpsProfileSeed` in
-- src/models/authorization/profileCatalogueSeed.js, which handles databases
-- that were seeded before this profile existed.
-- =============================================================================

INSERT INTO profiles (key, context, allowed_roles, is_active, label) VALUES ('venture_ops_contributor', 'global', '["staff"]', 1, 'Venture Ops Contributor') ON CONFLICT (key) DO NOTHING;
INSERT INTO profile_capabilities (profile_key, module, capability, access_level) VALUES ('venture_ops_contributor', 'lms', 'view', 1) ON CONFLICT (profile_key, module, capability) DO NOTHING;
INSERT INTO profile_capabilities (profile_key, module, capability, access_level) VALUES ('venture_ops_contributor', 'lms', 'create', 2) ON CONFLICT (profile_key, module, capability) DO NOTHING;
INSERT INTO profile_capabilities (profile_key, module, capability, access_level) VALUES ('venture_ops_contributor', 'lms', 'edit', 3) ON CONFLICT (profile_key, module, capability) DO NOTHING;
INSERT INTO profile_capabilities (profile_key, module, capability, access_level) VALUES ('venture_ops_contributor', 'programs', 'view', 1) ON CONFLICT (profile_key, module, capability) DO NOTHING;
INSERT INTO profile_capabilities (profile_key, module, capability, access_level) VALUES ('venture_ops_contributor', 'programs', 'create', 2) ON CONFLICT (profile_key, module, capability) DO NOTHING;
INSERT INTO profile_capabilities (profile_key, module, capability, access_level) VALUES ('venture_ops_contributor', 'programs', 'edit', 3) ON CONFLICT (profile_key, module, capability) DO NOTHING;
INSERT INTO profile_capabilities (profile_key, module, capability, access_level) VALUES ('venture_ops_contributor', 'ventures', 'view', 1) ON CONFLICT (profile_key, module, capability) DO NOTHING;
INSERT INTO profile_capabilities (profile_key, module, capability, access_level) VALUES ('venture_ops_contributor', 'ventures', 'create', 2) ON CONFLICT (profile_key, module, capability) DO NOTHING;
INSERT INTO profile_capabilities (profile_key, module, capability, access_level) VALUES ('venture_ops_contributor', 'ventures', 'edit', 3) ON CONFLICT (profile_key, module, capability) DO NOTHING;
INSERT INTO profile_capabilities (profile_key, module, capability, access_level) VALUES ('venture_ops_contributor', 'reports', 'view', 1) ON CONFLICT (profile_key, module, capability) DO NOTHING;
INSERT INTO profile_capabilities (profile_key, module, capability, access_level) VALUES ('venture_ops_contributor', 'messaging', 'view', 1) ON CONFLICT (profile_key, module, capability) DO NOTHING;
INSERT INTO profile_capabilities (profile_key, module, capability, access_level) VALUES ('venture_ops_contributor', 'messaging', 'send', 2) ON CONFLICT (profile_key, module, capability) DO NOTHING;

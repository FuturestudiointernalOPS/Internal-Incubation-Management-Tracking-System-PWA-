-- Context-role registry: which profile does program:program_manager map to?
SELECT context, role_key, profile_key, profile_name, is_active FROM context_role_profiles WHERE context = 'program' ORDER BY role_key;

-- Every profile in the database carrying programs.create
SELECT pc.profile_key, pc.capability, pc.access_level, p.context, p.allowed_roles, p.is_active
FROM profile_capabilities pc
LEFT JOIN profiles p ON p.key = pc.profile_key
WHERE pc.module = 'programs' AND pc.capability = 'create'
ORDER BY pc.profile_key;

-- Joakh's group memberships (both sources)
SELECT ug.user_cid, ug.group_name FROM user_groups ug WHERE ug.user_cid = 'USR_58C499684A4B';

-- Any program capability attached to those groups
SELECT gc.group_name, gc.module, gc.capability, gc.access_level
FROM group_capabilities gc
WHERE gc.module = 'programs'
  AND gc.group_name IN (SELECT group_name FROM user_groups WHERE user_cid = 'USR_58C499684A4B');

-- Full grant rows with provenance for Joakh
SELECT user_cid, module, capability, access_level, granted_by, expires_at
FROM user_capabilities
WHERE user_cid = 'USR_58C499684A4B'
ORDER BY module, capability;

-- Programs Joakh may have created (recorded creator/manager fields)
SELECT id, name, assigned_pm_id, created_by, created_at
FROM programs
WHERE assigned_pm_id = 'USR_58C499684A4B' OR created_by = 'USR_58C499684A4B'
ORDER BY created_at DESC
LIMIT 20;

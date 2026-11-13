-- Columns available in the permission audit log
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'permission_audit_log' ORDER BY ordinal_position;

-- The Staff Default profile row itself (who last touched it, when)
SELECT id, key, context, allowed_roles, is_active, notes, created_at, updated_at FROM profiles WHERE key IN ('staff_default', 'program_manager');

-- Context-role registry mapping
SELECT * FROM context_role_profiles WHERE context = 'program' ORDER BY role_key;

-- Audit trail around the programs.create right
SELECT created_at, actor_name, target_name, action, module, capability, previous_value, new_value, details
FROM permission_audit_log
WHERE module = 'programs'
ORDER BY created_at DESC
LIMIT 30;

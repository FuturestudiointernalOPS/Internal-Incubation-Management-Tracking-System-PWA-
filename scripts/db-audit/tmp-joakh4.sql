-- The baseline role → default template mapping
SELECT role_name, profile_key FROM role_profile_defaults ORDER BY role_name;

-- Full capability set of the Staff Default template
SELECT pc.module, pc.capability, pc.access_level
FROM profile_capabilities pc
WHERE pc.profile_key = 'staff_default'
ORDER BY pc.module, pc.capability;

-- Joakh's own identity row (is there a personal profile override?)
SELECT cid, name, role, profile_key, group_name, status FROM contacts WHERE cid = 'USR_58C499684A4B';

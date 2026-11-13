-- Who is Joakh, and what does the authorization layer know about them?
SELECT cid, name, email, role, profile_key, group_name, status FROM contacts WHERE lower(name) LIKE '%joakh%' OR lower(email) LIKE '%joakh%';

-- Active contextual profile assignments
SELECT pa.id, pa.contact_cid, pa.profile_key, pa.context_type, pa.context_id, pa.status, pa.source, pa.ends_at
FROM profile_assignments pa
WHERE pa.contact_cid IN (SELECT cid FROM contacts WHERE lower(name) LIKE '%joakh%' OR lower(email) LIKE '%joakh%')
ORDER BY pa.id;

-- Individual capability grants
SELECT uc.user_cid, uc.module, uc.capability, uc.access_level, uc.expires_at
FROM user_capabilities uc
WHERE uc.user_cid IN (SELECT cid FROM contacts WHERE lower(name) LIKE '%joakh%' OR lower(email) LIKE '%joakh%')
ORDER BY uc.module, uc.capability;

-- Restrictions
SELECT ur.user_cid, ur.module, ur.capability, ur.expires_at
FROM user_capability_restrictions ur
WHERE ur.user_cid IN (SELECT cid FROM contacts WHERE lower(name) LIKE '%joakh%' OR lower(email) LIKE '%joakh%');

-- Program capabilities carried by the profile(s) they hold (assigned + role default)
SELECT pc.profile_key, pc.module, pc.capability, pc.access_level
FROM profile_capabilities pc
WHERE pc.module = 'programs'
  AND pc.profile_key IN (
    SELECT profile_key FROM profile_assignments
    WHERE contact_cid IN (SELECT cid FROM contacts WHERE lower(name) LIKE '%joakh%' OR lower(email) LIKE '%joakh%')
      AND status = 'active'
    UNION
    SELECT profile_key FROM contacts WHERE lower(name) LIKE '%joakh%' OR lower(email) LIKE '%joakh%'
  )
ORDER BY pc.profile_key, pc.capability;

-- Group capabilities in programs
SELECT gc.group_name, gc.module, gc.capability, gc.access_level
FROM group_capabilities gc
WHERE gc.module = 'programs'
  AND gc.group_name IN (
    SELECT group_name FROM contacts WHERE lower(name) LIKE '%joakh%' OR lower(email) LIKE '%joakh%'
  );

-- Program feature eligibility rows (all identities, so we can see which one opens it)
SELECT feature_key, identity_type, identity_value, eligible
FROM feature_eligibility
WHERE feature_key = 'programs'
ORDER BY identity_type, identity_value;

-- Active profiles they hold, with their allowed roles
SELECT p.key, p.context, p.allowed_roles, p.is_active
FROM profiles p
WHERE p.key IN (
  SELECT profile_key FROM profile_assignments
  WHERE contact_cid IN (SELECT cid FROM contacts WHERE lower(name) LIKE '%joakh%' OR lower(email) LIKE '%joakh%')
    AND status = 'active'
  UNION
  SELECT profile_key FROM contacts WHERE lower(name) LIKE '%joakh%' OR lower(email) LIKE '%joakh%'
);

-- =============================================================================
-- PHASE 1B — 05_REPORT_E_ACCESS_AUDIT (READ-ONLY)
-- -----------------------------------------------------------------------------
-- Access-profile / capability / grant / restriction audit. Nothing writes.
-- Resolver precedence (verified from src/lib/auth.js) is documented in the
-- Phase 1B report, Section 8 — this SQL only exposes the data behind it.
-- =============================================================================

-- E1. Profiles and their capability counts
SELECT ap.id, ap.name, ap.is_active,
       (SELECT COUNT(*)::int FROM access_profile_capabilities apc WHERE apc.profile_id = ap.id) AS capability_count
FROM access_profiles ap
ORDER BY ap.is_active DESC, ap.name;

-- E2. Role -> default profile mapping
SELECT rpd.role_name, ap.name AS profile_name, ap.is_active
FROM role_access_profile_defaults rpd
JOIN access_profiles ap ON ap.id = rpd.access_profile_id
ORDER BY rpd.role_name;

-- E3. ORPHANED profile assignments: contacts pointing at a missing/inactive profile
SELECT c.cid, c.name, c.email, c.role, c.access_profile_id
FROM contacts c
LEFT JOIN access_profiles ap ON ap.id = c.access_profile_id
WHERE c.access_profile_id IS NOT NULL
  AND (ap.id IS NULL OR ap.is_active = 0)
ORDER BY c.cid;

-- E4. Capabilities referenced by profiles (module/capability pairs actually in use)
SELECT apc.module, apc.capability, COUNT(DISTINCT apc.profile_id)::int AS profile_count
FROM access_profile_capabilities apc
GROUP BY apc.module, apc.capability
ORDER BY apc.module, apc.capability;

-- E5. DIRECT GRANTS vs RESTRICTIONS (users with explicit capability rows)
SELECT u.user_cid, c.name, c.email, c.role,
       COUNT(DISTINCT u.module || '.' || u.capability)::int AS grant_count
FROM user_capabilities u
LEFT JOIN contacts c ON c.cid = u.user_cid
GROUP BY u.user_cid, c.name, c.email, c.role
ORDER BY grant_count DESC;

SELECT r.user_cid, c.name, c.email, c.role,
       COUNT(DISTINCT r.module || '.' || r.capability)::int AS restriction_count
FROM user_capability_restrictions r
LEFT JOIN contacts c ON c.cid = r.user_cid
GROUP BY r.user_cid, c.name, c.email, c.role
ORDER BY restriction_count DESC;

-- E6. Same capability granted AND restricted for the same user (conflict pairs)
SELECT g.user_cid, g.module, g.capability,
       g.access_level AS grant_level,
       r.restricted_by, r.expires_at
FROM user_capabilities g
JOIN user_capability_restrictions r
  ON r.user_cid = g.user_cid
 AND r.module = g.module
 AND r.capability = g.capability
WHERE (g.expires_at IS NULL OR g.expires_at > NOW())
  AND (r.expires_at IS NULL OR r.expires_at > NOW())
ORDER BY g.user_cid, g.module, g.capability;

-- E7. Orphaned direct grants/restrictions (user no longer exists)
SELECT 'grants' AS kind, u.user_cid FROM user_capabilities u
LEFT JOIN contacts c ON c.cid = u.user_cid WHERE c.cid IS NULL
UNION ALL
SELECT 'restrictions', r.user_cid FROM user_capability_restrictions r
LEFT JOIN contacts c ON c.cid = r.user_cid WHERE c.cid IS NULL;

-- E8. Users holding responsibilities (organisational function assignments)
SELECT ur.user_cid, c.name, c.email, r.name AS responsibility, r.key AS responsibility_key
FROM user_responsibilities ur
JOIN responsibilities r ON r.id = ur.responsibility_id
LEFT JOIN contacts c ON c.cid = ur.user_cid
ORDER BY c.name, r.name;

-- NOTE: role_capabilities rows are the legacy fallback used by the resolver
-- when no profile resolves. They are NOT deleted or modified by this phase.

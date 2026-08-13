-- =============================================================================
-- ROLE RECONCILIATION: enforce Participant as the default platform role
--
-- A user must not be Staff merely because their group has no Program
-- assignment. Legitimate internal staff are identified by the internal staff
-- group names, and staff with a Program assignment are kept as-is.
--
-- Run this against the database after reviewing the diagnostic count:
--   SELECT COUNT(*) FROM contacts
--   WHERE role = 'staff'
--     AND (program_id IS NULL OR TRIM(program_id) = '')
--     AND UPPER(TRIM(COALESCE(group_name,''))) NOT IN ('FUTURE STUDIO','STAFF');
-- =============================================================================

UPDATE contacts
SET role = 'participant'
WHERE role = 'staff'
  AND (program_id IS NULL OR TRIM(program_id) = '')
  AND UPPER(TRIM(COALESCE(group_name, ''))) NOT IN ('FUTURE STUDIO', 'STAFF');

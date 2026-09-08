-- =============================================================================
-- 041 — PROGRAM-LEVEL FACILITATOR GROUPS (system-defined, protected)
-- -----------------------------------------------------------------------------
-- Every program gets its own 'Facilitators' group (v2_groups, type='facilitators',
-- is_system=1). It is NOT a global CRM group. The system maintains the group;
-- the Program Manager manages the people inside it.
-- =============================================================================

BEGIN;

ALTER TABLE v2_groups ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'participant';
ALTER TABLE v2_groups ADD COLUMN IF NOT EXISTS is_system INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_v2_groups_program_type ON v2_groups(program_id, type);

-- Backfill: ensure every existing program has its system-defined Facilitators group
INSERT INTO v2_groups (program_id, name, type, is_system)
SELECT p.id, 'Facilitators', 'facilitators', 1
FROM v2_programs p
WHERE NOT EXISTS (
  SELECT 1 FROM v2_groups g
  WHERE g.program_id = p.id AND UPPER(TRIM(g.name)) = 'FACILITATORS'
);

COMMIT;

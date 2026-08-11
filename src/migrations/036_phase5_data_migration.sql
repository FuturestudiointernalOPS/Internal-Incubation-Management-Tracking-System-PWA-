-- Phase 5: Unified Operations — Data Migration
-- Migrates venture_standups, venture_retros, v2_standups, v2_retros
-- into the unified v2_op_reports table.
-- Non-destructive — source tables are NOT dropped.

--------------------------------------------------------------------------------
-- 1. Migrate venture_standups → v2_op_reports
--------------------------------------------------------------------------------
INSERT INTO v2_op_reports (
  user_id, user_name, user_role, workspace,
  report_type, week_number, year, status,
  top_priorities, expected_deliverables, weekly_priorities,
  context_type, context_id, created_at, updated_at
)
SELECT
  vs.created_by,
  COALESCE(c.name, vs.created_by),
  'staff',
  'main',
  'standup',
  vs.week_number,
  vs.year,
  'submitted',
  vs.top_priorities,
  vs.expected_deliverables,
  vs.weekly_priorities,
  'venture',
  vs.venture_id::text,
  vs.created_at,
  vs.created_at
FROM venture_standups vs
LEFT JOIN contacts c ON c.cid = vs.created_by
WHERE NOT EXISTS (
  SELECT 1 FROM v2_op_reports r
  WHERE r.context_type = 'venture'
    AND r.context_id = vs.venture_id::text
    AND r.week_number = vs.week_number
    AND r.year = vs.year
    AND r.report_type = 'standup'
);

--------------------------------------------------------------------------------
-- 2. Migrate venture_retros → v2_op_reports
--------------------------------------------------------------------------------
INSERT INTO v2_op_reports (
  user_id, user_name, user_role, workspace,
  report_type, week_number, year, status,
  completed_work, unfinished_tasks, carryover_items,
  context_type, context_id, created_at, updated_at
)
SELECT
  vr.created_by,
  COALESCE(c.name, vr.created_by),
  'staff',
  'main',
  'retro',
  vr.week_number,
  vr.year,
  'submitted',
  vr.completed_tasks,
  vr.outstanding_tasks,
  vr.carry_forward_notes,
  'venture',
  vr.venture_id::text,
  vr.created_at,
  vr.created_at
FROM venture_retros vr
LEFT JOIN contacts c ON c.cid = vr.created_by
WHERE NOT EXISTS (
  SELECT 1 FROM v2_op_reports r
  WHERE r.context_type = 'venture'
    AND r.context_id = vr.venture_id::text
    AND r.week_number = vr.week_number
    AND r.year = vr.year
    AND r.report_type = 'retro'
);

--------------------------------------------------------------------------------
-- 3. Migrate v2_standups → v2_op_reports
--------------------------------------------------------------------------------
INSERT INTO v2_op_reports (
  user_id, user_name, user_role, workspace,
  report_type, week_number, year, status,
  projects_tasks, top_priorities,
  context_type, context_id, created_at, updated_at
)
SELECT
  vs2.participant_id,
  COALESCE(c.name, vs2.participant_id),
  'participant',
  'main',
  'standup',
  vs2.week_number,
  EXTRACT(YEAR FROM vs2.created_at)::int,
  'submitted',
  vs2.what_done,
  vs2.what_today || E'\nBlockers: ' || vs2.blockers,
  'participant',
  vs2.program_id,
  vs2.created_at,
  vs2.created_at
FROM v2_standups vs2
LEFT JOIN contacts c ON c.cid = vs2.participant_id
WHERE NOT EXISTS (
  SELECT 1 FROM v2_op_reports r
  WHERE r.context_type = 'participant'
    AND r.context_id = vs2.program_id
    AND r.user_id = vs2.participant_id
    AND r.week_number = vs2.week_number
    AND r.report_type = 'standup'
);

--------------------------------------------------------------------------------
-- 4. Migrate v2_retros → v2_op_reports
--------------------------------------------------------------------------------
INSERT INTO v2_op_reports (
  user_id, user_name, user_role, workspace,
  report_type, week_number, year, status,
  wins, challenges, unfinished_tasks, retro_notes,
  context_type, context_id, created_at, updated_at
)
SELECT
  vr2.participant_id,
  COALESCE(c.name, vr2.participant_id),
  'participant',
  'main',
  'retro',
  vr2.week_number,
  EXTRACT(YEAR FROM vr2.created_at)::int,
  'submitted',
  vr2.went_well,
  vr2.improve,
  vr2.action_items,
  NULL,
  'participant',
  vr2.program_id,
  vr2.created_at,
  vr2.created_at
FROM v2_retros vr2
LEFT JOIN contacts c ON c.cid = vr2.participant_id
WHERE NOT EXISTS (
  SELECT 1 FROM v2_op_reports r
  WHERE r.context_type = 'participant'
    AND r.context_id = vr2.program_id
    AND r.user_id = vr2.participant_id
    AND r.week_number = vr2.week_number
    AND r.report_type = 'retro'
);

--------------------------------------------------------------------------------
-- 5. Verify counts (run separately to check)
--------------------------------------------------------------------------------
-- SELECT 'venture_standups' AS source, COUNT(*) FROM venture_standups
-- UNION ALL
-- SELECT 'migrated_venture_standups' AS source, COUNT(*) FROM v2_op_reports WHERE context_type = 'venture' AND report_type = 'standup'
-- UNION ALL
-- SELECT 'venture_retros' AS source, COUNT(*) FROM venture_retros
-- UNION ALL
-- SELECT 'migrated_venture_retros' AS source, COUNT(*) FROM v2_op_reports WHERE context_type = 'venture' AND report_type = 'retro'
-- UNION ALL
-- SELECT 'v2_standups' AS source, COUNT(*) FROM v2_standups
-- UNION ALL
-- SELECT 'migrated_participant_standups' AS source, COUNT(*) FROM v2_op_reports WHERE context_type = 'participant' AND report_type = 'standup'
-- UNION ALL
-- SELECT 'v2_retros' AS source, COUNT(*) FROM v2_retros
-- UNION ALL
-- SELECT 'migrated_participant_retros' AS source, COUNT(*) FROM v2_op_reports WHERE context_type = 'participant' AND report_type = 'retro';

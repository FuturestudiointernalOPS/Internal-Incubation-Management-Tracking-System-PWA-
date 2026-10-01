-- STAGING DIAGNOSTIC — are milestone statuses STALE relative to the work below them?
--
-- Answers one question before any bulk recalculation is built:
--   do existing Ventures already hold finished tasks whose milestone still
--   reads Not Started / In Progress?
--
-- Read-only. Run:
--   node scripts/db-audit/run-readonly.mjs scripts/db-audit/stale-milestone-check.sql .env.audit-staging

SELECT
  (SELECT COUNT(*) FROM ventures) AS ventures,
  (SELECT COUNT(*) FROM venture_journey_stages) AS journey_stages,
  (SELECT COUNT(*) FROM venture_milestones) AS milestones,
  (SELECT COUNT(*) FROM venture_tasks) AS tasks,
  (SELECT COUNT(*) FROM venture_deliverables) AS deliverables;

-- Milestones that HAVE tasks, by the status they currently hold.
WITH task_rollup AS (
  SELECT milestone_id::text AS mid,
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE lower(status) IN ('done', 'accepted', 'completed')) AS done
  FROM venture_tasks
  WHERE milestone_id IS NOT NULL
  GROUP BY milestone_id::text
)
SELECT m.status AS milestone_status,
       COUNT(*) AS milestones,
       SUM(r.total) AS tasks,
       SUM(r.done) AS tasks_done
FROM venture_milestones m
JOIN task_rollup r ON r.mid = m.id::text
GROUP BY m.status
ORDER BY milestones DESC;

-- STALE ROWS: every task finished, the milestone still not completed.
-- This is the size of the problem the sync cannot reach on its own.
WITH task_rollup AS (
  SELECT milestone_id::text AS mid,
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE lower(status) IN ('done', 'accepted', 'completed')) AS done
  FROM venture_tasks
  WHERE milestone_id IS NOT NULL
  GROUP BY milestone_id::text
)
SELECT COALESCE(v.company_name, v.name) AS venture,
       m.title AS milestone,
       m.status,
       r.done AS tasks_done,
       r.total AS tasks_total
FROM venture_milestones m
JOIN task_rollup r ON r.mid = m.id::text
LEFT JOIN ventures v ON v.id = m.venture_id
WHERE r.total > 0 AND r.done = r.total AND lower(m.status) <> 'completed'
ORDER BY r.total DESC
LIMIT 100;

-- THE NEW RULE'S BITE: evidence fully approved while the work is still open.
-- These would have closed under the old deliverable-only rule; they now stay
-- In Progress until the tasks are done.
WITH dv_rollup AS (
  SELECT milestone_id::text AS mid,
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE lower(COALESCE(approval_status, '')) = 'approved') AS approved
  FROM venture_deliverables
  WHERE milestone_id IS NOT NULL
  GROUP BY milestone_id::text
),
task_rollup AS (
  SELECT milestone_id::text AS mid,
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE lower(status) IN ('done', 'accepted', 'completed')) AS done
  FROM venture_tasks
  WHERE milestone_id IS NOT NULL
  GROUP BY milestone_id::text
)
SELECT COALESCE(v.company_name, v.name) AS venture,
       m.title AS milestone,
       m.status,
       d.approved AS deliverables_approved,
       d.total AS deliverables_total,
       r.done AS tasks_done,
       r.total AS tasks_total
FROM venture_milestones m
JOIN dv_rollup d ON d.mid = m.id::text
LEFT JOIN task_rollup r ON r.mid = m.id::text
LEFT JOIN ventures v ON v.id = m.venture_id
WHERE d.total > 0
  AND d.approved = d.total
  AND COALESCE(r.total, 0) > 0
  AND r.done < r.total
  AND lower(m.status) <> 'completed'
LIMIT 100;

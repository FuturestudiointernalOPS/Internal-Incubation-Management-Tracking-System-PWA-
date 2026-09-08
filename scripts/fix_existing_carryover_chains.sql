-- ============================================================
-- FIX: Auto-complete orphaned carryover chains
--
-- When a carried_over task's latest clone is completed, all
-- ancestor tasks should ALSO be completed. This fixes existing
-- data created before the auto-chain-completion was added.
--
-- Safe to run multiple times (idempotent).
-- ============================================================

-- Step 1: Find all tails (tasks at the end of a carryover chain)
-- A tail is a task that has NOT been cloned further.
WITH tails AS (
    SELECT id, status, carried_over_from_task_id
    FROM tasks
    WHERE status IN ('in_progress', 'blocked', 'carried_over', 'completed')
      AND NOT EXISTS (
          SELECT 1 FROM tasks clone
          WHERE clone.carried_over_from_task_id = tasks.id
      )
),
-- Step 2: Walk backwards from each tail to build the full chain
chain AS (
    -- Anchor: start from tails
    SELECT 
        t.id AS ancestor_id,
        t.status AS ancestor_status,
        tl.status AS tail_status,
        t.carried_over_from_task_id AS parent_id,
        0 AS depth
    FROM tasks t
    INNER JOIN tails tl ON t.id = tl.id

    UNION ALL

    -- Recursive: walk backwards via carried_over_from_task_id
    SELECT 
        t.id AS ancestor_id,
        t.status AS ancestor_status,
        c.tail_status,
        t.carried_over_from_task_id AS parent_id,
        c.depth + 1
    FROM tasks t
    INNER JOIN chain c ON t.id = c.parent_id
    WHERE t.carried_over_from_task_id IS NOT NULL
)
-- Step 3: Update all tasks whose chain ends with a completed tail
UPDATE tasks t
SET 
    status = 'completed',
    completed_at = COALESCE(t.completed_at, CURRENT_TIMESTAMP),
    updated_at = CURRENT_TIMESTAMP
FROM chain c
WHERE t.id = c.ancestor_id
  AND c.tail_status = 'completed'
  AND c.ancestor_status != 'completed'
  AND c.ancestor_status != 'archived';

-- Report
SELECT CONCAT(
    COUNT(*), ' task(s) auto-completed — their carryover chain ends in a completed task.'
) AS fix_result
FROM tasks
WHERE status = 'completed'
  AND carried_over_from_task_id IS NOT NULL
  AND completed_at IS NOT NULL;

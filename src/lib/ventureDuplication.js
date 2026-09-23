/**
 * Venture OS duplication (Vinance 3 — Phase 1).
 *
 * Duplicate Journey stages / Milestones / Tasks as INDEPENDENT structure
 * copies. A copy never shares rows with its source: stages, milestones and
 * tasks are inserted as fresh rows (new ids), so later edits to either side
 * cannot affect the other — the same guarantee templates rely on.
 *
 * Execution data is deliberately NOT copied:
 *   - task submissions / reviews / task reviews (venture_task_submissions,
 *     venture_task_reviews), comments, attachments, activity logs and
 *     history events stay with the source. A duplicate is a fresh structure
 *     the manager can customize and re-run; it inherits no history.
 *
 * Statuses reset on copy:
 *   - journey stage  → 'locked'  (manager activates it deliberately)
 *   - milestone      → 'not_started', progress 0
 *   - task           → 'backlog'
 * Assignees/assigner metadata are cleared (reporter = actor when provided).
 * Structure fields (name, description, objective, dates, priorities, labels,
 * checklist, review_required, required_deliverable_type, display_order,
 * parent/child task links) are preserved.
 */

const COPY_SUFFIX = " — Copy";

function newUuid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
        const random = (Math.random() * 16) | 0;
        const value = char === "x" ? random : (random & 0x3) | 0x8;
        return value.toString(16);
      });
}

const boolParam = (value) => value === true || value === 1 || value === "true" || value === "t" || value === "1";

/** Normalize an executor result ({ rows }) from execute-style or tx-style calls. */
function rowsOf(result) {
  return (result && result.rows) || [];
}

/**
 * Insert a fresh copy of a source task row bound to `newMilestoneId`.
 * Subtasks are re-parented through `parentMap` (source task id → copy id).
 * Returns the new task id.
 */
async function copyTaskRow(exec, { task, ventureId, newMilestoneId, actorCid, parentMap, suffixTitle = false }) {
  const title = suffixTitle && task.title ? `${task.title}${COPY_SUFFIX}` : task.title;
  // venture_tasks.id is SERIAL (integer) — never insert an explicit id;
  // capture the generated one for subtask re-parenting.
  const insertResult = await exec(
    `INSERT INTO venture_tasks
       (venture_id, milestone_id, title, description, status, priority,
        due_date, estimated_hours, assigned_cid, assigned_name, reporter_cid,
        reporter_name, labels, checklist, display_order, parent_task_id,
        review_required, required_deliverable_type)
     VALUES (?, ?, ?, ?, 'backlog', ?, ?, ?, NULL, NULL, ?, NULL, ?::jsonb, ?::jsonb, ?, ?, ?, ?)
     RETURNING id`,
    [
      ventureId,
      newMilestoneId,
      title,
      task.description || null,
      task.priority || "medium",
      task.due_date || null,
      task.estimated_hours || null,
      actorCid || null,
      JSON.stringify(typeof task.labels === "string" ? safeParse(task.labels, []) : task.labels || []),
      JSON.stringify(typeof task.checklist === "string" ? safeParse(task.checklist, []) : task.checklist || []),
      task.display_order ?? 0,
      parentMap.get(String(task.parent_task_id)) || null,
      boolParam(task.review_required) ? "TRUE" : "FALSE",
      task.required_deliverable_type || null,
    ],
  );
  const newTaskId = insertResult?.rows?.[0]?.id ?? insertResult?.lastInsertRowid;
  parentMap.set(String(task.id), newTaskId);
  return newTaskId;
}

function safeParse(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (_) {
    return fallback;
  }
}

/**
 * Copy all tasks under one source milestone into `newMilestoneId`.
 * Top-level tasks are copied first so subtask re-parenting always resolves.
 * Returns the number of copied tasks.
 */
async function copyTasksForMilestone(exec, { sourceMilestoneId, newMilestoneId, ventureId, actorCid }) {
  const tasksResult = await exec(
    `SELECT * FROM venture_tasks
     WHERE milestone_id = ?
     ORDER BY (parent_task_id IS NULL) DESC, id ASC`,
    [sourceMilestoneId],
  );
  const tasks = rowsOf(tasksResult);
  const parentMap = new Map();
  let count = 0;
  for (const task of tasks) {
    await copyTaskRow(exec, { task, ventureId, newMilestoneId, actorCid, parentMap });
    count += 1;
  }
  return count;
}

/**
 * Duplicate a Journey stage (with its bound milestones and their tasks) and
 * insert the copy directly after the source in the stage order.
 *
 * Returns { error } or { success, stage, milestones_copied, tasks_copied }.
 */
export async function duplicateJourneyStage(db, { dbId, stageId, actorCid }) {
  const stageResult = await db.execute({
    sql: "SELECT * FROM venture_journey_stages WHERE id = ? AND venture_id = ?",
    args: [stageId, dbId],
  });
  const stage = rowsOf(stageResult)[0];
  if (!stage) return { error: "Stage not found." };

  const newStageId = newUuid();
  const name = stage.name ? `${stage.name}${COPY_SUFFIX}` : "Untitled stage";
  let milestonesCopied = 0;
  let tasksCopied = 0;

  const outcome = await db.transaction(async (query) => {
    // ── Stage ordering: insert the copy right after the source ──
    const orderResult = await query(
      "SELECT id, stage_order FROM venture_journey_stages WHERE venture_id = ? ORDER BY stage_order ASC",
      [dbId],
    );
    const ordered = rowsOf(orderResult);
    const sourceIndex = ordered.findIndex((row) => String(row.id) === String(stageId));
    if (sourceIndex === -1) return { error: "Stage not found." };

    // Park every existing stage on distinct negatives so the UNIQUE
    // (venture_id, stage_order) constraint can never collide mid-swap.
    for (const row of ordered) {
      await query("UPDATE venture_journey_stages SET stage_order = ? WHERE id = ?", [-Number(row.stage_order), row.id]);
    }
    const maxOrder = ordered.reduce((maxSoFar, row) => Math.max(maxSoFar, Number(row.stage_order) || 0), 0);
    await query(
      `INSERT INTO venture_journey_stages (id, venture_id, name, description, objective, target_date, stage_order, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'locked')`,
      [newStageId, dbId, name, stage.description || null, stage.objective || null, stage.target_date || null, maxOrder + 1],
    );

    // Restore order as a dense 1..n sequence with the copy after the source.
    const finalOrder = [
      ...ordered.slice(0, sourceIndex + 1).map((row) => row.id),
      newStageId,
      ...ordered.slice(sourceIndex + 1).map((row) => row.id),
    ];
    for (let i = 0; i < finalOrder.length; i++) {
      await query("UPDATE venture_journey_stages SET stage_order = ? WHERE id = ?", [i + 1, finalOrder[i]]);
    }

    // ── Milestones bound to the source stage → fresh copies on the new stage ──
    const milestonesResult = await query(
      "SELECT * FROM venture_milestones WHERE journey_stage_id = ?",
      [stageId],
    );
    const stageMilestones = rowsOf(milestonesResult);
    for (let milestoneIndex = 0; milestoneIndex < stageMilestones.length; milestoneIndex++) {
      const milestone = stageMilestones[milestoneIndex];
      const newMilestoneId = newUuid();
      // Sequential release (Phase 3): the first milestone of the copied stage
      // is available; the rest start locked until the previous one completes.
      const milestoneStatus = milestoneIndex === 0 ? "not_started" : "locked";
      await query(
        `INSERT INTO venture_milestones
           (id, venture_id, title, description, objective, target_date, start_date,
            status, progress, priority, owner_cid, display_order, journey_stage_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
        [
          newMilestoneId, dbId, milestone.title, milestone.description || null, milestone.objective || null,
          milestone.target_date || null, milestone.start_date || null, milestoneStatus,
          milestone.priority || "medium", milestone.owner_cid || null,
          milestone.display_order ?? null, newStageId, actorCid || null,
        ],
      );
      tasksCopied += await copyTasksForMilestone(query, {
        sourceMilestoneId: milestone.id, newMilestoneId, ventureId: dbId, actorCid,
      });
      milestonesCopied += 1;
    }

    return {
      success: true,
      stage: {
        id: newStageId,
        name,
        description: stage.description || null,
        objective: stage.objective || null,
        target_date: stage.target_date || null,
        status: "locked",
      },
      milestones_copied: milestonesCopied,
      tasks_copied: tasksCopied,
    };
  });

  return outcome;
}

/**
 * Duplicate a single milestone (keeping its journey_stage_id binding) with
 * its tasks. Returns { error } or { success, milestone, tasks_copied }.
 *
 * `ventureIds` — accepted owner values ([internal dbId, VNT code]) so legacy
 * rows keyed on either survive.
 */
export async function duplicateMilestone(db, { dbId, code, milestoneId, actorCid }) {
  const owners = [dbId, code].filter(Boolean);
  const placeholders = owners.map(() => "?").join(", ");
  const sourceResult = await db.execute({
    sql: `SELECT * FROM venture_milestones WHERE id = ? AND venture_id IN (${placeholders})`,
    args: [milestoneId, ...owners],
  });
  const milestone = rowsOf(sourceResult)[0];
  if (!milestone) return { error: "Milestone not found." };

  const newMilestoneId = newUuid();
  const title = milestone.title ? `${milestone.title}${COPY_SUFFIX}` : "Untitled milestone";
  let tasksCopied = 0;

  await db.transaction(async (query) => {
    await query(
      `INSERT INTO venture_milestones
         (id, venture_id, title, description, objective, target_date, start_date,
          status, progress, priority, owner_cid, display_order, journey_stage_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
      [
        newMilestoneId, milestone.venture_id || dbId, title, milestone.description || null, milestone.objective || null,
        milestone.target_date || null, milestone.start_date || null, "not_started",
        milestone.priority || "medium", milestone.owner_cid || null,
        milestone.display_order ?? null, milestone.journey_stage_id || null, actorCid || null,
      ],
    );
    tasksCopied = await copyTasksForMilestone(query, {
      sourceMilestoneId: milestone.id, newMilestoneId, ventureId: milestone.venture_id || dbId, actorCid,
    });
  });

  return {
    success: true,
    milestone: {
      id: newMilestoneId,
      title,
      journey_stage_id: milestone.journey_stage_id || null,
      status: "not_started",
      progress: 0,
    },
    tasks_copied: tasksCopied,
  };
}

/**
 * Duplicate a single task (same milestone binding, fresh 'backlog' copy).
 * Returns { error } or { success, task }.
 */
export async function duplicateTask(db, { dbId, code, taskId, actorCid }) {
  const owners = [dbId, code].filter(Boolean);
  const placeholders = owners.map(() => "?").join(", ");
  const sourceResult = await db.execute({
    sql: `SELECT * FROM venture_tasks WHERE id = ? AND venture_id IN (${placeholders})`,
    args: [taskId, ...owners],
  });
  const task = rowsOf(sourceResult)[0];
  if (!task) return { error: "Task not found." };

  // venture_tasks.id is SERIAL — omit the id and capture the generated one.
  const insertResult = await db.execute({
    sql: `INSERT INTO venture_tasks
       (venture_id, milestone_id, title, description, status, priority,
        due_date, estimated_hours, assigned_cid, assigned_name, reporter_cid,
        reporter_name, labels, checklist, display_order, parent_task_id,
        review_required, required_deliverable_type)
     VALUES (?, ?, ?, ?, 'backlog', ?, ?, ?, NULL, NULL, ?, NULL, ?::jsonb, ?::jsonb, ?, NULL, ?, ?)
     RETURNING id`,
    args: [
      task.venture_id || dbId,
      task.milestone_id || null,
      task.title ? `${task.title}${COPY_SUFFIX}` : "Untitled task",
      task.description || null,
      task.priority || "medium",
      task.due_date || null,
      task.estimated_hours || null,
      actorCid || null,
      JSON.stringify(typeof task.labels === "string" ? safeParse(task.labels, []) : task.labels || []),
      JSON.stringify(typeof task.checklist === "string" ? safeParse(task.checklist, []) : task.checklist || []),
      task.display_order ?? 0,
      boolParam(task.review_required) ? "TRUE" : "FALSE",
      task.required_deliverable_type || null,
    ],
  });
  const newTaskId = insertResult?.rows?.[0]?.id ?? insertResult?.lastInsertRowid;

  return {
    success: true,
    task: { id: newTaskId, title: task.title ? `${task.title}${COPY_SUFFIX}` : "Untitled task" },
  };
}

export default { duplicateJourneyStage, duplicateMilestone, duplicateTask };

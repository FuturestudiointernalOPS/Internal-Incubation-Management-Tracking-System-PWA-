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
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
}

const boolParam = (v) => v === true || v === 1 || v === "true" || v === "t" || v === "1";

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
  const newTaskId = newUuid();
  const title = suffixTitle && task.title ? `${task.title}${COPY_SUFFIX}` : task.title;
  await exec(
    `INSERT INTO venture_tasks
       (id, venture_id, milestone_id, title, description, status, priority,
        due_date, estimated_hours, assigned_cid, assigned_name, reporter_cid,
        reporter_name, labels, checklist, display_order, parent_task_id,
        review_required, required_deliverable_type)
     VALUES (?, ?, ?, ?, ?, 'backlog', ?, ?, ?, NULL, NULL, ?, NULL, ?::jsonb, ?::jsonb, ?, ?, ?, ?)`,
    [
      newTaskId,
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
  const res = await exec(
    `SELECT * FROM venture_tasks
     WHERE milestone_id = ?
     ORDER BY (parent_task_id IS NULL) DESC, id ASC`,
    [sourceMilestoneId],
  );
  const tasks = rowsOf(res);
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
  const stageRes = await db.execute({
    sql: "SELECT * FROM venture_journey_stages WHERE id = ? AND venture_id = ?",
    args: [stageId, dbId],
  });
  const stage = rowsOf(stageRes)[0];
  if (!stage) return { error: "Stage not found." };

  const newStageId = newUuid();
  const name = stage.name ? `${stage.name}${COPY_SUFFIX}` : "Untitled stage";
  let milestonesCopied = 0;
  let tasksCopied = 0;

  const outcome = await db.transaction(async (query) => {
    // ── Stage ordering: insert the copy right after the source ──
    const orderRes = await query(
      "SELECT id, stage_order FROM venture_journey_stages WHERE venture_id = ? ORDER BY stage_order ASC",
      [dbId],
    );
    const ordered = rowsOf(orderRes);
    const sourceIdx = ordered.findIndex((r) => String(r.id) === String(stageId));
    if (sourceIdx === -1) return { error: "Stage not found." };

    // Park every existing stage on distinct negatives so the UNIQUE
    // (venture_id, stage_order) constraint can never collide mid-swap.
    for (const r of ordered) {
      await query("UPDATE venture_journey_stages SET stage_order = ? WHERE id = ?", [-Number(r.stage_order), r.id]);
    }
    const maxOrder = ordered.reduce((m, r) => Math.max(m, Number(r.stage_order) || 0), 0);
    await query(
      `INSERT INTO venture_journey_stages (id, venture_id, name, description, objective, target_date, stage_order, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'locked')`,
      [newStageId, dbId, name, stage.description || null, stage.objective || null, stage.target_date || null, maxOrder + 1],
    );

    // Restore order as a dense 1..n sequence with the copy after the source.
    const finalOrder = [
      ...ordered.slice(0, sourceIdx + 1).map((r) => r.id),
      newStageId,
      ...ordered.slice(sourceIdx + 1).map((r) => r.id),
    ];
    for (let i = 0; i < finalOrder.length; i++) {
      await query("UPDATE venture_journey_stages SET stage_order = ? WHERE id = ?", [i + 1, finalOrder[i]]);
    }

    // ── Milestones bound to the source stage → fresh copies on the new stage ──
    const msRes = await query(
      "SELECT * FROM venture_milestones WHERE journey_stage_id = ?",
      [stageId],
    );
    for (const m of rowsOf(msRes)) {
      const newMsId = newUuid();
      await query(
        `INSERT INTO venture_milestones
           (id, venture_id, title, description, objective, target_date, start_date,
            status, progress, priority, owner_cid, display_order, journey_stage_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'not_started', 0, ?, ?, ?, ?, ?)`,
        [
          newMsId, dbId, m.title, m.description || null, m.objective || null,
          m.target_date || null, m.start_date || null,
          m.priority || "medium", m.owner_cid || null,
          m.display_order ?? null, newStageId, actorCid || null,
        ],
      );
      tasksCopied += await copyTasksForMilestone(query, {
        sourceMilestoneId: m.id, newMilestoneId: newMsId, ventureId: dbId, actorCid,
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
  const sourceRes = await db.execute({
    sql: `SELECT * FROM venture_milestones WHERE id = ? AND venture_id IN (${placeholders})`,
    args: [milestoneId, ...owners],
  });
  const m = rowsOf(sourceRes)[0];
  if (!m) return { error: "Milestone not found." };

  const newMsId = newUuid();
  const title = m.title ? `${m.title}${COPY_SUFFIX}` : "Untitled milestone";
  let tasksCopied = 0;

  await db.transaction(async (query) => {
    await query(
      `INSERT INTO venture_milestones
         (id, venture_id, title, description, objective, target_date, start_date,
          status, progress, priority, owner_cid, display_order, journey_stage_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'not_started', 0, ?, ?, ?, ?, ?)`,
      [
        newMsId, m.venture_id || dbId, title, m.description || null, m.objective || null,
        m.target_date || null, m.start_date || null,
        m.priority || "medium", m.owner_cid || null,
        m.display_order ?? null, m.journey_stage_id || null, actorCid || null,
      ],
    );
    tasksCopied = await copyTasksForMilestone(query, {
      sourceMilestoneId: m.id, newMilestoneId: newMsId, ventureId: m.venture_id || dbId, actorCid,
    });
  });

  return {
    success: true,
    milestone: {
      id: newMsId,
      title,
      journey_stage_id: m.journey_stage_id || null,
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
  const sourceRes = await db.execute({
    sql: `SELECT * FROM venture_tasks WHERE id = ? AND venture_id IN (${placeholders})`,
    args: [taskId, ...owners],
  });
  const task = rowsOf(sourceRes)[0];
  if (!task) return { error: "Task not found." };

  const newTaskId = newUuid();
  await db.execute({
    sql: `INSERT INTO venture_tasks
       (id, venture_id, milestone_id, title, description, status, priority,
        due_date, estimated_hours, assigned_cid, assigned_name, reporter_cid,
        reporter_name, labels, checklist, display_order, parent_task_id,
        review_required, required_deliverable_type)
     VALUES (?, ?, ?, ?, ?, 'backlog', ?, ?, ?, NULL, NULL, ?, NULL, ?::jsonb, ?::jsonb, ?, ?, ?, ?)`,
    args: [
      newTaskId,
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
      null,
      boolParam(task.review_required) ? "TRUE" : "FALSE",
      task.required_deliverable_type || null,
    ],
  });
  return {
    success: true,
    task: { id: newTaskId, title: task.title ? `${task.title}${COPY_SUFFIX}` : "Untitled task" },
  };
}

export default { duplicateJourneyStage, duplicateMilestone, duplicateTask };

/**
 * VENTURE OS DUPLICATION (Vinance 3 — Phase 1).
 *
 * Duplicate Journey stages / Milestones / Tasks as INDEPENDENT structure copies.
 * A copy never shares rows with its source: stages, milestones and tasks are
 * inserted as fresh rows (new ids), so later edits to either side cannot affect
 * the other — the same guarantee templates rely on.
 *
 * Execution data is deliberately NOT copied: task submissions / reviews,
 * comments, attachments, activity logs and history events stay with the source.
 * A duplicate is a fresh structure the manager can customize and re-run; it
 * inherits no history.
 *
 * Statuses reset on copy:
 *   - journey stage  → 'upcoming'  (manager activates it, or its start_date does)
 *   - milestone      → 'upcoming', progress 0
 *   - task           → 'backlog'
 * Assignees/assigner metadata are cleared (reporter = actor when provided).
 * Structure fields (name, description, objective, dates, priorities, labels,
 * checklist, review_required, required_deliverable_type, display_order,
 * parent/child task links) are preserved.
 *
 * Every statement lives in `@/models/ventureDuplicationStore`; nothing here runs
 * SQL. This module used to be re-exported through the `@/lib/ventureDuplication` facade;
 * that facade is gone (CH-4) and importers read this module directly.
 */

import {
  runInTransaction,
  selectJourneyStageForDuplication,
  selectMilestoneForDuplication,
  selectTaskForDuplication,
  insertDuplicatedTaskRow,
  selectJourneyStageOrdersForDuplication,
  setJourneyStageOrderForDuplication,
  insertJourneyStageCopyRow,
  selectMilestonesForStageDuplication,
  insertMilestoneCopyRow,
  selectTasksForMilestoneDuplication,
  insertCopiedTaskWithParent,
} from "@/models/ventureDuplicationStore";

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

function safeParse(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (_) {
    return fallback;
  }
}

/** JSON text for a task's labels / checklist (accepts an already-parsed array). */
function toJsonArrayText(value) {
  return JSON.stringify(typeof value === "string" ? safeParse(value, []) : value || []);
}

/** The DB stores review_required as TRUE/FALSE text here. */
function toReviewRequiredText(value) {
  return boolParam(value) ? "TRUE" : "FALSE";
}

/**
 * Insert a fresh copy of a source task row bound to `newMilestoneId`.
 * Subtasks are re-parented through `parentMap` (source task id → copy id).
 * Returns the new task id.
 */
async function copyTaskRow(query, { task, ventureId, newMilestoneId, actorCid, parentMap, suffixTitle = false }) {
  const title = suffixTitle && task.title ? `${task.title}${COPY_SUFFIX}` : task.title;
  // venture_tasks.id is SERIAL (integer) — never insert an explicit id;
  // capture the generated one for subtask re-parenting.
  const insertResult = await insertCopiedTaskWithParent(query, {
    ventureId,
    milestoneId: newMilestoneId,
    title,
    description: task.description || null,
    priority: task.priority || "medium",
    dueDate: task.due_date || null,
    estimatedHours: task.estimated_hours || null,
    actorCid: actorCid || null,
    labelsJson: toJsonArrayText(task.labels),
    checklistJson: toJsonArrayText(task.checklist),
    displayOrder: task.display_order ?? 0,
    parentTaskId: parentMap.get(String(task.parent_task_id)) || null,
    reviewRequired: toReviewRequiredText(task.review_required),
    requiredDeliverableType: task.required_deliverable_type || null,
  });
  const newTaskId = insertResult?.rows?.[0]?.id ?? insertResult?.lastInsertRowid;
  parentMap.set(String(task.id), newTaskId);
  return newTaskId;
}

/**
 * Copy all tasks under one source milestone into `newMilestoneId`.
 * Top-level tasks are copied first so subtask re-parenting always resolves.
 * Returns the number of copied tasks.
 */
async function copyTasksForMilestone(query, { sourceMilestoneId, newMilestoneId, ventureId, actorCid }) {
  const tasks = rowsOf(await selectTasksForMilestoneDuplication(query, sourceMilestoneId));
  const parentMap = new Map();
  let count = 0;
  for (const task of tasks) {
    await copyTaskRow(query, { task, ventureId, newMilestoneId, actorCid, parentMap });
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
export async function duplicateJourneyStage({ dbId, stageId, actorCid }) {
  const stage = rowsOf(await selectJourneyStageForDuplication(stageId, dbId))[0];
  if (!stage) return { error: "Stage not found." };

  const newStageId = newUuid();
  const name = stage.name ? `${stage.name}${COPY_SUFFIX}` : "Untitled stage";
  let milestonesCopied = 0;
  let tasksCopied = 0;

  const outcome = await runInTransaction(async (query) => {
    // ── Stage ordering: insert the copy right after the source ──
    const ordered = rowsOf(await selectJourneyStageOrdersForDuplication(query, dbId));
    const sourceIndex = ordered.findIndex((row) => String(row.id) === String(stageId));
    if (sourceIndex === -1) return { error: "Stage not found." };

    // Park every existing stage on distinct negatives so the UNIQUE
    // (venture_id, stage_order) constraint can never collide mid-swap.
    for (const row of ordered) {
      await setJourneyStageOrderForDuplication(query, -Number(row.stage_order), row.id);
    }
    const maxOrder = ordered.reduce((maxSoFar, row) => Math.max(maxSoFar, Number(row.stage_order) || 0), 0);
    await insertJourneyStageCopyRow(query, {
      id: newStageId,
      ventureId: dbId,
      name,
      description: stage.description || null,
      objective: stage.objective || null,
      targetDate: stage.target_date || null,
      stageOrder: maxOrder + 1,
    });

    // Restore order as a dense 1..n sequence with the copy after the source.
    const finalOrder = [
      ...ordered.slice(0, sourceIndex + 1).map((row) => row.id),
      newStageId,
      ...ordered.slice(sourceIndex + 1).map((row) => row.id),
    ];
    for (let i = 0; i < finalOrder.length; i++) {
      await setJourneyStageOrderForDuplication(query, i + 1, finalOrder[i]);
    }

    // ── Milestones bound to the source stage → fresh copies on the new stage ──
    const stageMilestones = rowsOf(await selectMilestonesForStageDuplication(query, stageId));
    for (const milestone of stageMilestones) {
      const newMilestoneId = newUuid();
      // The copy is `upcoming`: it holds all its milestones until the copy is
      // activated (its own start date, or staff). Position releases nothing —
      // only an explicit dependency ever holds work back.
      await insertMilestoneCopyRow(query, {
        id: newMilestoneId,
        ventureId: dbId,
        title: milestone.title,
        description: milestone.description || null,
        objective: milestone.objective || null,
        targetDate: milestone.target_date || null,
        startDate: milestone.start_date || null,
        status: "upcoming",
        priority: milestone.priority || "medium",
        ownerCid: milestone.owner_cid || null,
        displayOrder: milestone.display_order ?? null,
        journeyStageId: newStageId,
        createdBy: actorCid || null,
      });
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
        status: "upcoming",
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
 * `dbId` + `code` — accepted owner values ([internal dbId, VNT code]) so legacy
 * rows keyed on either survive.
 */
export async function duplicateMilestone({ dbId, code, milestoneId, actorCid }) {
  const owners = [dbId, code].filter(Boolean);
  const milestone = rowsOf(await selectMilestoneForDuplication(milestoneId, owners))[0];
  if (!milestone) return { error: "Milestone not found." };

  const newMilestoneId = newUuid();
  const title = milestone.title ? `${milestone.title}${COPY_SUFFIX}` : "Untitled milestone";
  let tasksCopied = 0;

  await runInTransaction(async (query) => {
    await insertMilestoneCopyRow(query, {
      id: newMilestoneId,
      ventureId: milestone.venture_id || dbId,
      title,
      description: milestone.description || null,
      objective: milestone.objective || null,
      targetDate: milestone.target_date || null,
      startDate: milestone.start_date || null,
      status: "not_started",
      priority: milestone.priority || "medium",
      ownerCid: milestone.owner_cid || null,
      displayOrder: milestone.display_order ?? null,
      journeyStageId: milestone.journey_stage_id || null,
      createdBy: actorCid || null,
    });
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
export async function duplicateTask({ dbId, code, taskId, actorCid }) {
  const owners = [dbId, code].filter(Boolean);
  const task = rowsOf(await selectTaskForDuplication(taskId, owners))[0];
  if (!task) return { error: "Task not found." };

  const title = task.title ? `${task.title}${COPY_SUFFIX}` : "Untitled task";
  // venture_tasks.id is SERIAL — omit the id and capture the generated one.
  const insertResult = await insertDuplicatedTaskRow({
    ventureId: task.venture_id || dbId,
    milestoneId: task.milestone_id || null,
    title,
    description: task.description || null,
    priority: task.priority || "medium",
    dueDate: task.due_date || null,
    estimatedHours: task.estimated_hours || null,
    actorCid: actorCid || null,
    labelsJson: toJsonArrayText(task.labels),
    checklistJson: toJsonArrayText(task.checklist),
    displayOrder: task.display_order ?? 0,
    reviewRequired: toReviewRequiredText(task.review_required),
    requiredDeliverableType: task.required_deliverable_type || null,
  });
  const newTaskId = insertResult?.rows?.[0]?.id ?? insertResult?.lastInsertRowid;

  return { success: true, task: { id: newTaskId, title } };
}

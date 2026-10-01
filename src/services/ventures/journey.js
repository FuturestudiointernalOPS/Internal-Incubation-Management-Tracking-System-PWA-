/**
 * VENTURE JOURNEY — stage authoring, archive/delete and the template library.
 *
 * The Journey is the Venture-facing operating path: authorized staff define the
 * stages a specific Venture actually needs (never a hardcoded curriculum). This
 * service holds the DECISIONS of that authoring surface:
 *   - stage reads with a progressive fallback (archive / template columns);
 *   - the ordered swap and the re-serialised delete (transaction boundaries);
 *   - the filed-work guard that blocks a permanent delete;
 *   - the template library: what a save captures and what an apply recreates,
 *     including the first-stage status and the CONTINUED numbering.
 *
 * Every statement lives in `@/models/ventureJourneyStore`; nothing here runs
 * SQL (the boundary is pinned by `server/services-boundaries.test.js`).
 *
 * Re-exported unchanged through the compatibility facades
 * `@/lib/ventureJourneys`, `@/lib/ventureJourneyArchive` and
 * `@/lib/ventureJourneyTemplates` — see docs/LAYER_SPLIT.md.
 */

import {
  runInTransaction,
  ensureJourneyTableSchema,
  selectVentureIdByUuid,
  selectVentureIdByCode,
  selectJourneyStagesWithArchive,
  selectJourneyStagesWithTemplate,
  selectJourneyStagesCore,
  selectJourneyStageRow,
  selectNextJourneyStageOrder,
  selectJourneyStageOrders,
  parkJourneyStageOrder,
  setJourneyStageOrder,
  updateJourneyStageOrder,
  deleteJourneyStageRow,
  selectJourneyStageIdsInOrder,
  selectJourneyStageForArchive,
  archiveJourneyStageRow,
  restoreJourneyStageRow,
  selectStageMilestoneIds,
  selectJourneyStageIdsOrdered,
  selectMilestoneTaskIds,
  deleteTaskReviewsForTask,
  deleteTaskCommentsForTask,
  deleteTaskAttachmentsForTask,
  deleteJourneyStageNotes,
  deleteDeliverablesForMilestone,
  deleteTasksForMilestone,
  deleteMilestoneRow,
  selectJourneyTemplatesWithCounts,
  selectJourneyStagesForTemplate,
  insertJourneyTemplateRow,
  insertJourneyTemplateStageRow,
  selectMilestonesForJourneyStage,
  insertJourneyTemplateMilestoneRow,
  selectTopLevelTasksForMilestone,
  insertJourneyTemplateTaskRow,
  selectMaxJourneyStageOrder,
  selectJourneyTemplateById,
  selectTemplateStagesForApply,
  insertJourneyStageFromTemplateRow,
  selectTemplateMilestonesForStage,
  insertMilestoneFromTemplateRow,
  selectTemplateTasksForMilestone,
  insertTaskFromTemplateRow,
} from "@/models/ventureJourneyStore";

// The filed-work guard is the archive engine's decision — reused, never copied.
import { milestoneHasFiledWork } from "@/services/ventures/archive";

function rowsOf(result) {
  return (result && result.rows) || [];
}

/** A fresh uuid without depending on the runtime exposing `crypto`. */
function newUuid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
        const random = (Math.random() * 16) | 0;
        const value = char === "x" ? random : (random & 0x3) | 0x8;
        return value.toString(16);
      });
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
  return value === true || value === 1 || value === "true" ? "TRUE" : "FALSE";
}

// ── Stage table + id resolution ──────────────────────────────────────────────

/** Create the journey stage table when missing and add the configurable fields. */
export async function ensureJourneyTable() {
  await ensureJourneyTableSchema();
}

/**
 * Resolve the internal ventures(id) UUID used by the journey table.
 * Accepts either the VNT- code or the internal UUID.
 */
export async function resolveVentureInternalId(ventureId) {
  if (typeof ventureId === "string" && ventureId.includes("-") && !ventureId.startsWith("VNT-")) {
    try {
      const byIdResult = await selectVentureIdByUuid(ventureId);
      if (byIdResult.rows?.[0]) return byIdResult.rows[0].id;
      return ventureId;
    } catch (_) {
      return ventureId;
    }
  }
  const result = await selectVentureIdByCode(ventureId);
  return result.rows?.[0]?.id || null;
}

// ── Stage reads ──────────────────────────────────────────────────────────────

/**
 * Ordered stages for a Venture — only Venture-facing columns.
 *
 * Archived (soft-deleted) journeys are hidden by default; management surfaces
 * pass { includeArchived: true }. Falls back progressively when the additive
 * archive / template-provenance columns have not been migrated yet.
 */
export async function listJourneyStages(dbId, { includeArchived = false } = {}) {
  try {
    const res = await selectJourneyStagesWithArchive(dbId, { includeArchived });
    return res.rows || [];
  } catch (_) {
    try {
      const res = await selectJourneyStagesWithTemplate(dbId); // archive columns not migrated yet
      return res.rows || [];
    } catch (_) {
      const res = await selectJourneyStagesCore(dbId); // pre-template databases too
      return res.rows || [];
    }
  }
}

export async function getJourneyStage(dbId, stageId) {
  const res = await selectJourneyStageRow(dbId, stageId);
  return res.rows?.[0] || null;
}

export async function nextJourneyStageOrder(dbId) {
  const res = await selectNextJourneyStageOrder(dbId);
  return Number(res.rows?.[0]?.next_order || 1);
}

// ── Stage moves ──────────────────────────────────────────────────────────────

/**
 * Swap a stage with its neighbour (direction: up | down) inside a
 * transaction so the UNIQUE(venture_id, stage_order) constraint is never
 * violated mid-swap.
 */
export async function moveJourneyStage({ dbId, stageId, direction }) {
  return runInTransaction(async (query) => {
    const rows = await selectJourneyStageOrders(query, dbId);
    const list = rows.rows || [];
    const currentIndex = list.findIndex((stage) => stage.id === stageId);
    if (currentIndex === -1) return { error: "Stage not found." };
    const targetIndex = direction === "up" ? currentIndex - 1 : direction === "down" ? currentIndex + 1 : -1;
    if (targetIndex < 0 || targetIndex >= list.length) return { error: "Already at the edge." };

    const currentStage = list[currentIndex];
    const targetStage = list[targetIndex];
    // Park one order at a negative sentinel (orders are positive 1..n), then
    // swap — unique constraint is satisfied after every statement.
    await parkJourneyStageOrder(query, currentStage.id);
    await setJourneyStageOrder(query, currentStage.stage_order, targetStage.id);
    await setJourneyStageOrder(query, targetStage.stage_order, currentStage.id);
    return { success: true };
  });
}

/** Delete a stage and re-serialize the remaining order (1..n) atomically. */
export async function deleteJourneyStage({ dbId, stageId }) {
  return runInTransaction(async (query) => {
    await deleteJourneyStageRow(query, stageId, dbId);
    const rows = await selectJourneyStageIdsInOrder(query, dbId);
    for (let i = 0; i < (rows.rows || []).length; i++) {
      await setJourneyStageOrder(query, i + 1, rows.rows[i].id);
    }
    return { success: true };
  });
}

// ── Archive / permanent delete ───────────────────────────────────────────────

/** Milestone ids bound to one journey stage. */
async function stageMilestoneIds({ dbId, stageId }) {
  const result = await selectStageMilestoneIds(dbId, stageId).catch(() => ({ rows: [] }));
  return rowsOf(result).map((milestone) => milestone.id);
}

/** True when the stage's journey has any filed work (submissions/reviews/deliverables). */
export async function stageHasFiledWork({ dbId, stageId }) {
  const milestoneIds = await stageMilestoneIds({ dbId, stageId });
  for (const milestoneId of milestoneIds) {
    if (await milestoneHasFiledWork(milestoneId)) return true;
  }
  return false;
}

/**
 * Archive/restore a set of journey stages. Archive NEVER fails on filed work
 * (that is exactly what archive is for); it only hides the journey.
 * Returns { archived: [...], restored: [...], blocked: [...] }.
 */
export async function archiveJourneyStages({ dbId, stageIds = [], actorCid = null }) {
  const archived = [];
  const restored = [];
  const blocked = [];
  for (const rawId of stageIds) {
    const id = String(rawId);
    try {
      const row = rowsOf(await selectJourneyStageForArchive(dbId, id))[0];
      if (!row) {
        blocked.push({ id, title: id, reason: "Journey not found." });
        continue;
      }
      await archiveJourneyStageRow(actorCid, id, dbId);
      archived.push({ id, title: row.name || id });
    } catch (_) {
      blocked.push({ id, title: id, reason: "Could not archive this journey." });
    }
  }
  return { archived, restored, blocked };
}

export async function restoreJourneyStages({ dbId, stageIds = [] }) {
  const restored = [];
  const blocked = [];
  for (const rawId of stageIds) {
    const id = String(rawId);
    try {
      const row = rowsOf(await selectJourneyStageForArchive(dbId, id))[0];
      if (!row) {
        blocked.push({ id, title: id, reason: "Journey not found." });
        continue;
      }
      await restoreJourneyStageRow(id, dbId);
      restored.push({ id, title: row.name || id });
    } catch (_) {
      blocked.push({ id, title: id, reason: "Could not restore this journey." });
    }
  }
  return { archived: [], restored, blocked };
}

/** Re-serialize stage_order (1..n) for every remaining stage of the Venture. */
async function renumberStages(dbId) {
  const rows = rowsOf(await selectJourneyStageIdsOrdered(dbId));
  for (let i = 0; i < rows.length; i += 1) {
    await updateJourneyStageOrder(i + 1, rows[i].id);
  }
}

/**
 * Permanently delete journey stages (and their clean milestone/task
 * structure). Journeys with filed work are blocked — archive them instead.
 * Returns { deleted: [...], blocked: [{ id, title, reason }] }.
 */
export async function deleteJourneyStages({ dbId, stageIds = [] }) {
  const deleted = [];
  const blocked = [];

  for (const rawId of stageIds) {
    const id = String(rawId);
    try {
      const row = rowsOf(await selectJourneyStageForArchive(dbId, id))[0];
      if (!row) {
        blocked.push({ id, title: id, reason: "Journey not found." });
        continue;
      }
      if (await stageHasFiledWork({ dbId, stageId: id })) {
        blocked.push({
          id,
          title: row.name || id,
          reason: "This journey already has submitted work — it cannot be permanently deleted. Archive it instead.",
        });
        continue;
      }

      const milestoneIds = await stageMilestoneIds({ dbId, stageId: id });

      // Best-effort cleanup of optional child rows (outside the core
      // transaction so a missing legacy table can never abort the delete).
      for (const milestoneId of milestoneIds) {
        const taskRows = await selectMilestoneTaskIds(milestoneId).catch(() => ({ rows: [] }));
        for (const task of rowsOf(taskRows)) {
          await deleteTaskReviewsForTask(task.id).catch(() => {});
          await deleteTaskCommentsForTask(task.id).catch(() => {});
          await deleteTaskAttachmentsForTask(task.id).catch(() => {});
        }
      }
      await deleteJourneyStageNotes(id).catch(() => {});

      await runInTransaction(async (query) => {
        for (const milestoneId of milestoneIds) {
          await deleteDeliverablesForMilestone(query, milestoneId);
          await deleteTasksForMilestone(query, milestoneId);
          await deleteMilestoneRow(query, milestoneId, dbId);
        }
        await deleteJourneyStageRow(query, id, dbId);
      });

      deleted.push({ id, title: row.name || id });
    } catch (_) {
      blocked.push({ id, title: id, reason: "Could not delete this journey." });
    }
  }

  if (deleted.length > 0) {
    await renumberStages(dbId).catch(() => {});
  }
  return { deleted, blocked };
}

// ── Template library ─────────────────────────────────────────────────────────

/** List the template library with structural counts (newest first). */
export async function listJourneyTemplates() {
  const res = await selectJourneyTemplatesWithCounts();
  return rowsOf(res);
}

/**
 * Save the Venture's entire journey (stages + bound milestones + top-level
 * tasks) as a template. Returns { error } or
 * { success, template_id, name, stages, milestones, tasks }.
 */
export async function saveJourneyAsTemplate({ dbId, name, description = null, actorCid = null }) {
  const stagesResult = await selectJourneyStagesForTemplate(dbId);
  // Archived (soft-deleted) journeys are never captured into a new template.
  const stages = rowsOf(stagesResult).filter((stage) => stage.is_archived !== true);
  if (stages.length === 0) return { error: "This Venture has no journey stages to save yet." };

  const templateId = newUuid();
  const templateName = String(name || "").trim() || `${stages[0].name || "Venture"} Journey`;
  let stageCount = 0;
  let milestoneCount = 0;
  let taskCount = 0;

  await runInTransaction(async (query) => {
    await insertJourneyTemplateRow(query, {
      id: templateId,
      name: templateName,
      description: description || null,
      createdBy: actorCid || null,
    });

    for (const stage of stages) {
      stageCount += 1;
      const templateStageId = newUuid();
      await insertJourneyTemplateStageRow(query, {
        id: templateStageId,
        templateId,
        name: stage.name || "Untitled stage",
        description: stage.description || null,
        objective: stage.objective || null,
        stageOrder: stageCount,
      });

      const milestonesResult = await selectMilestonesForJourneyStage(query, stage.id);
      for (const milestone of rowsOf(milestonesResult)) {
        milestoneCount += 1;
        const templateMilestoneId = newUuid();
        await insertJourneyTemplateMilestoneRow(query, {
          id: templateMilestoneId,
          stageId: templateStageId,
          title: milestone.title,
          description: milestone.description || null,
          objective: milestone.objective || null,
          priority: milestone.priority || "medium",
          displayOrder: milestone.display_order ?? 0,
        });

        const tasksResult = await selectTopLevelTasksForMilestone(query, milestone.id);
        for (const task of rowsOf(tasksResult)) {
          taskCount += 1;
          await insertJourneyTemplateTaskRow(query, {
            id: newUuid(),
            milestoneId: templateMilestoneId,
            title: task.title || "Untitled task",
            description: task.description || null,
            priority: task.priority || "medium",
            labelsJson: toJsonArrayText(task.labels),
            checklistJson: toJsonArrayText(task.checklist),
            reviewRequired: toReviewRequiredText(task.review_required),
            requiredDeliverableType: task.required_deliverable_type || null,
            displayOrder: task.display_order ?? 0,
          });
        }
      }
    }
  });

  return {
    success: true,
    template_id: templateId,
    name: templateName,
    stages: stageCount,
    milestones: milestoneCount,
    tasks: taskCount,
  };
}

/**
 * Apply a journey template to a Venture: fresh journey stages with fresh
 * milestone + task rows. Returns { error } or
 * { success, stages, milestones, tasks }.
 *
 * A Venture may already be under way, so applying ADDS a chapter rather than
 * demanding a clean slate. Stage order is UNIQUE per Venture, so the new stages
 * CONTINUE the numbering; the old refusal forced a manager to tear a running
 * journey down to reuse a framework, which is never what they meant — the
 * framework is the point, and so is the work already there.
 *
 * On a Venture with no journey yet the first stage opens active and the rest
 * wait upcoming; on one already under way every new stage arrives upcoming, so
 * nothing opens itself on top of work in flight.
 */
export async function applyJourneyTemplate({ dbId, templateId, actorCid = null }) {
  const existing = await selectMaxJourneyStageOrder(dbId);
  const startingOrder = Number(rowsOf(existing)[0]?.max_order || 0);
  const ventureAlreadyHasAJourney = startingOrder > 0;

  const template = rowsOf(await selectJourneyTemplateById(templateId))[0];
  if (!template) return { error: "Template not found." };

  let stageCount = 0;
  let stageOrder = startingOrder;
  let milestoneCount = 0;
  let taskCount = 0;

  await runInTransaction(async (query) => {
    const templateStages = rowsOf(await selectTemplateStagesForApply(query, templateId));
    if (templateStages.length === 0) return { error: "Template has no stages." };

    for (let i = 0; i < templateStages.length; i++) {
      const templateStage = templateStages[i];
      stageCount += 1;
      stageOrder += 1;
      // Only a FIRST application opens its first journey. Adding to a Venture
      // already under way brings the new stages in UPCOMING: a journey opens
      // when its own start date arrives (or a manager activates it), never
      // because it happened to be first in a template.
      const stageStatus = !ventureAlreadyHasAJourney && i === 0 ? "active" : "upcoming";
      const stageInsertResult = await insertJourneyStageFromTemplateRow(query, {
        dbId,
        name: templateStage.name,
        description: templateStage.description || null,
        objective: templateStage.objective || null,
        stageOrder,
        status: stageStatus,
        templateId,
      });
      const newStageId = rowsOf(stageInsertResult)[0]?.id;

      const templateMilestones = rowsOf(await selectTemplateMilestonesForStage(query, templateStage.id));
      for (const templateMilestone of templateMilestones) {
        milestoneCount += 1;
        const newMilestoneId = newUuid();
        // Availability is set by the JOURNEY, never by a milestone's position:
        // a stage that has not opened offers nothing, and an active one offers
        // all of its milestones so the work can start. (Position-based release
        // went with the sequential chain; this template path had not caught up,
        // so a held stage was handing out its own first milestone.)
        const msStatus = stageStatus === "active" ? "not_started" : "upcoming";
        await insertMilestoneFromTemplateRow(query, {
          id: newMilestoneId,
          dbId,
          title: templateMilestone.title,
          description: templateMilestone.description || null,
          objective: templateMilestone.objective || null,
          status: msStatus,
          priority: templateMilestone.priority || "medium",
          displayOrder: templateMilestone.display_order ?? 0,
          stageId: newStageId,
          createdBy: actorCid || null,
        });

        const templateTasks = rowsOf(await selectTemplateTasksForMilestone(query, templateMilestone.id));
        for (const templateTask of templateTasks) {
          taskCount += 1;
          await insertTaskFromTemplateRow(query, {
            dbId,
            milestoneId: newMilestoneId,
            title: templateTask.title,
            description: templateTask.description || null,
            priority: templateTask.priority || "medium",
            labelsJson: toJsonArrayText(templateTask.labels),
            checklistJson: toJsonArrayText(templateTask.checklist),
            displayOrder: templateTask.display_order ?? 0,
            reviewRequired: toReviewRequiredText(templateTask.review_required),
            requiredDeliverableType: templateTask.required_deliverable_type || null,
          });
        }
      }
    }
  });

  return { success: true, template_id: templateId, stages: stageCount, milestones: milestoneCount, tasks: taskCount };
}

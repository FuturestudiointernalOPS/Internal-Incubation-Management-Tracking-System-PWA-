/**
 * journey — The journey template library: list, save as template, apply.
 *
 * Part of `services/ventures/journey` (split out of the former single
 * 520-line module, lane L2; code moved verbatim). The public surface is
 * re-exported unchanged by `src/services/ventures/journey.js`.
 */
import {
  insertJourneyStageFromTemplateRow,
  insertJourneyTemplateMilestoneRow,
  insertJourneyTemplateRow,
  insertJourneyTemplateStageRow,
  insertJourneyTemplateTaskRow,
  insertMilestoneFromTemplateRow,
  insertTaskFromTemplateRow,
  runInTransaction,
  selectJourneyStagesForTemplate,
  selectJourneyTemplateById,
  selectJourneyTemplatesWithCounts,
  selectMaxJourneyStageOrder,
  selectMilestonesForJourneyStage,
  selectTemplateMilestonesForStage,
  selectTemplateStagesForApply,
  selectTemplateTasksForMilestone,
  selectTopLevelTasksForMilestone,
} from "@/models/ventureJourneyStore";
import {
  newUuid,
  rowsOf,
  toJsonArrayText,
  toReviewRequiredText,
} from "./stages";

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

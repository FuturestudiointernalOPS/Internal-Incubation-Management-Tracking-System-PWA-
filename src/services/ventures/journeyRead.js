/**
 * services/ventures/journeyRead — what a Journey read carries beyond its stages.
 *
 * Moved verbatim out of `src/app/api/ventures/[id]/journey/route.js` (GET, lane
 * L2): attaches to each stage its milestones, each milestone's deliverables
 * (private evidence signed per read) and task execution counts, and resolves
 * the template the journey was generated from. The controller keeps the access
 * gate, the date-driven activation, the audience projection and the response.
 *
 * Same facades as the controller used, so route-level test mocks still apply.
 * No SQL, no HTTP.
 */
import { TASK_COMPLETED_STATUSES } from "@/lib/ventureStatuses";
import {
  listJourneyMilestonesByStage,
  listJourneyMilestonesByStageLegacy,
  listJourneyDeliverablesByMilestoneIds,
  listJourneyTasksByMilestoneIds,
  listJourneyTaskStatusesByMilestoneIds,
  listJourneyTaskStatusesByMilestoneIdsLegacy,
  getJourneyTemplateName,
} from "@/models/ventureJourney";

/**
 * `signEvidence(deliverable)` sets `evidence_download_url` on a deliverable
 * that has an attachment (the controller's signing rule).
 *
 * Mutates `stages` in place (milestones, deliverables, task_counts,
 * milestone_counts; strips the per-stage template stamp) exactly as the
 * controller did.
 *
 * @returns {Promise<{ templateSource: object|null, deliverablesUnavailable: boolean }>}
 */
export async function attachJourneyWork({ ventureParam, dbId, stages, signEvidence }) {
  // Phase 2 spine: attach the milestones bound to each stage so the Journey
  // timeline can show stage -> milestone progress. Venture-facing data only
  // (milestones are visible to members through their own tools). Defensive:
  // if the additive columns are missing the stage list still renders.
  const milestonesResult = await listJourneyMilestonesByStage(dbId).catch(() =>
    listJourneyMilestonesByStageLegacy(dbId).catch(() => ({ rows: [] })),
  );
  const milestonesByStage = {};
  for (const milestone of milestonesResult.rows || []) {
    const key = String(milestone.journey_stage_id);
    (milestonesByStage[key] = milestonesByStage[key] || []).push(milestone);
  }

  // Deliverables attached to each milestone (evidence submitted by the
  // Venture, reviewed by the Lead Manager / a scoped coach). Guarded so a
  // database without the table still renders the journey.
  const boundMilestoneIds = Object.values(milestonesByStage)
    .flat()
    .map((milestone) => String(milestone.id));
  const deliverablesByMilestone = {};
  // A failure here used to be swallowed as "this Venture has no deliverables",
  // which is how evidence vanished from EVERY view at once with no explanation
  // (a stale column, a type mismatch, a transient outage). The read stays
  // tolerant so the roadmap still renders, but it no longer lies: the failure
  // is logged and reported, and the surfaces show it instead of an empty list.
  let deliverablesUnavailable = false;
  if (boundMilestoneIds.length > 0) {
    const deliverablesResult = await listJourneyDeliverablesByMilestoneIds(boundMilestoneIds)
      .catch((error) => {
        deliverablesUnavailable = true;
        console.error(`[journey] deliverable evidence read failed for venture ${ventureParam}:`, error?.message || error);
        return { rows: [] };
      });
    for (const deliverable of deliverablesResult.rows || []) {
      const key = String(deliverable.milestone_id);
      (deliverablesByMilestone[key] = deliverablesByMilestone[key] || []).push(deliverable);
    }
    // Private evidence is signed by the controller (`signEvidence`): it owns
    // who may receive a usable URL. Called once per deliverable with a file.
    await Promise.all(
      Object.values(deliverablesByMilestone)
        .flat()
        .map(async (deliverable) => {
          if (!deliverable.attachment_url) return;
          await signEvidence(deliverable);
        }),
    );
  }

  // Task EXECUTION counts per milestone: the badge says what the outcome is,
  // this says how much of the work under it is done ("12 / 17 tasks done").
  // Display only — it never touches `progress`, which stays evidence-driven,
  // so no dashboard, report or export changes meaning because of this read.
  const taskCountsByMilestone = {};
  if (boundMilestoneIds.length > 0) {
    const tasksResult = await listJourneyTaskStatusesByMilestoneIds(boundMilestoneIds)
      .catch(() =>
        listJourneyTaskStatusesByMilestoneIdsLegacy(boundMilestoneIds).catch(() => ({ rows: [] })),
      );
    for (const task of tasksResult.rows || []) {
      const key = String(task.milestone_id);
      const counts = (taskCountsByMilestone[key] = taskCountsByMilestone[key] || { total: 0, done: 0 });
      counts.total += 1;
      if (TASK_COMPLETED_STATUSES.includes(String(task.status || "").trim().toLowerCase())) {
        counts.done += 1;
      }
    }
  }

  // The Activity behind each deliverable: a deliverable points at the task
  // that produces it (task_id), so the pair is resolved here. Guarded like the
  // counts — a database without the new columns still renders the roadmap.
  const tasksById = new Map();
  if (boundMilestoneIds.length > 0) {
    const tasksResult = await listJourneyTasksByMilestoneIds(boundMilestoneIds).catch(() => ({ rows: [] }));
    for (const task of tasksResult.rows || []) tasksById.set(String(task.id), task);
  }

  // Template provenance: stages generated from a reusable template carry a
  // (type, id) stamp — resolve the current template name for the UI banner.
  const stamped = stages.find((stage) => stage.source_template_id);
  let templateSource = null;
  if (stamped && stamped.source_template_id) {
    const srcType = stamped.source_template_type === "journey" ? "journey" : "plan";
    const table = srcType === "journey" ? "venture_journey_templates" : "venture_plan_templates";
    try {
      const templateResult = await getJourneyTemplateName(table, stamped.source_template_id).catch(() => ({ rows: [] }));
      const template = templateResult.rows?.[0];
      if (template) templateSource = { type: srcType, id: stamped.source_template_id, name: template.name || null };
    } catch (_) {}
  }

  for (const stage of stages) {
    const stageMilestones = milestonesByStage[stage.id] || [];
    stage.milestones = stageMilestones;
    for (const milestone of stageMilestones) {
      milestone.deliverables = deliverablesByMilestone[String(milestone.id)] || [];
      milestone.task_counts = taskCountsByMilestone[String(milestone.id)] || { total: 0, done: 0 };
      // "Activity → Deliverable": the deliverable carries its linked task's
      // title, Definition of Done, support and start — so one screen shows the
      // whole chain without a second read.
      for (const deliverable of milestone.deliverables) {
        const task =
          deliverable.task_id === null || deliverable.task_id === undefined
            ? null
            : tasksById.get(String(deliverable.task_id));
        deliverable.activity = task
          ? {
              id: task.id,
              source_ref: task.source_ref || null,
              title: task.title || null,
              description: task.description || null,
              definition_of_done: task.definition_of_done || null,
              owner_name: task.assigned_name || null,
              support_name: task.support_name || null,
              start_date: task.start_date || null,
              due_date: task.due_date || null,
            }
          : null;
      }
    }
    stage.milestone_counts = {
      total: stageMilestones.length,
      completed: stageMilestones.filter((milestone) => milestone.status === "completed").length,
    };
    // Provenance is surfaced once at the top level — never per-stage.
    delete stage.source_template_type;
    delete stage.source_template_id;
  }

  return { templateSource, deliverablesUnavailable };
}

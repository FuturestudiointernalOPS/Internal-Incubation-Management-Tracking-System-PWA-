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
export async function attachJourneyWork({ ventureParam, dbId, stages, signEvidence, includeArchived = false }) {
  // Phase 2 spine: attach the milestones bound to each stage so the Journey
  // timeline can show stage -> milestone progress. Venture-facing data only
  // (milestones are visible to members through their own tools). Defensive:
  // if the additive columns are missing the stage list still renders.
  //
  // `includeArchived` mirrors the STAGE read exactly: the Journey route sets it
  // only for a manager who asked for archived content. A soft-deleted milestone
  // must not be shown as live work to everyone else.
  const milestonesResult = await listJourneyMilestonesByStage(dbId, { includeArchived }).catch(() =>
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
  const tasksByMilestone = {};
  if (boundMilestoneIds.length > 0) {
    const tasksResult = await listJourneyTasksByMilestoneIds(boundMilestoneIds).catch(() => ({ rows: [] }));
    for (const task of tasksResult.rows || []) {
      tasksById.set(String(task.id), task);
      const key = String(task.milestone_id);
      (tasksByMilestone[key] = tasksByMilestone[key] || []).push(task);
    }
  }

  // Template provenance: stages generated from a reusable template carry a
  // (type, id) stamp — resolve the current template name for the UI banner.
  const stamped = stages.find((stage) => stage.source_template_id);
  let templateSource = null;
  // A stage stamped "plan_import" came from an imported tracker, not a reusable
  // template: its id points at the import, so there is no template name to read.
  // Asking the plan-template table (integer ids) with that UUID made the query
  // fail on every load of a journey.
  const looksLikeTemplate =
    stamped &&
    stamped.source_template_id &&
    stamped.source_template_type !== "plan_import" &&
    (stamped.source_template_type === "journey" || /^\d+$/.test(String(stamped.source_template_id)));
  if (looksLikeTemplate) {
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
      // A task whose linked deliverable has been APPROVED is finished: the
      // approval is the evidence, and it never rewrites the task row itself, so
      // the count reads it from the deliverable (never beyond the milestone's total).
      const approvedTaskIds = new Set(
        milestone.deliverables
          .filter((deliverable) => deliverable.approval_status === "approved" && deliverable.task_id != null)
          .map((deliverable) => String(deliverable.task_id)),
      );
      if (approvedTaskIds.size > 0) {
        const alsoDone = (tasksByMilestone[String(milestone.id)] || []).filter(
          (task) =>
            approvedTaskIds.has(String(task.id)) &&
            !TASK_COMPLETED_STATUSES.includes(String(task.status || "").trim().toLowerCase()),
        ).length;
        milestone.task_counts = {
          total: milestone.task_counts.total,
          done: Math.min(milestone.task_counts.total, milestone.task_counts.done + alsoDone),
        };
      }
      // A session can be booked AGAINST one of the milestone's ACTIVITIES (a
      // task), not only against the milestone: the whole work list is exposed
      // here so the booking form can offer it.
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
      // The milestone view renders an ACTIVITY block — Definition of Done, the
      // people supporting it, its start — from THIS list, so the list has to carry
      // those fields. It used to hand over only the booking fields, so an activity
      // reached the screen twice: complete through its deliverable, bare through its
      // milestone. The bare one won the grouping, and every milestone read
      // "Definition of Done: Not provided" for work whose Definition of Done was
      // stored, filled and correct.
      milestone.activities = (tasksByMilestone[String(milestone.id)] || []).map((task) => ({
        id: task.id,
        source_ref: task.source_ref || null,
        title: task.title || null,
        description: task.description || null,
        definition_of_done: task.definition_of_done || null,
        owner_name: task.assigned_name || null,
        support_name: task.support_name || null,
        start_date: task.start_date || null,
        due_date: task.due_date || null,
        status: task.status || null,
      }));
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

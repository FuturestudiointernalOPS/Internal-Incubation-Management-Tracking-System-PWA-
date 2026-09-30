import db from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireVentureAccess } from "@/lib/ventureAuth";
import { resolvePlanAccess, allowsPlanAction } from "@/lib/ventureOperatingPlans";
import { roleIsPrivileged } from "@/lib/ventureAuth";
import { canManageMilestones, releaseMilestonesForStage, activateDueStages } from "@/lib/ventureMilestoneEngine";
import { evidenceDownloadUrl, isExternalEvidenceLink } from "@/lib/ventureEvidence";
import { projectJourneyStagesForVenture } from "@/lib/ventureVisibility";
import { TASK_COMPLETED_STATUSES } from "@/lib/ventureStatuses";
import {
  ensureJourneyTable,
  resolveVentureInternalId,
  listJourneyStages,
  getJourneyStage,
  nextJourneyStageOrder,
  moveJourneyStage,
  deleteJourneyStage,
} from "@/lib/ventureJourneys";
import { diffFields, recordVentureChange } from "@/models/ventureChangeLog";
import {
  listJourneyMilestonesByStage,
  listJourneyMilestonesByStageLegacy,
  listJourneyDeliverablesByMilestoneIds,
  listJourneyTaskStatusesByMilestoneIds,
  listJourneyTaskStatusesByMilestoneIdsLegacy,
  getJourneyTemplateName,
  countJourneyStagesByVenture,
  insertJourneyStage,
  updateJourneyStageFields,
  activateJourneyStage,
  lockJourneyStage,
  holdJourneyStageMilestones,
  resetJourneyStage,
} from "@/models/ventureJourney";

export const dynamic = "force-dynamic";

/**
 * Venture Journey API.
 *
 * The Journey is Venture-facing but staff-defined: it is NOT a hardcoded
 * curriculum. Authorized staff (holding `operating_plan` capabilities on a
 * venture-wide assignment — or a global role) define the stages for the
 * specific Venture. Venture members read the published stages.
 *
 *   GET    — published stages (anyone with Venture access) + author flags
 *            (only returned to authorized staff)
 *   POST   — add a stage { name, description?, objective?, target_date? }
 *   PATCH  — stage management { action, stage_id, ... }:
 *            update | activate | lock | complete | reset | delete | move
 */

async function getViewerSession() {
  return getSession();
}

/** Shared write-gate: staff instrument only (operating_plan area). */
async function requireStaffJourneyAccess(id) {
  const session = await getViewerSession();
  if (!session) return { session: null, access: null };
  const access = await resolvePlanAccess(db, id, session);
  if (!access.ok) return { session, access: null };
  return { session, access };
}

async function resolveDbId(id) {
  await ensureJourneyTable();
  return resolveVentureInternalId(id);
}

export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const { session } = await requireVentureAccess(id);
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

    const dbId = await resolveDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    // Date-driven activation: a Journey whose start_date has arrived becomes
    // active — and its milestones are offered — right here. Journeys never
    // wait for another Journey to complete, so no one presses "activate".
    await activateDueStages(db, { dbId });

    // Management surfaces (staff) may request archived journeys; the
    // Venture-facing read never includes them.
    const wantArchived = new URL(req.url).searchParams.get("include_archived") === "1";

    // Author flags for staff surfaces only (members never receive them).
    let access = null;
    const viewer = await getViewerSession();
    if (viewer) {
      const planAccess = await resolvePlanAccess(db, id, viewer);
      if (planAccess.ok) {
        const [canCreate, canEdit, canManage] = await Promise.all([
          allowsPlanAction(db, planAccess, "create"),
          allowsPlanAction(db, planAccess, "edit"),
          allowsPlanAction(db, planAccess, "manage"),
        ]);
        access = { create: canCreate, edit: canEdit, manage: canManage };
      }
    }

    const stages = await listJourneyStages(dbId, {
      includeArchived: wantArchived && Boolean(access && access.manage),
    });

    // Milestone STRUCTURE authority (add / remove / duplicate / reorder) is
    // Lead Manager or Super Admin only — the panel hides those controls when
    // this is false. Never granted to members.
    let milestoneAuthority = false;
    if (viewer) {
      milestoneAuthority = await canManageMilestones(db, { id, cid: viewer.cid, role: viewer.role });
    }

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
          console.error(`[journey] deliverable evidence read failed for venture ${id}:`, error?.message || error);
          return { rows: [] };
        });
      for (const deliverable of deliverablesResult.rows || []) {
        const key = String(deliverable.milestone_id);
        (deliverablesByMilestone[key] = deliverablesByMilestone[key] || []).push(deliverable);
      }
      // Private evidence: a storage path is signed per read (1h), while an
      // external link the author pasted passes through untouched. Only viewers
      // who already passed this Venture read ever receive a usable URL.
      await Promise.all(
        Object.values(deliverablesByMilestone)
          .flat()
          .map(async (deliverable) => {
            if (!deliverable.attachment_url) return;
            deliverable.evidence_download_url = isExternalEvidenceLink(deliverable.attachment_url)
              ? deliverable.attachment_url
              : await evidenceDownloadUrl(deliverable.attachment_url);
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
      }
      stage.milestone_counts = {
        total: stageMilestones.length,
        completed: stageMilestones.filter((milestone) => milestone.status === "completed").length,
      };
      // Provenance is surfaced once at the top level — never per-stage.
      delete stage.source_template_type;
      delete stage.source_template_id;
    }

    // Guided experience (Vinance 3): a member sees the WHOLE map — every
    // Journey and every Milestone with its real status — and walks only the
    // part the Venture has reached. Future work is SEALED (title + status +
    // target date, no description/objective/deliverables) rather than deleted
    // from the payload: dropping it made the roadmap look like it had lost its
    // future, which is the confusion this replaces. Staff actors keep the
    // unsealed view; see src/lib/ventureVisibility.js for the projection.
    //
    // Both audiences are projected, differing only by `unsealed`, so the shape
    // never depends on who is asking: `sealed` is always present (true/false)
    // and a milestone's `deliverables` is always an array, never undefined.
    const unsealed = !viewer || Boolean(access) || roleIsPrivileged(viewer.role);
    const projected = projectJourneyStagesForVenture(stages, { unsealed });
    if (!unsealed) {
      return NextResponse.json({
        success: true,
        stages: projected,
        access,
        guided: true,
        template_source: templateSource,
        milestone_authority: milestoneAuthority,
        deliverables_unavailable: deliverablesUnavailable,
      });
    }

    return NextResponse.json({ success: true, stages: projected, access, template_source: templateSource, milestone_authority: milestoneAuthority, deliverables_unavailable: deliverablesUnavailable });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const { session, access } = await requireStaffJourneyAccess(id);
    if (!session || !access) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    if (!(await allowsPlanAction(db, access, "create"))) {
      return NextResponse.json({ success: false, error: "Your assignment does not allow defining this Venture's journey." }, { status: 403 });
    }

    const dbId = await resolveDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const body = await req.json();
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ success: false, error: "name is required." }, { status: 400 });

    const existing = await countJourneyStagesByVenture(dbId);
    const count = Number(existing.rows?.[0]?.n || 0);
    const stageOrder = await nextJourneyStageOrder(dbId);
    const status = count === 0 ? "active" : "upcoming";
    const targetDate = body.target_date ? String(body.target_date).slice(0, 10) : null;
    // Optional: when the Journey starts on its own (NULL = it starts only when
    // a staff member activates it). No ordering is imposed on it.
    const startDate = body.start_date ? String(body.start_date).slice(0, 10) : null;

    const insertResult = await insertJourneyStage({
      ventureId: dbId, name, description: body.description || null, objective: body.objective || null,
      startDate, targetDate, stageOrder, status,
    });

    try {
      const { addVentureHistory } = await import("@/lib/ventures");
      await addVentureHistory({ venture_id: id, event_type: "JOURNEY_STAGE_ADDED", description: `Journey stage "${name}" added` });
    } catch (_) {}

    // Managers keep their Archived view in sync: archived rows are returned
    // only to callers holding the manage capability (same rule as GET).
    const canManage = await allowsPlanAction(db, access, "manage");
    const stages = await listJourneyStages(dbId, { includeArchived: canManage });
    return NextResponse.json({ success: true, stage: stages.find((stage) => stage.id === insertResult.rows?.[0]?.id) || null, stages });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    const { session, access } = await requireStaffJourneyAccess(id);
    if (!session || !access) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

    const dbId = await resolveDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const body = await req.json();
    const action = String(body.action || "");
    const stageId = body.stage_id ? String(body.stage_id) : null;

    // ── Field edits ──
    if (action === "update") {
      if (!(await allowsPlanAction(db, access, "edit"))) {
        return NextResponse.json({ success: false, error: "Your assignment does not allow editing this Venture's journey." }, { status: 403 });
      }
      if (!stageId) return NextResponse.json({ success: false, error: "stage_id is required." }, { status: 400 });
      const stage = await getJourneyStage(dbId, stageId);
      if (!stage) return NextResponse.json({ success: false, error: "Stage not found" }, { status: 404 });

      const name = body.name !== undefined ? String(body.name).trim() : null;
      if (name === "") return NextResponse.json({ success: false, error: "name cannot be empty." }, { status: 400 });
      const targetDate = body.target_date !== undefined ? (body.target_date ? String(body.target_date).slice(0, 10) : null) : undefined;
      const startDate = body.start_date !== undefined ? (body.start_date ? String(body.start_date).slice(0, 10) : null) : undefined;

      await updateJourneyStageFields([
        name, body.description !== undefined ? 1 : 0, body.description !== undefined ? body.description : null,
        body.objective !== undefined ? 1 : 0, body.objective !== undefined ? body.objective : null,
        targetDate !== undefined ? 1 : 0, targetDate !== undefined ? targetDate : null,
        startDate !== undefined ? 1 : 0, startDate !== undefined ? startDate : null,
        stageId, dbId,
      ]);
      // Field-level history of the edit. Non-fatal by contract — the write above
      // already succeeded and must not be undone by a logging failure.
      try {
        const JOURNEY_FIELDS = ["name", "description", "objective", "target_date", "start_date"];
        const journeyChanges = diffFields(stage, body, JOURNEY_FIELDS);
        if (journeyChanges.length) {
          await recordVentureChange({
            dbId,
            entityType: "journey",
            entityId: stageId,
            entityLabel: stage.name || name || null,
            action: "updated",
            actorCid: session?.cid || null,
            actorName: session?.name || null,
            changes: journeyChanges,
          });
        }
      } catch (_) {}

      const canManage = await allowsPlanAction(db, access, "manage");
      const stages = await listJourneyStages(dbId, { includeArchived: canManage });
      return NextResponse.json({ success: true, stages });
    }

    // ── Management actions (status transitions, delete, move, template) ──
    const manageActions = ["activate", "lock", "complete", "reset", "delete", "move"];
    if (manageActions.includes(action)) {
      if (!(await allowsPlanAction(db, access, "manage"))) {
        return NextResponse.json({ success: false, error: "Your assignment does not allow managing this Venture's journey." }, { status: 403 });
      }
    } else {
      return NextResponse.json({ success: false, error: "Unknown action." }, { status: 400 });
    }

    const stage = stageId ? await getJourneyStage(dbId, stageId) : null;

    if (action === "activate") {
      if (!stage) return NextResponse.json({ success: false, error: "Stage not found" }, { status: 404 });
      if (stage.status === "completed") {
        return NextResponse.json({ success: false, error: "Completed stages are not reactivated directly — reset the stage first." }, { status: 400 });
      }
      // Activating is additive: Journeys overlap, so the others are left
      // alone (locking them here would fight the date-driven sweep, which
      // re-activates any Journey whose start_date has arrived).
      await activateJourneyStage(stageId, dbId);
      // The journey is now active — its milestones are offered (availability
      // is set by the Journey, never by a milestone's position).
      await releaseMilestonesForStage(db, { dbId, stageId });
    } else if (action === "lock") {
      if (!stage) return NextResponse.json({ success: false, error: "Stage not found" }, { status: 404 });
      if (stage.status === "completed") {
        return NextResponse.json({ success: false, error: "Completed stages cannot be paused — reset the stage first." }, { status: 400 });
      }
      await lockJourneyStage(stageId, dbId);
      // A Journey that is no longer active holds its unreleased work again.
      // Work already under way is left where it is.
      await holdJourneyStageMilestones(dbId, stageId);
    } else if (action === "complete") {
      // A journey is NEVER closed by hand: it completes automatically once all
      // of its milestones have been marked completed.
      return NextResponse.json(
        { success: false, error: "A journey cannot be closed manually — it completes automatically once all of its milestones are completed." },
        { status: 400 },
      );
    } else if (action === "reset") {
      if (!stage) return NextResponse.json({ success: false, error: "Stage not found" }, { status: 404 });
      // Reopening touches THIS Journey only. Journeys overlap, so what the
      // others are is decided by their own dates (and by staff), never by a
      // neighbour's state — the old positional re-lock is gone.
      await resetJourneyStage(stageId, dbId);
      // Reopened journey is active again — its milestones are offered.
      await releaseMilestonesForStage(db, { dbId, stageId });
    } else if (action === "delete") {
      if (!stage) return NextResponse.json({ success: false, error: "Stage not found" }, { status: 404 });
      await deleteJourneyStage({ dbId, stageId });
    } else if (action === "move") {
      if (!stage) return NextResponse.json({ success: false, error: "Stage not found" }, { status: 404 });
      const direction = String(body.direction || "");
      if (!["up", "down"].includes(direction)) {
        return NextResponse.json({ success: false, error: "direction (up|down) is required." }, { status: 400 });
      }
      const moved = await moveJourneyStage({ dbId, stageId, direction });
      if (moved.error) return NextResponse.json({ success: false, error: moved.error }, { status: 400 });
    }

    // The transition itself is the change. Recorded after the gate above, so a
    // refused action never leaves a row claiming it happened.
    try {
      const ACTION_NAMES = { activate: "activated", lock: "locked", reset: "reopened", delete: "deleted", move: "moved" };
      const actionName = ACTION_NAMES[action];
      if (actionName) {
        const nextStatus =
          action === "activate" ? "active" : action === "lock" ? "upcoming" : action === "reset" ? "active" : null;
        const changes =
          nextStatus && stage?.status && stage.status !== nextStatus
            ? [{ field: "status", from: stage.status, to: nextStatus }]
            : [];
        await recordVentureChange({
          dbId,
          entityType: "journey",
          entityId: stageId,
          entityLabel: stage?.name || null,
          action: actionName,
          actorCid: session?.cid || null,
          actorName: session?.name || null,
          changes,
          metadata: action === "move" ? { direction: String(body.direction || "") } : null,
        });
      }
    } catch (_) {}

    // Reached only after the manage gate above — safe to include archived rows.
    const stages = await listJourneyStages(dbId, { includeArchived: true });
    return NextResponse.json({ success: true, stages });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

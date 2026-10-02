import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireVentureAccess } from "@/lib/ventureAuth";
import { resolvePlanAccess, allowsPlanAction } from "@/services/ventures/operatingPlans";
import { roleIsPrivileged } from "@/lib/ventureAuth";
import { canManageMilestones, activateDueStages } from "@/lib/ventureMilestoneEngine";
import { evidenceDownloadUrl, isExternalEvidenceLink } from "@/lib/ventureEvidence";
import { projectJourneyStagesForVenture } from "@/lib/ventureVisibility";
import {
  ensureJourneyTable,
  resolveVentureInternalId,
  listJourneyStages,
  getJourneyStage,
} from "@/services/ventures/journey";
import { updateJourneyStageFields } from "@/models/ventureJourney";
import { attachJourneyWork } from "@/services/ventures/journeyRead";
import {
  addJourneyStage,
  recordJourneyStageEdit,
  runJourneyStageTransition,
  recordJourneyStageTransition,
} from "@/services/ventures/journeyStageActions";

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
  const access = await resolvePlanAccess(id, session);
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
    await activateDueStages({ dbId });

    // Management surfaces (staff) may request archived journeys; the
    // Venture-facing read never includes them.
    const wantArchived = new URL(req.url).searchParams.get("include_archived") === "1";

    // Author flags for staff surfaces only (members never receive them).
    let access = null;
    const viewer = await getViewerSession();
    if (viewer) {
      const planAccess = await resolvePlanAccess(id, viewer);
      if (planAccess.ok) {
        const [canCreate, canEdit, canManage] = await Promise.all([
          allowsPlanAction(planAccess, "create"),
          allowsPlanAction(planAccess, "edit"),
          allowsPlanAction(planAccess, "manage"),
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
      milestoneAuthority = await canManageMilestones({ id, cid: viewer.cid, role: viewer.role });
    }

    // Milestones, deliverables (signed evidence), task counts and template
    // provenance are attached by the service: services/ventures/journeyRead.
    // Private evidence: a storage path is signed per read (1h), while an
    // external link the author pasted passes through untouched. Only viewers
    // who already passed this Venture read ever receive a usable URL.
    const signEvidence = async (deliverable) => {
      deliverable.evidence_download_url = isExternalEvidenceLink(deliverable.attachment_url)
        ? deliverable.attachment_url
        : await evidenceDownloadUrl(deliverable.attachment_url);
    };
    const { templateSource, deliverablesUnavailable } = await attachJourneyWork({
      ventureParam: id, dbId, stages, signEvidence,
    });

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
    if (!(await allowsPlanAction(access, "create"))) {
      return NextResponse.json({ success: false, error: "Your assignment does not allow defining this Venture's journey." }, { status: 403 });
    }

    const dbId = await resolveDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const body = await req.json();
    // Name required, order, initial status, dates, insert and history:
    // services/ventures/journeyStageActions.
    const added = await addJourneyStage({ ventureParam: id, dbId, body });
    if (added.error) return NextResponse.json({ success: false, error: added.error }, { status: added.status });
    const insertResult = added.insertResult;

    // Managers keep their Archived view in sync: archived rows are returned
    // only to callers holding the manage capability (same rule as GET).
    const canManage = await allowsPlanAction(access, "manage");
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
      if (!(await allowsPlanAction(access, "edit"))) {
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
      // Field-level history of the edit (non-fatal): services/ventures/journeyStageActions.
      await recordJourneyStageEdit({ dbId, stage, stageId, name, body, session });

      const canManage = await allowsPlanAction(access, "manage");
      const stages = await listJourneyStages(dbId, { includeArchived: canManage });
      return NextResponse.json({ success: true, stages });
    }

    // ── Management actions (status transitions, delete, move, template) ──
    const manageActions = ["activate", "lock", "complete", "reset", "delete", "move"];
    if (manageActions.includes(action)) {
      if (!(await allowsPlanAction(access, "manage"))) {
        return NextResponse.json({ success: false, error: "Your assignment does not allow managing this Venture's journey." }, { status: 403 });
      }
    } else {
      return NextResponse.json({ success: false, error: "Unknown action." }, { status: 400 });
    }

    const stage = stageId ? await getJourneyStage(dbId, stageId) : null;

    // The transition itself (activate / lock / complete / reset / delete / move)
    // is a service decision; a refusal comes back as { error, status }.
    const refused = await runJourneyStageTransition({ action, stage, stageId, dbId, body });
    if (refused) return NextResponse.json({ success: false, error: refused.error }, { status: refused.status });

    // The transition itself is the change, recorded after the gate above
    // (non-fatal): services/ventures/journeyStageActions.
    await recordJourneyStageTransition({ action, stage, stageId, dbId, body, session });

    // Reached only after the manage gate above — safe to include archived rows.
    const stages = await listJourneyStages(dbId, { includeArchived: true });
    return NextResponse.json({ success: true, stages });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

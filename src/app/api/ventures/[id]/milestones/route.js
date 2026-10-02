import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { computeInitialMilestoneStatus, isMilestoneLeadAuthority, canManageMilestones, activateDueStages } from "@/lib/ventureMilestoneEngine";
import { dateOrNull, cidOrNull, isValidCid, isUnknownColumnError } from "@/lib/ventureInput";
import { roleIsPrivileged } from "@/lib/ventureAuth";
import { projectMilestonesForVenture } from "@/lib/ventureVisibility";
import {
  getVentureDbIdByCodeOrId,
  getVentureByCode,
  getVentureDbIdForMilestoneCreate,
  getVentureDbIdForMilestoneList,
  getVentureIdAndCode,
  getVentureMilestoneBeforeUpdate,
  insertVentureMilestone,
  listVentureMilestonesByDbId,
  updateVentureMilestoneFields,
  updateVentureMilestoneValueFields,
  ventureJourneyStageExists,
} from "@/models/ventureWorkspace";
import { recordMilestoneEdit, settleMilestoneCompletion } from "@/services/ventures/milestoneCompletion";

export const GET = createHandler(async (req, { params }) => {
  const { id } = await params;
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "view" });
  if (access.error) return access.error;
  const ventureResult = await getVentureDbIdForMilestoneList(id);
  const ventureDbId = ventureResult.rows?.[0]?.id;
  if (!ventureDbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
  const milestonesResult = await listVentureMilestonesByDbId(ventureDbId);
  // Archived (soft-deleted) milestones stay in the database (history is kept)
  // but are hidden from default lists. Row-level filter: environments whose
  // schema predates the is_archived column keep working (field is undefined).
  const includeArchived = new URL(req.url).searchParams.get("include_archived") === "1";
  const rows = (milestonesResult.rows || []).filter((milestone) => includeArchived || milestone.is_archived !== true);
  // Roadmap visibility: a member sees every milestone that exists on the map,
  // but the work inside a not-yet-released one is withheld. The projection is
  // shared with the journey read so the two surfaces cannot drift apart —
  // previously this list handed a founder the whole future roadmap while the
  // journey read was hiding it.
  const unsealed = roleIsPrivileged(access.session?.role);
  return NextResponse.json({ success: true, milestones: projectMilestonesForVenture(rows, { unsealed }) });
});

export const POST = createHandler(async (req, { params }) => {
  const { id } = await params;
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
  if (access.error) return access.error;

  // Adding a milestone is a STRUCTURE action: Lead Manager or Super Admin.
  const allowed = await canManageMilestones({ id, cid: access.session?.cid, role: access.session?.role });
  if (!allowed) {
    return NextResponse.json(
      { success: false, error: "Only the Venture's Lead Manager or a Super Admin can add milestones." },
      { status: 403 },
    );
  }

  const body = await req.json();
  const { title, description, target_date } = body;
  if (!title?.trim()) return NextResponse.json({ success: false, error: "Milestone title is required." }, { status: 400 });
  // The owner is a person reference: reject anything that is not a bounded
  // string (an object/array would otherwise be stored as "[object Object]").
  if (!isValidCid(body.owner_cid)) {
    return NextResponse.json({ success: false, error: "Invalid milestone owner." }, { status: 400 });
  }

  const ventureResult = await getVentureDbIdForMilestoneCreate(id);
  const ventureDbId = ventureResult.rows?.[0]?.id;
  if (!ventureDbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

  // Date-driven activation first, so a Journey whose start_date has arrived
  // counts as active when the status below is computed.
  await activateDueStages({ dbId: ventureDbId });

  // Journey binding (Phase 2): a milestone may belong to a Journey stage.
  // The stage must exist on THIS Venture when provided.
  const { journey_stage_id } = body;
  if (journey_stage_id) {
    const stageResult = await ventureJourneyStageExists(journey_stage_id, ventureDbId).catch(() => ({ rows: [] }));
    if (!(stageResult.rows || []).length) {
      return NextResponse.json({ success: false, error: "Unknown journey stage for this Venture." }, { status: 400 });
    }
  }

  // Availability is set by the Journey, not by position: a milestone bound to
  // an ACTIVE journey starts available; in a journey that has not started it
  // waits `upcoming`, and in a finished one it stays held. An explicit
  // dependency is the only other thing that ever holds a milestone back.
  const initialStatus = await computeInitialMilestoneStatus({ dbId: ventureDbId, stageId: journey_stage_id || null });

  const randomUUID = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => { const random = Math.random()*16|0; const value = char==='x'?random:(random&0x3|0x8); return value.toString(16); });

  await insertVentureMilestone({
    id: randomUUID,
    ventureDbId,
    title,
    description: description || null,
    targetDate: target_date || null,
    status: initialStatus,
    createdBy: req.session?.cid || null,
    journeyStageId: journey_stage_id || null,
    objective: body.objective || null,
    startDate: body.start_date || null,
    priority: body.priority || null,
    ownerCid: cidOrNull(body.owner_cid),
    ownerName: body.owner_name ? String(body.owner_name).trim() : null,
    displayOrder: body.display_order ?? null,
  });
  // milestone_id is returned so callers can attach deliverables in the same
  // flow (the journey panel creates the milestone and its deliverables at once).
  return NextResponse.json({ success: true, status: initialStatus, milestone_id: randomUUID });
});

export const PATCH = createHandler(async (req, { params }) => {
  const { id } = await params;
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
  if (access.error) return access.error;
  const { session } = access;
  const { searchParams } = new URL(req.url);
  const milestoneId = searchParams.get("id");
  if (!milestoneId) return NextResponse.json({ success: false, error: "Milestone ID required." }, { status: 400 });

  // Object-level authorization: the milestone id comes from the query string,
  // so the UPDATE is scoped to this venture's own milestones. A milestone id
  // belonging to another venture simply matches no row.
  const scopeVentureResult = await getVentureDbIdByCodeOrId(id).catch(() => ({ rows: [] }));
  const ventureDbIdForScope = scopeVentureResult.rows?.[0]?.id ?? null;
  if (!ventureDbIdForScope) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

  // Date-driven activation first: a Journey whose start_date has arrived is
  // active before this write decides anything.
  await activateDueStages({ dbId: ventureDbIdForScope });

  // The BEFORE state, read once: field-level history has to know what a value
  // WAS, not only what it became.
  const milestoneBeforeResult = await getVentureMilestoneBeforeUpdate(milestoneId, ventureDbIdForScope).catch(() => ({ rows: [] }));
  const milestoneBefore = milestoneBeforeResult.rows?.[0] || null;

  const body = await req.json();
  const { progress, status, title, description, target_date } = body;
  const completing = status === "completed";

  // Completion authority (Phase 3, locked decision): ONLY the Venture's
  // assigned Lead Manager or a Super Admin may mark a milestone completed.
  if (completing) {
    const ventureResult = await getVentureIdAndCode(id).catch(() => ({ rows: [] }));
    const ventureDbId = ventureResult.rows?.[0]?.id;
    const code = ventureResult.rows?.[0]?.venture_id || (typeof id === "string" && id.startsWith("VNT-") ? id : null);
    if (!ventureDbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
    const authorized = await isMilestoneLeadAuthority({ code, cid: session.cid, role: session.role });
    if (!authorized) {
      return NextResponse.json({ success: false, error: "Only the assigned Lead Manager or a Super Admin can complete milestones." }, { status: 403 });
    }
  }

  const updates = ["updated_at = NOW()"];
  const args = [];
  if (progress !== undefined) { updates.push("progress = ?"); args.push(progress); }
  if (status !== undefined) { updates.push("status = ?"); args.push(status); }
  if (title !== undefined) { updates.push("title = ?"); args.push(title); }
  if (description !== undefined) { updates.push("description = ?"); args.push(description); }
  if (target_date !== undefined) { updates.push("target_date = ?"); args.push(dateOrNull(target_date)); }
  if (body.objective !== undefined) { updates.push("objective = ?"); args.push(body.objective); }
  if (body.start_date !== undefined) { updates.push("start_date = ?"); args.push(dateOrNull(body.start_date)); }
  if (body.priority !== undefined) { updates.push("priority = ?"); args.push(body.priority); }
  if (body.owner_cid !== undefined) {
    if (!isValidCid(body.owner_cid)) {
      return NextResponse.json({ success: false, error: "Invalid milestone owner." }, { status: 400 });
    }
    updates.push("owner_cid = ?"); args.push(cidOrNull(body.owner_cid));
  }
  // The NAME half of the assignment: a milestone can be owned by someone with no
  // account, and the name is kept even after the owner is resolved to a person.
  if (body.owner_name !== undefined) {
    updates.push("owner_name = ?");
    args.push(body.owner_name ? String(body.owner_name).trim() : null);
  }
  if (body.display_order !== undefined) { updates.push("display_order = ?"); args.push(body.display_order); }
  if (body.journey_stage_id !== undefined) {
    // Allow clearing the binding with null, or moving to another stage.
    if (body.journey_stage_id) {
      const ventureResult = await getVentureByCode(id);
      const ventureDbId = ventureResult.rows?.[0]?.id;
      if (!ventureDbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
      const stageResult = await ventureJourneyStageExists(body.journey_stage_id, ventureDbId).catch(() => ({ rows: [] }));
      if (!(stageResult.rows || []).length) {
        return NextResponse.json({ success: false, error: "Unknown journey stage for this Venture." }, { status: 400 });
      }
    }
    updates.push("journey_stage_id = ?");
    args.push(body.journey_stage_id);
  }

  if (updates.length === 1) return NextResponse.json({ success: false, error: "No fields to update" }, { status: 400 });
  args.push(milestoneId, ventureDbIdForScope);
  try {
    await updateVentureMilestoneFields(updates, args);
  } catch (error) {
    // Safety net for older databases whose milestone table predates the
    // updated_at column: retry without it rather than failing the whole save.
    // `updated_at = NOW()` is always the FIRST clause and takes no arg, so the
    // value clauses line up with args[0..n-2] and the two scope args are last.
    if (!isUnknownColumnError(error)) throw error;
    const valueClauses = updates.filter((clause) => !clause.startsWith("updated_at"));
    const valueArgs = args.slice(0, args.length - 2);
    await updateVentureMilestoneValueFields(valueClauses, [...valueArgs, milestoneId, ventureDbIdForScope]);
  }

  // Field-level history of this save (non-fatal), then — when completing — the
  // Journey settles (releases, notices, history, automatic journey close):
  // services/ventures/milestoneCompletion.
  await recordMilestoneEdit({ dbId: ventureDbIdForScope, milestoneId, milestoneBefore, body, session });
  const journeyOutcome = completing
    ? await settleMilestoneCompletion({ ventureParam: id, milestoneId, session })
    : null;

  // `journey_completed` is additive: a caller that ignores it behaves exactly as
  // before, and the manager UI uses it to offer the journey's closing report.
  return NextResponse.json({ success: true, journey_completed: Boolean(journeyOutcome), journey: journeyOutcome });
});

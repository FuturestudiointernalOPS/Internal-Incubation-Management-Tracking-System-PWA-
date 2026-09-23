import db from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { computeInitialMilestoneStatus, completeMilestoneAndUnlockNext, isMilestoneLeadAuthority, canManageMilestones, completeStageIfAllMilestonesDone } from "@/lib/ventureMilestoneEngine";
import { dateOrNull, isUnknownColumnError } from "@/lib/ventureInput";
import { roleIsPrivileged } from "@/lib/ventureAuth";
import { projectMilestonesForVenture } from "@/lib/ventureVisibility";
import { notifyVentureFounders } from "@/lib/ventures";
import {
  getVentureDbIdForMilestoneCreate,
  getVentureDbIdForMilestoneList,
} from "@/models/ventureWorkspace";

export const GET = createHandler(async (req, { params }) => {
  const { id } = await params;
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "view" });
  if (access.error) return access.error;
  const ventureResult = await getVentureDbIdForMilestoneList(id);
  const ventureDbId = ventureResult.rows?.[0]?.id;
  if (!ventureDbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
  const milestonesResult = await db.execute({ sql: "SELECT * FROM venture_milestones WHERE venture_id = ? ORDER BY created_at DESC", args: [ventureDbId] });
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
  const allowed = await canManageMilestones(db, { id, cid: access.session?.cid, role: access.session?.role });
  if (!allowed) {
    return NextResponse.json(
      { success: false, error: "Only the Venture's Lead Manager or a Super Admin can add milestones." },
      { status: 403 },
    );
  }

  const body = await req.json();
  const { title, description, target_date } = body;
  if (!title?.trim()) return NextResponse.json({ success: false, error: "Milestone title is required." }, { status: 400 });

  const ventureResult = await getVentureDbIdForMilestoneCreate(id);
  const ventureDbId = ventureResult.rows?.[0]?.id;
  if (!ventureDbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

  // Journey binding (Phase 2): a milestone may belong to a Journey stage.
  // The stage must exist on THIS Venture when provided.
  const { journey_stage_id } = body;
  if (journey_stage_id) {
    const stageResult = await db.execute({
      sql: "SELECT 1 FROM venture_journey_stages WHERE id = ? AND venture_id = ?",
      args: [journey_stage_id, ventureDbId],
    }).catch(() => ({ rows: [] }));
    if (!(stageResult.rows || []).length) {
      return NextResponse.json({ success: false, error: "Unknown journey stage for this Venture." }, { status: 400 });
    }
  }

  // Sequential release (Phase 3): bound milestones start 'locked' unless they
  // are the stage's first milestone or follow a completed one — and only an
  // ACTIVE journey releases its milestones. In a locked (future) or completed
  // journey every newly added milestone starts locked; activating the journey
  // releases the first one.
  let initialStatus = await computeInitialMilestoneStatus(db, { dbId: ventureDbId, stageId: journey_stage_id || null });
  if (journey_stage_id) {
    const stageResult = await db.execute({
      sql: "SELECT status FROM venture_journey_stages WHERE id = ? AND venture_id = ?",
      args: [journey_stage_id, ventureDbId],
    }).catch(() => ({ rows: [] }));
    const stageStatus = stageResult.rows?.[0]?.status;
    if (stageStatus && stageStatus !== "active") initialStatus = "locked";
  }

  const randomUUID = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => { const random = Math.random()*16|0; const value = char==='x'?random:(random&0x3|0x8); return value.toString(16); });

  await db.execute({
    sql: `INSERT INTO venture_milestones (id, venture_id, title, description, target_date, status, progress, created_by, journey_stage_id, objective, start_date, priority, owner_cid, display_order) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`,
    args: [randomUUID, ventureDbId, title, description || null, target_date || null, initialStatus, req.session?.cid || null, journey_stage_id || null, body.objective || null, body.start_date || null, body.priority || null, body.owner_cid || null, body.display_order ?? null],
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
  const scopeVentureResult = await db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ? OR id::text = ?",
    args: [id, id],
  }).catch(() => ({ rows: [] }));
  const ventureDbIdForScope = scopeVentureResult.rows?.[0]?.id ?? null;
  if (!ventureDbIdForScope) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

  const body = await req.json();
  const { progress, status, title, description, target_date } = body;
  const completing = status === "completed";

  // Completion authority (Phase 3, locked decision): ONLY the Venture's
  // assigned Lead Manager or a Super Admin may mark a milestone completed.
  if (completing) {
    const ventureResult = await db.execute({
      sql: "SELECT id, venture_id FROM ventures WHERE venture_id = ? OR id::text = ?",
      args: [id, id],
    }).catch(() => ({ rows: [] }));
    const ventureDbId = ventureResult.rows?.[0]?.id;
    const code = ventureResult.rows?.[0]?.venture_id || (typeof id === "string" && id.startsWith("VNT-") ? id : null);
    if (!ventureDbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
    const authorized = await isMilestoneLeadAuthority(db, { code, cid: session.cid, role: session.role });
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
  if (body.owner_cid !== undefined) { updates.push("owner_cid = ?"); args.push(body.owner_cid); }
  if (body.display_order !== undefined) { updates.push("display_order = ?"); args.push(body.display_order); }
  if (body.journey_stage_id !== undefined) {
    // Allow clearing the binding with null, or moving to another stage.
    if (body.journey_stage_id) {
      const ventureResult = await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ?", args: [id] });
      const ventureDbId = ventureResult.rows?.[0]?.id;
      if (!ventureDbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
      const stageResult = await db.execute({
        sql: "SELECT 1 FROM venture_journey_stages WHERE id = ? AND venture_id = ?",
        args: [body.journey_stage_id, ventureDbId],
      }).catch(() => ({ rows: [] }));
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
    await db.execute({ sql: `UPDATE venture_milestones SET ${updates.join(", ")} WHERE id = ? AND venture_id = ?`, args });
  } catch (error) {
    // Safety net for older databases whose milestone table predates the
    // updated_at column: retry without it rather than failing the whole save.
    // `updated_at = NOW()` is always the FIRST clause and takes no arg, so the
    // value clauses line up with args[0..n-2] and the two scope args are last.
    if (!isUnknownColumnError(error)) throw error;
    const valueClauses = updates.filter((clause) => !clause.startsWith("updated_at"));
    const valueArgs = args.slice(0, args.length - 2);
    await db.execute({
      sql: `UPDATE venture_milestones SET ${valueClauses.join(", ")} WHERE id = ? AND venture_id = ?`,
      args: [...valueArgs, milestoneId, ventureDbIdForScope],
    });
  }

  // Approval cascade (Phase 3): completing a milestone unlocks the next
  // locked milestone in the same Journey stage, then founders are notified.
  // The Journey outcome is carried out of the block below so the caller can be
  // TOLD a journey just closed — that is the moment its closing report is owed.
  let journeyOutcome = null;
  if (completing) {
    const ventureResult = await db.execute({
      sql: "SELECT id FROM ventures WHERE venture_id = ? OR id::text = ?",
      args: [id, id],
    }).catch(() => ({ rows: [] }));
    const ventureDbId = ventureResult.rows?.[0]?.id || null;
    if (ventureDbId) {
      const outcome = await completeMilestoneAndUnlockNext(db, { dbId: ventureDbId, milestoneId });
      const milestoneResult = await db.execute({
        sql: "SELECT title, journey_stage_id FROM venture_milestones WHERE id = ?",
        args: [milestoneId],
      }).catch(() => ({ rows: [] }));
      const milestone = milestoneResult.rows?.[0];
      try {
        await notifyVentureFounders(
          ventureDbId,
          "Milestone approved",
          `The milestone "${milestone?.title || ""}" has been completed and approved.`,
          { journey_stage_id: milestone?.journey_stage_id || null, milestone_id: milestoneId },
          { templateKey: "venture.notif.milestoneApproved", params: { milestoneTitle: milestone?.title || "" }, dedupeKey: `milestone-completed:${milestoneId}` },
        );
      } catch (_) {}
      try {
        const { addVentureHistory } = await import("@/lib/ventures");
        await addVentureHistory({ venture_id: id, event_type: "MILESTONE_COMPLETED", description: `Milestone "${milestone?.title || milestoneId}" completed${outcome?.unlocked_milestone_id ? " — next milestone unlocked" : ""}` });
      } catch (_) {}

      // A Journey is never closed by hand: once EVERY milestone in it is
      // completed it closes automatically and the next journey becomes current.
      const stageOutcome = await completeStageIfAllMilestonesDone(db, {
        dbId: ventureDbId,
        stageId: milestone?.journey_stage_id,
        cid: session.cid,
      });
      if (stageOutcome?.completed) {
        journeyOutcome = {
          id: milestone?.journey_stage_id ? String(milestone.journey_stage_id) : null,
          name: stageOutcome.stage_name || null,
          next_stage_id: stageOutcome.next_stage_id || null,
        };
        try {
          const { addVentureHistory } = await import("@/lib/ventures");
          await addVentureHistory({
            venture_id: id,
            event_type: "JOURNEY_COMPLETED",
            description: `Journey "${stageOutcome.stage_name || ""}" completed — all milestones are done${stageOutcome.next_stage_id ? "; the next journey is now active" : ""}`,
          });
        } catch (_) {}
        try {
          await notifyVentureFounders(
            ventureDbId,
            "Journey completed",
            `All milestones in "${stageOutcome.stage_name || "your journey"}" are completed.`,
            { journey_stage_id: milestone?.journey_stage_id || null },
            {
              templateKey: "venture.notif.journeyCompleted",
              params: { stageName: stageOutcome.stage_name || "" },
              dedupeKey: `journey-completed:${milestone?.journey_stage_id}`,
            },
          );
        } catch (_) {}
      }
    }
  }

  // `journey_completed` is additive: a caller that ignores it behaves exactly as
  // before, and the manager UI uses it to offer the journey's closing report.
  return NextResponse.json({ success: true, journey_completed: Boolean(journeyOutcome), journey: journeyOutcome });
});

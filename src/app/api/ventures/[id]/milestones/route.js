import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { computeInitialMilestoneStatus, completeMilestoneAndUnlockNext, isMilestoneLeadAuthority, canManageMilestones } from "@/lib/ventureMilestoneEngine";
import { notifyVentureFounders } from "@/lib/ventures";
import {
  getVentureDbIdForMilestoneCreate,
  getVentureDbIdForMilestoneList,
} from "@/models/ventureWorkspace";

export const GET = createHandler(async (req, { params }) => {
  const { id } = await params;
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "view" });
  if (access.error) return access.error;
  const ventureRes = await getVentureDbIdForMilestoneList(id);
  const ventureDbId = ventureRes.rows?.[0]?.id;
  if (!ventureDbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
  const r = await db.execute({ sql: "SELECT * FROM venture_milestones WHERE venture_id = ? ORDER BY created_at DESC", args: [ventureDbId] });
  // Archived (soft-deleted) milestones stay in the database (history is kept)
  // but are hidden from default lists. Row-level filter: environments whose
  // schema predates the is_archived column keep working (field is undefined).
  const includeArchived = new URL(req.url).searchParams.get("include_archived") === "1";
  const rows = (r.rows || []).filter((m) => includeArchived || m.is_archived !== true);
  return NextResponse.json({ success: true, milestones: rows });
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

  const ventureRes = await getVentureDbIdForMilestoneCreate(id);
  const ventureDbId = ventureRes.rows?.[0]?.id;
  if (!ventureDbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

  // Journey binding (Phase 2): a milestone may belong to a Journey stage.
  // The stage must exist on THIS Venture when provided.
  const { journey_stage_id } = body;
  if (journey_stage_id) {
    const stageRes = await db.execute({
      sql: "SELECT 1 FROM venture_journey_stages WHERE id = ? AND venture_id = ?",
      args: [journey_stage_id, ventureDbId],
    }).catch(() => ({ rows: [] }));
    if (!(stageRes.rows || []).length) {
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
    const stageRes = await db.execute({
      sql: "SELECT status FROM venture_journey_stages WHERE id = ? AND venture_id = ?",
      args: [journey_stage_id, ventureDbId],
    }).catch(() => ({ rows: [] }));
    const stageStatus = stageRes.rows?.[0]?.status;
    if (stageStatus && stageStatus !== "active") initialStatus = "locked";
  }

  const randomUUID = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random()*16|0; const v = c==='x'?r:(r&0x3|0x8); return v.toString(16); });

  await db.execute({
    sql: `INSERT INTO venture_milestones (id, venture_id, title, description, target_date, status, progress, created_by, journey_stage_id, objective, start_date, priority, owner_cid, display_order) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`,
    args: [randomUUID, ventureDbId, title, description || null, target_date || null, initialStatus, req.session?.cid || null, journey_stage_id || null, body.objective || null, body.start_date || null, body.priority || null, body.owner_cid || null, body.display_order ?? null],
  });
  return NextResponse.json({ success: true, status: initialStatus });
});

export const PATCH = createHandler(async (req, { params }) => {
  const { id } = await params;
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
  if (access.error) return access.error;
  const { session } = access;
  const { searchParams } = new URL(req.url);
  const mid = searchParams.get("id");
  if (!mid) return NextResponse.json({ success: false, error: "Milestone ID required." }, { status: 400 });

  const body = await req.json();
  const { progress, status, title, description, target_date } = body;
  const completing = status === "completed";

  // Completion authority (Phase 3, locked decision): ONLY the Venture's
  // assigned Lead Manager or a Super Admin may mark a milestone completed.
  if (completing) {
    const vRes = await db.execute({
      sql: "SELECT id, venture_id FROM ventures WHERE venture_id = ? OR id::text = ?",
      args: [id, id],
    }).catch(() => ({ rows: [] }));
    const ventureDbId = vRes.rows?.[0]?.id;
    const code = vRes.rows?.[0]?.venture_id || (typeof id === "string" && id.startsWith("VNT-") ? id : null);
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
  if (target_date !== undefined) { updates.push("target_date = ?"); args.push(target_date); }
  if (body.objective !== undefined) { updates.push("objective = ?"); args.push(body.objective); }
  if (body.start_date !== undefined) { updates.push("start_date = ?"); args.push(body.start_date); }
  if (body.priority !== undefined) { updates.push("priority = ?"); args.push(body.priority); }
  if (body.owner_cid !== undefined) { updates.push("owner_cid = ?"); args.push(body.owner_cid); }
  if (body.display_order !== undefined) { updates.push("display_order = ?"); args.push(body.display_order); }
  if (body.journey_stage_id !== undefined) {
    // Allow clearing the binding with null, or moving to another stage.
    if (body.journey_stage_id) {
      const vRes = await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ?", args: [id] });
      const ventureDbId = vRes.rows?.[0]?.id;
      if (!ventureDbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
      const stageRes = await db.execute({
        sql: "SELECT 1 FROM venture_journey_stages WHERE id = ? AND venture_id = ?",
        args: [body.journey_stage_id, ventureDbId],
      }).catch(() => ({ rows: [] }));
      if (!(stageRes.rows || []).length) {
        return NextResponse.json({ success: false, error: "Unknown journey stage for this Venture." }, { status: 400 });
      }
    }
    updates.push("journey_stage_id = ?");
    args.push(body.journey_stage_id);
  }

  if (updates.length === 1) return NextResponse.json({ success: false, error: "No fields to update" }, { status: 400 });
  args.push(mid);
  await db.execute({ sql: `UPDATE venture_milestones SET ${updates.join(", ")} WHERE id = ?`, args });

  // Approval cascade (Phase 3): completing a milestone unlocks the next
  // locked milestone in the same Journey stage, then founders are notified.
  if (completing) {
    const vRes = await db.execute({
      sql: "SELECT id FROM ventures WHERE venture_id = ? OR id::text = ?",
      args: [id, id],
    }).catch(() => ({ rows: [] }));
    const ventureDbId = vRes.rows?.[0]?.id || null;
    if (ventureDbId) {
      const outcome = await completeMilestoneAndUnlockNext(db, { dbId: ventureDbId, milestoneId: mid });
      const milestoneRes = await db.execute({
        sql: "SELECT title, journey_stage_id FROM venture_milestones WHERE id = ?",
        args: [mid],
      }).catch(() => ({ rows: [] }));
      const m = milestoneRes.rows?.[0];
      try {
        await notifyVentureFounders(
          ventureDbId,
          "Milestone approved",
          `The milestone "${m?.title || ""}" has been completed and approved.`,
          { journey_stage_id: m?.journey_stage_id || null, milestone_id: mid },
          { templateKey: "venture.notif.milestoneApproved", params: { milestoneTitle: m?.title || "" }, dedupeKey: `milestone-completed:${mid}` },
        );
      } catch (_) {}
      try {
        const { addVentureHistory } = await import("@/lib/ventures");
        await addVentureHistory({ venture_id: id, event_type: "MILESTONE_COMPLETED", description: `Milestone "${m?.title || mid}" completed${outcome?.unlocked_milestone_id ? " — next milestone unlocked" : ""}` });
      } catch (_) {}
    }
  }

  return NextResponse.json({ success: true });
});

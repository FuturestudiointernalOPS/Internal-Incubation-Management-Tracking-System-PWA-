import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireVentureAccess } from "@/lib/ventureAuth";

export const GET = createHandler(async (req, { params }) => {
  const { id } = await params;
  const { session } = await requireVentureAccess(id, db);
  if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
  const ventureRes = await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ?", args: [id] });
  const ventureDbId = ventureRes.rows?.[0]?.id;
  if (!ventureDbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
  const r = await db.execute({ sql: "SELECT * FROM venture_milestones WHERE venture_id = ? ORDER BY created_at DESC", args: [ventureDbId] });
  return NextResponse.json({ success: true, milestones: r.rows || [] });
});

export const POST = createHandler(async (req, { params }) => {
  const { id } = await params;
  const { session } = await requireVentureAccess(id, db);
  if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
  const body = await req.json();
  const { title, description, target_date } = body;
  if (!title?.trim()) return NextResponse.json({ success: false, error: "Milestone title is required." }, { status: 400 });

  const ventureRes = await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ?", args: [id] });
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

  const randomUUID = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random()*16|0; const v = c==='x'?r:(r&0x3|0x8); return v.toString(16); });

  await db.execute({
    sql: `INSERT INTO venture_milestones (id, venture_id, title, description, target_date, status, progress, created_by, journey_stage_id, objective, start_date, priority, owner_cid, display_order) VALUES (?, ?, ?, ?, ?, 'not_started', 0, ?, ?, ?, ?, ?, ?, ?)`,
    args: [randomUUID, ventureDbId, title, description || null, target_date || null, req.session?.cid || null, journey_stage_id || null, body.objective || null, body.start_date || null, body.priority || null, body.owner_cid || null, body.display_order ?? null],
  });
  return NextResponse.json({ success: true });
});

export const PATCH = createHandler(async (req, { params }) => {
  const { id } = await params;
  const { session } = await requireVentureAccess(id, db);
  if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
  const { searchParams } = new URL(req.url);
  const mid = searchParams.get("id");
  if (!mid) return NextResponse.json({ success: false, error: "Milestone ID required." }, { status: 400 });

  const body = await req.json();
  const { progress, status, title, description, target_date } = body;

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
  return NextResponse.json({ success: true });
});

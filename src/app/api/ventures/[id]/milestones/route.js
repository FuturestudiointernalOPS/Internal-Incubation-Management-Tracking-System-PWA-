import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";

export const GET = createHandler(async (req, { params }) => {
  const { id } = await params;
  const ventureRes = await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ?", args: [id] });
  const ventureDbId = ventureRes.rows?.[0]?.id;
  if (!ventureDbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
  const r = await db.execute({ sql: "SELECT * FROM venture_milestones WHERE venture_id = ? ORDER BY created_at DESC", args: [ventureDbId] });
  return NextResponse.json({ success: true, milestones: r.rows || [] });
});

export const POST = createHandler(async (req, { params }) => {
  const { id } = await params;
  const body = await req.json();
  const { title, description, target_date } = body;
  if (!title?.trim()) return NextResponse.json({ success: false, error: "Milestone title is required." }, { status: 400 });

  const ventureRes = await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ?", args: [id] });
  const ventureDbId = ventureRes.rows?.[0]?.id;
  if (!ventureDbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

  const randomUUID = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random()*16|0; const v = c==='x'?r:(r&0x3|0x8); return v.toString(16); });

  await db.execute({
    sql: `INSERT INTO venture_milestones (id, venture_id, title, description, target_date, status, progress, created_by) VALUES (?, ?, ?, ?, ?, 'not_started', 0, ?)`,
    args: [randomUUID, ventureDbId, title, description || null, target_date || null, req.session?.cid || null],
  });
  return NextResponse.json({ success: true });
});

export const PATCH = createHandler(async (req, { params }) => {
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

  if (updates.length === 1) return NextResponse.json({ success: false, error: "No fields to update" }, { status: 400 });
  args.push(mid);
  await db.execute({ sql: `UPDATE venture_milestones SET ${updates.join(", ")} WHERE id = ?`, args });
  return NextResponse.json({ success: true });
});

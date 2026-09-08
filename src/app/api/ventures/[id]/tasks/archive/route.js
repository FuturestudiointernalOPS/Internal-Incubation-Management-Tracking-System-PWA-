import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import db from "@/lib/db";
import { requireVentureAccess } from "@/lib/ventureAuth";
import { applyBulk } from "@/lib/ventureArchive";

/**
 * POST /api/ventures/[id]/tasks/archive
 * Body: { ids: [..], action: "archive" | "restore" }
 *
 * Soft delete: tasks are archived, never removed. Tasks that already have
 * filed work (submissions or reviews) are blocked — they are part of the
 * Venture's record. Response reports archived/restored/blocked per id.
 */
export const POST = createHandler(async (req, { params }) => {
  const { id } = await params;
  const { session } = await requireVentureAccess(id, db);
  if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

  const body = await req.json();
  const ids = Array.isArray(body?.ids) ? body.ids.map((x) => String(x)).filter(Boolean) : [];
  const action = body?.action === "restore" ? "restore" : "archive";
  if (ids.length === 0) return NextResponse.json({ success: false, error: "No tasks selected." }, { status: 400 });

  const rowsRes = await db.execute({
    sql: `SELECT t.id, t.title FROM venture_tasks t
          JOIN ventures v ON v.id = t.venture_id
          WHERE (v.venture_id = ? OR v.id::text = ?)
            AND t.id::text = ANY(?)`,
    args: [id, id, ids],
  }).catch(() => ({ rows: [] }));

  const summary = await applyBulk(db, {
    rows: rowsRes.rows || [],
    actorCid: session.cid || null,
    action,
    kind: "task",
  });

  return NextResponse.json({ success: true, ...summary });
});

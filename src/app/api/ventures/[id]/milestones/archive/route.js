import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import db from "@/lib/db";
import { requireVentureAccess } from "@/lib/ventureAuth";
import { applyBulk } from "@/lib/ventureArchive";

/**
 * POST /api/ventures/[id]/milestones/archive
 * Body: { ids: [..], action: "archive" | "restore" }
 *
 * Soft delete: milestones (and their tasks) are archived, never removed.
 * Milestones that already have filed work (submissions/reviews/deliverables)
 * are blocked — they are part of the Venture's record. Response reports
 * archived/restored/blocked per id so the UI can show exactly what happened.
 */
export const POST = createHandler(async (req, { params }) => {
  const { id } = await params;
  const { session } = await requireVentureAccess(id, db);
  if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

  const body = await req.json();
  const ids = Array.isArray(body?.ids) ? body.ids.map((x) => String(x)).filter(Boolean) : [];
  const action = body?.action === "restore" ? "restore" : "archive";
  if (ids.length === 0) return NextResponse.json({ success: false, error: "No milestones selected." }, { status: 400 });

  const rowsRes = await db.execute({
    sql: `SELECT m.id, m.title FROM venture_milestones m
          JOIN ventures v ON v.id = m.venture_id
          WHERE (v.venture_id = ? OR v.id::text = ?)
            AND m.id::text = ANY(?)`,
    args: [id, id, ids],
  }).catch(() => ({ rows: [] }));

  const summary = await applyBulk(db, {
    rows: rowsRes.rows || [],
    actorCid: session.cid || null,
    action,
    kind: "milestone",
  });

  return NextResponse.json({ success: true, ...summary });
});

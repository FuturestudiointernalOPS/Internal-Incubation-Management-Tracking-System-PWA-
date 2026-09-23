import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import db from "@/lib/db";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
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
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
  if (access.error) return access.error;
  const { session } = access;

  const body = await req.json();
  const ids = Array.isArray(body?.ids) ? body.ids.map((taskId) => String(taskId)).filter(Boolean) : [];
  const action = body?.action === "restore" ? "restore" : "archive";
  if (ids.length === 0) return NextResponse.json({ success: false, error: "No tasks selected." }, { status: 400 });

  // venture_id in this table may hold either the Venture's INTERNAL id or its VNT-
  // code, and its type differs per database (text on both today). Comparing as
  // text on both sides matches either: joining on v.id alone raised "operator does
  // not exist: uuid = text" on staging (this statement was the failing one there)
  // and "integer = text" on production, and the catch below turned both into a
  // silent "archived 0 of N" with a success response.
  const rowsResult = await db.execute({
    sql: `SELECT t.id, t.title FROM venture_tasks t
          JOIN ventures v ON (t.venture_id::text = v.id::text OR t.venture_id::text = v.venture_id)
          WHERE (v.venture_id = ? OR v.id::text = ?)
            AND t.id::text = ANY(?)`,
    args: [id, id, ids],
  }).catch((error) => {
    console.error("[tasks/archive] lookup failed:", error?.message);
    return { rows: [] };
  });

  const summary = await applyBulk(db, {
    rows: rowsResult.rows || [],
    actorCid: session.cid || null,
    action,
    kind: "task",
  });

  return NextResponse.json({ success: true, ...summary });
});

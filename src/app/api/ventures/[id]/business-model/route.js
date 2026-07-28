import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireVentureAccess } from "@/lib/ventureAuth";

const ROLES = ["participant", "staff", "program_manager", "super_admin", "teacher", "developer"];
const ALLOWED = ["participant", "staff", "program_manager", "super_admin", "teacher"];

async function resolveVentureDbId(ventureId) {
  const r = await db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [ventureId],
  });
  return r.rows?.[0]?.id || null;
}

export async function GET(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth(ROLES);
    if (authError) return authError;
    const { id } = await params;
    const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const r = await db.execute({
      sql: `SELECT * FROM venture_business_models WHERE venture_id = ?`,
      args: [dbId],
    });
    return NextResponse.json({ success: true, business_model: r.rows?.[0] || null });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth(ALLOWED);
    if (authError) return authError;
    const { id } = await params;
    const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const body = await req.json();
    const fields = ["business_model_canvas", "lean_canvas", "revenue_streams", "cost_structure", "key_partners"];

    // Check if row exists
    const existing = await db.execute({
      sql: "SELECT id FROM venture_business_models WHERE venture_id = ?",
      args: [dbId],
    });

    if (existing.rows?.length > 0) {
      // UPDATE
      const setClauses = [];
      const upArgs = [];
      for (const f of fields) {
        if (body[f] !== undefined) {
          let val = body[f];
          if (typeof val === "object") val = JSON.stringify(val);
          setClauses.push(`${f} = ?`);
          upArgs.push(val);
        }
      }
      setClauses.push("updated_at = NOW()");
      setClauses.push("updated_by = ?");
      upArgs.push(session.cid);
      upArgs.push(dbId);
      await db.execute({
        sql: `UPDATE venture_business_models SET ${setClauses.join(", ")} WHERE venture_id = ?`,
        args: upArgs,
      });
    } else {
      // INSERT
      const insertCols = ["venture_id"];
      const insertVals = ["?"];
      const insertArgs = [dbId];
      for (const f of fields) {
        if (body[f] !== undefined) {
          let val = body[f];
          if (typeof val === "object") val = JSON.stringify(val);
          insertCols.push(f);
          insertVals.push("?");
          insertArgs.push(val);
        }
      }
      insertCols.push("updated_by");
      insertVals.push("?");
      insertArgs.push(session.cid);
      await db.execute({
        sql: `INSERT INTO venture_business_models (${insertCols.join(", ")}) VALUES (${insertVals.join(", ")})`,
        args: insertArgs,
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

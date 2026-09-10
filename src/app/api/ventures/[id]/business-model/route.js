import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import {
  createVentureBusinessModel,
  findVentureBusinessModel,
  getBusinessModelVentureId,
  getVentureBusinessModel,
  updateVentureBusinessModel,
} from "@/models/ventureJourney";


async function resolveVentureDbId(ventureId) {
  const r = await getBusinessModelVentureId(ventureId);
  return r.rows?.[0]?.id || null;
}

export async function GET(req, { params }) {
  try {
    await initDb();
    const { id } = await params;
    const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "view" });
    if (access.error) return access.error;

    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const r = await getVentureBusinessModel(dbId);
    return NextResponse.json({ success: true, business_model: r.rows?.[0] || null });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    await initDb();
    const { id } = await params;
    const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
    if (access.error) return access.error;
    const { session } = access;

    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const body = await req.json();
    const fields = ["business_model_canvas", "lean_canvas", "revenue_streams", "cost_structure", "key_partners"];

    // Check if row exists
    const existing = await findVentureBusinessModel(dbId);

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
      await updateVentureBusinessModel(setClauses, upArgs);
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
      await createVentureBusinessModel(insertCols, insertVals, insertArgs);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

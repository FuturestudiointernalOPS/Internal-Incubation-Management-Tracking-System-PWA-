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
  const ventureResult = await getBusinessModelVentureId(ventureId);
  return ventureResult.rows?.[0]?.id || null;
}

export async function GET(req, { params }) {
  try {
    await initDb();
    const { id } = await params;
    const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "view" });
    if (access.error) return access.error;

    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const businessModelResult = await getVentureBusinessModel(dbId);
    return NextResponse.json({ success: true, business_model: businessModelResult.rows?.[0] || null });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
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
      const updateArgs = [];
      for (const field of fields) {
        if (body[field] !== undefined) {
          let fieldValue = body[field];
          if (typeof fieldValue === "object") fieldValue = JSON.stringify(fieldValue);
          setClauses.push(`${field} = ?`);
          updateArgs.push(fieldValue);
        }
      }
      setClauses.push("updated_at = NOW()");
      setClauses.push("updated_by = ?");
      updateArgs.push(session.cid);
      updateArgs.push(dbId);
      await updateVentureBusinessModel(setClauses, updateArgs);
    } else {
      // INSERT
      const insertCols = ["venture_id"];
      const insertVals = ["?"];
      const insertArgs = [dbId];
      for (const field of fields) {
        if (body[field] !== undefined) {
          let fieldValue = body[field];
          if (typeof fieldValue === "object") fieldValue = JSON.stringify(fieldValue);
          insertCols.push(field);
          insertVals.push("?");
          insertArgs.push(fieldValue);
        }
      }
      insertCols.push("updated_by");
      insertVals.push("?");
      insertArgs.push(session.cid);
      await createVentureBusinessModel(insertCols, insertVals, insertArgs);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

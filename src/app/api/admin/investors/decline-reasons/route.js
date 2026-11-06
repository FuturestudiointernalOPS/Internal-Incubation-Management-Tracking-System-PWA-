import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireInvestorStudioAuthorization as requireAuthorization } from "@/server/investor/studioAuthorization";
import { ensureInvestorExpansionSchema } from "@/models/investor/expansionSchema";
import {
  insertDeclineReason,
  listDeclineReasons,
  updateDeclineReason,
} from "@/models/investor/declineReasons";

/** GET — all reasons (including inactive) for studio editing. */
export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuthorization("investor", "view");
    if (authError) return authError;
    await ensureInvestorExpansionSchema();

    const appliesTo = new URL(req.url).searchParams.get("applies_to") || undefined;
    const result = await listDeclineReasons({ appliesTo, activeOnly: false });
    return NextResponse.json({ success: true, reasons: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/** POST — create a reason. */
export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuthorization("investor", "edit");
    if (authError) return authError;
    await ensureInvestorExpansionSchema();

    const body = await req.json();
    const appliesTo = body.applies_to;
    const nameEn = String(body.name_en || "").trim();
    const nameFr = String(body.name_fr || "").trim();
    if (!appliesTo || !nameEn || !nameFr) {
      return NextResponse.json({ success: false, error: "applies_to, name_en and name_fr required" }, { status: 400 });
    }

    const inserted = await insertDeclineReason({
      appliesTo,
      nameEn,
      nameFr,
      sortOrder: Number(body.sort_order) || 0,
    });
    return NextResponse.json({ success: true, reason: inserted.rows?.[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/** PUT — update or toggle active. */
export async function PUT(req) {
  try {
    await initDb();
    const authError = await requireAuthorization("investor", "edit");
    if (authError) return authError;

    const body = await req.json();
    if (!body.id) {
      return NextResponse.json({ success: false, error: "id required" }, { status: 400 });
    }

    const updated = await updateDeclineReason({
      id: body.id,
      nameEn: body.name_en != null ? String(body.name_en).trim() : null,
      nameFr: body.name_fr != null ? String(body.name_fr).trim() : null,
      active: typeof body.active === "boolean" ? body.active : null,
      sortOrder: body.sort_order != null ? Number(body.sort_order) : null,
    });
    if (!updated.rows?.[0]) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, reason: updated.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

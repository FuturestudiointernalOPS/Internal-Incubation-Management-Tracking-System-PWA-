import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

import {
  createVentureUpdate,
  listVentureUpdatesByVentureId,
} from "@/models/investor";
import { requireInvestorSelfServiceAuthorization } from "@/models/authorization/investorSelfService";

export async function GET(req) {
  try {
    await initDb();
    const capError = await requireInvestorSelfServiceAuthorization("view");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const ventureId = searchParams.get("venture_id");
    if (!ventureId) return NextResponse.json({ success: false, error: "venture_id required" }, { status: 400 });

    const result = await listVentureUpdatesByVentureId(ventureId);
    return NextResponse.json({ success: true, updates: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const capError = await requireInvestorSelfServiceAuthorization("create");
    if (capError) return capError;

    const session = await getSession();
    const { venture_id, title, content, update_type } = await req.json();
    if (!venture_id || !title || !content) {
      return NextResponse.json({ success: false, error: "venture_id, title, and content required" }, { status: 400 });
    }

    const result = await createVentureUpdate({ venture_id, title, content, update_type, created_by: session.cid || session.id });
    return NextResponse.json({ success: true, update: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

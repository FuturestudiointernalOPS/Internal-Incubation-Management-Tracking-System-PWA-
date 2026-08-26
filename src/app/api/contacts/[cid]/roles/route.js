import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/lib/authorization";

export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  try {
    await initDb();
    const capError = await requireAuthorization("contacts", "view");
    if (capError) return capError;

    const { cid } = await params;
    const result = await db.execute({
      sql: "SELECT * FROM contact_roles WHERE contact_cid = ? ORDER BY is_current DESC, started_at DESC",
      args: [cid],
    });

    return NextResponse.json({ success: true, roles: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

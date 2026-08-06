import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "program_manager", "staff", "teacher"]);
    if (authError) return authError;

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

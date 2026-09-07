import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listScopeTypes } from "@/lib/venturePermissions";

const READ_ROLES = ["super_admin", "developer", "admin", "staff"];

export async function GET() {
  try {
    await initDb();
    const authError = await requireAuth(READ_ROLES);
    if (authError) return authError;
    const scopes = await listScopeTypes(db);
    return NextResponse.json({ success: true, scopes });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

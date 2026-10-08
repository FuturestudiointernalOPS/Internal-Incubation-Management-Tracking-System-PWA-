import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/guards";
import { listScopeTypes } from "@/services/ventures/permissions";

const READ_ROLES = ["super_admin", "staff"];

export async function GET() {
  try {
    await initDb();
    const authError = await requireAuth(READ_ROLES);
    if (authError) return authError;
    const scopes = await listScopeTypes();
    return NextResponse.json({ success: true, scopes });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

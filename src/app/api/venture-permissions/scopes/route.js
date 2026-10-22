import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/models/authorization/index";
import { listScopeTypes } from "@/services/ventures/permissions";


export async function GET() {
  try {
    await initDb();
    const authError = await requireAuthorization("ventures", "permissions_view");
    if (authError) return authError;
    const scopes = await listScopeTypes();
    return NextResponse.json({ success: true, scopes });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/guards";
import { getSession } from "@/server/auth/session";
import { requireAuthorization } from "@/models/authorization/index";
import { listReports, saveReport } from "@/services/dashboard/opReports";

/**
 * OPERATIONAL REPORTS API
 *
 * GET  /api/op-reports?user_id=X&type=standup&week=12&year=2026
 *   - Returns reports, filtered by query params
 *   - Super Admin sees all; staff see only their own
 *
 * POST /api/op-reports
 *   - Creates or updates a report (upsert on user_id + week + year + type)
 *
 * The scope rule, the upsert and the field-merge rules live in
 * `services/dashboard/opReports`; this controller keeps the authentication, the
 * capability gate and the response envelope.
 */

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const { status, body } = await listReports({
      session,
      filters: {
        user_id: searchParams.get("user_id"),
        report_type: searchParams.get("type"),
        week_number: searchParams.get("week"),
        year: searchParams.get("year"),
        workspace: searchParams.get("workspace"),
        context_type: searchParams.get("context_type"),
        context_id: searchParams.get("context_id"),
      },
    });
    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("GET op-reports error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("reports", "create");
    if (capError) return capError;
    const payload = await req.json();
    const { status, body } = await saveReport(payload);
    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("POST op-reports error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

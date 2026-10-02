import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import { NextResponse } from "next/server";
import { listPendingUsersGrouped } from "@/services/dashboard/userAdmin";

/**
 * GET /api/admin/pending-users
 *
 * The pending users and their group breakdown. The read and the grouping live
 * in `services/dashboard/userAdmin`.
 */
export async function GET() {
  try {
    const capError = await requireAuthorization("permissions", "view_matrix");
    if (capError) return capError;

    await initDb();
    const { status, body } = await listPendingUsersGrouped();
    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("API Error:", error.message);
    return NextResponse.json(
      { success: false, error: "errors.somethingWrong" },
      { status: 500 },
    );
  }
}

import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/models/authorization/index";
import { getSession } from "@/lib/auth";
import { rejectUser } from "@/services/dashboard/userAdmin";

/**
 * REJECT USER ENDPOINT
 * POST /api/admin/reject-user
 *
 * Body: { user_cid }
 *
 * Sets user status to 'rejected' — they cannot proceed further. The use-case
 * (existence check, write, audit, notification clearing) lives in
 * `services/dashboard/userAdmin`.
 */
export async function POST(req) {
  try {
    const capError = await requireAuthorization("permissions", "assign_capabilities");
    if (capError) return capError;

    await initDb();
    const { user_cid } = await req.json();
    const session = await getSession();

    const { status, body } = await rejectUser({ userCid: user_cid, actor: session });
    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("API Error:", error.message);
    return NextResponse.json(
      { success: false, error: "errors.somethingWrong" },
      { status: 500 },
    );
  }
}

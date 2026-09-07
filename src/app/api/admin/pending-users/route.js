import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import { NextResponse } from "next/server";
import { listPendingUsers } from "@/models/adminOps";

export async function GET() {
  try {
    const capError = await requireAuthorization("permissions", "view_matrix");
    if (capError) return capError;

    await initDb();
    const result = await listPendingUsers();

    const pendingUsers = result.rows;
    const grouped = {};
    for (const user of pendingUsers) {
      const group = user.group_name || "UNASSIGNED";
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push(user);
    }

    return NextResponse.json({
      success: true,
      total: pendingUsers.length,
      pendingUsers,
      grouped,
    });
  } catch (e) {
    console.error("API Error:", e.message);
    return NextResponse.json(
      { success: false, error: "errors.somethingWrong" },
      { status: 500 },
    );
  }
}

import db, { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const capError = await requireAuthorization("permissions", "view_matrix");
    if (capError) return capError;

    await initDb();
    const result = await db.execute({
      sql: `SELECT cid, name, email, phone, group_name, role, created_at, program_name, gender FROM contacts WHERE status = 'pending' AND archived_at IS NULL AND deleted_at IS NULL ORDER BY created_at DESC`,
      args: [],
    });

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

import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export async function GET(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth([
      "participant",
      "staff",
      "program_manager",
      "super_admin",
      "teacher",
      "developer",
    ]);
    if (authError) return authError;

    const { id } = await params;

    const result = await db.execute({
      sql: `
        SELECT v.*,
          (SELECT COUNT(*) FROM venture_members vm WHERE vm.venture_id = v.id AND vm.member_type = 'founder' AND vm.removed_at IS NULL) as founder_count,
          (SELECT COUNT(*) FROM venture_members vm WHERE vm.venture_id = v.id AND vm.removed_at IS NULL) as member_count
        FROM ventures v
        WHERE v.id = ?
      `,
      args: [id],
    });

    if (!result.rows || result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Venture not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, venture: result.rows[0] });
  } catch (error) {
    console.error("GET /api/ventures/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

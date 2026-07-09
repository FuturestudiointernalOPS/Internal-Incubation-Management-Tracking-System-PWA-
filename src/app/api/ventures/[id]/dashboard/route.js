import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";

export async function GET(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth([
      "participant", "staff", "program_manager", "super_admin", "teacher", "developer",
    ]);
    if (authError) return authError;

    const session = await getSession();
    const { id } = await params;

    const ventureRes = await db.execute({
      sql: `SELECT v.*,
        (SELECT COUNT(*) FROM venture_members vm WHERE vm.venture_id = v.id AND vm.member_type = 'founder' AND vm.removed_at IS NULL) as founder_count,
        (SELECT COUNT(*) FROM venture_members vm WHERE vm.venture_id = v.id AND vm.removed_at IS NULL) as member_count
        FROM ventures v WHERE v.id = ?`,
      args: [id],
    });

    if (!ventureRes.rows?.[0]) {
      return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
    }

    const venture = ventureRes.rows[0];

    if (session.role === "participant" && venture.visibility !== "public") {
      const memberCheck = await db.execute({
        sql: `SELECT 1 FROM venture_members WHERE venture_id = ? AND contact_id = ? AND removed_at IS NULL`,
        args: [id, session.cid],
      });
      if (!memberCheck.rows?.length) {
        return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
      }
    }

    const activityRes = await db.execute({
      sql: `
        SELECT vm.member_type, vm.joined_at, c.name as contact_name
        FROM venture_members vm
        LEFT JOIN contacts c ON vm.contact_id = c.cid
        WHERE vm.venture_id = ? AND vm.removed_at IS NULL
        ORDER BY vm.joined_at DESC LIMIT 5
      `,
      args: [id],
    });

    return NextResponse.json({
      success: true,
      venture: {
        id: venture.id, name: venture.name, status: venture.status,
        business_stage: venture.business_stage, industry: venture.industry,
        description: venture.description, mission: venture.mission, vision: venture.vision,
        founder_count: venture.founder_count, member_count: venture.member_count,
        visibility: venture.visibility, created_at: venture.created_at,
      },
      progress: null,
      recent_activity: activityRes.rows || [],
    });
  } catch (error) {
    console.error("GET /api/ventures/[id]/dashboard error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

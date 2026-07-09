import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export async function GET(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth([
      "participant", "staff", "program_manager", "super_admin", "teacher", "developer",
    ]);
    if (authError) return authError;

    const { id } = await params;

    const ventureRes = await db.execute({
      sql: `SELECT * FROM ventures WHERE id = ?`,
      args: [id],
    });

    if (!ventureRes.rows?.[0]) {
      return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
    }

    const venture = ventureRes.rows[0];

    // Previous program info
    let program = null;
    if (venture.program_id) {
      const progRes = await db.execute({
        sql: `SELECT id, name, start_date, end_date, deliverables FROM v2_programs WHERE id = ?::uuid`,
        args: [venture.program_id],
      });
      if (progRes.rows?.[0]) {
        const p = progRes.rows[0];
        let deliverables = p.deliverables;
        if (typeof deliverables === "string") {
          try { deliverables = JSON.parse(deliverables); } catch (e) {}
        }
        program = {
          id: p.id, name: p.name, start_date: p.start_date, end_date: p.end_date,
          deliverables: deliverables || [],
        };
      }
    }

    // Founder program history (all founders including removed)
    const foundersRes = await db.execute({
      sql: `
        SELECT vm.contact_id, vm.role, vm.joined_at, vm.removed_at, c.name as contact_name
        FROM venture_members vm
        LEFT JOIN contacts c ON vm.contact_id = c.cid
        WHERE vm.venture_id = ? AND vm.member_type = 'founder'
        ORDER BY vm.joined_at DESC
      `,
      args: [id],
    });

    const founderHistory = [];
    for (const founder of (foundersRes.rows || [])) {
      let ppRows = [];
      if (venture.program_id) {
        try {
          const ppRes = await db.execute({
            sql: `
              SELECT pp.*, vp.name as program_name
              FROM participant_programs pp
              LEFT JOIN v2_programs vp ON CAST(pp.program_id AS TEXT) = CAST(vp.id AS TEXT)
              WHERE pp.contact_id = ? AND CAST(pp.program_id AS TEXT) != CAST(? AS TEXT)
              ORDER BY pp.joined_at DESC
            `,
            args: [founder.contact_id, venture.program_id],
          });
          ppRows = ppRes.rows || [];
        } catch (e) {
          console.error("Founder program history query error:", e.message);
        }
      }
      founderHistory.push({
        contact_id: founder.contact_id,
        contact_name: founder.contact_name,
        role: founder.role,
        joined_at: founder.joined_at,
        removed_at: founder.removed_at,
        programs: ppRows,
      });
    }

    return NextResponse.json({
      success: true,
      previous_program: program,
      graduation: venture.graduated_at ? {
        graduated_at: venture.graduated_at,
        graduation_notes: venture.graduation_notes,
      } : null,
      founder_history: founderHistory,
    });
  } catch (error) {
    console.error("GET /api/ventures/[id]/history error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import {
  getFounderProgramHistory,
  getProgramById,
  getVentureForHistory,
  getVentureFounderHistory,
} from "@/models/ventureJourney";

export async function GET(req, { params }) {
  try {
    await initDb();
    // Phase 1.1 (watchlist): history is venture-scoped for EVERY non-global
    // session — an active venture_members row OR an active venture staff
    // assignment is required, regardless of stored role. This closes the
    // founder path that previously passed on the allowlist alone and admits
    // member-baseline founders. SA/developer/admin keep the global bypass.
    const authError = await requireAuth();
    if (authError) return authError;

    const session = await getSession();
    const { id } = await params;

    const ventureRes = await getVentureForHistory(id);

    if (!ventureRes.rows?.[0]) {
      return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
    }

    const venture = ventureRes.rows[0];

    if (session && !["super_admin", "developer", "admin"].includes(session.role)) {
      const { hasActiveVentureAssignment } = await import("@/lib/ventureAuth");
      const assigned = await hasActiveVentureAssignment(id, session.cid, db);
      const member = await db.execute({
        sql: "SELECT 1 FROM venture_members WHERE venture_id = ? AND (contact_id = ? OR user_cid = ?) AND removed_at IS NULL LIMIT 1",
        args: [id, session.cid || "", session.cid || ""],
      });
      if (!assigned && !member.rows?.length) {
        return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
      }
    }

    // Previous program info
    let program = null;
    if (venture.program_id) {
      const progRes = await getProgramById(venture.program_id);
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
    // venture_members stores venture_id as the VNT code (TEXT)
    const foundersRes = await getVentureFounderHistory(id);

    const founderHistory = [];
    for (const founder of (foundersRes.rows || [])) {
      let ppRows = [];
      if (venture.program_id) {
        try {
          const ppRes = await getFounderProgramHistory(founder.contact_id, venture.program_id);
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

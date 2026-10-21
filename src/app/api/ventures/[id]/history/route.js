import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/guards";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
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
    // member-baseline founders. SA keeps the global bypass.
    const authError = await requireAuth();
    if (authError) return authError;

    const { id } = await params;

    const ventureResult = await getVentureForHistory(id);

    if (!ventureResult.rows?.[0]) {
      return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
    }

    // The canonical read gate: capability + the venture perimeter. It answers
    // exactly what the inline check did (platform owner, active membership, or
    // active staff assignment).
    const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "view" });
    if (access.error) return access.error;

    const venture = ventureResult.rows[0];

    // Previous program info
    let program = null;
    if (venture.program_id) {
      const programResult = await getProgramById(venture.program_id);
      if (programResult.rows?.[0]) {
        const programRow = programResult.rows[0];
        let deliverables = programRow.deliverables;
        if (typeof deliverables === "string") {
          try { deliverables = JSON.parse(deliverables); } catch {}
        }
        program = {
          id: programRow.id, name: programRow.name, start_date: programRow.start_date, end_date: programRow.end_date,
          deliverables: deliverables || [],
        };
      }
    }

    // Founder program history (all founders including removed)
    // venture_members stores venture_id as the VNT code (TEXT)
    const foundersResult = await getVentureFounderHistory(id);

    const founderHistory = [];
    for (const founder of (foundersResult.rows || [])) {
      let programHistoryRows = [];
      if (venture.program_id) {
        try {
          const programHistoryResult = await getFounderProgramHistory(founder.contact_id, venture.program_id);
          programHistoryRows = programHistoryResult.rows || [];
        } catch (error) {
          console.error("Founder program history query error:", error.message);
        }
      }
      founderHistory.push({
        contact_id: founder.contact_id,
        contact_name: founder.contact_name,
        role: founder.role,
        joined_at: founder.joined_at,
        removed_at: founder.removed_at,
        programs: programHistoryRows,
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

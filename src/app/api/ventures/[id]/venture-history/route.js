import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { isStaffActorForVenture } from "@/lib/ventureAuth";
import {
  getVentureDbIdByCodeOrId,
  listVentureHistoryEvents,
  listVentureHistoryNotes,
  listVentureHistoryReviewDecisions,
  listVentureHistorySessionNotes,
} from "@/models/ventureWorkspace";

export const dynamic = "force-dynamic";

/**
 * GET /api/ventures/[id]/venture-history — Venture institutional memory
 * (Vinance 3 — Phase 2).
 *
 * Assembles the Venture's readable history into one record:
 *   events           → venture_history (stage added/template applied/duplicated…)
 *   notes            → internal staff notes (staff viewers only)
 *   session_notes    → coach/facilitator session records (staff only)
 *   review_decisions → submission review outcomes with staff feedback
 *
 * Read-only assembly. Every writer keeps writing to its own append-only
 * table — nothing here mutates. Reviewer identities are hidden from
 * non-staff viewers.
 */
export async function GET(req, { params }) {
  try {
    await initDb();
    const { id } = await params;
    const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "view" });
    if (access.error) return access.error;
    const { session } = access;

    const ventureResult = await getVentureDbIdByCodeOrId(id).catch(() => ({ rows: [] }));
    const dbId = ventureResult.rows?.[0]?.id || null;
    const owners = [id, dbId].filter(Boolean);

    const staff = await isStaffActorForVenture(db, id, session);

    const [eventsResult, notesResult, reviewsResult, sessionNotesResult] = await Promise.all([
      listVentureHistoryEvents(owners).catch(() => ({ rows: [] })),
      staff
        ? listVentureHistoryNotes(owners).catch(() => ({ rows: [] }))
        : Promise.resolve({ rows: [] }),
      listVentureHistoryReviewDecisions(owners).catch(() => ({ rows: [] })),
      staff
        ? listVentureHistorySessionNotes(owners).catch(() => ({ rows: [] }))
        : Promise.resolve({ rows: [] }),
    ]);

    // Reviewer identity is staff information; founders see decision + comment.
    const reviewDecisions = (reviewsResult.rows || []).map((row) =>
      staff ? row : { ...row, reviewed_by: null },
    );

    return NextResponse.json({
      success: true,
      staff,
      timeline: {
        events: eventsResult.rows || [],
        notes: notesResult.rows || [],
        session_notes: sessionNotesResult.rows || [],
        review_decisions: reviewDecisions,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

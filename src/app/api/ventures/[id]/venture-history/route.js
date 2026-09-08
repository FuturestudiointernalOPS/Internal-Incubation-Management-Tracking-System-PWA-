import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireVentureAccess, isStaffActorForVenture } from "@/lib/ventureAuth";

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
    const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

    const ventureRes = await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ? OR id::text = ?", args: [id, id] }).catch(() => ({ rows: [] }));
    const dbId = ventureRes.rows?.[0]?.id || null;
    const owners = [id, dbId].filter(Boolean);
    const ownersSql = `IN (${owners.map(() => "?").join(", ")})`;

    const staff = await isStaffActorForVenture(db, id, session);

    const [eventsRes, notesRes, reviewsRes, sessionNotesRes] = await Promise.all([
      db.execute({
        sql: `SELECT event_type, description, metadata, created_by, created_at
              FROM venture_history WHERE venture_id ${ownersSql}
              ORDER BY created_at ASC LIMIT 300`,
        args: owners,
      }).catch(() => ({ rows: [] })),
      staff
        ? db.execute({
            sql: `SELECT id, title, body, author_name, scope_ref_type, scope_ref_id, created_at
                  FROM venture_notes WHERE venture_id ${ownersSql} AND is_archived = FALSE
                  ORDER BY created_at DESC LIMIT 50`,
            args: owners,
          }).catch(() => ({ rows: [] }))
        : Promise.resolve({ rows: [] }),
      db.execute({
        sql: `SELECT s.version, s.status, s.review_decision, s.review_comment, s.reviewed_at,
                     s.submitted_by_name, s.reviewed_by, s.created_at,
                     t.title AS task_title
              FROM venture_task_submissions s
              JOIN venture_tasks t ON t.id = s.task_id
              WHERE t.venture_id ${ownersSql} AND s.review_decision IS NOT NULL
              ORDER BY s.reviewed_at DESC NULLS LAST LIMIT 100`,
        args: owners,
      }).catch(() => ({ rows: [] })),
      staff
        ? db.execute({
            sql: `SELECT sn.id, sn.note_type, sn.content, sn.author_name, sn.created_at,
                         s.title AS session_title, s.start_time, s.journey_stage_id, s.milestone_ref
                  FROM venture_session_notes sn
                  JOIN venture_sessions s ON s.id = sn.session_id
                  WHERE s.venture_id ${ownersSql}
                  ORDER BY sn.created_at DESC LIMIT 50`,
            args: owners,
          }).catch(() => ({ rows: [] }))
        : Promise.resolve({ rows: [] }),
    ]);

    // Reviewer identity is staff information; founders see decision + comment.
    const reviewDecisions = (reviewsRes.rows || []).map((r) =>
      staff ? r : { ...r, reviewed_by: null },
    );

    return NextResponse.json({
      success: true,
      staff,
      timeline: {
        events: eventsRes.rows || [],
        notes: notesRes.rows || [],
        session_notes: sessionNotesRes.rows || [],
        review_decisions: reviewDecisions,
      },
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

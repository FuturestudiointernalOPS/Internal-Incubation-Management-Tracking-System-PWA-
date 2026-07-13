import db from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";

/**
 * PARTICIPANT FOLLOW-UPS API
 * Returns follow-up meetings for the authenticated participant.
 * Used to display scheduled coaching meetings on the participant dashboard.
 */
export const GET = createHandler(async (req) => {
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Authentication required." },
      { status: 401 },
    );
  }

  const cid = session.cid;

  // Find participant in v2_participants
  const participantRes = await db.execute({
    sql: "SELECT id FROM v2_participants WHERE email = ? OR id = ?",
    args: [session.email, cid],
  });

  const participantId = participantRes.rows[0]?.id || cid;

  const result = await db.execute({
    sql: `SELECT f.*, p.name as program_name,
                 d.title as deliverable_title,
                 s.status as submission_status
          FROM v2_followups f
          LEFT JOIN v2_programs p ON f.program_id = p.id
          LEFT JOIN v2_submissions s ON f.submission_id = s.id
          LEFT JOIN v2_deliverables d ON s.deliverable_id = d.id
          WHERE f.participant_id = ?
          ORDER BY f.scheduled_at DESC`,
    args: [participantId],
  });

  // Also check by participant_id matching contact cid
  let additionalFollowups = [];
  if (participantId !== cid) {
    try {
      const extraRes = await db.execute({
        sql: `SELECT f.*, p.name as program_name,
                     d.title as deliverable_title,
                     s.status as submission_status
              FROM v2_followups f
              LEFT JOIN v2_programs p ON f.program_id = p.id
              LEFT JOIN v2_submissions s ON f.submission_id = s.id
              LEFT JOIN v2_deliverables d ON s.deliverable_id = d.id
              WHERE f.participant_id = ?
              ORDER BY f.scheduled_at DESC`,
        args: [cid],
      });
      additionalFollowups = extraRes.rows || [];
    } catch (_) {}
  }

  const allFollowups = [...(result.rows || []), ...additionalFollowups];
  // Deduplicate
  const seen = new Set();
  const unique = allFollowups.filter((f) => {
    if (seen.has(f.id)) return false;
    seen.add(f.id);
    return true;
  });

  return NextResponse.json({ success: true, followups: unique });
});

import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { getParticipantProgramIds } from "@/lib/participant-membership";

export const dynamic = "force-dynamic";

/**
 * GET /api/messaging/contacts
 *
 * Returns the contacts the current participant is allowed to message:
 *   - the program manager(s) of the programs they participate in
 *   - the assistant(s) assigned to those programs
 *   - the facilitator(s) of those programs
 *   - the other participants enrolled in the same programs
 *
 * The list is scoped server-side (unlike GET /api/contacts, which only returns
 * the participant's own contact) so the messaging UI can rely on it directly.
 */
export async function GET(req) {
  try {
    await initDb();

    const authError = await requireAuth(["participant", "founder"]);
    if (authError) return authError;

    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    const cid = session.cid;

    const contactRes = await db.execute({
      sql: "SELECT * FROM contacts WHERE cid = ?",
      args: [cid],
    });
    const contact = contactRes.rows[0] || {};

    const programIds = await getParticipantProgramIds({
      cid,
      email: session.email,
      contact,
    });

    if (programIds.length === 0) {
      return NextResponse.json({ success: true, contacts: [] });
    }

    const ph = programIds.map(() => "?").join(",");
    const allowedCids = new Set();

    // 1. Program managers + assistants of the participant's programs.
    try {
      const res = await db.execute({
        sql: `SELECT assigned_pm_id, assigned_assistant_id FROM v2_programs WHERE id::text IN (${ph})`,
        args: programIds,
      });
      for (const r of res.rows) {
        if (r.assigned_pm_id) allowedCids.add(String(r.assigned_pm_id));
        if (r.assigned_assistant_id) {
          try {
            const ids =
              typeof r.assigned_assistant_id === "string"
                ? JSON.parse(r.assigned_assistant_id)
                : r.assigned_assistant_id;
            if (Array.isArray(ids)) {
              ids.forEach((x) => x && allowedCids.add(String(x)));
            }
          } catch (_) {}
        }
      }
    } catch (_) {}

    // 2. Facilitators via legacy v2_program_staff.
    try {
      const res = await db.execute({
        sql: `SELECT staff_id FROM v2_program_staff WHERE program_id::text IN (${ph})`,
        args: programIds,
      });
      res.rows.forEach((r) => r.staff_id && allowedCids.add(String(r.staff_id)));
    } catch (_) {}

    // 3. Facilitators via generalized contact_roles.
    try {
      const res = await db.execute({
        sql: `SELECT contact_cid FROM contact_roles WHERE context_type = 'program' AND CAST(context_id AS TEXT) IN (${ph}) AND is_current = true`,
        args: programIds,
      });
      res.rows.forEach(
        (r) => r.contact_cid && allowedCids.add(String(r.contact_cid)),
      );
    } catch (_) {}

    // 4. Other participants enrolled in the same programs (participant_programs).
    try {
      const res = await db.execute({
        sql: `SELECT participant_id FROM participant_programs WHERE program_id::text IN (${ph})`,
        args: programIds,
      });
      res.rows.forEach(
        (r) => r.participant_id && allowedCids.add(String(r.participant_id)),
      );
    } catch (_) {}

    // 5. Legacy participants linked via contacts.program_id.
    try {
      const res = await db.execute({
        sql: `SELECT cid FROM contacts WHERE program_id::text IN (${ph})`,
        args: programIds,
      });
      res.rows.forEach((r) => r.cid && allowedCids.add(String(r.cid)));
    } catch (_) {}

    // Exclude self.
    allowedCids.delete(String(cid));

    if (allowedCids.size === 0) {
      return NextResponse.json({ success: true, contacts: [] });
    }

    const cidList = Array.from(allowedCids);
    const cph = cidList.map(() => "?").join(",");
    const contactsRes = await db.execute({
      sql: `SELECT * FROM contacts WHERE cid IN (${cph}) AND status = 'active' AND archived_at IS NULL AND deleted_at IS NULL ORDER BY name ASC`,
      args: cidList,
    });

    // Strip the password hash for safety (mirrors GET /api/contacts).
    const contacts = (contactsRes.rows || []).map(({ password, ...c }) => c);

    return NextResponse.json({ success: true, contacts });
  } catch (error) {
    console.error("Messaging contacts error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

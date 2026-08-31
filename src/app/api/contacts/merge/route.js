import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;
    const capError = await requireAuthorization("contacts", "delete");
    if (capError) return capError;

    const session = await getSession();
    const { survivor_cid, duplicate_cid } = await req.json();
    if (!survivor_cid || !duplicate_cid) {
      return NextResponse.json({ success: false, error: "survivor_cid and duplicate_cid required" }, { status: 400 });
    }

    const counts = { programs: 0, ventures: 0, timeline: 0, flags: 0 };

    // Reassign participant_programs
    const pp = await db.execute({
      sql: "UPDATE participant_programs SET participant_id = ? WHERE participant_id = ?",
      args: [survivor_cid, duplicate_cid],
    });
    counts.programs = pp.rowsAffected || 0;

    // Reassign venture_members
    const vm = await db.execute({
      sql: "UPDATE venture_members SET contact_id = ? WHERE contact_id = ?",
      args: [survivor_cid, duplicate_cid],
    });
    counts.ventures = vm.rowsAffected || 0;

    // Move timeline events
    const tl = await db.execute({
      sql: "UPDATE contact_timeline SET contact_cid = ? WHERE contact_cid = ?",
      args: [survivor_cid, duplicate_cid],
    });
    counts.timeline = tl.rowsAffected || 0;

    // Write merge event to timeline
    await db.execute({
      sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, actor_id, metadata)
            VALUES (?, 'contact_merged', ?, 'crm', ?, ?::jsonb)`,
      args: [survivor_cid, `Merged from ${duplicate_cid}`, session.cid, JSON.stringify({ merged_from: duplicate_cid, counts })],
    });

    // Soft-delete the duplicate and free its email (unique placeholder) so
    // the address can be reused by a new contact later without tripping the
    // contacts_email_key unique constraint.
    await db.execute({
      sql: `UPDATE contacts
            SET deleted_at = NOW(), deleted_by = ?, deleted = 1,
                email = '__deleted_' || cid || '__' || email
            WHERE cid = ?`,
      args: [session.cid, duplicate_cid],
    });

    // Mark duplicate flags as resolved
    const flags = await db.execute({
      sql: `UPDATE contact_duplicate_flags SET status = 'merged', reviewed_by = ?, reviewed_at = NOW()
            WHERE (contact_cid_a = ? AND contact_cid_b = ?) OR (contact_cid_a = ? AND contact_cid_b = ?)`,
      args: [session.cid, survivor_cid, duplicate_cid, duplicate_cid, survivor_cid],
    });
    counts.flags = flags.rowsAffected || 0;

    const summary = `${counts.programs} programs, ${counts.ventures} ventures, ${counts.timeline} events reassigned`;
    return NextResponse.json({ success: true, summary, counts });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

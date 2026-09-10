import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import {
  reassignContactPrograms,
  reassignContactVentures,
  reassignContactTimelineEvents,
  createContactMergeTimelineEvent,
  softDeleteDuplicateContact,
  resolveDuplicateFlagsForMerge,
} from "@/models/contacts";

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
    const pp = await reassignContactPrograms(survivor_cid, duplicate_cid);
    counts.programs = pp.rowsAffected || 0;

    // Reassign venture_members
    const vm = await reassignContactVentures(survivor_cid, duplicate_cid);
    counts.ventures = vm.rowsAffected || 0;

    // Phase 6: the survivor inherits the duplicate's venture relationships —
    // reconcile their context grants so a merged founder keeps working access.
    try {
      const { syncContextGrantsForUser } = await import("@/models/authorization/contextGrants");
      await syncContextGrantsForUser(survivor_cid);
    } catch (_) {}

    // Move timeline events
    const tl = await reassignContactTimelineEvents(survivor_cid, duplicate_cid);
    counts.timeline = tl.rowsAffected || 0;

    // Write merge event to timeline
    await createContactMergeTimelineEvent(
      survivor_cid,
      duplicate_cid,
      session.cid,
      counts,
    );

    // Soft-delete the duplicate and free its email (unique placeholder) so
    // the address can be reused by a new contact later without tripping the
    // contacts_email_key unique constraint.
    await softDeleteDuplicateContact(session.cid, duplicate_cid);

    // Mark duplicate flags as resolved
    const flags = await resolveDuplicateFlagsForMerge(
      survivor_cid,
      duplicate_cid,
      session.cid,
    );
    counts.flags = flags.rowsAffected || 0;

    const summary = `${counts.programs} programs, ${counts.ventures} ventures, ${counts.timeline} events reassigned`;
    return NextResponse.json({ success: true, summary, counts });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

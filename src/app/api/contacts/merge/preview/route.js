import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import {
  countMergeParticipantPrograms,
  countMergeVentureMemberships,
  countMergeTimelineEvents,
} from "@/models/contacts";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;
    const capError = await requireAuthorization("contacts", "view");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const survivorCid = searchParams.get("a");
    const duplicateCid = searchParams.get("b");
    if (!survivorCid || !duplicateCid)
      return NextResponse.json(
        { success: false, error: "a and b required" },
        { status: 400 },
      );

    // Count what will be reassigned
    const [participantProgramsCount, ventureMembershipsCount, timelineEventsCount] =
      await Promise.all([
        countMergeParticipantPrograms(duplicateCid),
        countMergeVentureMemberships(duplicateCid),
        countMergeTimelineEvents(duplicateCid),
      ]);

    return NextResponse.json({
      success: true,
      summary: {
        program_enrollments: participantProgramsCount.rows[0]?.c || 0,
        venture_memberships: ventureMembershipsCount.rows[0]?.c || 0,
        timeline_events: timelineEventsCount.rows[0]?.c || 0,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

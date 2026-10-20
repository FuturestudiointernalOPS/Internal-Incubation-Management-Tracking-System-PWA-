import { createHandler } from "@/lib/api/createHandler";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/models/authorization/index";
import {
  countActiveV2Programs,
  countActiveProjects,
  countParticipantContacts,
  countStaffContacts,
  listRecentActivityLogs,
  listActiveV2Programs,
  listStaffRoster,
} from "@/models/adminOps";

export const dynamic = "force-dynamic";

export const GET = createHandler(async () => {
  // Lot 4.2 — the platform console is an explicit read capability, not a role
  // name. The platform owner bypasses it; no other profile carries it.
  const capError = await requireAuthorization("settings", "view");
  if (capError) return capError;

  const [
    programsResult,
    participantsResult,
    staffResult,
    logsResult,
    activePrograms,
    projectsResult,
    rosterResult,
  ] = await Promise.all([
    countActiveV2Programs(),
    countParticipantContacts(),
    countStaffContacts(),
    listRecentActivityLogs(),
    listActiveV2Programs(),
    countActiveProjects(),
    listStaffRoster(),
  ]);

  return NextResponse.json(
    {
      success: true,
      stats: {
        programs: programsResult.rows[0].count,
        participants: participantsResult.rows[0].count,
        totalStaff: staffResult.rows[0].count,
        projects: projectsResult.rows[0].count,
      },
      activity: logsResult.rows,
      activePrograms: activePrograms.rows,
      staffRoster: rosterResult.rows,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
});

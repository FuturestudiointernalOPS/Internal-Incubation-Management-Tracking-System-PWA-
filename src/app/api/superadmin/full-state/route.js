import { createHandler } from "@/lib/api/createHandler";
import { NextResponse } from "next/server";
import {
  countActiveV2Programs,
  countParticipantContacts,
  countStaffContacts,
  listRecentActivityLogs,
  listActiveV2Programs,
} from "@/models/adminOps";

export const dynamic = "force-dynamic";

export const GET = createHandler({ roles: ["super_admin"] }, async () => {
  const [programsResult, participantsResult, staffResult, logsResult, activePrograms] =
    await Promise.all([
      countActiveV2Programs(),
      countParticipantContacts(),
      countStaffContacts(),
      listRecentActivityLogs(),
      listActiveV2Programs(),
    ]);

  return NextResponse.json(
    {
      success: true,
      stats: {
        programs: programsResult.rows[0].count,
        participants: participantsResult.rows[0].count,
        totalStaff: staffResult.rows[0].count,
      },
      activity: logsResult.rows,
      activePrograms: activePrograms.rows,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
});

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
  const [progRes, partRes, staffRes, logRes, activeProgList] =
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
        programs: progRes.rows[0].count,
        participants: partRes.rows[0].count,
        totalStaff: staffRes.rows[0].count,
      },
      activity: logRes.rows,
      activePrograms: activeProgList.rows,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
});

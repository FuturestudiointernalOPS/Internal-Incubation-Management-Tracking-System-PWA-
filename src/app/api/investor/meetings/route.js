import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";

import { requireInvestorSelfServiceAuthorization } from "@/models/authorization/investorSelfService";
import {
  listInvestorMeetingsForViewer,
  createInvestorMeeting,
} from "@/services/investor";

/**
 * GET /api/investor/meetings?venture_id=X
 * POST /api/investor/meetings — schedule
 *
 * The venture-required scope rule lives in `@/services/investor`.
 */
export async function GET(req) {
  try {
    await initDb();
    const capError = await requireInvestorSelfServiceAuthorization("view");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const ventureId = searchParams.get("venture_id");

    const result = await listInvestorMeetingsForViewer({
      ventureId,
      session: await getSession(),
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, meetings: result.meetings });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const capError = await requireInvestorSelfServiceAuthorization("create");
    if (capError) return capError;

    const { venture_id, title, description, start_time, end_time, location } = await req.json();

    const result = await createInvestorMeeting({
      ventureId: venture_id,
      title,
      description,
      startTime: start_time,
      endTime: end_time,
      location,
      session: await getSession(),
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, meeting: result.meeting });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import {
  insertInvestorMeeting,
  listInvestorMeetingEvents,
} from "@/models/investorRelations";

/** GET /api/investor/meetings?venture_id=X */
export async function GET(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("investor", "view");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const ventureId = searchParams.get("venture_id");

    const result = await listInvestorMeetingEvents({ ventureId });
    return NextResponse.json({ success: true, meetings: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/** POST /api/investor/meetings — schedule */
export async function POST(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("investor", "create");
    if (capError) return capError;

    const session = await getSession();
    const { venture_id, title, description, start_time, end_time, location } = await req.json();

    if (!title || !start_time) {
      return NextResponse.json({ success: false, error: "Title and start_time required" }, { status: 400 });
    }

    const result = await insertInvestorMeeting(
      venture_id || null,
      title,
      description || null,
      start_time,
      end_time || null,
      location || "video",
      session.cid || session.id,
    );

    return NextResponse.json({ success: true, meeting: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { readParticipantAnnouncements } from "@/services/communications/inboxNotifications";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session?.cid) return NextResponse.json({ success: false }, { status: 401 });
  try {
    return NextResponse.json(await readParticipantAnnouncements(session));
  } catch (error) {
    console.error("Participant announcements read failed", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

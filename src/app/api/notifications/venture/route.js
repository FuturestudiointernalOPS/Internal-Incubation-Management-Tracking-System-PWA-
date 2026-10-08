import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/server/auth/session";
import { readVentureNotificationCenter, actOnVentureNotification } from "@/services/communications/ventureNotifications";

function respond(outcome) {
  if (outcome.denied) {
    return NextResponse.json({ success: false, error: outcome.denied.error }, { status: outcome.denied.status });
  }
  return NextResponse.json({ success: true, ...outcome });
}

export const GET = createHandler(async (req) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  const queryParams = new URL(req.url).searchParams;
  return respond(await readVentureNotificationCenter({ session, queryParams }));
});

export const POST = createHandler(async (req) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  const body = await req.json();
  return respond(await actOnVentureNotification({ session, body }));
});

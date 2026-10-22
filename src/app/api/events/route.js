import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/models/authorization/index";
import { listEvents } from "@/models/communications";
import { createEvent } from "@/services/communications/events";

/**
 * /api/events — calendar events.
 *
 * GET  ?program_id=X  list events (optionally scoped to a program)
 * POST                create an event and notify its participant
 *
 * The notification composition lives in `@/services/communications/events`;
 * this route keeps the capability gate and the envelope.
 */

export const GET = createHandler(async (req) => {
    const capError = await requireAuthorization("programs", "view");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("program_id");

  const result = await listEvents({ programId });
  return NextResponse.json({ success: true, events: result.rows });
});

export const POST = createHandler(
  async (req) => {
    const capError = await requireAuthorization("programs", "edit");
    if (capError) return capError;

    const payload = await req.json();

    const newEvent = await createEvent({ payload });
    return NextResponse.json({ success: true, event: newEvent });
  },
);

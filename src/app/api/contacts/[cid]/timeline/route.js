import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireAuthorization } from "@/models/authorization/index";
import {
  mayReadContactTimeline,
  listContactTimeline,
  addContactTimelineEvent,
} from "@/services/contacts/timeline";

export const dynamic = "force-dynamic";

/**
 * /api/contacts/[cid]/timeline — a contact's timeline.
 *
 * The scope rule (own-record for participants/founders, program-scoped for
 * program managers) and the event append live in
 * `@/services/contacts/timeline`; this route gates on the capability and shapes
 * the HTTP answer.
 */

export async function GET(req, { params }) {
  try {
    await initDb();
    const capError = await requireAuthorization("contacts", "view");
    if (capError) return capError;

    const session = await getSession();
    const { cid } = await params;
    const { searchParams } = new URL(req.url);
    const moduleFilter = searchParams.get("module");
    const typeFilter = searchParams.get("type");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!mayReadContactTimeline(session, cid)) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 });
    }

    const { contact, events, total } = await listContactTimeline(session, cid, {
      moduleFilter,
      typeFilter,
      limit,
      offset,
    });

    return NextResponse.json({ success: true, contact, events, total });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    await initDb();
    const capError = await requireAuthorization("contacts", "edit");
    if (capError) return capError;

    const session = await getSession();
    const { cid } = await params;
    const { event_type, description, metadata } = await req.json();

    if (!event_type || !description) {
      return NextResponse.json({ success: false, error: "event_type and description required" }, { status: 400 });
    }

    const event = await addContactTimelineEvent({
      cid,
      eventType: event_type,
      description,
      actorCid: session.cid,
      metadata,
    });

    return NextResponse.json({ success: true, event });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

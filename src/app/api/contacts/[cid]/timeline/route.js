import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import {
  getProgramIdsForPm,
  getContactTimelineEvents,
  getTimelineContactIdentity,
  createContactTimelineEvent,
} from "@/models/contacts";

export const dynamic = "force-dynamic";

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

    if (session.role === "participant" || session.role === "founder") {
      if (session.cid !== cid) {
        return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 });
      }
    }

    // Program managers: scope events to non-program modules + their programs.
    let pmProgramIds;
    if (session.role === "program_manager") {
      const progRes = await getProgramIdsForPm(session.cid);
      pmProgramIds = progRes.rows.map(r => r.id);
    }

    const result = await getContactTimelineEvents(
      cid,
      moduleFilter,
      typeFilter,
      pmProgramIds,
      limit,
      offset,
    );
    const contactRes = await getTimelineContactIdentity(cid);

    return NextResponse.json({ success: true, contact: contactRes.rows[0] || null, events: result.rows, total: result.rows.length });
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

    const result = await createContactTimelineEvent(
      cid,
      event_type,
      description,
      session.cid,
      metadata,
    );

    return NextResponse.json({ success: true, event: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

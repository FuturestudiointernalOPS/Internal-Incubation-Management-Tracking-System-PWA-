import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { selectVentureIdentity } from "@/models/ventureReportingStore";
import { listEvents, createEvent, deleteEvent, interviewSummary } from "@/services/ventures/reporting/events";

/**
 * GET/POST/DELETE /api/ventures/[id]/reporting/events
 *
 * The founder's event log (spec §7): the things that happened on a day, not in
 * a month. GET also returns the interview summary, because the two answers sit
 * side by side on the same tab ("10 interviews, 7 of them evidenced").
 */
async function resolveVenture(id) {
  const result = await selectVentureIdentity(id).catch(() => ({ rows: [] }));
  return (result.rows || [])[0] || null;
}

export const GET = createHandler(async (req, { params }) => {
  const { id } = await params;
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "view" });
  if (access.error) return access.error;

  const venture = await resolveVenture(id);
  if (!venture) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

  const [{ events, bands, currency }, interviews] = await Promise.all([
    listEvents({ ventureUuid: venture.id }),
    interviewSummary({ ventureUuid: venture.id }),
  ]);

  return NextResponse.json({ success: true, events, bands, currency, interviews });
});

export const POST = createHandler(async (req, { params }) => {
  const { id } = await params;
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
  if (access.error) return access.error;

  const venture = await resolveVenture(id);
  if (!venture) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const result = await createEvent({
    ventureUuid: venture.id,
    ventureCode: venture.venture_id,
    actorCid: req.session?.cid || null,
    input: body,
  });

  if (result.errors) {
    return NextResponse.json({ success: false, errors: result.errors }, { status: 400 });
  }
  return NextResponse.json({ success: true, event: result.event });
});

export const DELETE = createHandler(async (req, { params }) => {
  const { id } = await params;
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
  if (access.error) return access.error;

  const venture = await resolveVenture(id);
  if (!venture) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const result = await deleteEvent({
    ventureUuid: venture.id,
    id: body.id,
    actorCid: req.session?.cid || null,
  });

  if (result.errors) {
    return NextResponse.json({ success: false, errors: result.errors }, { status: 400 });
  }
  return NextResponse.json({ success: true });
});

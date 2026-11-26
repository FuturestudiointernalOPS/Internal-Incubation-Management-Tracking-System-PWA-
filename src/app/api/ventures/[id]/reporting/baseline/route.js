import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { selectVentureIdentity } from "@/models/ventureReportingStore";
import {
  getBaseline,
  captureBaseline,
  supersedeBaseline,
} from "@/services/ventures/reporting/baseline";

/** GET/POST/PUT /api/ventures/[id]/reporting/baseline */

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

  return NextResponse.json({ success: true, baseline: await getBaseline({ ventureUuid: venture.id }) });
});

/** Capture the baseline once. */
export const POST = createHandler(async (req, { params }) => {
  const { id } = await params;
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
  if (access.error) return access.error;

  const venture = await resolveVenture(id);
  if (!venture) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const result = await captureBaseline({
    ventureUuid: venture.id,
    ventureCode: venture.venture_id,
    actorCid: req.session?.cid || null,
    input: body,
  });
  if (result.errors) {
    return NextResponse.json({ success: false, errors: result.errors }, { status: 400 });
  }
  return NextResponse.json({ success: true, baseline: result.baseline });
});

/** Supersede the locked baseline — a reason is mandatory. */
export const PUT = createHandler(async (req, { params }) => {
  const { id } = await params;
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
  if (access.error) return access.error;

  const venture = await resolveVenture(id);
  if (!venture) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const result = await supersedeBaseline({
    ventureUuid: venture.id,
    ventureCode: venture.venture_id,
    actorCid: req.session?.cid || null,
    reason: body.reason,
    input: body.baseline || null,
  });
  if (result.errors) {
    return NextResponse.json({ success: false, errors: result.errors }, { status: 400 });
  }
  return NextResponse.json({ success: true, baseline: result.baseline });
});

import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/models/authorization/index";
import { selectVentureIdentity } from "@/models/ventureReportingStore";
import {
  listQuarterlyReports,
  getQuarterlyReport,
  decideQuarterlyReport,
} from "@/services/ventures/reporting/quarterly";

/**
 * GET/POST /api/ventures/[id]/reporting/quarterly/review[?period=2026-Q4]
 *
 * The studio's side of the quarterly report. Gated on `ventures.validate` for
 * both verbs — same reasoning as the monthly review route: `ventures.view` is a
 * right every founder holds for their own Venture, so it cannot open a
 * cross-Venture review surface.
 */
async function resolveVenture(id) {
  const result = await selectVentureIdentity(id).catch(() => ({ rows: [] }));
  return (result.rows || [])[0] || null;
}

export const GET = createHandler(async (req, { params }) => {
  const { id } = await params;
  const authError = await requireAuthorization("ventures", "validate");
  if (authError) return authError;

  const venture = await resolveVenture(id);
  if (!venture) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

  const period = new URL(req.url).searchParams.get("period");
  if (!period) {
    const { reports } = await listQuarterlyReports({ ventureUuid: venture.id });
    return NextResponse.json({ success: true, reports });
  }

  const detail = await getQuarterlyReport({ ventureUuid: venture.id, period });
  if (detail.errors) {
    return NextResponse.json({ success: false, errors: detail.errors }, { status: 400 });
  }
  return NextResponse.json({ success: true, ...detail });
});

export const POST = createHandler(async (req, { params }) => {
  const { id } = await params;
  const authError = await requireAuthorization("ventures", "validate", 3);
  if (authError) return authError;

  const venture = await resolveVenture(id);
  if (!venture) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const result = await decideQuarterlyReport({
    ventureUuid: venture.id,
    ventureCode: venture.venture_id,
    actorCid: req.session?.cid || null,
    input: body,
  });

  if (result.errors) {
    return NextResponse.json({ success: false, errors: result.errors }, { status: 400 });
  }
  return NextResponse.json({ success: true, report: result.report, metrics: result.metrics });
});

import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { selectVentureIdentity } from "@/models/ventureReportingStore";
import {
  listQuarterlyReports,
  getQuarterlyReport,
  saveQuarterlyReport,
} from "@/services/ventures/reporting/quarterly";

/**
 * GET/POST /api/ventures/[id]/reporting/quarterly[?period=2026-Q4]
 *
 * The founder's quarterly report. Only the STAGE-SPECIFIC questions live here;
 * customers, MRR, retention and runway are read from the validated monthly
 * reports, so the same figure is never entered twice.
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
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
  if (access.error) return access.error;

  const venture = await resolveVenture(id);
  if (!venture) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const result = await saveQuarterlyReport({
    ventureUuid: venture.id,
    ventureCode: venture.venture_id,
    actorCid: req.session?.cid || null,
    input: body,
  });

  if (result.errors) {
    return NextResponse.json({ success: false, errors: result.errors }, { status: 400 });
  }
  return NextResponse.json({ success: true, report: result.report });
});

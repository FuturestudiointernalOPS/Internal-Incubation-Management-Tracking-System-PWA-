import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { selectVentureIdentity } from "@/models/ventureReportingStore";
import {
  listMonthlyReports,
  getMonthlyReport,
  saveMonthlyReport,
} from "@/services/ventures/reporting/monthly";

/**
 * GET/POST /api/ventures/[id]/reporting/monthly[?period=YYYY-MM]
 *
 * The FOUNDER owns the monthly report (venture_own scope, `ventures.edit`).
 * The studio reads and decides elsewhere — `/reporting/monthly/review` — so a
 * reviewer never needs to be a member of the Venture they review.
 *
 * GET            → the submission history (all months, all versions)
 * GET ?period=   → one month: open report, validated report, history, stored
 *                  metrics, and a live preview of the draft
 * POST           → save (and optionally submit) the founder's month
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
    const { reports } = await listMonthlyReports({ ventureUuid: venture.id });
    return NextResponse.json({ success: true, reports });
  }

  const detail = await getMonthlyReport({ ventureUuid: venture.id, period });
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
  const result = await saveMonthlyReport({
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

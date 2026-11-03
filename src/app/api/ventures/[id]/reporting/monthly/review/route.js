import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/models/authorization/index";
import { selectVentureIdentity } from "@/models/ventureReportingStore";
import {
  listMonthlyReports,
  getMonthlyReport,
  decideMonthlyReport,
} from "@/services/ventures/reporting/monthly";

/**
 * GET/POST /api/ventures/[id]/reporting/monthly/review[?period=YYYY-MM]
 *
 * THE STUDIO'S SIDE. Deliberately NOT scoped to `venture_own`: validating a
 * founder's report is a review duty, and the reviewer is often not a member of
 * the Venture they review. That is exactly why `ventures.validate` exists as
 * its own assignable capability, separate from `ventures.edit`.
 *
 * GET             → every submission for the Venture, all statuses
 * GET ?period=    → one month in full, including a live preview of the
 *                   submitted draft (so the reviewer sees the numbers the
 *                   engine will produce, not just the raw inputs)
 * POST            → { period, action: "validate" | "reject", reason? }
 *
 * BOTH verbs are gated on `ventures.validate`. Reading through this route is
 * reading AS a reviewer; the founder's own read lives on the scoped route.
 */
async function resolveVenture(id) {
  const result = await selectVentureIdentity(id).catch(() => ({ rows: [] }));
  return (result.rows || [])[0] || null;
}

export const GET = createHandler(async (req, { params }) => {
  const { id } = await params;
  // `ventures.validate`, not `ventures.view`: a founder holds `view` on their
  // OWN Venture, and an unscoped view check would let them read every other
  // Venture's submissions. The reviewer capability is the correct door.
  const authError = await requireAuthorization("ventures", "validate");
  if (authError) return authError;

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
  // Level 3: this is a decision, not a read. Assignable to a program manager
  // or a staff reviewer without granting them `ventures.edit` on the Venture.
  const authError = await requireAuthorization("ventures", "validate", 3);
  if (authError) return authError;

  const venture = await resolveVenture(id);
  if (!venture) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const result = await decideMonthlyReport({
    ventureUuid: venture.id,
    ventureCode: venture.venture_id,
    actorCid: req.session?.cid || null,
    input: body,
  });

  if (result.errors) {
    return NextResponse.json({ success: false, errors: result.errors }, { status: 400 });
  }
  return NextResponse.json({
    success: true,
    report: result.report,
    metrics: result.metrics,
  });
});

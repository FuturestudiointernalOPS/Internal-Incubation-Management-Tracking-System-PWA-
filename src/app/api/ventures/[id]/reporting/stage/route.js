import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/models/authorization/index";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { selectVentureIdentity } from "@/models/ventureReportingStore";
import { getStageStatus, refreshStageProposal, decideStageProposal } from "@/services/ventures/reporting/stage";

/**
 * GET/POST /api/ventures/[id]/reporting/stage
 *
 * GET  → the live evaluation: current stage, the next stage's criteria
 *        (met / not met / MISSING), the progress score, the review flag,
 *        the pending proposal and the stage history.
 *        Readable by the founder (scoped) and by a reviewer.
 *
 * POST → { action: "propose" | "approve" | "reject", reason? }
 *        Studio only (`ventures.validate`). Proposing re-evaluates and queues
 *        a proposal when every criterion is met; approving is the ONLY writer
 *        of `ventures.business_stage`.
 */
async function resolveVenture(id) {
  const result = await selectVentureIdentity(id).catch(() => ({ rows: [] }));
  return (result.rows || [])[0] || null;
}

export const GET = createHandler(async (req, { params }) => {
  const { id } = await params;

  // A reviewer is not necessarily a member of the Venture.
  const authError = await requireAuthorization("ventures", "validate");
  if (authError) {
    const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "view" });
    if (access.error) return access.error;
  }

  const venture = await resolveVenture(id);
  if (!venture) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

  const status = await getStageStatus({ ventureUuid: venture.id });
  return NextResponse.json({ success: true, ...status });
});

export const POST = createHandler(async (req, { params }) => {
  const { id } = await params;
  const authError = await requireAuthorization("ventures", "validate", 3);
  if (authError) return authError;

  const venture = await resolveVenture(id);
  if (!venture) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "").trim();

  if (action === "propose") {
    const result = await refreshStageProposal({
      ventureUuid: venture.id,
      ventureCode: venture.venture_id,
      actorCid: req.session?.cid || null,
    });
    if (result.reason === "not_eligible") {
      return NextResponse.json(
        { success: false, error: "venture.reporting.stage.validation.notEligible", evaluation: result.evaluation },
        { status: 409 },
      );
    }
    return NextResponse.json({ success: true, proposal: result.proposal, reason: result.reason });
  }

  const result = await decideStageProposal({
    ventureUuid: venture.id,
    ventureCode: venture.venture_id,
    actorCid: req.session?.cid || null,
    input: { action, reason: body.reason },
  });

  if (result.errors) {
    return NextResponse.json({ success: false, errors: result.errors }, { status: 400 });
  }
  return NextResponse.json({ success: true, proposal: result.proposal, approved: result.approved });
});

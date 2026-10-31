import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/models/authorization/index";
import { resendFounderInvite } from "@/services/dashboard/adminVentures";

/**
 * POST /api/admin/ventures/[id]/resend-founder-invite
 *
 * Send the Venture's PENDING founder invitation again — the one created with
 * the Venture, or any founder invitation still waiting for an answer.
 *
 * Body: { invitation_id? }  — omitted sends the newest pending founder
 *                              invitation of the Venture.
 *
 * The invitation is re-issued (new link, earlier one stops working) and mailed
 * through the SAME `/venture-invite/<token>` acceptance path as every other
 * Venture invitation. The work lives in `services/dashboard/adminVentures`;
 * this controller keeps the capability gate and the envelope.
 */
export const dynamic = "force-dynamic";

export const POST = createHandler(async (req, { params }) => {
  const authError = await requireAuthorization("ventures", "edit");
  if (authError) return authError;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const { status, body: responseBody } = await resendFounderInvite({
    ventureId: id,
    invitationId: body.invitation_id ?? null,
    actor: req.session,
  });
  return NextResponse.json(responseBody, { status });
});

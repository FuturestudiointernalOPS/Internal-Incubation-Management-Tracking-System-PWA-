import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { createVentureWithFounderInvite } from "@/services/dashboard/adminVentures";

/**
 * POST /api/admin/ventures/create
 *
 * Super-admin fast-path: record a Venture by name and invite its founder in one
 * step. The Venture is created ACTIVE (an administrator vouches for it), and the
 * founder receives an invitation link where they either create their account
 * (a stranger to the platform) or accept as an existing user — either way they
 * become the Venture's founder with access to its workspace.
 *
 * This route never fabricates a founder ACCOUNT: it only ever emits an
 * invitation. The founder identity is resolved (never guessed) at acceptance.
 *
 * The validation, the invitation and the delivery recording live in
 * `services/dashboard/adminVentures`; this controller keeps the super-admin gate
 * and the envelope.
 */
export const POST = createHandler({ roles: ["super_admin"] }, async (req) => {
  const body = await req.json().catch(() => ({}));

  const { status, body: responseBody } = await createVentureWithFounderInvite({
    companyName: body.company_name,
    founderEmail: body.founder_email,
    actor: req.session,
  });
  return NextResponse.json(responseBody, { status });
});

import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import { lmsErrorResponse } from "@/lib/lms/errors";
import { applyRegistrationAction } from "@/services/lms/registrations";

export const dynamic = "force-dynamic";

/**
 * POST /api/lms/registrations/[id]  { action }
 *
 * The team actions, all server-side and decided in
 * `@/services/lms/registrations`: retry-access, resend-email, refund (with an
 * optional same-step access revocation) and revoke-access. Requires lms.edit.
 */
export async function POST(req, { params }) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "edit");
    if (capError) return capError;

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    const result = await applyRegistrationAction({
      id,
      action,
      revokeAccess: body.revokeAccess,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    return lmsErrorResponse(error);
  }
}

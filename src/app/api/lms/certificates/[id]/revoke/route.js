import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/models/authorization/index";
import { revokeCertificate } from "@/models/lms/certificates";
import { lmsErrorResponse } from "@/models/lms/errors";

export const dynamic = "force-dynamic";

/**
 * POST /api/lms/certificates/[id]/revoke
 * Minimal V1 revocation (admin only — lms.edit capability; super admin bypasses
 * through the resolver). Never deletes the certificate record: the historical
 * record stays auditable and the public verification page reflects REVOKED.
 * Idempotent: revoking an already-revoked certificate succeeds quietly.
 */
export async function POST(req, { params }) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "edit");
    if (capError) return capError;

    const { id } = await params;
    const result = await revokeCertificate(id);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return lmsErrorResponse(error);
  }
}

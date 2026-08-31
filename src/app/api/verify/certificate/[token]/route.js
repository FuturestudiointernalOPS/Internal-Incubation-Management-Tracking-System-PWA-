import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { getCertificatePublic } from "@/lib/lms/certificates";
import { lmsErrorResponse } from "@/lib/lms/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/verify/certificate/[token]
 * PUBLIC certificate verification — deliberately NO authentication.
 *
 * Exposes ONLY the deliberately public certificate fields (certificate number,
 * learner name, course title, issue date, status). Never emails, user ids,
 * enrollment data, internal database ids, or the verification token itself.
 * A revoked certificate still verifies as a real certificate (status revoked) —
 * the record is never deleted.
 */
export async function GET(req, { params }) {
  try {
    await initDb();
    const { token } = await params;
    const certificate = await getCertificatePublic(token);
    return NextResponse.json({ success: true, certificate });
  } catch (e) {
    return lmsErrorResponse(e);
  }
}

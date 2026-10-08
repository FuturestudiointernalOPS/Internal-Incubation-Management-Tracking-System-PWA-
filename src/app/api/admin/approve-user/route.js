import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/models/authorization/index";
import { getSession } from "@/server/auth/session";
import { NextResponse } from "next/server";
import { ensureTokenHashColumns } from "@/lib/token-hashing";
import { approveUser } from "@/services/dashboard/userAdmin";

/**
 * APPROVE USER ENDPOINT
 * POST /api/admin/approve-user
 *
 * Body: { user_cid, role? }
 *
 * The use-case (existence / status checks, the role rule, the setup token and
 * email, the audit entry, the notification clearing) lives in
 * `services/dashboard/userAdmin`; this controller keeps the `initDb`, the token
 * column bootstrap, the capability gate, the base URL and the envelope.
 */
export async function POST(req) {
  try {
    await initDb();
    await ensureTokenHashColumns();
    const capError = await requireAuthorization("permissions", "assign_capabilities");
    if (capError) return capError;

    const session = await getSession();
    const { user_cid, role } = await req.json();

    const protocol = req.headers.get("x-forwarded-proto") || "https";
    const host = req.headers.get("host") || "impactos.futurestudio.com";
    const baseUrl = `${protocol}://${host}`;

    const { status, body } = await approveUser({
      userCid: user_cid,
      requestedRole: role,
      actor: session,
      baseUrl,
    });
    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("User approval error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to approve user." },
      { status: 500 },
    );
  }
}

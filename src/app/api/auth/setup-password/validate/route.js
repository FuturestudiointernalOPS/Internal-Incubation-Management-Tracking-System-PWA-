import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { hashToken, ensureTokenHashColumns } from "@/lib/token-hashing";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  getPasswordSetupTokenWithUser,
  backfillPasswordSetupTokenHashOnValidate,
} from "@/models/authFlows";

/**
 * VALIDATE PASSWORD SETUP TOKEN
 * GET /api/auth/setup-password/validate?token=xxx
 *
 * Returns: { valid: true/false, user: { name, email } } or error
 */
export async function GET(req) {
  try {
    await initDb();
    await ensureTokenHashColumns();

    // Rate limit: an unauthenticated token probe must be throttled.
    const limited = enforceRateLimit(req, `setup-validate:ip:${getClientIp(req)}`, {
      limit: 20,
      windowMs: 15 * 60 * 1000,
    });
    if (limited) return limited;

    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { valid: false, error: "Token is required" },
        { status: 400 }
      );
    }

    const tokenHash = hashToken(token);
    const result = await getPasswordSetupTokenWithUser(tokenHash, token);

    if (result.rows.length === 0) {
      return NextResponse.json({
        valid: false,
        error: "This link is invalid or has expired. Please contact your administrator.",
      });
    }

    const record = result.rows[0];

    // Lazily backfill the hash for legacy rows stored before hashing was added.
    if (!record.token_hash) {
      await backfillPasswordSetupTokenHashOnValidate(tokenHash, record.id).catch(
        () => {},
      );
    }
    return NextResponse.json({
      valid: true,
      user: {
        name: record.user_name || "User",
        email: record.user_email,
        cid: record.contact_cid,
      },
    });
  } catch (error) {
    console.error("Token validation error:", error);
    return NextResponse.json(
      { valid: false, error: "Failed to validate token" },
      { status: 500 }
    );
  }
}

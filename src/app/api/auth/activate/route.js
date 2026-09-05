import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sendWelcomeEmail } from "@/lib/email";
import { hashToken, ensureTokenHashColumns } from "@/lib/token-hashing";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  getActivationInviteByTokenHash,
  getActivationTokenExpiry,
  backfillActivationTokenHashOnOpen,
  logInvitationOpened,
  getActivationInviteForPasswordSetup,
  backfillActivationTokenHashOnActivate,
  activateContactWithPassword,
  markActivationTokenUsed,
  logInvitationActivated,
} from "@/models/authFlows";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/activate?token=XXX
 *
 * Validates an activation token and returns user info for the activation page.
 */
export async function GET(req) {
  try {
    await initDb();
    await ensureTokenHashColumns();
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ success: false, error: "Token is required" }, { status: 400 });
    }

    const tokenHash = hashToken(token);
    const tokenRes = await getActivationInviteByTokenHash(tokenHash, token);

    if (tokenRes.rows.length === 0) {
      // Check if token exists but expired
      const expiredRes = await getActivationTokenExpiry(tokenHash, token);

      if (expiredRes.rows.length > 0) {
        return NextResponse.json(
          { success: false, error: "This link has expired. Contact your administrator.", expired: true },
          { status: 400 },
        );
      }

      return NextResponse.json({ success: false, error: "Invalid token" }, { status: 400 });
    }

    const record = tokenRes.rows[0];

    // Lazily backfill the hash for legacy rows stored before hashing was added.
    if (!record.token_hash) {
      await backfillActivationTokenHashOnOpen(tokenHash, record.id).catch(
        () => {},
      );
    }

    // Audit: invitation opened
    try {
      await logInvitationOpened(record.contact_cid);
    } catch (_) {}

    return NextResponse.json({
      success: true,
      name: record.name,
      email: record.email,
      role: record.role || "participant",
      language: record.language || "en",
      cid: record.contact_cid,
    });
  } catch (error) {
    console.error("Activate GET error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/auth/activate
 *
 * Sets the user's password and activates their account.
 * Body: { token, password }
 */
export async function POST(req) {
  try {
    await initDb();
    await ensureTokenHashColumns();

    // Rate limit: prevents brute-forcing activation tokens (10 per IP / 15 min)
    const limited = enforceRateLimit(req, `activate:ip:${getClientIp(req)}`, {
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });
    if (limited) return limited;

    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ success: false, error: "Token and password are required" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ success: false, error: "Password must be at least 6 characters" }, { status: 400 });
    }

    // Validate token
    const tokenHash = hashToken(token);
    const tokenRes = await getActivationInviteForPasswordSetup(tokenHash, token);

    if (tokenRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired token. Contact your administrator." },
        { status: 400 },
      );
    }

    const record = tokenRes.rows[0];

    // Lazily backfill the hash for legacy rows stored before hashing was added.
    if (!record.token_hash) {
      await backfillActivationTokenHashOnActivate(tokenHash, record.id).catch(
        () => {},
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Update contact: set password, mark as active and verified
    await activateContactWithPassword(hashedPassword, record.contact_cid);

    // Mark token as used
    await markActivationTokenUsed(record.id);

    // Audit: invitation activated
    try {
      await logInvitationActivated(record.contact_cid);
    } catch (_) {}

    // Send welcome email (non-blocking)
    sendWelcomeEmail({ to: record.email, name: record.name, role: record.role, language: record.language }).catch((e) =>
      console.error("Welcome email failed:", e),
    );

    return NextResponse.json({ success: true, message: "Account activated. You can now log in." });
  } catch (error) {
    console.error("Activate POST error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

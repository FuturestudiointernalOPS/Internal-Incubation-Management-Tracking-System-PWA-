import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sendWelcomeEmail } from "@/lib/email";
import { hashToken, ensureTokenHashColumns } from "@/lib/token-hashing";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";

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
    const tokenRes = await db.execute({
      sql: `SELECT pt.*, c.name, c.email, c.role, c.language
            FROM password_setup_tokens pt
            JOIN contacts c ON pt.contact_cid = c.cid
            WHERE pt.used = 0 AND pt.expires_at > NOW()
              AND (pt.token_hash = ? OR pt.token = ?)`,
      args: [tokenHash, token],
    });

    if (tokenRes.rows.length === 0) {
      // Check if token exists but expired
      const expiredRes = await db.execute({
        sql: "SELECT expires_at FROM password_setup_tokens WHERE token_hash = ? OR token = ?",
        args: [tokenHash, token],
      });

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
      await db.execute({
        sql: "UPDATE password_setup_tokens SET token_hash = ? WHERE id = ?",
        args: [tokenHash, record.id],
      }).catch(() => {});
    }

    // Audit: invitation opened
    try {
      await db.execute({
        sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, actor_id, metadata)
              VALUES (?, 'invitation_opened', 'Invitation opened', 'contacts', ?, '{}'::jsonb)`,
        args: [record.contact_cid, record.contact_cid],
      });
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
    const tokenRes = await db.execute({
      sql: `SELECT pt.*, c.email, c.name, c.role, c.language
            FROM password_setup_tokens pt
            JOIN contacts c ON pt.contact_cid = c.cid
            WHERE pt.used = 0 AND pt.expires_at > NOW()
              AND (pt.token_hash = ? OR pt.token = ?)`,
      args: [tokenHash, token],
    });

    if (tokenRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired token. Contact your administrator." },
        { status: 400 },
      );
    }

    const record = tokenRes.rows[0];

    // Lazily backfill the hash for legacy rows stored before hashing was added.
    if (!record.token_hash) {
      await db.execute({
        sql: "UPDATE password_setup_tokens SET token_hash = ? WHERE id = ?",
        args: [tokenHash, record.id],
      }).catch(() => {});
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Update contact: set password, mark as active and verified
    await db.execute({
      sql: "UPDATE contacts SET password = ?, status = 'active', activated_at = NOW() WHERE cid = ?",
      args: [hashedPassword, record.contact_cid],
    });

    // Mark token as used
    await db.execute({
      sql: "UPDATE password_setup_tokens SET used = 1 WHERE id = ?",
      args: [record.id],
    });

    // Audit: invitation activated
    try {
      await db.execute({
        sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, actor_id, metadata)
              VALUES (?, 'invitation_activated', 'Account activated', 'contacts', ?, '{}'::jsonb)`,
        args: [record.contact_cid, record.contact_cid],
      });
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

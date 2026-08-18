import db from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { v4 as uuidv4 } from "uuid";
import { sendInviteEmail } from "@/lib/email";
import { hashToken, ensureTokenHashColumns } from "@/lib/token-hashing";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export const POST = createHandler(
  { roles: ["super_admin"] },
  async (req, { params }) => {
    const { cid } = await params;

    // Self-heal the token_hash column on first use (cached once per process)
    await ensureTokenHashColumns();

    // Rate limit: max 10 resends per IP per 10 minutes
    const ipLimited = enforceRateLimit(req, `resend:ip:${getClientIp(req)}`, {
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });
    if (ipLimited) return ipLimited;

    // Rate limit: max 5 resends per contact per hour
    const contactLimited = enforceRateLimit(req, `resend:cid:${cid}`, {
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (contactLimited) return contactLimited;

    const contactRes = await db.execute({
      sql: "SELECT cid, name, email, role FROM contacts WHERE cid = ?",
      args: [cid],
    });
    if (contactRes.rows.length === 0)
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    const contact = contactRes.rows[0];
    await db.execute({
      sql: "UPDATE password_setup_tokens SET expires_at = NOW() - INTERVAL '1 second' WHERE contact_cid = ? AND used = 0",
      args: [cid],
    });
    const token = uuidv4();
    const tokenHash = hashToken(token);
    await db.execute({
      sql: "INSERT INTO password_setup_tokens (token, token_hash, contact_cid, expires_at) VALUES (?, ?, ?, NOW() + INTERVAL '48 hours')",
      args: [token, tokenHash, cid],
    });
    sendInviteEmail({
      to: contact.email,
      name: contact.name,
      role: contact.role,
      token,
    }).catch((e) => console.error("Resend invite email failed:", e));
    return NextResponse.json({ success: true, message: "Invite resent" });
  },
);

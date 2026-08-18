import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";
import { hashToken, ensureTokenHashColumns } from "@/lib/token-hashing";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";

// POST /api/venture-invites — Super Admin generates a shareable invite link
export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    // Rate limit: 20 invite links per IP per 10 minutes
    const limited = enforceRateLimit(req, `venture-invites:ip:${getClientIp(req)}`, {
      limit: 20,
      windowMs: 10 * 60 * 1000,
    });
    if (limited) return limited;

    const body = await req.json();
    const maxUses = parseInt(body?.max_uses || 1);
    const expiresInDays = parseInt(body?.expires_in_days || 7);

    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS venture_invite_links (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        token TEXT NOT NULL UNIQUE,
        created_by TEXT REFERENCES contacts(cid),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        max_uses INTEGER NOT NULL DEFAULT 1,
        uses INTEGER NOT NULL DEFAULT 0
      )`,
    });

    // Ensure the hashed-token column exists (idempotent, cached once per process)
    await ensureTokenHashColumns();

    const token = uuidv4().replace(/-/g, "").substring(0, 16).toUpperCase();
    const expiresAt = new Date(Date.now() + expiresInDays * 86400000).toISOString();

    await db.execute({
      sql: "INSERT INTO venture_invite_links (token, token_hash, created_by, expires_at, max_uses) VALUES (?, ?, ?, ?, ?)",
      args: [token, hashToken(token), null, expiresAt, maxUses],
    });

    const reqOrigin = req.headers.get("origin");
    let appUrl = reqOrigin && reqOrigin !== "null" ? reqOrigin : (process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ""));
    if (!appUrl) {
      try {
        appUrl = new URL(req.url).origin;
      } catch {
        appUrl = "";
      }
    }
    const invitePath = `/register-venture?token=${token}`;
    return NextResponse.json({
      success: true,
      token,
      link: appUrl ? `${appUrl}${invitePath}` : invitePath,
      expires_at: expiresAt,
      max_uses: maxUses,
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";

// POST /api/venture-invites — Super Admin generates a shareable invite link
export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

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

    const token = uuidv4().replace(/-/g, "").substring(0, 16).toUpperCase();
    const expiresAt = new Date(Date.now() + expiresInDays * 86400000).toISOString();

    await db.execute({
      sql: "INSERT INTO venture_invite_links (token, created_by, expires_at, max_uses) VALUES (?, ?, ?, ?)",
      args: [token, null, expiresAt, maxUses],
    });

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (() => {
        try {
          return new URL(req.url).origin;
        } catch {
          return "";
        }
      })() ||
      "https://internal-incubation-management-tracking-system.vercel.app";
    return NextResponse.json({
      success: true,
      token,
      link: `${appUrl}/register-venture?token=${token}`,
      expires_at: expiresAt,
      max_uses: maxUses,
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

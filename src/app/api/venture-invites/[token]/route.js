import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { hashToken, ensureTokenHashColumns } from "@/lib/token-hashing";

// GET /api/venture-invites/[token] — validate a token (public)
export async function GET(req, { params }) {
  try {
    await initDb();
    await ensureTokenHashColumns();
    const { token } = await params;
    if (!token) return NextResponse.json({ success: false, error: "Token required" }, { status: 400 });

    const r = await db.execute({
      sql: "SELECT * FROM venture_invite_links WHERE token_hash = ? OR token = ?",
      args: [hashToken(token), token],
    });
    const link = r.rows?.[0];
    if (!link) return NextResponse.json({ success: false, error: "Invalid invitation link" }, { status: 404 });

    // Lazily backfill the hash for legacy rows stored before hashing was added.
    if (!link.token_hash) {
      await db.execute({
        sql: "UPDATE venture_invite_links SET token_hash = ? WHERE id = ?",
        args: [hashToken(token), link.id],
      }).catch(() => {});
    }
    if (new Date(link.expires_at) < new Date()) {
      return NextResponse.json({ success: false, error: "This invitation link has expired" }, { status: 410 });
    }
    if (link.uses >= link.max_uses) {
      return NextResponse.json({ success: false, error: "This invitation link has reached its usage limit" }, { status: 410 });
    }

    return NextResponse.json({ success: true, valid: true, max_uses: link.max_uses, uses: link.uses });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

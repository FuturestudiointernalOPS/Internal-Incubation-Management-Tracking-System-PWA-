import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";

/** POST /api/investor/watchlist — toggle add/remove */
export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "staff", "investor"]);
    if (authError) return authError;

    const session = await getSession();
    const { venture_id, personal_notes } = await req.json();
    if (!venture_id) return NextResponse.json({ success: false, error: "venture_id required" }, { status: 400 });

    const prof = await db.execute({
      sql: "SELECT id FROM investor_profiles WHERE user_id = ?",
      args: [session.cid || session.id],
    });
    if (prof.rows.length === 0) return NextResponse.json({ success: false, error: "Profile not found" }, { status: 404 });

    const investorId = prof.rows[0].id;
    const existing = await db.execute({
      sql: "SELECT id FROM investor_watchlist WHERE investor_id = ? AND venture_id = ?",
      args: [investorId, venture_id],
    });

    if (existing.rows.length > 0) {
      await db.execute({
        sql: "DELETE FROM investor_watchlist WHERE investor_id = ? AND venture_id = ?",
        args: [investorId, venture_id],
      });
      return NextResponse.json({ success: true, action: "removed" });
    }

    await db.execute({
      sql: "INSERT INTO investor_watchlist (investor_id, venture_id, personal_notes) VALUES (?, ?, ?)",
      args: [investorId, venture_id, personal_notes || null],
    });
    return NextResponse.json({ success: true, action: "added" });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

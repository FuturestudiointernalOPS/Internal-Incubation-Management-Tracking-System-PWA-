import { NextResponse } from "next/server";
import db, { initDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    await initDb();
    const authError = await requireAuth(["staff", "super_admin"]);
    if (authError) return authError; // Self-Healing: Ensure tables exist

    const result = await db.execute(`
      SELECT * FROM activity_logs
      ORDER BY timestamp DESC
      LIMIT 100
    `);

    return NextResponse.json({
      success: true,
      activity: result.rows,
    });
  } catch (err) {
    console.error("Activity API Error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["staff", "super_admin"]);
    if (authError) return authError;
    const { user, action } = await req.json();

    await db.execute({
      sql: "INSERT INTO activity_logs (user, action) VALUES (?, ?)",
      args: [user || "System", action],
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Activity Save Error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}

import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const recipientId = searchParams.get('recipient_id');

    if (!recipientId) return NextResponse.json({ success: false, error: "Recipient ID required" });

    const result = await db.execute({
      sql: "SELECT * FROM v2_notifications WHERE recipient_id = ? ORDER BY created_at DESC",
      args: [recipientId]
    });

    return NextResponse.json({ success: true, notifications: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const { id, read } = await req.json();
    await db.execute({
      sql: "UPDATE v2_notifications SET read = ? WHERE id = ?",
      args: [read ? 1 : 0, id]
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

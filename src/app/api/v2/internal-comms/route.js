import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const cid = searchParams.get('cid'); // Get messages for a specific user

    let query = "SELECT * FROM v2_messages";
    let args = [];

    if (cid) {
      query += " WHERE recipient_id = ? OR sender_id = ? OR target_type = 'all'";
      args = [cid, cid];
    }
    
    query += " ORDER BY created_at DESC";

    const res = await db.execute({ sql: query, args });
    return NextResponse.json({ success: true, messages: res.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const { sender_id, recipient_id, target_type, target_id, subject, body, priority } = await req.json();
    
    await db.execute({
      sql: "INSERT INTO v2_messages (sender_id, recipient_id, target_type, target_id, subject, body, priority) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [sender_id, recipient_id || null, target_type || 'individual', target_id || null, subject, body, priority || 'normal']
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

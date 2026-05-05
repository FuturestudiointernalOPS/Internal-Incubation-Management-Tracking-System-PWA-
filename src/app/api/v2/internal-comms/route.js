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

    // ARCHITECTURE UPGRADE: Trigger Notifications on Message Transmission
    if (recipient_id) {
       await db.execute({
          sql: "INSERT INTO v2_notifications (recipient_id, title, message, type) VALUES (?, ?, ?, ?)",
          args: [recipient_id, subject, body.substring(0, 50) + (body.length > 50 ? '...' : ''), 'message']
       });
    } else if (target_type === 'staff') {
       // Notify all staff
       const staff = await db.execute("SELECT cid FROM contacts WHERE role IN ('Program Manager', 'Teacher', 'Super Admin')");
       for (const s of staff.rows) {
          if (s.cid === sender_id) continue;
          await db.execute({
             sql: "INSERT INTO v2_notifications (recipient_id, title, message, type) VALUES (?, ?, ?, ?)",
             args: [s.cid, subject, body.substring(0, 50) + (body.length > 50 ? '...' : ''), 'message']
          });
       }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

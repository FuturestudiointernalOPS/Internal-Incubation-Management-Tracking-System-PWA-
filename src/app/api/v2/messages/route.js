import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    await initDb();
    const { program_id, sender_id, recipient_id, subject, body } = await req.json();

    const result = await db.execute({
      sql: `INSERT INTO v2_messages (program_id, sender_id, recipient_id, subject, body) 
            VALUES (?, ?, ?, ?, ?) RETURNING *`,
      args: [program_id, sender_id, recipient_id, subject, body]
    });

    // NOTIFICATION BRIDGE
    // If recipient_id is 'all', notify all participants in program
    let emails = [];
    if (recipient_id === 'all') {
       const res = await db.execute({
         sql: "SELECT email FROM v2_participants WHERE program_id = ?",
         args: [program_id]
       });
       emails = res.rows.map(r => r.email);
    } else {
       emails = [recipient_id];
    }

    // In a real email setup, we would trigger SMTP here.
    // For now, we create internal notifications.
    for (const email of emails) {
       await db.execute({
         sql: "INSERT INTO v2_notifications (recipient_id, title, message, type) VALUES (?, ?, ?, 'message')",
         args: [email, subject || "New Message from PM", body]
       });
    }

    return NextResponse.json({ success: true, message: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

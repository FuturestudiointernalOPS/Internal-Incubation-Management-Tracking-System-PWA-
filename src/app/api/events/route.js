import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const programId = searchParams.get('program_id');

    let sql = "SELECT * FROM v2_events";
    let args = [];

    if (programId) {
      sql += " WHERE program_id = ?";
      args.push(programId);
    }

    const result = await db.execute({ sql, args });
    return NextResponse.json({ success: true, events: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const { program_id, team_id, title, description, event_type, start_time, location, created_by } = await req.json();

    const result = await db.execute({
      sql: `INSERT INTO v2_events (program_id, team_id, title, description, event_type, start_time, location, created_by) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      args: [program_id, team_id || null, title, description, event_type, start_time, location, created_by]
    });

    const newEvent = result.rows[0];

    // AUTO-NOTIFICATION LOGIC: Notify all related participants
    let participantsSql = "SELECT email FROM v2_participants WHERE program_id = ?";
    let parArgs = [program_id];
    if (team_id) {
       // If specific team event (Future proofing if participants are linked to teams)
       // For now, notifying all in program as per request "everybody in a group or every participant... will receive"
    }

    const participants = await db.execute({ sql: participantsSql, args: parArgs });
    
    for (const p of participants.rows) {
       await db.execute({
         sql: "INSERT INTO v2_notifications (recipient_id, title, message, type) VALUES (?, ?, ?, 'event')",
         args: [p.email, `New Event: ${title}`, `A new ${event_type} has been scheduled for ${new Date(start_time).toLocaleString()}.`]
       });
    }

    return NextResponse.json({ success: true, event: newEvent });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

import db from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";

export const GET = createHandler(
  { roles: ["staff", "super_admin"] },
  async (req) => {
    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("program_id");

    let sql = "SELECT * FROM v2_events";
    let args = [];

    if (programId) {
      sql += " WHERE program_id = ?";
      args.push(programId);
    }

    const result = await db.execute({ sql, args });
    return NextResponse.json({ success: true, events: result.rows });
  },
);

export const POST = createHandler(
  { roles: ["staff", "super_admin", "program_manager"] },
  async (req) => {
    const {
      program_id,
      participant_id,
      title,
      description,
      event_type,
      start_time,
      end_time,
      location,
      created_by,
    } = await req.json();

    const result = await db.execute({
      sql: `INSERT INTO v2_events (program_id, title, description, event_type, start_time, end_time, location, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      args: [
        program_id,
        title,
        description,
        event_type || "meeting",
        start_time,
        end_time || null,
        location || null,
        created_by,
      ],
    });

    const newEvent = result.rows[0];

    // Notify participant if participant_id provided
    if (participant_id) {
      try {
        const notifTitle = `Meeting Scheduled: ${title}`;
        const notifMessage = `Your PM has scheduled a review meeting on ${new Date(start_time).toLocaleDateString()} at ${new Date(start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.${location ? ` Location: ${location}` : ""}`;
        await db.execute({
          sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at)
                VALUES (?, ?, ?, 'event', 0, NOW())`,
          args: [participant_id, notifTitle, notifMessage],
        });
      } catch (_) {}
    }

    return NextResponse.json({ success: true, event: newEvent });
  },
);

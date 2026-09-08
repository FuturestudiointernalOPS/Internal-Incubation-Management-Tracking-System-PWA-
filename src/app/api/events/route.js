import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { insertEvent, insertEventNotification, listEvents } from "@/models/communications";

export const GET = createHandler(
  { roles: ["staff", "super_admin"] },
  async (req) => {
    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("program_id");

    const result = await listEvents({ programId });
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

    const result = await insertEvent({
      programId: program_id,
      title,
      description,
      eventType: event_type,
      startTime: start_time,
      endTime: end_time,
      location,
      createdBy: created_by,
    });

    const newEvent = result.rows[0];

    // Notify participant if participant_id provided
    if (participant_id) {
      try {
        const notifTitle = `Meeting Scheduled: ${title}`;
        const notifMessage = `Your PM has scheduled a review meeting on ${new Date(start_time).toLocaleDateString()} at ${new Date(start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.${location ? ` Location: ${location}` : ""}`;
        await insertEventNotification(participant_id, notifTitle, notifMessage);
      } catch (_) {}
    }

    return NextResponse.json({ success: true, event: newEvent });
  },
);

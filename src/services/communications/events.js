/**
 * EVENTS — the calendar-event use-cases.
 *
 * Creating an event notifies the named participant with a composed,
 * human-readable date / location message. The notification is non-blocking.
 *
 * Reads and writes go through `@/models/communications`; nothing here runs SQL.
 *
 * See docs/LAYER_SPLIT.md.
 */

import { insertEvent, insertEventNotification } from "@/models/communications";

/** Create an event and (optionally) notify its participant; returns the row. */
export async function createEvent({ payload }) {
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
  } = payload || {};

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
      const notificationTitle = `Meeting Scheduled: ${title}`;
      const notificationMessage = `Your PM has scheduled a review meeting on ${new Date(start_time).toLocaleDateString()} at ${new Date(start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.${location ? ` Location: ${location}` : ""}`;
      await insertEventNotification(participant_id, notificationTitle, notificationMessage);
    } catch (_) {}
  }

  return newEvent;
}

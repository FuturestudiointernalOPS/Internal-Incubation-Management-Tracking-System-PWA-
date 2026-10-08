/**
 * Participant service — the home dashboard's calendar + announcements shaping.
 *
 * The events of every enrolled program (sessions, requirement deadlines, program
 * events, Venture sessions), deduplicated by a stable key and sorted by date,
 * plus the announcement shape the dashboard expects. No SQL, no HTTP.
 */

/**
 * The calendar events of every enrolled program: sessions (v2), requirement
 * deadlines (marked submitted when one exists), program events (v2_events and
 * the Venture sessions of the Ventures the person belongs to). Deduplicated by
 * stable event key and sorted by date.
 */
export function buildCalendarEvents({ programsData, events = [], ventureSessions = [] }) {
  const calendarEvents = [];
  const seenEventKeys = new Set();

  for (const program of programsData) {
    for (const session of program.sessions || []) {
      const sessionDate = session.start_at || session.scheduled_date;
      if (!sessionDate) continue;
      const dateStr = new Date(sessionDate).toISOString().split("T")[0];
      const eventKey = `session-${session.id}`;
      if (seenEventKeys.has(eventKey)) continue;
      seenEventKeys.add(eventKey);
      calendarEvents.push({
        id: eventKey,
        title: session.title,
        date: dateStr,
        time: session.start_time || null,
        type: "session",
        source: "v2_sessions",
        relatedId: session.id,
        programId: program.id,
        description: program.name,
      });
    }

    for (const deliverable of program.deliverables || []) {
      if (deliverable.title?.toLowerCase().includes("attendance")) continue;
      if (!deliverable.due_date && !deliverable.created_at) continue;
      const existingSubmission = (program.submissions || []).find(
        (submission) =>
          String(submission.document_id) === String(deliverable.id) ||
          String(submission.deliverable_id) === String(deliverable.id),
      );
      const dueDate = new Date(deliverable.due_date || deliverable.created_at);
      const dateStr = dueDate.toISOString().split("T")[0];
      const eventKey = `deliverable-${deliverable.id}`;
      if (seenEventKeys.has(eventKey)) continue;
      seenEventKeys.add(eventKey);
      calendarEvents.push({
        id: eventKey,
        title: existingSubmission
          ? `${deliverable.title} (submitted)`
          : `${deliverable.title} (due)`,
        date: dateStr,
        time: null,
        type: existingSubmission ? "submission" : "deadline",
        source: "v2_document_requirements",
        relatedId: deliverable.id,
        programId: program.id,
        description: existingSubmission
          ? `Status: ${existingSubmission.status}`
          : program.name,
      });
    }
  }

  for (const event of events) {
    const eventDate = new Date(event.start_time);
    const dateStr = eventDate.toISOString().split("T")[0];
    const timeStr = eventDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const eventKey = `event-${event.id}`;
    if (seenEventKeys.has(eventKey)) continue;
    seenEventKeys.add(eventKey);
    calendarEvents.push({
      id: eventKey,
      title: event.title || "Meeting",
      date: dateStr,
      time: timeStr,
      type: "event",
      source: "v2_events",
      relatedId: event.id,
      programId: event.program_id,
      description: event.description || event.event_type || "Review",
    });
  }

  // Venture sessions (Vinance 3): booked sessions of the Ventures this person
  // belongs to. The source returns venture-facing sessions only — internal
  // staff sessions are never exposed to a founder.
  for (const session of ventureSessions) {
    const eventKey = `vsess-${session.id}`;
    if (seenEventKeys.has(eventKey)) continue;
    seenEventKeys.add(eventKey);
    const sessionStart = new Date(session.start_time);
    calendarEvents.push({
      id: eventKey,
      title: session.title,
      date: sessionStart.toISOString().split("T")[0],
      time: sessionStart.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      type: "venture_session",
      source: "session",
      relatedId: session.id,
      description: session.coach_name ? `Coach: ${session.coach_name}` : null,
    });
  }

  calendarEvents.sort((first, second) => first.date.localeCompare(second.date));
  return calendarEvents;
}

/** The announcements the participant sees, in the dashboard's shape. */
export function mapAnnouncements(rows = []) {
  return rows.map((notification) => ({
    id: notification.id,
    title: notification.title,
    message: notification.message,
    type: notification.type || "announcement",
    isRead: notification.is_read,
    createdAt: notification.created_at,
  }));
}
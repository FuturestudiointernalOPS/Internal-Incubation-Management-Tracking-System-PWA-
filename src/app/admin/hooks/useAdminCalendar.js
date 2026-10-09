import { useCallback, useMemo, useState } from "react";
import { buildMeetingPayload, buildTaskPayload } from "@/components/staff/calendarModel";
import { tasksToEvents, googleEventsToEvents } from "@/components/admin/dashboard-page/calendarEvents";

async function send(url, method, body) {
  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) return { ok: false, error: data.error || data.message || null };
    return { ok: true };
  } catch {
    return { ok: false, error: null };
  }
}

const currentUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

/**
 * The dashboard calendar: its feed (the tasks the widgets already read) and the
 * three things it can do — change a task's status, add a task, add a meeting.
 * Each one re-reads the widgets afterwards.
 *
 * `externalItems`: read-only entries from the user's "Future Studio" Google
 * Calendar, shown in the calendar only.
 */
const NO_EXTERNAL_ITEMS = [];

export function useAdminCalendar({ tasks, assignments, fetchWidgetData, externalItems = NO_EXTERNAL_ITEMS }) {
  const [now] = useState(() => new Date());
  const events = useMemo(
    () => [
      ...tasksToEvents([...(tasks || []), ...(assignments || [])]),
      ...googleEventsToEvents(externalItems),
    ],
    [tasks, assignments, externalItems],
  );
  const onRangeChange = useCallback(() => {}, []);

  const onSetStatus = useCallback(
    async (item, status) => {
      const result = await send("/api/tasks", "PUT", { id: item.relatedId, status });
      if (result.ok) fetchWidgetData();
      return result;
    },
    [fetchWidgetData],
  );
  const onCreateTask = useCallback(
    async (form) => {
      const user = currentUser();
      const result = await send("/api/tasks", "POST", buildTaskPayload(form, { cid: user.cid || user.id, name: user.name }, new Date()));
      if (result.ok) fetchWidgetData();
      return result;
    },
    [fetchWidgetData],
  );
  const onCreateMeeting = useCallback(
    async (form) => {
      const user = currentUser();
      const result = await send("/api/events", "POST", buildMeetingPayload(form, { cid: user.cid || user.id }));
      if (result.ok) fetchWidgetData();
      return result;
    },
    [fetchWidgetData],
  );

  return { now, events, onRangeChange, onSetStatus, onCreateTask, onCreateMeeting };
}

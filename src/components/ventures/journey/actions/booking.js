/**
 * Sessions and their notes
 *
 * Opening the booking dialog, booking it through the venture sessions
 * API, and saving a facilitator note on a past session.
 *
 * Cut out of src/components/ventures/JourneyManagerPanel.js as-is: no state of
 * its own, no reads. The panel keeps every state value and every read, and hands
 * this factory what it reads through `values` — plus what the factories above
 * it return. The names it need are listed in the signature — nothing else.
 */

import {
  minSessionStartInput,
  isValidSessionStart,
  toDateInput,
  toTimeInput,
} from "@/lib/ventureSessionRules";

export function sessionBooking({
  setBookFor,
  setBookForm,
  coachOptions,
  ventureId,
  setCoachOptions,
  bookForm,
  notify,
  t,
  setBookSaving,
  refreshSessions,
  noteDraft,
  setNoteSaving,
  setNoteEditFor,
  setNoteDraft,
}) {
  const openBooking = async (milestone) => {
    setBookFor(milestone.id);
    // Prefill the earliest bookable slot (30 minutes from now) — never an empty picker.
    // One instant drives both the floor and the prefill, so the prefilled slot is always valid.
    const min = minSessionStartInput();
    setBookForm({ date: toDateInput(min), time: toTimeInput(min), min_time: toTimeInput(min), duration: "45", coach_id: "", title: milestone.title || "", deliverable_id: "", note: "", files: [] });
    if (coachOptions.length === 0) {
      try {
        const res = await fetch(`/api/ventures/${ventureId}/coaches`);
        const payload = await res.json();
        if (payload.success) setCoachOptions(payload.coaches || []);
      } catch (_) {}
    }
  };

  const bookSession = async (event, stage, milestone) => {
    event.preventDefault();
    if (!bookForm.date || !bookForm.time) return;
    // A session always carries its internal note — the record of why it exists.
    if (!bookForm.note.trim()) {
      notify(t("venture.manager.memoRequired"), "error");
      return;
    }
    // One instant for the whole submit: the guard, the end-time maths and the payload.
    const start = new Date(`${bookForm.date}T${bookForm.time}:00`);
    if (!isValidSessionStart(start)) {
      const next = minSessionStartInput();
      setBookForm((prev) => ({ ...prev, date: toDateInput(next), time: toTimeInput(next), min_time: toTimeInput(next) }));
      notify(t("venture.manager.sessionTooSoon"), "error");
      return;
    }
    setBookSaving(true);
    try {
      // Attach the documents first: each file goes to the Venture's session
      // material route (private bucket) and only its path is stored, so the
      // booking carries the deck the participants are meant to read.
      const materials = [];
      for (const file of bookForm.files || []) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("milestone_id", String(milestone.id));
        const uploadResponse = await fetch(`/api/ventures/${ventureId}/sessions/upload`, { method: "POST", body: formData });
        const uploadPayload = await uploadResponse.json().catch(() => ({}));
        if (!uploadPayload.success) {
          notify(uploadPayload.error || t("venture.manager.actionFailed"), "error");
          return;
        }
        materials.push({ path: uploadPayload.path, name: uploadPayload.name, size: uploadPayload.size });
      }
      const minutes = Number(bookForm.duration) || 45;
      const end = new Date(start.getTime() + minutes * 60000);
      const coach = coachOptions.find((option) => String(option.coach_id) === String(bookForm.coach_id));
      const res = await fetch(`/api/ventures/${ventureId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_session",
          title: bookForm.title || milestone.title,
          description: bookForm.note.trim(),
          session_type: "coaching",
          coach_id: bookForm.coach_id || null,
          coach_name: coach?.full_name || null,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          // The Venture is meant to see this session and be notified of it.
          venture_facing: true,
          journey_stage_id: stage.id,
          milestone_ref: String(milestone.id),
          deliverable_id: bookForm.deliverable_id || null,
          materials,
        }),
      });
      const payload = await res.json();
      if (payload.success) {
        notify(t("venture.manager.sessionBooked"));
        setBookFor(null);
        // Surface the new session inside its milestone right away.
        refreshSessions();
      } else {
        notify(payload.error || t("venture.manager.actionFailed"), "error");
      }
    } catch (_) {
      notify(t("venture.manager.actionFailed"), "error");
    } finally {
      setBookSaving(false);
    }
  };

  const SESSION_STATUSES = ["scheduled", "confirmed", "in_progress", "completed", "cancelled", "rescheduled", "no_show"];
  const sessionStatusKey = (status) => `venture.manager.sessionStatuses.${SESSION_STATUSES.includes(status) ? status : "scheduled"}`;

  /** Save the session's single note. The server rewrites the SAME record the
   *  session was booked with — it never files a second note. */
  const saveSessionNote = async (sessionId) => {
    const note = noteDraft.trim();
    if (!note) return;
    setNoteSaving(true);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_session_note", session_id: sessionId, note }),
      });
      const payload = await res.json();
      if (payload.success) {
        notify(t("venture.manager.memoSaved"));
        setNoteEditFor(null);
        setNoteDraft("");
        refreshSessions();
      } else {
        notify(payload.error || t("venture.manager.actionFailed"), "error");
      }
    } catch (_) {
      notify(t("venture.manager.actionFailed"), "error");
    } finally {
      setNoteSaving(false);
    }
  };

  return {
    openBooking,
    bookSession,
    SESSION_STATUSES,
    sessionStatusKey,
    saveSessionNote,
  };
}

"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { EventFormModal } from "@/components/shared/calendar/CalendarModals";
import { dateKey, parseKey, validateForm } from "@/components/shared/calendar/calendarModel";
import { notify } from "@/components/shared/notify";

function blankForm(now, type) {
  return {
    type: type || "task",
    title: "",
    date: dateKey(now),
    start: "09:00",
    end: "10:00",
    status: "pending",
    place: "",
    error: "",
    busy: false,
  };
}

/**
 * The "new task / meeting" form, opened from the hero, the Tasks fold and the
 * Meetings fold. Each request carries its own id: one not answered yet opens
 * the form (decided while rendering, so no effect copies a prop into state).
 * The writes belong to the screen (`onCreateTask`, `onCreateMeeting`).
 */
export default function QuickCreateModal({ request, now, onCreateTask, onCreateMeeting }) {
  const { t, lang } = useI18n();
  const [form, setForm] = useState(null);
  const [answered, setAnswered] = useState(null);

  if (request && request.id !== answered) {
    setAnswered(request.id);
    setForm(blankForm(now, request.type));
  }

  const patchForm = (patch) => setForm((previous) => ({ ...previous, ...patch, error: "" }));
  const statusLabel = (value) => t(`staffMisc.front.status.${value}`);

  const submitForm = async (event) => {
    event.preventDefault();
    const problem = validateForm(form);
    if (problem) {
      setForm({ ...form, error: t(`staffMisc.front.calendar.error.${problem}`) });
      return;
    }
    setForm({ ...form, busy: true, error: "" });
    const result = form.type === "meeting" ? await onCreateMeeting(form) : await onCreateTask(form);
    if (!result?.ok) {
      setForm({ ...form, busy: false, error: result?.error || t("staffMisc.front.calendar.error.save") });
      return;
    }
    const date = parseKey(form.date).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", { day: "numeric", month: "long" });
    const type = form.type;
    setForm(null);
    notify("success", t(type === "meeting" ? "staffMisc.front.calendar.meetingAdded" : "staffMisc.front.calendar.taskAdded", { date }));
  };

  return <EventFormModal form={form} setForm={setForm} patchForm={patchForm} submitForm={submitForm} statusLabel={statusLabel} />;
}

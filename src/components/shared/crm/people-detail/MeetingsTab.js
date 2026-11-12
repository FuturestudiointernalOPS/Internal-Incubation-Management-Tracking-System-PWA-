"use client";

import { Plus } from "lucide-react";
import { formatLocaleDate } from "@/lib/constants";

/**
 * Meetings tab — the record-meeting form and the meeting timeline. The form
 * fields and the save handler are owned by the page.
 */
export default function MeetingsTab({
  showMeeting,
  onToggleForm,
  meetingDate,
  onMeetingDateChange,
  meetingSummary,
  onMeetingSummaryChange,
  meetingAttendees,
  onMeetingAttendeesChange,
  meetingOutcome,
  onMeetingOutcomeChange,
  savingMeeting,
  onAddMeeting,
  events,
  t,
  lang,
}) {
  return (
    <div className="space-y-4">
      {!showMeeting ? (
        <button
          onClick={() => onToggleForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[var(--brand-orange)] text-black font-bold text-sm uppercase rounded-xl"
        >
          <Plus className="w-3.5 h-3.5" /> {t("crm.people.recordMeeting")}
        </button>
      ) : (
        <div className="bg-primary border border-[var(--border-primary)] rounded-2xl p-5 space-y-3">
          <input
            type="date"
            value={meetingDate}
            onChange={event => onMeetingDateChange(event.target.value)}
            className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--brand-orange)]"
          />
          <input
            type="text"
            placeholder={t("crm.people.meetingSummaryPlaceholder")}
            value={meetingSummary}
            onChange={event => onMeetingSummaryChange(event.target.value)}
            className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--brand-orange)]"
          />
          <input
            type="text"
            placeholder={t("crm.people.meetingAttendeesPlaceholder")}
            value={meetingAttendees}
            onChange={event => onMeetingAttendeesChange(event.target.value)}
            className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--brand-orange)]"
          />
          <textarea
            placeholder={t("crm.people.meetingOutcomePlaceholder")}
            value={meetingOutcome}
            onChange={event => onMeetingOutcomeChange(event.target.value)}
            rows={2}
            className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--brand-orange)]"
          />
          <div className="flex gap-2">
            <button
              onClick={onAddMeeting}
              disabled={savingMeeting || !meetingSummary.trim()}
              className="px-4 py-2 bg-[var(--brand-orange)] text-black font-bold text-sm uppercase rounded-xl disabled:opacity-50"
            >
              {savingMeeting ? t("crm.people.saving") : t("crm.people.saveMeeting")}
            </button>
            <button onClick={() => onToggleForm(false)} className="px-4 py-2 bg-tertiary font-bold text-sm uppercase rounded-xl">
              {t("crm.people.cancel")}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {events.filter(event => event.event_type === "meeting_held").map(meetingEvent => (
          <div key={meetingEvent.id} className="bg-primary border border-[var(--border-primary)] rounded-xl p-3">
            <p className="text-sm font-bold">{meetingEvent.description}</p>
            {meetingEvent.metadata && (
              <div className="text-[10px] text-[var(--text-secondary)] mt-1 space-y-0.5">
                {meetingEvent.metadata.date && <p>{t("crm.people.metaDate")} {meetingEvent.metadata.date}</p>}
                {meetingEvent.metadata.attendees && <p>{t("crm.people.metaAttendees")} {meetingEvent.metadata.attendees}</p>}
                {meetingEvent.metadata.outcome && <p>{t("crm.people.metaOutcome")} {meetingEvent.metadata.outcome}</p>}
              </div>
            )}
            <p className="text-[10px] text-[var(--text-secondary)] mt-1">
              {formatLocaleDate(meetingEvent.created_at, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }, lang)}
            </p>
          </div>
        ))}
        {events.filter(event => event.event_type === "meeting_held").length === 0 && (
          <p className="text-sm text-[var(--text-secondary)] py-4">{t("crm.people.noMeetings")}</p>
        )}
      </div>
    </div>
  );
}

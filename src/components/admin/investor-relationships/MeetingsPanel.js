"use client";

import { Calendar, Plus, CheckCircle2, MapPin } from "lucide-react";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import { useI18n } from "@/lib/i18n";
import { MEETING_TYPES, MEETING_ICONS } from "./constants";

/**
 * The Meetings tab: the meetings list with its complete action, and the
 * activity timeline beside it.
 * Extracted verbatim from AdminRelationshipsPage.
 */
export default function MeetingsPanel({ meetings, timeline, onCreateMeeting, onCompleteMeeting }) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Meetings */}
      <div className="lg:col-span-2 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-[var(--text-primary)] uppercase">{t("investorAdmin.relationships.meetings")} ({meetings.length})</h3>
          <AppButton variant="primary" size="sm" icon={Plus} onClick={onCreateMeeting}>
            {t("investorAdmin.relationships.scheduleMeeting")}
          </AppButton>
        </div>
        {meetings.length === 0 ? (
          <p className="text-xs text-[var(--text-tertiary)] py-8 text-center">{t("investorAdmin.relationships.noMeetingsScheduled")}</p>
        ) : (
          <div className="space-y-2">
            {meetings.map(meeting => {
              const MIcon = MEETING_ICONS[meeting.meeting_type] || Calendar;
              return (
                <AppCard key={meeting.id} padding="md">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-xl ${meeting.status === "completed" ? "bg-emerald-500/10" : meeting.status === "cancelled" ? "bg-rose-500/10" : "bg-brand-orange/10"}`}>
                        <MIcon className={`w-4 h-4 ${meeting.status === "completed" ? "text-emerald-400" : meeting.status === "cancelled" ? "text-rose-400" : "text-[var(--brand-orange)]"}`} />
                      </div>
                      <div>
                        <p className="text-xs font-black text-[var(--text-primary)]">
                          {t(MEETING_TYPES.find(meetingType => meetingType.value === meeting.meeting_type)?.label) || meeting.meeting_type}
                        </p>
                        <p className="text-[10px] text-[var(--text-secondary)]">
                          {meeting.scheduled_date ? new Date(meeting.scheduled_date).toLocaleDateString() : t("investorAdmin.relationships.tbd")}
                          {meeting.scheduled_time ? t("investorAdmin.relationships.atTime", { time: meeting.scheduled_time }) : ""}
                          {meeting.duration_minutes ? t("investorAdmin.relationships.durationSuffix", { minutes: meeting.duration_minutes }) : ""}
                        </p>
                        {meeting.location && (
                          <p className="text-[10px] text-[var(--text-tertiary)] flex items-center gap-1 mt-0.5">
                            <MapPin className="w-2.5 h-2.5" /> {meeting.location}
                          </p>
                        )}
                        {meeting.notes && <p className="text-[10px] text-[var(--text-secondary)] mt-1">{meeting.notes}</p>}
                        {meeting.outcome && (
                          <div className="mt-2 p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                            <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wide">{t("investorAdmin.relationships.outcome")}</p>
                            <p className="text-[10px] text-[var(--text-primary)] mt-0.5">{meeting.outcome}</p>
                          </div>
                        )}
                        {meeting.action_items && (() => {
                          try {
                            const items = typeof meeting.action_items === "string" ? JSON.parse(meeting.action_items) : meeting.action_items;
                            if (!Array.isArray(items) || items.length === 0) return null;
                            return (
                              <div className="mt-2 space-y-1">
                                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{t("investorAdmin.relationships.actionItems")}</p>
                                {items.map((item, i) => (
                                  <p key={i} className="text-[10px] text-[var(--text-primary)] flex items-center gap-1">
                                    <span className="w-1 h-1 rounded-full bg-[var(--brand-orange)]" /> {item}
                                  </p>
                                ))}
                              </div>
                            );
                          } catch (_) { return null; }
                        })()}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        meeting.status === "scheduled" ? "bg-amber-500/10 text-amber-400" :
                        meeting.status === "completed" ? "bg-emerald-500/10 text-emerald-400" :
                        "bg-rose-500/10 text-rose-400"
                      }`}>{meeting.status}</span>
                      {meeting.status === "scheduled" && (
                        <AppButton variant="secondary" size="sm" icon={CheckCircle2}
                          onClick={() => onCompleteMeeting(meeting)}>
                          {t("investorAdmin.relationships.complete")}
                        </AppButton>
                      )}
                    </div>
                  </div>
                </AppCard>
              );
            })}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="space-y-3">
        <h3 className="text-sm font-black text-[var(--text-primary)] uppercase">{t("investorAdmin.relationships.timeline")}</h3>
        {timeline.length === 0 ? (
          <p className="text-xs text-[var(--text-tertiary)] py-8 text-center">{t("investorAdmin.relationships.noActivityYet")}</p>
        ) : (
          <div className="space-y-1 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-[var(--border-primary)]">
            {timeline.map(ev => (
              <div key={ev.id} className="relative pl-8 py-2">
                <div className="absolute left-2 top-3 w-2 h-2 rounded-full bg-[var(--brand-orange)]" />
                <p className="text-[10px] font-bold text-[var(--text-primary)]">{ev.description}</p>
                <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                  {new Date(ev.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

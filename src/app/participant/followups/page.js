"use client";

import { Calendar, Clock, ExternalLink, Video, MessageSquare } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";

// Module scope on purpose: the hook keys its internal callback on this function,
// so an inline arrow would give it a new identity on every render and refetch in
// a loop.
const pickFollowups = (payload) => (payload?.success ? payload.followups || [] : []);

export default function ParticipantFollowupsPage() {
  const { t } = useI18n();
  // The loader's work — painting from the cache first, discarding a stale
  // response, and the background refresh — belongs to the hook, so this screen
  // keeps no data state of its own and never sets state from an effect.
  // Not gated on the cached user: /api/participant/followups resolves the
  // participant from the session, so an empty or evicted cache must not block
  // the load and leave the page on its spinner forever.
  const { data: followups, loading } = useApi("/api/participant/followups", {
    defaultValue: [],
    transform: pickFollowups,
  });

  const statusStyles = {
    scheduled: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    cancelled: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  };

  return (
    <>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[var(--brand-orange)]" />
          <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
            {t("participantMisc.followups.title")}
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-5 h-5 border-2 border-t-[var(--brand-orange)] rounded-full animate-spin"
              style={{ borderColor: "rgba(255,102,0,0.1)", borderTopColor: "var(--brand-orange)" }}
            />
          </div>
        ) : followups.length === 0 ? (
          <div className="text-center py-16">
            <Calendar className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-3" />
            <p className="text-[11px] font-bold text-[var(--text-secondary)]">
              {t("participantMisc.followups.empty")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {followups.map((followup) => (
              <div
                key={followup.id}
                className="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[12px] font-bold text-[var(--text-primary)]">
                      {followup.comment || t("participantMisc.followups.followUpMeeting")}
                    </p>
                    <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                      {followup.program_name || ""}
                      {followup.deliverable_title ? ` · ${followup.deliverable_title}` : ""}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${statusStyles[followup.status] || statusStyles.scheduled}`}>
                    {followup.status || t("participantMisc.followups.statusScheduled")}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-[10px] font-medium text-[var(--text-tertiary)]">
                  {followup.scheduled_at && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      {new Date(followup.scheduled_at).toLocaleDateString()} {" "}
                      {new Date(followup.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  )}
                  {followup.duration_minutes && (
                    <span>{t("participantMisc.followups.duration", { minutes: followup.duration_minutes })}</span>
                  )}
                </div>

                {followup.meeting_link && (
                  <a
                    href={followup.meeting_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-orange/10 border border-brand-orange/20 text-[10px] font-bold uppercase tracking-wide text-[var(--brand-orange)] hover:brightness-110 transition-all"
                  >
                    <Video className="w-3 h-3" />
                    {t("participantMisc.followups.joinMeeting")}
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}

                {followup.notes && (
                  <div className="p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/10">
                    <div className="flex items-center gap-1.5 mb-1">
                      <MessageSquare className="w-3 h-3 text-blue-400" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">{t("participantMisc.followups.notes")}</span>
                    </div>
                    <p className="text-[10px] text-[var(--text-primary)]">{followup.notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

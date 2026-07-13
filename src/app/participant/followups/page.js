"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Calendar, Clock, ExternalLink, RefreshCw, Video, MessageSquare, CheckCircle2, XCircle } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useI18n } from "@/lib/i18n";

export default function ParticipantFollowupsPage() {
  const [user, setUser] = useState({});
  const [followups, setFollowups] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(stored);
  }, []);

  const fetchFollowups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/participant/followups");
      const data = await res.json();
      if (data.success) {
        setFollowups(data.followups || []);
      }
    } catch (e) {
      console.error("Failed to load follow-ups", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user.cid || user.id) fetchFollowups();
  }, [user, fetchFollowups]);

  const statusStyles = {
    scheduled: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    cancelled: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  };

  return (
    <DashboardLayout role={user.role || "participant"}>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[var(--brand-orange)]" />
          <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
            {t("participant.followUpMeeting") || "Follow-up Meetings"}
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
              No follow-up meetings scheduled
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {followups.map((f) => (
              <div
                key={f.id}
                className="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[12px] font-bold text-[var(--text-primary)]">
                      {f.comment || "Follow-up Meeting"}
                    </p>
                    <p className="text-[9px] text-[var(--text-secondary)] mt-0.5">
                      {f.program_name || ""}
                      {f.deliverable_title ? ` · ${f.deliverable_title}` : ""}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-wider border ${statusStyles[f.status] || statusStyles.scheduled}`}>
                    {f.status || "scheduled"}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-[9px] text-[var(--text-tertiary)]">
                  {f.scheduled_at && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      {new Date(f.scheduled_at).toLocaleDateString()} {" "}
                      {new Date(f.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  )}
                  {f.duration_minutes && (
                    <span>{f.duration_minutes} min</span>
                  )}
                </div>

                {f.meeting_link && (
                  <a
                    href={f.meeting_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--brand-orange)]/10 border border-[var(--brand-orange)]/20 text-[9px] font-bold text-[var(--brand-orange)] hover:brightness-110 transition-all"
                  >
                    <Video className="w-3 h-3" />
                    Join Meeting
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}

                {f.notes && (
                  <div className="p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/10">
                    <div className="flex items-center gap-1.5 mb-1">
                      <MessageSquare className="w-3 h-3 text-blue-400" />
                      <span className="text-[7px] font-black text-blue-400 uppercase tracking-widest">Notes</span>
                    </div>
                    <p className="text-[9px] text-[var(--text-primary)]">{f.notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useI18n } from "@/lib/i18n";
import { Clock, Loader2 } from "lucide-react";

/**
 * PARTICIPANT TIMELINE — the user's own general activity log
 * (contact_timeline). Program enrollment is NOT required.
 */
export default function ParticipantTimelinePage() {
  const { t } = useI18n();
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(u);
    if (u.cid) {
      fetch("/api/participant/timeline?limit=100")
        .then((r) => r.json())
        .then((d) => setEvents(d.success ? d.events || [] : []))
        .catch(() => setEvents([]))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const fmt = (d) => (d ? new Date(d).toLocaleDateString() : "");

  return (
    <DashboardLayout role={user?.role || "participant"} activeTab="timeline">
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tight">
          {t("participant.activityTimeline")}
        </h1>

        <div className="mt-6 space-y-3">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--brand-orange)]" />
            </div>
          ) : events && events.length > 0 ? (
            events.map((e) => (
              <div
                key={e.id}
                className="flex items-start gap-3 p-4 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-tertiary)]"
              >
                <Clock className="w-4 h-4 text-[var(--brand-orange)] shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-[var(--text-primary)]">
                    {e.description}
                  </p>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mt-1">
                    {(e.event_type || "").replace(/_/g, " ")} · {fmt(e.created_at)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-16">
              <p className="text-[11px] font-bold text-[var(--text-secondary)]">
                {t("participant.timelineEmpty")}
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

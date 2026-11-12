"use client";

import { Calendar } from "lucide-react";
import AppCard from "@/components/ui/AppCard";
import { useI18n } from "@/lib/i18n";

/**
 * The upcoming meetings block on the Discover tab.
 * Extracted verbatim from InvestorDashboard.
 */
export default function UpcomingMeetingsSection({ relationships }) {
  const { t } = useI18n();
  if (relationships.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-[var(--brand-orange)]" />
        <h3 className="text-[11px] font-black text-[var(--text-primary)] uppercase tracking-wider">{t("upcomingMeetings")}</h3>
      </div>
      <div className="space-y-2">
        {relationships.map(relationship => (
          <div key={relationship.id}>
            {relationship.next_meetings && Array.isArray(relationship.next_meetings) && relationship.next_meetings.length > 0 && relationship.next_meetings.map(meeting => (
                  <AppCard key={meeting.id} padding="md" className="mb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-brand-orange/10">
                          <Calendar className="w-4 h-4 text-[var(--brand-orange)]" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-[var(--text-primary)]">{relationship.venture_name} — {meeting.meeting_type?.replace(/_/g, " ") || "Meeting"}</p>
                          <p className="text-[10px] text-[var(--text-secondary)]">
                            {meeting.scheduled_date ? new Date(meeting.scheduled_date).toLocaleDateString() : "TBD"}
                            {meeting.scheduled_time ? ` at ${meeting.scheduled_time}` : ""}
                            {relationship.relationship_manager_name ? ` · ${relationship.relationship_manager_name}` : ""}
                          </p>
                        </div>
                      </div>
                    </div>
                  </AppCard>
                ))}
          </div>
        ))}
      </div>
    </div>
  );
}

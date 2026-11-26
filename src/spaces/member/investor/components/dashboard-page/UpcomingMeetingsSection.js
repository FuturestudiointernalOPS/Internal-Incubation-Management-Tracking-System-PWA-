"use client";

import { Calendar } from "lucide-react";
import AppCard from "@/components/ui/AppCard";
import { useI18n } from "@/lib/i18n";
import { InitialAvatar } from "./VentureIdentity";

/**
 * The upcoming meetings block on the Discover tab.
 */
export default function UpcomingMeetingsSection({ relationships }) {
  const { t } = useI18n();
  if (relationships.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-[var(--brand-orange)]" aria-hidden="true" />
        <h3 className="stf-k">{t("upcomingMeetings")}</h3>
      </div>
      <div className="space-y-2">
        {relationships.map(relationship => (
          <div key={relationship.id}>
            {relationship.next_meetings && Array.isArray(relationship.next_meetings) && relationship.next_meetings.length > 0 && relationship.next_meetings.map(meeting => (
                  <AppCard key={meeting.id} padding="md" className="mb-2">
                    <div className="flex items-center gap-3">
                      <InitialAvatar name={relationship.venture_name} />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-black text-[var(--text-primary)]">{relationship.venture_name} — {meeting.meeting_type?.replace(/_/g, " ") || t("member.investor.browser.meetings.untitled")}</p>
                        <p className="text-[10px] text-[var(--text-secondary)]">
                          {meeting.scheduled_date ? new Date(meeting.scheduled_date).toLocaleDateString() : t("member.investor.browser.meetings.tbd")}
                          {meeting.scheduled_time ? ` ${t("member.investor.browser.meetings.at", { time: meeting.scheduled_time })}` : ""}
                          {relationship.relationship_manager_name ? ` · ${relationship.relationship_manager_name}` : ""}
                        </p>
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

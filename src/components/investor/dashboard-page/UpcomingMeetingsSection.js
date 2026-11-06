"use client";

import { Calendar } from "lucide-react";
import AppCard from "@/components/ui/AppCard";
import AppEmptyState from "@/components/ui/AppEmptyState";
import { useI18n } from "@/lib/i18n";

/**
 * The investor's upcoming meetings and a clear empty state when none are scheduled.
 */
export default function UpcomingMeetingsSection({ relationships }) {
  const { t, lang } = useI18n();
  const meetings = relationships.flatMap((relationship) =>
    (Array.isArray(relationship.next_meetings) ? relationship.next_meetings : [])
      .map((meeting) => ({ relationship, meeting })),
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-[var(--brand-orange)]" />
        <h2 className="text-[11px] font-black text-[var(--text-primary)] uppercase tracking-wider">{t("dashboardV2.upcomingMeetings")}</h2>
      </div>
      {meetings.length === 0 ? (
        <AppEmptyState
          title={t("dashboardV2.noUpcomingMeetings")}
          description={t("dashboardV2.noUpcomingMeetingsHint")}
          icon={Calendar}
          size="sm"
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {meetings.map(({ relationship, meeting }) => (
            <AppCard key={meeting.id} padding="md">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-[var(--surface-3)] p-2">
                  <Calendar className="h-4 w-4 text-[var(--brand-orange)]" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[var(--text-primary)]">
                    {relationship.venture_name} · {meeting.meeting_type?.replace(/_/g, " ") || t("dashboardV2.meeting")}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    {meeting.scheduled_date
                      ? new Date(meeting.scheduled_date).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US")
                      : t("dashboardV2.timeToBeSet")}
                    {meeting.scheduled_time ? ` · ${meeting.scheduled_time}` : ""}
                    {relationship.relationship_manager_name ? ` · ${relationship.relationship_manager_name}` : ""}
                  </p>
                </div>
              </div>
            </AppCard>
          ))}
        </div>
      )}
    </div>
  );
}

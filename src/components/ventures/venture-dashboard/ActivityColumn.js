"use client";

import { useI18n } from "@/lib/i18n";
import { Calendar, Activity, FileText, Bell } from "lucide-react";
import { activityLabel, activityDetails, isSystemActor } from "@/lib/ventureActivity";
import WidgetCard from "./WidgetCard";

/**
 * Column 3 of the metrics row: upcoming meetings, recent activity, recent
 * documents and notifications. Extracted verbatim from VentureDashboard.
 */
export default function ActivityColumn({ data, widgetState, refreshWidget }) {
  const { t, lang } = useI18n();
  return (
    <div className="space-y-6">
      {/* 7. Upcoming Meetings */}
      <WidgetCard title={t("vadmin.dashboard.upcomingMeetings")} icon={Calendar} iconColor="bg-blue-500/10"
        loading={widgetState("meetings").loading} error={widgetState("meetings").error}
        empty={widgetState("meetings").empty} emptyMessage={t("vadmin.dashboard.noUpcomingMeetings")}
        onRefresh={() => refreshWidget("meetings")}
      >
        <div className="space-y-2">
          {(data.meetings || []).length === 0 ? (
            <div className="flex flex-col items-center py-4">
              <Calendar className="w-8 h-8 text-slate-600 mb-2" />
              <p className="text-[10px] text-[var(--text-secondary)]">{t("vadmin.dashboard.noScheduledMeetings")}</p>
            </div>
          ) : (
            (data.meetings || []).slice(0, 4).map((meeting, index) => (
              <div key={meeting.id || index} className="flex items-start gap-3 p-3 bg-tertiary rounded-xl">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  meeting.type === "coaching" ? "bg-indigo-500/10 text-indigo-400" :
                  meeting.type === "advisor" ? "bg-purple-500/10 text-purple-400" :
                  "bg-blue-500/10 text-blue-400"
                }`}>
                  <Calendar className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-[var(--text-primary)] truncate">{meeting.title}</p>
                  <p className="text-[10px] text-[var(--text-secondary)]">{meeting.date ? new Date(meeting.date).toLocaleDateString(lang) : ""}{meeting.time ? ` ${t("vadmin.dashboard.atTime", { time: meeting.time })}` : ""}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </WidgetCard>

      {/* 8. Activity */}
      <WidgetCard title={t("vadmin.dashboard.recentActivity")} icon={Activity} iconColor="bg-amber-500/10"
        loading={widgetState("recent_activity").loading} error={widgetState("recent_activity").error}
        empty={widgetState("recent_activity").empty} emptyMessage={t("vadmin.dashboard.noRecentActivity")}
        onRefresh={() => refreshWidget("recent_activity")}
      >
        <div className="space-y-1.5">
          {(data.recent_activity || []).slice(0, 5).map((activity, index) => {
            const details = activityDetails(activity.details, t);
            return (
              <div key={activity.id || index} className="flex items-start gap-3 p-2 rounded-lg hover:bg-tertiary transition-all">
                <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${
                  activity.action?.includes("APPROVED") || activity.action?.includes("CREATED") ? "bg-emerald-500/10 text-emerald-400" :
                  activity.action?.includes("REJECTED") || activity.action?.includes("REMOVED") ? "bg-rose-500/10 text-rose-400" :
                  "bg-amber-500/10 text-amber-400"
                }`}>
                  <Activity className="w-3 h-3" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-[var(--text-primary)]">{activityLabel(activity.action, t)}</p>
                  <p className="text-[10px] text-[var(--text-secondary)]">
                    {isSystemActor(activity.actor) ? "" : `${activity.actor} · `}
                    {activity.created_at ? new Date(activity.created_at).toLocaleDateString(lang) : ""}
                  </p>
                  {details.length > 0 && (
                    <p className="text-[10px] text-[var(--text-secondary)] opacity-80">{details[0]}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </WidgetCard>

      {/* 9. Documents */}
      <WidgetCard title={t("vadmin.dashboard.recentDocuments")} icon={FileText} iconColor="bg-brand-orange/10"
        loading={widgetState("documents").loading} error={widgetState("documents").error}
        empty={widgetState("documents").empty} emptyMessage={t("vadmin.dashboard.noDocumentsUploaded")}
        onRefresh={() => refreshWidget("documents")}
      >
        <div className="space-y-2">
          {(data.documents?.recent || []).length === 0 ? (
            <div className="flex flex-col items-center py-4">
              <FileText className="w-8 h-8 text-slate-600 mb-2" />
              <p className="text-[10px] text-[var(--text-secondary)]">{t("vadmin.dashboard.uploadFirstDocument")}</p>
            </div>
          ) : (
            (data.documents?.recent || []).slice(0, 4).map((doc, index) => (
              <div key={doc.id || index} className="flex items-center gap-3 p-2 bg-tertiary rounded-lg">
                <FileText className="w-4 h-4 text-[var(--brand-orange)] shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-[var(--text-primary)] truncate">{doc.file_name}</p>
                  <p className="text-[10px] text-[var(--text-secondary)]">{doc.category?.replace(/_/g, " ")} · {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString(lang) : ""}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </WidgetCard>

      {/* 10. Notifications */}
      <WidgetCard title={`${t("vadmin.dashboard.notifications")}${data.notifications?.unread > 0 ? ` (${data.notifications.unread})` : ""}`} icon={Bell} iconColor="bg-rose-500/10"
        loading={widgetState("notifications").loading} error={widgetState("notifications").error}
        empty={widgetState("notifications").empty} emptyMessage={t("vadmin.dashboard.noNotifications")}
        onRefresh={() => refreshWidget("notifications")}
      >
        <div className="space-y-1.5">
          {(data.notifications?.recent || []).slice(0, 4).map((notification, index) => (
            <div key={notification.id || index} className={`flex items-start gap-3 p-2 rounded-lg ${!notification.is_read ? "bg-rose-500/5 border border-rose-500/10" : "hover:bg-tertiary"}`}>
              <Bell className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${notification.is_read ? "text-slate-600" : "text-rose-400"}`} />
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-[var(--text-primary)] truncate">{notification.title}</p>
                <p className="text-[10px] text-[var(--text-secondary)] truncate">{notification.message}</p>
              </div>
            </div>
          ))}
        </div>
      </WidgetCard>
    </div>
  );
}

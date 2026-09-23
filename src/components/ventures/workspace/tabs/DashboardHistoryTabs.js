"use client";

import { Users, BarChart3, Clock, Bell, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useVenture } from "../VentureContext";
import { getFounderMembers, getTeamMembers } from "../ventureMeta";

/* Dashboard (Overview) Tab */
export function DashboardTab() {
  const { t } = useI18n();
  const { dashboardData, members, calendarEvents, journeyStages, cardStyle } = useVenture();

  // Overview helpers: current/next Journey milestone + upcoming Venture events.
  const journeyList = journeyStages || [];
  const activeStage = journeyList.find((stage) => stage.status === "active") || journeyList.find((stage) => stage.status !== "completed");
  const nextStage = journeyList.find((stage) => stage.status === "locked" && stage.stage_order > (activeStage?.stage_order || 0));
  const todayISO = new Date().toISOString().slice(0, 10);
  const upcomingEvents = (calendarEvents || [])
    .filter((event) => event.date && String(event.date) >= todayISO)
    .sort((eventA, eventB) => String(eventA.date).localeCompare(String(eventB.date)) || String(eventA.start_time || "").localeCompare(String(eventB.start_time || "")))
    .slice(0, 6);
  const EVENT_TYPE_KEYS = {
    milestone: "milestones", task: "tasks", action: "actionPlans",
    coaching: "coaching", followup: "followUpDate", meeting: "calendar", session: "coaching",
  };
  if (!dashboardData) return (
    <div className="space-y-4">
      <div className="text-center py-8"><Loader2 className="animate-spin mx-auto" style={{ color: "var(--text-secondary)" }} size={24} /></div>
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t("venture.founderCount"), value: dashboardData.founders?.total ?? 0, icon: Users },
          { label: t("venture.memberCount"), value: (getFounderMembers(members).length + getTeamMembers(members).length) || 0, icon: Users },
          { label: t("venture.businessStage"), value: t(`venture.stages.${dashboardData.venture?.business_stage || "idea"}`), icon: BarChart3 },
          { label: t("venture.status"), value: t(`venture.statuses.${dashboardData.venture?.status || "active"}`), icon: Clock },
        ].map((stat, index) => (
          <div key={index} className="rounded-xl p-4 border" style={cardStyle}>
            <stat.icon size={18} className="mb-2" style={{ color: "var(--brand-orange)" }} />
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Current Journey position + upcoming Venture events (overview) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl p-5 border" style={cardStyle}>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <BarChart3 size={16} style={{ color: "var(--brand-orange)" }} />
            {t("venture.journey")}
          </h3>
          {activeStage ? (
            <div className="space-y-1.5 text-sm">
              <p><span style={{ color: "var(--text-secondary)" }}>{t("venture.current")}:</span> <span className="font-semibold">{activeStage.name}</span></p>
              {nextStage && (
                <p style={{ color: "var(--text-secondary)" }}>{t("venture.next")}: {nextStage.name}</p>
              )}
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{t("venture.noJourneyYet")}</p>
          )}
        </div>
        <div className="rounded-xl p-5 border" style={cardStyle}>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Clock size={16} style={{ color: "var(--brand-orange)" }} />
            {t("venture.upcoming")}
          </h3>
          {upcomingEvents.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{t("venture.noEvents")}</p>
          ) : (
            <div className="space-y-2">
              {upcomingEvents.map((event, index) => (
                <div key={index} className="flex items-center gap-3 text-sm py-1.5 border-b last:border-0" style={{ borderColor: "rgb(255 255 255 / 0.05)" }}>
                  <div className="shrink-0 w-14 text-center">
                    <p className="text-[10px] font-black leading-tight">{event.date ? new Date(`${event.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" }) : ""}</p>
                    <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>{event.date ? new Date(`${event.date}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : ""}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{event.title}</p>
                    <p className="text-[11px] capitalize" style={{ color: "var(--text-secondary)" }}>
                      {event.start_time ? `${event.start_time} · ` : ""}{t(`venture.${EVENT_TYPE_KEYS[event.type] || "calendar"}`)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-xl p-6 border" style={cardStyle}>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Clock size={16} style={{ color: "var(--brand-orange)" }} />
          {t("venture.recentActivity")}
        </h3>
        {dashboardData.recent_activity?.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{t("venture.noRecentActivity")}</p>
        ) : dashboardData.recent_activity?.map((activity, index) => (
          <div key={activity.id || index} className="flex items-center gap-3 py-2 border-b last:border-0 text-sm" style={{ borderColor: "rgb(255 255 255 / 0.05)" }}>
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "var(--brand-orange)" }} />
            <span className="font-medium">{t(`venture.activity.${activity.action}`)}</span>
            <span style={{ color: "var(--text-secondary)" }}>• {new Date(activity.created_at).toLocaleDateString()}</span>
          </div>
        ))}
      </div>

      {/* Notifications */}
      <div className="rounded-xl p-6 border" style={cardStyle}>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Bell size={16} style={{ color: "var(--brand-orange)" }} />
          {t("venture.recentNotifications")} {dashboardData.notifications?.unread > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400">{dashboardData.notifications.unread} {t("venture.unread")}</span>}
        </h3>
        {!dashboardData.notifications?.recent?.length ? (
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{t("venture.noNotifications")}</p>
        ) : dashboardData.notifications.recent.map((notification, index) => (
          <div key={notification.id || index} className="py-2 border-b last:border-0" style={{ borderColor: "rgb(255 255 255 / 0.05)" }}>
            <div className="flex items-center gap-2">
              {!notification.is_read && <span className="w-2 h-2 rounded-full bg-blue-400" />}
              <p className="text-sm font-medium">{notification.title}</p>
            </div>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{notification.message}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{new Date(notification.created_at).toLocaleDateString()}</p>
          </div>
        ))}
      </div>

      </div>
  );
}


"use client";

import { Users, BarChart3, Clock, Bell, Activity, History, UserCheck, CheckSquare, MessageCircle, RotateCcw, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useVenture } from "../VentureContext";
import { getFounderMembers, getTeamMembers } from "../ventureMeta";

/* Dashboard (Overview) Tab */
export function DashboardTab() {
  const { t } = useI18n();
  const { dashboardData, members, progressData, calendarEvents, journeyStages, cardStyle } = useVenture();

  // Overview helpers: current/next Journey milestone + upcoming Venture events.
  const journeyList = journeyStages || [];
  const activeStage = journeyList.find((s) => s.status === "active") || journeyList.find((s) => s.status !== "completed");
  const nextStage = journeyList.find((s) => s.status === "locked" && s.stage_order > (activeStage?.stage_order || 0));
  const todayISO = new Date().toISOString().slice(0, 10);
  const upcomingEvents = (calendarEvents || [])
    .filter((e) => e.date && String(e.date) >= todayISO)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.start_time || "").localeCompare(String(b.start_time || "")))
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
        ].map((stat, i) => (
          <div key={i} className="rounded-xl p-4 border" style={cardStyle}>
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
              {upcomingEvents.map((ev, i) => (
                <div key={i} className="flex items-center gap-3 text-sm py-1.5 border-b last:border-0" style={{ borderColor: "rgb(255 255 255 / 0.05)" }}>
                  <div className="shrink-0 w-14 text-center">
                    <p className="text-[10px] font-black leading-tight">{ev.date ? new Date(`${ev.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" }) : ""}</p>
                    <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>{ev.date ? new Date(`${ev.date}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : ""}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{ev.title}</p>
                    <p className="text-[11px] capitalize" style={{ color: "var(--text-secondary)" }}>
                      {ev.start_time ? `${ev.start_time} · ` : ""}{t(`venture.${EVENT_TYPE_KEYS[ev.type] || "calendar"}`)}
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
        ) : dashboardData.recent_activity?.map((a, i) => (
          <div key={a.id || i} className="flex items-center gap-3 py-2 border-b last:border-0 text-sm" style={{ borderColor: "rgb(255 255 255 / 0.05)" }}>
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "var(--brand-orange)" }} />
            <span className="font-medium">{t(`venture.activity.${a.action}`)}</span>
            <span style={{ color: "var(--text-secondary)" }}>• {new Date(a.created_at).toLocaleDateString()}</span>
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
        ) : dashboardData.notifications.recent.map((n, i) => (
          <div key={n.id || i} className="py-2 border-b last:border-0" style={{ borderColor: "rgb(255 255 255 / 0.05)" }}>
            <div className="flex items-center gap-2">
              {!n.is_read && <span className="w-2 h-2 rounded-full bg-blue-400" />}
              <p className="text-sm font-medium">{n.title}</p>
            </div>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{n.message}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{new Date(n.created_at).toLocaleDateString()}</p>
          </div>
        ))}
      </div>

      {/* Progress Summary */}
      <div className="rounded-xl p-6 border" style={cardStyle}>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Activity size={16} style={{ color: "var(--brand-orange)" }} />
          {t("venture.progressSummary")}
        </h3>
        {progressData ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg p-3 border" style={cardStyle}>
              <p className="text-xs" style={{color:'var(--text-secondary)'}}>{t('venture.profileCompletion')||'Profile Completion'}</p>
              <p className="text-xl font-bold mt-1" style={{color:'var(--brand-orange)'}}>{progressData.profile_completion||0}%</p>
            </div>
            <div className="rounded-lg p-3 border" style={cardStyle}>
              <p className="text-xs" style={{color:'var(--text-secondary)'}}>{t('venture.taskCompletion')}</p>
              <p className="text-xl font-bold mt-1">{progressData.task_completion||0}%</p>
            </div>
            <div className="rounded-lg p-3 border" style={cardStyle}>
              <p className="text-xs" style={{color:'var(--text-secondary)'}}>{t('venture.avgMilestoneProgress')}</p>
              <p className="text-xl font-bold mt-1">{progressData.avg_milestone_progress||0}%</p>
            </div>
            <div className="rounded-lg p-3 border" style={cardStyle}>
              <p className="text-xs" style={{color:'var(--text-secondary)'}}>{t('venture.standupsCount')}</p>
              <p className="text-xl font-bold mt-1">{progressData.standups_count||0}</p>
            </div>
            <div className="rounded-lg p-3 border" style={cardStyle}>
              <p className="text-xs" style={{color:'var(--text-secondary)'}}>{t('venture.retrosCount')}</p>
              <p className="text-xl font-bold mt-1">{progressData.retros_count||0}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{t("venture.noProgressData")}</p>
        )}
      </div>
    </div>
  );
}

/* History Tab */
export function HistoryTab() {
  const { t } = useI18n();
  const { historyData, cardStyle } = useVenture();
  if (!historyData) return (
    <div className="space-y-4">
      <div className="text-center py-8"><Loader2 className="animate-spin mx-auto" style={{ color: "var(--text-secondary)" }} size={24} /></div>
    </div>
  );
  return (
    <div className="space-y-4">
      {historyData.previous_program && (
        <div className="rounded-xl p-6 border" style={cardStyle}>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <History size={16} style={{ color: "var(--brand-orange)" }} />
            {t("venture.previousProgram")}
          </h3>
          <p className="font-medium">{historyData.previous_program.name}</p>
          {historyData.previous_program.start_date && (
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {new Date(historyData.previous_program.start_date).toLocaleDateString()}
              {historyData.previous_program.end_date && ` - ${new Date(historyData.previous_program.end_date).toLocaleDateString()}`}
            </p>
          )}
          {historyData.previous_program.deliverables?.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{t("venture.deliverables")}:</p>
              <div className="flex flex-wrap gap-1">
                {historyData.previous_program.deliverables.map((d, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgb(255 255 255 / 0.1)" }}>{d}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {historyData.graduation ? (
        <div className="rounded-xl p-6 border" style={cardStyle}>
          <h3 className="font-semibold mb-2">{t("venture.graduationInfo")}</h3>
          <p className="text-sm">{new Date(historyData.graduation.graduated_at).toLocaleDateString()}</p>
          {historyData.graduation.graduation_notes && (
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{historyData.graduation.graduation_notes}</p>
          )}
        </div>
      ) : (
        <div className="rounded-xl p-6 border" style={cardStyle}>
          <h3 className="font-semibold mb-2">{t("venture.graduationInfo")}</h3>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{t("venture.notYetGraduated")}</p>
        </div>
      )}

      <div className="rounded-xl p-6 border" style={cardStyle}>
        <h3 className="font-semibold mb-3">{t("venture.founderHistory")}</h3>
        {historyData.founder_history?.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{t("venture.noFoundersYet")}</p>
        ) : historyData.founder_history?.map((fh, i) => (
          <div key={i} className="mb-4 pb-4 border-b last:border-0 last:mb-0 last:pb-0" style={{ borderColor: "rgb(255 255 255 / 0.05)" }}>
            <p className="font-medium">{fh.contact_name || fh.contact_id}</p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {t("venture.founders")} {fh.removed_at ? `(removed ${new Date(fh.removed_at).toLocaleDateString()})` : `(${t("venture.statuses.active")})`}
            </p>
            {fh.programs?.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{t("venture.programs")}:</p>
                {fh.programs.map((p, j) => (
                  <p key={j} className="text-xs pl-3" style={{ color: "var(--text-secondary)" }}>
                    • {p.program_name || `Program ${p.program_id}`} {p.joined_at && `(${new Date(p.joined_at).toLocaleDateString()})`}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* Progress Tab */
export function ProgressTab() {
  const { t } = useI18n();
  const { progressData, cardStyle } = useVenture();
  return (
    <div className="space-y-4">
      {!progressData ? (
        <div className="text-center py-8"><Loader2 className="animate-spin mx-auto" style={{ color: "var(--text-secondary)" }} size={24} /></div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: t('venture.profileCompletion'), value: `${progressData.profile_completion || 0}%`, icon: UserCheck },
            { label: t('venture.taskCompletion'), value: `${progressData.task_completion || 0}%`, icon: Activity },
            { label: t('venture.avgMilestoneProgress'), value: `${progressData.avg_milestone_progress || 0}%`, icon: CheckSquare },
            { label: t('venture.standupsCount'), value: progressData.standups_count || 0, icon: MessageCircle },
            { label: t('venture.retrosCount'), value: progressData.retros_count || 0, icon: RotateCcw },
          ].map((stat, i) => (
            <div key={i} className="rounded-xl p-4 border" style={cardStyle}>
              <stat.icon size={18} className="mb-2" style={{ color: "var(--brand-orange)" }} />
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{stat.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

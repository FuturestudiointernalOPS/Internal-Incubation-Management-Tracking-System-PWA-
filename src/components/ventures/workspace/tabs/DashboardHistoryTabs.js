"use client";

import { Users, BarChart3, Clock, CheckCircle2, Target, ListTodo, Flag } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useVenture } from "../VentureContext";
import KpiCard from "@/components/ui/KpiCard";
import DashboardWorkQueue from "./DashboardWorkQueue";
import VentureSupportCard from "@/components/ventures/support/VentureSupportCard";

/**
 * Founder dashboard — the Venture's state at a glance, and what needs doing.
 *
 * Everything here is an EXISTING reading. No percentage is recomputed on this
 * screen: the work queue comes from WS1 (`/my-work`), the progress figures from
 * `/progress`, the people and feeds from `/dashboard`, the roadmap from
 * `/journey`. The progress figures use the WS4 vocabulary: task completion and
 * Milestones Completed are counted from live work, and "Venture setup" is the
 * Venture's own record — never the retired profile-completion widget.
 *
 * Layout order is the point: identity → work queue → progress → journey and
 * events → activity and notifications. The action queue is second because that
 * is what a founder opens the dashboard to find.
 */
export function DashboardTab({ onSection }) {
  const { t } = useI18n();
  const {
    dashboardData,
    dashboardLoading,
    journeyStages,
    progressData,
    progressLoading,
    progressFailed,
    myWork,
    myWorkLoading,
    myWorkFailed,
    fetchMyWork,
    params,
  } = useVenture();

  // Overview helpers: current/next Journey stage.
  const journeyList = journeyStages || [];
  const activeStage =
    journeyList.find((stage) => stage.status === "active") ||
    journeyList.find((stage) => stage.status !== "completed");
  const nextStage = journeyList.find(
    (stage) => stage.status === "upcoming" && stage.stage_order > (activeStage?.stage_order || 0),
  );

  // The Founders tile read `dashboardData.founders`, a key the dashboard
  // aggregate never returned — so it was 0 for every Venture. The people are
  // counted in ONE place (`team`), and that is what is read now.
  const team = dashboardData?.team || null;
  const ventureInfo = dashboardData?.venture || null;

  // Sealed-aware: WS1 already withholds unreleased planning from a member, so
  // the dashboard never re-derives the next milestone from the roadmap.
  const nextMilestone = myWork?.venture?.next_milestone || null;

  // Personal and venture-wide are disjoint by construction (WS1 partitions the
  // queue), so the sum is a real count of distinct open records.
  const openWork = myWork
    ? (myWork.personal?.counts?.total_open || 0) + (myWork.venture?.counts?.total_open || 0)
    : null;

  const progressValue = (value) => (progressFailed ? "—" : `${Number(value) || 0}%`);

  // A read that has not answered yet is "loading"; one that answered nothing is
  // "—". Neither is zero, and neither is an empty section.
  const overviewPending = dashboardLoading && !dashboardData;
  const milestonePending = progressLoading && !progressData;

  return (
    <div className="space-y-4">
      {/* ── Venture overview ─────────────────────────────────────────────── */}
      <div className="stf-grid c4">
        <KpiCard
          label={t("venture.founderCount")}
          value={team ? team.founders ?? 0 : "—"}
          icon={Users}
          loading={overviewPending}
        />
        <KpiCard
          label={t("venture.team")}
          value={team ? team.team ?? 0 : "—"}
          icon={Users}
          loading={overviewPending}
        />
        <KpiCard
          label={t("venture.businessStage")}
          value={
            ventureInfo
              ? t(`venture.stages.${ventureInfo.business_stage || "idea"}`)
              : "—"
          }
          icon={BarChart3}
          loading={overviewPending}
        />
        <KpiCard
          label={t("venture.status")}
          value={ventureInfo ? t(`venture.statuses.${ventureInfo.status || "active"}`) : "—"}
          icon={Clock}
          loading={overviewPending}
        />
      </div>

      {/* ── Progress overview ────────────────────────────────────────────── */}
      <div className="stf-grid c4">
        <KpiCard
          label={t("venture.progressOverview.ventureSetup")}
          value={progressValue(progressData?.venture_setup)}
          hint={t("venture.progressOverview.ventureSetupHint")}
          icon={Target}
          loading={milestonePending}
          onClick={onSection ? () => onSection("profile") : undefined}
        />
        <KpiCard
          label={t("venture.taskCompletion")}
          value={progressValue(progressData?.task_completion)}
          hint={
            progressData
              ? t("venture.progressOverview.doneOf", {
                  done: progressData.completed_tasks ?? 0,
                  total: progressData.total_tasks ?? 0,
                })
              : null
          }
          icon={CheckCircle2}
          loading={milestonePending}
        />
        <KpiCard
          label={t("venture.progressOverview.milestonesCompleted")}
          value={progressFailed ? "—" : progressData?.milestones?.completed ?? 0}
          hint={
            progressData
              ? t(
                  progressData.milestones?.progress_percent != null
                    ? "venture.progressOverview.milestonesProgress"
                    : "venture.progressOverview.milestonesOf",
                  {
                    done: progressData.milestones?.completed ?? 0,
                    total: progressData.milestones?.total ?? 0,
                    percent: progressData.milestones?.progress_percent ?? 0,
                  },
                )
              : null
          }
          icon={Flag}
          loading={milestonePending}
        />
        <KpiCard
          label={t("venture.progressOverview.openWork")}
          value={myWorkFailed ? "—" : openWork ?? 0}
          hint={myWorkFailed ? t("venture.myWork.loadFailed") : null}
          icon={ListTodo}
          loading={myWorkLoading && !myWork}
        />
      </div>

      {/* ── What needs the founder ───────────────────────────────────────── */}
      <DashboardWorkQueue
        myWork={myWork}
        loading={myWorkLoading}
        failed={myWorkFailed}
        onOpen={onSection ? () => onSection("journey") : null}
        onRetry={fetchMyWork}
      />

      {/* ── Who supports the Venture ─────────────────────────────────────── */}
      {params?.id && <VentureSupportCard ventureId={params.id} />}

      {/* ── Journey position + next milestone ────────────────────────────── */}
      <div className="stf-grid c1">
        <div className="stf-card">
          <h3>
            <BarChart3 size={16} />
            {t("venture.journey")}
          </h3>
          {activeStage || nextMilestone ? (
            <div className="space-y-1.5 text-sm">
              {activeStage && (
                <p>
                  <span style={{ color: "var(--text-secondary)" }}>{t("venture.current")}:</span>{" "}
                  <span className="font-semibold">{activeStage.name}</span>
                </p>
              )}
              {nextStage && (
                <p style={{ color: "var(--text-secondary)" }}>
                  {t("venture.next")}: {nextStage.name}
                </p>
              )}
              {nextMilestone && (
                <p>
                  <span style={{ color: "var(--text-secondary)" }}>
                    {t("venture.progressOverview.nextMilestone")}:
                  </span>{" "}
                  <span className="font-semibold">{nextMilestone.title}</span>
                  {nextMilestone.target_date && (
                    <span style={{ color: "var(--text-secondary)" }}>
                      {" · "}
                      {new Date(`${nextMilestone.target_date}T00:00:00`).toLocaleDateString()}
                    </span>
                  )}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {t("venture.noJourneyYet")}
            </p>
          )}
        </div>
      </div>

      {/* ── Recent activity ──────────────────────────────────────────────── */}
      <div className="stf-card">
        <h3>
          <Clock size={16} />
          {t("venture.recentActivity")}
        </h3>
        {!dashboardData?.recent_activity?.length ? (
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {overviewPending ? t("common.loading") : t("venture.noRecentActivity")}
          </p>
        ) : (
          dashboardData.recent_activity.map((activity, index) => (
            <div
              key={activity.id || index}
              className="flex items-center gap-3 py-2 border-b last:border-0 text-sm"
              style={{ borderColor: "var(--border-primary)" }}
            >
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: "var(--brand-orange)" }}
              />
              <span className="font-medium">{t(`venture.activity.${activity.action}`)}</span>
              <span style={{ color: "var(--text-secondary)" }}>
                • {new Date(activity.created_at).toLocaleDateString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

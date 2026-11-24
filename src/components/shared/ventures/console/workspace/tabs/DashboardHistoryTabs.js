"use client";

import { Users, BarChart3, Target, ListTodo, Flag } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useVenture } from "../VentureContext";
import KpiCard from "@/components/ui/KpiCard";
import DashboardWorkQueue from "./DashboardWorkQueue";
import VentureSupportCard from "@/components/shared/ventures/console/support/VentureSupportCard";
import FounderOnboardingWizard from "./FounderOnboardingWizard";
import VentureReportingCharts from "@/components/shared/ventures/console/reporting/VentureReportingCharts";

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
    form,
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
    <div className="space-y-6">
      {/* ── Founder Day-1 Launchpad & Guided Setup Wizard ── */}
      <FounderOnboardingWizard
        venture={ventureInfo}
        onSection={onSection}
        form={form}
        team={team}
        journeyStages={journeyList}
      />

      {/* ── Executive Performance Metrics (4 Consolidated High-Signal KPIs) ── */}
      <div className="stf-grid c4">
        <KpiCard
          label={t("venture.businessStage")}
          value={
            ventureInfo
              ? t(`venture.stages.${ventureInfo.business_stage || "idea"}`)
              : "—"
          }
          hint={ventureInfo?.program_name || ventureInfo?.cohort_name || "Direct Incubation"}
          icon={BarChart3}
          loading={overviewPending}
        />
        <KpiCard
          label={t("venture.progressOverview.milestonesCompleted")}
          value={progressFailed ? "—" : `${progressData?.milestones?.completed ?? 0} / ${progressData?.milestones?.total ?? 0}`}
          hint={
            progressData?.milestones?.progress_percent != null
              ? `${progressData.milestones.progress_percent}% roadmap complete`
              : "Active Journey Milestones"
          }
          icon={Flag}
          loading={milestonePending}
          onClick={onSection ? () => onSection("journey") : undefined}
        />
        <KpiCard
          label={t("venture.progressOverview.openWork")}
          value={myWorkFailed ? "—" : openWork ?? 0}
          hint={
            myWork?.personal?.counts?.total_open != null
              ? `${myWork.personal.counts.total_open} assigned directly to you`
              : "Pending Deliverables"
          }
          icon={ListTodo}
          loading={myWorkLoading && !myWork}
        />
        <KpiCard
          label={t("venture.progressOverview.ventureSetup")}
          value={progressValue(progressData?.venture_setup)}
          hint={t("venture.progressOverview.ventureSetupHint")}
          icon={Target}
          loading={milestonePending}
          onClick={onSection ? () => onSection("profile") : undefined}
        />
      </div>

      {/* ── Venture Analytics & Growth Telemetry Charts ── */}
      {params?.id && <VentureReportingCharts ventureId={params.id} />}

      {/* ── Active Journey Milestone Roadmap Hero ── */}
      <div
        className="rounded-2xl p-5 border transition-all"
        style={{
          background: "linear-gradient(135deg, var(--surface-1) 0%, var(--surface-2) 100%)",
          borderColor: "var(--border-primary)",
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider"
                style={{
                  background: "color-mix(in srgb, var(--brand-orange) 15%, transparent)",
                  color: "var(--brand-orange)",
                }}
              >
                Current Roadmap Stage
              </span>
              <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                {activeStage ? activeStage.name : "Active Incubation Phase"}
              </span>
            </div>
            <h3 className="text-base font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
              {nextMilestone?.title ? (
                <>Next Deliverable: <span className="text-[var(--brand-orange)]">{nextMilestone.title}</span></>
              ) : (
                activeStage?.name || "Sprint Alignment"
              )}
            </h3>
            {nextMilestone?.target_date && (
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Target Completion: <strong>{new Date(`${nextMilestone.target_date}T00:00:00`).toLocaleDateString(undefined, { dateStyle: "medium" })}</strong>
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {nextStage && (
              <div className="hidden lg:block text-right pr-4 border-r border-[var(--border-primary)]">
                <div className="text-[10px] uppercase font-bold tracking-wider" style={{ color: "var(--text-secondary)" }}>
                  Upcoming Phase
                </div>
                <div className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                  {nextStage.name}
                </div>
              </div>
            )}
            {onSection && (
              <button
                type="button"
                onClick={() => onSection("journey")}
                className="px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                style={{
                  background: "var(--surface-3)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-primary)",
                }}
              >
                Open Full Roadmap →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Balanced Two-Column Operational Cockpit (65% / 35%) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Action Queue & Deliverables */}
        <div className="lg:col-span-8 space-y-6">
          <DashboardWorkQueue
            myWork={myWork}
            loading={myWorkLoading}
            failed={myWorkFailed}
            onOpen={onSection ? () => onSection("journey") : null}
            onRetry={fetchMyWork}
          />

          
        </div>

        {/* Right Column: Studio Support & Venture Team */}
        <div className="lg:col-span-4 space-y-6">
          {params?.id && <VentureSupportCard ventureId={params.id} />}

          {/* Quick Team Glance */}
          <div className="stf-card">
            <h3>
              <Users size={16} />
              Venture Leadership
            </h3>
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between text-sm">
                <span style={{ color: "var(--text-secondary)" }}>Founding Team</span>
                <span className="font-bold">{team?.founders ?? 1} Founder</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span style={{ color: "var(--text-secondary)" }}>Team Members</span>
                <span className="font-bold">{team?.team ?? 0} Members</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span style={{ color: "var(--text-secondary)" }}>Task Completion</span>
                <span className="font-bold">{progressValue(progressData?.task_completion)}</span>
              </div>
              {onSection && (
                <div className="pt-2 border-t border-[var(--border-primary)]">
                  <button
                    type="button"
                    onClick={() => onSection("team")}
                    className="text-xs font-bold text-[var(--brand-orange)] hover:underline flex items-center gap-1"
                  >
                    Manage Founders & Access →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

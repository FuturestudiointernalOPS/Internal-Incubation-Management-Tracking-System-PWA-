"use client";

import { useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Target,
  FileText,
  AlertCircle,
  Users,
  Layers,
  RefreshCw,
  BarChart3,
  User,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { getServerErrorKey } from "@/lib/constants";
import SubmissionVersionHistory from "./SubmissionVersionHistory";
import { useApi } from "@/lib/hooks/useApi";
import { useSessionUser } from "@/lib/hooks/useSessionUser";
import { translateStatus } from "./program-detail/translateStatus";
import StatusBadge from "./program-detail/StatusBadge";
import WeekCard from "./program-detail/WeekCard";
import SubmitForm from "./program-detail/SubmitForm";
import ResourceCard from "./program-detail/ResourceCard";
import DetailSkeleton from "./program-detail/DetailSkeleton";

// ─── Read shaping (module scope: built once, never per render) ───────────

// The curriculum as the screen shows it: the "attendance" deliverables are not
// part of what a participant submits, so they come out of the answer here rather
// than being filtered again on every render.
function shapeCurriculum(payload) {
  const weeks = payload.curriculum?.weeks;
  if (!weeks) return payload;
  return {
    ...payload,
    curriculum: {
      ...payload.curriculum,
      weeks: weeks.map((week) => ({
        ...week,
        deliverables: (week.deliverables || []).filter(
          (deliverable) => !deliverable.title?.toLowerCase().includes("attendance"),
        ),
      })),
    },
  };
}

const EMPTY_DETAIL = { payload: null, failure: null };

const pickProgramDetail = (response) =>
  response?.success
    ? { payload: shapeCurriculum(response), failure: null }
    : { payload: null, failure: response?.error || null };

/** The message for a refused payload: its own key when one is known. */
function detailError(failure, t) {
  const key = getServerErrorKey(failure);
  return key ? t(key) : failure || t("participant.failedToLoad");
}

// ─── Main Component ─────────────────────────────────────────────────
export default function ProgramDetail({ programId }) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("curriculum");
  const [submitModal, setSubmitModal] = useState(null); // { deliverableId, weekNumber, deliverable }
  // Only the weeks the person has toggled themselves, recorded over the default.
  const [weekOverrides, setWeekOverrides] = useState({});

  // Who is signed in comes from the session the shell already publishes.
  const { user: sessionUser } = useSessionUser();
  const user = sessionUser || {};

  // The programme is read through the shared hook, which owns the cache, the
  // cache-first paint and the discarding of a stale answer.
  const {
    data: detail,
    loading,
    error: readError,
    refresh: refreshDetail,
  } = useApi(`/api/participant/programs/${programId}`, {
    defaultValue: EMPTY_DETAIL,
    transform: pickProgramDetail,
  });
  const data = detail.payload;
  const error = detail.failure
    ? detailError(detail.failure, t)
    : readError
      ? t("errors.networkError")
      : null;

  // Which weeks are open. The course's current week starts open and every week
  // the person toggles keeps their choice - DERIVED, so a fresh read can no
  // longer close a week they had opened, and opening the current one costs no
  // state write and no extra render.
  const isWeekOpen = (weekNumber) =>
    weekOverrides[weekNumber] ??
    (weekNumber === data?.curriculum?.currentWeek);

  const toggleWeek = (weekNumber) =>
    setWeekOverrides((prev) => ({
      ...prev,
      [weekNumber]: !(prev[weekNumber] ?? (weekNumber === data?.curriculum?.currentWeek)),
    }));

  // ── Error State ──────────────────────────────────────────────────
  if (error && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6">
        <AlertCircle className="w-12 h-12 text-rose-400" />
        <div className="text-center">
          <h3 className="text-lg font-black text-[var(--text-primary)]">
            {t("participant.failedToLoad")}
          </h3>
          <p className="text-sm text-[var(--text-secondary)] mt-2">
            {error}
          </p>
        </div>
        <button
          onClick={refreshDetail}
          className="flex items-center gap-2 px-6 py-3 bg-[var(--brand-orange)] text-black rounded-xl text-sm font-bold uppercase tracking-wide"
        >
          <RefreshCw className="w-3.5 h-3.5" /> {t("participant.retry")}
        </button>
      </div>
    );
  }

  if (loading) return <DetailSkeleton />;
  if (!data?.program) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <BookOpen className="w-12 h-12 text-[var(--text-tertiary)] mb-3" />
        <p className="text-sm text-[var(--text-secondary)]">
          {t("participant.programNotFound")}
        </p>
      </div>
    );
  }

  const {
    program,
    curriculum,
    resources,
    kpis,
    followups,
  } = data;
  const { metrics } = program;

  // Completed / archived programs are view-only for participants.
  const isViewOnlyProgram =
    !!program?.status && String(program.status).toLowerCase() !== "active";

  // The displayed status reflects the deliverables' actual state: once every
  // unlocked deliverable has an approved submission, show "Completed" rather
  // than the raw program status.
  const displayStatus =
    metrics.totalDeliverables > 0 &&
    metrics.completedDeliverables >= metrics.totalDeliverables
      ? "completed"
      : program.status || "active";

  // Resources grouped by week for display
  const resourcesByWeek = resources?.byWeek || {};
  const generalResources = resources?.general || [];

  const tabs = [
    { id: "curriculum", label: t("participant.curriculum"), icon: Layers },
    { id: "assignments", label: t("participant.assignments"), icon: FileText },
    { id: "progress", label: t("participant.progress"), icon: BarChart3 },
    { id: "resources", label: t("participant.resources"), icon: BookOpen },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* ═══ Back + Header ═══ */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => window.history.back()}
          className="p-2 rounded-lg hover:bg-[var(--surface-2)] transition-all mt-1"
        >
          <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge status={displayStatus} />
          </div>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-[var(--text-primary)]">
            {program.name}
          </h1>
          {program.description && (
            <p className="text-sm text-[var(--text-secondary)] mt-1 max-w-2xl">
              {program.description}
            </p>
          )}
        </div>
      </div>

      {/* ═══ Program Quick Stats ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[var(--bg-tertiary)] rounded-xl p-4 border border-[var(--border-primary)]">
          <p className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
            {metrics.percentComplete}%
          </p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-1">
            {t("participant.complete")}
          </p>
        </div>
        <div className="bg-[var(--bg-tertiary)] rounded-xl p-4 border border-[var(--border-primary)]">
          <p className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
            {t("participant.week")} {curriculum.currentWeek}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-1">
            {program.durationWeeks ? t("participant.ofWeeks", { total: program.durationWeeks }) : t("participant.current")}
          </p>
        </div>
        <div className="bg-[var(--bg-tertiary)] rounded-xl p-4 border border-[var(--border-primary)]">
          <p className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
            {metrics.totalDeliverables}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-1">
            {t("participant.deliverables")}
          </p>
        </div>
        <div className="bg-[var(--bg-tertiary)] rounded-xl p-4 border border-[var(--border-primary)]">
          <p className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
            {metrics.completedDeliverables}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-1">
            {t("participant.completed")}
          </p>
        </div>
      </div>

      {/* ═══ Facilitators ═══ */}
      {program.facilitators?.length > 0 && (
        <div className="bg-[var(--bg-tertiary)] rounded-xl p-4 border border-[var(--border-primary)]">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2">
            {t("participant.facilitators")}
          </p>
          <div className="flex flex-wrap gap-2">
            {program.pmName && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-orange/10 border border-brand-orange/20">
                <User className="w-3 h-3 text-[var(--brand-orange)]" />
                <span className="text-[10px] font-bold text-[var(--brand-orange)]">
                  {program.pmName} (PM)
                </span>
              </div>
            )}
            {program.facilitators.map((facilitator) => (
              <div
                key={facilitator.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20"
              >
                <User className="w-3 h-3 text-blue-400" />
                <span className="text-[10px] font-bold text-blue-400">
                  {facilitator.name} {facilitator.role ? `(${facilitator.role})` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Tabs ═══ */}
      <div className="flex items-center gap-1 border-b border-[var(--border-primary)] pb-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-[var(--brand-orange)] text-black"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ Tab: Curriculum ═══ */}
      {activeTab === "curriculum" && (
        <div className="space-y-3">
          {curriculum.weeks.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-3" />
              <p className="text-sm text-[var(--text-secondary)]">
                {t("participant.noCurriculumYet")}
              </p>
            </div>
          ) : (
            curriculum.weeks.map((week) => (
              <WeekCard
                key={week.number}
                week={week}
                isExpanded={isWeekOpen(week.number)}
                onToggle={toggleWeek}
                programId={programId}
                t={t}
                onSubmit={(delId, weekNumber, delData) =>
                  setSubmitModal({
                    deliverableId: delId,
                    weekNumber: weekNumber,
                    deliverable: delData,
                  })
                }
              />
            ))
          )}
        </div>
      )}

      {/* ═══ Tab: Assignments ═══ */}
      {activeTab === "assignments" && (
        <div className="space-y-4">
          {curriculum.weeks.filter((week) => !week.locked).map((week) => (
            <div key={week.number} className="space-y-2">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                Week {week.number}
              </h3>
              {week.deliverables.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">{t("participant.noAssignmentsThisWeek")}</p>
              ) : (
                week.deliverables.map((deliverable) => (
                  <div
                    key={deliverable.id}
                    className="flex items-center justify-between p-4 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        deliverable.submission?.status === "approved" ? "bg-emerald-500/10" :
                        deliverable.submission ? "bg-amber-500/10" : "bg-white/5"
                      }`}>
                        <FileText className={`w-4 h-4 ${
                          deliverable.submission?.status === "approved" ? "text-emerald-400" :
                          deliverable.submission ? "text-amber-400" : "text-[var(--text-tertiary)]"
                        }`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-[var(--text-primary)] truncate">
                          {deliverable.title}
                        </p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                          {deliverable.allowedFormat} {deliverable.dueDate ? `· ${t("participant.due")}: ${new Date(deliverable.dueDate).toLocaleDateString()}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {deliverable.submission ? (
                        <StatusBadge status={deliverable.submission.status} />
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("participant.pending")}</span>
                      )}
                      {deliverable.submission?.score != null && (
                        <span className="text-[10px] font-bold text-[var(--brand-orange)]">
                          {deliverable.submission.score}/100
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          ))}
          {curriculum.weeks.filter((week) => !week.locked).length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-3" />
              <p className="text-sm text-[var(--text-secondary)]">
                {t("participant.noAssignmentsYet")}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ═══ Tab: Resources ═══ */}
      {activeTab === "resources" && (
        <div className="space-y-6">
          {/* Resources by week */}
          {Object.entries(resourcesByWeek).length > 0
            ? Object.entries(resourcesByWeek)
                .sort(([leftWeek], [rightWeek]) => Number(leftWeek) - Number(rightWeek))
                .map(([weekNumber, items]) => (
                  <div key={weekNumber}>
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-3">
                      {Number(weekNumber) > 0 ? `${t("participant.week")} ${weekNumber}` : t("participant.general")}
                    </h3>
                    <div className="space-y-2">
                      {items.map((resource) => (
                        <ResourceCard key={resource.id} resource={resource} />
                      ))}
                    </div>
                  </div>
                ))
            : null}

          {/* General resources */}
          {generalResources.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-3">
                {t("participant.generalResources")}
              </h3>
              <div className="space-y-2">
                {generalResources.map((resource) => (
                  <ResourceCard key={resource.id} resource={resource} />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {(!resources || resources.total === 0) && (
            <div className="text-center py-16">
              <BookOpen className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-3" />
              <p className="text-sm text-[var(--text-secondary)]">
                {t("participant.noResourcesYet")}
              </p>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                {t("participant.resourcesHint")}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ═══ Tab: Progress ═══ */}
      {activeTab === "progress" && (
        <div className="space-y-6">
          {/* Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[var(--bg-tertiary)] rounded-xl p-5 border border-[var(--border-primary)]">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-brand-orange/10 flex items-center justify-center">
                  <Target className="w-4 h-4 text-[var(--brand-orange)]" />
                </div>
              </div>
              <p className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
                {metrics.percentComplete}%
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-1">
                {t("participant.programCompletion")}
              </p>
              <div className="w-full h-1.5 bg-white/10 rounded-full mt-3 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--brand-orange)] transition-all"
                  style={{ width: `${Math.min(metrics.percentComplete, 100)}%` }}
                />
              </div>
            </div>
            <div className="bg-[var(--bg-tertiary)] rounded-xl p-5 border border-[var(--border-primary)]">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-emerald-400" />
                </div>
              </div>
              <p className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
                {metrics.attendanceRate}%
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-1">
                {t("participant.attendance")}
              </p>
              <div className="w-full h-1.5 bg-white/10 rounded-full mt-3 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all"
                  style={{ width: `${Math.min(metrics.attendanceRate, 100)}%` }}
                />
              </div>
            </div>
            <div className="bg-[var(--bg-tertiary)] rounded-xl p-5 border border-[var(--border-primary)]">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-blue-400" />
                </div>
              </div>
              <p className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
                {metrics.kpiCompletion}%
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-1">
                {t("participant.kpiAchievement")}
              </p>
              <div className="w-full h-1.5 bg-white/10 rounded-full mt-3 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-400 transition-all"
                  style={{ width: `${Math.min(metrics.kpiCompletion, 100)}%` }}
                />
              </div>
            </div>
            <div className="bg-[var(--bg-tertiary)] rounded-xl p-5 border border-[var(--border-primary)]">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-purple-400" />
                </div>
              </div>
              <p className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
                {metrics.completedDeliverables}/{metrics.totalDeliverables}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-1">
                {t("participant.deliverablesDone")}
              </p>
              <div className="w-full h-1.5 bg-white/10 rounded-full mt-3 overflow-hidden">
                <div
                  className="h-full rounded-full bg-purple-400 transition-all"
                  style={{
                    width: `${metrics.totalDeliverables > 0 ? Math.min((metrics.completedDeliverables / metrics.totalDeliverables) * 100, 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Submissions — Version History */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-3">
              {t("participant.submissionHistory")}
            </h3>
            <SubmissionVersionHistory
              participantId={user?.cid || user?.id}
              programId={programId}
            />
          </div>

          {/* Follow-ups */}
          {followups.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-3">
                {t("participant.followUps")}
              </h3>
              <div className="space-y-2">
                {followups.slice(0, 5).map((followup) => (
                  <div
                    key={followup.id}
                    className="p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)]"
                  >
                    <p className="text-[11px] font-bold text-[var(--text-primary)]">
                      {t("participant.week")} {followup.week_number}
                    </p>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">
                      {followup.comment}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ Tab: Details ═══ */}
      {activeTab === "details" && (
        <div className="space-y-4">
          {/* Program Info */}
          <div className="bg-[var(--bg-tertiary)] rounded-xl p-5 border border-[var(--border-primary)]">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-4">
              {t("participant.programInfo")}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("participant.status")}
                </p>
                <p className="text-[12px] font-bold text-[var(--text-primary)] mt-1">
                  {translateStatus(program.status || "active", t)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("participant.duration")}
                </p>
                <p className="text-[12px] font-bold text-[var(--text-primary)] mt-1">
                  {program.durationWeeks || "?"} {t("participant.weeks")}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("participant.startDate")}
                </p>
                <p className="text-[12px] font-bold text-[var(--text-primary)] mt-1">
                  {program.startDate
                    ? new Date(program.startDate).toLocaleDateString()
                    : "TBD"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("participant.endDate")}
                </p>
                <p className="text-[12px] font-bold text-[var(--text-primary)] mt-1">
                  {program.endDate
                    ? new Date(program.endDate).toLocaleDateString()
                    : "TBD"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("participant.currentWeek")}
                </p>
                <p className="text-[12px] font-bold text-[var(--text-primary)] mt-1">
                  {t("participant.week")} {curriculum.currentWeek}
                </p>
              </div>
              {program.pmName && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    {t("participant.programManager")}
                  </p>
                  <p className="text-[12px] font-bold text-[var(--text-primary)] mt-1">
                    {program.pmName}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* KPIs */}
          {kpis.length > 0 && (
            <div className="bg-[var(--bg-tertiary)] rounded-xl p-5 border border-[var(--border-primary)]">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-4">
                {t("participant.keyPerformanceIndicators")}
              </h3>
              <div className="space-y-3">
                {kpis.map((kpi) => (
                  <div
                    key={kpi.id}
                    className="flex items-center justify-between"
                  >
                    <span className="text-[10px] font-bold text-[var(--text-primary)]">
                      {kpi.title}
                    </span>
                    <span className="text-[10px] font-bold text-[var(--text-secondary)]">
                      {kpi.current_value || 0} / {kpi.target_value || 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ Submit Modal ═══ */}
      {submitModal && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          onClick={() => setSubmitModal(null)}
        >
          <div
            className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-2xl w-full max-w-md space-y-5 p-6 max-h-[85vh] overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-[var(--text-primary)] tracking-tight">
                {t("participant.submitDeliverable")}
              </h3>
              <button onClick={() => setSubmitModal(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <SubmitForm
              programId={programId}
              deliverableId={submitModal.deliverableId}
              onDone={() => {
                setSubmitModal(null);
                refreshDetail();
              }}
              readOnly={isViewOnlyProgram}
              deliverable={submitModal.deliverable}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
}

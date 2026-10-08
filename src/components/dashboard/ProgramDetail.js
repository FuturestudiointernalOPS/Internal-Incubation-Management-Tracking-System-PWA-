"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  FileText,
  AlertCircle,
  Layers,
  RefreshCw,
  BarChart3,
  User,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { getServerErrorKey } from "@/lib/constants";
import { useApi } from "@/lib/hooks/useApi";
import { useSessionUser } from "@/lib/hooks/useSessionUser";
import StatusBadge from "./program-detail/StatusBadge";
import WeekCard from "./program-detail/WeekCard";
import SubmitForm from "./program-detail/SubmitForm";
import ResourceCard from "./program-detail/ResourceCard";
import DetailSkeleton from "./program-detail/DetailSkeleton";
import ProgressTab from "./program-detail/ProgressTab";
import AssignmentsTab from "./program-detail/AssignmentsTab";
import DetailsTab from "./program-detail/DetailsTab";

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
  const requestedSession = useSearchParams().get("session");
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
  const defaultWeekOpen = (weekNumber) =>
    weekNumber === data?.curriculum?.currentWeek ||
    data?.curriculum?.weeks?.some(week =>
      week.number === weekNumber &&
      week.sessions?.some(session => String(session.id) === requestedSession),
    );
  const isWeekOpen = (weekNumber) => weekOverrides[weekNumber] ?? defaultWeekOpen(weekNumber);
  const toggleWeek = (weekNumber) =>
    setWeekOverrides((prev) => ({
      ...prev,
      [weekNumber]: !(prev[weekNumber] ?? defaultWeekOpen(weekNumber)),
    }));

  useEffect(() => {
    if (!requestedSession || !data) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(`session-${requestedSession}`)?.scrollIntoView({ block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [data, requestedSession]);

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
        <div id="facilitators" className="scroll-mt-24 bg-[var(--bg-tertiary)] rounded-xl p-4 border border-[var(--border-primary)]">
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
        <AssignmentsTab t={t} curriculum={curriculum} />
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
        <ProgressTab
          metrics={metrics}
          user={user}
          programId={programId}
          followups={followups}
          t={t}
        />
      )}

      {/* ═══ Tab: Details ═══ */}
      {activeTab === "details" && (
        <DetailsTab t={t} program={program} curriculum={curriculum} kpis={kpis} />
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

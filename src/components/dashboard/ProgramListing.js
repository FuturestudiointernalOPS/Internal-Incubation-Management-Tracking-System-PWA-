"use client";

import React from "react";
import {
  BookOpen,
  Calendar,
  ChevronRight,
  Target,
  Users,
  FileText,
  AlertCircle,
  RefreshCw,
  Layers,
} from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { formatLocaleDate } from "@/lib/constants";
import { useApi } from "@/lib/hooks/useApi";

// ─── Read shaping (module scope: built once, never per render) ───────

// The list and the contact it came with, plus the server's own refusal folded
// into the value so a refused payload still reaches the failure panel.
const EMPTY_PROGRAMS = { programs: [], contact: null, failure: null };

const pickPrograms = (payload) =>
  payload?.success
    ? { programs: payload.programs || [], contact: payload.contact, failure: null }
    : { programs: [], contact: null, failure: payload?.error || null };

// ─── Status Badge ──────────────────────────────────────────────────
function StatusBadge({ status }) {
  const { t } = useI18n();
  const config = {
    active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    completed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    archived: "bg-white/5 text-[var(--text-tertiary)] border-white/10",
  };
  const classes = config[status?.toLowerCase()] || config.active;
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${classes}`}
    >
      {status || t("participantMisc.programListing.active")}
    </span>
  );
}

// ─── Mini Metric ────────────────────────────────────────────────────
function MiniMetric({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-6 h-6 rounded-md flex items-center justify-center ${color.bg}`}
      >
        <Icon className={`w-3 h-3 ${color.text}`} />
      </div>
      <div>
        <span className="text-[11px] font-bold text-[var(--text-primary)]">
          {value}%
        </span>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
          {label}
        </p>
      </div>
    </div>
  );
}

// ─── Program Card ───────────────────────────────────────────────────
function ProgramCard({ program, onSelect }) {
  const { t, lang } = useI18n();
  const { metrics } = program;
  // Show "Completed" once every unlocked deliverable has an approved
  // submission, so the badge reflects the deliverables' actual state.
  const displayStatus =
    metrics.totalDeliverables > 0 &&
    metrics.completedDeliverables >= metrics.totalDeliverables
      ? "completed"
      : program.status || "active";
  const progressColor =
    metrics.percentComplete >= 80
      ? "bg-emerald-400"
      : metrics.percentComplete >= 50
        ? "bg-[var(--brand-orange)]"
        : metrics.percentComplete >= 20
          ? "bg-amber-400"
          : "bg-rose-400";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl p-6 hover:border-brand-orange/30 transition-all cursor-pointer group"
      onClick={() => onSelect?.(program.id)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <StatusBadge status={displayStatus} />
            {program.status && String(program.status).toLowerCase() !== "active" && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/5 text-[var(--text-tertiary)] border border-white/10">
                {t("participantMisc.programListing.viewOnly")}
              </span>
            )}
          </div>
          <h3 className="text-[15px] font-black text-[var(--text-primary)] truncate">
            {program.name}
          </h3>
        </div>
        <div className="relative w-14 h-14 shrink-0 ml-3">
          <svg className="w-full h-full" viewBox="0 0 56 56">
            {/* Rotation applied around the circle center via SVG attribute —
                CSS transform on <svg> is subject to SVG transform-origin quirks
                and clips the ring at the top-left in some browsers. */}
            <g transform="rotate(-90 28 28)">
              <circle
                cx="28"
                cy="28"
                r="22"
                fill="transparent"
                stroke="currentColor"
                strokeWidth="4"
                className="text-white/10"
              />
              <circle
                cx="28"
                cy="28"
                r="22"
                fill="transparent"
                stroke="currentColor"
                strokeWidth="4"
                strokeDasharray={138.2}
                strokeDashoffset={138.2 - (138.2 * metrics.percentComplete) / 100}
                className={progressColor}
                strokeLinecap="round"
              />
            </g>
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-[var(--text-primary)]">
            {metrics.percentComplete}%
          </span>
        </div>
      </div>

      {/* Info tags */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {program.cohort && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/5">
            <Users className="w-3 h-3 text-[var(--text-tertiary)]" />
            <span className="text-[10px] font-bold text-[var(--text-secondary)]">
              {program.cohort}
            </span>
          </div>
        )}
        {program.durationWeeks && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/5">
            <Layers className="w-3 h-3 text-[var(--text-tertiary)]" />
            <span className="text-[10px] font-bold text-[var(--text-secondary)]">
              {t("participantMisc.programListing.weekRange", {
                current: program.currentWeek,
                total: program.durationWeeks,
              })}
            </span>
          </div>
        )}
        {program.facilitators?.length > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/5">
            <Users className="w-3 h-3 text-[var(--text-tertiary)]" />
            <span className="text-[10px] font-bold text-[var(--text-secondary)]">
              {t("participantMisc.programListing.facilitators", {
                count: program.facilitators.length,
              })}
            </span>
          </div>
        )}
      </div>

      {/* Mini metrics grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-[var(--border-primary)]">
        <MiniMetric
          icon={Target}
          label={t("participantMisc.programListing.progress")}
          value={metrics.percentComplete}
          color={{
            bg: "bg-brand-orange/10",
            text: "text-[var(--brand-orange)]",
          }}
        />
        <MiniMetric
          icon={Users}
          label={t("participantMisc.programListing.attendance")}
          value={metrics.attendanceRate}
          color={{ bg: "bg-emerald-500/10", text: "text-emerald-400" }}
        />
        <MiniMetric
          icon={FileText}
          label={t("participantMisc.programListing.assignments")}
          value={metrics.assignmentCompletion}
          color={{ bg: "bg-blue-500/10", text: "text-blue-400" }}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--border-primary)]">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3 h-3 text-[var(--text-tertiary)]" />
          <span className="text-[10px] font-medium text-[var(--text-secondary)]">
            {program.startDate
              ? formatLocaleDate(program.startDate, { month: "short", day: "numeric" }, lang)
              : t("participantMisc.programListing.na")}{" "}
            –{" "}
            {program.endDate
              ? formatLocaleDate(program.endDate, { month: "short", day: "numeric" }, lang)
              : t("participantMisc.programListing.na")}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[var(--brand-orange)] group-hover:gap-2 transition-all">
          <span>{t("participantMisc.programListing.details")}</span>
          <ChevronRight className="w-3 h-3" />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Program Listing Skeleton ───────────────────────────────────────
function ListingSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-8 w-48 bg-white/10 rounded" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[...Array(2)].map((_, index) => (
          <div
            key={index}
            className="bg-[var(--bg-tertiary)] rounded-xl p-6 border border-[var(--border-primary)]"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="h-4 w-16 bg-white/10 rounded mb-2" />
                <div className="h-5 w-40 bg-white/10 rounded" />
              </div>
              <div className="w-14 h-14 bg-white/10 rounded-full" />
            </div>
            <div className="flex gap-2 mb-4">
              <div className="h-5 w-20 bg-white/5 rounded" />
              <div className="h-5 w-24 bg-white/5 rounded" />
            </div>
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/5">
              {[...Array(3)].map((_, index) => (
                <div key={index} className="h-10 bg-white/5 rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────
export default function ProgramListing() {
  const { t } = useI18n();
  const router = useRouter();

  // The list is read through the shared hook, which owns the cache, the
  // cache-first paint and the discarding of a stale answer.
  const {
    data: programsRead,
    loading,
    error: readError,
    refresh,
  } = useApi("/api/participant/programs", {
    defaultValue: EMPTY_PROGRAMS,
    transform: pickPrograms,
  });
  const programs = programsRead.programs;
  const contact = programsRead.contact;
  // A refused payload keeps the server's own message (translated when it names a
  // key, shown as it stands otherwise) with the generic one as the floor; a
  // request that never answered says so.
  const error = programsRead.failure
    ? t(programsRead.failure) ||
      t("participantMisc.programListing.failedToLoadPrograms")
    : readError
      ? t("participantMisc.programListing.networkError")
      : null;

  const handleProgramSelect = (programId) => {
    // Client-side navigation — ProgramListing lives inside the persistent
    // /participant shell, so a full page reload would remount the whole
    // dashboard (auth chain + badges) for no reason.
    router.push(`/participant/${programId}`);
  };

  // ── Error State ──────────────────────────────────────────────────
  if (error && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-rose-400" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-black text-[var(--text-primary)] uppercase tracking-tight">
            {t("participantMisc.programListing.failedToLoadPrograms")}
          </h3>
          <p className="text-sm text-[var(--text-secondary)] mt-2">
            {error}
          </p>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-2 px-6 py-3 bg-[var(--brand-orange)] text-black rounded-xl text-sm font-bold uppercase tracking-wide hover:brightness-110 transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" /> {t("participantMisc.programListing.retry")}
        </button>
      </div>
    );
  }

  // ── Loading State ────────────────────────────────────────────────
  if (loading) return <ListingSkeleton />;

  // ── Empty State ──────────────────────────────────────────────────
  if (programs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6">
        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
          <BookOpen className="w-8 h-8 text-[var(--text-tertiary)]" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-black text-[var(--text-primary)] uppercase tracking-tight">
            {t("participantMisc.programListing.noProgramsYet")}
          </h3>
          <p className="text-sm text-[var(--text-secondary)] mt-2 max-w-md">
            {t("participantMisc.programListing.noProgramsHint")}
          </p>
        </div>
      </div>
    );
  }

  // ── Group programs by status ─────────────────────────────────────
  const activePrograms = programs.filter(
    (program) => program.status?.toLowerCase() === "active" || !program.status,
  );
  const otherPrograms = programs.filter(
    (program) => program.status?.toLowerCase() !== "active" && program.status,
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-[var(--text-primary)]">
          {t("participantMisc.programListing.myPrograms")}
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {t("participantMisc.programListing.enrolledCount", {
            count: programs.length,
          })}
          {contact?.name ? ` — ${contact.name}` : ""}
        </p>
      </div>

      {/* Active Programs */}
      {activePrograms.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {t("participantMisc.programListing.activePrograms", {
                count: activePrograms.length,
              })}
            </h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {activePrograms.map((program) => (
              <ProgramCard
                key={program.id}
                program={program}
                onSelect={handleProgramSelect}
              />
            ))}
          </div>
        </div>
      )}

      {/* Other Programs */}
      {otherPrograms.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {t("participantMisc.programListing.otherPrograms", {
                count: otherPrograms.length,
              })}
            </h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {otherPrograms.map((program) => (
              <ProgramCard
                key={program.id}
                program={program}
                onSelect={handleProgramSelect}
              />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

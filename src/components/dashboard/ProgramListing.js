"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  BookOpen,
  Calendar,
  ChevronRight,
  Target,
  Users,
  Clock,
  BarChart3,
  FileText,
  AlertCircle,
  RefreshCw,
  Zap,
  Layers,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { motion } from "framer-motion";

// ─── Status Badge ──────────────────────────────────────────────────
function StatusBadge({ status }) {
  const config = {
    active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    completed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    archived: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  };
  const classes = config[status?.toLowerCase()] || config.active;
  return (
    <span
      className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${classes}`}
    >
      {status || "Active"}
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
        <span className="text-[11px] font-black text-[var(--text-primary)]">
          {value}%
        </span>
        <p className="text-[7px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
          {label}
        </p>
      </div>
    </div>
  );
}

// ─── Program Card ───────────────────────────────────────────────────
function ProgramCard({ program, onSelect }) {
  const { metrics } = program;
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
      className="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl p-6 hover:border-[var(--brand-orange)]/30 transition-all cursor-pointer group"
      onClick={() => onSelect?.(program.id)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <StatusBadge status={program.status} />
            {program.programMode && (
              <span className="text-[8px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                {program.programMode}
              </span>
            )}
          </div>
          <h3 className="text-[15px] font-black text-[var(--text-primary)] truncate">
            {program.name}
          </h3>
        </div>
        <div className="relative w-14 h-14 shrink-0 ml-3">
          <svg className="w-full h-full transform -rotate-90">
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
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-[var(--text-primary)]">
            {metrics.percentComplete}%
          </span>
        </div>
      </div>

      {/* Info tags */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {program.cohort && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/5">
            <Users className="w-3 h-3 text-[var(--text-tertiary)]" />
            <span className="text-[8px] font-bold text-[var(--text-tertiary)]">
              {program.cohort}
            </span>
          </div>
        )}
        {program.durationWeeks && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/5">
            <Layers className="w-3 h-3 text-[var(--text-tertiary)]" />
            <span className="text-[8px] font-bold text-[var(--text-tertiary)]">
              Week {program.currentWeek}/{program.durationWeeks}
            </span>
          </div>
        )}
        {program.facilitators?.length > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/5">
            <Users className="w-3 h-3 text-[var(--text-tertiary)]" />
            <span className="text-[8px] font-bold text-[var(--text-tertiary)]">
              {program.facilitators.length} facilitator
              {program.facilitators.length > 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {/* Mini metrics grid */}
      <div className="grid grid-cols-3 gap-3 pt-4 border-t border-[var(--border-primary)]">
        <MiniMetric
          icon={Target}
          label="Progress"
          value={metrics.percentComplete}
          color={{
            bg: "bg-[var(--brand-orange)]/10",
            text: "text-[var(--brand-orange)]",
          }}
        />
        <MiniMetric
          icon={Users}
          label="Attendance"
          value={metrics.attendanceRate}
          color={{ bg: "bg-emerald-500/10", text: "text-emerald-400" }}
        />
        <MiniMetric
          icon={FileText}
          label="Assignments"
          value={metrics.assignmentCompletion}
          color={{ bg: "bg-blue-500/10", text: "text-blue-400" }}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--border-primary)]">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3 h-3 text-[var(--text-tertiary)]" />
          <span className="text-[8px] text-[var(--text-tertiary)]">
            {program.startDate
              ? new Date(program.startDate).toLocaleDateString("en", {
                  month: "short",
                  day: "numeric",
                })
              : "N/A"}{" "}
            –{" "}
            {program.endDate
              ? new Date(program.endDate).toLocaleDateString("en", {
                  month: "short",
                  day: "numeric",
                })
              : "N/A"}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[9px] font-bold text-[var(--brand-orange)] group-hover:gap-2 transition-all">
          <span>Details</span>
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
        {[...Array(2)].map((_, i) => (
          <div
            key={i}
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
              {[...Array(3)].map((_, j) => (
                <div key={j} className="h-10 bg-white/5 rounded" />
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
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contact, setContact] = useState(null);

  const fetchPrograms = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/participant/programs");
      const data = await res.json();
      if (data.success) {
        setPrograms(data.programs || []);
        setContact(data.contact);
      } else {
        setError(data.error || "Failed to load programs");
      }
    } catch (e) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);

  const handleProgramSelect = (programId) => {
    window.location.href = `/participant/${programId}`;
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
            Failed to Load Programs
          </h3>
          <p className="text-[12px] text-[var(--text-secondary)] mt-2">
            {error}
          </p>
        </div>
        <button
          onClick={fetchPrograms}
          className="flex items-center gap-2 px-6 py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry
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
            No Programs Yet
          </h3>
          <p className="text-[12px] text-[var(--text-secondary)] mt-2 max-w-md">
            You are not enrolled in any programs yet. Once you are added to a
            program, it will appear here.
          </p>
        </div>
      </div>
    );
  }

  // ── Group programs by status ─────────────────────────────────────
  const activePrograms = programs.filter(
    (p) => p.status?.toLowerCase() === "active" || !p.status,
  );
  const otherPrograms = programs.filter(
    (p) => p.status?.toLowerCase() !== "active" && p.status,
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tight">
          My Programs
        </h1>
        <p className="text-[11px] text-[var(--text-secondary)] mt-1">
          {programs.length} program{programs.length > 1 ? "s" : ""} enrolled
          {contact?.name ? ` — ${contact.name}` : ""}
        </p>
      </div>

      {/* Active Programs */}
      {activePrograms.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <h2 className="text-[11px] font-black text-[var(--text-secondary)] uppercase tracking-wider">
              Active Programs ({activePrograms.length})
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
            <h2 className="text-[11px] font-black text-[var(--text-secondary)] uppercase tracking-wider">
              Other Programs ({otherPrograms.length})
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

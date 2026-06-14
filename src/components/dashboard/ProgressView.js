"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Target,
  Users,
  FileText,
  BarChart3,
  Zap,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  BookOpen,
  TrendingUp,
  Calendar,
  Clock,
  Award,
} from "lucide-react";
import { motion } from "framer-motion";

// ─── Metric Card (large) ────────────────────────────────────────────
function MetricCard({ label, value, icon: Icon, color, subtitle }) {
  return (
    <div className="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${color.bg}`}
        >
          <Icon className={`w-5 h-5 ${color.text}`} />
        </div>
        <span
          className={`text-2xl font-black ${value >= 50 ? "text-emerald-400" : value >= 25 ? "text-amber-400" : "text-rose-400"}`}
        >
          {value}%
        </span>
      </div>
      <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
        {label}
      </p>
      <div className="w-full h-2 bg-white/10 rounded-full mt-3 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${Math.min(value, 100)}%`,
            backgroundColor: color.hex,
          }}
        />
      </div>
      {subtitle && (
        <p className="text-[8px] text-[var(--text-tertiary)] mt-2">
          {subtitle}
        </p>
      )}
    </div>
  );
}

// ─── Milestone Item ─────────────────────────────────────────────────
function MilestoneItem({ milestone }) {
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border ${
        milestone.achieved
          ? "border-emerald-500/20 bg-emerald-500/5"
          : "border-[var(--border-primary)] bg-[var(--surface-2)]"
      }`}
    >
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          milestone.achieved ? "bg-emerald-500/10" : "bg-white/5"
        }`}
      >
        {milestone.achieved ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        ) : (
          <Clock className="w-4 h-4 text-[var(--text-tertiary)]" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`text-[11px] font-bold truncate ${
            milestone.achieved
              ? "text-[var(--text-primary)]"
              : "text-[var(--text-tertiary)]"
          }`}
        >
          {milestone.title}
        </p>
        <p className="text-[8px] text-[var(--text-tertiary)] mt-0.5">
          Week {milestone.week || "?"}
          {milestone.score > 0 ? ` · Score: ${milestone.score}` : ""}
          {milestone.date
            ? ` · ${new Date(milestone.date).toLocaleDateString()}`
            : ""}
        </p>
      </div>
      {milestone.achieved && (
        <Award className="w-4 h-4 text-emerald-400 shrink-0" />
      )}
    </div>
  );
}

// ─── Week History Bar ───────────────────────────────────────────────
function WeekHistoryBar({ week }) {
  const delPct =
    week.deliverablesTotal > 0
      ? (week.deliverablesCompleted / week.deliverablesTotal) * 100
      : 0;
  const sesPct =
    week.sessionsTotal > 0
      ? (week.sessionsAttended / week.sessionsTotal) * 100
      : 0;

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--surface-2)] transition-all">
      <span className="text-[9px] font-black text-[var(--text-secondary)] w-12 shrink-0">
        Week {week.week}
      </span>
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[7px] font-bold text-[var(--text-tertiary)] w-14">
            Deliverables
          </span>
          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--brand-orange)]"
              style={{ width: `${delPct}%` }}
            />
          </div>
          <span className="text-[8px] font-bold text-[var(--text-secondary)] w-10 text-right">
            {week.deliverablesCompleted}/{week.deliverablesTotal}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[7px] font-bold text-[var(--text-tertiary)] w-14">
            Attendance
          </span>
          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-400"
              style={{ width: `${sesPct}%` }}
            />
          </div>
          <span className="text-[8px] font-bold text-[var(--text-secondary)] w-10 text-right">
            {week.sessionsAttended}/{week.sessionsTotal}
          </span>
        </div>
      </div>
      {week.hasRitual && <Zap className="w-3 h-3 text-amber-400 shrink-0" />}
    </div>
  );
}

// ─── Skeleton ───────────────────────────────────────────────────────
function ProgressSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-white/10 rounded" />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-32 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)]"
          />
        ))}
      </div>
      <div className="h-6 w-32 bg-white/10 rounded" />
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="h-16 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)]"
        />
      ))}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────
export default function ProgressView({ programId: filterProgramId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedProgram, setSelectedProgram] = useState("all");
  const [showMilestones, setShowMilestones] = useState(true);
  const [showHistory, setShowHistory] = useState(true);

  const fetchProgress = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      const cid = u.cid || u.id || "";
      const res = await fetch(`/api/participant/progress?cid=${cid}`);
      const result = await res.json();
      if (result.success) setData(result);
      else setError(result.error || "Failed to load");
    } catch (e) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  if (loading) return <ProgressSkeleton />;
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <AlertCircle className="w-10 h-10 text-rose-400" />
        <p className="text-[12px] text-[var(--text-secondary)]">{error}</p>
        <button
          onClick={fetchProgress}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest"
        >
          <RefreshCw className="w-3 h-3" /> Retry
        </button>
      </div>
    );
  }

  if (!data || data.programs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <BookOpen className="w-12 h-12 text-[var(--text-tertiary)]" />
        <p className="text-[12px] font-bold text-[var(--text-secondary)]">
          No progress data available
        </p>
      </div>
    );
  }

  const activeProgram =
    selectedProgram === "all"
      ? null
      : data.programs.find((p) => p.id === selectedProgram);

  const metrics = activeProgram ? activeProgram.metrics : data.overall;
  const milestones = activeProgram
    ? activeProgram.milestones
    : data.programs.flatMap((p) => p.milestones);
  const history = activeProgram ? activeProgram.history : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tight">
          My Progress
        </h1>
        <p className="text-[11px] text-[var(--text-secondary)] mt-1">
          {data.participant.name} · {data.totals.programs} program
          {data.totals.programs > 1 ? "s" : ""}
        </p>
      </div>

      {/* Program selector */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSelectedProgram("all")}
          className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
            selectedProgram === "all"
              ? "bg-[var(--brand-orange)] text-black"
              : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"
          }`}
        >
          All Programs
        </button>
        {data.programs.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelectedProgram(p.id)}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
              selectedProgram === p.id
                ? "bg-[var(--brand-orange)] text-black"
                : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Overall Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          label="Program Completion"
          value={metrics.programCompletion}
          icon={Target}
          color={{
            bg: "bg-[var(--brand-orange)]/10",
            text: "text-[var(--brand-orange)]",
            hex: "#FF6600",
          }}
          subtitle={
            activeProgram
              ? `${activeProgram.stats.completedDeliverables}/${activeProgram.stats.totalDeliverables} deliverables`
              : `${data.totals.completedDeliverables}/${data.totals.deliverables} deliverables`
          }
        />
        <MetricCard
          label="Attendance"
          value={metrics.attendanceRate}
          icon={Users}
          color={{
            bg: "bg-emerald-500/10",
            text: "text-emerald-400",
            hex: "#34D399",
          }}
          subtitle={
            activeProgram
              ? `${activeProgram.stats.attendedSessions}/${activeProgram.stats.totalSessions} sessions`
              : `${data.totals.attended}/${data.totals.sessions} sessions`
          }
        />
        <MetricCard
          label="Assignments"
          value={metrics.assignmentCompletion}
          icon={FileText}
          color={{
            bg: "bg-blue-500/10",
            text: "text-blue-400",
            hex: "#6366F1",
          }}
          subtitle={
            activeProgram
              ? `${activeProgram.stats.approvedSubmissions}/${activeProgram.stats.totalSubmissions} approved`
              : `${data.totals.approved}/${data.totals.submissions} approved`
          }
        />
        <MetricCard
          label="KPI Achievement"
          value={metrics.kpiCompletion}
          icon={BarChart3}
          color={{
            bg: "bg-purple-500/10",
            text: "text-purple-400",
            hex: "#A855F7",
          }}
          subtitle={
            activeProgram
              ? `${activeProgram.stats.targetMetKpis}/${activeProgram.stats.totalKpis} KPIs met`
              : ""
          }
        />
        <MetricCard
          label="Ritual Participation"
          value={metrics.ritualParticipation}
          icon={Zap}
          color={{
            bg: "bg-amber-500/10",
            text: "text-amber-400",
            hex: "#FBBF24",
          }}
          subtitle={`${data.totals.rituals} total submissions`}
        />
      </div>

      {/* Per-program stats cards (when viewing all) */}
      {selectedProgram === "all" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {data.programs.map((p) => (
            <div
              key={p.id}
              className="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[12px] font-black text-[var(--text-primary)]">
                  {p.name}
                </h3>
                <span className="text-[9px] text-[var(--text-secondary)]">
                  Week {p.currentWeek}/{p.durationWeeks || "?"}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {[
                  {
                    label: "Progress",
                    value: p.metrics.programCompletion,
                    color: "#FF6600",
                  },
                  {
                    label: "Attendance",
                    value: p.metrics.attendanceRate,
                    color: "#34D399",
                  },
                  {
                    label: "Assignments",
                    value: p.metrics.assignmentCompletion,
                    color: "#6366F1",
                  },
                  {
                    label: "KPIs",
                    value: p.metrics.kpiCompletion,
                    color: "#A855F7",
                  },
                  {
                    label: "Rituals",
                    value: p.metrics.ritualParticipation,
                    color: "#FBBF24",
                  },
                ].map((m) => (
                  <div key={m.label} className="text-center">
                    <div className="flex items-end justify-center gap-0.5">
                      <span className="text-[11px] font-black text-[var(--text-primary)]">
                        {m.value}
                      </span>
                      <span className="text-[7px] text-[var(--text-tertiary)]">
                        %
                      </span>
                    </div>
                    <p className="text-[6px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mt-0.5">
                      {m.label}
                    </p>
                    <div className="w-full h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${m.value}%`,
                          backgroundColor: m.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Milestones */}
      <div>
        <button
          onClick={() => setShowMilestones(!showMilestones)}
          className="flex items-center gap-2 text-[11px] font-black text-[var(--text-secondary)] uppercase tracking-wider mb-3"
        >
          <Award className="w-4 h-4" />
          Milestones ({milestones.filter((m) => m.achieved).length}/
          {milestones.length})
        </button>
        {showMilestones && (
          <div className="space-y-2">
            {milestones.length === 0 ? (
              <div className="text-center py-8 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)]">
                <Award className="w-8 h-8 text-[var(--text-tertiary)] mx-auto mb-2" />
                <p className="text-[10px] font-bold text-[var(--text-secondary)]">
                  No milestones yet
                </p>
              </div>
            ) : (
              milestones
                .slice(0, 20)
                .map((m) => <MilestoneItem key={m.id} milestone={m} />)
            )}
          </div>
        )}
      </div>

      {/* Weekly history (per-program view) */}
      {activeProgram && history && history.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-[11px] font-black text-[var(--text-secondary)] uppercase tracking-wider mb-3"
          >
            <TrendingUp className="w-4 h-4" />
            Weekly Breakdown
          </button>
          {showHistory && (
            <div className="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl p-4 space-y-1">
              {history.map((week) => (
                <WeekHistoryBar key={week.week} week={week} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats summary */}
      <div className="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl p-5">
        <h3 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider mb-4">
          Summary
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="text-lg font-black text-[var(--text-primary)]">
              {data.totals.submissions}
            </p>
            <p className="text-[8px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
              Total Submissions
            </p>
          </div>
          <div>
            <p className="text-lg font-black text-emerald-400">
              {data.totals.approved}
            </p>
            <p className="text-[8px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
              Approved
            </p>
          </div>
          <div>
            <p className="text-lg font-black text-[var(--text-primary)]">
              {data.totals.sessions}
            </p>
            <p className="text-[8px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
              Total Sessions
            </p>
          </div>
          <div>
            <p className="text-lg font-black text-[var(--text-primary)]">
              {data.totals.rituals}
            </p>
            <p className="text-[8px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
              Ritual Submissions
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

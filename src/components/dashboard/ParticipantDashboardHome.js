"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  Target,
  BookOpen,
  ChevronRight,
  Bell,
  FileText,
  TrendingUp,
  Users,
  Zap,
  BarChart3,
  MessageSquare,
  ArrowRight,
  Loader2,
  RefreshCw,
  ExternalLink,
  Layers,
} from "lucide-react";
import { motion } from "framer-motion";
import CalendarPanel from "@/components/ui/CalendarPanel";

// ─── Progress Ring ─────────────────────────────────────────────────
function ProgressRing({
  percent,
  size = 80,
  strokeWidth = 6,
  color = "#FF6600",
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-white/10"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <span className="absolute text-lg font-black text-white">{percent}%</span>
    </div>
  );
}

// ─── Metric Card ────────────────────────────────────────────────────
function MetricCard({ label, value, icon: Icon, color, trend }) {
  return (
    <div className="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl p-5 hover:border-[var(--brand-orange)]/20 transition-all group">
      <div className="flex items-start justify-between mb-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${color.bg}`}
        >
          <Icon className={`w-5 h-5 ${color.text}`} />
        </div>
        {trend !== undefined && (
          <span
            className={`text-[9px] font-black uppercase tracking-wider ${trend >= 0 ? "text-emerald-400" : "text-rose-400"}`}
          >
            {trend >= 0 ? "+" : ""}
            {trend}%
          </span>
        )}
      </div>
      <div className="space-y-1">
        <div className="flex items-end gap-2">
          <span className="text-2xl font-black text-[var(--text-primary)]">
            {value}%
          </span>
        </div>
        <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
          {label}
        </p>
        <div className="w-full h-1.5 bg-white/10 rounded-full mt-2 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-out"
            style={{
              width: `${Math.min(value, 100)}%`,
              backgroundColor: color.hex,
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Announcement Item ──────────────────────────────────────────────
function AnnouncementItem({ announcement }) {
  const typeIcons = {
    announcement: Bell,
    schedule: Calendar,
    alert: AlertCircle,
    milestone: Target,
  };
  const Icon = typeIcons[announcement.type] || Bell;

  const typeColors = {
    announcement: "text-[var(--brand-orange)] bg-[var(--brand-orange)]/10",
    schedule: "text-blue-400 bg-blue-500/10",
    alert: "text-rose-400 bg-rose-500/10",
    milestone: "text-emerald-400 bg-emerald-500/10",
  };
  const colors = typeColors[announcement.type] || typeColors.announcement;

  return (
    <div className="flex items-start gap-4 p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-primary)] hover:border-[var(--border-primary)]/50 transition-all">
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${colors}`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-bold text-[var(--text-primary)]">
          {announcement.title}
        </p>
        {announcement.message && (
          <p className="text-[11px] text-[var(--text-secondary)] mt-1 line-clamp-2">
            {announcement.message}
          </p>
        )}
        <p className="text-[9px] text-[var(--text-tertiary)] mt-1.5">
          {announcement.createdAt
            ? new Date(announcement.createdAt).toLocaleDateString("en", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : ""}
        </p>
      </div>
      {!announcement.isRead && (
        <div className="w-2 h-2 rounded-full bg-[var(--brand-orange)] shrink-0 mt-2" />
      )}
    </div>
  );
}

// ─── Skeleton Loader ────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Welcome skeleton */}
      <div className="bg-[var(--bg-tertiary)] rounded-2xl p-8 border border-[var(--border-primary)]">
        <div className="h-4 w-24 bg-white/10 rounded mb-4" />
        <div className="h-8 w-64 bg-white/10 rounded mb-2" />
        <div className="h-4 w-48 bg-white/5 rounded" />
      </div>
      {/* Metrics skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="bg-[var(--bg-tertiary)] rounded-xl p-5 border border-[var(--border-primary)]"
          >
            <div className="h-10 w-10 bg-white/10 rounded-lg mb-3" />
            <div className="h-6 w-16 bg-white/10 rounded mb-2" />
            <div className="h-3 w-20 bg-white/5 rounded" />
            <div className="h-1.5 w-full bg-white/5 rounded mt-3" />
          </div>
        ))}
      </div>
      {/* Content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-6 w-32 bg-white/10 rounded" />
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-16 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)]"
            />
          ))}
        </div>
        <div className="space-y-4">
          <div className="h-6 w-32 bg-white/10 rounded" />
          {[...Array(2)].map((_, i) => (
            <div
              key={i}
              className="h-20 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────
export default function ParticipantDashboardHome() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { t } = useI18n();

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/participant/home");
      const result = await res.json();
      if (result.success) {
        setData(result);
      } else {
        setError(result.error || "Failed to load dashboard");
      }
    } catch (e) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // ── Error State ──────────────────────────────────────────────────
  if (error && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-rose-400" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-black text-[var(--text-primary)] uppercase tracking-tight">
            Failed to Load
          </h3>
          <p className="text-[12px] text-[var(--text-secondary)] mt-2 max-w-md">
            {error}
          </p>
        </div>
        <button
          onClick={fetchDashboard}
          className="flex items-center gap-2 px-6 py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    );
  }

  // ── Loading State ────────────────────────────────────────────────
  if (loading) {
    return <DashboardSkeleton />;
  }

  // ── Empty State ──────────────────────────────────────────────────
  if (!data?.primaryProgram && data?.programs?.length === 0) {
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
            program, your dashboard will appear here.
          </p>
        </div>
      </div>
    );
  }

  const {
    participant,
    primaryProgram,
    programs,
    actionCenter,
    calendarEvents,
    announcements,
  } = data;
  const hasActions =
    actionCenter.overdue.length > 0 ||
    actionCenter.dueSoon.length > 0 ||
    actionCenter.pendingSubmissions.length > 0 ||
    actionCenter.upcomingSessions.length > 0;

  // ── Main Dashboard ───────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      {/* ═══ WELCOME AREA ═══ */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--bg-tertiary)] via-[var(--bg-secondary)] to-[var(--bg-tertiary)] border border-[var(--border-primary)] p-8"
      >
        {/* Decorative gradient orbs */}
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-[var(--brand-orange)]/5 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-48 h-48 rounded-full bg-blue-500/5 blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.3em]">
              Active Session
            </span>
          </div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">
            Welcome back,{" "}
            <span className="text-[var(--brand-orange)]">
              {participant?.name?.split(" ")[0] || "Participant"}
            </span>
          </h1>
          {primaryProgram && (
            <div className="flex flex-wrap items-center gap-4 mt-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--brand-orange)]/10 border border-[var(--brand-orange)]/20">
                <BookOpen className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
                <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-wider">
                  {primaryProgram.name}
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <Users className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-wider">
                  {primaryProgram.cohort}
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">
                  Week {primaryProgram.currentWeek} of{" "}
                  {primaryProgram.durationWeeks || "?"}
                </span>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* ═══ PROGRESS OVERVIEW CARDS ═══ */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider mb-4">
          Your Progress
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <MetricCard
            label="Program Completion"
            value={primaryProgram?.metrics?.programCompletion || 0}
            icon={Target}
            color={{
              bg: "bg-[var(--brand-orange)]/10",
              text: "text-[var(--brand-orange)]",
              hex: "#FF6600",
            }}
          />
          <MetricCard
            label="Attendance"
            value={primaryProgram?.metrics?.attendanceRate || 0}
            icon={Users}
            color={{
              bg: "bg-emerald-500/10",
              text: "text-emerald-400",
              hex: "#34D399",
            }}
          />
          <MetricCard
            label="Assignments"
            value={primaryProgram?.metrics?.assignmentCompletion || 0}
            icon={FileText}
            color={{
              bg: "bg-blue-500/10",
              text: "text-blue-400",
              hex: "#6366F1",
            }}
          />
          <MetricCard
            label="KPI Achievement"
            value={primaryProgram?.metrics?.kpiCompletion || 0}
            icon={BarChart3}
            color={{
              bg: "bg-purple-500/10",
              text: "text-purple-400",
              hex: "#A855F7",
            }}
          />
          <MetricCard
            label="Ritual Participation"
            value={0}
            icon={Zap}
            color={{
              bg: "bg-amber-500/10",
              text: "text-amber-400",
              hex: "#FBBF24",
            }}
          />
        </div>
      </motion.div>

      {/* ═══ CALENDAR ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CalendarPanel events={calendarEvents} />
        </div>
        <div className="space-y-3">
          {actionCenter.overdue.length > 0 && (
            <div className="card border-l-4 border-l-rose-500 !py-3 !px-4">
              <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest">
                Overdue ({actionCenter.overdue.length})
              </p>
              <div className="space-y-1 mt-2">
                {actionCenter.overdue.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-primary)]"
                  >
                    <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
                    <span className="truncate">{item.title}</span>
                    <span className="text-[7px] text-rose-500 shrink-0">
                      {item.daysOverdue}d
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {actionCenter.dueSoon.length > 0 && (
            <div className="card border-l-4 border-l-amber-500 !py-3 !px-4">
              <p className="text-[8px] font-black text-amber-500 uppercase tracking-widest">
                Due This Week ({actionCenter.dueSoon.length})
              </p>
              <div className="space-y-1 mt-2">
                {actionCenter.dueSoon.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-primary)]"
                  >
                    <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                    <span className="truncate">{item.title}</span>
                    <span className="text-[7px] text-amber-500 shrink-0">
                      {item.daysLeft}d
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {actionCenter.pendingSubmissions.length > 0 && (
            <div className="card border-l-4 border-l-blue-500 !py-3 !px-4">
              <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest">
                Pending Review ({actionCenter.pendingSubmissions.length})
              </p>
              <div className="space-y-1 mt-2">
                {actionCenter.pendingSubmissions.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-primary)]"
                  >
                    <AlertCircle className="w-3 h-3 text-blue-500 shrink-0" />
                    <span className="truncate">
                      Deliverable #{item.deliverableId}
                    </span>
                    <span className="text-[7px] text-blue-500 shrink-0">
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ ANNOUNCEMENTS ═══ */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.35 }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">
              Announcements
            </h2>
            {announcements.filter((a) => !a.isRead).length > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-[var(--brand-orange)] text-black">
                {announcements.filter((a) => !a.isRead).length} NEW
              </span>
            )}
          </div>
        </div>

        {announcements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)]">
            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-3">
              <Bell className="w-6 h-6 text-[var(--text-tertiary)]" />
            </div>
            <p className="text-[11px] font-bold text-[var(--text-secondary)]">
              No announcements yet
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {announcements.slice(0, 6).map((a) => (
              <AnnouncementItem key={a.id} announcement={a} />
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

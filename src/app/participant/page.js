"use client";

import React, { useState, useEffect } from "react";
import {
  Rocket,
  Target,
  CheckCircle2,
  ChevronRight,
  BookOpen,
  Users,
  Clock,
  AlertCircle,
  Zap,
  Calendar,
  Activity,
  MessageSquare,
  Send,
  HelpCircle,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { IMPACT_CACHE } from "@/utils/impactCache";

/**
 * PARTICIPANT PROJECTS OVERVIEW
 * Landing page — shows all enrolled programs with progress.
 * Click any project to drill into detail (weeks, materials, messages, progress).
 */
export default function ParticipantProjectsOverview() {
  const router = useRouter();
  const [programs, setPrograms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [showSupport, setShowSupport] = useState(false);
  const [supportForm, setSupportForm] = useState({ category: "", message: "" });
  const [supportSending, setSupportSending] = useState(false);
  const [toast, setToast] = useState(null);

  const notify = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
      setUser(storedUser);
      const email = storedUser.email;

      if (!email) {
        setIsLoading(false);
        return;
      }

      const url = `/api/participant/programs?email=${email}`;

      // Check cache first
      const cached = IMPACT_CACHE.get("participant_programs");
      if (cached?.programs?.length > 0) {
        setPrograms(cached.programs);
        setIsLoading(false);
      }

      // Full sync
      const res = await fetch(url);
      const data = await res.json();

      if (!data.success) throw new Error(data.error);

      setPrograms(data.programs || []);
      IMPACT_CACHE.set("participant_programs", data);
      setIsLoading(false);
    } catch (e) {
      console.error("Dashboard sync failure", e);
      setIsLoading(false);
    }
  };

  const submitSupport = async () => {
    if (!supportForm.category || !supportForm.message.trim()) {
      notify("Please select a category and write a message.", "error");
      return;
    }
    setSupportSending(true);
    try {
      const body = {
        recipient_id: "sa",
        title: `Support: ${supportForm.category}`,
        message: `${user?.name || "Participant"} needs help: ${supportForm.message}`,
        type: "support_request",
      };
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        notify("Support request sent! A team member will follow up.");
        setShowSupport(false);
        setSupportForm({ category: "", message: "" });
      } else {
        notify("Failed to send. Try again.", "error");
      }
    } catch (e) {
      notify("Network error.", "error");
    } finally {
      setSupportSending(false);
    }
  };

  if (isLoading)
    return (
      <div className="min-h-screen bg-[#080810] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#FF6600]/20 border-t-[#FF6600] rounded-full animate-spin" />
      </div>
    );

  // Empty state
  if (!isLoading && programs.length === 0) {
    return (
      <DashboardLayout role="participant" activeTab="projects">
        <div className="max-w-lg mx-auto mt-20 text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-[#FF6600]/10 flex items-center justify-center mx-auto">
            <BookOpen className="w-10 h-10 text-[#FF6600]" />
          </div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">
            No Programs Found
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            You are not currently enrolled in any active programs. Please
            contact your Program Manager or Super Admin to get assigned to a
            cohort.
          </p>
          <div className="bg-[#0F172A] border border-white/5 rounded-2xl p-5 text-left space-y-3">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              How to get enrolled:
            </p>
            <ol className="text-xs text-slate-400 space-y-2 list-decimal list-inside">
              <li>Your Admin assigns you to a group/cohort</li>
              <li>That group is linked to an active program</li>
              <li>Once linked, your dashboard will appear here</li>
            </ol>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="participant" activeTab="projects">
      <div className="max-w-4xl mx-auto space-y-8 pb-16">
        {/* ─── HEADER ─── */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Rocket className="w-5 h-5 text-[#FF6600]" />
            <span className="text-[10px] font-black text-[#FF6600] uppercase tracking-[0.3em]">
              Participant Portal
            </span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-black text-white tracking-tight uppercase">
            My Projects
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            You are enrolled in{" "}
            <strong className="text-white">{programs.length}</strong> program
            {programs.length !== 1 ? "s" : ""}. Select a project below to view
            your curriculum, materials, and progress.
          </p>
        </div>

        {/* ─── THIS WEEK + UPCOMING DEADLINES WIDGETS ─── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Weekly Goals Widget */}
          <div className="ios-card bg-[#0F172A] border border-white/5 !p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-[#FF6600]" />
              <span className="text-[9px] font-black text-[#FF6600] uppercase tracking-[0.2em]">
                This Week
              </span>
            </div>
            <div className="space-y-2.5">
              {(() => {
                const items = [];
                programs.forEach((prog) => {
                  const week = prog.metrics?.currentWeek || 1;
                  const currentSession = (prog.sessions || []).find(
                    (s) => s.week_number === week,
                  );
                  if (currentSession) {
                    items.push({
                      text: `Attend: ${currentSession.title}`,
                      program: prog.name,
                      icon: Calendar,
                      urgent: false,
                    });
                  }
                  const pendingDels = (prog.deliverables || []).filter((d) => {
                    const sub = (prog.submissions || []).find(
                      (s) =>
                        s.deliverable_id === d.id || s.document_id === d.id,
                    );
                    return (
                      !sub ||
                      (sub.status !== "approved" && sub.status !== "completed")
                    );
                  });
                  pendingDels.slice(0, 2).forEach((d) => {
                    items.push({
                      text: `Submit: ${d.title}`,
                      program: prog.name,
                      icon: CheckCircle2,
                      urgent: true,
                    });
                  });
                });
                return items.slice(0, 5).map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div key={i} className="flex items-start gap-3">
                      <div
                        className={`p-1.5 rounded-lg mt-0.5 ${item.urgent ? "bg-amber-500/10" : "bg-[#FF6600]/10"}`}
                      >
                        <Icon
                          className={`w-3.5 h-3.5 ${item.urgent ? "text-amber-500" : "text-[#FF6600]"}`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-white leading-snug">
                          {item.text}
                        </p>
                        <p className="text-[8px] text-slate-500 mt-0.5 uppercase tracking-wider">
                          {item.program}
                        </p>
                      </div>
                    </div>
                  );
                });
              })()}
              {(() => {
                let total = 0;
                programs.forEach((prog) => {
                  total += (prog.deliverables || []).filter((d) => {
                    const sub = (prog.submissions || []).find(
                      (s) =>
                        s.deliverable_id === d.id || s.document_id === d.id,
                    );
                    return (
                      !sub ||
                      (sub.status !== "approved" && sub.status !== "completed")
                    );
                  }).length;
                });
                return total === 0 ? (
                  <p className="text-[10px] text-slate-500 italic text-center py-2">
                    All caught up! No pending items.
                  </p>
                ) : null;
              })()}
            </div>
          </div>

          {/* Upcoming Deadlines Widget */}
          <div className="ios-card bg-[#0F172A] border border-white/5 !p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="text-[9px] font-black text-amber-500 uppercase tracking-[0.2em]">
                Upcoming Deadlines
              </span>
            </div>
            <div className="space-y-2.5">
              {(() => {
                const items = [];
                programs.forEach((prog) => {
                  const week = prog.metrics?.currentWeek || 1;
                  // Upcoming sessions (current week + next)
                  (prog.sessions || [])
                    .filter(
                      (s) => s.week_number >= week && s.week_number <= week + 1,
                    )
                    .forEach((s) => {
                      const date = s.scheduled_date
                        ? new Date(s.scheduled_date).toLocaleDateString(
                            "en-US",
                            {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            },
                          )
                        : null;
                      items.push({
                        text: s.title,
                        date: date || `Week ${s.week_number}`,
                        type: "session",
                        program: prog.name,
                      });
                    });
                  // Pending submissions
                  (prog.deliverables || []).forEach((d) => {
                    const sub = (prog.submissions || []).find(
                      (s) =>
                        s.deliverable_id === d.id || s.document_id === d.id,
                    );
                    if (!sub || sub.status === "pending") {
                      items.push({
                        text: d.title,
                        date: sub ? "Pending Review" : "Not Submitted",
                        type: "deliverable",
                        program: prog.name,
                      });
                    }
                  });
                });
                if (items.length === 0) {
                  return (
                    <p className="text-[10px] text-slate-500 italic text-center py-2">
                      No upcoming deadlines.
                    </p>
                  );
                }
                return items.slice(0, 5).map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div
                      className={`p-1.5 rounded-lg mt-0.5 ${
                        item.type === "session"
                          ? "bg-blue-500/10"
                          : "bg-amber-500/10"
                      }`}
                    >
                      {item.type === "session" ? (
                        <Calendar className="w-3.5 h-3.5 text-blue-500" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white leading-snug">
                        {item.text}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={`text-[8px] font-black uppercase tracking-wider ${
                            item.type === "session"
                              ? "text-blue-400"
                              : "text-amber-400"
                          }`}
                        >
                          {item.date}
                        </span>
                        <span className="text-[7px] text-slate-600">
                          {item.program}
                        </span>
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>

        {/* ─── ACTIVITY TIMELINE + PROGRESS BREAKDOWN ─── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Activity Timeline */}
          <div className="md:col-span-2 ios-card bg-[#0F172A] border border-white/5 !p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#FF6600]" />
              <span className="text-[9px] font-black text-[#FF6600] uppercase tracking-[0.2em]">
                Recent Activity
              </span>
            </div>
            <div className="space-y-2">
              {(() => {
                const activities = [];
                programs.forEach((prog) => {
                  const week = prog.metrics?.currentWeek || 1;
                  // Submitted submissions
                  (prog.submissions || []).forEach((s) => {
                    const date = s.created_at
                      ? new Date(s.created_at)
                      : new Date();
                    const statusIcon =
                      s.status === "approved"
                        ? "✅"
                        : s.status === "pending"
                          ? "⏳"
                          : "📤";
                    activities.push({
                      text: `${statusIcon} Submitted ${s.deliverable_title || "deliverable"} (${s.status || "pending"})`,
                      program: prog.name,
                      date,
                    });
                  });
                  // Completed sessions
                  (prog.sessions || [])
                    .filter((s) => s.status === "completed")
                    .slice(0, 2)
                    .forEach((s) => {
                      activities.push({
                        text: `✅ Completed: ${s.title}`,
                        program: prog.name,
                        date: s.scheduled_date
                          ? new Date(s.scheduled_date)
                          : new Date(),
                      });
                    });
                  // Current week
                  const currentSession = (prog.sessions || []).find(
                    (s) => s.week_number === week && s.status !== "completed",
                  );
                  if (currentSession) {
                    activities.push({
                      text: `📅 Current: ${currentSession.title}`,
                      program: prog.name,
                      date: new Date(),
                    });
                  }
                });
                activities.sort((a, b) => b.date - a.date);

                if (activities.length === 0) {
                  return (
                    <p className="text-[10px] text-slate-500 italic text-center py-4">
                      No recent activity.
                    </p>
                  );
                }
                return activities.slice(0, 6).map((act, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0"
                  >
                    <div className="w-6 h-6 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-[10px] flex-shrink-0">
                      {act.text.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white leading-snug">
                        {act.text}
                      </p>
                      <p className="text-[8px] text-slate-500 mt-0.5">
                        {act.program} · {act.date.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* Progress Breakdown */}
          <div className="ios-card bg-[#0F172A] border border-white/5 !p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              <span className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em]">
                My Progress
              </span>
            </div>
            <div className="space-y-4">
              {(() => {
                let totalSessions = 0;
                let completedSessions = 0;
                let totalDels = 0;
                let completedDels = 0;
                let totalAttendance = 0;
                let presentCount = 0;
                let pendingSubs = 0;
                let approvedSubs = 0;

                programs.forEach((prog) => {
                  const sessions = prog.sessions || [];
                  totalSessions += sessions.length;
                  completedSessions += sessions.filter(
                    (s) => s.status === "completed",
                  ).length;

                  const dels = prog.deliverables || [];
                  totalDels += dels.length;
                  dels.forEach((d) => {
                    const sub = (prog.submissions || []).find(
                      (s) =>
                        s.deliverable_id === d.id || s.document_id === d.id,
                    );
                    if (sub) {
                      if (
                        sub.status === "approved" ||
                        sub.status === "completed"
                      ) {
                        completedDels++;
                        approvedSubs++;
                      } else {
                        pendingSubs++;
                      }
                    }
                  });
                });

                const sessionPct =
                  totalSessions > 0
                    ? Math.round((completedSessions / totalSessions) * 100)
                    : 0;
                const delsPct =
                  totalDels > 0
                    ? Math.round((completedDels / totalDels) * 100)
                    : 0;
                const totalSubs = pendingSubs + approvedSubs;
                const approvalPct =
                  totalSubs > 0
                    ? Math.round((approvedSubs / totalSubs) * 100)
                    : 0;

                return (
                  <>
                    <ProgressBar
                      label="Sessions"
                      value={sessionPct}
                      detail={`${completedSessions}/${totalSessions}`}
                      color="bg-blue-500"
                    />
                    <ProgressBar
                      label="Assignments"
                      value={delsPct}
                      detail={`${completedDels}/${totalDels}`}
                      color="bg-[#FF6600]"
                    />
                    <ProgressBar
                      label="Submissions"
                      value={approvalPct}
                      detail={`${approvedSubs} approved`}
                      color="bg-emerald-500"
                    />
                    {pendingSubs > 0 && (
                      <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20 text-center">
                        <p className="text-[10px] font-black text-amber-500">
                          {pendingSubs} pending review
                        </p>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        {/* ─── ANNOUNCEMENTS ─── */}
        {(() => {
          const allFollowups = [];
          programs.forEach((prog) => {
            (prog.followups || []).forEach((f) => {
              allFollowups.push({ ...f, programName: prog.name });
            });
          });
          allFollowups.sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at),
          );
          if (allFollowups.length === 0) return null;
          return (
            <div className="ios-card bg-[#0F172A] border border-white/5 !p-5 space-y-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-500" />
                <span className="text-[9px] font-black text-blue-500 uppercase tracking-[0.2em]">
                  Announcements
                </span>
              </div>
              <div className="space-y-3">
                {allFollowups.slice(0, 4).map((f, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 bg-[var(--bg-tertiary)] rounded-xl border border-white/5"
                  >
                    <div className="w-7 h-7 rounded-full bg-blue-500/10 flex items-center justify-center text-[10px] flex-shrink-0">
                      📢
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white leading-snug">
                        {f.message || f.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[8px] text-blue-400 font-bold uppercase">
                          {f.programName}
                        </span>
                        <span className="text-[7px] text-slate-600">
                          {new Date(f.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ─── PROJECT CARDS GRID ─── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {programs.map((prog, idx) => {
            const progMetrics = prog.metrics || {};
            const pct = progMetrics.percentComplete || 0;
            const totalDels = progMetrics.totalDeliverables || 0;
            const completedDels = progMetrics.completedDeliverables || 0;
            const week = progMetrics.currentWeek || 1;
            const totalWeeks =
              prog.duration_weeks || prog.sessions?.length || week;
            const sessionCount = prog.sessions?.length || 0;
            const completedSessions =
              prog.sessions?.filter(
                (s) => s.status === "completed" || s.status === "current",
              ).length || 0;

            return (
              <motion.button
                key={prog.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08 }}
                onClick={() => router.push(`/participant/${prog.id}`)}
                className="ios-card bg-[#0F172A] border border-white/5 hover:border-[#FF6600]/30 hover:bg-[#0F172A]/80 !p-6 text-left transition-all group relative overflow-hidden"
              >
                {/* Hover glow */}
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#FF6600]/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="relative z-10 space-y-5">
                  {/* Top row: icon, title, badge */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[#FF6600]/10 border border-[#FF6600]/20 flex items-center justify-center flex-shrink-0">
                        <Rocket className="w-5 h-5 text-[#FF6600]" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-base font-black text-white uppercase tracking-tight truncate">
                          {prog.name || "Untitled Program"}
                        </h2>
                        {prog.description && (
                          <p className="text-[10px] text-slate-500 font-semibold mt-0.5 line-clamp-1">
                            {prog.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-[#FF6600] group-hover:translate-x-1 transition-all flex-shrink-0" />
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        Progress
                      </span>
                      <span className="text-sm font-black text-white">
                        {pct}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-[#FF6600] rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{
                          duration: 1,
                          delay: idx * 0.1,
                          ease: "easeOut",
                        }}
                      />
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-6 text-[9px] font-semibold text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-600" />
                      Week {week} of {totalWeeks}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-slate-600" />
                      {completedDels}/{totalDels} deliverables
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-slate-600" />
                      {completedSessions}/{sessionCount} sessions
                    </span>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* ─── HELP & SUPPORT FLOATING BUTTON ─── */}
        <button
          onClick={() => setShowSupport(true)}
          className="fixed bottom-6 right-6 z-[400] w-14 h-14 rounded-full bg-[#FF6600] text-black shadow-2xl shadow-[#FF6600]/30 flex items-center justify-center hover:scale-110 transition-all animate-in fade-in"
        >
          <HelpCircle className="w-6 h-6" />
        </button>

        {/* ─── TOAST ─── */}
        {toast && (
          <div
            className={`fixed bottom-24 right-6 z-[500] px-5 py-3 rounded-xl text-sm font-bold uppercase tracking-widest border shadow-2xl ${
              toast.type === "error"
                ? "bg-rose-50 text-rose-700 border-rose-200"
                : "bg-emerald-50 text-emerald-700 border-emerald-200"
            }`}
          >
            {toast.msg}
          </div>
        )}

        {/* ─── SUPPORT MODAL ─── */}
        {showSupport && (
          <div
            className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => setShowSupport(false)}
          >
            <div
              className="card w-full max-w-sm space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center">
                <h3 className="text-base font-black uppercase tracking-tight text-[var(--text-primary)]">
                  Need Help?
                </h3>
                <button onClick={() => setShowSupport(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                    Issue Category
                  </label>
                  <select
                    value={supportForm.category}
                    onChange={(e) =>
                      setSupportForm((p) => ({
                        ...p,
                        category: e.target.value,
                      }))
                    }
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-4 py-3 text-sm outline-none font-bold text-[var(--text-primary)]"
                  >
                    <option value="">Select category...</option>
                    <option value="technical">Technical Issue</option>
                    <option value="mentor">Need Mentor Support</option>
                    <option value="submission">Submission Problem</option>
                    <option value="curriculum">Curriculum Question</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                    Message
                  </label>
                  <textarea
                    value={supportForm.message}
                    onChange={(e) =>
                      setSupportForm((p) => ({ ...p, message: e.target.value }))
                    }
                    rows={4}
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-4 py-3 text-sm outline-none font-bold text-[var(--text-primary)] resize-none"
                    placeholder="Describe your issue or request..."
                  />
                </div>
              </div>
              <button
                onClick={submitSupport}
                disabled={
                  supportSending ||
                  !supportForm.category ||
                  !supportForm.message.trim()
                }
                className="w-full btn btn-primary py-4 gap-2"
              >
                {supportSending ? (
                  "Sending..."
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Send Request
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// Progress bar sub-component
function ProgressBar({ label, value, detail, color }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
          {label}
        </span>
        <span className="text-[10px] font-bold text-white">
          {value}%
          {detail && (
            <span className="text-slate-500 font-normal ml-1">· {detail}</span>
          )}
        </span>
      </div>
      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

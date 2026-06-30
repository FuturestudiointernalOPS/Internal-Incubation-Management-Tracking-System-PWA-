"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  Send,
  RefreshCw,
  CheckCircle2,
  Loader2,
  ListTodo,
  ChevronRight,
  Calendar,
  AlertCircle,
  AlertTriangle,
  PlusCircle,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function DeveloperStandup() {
  const router = useRouter();
  const [userRole, setUserRole] = useState("staff");
  const [loading, setLoading] = useState(true);
  const [existingReport, setExistingReport] = useState(null);
  const [weeklyTasks, setWeeklyTasks] = useState([]);
  const [standupData, setStandupData] = useState({
    accomplishments: "",
    plans: "",
    blockers: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [weekInfo, setWeekInfo] = useState({ week: 0, year: 0 });
  const [isMonday, setIsMonday] = useState(false);
  const [formActive, setFormActive] = useState(false);
  const [carryOverFrom, setCarryOverFrom] = useState(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("user");
      if (saved) {
        const u = JSON.parse(saved);
        setUserRole(u.role || "staff");
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    const day = new Date().getDay();
    setIsMonday(day === 1); // 1 = Monday
  }, []);

  const fetchStandup = useCallback(
    async (showAll = false, carryOver = false) => {
      setLoading(true);
      try {
        const sessionRes = await fetch("/api/auth/session");
        const sessionData = await sessionRes.json();
        if (sessionData.authenticated && sessionData.user) {
          const userId = sessionData.user.cid;
          const now = new Date();
          const weekNumber = getWeekNumber(now);
          const year = now.getFullYear();
          setWeekInfo({ week: weekNumber, year });

          let url = `/api/standups/current?user_id=${userId}&week=${weekNumber}&year=${year}`;
          if (showAll) url += "&show_all=true";
          if (carryOver) url += "&carry_over=true";

          const res = await fetch(url);
          const data = await res.json();
          if (data.success) {
            setExistingReport(data.report);
            setWeeklyTasks(data.tasks || []);

            if (data.carryOverFrom) {
              setCarryOverFrom(data.carryOverFrom);
            }

            if (data.report) {
              setStandupData({
                accomplishments: data.report.accomplishments || "",
                plans: data.report.plans || "",
                blockers: data.report.blockers || "",
              });
            }
          }
        }
      } catch (e) {
        console.error("Failed to fetch standup data", e);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // On initial load: if report exists, show all tasks; otherwise just load normally
  useEffect(() => {
    fetchStandup(false, false);
  }, [fetchStandup]);

  // When "Create New Standup" is clicked — Monday only, loads carry-over
  const handleCreateStandup = () => {
    if (!isMonday) return;
    setFormActive(true);
    setStandupData({ accomplishments: "", plans: "", blockers: "" });
    fetchStandup(false, true); // carry_over=true
  };

  // When a standup already exists, show the form with all tasks
  useEffect(() => {
    if (existingReport) {
      setFormActive(true);
      // Re-fetch with show_all=true to display completed tasks too
      fetchStandup(true, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingReport?.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const sessionRes = await fetch("/api/auth/session");
      const sessionData = await sessionRes.json();
      if (!sessionData.authenticated) {
        setError("Session expired");
        setSubmitting(false);
        return;
      }

      const userId = sessionData.user.cid;
      const now = new Date();
      const weekNumber = getWeekNumber(now);
      const year = now.getFullYear();

      const res = await fetch("/api/standups/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          user_name: sessionData.user.name,
          report_type: "standup",
          week_number: weekNumber,
          year,
          accomplishments: standupData.accomplishments,
          plans: standupData.plans,
          blockers: standupData.blockers,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
        setTimeout(() => setSubmitted(false), 3000);
        // Refresh with show_all since a report now exists
        fetchStandup(true, false);
      } else {
        setError(data.error || "Failed to submit standup");
      }
    } catch (e) {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const activeTaskCount = weeklyTasks.filter(
    (t) => t.status !== "completed" && t.status !== "archived",
  ).length;

  return (
    <DashboardLayout role={userRole} activeTab="standup">
      <div className="space-y-8 pb-20">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                Weekly Standup
              </span>
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              Standup
            </h1>
            <p className="text-xs font-bold text-[var(--text-secondary)] opacity-60">
              Week {weekInfo.week}, {weekInfo.year}
              {existingReport ? " — Update your report" : ""}
              {!isMonday && !existingReport && !formActive
                ? " — Standup available on Mondays"
                : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!formActive && !existingReport && (
              <button
                onClick={handleCreateStandup}
                disabled={!isMonday}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[9px] transition-all ${
                  isMonday
                    ? "bg-[var(--brand-orange)] text-black hover:opacity-90"
                    : "bg-secondary border border-[var(--border-primary)] text-slate-500 cursor-not-allowed"
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                Create New Standup
              </button>
            )}
            {formActive && (
              <button
                onClick={() => fetchStandup(!!existingReport, false)}
                className="flex items-center gap-2 px-4 py-2.5 bg-secondary border border-[var(--border-primary)] rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-tertiary transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            )}
          </div>
        </header>

        {!formActive && !existingReport && !loading && (
          <div className="text-center py-20">
            <MessageSquare className="w-12 h-12 text-slate-500 mx-auto mb-4 opacity-30" />
            <p className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider opacity-40">
              {isMonday
                ? "Ready for your weekly standup?"
                : "Standups are submitted on Mondays"}
            </p>
            <p className="text-[10px] font-bold text-slate-500 mt-2">
              {isMonday
                ? "Click Create New Standup to start"
                : "Come back on Monday to submit your weekly report"}
            </p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div
              className="w-6 h-6 border-2 border-t-[var(--brand-orange)] rounded-full animate-spin"
              style={{
                borderColor: "rgba(255,102,0,0.1)",
                borderTopColor: "var(--brand-orange)",
              }}
            />
          </div>
        )}

        {formActive && !loading && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Left Column: Weekly Tasks */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ListTodo className="w-4 h-4 text-[var(--brand-orange)]" />
                  <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">
                    {carryOverFrom
                      ? `Carry-Over From Week ${carryOverFrom.week}`
                      : existingReport
                        ? "This Week's Tasks"
                        : "This Week's Tasks"}
                  </h2>
                </div>
                {!carryOverFrom && (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-[var(--brand-orange)]/10 text-[var(--brand-orange)] uppercase tracking-wider">
                    {activeTaskCount} active
                  </span>
                )}
              </div>

              {weeklyTasks.length === 0 ? (
                <div className="ios-card !p-6 border-dashed border-[var(--border-primary)] text-center">
                  <p className="text-[10px] font-bold text-slate-500">
                    {carryOverFrom
                      ? "No tasks to carry over from last week"
                      : "No tasks for this week"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {weeklyTasks.map((task) => (
                    <div
                      key={task.id}
                      className="ios-card !p-3 border-[var(--border-primary)] hover:border-[var(--brand-orange)]/30 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                            task.status === "completed"
                              ? "bg-emerald-400"
                              : task.priority === "critical"
                                ? "bg-red-500"
                                : task.priority === "high"
                                  ? "bg-amber-400"
                                  : task.priority === "medium"
                                    ? "bg-blue-400"
                                    : "bg-slate-400"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p
                              className={`text-[10px] font-bold truncate ${
                                task.status === "completed"
                                  ? "text-[var(--text-secondary)] line-through opacity-60"
                                  : "text-[var(--text-primary)]"
                              }`}
                            >
                              {task.title}
                            </p>
                            {task.blockers?.length > 0 && (
                              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-[7px] font-bold px-1 py-0.5 rounded uppercase tracking-wider ${
                                task.status === "completed"
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : task.status === "in_progress"
                                    ? "bg-blue-500/10 text-blue-400"
                                    : task.status === "blocked"
                                      ? "bg-rose-500/10 text-rose-400"
                                      : task.status === "carried_over"
                                        ? "bg-purple-500/10 text-purple-400"
                                        : task.status === "pending"
                                          ? "bg-slate-500/10 text-slate-400"
                                          : "bg-slate-500/10 text-slate-400"
                              }`}
                            >
                              {task.status.replace(/_/g, " ")}
                            </span>
                            {task.priority && (
                              <span
                                className={`text-[7px] font-bold px-1 py-0.5 rounded uppercase tracking-wider ${
                                  task.priority === "critical"
                                    ? "bg-red-500/10 text-red-400"
                                    : task.priority === "high"
                                      ? "bg-amber-500/10 text-amber-400"
                                      : "bg-slate-500/10 text-slate-400"
                                }`}
                              >
                                {task.priority}
                              </span>
                            )}
                            {task.end_date && (
                              <span className="text-[7px] font-bold text-slate-500 flex items-center gap-1">
                                <Calendar className="w-2.5 h-2.5" />
                                {new Date(task.end_date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Standup Form */}
            <div className="lg:col-span-3">
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                    <p className="text-[10px] font-bold text-red-400">
                      {error}
                    </p>
                  </div>
                )}

                {submitted && (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <p className="text-[10px] font-bold text-emerald-400">
                      Standup submitted successfully!
                    </p>
                  </div>
                )}

                <div>
                  <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest block mb-2">
                    What did you accomplish?
                  </label>
                  <textarea
                    value={standupData.accomplishments}
                    onChange={(e) =>
                      setStandupData({
                        ...standupData,
                        accomplishments: e.target.value,
                      })
                    }
                    rows={4}
                    placeholder={
                      weeklyTasks.length > 0
                        ? `Progress on: ${weeklyTasks.map((t) => t.title).join(", ")}`
                        : "Describe what you worked on this week..."
                    }
                    className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 transition-all resize-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest block mb-2">
                    What are you planning to work on?
                  </label>
                  <textarea
                    value={standupData.plans}
                    onChange={(e) =>
                      setStandupData({ ...standupData, plans: e.target.value })
                    }
                    rows={4}
                    placeholder="Your plan for the next days..."
                    className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 transition-all resize-none"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest block mb-2">
                    Any blockers?
                  </label>
                  <textarea
                    value={standupData.blockers}
                    onChange={(e) =>
                      setStandupData({
                        ...standupData,
                        blockers: e.target.value,
                      })
                    }
                    rows={3}
                    placeholder="Anything blocking your progress..."
                    className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 transition-all resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--brand-orange)] text-black text-[9px] font-black uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />{" "}
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />{" "}
                      {existingReport ? "Update Standup" : "Submit Standup"}
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7,
    )
  );
}

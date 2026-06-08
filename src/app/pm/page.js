"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  Rocket,
  Layers,
  Target,
  Activity,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Shield,
  Zap,
  Search,
  Filter,
  Users,
  LayoutDashboard,
  Settings,
  MessageSquare,
  TrendingUp,
  Send,
  Mail,
  Briefcase,
  Clock,
  ListTodo,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useI18n } from "@/lib/i18n";

/**
 * PROJECT MANAGER OPERATIONS HUB ÔÇö OPTIMIZED (V3)
 * High-density tabular interface for zero-latency program governance.
 */
export default function PMDashboard() {
  const router = useRouter();
  const [programs, setPrograms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stats, setStats] = useState({
    totalParticipants: 0,
    activeDeliverables: 0,
    averageEngagement: "0%",
  });
  const [schedule, setSchedule] = useState([]);
  const [pmProjects, setPmProjects] = useState([]);
  const [pmProjectsLoading, setPmProjectsLoading] = useState(true);
  const [pmTasks, setPmTasks] = useState([]);
  const [pmTaskLoading, setPmTaskLoading] = useState(false);
  const [pmBlockers, setPmBlockers] = useState([]);
  const [pmBlockersLoading, setPmBlockersLoading] = useState(false);
  const [resolvingPmBlocker, setResolvingPmBlocker] = useState(null);
  const { t } = useI18n();

  // Calendar state
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedTask, setSelectedTask] = useState(null);

  const handlePrevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear(calYear - 1);
    } else setCalMonth(calMonth - 1);
  };
  const handleNextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear(calYear + 1);
    } else setCalMonth(calMonth + 1);
  };

  function formatDate(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  function getCalendarDays(year, month) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const days = [];
    for (let i = 0; i < startPad; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);
    return days;
  }
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const pmCalendarDays = getCalendarDays(calYear, calMonth);

  const pmCalendarTasks = React.useMemo(() => {
    const cal = {};
    (pmTasks || []).forEach((task) => {
      if (task.start_date || task.end_date) {
        const start = task.start_date ? new Date(task.start_date) : null;
        const end = task.end_date ? new Date(task.end_date) : null;
        if (start && end) {
          const current = new Date(start);
          while (current <= end) {
            const key = formatDate(
              current.getFullYear(),
              current.getMonth(),
              current.getDate(),
            );
            if (!cal[key]) cal[key] = [];
            cal[key].push(task);
            current.setDate(current.getDate() + 1);
          }
        } else if (start) {
          const key = formatDate(
            start.getFullYear(),
            start.getMonth(),
            start.getDate(),
          );
          if (!cal[key]) cal[key] = [];
          cal[key].push(task);
        } else if (end) {
          const key = formatDate(
            end.getFullYear(),
            end.getMonth(),
            end.getDate(),
          );
          if (!cal[key]) cal[key] = [];
          cal[key].push(task);
        }
      }
    });
    return cal;
  }, [pmTasks]);

  function isToday(d) {
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  }

  const STATUS_CONFIG = {
    pending: {
      label: "Pending",
      color: "text-slate-400",
      bg: "bg-slate-500/10",
      dot: "bg-slate-400",
    },
    in_progress: {
      label: "Active",
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      dot: "bg-blue-400",
    },
    blocked: {
      label: "Blocked",
      color: "text-rose-400",
      bg: "bg-rose-500/10",
      dot: "bg-rose-400",
    },
    completed: {
      label: "Done",
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      dot: "bg-emerald-400",
    },
    carried_over: {
      label: "Carryover",
      color: "text-indigo-400",
      bg: "bg-indigo-500/10",
      dot: "bg-indigo-400",
    },
  };

  // Fetch projects where user is owner
  const fetchPmProjects = async (userId) => {
    setPmProjectsLoading(true);
    try {
      const res = await fetch("/api/admin/projects");
      const data = await res.json();
      if (data.success) {
        const all = data.projects || [];
        const owned = all.filter((p) => {
          if (p.owner_id && String(p.owner_id) === String(userId)) return true;
          if (p.meta) {
            try {
              const m =
                typeof p.meta === "string" ? JSON.parse(p.meta) : p.meta;
              if (
                m.assigned_pm_id &&
                String(m.assigned_pm_id) === String(userId)
              )
                return true;
            } catch (e) {}
          }
          return false;
        });
        setPmProjects(owned);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPmProjectsLoading(false);
    }
  };

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/session");
        const data = await res.json();
        if (
          !data.authenticated ||
          (data.user.role !== "program_manager" &&
            data.user.role !== "super_admin")
        ) {
          router.replace("/login");
          return;
        }
        fetchPMPrograms(data.user.cid);
        fetchGlobalSchedule();
      } catch {
        router.replace("/login");
      }
    }
    checkAuth();
  }, [router]);

  // Fetch PM projects after auth
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const userId = user.cid || user.id;
    if (userId) fetchPmProjects(userId);
  }, []);

  // Fetch tasks for calendar
  useEffect(() => {
    async function fetchTasks() {
      try {
        const res = await fetch("/api/tasks?brief=true");
        const data = await res.json();
        if (data.success) setPmTasks(data.tasks || []);
      } catch (e) {}
    }
    fetchTasks();
  }, []);

  // Fetch blockers for dashboard
  const fetchPmBlockers = useCallback(async () => {
    setPmBlockersLoading(true);
    try {
      const res = await fetch("/api/admin/blockers?status=active");
      const data = await res.json();
      if (data.success) setPmBlockers(data.blockers || []);
    } catch (e) {
      console.error(e);
    } finally {
      setPmBlockersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPmBlockers();
  }, [fetchPmBlockers]);

  const handleResolvePmBlocker = async (blockerId) => {
    setResolvingPmBlocker(blockerId);
    try {
      await fetch("/api/admin/blockers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: blockerId, resolved_by: "sa" }),
      });
      fetchPmBlockers();
    } catch (e) {
      console.error(e);
    } finally {
      setResolvingPmBlocker(null);
    }
  };

  const fetchGlobalSchedule = async () => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const identifier = user.cid || user.id;
      const res = await fetch(
        `/api/pm/schedule?pm_id=${identifier}&is_lead_pm=${user.isLeadPM}`,
      );
      const data = await res.json();
      if (data.success) {
        setSchedule(data.schedule || []);
      }
    } catch (e) {}
  };

  const fetchPMPrograms = async (pmId) => {
    try {
      const res = await fetch("/api/pm/programs?assigned_pm_id=" + pmId);
      const data = await res.json();

      if (data.success) {
        setPrograms(data.programs || []);
        const participants = (data.programs || []).reduce(
          (acc, p) => acc + (p.participant_count || 0),
          0,
        );
        setStats({
          totalParticipants: participants,
          activeDeliverables: (data.programs || []).length * 8,
          averageEngagement: "84%",
        });
      }
      setIsLoading(false);
    } catch (e) {
      console.error(e);
      setIsLoading(false);
    }
  };

  if (isLoading)
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "var(--bg-primary)" }}
      >
        <div
          className="w-12 h-12 border-4 border-t-[var(--brand-orange)] rounded-full animate-spin"
          style={{
            borderColor: "rgba(255, 102, 0, 0.1)",
            borderTopColor: "var(--brand-orange)",
          }}
        />
      </div>
    );

  const filtered = programs.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <DashboardLayout role="program_manager" activeTab="v2">
      <div className="space-y-10 pb-20 text-left">
        {/* EXECUTIVE HEADER */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-white/5 pb-10">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#FF6600]" />
              <span className="text-[10px] font-black text-[#FF6600] uppercase tracking-[0.4em]">
                {t("pm.dashboard")}
              </span>
            </div>
            <h1
              className="text-5xl font-black tracking-tighter uppercase italic"
              style={{ color: "var(--text-primary)" }}
            >
              {t("pm.dashboard")}
            </h1>
          </div>

          <div className="flex gap-4">
            <div
              className="p-4 rounded-2xl px-8 flex flex-col justify-center border"
              style={{
                background: "var(--bg-secondary)",
                borderColor: "var(--border-primary)",
              }}
            >
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 italic">
                {t("pm.teamOverview")}
              </span>
              <span className="text-emerald-500 font-black text-xs uppercase italic flex items-center gap-2">
                <Activity className="w-3 h-3" /> {t("status.active")}
              </span>
            </div>
          </div>
        </header>

        {/* ═══════ CALENDAR ═══════ */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#FF6600]" />
              <span
                className="text-xs font-black uppercase tracking-wider"
                style={{ color: "var(--text-primary)" }}
              >
                {MONTHS[calMonth]} {calYear}
              </span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={handlePrevMonth}
                className="p-1 rounded hover:bg-white/5 transition-all"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setCalMonth(now.getMonth());
                  setCalYear(now.getFullYear());
                }}
                className="px-2.5 py-1 rounded text-[8px] font-black uppercase tracking-widest hover:bg-white/5 transition-all"
              >
                Today
              </button>
              <button
                onClick={handleNextMonth}
                className="p-1 rounded hover:bg-white/5 transition-all"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-px bg-white/5 rounded-lg overflow-hidden">
            {DAYS.map((d) => (
              <div
                key={d}
                className="p-1.5 text-center"
                style={{ background: "var(--bg-primary)" }}
              >
                <span
                  className="text-[7px] font-black uppercase tracking-widest"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {d}
                </span>
              </div>
            ))}
            {pmCalendarDays.map((day, idx) => {
              if (day === null)
                return (
                  <div
                    key={`empty-${idx}`}
                    className="p-1.5 min-h-[60px]"
                    style={{ background: "var(--bg-primary)" }}
                  />
                );
              const dateStr = formatDate(calYear, calMonth, day);
              const dayTasks = pmCalendarTasks[dateStr] || [];
              const isCurrent = isToday(new Date(calYear, calMonth, day));
              const isPast =
                new Date(calYear, calMonth, day) <
                new Date(new Date().toDateString());
              return (
                <div
                  key={dateStr}
                  className={`p-1 min-h-[60px] transition-all ${isCurrent ? "ring-1 ring-[#FF6600]/40" : ""} ${isPast ? "opacity-50" : ""}`}
                  style={{ background: "var(--bg-primary)" }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[8px] font-bold ${isCurrent ? "text-[#FF6600]" : ""}`}
                      style={{
                        color: isCurrent ? "" : "var(--text-secondary)",
                      }}
                    >
                      {day}
                    </span>
                    {dayTasks.length > 0 && (
                      <span
                        className="text-[7px] font-bold"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {dayTasks.length}
                      </span>
                    )}
                  </div>
                  <div className="space-y-0.5 mt-0.5">
                    {dayTasks.slice(0, 1).map((task) => (
                      <button
                        key={task.id}
                        onClick={() => setSelectedTask(task)}
                        className="w-full text-left px-1 py-0.5 rounded text-[7px] font-bold truncate leading-tight hover:brightness-110 transition-all"
                        style={{
                          backgroundColor:
                            task.status === "in_progress"
                              ? "rgba(59,130,246,0.1)"
                              : task.status === "blocked"
                                ? "rgba(244,63,94,0.1)"
                                : task.status === "completed"
                                  ? "rgba(16,185,129,0.1)"
                                  : "rgba(100,116,139,0.1)",
                          color:
                            task.status === "in_progress"
                              ? "#60a5fa"
                              : task.status === "blocked"
                                ? "#fb7185"
                                : task.status === "completed"
                                  ? "#34d399"
                                  : "#94a3b8",
                        }}
                      >
                        {task.title}
                      </button>
                    ))}
                    {dayTasks.length > 1 && (
                      <span
                        className="text-[6px]"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        +{dayTasks.length - 1}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* METRICS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              label: t("pm.dashboard"),
              value: stats.totalParticipants,
              icon: Users,
              color: "text-[#FF6600]",
            },
            {
              label: t("admin.activePrograms"),
              value: stats.activeDeliverables,
              icon: Target,
              color: "text-[#FF6600]",
            },
            {
              label: t("pm.teamOverview"),
              value: stats.averageEngagement,
              icon: TrendingUp,
              color: "text-emerald-400",
            },
          ].map((stat, i) => (
            <div key={i} className="card !p-8 group">
              <div className="flex justify-between items-center mb-4">
                <stat.icon className={`w-6 h-6 ${stat.color} opacity-40`} />
                <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest italic">
                  {t("time.thisWeek")}
                </span>
              </div>
              <h4
                className="text-4xl font-black italic tracking-tighter"
                style={{ color: "var(--text-primary)" }}
              >
                {stat.value}
              </h4>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-2 italic">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* TACTICAL CONTROLS */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div
            className="flex gap-4 p-1 rounded-xl border"
            style={{
              background: "var(--bg-secondary)",
              borderColor: "var(--border-primary)",
            }}
          >
            <button className="px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-[#FF6600] text-black">
              {t("admin.activePrograms")}
            </button>
            <button
              onClick={() =>
                document
                  .getElementById("pm-calendar")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              className="px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-[var(--text-primary)] transition-all"
            >
              {t("time.thisMonth")}
            </button>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("common.search")}
              className="w-full border rounded-xl py-3.5 pl-12 pr-4 text-xs font-bold outline-none focus:border-[#FF6600]/50 transition-all"
              style={{
                background: "var(--bg-secondary)",
                borderColor: "var(--border-primary)",
                color: "var(--text-primary)",
              }}
            />
          </div>
        </div>

        {/* HIGH-DENSITY PROGRAM TABLE */}
        <div className="table-container shadow-none">
          <table className="data-table w-full border-collapse">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/5">
                <th className="px-8 py-6 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest italic">
                  {t("pm.programs")}
                </th>
                <th className="px-8 py-6 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest italic">
                  {t("status.active")}
                </th>
                <th className="px-8 py-6 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest italic">
                  {t("pm.teamOverview")}
                </th>
                <th className="px-8 py-6 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest italic">
                  {t("time.created")}
                </th>
                <th className="px-8 py-6 text-right text-[9px] font-black text-slate-500 uppercase tracking-widest italic">
                  {t("common.submit")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className="group cursor-pointer hover:bg-white/[0.03] transition-all"
                  onClick={() => router.push(`/pm/programs/${p.id}`)}
                >
                  <td className="px-8 py-8">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF6600]/20 to-transparent border border-[#FF6600]/20 flex items-center justify-center text-[#FF6600]">
                        <Briefcase className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col">
                        <span
                          className="text-base font-black uppercase italic tracking-tighter"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {p.name}
                        </span>
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-1 italic line-clamp-1">
                          {p.description || t("status.active")}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-8">
                    <div className="flex flex-col">
                      <span
                        className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest inline-block w-fit ${p.status === "active" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-slate-500/10 text-slate-500"}`}
                      >
                        {p.status || t("status.active")}
                      </span>
                      <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest mt-2 italic flex items-center gap-1">
                        <Clock className="w-2 h-2" /> {t("time.created")}:
                        {new Date(p.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-8">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 border"
                        style={{
                          background: "var(--bg-primary)",
                          borderColor: "var(--border-primary)",
                        }}
                      >
                        <Users className="w-4 h-4" />
                      </div>
                      <span
                        className="text-xs font-black italic"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {p.participant_count || 0} {t("pm.teamOverview")}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-8">
                    <div className="space-y-3 w-40">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-black text-slate-600 uppercase italic">
                          {t("status.completed")}
                        </span>
                        <span className="text-[10px] font-black text-[#FF6600] italic">
                          {Math.round(p.completion_index || 0)}%
                        </span>
                      </div>
                      <div
                        className="h-1.5 w-full rounded-full overflow-hidden"
                        style={{ background: "var(--bg-tertiary)" }}
                      >
                        <div
                          className="h-full bg-[#FF6600] transition-all duration-1000"
                          style={{ width: `${p.completion_index || 0}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-8 text-right">
                    <div
                      className="inline-flex items-center justify-center p-3 rounded-xl border text-slate-700 group-hover:text-[#FF6600] group-hover:border-[#FF6600]/30 transition-all"
                      style={{
                        background: "var(--bg-secondary)",
                        borderColor: "var(--border-primary)",
                      }}
                    >
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan="5"
                    className="px-8 py-20 text-center text-slate-700 uppercase font-black italic tracking-widest"
                  >
                    {t("common.noResults")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* MY PROJECTS */}
        <div className="table-container shadow-none">
          <div className="flex items-center justify-between px-8 py-6">
            <div className="flex items-center gap-2">
              <Rocket className="w-5 h-5 text-[#FF6600]" />
              <span
                className="text-base font-black uppercase italic tracking-tighter"
                style={{ color: "var(--text-primary)" }}
              >
                My Projects
              </span>
            </div>
            {pmProjects.length > 0 && (
              <span className="text-[10px] font-black text-slate-500 uppercase italic">
                {pmProjects.length} total
              </span>
            )}
          </div>
          {pmProjectsLoading ? (
            <div className="px-8 py-20 text-center">
              <p className="text-[10px] text-slate-500 italic">
                Loading projects...
              </p>
            </div>
          ) : pmProjects.length === 0 ? (
            <div className="px-8 py-20 text-center">
              <p className="text-[10px] text-slate-500 italic">
                No projects yet
              </p>
            </div>
          ) : (
            <table className="data-table w-full border-collapse">
              <thead>
                <tr className="bg-white/[0.02] border-b border-white/5">
                  <th className="px-8 py-6 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest italic">
                    Project
                  </th>
                  <th className="px-8 py-6 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest italic">
                    Status
                  </th>
                  <th className="px-8 py-6 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest italic">
                    Tasks
                  </th>
                  <th className="px-8 py-6 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest italic">
                    Blockers
                  </th>
                  <th className="px-8 py-6 text-center text-[9px] font-black text-slate-500 uppercase tracking-widest italic">
                    Progress
                  </th>
                  <th className="px-8 py-6 text-right text-[9px] font-black text-slate-500 uppercase tracking-widest italic"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {pmProjects.map((project) => {
                  const total = project.taskStats?.total || 0;
                  const completed = project.taskStats?.completed || 0;
                  const rate =
                    total > 0 ? Math.round((completed / total) * 100) : 0;
                  return (
                    <tr
                      key={project.id}
                      className="group cursor-pointer hover:bg-white/[0.03] transition-all"
                      onClick={() =>
                        router.push(`/admin/projects/${project.id}`)
                      }
                    >
                      <td className="px-8 py-8">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF6600]/20 to-transparent border border-[#FF6600]/20 flex items-center justify-center text-[#FF6600]">
                            <Rocket className="w-5 h-5" />
                          </div>
                          <div className="flex flex-col">
                            <span
                              className="text-base font-black uppercase italic tracking-tighter"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {project.name}
                            </span>
                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-1 italic">
                              {project.type || "Internal"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-8">
                        <span
                          className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest inline-block ${project.status === "Active" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : project.status === "Paused" ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : "bg-slate-500/10 text-slate-500 border border-slate-500/20"}`}
                        >
                          {project.status || "Active"}
                        </span>
                      </td>
                      <td className="px-8 py-8">
                        <span
                          className="text-sm font-black italic"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {total}
                        </span>
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1 italic">
                          tasks
                        </span>
                      </td>
                      <td className="px-8 py-8">
                        {(project.blockerStats?.active || 0) > 0 ? (
                          <span className="text-sm font-black italic text-rose-500">
                            {project.blockerStats.active} active
                          </span>
                        ) : (
                          <span className="text-[10px] font-black text-slate-600 italic">
                            None
                          </span>
                        )}
                      </td>
                      <td className="px-8 py-8 text-center">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-[9px] font-black text-slate-600 uppercase italic">
                              Complete
                            </span>
                            <span className="text-[10px] font-black text-[#FF6600] italic">
                              {rate}%
                            </span>
                          </div>
                          <div
                            className="h-1.5 w-full rounded-full overflow-hidden"
                            style={{ background: "var(--bg-tertiary)" }}
                          >
                            <div
                              className="h-full bg-[#FF6600] transition-all duration-1000"
                              style={{ width: `${rate}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-8 text-right">
                        <div
                          className="inline-flex items-center justify-center p-3 rounded-xl border text-slate-700 group-hover:text-[#FF6600] group-hover:border-[#FF6600]/30 transition-all"
                          style={{
                            background: "var(--bg-secondary)",
                            borderColor: "var(--border-primary)",
                          }}
                        >
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ═══════ MY TASKS ═══════ */}
        {(() => {
          if (pmTaskLoading || !pmTasks) return null;
          const today = new Date();
          const todayStr = formatDate(
            today.getFullYear(),
            today.getMonth(),
            today.getDate(),
          );
          const endOfWeek = new Date(today);
          endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
          const overdue = (pmTasks || []).filter(
            (t) =>
              t.end_date &&
              new Date(t.end_date) < today &&
              t.status !== "completed",
          );
          const todayTasks = (pmTasks || []).filter((t) => {
            if (!t.end_date) return false;
            const d = new Date(t.end_date);
            return (
              d.toDateString() === today.toDateString() &&
              t.status !== "completed"
            );
          });
          const weekTasks = (pmTasks || []).filter((t) => {
            if (!t.end_date || t.status === "completed") return false;
            const d = new Date(t.end_date);
            return d > today && d <= endOfWeek;
          });
          if (
            overdue.length === 0 &&
            todayTasks.length === 0 &&
            weekTasks.length === 0
          )
            return null;
          return (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <ListTodo className="w-4 h-4 text-[#FF6600]" />
                <span
                  className="text-sm font-black uppercase italic"
                  style={{ color: "var(--text-primary)" }}
                >
                  My Tasks
                </span>
              </div>
              <div className="space-y-2">
                {overdue.length > 0 && (
                  <div>
                    <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest mb-1">
                      Overdue ({overdue.length})
                    </p>
                    {overdue.slice(0, 3).map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center gap-2 p-2 rounded-lg bg-rose-500/5 border border-rose-500/10 mb-1"
                      >
                        <span className="text-[10px] font-bold text-[var(--text-primary)] flex-1 truncate">
                          {t.title}
                        </span>
                        <span className="text-[8px] text-rose-400">
                          {t.end_date}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {todayTasks.length > 0 && (
                  <div>
                    <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-1">
                      Due Today ({todayTasks.length})
                    </p>
                    {todayTasks.slice(0, 3).map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/10 mb-1"
                      >
                        <span className="text-[10px] font-bold text-[var(--text-primary)] flex-1 truncate">
                          {t.title}
                        </span>
                        <span className="text-[8px] text-amber-400">
                          {t.end_date}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {weekTasks.length > 0 && (
                  <div>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Due This Week ({weekTasks.length})
                    </p>
                    {weekTasks.slice(0, 3).map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-tertiary border border-[var(--border-primary)] mb-1"
                      >
                        <span className="text-[10px] font-bold text-[var(--text-primary)] flex-1 truncate">
                          {t.title}
                        </span>
                        <span className="text-[8px] text-slate-500">
                          {t.end_date}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ═══════ MY BLOCKERS ═══════ */}
        {pmBlockers.length > 0 && !pmBlockersLoading && (
          <div className="card border-l-4 border-l-rose-500">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-rose-500" />
              <span
                className="text-sm font-black uppercase italic"
                style={{ color: "var(--text-primary)" }}
              >
                My Blockers
              </span>
              <span className="text-[9px] font-bold text-slate-500 ml-auto">
                {pmBlockers.length} active
              </span>
            </div>
            <div className="space-y-1.5">
              {pmBlockers
                .sort((a, b) => {
                  const order = { critical: 0, high: 1, medium: 2, low: 3 };
                  return (order[a.severity] || 99) - (order[b.severity] || 99);
                })
                .map((blocker) => (
                  <div
                    key={blocker.id}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-rose-500/[0.03] border border-rose-500/10"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-[var(--text-primary)]">
                          {blocker.title}
                        </span>
                        {blocker.severity && (
                          <span
                            className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded ${blocker.severity === "critical" || blocker.severity === "high" ? "bg-rose-500/10 text-rose-500" : "bg-slate-500/10 text-slate-500"}`}
                          >
                            {blocker.severity}
                          </span>
                        )}
                      </div>
                      <p className="text-[8px] text-slate-500 mt-0.5">
                        {blocker.task_title && <>Task: {blocker.task_title}</>}
                        {blocker.task_owner && (
                          <> · Owner: {blocker.task_owner}</>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => handleResolvePmBlocker(blocker.id)}
                      disabled={resolvingPmBlocker === blocker.id}
                      className="px-3 py-1.5 bg-emerald-500 text-black rounded-lg text-[8px] font-black uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-50 shrink-0"
                    >
                      {resolvingPmBlocker === blocker.id ? "..." : "Resolve"}
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* CALENDAR QUICK VIEW */}
        <div
          id="pm-calendar"
          className="grid grid-cols-1 lg:grid-cols-2 gap-8 scroll-mt-10"
        >
          <div className="card !p-10 space-y-8">
            <div className="flex items-center justify-between">
              <h3
                className="text-xl font-black uppercase italic tracking-tighter"
                style={{ color: "var(--text-primary)" }}
              >
                {t("admin.viewAllPrograms")}
              </h3>
              <span className="text-[10px] font-black text-[#FF6600] uppercase tracking-widest italic">
                {t("time.thisWeek")}
              </span>
            </div>
            <div className="space-y-4">
              {schedule.slice(0, 4).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-6 p-4 rounded-2xl border hover:bg-tertiary transition-all"
                  style={{
                    background: "var(--bg-secondary)",
                    borderColor: "var(--border-primary)",
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex flex-col items-center justify-center text-[9px] font-black uppercase border"
                    style={{
                      background: "var(--bg-primary)",
                      borderColor: "var(--border-primary)",
                    }}
                  >
                    <span className="text-[#FF6600]">
                      {new Date(item.scheduled_date).getDate()}
                    </span>
                    <span className="text-slate-600 text-[6px]">
                      {new Date(item.scheduled_date).toLocaleString("default", {
                        month: "short",
                      })}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p
                      className="text-xs font-black uppercase italic"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {item.title}
                    </p>
                    <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mt-1">
                      {item.program_name}
                    </p>
                  </div>
                </div>
              ))}
              {schedule.length === 0 && (
                <p className="text-[10px] font-black text-slate-800 italic uppercase">
                  {t("common.noResults")}
                </p>
              )}
            </div>
          </div>

          <div
            className="card !p-10 flex flex-col justify-between border-dashed"
            style={{
              background: "rgba(255, 102, 0, 0.02)",
              borderColor: "var(--brand-orange)",
            }}
          >
            <div className="space-y-4 text-left">
              <h3
                className="text-2xl font-black uppercase italic tracking-tighter"
                style={{ color: "var(--text-primary)" }}
              >
                {t("navigation.communication")}
              </h3>
              <p className="text-xs font-bold text-slate-400 uppercase leading-relaxed tracking-tight">
                {t("navigation.communication")}
              </p>
            </div>
            <button
              onClick={() => router.push("/pm/communications/contacts")}
              className="w-full bg-[#FF6600] text-black font-black uppercase italic tracking-widest py-5 rounded-2xl hover:bg-black hover:text-white transition-all flex items-center justify-center gap-3 mt-10"
            >
              <MessageSquare className="w-5 h-5" />{" "}
              {t("navigation.communication")}
            </button>
          </div>
        </div>
      </div>

      {/* ═══════ TASK DETAIL DRAWER ═══════ */}
      {selectedTask && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          onClick={() => setSelectedTask(null)}
        >
          <div
            className="card w-full max-w-lg space-y-5 border-[#FF6600]/30 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start">
              <div>
                <h3
                  className="text-lg font-black"
                  style={{ color: "var(--text-primary)" }}
                >
                  {selectedTask.title}
                </h3>
                <p className="text-[10px] text-slate-500 mt-1">
                  Status: {selectedTask.status?.replace(/_/g, " ")}
                </p>
              </div>
              <button
                onClick={() => setSelectedTask(null)}
                className="p-1 hover:bg-white/5 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {selectedTask.start_date && (
                <div
                  className="p-3 rounded-xl border"
                  style={{
                    background: "var(--bg-tertiary)",
                    borderColor: "var(--border-primary)",
                  }}
                >
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                    Start
                  </p>
                  <p
                    className="text-xs font-bold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {new Date(selectedTask.start_date).toLocaleDateString()}
                  </p>
                </div>
              )}
              {selectedTask.end_date && (
                <div
                  className="p-3 rounded-xl border"
                  style={{
                    background: "var(--bg-tertiary)",
                    borderColor: "var(--border-primary)",
                  }}
                >
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                    Due
                  </p>
                  <p
                    className="text-xs font-bold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {new Date(selectedTask.end_date).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
            {selectedTask.description && (
              <div
                className="p-3 rounded-xl border"
                style={{
                  background: "var(--bg-tertiary)",
                  borderColor: "var(--border-primary)",
                }}
              >
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  Description
                </p>
                <p
                  className="text-xs font-bold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {selectedTask.description}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

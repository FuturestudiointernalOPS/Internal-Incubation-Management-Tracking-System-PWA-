"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  BarChart3,
  Search,
  Filter,
  Users,
  ArrowLeft,
  ListTodo,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Briefcase,
  TrendingUp,
  User,
  ChevronDown,
  ChevronRight,
  Target,
  Activity,
} from "lucide-react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { useI18n } from "@/lib/i18n";

const STATUS_CONFIG = {
  pending: { label: "Pending", color: "text-slate-400", bg: "bg-slate-500/10" },
  in_progress: {
    label: "Active",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  blocked: { label: "Blocked", color: "text-rose-400", bg: "bg-rose-500/10" },
  completed: {
    label: "Done",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  carried_over: {
    label: "Carryover",
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
  },
};

const SEVERITY_COLORS = {
  low: "text-slate-400 bg-slate-500/10",
  medium: "text-amber-400 bg-amber-500/10",
  high: "text-rose-400 bg-rose-500/10",
  critical: "text-red-400 bg-red-500/10",
};

function getWeekNumber(date) {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

export default function AdminIntelligence() {
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Raw data
  const [tasks, setTasks] = useState([]);
  const [blockers, setBlockers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [reports, setReports] = useState([]);
  const [contacts, setContacts] = useState([]);

  // UI state
  const [expandedStaff, setExpandedStaff] = useState(null);
  const [expandedProject, setExpandedProject] = useState(null);

  // Filters
  const [filterWeek, setFilterWeek] = useState("all");
  const [filterStaff, setFilterStaff] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [filterProgram, setFilterProgram] = useState("");
  const [filterBlockerType, setFilterBlockerType] = useState("");

  const fetchAll = useCallback(async () => {
    setRefreshing(true);
    try {
      const [tRes, bRes, pRes, pgRes, rRes, cRes] = await Promise.all([
        fetch("/api/tasks"),
        fetch("/api/blockers"),
        fetch("/api/projects"),
        fetch("/api/programs"),
        fetch("/api/op-reports"),
        fetch("/api/contacts"),
      ]);
      const tData = await tRes.json();
      const bData = await bRes.json();
      const pData = await pRes.json();
      const pgData = await pgRes.json();
      const rData = await rRes.json();
      const cData = await cRes.json();
      if (tData.success) setTasks(tData.tasks || []);
      if (bData.success) setBlockers(bData.blockers || []);
      if (pData.success) setProjects(pData.projects || []);
      if (pgData.success) setPrograms(pgData.programs || []);
      if (rData.success) setReports(rData.reports || []);
      if (cData.success) setContacts(cData.contacts || []);
    } catch (e) {
      console.error("Intelligence fetch error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Build lookup maps
  const projectMap = useMemo(() => {
    const m = {};
    projects.forEach((p) => {
      m[p.id] = p;
    });
    return m;
  }, [projects]);

  const programMap = useMemo(() => {
    const m = {};
    programs.forEach((p) => {
      m[p.id] = p;
    });
    return m;
  }, [programs]);

  const contactMap = useMemo(() => {
    const m = {};
    contacts.forEach((c) => {
      m[c.cid || c.id] = c;
    });
    return m;
  }, [contacts]);

  const staffList = useMemo(() => {
    const seen = {};
    tasks.forEach((t) => {
      if (t.user_id && !seen[t.user_id]) {
        seen[t.user_id] = {
          id: t.user_id,
          name: t.user_name || t.user_id,
          ...(contactMap[t.user_id] || {}),
        };
      }
    });
    blockers.forEach((b) => {
      if (b.user_id && !seen[b.user_id]) {
        seen[b.user_id] = {
          id: b.user_id,
          name: b.user_name || b.user_id,
          ...(contactMap[b.user_id] || {}),
        };
      }
    });
    return Object.values(seen).sort((a, b) =>
      (a.name || "").localeCompare(b.name || ""),
    );
  }, [tasks, blockers, contactMap]);

  // ─── FILTERED DATA ───
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filterStaff && t.user_id !== filterStaff) return false;
      if (filterProject && String(t.project_id) !== filterProject) return false;
      if (filterProgram) {
        const proj = projectMap[t.project_id];
        if (!proj || String(proj.program_id) !== filterProgram) return false;
      }
      if (filterWeek === "current") {
        const cw = getWeekNumber(new Date());
        if (
          t.created_week !== cw &&
          t.created_year !== new Date().getFullYear()
        )
          return false;
      } else if (filterWeek === "last") {
        const cw = getWeekNumber(new Date()) - 1;
        const cy =
          cw < 1 ? new Date().getFullYear() - 1 : new Date().getFullYear();
        const actualWeek = cw < 1 ? 52 : cw;
        if (t.created_week !== actualWeek && t.created_year !== cy)
          return false;
      } else if (filterWeek === "month") {
        const d = new Date(t.created_at);
        const now = new Date();
        if (
          d.getMonth() !== now.getMonth() ||
          d.getFullYear() !== now.getFullYear()
        )
          return false;
      }
      return true;
    });
  }, [
    tasks,
    filterStaff,
    filterProject,
    filterProgram,
    filterWeek,
    projectMap,
  ]);

  const filteredBlockers = useMemo(() => {
    return blockers.filter((b) => {
      if (filterBlockerType && b.severity !== filterBlockerType) return false;
      if (filterStaff && b.user_id !== filterStaff) return false;
      return true;
    });
  }, [blockers, filterBlockerType, filterStaff]);

  // ─── KPI METRICS ───
  const kpiMetrics = useMemo(() => {
    const total = filteredTasks.length;
    const completed = filteredTasks.filter(
      (t) => t.status === "completed",
    ).length;
    const active = filteredTasks.filter(
      (t) => t.status === "in_progress" || t.status === "blocked",
    ).length;
    const carried = filteredTasks.filter(
      (t) => t.status === "carried_over",
    ).length;
    const activeBlockers = filteredBlockers.filter(
      (b) => b.status === "active",
    ).length;
    const activeStaff = new Set(
      filteredTasks
        .filter((t) => t.status !== "completed")
        .map((t) => t.user_id),
    ).size;
    return {
      totalTasks: total,
      completedTasks: completed,
      activeTasks: active,
      activeBlockers,
      carryOverRate: total > 0 ? ((carried / total) * 100).toFixed(0) : "0",
      activeStaff,
    };
  }, [filteredTasks, filteredBlockers]);

  // ─── STAFF PERFORMANCE ───
  const staffMetrics = useMemo(() => {
    const map = {};
    filteredTasks.forEach((t) => {
      if (!map[t.user_id])
        map[t.user_id] = {
          id: t.user_id,
          name: t.user_name || t.user_id,
          total: 0,
          completed: 0,
          carried: 0,
          activeBlockers: 0,
          tasks: [],
        };
      map[t.user_id].total++;
      if (t.status === "completed") map[t.user_id].completed++;
      if (t.status === "carried_over") map[t.user_id].carried++;
      map[t.user_id].tasks.push(t);
    });
    filteredBlockers.forEach((b) => {
      if (map[b.user_id]) {
        if (b.status === "active") map[b.user_id].activeBlockers++;
      }
    });
    const arr = Object.values(map);
    arr.forEach((s) => {
      s.completionRate =
        s.total > 0 ? ((s.completed / s.total) * 100).toFixed(0) : 0;
    });
    return arr.sort((a, b) => a.completionRate - b.completionRate);
  }, [filteredTasks, filteredBlockers]);

  // ─── PROJECT PERFORMANCE ───
  const projectMetrics = useMemo(() => {
    const map = {};
    filteredTasks.forEach((t) => {
      if (!t.project_id) return;
      const pid = String(t.project_id);
      if (!map[pid])
        map[pid] = {
          id: pid,
          total: 0,
          completed: 0,
          carried: 0,
          activeBlockers: 0,
          staff: new Set(),
          weeks: {},
        };
      map[pid].total++;
      if (t.status === "completed") {
        map[pid].completed++;
        const wk = `${t.created_year}-W${String(t.created_week).padStart(2, "0")}`;
        map[pid].weeks[wk] = (map[pid].weeks[wk] || 0) + 1;
      }
      if (t.status === "carried_over") map[pid].carried++;
      if (t.user_name) map[pid].staff.add(t.user_name);
    });
    filteredBlockers.forEach((b) => {
      const t = filteredTasks.find((x) => x.id === b.task_id);
      if (t && t.project_id && map[String(t.project_id)]) {
        if (b.status === "active") map[String(t.project_id)].activeBlockers++;
      }
    });
    const arr = Object.values(map);
    arr.forEach((p) => {
      p.completionRate =
        p.total > 0 ? ((p.completed / p.total) * 100).toFixed(0) : 0;
      const weekCount = Object.keys(p.weeks).length;
      p.velocity = weekCount > 0 ? (p.completed / weekCount).toFixed(1) : "0";
      p.staffList = Array.from(p.staff);
      const rate = parseInt(p.completionRate);
      p.health =
        rate > 70 && p.activeBlockers === 0
          ? "on_track"
          : rate > 30 && p.activeBlockers < 2
            ? "at_risk"
            : "blocked";
    });
    return arr.sort(
      (a, b) => parseInt(a.completionRate) - parseInt(b.completionRate),
    );
  }, [filteredTasks, filteredBlockers]);

  // ─── BLOCKER INTELLIGENCE ───
  const blockerMetrics = useMemo(() => {
    const active = filteredBlockers.filter((b) => b.status === "active");
    const resolved = filteredBlockers.filter((b) => b.status === "resolved");
    const typeMap = {};
    filteredBlockers.forEach((b) => {
      const type = b.severity || "medium";
      if (!typeMap[type])
        typeMap[type] = {
          count: 0,
          label: type.charAt(0).toUpperCase() + type.slice(1),
        };
      typeMap[type].count++;
    });
    const totalByType = Object.values(typeMap).reduce((s, v) => s + v.count, 0);
    const typeBreakdown = Object.entries(typeMap)
      .map(([key, v]) => ({
        key,
        ...v,
        percent:
          totalByType > 0 ? ((v.count / totalByType) * 100).toFixed(0) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const avgResolutionHours =
      resolved.length > 0
        ? (
            resolved.reduce(
              (sum, b) =>
                sum +
                (new Date(b.resolved_at) - new Date(b.created_at)) / 3600000,
              0,
            ) / resolved.length
          ).toFixed(0)
        : "—";

    const longestUnresolved =
      active.length > 0
        ? Math.max(
            ...active.map(
              (b) => (Date.now() - new Date(b.created_at)) / 86400000,
            ),
          )
        : 0;

    const agingBlockers = [...active].sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at),
    );

    return {
      active,
      resolved,
      typeBreakdown,
      avgResolutionHours,
      longestUnresolved: Math.round(longestUnresolved),
      agingBlockers,
    };
  }, [filteredBlockers]);

  // ─── CARRY-OVER ANALYTICS ───
  const carryOverMetrics = useMemo(() => {
    const carried = filteredTasks.filter((t) => t.status === "carried_over");
    const multiWeek = carried.filter((t) => (t.reschedule_count || 0) >= 3);

    // Staff leaderboard
    const staffMap = {};
    carried.forEach((t) => {
      if (!staffMap[t.user_id])
        staffMap[t.user_id] = {
          id: t.user_id,
          name: t.user_name || t.user_id,
          count: 0,
          multiWeek: 0,
          totalTasks: 0,
        };
      staffMap[t.user_id].count++;
      if ((t.reschedule_count || 0) >= 3) staffMap[t.user_id].multiWeek++;
    });
    filteredTasks.forEach((t) => {
      if (staffMap[t.user_id]) staffMap[t.user_id].totalTasks++;
    });
    const leaderboard = Object.values(staffMap)
      .map((s) => ({
        ...s,
        rate:
          s.totalTasks > 0 ? ((s.count / s.totalTasks) * 100).toFixed(0) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Projects with chronic delays
    const projMap = {};
    filteredTasks.forEach((t) => {
      if (!t.project_id) return;
      if (!projMap[t.project_id])
        projMap[t.project_id] = { total: 0, carried: 0 };
      projMap[t.project_id].total++;
      if (t.status === "carried_over") projMap[t.project_id].carried++;
    });
    const chronicProjects = Object.entries(projMap)
      .filter(([_, v]) => v.total > 0 && v.carried / v.total > 0.3)
      .map(([id, v]) => ({
        id,
        name: projectMap[id]?.name || `Project #${id}`,
        rate: ((v.carried / v.total) * 100).toFixed(0),
      }));

    // Distribution
    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    carried.forEach((t) => {
      const w = Math.min(t.reschedule_count || 0, 5);
      if (dist[w] !== undefined) dist[w]++;
    });
    const maxDist = Math.max(...Object.values(dist), 1);
    const distribution = Object.entries(dist).map(([week, count]) => {
      const w = parseInt(week);
      return {
        label: w >= 5 ? "5+ weeks" : `${w} week${w > 1 ? "s" : ""}`,
        count,
        percent: (count / maxDist) * 100,
        color:
          w >= 5 ? "bg-rose-500" : w >= 3 ? "bg-amber-500" : "bg-slate-500",
      };
    });

    return {
      totalCarried: carried.length,
      multiWeekCount: multiWeek.length,
      leaderboard,
      chronicProjects,
      distribution,
    };
  }, [filteredTasks, projectMap]);

  // ─── WEEKLY SYSTEM HEALTH ───
  const weeklyHealth = useMemo(() => {
    const currentWeek = getWeekNumber(new Date());
    const currentYear = new Date().getFullYear();
    const totalStaff = staffList.length || 1;

    const thisWeekStandups = reports.filter(
      (r) =>
        r.report_type === "standup" &&
        r.week_number === currentWeek &&
        r.year === currentYear,
    );
    const thisWeekRetros = reports.filter(
      (r) =>
        r.report_type === "retro" &&
        r.week_number === currentWeek &&
        r.year === currentYear,
    );

    const createdThisWeek = filteredTasks.filter(
      (t) => t.created_week === currentWeek && t.created_year === currentYear,
    ).length;
    const completedThisWeek = filteredTasks.filter(
      (t) =>
        t.created_week === currentWeek &&
        t.created_year === currentYear &&
        t.status === "completed",
    ).length;

    // 8-week trend
    const last8Weeks = [];
    for (let i = 7; i >= 0; i--) {
      let w = currentWeek - i;
      let y = currentYear;
      if (w < 1) {
        w += 52;
        y--;
      }
      const weekTasks = filteredTasks.filter(
        (t) => t.created_week === w && t.created_year === y,
      );
      const weekReports = reports.filter(
        (r) => r.week_number === w && r.year === y,
      );
      last8Weeks.push({
        week: w,
        year: y,
        created: weekTasks.length,
        completed: weekTasks.filter((t) => t.status === "completed").length,
        carried: weekTasks.filter((t) => t.status === "carried_over").length,
        standups: weekReports.filter((r) => r.report_type === "standup").length,
        retros: weekReports.filter((r) => r.report_type === "retro").length,
      });
    }

    return {
      standupRate:
        totalStaff > 0
          ? ((thisWeekStandups.length / totalStaff) * 100).toFixed(0)
          : "0",
      retroRate:
        totalStaff > 0
          ? ((thisWeekRetros.length / totalStaff) * 100).toFixed(0)
          : "0",
      standupSubmitted: thisWeekStandups.length,
      retroSubmitted: thisWeekRetros.length,
      totalStaff,
      createdThisWeek,
      completedThisWeek,
      last8Weeks,
    };
  }, [filteredTasks, reports, staffList]);

  // ─── PROGRAM PERFORMANCE ───
  const programMetrics = useMemo(() => {
    return programs
      .map((prog) => {
        const progProjects = projects.filter(
          (p) => String(p.program_id) === String(prog.id),
        );
        const progProjectIds = progProjects.map((p) => p.id);
        const progTasks = filteredTasks.filter((t) =>
          progProjectIds.includes(t.project_id),
        );
        const total = progTasks.length;
        const completed = progTasks.filter(
          (t) => t.status === "completed",
        ).length;
        const participants = new Set(progTasks.map((t) => t.user_id)).size;
        const rate = total > 0 ? ((completed / total) * 100).toFixed(0) : "0";
        let health = "on_track";
        if (parseInt(rate) < 50) health = "at_risk";
        if (parseInt(rate) < 20) health = "blocked";
        return {
          id: prog.id,
          name: prog.name,
          total,
          completed,
          rate,
          participants,
          health,
          projectCount: progProjects.length,
        };
      })
      .filter((p) => p.total > 0 || p.projectCount > 0);
  }, [programs, projects, filteredTasks]);

  // ─── RENDER HELPERS ───
  const renderStatCard = (
    label,
    value,
    color = "text-[var(--text-primary)]",
    sub = null,
  ) => (
    <div className="card p-4 space-y-1">
      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
        {label}
      </p>
      <p className={`text-3xl font-black ${color}`}>{value}</p>
      {sub && <p className="text-[8px] text-slate-500">{sub}</p>}
    </div>
  );

  const renderHealthBadge = (health) => {
    const colors = {
      on_track: "text-emerald-400 bg-emerald-500/10",
      at_risk: "text-amber-400 bg-amber-500/10",
      blocked: "text-rose-400 bg-rose-500/10",
    };
    const labels = {
      on_track: "On Track",
      at_risk: "At Risk",
      blocked: "Blocked",
    };
    return (
      <span
        className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${colors[health] || colors.on_track}`}
      >
        {labels[health] || health}
      </span>
    );
  };

  const renderStatusBadge = (status) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    return (
      <span
        className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}
      >
        {cfg.label}
      </span>
    );
  };

  if (loading) {
    return (
      <DashboardLayout role="super_admin">
        <div className="space-y-8 pb-20 text-left">
          <div className="card py-32 flex items-center justify-center">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Loading intelligence...
              </span>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="super_admin">
      <div className="space-y-8 pb-20 text-left">
        {/* HEADER */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                Intelligence
              </span>
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              System Performance
            </h1>
          </div>
          <button
            onClick={fetchAll}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
          >
            <RefreshCw
              className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`}
            />{" "}
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </header>

        {/* ─── GLOBAL FILTERS ─── */}
        <div className="flex flex-wrap gap-2 p-3 card">
          <select
            value={filterWeek}
            onChange={(e) => setFilterWeek(e.target.value)}
            className="bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-bold outline-none text-[var(--text-primary)] appearance-none cursor-pointer"
          >
            <option value="all">All Time</option>
            <option value="current">This Week</option>
            <option value="last">Last Week</option>
            <option value="month">This Month</option>
          </select>
          <select
            value={filterStaff}
            onChange={(e) => setFilterStaff(e.target.value)}
            className="bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-bold outline-none text-[var(--text-primary)] appearance-none cursor-pointer"
          >
            <option value="">All Staff</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-bold outline-none text-[var(--text-primary)] appearance-none cursor-pointer"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={filterProgram}
            onChange={(e) => setFilterProgram(e.target.value)}
            className="bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-bold outline-none text-[var(--text-primary)] appearance-none cursor-pointer"
          >
            <option value="">All Programs</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={filterBlockerType}
            onChange={(e) => setFilterBlockerType(e.target.value)}
            className="bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-bold outline-none text-[var(--text-primary)] appearance-none cursor-pointer"
          >
            <option value="">All Blocker Types</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        {/* ═══════ SECTION 1: GLOBAL SYSTEM OVERVIEW ═══════ */}
        <div className="space-y-3">
          <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[var(--brand-orange)]" /> Global
            Overview
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {renderStatCard("Total Tasks", kpiMetrics.totalTasks)}
            {renderStatCard(
              "Completed",
              kpiMetrics.completedTasks,
              "text-emerald-400",
            )}
            {renderStatCard("Active", kpiMetrics.activeTasks, "text-blue-400")}
            {renderStatCard(
              "Active Blockers",
              kpiMetrics.activeBlockers,
              "text-rose-400",
            )}
            {renderStatCard(
              "Carry-over Rate",
              `${kpiMetrics.carryOverRate}%`,
              kpiMetrics.carryOverRate > 20
                ? "text-amber-400"
                : "text-[var(--text-primary)]",
            )}
            {renderStatCard(
              "Active Staff",
              kpiMetrics.activeStaff,
              "text-indigo-400",
            )}
          </div>
        </div>

        {/* ═══════ SECTION 2: STAFF PERFORMANCE ═══════ */}
        <div className="space-y-3">
          <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2">
            <Users className="w-4 h-4 text-[var(--brand-orange)]" /> Staff
            Performance
          </h2>
          {staffMetrics.length === 0 ? (
            <p className="text-[10px] text-slate-600 italic text-center py-8">
              No staff data for current filters.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {staffMetrics.map((s) => (
                <div key={s.id} className="card p-4">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() =>
                      setExpandedStaff(expandedStaff === s.id ? null : s.id)
                    }
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary border border-[var(--border-primary)] flex items-center justify-center text-sm font-black uppercase">
                        {s.name?.charAt(0) || "?"}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[var(--text-primary)]">
                          {s.name}
                        </p>
                        <p className="text-[8px] text-slate-500">
                          {s.total} tasks
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-lg font-black text-emerald-400">
                          {s.completionRate}%
                        </p>
                        <p className="text-[7px] text-slate-500 uppercase tracking-wider">
                          Rate
                        </p>
                      </div>
                      {s.activeBlockers > 0 && (
                        <Shield className="w-4 h-4 text-rose-400" />
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3 mt-3 text-[10px]">
                    <span>
                      <span className="font-bold text-emerald-400">
                        {s.completed}
                      </span>{" "}
                      <span className="text-slate-500">done</span>
                    </span>
                    <span>
                      <span className="font-bold text-indigo-400">
                        {s.carried}
                      </span>{" "}
                      <span className="text-slate-500">carry</span>
                    </span>
                    <span>
                      <span
                        className={`font-bold ${s.activeBlockers > 0 ? "text-rose-400" : "text-slate-500"}`}
                      >
                        {s.activeBlockers}
                      </span>{" "}
                      <span className="text-slate-500">blocked</span>
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 bg-tertiary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${s.completionRate}%` }}
                    />
                  </div>
                  {expandedStaff === s.id && (
                    <div className="mt-3 pt-3 border-t border-[var(--border-primary)]/30 space-y-1 max-h-40 overflow-y-auto">
                      {s.tasks.map((t) => (
                        <div
                          key={t.id}
                          className="flex justify-between items-center text-[10px] py-0.5"
                        >
                          <span className="font-medium text-[var(--text-primary)] truncate mr-2">
                            {t.title}
                          </span>
                          {renderStatusBadge(t.status)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ═══════ SECTION 3: PROJECT PERFORMANCE ═══════ */}
        <div className="space-y-3">
          <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-[var(--brand-orange)]" /> Project
            Performance
          </h2>
          {projectMetrics.length === 0 ? (
            <p className="text-[10px] text-slate-600 italic text-center py-8">
              No project data for current filters.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {projectMetrics.map((p) => {
                const proj = projectMap[p.id];
                return (
                  <div key={p.id} className="card p-4">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() =>
                        setExpandedProject(
                          expandedProject === p.id ? null : p.id,
                        )
                      }
                    >
                      <div>
                        <p className="text-xs font-bold text-[var(--text-primary)]">
                          {proj?.name || `Project #${p.id}`}
                        </p>
                        <p className="text-[8px] text-slate-500">
                          {programMap[proj?.program_id]?.name || "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-lg font-black text-emerald-400">
                          {p.completionRate}%
                        </p>
                        {renderHealthBadge(p.health)}
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-3 mt-3 text-[10px]">
                      <div>
                        <span className="font-black">{p.total}</span>{" "}
                        <span className="text-slate-500">total</span>
                      </div>
                      <div>
                        <span className="font-black text-emerald-400">
                          {p.completed}
                        </span>{" "}
                        <span className="text-slate-500">done</span>
                      </div>
                      <div>
                        <span className="font-black">{p.velocity}/wk</span>{" "}
                        <span className="text-slate-500">velocity</span>
                      </div>
                      <div>
                        <span
                          className={`font-black ${p.activeBlockers > 0 ? "text-rose-400" : "text-slate-500"}`}
                        >
                          {p.activeBlockers}
                        </span>{" "}
                        <span className="text-slate-500">blockers</span>
                      </div>
                    </div>
                    {expandedProject === p.id && (
                      <div className="mt-3 pt-3 border-t border-[var(--border-primary)]/30 space-y-1">
                        <p className="text-[8px] text-slate-500">
                          Staff: {p.staffList.join(", ") || "—"}
                        </p>
                        <p className="text-[8px] text-slate-500">
                          Completion rate: {p.completionRate}% across {p.total}{" "}
                          tasks
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ═══════ SECTION 4: BLOCKER INTELLIGENCE ═══════ */}
        <div className="space-y-3">
          <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2">
            <Shield className="w-4 h-4 text-rose-400" /> Blocker Intelligence
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {renderStatCard(
              "Active Blockers",
              blockerMetrics.active.length,
              "text-rose-400",
            )}
            {renderStatCard(
              "Avg Resolution",
              blockerMetrics.avgResolutionHours === "—"
                ? "—"
                : `${blockerMetrics.avgResolutionHours}h`,
              "text-[var(--text-primary)]",
            )}
            {renderStatCard(
              "Longest Open",
              `${blockerMetrics.longestUnresolved}d`,
              "text-amber-400",
            )}
          </div>

          {/* Type breakdown */}
          {blockerMetrics.typeBreakdown.length > 0 && (
            <div className="card p-4">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                By Severity
              </p>
              <div className="space-y-1.5">
                {blockerMetrics.typeBreakdown.map((t) => (
                  <div
                    key={t.key}
                    className="flex items-center gap-2 text-[10px]"
                  >
                    <span className="w-20 text-slate-500">{t.label}</span>
                    <div className="flex-1 h-4 rounded bg-tertiary overflow-hidden">
                      <div
                        className={`h-full rounded ${SEVERITY_COLORS[t.key]?.split(" ")[1] || "bg-slate-500"}`}
                        style={{ width: `${t.percent}%` }}
                      />
                    </div>
                    <span className="w-8 font-bold text-right">{t.count}</span>
                    <span className="w-10 text-slate-500">{t.percent}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Aging blockers table */}
          {blockerMetrics.agingBlockers.length > 0 && (
            <div className="card !p-0 overflow-hidden">
              <div className="p-3 border-b border-[var(--border-primary)]">
                <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest">
                  Aging Blockers
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-tertiary border-b border-[var(--border-primary)]">
                      <th className="text-left px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
                        Blocker
                      </th>
                      <th className="text-left px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
                        Task
                      </th>
                      <th className="text-left px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
                        Staff
                      </th>
                      <th className="text-left px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
                        Age
                      </th>
                      <th className="text-left px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
                        Severity
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {blockerMetrics.agingBlockers.map((b) => {
                      const weeksOpen = Math.floor(
                        (Date.now() - new Date(b.created_at)) /
                          (7 * 24 * 60 * 60 * 1000),
                      );
                      const task = filteredTasks.find(
                        (t) => t.id === b.task_id,
                      );
                      return (
                        <tr
                          key={b.id}
                          className={`border-b border-[var(--border-primary)]/40 ${weeksOpen >= 3 ? "bg-rose-500/5" : ""}`}
                        >
                          <td className="px-3 py-2 text-[10px] font-bold text-[var(--text-primary)]">
                            {b.title}
                          </td>
                          <td className="px-3 py-2 text-[9px] text-slate-500">
                            {task?.title || `Task #${b.task_id}`}
                          </td>
                          <td className="px-3 py-2 text-[9px] text-slate-500">
                            {b.user_name || "—"}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`text-[9px] font-bold ${weeksOpen >= 3 ? "text-rose-400" : "text-slate-500"}`}
                            >
                              {weeksOpen}w
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${SEVERITY_COLORS[b.severity] || SEVERITY_COLORS.medium}`}
                            >
                              {b.severity || "medium"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ═══════ SECTION 5: CARRY-OVER ANALYTICS ═══════ */}
        <div className="space-y-3">
          <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" /> Carry-Over Analytics
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {renderStatCard(
              "Carried Over",
              carryOverMetrics.totalCarried,
              "text-indigo-400",
            )}
            {renderStatCard(
              "Multi-Week (3+)",
              carryOverMetrics.multiWeekCount,
              carryOverMetrics.multiWeekCount > 0
                ? "text-amber-400"
                : "text-[var(--text-primary)]",
            )}
            {renderStatCard(
              "Chronic Projects",
              carryOverMetrics.chronicProjects.length,
              carryOverMetrics.chronicProjects.length > 0
                ? "text-rose-400"
                : "text-[var(--text-primary)]",
            )}
          </div>

          {/* Distribution bar chart */}
          {carryOverMetrics.distribution.some((d) => d.count > 0) && (
            <div className="card p-4">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">
                Weeks Carried Distribution
              </p>
              <div className="space-y-2">
                {carryOverMetrics.distribution.map((d) => (
                  <div key={d.label} className="flex items-center gap-2">
                    <span className="text-[9px] text-slate-500 w-16">
                      {d.label}
                    </span>
                    <div className="flex-1 h-5 rounded bg-tertiary overflow-hidden">
                      <div
                        className={`h-full rounded ${d.color}`}
                        style={{ width: `${d.percent}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-bold w-8 text-right">
                      {d.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Carry-over leaderboard */}
          {carryOverMetrics.leaderboard.length > 0 && (
            <div className="card !p-0 overflow-hidden">
              <div className="p-3 border-b border-[var(--border-primary)]">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                  Staff Carry-Over Leaderboard
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-tertiary border-b border-[var(--border-primary)]">
                      <th className="text-left px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
                        Staff
                      </th>
                      <th className="text-center px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
                        Carried
                      </th>
                      <th className="text-center px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
                        Multi-Week
                      </th>
                      <th className="text-center px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
                        Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {carryOverMetrics.leaderboard.map((s) => (
                      <tr
                        key={s.id}
                        className="border-b border-[var(--border-primary)]/40"
                      >
                        <td className="px-3 py-2 text-[10px] font-bold text-[var(--text-primary)]">
                          {s.name}
                        </td>
                        <td className="px-3 py-2 text-center text-[10px] font-bold text-indigo-400">
                          {s.count}
                        </td>
                        <td className="px-3 py-2 text-center text-[10px]">
                          {s.multiWeek}
                        </td>
                        <td className="px-3 py-2 text-center text-[10px]">
                          {s.rate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Chronic projects */}
          {carryOverMetrics.chronicProjects.length > 0 && (
            <div className="card p-4">
              <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-2">
                Projects With Chronic Delays
              </p>
              <div className="space-y-1">
                {carryOverMetrics.chronicProjects.map((p) => (
                  <div
                    key={p.id}
                    className="flex justify-between text-[10px] py-0.5"
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-rose-400 font-bold">
                      {p.rate}% carry-over
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ═══════ SECTION 6: WEEKLY SYSTEM HEALTH ═══════ */}
        <div className="space-y-3">
          <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2">
            <Activity className="w-4 h-4 text-[var(--brand-orange)]" /> Weekly
            System Health
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {renderStatCard(
              "Standup Rate",
              `${weeklyHealth.standupRate}%`,
              "text-emerald-400",
              `${weeklyHealth.standupSubmitted}/${weeklyHealth.totalStaff} submitted`,
            )}
            {renderStatCard(
              "Retro Rate",
              `${weeklyHealth.retroRate}%`,
              "text-blue-400",
              `${weeklyHealth.retroSubmitted}/${weeklyHealth.totalStaff} submitted`,
            )}
            {renderStatCard(
              "Created This Week",
              weeklyHealth.createdThisWeek,
              "text-[var(--text-primary)]",
            )}
            {renderStatCard(
              "Completed This Week",
              weeklyHealth.completedThisWeek,
              "text-emerald-400",
            )}
          </div>

          {/* 8-week trend */}
          <div className="card !p-0 overflow-hidden">
            <div className="p-3 border-b border-[var(--border-primary)]">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                8-Week Trend
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-tertiary border-b border-[var(--border-primary)]">
                    <th className="text-left px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
                      Week
                    </th>
                    <th className="text-center px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="text-center px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
                      Completed
                    </th>
                    <th className="text-center px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
                      Carried
                    </th>
                    <th className="text-center px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
                      Standups
                    </th>
                    <th className="text-center px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
                      Retros
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyHealth.last8Weeks.map((w) => (
                    <tr
                      key={`${w.week}-${w.year}`}
                      className="border-b border-[var(--border-primary)]/40"
                    >
                      <td className="px-3 py-2 text-[10px] font-bold">
                        W{w.week}
                      </td>
                      <td className="px-3 py-2 text-center text-[10px]">
                        {w.created}
                      </td>
                      <td className="px-3 py-2 text-center text-[10px] text-emerald-400 font-bold">
                        {w.completed}
                      </td>
                      <td className="px-3 py-2 text-center text-[10px] text-indigo-400">
                        {w.carried}
                      </td>
                      <td className="px-3 py-2 text-center text-[10px]">
                        {w.standups}/{weeklyHealth.totalStaff}
                      </td>
                      <td className="px-3 py-2 text-center text-[10px]">
                        {w.retros}/{weeklyHealth.totalStaff}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ═══════ SECTION 7: PROGRAM PERFORMANCE ═══════ */}
        <div className="space-y-3">
          <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2">
            <Target className="w-4 h-4 text-[var(--brand-orange)]" /> Program
            Performance
          </h2>
          {programMetrics.length === 0 ? (
            <p className="text-[10px] text-slate-600 italic text-center py-8">
              No program data for current filters.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {programMetrics.map((p) => (
                <div key={p.id} className="card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs font-bold text-[var(--text-primary)]">
                        {p.name}
                      </p>
                      <p className="text-[8px] text-slate-500">
                        {p.projectCount} projects
                      </p>
                    </div>
                    {renderHealthBadge(p.health)}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    <div>
                      <span className="font-black text-emerald-400">
                        {p.rate}%
                      </span>{" "}
                      <span className="text-slate-500">completion</span>
                    </div>
                    <div>
                      <span className="font-black">{p.participants}</span>{" "}
                      <span className="text-slate-500">participants</span>
                    </div>
                    <div>
                      <span className="font-black">
                        {p.completed}/{p.total}
                      </span>{" "}
                      <span className="text-slate-500">tasks</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

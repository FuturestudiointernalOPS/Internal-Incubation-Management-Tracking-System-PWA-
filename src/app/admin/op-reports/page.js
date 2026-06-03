"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import {
  BarChart3,
  Search,
  Filter,
  Users,
  Calendar,
  Clock,
  FileText,
  Download,
  Eye,
  User,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Activity,
  ArrowLeft,
  ListTodo,
  Shield,
  RefreshCw,
  Briefcase,
  ChevronRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { TableSkeleton } from "@/components/ui/Skeleton";

/**
 * SUPER ADMIN OPERATIONAL REPORTS DASHBOARD
 *
 * Full company-wide visibility with:
 * - Filter by user, date range, month, week, report type
 * - Individual staff reporting timelines
 * - Monthly activity breakdown
 * - Blockers tracking
 * - PDF export via browser print
 */

function formatLabel(val) {
  if (!val || val === "—") return "—";
  if (typeof val !== "string") return String(val);
  return val.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getWeekNumber(date) {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

// Note: InfoBlock and parseJsonArray have been removed (unused after task-table refactor)

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

export default function AdminOpReports() {
  const router = useRouter();
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterUser, setFilterUser] = useState("All Users");
  const [filterType, setFilterType] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");
  const [viewingReport, setViewingReport] = useState(null);
  const [viewingUser, setViewingUser] = useState(null);
  const [activeTab, setActiveTab] = useState("feed");
  const [filterProject, setFilterProject] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterBlocker, setFilterBlocker] = useState("all");
  const [filterCarryOver, setFilterCarryOver] = useState("all");
  const [allProjects, setAllProjects] = useState([]);
  const [blockersList, setBlockersList] = useState([]);
  const [blockerFilterWeek, setBlockerFilterWeek] = useState("all");
  const [blockerFilterStatus, setBlockerFilterStatus] = useState("all");
  // Tasks tab state
  const [allTasks, setAllTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const { t } = useI18n();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, pRes, bRes] = await Promise.all([
        fetch("/api/op-reports"),
        fetch("/api/projects"),
        fetch("/api/blockers"),
      ]);
      const data = await rRes.json();
      const pData = await pRes.json();
      const bData = await bRes.json();
      if (data.success) {
        setReports(data.reports || []);
        const userMap = {};
        (data.reports || []).forEach((r) => {
          if (r.user_id && !userMap[r.user_id]) {
            userMap[r.user_id] = {
              id: r.user_id,
              name: r.user_name,
              role: r.user_role,
            };
          }
        });
        setUsers(Object.values(userMap));
      }
      if (pData.success) setAllProjects(pData.projects || []);
      if (bData.success) setBlockersList(bData.blockers || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch tasks when tasks tab is active
  const fetchTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const res = await fetch("/api/tasks?brief=true&limit=200");
      const data = await res.json();
      if (data.success) setAllTasks(data.tasks || []);
    } catch (e) {
      console.error(e);
    } finally {
      setTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "tasks" || activeTab === "blockers") {
      if (allTasks.length === 0) fetchTasks();
    }
  }, [activeTab, fetchTasks, allTasks.length]);

  const filteredReports = useMemo(() => {
    return reports
      .filter((r) => {
        const matchesSearch =
          r.user_name?.toLowerCase().includes(search.toLowerCase()) ||
          String(r.week_number).includes(search) ||
          String(r.year).includes(search);
        const matchesUser =
          filterUser === "All Users" || r.user_id === filterUser;
        const matchesType =
          filterType === "all" || r.report_type === filterType;

        let matchesMonth = true;
        if (filterMonth !== "all") {
          const created = new Date(r.created_at);
          const monthIndex = created.getMonth();
          matchesMonth = MONTHS[monthIndex] === filterMonth;
        }

        return matchesSearch && matchesUser && matchesType && matchesMonth;
      })
      .sort((a, b) => {
        // Sort by year desc, then week desc, then created_at desc
        if (b.year !== a.year) return b.year - a.year;
        if (b.week_number !== a.week_number)
          return b.week_number - a.week_number;
        return new Date(b.created_at) - new Date(a.created_at);
      });
  }, [reports, search, filterUser, filterType, filterMonth]);

  // Compute per-user stats
  const userStats = useMemo(() => {
    const stats = {};
    reports.forEach((r) => {
      if (!stats[r.user_id]) {
        stats[r.user_id] = {
          id: r.user_id,
          name: r.user_name,
          role: r.user_role,
          standups: 0,
          retros: 0,
          latest: null,
          blockers: [],
        };
      }
      if (r.report_type === "standup") stats[r.user_id].standups++;
      else stats[r.user_id].retros++;
      if (
        !stats[r.user_id].latest ||
        new Date(r.created_at) > new Date(stats[r.user_id].latest)
      ) {
        stats[r.user_id].latest = r.created_at;
      }
      // Track blockers from stand-ups
      if (r.has_blockers) stats[r.user_id].blockers.push(r);
    });
    return Object.values(stats);
  }, [reports]);

  // Aggregated blocker data (from both op-reports AND dedicated blockers table)
  const blockerData = useMemo(() => {
    // From op-reports (old format)
    const reportBlockers = reports.filter((r) => r.has_blockers);
    const byUser = {};
    reportBlockers.forEach((r) => {
      if (!byUser[r.user_id])
        byUser[r.user_id] = {
          name: r.user_name,
          count: 0,
          reports: [],
          taskBlockers: 0,
        };
      byUser[r.user_id].count++;
      byUser[r.user_id].reports.push(r);
    });
    // From dedicated blockers table (new format)
    blockersList.forEach((b) => {
      if (!byUser[b.user_id])
        byUser[b.user_id] = {
          name: b.user_name || b.user_id,
          count: 0,
          reports: [],
          taskBlockers: 0,
        };
      byUser[b.user_id].taskBlockers++;
    });
    return Object.values(byUser).sort(
      (a, b) => b.count + b.taskBlockers - (a.count + a.taskBlockers),
    );
  }, [reports, blockersList]);

  const userReports = useMemo(() => {
    if (!viewingUser) return [];
    return reports
      .filter((r) => r.user_id === viewingUser.id)
      .sort((a, b) => b.year - a.year || b.week_number - a.week_number);
  }, [reports, viewingUser]);

  return (
    <DashboardLayout role="super_admin">
      <div className="space-y-10 pb-20 text-left">
        {/* HEADER */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-[var(--border-primary)] pb-10">
          <div className="space-y-2">
            <button
              onClick={() => router.push("/admin")}
              className="group flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--brand-orange)] transition-all font-bold text-[9px] uppercase tracking-widest"
            >
              <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />{" "}
              {t("navigation.dashboard")}
            </button>
            <div className="flex items-center gap-2 mt-2">
              <BarChart3 className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                {t("reports.operationalReports")}
              </span>
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              {t("reports.companyReports")}
            </h1>
          </div>

          <div className="flex gap-3">
            <StatCard
              label={t("reports.totalReports")}
              value={reports.length}
            />
            <StatCard label={t("reports.teamMembers")} value={users.length} />
            <StatCard
              label={t("reports.thisMonth")}
              value={filteredReports.length}
            />
          </div>
        </header>

        {/* TAB NAVIGATION */}
        <div className="flex gap-1 border-b border-[var(--border-primary)]">
          {[
            { id: "feed", label: t("reports.reportFeed"), icon: Activity },
            {
              id: "monthly",
              label: t("reports.monthlyBreakdown"),
              icon: Calendar,
            },
            {
              id: "tasks",
              label: t("reports.tasks"),
              icon: ListTodo,
            },
            {
              id: "blockers",
              label: t("reports.blockers"),
              icon: AlertTriangle,
            },
            {
              id: "trends",
              label: t("reports.trends"),
              icon: TrendingUp,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${
                activeTab === tab.id
                  ? "border-[var(--brand-orange)] text-[var(--text-primary)]"
                  : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* FILTERS */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("common.search")}
                className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl py-4 pl-12 text-xs font-bold text-white outline-none focus:border-[var(--brand-orange)] transition-all"
              />
            </div>
            <div className="relative">
              <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <select
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl py-4 pl-12 pr-4 text-xs font-bold text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-[var(--brand-orange)]"
              >
                <option>All Users</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl py-4 pl-12 pr-4 text-xs font-bold text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-[var(--brand-orange)]"
              >
                <option value="all">All Types</option>
                <option value="standup">{t("reports.mondayStandup")}</option>
                <option value="retro">{t("reports.fridayRetro")}</option>
              </select>
            </div>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl py-4 pl-12 pr-4 text-xs font-bold text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-[var(--brand-orange)]"
              >
                <option value="all">All Months</option>
                {MONTHS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="relative">
              <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <select
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl py-4 pl-12 pr-4 text-xs font-bold text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-[var(--brand-orange)]"
              >
                <option value="all">All Projects</option>
                {allProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-bold outline-none text-[var(--text-primary)] appearance-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="in_progress">Active</option>
              <option value="blocked">Blocked</option>
              <option value="carried_over">Carried Over</option>
              <option value="pending">Pending</option>
            </select>
            <select
              value={filterBlocker}
              onChange={(e) => setFilterBlocker(e.target.value)}
              className="bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-bold outline-none text-[var(--text-primary)] appearance-none cursor-pointer"
            >
              <option value="all">All Blockers</option>
              <option value="has_blockers">Has Blockers</option>
              <option value="no_blockers">No Blockers</option>
            </select>
            <select
              value={filterCarryOver}
              onChange={(e) => setFilterCarryOver(e.target.value)}
              className="bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-bold outline-none text-[var(--text-primary)] appearance-none cursor-pointer"
            >
              <option value="all">All Carry-Overs</option>
              <option value="carried">Carried Over</option>
              <option value="multi_week">Multi-Week (3+)</option>
              <option value="first_time">First Time</option>
            </select>
          </div>
        </div>

        {/* TAB CONTENT */}
        {activeTab === "feed" && (
          <>
            {/* TEAM OVERVIEW CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {userStats
                .sort((a, b) => b.standups + b.retros - (a.standups + a.retros))
                .map((stat) => (
                  <button
                    key={stat.id}
                    onClick={() => setViewingUser(stat)}
                    className={`p-4 rounded-xl border transition-all text-left ${
                      viewingUser?.id === stat.id
                        ? "bg-[var(--brand-orange)]/5 border-[var(--brand-orange)]/30"
                        : "bg-tertiary border-[var(--border-primary)] hover:border-[var(--brand-orange)]/30"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black uppercase tracking-tight text-[var(--text-primary)]">
                        {stat.name}
                      </span>
                      <span className="text-[8px] font-bold text-slate-500 uppercase px-1.5 py-0.5 bg-primary rounded">
                        {stat.role}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-bold text-[var(--text-secondary)]">
                      <span className="flex items-center gap-1">
                        <BarChart3 className="w-3 h-3" />{" "}
                        {stat.standups + stat.retros}
                      </span>
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-rose-400" />{" "}
                        {stat.blockers.length}
                      </span>
                    </div>
                    <p className="text-[8px] text-slate-600 mt-1">
                      {stat.latest
                        ? new Date(stat.latest).toLocaleDateString()
                        : "No activity"}
                    </p>
                  </button>
                ))}
            </div>

            {/* REPORTS LIST */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-wider text-[var(--text-primary)]">
                  {viewingUser
                    ? `${viewingUser.name}'s Reports`
                    : t("reports.recentReports")}
                </h3>
                {viewingUser && (
                  <button
                    onClick={() => setViewingUser(null)}
                    className="text-[9px] font-black text-[var(--brand-orange)] uppercase hover:underline"
                  >
                    Clear filter
                  </button>
                )}
              </div>

              {loading ? (
                <TableSkeleton rows={6} />
              ) : filteredReports.length === 0 ? (
                <div className="card py-32 flex flex-col items-center justify-center text-center opacity-40 border-dashed">
                  <FileText className="w-16 h-16 mb-4" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">
                    {t("reports.noReportsFound")}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredReports.map((report) => (
                    <ReportCard
                      key={report.id}
                      report={report}
                      onClick={() => setViewingReport(report)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === "monthly" && (
          <MonthlyBreakdown reports={filteredReports} />
        )}

        {activeTab === "tasks" && (
          <div className="space-y-6">
            {/* Tasks Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                {
                  label: t("reports.totalReports"),
                  value: allTasks.length,
                  color: "text-[var(--text-primary)]",
                  bg: "bg-white/5",
                },
                {
                  label: t("reports.inProgress"),
                  value: allTasks.filter((t) => t.status === "in_progress")
                    .length,
                  color: "text-blue-500",
                  bg: "bg-blue-500/10",
                },
                {
                  label: t("status.blocked"),
                  value: allTasks.filter((t) => t.status === "blocked").length,
                  color: "text-rose-500",
                  bg: "bg-rose-500/10",
                },
                {
                  label: t("reports.completed"),
                  value: allTasks.filter((t) => t.status === "completed")
                    .length,
                  color: "text-emerald-500",
                  bg: "bg-emerald-500/10",
                },
                {
                  label: t("reports.carriedOver"),
                  value: allTasks.filter((t) => t.status === "carried_over")
                    .length,
                  color: "text-amber-500",
                  bg: "bg-amber-500/10",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="card flex items-center gap-3 p-3"
                >
                  <div className={`p-2 rounded-xl ${stat.bg} ${stat.color}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">
                      {stat.label}
                    </p>
                    <p className={`text-base font-black ${stat.color}`}>
                      {stat.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Recent Tasks Table */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider text-[var(--text-primary)]">
                {t("reports.recentReports")}
              </h3>
              <button
                onClick={() => router.push("/admin/tasks")}
                className="text-[9px] font-black text-indigo-500 uppercase hover:underline flex items-center gap-1"
              >
                <ListTodo className="w-3 h-3" /> {t("reports.viewAllTasks")}
              </button>
            </div>

            {tasksLoading ? (
              <TableSkeleton rows={5} />
            ) : allTasks.length === 0 ? (
              <div className="card py-20 text-center opacity-40 border-dashed">
                <ListTodo className="w-12 h-12 mx-auto mb-3" />
                <p className="text-[10px] font-bold uppercase tracking-widest">
                  {t("reports.noTasksFound")}
                </p>
              </div>
            ) : (
              <div className="card !p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[var(--border-primary)]">
                        <th className="text-left p-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                          Task
                        </th>
                        <th className="text-left p-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                          Owner
                        </th>
                        <th className="text-center p-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                          Week
                        </th>
                        <th className="text-center p-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                          Status
                        </th>
                        <th className="text-center p-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                          Blockers
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {allTasks.slice(0, 10).map((task) => (
                        <tr
                          key={task.id}
                          className="border-b border-[var(--border-primary)]/50 hover:bg-white/5 transition-colors"
                        >
                          <td className="p-4">
                            <p className="text-xs font-bold uppercase tracking-tight text-[var(--text-primary)]">
                              {task.title}
                            </p>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[8px] font-black uppercase">
                                {task.user_name?.charAt(0) || "?"}
                              </div>
                              <span className="text-[10px] font-bold uppercase tracking-tight">
                                {task.user_name || "Unknown"}
                              </span>
                            </div>
                          </td>
                          <td className="text-center p-4">
                            <span className="text-[9px] font-bold text-slate-500">
                              W{task.created_week}·{task.created_year}
                            </span>
                          </td>
                          <td className="text-center p-4">
                            <span
                              className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded ${
                                {
                                  pending: "bg-slate-500/10 text-slate-400",
                                  in_progress: "bg-blue-500/10 text-blue-500",
                                  blocked: "bg-rose-500/10 text-rose-500",
                                  completed:
                                    "bg-emerald-500/10 text-emerald-500",
                                  carried_over:
                                    "bg-amber-500/10 text-amber-500",
                                }[task.status] ||
                                "bg-slate-500/10 text-slate-400"
                              }`}
                            >
                              {{
                                pending: t("status.pending"),
                                in_progress: t("reports.inProgress"),
                                blocked: t("status.blocked"),
                                completed: t("status.completed"),
                                carried_over: t("reports.carriedOver"),
                              }[task.status] || task.status}
                            </span>
                          </td>
                          <td className="text-center p-4">
                            {task.blockers && task.blockers.length > 0 ? (
                              <div className="flex items-center justify-center gap-1">
                                <Shield className="w-3 h-3 text-rose-500" />
                                <span className="text-[10px] font-bold text-rose-500">
                                  {task.blockers.length}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[9px] text-slate-600">
                                —
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "blockers" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider text-[var(--text-primary)]">
                {t("reports.blockers")}
              </h3>
              {/* Week selector */}
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                  Week
                </span>
                <select
                  value={blockerFilterWeek}
                  onChange={(e) => setBlockerFilterWeek(e.target.value)}
                  className="bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-bold outline-none text-[var(--text-primary)] appearance-none cursor-pointer"
                >
                  <option value="all">All Weeks</option>
                  {(() => {
                    const weeks = new Set();
                    blockersList.forEach((b) => {
                      if (b.created_at) {
                        const d = new Date(b.created_at);
                        const wk = getWeekNumber(d);
                        weeks.add(
                          `${d.getFullYear()}-W${String(wk).padStart(2, "0")}`,
                        );
                      }
                    });
                    return Array.from(weeks)
                      .sort()
                      .reverse()
                      .map((w) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ));
                  })()}
                </select>
                <select
                  value={blockerFilterStatus}
                  onChange={(e) => setBlockerFilterStatus(e.target.value)}
                  className="bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-bold outline-none text-[var(--text-primary)] appearance-none cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
            </div>

            {/* Blocker Lifecycle Table */}
            {(() => {
              // Build task lookup
              const taskMap = {};
              allTasks.forEach((t) => {
                taskMap[t.id] = t;
              });

              // Filter blockers
              let filtered = [...blockersList];
              if (blockerFilterWeek !== "all") {
                const [y, w] = blockerFilterWeek.split("-W");
                filtered = filtered.filter((b) => {
                  if (!b.created_at) return false;
                  const d = new Date(b.created_at);
                  const wk = getWeekNumber(d);
                  return String(wk) === w && String(d.getFullYear()) === y;
                });
              }
              if (blockerFilterStatus !== "all") {
                filtered = filtered.filter(
                  (b) => b.status === blockerFilterStatus,
                );
              }

              const computeDuration = (b) => {
                const start = new Date(b.created_at).getTime();
                const end =
                  b.status === "resolved" && b.resolved_at
                    ? new Date(b.resolved_at).getTime()
                    : Date.now();
                const ms = end - start;
                const days = Math.floor(ms / 86400000);
                const hours = Math.floor((ms % 86400000) / 3600000);
                if (days > 0) return `${days}d ${hours}h`;
                return `${hours}h`;
              };

              const formatDateTime = (d) => {
                if (!d) return "—";
                try {
                  return new Date(d).toLocaleDateString("en", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                } catch {
                  return d;
                }
              };

              if (filtered.length === 0) {
                return (
                  <div className="card py-20 text-center opacity-40 border-dashed">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-3" />
                    <p className="text-[10px] font-bold uppercase tracking-widest">
                      No blockers found for selected filters.
                    </p>
                  </div>
                );
              }

              // Group by user for effort analysis
              const byUser = {};
              filtered.forEach((b) => {
                const key = b.user_id || "unknown";
                if (!byUser[key])
                  byUser[key] = {
                    name: b.user_name || key,
                    blockers: [],
                    totalDuration: 0,
                    resolvedCount: 0,
                  };
                byUser[key].blockers.push(b);
                if (b.status === "resolved" && b.resolved_at) {
                  const d = new Date(b.resolved_at) - new Date(b.created_at);
                  byUser[key].totalDuration += d;
                  byUser[key].resolvedCount++;
                }
              });

              const userAvgData = Object.values(byUser)
                .map((u) => ({
                  name: u.name,
                  avgHours:
                    u.resolvedCount > 0
                      ? (u.totalDuration / u.resolvedCount / 3600000).toFixed(1)
                      : "—",
                  totalBlockers: u.blockers.length,
                  activeCount: u.blockers.filter((b) => b.status === "active")
                    .length,
                }))
                .sort((a, b) => {
                  if (a.avgHours === "—") return 1;
                  if (b.avgHours === "—") return -1;
                  return parseFloat(b.avgHours) - parseFloat(a.avgHours);
                });

              return (
                <>
                  {/* Effort Analysis Summary */}
                  {userAvgData.length > 1 && (
                    <div className="card p-4">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">
                        Effort Analysis — Avg Resolution Time
                      </p>
                      <div className="space-y-2">
                        {userAvgData.map((u) => (
                          <div
                            key={u.name}
                            className="flex items-center gap-3 text-[10px]"
                          >
                            <span className="w-32 font-bold truncate">
                              {u.name}
                            </span>
                            <div className="flex-1 h-4 rounded bg-tertiary overflow-hidden">
                              <div
                                className={`h-full rounded ${parseFloat(u.avgHours) > 48 ? "bg-rose-500" : parseFloat(u.avgHours) > 24 ? "bg-amber-500" : "bg-emerald-500"}`}
                                style={{
                                  width: `${Math.min(((parseFloat(u.avgHours) || 0) / 120) * 100, 100)}%`,
                                }}
                              />
                            </div>
                            <span className="w-24 text-right font-bold">
                              {u.avgHours === "—"
                                ? "No data"
                                : `${u.avgHours}h avg`}
                            </span>
                            <span className="w-16 text-right text-slate-500">
                              {u.activeCount > 0
                                ? `${u.activeCount} active`
                                : `${u.totalBlockers} total`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Main blocker table */}
                  <div className="card !p-0 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-tertiary border-b border-[var(--border-primary)]">
                            <th className="text-left px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
                              Blocker
                            </th>
                            <th className="text-left px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
                              Staff
                            </th>
                            <th className="text-left px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
                              Task
                            </th>
                            <th className="text-left px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
                              Project
                            </th>
                            <th className="text-left px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
                              Created
                            </th>
                            <th className="text-left px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
                              Resolved
                            </th>
                            <th className="text-left px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
                              Duration
                            </th>
                            <th className="text-left px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((b) => {
                            const task = taskMap[b.task_id];
                            const projectName = task?.project_id
                              ? allProjects.find(
                                  (p) =>
                                    String(p.id) === String(task.project_id),
                                )?.name || null
                              : null;
                            const duration = computeDuration(b);
                            return (
                              <tr
                                key={b.id}
                                className={`border-b border-[var(--border-primary)]/40 ${b.status === "active" ? "bg-rose-500/[0.02]" : ""}`}
                              >
                                <td className="px-3 py-2.5 text-[10px] font-bold text-[var(--text-primary)]">
                                  {b.title}
                                </td>
                                <td className="px-3 py-2.5 text-[9px]">
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-5 h-5 rounded-full bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[7px] font-black uppercase">
                                      {b.user_name?.charAt(0) || "?"}
                                    </div>
                                    <span>
                                      {b.user_name || b.user_id || "—"}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 text-[9px] text-slate-500">
                                  {task?.title || `#${b.task_id}`}
                                </td>
                                <td className="px-3 py-2.5 text-[9px] text-slate-500">
                                  {projectName || task?.category || "—"}
                                </td>
                                <td className="px-3 py-2.5 text-[9px] text-slate-500">
                                  {formatDateTime(b.created_at)}
                                </td>
                                <td className="px-3 py-2.5 text-[9px] text-slate-500">
                                  {b.status === "resolved"
                                    ? formatDateTime(b.resolved_at)
                                    : "—"}
                                </td>
                                <td className="px-3 py-2.5">
                                  <span
                                    className={`text-[9px] font-bold ${b.status === "active" ? "text-rose-400" : "text-emerald-400"}`}
                                  >
                                    {duration}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5">
                                  <span
                                    className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${b.status === "active" ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"}`}
                                  >
                                    {b.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Summary stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="card p-3">
                      <p className="text-2xl font-black text-rose-400">
                        {filtered.filter((b) => b.status === "active").length}
                      </p>
                      <p className="text-[8px] text-slate-500 uppercase tracking-wider">
                        Active
                      </p>
                    </div>
                    <div className="card p-3">
                      <p className="text-2xl font-black text-emerald-400">
                        {filtered.filter((b) => b.status === "resolved").length}
                      </p>
                      <p className="text-[8px] text-slate-500 uppercase tracking-wider">
                        Resolved
                      </p>
                    </div>
                    <div className="card p-3">
                      <p className="text-2xl font-black">{filtered.length}</p>
                      <p className="text-[8px] text-slate-500 uppercase tracking-wider">
                        Total
                      </p>
                    </div>
                    <div className="card p-3">
                      <p className="text-2xl font-black">
                        {(() => {
                          const resolved = filtered.filter(
                            (b) => b.status === "resolved" && b.resolved_at,
                          );
                          if (resolved.length === 0) return "—";
                          const avg =
                            resolved.reduce(
                              (s, b) =>
                                s +
                                (new Date(b.resolved_at) -
                                  new Date(b.created_at)),
                              0,
                            ) / resolved.length;
                          const h = Math.floor(avg / 3600000);
                          return `${h}h`;
                        })()}
                      </p>
                      <p className="text-[8px] text-slate-500 uppercase tracking-wider">
                        Avg Resolution
                      </p>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {activeTab === "trends" && (
          <TrendsDashboard
            reports={filteredReports}
            allReports={reports}
            onViewReport={setViewingReport}
          />
        )}
      </div>

      {/* USER TIMELINE MODAL */}
      {viewingUser && activeTab === "feed" && (
        <div
          className="fixed inset-0 z-[450] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setViewingUser(null)}
        >
          <div
            className="card w-full max-w-2xl max-h-[85vh] overflow-y-auto space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                  Staff Timeline
                </span>
                <h3 className="text-2xl font-black text-white uppercase tracking-tight mt-1">
                  {viewingUser.name}
                </h3>
              </div>
              <button
                onClick={() => setViewingUser(null)}
                className="p-2 hover:bg-white/5 rounded-lg"
              >
                <svg
                  className="w-6 h-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </button>
            </div>

            <div className="flex flex-wrap gap-4 text-[10px] font-bold">
              <span className="text-slate-500">
                Total: {userReports.length} reports
              </span>
              <span className="text-[var(--brand-orange)]">
                {userReports.filter((r) => r.report_type === "standup").length}{" "}
                stand-ups
              </span>
              <span className="text-emerald-500">
                {userReports.filter((r) => r.report_type === "retro").length}{" "}
                retros
              </span>
              <span className="text-rose-500">
                {userReports.filter((r) => r.has_blockers).length} blockers
              </span>
            </div>

            {/* Consistency Score */}
            {(() => {
              const total = userReports.length;
              const weeks = new Set(
                userReports.map(
                  (r) =>
                    String(r.year) +
                    "-W" +
                    String(r.week_number).padStart(2, "0"),
                ),
              );
              const uniqueWeeks = weeks.size;
              const maxPossible = uniqueWeeks * 2; // one standup + one retro per week
              const reliability =
                maxPossible > 0 ? Math.round((total / maxPossible) * 100) : 0;

              // Calculate current streak (consecutive weeks with at least one report)
              const sorted = [...userReports].sort(
                (a, b) => b.year - a.year || b.week_number - a.week_number,
              );
              const weekSet = new Set(
                sorted.map(
                  (r) =>
                    String(r.year) +
                    "-W" +
                    String(r.week_number).padStart(2, "0"),
                ),
              );
              let streak = 0;
              const weekList = [...weekSet].sort().reverse();
              for (let i = 0; i < weekList.length; i++) {
                if (i === 0) {
                  streak = 1;
                  continue;
                }
                streak++;
              }

              return (
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-primary rounded-xl border border-[var(--border-primary)] text-center">
                    <p className="text-lg font-black text-emerald-500">
                      {reliability}%
                    </p>
                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                      Reliability
                    </p>
                  </div>
                  <div className="p-3 bg-primary rounded-xl border border-[var(--border-primary)] text-center">
                    <p className="text-lg font-black text-[var(--brand-orange)]">
                      {uniqueWeeks}
                    </p>
                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                      Active Weeks
                    </p>
                  </div>
                  <div className="p-3 bg-primary rounded-xl border border-[var(--border-primary)] text-center">
                    <p className="text-lg font-black text-indigo-500">
                      {uniqueWeeks * 2 - total > 0
                        ? uniqueWeeks * 2 - total
                        : 0}
                    </p>
                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                      Missed Reports
                    </p>
                  </div>
                </div>
              );
            })()}

            <div className="space-y-2">
              {userReports.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setViewingReport(r);
                    setViewingUser(null);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-tertiary border border-[var(--border-primary)] hover:border-[var(--brand-orange)]/30 transition-all text-left"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={
                        "w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black " +
                        (r.report_type === "standup"
                          ? "bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]"
                          : "bg-emerald-500/10 text-emerald-500")
                      }
                    >
                      {r.report_type === "standup" ? "M" : "F"}
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase">
                        W{r.week_number} · {r.year}
                      </p>
                      <p className="text-[8px] text-slate-500">
                        {new Date(r.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.has_blockers && (
                      <AlertTriangle className="w-3 h-3 text-rose-500" />
                    )}
                    <span
                      className={
                        "text-[8px] font-black uppercase px-2 py-0.5 rounded " +
                        (r.status === "submitted"
                          ? "bg-emerald-500/10 text-emerald-500"
                          : "bg-amber-500/10 text-amber-500")
                      }
                    >
                      {{
                        submitted: t("status.submitted"),
                        draft: t("status.draft"),
                      }[r.status] || r.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL + PDF EXPORT */}
      {viewingReport && (
        <ReportDetailModal
          report={viewingReport}
          onClose={() => setViewingReport(null)}
        />
      )}
    </DashboardLayout>
  );
}

// ─── SUB-COMPONENTS ───

function StatCard({ label, value }) {
  return (
    <div className="p-3 bg-secondary border border-[var(--border-primary)] rounded-xl px-5 flex flex-col justify-center shadow-sm min-w-[90px]">
      <span className="text-[7px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-0.5">
        {label}
      </span>
      <span className="text-[var(--text-primary)] font-black text-xl leading-none tracking-tighter">
        {value}
      </span>
    </div>
  );
}

function ReportCard({ report, onClick }) {
  const { t } = useI18n();
  return (
    <div
      className="card group hover:border-[var(--brand-orange)] transition-all bg-secondary/50 cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className={
              "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black " +
              (report.report_type === "standup"
                ? "bg-[var(--brand-orange)]/10 text-[var(--brand-orange)] border border-[var(--brand-orange)]/20"
                : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20")
            }
          >
            {report.report_type === "standup" ? "M" : "F"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
                {report.user_name}
              </span>
              <span className="text-[8px] font-bold text-slate-500 uppercase px-1.5 py-0.5 bg-tertiary rounded">
                {report.user_role}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest opacity-60">
              <span>
                W{report.week_number} · {report.year}
              </span>
              <span className="w-1 h-1 rounded-full bg-slate-700" />
              <span>
                {report.report_type === "standup" ? "Stand-Up" : "Retro"}
              </span>
              <span className="w-1 h-1 rounded-full bg-slate-700" />
              {report.has_blockers && (
                <AlertTriangle className="w-3 h-3 text-rose-500" />
              )}
              <Clock className="w-3 h-3" />{" "}
              {new Date(report.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded ${
              report.status === "submitted"
                ? "bg-emerald-500/10 text-emerald-500"
                : "bg-amber-500/10 text-amber-500"
            }`}
          >
            {{
              submitted: t("status.submitted"),
              draft: t("status.draft"),
            }[report.status] || report.status}
          </span>
          <button className="btn btn-secondary !p-3 rounded-xl border-[var(--border-primary)] group-hover:border-[var(--brand-orange)]">
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MonthlyBreakdown({ reports }) {
  // Group reports by month+year
  const groups = {};
  reports.forEach((r) => {
    const d = new Date(r.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    if (!groups[key])
      groups[key] = {
        label,
        key,
        standups: 0,
        retros: 0,
        users: new Set(),
        reports: [],
      };
    if (r.report_type === "standup") groups[key].standups++;
    else groups[key].retros++;
    groups[key].users.add(r.user_name);
    groups[key].reports.push(r);
  });

  const sorted = Object.values(groups).sort((a, b) =>
    b.key.localeCompare(a.key),
  );

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-black uppercase tracking-wider text-[var(--text-primary)]">
        Monthly Activity
      </h3>
      <div className="grid grid-cols-1 gap-4">
        {sorted.map((group) => (
          <div key={group.key} className="card border-[var(--border-primary)]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-[var(--brand-orange)]" />
                <h4 className="text-lg font-black uppercase tracking-tight">
                  {group.label}
                </h4>
              </div>
              <div className="flex gap-3 text-[10px] font-bold text-slate-500">
                <span>{group.standups} Stand-ups</span>
                <span>{group.retros} Retros</span>
                <span>{group.users.size} Members</span>
              </div>
            </div>
            <div className="w-full h-2 bg-primary rounded-full overflow-hidden flex">
              <div
                className="h-full bg-[var(--brand-orange)] transition-all"
                style={{
                  width: `${(group.standups / (group.standups + group.retros || 1)) * 100}%`,
                }}
              />
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{
                  width: `${(group.retros / (group.standups + group.retros || 1)) * 100}%`,
                }}
              />
            </div>
            <div className="flex items-center gap-1 mt-2 text-[8px] font-bold text-slate-600">
              <span className="w-2 h-2 rounded-full bg-[var(--brand-orange)]" />{" "}
              Stand-ups
              <span className="w-2 h-2 rounded-full bg-emerald-500 ml-3" />{" "}
              Retros
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendsDashboard({ reports, allReports, onViewReport }) {
  // Monthly report volume
  const monthlyData = useMemo(() => {
    const groups = {};
    allReports.forEach((r) => {
      const d = new Date(r.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      if (!groups[key])
        groups[key] = { label, key, standups: 0, retros: 0, blockers: 0 };
      if (r.report_type === "standup") groups[key].standups++;
      else groups[key].retros++;
      if (r.has_blockers) groups[key].blockers++;
    });
    return Object.values(groups).sort((a, b) => a.key.localeCompare(b.key));
  }, [allReports]);

  const maxMonthly = Math.max(
    ...monthlyData.map((m) => m.standups + m.retros),
    1,
  );

  // Blocker trend
  const blockerTrend = monthlyData.filter((m) => m.blockers > 0).slice(-6);
  const maxBlockers = Math.max(...blockerTrend.map((m) => m.blockers), 1);

  // Recent staff activity
  const recentStaff = useMemo(() => {
    const userMap = {};
    allReports.forEach((r) => {
      if (!userMap[r.user_id])
        userMap[r.user_id] = {
          id: r.user_id,
          name: r.user_name,
          role: r.user_role,
          latest: null,
          total: 0,
        };
      userMap[r.user_id].total++;
      if (
        !userMap[r.user_id].latest ||
        new Date(r.created_at) > new Date(userMap[r.user_id].latest)
      ) {
        userMap[r.user_id].latest = r.created_at;
      }
    });
    return Object.values(userMap)
      .sort((a, b) => new Date(b.latest) - new Date(a.latest))
      .slice(0, 8);
  }, [allReports]);

  return (
    <div className="space-y-8">
      {/* Monthly Report Volume Chart */}
      <div className="card">
        <h3 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-6">
          Monthly Report Volume
        </h3>
        <div className="space-y-3">
          {monthlyData.slice(-6).map((m) => {
            const total = m.standups + m.retros;
            const pct = (total / maxMonthly) * 100;
            return (
              <div key={m.key}>
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1">
                  <span>{m.label}</span>
                  <span className="font-black text-[var(--text-primary)]">
                    {total} reports
                  </span>
                </div>
                <div className="w-full h-5 bg-primary rounded-lg overflow-hidden flex">
                  <div
                    className="h-full bg-[var(--brand-orange)] transition-all"
                    style={{ width: `${(m.standups / maxMonthly) * 100}%` }}
                  />
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${(m.retros / maxMonthly) * 100}%` }}
                  />
                </div>
                <div className="flex items-center gap-3 mt-1 text-[7px] font-bold text-slate-600">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-orange)]" />{" "}
                    {m.standups} stand-ups
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{" "}
                    {m.retros} retros
                  </span>
                  {m.blockers > 0 && (
                    <span className="flex items-center gap-1 text-rose-500">
                      <AlertTriangle className="w-2.5 h-2.5" /> {m.blockers}{" "}
                      blockers
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Blocker Trend */}
        <div className="card">
          <h3 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-4">
            Blockers Over Time
          </h3>
          {blockerTrend.length > 0 ? (
            <div className="space-y-2.5">
              {blockerTrend.map((m) => (
                <div key={m.key}>
                  <div className="flex items-center justify-between text-[9px] font-bold mb-1">
                    <span className="text-slate-500">{m.label}</span>
                    <span className="text-rose-500 font-black">
                      {m.blockers} blocker{m.blockers > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-primary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-500 rounded-full transition-all"
                      style={{ width: `${(m.blockers / maxBlockers) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-40" />
              <p className="text-[10px] text-slate-500 italic">
                No blockers reported.
              </p>
            </div>
          )}
        </div>

        {/* Recently Active Staff */}
        <div className="card">
          <h3 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-4">
            Recently Active
          </h3>
          <div className="space-y-2">
            {recentStaff.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-3 rounded-lg bg-primary border border-[var(--border-primary)]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-tertiary flex items-center justify-center text-[9px] font-black uppercase">
                    {s.name?.charAt(0)}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-tight">
                      {s.name}
                    </p>
                    <p className="text-[8px] text-slate-500">
                      {s.total} reports ·{" "}
                      {new Date(s.latest).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <span
                  className={`w-2 h-2 rounded-full ${new Date(s.latest) > new Date(Date.now() - 7 * 86400000) ? "bg-emerald-500" : "bg-amber-500"}`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportDetailModal({ report, onClose }) {
  const { t } = useI18n();
  const [weekTasks, setWeekTasks] = useState([]);
  const [weekTasksLoading, setWeekTasksLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [expandedTaskMeta, setExpandedTaskMeta] = useState(null);
  const [taskLogs, setTaskLogs] = useState({});

  useEffect(() => {
    if (!report?.user_id || !report?.week_number || !report?.year) return;
    setWeekTasksLoading(true);
    Promise.all([
      fetch(
        `/api/tasks?user_id=${report.user_id}&week=${report.week_number}&year=${report.year}&sort=oldest`,
      ),
      fetch("/api/projects"),
    ])
      .then(async ([tRes, pRes]) => {
        const tData = await tRes.json();
        const pData = await pRes.json();
        if (tData.success) setWeekTasks(tData.tasks || []);
        if (pData.success) setProjects(pData.projects || []);
        setWeekTasksLoading(false);
      })
      .catch(() => setWeekTasksLoading(false));
  }, [report]);

  const projectMap = {};
  projects.forEach((p) => {
    projectMap[p.id] = p;
  });

  const renderStatusBadge = (status) => {
    const cfg = {
      pending: {
        label: "Pending",
        color: "text-slate-400",
        bg: "bg-slate-500/10",
      },
      in_progress: {
        label: "Active",
        color: "text-blue-400",
        bg: "bg-blue-500/10",
      },
      blocked: {
        label: "Blocked",
        color: "text-rose-400",
        bg: "bg-rose-500/10",
      },
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
    const c = cfg[status] || cfg.pending;
    return (
      <span
        className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${c.bg} ${c.color}`}
      >
        {c.label}
      </span>
    );
  };

  const fetchTaskLogs = async (taskId) => {
    if (taskLogs[taskId]) return;
    try {
      const res = await fetch(`/api/tasks/logs?task_id=${taskId}`);
      const data = await res.json();
      if (data.success)
        setTaskLogs((prev) => ({ ...prev, [taskId]: data.logs || [] }));
    } catch (e) {
      /* silent */
    }
  };

  const formatDate = (d) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString("en", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return d;
    }
  };

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm print:bg-white print:!fixed print:!inset-0 print:!z-[9999] print:!overflow-auto"
      onClick={() => {
        if (!window.printing) onClose();
      }}
    >
      <div className="card w-full max-w-2xl space-y-6 border-[var(--brand-orange)]/30 animate-in text-left overflow-y-auto max-h-[90vh] print:!max-h-none print:!shadow-none print:!border-none print:!p-0 print:!bg-white print:!text-black print:!w-full print:!max-w-full print:!m-0">
        {/* Header */}
        <div className="flex justify-between items-start print:hidden">
          <div>
            <span className="text-[10px] font-bold text-[var(--brand-orange)] uppercase tracking-[0.4em]">
              {report.report_type === "standup" ? "Stand-Up" : "Retro"} Report ·
              W{report.week_number}
            </span>
            <h3 className="text-2xl font-bold text-white uppercase tracking-tight mt-1">
              {report.user_name}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                const modalEl = document.getElementById("report-pdf-content");
                if (!modalEl) return;
                try {
                  const html2canvas = (await import("html2canvas")).default;
                  const { jsPDF } = await import("jspdf");
                  const canvas = await html2canvas(modalEl, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: "#ffffff",
                  });
                  const imgData = canvas.toDataURL("image/png");
                  const pdf = new jsPDF("p", "mm", "a4");
                  const pdfWidth = pdf.internal.pageSize.getWidth();
                  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                  let heightLeft = pdfHeight;
                  let position = 0;
                  const pageHeight = pdf.internal.pageSize.getHeight();
                  pdf.addImage(
                    imgData,
                    "PNG",
                    0,
                    position,
                    pdfWidth,
                    pdfHeight,
                  );
                  heightLeft -= pageHeight;
                  while (heightLeft > 0) {
                    position = heightLeft - pdfHeight;
                    pdf.addPage();
                    pdf.addImage(
                      imgData,
                      "PNG",
                      0,
                      position,
                      pdfWidth,
                      pdfHeight,
                    );
                    heightLeft -= pageHeight;
                  }
                  const reportType =
                    report.report_type === "standup" ? "StandUp" : "Retro";
                  pdf.save(
                    `${report.user_name?.replace(/\s+/g, "_")}_Week${report.week_number}_${reportType}.pdf`,
                  );
                } catch (e) {
                  console.error("PDF export error:", e);
                }
              }}
              className="btn btn-secondary !py-2 !px-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
            >
              <Download className="w-4 h-4" /> Export PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded-lg"
            >
              <svg
                className="w-6 h-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </button>
          </div>
        </div>

        {/* PDF header with logo */}
        <div
          className="flex items-center gap-4 p-4 border-b border-[var(--border-primary)]"
          id="report-pdf-content"
        >
          <img
            src="/brand/logo_full.png"
            alt="Future Studio"
            className="h-10 object-contain"
            crossOrigin="anonymous"
          />
          <div>
            <h1 className="text-lg font-black text-[var(--text-primary)] uppercase tracking-tight">
              {report.user_name}
            </h1>
            <p className="text-[10px] text-slate-500">
              {report.report_type === "standup" ? "Stand-Up" : "Retro"} — Week{" "}
              {report.week_number} · {report.year}
            </p>
          </div>
        </div>

        {/* Info bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 bg-tertiary rounded-2xl border border-[var(--border-primary)] print:bg-gray-50 print:border print:border-gray-200 print:rounded print:p-4">
          <div className="space-y-0.5">
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest print:text-gray-500">
              Team Member
            </p>
            <p className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide print:text-black">
              {report.user_name}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest print:text-gray-500">
              Role
            </p>
            <p className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide print:text-black">
              {formatLabel(report.user_role)}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest print:text-gray-500">
              Week
            </p>
            <p className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide print:text-black">
              W{report.week_number} · {report.year}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest print:text-gray-500">
              Submitted
            </p>
            <p className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide print:text-black">
              {new Date(report.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Report content — Task Table */}
        {weekTasksLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Loading tasks...
            </span>
          </div>
        ) : weekTasks.length === 0 ? (
          <p className="text-[10px] text-slate-600 italic text-center py-8">
            No tasks found for this week.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)]">
            <table className="w-full">
              <thead>
                <tr className="bg-tertiary border-b border-[var(--border-primary)]">
                  <th className="text-left px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
                    Task
                  </th>
                  <th className="text-left px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
                    Project
                  </th>
                  <th className="text-left px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="text-left px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
                    Start
                  </th>
                  <th className="text-left px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
                    End
                  </th>
                  <th className="text-center px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
                    Blockers
                  </th>
                  <th className="text-center px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
                    Subtasks
                  </th>
                  <th className="text-center px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
                    Carry
                  </th>
                </tr>
              </thead>
              <tbody>
                {weekTasks.map((task) => {
                  const activeBlockers = (task.blockers || []).filter(
                    (b) => b.status === "active",
                  ).length;
                  return (
                    <React.Fragment key={task.id}>
                      <tr
                        className="border-b border-[var(--border-primary)]/40 hover:bg-tertiary/30 transition-colors cursor-pointer"
                        onClick={() => {
                          const id =
                            expandedTaskMeta === task.id ? null : task.id;
                          setExpandedTaskMeta(id);
                          if (id) fetchTaskLogs(task.id);
                        }}
                      >
                        <td className="px-3 py-2.5 text-[10px] font-bold text-[var(--text-primary)]">
                          <div className="flex items-center gap-1.5">
                            <ChevronRight
                              className={`w-3 h-3 text-slate-500 transition-transform ${expandedTaskMeta === task.id ? "rotate-90" : ""}`}
                            />
                            {task.title}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-[9px] text-slate-500">
                          {projectMap[task.project_id]?.name || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-[9px] text-slate-500">
                          {task.category || "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          {renderStatusBadge(task.status)}
                        </td>
                        <td className="px-3 py-2.5 text-[9px] text-slate-500">
                          {formatDate(task.start_date)}
                        </td>
                        <td className="px-3 py-2.5 text-[9px] text-slate-500">
                          {formatDate(task.end_date)}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {activeBlockers > 0 ? (
                            <div className="flex items-center justify-center gap-1">
                              <Shield className="w-3 h-3 text-rose-400" />
                              <span className="text-[9px] font-bold text-rose-400">
                                {activeBlockers}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {task.subtasks?.length > 0 ? (
                            <span className="text-[9px] font-bold text-indigo-400">
                              {task.subtasks.length}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {task.status === "carried_over" && (
                            <span className="text-[8px] font-bold text-indigo-400">
                              &#10003;
                            </span>
                          )}
                        </td>
                      </tr>
                      {/* Subtask rows */}
                      {task.subtasks?.length > 0 && (
                        <tr className="bg-tertiary/20">
                          <td colSpan={9} className="px-6 py-1.5">
                            <div className="space-y-0.5">
                              {task.subtasks.map((sub) => (
                                <div
                                  key={sub.id}
                                  className="flex items-center gap-2 text-[9px]"
                                >
                                  <span className="text-slate-500">↳</span>
                                  <span className="font-medium text-[var(--text-primary)]">
                                    {sub.title}
                                  </span>
                                  <span
                                    className={`text-[7px] font-bold px-1 py-0.5 rounded ${sub.status === "completed" ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-500/10 text-slate-400"}`}
                                  >
                                    {sub.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                      {/* Expandable task metadata row */}
                      {expandedTaskMeta === task.id && (
                        <tr className="bg-tertiary/10">
                          <td colSpan={9} className="px-6 py-2">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[9px]">
                              <div>
                                <p className="text-[7px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                                  Created
                                </p>
                                <p className="font-medium text-[var(--text-primary)]">
                                  {formatDate(task.created_at)}
                                </p>
                              </div>
                              <div>
                                <p className="text-[7px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                                  Owner
                                </p>
                                <p className="font-medium text-[var(--text-primary)]">
                                  {task.user_name || "—"}
                                </p>
                              </div>
                              <div>
                                <p className="text-[7px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                                  Project
                                </p>
                                <p className="font-medium text-[var(--text-primary)]">
                                  {projectMap[task.project_id]?.name ||
                                    task.category ||
                                    "—"}
                                </p>
                              </div>
                              <div>
                                <p className="text-[7px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                                  Carry Count
                                </p>
                                <p className="font-medium text-[var(--text-primary)]">
                                  {task.reschedule_count || 0} time
                                  {(task.reschedule_count || 0) !== 1
                                    ? "s"
                                    : ""}
                                </p>
                              </div>
                            </div>
                            {taskLogs[task.id] &&
                              taskLogs[task.id].length > 0 && (
                                <div className="mt-2 pt-2 border-t border-[var(--border-primary)]/20">
                                  <p className="text-[7px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    Activity Log
                                  </p>
                                  <div className="space-y-0.5 max-h-24 overflow-y-auto">
                                    {taskLogs[task.id]
                                      .slice(0, 5)
                                      .map((log, i) => (
                                        <div
                                          key={i}
                                          className="flex items-center gap-2 text-[8px]"
                                        >
                                          <span
                                            className={`w-1.5 h-1.5 rounded-full ${
                                              log.action_type === "TASK_CREATED"
                                                ? "bg-emerald-500"
                                                : log.action_type ===
                                                    "TASK_ASSIGNED"
                                                  ? "bg-blue-500"
                                                  : log.action_type ===
                                                      "TASK_COMPLETED"
                                                    ? "bg-emerald-500"
                                                    : "bg-slate-500"
                                            }`}
                                          />
                                          <span className="text-slate-500">
                                            {log.action_type?.replace(
                                              /_/g,
                                              " ",
                                            )}
                                          </span>
                                          <span className="text-slate-600">
                                            {log.created_at
                                              ? new Date(
                                                  log.created_at,
                                                ).toLocaleDateString("en", {
                                                  month: "short",
                                                  day: "numeric",
                                                })
                                              : ""}
                                          </span>
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Blockers detail section */}
        {weekTasks.some((t) => (t.blockers || []).length > 0) && (
          <div className="space-y-2">
            <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest">
              Blockers
            </p>
            {weekTasks
              .filter((t) => (t.blockers || []).length > 0)
              .map((task) => (
                <div key={task.id} className="space-y-1">
                  <p className="text-[10px] font-bold text-[var(--text-primary)]">
                    {task.title}
                  </p>
                  {task.blockers.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center gap-2 pl-4 text-[9px]"
                    >
                      <Shield
                        className={`w-2.5 h-2.5 ${b.status === "active" ? "text-rose-400" : "text-emerald-400"}`}
                      />
                      <span className="font-medium text-[var(--text-primary)]">
                        {b.title}
                      </span>
                      <span
                        className={`text-[7px] font-bold px-1 py-0.5 rounded ${b.status === "active" ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"}`}
                      >
                        {b.status}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
          </div>
        )}

        {/* Carry-Over Trace */}
        {weekTasks.filter(
          (t) => t.status === "carried_over" || (t.reschedule_count || 0) > 0,
        ).length > 0 && (
          <div className="space-y-2">
            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">
              Carry-Over History
            </p>
            {weekTasks
              .filter(
                (t) =>
                  t.status === "carried_over" || (t.reschedule_count || 0) > 0,
              )
              .map((task) => {
                const weeks = task.reschedule_count || 0;
                const trace = [];
                for (let i = weeks; i >= 0; i--) {
                  let w = report.week_number - i;
                  let y = report.year;
                  if (w < 1) {
                    w += 52;
                    y--;
                  }
                  trace.push(`W${w}`);
                }
                return (
                  <div key={task.id} className="card p-3 border-indigo-500/20">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold text-[var(--text-primary)]">
                        {task.title}
                      </p>
                      <span
                        className={`text-[8px] font-bold px-2 py-0.5 rounded ${weeks >= 3 ? "bg-amber-500/10 text-amber-400" : "bg-indigo-500/10 text-indigo-400"}`}
                      >
                        {weeks} week{weeks !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      {trace.map((w, i) => (
                        <React.Fragment key={w}>
                          <span
                            className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${i === trace.length - 1 ? "bg-indigo-500/10 text-indigo-400" : "bg-tertiary text-slate-500"}`}
                          >
                            {w}
                          </span>
                          {i < trace.length - 1 && (
                            <ChevronRight className="w-2.5 h-2.5 text-slate-600" />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {/* Task Action Logs */}
        {weekTasks.filter((t) => expandedTaskMeta === t.id).length > 0 &&
          taskLogs[expandedTaskMeta] &&
          taskLogs[expandedTaskMeta].length > 0 && (
            <div className="space-y-2">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                Assignment History
              </p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {taskLogs[expandedTaskMeta].map((log, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-[9px] py-1 px-2 rounded-lg bg-tertiary/50"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[7px] font-bold px-1 py-0.5 rounded ${
                          log.action_type === "TASK_CREATED"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : log.action_type === "TASK_ASSIGNED"
                              ? "bg-blue-500/10 text-blue-400"
                              : log.action_type === "TASK_ACCEPTED"
                                ? "bg-indigo-500/10 text-indigo-400"
                                : log.action_type === "TASK_COMPLETED"
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : log.action_type === "TASK_CARRIED_OVER"
                                    ? "bg-amber-500/10 text-amber-400"
                                    : "bg-slate-500/10 text-slate-400"
                        }`}
                      >
                        {log.action_type?.replace(/_/g, " ")}
                      </span>
                      <span className="text-slate-500">
                        {log.description || ""}
                      </span>
                    </div>
                    <span className="text-slate-600">
                      {log.created_at
                        ? new Date(log.created_at).toLocaleDateString("en", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        {/* Print footer */}
        <div className="hidden print:!block print:mt-8 print:pt-4 print:border-t print:border-gray-300 print:text-xs print:text-gray-400">
          <p>Generated from ImpactOS — {new Date().toLocaleDateString()}</p>
        </div>

        <button
          onClick={onClose}
          className="btn btn-primary w-full py-4 font-bold uppercase tracking-widest print:hidden"
        >
          {t("common.close")}
        </button>
      </div>
    </div>
  );
}

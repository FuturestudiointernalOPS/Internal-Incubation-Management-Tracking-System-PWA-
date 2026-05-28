"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
 * - Recurring blockers tracking
 * - PDF export via browser print
 */

function formatLabel(val) {
  if (!val || val === "—") return "—";
  if (typeof val !== "string") return String(val);
  return val.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function InfoBlock({ label, value }) {
  return (
    <div className="p-3 bg-[var(--bg-primary)] rounded-xl border border-[var(--border-primary)] print:bg-white print:border-gray-200 print:rounded print:p-2.5">
      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 print:text-gray-500">
        {label}
      </p>
      <p className="text-xs font-bold text-[var(--text-primary)] leading-snug print:text-black whitespace-pre-wrap">
        {value || "—"}
      </p>
    </div>
  );
}

function parseJsonArray(val) {
  try {
    const parsed = typeof val === "string" ? JSON.parse(val) : val;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

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
  const [activeTab, setActiveTab] = useState("feed"); // "feed" | "monthly" | "blockers"

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/op-reports");
      const data = await res.json();
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
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const matchesSearch =
        r.user_name?.toLowerCase().includes(search.toLowerCase()) ||
        String(r.week_number).includes(search) ||
        String(r.year).includes(search);
      const matchesUser =
        filterUser === "All Users" || r.user_id === filterUser;
      const matchesType = filterType === "all" || r.report_type === filterType;

      let matchesMonth = true;
      if (filterMonth !== "all") {
        const created = new Date(r.created_at);
        const monthIndex = created.getMonth();
        matchesMonth = MONTHS[monthIndex] === filterMonth;
      }

      return matchesSearch && matchesUser && matchesType && matchesMonth;
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

  // Aggregated blocker data
  const blockerData = useMemo(() => {
    const blockers = reports.filter((r) => r.has_blockers);
    const byUser = {};
    blockers.forEach((r) => {
      if (!byUser[r.user_id])
        byUser[r.user_id] = { name: r.user_name, count: 0, reports: [] };
      byUser[r.user_id].count++;
      byUser[r.user_id].reports.push(r);
    });
    return Object.values(byUser).sort((a, b) => b.count - a.count);
  }, [reports]);

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
              Dashboard
            </button>
            <div className="flex items-center gap-2 mt-2">
              <BarChart3 className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                Operational Reports
              </span>
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              Company Reports
            </h1>
          </div>

          <div className="flex gap-3">
            <StatCard label="Total Reports" value={reports.length} />
            <StatCard label="Team Members" value={users.length} />
            <StatCard label="This Month" value={filteredReports.length} />
          </div>
        </header>

        {/* TAB NAVIGATION */}
        <div className="flex gap-1 border-b border-[var(--border-primary)]">
          {[
            { id: "feed", label: "Report Feed", icon: Activity },
            { id: "monthly", label: "Monthly Breakdown", icon: Calendar },
            {
              id: "blockers",
              label: "Recurring Blockers",
              icon: AlertTriangle,
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
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, week, year..."
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl py-4 pl-12 text-xs font-bold text-white outline-none focus:border-[var(--brand-orange)] transition-all"
            />
          </div>

          <div className="relative">
            <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl py-4 pl-12 pr-4 text-xs font-bold text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-[var(--brand-orange)]"
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
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl py-4 pl-12 pr-4 text-xs font-bold text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-[var(--brand-orange)]"
            >
              <option value="all">All Types</option>
              <option value="standup">Stand-Up (Monday)</option>
              <option value="retro">Retro (Friday)</option>
            </select>
          </div>

          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl py-4 pl-12 pr-4 text-xs font-bold text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-[var(--brand-orange)]"
            >
              <option value="all">All Months</option>
              {MONTHS.map((m) => (
                <option key={m}>{m}</option>
              ))}
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
                        : "bg-[var(--bg-tertiary)] border-[var(--border-primary)] hover:border-[var(--brand-orange)]/30"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black uppercase tracking-tight text-[var(--text-primary)]">
                        {stat.name}
                      </span>
                      <span className="text-[8px] font-bold text-slate-500 uppercase px-1.5 py-0.5 bg-[var(--bg-primary)] rounded">
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
                    : "Recent Reports"}
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
                    No operational reports found
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

        {activeTab === "blockers" && (
          <div className="space-y-6">
            <h3 className="text-sm font-black uppercase tracking-wider text-[var(--text-primary)]">
              Recurring Blockers
            </h3>
            {blockerData.length === 0 ? (
              <div className="card py-20 text-center opacity-40 border-dashed">
                <AlertTriangle className="w-12 h-12 mx-auto mb-3" />
                <p className="text-[10px] font-bold uppercase tracking-widest">
                  No blockers reported
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {blockerData.map((b) => (
                  <div key={b.name} className="card border-rose-500/20">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 font-black">
                          {b.count}
                        </div>
                        <div>
                          <p className="text-sm font-black uppercase tracking-tight">
                            {b.name}
                          </p>
                          <p className="text-[9px] text-rose-400 font-bold uppercase tracking-widest">
                            {b.count} blocked week{b.count > 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {b.reports.slice(0, 5).map((r) => (
                        <div
                          key={r.id}
                          onClick={() => setViewingReport(r)}
                          className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] cursor-pointer hover:border-rose-500/30 transition-all"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black">
                              W{r.week_number} · {r.year}
                            </span>
                            <span className="text-[8px] text-slate-500">
                              {r.report_type === "standup"
                                ? "Stand-Up"
                                : "Retro"}
                            </span>
                          </div>
                          <Eye className="w-3 h-3 text-slate-500" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
                className="p-2 hover:bg-[var(--bg-primary)] rounded-lg"
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

            <div className="flex gap-4 text-[10px] font-bold text-slate-500">
              <span>Total: {userReports.length} reports</span>
              <span>
                Stand-ups:{" "}
                {userReports.filter((r) => r.report_type === "standup").length}
              </span>
              <span>
                Retros:{" "}
                {userReports.filter((r) => r.report_type === "retro").length}
              </span>
              <span>
                Blockers: {userReports.filter((r) => r.has_blockers).length}
              </span>
            </div>

            <div className="space-y-2">
              {userReports.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setViewingReport(r);
                    setViewingUser(null);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-primary)] hover:border-[var(--brand-orange)]/30 transition-all text-left"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${
                        r.report_type === "standup"
                          ? "bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]"
                          : "bg-emerald-500/10 text-emerald-500"
                      }`}
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
                      className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                        r.status === "submitted"
                          ? "bg-emerald-500/10 text-emerald-500"
                          : "bg-amber-500/10 text-amber-500"
                      }`}
                    >
                      {r.status}
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
    <div className="p-3 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl px-5 flex flex-col justify-center shadow-sm min-w-[90px]">
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
  return (
    <div
      className="card group hover:border-[var(--brand-orange)] transition-all bg-[var(--bg-secondary)]/50 cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black ${
              report.report_type === "standup"
                ? "bg-[var(--brand-orange)]/10 text-[var(--brand-orange)] border border-[var(--brand-orange)]/20"
                : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
            }`}
          >
            {report.report_type === "standup" ? "M" : "F"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
                {report.user_name}
              </span>
              <span className="text-[8px] font-bold text-slate-500 uppercase px-1.5 py-0.5 bg-[var(--bg-tertiary)] rounded">
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
            {report.status}
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
            <div className="w-full h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden flex">
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

function ReportDetailModal({ report, onClose }) {
  const [expandedSections, setExpandedSections] = useState({
    standup: report.report_type === "standup",
    retro: report.report_type === "retro",
  });

  const toggleSection = (key) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const standupItems =
    report.report_type === "standup" ? (
      <>
        <Section
          title="Top Priorities This Week"
          color="text-[var(--brand-orange)]"
          expanded={expandedSections.standup}
          onToggle={() => toggleSection("standup")}
        >
          <InfoBlock
            label="Priorities"
            value={
              parseJsonArray(report.top_priorities)
                .map((i) => `• ${i}`)
                .join("\n") || "—"
            }
          />
        </Section>
        <Section
          title="Expected Deliverables"
          color="text-blue-500"
          expanded={true}
        >
          <InfoBlock
            label="Deliverables"
            value={
              parseJsonArray(report.expected_deliverables)
                .map((i) => `• ${i}`)
                .join("\n") || "—"
            }
          />
        </Section>
        {report.projects_tasks && (
          <Section
            title="Projects / Tasks"
            color="text-indigo-500"
            expanded={true}
          >
            <InfoBlock label="Tasks" value={report.projects_tasks} />
          </Section>
        )}
        {report.has_dependencies != null && (
          <Section title="Dependencies" color="text-indigo-500" expanded={true}>
            <InfoBlock
              label="Has Dependencies"
              value={report.has_dependencies ? "Yes" : "No"}
            />
            {report.dependency_note && (
              <InfoBlock label="Note" value={report.dependency_note} />
            )}
          </Section>
        )}
        <Section title="Risks & Support" color="text-rose-500" expanded={true}>
          <div className="space-y-2">
            <InfoBlock
              label="Anticipated Blockers"
              value={
                report.has_blockers ? report.blocker_description || "Yes" : "No"
              }
            />
            <InfoBlock
              label="Needs Support"
              value={report.needs_support ? report.support_note || "Yes" : "No"}
            />
          </div>
        </Section>
        {report.additional_notes && (
          <Section
            title="Additional Notes"
            color="text-slate-500"
            expanded={true}
          >
            <InfoBlock label="Notes" value={report.additional_notes} />
          </Section>
        )}
      </>
    ) : null;

  const retroItems =
    report.report_type === "retro" ? (
      <>
        <Section
          title="What Was Completed"
          color="text-emerald-500"
          expanded={true}
        >
          <InfoBlock
            label="Completed"
            value={
              parseJsonArray(report.completed_work)
                .map((i) => `• ${i}`)
                .join("\n") || "—"
            }
          />
        </Section>
        {parseJsonArray(report.unfinished_tasks).length > 0 && (
          <Section
            title="What Was Not Completed"
            color="text-amber-500"
            expanded={true}
          >
            <InfoBlock
              label="Not Completed"
              value={
                parseJsonArray(report.unfinished_tasks)
                  .map((i) => `• ${i}`)
                  .join("\n") || "—"
              }
            />
          </Section>
        )}
        {report.week_status && (
          <Section
            title="Overall Week Status"
            color="text-purple-500"
            expanded={true}
          >
            <InfoBlock label="Status" value={formatLabel(report.week_status)} />
          </Section>
        )}
        {report.had_blockers != null && (
          <Section
            title="Roadblocks & Challenges"
            color="text-rose-500"
            expanded={true}
          >
            <div className="space-y-2">
              <InfoBlock
                label="Experienced Blockers"
                value={report.had_blockers ? "Yes" : "No"}
              />
              {report.blocker_type && (
                <InfoBlock
                  label="Blocker Type"
                  value={formatLabel(report.blocker_type)}
                />
              )}
              {report.blocker_desc && (
                <InfoBlock label="Description" value={report.blocker_desc} />
              )}
            </div>
          </Section>
        )}
        {parseJsonArray(report.wins).length > 0 && (
          <Section
            title="Wins & Progress"
            color="text-[var(--brand-orange)]"
            expanded={true}
          >
            <div className="space-y-2">
              <InfoBlock
                label="What Went Well"
                value={parseJsonArray(report.wins)
                  .map((i) => `• ${i}`)
                  .join("\n")}
              />
              {report.major_achievement && (
                <InfoBlock
                  label="Major Achievement"
                  value={report.major_achievement}
                />
              )}
            </div>
          </Section>
        )}
        {parseJsonArray(report.carryover_items).length > 0 && (
          <Section title="Carryover" color="text-indigo-500" expanded={true}>
            <InfoBlock
              label="Tasks Carrying Over"
              value={parseJsonArray(report.carryover_items)
                .map((i) => `• ${i}`)
                .join("\n")}
            />
          </Section>
        )}
        {report.retro_notes && (
          <Section title="Retro Notes" color="text-slate-500" expanded={true}>
            <InfoBlock label="Notes" value={report.retro_notes} />
          </Section>
        )}
      </>
    ) : null;

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
              onClick={() => {
                window.printing = true;
                window.print();
                setTimeout(() => {
                  window.printing = false;
                }, 1000);
              }}
              className="btn btn-secondary !py-2 !px-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
            >
              <Download className="w-4 h-4" /> Export PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[var(--bg-primary)] rounded-lg"
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

        {/* Print header */}
        <div className="hidden print:!block print:mb-6 print:pb-4 print:border-b print:border-gray-300">
          <h1 className="text-2xl font-bold text-black">{report.user_name}</h1>
          <p className="text-sm text-gray-600 mt-1">
            {report.report_type === "standup"
              ? "Monday Stand-Up"
              : "Friday Retro"}{" "}
            — Week {report.week_number} · {report.year}
          </p>
        </div>

        {/* Info bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 bg-[var(--bg-tertiary)] rounded-2xl border border-[var(--border-primary)] print:bg-gray-50 print:border print:border-gray-200 print:rounded print:p-4">
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

        {/* Report content */}
        {standupItems}
        {retroItems}

        {/* Print footer */}
        <div className="hidden print:!block print:mt-8 print:pt-4 print:border-t print:border-gray-300 print:text-xs print:text-gray-400">
          <p>Generated from ImpactOS — {new Date().toLocaleDateString()}</p>
        </div>

        <button
          onClick={onClose}
          className="btn btn-primary w-full py-4 font-bold uppercase tracking-widest print:hidden"
        >
          Close Report
        </button>
      </div>
    </div>
  );
}

function Section({ title, color, expanded = true, onToggle, children }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h5
          className={`text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-2 border-b border-white/10 pb-2 flex-1 ${color} print:border-gray-200 print:text-gray-700`}
        >
          {title}
        </h5>
        {onToggle && (
          <button
            onClick={onToggle}
            className="p-1 text-slate-500 hover:text-white transition-all"
          >
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>
      {expanded && children}
    </section>
  );
}

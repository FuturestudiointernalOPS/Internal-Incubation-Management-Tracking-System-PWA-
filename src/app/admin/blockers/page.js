"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import {
  Search,
  Filter,
  Users,
  AlertTriangle,
  ArrowLeft,
  X,
  CheckCircle2,
  Clock,
  Eye,
  Shield,
  ListTodo,
  ChevronRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { TableSkeleton } from "@/components/ui/Skeleton";

/**
 * SUPER ADMIN BLOCKERS DASHBOARD
 *
 * Dedicated blocker management page.
 * Displays all blockers with task and user context.
 * Default view: active blockers first, resolved below.
 *
 * Rules:
 *   - Only blocker creator can mark resolved
 *   - Super Admin can view, filter, monitor but NOT resolve
 */

const SEVERITY_CONFIG = {
  low: { label: "Low", color: "text-slate-400", bg: "bg-slate-500/10" },
  medium: { label: "Medium", color: "text-amber-500", bg: "bg-amber-500/10" },
  high: { label: "High", color: "text-rose-500", bg: "bg-rose-500/10" },
  critical: { label: "Critical", color: "text-red-600", bg: "bg-red-600/10" },
};

function formatSeverity(severity) {
  const config = SEVERITY_CONFIG[severity];
  return config ? config.label : severity;
}

function getSeverityColor(severity) {
  const config = SEVERITY_CONFIG[severity];
  return config ? config.color : "text-slate-400";
}

function getSeverityBg(severity) {
  const config = SEVERITY_CONFIG[severity];
  return config ? config.bg : "bg-slate-500/10";
}

export default function AdminBlockers() {
  const router = useRouter();
  const [blockers, setBlockers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterUser, setFilterUser] = useState("All Users");
  const [viewingBlocker, setViewingBlocker] = useState(null);
  const { t } = useI18n();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [blockerRes, taskRes] = await Promise.all([
        fetch("/api/blockers"),
        fetch("/api/tasks"),
      ]);
      const blockerData = await blockerRes.json();
      const taskData = await taskRes.json();
      if (blockerData.success) setBlockers(blockerData.blockers || []);
      if (taskData.success) setTasks(taskData.tasks || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Build task lookup
  const taskMap = useMemo(() => {
    const map = {};
    tasks.forEach((t) => {
      map[t.id] = t;
    });
    return map;
  }, [tasks]);

  // Build user list from blockers
  const users = useMemo(() => {
    const userMap = {};
    blockers.forEach((b) => {
      if (b.user_id && !userMap[b.user_id]) {
        userMap[b.user_id] = { id: b.user_id, name: b.user_name };
      }
    });
    return Object.values(userMap);
  }, [blockers]);

  // Filtered + sorted: active first, then resolved
  const filteredBlockers = useMemo(() => {
    return blockers
      .filter((b) => {
        const matchesSearch =
          b.title?.toLowerCase().includes(search.toLowerCase()) ||
          b.user_name?.toLowerCase().includes(search.toLowerCase());
        const matchesStatus =
          filterStatus === "all" || b.status === filterStatus;
        const matchesUser =
          filterUser === "All Users" || b.user_id === filterUser;
        return matchesSearch && matchesStatus && matchesUser;
      })
      .sort((a, b) => {
        // Active first, then resolved
        if (a.status === "active" && b.status !== "active") return -1;
        if (a.status !== "active" && b.status === "active") return 1;
        // Within same status, newest first
        return new Date(b.created_at) - new Date(a.created_at);
      });
  }, [blockers, search, filterStatus, filterUser]);

  const stats = useMemo(() => {
    return {
      active: blockers.filter((b) => b.status === "active").length,
      resolved: blockers.filter((b) => b.status === "resolved").length,
      total: blockers.length,
    };
  }, [blockers]);

  const getTaskTitle = (taskId) => {
    const task = taskMap[taskId];
    return task ? task.title : `Task #${taskId}`;
  };

  return (
    <DashboardLayout role="super_admin">
      <div className="space-y-8 pb-20 text-left">
        {/* HEADER */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <button
              onClick={() => router.push("/admin")}
              className="group flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--brand-orange)] transition-all font-bold text-[9px] uppercase tracking-widest"
            >
              <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />{" "}
              Dashboard
            </button>
            <div className="flex items-center gap-2 mt-2">
              <Shield className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                {t("navigation.internalReports")}
              </span>
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              {t("reports.blockers")}
            </h1>
          </div>

          <div className="flex gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-black text-rose-500">
                  {stats.active} {t("reports.active")}
                </span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-black text-emerald-500">
                  {stats.resolved} {t("reports.resolved")}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* STATS ROW */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card flex items-center gap-4 p-5 border-l-4 border-rose-500">
            <AlertTriangle className="w-6 h-6 text-rose-500" />
            <div>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                {t("reports.active")}
              </p>
              <p className="text-2xl font-black text-rose-500">
                {stats.active}
              </p>
            </div>
          </div>
          <div className="card flex items-center gap-4 p-5 border-l-4 border-emerald-500">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            <div>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                {t("reports.resolved")}
              </p>
              <p className="text-2xl font-black text-emerald-500">
                {stats.resolved}
              </p>
            </div>
          </div>
          <div className="card flex items-center gap-4 p-5 border-l-4 border-[var(--brand-orange)]">
            <Shield className="w-6 h-6 text-[var(--brand-orange)]" />
            <div>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                {t("reports.blockers")}
              </p>
              <p className="text-2xl font-black">{stats.total}</p>
            </div>
          </div>
        </div>

        {/* FILTERS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl py-4 pl-12 pr-4 text-xs font-bold text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-[var(--brand-orange)]"
            >
              <option value="all">All Statuses</option>
              <option value="active">{t("status.active")}</option>
              <option value="resolved">{t("status.resolved")}</option>
            </select>
          </div>
        </div>

        {/* BLOCKERS TABLE */}
        {loading ? (
          <TableSkeleton rows={8} />
        ) : filteredBlockers.length === 0 ? (
          <div className="card py-32 flex flex-col items-center justify-center text-center opacity-40 border-dashed">
            <Shield className="w-16 h-16 mb-4" />
            <p className="text-[10px] font-bold uppercase tracking-widest">
              {t("reports.noBlockersFound")}
            </p>
            <p className="text-[9px] text-slate-500 mt-2">
              Blockers will appear here once tied to tasks.
            </p>
          </div>
        ) : (
          <div className="card !p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border-primary)]">
                    <th className="text-left p-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      Blocker
                    </th>
                    <th className="text-left p-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      Owner
                    </th>
                    <th className="text-left p-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      Linked Task
                    </th>
                    <th className="text-center p-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      Severity
                    </th>
                    <th className="text-center p-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      Status
                    </th>
                    <th className="text-center p-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      {t("time.created")}
                    </th>
                    <th className="text-center p-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      {t("time.updated")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBlockers.map((blocker) => (
                    <tr
                      key={blocker.id}
                      className={`border-b border-[var(--border-primary)]/50 hover:bg-white/5 transition-colors ${
                        blocker.status === "active"
                          ? "bg-rose-500/5"
                          : "opacity-60"
                      }`}
                    >
                      <td className="p-4">
                        <button
                          onClick={() => setViewingBlocker(blocker)}
                          className="text-left group"
                        >
                          <p className="text-xs font-bold uppercase tracking-tight text-[var(--text-primary)] group-hover:text-[var(--brand-orange)] transition-colors">
                            {blocker.title}
                          </p>
                          {blocker.description && (
                            <p className="text-[9px] text-slate-500 mt-0.5 line-clamp-1">
                              {blocker.description}
                            </p>
                          )}
                        </button>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[8px] font-black uppercase">
                            {blocker.user_name?.charAt(0) || "?"}
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-tight">
                            {blocker.user_name || "Unknown"}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => router.push(`/admin/tasks`)}
                          className="text-[10px] font-bold text-indigo-500 hover:underline flex items-center gap-1"
                        >
                          <ListTodo className="w-3 h-3" />
                          {getTaskTitle(blocker.task_id)}
                        </button>
                      </td>
                      <td className="text-center p-4">
                        <span
                          className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded ${getSeverityBg(blocker.severity)} ${getSeverityColor(blocker.severity)}`}
                        >
                          {formatSeverity(blocker.severity)}
                        </span>
                      </td>
                      <td className="text-center p-4">
                        <span
                          className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded ${
                            blocker.status === "active"
                              ? "bg-rose-500/10 text-rose-500"
                              : "bg-emerald-500/10 text-emerald-500"
                          }`}
                        >
                          {blocker.status === "active"
                            ? t("status.active")
                            : t("status.resolved")}
                        </span>
                      </td>
                      <td className="text-center p-4">
                        <span className="text-[9px] text-slate-500">
                          {new Date(blocker.created_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="text-center p-4">
                        <span className="text-[9px] text-slate-500">
                          {blocker.resolved_at
                            ? new Date(blocker.resolved_at).toLocaleDateString()
                            : "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* BLOCKER DETAIL MODAL */}
        {viewingBlocker && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setViewingBlocker(null)}
            />
            <div className="relative bg-secondary border border-[var(--border-primary)] rounded-2xl w-full max-w-lg p-8 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
                  Blocker Details
                </h3>
                <button
                  onClick={() => setViewingBlocker(null)}
                  className="p-2 rounded-lg hover:bg-white/5 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                    Title
                  </p>
                  <p className="text-sm font-bold text-[var(--text-primary)]">
                    {viewingBlocker.title}
                  </p>
                </div>

                {viewingBlocker.description && (
                  <div>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Description
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {viewingBlocker.description}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Owner
                    </p>
                    <p className="text-xs font-bold text-[var(--text-primary)]">
                      {viewingBlocker.user_name || "Unknown"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Linked Task
                    </p>
                    <p className="text-xs font-bold text-indigo-500">
                      {getTaskTitle(viewingBlocker.task_id)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Severity
                    </p>
                    <span
                      className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded ${getSeverityBg(viewingBlocker.severity)} ${getSeverityColor(viewingBlocker.severity)}`}
                    >
                      {formatSeverity(viewingBlocker.severity)}
                    </span>
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Status
                    </p>
                    <span
                      className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded ${
                        viewingBlocker.status === "active"
                          ? "bg-rose-500/10 text-rose-500"
                          : "bg-emerald-500/10 text-emerald-500"
                      }`}
                    >
                      {viewingBlocker.status === "active"
                        ? t("status.active")
                        : t("status.resolved")}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      {t("time.created")}
                    </p>
                    <p className="text-[10px] font-bold text-[var(--text-primary)]">
                      {new Date(viewingBlocker.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {viewingBlocker.resolved_at && (
                    <div>
                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                        Resolved At
                      </p>
                      <p className="text-[10px] font-bold text-emerald-500">
                        {new Date(
                          viewingBlocker.resolved_at,
                        ).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-[var(--border-primary)] bg-amber-500/5 p-4 rounded-xl">
                  <p className="text-[8px] font-black text-amber-500 uppercase tracking-widest">
                    Super Admin Notice
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Only{" "}
                    <span className="font-bold text-white">
                      {viewingBlocker.user_name || "the blocker creator"}
                    </span>{" "}
                    can mark this blocker as resolved. Super Admins can view and
                    monitor but cannot resolve blockers.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

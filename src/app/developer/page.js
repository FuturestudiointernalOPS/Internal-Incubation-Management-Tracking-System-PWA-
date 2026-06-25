"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  Bug,
  Clock,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useI18n } from "@/lib/i18n";

export default function DeveloperDashboard() {
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);
  const [userRole, setUserRole] = useState("developer");
  const [priorityTasks, setPriorityTasks] = useState([]);
  const [recentErrors, setRecentErrors] = useState([]);

  useEffect(() => {
    // Get user role from localStorage for layout
    try {
      const saved = localStorage.getItem("user");
      if (saved) {
        const u = JSON.parse(saved);
        setUserRole(u.role || "developer");
      }
    } catch (_) {}
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch error logs
      const errRes = await fetch(
        "/api/errors?resolved=false&severity=critical",
      );
      const errData = await errRes.json();
      if (errData.success) {
        setErrors(errData.errors || []);
        setRecentErrors((errData.errors || []).slice(0, 5));
      }

      // Fetch user's session for dashboard data
      const sessionRes = await fetch("/api/auth/session");
      const sessionData = await sessionRes.json();
      if (sessionData.authenticated && sessionData.user) {
        const userId = sessionData.user.cid;
        const userRole = sessionData.user.role;

        // Fetch priority tasks assigned to this user
        const taskRes = await fetch(
          `/api/tasks?assigned_to=${userId}&role=${userRole}&sort=priority`,
        );
        const taskData = await taskRes.json();
        if (taskData.success) {
          const tasks = taskData.tasks || [];
          // Sort: critical first, then high, then medium, then low
          const sorted = tasks.sort((a, b) => {
            const order = { critical: 0, high: 1, medium: 2, low: 3 };
            return (order[a.priority] || 4) - (order[b.priority] || 4);
          });
          setPriorityTasks(
            sorted.filter(
              (t) => t.priority === "critical" || t.priority === "high",
            ),
          );
        }
      }
    } catch (e) {
      console.error("Failed to fetch dashboard data", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalErrors = errors.length;
  const unresolvedErrors = errors.filter((e) => !e.resolved).length;
  const criticalErrors = errors.filter(
    (e) => e.severity === "critical" || e.severity === "fatal",
  ).length;

  const stats = [
    {
      label: "Critical Errors",
      value: criticalErrors,
      icon: Bug,
      color: "var(--chart-danger, #ef4444)",
      bg: "rgba(239,68,68,0.1)",
    },
    {
      label: "Unresolved",
      value: unresolvedErrors,
      icon: AlertTriangle,
      color: "var(--brand-orange)",
      bg: "rgba(255,102,0,0.1)",
    },
    {
      label: "Priority Tasks",
      value: priorityTasks.length,
      icon: Clock,
      color: "var(--chart-warning, #f59e0b)",
      bg: "rgba(245,158,11,0.1)",
    },
  ];

  return (
    <DashboardLayout role={userRole} activeTab="dashboard">
      <div className="space-y-8 pb-20">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                Developer Workspace
              </span>
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              Developer Dashboard Developer Dashboard
            </h1>
            <p className="text-xs font-bold text-[var(--text-secondary)] opacity-60">
              Your tasks, errors, and daily workflow
            </p>
          </div>
        </header>

        {/* Stats Cards */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div
              className="w-6 h-6 border-2 border-t-[var(--brand-orange)] rounded-full animate-spin"
              style={{
                borderColor: "rgba(255,102,0,0.1)",
                borderTopColor: "var(--brand-orange)",
              }}
            />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="card bg-secondary border-[var(--border-primary)] p-6 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                      {stat.label}
                    </p>
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: stat.bg }}
                    >
                      <stat.icon
                        className="w-5 h-5"
                        style={{ color: stat.color }}
                      />
                    </div>
                  </div>
                  <p
                    className="text-3xl font-black tracking-tight"
                    style={{ color: stat.color }}
                  >
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Priority Tasks Section */}
            {priorityTasks.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[var(--chart-warning, #f59e0b)]" />
                  <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">
                    Priority Tasks
                  </h2>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 uppercase tracking-wider">
                    Critical & High
                  </span>
                </div>
                <div className="space-y-2">
                  {priorityTasks.map((task) => (
                    <div
                      key={task.id}
                      className="ios-card !p-4 border-l-4 border-l-red-500 hover:border-[var(--brand-orange)]/30 transition-all cursor-pointer"
                      onClick={() => router.push("/developer/my-tasks")}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              task.priority === "critical"
                                ? "bg-red-500"
                                : "bg-amber-400"
                            }`}
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                              {task.title}
                            </p>
                            {task.end_date && (
                              <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                                Due:{" "}
                                {new Date(task.end_date).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                        <span
                          className={`text-[8px] font-bold px-2 py-0.5 rounded uppercase tracking-wider shrink-0 ml-2 ${
                            task.priority === "critical"
                              ? "bg-red-500/10 text-red-400"
                              : "bg-amber-500/10 text-amber-400"
                          }`}
                        >
                          {task.priority}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Links */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => router.push("/developer/errors")}
                className="ios-card !p-6 flex items-center gap-4 hover:border-[var(--brand-orange)]/30 transition-all text-left"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(239,68,68,0.1)" }}
                >
                  <Bug className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">
                    Error Logs
                  </p>
                  <p className="text-[10px] font-bold text-[var(--text-secondary)] mt-0.5">
                    View and manage all captured errors
                  </p>
                </div>
              </button>
              <button
                onClick={() => router.push("/developer/assigned-tasks")}
                className="ios-card !p-6 flex items-center gap-4 hover:border-[var(--brand-orange)]/30 transition-all text-left"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(245,158,11,0.1)" }}
                >
                  <Clock className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">
                    My Assigned Tasks
                  </p>
                  <p className="text-[10px] font-bold text-[var(--text-secondary)] mt-0.5">
                    View all tasks assigned to you
                  </p>
                </div>
              </button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

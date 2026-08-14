"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ListTodo,
  ChevronRight,
  RefreshCw,
  Calendar,
  User,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useI18n } from "@/lib/i18n";

export default function AssignedTasks() {
  const { t } = useI18n();
  const [userRole, setUserRole] = useState("developer");
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [pendingAssignments, setPendingAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("user");
      if (saved) {
        const u = JSON.parse(saved);
        setUser(u);
        setUserRole(u.role || "developer");
      }
    } catch (_) {}
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const sessionRes = await fetch("/api/auth/session");
      const sessionData = await sessionRes.json();
      if (!sessionData.authenticated || !sessionData.user) return;
      const userId = sessionData.user.cid;
      if (!user) setUser(sessionData.user);

      // Fetch accepted/active assigned tasks
      const tasksRes = await fetch(
        `/api/tasks?assigned_to=${userId}&sort=priority`,
      );
      const tasksData = await tasksRes.json();
      if (tasksData.success) setTasks(tasksData.tasks || []);

      // Fetch pending assignments (accept/decline workflow)
      const assignRes = await fetch(
        `/api/tasks/assignments?assignee_id=${userId}&status=pending`,
      );
      const assignData = await assignRes.json();
      if (assignData.success)
        setPendingAssignments(assignData.assignments || []);
    } catch (e) {
      console.error("Failed to fetch data", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleResponse = async (assignmentId, action) => {
    setResponding(assignmentId);
    try {
      const res = await fetch("/api/tasks/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignment_id: assignmentId, action }),
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      } else {
        window.dispatchEvent(new CustomEvent('impactos:notify', { detail: { type: 'error', message: t((data.error || "Failed to respond") || "") || (data.error || "Failed to respond") } }));
      }
    } catch (e) {
      window.dispatchEvent(new CustomEvent('impactos:notify', { detail: { type: 'error', message: "Network error" } }));
    } finally {
      setResponding(null);
    }
  };

  const criticalTasks = tasks.filter((t) => t.priority === "critical");
  const highTasks = tasks.filter((t) => t.priority === "high");
  const normalTasks = tasks.filter(
    (t) => t.priority !== "critical" && t.priority !== "high",
  );

  const TaskCard = ({ task }) => (
    <div
      className={`card p-4 ${task.priority === "critical" ? "border-rose-500/30 bg-rose-500/5" : task.priority === "high" ? "border-amber-500/30 bg-amber-500/5" : ""}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-[var(--text-primary)] truncate">
              {task.title}
            </h3>
            {task.priority === "critical" && (
              <span className="text-[8px] font-black text-rose-400 px-1.5 py-0.5 rounded-full bg-rose-500/10 uppercase">
                {t("developer.critical")}
              </span>
            )}
            {task.priority === "high" && (
              <span className="text-[8px] font-black text-amber-400 px-1.5 py-0.5 rounded-full bg-amber-500/10 uppercase">
                {t("developer.high")}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-1.5">
            <span className="flex items-center gap-1 text-[9px] text-slate-500">
              <User className="w-3 h-3" />{" "}
              {task.user_name || t("developer.unknown")}
            </span>
            {task.end_date && (
              <span className="flex items-center gap-1 text-[9px] text-slate-500">
                <Calendar className="w-3 h-3" /> Due:{" "}
                {new Date(task.end_date).toLocaleDateString("en-GB")}
              </span>
            )}
            <span
              className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full ${task.status === "completed" ? "bg-emerald-500/10 text-emerald-400" : task.status === "blocked" ? "bg-rose-500/10 text-rose-400" : "bg-blue-500/10 text-blue-400"}`}
            >
              {task.status === "in_progress" ? "In Progress" : task.status}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <DashboardLayout role={userRole} activeTab="assigned_tasks">
      <div className="space-y-8 pb-20">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ListTodo className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                {t("developer.assignedWork")}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              {t("developer.assignedTasks")}
            </h1>
            <p className="text-xs font-bold text-[var(--text-secondary)] opacity-60">
              {t("developer.assignedSubtitle")}
            </p>
          </div>
          <button
            onClick={fetchData}
            className="btn btn-secondary gap-2 !px-4 !py-2.5"
          >
            <RefreshCw className="w-4 h-4" /> {t("developer.refresh")}
          </button>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-5 h-5 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Pending Assignments — Accept / Decline */}
            {pendingAssignments.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  {t("developer.pendingReview")} ({pendingAssignments.length})
                </h2>
                <p className="text-[10px] text-slate-500">
                  {t("developer.pendingHint")}
                </p>
                <div className="space-y-3">
                  {pendingAssignments.map((a) => (
                    <div
                      key={a.id}
                      className="card p-4 border-amber-500/20 bg-amber-500/[0.03]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-bold text-[var(--text-primary)]">
                            {a.task_title}
                          </h3>
                          <div className="flex items-center gap-3 mt-1 text-[9px] text-slate-500">
                            <span className="flex items-center gap-1">
                              <Send className="w-3 h-3" />{" "}
                              {t("developer.assignedBy")}{" "}
                              {a.assigner_name || t("developer.unknown")}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />{" "}
                              {new Date(a.created_at).toLocaleDateString(
                                "en-GB",
                              )}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => handleResponse(a.id, "decline")}
                            disabled={responding === a.id}
                            className="flex items-center gap-1.5 px-4 py-2 bg-rose-500/10 text-rose-400 rounded-lg text-[8px] font-black uppercase tracking-wider hover:bg-rose-500 hover:text-white transition-all disabled:opacity-40"
                          >
                            <XCircle className="w-3.5 h-3.5" />{" "}
                            {t("developer.decline")}
                          </button>
                          <button
                            onClick={() => handleResponse(a.id, "accept")}
                            disabled={responding === a.id}
                            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-lg text-[8px] font-black uppercase tracking-wider hover:bg-emerald-500 hover:text-white transition-all disabled:opacity-40"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />{" "}
                            {t("developer.accept")}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Critical Priority Tasks */}
            {criticalTasks.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  {t("developer.critical")} ({criticalTasks.length})
                </h2>
                <div className="space-y-2">
                  {criticalTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              </div>
            )}

            {/* High Priority Tasks */}
            {highTasks.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  {t("developer.highPriority")} ({highTasks.length})
                </h2>
                <div className="space-y-2">
                  {highTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              </div>
            )}

            {/* Normal Priority Tasks */}
            {normalTasks.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2">
                  <ListTodo className="w-4 h-4 text-[var(--brand-orange)]" />
                  {t("developer.tasks")} ({normalTasks.length})
                </h2>
                <div className="space-y-2">
                  {normalTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              </div>
            )}

            {criticalTasks.length === 0 &&
              highTasks.length === 0 &&
              normalTasks.length === 0 &&
              pendingAssignments.length === 0 && (
                <div className="text-center py-20">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                  <p className="text-sm font-bold text-slate-500">
                    {t("developer.noAssignedTasks")}
                  </p>
                  <p className="text-[10px] text-slate-600 mt-1">
                    {t("developer.noAssignedTasksHint")}
                  </p>
                </div>
              )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

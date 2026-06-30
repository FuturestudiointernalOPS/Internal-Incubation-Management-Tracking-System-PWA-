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
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function AssignedTasks() {
  const [userRole, setUserRole] = useState("developer");
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("user");
      if (saved) {
        const u = JSON.parse(saved);
        setUserRole(u.role || "developer");
      }
    } catch (_) {}
  }, []);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const sessionRes = await fetch("/api/auth/session");
      const sessionData = await sessionRes.json();
      if (sessionData.authenticated && sessionData.user) {
        const userId = sessionData.user.cid;
        const res = await fetch(`/api/tasks?assigned_to=${userId}&sort=priority`);
        const data = await res.json();
        if (data.success) {
          setTasks(data.tasks || []);
        }
      }
    } catch (e) {
      console.error("Failed to fetch assigned tasks", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const priorityTasks = tasks.filter((t) => t.priority === "critical" || t.priority === "high");
  const otherTasks = tasks.filter((t) => t.priority !== "critical" && t.priority !== "high");

  return (
    <DashboardLayout role={userRole} activeTab="assigned_tasks">
      <div className="space-y-8 pb-20">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ListTodo className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                Developer Workspace
              </span>
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              Assigned Tasks
            </h1>
            <p className="text-xs font-bold text-[var(--text-secondary)] opacity-60">
              {tasks.length} tasks assigned to you
            </p>
          </div>
          <button
            onClick={fetchTasks}
            className="flex items-center gap-2 px-4 py-2.5 bg-secondary border border-[var(--border-primary)] rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-tertiary transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-t-[var(--brand-orange)] rounded-full animate-spin"
              style={{ borderColor: "rgba(255,102,0,0.1)", borderTopColor: "var(--brand-orange)" }}
            />
          </div>
        ) : tasks.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center opacity-40">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4" />
            <p className="text-lg font-black text-[var(--text-primary)] uppercase">No assigned tasks</p>
            <p className="text-xs font-bold text-slate-500 mt-1">
              Tasks assigned to you will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Priority Section */}
            {priorityTasks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">Priority</h2>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-red-500/10 text-red-400 uppercase tracking-wider">
                    {priorityTasks.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {priorityTasks.map((task) => (
                    <div key={task.id} className={`ios-card !p-4 border-l-4 ${task.priority === "critical" ? "border-l-red-500" : "border-l-amber-400"}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                              task.priority === "critical" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"
                            }`}>{task.priority}</span>
                            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-400 uppercase tracking-wider">
                              {task.status?.replace("_", " ") || "pending"}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-[var(--text-primary)]">{task.title}</p>
                          {task.end_date && (
                            <p className="text-[8px] font-bold text-slate-500 mt-0.5 flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> Due: {new Date(task.end_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Other Tasks */}
            {otherTasks.length > 0 && (
              <div>
                <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider mb-3">All Tasks</h2>
                <div className="space-y-2">
                  {otherTasks.map((task) => (
                    <div key={task.id} className="ios-card !p-4 border-[var(--border-primary)]">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-400 uppercase tracking-wider">
                              {task.status?.replace("_", " ") || "pending"}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-[var(--text-primary)]">{task.title}</p>
                          {task.end_date && (
                            <p className="text-[8px] font-bold text-slate-500 mt-0.5">
                              Due: {new Date(task.end_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

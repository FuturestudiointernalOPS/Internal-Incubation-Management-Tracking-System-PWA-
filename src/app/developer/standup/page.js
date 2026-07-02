"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  MessageSquare,
  Send,
  Save,
  Plus,
  ChevronLeft,
  ChevronRight,
  Target,
  CheckCircle2,
  RotateCcw,
  X,
  Shield,
  Archive,
} from "lucide-react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import TaskManager from "@/components/tasks/TaskManager";
import { useI18n } from "@/lib/i18n";

function getWeekNumber(date) {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function getCurrentWeek() {
  const now = new Date();
  return { week: getWeekNumber(now), year: now.getFullYear() };
}

function formatDate(dateStr) {
  if (!dateStr) return "\u2014";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

const STATUS_CONFIG = {
  pending: { color: "text-slate-400", bg: "bg-slate-500/10" },
  in_progress: { color: "text-blue-400", bg: "bg-blue-500/10" },
  blocked: { color: "text-rose-400", bg: "bg-rose-500/10" },
  completed: { color: "text-emerald-400", bg: "bg-emerald-500/10" },
  carried_over: { color: "text-amber-400", bg: "bg-amber-500/10" },
};

const statusLabelKey = (status) => {
  const map = {
    pending: "status.pending",
    in_progress: "status.inProgress",
    blocked: "status.blocked",
    completed: "status.completed",
    carried_over: "status.carriedOver",
  };
  return map[status] || "status.pending";
};

export default function DeveloperStandup() {
  const router = useRouter();
  const { t } = useI18n();
  const [user, setUser] = useState(null);
  const [weekInfo, setWeekInfo] = useState(getCurrentWeek());
  const [tasks, setTasks] = useState([]);
  const [history, setHistory] = useState([]);
  const [showStandupModal, setShowStandupModal] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskRows, setTaskRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [assignedProjects, setAssignedProjects] = useState([]);
  const [existingReport, setExistingReport] = useState(null);

  const [form, setForm] = useState({
    top_priorities: [],
    expected_deliverables: [],
    projects_tasks: "",
    has_dependencies: null,
    dependency_note: "",
    has_blockers: null,
    blocker_description: "",
    needs_support: null,
    support_note: "",
    additional_notes: "",
    completed_work: [],
    unfinished_tasks: [],
    challenges: "",
    wins: [],
    carryover_items: [],
    retro_notes: "",
  });

  const notify = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem("user");
      if (!saved) {
        router.push("/login");
        return;
      }
      const u = JSON.parse(saved);
      if (!u.id && !u.cid) {
        router.push("/login");
        return;
      }
      setUser(u);
    } catch (e) {
      router.push("/login");
    }
  }, [router]);

  const fetchTasks = useCallback(async () => {
    if (!user) return;
    try {
      const userId = user.cid || user.id;
      const statuses = [
        "pending",
        "in_progress",
        "blocked",
        "carried_over",
        "completed",
      ];
      const ownResults = await Promise.all(
        statuses.map((s) =>
          fetch(`/api/tasks?user_id=${userId}&status=${s}`).then((r) =>
            r.json(),
          ),
        ),
      );
      const ownTasks = ownResults.flatMap((data) => {
        if (!data || typeof data !== "object") return [];
        return Array.isArray(data) ? data : data.tasks || [];
      });
      const taskMap = new Map();
      ownTasks.forEach((t) => {
        if (!taskMap.has(t.id)) taskMap.set(t.id, t);
      });
      setTasks(Array.from(taskMap.values()));
    } catch (e) {
      console.error("Failed to fetch tasks:", e);
    }
  }, [user]);

  const fetchHistory = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/op-reports?user_id=${user.cid || user.id}`);
      const data = await res.json();
      if (data.success) setHistory(data.reports || []);
    } catch (e) {}
  }, [user]);

  const fetchAssignedProjects = useCallback(async () => {
    if (!user?.cid && !user?.id) return;
    try {
      const userId = user.cid || user.id;
      const res = await fetch(`/api/projects/assignments?user_cid=${userId}`);
      const data = await res.json();
      if (data.success) {
        const all = [
          ...(data.owned || []),
          ...(data.collab || []),
          ...(data.all_active || []),
        ];
        const seen = new Set();
        setAssignedProjects(
          all.filter((p) => {
            if (seen.has(String(p.id))) return false;
            seen.add(String(p.id));
            return true;
          }),
        );
      }
    } catch (e) {
      console.error("Failed to fetch projects:", e);
    }
  }, [user]);

  const handleSubmit = async (status = "submitted") => {
    if (!user) return;
    setSaving(true);
    try {
      const userId = user.cid || user.id;
      const body = {
        user_id: userId,
        user_name: user.name || "",
        user_role: user.role || "staff",
        report_type: "standup",
        week_number: weekInfo.week,
        year: weekInfo.year,
        status,
        top_priorities: JSON.stringify(form.top_priorities),
        expected_deliverables: JSON.stringify(form.expected_deliverables),
        projects_tasks: form.projects_tasks || null,
        has_dependencies: form.has_dependencies,
        dependency_note: form.dependency_note || null,
        has_blockers: form.has_blockers,
        blocker_description: form.blocker_description || null,
        needs_support: form.needs_support,
        support_note: form.support_note || null,
        additional_notes: form.additional_notes || null,
      };
      const res = await fetch("/api/op-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        notify(
          status === "submitted" ? "Standup submitted!" : "Draft saved",
          "success",
        );
        setTaskRows([]);
        setShowTaskForm(false);
        fetchReport();
        fetchHistory();
        fetchTasks();
      } else {
        notify(data.error || "Failed to save", "error");
      }
    } catch (e) {
      notify("Network error", "error");
    } finally {
      setSaving(false);
    }
  };

  const fetchReport = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/op-reports?user_id=${user.cid || user.id}&type=standup&week=${weekInfo.week}&year=${weekInfo.year}`,
      );
      const data = await res.json();
      if (data.success) {
        const report = data.reports[0] || null;
        setExistingReport(report);
        if (report) {
          setForm((p) => ({
            ...p,
            top_priorities: (() => {
              try {
                const v = JSON.parse(report.top_priorities);
                return Array.isArray(v) ? v : [];
              } catch {
                return [];
              }
            })(),
            expected_deliverables: (() => {
              try {
                const v = JSON.parse(report.expected_deliverables);
                return Array.isArray(v) ? v : [];
              } catch {
                return [];
              }
            })(),
            projects_tasks: report.projects_tasks || "",
            has_dependencies:
              report.has_dependencies != null
                ? Boolean(report.has_dependencies)
                : null,
            dependency_note: report.dependency_note || "",
            has_blockers:
              report.has_blockers != null ? Boolean(report.has_blockers) : null,
            blocker_description: report.blocker_description || "",
            needs_support:
              report.needs_support != null
                ? Boolean(report.needs_support)
                : null,
            support_note: report.support_note || "",
            additional_notes: report.additional_notes || "",
          }));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user, weekInfo]);

  useEffect(() => {
    if (user) {
      fetchReport();
      fetchHistory();
      fetchTasks();
      fetchAssignedProjects();
    }
  }, [user, fetchReport, fetchHistory, fetchTasks, fetchAssignedProjects]);

  const navigateWeek = (direction) => {
    const newWeek = weekInfo.week + direction;
    const newYear = weekInfo.year;
    if (newWeek < 1) setWeekInfo({ week: 52, year: newYear - 1 });
    else if (newWeek > 52) setWeekInfo({ week: 1, year: newYear + 1 });
    else setWeekInfo({ week: newWeek, year: newYear });
  };

  const hasCurrentWeekStandup = history.some(
    (r) =>
      r.report_type === "standup" &&
      r.week_number === getCurrentWeek().week &&
      r.year === getCurrentWeek().year,
  );

  return (
    <DashboardLayout role={user?.role || "developer"}>
      <div className="space-y-8 pb-20 text-left">
        {toast && (
          <div
            className={`fixed bottom-6 right-6 z-[500] px-6 py-3 rounded-lg text-sm font-bold uppercase tracking-widest border shadow-2xl ${toast.type === "error" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}
          >
            {toast.msg}
          </div>
        )}

        {/* Header */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                WEEKLY STANDUP
              </span>
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              Standup
            </h1>
            <p className="text-xs font-bold text-[var(--text-secondary)] opacity-60">
              Plan and track your weekly work
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigateWeek(-1)}
              className="btn btn-secondary !p-3 rounded-xl"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-center px-4">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                Week {weekInfo.week} — {weekInfo.year}
              </p>
            </div>
            <button
              onClick={() => navigateWeek(1)}
              className="btn btn-secondary !p-3 rounded-xl"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Create / Edit Standup */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              Weekly Standup
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Manage your weekly plans and tasks
            </p>
          </div>
          <button
            onClick={async () => {
              if (hasCurrentWeekStandup) return;
              setShowStandupModal(true);
              setWeekInfo(getCurrentWeek());
              const now = new Date();
              const curWeek = getWeekNumber(now);
              const curYear = now.getFullYear();
              let prevWeek = curWeek - 1;
              let prevYear = curYear;
              if (prevWeek < 1) {
                prevWeek = 52;
                prevYear = curYear - 1;
              }
              const userId = user?.cid || user?.id;
              try {
                const res = await fetch(
                  `/api/tasks?user_id=${userId}&week=${prevWeek}&year=${prevYear}&sort=oldest`,
                );
                const data = await res.json();
                const prevWeekTasks = (data.tasks || []).filter(
                  (t) =>
                    !["archived", "completed"].includes(t.status) &&
                    !t.parent_task_id,
                );
                if (prevWeekTasks.length > 0) {
                  const rows = [];
                  for (const t of prevWeekTasks) {
                    rows.push({
                      id: t.id,
                      is_carryover: true,
                      carried_over_from_task_id: t.id,
                      name: t.title,
                      description: t.description || "",
                      project_id: t.project_id || null,
                      category: t.category || "",
                      start_date: t.start_date || "",
                      start_time: "",
                      due_date: t.end_date || "",
                      due_time: "",
                      blockers:
                        t.blockers?.map((b) => ({
                          id: b.id,
                          description: b.title,
                          severity: b.severity || "medium",
                          status: b.status || "Active",
                          created_at: b.created_at,
                        })) || [],
                      parent_task_id: null,
                      status: t.status,
                      collaborators: [],
                      uncompleted_reason: "",
                    });
                    if (t.subtasks?.length > 0) {
                      for (const st of t.subtasks) {
                        if (["archived", "completed"].includes(st.status))
                          continue;
                        rows.push({
                          id: st.id,
                          is_carryover: true,
                          carried_over_from_task_id: st.id,
                          name: st.title,
                          description: "",
                          project_id: t.project_id || null,
                          category: t.category || "",
                          start_date: "",
                          start_time: "",
                          due_date: "",
                          due_time: "",
                          blockers: [],
                          parent_task_id: t.id,
                          status: st.status,
                          collaborators: [],
                          uncompleted_reason: "",
                        });
                      }
                    }
                  }
                  setTaskRows(rows);
                  setShowTaskForm(false);
                  return;
                }
              } catch (e) {
                console.error("Failed to fetch previous week tasks:", e);
              }
              setShowTaskForm(true);
            }}
            disabled={hasCurrentWeekStandup}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-[10px] font-semibold transition-all ${hasCurrentWeekStandup ? "bg-slate-200 text-slate-400 cursor-not-allowed opacity-50" : "bg-[var(--brand-orange)] text-black hover:brightness-110"}`}
          >
            <Plus className="w-4 h-4" /> Create New Standup
          </button>
        </div>

        {/* Standups History Table */}
        <div className="overflow-hidden rounded-xl border border-[var(--border-primary)]">
          <table className="w-full">
            <thead>
              <tr className="bg-tertiary border-b border-[var(--border-primary)]">
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Week
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Total Tasks
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-right px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {history
                .filter((r) => r.report_type === "standup")
                .map((report) => {
                  const taskCount = tasks.filter(
                    (t) =>
                      t.created_week === report.week_number &&
                      t.created_year === report.year,
                  ).length;
                  const key = `${report.week_number}-${report.year}`;
                  const isExpanded = false;
                  return (
                    <tr
                      key={report.id}
                      className="border-b border-[var(--border-primary)]/50 hover:bg-tertiary/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                          Week {report.week_number}
                        </span>{" "}
                        <span className="text-[10px] text-slate-500 ml-2">
                          {report.year}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[12px] font-medium text-slate-500">
                          {taskCount} tasks
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${report.status === "submitted" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}
                        >
                          {report.status === "submitted"
                            ? "Submitted"
                            : "Draft"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            setWeekInfo({
                              week: report.week_number,
                              year: report.year,
                            });
                            setShowStandupModal(true);
                          }}
                          className="text-[11px] font-medium text-[var(--brand-orange)] hover:underline flex items-center gap-1 ml-auto"
                        >
                          Edit <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              {history.filter((r) => r.report_type === "standup").length ===
                0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center">
                    <Target className="w-8 h-8 mx-auto mb-3 text-slate-500 opacity-30" />
                    <p className="text-[12px] font-medium text-slate-500 mb-1">
                      No standup reports yet
                    </p>
                    <p className="text-[10px] text-slate-600 mb-4">
                      Create your first weekly standup to start tracking your
                      work.
                    </p>
                    <button
                      onClick={() => {
                        setShowStandupModal(true);
                        setWeekInfo(getCurrentWeek());
                      }}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--brand-orange)] text-black rounded-lg text-[10px] font-semibold hover:brightness-110 transition-all"
                    >
                      <Plus className="w-4 h-4" /> Create New Standup
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Standup Modal */}
      {showStandupModal && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowStandupModal(false)}
        >
          <div
            className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-secondary border border-[var(--border-primary)] rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 bg-primary border-b border-[var(--border-primary)]">
              <div className="flex items-center justify-between px-6 py-4">
                <div>
                  <h2 className="text-base font-bold text-[var(--text-primary)]">
                    Standup Week {weekInfo.week}
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {weekInfo.year}
                  </p>
                </div>
                <button
                  onClick={() => setShowStandupModal(false)}
                  className="p-1.5 hover:bg-tertiary rounded-md transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="px-6 py-4 space-y-6">
              {/* Carry Over Tasks */}
              <div>
                <h3 className="text-[11px] font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
                  <ChevronRight className="w-3.5 h-3.5" /> Carry-Over Tasks
                </h3>
                {tasks.filter((t) => t.status === "carried_over").length ===
                0 ? (
                  <p className="text-[10px] text-slate-600 italic py-2">
                    No carry-over tasks.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {tasks
                      .filter((t) => t.status === "carried_over")
                      .map((task) => (
                        <div
                          key={task.id}
                          className="flex items-start gap-3 p-3 rounded-xl border border-indigo-500/20 bg-indigo-500/[0.03]"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold text-[var(--text-primary)]">
                              {task.title}
                            </p>
                            <div className="flex flex-wrap gap-2 mt-1">
                              <span className="text-[8px] text-slate-500">
                                Due: {formatDate(task.end_date)}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={async () => {
                                await fetch("/api/tasks", {
                                  method: "PUT",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    id: task.id,
                                    status: "in_progress",
                                    user_id: user?.cid || user?.id,
                                  }),
                                });
                                fetchTasks();
                              }}
                              className="px-2.5 py-1 text-[8px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500 hover:text-white transition-all"
                            >
                              Continue
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Weekly Focus */}
              <div>
                <h3 className="text-[11px] font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5" /> Weekly Focus
                </h3>
                <TaskManager
                  mode="standup"
                  userId={user?.cid || user?.id}
                  userName={user?.name || ""}
                  projects={assignedProjects}
                  taskList={tasks}
                  onTasksChange={fetchTasks}
                  weekInfo={weekInfo}
                  showCarryOver={false}
                />
              </div>

              {/* Additional Notes */}
              <div>
                <h3 className="text-[11px] font-semibold text-slate-500 mb-2">
                  Additional Notes
                </h3>
                <textarea
                  value={form.additional_notes}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, additional_notes: e.target.value }))
                  }
                  rows={2}
                  placeholder="Anything else to note?"
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-4 py-2.5 text-xs outline-none font-bold text-[var(--text-primary)] focus:border-slate-500 transition-all resize-none"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-[var(--border-primary)] sticky bottom-0 bg-primary px-6 py-4">
              <button
                onClick={() => {
                  handleSubmit("draft");
                  setShowStandupModal(false);
                }}
                disabled={saving}
                className="flex-1 btn btn-secondary gap-2 py-4"
              >
                <Save className="w-4 h-4" />{" "}
                {saving ? "Saving..." : "Save Draft"}
              </button>
              <button
                onClick={() => {
                  handleSubmit("submitted");
                  setShowStandupModal(false);
                }}
                disabled={saving}
                className="flex-1 btn btn-primary gap-2 py-4"
              >
                <Send className="w-4 h-4" /> {saving ? "Saving..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

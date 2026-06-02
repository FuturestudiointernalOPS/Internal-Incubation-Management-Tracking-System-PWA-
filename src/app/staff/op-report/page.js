"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  Send,
  Clock,
  AlertTriangle,
  Trophy,
  Target,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Save,
  FileText,
  Users,
  BarChart3,
  Shield,
  Plus,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useI18n } from "@/lib/i18n";

/**
 * STAFF OPERATIONAL REPORT PAGE
 *
 * Team members submit weekly stand-up (Monday) and retro (Friday) reports.
 * Each user sees only their own report history.
 */

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

export default function StaffOpReport() {
  const router = useRouter();
  const { t } = useI18n();
  const [user, setUser] = useState(null);
  const [reportType, setReportType] = useState("standup"); // "standup" | "retro" | "summary"
  const [weekInfo, setWeekInfo] = useState(getCurrentWeek());
  const [existingReport, setExistingReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [history, setHistory] = useState([]);
  const [showStandupModal, setShowStandupModal] = useState(false);

  // Form state
  const [form, setForm] = useState({
    // Stand-up (structured)
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
    // Retro fields (structured)
    completed_work: [],
    unfinished_tasks: [],
    week_status: "",
    had_blockers: null,
    blocker_type: "",
    blocker_desc: "",
    wins: [],
    major_achievement: "",
    carryover_items: [],
    retro_notes: "",
  });

  // Temporary input for adding bullet items
  const [newPriority, setNewPriority] = useState("");
  const [newDeliverable, setNewDeliverable] = useState("");
  const [newCompleted, setNewCompleted] = useState("");
  const [newUnfinished, setNewUnfinished] = useState("");
  const [newWin, setNewWin] = useState("");
  const [newCarryover, setNewCarryover] = useState("");

  // Task integration state (Phase 4)
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [taskCreationOpen, setTaskCreationOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskProject, setNewTaskProject] = useState("");
  const [newTaskStartDate, setNewTaskStartDate] = useState("");
  const [newTaskEndDate, setNewTaskEndDate] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);
  const [reconciledTasks, setReconciledTasks] = useState({});

  // Structured task row state
  const [assignedProjects, setAssignedProjects] = useState([]);
  const [allStaff, setAllStaff] = useState([]);
  const [taskRows, setTaskRows] = useState([]);
  const [blockerModal, setBlockerModal] = useState(null); // { taskRowIndex } or null
  const [newBlockerDesc, setNewBlockerDesc] = useState("");
  const [staffSearch, setStaffSearch] = useState("");

  const notify = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchReport = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/op-reports?user_id=${user.cid || user.id}&type=${reportType}&week=${weekInfo.week}&year=${weekInfo.year}`,
      );
      const data = await res.json();
      if (data.success) {
        const report = data.reports[0] || null;
        setExistingReport(report);
        if (report) {
          // Parse JSON arrays safely
          try {
            report.top_priorities =
              typeof report.top_priorities === "string"
                ? JSON.parse(report.top_priorities)
                : report.top_priorities || [];
          } catch {
            report.top_priorities = [];
          }
          try {
            report.expected_deliverables =
              typeof report.expected_deliverables === "string"
                ? JSON.parse(report.expected_deliverables)
                : report.expected_deliverables || [];
          } catch {
            report.expected_deliverables = [];
          }

          setForm({
            top_priorities: report.top_priorities || [],
            expected_deliverables: report.expected_deliverables || [],
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
            completed_work: report.completed_work || "",
            unfinished_tasks: report.unfinished_tasks || "",
            challenges: report.challenges || "",
            wins: report.wins || "",
            carryover_items: report.carryover_items || "",
            retro_notes: report.retro_notes || "",
          });
        } else {
          setForm({
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
            completed_work: "",
            unfinished_tasks: "",
            challenges: "",
            wins: "",
            carryover_items: "",
            retro_notes: "",
          });
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user, reportType, weekInfo]);

  const fetchHistory = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/op-reports?user_id=${user.cid || user.id}`);
      const data = await res.json();
      if (data.success) setHistory(data.reports || []);
    } catch (e) {}
  }, [user]);

  const fetchTasks = useCallback(async () => {
    if (!user) return;
    setLoadingTasks(true);
    try {
      const userId = user.cid || user.id;
      const statuses = ["pending", "in_progress", "blocked", "carried_over"];
      const results = await Promise.all(
        statuses.map((s) =>
          fetch(`/api/tasks?user_id=${userId}&status=${s}`).then((r) =>
            r.json(),
          ),
        ),
      );
      const allTasks = results.flatMap((data) => {
        if (!data || typeof data !== "object") return [];
        return Array.isArray(data) ? data : data.tasks || [];
      });
      setTasks(allTasks);
    } catch (e) {
      console.error("Failed to fetch tasks:", e);
    } finally {
      setLoadingTasks(false);
    }
  }, [user]);

  // Fetch assigned projects for dropdown
  const fetchAssignedProjects = useCallback(async () => {
    if (!user?.cid && !user?.id) return;
    try {
      const userId = user.cid || user.id;
      const res = await fetch(`/api/projects/assignments?user_cid=${userId}`);
      const data = await res.json();
      if (data.success) setAssignedProjects(data.projects || []);
    } catch (e) {
      console.error("Failed to fetch assigned projects:", e);
    }
  }, [user]);

  // Fetch Future Studio staff for collaborator selection
  const fetchAllStaff = useCallback(async () => {
    try {
      const res = await fetch("/api/contacts");
      const data = await res.json();
      if (data.success) {
        // Only active staff from FUTURE STUDIO group
        const staff = (data.contacts || [])
          .filter(
            (c) =>
              c.status === "active" &&
              c.group_name?.toUpperCase() === "FUTURE STUDIO",
          )
          .map((c) => ({
            id: c.cid || c.id,
            name: c.name,
            email: c.email,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setAllStaff(staff);
      }
    } catch (e) {
      console.error("Failed to fetch staff:", e);
    }
  }, []);

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
      console.error("Failed to parse user from localStorage:", e);
      router.push("/login");
    }
  }, [router]);

  useEffect(() => {
    if (user) {
      fetchReport();
      fetchHistory();
      fetchTasks();
      fetchAssignedProjects();
      fetchAllStaff();
    }
  }, [
    user,
    fetchReport,
    fetchHistory,
    fetchTasks,
    fetchAssignedProjects,
    fetchAllStaff,
  ]);

  const handleSubmit = async (status = "submitted") => {
    if (!user) return;

    setSaving(true);
    try {
      const body = {
        user_id: user.cid || user.id,
        user_name: user.name || "",
        user_role: user.role || "staff",
        report_type: reportType,
        week_number: weekInfo.week,
        year: weekInfo.year,
        status,
        // Stand-up structured fields
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
        // Retro fields (passthrough)
        completed_work: form.completed_work || null,
        unfinished_tasks: form.unfinished_tasks || null,
        challenges: form.challenges || null,
        wins: form.wins || null,
        carryover_items: form.carryover_items || null,
        retro_notes: form.retro_notes || null,
      };
      const res = await fetch("/api/op-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        // Task reconciliation: update task statuses on retro submission
        if (reportType === "retro" && status === "submitted") {
          const userId = user.cid || user.id;
          const reconciledEntries = Object.entries(reconciledTasks);
          if (reconciledEntries.length > 0) {
            await Promise.all(
              reconciledEntries.map(async ([taskId, isCompleted]) => {
                const updateBody = {
                  id: taskId,
                  user_id: userId,
                  status: isCompleted ? "completed" : "carried_over",
                  force_complete: true,
                };
                try {
                  await fetch("/api/tasks", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(updateBody),
                  });
                } catch (e) {
                  console.error("Failed to update task", taskId, e);
                }
              }),
            );
            fetchTasks();
          }
        }

        notify(
          status === "submitted"
            ? t("reports.reportSubmitted")
            : t("reports.reportSaved"),
          "success",
        );
        fetchReport();
        fetchHistory();
      } else {
        notify(data.error || t("reports.failedToSave"), "error");
      }
    } catch (e) {
      notify(t("errors.networkError"), "error");
    } finally {
      setSaving(false);
    }
  };

  // ─── TASK ROW MANAGEMENT ───
  const addTaskRow = () => {
    setTaskRows((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: "",
        description: "",
        project_id: null,
        category: "",
        start_date: "",
        due_date: "",
        blockers: [],
        collaborators: [],
        // Retro fields
        status: null, // "completed" | "uncompleted"
        uncompleted_reason: "",
      },
    ]);
  };

  const updateTaskRow = (index, field, value) => {
    setTaskRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removeTaskRow = (index) => {
    setTaskRows((prev) => prev.filter((_, i) => i !== index));
  };

  const addBlockerToRow = (rowIndex, description) => {
    setTaskRows((prev) => {
      const updated = [...prev];
      updated[rowIndex] = {
        ...updated[rowIndex],
        blockers: [
          ...(updated[rowIndex].blockers || []),
          {
            id: Date.now(),
            description,
            severity: "medium",
            status: "Active",
            created_at: new Date().toISOString(),
          },
        ],
      };
      return updated;
    });
  };

  const updateBlockerInRow = (rowIndex, blockerId, updates) => {
    setTaskRows((prev) => {
      const updated = [...prev];
      updated[rowIndex] = {
        ...updated[rowIndex],
        blockers: (updated[rowIndex].blockers || []).map((b) =>
          b.id === blockerId ? { ...b, ...updates } : b,
        ),
      };
      return updated;
    });
  };

  const removeBlockerFromRow = (rowIndex, blockerId) => {
    setTaskRows((prev) => {
      const updated = [...prev];
      updated[rowIndex] = {
        ...updated[rowIndex],
        blockers: (updated[rowIndex].blockers || []).filter(
          (b) => b.id !== blockerId,
        ),
      };
      return updated;
    });
  };

  const resolveBlocker = (rowIndex, blockerId) => {
    setTaskRows((prev) => {
      const updated = [...prev];
      updated[rowIndex] = {
        ...updated[rowIndex],
        blockers: (updated[rowIndex].blockers || []).map((b) =>
          b.id === blockerId
            ? {
                ...b,
                status: "Resolved",
                resolved_at: new Date().toISOString(),
              }
            : b,
        ),
      };
      return updated;
    });
  };

  const navigateWeek = (direction) => {
    const newWeek = weekInfo.week + direction;
    const newYear = weekInfo.year;
    // Simple year boundary
    if (newWeek < 1) {
      setWeekInfo({ week: 52, year: newYear - 1 });
    } else if (newWeek > 52) {
      setWeekInfo({ week: 1, year: newYear + 1 });
    } else {
      setWeekInfo({ week: newWeek, year: newYear });
    }
  };

  return (
    <DashboardLayout role={user?.role || "staff"}>
      <div className="space-y-8 pb-20 text-left">
        {/* Toast */}
        {toast && (
          <div
            className={`fixed bottom-6 right-6 z-[500] px-6 py-3 rounded-lg text-sm font-bold uppercase tracking-widest border shadow-2xl ${
              toast.type === "error"
                ? "bg-rose-50 text-rose-700 border-rose-200"
                : "bg-emerald-50 text-emerald-700 border-emerald-200"
            }`}
          >
            {toast.msg}
          </div>
        )}

        {/* HEADER */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                Operational Reporting
              </span>
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              {t("reports.weeklyReport")}
            </h1>
            <p className="text-xs font-bold text-[var(--text-secondary)] opacity-60">
              Track your weekly priorities, deliverables, and progress
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
                {t("time.week")} {weekInfo.week} — {weekInfo.year}
              </p>
              <p className="text-[9px] font-bold text-[var(--text-secondary)] opacity-50 uppercase tracking-widest mt-0.5">
                {reportType === "standup"
                  ? t("reports.mondayStandup")
                  : t("reports.fridayRetro")}
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

        {/* REPORT TYPE TOGGLE */}
        <div className="flex gap-2 bg-tertiary p-1 rounded-xl border border-[var(--border-primary)] w-fit">
          <button
            onClick={() => setReportType("standup")}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              reportType === "standup"
                ? "bg-[var(--brand-orange)] text-black shadow-lg"
                : "text-slate-500 hover:text-white"
            }`}
          >
            <Calendar className="w-4 h-4" /> {t("reports.mondayStandup")}
          </button>
          <button
            onClick={() => setReportType("retro")}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              reportType === "retro"
                ? "bg-[var(--brand-orange)] text-black shadow-lg"
                : "text-slate-500 hover:text-white"
            }`}
          >
            <Trophy className="w-4 h-4" /> {t("reports.fridayRetro")}
          </button>
          <button
            onClick={() => setReportType("summary")}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              reportType === "summary"
                ? "bg-[var(--brand-orange)] text-black shadow-lg"
                : "text-slate-500 hover:text-white"
            }`}
          >
            <BarChart3 className="w-4 h-4" /> Weekly Summary
          </button>
        </div>

        {existingReport?.status === "submitted" && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
              Report already submitted for this week. You can still update it
              below.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* REPORT FORM */}
          <div className="lg:col-span-2 space-y-8">
            {reportType === "standup" ? (
              <div className="space-y-8">
                {/* ═══════════════════════════════════════ */}
                {/* THIS WEEK'S PLAN                       */}
                {/* ═══════════════════════════════════════ */}
                {/* Standup status + action */}
                <div className="text-center space-y-4">
                  {existingReport?.status === "submitted" ? (
                    <div
                      onClick={() => setShowStandupModal(true)}
                      className="cursor-pointer p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/20 space-y-2 hover:bg-emerald-500/10 transition-all"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                          Standup Submitted for W{weekInfo.week}
                        </span>
                      </div>
                      <p className="text-[9px] text-slate-500">
                        Click to update your plan
                      </p>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-500">
                      You haven't defined your plan for this week yet.
                    </p>
                  )}

                  <button
                    onClick={() => setShowStandupModal(true)}
                    className="inline-flex items-center gap-2 px-8 py-4 bg-[var(--brand-orange)] text-black rounded-xl text-[11px] font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-lg shadow-orange-500/20"
                  >
                    <Plus className="w-5 h-5" /> Create Standup
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                {/* RETRO FIELDS */}

                {/* TASK RECONCILIATION — Phase 5 */}
                <Section
                  title={t("reports.taskReconciliation")}
                  icon={CheckCircle2}
                  color="text-purple-500"
                >
                  <div className="space-y-3">
                    <p className="text-xs text-[var(--text-secondary)] mb-1">
                      {t("reports.reviewTasks")}
                    </p>

                    {loadingTasks ? (
                      <p className="text-xs text-slate-500 italic">
                        {t("common.loading")}
                      </p>
                    ) : tasks.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">
                        {t("reports.noTasksFound")}
                      </p>
                    ) : (
                      <>
                        <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                          {tasks.map((task) => {
                            const isCompleted =
                              reconciledTasks[task.id] === true;
                            const isCarriedOver =
                              reconciledTasks[task.id] === false;

                            return (
                              <div
                                key={task.id}
                                className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-all ${
                                  isCompleted
                                    ? "border-emerald-500/30 bg-emerald-500/5"
                                    : isCarriedOver
                                      ? "border-indigo-500/30 bg-indigo-500/5"
                                      : "border-[var(--border-primary)] bg-secondary"
                                }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                                    {task.title}
                                  </p>
                                  <span
                                    className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                      task.status === "pending"
                                        ? "bg-slate-500/20 text-slate-400"
                                        : task.status === "in_progress"
                                          ? "bg-blue-500/20 text-blue-400"
                                          : task.status === "blocked"
                                            ? "bg-rose-500/20 text-rose-400"
                                            : task.status === "carried_over"
                                              ? "bg-indigo-500/20 text-indigo-400"
                                              : "bg-slate-500/20 text-slate-400"
                                    }`}
                                  >
                                    {task.status.replace("_", " ")}
                                  </span>
                                </div>
                                <div className="flex gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setReconciledTasks((prev) => ({
                                        ...prev,
                                        [task.id]: true,
                                      }))
                                    }
                                    className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                                      isCompleted
                                        ? "bg-emerald-500 text-white shadow-sm"
                                        : "bg-primary text-[var(--text-secondary)] border border-[var(--border-primary)] hover:border-emerald-500/50"
                                    }`}
                                  >
                                    {t("reports.completed")}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setReconciledTasks((prev) => ({
                                        ...prev,
                                        [task.id]: false,
                                      }))
                                    }
                                    className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                                      isCarriedOver
                                        ? "bg-indigo-500 text-white shadow-sm"
                                        : "bg-primary text-[var(--text-secondary)] border border-[var(--border-primary)] hover:border-indigo-500/50"
                                    }`}
                                  >
                                    {t("reports.carryOver")}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <p className="text-xs text-[var(--text-secondary)] pt-1">
                          {
                            Object.values(reconciledTasks).filter(Boolean)
                              .length
                          }{" "}
                          of {tasks.length} tasks completed
                        </p>
                      </>
                    )}
                  </div>
                </Section>

                <Section
                  title="Completed Work"
                  icon={CheckCircle2}
                  color="text-emerald-500"
                >
                  <textarea
                    value={form.completed_work}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, completed_work: e.target.value }))
                    }
                    rows={4}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-5 py-4 text-sm outline-none font-bold text-[var(--text-primary)] focus:border-emerald-500 transition-all resize-none"
                    placeholder="What did you complete this week?"
                  />
                </Section>

                <Section
                  title="Unfinished Tasks"
                  icon={Clock}
                  color="text-amber-500"
                >
                  <textarea
                    value={form.unfinished_tasks}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        unfinished_tasks: e.target.value,
                      }))
                    }
                    rows={3}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-5 py-4 text-sm outline-none font-bold text-[var(--text-primary)] focus:border-amber-500 transition-all resize-none"
                    placeholder="What didn't get finished?"
                  />
                </Section>

                <Section
                  title="Challenges"
                  icon={AlertTriangle}
                  color="text-rose-500"
                >
                  <textarea
                    value={form.challenges}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, challenges: e.target.value }))
                    }
                    rows={3}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-5 py-4 text-sm outline-none font-bold text-[var(--text-primary)] focus:border-rose-500 transition-all resize-none"
                    placeholder="What challenges did you face?"
                  />
                </Section>

                <Section
                  title="Wins"
                  icon={Trophy}
                  color="text-[var(--brand-orange)]"
                >
                  <textarea
                    value={form.wins}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, wins: e.target.value }))
                    }
                    rows={3}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-5 py-4 text-sm outline-none font-bold text-[var(--text-primary)] focus:border-[var(--brand-orange)] transition-all resize-none"
                    placeholder="Any wins or highlights this week?"
                  />
                </Section>

                <Section
                  title="Carryover Items"
                  icon={ChevronRight}
                  color="text-indigo-500"
                >
                  <textarea
                    value={form.carryover_items}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        carryover_items: e.target.value,
                      }))
                    }
                    rows={3}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-5 py-4 text-sm outline-none font-bold text-[var(--text-primary)] focus:border-indigo-500 transition-all resize-none"
                    placeholder="What carries over to next week?"
                  />
                </Section>

                <Section
                  title="Retro Notes"
                  icon={FileText}
                  color="text-slate-500"
                >
                  <textarea
                    value={form.retro_notes}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, retro_notes: e.target.value }))
                    }
                    rows={2}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-5 py-4 text-sm outline-none font-bold text-[var(--text-primary)] focus:border-slate-500 transition-all resize-none"
                    placeholder="Any additional retro thoughts?"
                  />
                </Section>
              </div>
            )}

            {/* ACTION BUTTONS */}
            <div className="flex gap-3 pt-4 border-t border-[var(--border-primary)]">
              <button
                onClick={() => handleSubmit("draft")}
                disabled={saving}
                className="flex-1 btn btn-secondary gap-2 py-4"
              >
                <Save className="w-4 h-4" />
                {saving ? t("common.loading") : t("reports.saveDraft")}
              </button>
              <button
                onClick={() => handleSubmit("submitted")}
                disabled={saving}
                className="flex-1 btn btn-primary gap-2 py-4"
              >
                <Send className="w-4 h-4" />
                {saving ? t("common.loading") : t("reports.submitReport")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── STANDUP CREATION MODAL ─── */}
      {showStandupModal && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowStandupModal(false)}
        >
          <div
            className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-6 border-[var(--brand-orange)]/30"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between sticky top-0 bg-secondary pb-4 border-b border-[var(--border-primary)] z-10">
              <div>
                <h3 className="text-lg font-black text-[var(--text-primary)] uppercase tracking-tight">
                  Create Standup
                </h3>
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                  Week {weekInfo.week} — {weekInfo.year}
                </p>
              </div>
              <button
                onClick={() => setShowStandupModal(false)}
                className="p-2 hover:bg-white/5 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Section 1 — Carry Over Tasks */}
              <Section
                title="Carry Over Tasks"
                icon={ChevronRight}
                color="text-indigo-400"
              >
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
                                Due: {task.end_date || "—"}
                              </span>
                              {(task.blockers || []).filter(
                                (b) => b.status === "active",
                              ).length > 0 && (
                                <span className="text-[8px] text-rose-400 flex items-center gap-1">
                                  <Shield className="w-2.5 h-2.5" />
                                  {
                                    (task.blockers || []).filter(
                                      (b) => b.status === "active",
                                    ).length
                                  }{" "}
                                  active
                                </span>
                              )}
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
              </Section>

              {/* Section 2 — Weekly Focus */}
              <Section
                title="Weekly Focus"
                icon={Target}
                color="text-[var(--brand-orange)]"
              >
                <div className="space-y-3">
                  {taskRows.map((row, idx) => (
                    <div
                      key={row.id}
                      className="p-4 rounded-xl border border-[var(--border-primary)] bg-secondary space-y-2"
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0 space-y-2">
                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) =>
                              updateTaskRow(idx, "name", e.target.value)
                            }
                            placeholder="Task name *"
                            className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
                          />
                          <input
                            type="text"
                            value={row.description || ""}
                            onChange={(e) =>
                              updateTaskRow(idx, "description", e.target.value)
                            }
                            placeholder="Brief description (optional)"
                            className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-1.5 text-[9px] font-bold text-[var(--text-secondary)] outline-none focus:border-[var(--brand-orange)] transition-all"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={row.project_id || ""}
                              onChange={(e) =>
                                updateTaskRow(
                                  idx,
                                  "project_id",
                                  e.target.value || null,
                                )
                              }
                              className="bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-1.5 text-[9px] font-bold text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-[var(--brand-orange)]"
                            >
                              <option value="">No Project</option>
                              {assignedProjects.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                            {!row.project_id ? (
                              <select
                                value={row.category}
                                onChange={(e) =>
                                  updateTaskRow(idx, "category", e.target.value)
                                }
                                className="bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-1.5 text-[9px] font-bold text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-[var(--brand-orange)]"
                              >
                                <option value="">Category *</option>
                                <option value="Operations">Operations</option>
                                <option value="Administration">
                                  Administration
                                </option>
                                <option value="Finance">Finance</option>
                                <option value="Marketing">Marketing</option>
                                <option value="Content">Content</option>
                                <option value="Research">Research</option>
                                <option value="Technology">Technology</option>
                                <option value="Logistics">Logistics</option>
                                <option value="Other">Other</option>
                              </select>
                            ) : (
                              <div className="flex items-center text-[8px] text-slate-500 italic px-2">
                                Project selected
                              </div>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="date"
                              value={row.start_date || ""}
                              onChange={(e) =>
                                updateTaskRow(idx, "start_date", e.target.value)
                              }
                              className="bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-1.5 text-[9px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
                            />
                            <input
                              type="date"
                              value={row.due_date || ""}
                              onChange={(e) =>
                                updateTaskRow(idx, "due_date", e.target.value)
                              }
                              className="bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-1.5 text-[9px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
                            />
                          </div>
                          <div className="flex gap-2">
                            <select
                              value={row.collaborators?.[0] || ""}
                              onChange={(e) =>
                                updateTaskRow(
                                  idx,
                                  "collaborators",
                                  e.target.value ? [e.target.value] : [],
                                )
                              }
                              className="flex-1 bg-primary border border-[var(--border-primary)] rounded-lg px-2.5 py-1.5 text-[8px] font-bold text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-[var(--brand-orange)]"
                            >
                              <option value="">Collaborator</option>
                              {allStaff.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => setBlockerModal(idx)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--border-primary)] text-[8px] font-bold hover:border-rose-500/30 transition-all"
                            >
                              <Shield className="w-3 h-3 text-rose-400" />
                              {row.blockers?.length > 0
                                ? `${row.blockers.length} Blocker${row.blockers.length > 1 ? "s" : ""}`
                                : "Blockers"}
                            </button>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeTaskRow(idx)}
                          className="p-1 text-rose-500/50 hover:text-rose-500 transition-all shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addTaskRow}
                    className="w-full py-3 border-2 border-dashed border-[var(--border-primary)] rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-[var(--brand-orange)] hover:border-[var(--brand-orange)]/30 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Weekly Focus
                  </button>
                </div>
              </Section>

              {/* Additional Notes */}
              <Section
                title="Additional Notes"
                icon={FileText}
                color="text-slate-500"
              >
                <textarea
                  value={form.additional_notes}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      additional_notes: e.target.value,
                    }))
                  }
                  rows={2}
                  placeholder="Anything else to note?"
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-4 py-2.5 text-xs outline-none font-bold text-[var(--text-primary)] focus:border-slate-500 transition-all resize-none"
                />
              </Section>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-[var(--border-primary)] sticky bottom-0 bg-secondary">
              <button
                onClick={() => {
                  handleSubmit("draft");
                  setShowStandupModal(false);
                }}
                disabled={saving}
                className="flex-1 btn btn-secondary gap-2 py-4"
              >
                <Save className="w-4 h-4" />
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
                <Send className="w-4 h-4" />
                {saving ? "Saving..." : "Submit Standup"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── BLOCKER MODAL ─── */}
      {blockerModal !== null && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          onClick={() => setBlockerModal(null)}
        >
          <div
            className="card w-full max-w-md space-y-4 border-rose-500/30"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-rose-400" />
                <span className="text-xs font-black uppercase tracking-wider text-rose-400">
                  Blockers
                </span>
              </div>
              <button onClick={() => setBlockerModal(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-[10px] text-slate-500">
              Task:{" "}
              <span className="font-bold text-[var(--text-primary)]">
                {taskRows[blockerModal]?.name || "Untitled"}
              </span>
            </p>

            {/* Existing blockers */}
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {(taskRows[blockerModal]?.blockers || []).length === 0 && (
                <p className="text-[10px] text-slate-600 italic text-center py-4">
                  No blockers declared yet.
                </p>
              )}
              {(taskRows[blockerModal]?.blockers || []).map((b) => (
                <div
                  key={b.id}
                  className={`flex items-center justify-between p-2.5 rounded-lg border ${
                    b.status === "Resolved"
                      ? "border-emerald-500/20 bg-emerald-500/5"
                      : "border-rose-500/20 bg-rose-500/5"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-[var(--text-primary)] truncate">
                      {b.description}
                    </p>
                    {b.resolved_at && (
                      <p className="text-[8px] text-slate-500">
                        Resolved {new Date(b.resolved_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  {b.status === "Active" ? (
                    <button
                      onClick={() => resolveBlocker(blockerModal, b.id)}
                      className="px-2.5 py-1 text-[8px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-400 rounded-lg hover:bg-rose-500 hover:text-white transition-all shrink-0"
                    >
                      Resolve
                    </button>
                  ) : (
                    <span className="px-2.5 py-1 text-[8px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 rounded-lg">
                      Resolved
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Add new blocker */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newBlockerDesc}
                onChange={(e) => setNewBlockerDesc(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newBlockerDesc.trim()) {
                    e.preventDefault();
                    addBlockerToRow(blockerModal, newBlockerDesc.trim());
                    setNewBlockerDesc("");
                  }
                }}
                placeholder="Describe blocker..."
                className="flex-1 bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs outline-none font-bold text-[var(--text-primary)] focus:border-rose-500 transition-all"
              />
              <button
                onClick={() => {
                  if (newBlockerDesc.trim()) {
                    addBlockerToRow(blockerModal, newBlockerDesc.trim());
                    setNewBlockerDesc("");
                  }
                }}
                className="px-3 py-2 bg-rose-500 text-black rounded-lg text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

// Section wrapper component
function Section({ title, icon: Icon, color, children }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pb-1 border-b border-[var(--border-primary)]/30">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <span
          className={`text-[9px] font-black uppercase tracking-[0.2em] ${color}`}
        >
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

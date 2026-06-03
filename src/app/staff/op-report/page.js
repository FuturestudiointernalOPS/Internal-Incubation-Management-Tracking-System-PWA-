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
  ChevronDown,
  Save,
  FileText,
  Users,
  BarChart3,
  Shield,
  Plus,
  X,
  ListTodo,
  Briefcase,
  Activity,
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

function formatDate(dateStr) {
  if (!dateStr) return "—";
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
  const [expandedWeek, setExpandedWeek] = useState(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [newTaskForm, setNewTaskForm] = useState({
    name: "",
    project_id: "",
    category: "",
    due_date: "",
    collaborator: "",
    collaborator_note: "",
  });

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
  const [reconciledBlockers, setReconciledBlockers] = useState({});
  const [taskReasons, setTaskReasons] = useState({});

  // Structured task row state
  const [assignedProjects, setAssignedProjects] = useState([]);
  const [allStaff, setAllStaff] = useState([]);
  const [taskRows, setTaskRows] = useState([]);
  const [blockerModal, setBlockerModal] = useState(null); // { taskRowIndex } or null
  const [newBlockerDesc, setNewBlockerDesc] = useState("");
  const [staffSearch, setStaffSearch] = useState("");

  // Summary tab state
  const [summaryTasks, setSummaryTasks] = useState([]);
  const [summaryBlockers, setSummaryBlockers] = useState([]);
  const [summaryProjects, setSummaryProjects] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryCollapsed, setSummaryCollapsed] = useState({});
  const [summaryProjectExpanded, setSummaryProjectExpanded] = useState({});

  const toggleSummaryCollapsed = (key) => {
    setSummaryCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const fetchSummaryData = useCallback(async () => {
    if (!user?.cid) return;
    setSummaryLoading(true);
    try {
      const [tRes, bRes, pRes] = await Promise.all([
        fetch(
          `/api/tasks?user_id=${user.cid}&week=${weekInfo.week}&year=${weekInfo.year}&sort=oldest`,
        ),
        fetch(`/api/blockers?user_id=${user.cid}`),
        fetch(`/api/projects/assignments?user_cid=${user.cid}`),
      ]);
      const tData = await tRes.json();
      const bData = await bRes.json();
      const pData = await pRes.json();
      if (tData.success) setSummaryTasks(tData.tasks || []);
      if (bData.success) setSummaryBlockers(bData.blockers || []);
      if (pData.success) setSummaryProjects(pData.projects || []);
    } catch (e) {
      console.error("Summary fetch error:", e);
    } finally {
      setSummaryLoading(false);
    }
  }, [user?.cid, weekInfo.week, weekInfo.year]);

  useEffect(() => {
    if (reportType === "summary" && user?.cid) {
      fetchSummaryData();
    }
  }, [reportType, fetchSummaryData]);

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
            wins: (() => {
              try {
                const p = JSON.parse(report.wins);
                return Array.isArray(p) ? p : [];
              } catch {
                return [];
              }
            })(),
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
            wins: [],
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
      // First: create all task rows as real tasks
      const userId = user.cid || user.id;
      const weekData = getCurrentWeek();

      const createdTaskIds = [];
      for (const row of taskRows) {
        if (!row.name.trim()) continue;
        const taskRes = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: row.name.trim(),
            description: row.description || null,
            project_id: row.project_id || null,
            category: row.category || null,
            user_id: userId,
            user_name: user.name || "",
            status: "pending",
            created_week: weekData.week,
            created_year: weekData.year,
            start_date: row.start_date || null,
            end_date: row.due_date || null,
            carried_over_from_task_id: null,
          }),
        });
        const taskData = await taskRes.json();
        if (taskData.success) {
          createdTaskIds.push(taskData.id);
        }
      }

      // Then: submit the report
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
        setTaskRows([]);
        setShowTaskForm(false);
        fetchReport();
        fetchHistory();
        fetchTasks();
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
    if (!newTaskForm.name.trim()) return;
    setTaskRows((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: newTaskForm.name.trim(),
        description: "",
        project_id: newTaskForm.project_id || null,
        category: newTaskForm.category || "",
        start_date: "",
        due_date: newTaskForm.due_date || "",
        blockers: [],
        collaborators: newTaskForm.collaborator
          ? [
              {
                id: newTaskForm.collaborator,
                note: newTaskForm.collaborator_note,
              },
            ]
          : [],
        status: null,
        uncompleted_reason: "",
      },
    ]);
    setNewTaskForm({
      name: "",
      project_id: "",
      category: "",
      due_date: "",
      collaborator: "",
      collaborator_note: "",
    });
    setShowTaskForm(false);
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
          ...(updated[rowIndex]?.blockers || []),
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
        blockers: (updated[rowIndex]?.blockers || []).map((b) =>
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
        blockers: (updated[rowIndex]?.blockers || []).filter(
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
        blockers: (updated[rowIndex]?.blockers || []).map((b) =>
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
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-[var(--text-primary)]">
                      Monday Stand-Up
                    </h2>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Track and manage your weekly plans
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowStandupModal(true);
                      setWeekInfo(getCurrentWeek());
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[var(--brand-orange)] text-black rounded-lg text-[10px] font-semibold hover:brightness-110 transition-all"
                  >
                    <Plus className="w-4 h-4" /> Create New Stand-Up
                  </button>
                </div>

                {/* Standups Table */}
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
                          return (
                            <>
                              <tr
                                key={report.id}
                                className="border-b border-[var(--border-primary)]/50 hover:bg-tertiary/50 transition-colors"
                              >
                                <td className="px-4 py-3">
                                  <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                                    Week {report.week_number}
                                  </span>
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
                                    className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${
                                      report.status === "submitted"
                                        ? "bg-emerald-500/10 text-emerald-400"
                                        : "bg-amber-500/10 text-amber-400"
                                    }`}
                                  >
                                    {report.status === "submitted"
                                      ? "Submitted"
                                      : "Draft"}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    onClick={() => {
                                      const key = `${report.week_number}-${report.year}`;
                                      setExpandedWeek(
                                        expandedWeek === key ? null : key,
                                      );
                                    }}
                                    className="text-[11px] font-medium text-[var(--brand-orange)] hover:underline flex items-center gap-1 ml-auto"
                                  >
                                    {expandedWeek ===
                                    `${report.week_number}-${report.year}`
                                      ? "Collapse"
                                      : "View"}
                                    <ChevronDown
                                      className={`w-3 h-3 transition-transform ${
                                        expandedWeek ===
                                        `${report.week_number}-${report.year}`
                                          ? "rotate-180"
                                          : ""
                                      }`}
                                    />
                                  </button>
                                </td>
                              </tr>
                              {expandedWeek ===
                                `${report.week_number}-${report.year}` && (
                                <tr key={`tasks-${report.id}`}>
                                  <td colSpan={4} className="px-0 py-0">
                                    <div className="bg-tertiary/50 border-t border-[var(--border-primary)]">
                                      <div className="p-4">
                                        {tasks.filter(
                                          (t) =>
                                            t.created_week ===
                                              report.week_number &&
                                            t.created_year === report.year,
                                        ).length === 0 ? (
                                          <p className="text-[11px] text-slate-500 text-center py-4">
                                            No tasks for this week
                                          </p>
                                        ) : (
                                          <div className="overflow-hidden rounded-lg border border-[var(--border-primary)]">
                                            <table className="w-full">
                                              <thead>
                                                <tr className="bg-primary border-b border-[var(--border-primary)]">
                                                  <th className="text-left px-3 py-2 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                                                    Task
                                                  </th>
                                                  <th className="text-left px-3 py-2 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                                                    Project
                                                  </th>
                                                  <th className="text-left px-3 py-2 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                                                    Due
                                                  </th>
                                                  <th className="text-left px-3 py-2 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                                                    Blockers
                                                  </th>
                                                  <th className="text-left px-3 py-2 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                                                    Status
                                                  </th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {tasks
                                                  .filter(
                                                    (t) =>
                                                      t.created_week ===
                                                        report.week_number &&
                                                      t.created_year ===
                                                        report.year,
                                                  )
                                                  .map((task) => {
                                                    const config =
                                                      STATUS_CONFIG[
                                                        task.status
                                                      ] ||
                                                      STATUS_CONFIG.pending;
                                                    const activeBlockers = (
                                                      task.blockers || []
                                                    ).filter(
                                                      (b) =>
                                                        b.status === "active",
                                                    );
                                                    return (
                                                      <tr
                                                        key={task.id}
                                                        className="border-b border-[var(--border-primary)]/40 hover:bg-primary/50 transition-colors"
                                                      >
                                                        <td className="px-3 py-2.5">
                                                          <div className="flex items-center gap-2">
                                                            <div
                                                              className={`w-1.5 h-1.5 rounded-full ${config.color.replace("text-", "bg-")} shrink-0`}
                                                            />
                                                            <span className="text-[12px] font-medium text-[var(--text-primary)]">
                                                              {task.title}
                                                            </span>
                                                          </div>
                                                        </td>
                                                        <td className="px-3 py-2.5 text-[11px] text-slate-500">
                                                          {task.project_id
                                                            ? assignedProjects.find(
                                                                (p) =>
                                                                  String(
                                                                    p.id,
                                                                  ) ===
                                                                  String(
                                                                    task.project_id,
                                                                  ),
                                                              )?.name ||
                                                              "Project"
                                                            : task.category ||
                                                              "—"}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-[11px] text-slate-500">
                                                          {formatDate(
                                                            task.end_date,
                                                          )}
                                                        </td>
                                                        <td className="px-3 py-2.5">
                                                          {activeBlockers.length >
                                                          0 ? (
                                                            <span className="flex items-center gap-1 text-[10px] text-rose-400">
                                                              <Shield className="w-3 h-3" />
                                                              {
                                                                activeBlockers.length
                                                              }
                                                            </span>
                                                          ) : (
                                                            <span className="text-[10px] text-slate-600">
                                                              —
                                                            </span>
                                                          )}
                                                        </td>
                                                        <td className="px-3 py-2.5">
                                                          <span
                                                            className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}
                                                          >
                                                            {config.label}
                                                          </span>
                                                        </td>
                                                      </tr>
                                                    );
                                                  })}
                                              </tbody>
                                            </table>
                                          </div>
                                        )}
                                        <div className="mt-3">
                                          <button
                                            onClick={() => {
                                              setWeekInfo({
                                                week: report.week_number,
                                                year: report.year,
                                              });
                                              setShowStandupModal(true);
                                              setTimeout(
                                                () => setShowTaskForm(true),
                                                100,
                                              );
                                            }}
                                            className="w-full py-2 border border-dashed border-[var(--border-primary)] rounded-lg text-[10px] font-medium text-slate-500 hover:text-[var(--brand-orange)] hover:border-[var(--brand-orange)]/30 transition-all flex items-center justify-center gap-1.5"
                                          >
                                            <Plus className="w-3.5 h-3.5" /> Add
                                            Task
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </>
                          );
                        })}
                      {history.filter((r) => r.report_type === "standup")
                        .length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center">
                            <Target className="w-8 h-8 mx-auto mb-3 text-slate-500 opacity-30" />
                            <p className="text-[12px] font-medium text-slate-500 mb-1">
                              No stand-up reports yet
                            </p>
                            <p className="text-[10px] text-slate-600 mb-4">
                              {tasks.length > 0
                                ? `You have ${tasks.length} task${tasks.length > 1 ? "s" : ""} — create a stand-up to track them weekly`
                                : "Create your first stand-up to plan your week"}
                            </p>
                            <button
                              onClick={() => {
                                setShowStandupModal(true);
                                setWeekInfo(getCurrentWeek());
                              }}
                              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--brand-orange)] text-black rounded-lg text-[10px] font-semibold hover:brightness-110 transition-all"
                            >
                              <Plus className="w-4 h-4" /> Create Stand-Up
                            </button>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : reportType === "retro" ? (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">
                    Friday Retro
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Review completed work by week
                  </p>
                </div>
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
                          Completed
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
                        .filter(
                          (r) =>
                            r.report_type === "standup" ||
                            r.report_type === "retro",
                        )
                        .reduce((unique, r) => {
                          const key = r.week_number + "-" + r.year;
                          if (
                            !unique.find(
                              (x) =>
                                x.week_number === r.week_number &&
                                x.year === r.year,
                            )
                          )
                            unique.push(r);
                          return unique;
                        }, [])
                        .map((report) => {
                          const weekKey =
                            report.week_number + "-" + report.year;
                          const weekTasks = tasks.filter(
                            (t) =>
                              t.created_week === report.week_number &&
                              t.created_year === report.year,
                          );
                          const completed = weekTasks.filter(
                            (t) => t.status === "completed",
                          ).length;
                          const isExpanded = expandedWeek === weekKey;
                          return (
                            <>
                              <tr
                                key={weekKey}
                                className="border-b border-[var(--border-primary)]/50 hover:bg-tertiary/50 transition-colors"
                              >
                                <td className="px-4 py-3">
                                  <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                                    Week {report.week_number}
                                  </span>
                                  <span className="text-[10px] text-slate-500 ml-2">
                                    {report.year}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-[12px] font-medium text-slate-500">
                                  {weekTasks.length} tasks
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-[12px] font-medium text-emerald-400">
                                    {completed}/{weekTasks.length}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${completed === weekTasks.length && weekTasks.length > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}
                                  >
                                    {completed === weekTasks.length &&
                                    weekTasks.length > 0
                                      ? "Complete"
                                      : "Review"}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    onClick={() =>
                                      setExpandedWeek(
                                        isExpanded ? null : weekKey,
                                      )
                                    }
                                    className="text-[11px] font-medium text-[var(--brand-orange)] hover:underline flex items-center gap-1 ml-auto"
                                  >
                                    {isExpanded ? "Collapse" : "View"}
                                    <ChevronDown
                                      className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                    />
                                  </button>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr key={"t-" + weekKey}>
                                  <td colSpan={5} className="px-0 py-0">
                                    <div className="bg-tertiary/50 border-t border-[var(--border-primary)] p-4">
                                      {weekTasks.length === 0 ? (
                                        <p className="text-[11px] text-slate-500 text-center py-4">
                                          No tasks for this week
                                        </p>
                                      ) : (
                                        <div className="overflow-hidden rounded-lg border border-[var(--border-primary)]">
                                          <table className="w-full">
                                            <thead>
                                              <tr className="bg-primary border-b border-[var(--border-primary)]">
                                                <th className="w-10 px-3 py-2 text-center text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                                                  Done
                                                </th>
                                                <th className="text-left px-3 py-2 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                                                  Task
                                                </th>
                                                <th className="text-left px-3 py-2 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                                                  Project
                                                </th>
                                                <th className="text-left px-3 py-2 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                                                  Due
                                                </th>
                                                <th className="text-left px-3 py-2 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                                                  Blockers
                                                </th>
                                                <th className="text-left px-3 py-2 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                                                  Status
                                                </th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {weekTasks.map((task) => {
                                                const cfg =
                                                  STATUS_CONFIG[task.status] ||
                                                  STATUS_CONFIG.pending;
                                                const ab = (
                                                  task.blockers || []
                                                ).filter(
                                                  (b) => b.status === "active",
                                                );
                                                return (
                                                  <tr
                                                    key={task.id}
                                                    className="border-b border-[var(--border-primary)]/40 hover:bg-primary/50 transition-colors"
                                                  >
                                                    <td className="px-3 py-2.5 text-center">
                                                      <div
                                                        className={`w-4 h-4 rounded-full border-2 mx-auto ${task.status === "completed" ? "bg-emerald-500 border-emerald-500" : "border-slate-600"}`}
                                                      >
                                                        {task.status ===
                                                          "completed" && (
                                                          <CheckCircle2 className="w-3 h-3 text-white" />
                                                        )}
                                                      </div>
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                      <span
                                                        className={`text-[11px] font-medium ${task.status === "completed" ? "line-through text-slate-500" : "text-[var(--text-primary)]"}`}
                                                      >
                                                        {task.title}
                                                      </span>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-[10px] text-slate-500">
                                                      {task.project_id
                                                        ? assignedProjects.find(
                                                            (p) =>
                                                              String(p.id) ===
                                                              String(
                                                                task.project_id,
                                                              ),
                                                          )?.name || "Project"
                                                        : task.category || "—"}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-[10px] text-slate-500">
                                                      {formatDate(
                                                        task.end_date,
                                                      )}
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                      <div className="flex items-center gap-1.5">
                                                        {ab.length > 0 ? (
                                                          <span className="text-[9px] text-rose-400 font-medium">
                                                            {ab.length} active
                                                          </span>
                                                        ) : (
                                                          <span className="text-[9px] text-slate-600">
                                                            0
                                                          </span>
                                                        )}
                                                        <button
                                                          onClick={() =>
                                                            setBlockerModal({
                                                              type: "api",
                                                              taskId: task.id,
                                                            })
                                                          }
                                                          className="text-[9px] text-[var(--brand-orange)] hover:underline ml-1"
                                                        >
                                                          Manage
                                                        </button>
                                                      </div>
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                      <span
                                                        className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}
                                                      >
                                                        {cfg.label}
                                                      </span>
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </>
                          );
                        })}
                      {history.filter(
                        (r) =>
                          r.report_type === "standup" ||
                          r.report_type === "retro",
                      ).length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center">
                            <CheckCircle2 className="w-8 h-8 mx-auto mb-3 text-slate-500 opacity-30" />
                            <p className="text-[12px] font-medium text-slate-500">
                              No weekly reports yet
                            </p>
                            <p className="text-[10px] text-slate-600 mt-1">
                              Complete a stand-up to see retro here
                            </p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                {summaryLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="w-5 h-5 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" />
                    <span className="ml-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Loading summary...
                    </span>
                  </div>
                ) : (
                  <>
                    {/* ═══════════════════════════════════ */}
                    {/* PHASE 1 — WEEKLY OVERVIEW CARD     */}
                    {/* ═══════════════════════════════════ */}
                    {(() => {
                      const planned = summaryTasks.length;
                      const completed = summaryTasks.filter(
                        (t) => t.status === "completed",
                      ).length;
                      const carriedOver = summaryTasks.filter(
                        (t) => t.status === "carried_over",
                      ).length;
                      const blockersCreated = summaryBlockers.length;
                      const blockersResolved = summaryBlockers.filter(
                        (b) => b.status === "resolved",
                      ).length;
                      const activeBlockers = summaryBlockers.filter(
                        (b) => b.status === "active",
                      ).length;
                      const projectsCount = new Set(
                        summaryTasks
                          .filter((t) => t.project_id)
                          .map((t) => t.project_id),
                      ).size;

                      // Calculate date range
                      const monday = new Date();
                      monday.setDate(
                        monday.getDate() +
                          ((7 - monday.getDay() + 1) % 7 || 7) * -1 +
                          7 * (weekInfo.week - getWeekNumber(new Date())),
                      );
                      const friday = new Date(monday);
                      friday.setDate(monday.getDate() + 4);
                      const dateRange = `${monday.toLocaleDateString("en", { month: "short", day: "numeric" })} - ${friday.toLocaleDateString("en", { month: "short", day: "numeric" })}`;

                      return (
                        <div className="card p-5 space-y-4 border-[var(--brand-orange)]/20">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-lg font-black text-[var(--text-primary)]">
                                Week {weekInfo.week}
                              </p>
                              <p className="text-[10px] text-slate-500">
                                {dateRange}
                              </p>
                            </div>
                            <BarChart3 className="w-6 h-6 text-[var(--brand-orange)] opacity-40" />
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div>
                              <p className="text-2xl font-black text-[var(--text-primary)]">
                                {planned}
                              </p>
                              <p className="text-[8px] text-slate-500 uppercase tracking-wider">
                                Tasks Planned
                              </p>
                            </div>
                            <div>
                              <p className="text-2xl font-black text-emerald-400">
                                {completed}
                              </p>
                              <p className="text-[8px] text-slate-500 uppercase tracking-wider">
                                Completed
                              </p>
                            </div>
                            <div>
                              <p className="text-2xl font-black text-indigo-400">
                                {carriedOver}
                              </p>
                              <p className="text-[8px] text-slate-500 uppercase tracking-wider">
                                Carried Over
                              </p>
                            </div>
                            <div>
                              <p className="text-2xl font-black text-rose-400">
                                {activeBlockers}
                              </p>
                              <p className="text-[8px] text-slate-500 uppercase tracking-wider">
                                Active Blockers
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-4 pt-2 border-t border-[var(--border-primary)]/30">
                            <span className="text-[9px] text-slate-500">
                              Blockers Created:{" "}
                              <span className="font-bold text-[var(--text-primary)]">
                                {blockersCreated}
                              </span>
                            </span>
                            <span className="text-[9px] text-slate-500">
                              Blockers Resolved:{" "}
                              <span className="font-bold text-emerald-400">
                                {blockersResolved}
                              </span>
                            </span>
                            <span className="text-[9px] text-slate-500">
                              Projects Contributed To:{" "}
                              <span className="font-bold text-[var(--text-primary)]">
                                {projectsCount}
                              </span>
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* ═══════════════════════════════════ */}
                    {/* PHASE 2 — TASKS WORKED ON THIS WEEK */}
                    {/* ═══════════════════════════════════ */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2">
                        <ListTodo className="w-4 h-4 text-[var(--brand-orange)]" />
                        Tasks Worked On This Week
                      </h3>
                      {summaryTasks.length === 0 ? (
                        <p className="text-[10px] text-slate-600 italic text-center py-8">
                          No tasks for this week.
                        </p>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)]">
                          <table className="w-full">
                            <thead>
                              <tr className="bg-tertiary border-b border-[var(--border-primary)]">
                                <th className="text-left px-3 py-2 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                                  Task Name
                                </th>
                                <th className="text-left px-3 py-2 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                                  Project
                                </th>
                                <th className="text-left px-3 py-2 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                                  Category
                                </th>
                                <th className="text-left px-3 py-2 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                                  Created
                                </th>
                                <th className="text-left px-3 py-2 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                                  Due
                                </th>
                                <th className="text-left px-3 py-2 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                                  Status
                                </th>
                                <th className="text-left px-3 py-2 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                                  Collaborators
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {summaryTasks.map((task) => {
                                const cfg =
                                  STATUS_CONFIG[task.status] ||
                                  STATUS_CONFIG.pending;
                                const projectName = summaryProjects.find(
                                  (p) =>
                                    String(p.id) === String(task.project_id),
                                )?.name;
                                return (
                                  <React.Fragment key={task.id}>
                                    <tr className="border-b border-[var(--border-primary)]/40 hover:bg-tertiary/30 transition-colors">
                                      <td className="px-3 py-2.5 text-[11px] font-bold text-[var(--text-primary)]">
                                        {task.title}
                                      </td>
                                      <td className="px-3 py-2.5 text-[10px] text-slate-500">
                                        {projectName || "—"}
                                      </td>
                                      <td className="px-3 py-2.5 text-[10px] text-slate-500">
                                        {task.category || "—"}
                                      </td>
                                      <td className="px-3 py-2.5 text-[10px] text-slate-500">
                                        {formatDate(task.created_at)}
                                      </td>
                                      <td className="px-3 py-2.5 text-[10px] text-slate-500">
                                        {formatDate(task.end_date)}
                                      </td>
                                      <td className="px-3 py-2.5">
                                        <span
                                          className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}
                                        >
                                          {cfg.label}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2.5 text-[10px] text-slate-500">
                                        —
                                      </td>
                                    </tr>
                                    {/* Subtasks */}
                                    {task.subtasks?.length > 0 && (
                                      <tr className="bg-tertiary/30">
                                        <td colSpan={7} className="px-6 py-2">
                                          <div className="space-y-1">
                                            {task.subtasks.map((sub) => {
                                              const subCfg =
                                                STATUS_CONFIG[sub.status] ||
                                                STATUS_CONFIG.pending;
                                              return (
                                                <div
                                                  key={sub.id}
                                                  className="flex items-center gap-2 text-[10px]"
                                                >
                                                  <span className="text-slate-500">
                                                    ↳
                                                  </span>
                                                  <span className="font-medium text-[var(--text-primary)]">
                                                    {sub.title}
                                                  </span>
                                                  <span
                                                    className={`text-[8px] px-1.5 py-0.5 rounded-full ${subCfg.bg} ${subCfg.color}`}
                                                  >
                                                    {subCfg.label}
                                                  </span>
                                                </div>
                                              );
                                            })}
                                          </div>
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
                    </div>

                    {/* ═══════════════════════════════════ */}
                    {/* PHASE 3 — PROJECT CONTRIBUTIONS     */}
                    {/* ═══════════════════════════════════ */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-[var(--brand-orange)]" />
                        Project Contributions
                      </h3>
                      {(() => {
                        const grouped = {};
                        summaryTasks.forEach((task) => {
                          const key = task.project_id
                            ? `project_${task.project_id}`
                            : `category_${task.category || "Operations"}`;
                          if (!grouped[key]) grouped[key] = [];
                          grouped[key].push(task);
                        });
                        const entries = Object.entries(grouped);
                        if (entries.length === 0)
                          return (
                            <p className="text-[10px] text-slate-600 italic text-center py-8">
                              No project data for this week.
                            </p>
                          );
                        return entries.map(([key, projectTasks]) => {
                          const isProject = key.startsWith("project_");
                          const projectId = isProject
                            ? key.replace("project_", "")
                            : null;
                          const projectName = isProject
                            ? summaryProjects.find(
                                (p) => String(p.id) === String(projectId),
                              )?.name || "Project"
                            : key.replace("category_", "");
                          const completedCount = projectTasks.filter(
                            (t) => t.status === "completed",
                          ).length;
                          const carriedCount = projectTasks.filter(
                            (t) => t.status === "carried_over",
                          ).length;
                          const activeBlockersCount = projectTasks.reduce(
                            (sum, t) =>
                              sum +
                              (t.blockers || []).filter(
                                (b) => b.status === "active",
                              ).length,
                            0,
                          );
                          const expanded = summaryProjectExpanded[key];
                          return (
                            <div key={key} className="card p-4 space-y-3">
                              <div
                                className="flex items-center justify-between cursor-pointer"
                                onClick={() =>
                                  setSummaryProjectExpanded((prev) => ({
                                    ...prev,
                                    [key]: !prev[key],
                                  }))
                                }
                              >
                                <div>
                                  <p className="text-xs font-bold text-[var(--text-primary)]">
                                    {projectName}
                                  </p>
                                  <p className="text-[9px] text-slate-500">
                                    Tasks Worked On: {projectTasks.length} |
                                    Completed: {completedCount} | Carry Over:{" "}
                                    {carriedCount} | Blockers:{" "}
                                    {activeBlockersCount}
                                  </p>
                                </div>
                                <ChevronDown
                                  className={`w-4 h-4 text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`}
                                />
                              </div>
                              {expanded && (
                                <div className="space-y-1.5 pt-2 border-t border-[var(--border-primary)]/30">
                                  {projectTasks.map((t) => {
                                    const tCfg =
                                      STATUS_CONFIG[t.status] ||
                                      STATUS_CONFIG.pending;
                                    return (
                                      <div
                                        key={t.id}
                                        className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-tertiary/50"
                                      >
                                        <span className="text-[10px] font-medium text-[var(--text-primary)]">
                                          {t.title}
                                        </span>
                                        <span
                                          className={`text-[8px] px-1.5 py-0.5 rounded-full ${tCfg.bg} ${tCfg.color}`}
                                        >
                                          {tCfg.label}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>

                    {/* ═══════════════════════════════════ */}
                    {/* PHASE 4 — ASSIGNMENT HISTORY       */}
                    {/* ═══════════════════════════════════ */}
                    {(() => {
                      const assignedTasks = summaryTasks.filter(
                        (t) =>
                          t.user_id &&
                          user?.cid &&
                          String(t.user_id) !== String(user.cid),
                      );
                      if (assignedTasks.length === 0) return null;
                      return (
                        <div className="space-y-3">
                          <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2">
                            <Users className="w-4 h-4 text-[var(--brand-orange)]" />
                            Task Assignments Received
                          </h3>
                          <div className="space-y-2">
                            {assignedTasks.map((task) => {
                              const cfg =
                                STATUS_CONFIG[task.status] ||
                                STATUS_CONFIG.pending;
                              return (
                                <div
                                  key={task.id}
                                  className="card p-3 flex items-center justify-between"
                                >
                                  <div>
                                    <p className="text-[11px] font-bold text-[var(--text-primary)]">
                                      {task.title}
                                    </p>
                                    <p className="text-[9px] text-slate-500 mt-0.5">
                                      Assigned by {task.user_name || "Unknown"}{" "}
                                      on {formatDate(task.created_at)}
                                    </p>
                                  </div>
                                  <span
                                    className={`text-[8px] font-bold px-2 py-1 rounded-full ${cfg.bg} ${cfg.color}`}
                                  >
                                    {cfg.label}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* ═══════════════════════════════════ */}
                    {/* PHASE 5 — BLOCKERS SUMMARY         */}
                    {/* ═══════════════════════════════════ */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2">
                        <Shield className="w-4 h-4 text-rose-400" />
                        Blockers Summary
                      </h3>
                      {summaryBlockers.length === 0 ? (
                        <p className="text-[10px] text-slate-600 italic text-center py-8">
                          No blockers reported this week.
                        </p>
                      ) : (
                        <>
                          {/* Resolved Blockers */}
                          {summaryBlockers.filter(
                            (b) => b.status === "resolved",
                          ).length > 0 && (
                            <div className="space-y-2">
                              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                                Resolved Blockers
                              </p>
                              <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)]">
                                <table className="w-full">
                                  <thead>
                                    <tr className="bg-tertiary">
                                      <th className="text-left px-3 py-2 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                                        Blocker
                                      </th>
                                      <th className="text-left px-3 py-2 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                                        Task
                                      </th>
                                      <th className="text-left px-3 py-2 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                                        Created
                                      </th>
                                      <th className="text-left px-3 py-2 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                                        Resolved
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {summaryBlockers
                                      .filter((b) => b.status === "resolved")
                                      .map((b) => (
                                        <tr
                                          key={b.id}
                                          className="border-b border-[var(--border-primary)]/40"
                                        >
                                          <td className="px-3 py-2 text-[10px] font-bold text-emerald-400">
                                            {b.title}
                                          </td>
                                          <td className="px-3 py-2 text-[10px] text-slate-500">
                                            {summaryTasks.find(
                                              (t) => t.id === b.task_id,
                                            )?.title || "Task #" + b.task_id}
                                          </td>
                                          <td className="px-3 py-2 text-[10px] text-slate-500">
                                            {formatDate(b.created_at)}
                                          </td>
                                          <td className="px-3 py-2 text-[10px] text-slate-500">
                                            {formatDate(b.resolved_at)}
                                          </td>
                                        </tr>
                                      ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                          {/* Active Blockers */}
                          {summaryBlockers.filter((b) => b.status === "active")
                            .length > 0 && (
                            <div className="space-y-2">
                              <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">
                                Active Blockers
                              </p>
                              <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)]">
                                <table className="w-full">
                                  <thead>
                                    <tr className="bg-tertiary">
                                      <th className="text-left px-3 py-2 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                                        Blocker
                                      </th>
                                      <th className="text-left px-3 py-2 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                                        Task
                                      </th>
                                      <th className="text-left px-3 py-2 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                                        Created
                                      </th>
                                      <th className="text-left px-3 py-2 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                                        Weeks Open
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {summaryBlockers
                                      .filter((b) => b.status === "active")
                                      .map((b) => {
                                        const weeksOpen = Math.floor(
                                          (Date.now() -
                                            new Date(b.created_at).getTime()) /
                                            (7 * 24 * 60 * 60 * 1000),
                                        );
                                        return (
                                          <tr
                                            key={b.id}
                                            className={`border-b border-[var(--border-primary)]/40 ${weeksOpen > 2 ? "bg-rose-500/5" : ""}`}
                                          >
                                            <td className="px-3 py-2 text-[10px] font-bold text-rose-400">
                                              {b.title}
                                            </td>
                                            <td className="px-3 py-2 text-[10px] text-slate-500">
                                              {summaryTasks.find(
                                                (t) => t.id === b.task_id,
                                              )?.title || "Task #" + b.task_id}
                                            </td>
                                            <td className="px-3 py-2 text-[10px] text-slate-500">
                                              {formatDate(b.created_at)}
                                            </td>
                                            <td className="px-3 py-2">
                                              <span
                                                className={`text-[9px] font-bold ${weeksOpen >= 3 ? "text-rose-400" : weeksOpen >= 2 ? "text-amber-400" : "text-slate-500"}`}
                                              >
                                                {weeksOpen}w
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
                        </>
                      )}
                    </div>

                    {/* ═══════════════════════════════════ */}
                    {/* PHASE 6 — COLLABORATION OVERVIEW   */}
                    {/* ═══════════════════════════════════ */}
                    {(() => {
                      const collabMap = {};
                      summaryTasks.forEach((task) => {
                        if (task.user_name && task.user_name !== user?.name) {
                          if (!collabMap[task.user_name])
                            collabMap[task.user_name] = [];
                          collabMap[task.user_name].push(task);
                        }
                      });
                      const entries = Object.entries(collabMap);
                      if (entries.length === 0) return null;
                      return (
                        <div className="space-y-3">
                          <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2">
                            <Users className="w-4 h-4 text-[var(--brand-orange)]" />
                            Collaboration Overview
                          </h3>
                          {entries.map(([name, sharedTasks]) => (
                            <div key={name} className="card p-3">
                              <div
                                className="flex items-center justify-between cursor-pointer"
                                onClick={() => toggleSummaryCollapsed(name)}
                              >
                                <div className="flex items-center gap-2">
                                  <Users className="w-3.5 h-3.5 text-slate-500" />
                                  <span className="text-xs font-bold text-[var(--text-primary)]">
                                    {name}
                                  </span>
                                </div>
                                <span className="text-[9px] text-slate-500">
                                  {sharedTasks.length} shared task
                                  {sharedTasks.length !== 1 ? "s" : ""}
                                </span>
                              </div>
                              {summaryCollapsed[name] && (
                                <div className="mt-2 pt-2 border-t border-[var(--border-primary)]/30 space-y-1">
                                  {sharedTasks.map((t) => (
                                    <div
                                      key={t.id}
                                      className="flex justify-between text-[10px] py-0.5"
                                    >
                                      <span className="font-medium text-[var(--text-primary)]">
                                        {t.title}
                                      </span>
                                      <span className="text-slate-500">
                                        {summaryProjects.find(
                                          (p) =>
                                            String(p.id) ===
                                            String(t.project_id),
                                        )?.name ||
                                          t.category ||
                                          "—"}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {/* ═══════════════════════════════════ */}
                    {/* PHASE 7 — CARRY-OVER INTELLIGENCE  */}
                    {/* ═══════════════════════════════════ */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2">
                        <Clock className="w-4 h-4 text-indigo-400" />
                        Carry-Over Items
                      </h3>
                      {(() => {
                        const carryOverTasks = summaryTasks.filter(
                          (t) => t.status !== "completed",
                        );
                        if (carryOverTasks.length === 0)
                          return (
                            <p className="text-[10px] text-emerald-400 italic text-center py-8">
                              All tasks completed this week. 🎉
                            </p>
                          );
                        return (
                          <div className="space-y-2">
                            {carryOverTasks.map((task) => {
                              const weeks = task.reschedule_count || 0;
                              return (
                                <div
                                  key={task.id}
                                  className={`card p-3 ${weeks >= 5 ? "border-rose-500/30 bg-rose-500/5" : weeks >= 3 ? "border-amber-500/30 bg-amber-500/5" : ""}`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                                        {task.title}
                                      </p>
                                      <p className="text-[9px] text-slate-500 mt-0.5">
                                        Project:{" "}
                                        {summaryProjects.find(
                                          (p) =>
                                            String(p.id) ===
                                            String(task.project_id),
                                        )?.name || "—"}{" "}
                                        | Due: {formatDate(task.end_date)}
                                      </p>
                                    </div>
                                    <div className="text-right shrink-0 ml-4">
                                      <p
                                        className={`text-lg font-black ${weeks >= 5 ? "text-rose-400" : weeks >= 3 ? "text-amber-400" : "text-[var(--text-primary)]"}`}
                                      >
                                        {weeks}
                                      </p>
                                      <p className="text-[7px] text-slate-500 uppercase tracking-wider">
                                        Weeks
                                      </p>
                                    </div>
                                  </div>
                                  {weeks >= 3 && (
                                    <div
                                      className={`mt-2 text-[8px] font-black uppercase tracking-wider ${weeks >= 5 ? "text-rose-400" : "text-amber-400"}`}
                                    >
                                      {weeks >= 5
                                        ? "⚠ Critical — Requires immediate attention"
                                        : "⚠ Requires attention"}
                                    </div>
                                  )}
                                  {(task.blockers || []).filter(
                                    (b) => b.status === "active",
                                  ).length > 0 && (
                                    <div className="flex items-center gap-1 mt-2 text-rose-400 text-[9px]">
                                      <Shield className="w-3 h-3" />
                                      {
                                        (task.blockers || []).filter(
                                          (b) => b.status === "active",
                                        ).length
                                      }{" "}
                                      active blocker(s)
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>

                    {/* ═══════════════════════════════════ */}
                    {/* PHASE 8 — PROJECT OWNER SUMMARY    */}
                    {/* ═══════════════════════════════════ */}
                    {(() => {
                      const ownedProjects = summaryProjects.filter(
                        (p) => p.member_role === "lead",
                      );
                      if (ownedProjects.length === 0) return null;
                      return (
                        <div className="space-y-3">
                          <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2">
                            <Briefcase className="w-4 h-4 text-[var(--brand-orange)]" />
                            Projects I Own
                          </h3>
                          {ownedProjects.map((project) => {
                            const projectTasks = summaryTasks.filter(
                              (t) =>
                                String(t.project_id) === String(project.id),
                            );
                            const completed = projectTasks.filter(
                              (t) => t.status === "completed",
                            ).length;
                            const active = projectTasks.filter(
                              (t) =>
                                t.status === "in_progress" ||
                                t.status === "blocked",
                            ).length;
                            const carried = projectTasks.filter(
                              (t) => t.status === "carried_over",
                            ).length;
                            const blockerCount = projectTasks.reduce(
                              (sum, t) =>
                                sum +
                                (t.blockers || []).filter(
                                  (b) => b.status === "active",
                                ).length,
                              0,
                            );
                            const collaborators = new Set(
                              projectTasks
                                .map((t) => t.user_name)
                                .filter(Boolean),
                            );
                            const total = projectTasks.length;
                            const rate = total > 0 ? completed / total : 0;
                            let health = "on_track";
                            if (
                              (blockerCount > 0 ||
                                (total > 0 && carried / total > 0.3)) &&
                              rate < 0.7
                            )
                              health = "at_risk";
                            if (blockerCount >= 2 || rate < 0.3)
                              health = "blocked";
                            const healthColors = {
                              on_track: "text-emerald-400 bg-emerald-500/10",
                              at_risk: "text-amber-400 bg-amber-500/10",
                              blocked: "text-rose-400 bg-rose-500/10",
                            };
                            const healthLabels = {
                              on_track: "On Track",
                              at_risk: "At Risk",
                              blocked: "Blocked",
                            };
                            return (
                              <div key={project.id} className="card p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <p className="text-xs font-bold text-[var(--text-primary)]">
                                    {project.name}
                                  </p>
                                  <span
                                    className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${healthColors[health]}`}
                                  >
                                    {healthLabels[health]}
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[10px]">
                                  <div>
                                    <span className="font-bold text-emerald-400">
                                      {completed}
                                    </span>{" "}
                                    <span className="text-slate-500">
                                      completed
                                    </span>
                                  </div>
                                  <div>
                                    <span className="font-bold text-blue-400">
                                      {active}
                                    </span>{" "}
                                    <span className="text-slate-500">
                                      active
                                    </span>
                                  </div>
                                  <div>
                                    <span className="font-bold text-indigo-400">
                                      {carried}
                                    </span>{" "}
                                    <span className="text-slate-500">
                                      carried
                                    </span>
                                  </div>
                                  <div>
                                    <span className="font-bold text-rose-400">
                                      {blockerCount}
                                    </span>{" "}
                                    <span className="text-slate-500">
                                      blockers
                                    </span>
                                  </div>
                                </div>
                                {collaborators.size > 0 && (
                                  <p className="text-[9px] text-slate-500 mt-2">
                                    Collaborators:{" "}
                                    {Array.from(collaborators).join(", ")}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* ═══════════════════════════════════ */}
                    {/* PHASE 9 — WEEKLY ACTIVITY TIMELINE */}
                    {/* ═══════════════════════════════════ */}
                    {(() => {
                      const timeline = {};
                      summaryTasks.forEach((task) => {
                        const day = task.created_at?.split("T")[0];
                        if (!day) return;
                        if (!timeline[day])
                          timeline[day] = {
                            created: 0,
                            completed: 0,
                            blockerAdded: 0,
                            blockerResolved: 0,
                          };
                        timeline[day].created++;
                        if (task.status === "completed")
                          timeline[day].completed++;
                      });
                      summaryBlockers.forEach((b) => {
                        const day = b.created_at?.split("T")[0];
                        if (!day) return;
                        if (!timeline[day])
                          timeline[day] = {
                            created: 0,
                            completed: 0,
                            blockerAdded: 0,
                            blockerResolved: 0,
                          };
                        timeline[day].blockerAdded =
                          (timeline[day].blockerAdded || 0) + 1;
                        if (b.status === "resolved" && b.resolved_at) {
                          const rd = b.resolved_at?.split("T")[0];
                          if (rd) {
                            if (!timeline[rd])
                              timeline[rd] = {
                                created: 0,
                                completed: 0,
                                blockerAdded: 0,
                                blockerResolved: 0,
                              };
                            timeline[rd].blockerResolved =
                              (timeline[rd].blockerResolved || 0) + 1;
                          }
                        }
                      });
                      const sortedDays = Object.keys(timeline).sort();
                      if (sortedDays.length === 0) return null;
                      return (
                        <div className="space-y-3">
                          <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2">
                            <Activity className="w-4 h-4 text-[var(--brand-orange)]" />
                            Weekly Activity Timeline
                          </h3>
                          <div className="space-y-3">
                            {sortedDays.map((day) => {
                              const d = timeline[day];
                              const events = [];
                              if (d.created > 0)
                                events.push(
                                  `Created ${d.created} task${d.created !== 1 ? "s" : ""}`,
                                );
                              if (d.completed > 0)
                                events.push(
                                  `Completed ${d.completed} task${d.completed !== 1 ? "s" : ""}`,
                                );
                              if (d.blockerAdded > 0)
                                events.push(
                                  `Added ${d.blockerAdded} blocker${d.blockerAdded !== 1 ? "s" : ""}`,
                                );
                              if (d.blockerResolved > 0)
                                events.push(
                                  `Resolved ${d.blockerResolved} blocker${d.blockerResolved !== 1 ? "s" : ""}`,
                                );
                              const dayLabel = new Date(
                                day + "T00:00:00",
                              ).toLocaleDateString("en", {
                                weekday: "long",
                                month: "long",
                                day: "numeric",
                              });
                              return (
                                <div key={day} className="flex gap-3">
                                  <div className="w-2 h-2 rounded-full bg-[var(--brand-orange)] mt-1.5 shrink-0" />
                                  <div>
                                    <p className="text-[10px] text-slate-500">
                                      {dayLabel}
                                    </p>
                                    {events.map((ev, i) => (
                                      <p
                                        key={i}
                                        className="text-xs font-bold text-[var(--text-primary)]"
                                      >
                                        {ev}
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {showStandupModal && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowStandupModal(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 bg-primary border-b border-[var(--border-primary)]">
              <div className="flex items-center justify-between px-6 py-4">
                <div>
                  <h2 className="text-base font-bold text-[var(--text-primary)]">
                    Standup — Week {weekInfo.week}
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
              {/* Section 1 — Carry Over Tasks */}
              <div>
                <h3 className="text-[11px] font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
                  <ChevronRight className="w-3.5 h-3.5" /> Carry Over Tasks
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
              </div>

              {/* Section 2 — Weekly Focus */}
              <div>
                <h3 className="text-[11px] font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5" /> Weekly Focus
                </h3>
                {/* Added tasks summary */}
                {taskRows.length > 0 && (
                  <div className="space-y-1 mb-3">
                    {taskRows.map((row, idx) => (
                      <div
                        key={row.id}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg bg-tertiary border border-[var(--border-primary)]"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--brand-orange)] shrink-0" />
                        <span className="flex-1 text-[11px] font-bold text-[var(--text-primary)] truncate">
                          {row.name}
                        </span>
                        <span className="text-[9px] text-slate-500">
                          {row.project_id
                            ? assignedProjects.find(
                                (p) => String(p.id) === String(row.project_id),
                              )?.name || "Project"
                            : row.category || ""}
                        </span>
                        {row.due_date && (
                          <span className="text-[9px] text-slate-500">
                            {row.due_date}
                          </span>
                        )}
                        {row.blockers?.length > 0 && (
                          <span
                            onClick={() => setBlockerModal(idx)}
                            className="flex items-center gap-1 text-[9px] text-rose-400 cursor-pointer hover:text-rose-300"
                          >
                            <Shield className="w-3 h-3" />
                            {row.blockers.length}
                          </span>
                        )}
                        <button
                          onClick={() => removeTaskRow(idx)}
                          className="text-rose-500/50 hover:text-rose-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Task creation form — layered */}
                {showTaskForm ? (
                  <div className="p-4 rounded-xl border border-[var(--brand-orange)]/30 bg-[var(--brand-orange)]/[0.02] space-y-3">
                    <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                      New Task
                    </p>

                    <div>
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Task Name
                      </label>
                      <input
                        type="text"
                        value={newTaskForm.name}
                        onChange={(e) =>
                          setNewTaskForm((p) => ({
                            ...p,
                            name: e.target.value,
                          }))
                        }
                        placeholder="e.g. Email Migration"
                        className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
                        autoFocus
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          Project
                        </label>
                        <select
                          value={newTaskForm.project_id}
                          onChange={(e) =>
                            setNewTaskForm((p) => ({
                              ...p,
                              project_id: e.target.value,
                              category: "",
                            }))
                          }
                          className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-[var(--brand-orange)]"
                        >
                          <option value="">No Project</option>
                          {assignedProjects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      {!newTaskForm.project_id && (
                        <div>
                          <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            Category
                          </label>
                          <select
                            value={newTaskForm.category}
                            onChange={(e) =>
                              setNewTaskForm((p) => ({
                                ...p,
                                category: e.target.value,
                              }))
                            }
                            className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold text-purple-400 outline-none appearance-none cursor-pointer focus:border-[var(--brand-orange)]"
                          >
                            <option value="">Select...</option>
                            <option value="Operations">Operations</option>
                            <option value="Administration">Admin</option>
                            <option value="Marketing">Marketing</option>
                            <option value="Finance">Finance</option>
                            <option value="Logistics">Logistics</option>
                            <option value="HR">HR</option>
                            <option value="Technology">Technology</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          Due Date
                        </label>
                        <input
                          type="date"
                          value={newTaskForm.due_date}
                          onChange={(e) =>
                            setNewTaskForm((p) => ({
                              ...p,
                              due_date: e.target.value,
                            }))
                          }
                          className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          Collaborator
                        </label>
                        <select
                          value={newTaskForm.collaborator}
                          onChange={(e) =>
                            setNewTaskForm((p) => ({
                              ...p,
                              collaborator: e.target.value,
                            }))
                          }
                          className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-[var(--brand-orange)]"
                        >
                          <option value="">None</option>
                          {allStaff.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                        {newTaskForm.collaborator && (
                          <input
                            type="text"
                            value={newTaskForm.collaborator_note}
                            onChange={(e) =>
                              setNewTaskForm((p) => ({
                                ...p,
                                collaborator_note: e.target.value,
                              }))
                            }
                            placeholder="What do you need from them?"
                            className="w-full mt-1.5 bg-primary border border-[var(--border-primary)] rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-[var(--text-secondary)] outline-none focus:border-[var(--brand-orange)] transition-all"
                          />
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={addTaskRow}
                        disabled={!newTaskForm.name.trim()}
                        className="flex-1 px-4 py-2.5 bg-[var(--brand-orange)] text-black rounded-lg text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-40"
                      >
                        Add Task
                      </button>
                      <button
                        onClick={() => {
                          setShowTaskForm(false);
                          setNewTaskForm({
                            name: "",
                            project_id: "",
                            category: "",
                            due_date: "",
                            collaborator: "",
                            collaborator_note: "",
                          });
                        }}
                        className="px-4 py-2.5 bg-tertiary border border-[var(--border-primary)] rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-[var(--text-primary)] transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowTaskForm(true)}
                    className="w-full py-3 border-2 border-dashed border-[var(--border-primary)] rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-[var(--brand-orange)] hover:border-[var(--brand-orange)]/30 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Add Weekly Focus
                  </button>
                )}
              </div>

              {/* Additional Notes */}
              <div>
                <h3 className="text-[11px] font-semibold text-slate-500 mb-2">
                  Additional Notes
                </h3>
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

            <p className="text-[10px] text-[var(--text-secondary)]">
              Task:{" "}
              <span className="font-bold text-[var(--text-primary)]">
                {blockerModal.type === "api"
                  ? tasks.find((t) => t.id === blockerModal.taskId)?.title ||
                    "Task"
                  : taskRows[blockerModal]?.name || "Untitled"}
              </span>
            </p>

            {/* Existing blockers */}
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {(() => {
                const bs =
                  blockerModal.type === "api"
                    ? tasks.find((t) => t.id === blockerModal.taskId)
                        ?.blockers || []
                    : taskRows[blockerModal]?.blockers || [];
                return bs.length === 0 ? (
                  <p className="text-[10px] text-[var(--text-secondary)] italic text-center py-4">
                    No blockers declared yet.
                  </p>
                ) : (
                  bs.map((b) => (
                    <div
                      key={b.id}
                      className={`flex items-center justify-between p-2.5 rounded-lg border ${
                        b.status === "Resolved"
                          ? "border border-emerald-500/30 bg-emerald-500/[0.08]"
                          : "border border-rose-500/30 bg-rose-500/[0.08]"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-[var(--text-primary)] truncate">
                          {b.title || b.description}
                        </p>
                        {b.resolved_at && (
                          <p className="text-[8px] text-[var(--text-secondary)]">
                            Resolved{" "}
                            {new Date(b.resolved_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      {b.status === "Active" ? (
                        <button
                          onClick={async () => {
                            if (blockerModal.type === "api") {
                              await fetch("/api/blockers", {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  id: b.id,
                                  user_id: user?.cid || user?.id,
                                  status: "resolved",
                                  resolved_by: user?.cid || user?.id,
                                }),
                              });
                              fetchTasks();
                            } else {
                              resolveBlocker(blockerModal, b.id);
                            }
                            setBlockerModal(null);
                          }}
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
                  ))
                );
              })()}
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
                    blockerModal.type === "api"
                      ? (async () => {
                          await fetch("/api/blockers", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              task_id: blockerModal.taskId,
                              user_id: user?.cid || user?.id,
                              user_name: user?.name || "",
                              title: newBlockerDesc.trim(),
                            }),
                          });
                          setNewBlockerDesc("");
                          fetchTasks();
                        })()
                      : addBlockerToRow(blockerModal, newBlockerDesc.trim());
                    setNewBlockerDesc("");
                  }
                }}
                placeholder="Describe blocker..."
                className="flex-1 bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs outline-none font-bold text-[var(--text-primary)] focus:border-rose-500 transition-all"
              />
              <button
                onClick={() => {
                  if (newBlockerDesc.trim()) {
                    if (blockerModal.type === "api") {
                      fetch("/api/blockers", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          task_id: blockerModal.taskId,
                          user_id: user?.cid || user?.id,
                          user_name: user?.name || "",
                          title: newBlockerDesc.trim(),
                        }),
                      }).then(() => {
                        setNewBlockerDesc("");
                        setBlockerModal(null);
                        fetchTasks();
                      });
                    } else {
                      addBlockerToRow(blockerModal, newBlockerDesc.trim());
                      setNewBlockerDesc("");
                    }
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

"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo, Suspense } from "react";
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
  FileText,
  Users,
  BarChart3,
  Shield,
  Plus,
  X,
  ListTodo,
  Briefcase,
  Activity,
  CornerDownRight,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useSessionUser } from "@/lib/hooks/useSessionUser";
import { useApi, useApiMulti } from "@/lib/hooks/useApi";
import TaskManager from "@/components/tasks/TaskManager";
import TaskDetailModal from "@/components/ui/TaskDetailModal";
import { formatLocaleDate } from "@/lib/constants";

/**
 * STAFF OPERATIONAL REPORT PAGE
 *
 * Team members submit weekly stand-up (Monday) and retro (Friday) reports.
 * Each user sees only their own report history.
 */

function getWeekNumber(date) {
  const weekDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = weekDate.getUTCDay() || 7;
  weekDate.setUTCDate(weekDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(weekDate.getUTCFullYear(), 0, 1));
  return Math.ceil(((weekDate - yearStart) / 86400000 + 1) / 7);
}

function getCurrentWeek() {
  const now = new Date();
  return { week: getWeekNumber(now), year: now.getFullYear() };
}

/** The tabs, as the address may name them. Anything else means the first one. */
const REPORT_TABS = ["standup", "retro", "summary"];

// ─── Module-scope readers ────────────────────────────────────────────────────
// The reading hook keys its internal work on these, so they are made once here
// rather than rebuilt on every render.

const EMPTY_LIST = [];
const pickList = (field) => (payload) => (payload?.success ? payload[field] || [] : []);

// ─── The op-report read, and the form it fills ───────────────────────────

const TASK_STATUSES = [
  "pending",
  "in_progress",
  "blocked",
  "carried_over",
  "completed",
];

// Before the report read has answered, the form is exactly the shape this screen
// has always started from — which is NOT the shape an empty report produces, so
// the two are kept apart rather than merged into one "empty".
const INITIAL_FORM = {
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
  week_status: "",
  had_blockers: null,
  blocker_type: "",
  blocker_desc: "",
  wins: [],
  major_achievement: "",
  carryover_items: [],
  retro_notes: "",
};

// What a week with no report yet produces, matching the loader's empty branch.
const EMPTY_REPORT_FORM = {
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
  carryover_items: [],
  retro_notes: "",
};

const EMPTY_REPORT = { report: null, answered: false };

/** A stored report as the form reads it: its JSON-encoded lists decoded. */
function shapeReport(report) {
  if (!report) return null;
  const asList = (value) => {
    try {
      const parsed = typeof value === "string" ? JSON.parse(value) : value;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };
  const asListOrText = (value) => {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : value || "";
    } catch {
      return value || "";
    }
  };
  return {
    ...report,
    top_priorities: asList(report.top_priorities),
    expected_deliverables: asList(report.expected_deliverables),
    wins: asList(report.wins),
    carryover_items: asListOrText(report.carryover_items),
  };
}

// A refusal is reported as "not answered" rather than as an empty week: the form
// then keeps the shape it has always had while the read is outstanding.
const pickReport = (payload) =>
  payload?.success
    ? { report: shapeReport(payload.reports?.[0] || null), answered: true }
    : EMPTY_REPORT;

/** The form values a stored report — or no report at all — produces. */
const reportToForm = (report) =>
  report
    ? {
        top_priorities: report.top_priorities || [],
        expected_deliverables: report.expected_deliverables || [],
        projects_tasks: report.projects_tasks || "",
        has_dependencies:
          report.has_dependencies != null ? Boolean(report.has_dependencies) : null,
        dependency_note: report.dependency_note || "",
        has_blockers:
          report.has_blockers != null ? Boolean(report.has_blockers) : null,
        blocker_description: report.blocker_description || "",
        needs_support: report.needs_support != null ? Boolean(report.needs_support) : null,
        support_note: report.support_note || "",
        additional_notes: report.additional_notes || "",
        completed_work: report.completed_work || "",
        unfinished_tasks: report.unfinished_tasks || "",
        challenges: report.challenges || "",
        wins: report.wins || [],
        carryover_items: report.carryover_items || [],
        retro_notes: report.retro_notes || "",
      }
    : EMPTY_REPORT_FORM;

/** Every project this person is on, deduplicated: the flat list the picker uses. */
const pickAssignments = (payload) => {
  if (!payload?.success) return EMPTY_LIST;
  const all = [...(payload.owned || []), ...(payload.collab || []), ...(payload.all_active || [])];
  const seen = new Set();
  return all.filter((project) => {
    if (seen.has(String(project.id))) return false;
    seen.add(String(project.id));
    return true;
  });
};

/** The Future Studio staff the collaborator picker offers. */
const pickStudioStaff = (payload) =>
  (payload?.success ? payload.contacts || [] : [])
    .filter(
      (contact) =>
        contact.status === "active" &&
        contact.role !== "super_admin" &&
        contact.group_name?.toUpperCase() === "FUTURE STUDIO",
    )
    .map((contact) => ({ id: contact.cid || contact.id, name: contact.name, email: contact.email }))
    .sort((first, second) => first.name.localeCompare(second.name));

// Returns true when a stand-up draft actually contains something the user
// typed/added (a non-empty field or at least one task row). Empty drafts are
// not worth showing or keeping.
function hasDraftContent(form, taskRows) {
  if (Array.isArray(taskRows) && taskRows.length > 0) return true;
  if (!form) return false;

  const arrayFields = [
    "top_priorities",
    "expected_deliverables",
    "completed_work",
    "unfinished_tasks",
    "wins",
    "carryover_items",
  ];
  for (const field of arrayFields) {
    if (Array.isArray(form[field]) && form[field].length > 0) return true;
  }

  const stringFields = [
    "projects_tasks",
    "dependency_note",
    "blocker_description",
    "support_note",
    "additional_notes",
    "challenges",
    "week_status",
    "blocker_type",
    "blocker_desc",
    "major_achievement",
    "retro_notes",
  ];
  for (const field of stringFields) {
    if (typeof form[field] === "string" && form[field].trim() !== "") return true;
  }

  return false;
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  try {
    const parsedDate = new Date(dateStr);
    if (isNaN(parsedDate.getTime())) return dateStr;
    const day = String(parsedDate.getDate()).padStart(2, "0");
    const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
    const year = parsedDate.getFullYear();
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

const statusLabelKey = (status) => {
  const labelKeys = {
    pending: "status.pending",
    in_progress: "status.inProgress",
    blocked: "status.blocked",
    completed: "status.completed",
    carried_over: "status.carriedOver",
  };
  return labelKeys[status] || "status.pending";
};

function StaffOpReport() {
  const router = useRouter();
  const { t, lang } = useI18n();

  // Who is signed in, from the shell's session cache. This screen used to ask the
  // session endpoint for itself and, failing that, read the browser's stored copy
  // - with a redirect to sign-in on top, which the request gate already performs
  // for every page behind a session. One identity, no request, no redirect here.
  const { cid: userCid, user } = useSessionUser();

  // ─── The address is the source of truth for the tab and the week ───
  //
  // These two used to be state: one effect read the query string into them and a
  // second wrote them back out, a two-way mirror - and it is why every read on this
  // screen was keyed on the mirror rather than on the address. They are COMPUTED
  // from the address now, so the browser's back button, a sidebar link and the
  // controls below all land on the same value and there is nothing to keep in step.
  //
  // The current week is snapshotted once, for the reason every screen here
  // snapshots the clock: read during a render it would differ between the server's
  // value and the browser's at a week boundary.
  const [thisWeek] = useState(() => getCurrentWeek());
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const reportType = REPORT_TABS.includes(tabParam) ? tabParam : "standup";

  const weekParam = parseInt(searchParams.get("week") || "", 10);
  const yearParam = parseInt(searchParams.get("year") || "", 10);
  const weekInfo = useMemo(() => {
    if (isNaN(weekParam) || weekParam < 1 || weekParam > 53) return thisWeek;
    return {
      week: weekParam,
      year: !isNaN(yearParam) && yearParam >= 2000 ? yearParam : thisWeek.year,
    };
  }, [weekParam, yearParam, thisWeek]);

  // The controls ASK FOR another tab or week by changing the address, which is what
  // makes the derived values above the only ones the screen reads. The two names
  // below keep every existing call site working, including the ones that pass an
  // updater, as the setters they replace accepted.
  const goTo = useCallback(
    (next) => {
      const qs = new URLSearchParams({
        tab: next.tab ?? reportType,
        week: String(next.week ?? weekInfo.week),
        year: String(next.year ?? weekInfo.year),
      }).toString();
      router.replace(`/staff/op-report?${qs}`, { scroll: false });
    },
    [router, reportType, weekInfo.week, weekInfo.year],
  );

  const setReportType = useCallback((tab) => goTo({ tab }), [goTo]);
  const setWeekInfo = useCallback(
    (next) => {
      const value = typeof next === "function" ? next(weekInfo) : next;
      goTo({ week: value.week, year: value.year });
    },
    [goTo, weekInfo],
  );

  // Arriving without a query string, the address is filled in once so that a
  // refresh or a shared link describes the same view. This navigates and writes no
  // state, which is why it is an effect that is allowed to exist.
  useEffect(() => {
    if (searchParams.get("tab")) return;
    goTo({});
  }, [searchParams, goTo]);
  // ─── The five reads the old effect called together ───
  //
  // Addressed on the person and, for the report, on the report's OWN address — so
  // a change of week or of type is what re-reads, and so the form below has an
  // address to belong to. No address means "not asked yet" and issues nothing.
  const userId = userCid || user?.id || null;
  const reportUrl = userId
    ? `/api/op-reports?user_id=${userId}&type=${reportType}&week=${weekInfo.week}&year=${weekInfo.year}`
    : null;
  const { data: reportRead, refresh: refreshReport } = useApi(reportUrl, {
    defaultValue: EMPTY_REPORT,
    transform: pickReport,
  });
  const existingReport = reportRead.report;

  const { data: history, refresh: refreshHistory } = useApi(
    userId ? `/api/op-reports?user_id=${userId}` : null,
    { defaultValue: EMPTY_LIST, transform: pickList("reports") },
  );
  const { data: assignedProjects } = useApi(
    userId ? `/api/projects/assignments?user_cid=${userId}` : null,
    { defaultValue: EMPTY_LIST, transform: pickAssignments },
  );

  // The task list is one read per status plus the tasks assigned TO this person,
  // issued together; the merge below is what the loader did by hand.
  const taskEndpoints = useMemo(
    () =>
      userId
        ? [
            ...TASK_STATUSES.map((status) => ({
              key: status,
              url: `/api/tasks?user_id=${userId}&status=${status}`,
              transform: pickList("tasks"),
            })),
            {
              key: "assigned",
              url: `/api/tasks?assigned_to=${userId}`,
              transform: pickList("tasks"),
            },
          ]
        : [],
    [userId],
  );
  const { data: taskAnswers, refresh: refreshTasks } = useApiMulti(taskEndpoints);
  const tasks = useMemo(() => {
    const merged = new Map();
    for (const status of TASK_STATUSES) {
      for (const task of taskAnswers[status] || []) {
        if (!merged.has(task.id)) merged.set(task.id, task);
      }
    }
    for (const task of taskAnswers.assigned || []) {
      if (!merged.has(task.id)) merged.set(task.id, task);
    }
    return Array.from(merged.values());
  }, [taskAnswers]);

  // The task list feeds the dashboard's calendar; the loader signalled that on
  // every load, and that signal is the only thing left in an effect - it writes
  // no state, which is why it is allowed to be one.
  useEffect(() => {
    window.__refreshDashboard?.();
  }, [tasks]);

  // The Future Studio staff list the collaborator picker was built from. Its
  // answer has never been READ on this screen - the picker was not carried over -
  // so the request is kept and its answer discarded, rather than quietly dropped
  // as part of a warning cleanup.
  useApi("/api/contacts", { defaultValue: EMPTY_LIST, transform: pickStudioStaff });

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [showStandupModal, setShowStandupModal] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [isHistorical, setIsHistorical] = useState(false);
  const [expandedWeek, setExpandedWeek] = useState(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [newTaskForm, setNewTaskForm] = useState({
    name: "",
    project_id: "",
    category: "",
    start_date: "",
    start_time: "",
    due_date: "",
    due_time: "",
    collaborator: "",
    collaborator_note: "",
    project_search: "",
    show_dropdown: false,
  });

  // Form state. The report the read returned is the BASE, and the person's typing
  // is recorded WITH THE ADDRESS IT WAS TYPED FOR - so changing week or type shows
  // THAT week's report instead of carrying the previous one's text across, and a
  // re-read can never wipe what someone is in the middle of writing.
  const [formOverride, setFormOverride] = useState({ key: null, value: null });
  const baseForm = useMemo(
    () => (reportRead.answered ? reportToForm(reportRead.report) : INITIAL_FORM),
    [reportRead],
  );
  const form =
    formOverride.key === reportUrl && formOverride.value
      ? formOverride.value
      : baseForm;
  const setForm = useCallback(
    (next) => {
      setFormOverride((prev) => {
        const current =
          prev.key === reportUrl && prev.value ? prev.value : baseForm;
        return {
          key: reportUrl,
          value: typeof next === "function" ? next(current) : next,
        };
      });
    },
    [reportUrl, baseForm],
  );

  // Temporary input for adding bullet items
  const [newPriority, setNewPriority] = useState("");
  const [newDeliverable, setNewDeliverable] = useState("");
  const [newWin, setNewWin] = useState("");
  const [newCarryover, setNewCarryover] = useState("");

  // Task integration state (Phase 4)
  // Increment to ask the TaskManager inside the standup to open its new-task
  // form directly ("Add Task" shortcut at the bottom of the task list).
  const [newTaskRequest] = useState(0);
  const [taskCreationOpen, setTaskCreationOpen] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskReasons, setTaskReasons] = useState({});

  // Structured task row state
  const [taskRows, setTaskRows] = useState([]);
  const [blockerModal, setBlockerModal] = useState(null); // { taskRowIndex } or null
  const [confirmTarget, setConfirmTarget] = useState(null); // { id, message, onConfirm } or null
  const [newBlockerTitle, setNewBlockerTitle] = useState("");
  const [newBlockerDescription, setNewBlockerDescription] = useState("");
  const [newBlockerPriority, setNewBlockerPriority] = useState("medium");
  const [newBlockerRefUrl, setNewBlockerRefUrl] = useState("");
  const [newBlockerNotes, setNewBlockerNotes] = useState("");
  const [subTaskModal, setSubTaskModal] = useState(null); // parent row id or null
  const [subTaskName, setSubTaskName] = useState("");
  const [expandedTasks, setExpandedTasks] = useState({}); // taskId -> boolean
  const [updatingTasks, setUpdatingTasks] = useState({}); // taskId -> boolean
  const [taskDetail, setTaskDetail] = useState(null); // task object for detail modal

  // Summary tab state — the three lists themselves are read below.
  const [summaryCollapsed, setSummaryCollapsed] = useState({});
  const [summaryProjectExpanded, setSummaryProjectExpanded] = useState({});

  // Draft auto-save timer ref
  const draftTimerRef = useRef(null);
  // Draft recovery banner state
  const [draftAvailable, setDraftAvailable] = useState(false);
  // Snapshot the clock once per render — reading it mid-render is impure.
  const [now] = useState(() => Date.now());

  // Build a localStorage key for the current user + current week
  const getDraftKey = useCallback(() => {
    if (!userCid) return null;
    return `standup_draft_${userCid}_${weekInfo.week}_${weekInfo.year}`;
  }, [userCid, weekInfo.week, weekInfo.year]);

  // Save draft to localStorage after 2s of no changes
  useEffect(() => {
    if (!user || saving || !showStandupModal) return;
    const key = getDraftKey();
    if (!key) return;

    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      try {
        if (hasDraftContent(form, taskRows)) {
          const draft = {
            form,
            taskRows,
            reportType,
            showTaskForm,
            savedAt: Date.now(),
          };
          localStorage.setItem(key, JSON.stringify(draft));
        } else {
          localStorage.removeItem(key);
        }
      } catch {
        // localStorage full or unavailable — silently ignore
      }
    }, 2000);

    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [form, taskRows, user, saving, showStandupModal, reportType, showTaskForm, getDraftKey]);

  // Check for existing draft when modal opens
  const checkDraft = useCallback(() => {
    const key = getDraftKey();
    if (!key) return;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (hasDraftContent(parsed.form, parsed.taskRows)) {
          setDraftAvailable(true);
          return;
        }
      }
    } catch {
      // ignore
    }
    setDraftAvailable(false);
  }, [getDraftKey]);

  // Restore draft content
  const restoreDraft = useCallback(() => {
    const key = getDraftKey();
    if (!key) return;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.form) setForm(draft.form);
        if (draft.taskRows) setTaskRows(draft.taskRows);
        if (draft.reportType) setReportType(draft.reportType);
        if (draft.showTaskForm !== undefined) setShowTaskForm(draft.showTaskForm);
      }
    } catch {
      // ignore
    }
    setDraftAvailable(false);
  }, [getDraftKey, setReportType, setForm]);

  // Discard draft
  const discardDraft = useCallback(() => {
    const key = getDraftKey();
    if (key) {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
    }
    setDraftAvailable(false);
  }, [getDraftKey]);

  // Clear draft from localStorage (called on successful submit)
  const clearDraft = useCallback(() => {
    const key = getDraftKey();
    if (key) {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
    }
    setDraftAvailable(false);
  }, [getDraftKey]);

  const toggleSummaryCollapsed = (key) => {
    setSummaryCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };


  // ─── The summary tab's three reads ────────────────────────────────────
  //
  // Read only while that tab is open, which the effect this replaces expressed by
  // deciding whether to call its loader, and addressed on the person and the week
  // so a change of either re-reads.
  const summaryOn = reportType === "summary" && Boolean(userCid);
  const { data: summaryTasks, loading: summaryTasksLoading } = useApi(
    summaryOn
      ? `/api/tasks?user_id=${userCid}&week=${weekInfo.week}&year=${weekInfo.year}&sort=oldest`
      : null,
    { defaultValue: EMPTY_LIST, transform: pickList("tasks"), deps: [userCid, summaryOn, weekInfo.week, weekInfo.year] },
  );
  const { data: summaryBlockers, loading: summaryBlockersLoading } = useApi(
    summaryOn ? `/api/blockers?user_id=${userCid}` : null,
    { defaultValue: EMPTY_LIST, transform: pickList("blockers"), deps: [userCid, summaryOn] },
  );
  const { data: summaryProjects, loading: summaryProjectsLoading } = useApi(
    summaryOn ? `/api/projects/assignments?user_cid=${userCid}` : null,
    { defaultValue: EMPTY_LIST, transform: pickList("projects"), deps: [userCid, summaryOn] },
  );

  // The panel waits for all three, which is what the loader did by applying the
  // three answers together.
  const summaryLoading =
    summaryTasksLoading || summaryBlockersLoading || summaryProjectsLoading;

  const notify = (message, type = "success") => {
    setToast({ msg: message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Opening the standup dialog asks the browser's stored draft whether there is
  // one, and offers it. Done where the dialog is opened rather than in an effect
  // watching it: the answer is a fact about storage, read when it is needed, and
  // in an effect the panel appeared without it for a frame - which is what the
  // fifty-millisecond delay in the old code was waiting for.
  const openStandupModal = () => {
    setShowStandupModal(true);
    if (!readOnly && !isHistorical) checkDraft();
    else setDraftAvailable(false);
  };

  const handleSubmit = async (status = "submitted") => {
    if (!user) return;

    setSaving(true);
    try {
      // First: create only NEW task rows as real tasks (skip existing ones already in DB)
      const userId = user.cid || user.id;
      // Use weekInfo (the viewed week) for both task creation AND standup — keep them in sync
      const weekData = weekInfo;

      // Map local row IDs to real DB IDs for parent_task_id resolution
      const idMapping = {};
      // Sort: parents before children so real IDs are available for sub-tasks
      const sortedRows = [...taskRows].sort((first, second) => {
        if (first.parent_task_id && !second.parent_task_id) return 1;
        if (!first.parent_task_id && second.parent_task_id) return -1;
        return 0;
      });
      for (const row of sortedRows) {
        if (!row.name.trim()) continue;
        // Skip rows that already exist in DB unless they are carryovers waiting to be created for the new week
        if (
          row.status !== null &&
          row.status !== undefined &&
          !row.is_carryover
        )
          continue;

        // Resolve the real parent_task_id: if the parent was just created in this batch,
        // use the real DB ID; otherwise use the provided parent_task_id as-is
        let resolvedParentId = row.parent_task_id || null;
        if (resolvedParentId && idMapping[resolvedParentId]) {
          resolvedParentId = idMapping[resolvedParentId];
        }

        // Use shared carry-over API if this row has an original DB task to migrate
        if (row.carried_over_from_task_id) {
          const carryoverResponse = await fetch("/api/tasks/carryover", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              task_id: row.carried_over_from_task_id,
              target_week: weekData.week,
              target_year: weekData.year,
              user_id: userId,
              user_name: user.name || "",
            }),
          });
          const carryoverData = await carryoverResponse.json();
          if (carryoverData.success) {
            idMapping[row.id] = carryoverData.id;
          }
        } else {
          const taskResponse = await fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: row.name.trim(),
              description: row.description || null,
              project_id: row.project_id || null,
              category: row.category || null,
              user_id: userId,
              user_name: user.name || "",
              status: row.is_carryover
                ? row.status || "in_progress"
                : "in_progress",
              created_week: weekData.week,
              created_year: weekData.year,
              parent_task_id: resolvedParentId,
              start_date: row.start_date
                ? `${row.start_date}${row.start_time ? `T${row.start_time}:00` : ""}`
                : null,
              end_date: row.due_date
                ? `${row.due_date}${row.due_time ? `T${row.due_time}:00` : ""}`
                : null,
            }),
          });
          const taskData = await taskResponse.json();
          if (taskData.success) {
            idMapping[row.id] = taskData.id;
          }
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
        wins: JSON.stringify(form.wins || []),
        carryover_items: JSON.stringify(form.carryover_items || []),
        retro_notes: form.retro_notes || null,
      };
      const response = await fetch("/api/op-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (data.success) {
        notify(
          status === "submitted"
            ? t("reports.reportSubmitted")
            : t("reports.reportSaved"),
          "success",
        );
        clearDraft();
        setTaskRows([]);
        setShowTaskForm(false);
        refreshReport();
        refreshHistory();
        refreshTasks();
      } else {
        notify(t((data.error || t("reports.failedToSave")) || "") || (data.error || t("reports.failedToSave")), "error");
      }
    } catch {
      notify(t("errors.networkError"), "error");
    } finally {
      setSaving(false);
    }
  };

  // ─── BULLET-LIST ITEM HANDLERS (priorities / deliverables / wins / carryover) ───
  const _addPriority = () => {
    const value = newPriority.trim();
    if (!value) return;
    setForm((prev) => ({ ...prev, top_priorities: [...(prev.top_priorities || []), value] }));
    setNewPriority("");
  };

  const _addDeliverable = () => {
    const value = newDeliverable.trim();
    if (!value) return;
    setForm((prev) => ({
      ...prev,
      expected_deliverables: [...(prev.expected_deliverables || []), value],
    }));
    setNewDeliverable("");
  };

  const _addWin = () => {
    const value = newWin.trim();
    if (!value) return;
    setForm((prev) => ({ ...prev, wins: [...(prev.wins || []), value] }));
    setNewWin("");
  };

  const _addCarryover = () => {
    const value = newCarryover.trim();
    if (!value) return;
    setForm((prev) => ({
      ...prev,
      carryover_items: [...(prev.carryover_items || []), value],
    }));
    setNewCarryover("");
  };

  // ─── TASK ROW MANAGEMENT ───

  const _addSubTaskRow = (parentRowId) => {
    setSubTaskModal(parentRowId);
    setSubTaskName("");
  };

  const _addSubTaskFromModal = () => {
    const name = subTaskName.trim();
    if (!name) return;
    const parentId = subTaskModal;
    setTaskRows((prev) => {
      const newRow = {
        id: Date.now(),
        name,
        description: "",
        project_id: prev.find((row) => row.id === parentId)?.project_id || null,
        category: prev.find((row) => row.id === parentId)?.category || "",
        start_date: "",
        start_time: "",
        due_date: "",
        due_time: "",
        blockers: [],
        collaborators: [],
        parent_task_id: parentId,
        status: null,
        uncompleted_reason: "",
      };
      const parentIdx = prev.findIndex((row) => row.id === parentId);
      if (parentIdx !== -1) {
        const updated = [...prev];
        updated.splice(parentIdx + 1, 0, newRow);
        return updated;
      }
      return [...prev, newRow];
    });
    setSubTaskName("");
  };

  const _addTaskRow = () => {
    if (!newTaskForm.name.trim()) return;
    setTaskRows((prev) => {
      const newRow = {
        id: Date.now(),
        name: newTaskForm.name.trim(),
        description: "",
        project_id: newTaskForm.project_id || null,
        category: newTaskForm.category || "",
        start_date: newTaskForm.start_date || "",
        start_time: newTaskForm.start_time || "",
        due_date: newTaskForm.due_date || "",
        due_time: newTaskForm.due_time || "",
        blockers: [],
        collaborators: newTaskForm.collaborator
          ? [
              {
                id: newTaskForm.collaborator,
                note: newTaskForm.collaborator_note,
              },
            ]
          : [],
        parent_task_id: null,
        status: null,
        uncompleted_reason: "",
      };
      return [...prev, newRow];
    });
    setNewTaskForm({
      name: "",
      project_id: "",
      category: "",
      start_date: "",
      start_time: "",
      due_date: "",
      due_time: "",
      collaborator: "",
      collaborator_note: "",
      project_search: "",
      show_dropdown: false,
    });
    setShowTaskForm(false);
  };

  // Create a new task immediately via the existing tasks API, then refresh.
  const handleCreateNewTask = async () => {
    if (!newTaskForm.name.trim()) return;
    setCreatingTask(true);
    try {
      const week = weekInfo || getCurrentWeek();
      const userId = user?.cid || user?.id;
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTaskForm.name.trim(),
          project_id: newTaskForm.project_id || null,
          user_id: userId,
          user_name: user?.name || "User",
          status: "in_progress",
          created_week: week.week,
          created_year: week.year,
          start_date: newTaskForm.start_date || null,
          end_date: newTaskForm.due_date || null,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setTaskCreationOpen(false);
        setNewTaskForm({
          name: "",
          project_id: "",
          category: "",
          start_date: "",
          start_time: "",
          due_date: "",
          due_time: "",
          collaborator: "",
          collaborator_note: "",
          project_search: "",
          show_dropdown: false,
        });
        notify(t("staff.opReport.tasksCreated", { count: 1 }));
        refreshTasks();
      } else {
        notify(
          data.error || t("errors.taskCreateFailed"),
          "error",
        );
      }
    } catch (error) {
      console.error("Create task error:", error);
      notify(
        t("errors.somethingWrong") || "Something went wrong. Please try again.",
        "error",
      );
    } finally {
      setCreatingTask(false);
    }
  };

  const _updateTaskRow = (index, field, value) => {
    setTaskRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const _removeTaskRow = (index) => {
    const row = taskRows[index];
    if (!row?.status) {
      setTaskRows((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
      return;
    }
    setConfirmTarget({
      id: row.id,
      message: 'Are you sure you want to archive this task?',
      onConfirm: () => performArchiveTask(index),
    });
  };

  const performArchiveTask = async (index) => {
    const row = taskRows[index];
    try {
      const response = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: row.id,
          status: "archived",
          user_id: user?.cid || user?.id,
        }),
      });
      if (!response.ok) throw new Error("Failed to archive task");
    } catch (err) {
      console.error(err);
      return;
    }
    setTaskRows((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
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

  const _updateBlockerInRow = (rowIndex, blockerId, updates) => {
    setTaskRows((prev) => {
      const updated = [...prev];
      updated[rowIndex] = {
        ...updated[rowIndex],
        blockers: (updated[rowIndex]?.blockers || []).map((blocker) =>
          blocker.id === blockerId ? { ...blocker, ...updates } : blocker,
        ),
      };
      return updated;
    });
  };

  const _removeBlockerFromRow = (rowIndex, blockerId) => {
    setTaskRows((prev) => {
      const updated = [...prev];
      updated[rowIndex] = {
        ...updated[rowIndex],
        blockers: (updated[rowIndex]?.blockers || []).filter(
          (blocker) => blocker.id !== blockerId,
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
        blockers: (updated[rowIndex]?.blockers || []).map((blocker) =>
          blocker.id === blockerId
            ? {
                ...blocker,
                status: "Resolved",
                resolved_at: new Date().toISOString(),
              }
            : blocker,
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
    <>
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
                {t("reports.companyReports")}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              {t("reports.weeklyReport")}
            </h1>
            <p className="text-xs font-bold text-[var(--text-secondary)] opacity-60">
              {t("staff.opReport.subtitle")}
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
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("time.week")} {weekInfo.week} — {weekInfo.year}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-50 mt-0.5">
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
            className={`flex items-center gap-2 px-6 py-3 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${
              reportType === "standup"
                ? "bg-[var(--brand-orange)] text-black shadow-lg"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Calendar className="w-4 h-4" /> {t("reports.mondayStandup")}
          </button>
          <button
            onClick={() => setReportType("retro")}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${
              reportType === "retro"
                ? "bg-[var(--brand-orange)] text-black shadow-lg"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Trophy className="w-4 h-4" /> {t("reports.fridayRetro")}
          </button>
          <button
            onClick={() => setReportType("summary")}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${
              reportType === "summary"
                ? "bg-[var(--brand-orange)] text-black shadow-lg"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <BarChart3 className="w-4 h-4" />{" "}
            {t("staff.opReport.weeklySummary")}
          </button>
        </div>

        {existingReport?.status === "submitted" && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
              {t("staff.opReport.alreadySubmitted")}
            </p>
          </div>
        )}

        <div className="w-full">
          {/* REPORT FORM */}
          <div className="space-y-8">
            {reportType === "standup" ? (
              <div className="space-y-6">
                {/* Header */}
                {(() => {
                  return (
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-bold text-[var(--text-primary)]">
                          {t("reports.mondayStandup")}
                        </h2>
                        <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                          {t("staff.opReport.manageWeeklyPlans")}
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          const currentWeek = getCurrentWeek();
                          const isPastWeek =
                            weekInfo.week !== currentWeek.week ||
                            weekInfo.year !== currentWeek.year;
                          setReadOnly(isPastWeek);
                          setIsHistorical(isPastWeek);
                          openStandupModal();

                          // Only the current week's "new standup" flow pre-fills
                          // carry-over tasks from previous weeks.
                          if (isPastWeek) return;

                          // ─── Compute current reporting week ───
                          const now = new Date();
                          const curWeek = getWeekNumber(now);
                          const curYear = now.getFullYear();

                          // ─── Fetch ALL tasks for user and filter past incomplete tasks ───
                          const userId = user?.cid || user?.id;
                          try {
                            const response = await fetch(
                              `/api/tasks?user_id=${userId}&sort=oldest`,
                            );
                            const data = await response.json();
                            const allTasks = data.tasks || [];

                            // ── Collapse carry-over chains to their LATEST open copy ──
                            // Every week a carried task is cloned (clone -> source via
                            // carried_over_from_task_id). Pre-filling every chain member
                            // made one submit clone the same task several times and flip
                            // earlier copies (even completed ones) to 'carried_over'.
                            // Only the newest open copy may be carried, and only once.
                            const cloneIndex = new Map(); // source id -> clones
                            for (const task of allTasks) {
                              if (!task.carried_over_from_task_id) continue;
                              const list =
                                cloneIndex.get(task.carried_over_from_task_id) ||
                                [];
                              list.push(task);
                              cloneIndex.set(task.carried_over_from_task_id, list);
                            }
                            const latestOpenCopy = (task) => {
                              let current = task;
                              const seen = new Set();
                              while (!seen.has(current.id)) {
                                seen.add(current.id);
                                const next = (cloneIndex.get(current.id) || [])
                                  .filter(
                                    (clone) =>
                                      !["archived", "completed"].includes(
                                        clone.status,
                                      ),
                                  )
                                  .sort(
                                    (first, second) =>
                                      second.created_year - first.created_year ||
                                      second.created_week - first.created_week ||
                                      second.id - first.id,
                                  )[0];
                                if (!next) break;
                                current = next;
                              }
                              return current;
                            };

                            const chainsToCarry = new Map(); // head id -> task
                            for (const task of allTasks) {
                              // Only open, top-level tasks from earlier weeks can start a carry.
                              if (
                                ["archived", "completed"].includes(task.status) ||
                                task.parent_task_id ||
                                (task.created_week === curWeek &&
                                  task.created_year === curYear)
                              )
                                continue;
                              const head = latestOpenCopy(task);
                              // Already carried into the current week — nothing to do.
                              if (
                                head.created_week === curWeek &&
                                head.created_year === curYear
                              )
                                continue;
                              if (!chainsToCarry.has(head.id)) {
                                chainsToCarry.set(head.id, head);
                              }
                            }
                            const prevWeekTasks = [...chainsToCarry.values()];

                            if (prevWeekTasks.length > 0) {
                              // Subtasks are NOT pre-filled individually: they follow
                              // their parent clone automatically (the carry-over API
                              // re-parents them), which keeps the hierarchy intact.
                              const allTaskRows = prevWeekTasks.map((task) => ({
                                id: task.id,
                                is_carryover: true,
                                carried_over_from_task_id: task.id,
                                name: task.title,
                                description: task.description || "",
                                project_id: task.project_id || null,
                                category: task.category || "",
                                start_date: task.start_date || "",
                                start_time: "",
                                due_date: task.end_date || "",
                                due_time: "",
                                blockers:
                                  task.blockers?.map((blocker) => ({
                                    id: blocker.id,
                                    description: blocker.title,
                                    severity: blocker.severity || "medium",
                                    status: blocker.status || "Active",
                                    created_at: blocker.created_at,
                                  })) || [],
                                parent_task_id: null,
                                status: task.status,
                                collaborators: [],
                                uncompleted_reason: "",
                              }));
                              setTaskRows(allTaskRows);
                              setShowTaskForm(false);
                              return;
                            }
                            setShowTaskForm(false);
                          } catch (error) {
                            console.error(
                              "Failed to fetch previous week tasks:",
                              error,
                            );
                          }
                          setShowTaskForm(true);
                        }}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[10px] font-bold bg-[var(--brand-orange)] text-black hover:brightness-110 transition-all"
                      >
                        <>
                          <Plus className="w-4 h-4" />{" "}
                          {history.some(
                            (entry) =>
                              entry.report_type === "standup" &&
                              entry.week_number === weekInfo.week &&
                              entry.year === weekInfo.year,
                          )
                            ? t("staff.opReport.editStandup")
                            : t("staff.opReport.createNewStandup")}
                        </>
                      </button>
                    </div>
                  );
                })()}

                {/* Standups Table */}
                <div className="overflow-hidden rounded-xl border border-[var(--border-primary)]">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                    <thead>
                      <tr className="bg-tertiary border-b border-[var(--border-primary)]">
                        <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                          {t("staff.table.week")}
                        </th>
                        <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                          {t("staff.table.totalTasks")}
                        </th>
                        <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                          {t("staff.table.status")}
                        </th>
                        <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                          {t("staff.table.actions")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {history
                        .filter((historyEntry) => historyEntry.report_type === "standup")
                        .map((report) => {
                          const weekTasks = tasks.filter(
                            (task) =>
                              task.created_week === report.week_number &&
                              task.created_year === report.year &&
                              !task.parent_task_id, // subtasks are counted via the parent
                          );
                          const taskCount = weekTasks.reduce(
                            (sum, task) =>
                              sum + 1 + (task.subtasks?.length || 0),
                            0,
                          );
                          return (
                            <React.Fragment key={report.id}>
                              <tr
                                key={report.id}
                                className="border-b border-[var(--border-primary)]/50 hover:bg-tertiary/50 transition-colors"
                              >
                                <td className="px-4 py-3">
                                  <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                                    {t("staff.table.week")} {report.week_number}
                                  </span>
                                  <span className="text-[10px] font-medium text-[var(--text-secondary)] ml-2">
                                    {report.year}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-[12px] font-medium text-[var(--text-secondary)]">
                                    {taskCount} {t("staff.table.tasks")}
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
                                      ? t("status.submitted")
                                      : t("status.draft")}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    onClick={() => {
                                      const weekKey = `${report.week_number}-${report.year}`;
                                      setExpandedWeek((prev) =>
                                        prev === weekKey ? null : weekKey,
                                      );
                                    }}
                                    className="text-[11px] font-medium text-[var(--brand-orange)] hover:underline flex items-center gap-1 ml-auto"
                                  >
                                    {expandedWeek ===
                                    `${report.week_number}-${report.year}`
                                      ? t("common.collapse")
                                      : t("common.view")}
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
                                      <div className="p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                            {report.week_number > 0
                                              ? `Week ${report.week_number}, ${report.year}`
                                              : ""}
                                          </span>
                                          <button
                                            onClick={() => {
                                              const currentWeek =
                                                getCurrentWeek();
                                              const isPastWeek =
                                                report.week_number !==
                                                  currentWeek.week ||
                                                report.year !==
                                                  currentWeek.year;
                                              setReadOnly(isPastWeek);
                                              setIsHistorical(isPastWeek);
                                              setWeekInfo({
                                                week: report.week_number,
                                                year: report.year,
                                              });
                                              // Load tasks for that week into taskRows
                                              const weekTasks = tasks.filter(
                                                (task) =>
                                                  [
                                                    "archived",
                                                    "completed",
                                                  ].includes(task.status) &&
                                                  !task.parent_task_id,
                                              );
                                              const allTaskRows = [];
                                              for (const task of weekTasks) {
                                                allTaskRows.push({
                                                  id: task.id,
                                                  name: task.title,
                                                  description:
                                                    task.description || "",
                                                  project_id:
                                                    task.project_id || null,
                                                  category: task.category || "",
                                                  start_date:
                                                    task.start_date || "",
                                                  start_time: "",
                                                  due_date: task.end_date || "",
                                                  due_time: "",
                                                  blockers:
                                                    task.blockers?.map((blocker) => ({
                                                      id: blocker.id,
                                                      description: blocker.title,
                                                      severity:
                                                        blocker.severity || "medium",
                                                      status:
                                                        blocker.status || "Active",
                                                      created_at: blocker.created_at,
                                                    })) || [],
                                                  parent_task_id:
                                                    task.parent_task_id || null,
                                                  status: task.status,
                                                  collaborators: [],
                                                  uncompleted_reason: "",
                                                });
                                                if (task.subtasks?.length > 0) {
                                                  for (const subtask of task.subtasks) {
                                                    allTaskRows.push({
                                                      id: subtask.id,
                                                      name: subtask.title,
                                                      description: "",
                                                      project_id:
                                                        task.project_id || null,
                                                      category:
                                                        task.category || "",
                                                      start_date: "",
                                                      start_time: "",
                                                      due_date: "",
                                                      due_time: "",
                                                      blockers: [],
                                                      parent_task_id: task.id,
                                                      status: subtask.status,
                                                      collaborators: [],
                                                      uncompleted_reason: "",
                                                    });
                                                  }
                                                }
                                              }
                                              setTaskRows(allTaskRows);
                                              openStandupModal();
                                              setShowTaskForm(false);
                                            }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--brand-orange)] text-black rounded-lg text-[10px] font-bold uppercase tracking-wide hover:brightness-110 transition-all"
                                          >
                                            <ChevronRight className="w-3 h-3" />{" "}
                                            {(() => {
                                              const currentWeek =
                                                getCurrentWeek();
                                              const isPastWeek =
                                                report.week_number !==
                                                  currentWeek.week ||
                                                report.year !==
                                                  currentWeek.year;
                                              return isPastWeek
                                                ? t("staff.opReport.view")
                                                : t(
                                                    "staff.opReport.editStandup",
                                                  );
                                            })()}
                                          </button>
                                        </div>
                                        {tasks.filter(
                                          (task) =>
                                            task.created_week ===
                                              report.week_number &&
                                            task.created_year === report.year,
                                        ).length === 0 ? (
                                          <p className="text-[11px] text-[var(--text-secondary)] text-center py-4">
                                            {t("reports.noTasksFound")}
                                          </p>
                                        ) : (
                                          <div className="overflow-hidden rounded-lg border border-[var(--border-primary)]">
                                            <div className="overflow-x-auto">
                                              <table className="w-full">
                                              <thead>
                                                <tr className="bg-primary border-b border-[var(--border-primary)]">
                                                  <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                                    {t("staff.table.task")}
                                                  </th>
                                                  <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                                    {t("staff.table.project")}
                                                  </th>
                                                  <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                                    {t("staff.table.due")}
                                                  </th>
                                                  <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                                    {t("staff.table.blockers")}
                                                  </th>
                                                  <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                                    {t("staff.table.status")}
                                                  </th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {(() => {
                                                  const weekTasks =
                                                    tasks.filter(
                                                      (task) =>
                                                        task.created_week ===
                                                          report.week_number &&
                                                        task.created_year ===
                                                          report.year,
                                                    );
                                                  const mainTasks =
                                                    weekTasks.filter(
                                                      (task) => !task.parent_task_id,
                                                    );
                                                  const subTasks =
                                                    weekTasks.filter(
                                                      (task) => task.parent_task_id,
                                                    );

                                                  const rowsToRender = [];
                                                  const renderedSubTaskIds =
                                                    new Set();

                                                  mainTasks.forEach(
                                                    (mainTask) => {
                                                      rowsToRender.push({
                                                        ...mainTask,
                                                        isSubtask: false,
                                                      });
                                                      const children =
                                                        subTasks.filter(
                                                          (subtask) =>
                                                            subtask.parent_task_id ===
                                                            mainTask.id,
                                                        );
                                                      children.forEach((subtask) => {
                                                        rowsToRender.push({
                                                          ...subtask,
                                                          isSubtask: true,
                                                        });
                                                        renderedSubTaskIds.add(
                                                          subtask.id,
                                                        );
                                                      });
                                                    },
                                                  );

                                                  // Catch any orphaned subtasks (parent not in this week)
                                                  subTasks.forEach((subtask) => {
                                                    if (
                                                      !renderedSubTaskIds.has(
                                                        subtask.id,
                                                      )
                                                    ) {
                                                      rowsToRender.push({
                                                        ...subtask,
                                                        isSubtask: true,
                                                        isOrphan: true,
                                                      });
                                                    }
                                                  });

                                                  return rowsToRender.map(
                                                    (task) => {
                                                      const statusConfig =
                                                        STATUS_CONFIG[
                                                          task.status
                                                        ] ||
                                                        STATUS_CONFIG.pending;
                                                      const activeBlockers = (
                                                        task.blockers || []
                                                      ).filter(
                                                        (blocker) =>
                                                          blocker.status === "active",
                                                      );
                                                      return (
                                                        <tr
                                                          key={task.id}
                                                          className={`border-b border-[var(--border-primary)]/40 hover:bg-primary/50 transition-colors ${
                                                            task.isSubtask &&
                                                            !task.isOrphan
                                                              ? "bg-tertiary/20"
                                                              : ""
                                                          }`}
                                                        >
                                                          <td
                                                            className={`px-3 py-2.5 ${task.isSubtask && !task.isOrphan ? "pl-8" : ""}`}
                                                          >
                                                            <div className="flex items-center gap-2">
                                                              {task.isSubtask && (
                                                                <CornerDownRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                                              )}
                                                              <div
                                                                className={`w-1.5 h-1.5 rounded-full ${statusConfig.color.replace("text-", "bg-")} shrink-0`}
                                                              />
                                                              <span
                                                                className="text-[12px] font-medium text-[var(--text-primary)] cursor-pointer hover:text-[var(--brand-orange)]"
                                                                onClick={() =>
                                                                  setTaskDetail(
                                                                    task,
                                                                  )
                                                                }
                                                              >
                                                                {task.title}
                                                              </span>
                                                              {task.priority &&
                                                                task.priority !==
                                                                  "medium" && (
                                                                  <span
                                                                    className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${
                                                                      task.priority ===
                                                                      "critical"
                                                                        ? "bg-red-500/10 text-red-400"
                                                                        : task.priority ===
                                                                            "high"
                                                                          ? "bg-amber-500/10 text-amber-400"
                                                                          : "bg-slate-500/10 text-slate-400"
                                                                    }`}
                                                                  >
                                                                    {
                                                                      task.priority
                                                                    }
                                                                  </span>
                                                                )}
                                                            </div>
                                                          </td>
                                                          <td className="px-3 py-2.5 text-[11px] text-[var(--text-secondary)]">
                                                            {task.project_id
                                                              ? assignedProjects.find(
                                                                  (project) =>
                                                                    String(
                                                                      project.id,
                                                                    ) ===
                                                                    String(
                                                                      task.project_id,
                                                                    ),
                                                                )?.name ||
                                                                t(
                                                                  "staff.table.projectFallback",
                                                                )
                                                              : task.category ||
                                                                "—"}
                                                          </td>
                                                          <td className="px-3 py-2.5 text-[11px] text-[var(--text-secondary)]">
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
                                                              <span className="text-[10px] text-[var(--text-secondary)]">
                                                                —
                                                              </span>
                                                            )}
                                                          </td>
                                                          <td className="px-3 py-2.5">
                                                            <span
                                                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusConfig.bg} ${statusConfig.color}`}
                                                            >
                                                              {t(
                                                                statusLabelKey(
                                                                  task.status,
                                                                ),
                                                              )}
                                                            </span>
                                                          </td>
                                                        </tr>
                                                      );
                                                    },
                                                  );
                                                })()}
                                              </tbody>
                                              </table>
                                            </div>
                                          </div>
                                        )}
                                        {(() => {
                                          const currentWeek = getCurrentWeek();
                                          const isPastWeek =
                                            report.week_number !==
                                              currentWeek.week ||
                                            report.year !== currentWeek.year;
                                          if (isPastWeek) return null;
                                          return (
                                            <div className="mt-3">
                                              <button
                                                onClick={() => {
                                                  setReadOnly(false);
                                                  setIsHistorical(false);
                                                  setWeekInfo({
                                                    week: report.week_number,
                                                    year: report.year,
                                                  });
                                                  setNewTaskForm((prev) => ({
                                                    ...prev,
                                                    name: "",
                                                    project_id: "",
                                                    start_date: "",
                                                    due_date: "",
                                                  }));
                                                  setTaskCreationOpen(true);
                                                }}
                                                className="w-full py-2 border border-dashed border-[var(--border-primary)] rounded-lg text-[10px] font-medium text-[var(--text-secondary)] hover:text-[var(--brand-orange)] hover:border-[var(--brand-orange)]/30 transition-all flex items-center justify-center gap-1.5"
                                              >
                                                <Plus className="w-3.5 h-3.5" />{" "}
                                                {t("reports.addTask")}
                                              </button>
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      {history.filter((entry) => entry.report_type === "standup")
                        .length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center">
                            <Target className="w-8 h-8 mx-auto mb-3 text-slate-500 opacity-30" />
                            <p className="text-[12px] font-medium text-[var(--text-secondary)] mb-1">
                              {t("staff.opReport.noStandupReports")}
                            </p>
                            <p className="text-[10px] text-[var(--text-secondary)] mb-4">
                              {tasks.length > 0
                                ? t("staff.opReport.hasTasksPrompt", {
                                    count: tasks.length,
                                  })
                                : t("staff.opReport.createFirstStandup")}
                            </p>
                            <button
                              onClick={() => {
                                const currentWeek = getCurrentWeek();
                                const isPastWeek =
                                  weekInfo.week !== currentWeek.week ||
                                  weekInfo.year !== currentWeek.year;
                                setReadOnly(isPastWeek);
                                setIsHistorical(isPastWeek);
                                openStandupModal();
                              }}
                              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--brand-orange)] text-black rounded-lg text-[10px] font-semibold hover:brightness-110 transition-all"
                            >
                              <>
                                <Plus className="w-4 h-4" />{" "}
                                {t("staff.opReport.createNewStandup")}
                              </>
                            </button>
                          </td>
                        </tr>
                      )}
                    </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : reportType === "retro" ? (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">
                    {t("reports.fridayRetro")}
                  </h2>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                    {t("staff.opReport.reviewCompletedWork")}
                  </p>
                </div>

                {/* Week history table */}
                <div className="overflow-hidden rounded-xl border border-[var(--border-primary)]">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                    <thead>
                      <tr className="bg-tertiary border-b border-[var(--border-primary)]">
                        <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                          {t("staff.table.week")}
                        </th>
                        <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                          {t("staff.table.totalTasks")}
                        </th>
                        <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                          {t("staff.table.completed")}
                        </th>
                        <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                          {t("staff.table.status")}
                        </th>
                        <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                          {t("staff.table.actions")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {history
                        .filter(
                          (entry) =>
                            entry.report_type === "standup" ||
                            entry.report_type === "retro",
                        )
                        .reduce((unique, entry) => {
                          if (
                            !unique.find(
                              (existingReport) =>
                                existingReport.week_number === entry.week_number &&
                                existingReport.year === entry.year,
                            )
                          )
                            unique.push(entry);
                          return unique;
                        }, [])
                        .map((report) => {
                          const weekKey =
                            report.week_number + "-" + report.year;
                          const weekTasks = tasks.filter(
                            (task) =>
                              task.created_week === report.week_number &&
                              task.created_year === report.year &&
                              !task.parent_task_id, // exclude sub-tasks (rendered inside parent)
                          );
                          const totalTasks = weekTasks.reduce(
                            (sum, task) =>
                              sum + 1 + (task.subtasks?.length || 0),
                            0,
                          );
                          const completed = weekTasks.reduce(
                            (sum, task) =>
                              sum +
                              (task.status === "completed" ? 1 : 0) +
                              (task.subtasks?.filter(
                                (subtask) => subtask.status === "completed",
                              ).length || 0),
                            0,
                          );
                          const isExpanded = expandedWeek === weekKey;
                          return (
                            <React.Fragment key={weekKey}>
                              <tr
                                key={weekKey}
                                className="border-b border-[var(--border-primary)]/50 hover:bg-tertiary/50 transition-colors"
                              >
                                <td className="px-4 py-3">
                                  <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                                    {t("staff.table.week")} {report.week_number}
                                  </span>
                                  <span className="text-[10px] font-medium text-[var(--text-secondary)] ml-2">
                                    {report.year}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-[12px] font-medium text-[var(--text-secondary)]">
                                  {totalTasks} {t("staff.table.tasks")}
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-[12px] font-medium text-emerald-400">
                                    {completed}/{totalTasks}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${completed === totalTasks && totalTasks > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}
                                  >
                                    {completed === totalTasks &&
                                    totalTasks > 0
                                      ? t("staff.opReport.complete")
                                      : t("staff.opReport.review")}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    onClick={() =>
                                      setExpandedWeek((prev) =>
                                        prev === weekKey ? null : weekKey,
                                      )
                                    }
                                    className="text-[11px] font-medium text-[var(--brand-orange)] hover:underline flex items-center gap-1 ml-auto"
                                  >
                                    {isExpanded
                                      ? t("common.collapse")
                                      : t("common.view")}
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
                                        <p className="text-[11px] text-[var(--text-secondary)] text-center py-4">
                                          {t("reports.noTasksFound")}
                                        </p>
                                      ) : (
                                        <div className="overflow-hidden rounded-lg border border-[var(--border-primary)]">
                                          <div className="overflow-x-auto">
                                          <table className="w-full">
                                            <thead>
                                              <tr className="bg-primary border-b border-[var(--border-primary)]">
                                                <th className="w-10 px-3 py-2 text-center text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                                  {t("staff.opReport.done")}
                                                </th>
                                                <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                                  {t("staff.table.task")}
                                                </th>
                                                <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                                  {t("staff.table.project")}
                                                </th>
                                                <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                                  {t("staff.table.due")}
                                                </th>
                                                <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                                  {t("staff.table.blockers")}
                                                </th>
                                                <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                                  {t("staff.table.status")}
                                                </th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {weekTasks
                                                .sort((first, second) => {
                                                  if (
                                                    first.status === "completed" &&
                                                    second.status !== "completed"
                                                  )
                                                    return 1;
                                                  if (
                                                    first.status !== "completed" &&
                                                    second.status === "completed"
                                                  )
                                                    return -1;

                                                  const firstCarryover =
                                                    first.carried_over_from_task_id !==
                                                      null ||
                                                    first.status === "carried_over";
                                                  const secondCarryover =
                                                    second.carried_over_from_task_id !==
                                                      null ||
                                                    second.status === "carried_over";
                                                  if (firstCarryover && !secondCarryover)
                                                    return -1;
                                                  if (!firstCarryover && secondCarryover)
                                                    return 1;

                                                  return (
                                                    new Date(
                                                      first.created_at,
                                                    ).getTime() -
                                                    new Date(
                                                      second.created_at,
                                                    ).getTime()
                                                  );
                                                })
                                                .map((task) => {
                                                  const activeBlockers = (
                                                    task.blockers || []
                                                  ).filter(
                                                    (blocker) =>
                                                      blocker.status === "active",
                                                  );
                                                  return (
                                                    <tr
                                                      key={task.id}
                                                      className="border-b border-[var(--border-primary)]/40 hover:bg-primary/50 transition-colors"
                                                    >
                                                      <td className="px-3 py-2.5 text-center">
                                                        <button
                                                          onClick={async () => {
                                                            if (
                                                              updatingTasks[
                                                                task.id
                                                              ]
                                                            )
                                                              return;
                                                            setUpdatingTasks(
                                                              (prev) => ({
                                                                ...prev,
                                                                [task.id]: true,
                                                              }),
                                                            );
                                                            try {
                                                              const newStatus =
                                                                task.status ===
                                                                "completed"
                                                                  ? "in_progress"
                                                                  : "completed";
                                                              let blocked = false;
                                                              // If completing parent, cascade to all sub-tasks
                                                              if (
                                                                newStatus ===
                                                                  "completed" &&
                                                                task.subtasks
                                                                  ?.length > 0
                                                              ) {
                                                                const subtaskResults =
                                                                  await Promise.all(
                                                                    task.subtasks.map(
                                                                      async (
                                                                        subtask,
                                                                      ) => {
                                                                        const response =
                                                                          await fetch(
                                                                            "/api/tasks",
                                                                            {
                                                                              method:
                                                                                "PUT",
                                                                              headers:
                                                                                {
                                                                                  "Content-Type":
                                                                                    "application/json",
                                                                                },
                                                                              body: JSON.stringify(
                                                                                {
                                                                                  id: subtask.id,
                                                                                  status:
                                                                                    "completed",
                                                                                },
                                                                              ),
                                                                            },
                                                                          );
                                                                        return {
                                                                          subtaskId:
                                                                            subtask.id,
                                                                          data: await response.json(),
                                                                        };
                                                                      },
                                                                    ),
                                                                  );
                                                                const blockedSubtasks =
                                                                  subtaskResults.filter(
                                                                    (result) =>
                                                                      result.data
                                                                        ?.hasActiveBlockers,
                                                                  );
                                                                if (
                                                                  blockedSubtasks.length >
                                                                  0
                                                                ) {
                                                                  blocked = true;
                                                                  notify(
                                                                    t(
                                                                      "staff.opReport.blockerActive",
                                                                    ),
                                                                    "error",
                                                                  );
                                                                }
                                                              }
                                                              if (!blocked) {
                                                                const response =
                                                                  await fetch(
                                                                    "/api/tasks",
                                                                    {
                                                                      method:
                                                                        "PUT",
                                                                      headers: {
                                                                        "Content-Type":
                                                                          "application/json",
                                                                      },
                                                                      body: JSON.stringify(
                                                                        {
                                                                          id: task.id,
                                                                          status:
                                                                            newStatus,
                                                                        },
                                                                      ),
                                                                    },
                                                                  );
                                                                const data =
                                                                  await response.json();
                                                                if (
                                                                  data.success ===
                                                                    false &&
                                                                  data.hasActiveBlockers
                                                                ) {
                                                                  notify(
                                                                    t(
                                                                      "staff.opReport.blockerActive",
                                                                    ),
                                                                    "error",
                                                                  );
                                                                } else {
                                                                  refreshTasks();
                                                                }
                                                              }
                                                            } catch (error) {
                                                              console.error(error);
                                                            } finally {
                                                              setUpdatingTasks(
                                                                (prev) => ({
                                                                  ...prev,
                                                                  [task.id]: false,
                                                                }),
                                                              );
                                                            }
                                                          }}
                                                          disabled={
                                                            updatingTasks[
                                                              task.id
                                                            ]
                                                          }
                                                          className={`w-4 h-4 rounded-full border-2 mx-auto cursor-pointer transition-all hover:scale-110 ${task.status === "completed" ? "bg-emerald-500 border-emerald-500" : "border-slate-600 hover:border-emerald-400"} ${updatingTasks[task.id] ? "opacity-50 animate-pulse" : ""}`}
                                                        >
                                                          {task.status ===
                                                            "completed" && (
                                                            <CheckCircle2 className="w-3 h-3 text-white" />
                                                          )}
                                                        </button>
                                                      </td>
                                                      <td className="px-3 py-2.5">
                                                        <div>
                                                          <button
                                                            onClick={() => {
                                                              if (
                                                                task.subtasks
                                                                  ?.length > 0
                                                              ) {
                                                                setExpandedTasks(
                                                                  (prev) => ({
                                                                    ...prev,
                                                                    [task.id]:
                                                                      !prev[
                                                                        task.id
                                                                      ],
                                                                  }),
                                                                );
                                                              }
                                                            }}
                                                            className={`flex items-center gap-1.5 text-left ${task.subtasks?.length > 0 ? "cursor-pointer hover:text-[var(--brand-orange)]" : ""}`}
                                                          >
                                                            <span
                                                              className={`text-[11px] font-medium ${task.status === "completed" ? "line-through text-[var(--text-secondary)]" : "text-[var(--text-primary)]"}`}
                                                            >
                                                              {task.title}
                                                            </span>
                                                            {task.priority &&
                                                              task.priority !==
                                                                "medium" && (
                                                                <span
                                                                  className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${
                                                                    task.priority ===
                                                                    "critical"
                                                                      ? "bg-red-500/10 text-red-400"
                                                                      : task.priority ===
                                                                          "high"
                                                                        ? "bg-amber-500/10 text-amber-400"
                                                                        : "bg-slate-500/10 text-slate-400"
                                                                  }`}
                                                                >
                                                                  {
                                                                    task.priority
                                                                  }
                                                                </span>
                                                              )}
                                                            {(task.carried_over_from_task_id !==
                                                              null ||
                                                              task.status ===
                                                                "carried_over") && (
                                                              <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded ml-2">
                                                                <Shield className="w-2.5 h-2.5" />{" "}
                                                                Carryover
                                                              </span>
                                                            )}
                                                            {task.subtasks
                                                              ?.length > 0 && (
                                                              <span
                                                                className={`text-[8px] transition-transform ${expandedTasks[task.id] ? "rotate-180" : ""}`}
                                                              >
                                                                ▼
                                                              </span>
                                                            )}
                                                          </button>
                                                          {/* Expanded sub-tasks */}
                                                          {expandedTasks[
                                                            task.id
                                                          ] &&
                                                            task.subtasks
                                                              ?.length > 0 && (
                                                              <div className="mt-2 ml-3 pl-3 border-l-2 border-indigo-500/30 space-y-1">
                                                                {task.subtasks.map(
                                                                  (subtask) => (
                                                                    <div
                                                                      key={
                                                                        subtask.id
                                                                      }
                                                                      className="flex items-center gap-2 py-0.5"
                                                                    >
                                                                      <button
                                                                        onClick={async () => {
                                                                          if (
                                                                            updatingTasks[
                                                                              subtask
                                                                                .id
                                                                            ]
                                                                          )
                                                                            return;
                                                                          setUpdatingTasks(
                                                                            (
                                                                              prev,
                                                                            ) => ({
                                                                              ...prev,
                                                                              [subtask.id]: true,
                                                                            }),
                                                                          );
                                                                          try {
                                                                            const subtaskResponse =
                                                                              await fetch(
                                                                                "/api/tasks",
                                                                                {
                                                                                  method:
                                                                                    "PUT",
                                                                                  headers:
                                                                                    {
                                                                                      "Content-Type":
                                                                                        "application/json",
                                                                                    },
                                                                                  body: JSON.stringify(
                                                                                    {
                                                                                      id: subtask.id,
                                                                                      status:
                                                                                        subtask.status ===
                                                                                        "completed"
                                                                                          ? "in_progress"
                                                                                          : "completed",
                                                                                    },
                                                                                  ),
                                                                                },
                                                                              );
                                                                            const subtaskData =
                                                                              await subtaskResponse.json();
                                                                            if (
                                                                              subtaskData.success ===
                                                                                false &&
                                                                              subtaskData.hasActiveBlockers
                                                                            ) {
                                                                              notify(
                                                                                t(
                                                                                  "staff.opReport.blockerActive",
                                                                                ),
                                                                                "error",
                                                                              );
                                                                            } else {
                                                                              refreshTasks();
                                                                            }
                                                                          } catch (error) {
                                                                            console.error(
                                                                              error,
                                                                            );
                                                                          } finally {
                                                                            setUpdatingTasks(
                                                                              (
                                                                                prev,
                                                                              ) => ({
                                                                                ...prev,
                                                                                [subtask.id]: false,
                                                                              }),
                                                                            );
                                                                          }
                                                                        }}
                                                                        className={`w-3 h-3 rounded-full border-2 shrink-0 ${subtask.status === "completed" ? "bg-emerald-500 border-emerald-500" : "border-slate-600"}`}
                                                                      >
                                                                        {subtask.status ===
                                                                          "completed" && (
                                                                          <CheckCircle2 className="w-2 h-2 text-white" />
                                                                        )}
                                                                      </button>
                                                                      <span
                                                                        className={`text-[10px] ${subtask.status === "completed" ? "line-through text-[var(--text-secondary)]" : "text-[var(--text-primary)]"}`}
                                                                      >
                                                                        {
                                                                          subtask.title
                                                                        }
                                                                      </span>
                                                                      <span
                                                                        className={`text-[10px] font-bold uppercase px-1 py-0.5 rounded-full ${STATUS_CONFIG[subtask.status]?.bg || "bg-slate-500/10"} ${STATUS_CONFIG[subtask.status]?.color || "text-slate-400"}`}
                                                                      >
                                                                        {t(
                                                                          statusLabelKey(
                                                                            subtask.status,
                                                                          ),
                                                                        )}
                                                                      </span>
                                                                    </div>
                                                                  ),
                                                                )}
                                                              </div>
                                                            )}
                                                        </div>
                                                      </td>
                                                      <td className="px-3 py-2.5 text-[10px] text-[var(--text-secondary)]">
                                                        {task.project_id
                                                          ? assignedProjects.find(
                                                              (project) =>
                                                                String(project.id) ===
                                                                String(
                                                                  task.project_id,
                                                                ),
                                                            )?.name ||
                                                            t(
                                                              "staff.table.projectFallback",
                                                            )
                                                          : task.category ||
                                                            "—"}
                                                      </td>
                                                      <td className="px-3 py-2.5 text-[10px] text-[var(--text-secondary)]">
                                                        {formatDate(
                                                          task.end_date,
                                                        )}
                                                      </td>
                                                      <td className="px-3 py-2.5">
                                                        <button
                                                          onClick={() =>
                                                            setBlockerModal({
                                                              type: "api",
                                                              taskId: task.id,
                                                            })
                                                          }
                                                          className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/5 transition-all text-[10px] font-bold"
                                                        >
                                                          {activeBlockers.length > 0 ? (
                                                            <span className="text-rose-400 font-medium flex items-center gap-1">
                                                              <Shield className="w-3 h-3" />
                                                              {activeBlockers.length}{" "}
                                                              Blocker
                                                              {activeBlockers.length > 1
                                                                ? "s"
                                                                : ""}
                                                            </span>
                                                          ) : (
                                                            <span className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1">
                                                              <Shield className="w-3 h-3" />
                                                              Add Blocker
                                                            </span>
                                                          )}
                                                        </button>
                                                      </td>
                                                      <td className="px-3 py-2.5">
                                                        <select
                                                          value={
                                                            task.status ||
                                                            "pending"
                                                          }
                                                          onChange={async (
                                                            event,
                                                          ) => {
                                                            const newStatus =
                                                              event.target.value;
                                                            if (
                                                              updatingTasks[
                                                                task.id
                                                              ]
                                                            )
                                                              return;
                                                            setUpdatingTasks(
                                                              (prev) => ({
                                                                ...prev,
                                                                [task.id]: true,
                                                              }),
                                                            );
                                                            try {
                                                              await fetch(
                                                                "/api/tasks",
                                                                {
                                                                  method: "PUT",
                                                                  headers: {
                                                                    "Content-Type":
                                                                      "application/json",
                                                                  },
                                                                  body: JSON.stringify(
                                                                    {
                                                                      id: task.id,
                                                                      status:
                                                                        newStatus,
                                                                    },
                                                                  ),
                                                                },
                                                              );
                                                              refreshTasks();
                                                            } catch (err) {
                                                              console.error(
                                                                err,
                                                              );
                                                            } finally {
                                                              setUpdatingTasks(
                                                                (prev) => ({
                                                                  ...prev,
                                                                  [task.id]: false,
                                                                }),
                                                              );
                                                            }
                                                          }}
                                                          className={`text-[10px] font-bold px-1 py-0.5 rounded-full border-0 outline-none cursor-pointer appearance-none ${STATUS_CONFIG[task.status]?.bg || "bg-slate-500/10"} ${STATUS_CONFIG[task.status]?.color || "text-slate-400"}`}
                                                        >
                                                          <option
                                                            value="pending"
                                                            className="bg-primary text-slate-400"
                                                          >
                                                            Not Started
                                                          </option>
                                                          <option
                                                            value="in_progress"
                                                            className="bg-primary text-blue-400"
                                                          >
                                                            In Progress
                                                          </option>
                                                          <option
                                                            value="blocked"
                                                            className="bg-primary text-rose-400"
                                                          >
                                                            Blocked
                                                          </option>
                                                          <option
                                                            value="carried_over"
                                                            className="bg-primary text-amber-400"
                                                          >
                                                            Carried Over
                                                          </option>
                                                          <option
                                                            value="completed"
                                                            className="bg-primary text-emerald-400"
                                                          >
                                                            Completed
                                                          </option>
                                                        </select>
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
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      {history.filter(
                        (entry) =>
                          entry.report_type === "standup" ||
                          entry.report_type === "retro",
                      ).length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center">
                            <CheckCircle2 className="w-8 h-8 mx-auto mb-3 text-slate-500 opacity-30" />
                            <p className="text-[12px] font-medium text-[var(--text-secondary)]">
                              {t("staff.opReport.noWeeklyReports")}
                            </p>
                            <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                              {t("staff.opReport.retroRequiresStandup")}
                            </p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                {summaryLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="w-5 h-5 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" />
                    <span className="ml-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                      {t("common.loading")}
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
                        (task) => task.status === "completed",
                      ).length;
                      const carriedOver = summaryTasks.filter(
                        (task) => task.status === "carried_over",
                      ).length;
                      const blockersCreated = summaryBlockers.length;
                      const blockersResolved = summaryBlockers.filter(
                        (blocker) => blocker.status === "resolved",
                      ).length;
                      const activeBlockers = summaryBlockers.filter(
                        (blocker) => blocker.status === "active",
                      ).length;
                      const projectsCount = new Set(
                        summaryTasks
                          .filter((task) => task.project_id)
                          .map((task) => task.project_id),
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
                      const dateRange = `${formatLocaleDate(monday, { month: "short", day: "numeric" }, lang)} - ${formatLocaleDate(friday, { month: "short", day: "numeric" }, lang)}`;

                      return (
                        <div className="card p-5 space-y-4 border-[var(--brand-orange)]/20">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-lg font-black text-[var(--text-primary)]">
                                {t("staff.table.week")} {weekInfo.week}
                              </p>
                              <p className="text-[10px] text-[var(--text-secondary)]">
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
                              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                {t("staff.opReport.tasksPlanned")}
                              </p>
                            </div>
                            <div>
                              <p className="text-2xl font-black text-emerald-400">
                                {completed}
                              </p>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                {t("staff.table.completed")}
                              </p>
                            </div>
                            <div>
                              <p className="text-2xl font-black text-indigo-400">
                                {carriedOver}
                              </p>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                {t("staff.opReport.carriedOver")}
                              </p>
                            </div>
                            <div>
                              <p className="text-2xl font-black text-rose-400">
                                {activeBlockers}
                              </p>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                {t("staff.opReport.activeBlockers")}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-4 pt-2 border-t border-[var(--border-primary)]/30">
                            <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                              {t("staff.opReport.productivity")}:{" "}
                              <span className="font-bold text-emerald-400">
                                {planned > 0
                                  ? Math.round((completed / planned) * 100)
                                  : 0}
                                %
                              </span>
                            </span>
                            <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                              {t("staff.opReport.blockersCreated")}:{" "}
                              <span className="font-bold text-[var(--text-primary)]">
                                {blockersCreated}
                              </span>
                            </span>
                            <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                              {t("staff.opReport.blockersResolved")}:{" "}
                              <span className="font-bold text-emerald-400">
                                {blockersResolved}
                              </span>
                            </span>
                            <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                              {t("staff.opReport.projectsContributed")}:{" "}
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
                        {t("staff.section.tasksWorkedOn")}
                      </h3>
                      {summaryTasks.length === 0 ? (
                        <p className="text-sm text-[var(--text-secondary)] text-center py-8">
                          {t("reports.noTasksFound")}
                        </p>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)]">
                          <table className="w-full">
                            <thead>
                              <tr className="bg-tertiary border-b border-[var(--border-primary)]">
                                <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                  {t("staff.table.task")}
                                </th>
                                <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                  {t("staff.table.project")}
                                </th>
                                <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                  {t("staff.table.category")}
                                </th>
                                <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                  {t("time.created")}
                                </th>
                                <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                  {t("staff.table.due")}
                                </th>
                                <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                  {t("staff.table.status")}
                                </th>
                                <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                  {t("staff.table.collaborators")}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {summaryTasks.map((task) => {
                                const statusConfig =
                                  STATUS_CONFIG[task.status] ||
                                  STATUS_CONFIG.pending;
                                const projectName = summaryProjects.find(
                                  (project) =>
                                    String(project.id) === String(task.project_id),
                                )?.name;
                                return (
                                  <React.Fragment key={task.id}>
                                    <tr className="border-b border-[var(--border-primary)]/40 hover:bg-tertiary/30 transition-colors">
                                      <td className="px-3 py-2.5 text-[11px] font-bold text-[var(--text-primary)]">
                                        {task.title}
                                      </td>
                                      <td className="px-3 py-2.5 text-[10px] text-[var(--text-secondary)]">
                                        {projectName || "—"}
                                      </td>
                                      <td className="px-3 py-2.5 text-[10px] text-[var(--text-secondary)]">
                                        {task.category || "—"}
                                      </td>
                                      <td className="px-3 py-2.5 text-[10px] text-[var(--text-secondary)]">
                                        {formatDate(task.created_at)}
                                      </td>
                                      <td className="px-3 py-2.5 text-[10px] text-[var(--text-secondary)]">
                                        {formatDate(task.end_date)}
                                      </td>
                                      <td className="px-3 py-2.5">
                                        <span
                                          className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${statusConfig.bg} ${statusConfig.color}`}
                                        >
                                          {t(statusLabelKey(task.status))}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2.5 text-[10px] text-[var(--text-secondary)]">
                                        —
                                      </td>
                                    </tr>
                                    {/* Subtasks */}
                                    {task.subtasks?.length > 0 && (
                                      <tr className="bg-tertiary/30">
                                        <td colSpan={7} className="px-6 py-2">
                                          <div className="space-y-1">
                                            {task.subtasks.map((subtask) => {
                                              const subtaskStatusConfig =
                                                STATUS_CONFIG[subtask.status] ||
                                                STATUS_CONFIG.pending;
                                              return (
                                                <div
                                                  key={subtask.id}
                                                  className="flex items-center gap-2 text-[10px]"
                                                >
                                                  <span className="text-[var(--text-secondary)]">
                                                    ↳
                                                  </span>
                                                  <span className="font-medium text-[var(--text-primary)]">
                                                    {subtask.title}
                                                  </span>
                                                  <span
                                                    className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${subtaskStatusConfig.bg} ${subtaskStatusConfig.color}`}
                                                  >
                                                    {t(
                                                      statusLabelKey(
                                                        subtask.status,
                                                      ),
                                                    )}
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
                        {t("staff.section.projectContributions")}
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
                            <p className="text-sm text-[var(--text-secondary)] text-center py-8">
                              {t("staff.opReport.noProjectData")}
                            </p>
                          );
                        return entries.map(([key, projectTasks]) => {
                          const isProject = key.startsWith("project_");
                          const projectId = isProject
                            ? key.replace("project_", "")
                            : null;
                          const projectName = isProject
                            ? summaryProjects.find(
                                (project) => String(project.id) === String(projectId),
                              )?.name || t("staff.table.projectFallback")
                            : key.replace("category_", "");
                          const completedCount = projectTasks.filter(
                            (task) => task.status === "completed",
                          ).length;
                          const carriedCount = projectTasks.filter(
                            (task) => task.status === "carried_over",
                          ).length;
                          const activeBlockersCount = projectTasks.reduce(
                            (sum, task) =>
                              sum +
                              (task.blockers || []).filter(
                                (blocker) => blocker.status === "active",
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
                                  <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                                    {t("staff.opReport.tasksWorkedOnCount", {
                                      count: projectTasks.length,
                                    })}{" "}
                                    |{t("staff.table.completed")}:{" "}
                                    {completedCount} |{" "}
                                    {t("staff.opReport.carryOver")}:{" "}
                                    {carriedCount} | {t("staff.table.blockers")}
                                    : {activeBlockersCount}
                                  </p>
                                </div>
                                <ChevronDown
                                  className={`w-4 h-4 text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`}
                                />
                              </div>
                              {expanded && (
                                <div className="space-y-1.5 pt-2 border-t border-[var(--border-primary)]/30">
                                  {projectTasks.map((projTask) => {
                                    const statusConfig =
                                      STATUS_CONFIG[projTask.status] ||
                                      STATUS_CONFIG.pending;
                                    return (
                                      <div
                                        key={projTask.id}
                                        className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-tertiary/50"
                                      >
                                        <span className="text-[10px] font-medium text-[var(--text-primary)]">
                                          {projTask.title}
                                        </span>
                                        <span
                                          className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${statusConfig.bg} ${statusConfig.color}`}
                                        >
                                          {t(statusLabelKey(projTask.status))}
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
                        (task) =>
                          task.user_id &&
                          user?.cid &&
                          String(task.user_id) !== String(user.cid),
                      );
                      if (assignedTasks.length === 0) return null;
                      return (
                        <div className="space-y-3">
                          <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2">
                            <Users className="w-4 h-4 text-[var(--brand-orange)]" />
                            {t("staff.section.taskAssignments")}
                          </h3>
                          <div className="space-y-2">
                            {assignedTasks.map((task) => {
                              const statusConfig =
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
                                    <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                                      {t("staff.opReport.assignedBy")}{" "}
                                      {task.user_name || t("common.unknown")}{" "}
                                      {t("time.on")}{" "}
                                      {formatDate(task.created_at)}
                                    </p>
                                  </div>
                                  <span
                                    className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${statusConfig.bg} ${statusConfig.color}`}
                                  >
                                    {t(statusLabelKey(task.status))}
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
                        {t("staff.section.blockersSummary")}
                      </h3>
                      {summaryBlockers.length === 0 ? (
                        <p className="text-sm text-[var(--text-secondary)] text-center py-8">
                          {t("reports.noBlockersFound")}
                        </p>
                      ) : (
                        <>
                          {/* Resolved Blockers */}
                          {summaryBlockers.filter(
                            (blocker) => blocker.status === "resolved",
                          ).length > 0 && (
                            <div className="space-y-2">
                              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                                {t("staff.opReport.resolvedBlockers")}
                              </p>
                              <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)]">
                                <table className="w-full">
                                  <thead>
                                    <tr className="bg-tertiary">
                                      <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                        {t("staff.table.blocker")}
                                      </th>
                                      <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                        {t("staff.table.task")}
                                      </th>
                                      <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                        {t("time.created")}
                                      </th>
                                      <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                        {t("staff.table.resolved")}
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {summaryBlockers
                                      .filter((blocker) => blocker.status === "resolved")
                                      .map((blocker) => (
                                        <tr
                                          key={blocker.id}
                                          className="border-b border-[var(--border-primary)]/40"
                                        >
                                          <td className="px-3 py-2 text-[10px] font-bold text-emerald-400">
                                            {blocker.title}
                                          </td>
                                          <td className="px-3 py-2 text-[10px] text-[var(--text-secondary)]">
                                            {summaryTasks.find(
                                              (task) => task.id === blocker.task_id,
                                            )?.title ||
                                              t("staff.table.taskLabel") +
                                                " #" +
                                                blocker.task_id}
                                          </td>
                                          <td className="px-3 py-2 text-[10px] text-[var(--text-secondary)]">
                                            {formatDate(blocker.created_at)}
                                          </td>
                                          <td className="px-3 py-2 text-[10px] text-[var(--text-secondary)]">
                                            {formatDate(blocker.resolved_at)}
                                          </td>
                                        </tr>
                                      ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                          {/* Active Blockers */}
                          {summaryBlockers.filter((blocker) => blocker.status === "active")
                            .length > 0 && (
                            <div className="space-y-2">
                              <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">
                                {t("staff.opReport.activeBlockers")}
                              </p>
                              <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)]">
                                <table className="w-full">
                                  <thead>
                                    <tr className="bg-tertiary">
                                      <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                        {t("staff.table.blocker")}
                                      </th>
                                      <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                        {t("staff.table.task")}
                                      </th>
                                      <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                        {t("time.created")}
                                      </th>
                                      <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                        {t("staff.table.weeksOpen")}
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {summaryBlockers
                                      .filter((blocker) => blocker.status === "active")
                                      .map((blocker) => {
                                        const weeksOpen = Math.floor(
                                          (now -
                                            new Date(blocker.created_at).getTime()) /
                                            (7 * 24 * 60 * 60 * 1000),
                                        );
                                        return (
                                          <tr
                                            key={blocker.id}
                                            className={`border-b border-[var(--border-primary)]/40 ${weeksOpen > 2 ? "bg-rose-500/5" : ""}`}
                                          >
                                            <td className="px-3 py-2 text-[10px] font-bold text-rose-400">
                                              {blocker.title}
                                            </td>
                                            <td className="px-3 py-2 text-[10px] text-[var(--text-secondary)]">
                                              {summaryTasks.find(
                                                (task) => task.id === blocker.task_id,
                                              )?.title ||
                                                t("staff.table.taskLabel") +
                                                  " #" +
                                                  blocker.task_id}
                                            </td>
                                            <td className="px-3 py-2 text-[10px] text-[var(--text-secondary)]">
                                              {formatDate(blocker.created_at)}
                                            </td>
                                            <td className="px-3 py-2">
                                              <span
                                                className={`text-[10px] font-bold ${weeksOpen >= 3 ? "text-rose-400" : weeksOpen >= 2 ? "text-amber-400" : "text-[var(--text-secondary)]"}`}
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
                            {t("staff.section.collaborationOverview")}
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
                                <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                                  {t("staff.opReport.sharedTasks", {
                                    count: sharedTasks.length,
                                  })}
                                </span>
                              </div>
                              {summaryCollapsed[name] && (
                                <div className="mt-2 pt-2 border-t border-[var(--border-primary)]/30 space-y-1">
                                  {sharedTasks.map((task) => (
                                    <div
                                      key={task.id}
                                      className="flex justify-between text-[10px] py-0.5"
                                    >
                                      <span className="font-medium text-[var(--text-primary)]">
                                        {task.title}
                                      </span>
                                      <span className="text-[var(--text-secondary)]">
                                        {summaryProjects.find(
                                          (project) =>
                                            String(project.id) ===
                                            String(task.project_id),
                                        )?.name ||
                                          task.category ||
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
                        {t("staff.section.carryOverItems")}
                      </h3>
                      {(() => {
                        const carryOverTasks = summaryTasks.filter(
                          (task) =>
                            ["pending", "in_progress", "blocked"].includes(
                              task.status,
                            ),
                        );
                        if (carryOverTasks.length === 0)
                          return (
                            <p className="text-sm text-emerald-400 text-center py-8">
                              {t("staff.opReport.allCompleted")}
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
                                      <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                                        {t("staff.opReport.project")}:{" "}
                                        {summaryProjects.find(
                                          (project) =>
                                            String(project.id) ===
                                            String(task.project_id),
                                        )?.name || "—"}{" "}
                                        | {t("staff.table.due")}:{" "}
                                        {formatDate(task.end_date)}
                                      </p>
                                    </div>
                                    <div className="text-right shrink-0 ml-4">
                                      <p
                                        className={`text-lg font-black ${weeks >= 5 ? "text-rose-400" : weeks >= 3 ? "text-amber-400" : "text-[var(--text-primary)]"}`}
                                      >
                                        {weeks}
                                      </p>
                                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                        {t("staff.table.weeksOpen")}
                                      </p>
                                    </div>
                                  </div>
                                  {/* Reason not completed */}
                                  <div className="mt-2">
                                    <input
                                      type="text"
                                      value={taskReasons[task.id] || ""}
                                      onChange={(event) =>
                                        setTaskReasons((prev) => ({
                                          ...prev,
                                          [task.id]: event.target.value,
                                        }))
                                      }
                                      placeholder="Why wasn't this completed? e.g. Waiting for feedback, dependency blocked..."
                                      className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-medium text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--brand-orange)] transition-all"
                                    />
                                  </div>
                                  {weeks >= 3 && (
                                    <div
                                      className={`mt-2 text-[10px] font-bold uppercase tracking-wide ${weeks >= 5 ? "text-rose-400" : "text-amber-400"}`}
                                    >
                                      {weeks >= 5
                                        ? t("staff.opReport.criticalAttention")
                                        : t("staff.opReport.requiresAttention")}
                                    </div>
                                  )}
                                  {(task.blockers || []).filter(
                                    (blocker) => blocker.status === "active",
                                  ).length > 0 && (
                                    <div className="flex items-center gap-1 mt-2 text-rose-400 text-[10px]">
                                      <Shield className="w-3 h-3" />
                                      {
                                        (task.blockers || []).filter(
                                          (blocker) => blocker.status === "active",
                                        ).length
                                      }{" "}
                                      {t("staff.opReport.activeBlockersCount")}
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
                        (project) => project.member_role === "lead",
                      );
                      if (ownedProjects.length === 0) return null;
                      return (
                        <div className="space-y-3">
                          <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2">
                            <Briefcase className="w-4 h-4 text-[var(--brand-orange)]" />
                            {t("staff.section.projectsIOwn")}
                          </h3>
                          {ownedProjects.map((project) => {
                            const projectTasks = summaryTasks.filter(
                              (task) =>
                                String(task.project_id) === String(project.id),
                            );
                            const completed = projectTasks.filter(
                              (task) => task.status === "completed",
                            ).length;
                            const active = projectTasks.filter(
                              (task) =>
                                task.status === "in_progress" ||
                                task.status === "blocked",
                            ).length;
                            const carried = projectTasks.filter(
                              (task) => task.status === "carried_over",
                            ).length;
                            const blockerCount = projectTasks.reduce(
                              (sum, task) =>
                                sum +
                                (task.blockers || []).filter(
                                  (blocker) => blocker.status === "active",
                                ).length,
                              0,
                            );
                            const collaborators = new Set(
                              projectTasks
                                .map((task) => task.user_name)
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
                            // healthLabels used via t() inline
                            return (
                              <div key={project.id} className="card p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <p className="text-xs font-bold text-[var(--text-primary)]">
                                    {project.name}
                                  </p>
                                  <span
                                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${healthColors[health]}`}
                                  >
                                    {health === "on_track"
                                      ? t("status.onTrack")
                                      : health === "at_risk"
                                        ? t("status.atRisk")
                                        : t("status.blocked")}
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[10px]">
                                  <div>
                                    <span className="font-bold text-emerald-400">
                                      {completed}
                                    </span>{" "}
                                    <span className="text-[var(--text-secondary)]">
                                      {t("status.completed")}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="font-bold text-blue-400">
                                      {active}
                                    </span>{" "}
                                    <span className="text-[var(--text-secondary)]">
                                      {t("status.active")}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="font-bold text-indigo-400">
                                      {carried}
                                    </span>{" "}
                                    <span className="text-[var(--text-secondary)]">
                                      {t("status.carriedOver")}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="font-bold text-rose-400">
                                      {blockerCount}
                                    </span>{" "}
                                    <span className="text-[var(--text-secondary)]">
                                      {t("staff.table.blockers")}
                                    </span>
                                  </div>
                                </div>
                                {collaborators.size > 0 && (
                                  <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-2">
                                    {t("staff.table.collaborators")}:{" "}
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
                      summaryBlockers.forEach((blocker) => {
                        const day = blocker.created_at?.split("T")[0];
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
                        if (blocker.status === "resolved" && blocker.resolved_at) {
                          const resolvedDay = blocker.resolved_at?.split("T")[0];
                          if (resolvedDay) {
                            if (!timeline[resolvedDay])
                              timeline[resolvedDay] = {
                                created: 0,
                                completed: 0,
                                blockerAdded: 0,
                                blockerResolved: 0,
                              };
                            timeline[resolvedDay].blockerResolved =
                              (timeline[resolvedDay].blockerResolved || 0) + 1;
                          }
                        }
                      });
                      const sortedDays = Object.keys(timeline).sort();
                      if (sortedDays.length === 0) return null;
                      return (
                        <div className="space-y-3">
                          <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2">
                            <Activity className="w-4 h-4 text-[var(--brand-orange)]" />
                            {t("staff.section.weeklyActivityTimeline")}
                          </h3>
                          <div className="space-y-3">
                            {sortedDays.map((day) => {
                              const dayStats = timeline[day];
                              const events = [];
                              if (dayStats.created > 0)
                                events.push(
                                  t("staff.opReport.tasksCreated", {
                                    count: dayStats.created,
                                  }),
                                );
                              if (dayStats.completed > 0)
                                events.push(
                                  t("staff.opReport.tasksCompleted", {
                                    count: dayStats.completed,
                                  }),
                                );
                              if (dayStats.blockerAdded > 0)
                                events.push(
                                  t("staff.opReport.blockersAdded", {
                                    count: dayStats.blockerAdded,
                                  }),
                                );
                              if (dayStats.blockerResolved > 0)
                                events.push(
                                  t("staff.opReport.blockersResolved", {
                                    count: dayStats.blockerResolved,
                                  }),
                                );
                              const dayLabel = formatLocaleDate(
                                day + "T00:00:00",
                                { weekday: "long", month: "long", day: "numeric" },
                                lang,
                              );
                              return (
                                <div key={day} className="flex gap-3">
                                  <div className="w-2 h-2 rounded-full bg-[var(--brand-orange)] mt-1.5 shrink-0" />
                                  <div>
                                    <p className="text-[10px] text-[var(--text-secondary)]">
                                      {dayLabel}
                                    </p>
                                    {events.map((event, index) => (
                                      <p
                                        key={index}
                                        className="text-xs font-bold text-[var(--text-primary)]"
                                      >
                                        {event}
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
      {taskCreationOpen && (
        <div
          className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          onClick={() => setTaskCreationOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-secondary border border-[var(--border-primary)] rounded-xl p-6 space-y-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-[var(--brand-orange)]" />
                <span className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)]">
                  {t("staff.opReport.newTask")}
                </span>
              </div>
              <button onClick={() => setTaskCreationOpen(false)}>
                <X className="w-5 h-5 text-[var(--text-secondary)]" />
              </button>
            </div>

            <div className="space-y-2">
              <input
                type="text"
                value={newTaskForm.name}
                onChange={(event) =>
                  setNewTaskForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder={t("staff.opReport.taskNamePlaceholder")}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
                autoFocus
              />
              <select
                value={newTaskForm.project_id}
                onChange={(event) =>
                  setNewTaskForm((prev) => ({ ...prev, project_id: event.target.value }))
                }
                className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[11px] font-bold text-[var(--text-primary)] outline-none"
              >
                <option value="">{t("common.none")}</option>
                {(assignedProjects || []).map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={newTaskForm.start_date}
                  onChange={(event) =>
                    setNewTaskForm((prev) => ({
                      ...prev,
                      start_date: event.target.value,
                    }))
                  }
                  className="bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[11px] font-bold text-[var(--text-primary)] outline-none"
                />
                <input
                  type="date"
                  value={newTaskForm.due_date}
                  onChange={(event) =>
                    setNewTaskForm((prev) => ({
                      ...prev,
                      due_date: event.target.value,
                    }))
                  }
                  className="bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[11px] font-bold text-[var(--text-primary)] outline-none"
                />
              </div>
              <button
                onClick={handleCreateNewTask}
                disabled={!newTaskForm.name.trim() || creatingTask}
                className="w-full px-4 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-sm font-bold uppercase tracking-wide disabled:opacity-40 hover:brightness-110 transition-all"
              >
                {creatingTask ? t("common.saving") : t("reports.addTask")}
              </button>
            </div>
          </div>
        </div>
      )}
      {showStandupModal && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          onClick={() => {
            setShowStandupModal(false);
            setReadOnly(false);
            setIsHistorical(false);
          }}
        >
          <div
            className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-secondary border border-[var(--border-primary)] rounded-2xl shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 bg-primary border-b border-[var(--border-primary)]">
              <div className="flex items-center justify-between px-6 py-4">
                <div>
                  <h2 className="text-base font-bold text-[var(--text-primary)]">
                    {t("staff.opReport.standupWeek")} {weekInfo.week}
                  </h2>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                    {weekInfo.year}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowStandupModal(false);
                    setReadOnly(false);
                    setIsHistorical(false);
                  }}
                  className="p-1.5 hover:bg-tertiary rounded-md transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="px-6 py-4 space-y-6">
              {isHistorical && (
                <div className="px-4 py-3 rounded-lg border border-amber-500/30 bg-[var(--bg-tertiary)] text-[12px] text-[var(--text-primary)] leading-relaxed flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <span>
                    {t("staff.opReport.lockedWeek")}
                  </span>
                </div>
              )}
              {/* Draft Recovery Banner */}
              {draftAvailable && !isHistorical && (
                <div className="px-4 py-3 rounded-lg border border-[var(--brand-orange)]/40 bg-[var(--brand-orange)]/10 flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Clock className="w-4 h-4 shrink-0 mt-0.5 text-[var(--brand-orange)]" />
                    <span className="text-[12px] text-[var(--text-primary)] leading-relaxed font-medium">
                      {t("staff.opReport.draftPrompt")}
                    </span>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={discardDraft}
                      className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--text-tertiary)] hover:text-[var(--text-primary)] border border-slate-600 rounded-lg hover:border-slate-400 transition-all"
                    >
                      {t("staff.opReport.discard")}
                    </button>
                    <button
                      onClick={restoreDraft}
                      className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-[var(--brand-orange)] text-black rounded-lg hover:brightness-110 transition-all"
                    >
                      {t("staff.opReport.restoreDraft")}
                    </button>
                  </div>
                </div>
              )}
              {/* Section 2 — Weekly Focus */}
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)] mb-2 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5" />{" "}
                  {t("staff.opReport.weeklyFocus")}
                </h3>
                <TaskManager
                  mode="standup"
                  userId={user?.cid || user?.id}
                  userName={user?.name || ""}
                  projects={assignedProjects}
                  taskList={tasks}
                  onTasksChange={refreshTasks}
                  weekInfo={weekInfo}
                  showCarryOver={true}
                  readOnly={readOnly || isHistorical}
                  requestNewTask={newTaskRequest}
                />
              </div>

            </div>

            {/* Action Buttons */}
            {!readOnly && !isHistorical && (
              <div className="flex gap-3 pt-4 border-t border-[var(--border-primary)] sticky bottom-0 bg-primary px-6 py-4">
                <button
                  onClick={() => {
                    handleSubmit("submitted");
                    setShowStandupModal(false);
                  }}
                  disabled={saving}
                  className="flex-1 btn btn-primary gap-2 py-4"
                >
                  <Send className="w-4 h-4" />
                  {saving ? t("common.saving") : t("common.save")}
                </button>
              </div>
            )}
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
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-rose-400" />
                <span className="text-xs font-black uppercase tracking-wider text-rose-400">
                  {t("staff.table.blockers")}
                </span>
              </div>
              <button onClick={() => setBlockerModal(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-[10px] text-[var(--text-secondary)]">
              {t("staff.table.task")}:{" "}
              <span className="font-bold text-[var(--text-primary)]">
                {blockerModal.type === "api"
                  ? tasks.find((task) => task.id === blockerModal.taskId)?.title ||
                    t("staff.table.task")
                  : taskRows[blockerModal]?.name || t("common.untitled")}
              </span>
            </p>

            {/* Existing blockers */}
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {(() => {
                const blockers =
                  blockerModal.type === "api"
                    ? tasks.find((task) => task.id === blockerModal.taskId)
                        ?.blockers || []
                    : taskRows[blockerModal]?.blockers || [];
                return blockers.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)] text-center py-4">
                    {t("staff.opReport.noBlockersDeclared")}
                  </p>
                ) : (
                  blockers.map((blocker) => (
                    <div
                      key={blocker.id}
                      className={`flex items-center justify-between p-2.5 rounded-lg border ${
                        blocker.status === "Resolved"
                          ? "border border-emerald-500/30 bg-emerald-500/[0.08]"
                          : "border border-rose-500/30 bg-rose-500/[0.08]"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[11px] font-bold text-[var(--text-primary)] truncate">
                            {blocker.title || blocker.description}
                          </p>
                          <span className="text-[10px] font-bold uppercase text-rose-500/60 shrink-0">
                            {blocker.severity || "medium"}
                          </span>
                        </div>
                        {blocker.description && blocker.description !== blocker.title && (
                          <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                            {blocker.description}
                          </p>
                        )}
                        {blocker.reference_url && (
                          <a
                            href={blocker.reference_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-blue-400 underline break-all"
                          >
                            {blocker.reference_url}
                          </a>
                        )}
                        {blocker.notes && (
                          <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                            {blocker.notes}
                          </p>
                        )}
                        {blocker.resolved_at && (
                          <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                            Resolved{" "}
                            {new Date(blocker.resolved_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      {blocker.status?.toLowerCase() === "active" ? (
                        <button
                          onClick={async () => {
                            if (blockerModal.type === "api") {
                              await fetch("/api/blockers", {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  id: blocker.id,
                                  user_id: user?.cid || user?.id,
                                  status: "resolved",
                                  resolved_by: user?.cid || user?.id,
                                }),
                              });
                              refreshTasks();
                            } else {
                              resolveBlocker(blockerModal, blocker.id);
                            }
                            setBlockerModal(null);
                          }}
                          className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide bg-rose-500/10 text-rose-400 rounded-lg hover:bg-rose-500 hover:text-white transition-all shrink-0"
                        >
                          {t("staff.opReport.resolve")}
                        </button>
                      ) : (
                        <span className="px-2.5 py-1 text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 rounded-lg">
                          {t("staff.opReport.resolved")}
                        </span>
                      )}
                    </div>
                  ))
                );
              })()}
            </div>

            {/* Add new blocker — blocked if task is closed */}
            {(() => {
              const taskStatus =
                blockerModal.type === "api"
                  ? tasks.find((task) => task.id === blockerModal.taskId)?.status
                  : null;
              const closedStatuses = ["completed", "archived", "carried_over"];
              const isClosed =
                taskStatus && closedStatuses.includes(taskStatus);

              if (isClosed) {
                return (
                  <p className="text-[10px] text-rose-400 text-center py-2">
                    Cannot add blockers — this task is {taskStatus}.
                  </p>
                );
              }

              return (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newBlockerTitle}
                    onChange={(event) => setNewBlockerTitle(event.target.value)}
                    placeholder={t("staff.opReport.blockerTitlePlaceholder")}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs outline-none font-bold text-[var(--text-primary)] focus:border-rose-500 transition-all"
                  />
                  <textarea
                    value={newBlockerDescription}
                    onChange={(event) => setNewBlockerDescription(event.target.value)}
                    placeholder={t(
                      "staff.opReport.blockerDescriptionPlaceholder",
                    )}
                    rows={2}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] outline-none text-[var(--text-primary)] focus:border-rose-500 transition-all resize-none"
                  />
                  <div className="flex gap-2">
                    <select
                      value={newBlockerPriority}
                      onChange={(event) => setNewBlockerPriority(event.target.value)}
                      className="flex-1 bg-primary border border-[var(--border-primary)] rounded-lg px-2 py-2 text-[10px] font-bold outline-none text-[var(--text-primary)]"
                    >
                      <option value="low">
                        {t("staff.opReport.priorityLow")}
                      </option>
                      <option value="medium">
                        {t("staff.opReport.priorityMedium")}
                      </option>
                      <option value="high">
                        {t("staff.opReport.priorityHigh")}
                      </option>
                      <option value="critical">
                        {t("staff.opReport.priorityCritical")}
                      </option>
                    </select>
                    <input
                      type="url"
                      value={newBlockerRefUrl}
                      onChange={(event) => setNewBlockerRefUrl(event.target.value)}
                      placeholder={t(
                        "staff.opReport.blockerReferenceUrlPlaceholder",
                      )}
                      className="flex-[2] bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] outline-none text-[var(--text-primary)] focus:border-rose-500 transition-all"
                    />
                  </div>
                  <textarea
                    value={newBlockerNotes}
                    onChange={(event) => setNewBlockerNotes(event.target.value)}
                    placeholder={t("staff.opReport.blockerNotesPlaceholder")}
                    rows={2}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] outline-none text-[var(--text-primary)] focus:border-rose-500 transition-all resize-none"
                  />
                  <button
                    onClick={async () => {
                      if (!newBlockerTitle.trim()) return;
                      const payload = {
                        task_id: blockerModal.taskId,
                        user_id: user?.cid || user?.id,
                        user_name: user?.name || "",
                        title: newBlockerTitle.trim(),
                        description: newBlockerDescription.trim() || null,
                        severity: newBlockerPriority,
                        reference_url: newBlockerRefUrl.trim() || null,
                        notes: newBlockerNotes.trim() || null,
                      };
                      if (blockerModal.type === "api") {
                        await fetch("/api/blockers", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(payload),
                        });
                        setNewBlockerTitle("");
                        setNewBlockerDescription("");
                        setNewBlockerPriority("medium");
                        setNewBlockerRefUrl("");
                        setNewBlockerNotes("");
                        refreshTasks();
                      } else {
                        addBlockerToRow(blockerModal, newBlockerTitle.trim());
                        setNewBlockerTitle("");
                        setNewBlockerDescription("");
                        setNewBlockerPriority("medium");
                        setNewBlockerRefUrl("");
                        setNewBlockerNotes("");
                      }
                    }}
                    disabled={!newBlockerTitle.trim()}
                    className="w-full px-3 py-2 bg-rose-500 text-black rounded-lg text-sm font-bold uppercase tracking-wide hover:brightness-110 transition-all disabled:opacity-30"
                  >
                    {t("staff.opReport.addBlockerButton")}
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      <TaskDetailModal task={taskDetail} onClose={() => setTaskDetail(null)} />

      {/* Confirm Dialog */}
      {confirmTarget && (
        <div className="fixed inset-0 z-[500] bg-black/40 flex items-center justify-center p-6" onClick={() => setConfirmTarget(null)}>
          <div className="card w-full max-w-sm space-y-6" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight">Confirm Action</h3>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{confirmTarget.message}</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmTarget(null)} className="px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all">Cancel</button>
              <button onClick={() => { confirmTarget.onConfirm(); setConfirmTarget(null); }} className="px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wide bg-rose-500 text-white hover:bg-rose-600 transition-all">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function StaffOpReportPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <StaffOpReport />
    </Suspense>
  );
}

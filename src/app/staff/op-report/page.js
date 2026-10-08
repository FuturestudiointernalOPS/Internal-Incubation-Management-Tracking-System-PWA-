"use client";
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  Suspense,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import {
  getWeekNumber,
  getCurrentWeek,
} from "@/components/staff/op-report/dates";
import { useSessionUser } from "@/lib/hooks/useSessionUser";
import { useApi, useApiMulti } from "@/lib/hooks/useApi";
import ReportHeader from "@/components/staff/op-report/ReportHeader";
import ReportTypeToggle from "@/components/staff/op-report/ReportTypeToggle";
import WeeklyOverview from "@/components/staff/op-report/WeeklyOverview";
import StandupFormHeader from "@/components/staff/op-report/StandupFormHeader";
import StandupHistoryTable from "@/components/staff/op-report/StandupHistoryTable";
import RetroHistoryTable from "@/components/staff/op-report/RetroHistoryTable";
import SummaryWeekCard from "@/components/staff/op-report/SummaryWeekCard";
import SummaryTasksTable from "@/components/staff/op-report/SummaryTasksTable";
import SummaryProjectsCard from "@/components/staff/op-report/SummaryProjectsCard";
import SummaryAssignmentsCard from "@/components/staff/op-report/SummaryAssignmentsCard";
import SummaryBlockersCard from "@/components/staff/op-report/SummaryBlockersCard";
import SummaryCollaborationCard from "@/components/staff/op-report/SummaryCollaborationCard";
import SummaryCarryoverCard from "@/components/staff/op-report/SummaryCarryoverCard";
import SummaryOwnerCard from "@/components/staff/op-report/SummaryOwnerCard";
import SummaryTimelineCard from "@/components/staff/op-report/SummaryTimelineCard";
import TaskCreationModal from "@/components/staff/op-report/TaskCreationModal";
import StandupDraftModal from "@/components/staff/op-report/StandupDraftModal";
import BlockerModal from "@/components/staff/op-report/BlockerModal";
import ConfirmDialog from "@/components/staff/op-report/ConfirmDialog";
import TaskDetailModal from "@/components/ui/TaskDetailModal";

/**
 * STAFF OPERATIONAL REPORT PAGE
 *
 * Team members submit weekly stand-up (Monday) and retro (Friday) reports.
 * Each user sees only their own report history.
 */

/** The tabs, as the address may name them. Anything else means the first one. */
const REPORT_TABS = ["standup", "retro", "summary"];

// ─── Module-scope readers ────────────────────────────────────────────────────
// The reading hook keys its internal work on these, so they are made once here
// rather than rebuilt on every render.

const EMPTY_LIST = [];
const pickList = (field) => (payload) =>
  payload?.success ? payload[field] || [] : [];

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
          report.has_dependencies != null
            ? Boolean(report.has_dependencies)
            : null,
        dependency_note: report.dependency_note || "",
        has_blockers:
          report.has_blockers != null ? Boolean(report.has_blockers) : null,
        blocker_description: report.blocker_description || "",
        needs_support:
          report.needs_support != null ? Boolean(report.needs_support) : null,
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
  const all = [
    ...(payload.owned || []),
    ...(payload.collab || []),
    ...(payload.all_active || []),
  ];
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
    .map((contact) => ({
      id: contact.cid || contact.id,
      name: contact.name,
      email: contact.email,
    }))
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
    if (typeof form[field] === "string" && form[field].trim() !== "")
      return true;
  }

  return false;
}

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
  const { data: taskAnswers, refresh: refreshTasks } =
    useApiMulti(taskEndpoints);
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
  useApi("/api/contacts", {
    defaultValue: EMPTY_LIST,
    transform: pickStudioStaff,
  });

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
    () =>
      reportRead.answered ? reportToForm(reportRead.report) : INITIAL_FORM,
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
  }, [
    form,
    taskRows,
    user,
    saving,
    showStandupModal,
    reportType,
    showTaskForm,
    getDraftKey,
  ]);

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
        if (draft.showTaskForm !== undefined)
          setShowTaskForm(draft.showTaskForm);
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
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    }
    setDraftAvailable(false);
  }, [getDraftKey]);

  // Clear draft from localStorage (called on successful submit)
  const clearDraft = useCallback(() => {
    const key = getDraftKey();
    if (key) {
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
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
    {
      defaultValue: EMPTY_LIST,
      transform: pickList("tasks"),
      deps: [userCid, summaryOn, weekInfo.week, weekInfo.year],
    },
  );
  const { data: summaryBlockers, loading: summaryBlockersLoading } = useApi(
    summaryOn ? `/api/blockers?user_id=${userCid}` : null,
    {
      defaultValue: EMPTY_LIST,
      transform: pickList("blockers"),
      deps: [userCid, summaryOn],
    },
  );
  const { data: summaryProjects, loading: summaryProjectsLoading } = useApi(
    summaryOn ? `/api/projects/assignments?user_cid=${userCid}` : null,
    {
      defaultValue: EMPTY_LIST,
      transform: pickList("projects"),
      deps: [userCid, summaryOn],
    },
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
        notify(
          t(data.error || t("reports.failedToSave") || "") ||
            data.error ||
            t("reports.failedToSave"),
          "error",
        );
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
    setForm((prev) => ({
      ...prev,
      top_priorities: [...(prev.top_priorities || []), value],
    }));
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
        notify(data.error || t("errors.taskCreateFailed"), "error");
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
      setTaskRows((prev) =>
        prev.filter((_, currentIndex) => currentIndex !== index),
      );
      return;
    }
    setConfirmTarget({
      id: row.id,
      message: "Are you sure you want to archive this task?",
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
    setTaskRows((prev) =>
      prev.filter((_, currentIndex) => currentIndex !== index),
    );
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
  const handleOpenNewStandup = async () => {
    const currentWeek = getCurrentWeek();
    const isPastWeek =
      weekInfo.week !== currentWeek.week || weekInfo.year !== currentWeek.year;
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
      const response = await fetch(`/api/tasks?user_id=${userId}&sort=oldest`);
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
        const list = cloneIndex.get(task.carried_over_from_task_id) || [];
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
              (clone) => !["archived", "completed"].includes(clone.status),
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
          (task.created_week === curWeek && task.created_year === curYear)
        )
          continue;
        const head = latestOpenCopy(task);
        // Already carried into the current week — nothing to do.
        if (head.created_week === curWeek && head.created_year === curYear)
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
      console.error("Failed to fetch previous week tasks:", error);
    }
    setShowTaskForm(true);
  };

  const handleToggleStandupWeek = (report) => {
    const weekKey = `${report.week_number}-${report.year}`;
    setExpandedWeek((prev) => (prev === weekKey ? null : weekKey));
  };

  const handleOpenHistoricalWeek = (report) => {
    const currentWeek = getCurrentWeek();
    const isPastWeek =
      report.week_number !== currentWeek.week ||
      report.year !== currentWeek.year;
    setReadOnly(isPastWeek);
    setIsHistorical(isPastWeek);
    setWeekInfo({
      week: report.week_number,
      year: report.year,
    });
    // Load tasks for that week into taskRows
    const weekTasks = tasks.filter(
      (task) =>
        ["archived", "completed"].includes(task.status) && !task.parent_task_id,
    );
    const allTaskRows = [];
    for (const task of weekTasks) {
      allTaskRows.push({
        id: task.id,
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
        parent_task_id: task.parent_task_id || null,
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
            project_id: task.project_id || null,
            category: task.category || "",
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
  };

  const handleOpenTaskCreation = (report) => {
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
  };

  const handleOpenStandupModal = () => {
    const currentWeek = getCurrentWeek();
    const isPastWeek =
      weekInfo.week !== currentWeek.week || weekInfo.year !== currentWeek.year;
    setReadOnly(isPastWeek);
    setIsHistorical(isPastWeek);
    openStandupModal();
  };

  const handleToggleRetroWeek = (weekKey) =>
    setExpandedWeek((prev) => (prev === weekKey ? null : weekKey));

  const handleToggleRetroTask = async (task) => {
    if (updatingTasks[task.id]) return;
    setUpdatingTasks((prev) => ({
      ...prev,
      [task.id]: true,
    }));
    try {
      const newStatus =
        task.status === "completed" ? "in_progress" : "completed";
      let blocked = false;
      // If completing parent, cascade to all sub-tasks
      if (newStatus === "completed" && task.subtasks?.length > 0) {
        const subtaskResults = await Promise.all(
          task.subtasks.map(async (subtask) => {
            const response = await fetch("/api/tasks", {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                id: subtask.id,
                status: "completed",
              }),
            });
            return {
              subtaskId: subtask.id,
              data: await response.json(),
            };
          }),
        );
        const blockedSubtasks = subtaskResults.filter(
          (result) => result.data?.hasActiveBlockers,
        );
        if (blockedSubtasks.length > 0) {
          blocked = true;
          notify(t("staff.opReport.blockerActive"), "error");
        }
      }
      if (!blocked) {
        const response = await fetch("/api/tasks", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: task.id,
            status: newStatus,
          }),
        });
        const data = await response.json();
        if (data.success === false && data.hasActiveBlockers) {
          notify(t("staff.opReport.blockerActive"), "error");
        } else {
          refreshTasks();
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setUpdatingTasks((prev) => ({
        ...prev,
        [task.id]: false,
      }));
    }
  };

  const handleToggleRetroSubtasks = (task) => {
    if (task.subtasks?.length > 0) {
      setExpandedTasks((prev) => ({
        ...prev,
        [task.id]: !prev[task.id],
      }));
    }
  };

  const handleToggleRetroSubtask = async (subtask) => {
    if (updatingTasks[subtask.id]) return;
    setUpdatingTasks((prev) => ({
      ...prev,
      [subtask.id]: true,
    }));
    try {
      const subtaskResponse = await fetch("/api/tasks", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: subtask.id,
          status: subtask.status === "completed" ? "in_progress" : "completed",
        }),
      });
      const subtaskData = await subtaskResponse.json();
      if (subtaskData.success === false && subtaskData.hasActiveBlockers) {
        notify(t("staff.opReport.blockerActive"), "error");
      } else {
        refreshTasks();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setUpdatingTasks((prev) => ({
        ...prev,
        [subtask.id]: false,
      }));
    }
  };

  const handleOpenBlockerForTask = (task) =>
    setBlockerModal({
      type: "api",
      taskId: task.id,
    });

  const handleChangeRetroTaskStatus = async (task, event) => {
    const newStatus = event.target.value;
    if (updatingTasks[task.id]) return;
    setUpdatingTasks((prev) => ({
      ...prev,
      [task.id]: true,
    }));
    try {
      await fetch("/api/tasks", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: task.id,
          status: newStatus,
        }),
      });
      refreshTasks();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingTasks((prev) => ({
        ...prev,
        [task.id]: false,
      }));
    }
  };

  const handleCloseStandupModal = () => {
    setShowStandupModal(false);
    setReadOnly(false);
    setIsHistorical(false);
  };

  const handleSaveStandupFromModal = () => {
    handleSubmit("submitted");
    setShowStandupModal(false);
  };

  const handleResolveBlocker = async (blocker) => {
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
  };

  const handleAddBlockerFromModal = async () => {
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
  };

  const handleNewTaskFieldChange = (field, value) =>
    setNewTaskForm((prev) => ({ ...prev, [field]: value }));

  const handleToggleProject = (key) =>
    setSummaryProjectExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleSetTaskReason = (taskId, value) =>
    setTaskReasons((prev) => ({ ...prev, [taskId]: value }));

  const handleConfirmAction = () => {
    confirmTarget.onConfirm();
    setConfirmTarget(null);
  };

  return (
    <>
      <div className="stf space-y-6 pb-20 text-left">
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
        <ReportHeader
          onNavigateWeek={navigateWeek}
          reportType={reportType}
          weekInfo={weekInfo}
        />

        {/* REPORT TYPE TOGGLE */}
        <ReportTypeToggle
          onSelectType={setReportType}
          reportType={reportType}
        />

        <WeeklyOverview
          existingReport={existingReport}
          history={history}
          now={new Date(now)}
          reportType={reportType}
          weekInfo={weekInfo}
        />

        <div className="w-full">
          {/* REPORT FORM */}
          <div className="space-y-8">
            {reportType === "standup" ? (
              <div className="space-y-6">
                {/* Header */}
                <StandupFormHeader
                  history={history}
                  onOpenNewStandup={handleOpenNewStandup}
                  weekInfo={weekInfo}
                />

                {/* Standups Table */}
                <StandupHistoryTable
                  history={history}
                  assignedProjects={assignedProjects}
                  expandedWeek={expandedWeek}
                  onOpenHistoricalWeek={handleOpenHistoricalWeek}
                  onOpenStandup={handleOpenStandupModal}
                  onOpenTask={setTaskDetail}
                  onOpenTaskCreation={handleOpenTaskCreation}
                  onToggleStandupWeek={handleToggleStandupWeek}
                  tasks={tasks}
                />
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
                <RetroHistoryTable
                  history={history}
                  assignedProjects={assignedProjects}
                  expandedTasks={expandedTasks}
                  expandedWeek={expandedWeek}
                  onAddBlocker={handleOpenBlockerForTask}
                  onChangeTaskStatus={handleChangeRetroTaskStatus}
                  onToggleRetroWeek={handleToggleRetroWeek}
                  onToggleSubtask={handleToggleRetroSubtask}
                  onToggleSubtasks={handleToggleRetroSubtasks}
                  onToggleTask={handleToggleRetroTask}
                  tasks={tasks}
                  updatingTasks={updatingTasks}
                />
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
                    <SummaryWeekCard
                      lang={lang}
                      summaryBlockers={summaryBlockers}
                      summaryTasks={summaryTasks}
                      weekInfo={weekInfo}
                    />

                    {/* ═══════════════════════════════════ */}
                    {/* PHASE 2 — TASKS WORKED ON THIS WEEK */}
                    {/* ═══════════════════════════════════ */}
                    <SummaryTasksTable
                      summaryProjects={summaryProjects}
                      summaryTasks={summaryTasks}
                    />

                    {/* ═══════════════════════════════════ */}
                    {/* PHASE 3 — PROJECT CONTRIBUTIONS     */}
                    {/* ═══════════════════════════════════ */}
                    <SummaryProjectsCard
                      onToggleProject={handleToggleProject}
                      summaryProjectExpanded={summaryProjectExpanded}
                      summaryProjects={summaryProjects}
                      summaryTasks={summaryTasks}
                    />

                    {/* ═══════════════════════════════════ */}
                    {/* PHASE 4 — ASSIGNMENT HISTORY       */}
                    {/* ═══════════════════════════════════ */}
                    <SummaryAssignmentsCard
                      summaryTasks={summaryTasks}
                      user={user}
                    />

                    {/* ═══════════════════════════════════ */}
                    {/* PHASE 5 — BLOCKERS SUMMARY         */}
                    {/* ═══════════════════════════════════ */}
                    <SummaryBlockersCard
                      now={now}
                      summaryBlockers={summaryBlockers}
                      summaryTasks={summaryTasks}
                    />

                    {/* ═══════════════════════════════════ */}
                    {/* PHASE 6 — COLLABORATION OVERVIEW   */}
                    {/* ═══════════════════════════════════ */}
                    <SummaryCollaborationCard
                      summaryCollapsed={summaryCollapsed}
                      summaryProjects={summaryProjects}
                      summaryTasks={summaryTasks}
                      toggleSummaryCollapsed={toggleSummaryCollapsed}
                      user={user}
                    />

                    {/* ═══════════════════════════════════ */}
                    {/* PHASE 7 — CARRY-OVER INTELLIGENCE  */}
                    {/* ═══════════════════════════════════ */}
                    <SummaryCarryoverCard
                      onSetTaskReason={handleSetTaskReason}
                      summaryProjects={summaryProjects}
                      summaryTasks={summaryTasks}
                      taskReasons={taskReasons}
                    />

                    {/* ═══════════════════════════════════ */}
                    {/* PHASE 8 — PROJECT OWNER SUMMARY    */}
                    {/* ═══════════════════════════════════ */}
                    <SummaryOwnerCard
                      summaryProjects={summaryProjects}
                      summaryTasks={summaryTasks}
                    />

                    {/* ═══════════════════════════════════ */}
                    {/* PHASE 9 — WEEKLY ACTIVITY TIMELINE */}
                    {/* ═══════════════════════════════════ */}
                    <SummaryTimelineCard
                      lang={lang}
                      summaryBlockers={summaryBlockers}
                      summaryTasks={summaryTasks}
                    />
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {taskCreationOpen && (
        <TaskCreationModal
          assignedProjects={assignedProjects}
          creatingTask={creatingTask}
          newTaskForm={newTaskForm}
          onClose={() => setTaskCreationOpen(false)}
          onCreate={handleCreateNewTask}
          onFieldChange={handleNewTaskFieldChange}
        />
      )}
      {showStandupModal && (
        <StandupDraftModal
          assignedProjects={assignedProjects}
          draftAvailable={draftAvailable}
          isHistorical={isHistorical}
          newTaskRequest={newTaskRequest}
          onClose={handleCloseStandupModal}
          onDiscardDraft={discardDraft}
          onRestoreDraft={restoreDraft}
          onSubmit={handleSaveStandupFromModal}
          readOnly={readOnly}
          refreshTasks={refreshTasks}
          saving={saving}
          tasks={tasks}
          user={user}
          weekInfo={weekInfo}
        />
      )}
      {/* ─── BLOCKER MODAL ─── */}
      {blockerModal !== null && (
        <BlockerModal
          blockerModal={blockerModal}
          newBlockerDescription={newBlockerDescription}
          newBlockerNotes={newBlockerNotes}
          newBlockerPriority={newBlockerPriority}
          newBlockerRefUrl={newBlockerRefUrl}
          newBlockerTitle={newBlockerTitle}
          onAddBlocker={handleAddBlockerFromModal}
          onClose={() => setBlockerModal(null)}
          onDescriptionChange={setNewBlockerDescription}
          onNotesChange={setNewBlockerNotes}
          onPriorityChange={setNewBlockerPriority}
          onRefUrlChange={setNewBlockerRefUrl}
          onResolveBlocker={handleResolveBlocker}
          onTitleChange={setNewBlockerTitle}
          taskRows={taskRows}
          tasks={tasks}
        />
      )}

      <TaskDetailModal task={taskDetail} onClose={() => setTaskDetail(null)} />

      {/* Confirm Dialog */}
      {confirmTarget && (
        <ConfirmDialog
          confirmTarget={confirmTarget}
          onClose={() => setConfirmTarget(null)}
          onConfirm={handleConfirmAction}
        />
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

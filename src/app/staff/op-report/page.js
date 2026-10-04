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
import { getCurrentWeek } from "@/components/staff/op-report/dates";
import { useSessionUser } from "@/lib/hooks/useSessionUser";
import { useApi, useApiMulti } from "@/lib/hooks/useApi";
import OpReportView from "@/components/staff/op-report/OpReportView";
import { EMPTY_LIST, EMPTY_REPORT, INITIAL_FORM, REPORT_TABS, TASK_STATUSES, hasDraftContent, pickAssignments, pickList, pickReport, pickStudioStaff, reportToForm } from "./readers";
import { useOpReportNav } from "./useOpReportNav";
import { toastActions } from "./actions/toast";
import { formRowActions } from "./actions/formRows";
import { blockerRowActions } from "./actions/blockers";
import { taskCreationActions } from "./actions/taskCreation";
import { submitActions } from "./actions/submit";
import { standupActions } from "./actions/standup";
import { retroActions } from "./actions/retro";
import { blockerModalActions } from "./actions/blockerModal";
import { summaryActions } from "./actions/summary";
import { newTaskActions } from "./actions/newTask";
import { confirmActions } from "./actions/confirm";
import { weekActions } from "./actions/week";


/**
 * STAFF OPERATIONAL REPORT PAGE
 *
 * Team members submit weekly stand-up (Monday) and retro (Friday) reports.
 * Each user sees only their own report history.
 */

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


  const { goTo, setReportType, setWeekInfo } = useOpReportNav({
    reportType,
    router,
    weekInfo,
  });

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

  // ─── TASK ROW MANAGEMENT ───

  // ─── THE SCREEN'S OTHER HALF ───
  // Every state value and every read stays here; the writes live in ./actions
  // (one factory per concern), the two useCallback handlers that must stay
  // memoised live in their own hooks, and the markup in components. Both sides
  // read the page through `values` (what it holds) and `ctx` (what it holds
  // plus every handler) — each block lists the names it needs in its own
  // signature.
  const values = {
    router,
    t,
    lang,
    user,
    reportType,
    weekInfo,
    refreshReport,
    history,
    refreshHistory,
    assignedProjects,
    refreshTasks,
    tasks,
    saving,
    setSaving,
    setToast,
    showStandupModal,
    setShowStandupModal,
    readOnly,
    setReadOnly,
    isHistorical,
    setIsHistorical,
    expandedWeek,
    setExpandedWeek,
    setShowTaskForm,
    newTaskForm,
    setNewTaskForm,
    form,
    setForm,
    newPriority,
    setNewPriority,
    newDeliverable,
    setNewDeliverable,
    newWin,
    setNewWin,
    newCarryover,
    setNewCarryover,
    newTaskRequest,
    taskCreationOpen,
    setTaskCreationOpen,
    creatingTask,
    setCreatingTask,
    taskReasons,
    setTaskReasons,
    taskRows,
    setTaskRows,
    blockerModal,
    setBlockerModal,
    confirmTarget,
    setConfirmTarget,
    newBlockerTitle,
    setNewBlockerTitle,
    newBlockerDescription,
    setNewBlockerDescription,
    newBlockerPriority,
    setNewBlockerPriority,
    newBlockerRefUrl,
    setNewBlockerRefUrl,
    newBlockerNotes,
    setNewBlockerNotes,
    subTaskModal,
    setSubTaskModal,
    subTaskName,
    setSubTaskName,
    expandedTasks,
    setExpandedTasks,
    updatingTasks,
    setUpdatingTasks,
    taskDetail,
    setTaskDetail,
    summaryCollapsed,
    setSummaryCollapsed,
    summaryProjectExpanded,
    setSummaryProjectExpanded,
    draftAvailable,
    setDraftAvailable,
    now,
    checkDraft,
    restoreDraft,
    discardDraft,
    clearDraft,
    summaryTasks,
    summaryBlockers,
    summaryProjects,
    summaryLoading,
  };

  const toastActionsResult = toastActions(values);
  const formRowActionsResult = formRowActions(values);
  const blockerRowActionsResult = blockerRowActions(values);
  const taskCreationActionsResult = taskCreationActions({ ...values, ...toastActionsResult });
  const submitActionsResult = submitActions({ ...values, ...toastActionsResult });
  const standupActionsResult = standupActions({ ...values, ...submitActionsResult, setWeekInfo });
  const retroActionsResult = retroActions({ ...values, ...toastActionsResult });
  const blockerModalActionsResult = blockerModalActions({ ...values, ...blockerRowActionsResult });
  const summaryActionsResult = summaryActions(values);
  const newTaskActionsResult = newTaskActions(values);
  const confirmActionsResult = confirmActions(values);
  const weekActionsResult = weekActions({ ...values, setWeekInfo });

  // The handlers this page renders with itself (its own header).
  const { navigateWeek } = weekActionsResult;

  const ctx = {
    ...toastActionsResult,
    ...formRowActionsResult,
    ...blockerRowActionsResult,
    ...taskCreationActionsResult,
    ...submitActionsResult,
    ...standupActionsResult,
    ...retroActionsResult,
    ...blockerModalActionsResult,
    ...summaryActionsResult,
    ...newTaskActionsResult,
    ...confirmActionsResult,
    ...weekActionsResult,
    ...values,
  };

  return (
    <OpReportView
      toast={toast}
      t={t}
      existingReport={existingReport}
      reportType={reportType}
      weekInfo={weekInfo}
      onSelectType={setReportType}
      onNavigateWeek={navigateWeek}
      ctx={ctx}
    />
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

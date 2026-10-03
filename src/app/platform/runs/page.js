"use client";


import { useState as useState, useEffect as useEffect, useCallback as useCallback, useMemo as useMemo, useRef as useRef } from "react";
import { Send as Send, Users as Users, FileText as FileText, Settings as Settings, Link2 as Link2, BarChart3 as BarChart3, Mail as Mail } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi, cacheGet, cacheSet } from "@/lib/hooks/useApi";
import { usePermissions } from "@/lib/PermissionProvider";
import { useDialogs } from "@/components/ui/DialogProvider";
import { EMAIL_PAGE_SIZE as EMAIL_PAGE_SIZE, RETRYABLE_EMAIL_STATUSES as RETRYABLE_EMAIL_STATUSES, TRACKING_FILTERS as TRACKING_FILTERS } from "@/components/platform/runs/constants";
import {
  EMPTY_RUN_LIST, EMPTY_SELECTION,
  pickRunList, fmtAnswer, pickPaymentsBySubmission, accountStatusOf,
} from "@/components/platform/runs/helpers";
import RunDetailHeader from "@/components/platform/runs/RunDetailHeader";
import EvalProgressPanel from "@/components/platform/runs/EvalProgressPanel";
import RunTabs from "@/components/platform/runs/RunTabs";
import { runFormActions } from "./actions/runForms";
import { runLifecycleActions } from "./actions/runLifecycle";
import { reviewActions } from "./actions/review";
import { assignmentActions } from "./actions/assignment";
import { runSettingsActions } from "./actions/runSettings";
import { runAutomationActions } from "./actions/runAutomation";
import { evaluationActions } from "./actions/evaluation";
import { runFilterActions } from "./actions/filters";
import { runExportActions } from "./actions/exportRun";
import { messagingActions } from "./actions/messaging";
import { runEmailActions } from "./actions/emails";
import RunResponsesPanel from "@/components/platform/runs/RunResponsesPanel";
import RunAdminTabs from "@/components/platform/runs/RunAdminTabs";
import RunDetailModals from "@/components/platform/runs/RunDetailModals";
import RunListView from "@/components/platform/runs/RunListView";


/**
 * PLATFORM FORM RUNS — Launch, assign, collect, review
 * Module 4 — Full implementation with assignments, settings, timeline, and enhanced review.
 */

export default function FormRunsPage() {
  const { t } = useI18n();
  // The AI evaluation controls follow `runs.review` — the same capability the
  // server enforces on POST /api/platform/ai/evaluate-submission. Holding it is
  // what lets a reviewer run (and re-run) the evaluation, which can auto-approve
  // an applicant. Watching batch PROGRESS only needs runs.view, so the progress
  // panel stays visible to everyone who can open the run.
  const { can } = usePermissions();
  const { confirm, prompt } = useDialogs();
  const canReview = can("runs", "review");
  const [forms, setForms] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [notification, setNotification] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage] = useState(50);
  const [sortField, setSortField] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");

  // Detail view
  const [selectedRun, setSelectedRun] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [subLoading, setSubLoading] = useState(false);
  const [detailTab, setDetailTab] = useState("overview");
  const [subFilter, setSubFilter] = useState("all"); // "all" | "submitted" | "approved" | "rejected" | "revision_requested" | "draft"

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createData, setCreateData] = useState({ form_id: "", name: "", description: "", opens_at: "", closes_at: "", group_id: "" });
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false); // 'opens' | 'closes' | null

  // Inline group creation (from run create modal + assign modal)
  const [showInlineGroup, setShowInlineGroup] = useState(false);
  const [inlineGroupName, setInlineGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Review modal
  const [showReview, setShowReview] = useState(false);
  const [reviewing, setReviewing] = useState(null);
  const [reviewData, setReviewData] = useState({ decision: "approved", comment: "", internal_note: "" });
  const [reviewTimeline, setReviewTimeline] = useState([]);
  const [evaluation, setEvaluation] = useState(null);  // AI evaluation loaded separately
  const [reviewIncludeResultPdf, setReviewIncludeResultPdf] = useState(false); // opt-in: also email the AI result PDF

  // Assignment modal
  const [showAssign, setShowAssign] = useState(false);
  const [assignTypes, setAssignTypes] = useState({ user: false, group: false, program: false, other: false });
  const [assignUserId, setAssignUserId] = useState("");
  const [assignGroupId, setAssignGroupId] = useState("");
  const [assignProgramId, setAssignProgramId] = useState("");
  const [assignOtherType, setAssignOtherType] = useState("cohort");
  const [assignOtherId, setAssignOtherId] = useState("");

  // Settings
  const [runSettings, setRunSettings] = useState({});
  const [editingSettings, setEditingSettings] = useState(false);

  // Timeline for selected submission
  const [selectedSubmission, setSelectedSubmission] = useState(null);

  // Form fields for spreadsheet column view
  const [runFormFields, setRunFormFields] = useState([]);

  // Operational dashboard
  const [dashboardStats, setDashboardStats] = useState(null);

  // AI Evaluation progress state (Phase 4 client-driven batching)
  const [evalProgress, setEvalProgress] = useState(null); // { total, evaluated, failed, remaining, percent, running, batch }
  const [evalStats, setEvalStats] = useState(null); // { approvals, emails }
  const [evaluations, setEvaluations] = useState([]); // AI evaluation rows for the open run
  const [emailLog, setEmailLog] = useState([]); // email delivery log for the open run
  const [runTemplates, setRunTemplates] = useState({}); // run-level email template overrides
  const [runFormSettings, setRunFormSettings] = useState({}); // form settings (for template fallback + AI base)
  const [runTplSaving, setRunTplSaving] = useState(false);
  const [runPersonalizing, setRunPersonalizing] = useState(null); // template key while AI writes
  // The document this run hands to its report writer (PDF / Word .docx / text).
  const [reportFile, setReportFile] = useState(null);
  const [reportFileBusy, setReportFileBusy] = useState(false);
  // The text the report writer reads out of that document — fetched on demand,
  // because it is the one part of the document that is large.
  const [reportFileText, setReportFileText] = useState(null);
  const [reportFileTextOpen, setReportFileTextOpen] = useState(false);

  // Run-scoped respondent search + filters (operate only on THIS run's submissions)
  const [respSearch, setRespSearch] = useState("");
  const [scoreOp, setScoreOp] = useState(""); // "" | "eq" | "gte" | "gt" | "lte" | "lt" | "between"
  const [scoreValue, setScoreValue] = useState("");
  const [scoreValue2, setScoreValue2] = useState("");
  const [fieldFilters, setFieldFilters] = useState({}); // field label → option value
  const [approvalEmailFilter, setApprovalEmailFilter] = useState("");
  const [activationEmailFilter, setActivationEmailFilter] = useState("");
  const [reviewFilter, setReviewFilter] = useState("");
  const [accountStatusFilter, setAccountStatusFilter] = useState("");
  const [fieldLabels, setFieldLabels] = useState({}); // field id → label (from the run's form)
  const [filterableFields, setFilterableFields] = useState([]); // form fields that carry options
  const [filterPickerOpen, setFilterPickerOpen] = useState(false); // Add Filter dropdown
  const [filterPickerMode, setFilterPickerMode] = useState(null); // null | "score" | { type: "field", label }
  const filterRowRef = useRef(null); // closes the picker when clicking outside

  // One key for the filter combination the respondent table is showing. The
  // table's page, its selected rows and the duplicates-only view are each
  // remembered TOGETHER WITH the combination they belong to and read during
  // render, so a search or filter change needs no effect to reset them: the
  // reset IS the comparison (§4.3 — a reset reachable during render is derived,
  // not written). Each setter takes its identity from the combination in force,
  // because the record it writes is keyed on that combination.
  const respFilterKey = JSON.stringify([
    respSearch, scoreOp, scoreValue, scoreValue2, fieldFilters, subFilter,
    approvalEmailFilter, activationEmailFilter, reviewFilter, accountStatusFilter,
  ]);

  // The payment side of the open Execution's responses. Separate read, so the
  // platform surface never needs the LMS tables and the run's own read budget is
  // unchanged; without the capability the column simply stays empty.
  const paymentsRead = useApi(
    selectedRun?.id ? `/api/lms/registrations?runId=${encodeURIComponent(selectedRun.id)}&perPage=200` : null,
    { defaultValue: { bySubmission: {} }, transform: pickPaymentsBySubmission, deps: [selectedRun?.id] },
  );
  const paymentsBySubmission = paymentsRead.data.bySubmission;
  const [respPageState, setRespPageState] = useState({ key: respFilterKey, page: 1 });
  const respPage = respPageState.key === respFilterKey ? respPageState.page : 1; // respondent table pagination
  const setRespPage = useCallback(
    (next) =>
      setRespPageState({
        key: respFilterKey,
        page: typeof next === "function" ? next(respPage) : next,
      }),
    [respFilterKey, respPage],
  );

  // The selection is remembered the same way, and this is a SAFETY property
  // rather than tidiness: a row selected under a filter combination that is no
  // longer in force reads as NOT SELECTED, so a hidden selection can never be
  // bulk-approved, bulk-messaged or exported. The recorded ids stay in state but
  // are unreachable while their combination is not the current one.
  const [selectionState, setSelectionState] = useState({ key: respFilterKey, ids: EMPTY_SELECTION });
  const selectedIds = selectionState.key === respFilterKey ? selectionState.ids : EMPTY_SELECTION; // bulk-selected respondent ids
  const setSelectedIds = useCallback(
    (next) =>
      setSelectionState({
        key: respFilterKey,
        ids: typeof next === "function" ? next(selectedIds) : next,
      }),
    [respFilterKey, selectedIds],
  );

  // The duplicates panel is open only while the combination it was opened under
  // is the current one.
  const [duplicatesKey, setDuplicatesKey] = useState(null); // duplicates-only view
  const showDuplicates = duplicatesKey === respFilterKey;
  const setShowDuplicates = useCallback(
    (next) => {
      const open = typeof next === "function" ? next(showDuplicates) : next;
      setDuplicatesKey(open ? respFilterKey : null);
    },
    [respFilterKey, showDuplicates],
  );
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false); // bulk Actions dropdown
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false); // confirm dialog
  const [bulkProcessing, setBulkProcessing] = useState(false); // bulk op running
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  const [bulkSummary, setBulkSummary] = useState(null); // { approved, already_approved, failed[] }
  const [bulkIncludeResultPdf, setBulkIncludeResultPdf] = useState(false); // opt-in: also email the AI result PDF
  const bulkAbortRef = useRef(false); // stops issuing new bulk batches when true
  const [retrySelected, setRetrySelected] = useState([]); // "submissionId:emailType" keys
  const [retryProcessing, setRetryProcessing] = useState(false);
  const [retryProgress, setRetryProgress] = useState({ done: 0, total: 0 });
  const [retrySummary, setRetrySummary] = useState(null); // { sent, already_sent, failed[] }
  const retryAbortRef = useRef(false); // stops issuing new retry batches when true
  const [activationConfirmOpen, setActivationConfirmOpen] = useState(false);
  const [activationForceResend, setActivationForceResend] = useState(false);
  const [activationProcessing, setActivationProcessing] = useState(false);
  const [activationProgress, setActivationProgress] = useState({ done: 0, total: 0 });
  // Bulk Send Result (response PDF email) — Actions menu
  const [resultConfirmOpen, setResultConfirmOpen] = useState(false);
  const [resultProcessing, setResultProcessing] = useState(false);
  const [resultProgress, setResultProgress] = useState({ done: 0, total: 0 });
  // Read-only preview of the document about to be sent (one recipient at a time)
  const [resultPreviewId, setResultPreviewId] = useState(null);
  // Standalone document preview opened from a single response row
  const [previewSubmission, setPreviewSubmission] = useState(null);
  // Bumped to force the open preview to reload after a regeneration
  const [previewNonce, setPreviewNonce] = useState(0);
  const [reportRegenerating, setReportRegenerating] = useState(null); // submission id while composing

  // Manual message composer (Room Overview → selected participants)
  const [showMessageComposer, setShowMessageComposer] = useState(false);
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [messageSending, setMessageSending] = useState(false);
  const [messageResult, setMessageResult] = useState(null); // { recipients, sent, failed }
  const [messageSummary, setMessageSummary] = useState(null); // { title, sent, skipped }
  const [aiPersonalizing, setAiPersonalizing] = useState(false);

  // Manual add respondent (super admin injects a test person into a run)
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualAddName, setManualAddName] = useState("");
  const [manualAddEmail, setManualAddEmail] = useState("");
  const [manualAdding, setManualAdding] = useState(false);
  // Manual message composer (Room Overview → selected participants)
  // Export options (format + scope)
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [exportFormat, setExportFormat] = useState("csv"); // csv | xlsx
  const [exportScope, setExportScope] = useState("filtered"); // selected | filtered

  const notify = (message) => { setNotification(message); setTimeout(() => setNotification(null), 3000); };

  // The run list follows the status filter and the page; the reference lists
  // beside it (forms, contacts, groups, programs, stats) do not. Splitting them
  // means a filter or page change re-issues the runs read alone instead of firing
  // all six requests again.
  const runsParams = new URLSearchParams();
  if (statusFilter !== "all") runsParams.set("status", statusFilter);
  runsParams.set("page", String(page));
  runsParams.set("per_page", String(perPage));
  const runsUrl = `/api/platform/form-runs?${runsParams}`;
  const {
    data: runList,
    loading,
    error: runListError,
    status: runListStatus,
    refresh: refreshRuns,
  } = useApi(runsUrl, {
    defaultValue: EMPTY_RUN_LIST,
    transform: pickRunList,
    deps: [statusFilter, page, perPage],
  });
  const runs = runList.runs;
  const totalRuns = runList.total;

  // The loader raised ONE toast whichever way a read failed, and logged which way
  // it was. The hook reports a refusal as a VALUE and a request that never got an
  // answer as an error, so the two are folded back together here. What the toast
  // SHOWS is derived from the read during render - the refusal is not copied into
  // state - and the only thing the page remembers is that this refusal has had its
  // three seconds, which is the toast's own timer.
  const runListRefusal =
    runList.failure ||
    (runListStatus !== null && runListStatus >= 400 ? String(runListStatus) : null);
  const runListFailure = runListRefusal || runListError || null;
  const [dismissedRunListFailure, setDismissedRunListFailure] = useState(null);
  const runListNotice =
    runListFailure && runListFailure !== dismissedRunListFailure
      ? t("platformMisc.runs.loadError", { error: runListFailure })
      : null;
  useEffect(() => {
    if (!runListNotice) return;
    if (runListRefusal) console.error("[runs] list error:", runListRefusal);
    else console.error("[runs] list fetch failed:", runListError);
    const timer = setTimeout(() => setDismissedRunListFailure(runListFailure), 3000);
    return () => clearTimeout(timer);
  }, [runListNotice, runListFailure, runListRefusal, runListError]);

  const fetchForms = useCallback(async (bypassCache = false) => {
    const url = "/api/platform/forms?status=published";
    const apply = (data) => {
      if (data.success) setForms(data.forms || []);
    };
    try {
      // Cache-first paint: the form dropdown renders instantly from a fresh
      // snapshot; the network refresh keeps it current in the background.
      if (!bypassCache) {
        const cached = cacheGet(url);
        if (cached !== null && cached.success) apply(cached);
      }
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        cacheSet(url, data);
        apply(data);
      }
    } catch (_) {}
  }, []);

  const fetchContacts = useCallback(async (bypassCache = false) => {
    const url = "/api/platform/form-runs?contacts=true";
    const apply = (data) => {
      if (data.success) setContacts(data.contacts || []);
    };
    try {
      // Cache-first paint: contact options render instantly from a fresh
      // snapshot; the network refresh keeps them current in the background.
      if (!bypassCache) {
        const cached = cacheGet(url);
        if (cached !== null && cached.success) apply(cached);
      }
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        cacheSet(url, data);
        apply(data);
      }
    } catch (_) {}
  }, []);

  const fetchGroups = useCallback(async (bypassCache = false) => {
    const url = "/api/groups";
    const apply = (data) => {
      if (data.success) setGroups(data.groups || []);
    };
    try {
      // Cache-first paint: the group dropdown renders instantly from a fresh
      // snapshot; group creation passes bypassCache=true so it reflects the
      // newly created group immediately.
      if (!bypassCache) {
        const cached = cacheGet(url);
        if (cached !== null && cached.success) apply(cached);
      }
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        cacheSet(url, data);
        apply(data);
      }
    } catch (_) {}
  }, []);

  const fetchPrograms = useCallback(async (bypassCache = false) => {
    const url = "/api/pm/programs";
    const apply = (data) => {
      if (data.success) setPrograms(data.programs || []);
    };
    try {
      // Cache-first paint: the program dropdown renders instantly from a fresh
      // snapshot; the network refresh keeps it current in the background.
      if (!bypassCache) {
        const cached = cacheGet(url);
        if (cached !== null && cached.success) apply(cached);
      }
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        cacheSet(url, data);
        apply(data);
      }
    } catch (_) {}
  }, []);



  const fetchDashboardStats = useCallback(async (bypassCache = false) => {
    const url = "/api/platform/form-runs?dashboard=true";
    const apply = (data) => {
      if (data.success) setDashboardStats(data.stats);
    };
    try {
      // Cache-first paint: dashboard cards render instantly from a fresh
      // snapshot; the network refresh keeps them current in the background.
      if (!bypassCache) {
        const cached = cacheGet(url);
        if (cached !== null && cached.success) apply(cached);
      }
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        cacheSet(url, data);
        apply(data);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchForms();
    fetchContacts();
    fetchGroups();
    fetchPrograms();
    fetchDashboardStats();
  }, [fetchForms, fetchContacts, fetchGroups, fetchPrograms, fetchDashboardStats]);

  const openRun = useCallback(async (run, options = {}) => {
    if (!options.keepTab) {
      setDetailTab("overview");
      setSubFilter("all");
    }
    setSelectedRun(run);
    setSubLoading(true);
    try {
      const response = await fetch(`/api/platform/form-runs?id=${run.id}`);
      const data = await response.json();
      if (data.success) {
        setSubmissions(data.submissions || []);
        setReviews(data.reviews || []);
        setAssignments(data.assignments || []);
        setRunSettings(data.run.settings || {});
        // The attached document belongs to the run that was just opened.
        setReportFile(data.report_file || null);
        setEvaluations(data.evaluations || []);
        setEmailLog(data.emails || []);
        setRunTemplates(data.run?.settings?.templates || {});
        setFieldLabels(data.field_labels || {});
        setFilterableFields(data.filterable_fields || []);
        if (!options.keepTab) {
          // Fresh run → reset search/filters so nothing leaks across runs
          setRespSearch("");
          setScoreOp("");
          setScoreValue("");
          setScoreValue2("");
          setFieldFilters({});
          setApprovalEmailFilter("");
          setActivationEmailFilter("");
          setReviewFilter("");
          setAccountStatusFilter("");
          setRespPage(1);
          setSelectedIds([]);
          setShowDuplicates(false);
          setReportFileText(null);
          setReportFileTextOpen(false);
          setFilterPickerOpen(false);
          setFilterPickerMode(null);
          setBulkSummary(null);
          setBulkMenuOpen(false);
          setBulkConfirmOpen(false);
          setResultConfirmOpen(false);
          setResultPreviewId(null);
          setPreviewSubmission(null);
          setRetrySelected([]);
          setRetrySummary(null);
        }
      }

      // Fetch form fields for spreadsheet column view
      try {
        const formResponse = await fetch(`/api/platform/forms?id=${run.form_id}`);
        const formData = await formResponse.json();
        if (formData.success) {
          setRunFormFields((formData.fields || []).filter(field => !["hidden"].includes(field.field_type)));
          setRunFormSettings(formData.form?.settings || {});
        }
      } catch (_) {}
    } catch (_) {}
    setSubLoading(false);
    // The three records this reset writes are DERIVED from the filter combination
    // in force (see the respondent table's view records), so resetting them for a
    // fresh run genuinely depends on the combination they belong to.
  }, [setRespPage, setSelectedIds, setShowDuplicates, setDetailTab, setSelectedRun]);

























































  // ─── RUN-SCOPED FILTERING (Overview) ───
  // Runs against ONLY this run's submissions + their AI evaluations.
  const submissionAnswers = useCallback((submission) => {
    const submissionData = submission.data || {};
    const answers = {};
    for (const [key, value] of Object.entries(submissionData)) {
      if (key.startsWith("_")) continue;
      answers[fieldLabels[key] || key] = fmtAnswer(value);
    }
    return answers;
  }, [fieldLabels]);

  const latestEmailOf = useCallback(
    (submission, type) =>
      emailLog
        .filter((email) => email.submission_id === submission.id && email.email_type === type)
        .slice(-1)[0] || null,
    [emailLog],
  );
  const latestReviewOf = useCallback((submission) => {
    const submissionReviews = reviews.filter((review) => review.submission_id === submission.id);
    return submissionReviews[submissionReviews.length - 1] || null;
  }, [reviews]);
  const emailStatusOf = useCallback((submission, type) => {
    const email = latestEmailOf(submission, type);
    return email ? email.status : "not_sent";
  }, [latestEmailOf]);

  const filteredSubmissions = useMemo(() => {
    if (!selectedRun) return [];
    const searchQuery = respSearch.trim().toLowerCase();
    const firstScoreValue = parseFloat(scoreValue);
    const secondScoreValue = parseFloat(scoreValue2);
    const hasScore = !!scoreOp && !isNaN(firstScoreValue);
    const scorePass = (score) => {
      if (!hasScore) return true;
      switch (scoreOp) {
        case "eq": return score === firstScoreValue;
        case "gte": return score >= firstScoreValue;
        case "gt": return score > firstScoreValue;
        case "lte": return score <= firstScoreValue;
        case "lt": return score < firstScoreValue;
        case "between": return !isNaN(secondScoreValue) ? score >= firstScoreValue && score <= secondScoreValue : score >= firstScoreValue;
        default: return true;
      }
    };
    const activeFieldFilters = Object.entries(fieldFilters).filter(([, filterValue]) => filterValue);

    return submissions.filter((submission) => {
      if (subFilter !== "all" && submission.status !== subFilter) return false;

      if (approvalEmailFilter && emailStatusOf(submission, "approval") !== approvalEmailFilter) return false;
      if (activationEmailFilter && emailStatusOf(submission, "activation") !== activationEmailFilter) return false;
      if (reviewFilter) {
        const review = latestReviewOf(submission);
        const decision = review ? review.decision : "none";
        if (decision !== reviewFilter) return false;
      }
      if (accountStatusFilter && accountStatusOf(submission) !== accountStatusFilter) return false;

      if (searchQuery) {
        const haystack = [
          submission.submitter_name || "",
          submission.email || "",
          ...Object.values(submissionAnswers(submission)),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(searchQuery)) return false;
      }

      if (hasScore) {
        const evalRow = evaluations.find((evaluationRow) => evaluationRow.submission_id === submission.id);
        const score = evalRow != null ? Number(evalRow.overall_score) : null;
        if (score == null || isNaN(score) || !scorePass(score)) return false;
      }

      if (activeFieldFilters.length > 0) {
        const answers = submissionAnswers(submission);
        for (const [label, filterValue] of activeFieldFilters) {
          const actual = String(answers[label] ?? "").trim().toLowerCase();
          if (actual !== String(filterValue).trim().toLowerCase()) return false;
        }
      }
      return true;
    });
  // The three helpers above carry the reactivity of `fieldLabels`, `reviews` and
  // `emailLog`: the memo depends on their identity, so those raw values are no
  // longer dependencies of their own.
  }, [selectedRun, submissions, evaluations, subFilter, respSearch, scoreOp, scoreValue, scoreValue2, fieldFilters, submissionAnswers, latestReviewOf, emailStatusOf, approvalEmailFilter, activationEmailFilter, reviewFilter, accountStatusFilter]);





  // ─── Filter chips (presentation only — the underlying filter state is the
  // same scoreOp/scoreValue/fieldFilters the filtering logic already uses) ───
  const SCORE_OPS = { eq: "=", gt: ">", gte: "≥", lt: "<", lte: "≤" };
  const scoreChipActive = !!scoreOp && scoreValue !== "";
  const scoreChipLabel = scoreChipActive
    ? scoreOp === "between"
      ? `${t("platformMisc.runs.colAiScore")}: ${scoreValue}–${scoreValue2 || "?"}%`
      : `${t("platformMisc.runs.colAiScore")}: ${SCORE_OPS[scoreOp] || ""} ${scoreValue}%`
    : "";
  const activeFieldFilters = Object.entries(fieldFilters).filter(([, filterValue]) => filterValue);

  // Tracking filters (Approval Email / Review / Status / Activation Email /
  // Account Status) — same pattern as field filters, but backed by fixed
  // option lists and the tracking filter state.
  const trackingFilterValue = (key) => {
    if (key === "approval_email") return approvalEmailFilter;
    if (key === "review") return reviewFilter;
    if (key === "status") return subFilter === "all" ? "" : subFilter;
    if (key === "activation_email") return activationEmailFilter;
    if (key === "account_status") return accountStatusFilter;
    return "";
  };



  const activeTrackingFilters = TRACKING_FILTERS
    .map((filter) => ({ key: filter.key, label: filter.label, value: trackingFilterValue(filter.key) }))
    .filter((filter) => filter.value);

  const availableParams = [
    ...(scoreChipActive ? [] : [{ key: "score", label: t("platformMisc.runs.colAiScore") }]),
    ...TRACKING_FILTERS
      .filter((filter) => !trackingFilterValue(filter.key))
      .map((filter) => ({ key: filter.key, label: filter.label })),
    ...filterableFields
      .filter((field) => !fieldFilters[field.label])
      .map((field) => ({ key: `field:${field.label}`, label: field.label })),
  ];
  const fieldOptionsOf = (label) => filterableFields.find((field) => field.label === label)?.options || [];





  // Clicking anywhere outside the filter row closes the Add Filter dropdown
  // and any open inline editor automatically.
  useEffect(() => {
    if (!filterPickerOpen && !filterPickerMode) return;
    const onDown = (event) => {
      if (filterRowRef.current && !filterRowRef.current.contains(event.target)) {
        setFilterPickerOpen(false);
        setFilterPickerMode(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [filterPickerOpen, filterPickerMode]);



  // ─── Duplicate detection: same resolved email appearing multiple times ───
  // The keeper (highest AI score) is marked; the rest are duplicates. After
  // evaluation, only the keeper should receive approval/activation emails.
  const duplicateGroups = useMemo(() => {
    const byEmail = new Map();
    for (const submission of submissions) {
      const key = (submission.email || "").trim().toLowerCase();
      if (!key || !key.includes("@")) continue;
      if (!byEmail.has(key)) byEmail.set(key, []);
      byEmail.get(key).push(submission);
    }
    const groups = [...byEmail.values()].filter((group) => group.length > 1);
    const keeperIds = new Set();
    for (const group of groups) {
      let best = null;
      let bestScore = NaN;
      for (const submission of group) {
        const evaluationRow = evaluations.find((candidateEvaluation) => candidateEvaluation.submission_id === submission.id);
        const score = evaluationRow != null ? Number(evaluationRow.overall_score) : NaN;
        if (!isNaN(score) && (isNaN(bestScore) || score > bestScore)) {
          best = submission;
          bestScore = score;
        }
      }
      if (best) keeperIds.add(best.id);
    }
    const extra = groups.reduce((accumulated, group) => accumulated + group.length - 1, 0);
    return { groups, keeperIds, extra };
  }, [submissions, evaluations]);

  const duplicateEmailSet = useMemo(() => {
    const set = new Set();
    for (const group of duplicateGroups.groups) {
      for (const submission of group) set.add((submission.email || "").trim().toLowerCase());
    }
    return set;
  }, [duplicateGroups]);

  // What the table actually displays: the filtered set, or only duplicates
  // when the duplicates view is active.
  const visibleSubmissions = useMemo(
    () =>
      showDuplicates
        ? filteredSubmissions.filter((submission) => duplicateEmailSet.has((submission.email || "").trim().toLowerCase()))
        : filteredSubmissions,
    [filteredSubmissions, showDuplicates, duplicateEmailSet]
  );

  // ─── Respondent table pagination (perPage rows per page) ───
  const respTotalPages = Math.max(1, Math.ceil(visibleSubmissions.length / perPage));
  const respSafePage = Math.min(respPage, respTotalPages);
  const pagedSubmissions = visibleSubmissions.slice(
    (respSafePage - 1) * perPage,
    respSafePage * perPage
  );

  // ─── Bulk selection (respects the CURRENT filters; Select All = all filtered, across pages) ───
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allFilteredSelected =
    visibleSubmissions.length > 0 && visibleSubmissions.every((submission) => selectedSet.has(submission.id));





  // Bulk approve: batches of 10 through the SAME review workflow as a single
  // approval (server-side action=bulk_review → processReviewInternal).
  const BULK_BATCH = 10;
  // The PDF opt-in needs an evaluation on EVERY selected submission — the server
  // refuses an approval whose document cannot follow.
  const allSelectedEvaluated = selectedIds.every((id) => evaluations.some((evaluation) => evaluation.submission_id === id));
  const runBulkApprove = async () => {
    if (!selectedRun || selectedIds.length === 0 || bulkProcessing) return;
    setBulkProcessing(true);
    setBulkConfirmOpen(false);
    setBulkIncludeResultPdf(false);
    bulkAbortRef.current = false;
    const ids = [...selectedIds];
    const includeResultPdf = bulkIncludeResultPdf;
    const summary = { approved: 0, already_approved: 0, failed: [], cancelled: 0 };
    let pdfFailed = 0;
    setBulkProgress({ done: 0, total: ids.length });
    let aborted = false;
    let processed = 0;
    for (let batchStart = 0; batchStart < ids.length && !aborted && !bulkAbortRef.current; batchStart += BULK_BATCH) {
      const chunk = ids.slice(batchStart, batchStart + BULK_BATCH);
      let data;
      try {
        const response = await fetch("/api/platform/form-runs?action=bulk_review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            run_id: selectedRun.id,
            submission_ids: chunk,
            decision: "approved",
            ...(includeResultPdf ? { include_result_pdf: true } : {}),
          }),
        });
        data = await response.json();
      } catch (_) {
        aborted = true;
        summary.failed.push({ name: t("platformMisc.runs.batchLabel", { count: Math.floor(batchStart / BULK_BATCH) + 1 }), error: t("platformMisc.runs.bulkNetworkError") });
        break;
      }
      if (!data.success) {
        aborted = true;
        summary.failed.push({ name: t("platformMisc.runs.batchFallback"), error: data.error || t("platformMisc.runs.bulkFailedError") });
        break;
      }
      for (const result of data.results || []) {
        if (result.status === "approved") summary.approved++;
        else if (result.status === "already_approved") summary.already_approved++;
        else summary.failed.push({ name: result.name || `#${result.submission_id}`, error: result.error || t("platformMisc.runs.failedFallback") });
        if (result.result_pdf === "failed") pdfFailed++;
      }
      processed = Math.min(batchStart + BULK_BATCH, ids.length);
      setBulkProgress({ done: processed, total: ids.length });
    }
    // Anything not yet processed when the user cancels (or a batch fails) is
    // reported as cancelled — nothing was sent for those rows, and they stay
    // in their previous state so they can be selected again later.
    summary.cancelled = ids.length - processed;
    // Record the unprocessed remainder as CANCELLED so history keeps
    // sent / failed / cancelled distinct and those rows stay retryable later.
    const unprocessedIds = ids.slice(processed);
    if (unprocessedIds.length > 0 && selectedRun) {
      try {
        await fetch("/api/platform/form-runs?action=mark_email_cancelled", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            run_id: selectedRun.id,
            items: unprocessedIds.map((submissionId) => ({ submission_id: submissionId, email_type: "approval" })),
          }),
        });
      } catch (_) {}
    }
    setBulkProcessing(false);
    setSelectedIds([]);
    if (selectedRun) await openRun(selectedRun);
    setBulkSummary(summary);
    if (pdfFailed > 0) notify(t("platformMisc.runs.bulkResultPdfSendFailed", { count: pdfFailed }));
  };

  // ─── Email delivery summary: latest row per (submission, email_type) ───
  const emailSummary = useMemo(() => {
    const latest = new Map();
    for (const email of emailLog) latest.set(`${email.submission_id}:${email.email_type}`, email);
    const empty = () => ({ sent: 0, delivered: 0, opened: 0, clicked: 0, delayed: 0, complained: 0, failed: 0, bounced: 0, cancelled: 0, skipped: 0, pending: 0 });
    const stats = { approval: empty(), activation: empty(), acknowledgement: empty() };
    const notDelivered = [];
    for (const email of latest.values()) {
      const bucket =
        email.email_type === "activation" ? stats.activation
        : email.email_type === "acknowledgement" ? stats.acknowledgement
        : stats.approval;
      const status = email.status;
      if (status === "sent") bucket.sent++;
      else if (["delivered", "opened", "clicked"].includes(status)) bucket[status]++;
      else if (status === "delayed") bucket.delayed++;
      else if (status === "complained") bucket.complained++;
      else if (["failed", "bounced", "cancelled", "pending"].includes(status)) {
        bucket[status]++;
        notDelivered.push(email);
      } else if (status === "skipped") bucket.skipped++;
    }
    return { stats, notDelivered };
  }, [emailLog]);

  // All email rows (latest per submission:email_type) enriched with the
  // respondent's resolved name + recipient.
  const allEmailRows = useMemo(() => {
    const latest = new Map();
    for (const email of emailLog) latest.set(`${email.submission_id}:${email.email_type}`, email);
    return [...latest.values()].map((emailRow) => {
      const submission = submissions.find((candidate) => candidate.id === emailRow.submission_id);
      return {
        ...emailRow,
        name: submission?.display_name || submission?.submitter_name || `#${emailRow.submission_id}`,
        email: emailRow.recipient || submission?.email || "",
      };
    });
  }, [emailLog, submissions]);

  const [emailStatusFilter, setEmailStatusFilter] = useState("all");
  const [emailDateFrom, setEmailDateFrom] = useState("");
  const [emailDateTo, setEmailDateTo] = useState("");
  const [emailSearch, setEmailSearch] = useState("");
  const [emailTypeFilter, setEmailTypeFilter] = useState("all"); // all | approval | activation
  const [emailPage, setEmailPage] = useState(1);

  const visibleEmailRows = useMemo(() => {
    return allEmailRows.filter((emailRow) => {
      if (emailTypeFilter !== "all" && emailRow.email_type !== emailTypeFilter) return false;
      if (emailStatusFilter !== "all" && emailRow.status !== emailStatusFilter) return false;
      if (emailSearch) {
        const searchQuery = emailSearch.toLowerCase();
        const haystack = `${emailRow.name || ""} ${emailRow.email || ""}`.toLowerCase();
        if (!haystack.includes(searchQuery)) return false;
      }
      const timestamp = emailRow.sent_at || emailRow.created_at;
      if (timestamp) {
        const date = new Date(timestamp);
        if (emailDateFrom && date < new Date(emailDateFrom + "T00:00:00")) return false;
        if (emailDateTo && date > new Date(emailDateTo + "T23:59:59")) return false;
      }
      return true;
    });
  }, [allEmailRows, emailTypeFilter, emailStatusFilter, emailSearch, emailDateFrom, emailDateTo]);

  const retryableVisible = useMemo(
    () => visibleEmailRows.filter((emailRow) => RETRYABLE_EMAIL_STATUSES.includes(emailRow.status)),
    [visibleEmailRows]
  );

  // All lifecycle statuses ever recorded per (submission, email_type) — used
  // to render delivery milestones (sent / delivered / opened / clicked) per
  // email from the appended Resend event rows.
  const emailStatusSets = useMemo(() => {
    const map = new Map();
    for (const email of emailLog) {
      const key = `${email.submission_id}:${email.email_type}`;
      if (!map.has(key)) map.set(key, new Set());
      map.get(key).add(email.status);
    }
    return map;
  }, [emailLog]);

  const emailTotalPages = Math.max(1, Math.ceil(visibleEmailRows.length / EMAIL_PAGE_SIZE));
  const safeEmailPage = Math.min(emailPage, emailTotalPages);
  const pagedEmailRows = visibleEmailRows.slice((safeEmailPage - 1) * EMAIL_PAGE_SIZE, safeEmailPage * EMAIL_PAGE_SIZE);

  const retrySelectedSet = useMemo(() => new Set(retrySelected), [retrySelected]);




















  // Activation history per submission (real email log — the ONLY source of truth
  // for "was the activation email ever sent?" — never derived from account status).
  const activationLogBySubmission = useMemo(() => {
    const map = new Map();
    for (const email of emailLog) {
      if (email.email_type !== "activation") continue;
      if (!map.has(email.submission_id)) map.set(email.submission_id, []);
      map.get(email.submission_id).push(email);
    }
    return map;
  }, [emailLog]);

  const hasActivationEmailSent = useCallback((id) => {
    // Full-history truth from the API enrichment (sent rows only) takes
    // priority; the client email log carries only the latest row per type.
    const submission = submissions.find((candidate) => candidate.id === id);
    if (submission?.activation_history?.first_sent_at) return true;
    const activationRows = activationLogBySubmission.get(id) || [];
    return activationRows.some((emailRow) => emailRow.status === "sent");
  }, [submissions, activationLogBySubmission]);

  // FIRST send: approved + activation email never sent yet
  const eligibleSendActivationIds = useMemo(() => {
    return selectedIds.filter((id) => {
      const submission = submissions.find((candidate) => candidate.id === id);
      if (!submission || String(submission.status || "").toLowerCase() !== "approved") return false;
      return !hasActivationEmailSent(id);
    });
  }, [selectedIds, submissions, hasActivationEmailSent]);

  // RESEND: approved + activation email already sent at least once
  const eligibleResendActivationIds = useMemo(() => {
    return selectedIds.filter((id) => {
      const submission = submissions.find((candidate) => candidate.id === id);
      if (!submission || String(submission.status || "").toLowerCase() !== "approved") return false;
      return hasActivationEmailSent(id);
    });
  }, [selectedIds, submissions, hasActivationEmailSent]);





  // Send Result (response PDF): any non-draft selected submission that has an
  // evaluation row. Failed/never-sent results are re-attempted server-side;
  // already-sent ones are reported and skipped.
  const evaluatedSubmissionIds = useMemo(
    () => new Set(evaluations.map((evaluationRow) => evaluationRow.submission_id)),
    [evaluations],
  );

  const eligibleSendResultIds = useMemo(() => {
    return selectedIds.filter((id) => {
      const submission = submissions.find((candidate) => candidate.id === id);
      if (!submission || String(submission.status || "") === "draft") return false;
      return evaluatedSubmissionIds.has(id);
    });
  }, [selectedIds, submissions, evaluatedSubmissionIds]);







  const runRetryEmails = async () => {
    if (!selectedRun || retrySelected.length === 0 || retryProcessing) return;
    setRetryProcessing(true);
    retryAbortRef.current = false;
    const items = retrySelected.map((retryKey) => {
      const [submissionId, type] = retryKey.split(":");
      return { submission_id: parseInt(submissionId), email_type: type };
    });
    const summary = { sent: 0, already_sent: 0, failed: [], cancelled: 0 };
    setRetryProgress({ done: 0, total: items.length });
    let aborted = false;
    let processed = 0;
    for (let chunkStart = 0; chunkStart < items.length && !aborted && !retryAbortRef.current; chunkStart += 10) {
      const chunk = items.slice(chunkStart, chunkStart + 10);
      let data;
      try {
        const response = await fetch("/api/platform/form-runs?action=retry_emails", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ run_id: selectedRun.id, retries: chunk }),
        });
        data = await response.json();
      } catch (_) {
        aborted = true;
        summary.failed.push({ name: t("platformMisc.runs.batchLabel", { count: Math.floor(chunkStart / 10) + 1 }), error: t("platformMisc.runs.retryNetworkError") });
        break;
      }
      if (!data.success) {
        aborted = true;
        summary.failed.push({ name: t("platformMisc.runs.batchFallback"), error: data.error || t("platformMisc.runs.retryFailedError") });
        break;
      }
      for (const result of data.results || []) {
        if (result.status === "sent") summary.sent++;
        else if (result.status === "already_sent") summary.already_sent++;
        else summary.failed.push({ name: result.name || `#${result.submission_id} (${result.email_type})`, error: result.error || t("platformMisc.runs.failedFallback") });
      }
      processed = Math.min(chunkStart + 10, items.length);
      setRetryProgress({ done: processed, total: items.length });
    }
    summary.retried = items.length;
    summary.cancelled = items.length - processed;
    // Record the unprocessed remainder as CANCELLED so history keeps
    // sent / failed / bounced / cancelled distinct and those rows stay
    // retryable later.
    const unprocessed = items.slice(processed);
    if (unprocessed.length > 0 && selectedRun) {
      try {
        await fetch("/api/platform/form-runs?action=mark_email_cancelled", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ run_id: selectedRun.id, items: unprocessed }),
        });
      } catch (_) {}
    }
    setRetryProcessing(false);
    setRetrySelected([]);
    // Refresh with keepTab so we STAY on the Emails tab — the summary modal
    // lives there, and the Failed list must update in place: successful
    // retries disappear from it, failures keep their latest reason.
    if (selectedRun) await openRun(selectedRun, { keepTab: true });
    setRetrySummary(summary);
    notify(
      summary.failed.length > 0
        ? t("platformMisc.runs.emailRetryPartial", { sent: summary.sent, failed: summary.failed.length })
        : t("platformMisc.runs.emailRetrySuccess", { sent: summary.sent })
    );
  };

  const subtotal = submissions.length;
  const submitted = submissions.filter((submission) => submission.status === "submitted").length;
  const approved = submissions.filter((submission) => submission.status === "approved").length;
  const rejected = submissions.filter((submission) => submission.status === "rejected").length;
  const revision = submissions.filter((submission) => submission.status === "revision_requested").length;
  const drafts = submissions.filter((submission) => submission.status === "draft").length;
  const overdue = submissions.filter((submission) => submission.status === "submitted" && selectedRun.closes_at && new Date(submission.submitted_at) > new Date(selectedRun.closes_at)).length;

  // ─── THE SCREEN'S OTHER HALF ───
  // Every state value and every read stays here; the writes live in ./actions
  // (one factory per concern) and the markup in components/platform/runs. Both
  // sides read the page through `values` (what it holds) and `ctx` (what it holds
  // plus every handler) — each block lists the names it needs in its own signature.
  const values = {
    t,
    confirm,
    prompt,
    canReview,
    forms,
    contacts,
    groups,
    programs,
    notification,
    statusFilter,
    setStatusFilter,
    search,
    setSearch,
    page,
    setPage,
    perPage,
    sortField,
    setSortField,
    sortDir,
    setSortDir,
    selectedRun,
    setSelectedRun,
    submissions,
    reviews,
    assignments,
    setAssignments,
    subLoading,
    detailTab,
    subFilter,
    setSubFilter,
    showCreate,
    setShowCreate,
    createData,
    setCreateData,
    saving,
    setSaving,
    showDatePicker,
    setShowDatePicker,
    showInlineGroup,
    setShowInlineGroup,
    inlineGroupName,
    setInlineGroupName,
    creatingGroup,
    setCreatingGroup,
    showReview,
    setShowReview,
    reviewing,
    setReviewing,
    reviewData,
    setReviewData,
    reviewTimeline,
    setReviewTimeline,
    evaluation,
    setEvaluation,
    reviewIncludeResultPdf,
    setReviewIncludeResultPdf,
    showAssign,
    setShowAssign,
    assignTypes,
    setAssignTypes,
    assignUserId,
    setAssignUserId,
    assignGroupId,
    setAssignGroupId,
    assignProgramId,
    setAssignProgramId,
    assignOtherType,
    setAssignOtherType,
    assignOtherId,
    setAssignOtherId,
    runSettings,
    setRunSettings,
    editingSettings,
    setEditingSettings,
    selectedSubmission,
    setSelectedSubmission,
    runFormFields,
    setRunFormFields,
    dashboardStats,
    setEvalProgress,
    setEvalStats,
    evaluations,
    emailLog,
    runTemplates,
    setRunTemplates,
    runFormSettings,
    runTplSaving,
    setRunTplSaving,
    runPersonalizing,
    setRunPersonalizing,
    reportFile,
    setReportFile,
    reportFileBusy,
    setReportFileBusy,
    reportFileText,
    setReportFileText,
    reportFileTextOpen,
    setReportFileTextOpen,
    respSearch,
    setRespSearch,
    scoreOp,
    setScoreOp,
    scoreValue,
    setScoreValue,
    scoreValue2,
    setScoreValue2,
    fieldFilters,
    setFieldFilters,
    approvalEmailFilter,
    setApprovalEmailFilter,
    activationEmailFilter,
    setActivationEmailFilter,
    reviewFilter,
    setReviewFilter,
    accountStatusFilter,
    setAccountStatusFilter,
    fieldLabels,
    filterPickerOpen,
    setFilterPickerOpen,
    filterPickerMode,
    setFilterPickerMode,
    paymentsBySubmission,
    setRespPage,
    selectedIds,
    setSelectedIds,
    showDuplicates,
    setShowDuplicates,
    bulkMenuOpen,
    setBulkMenuOpen,
    bulkConfirmOpen,
    setBulkConfirmOpen,
    bulkProcessing,
    bulkProgress,
    bulkSummary,
    setBulkSummary,
    bulkIncludeResultPdf,
    setBulkIncludeResultPdf,
    retrySelected,
    setRetrySelected,
    retryProcessing,
    retryProgress,
    retrySummary,
    setRetrySummary,
    activationConfirmOpen,
    setActivationConfirmOpen,
    activationForceResend,
    setActivationForceResend,
    activationProcessing,
    setActivationProcessing,
    activationProgress,
    setActivationProgress,
    resultConfirmOpen,
    setResultConfirmOpen,
    resultProcessing,
    setResultProcessing,
    resultProgress,
    setResultProgress,
    resultPreviewId,
    setResultPreviewId,
    previewSubmission,
    setPreviewSubmission,
    previewNonce,
    setPreviewNonce,
    reportRegenerating,
    setReportRegenerating,
    showMessageComposer,
    setShowMessageComposer,
    messageSubject,
    setMessageSubject,
    messageBody,
    setMessageBody,
    messageSending,
    setMessageSending,
    messageResult,
    setMessageResult,
    messageSummary,
    setMessageSummary,
    aiPersonalizing,
    setAiPersonalizing,
    showManualAdd,
    setShowManualAdd,
    manualAddName,
    setManualAddName,
    manualAddEmail,
    setManualAddEmail,
    manualAdding,
    setManualAdding,
    showExportOptions,
    setShowExportOptions,
    exportFormat,
    setExportFormat,
    exportScope,
    setExportScope,
    notify,
    loading,
    refreshRuns,
    runs,
    totalRuns,
    runListNotice,
    fetchGroups,
    openRun,
    submissionAnswers,
    filteredSubmissions,
    scoreChipActive,
    scoreChipLabel,
    activeFieldFilters,
    activeTrackingFilters,
    availableParams,
    fieldOptionsOf,
    duplicateGroups,
    duplicateEmailSet,
    visibleSubmissions,
    respTotalPages,
    respSafePage,
    pagedSubmissions,
    selectedSet,
    allFilteredSelected,
    allSelectedEvaluated,
    emailSummary,
    allEmailRows,
    emailStatusFilter,
    setEmailStatusFilter,
    emailDateFrom,
    setEmailDateFrom,
    emailDateTo,
    setEmailDateTo,
    emailSearch,
    setEmailSearch,
    emailTypeFilter,
    setEmailTypeFilter,
    setEmailPage,
    visibleEmailRows,
    retryableVisible,
    emailStatusSets,
    emailTotalPages,
    safeEmailPage,
    pagedEmailRows,
    retrySelectedSet,
    eligibleSendActivationIds,
    eligibleResendActivationIds,
    evaluatedSubmissionIds,
    eligibleSendResultIds,
    subtotal,
    submitted,
    approved,
    rejected,
    revision,
    drafts,
    overdue,
  };

  const runFormActionsResult = runFormActions(values);
  const runLifecycleActionsResult = runLifecycleActions(values);
  const reviewActionsResult = reviewActions(values);
  const assignmentActionsResult = assignmentActions(values);
  const runSettingsActionsResult = runSettingsActions(values);
  const runAutomationActionsResult = runAutomationActions(values);
  const evaluationActionsResult = evaluationActions(values);
  const runFilterActionsResult = runFilterActions(values);
  const runExportActionsResult = runExportActions(values);
  const messagingActionsResult = messagingActions(values);
  const runEmailActionsResult = runEmailActions(values);

  // The handlers this page renders with itself (its own header and tab bar).
  const { handleLaunch } = runLifecycleActionsResult;
  const { handleStatusChange } = runLifecycleActionsResult;
  const { handleDeleteRun } = runLifecycleActionsResult;
  const { handleBatchEvaluate } = evaluationActionsResult;
  const { openManualAdd } = messagingActionsResult;

  const ctx = {
    ...runFormActionsResult,
    ...runLifecycleActionsResult,
    ...reviewActionsResult,
    ...assignmentActionsResult,
    ...runSettingsActionsResult,
    ...runAutomationActionsResult,
    ...evaluationActionsResult,
    ...runFilterActionsResult,
    ...runExportActionsResult,
    ...messagingActionsResult,
    ...runEmailActionsResult,
    ...values,
  };

  // ─── RUN DETAIL VIEW ───
  if (selectedRun) {

    const tabs = [
      { id: "overview", label: t("platformMisc.runs.tabOverview"), icon: BarChart3 },
      { id: "share", label: t("platformMisc.runs.tabShare"), icon: Link2 },
      { id: "assignments", label: t("platformMisc.runs.tabAssignments", { count: assignments.length }), icon: Users },
      { id: "responses", label: t("platformMisc.runs.tabAllResponses"), icon: FileText, href: `/platform/responses?run_id=${selectedRun?.id || ""}` },
      { id: "templates", label: t("platformMisc.runs.tabTemplates"), icon: Mail },
      { id: "emails", label: t("platformMisc.runs.tabEmails"), icon: Send },
      { id: "settings", label: t("platformMisc.runs.tabSettings"), icon: Settings },
    ];

    return (
      <div className="flex flex-col h-screen overflow-hidden">
        {(notification || runListNotice) && <div className="fixed bottom-6 right-6 z-[500] px-5 py-3 rounded-xl bg-emerald-500 text-black text-[10px] font-bold uppercase animate-in">{notification || runListNotice}</div>}
        {/* Header */}
        <RunDetailHeader
          selectedRun={selectedRun}
          groups={groups}
          onBack={() => setSelectedRun(null)}
          handleLaunch={handleLaunch}
          handleStatusChange={handleStatusChange}
          handleDeleteRun={handleDeleteRun}
          openManualAdd={openManualAdd}
          evalProgress={evalProgress}
          canReview={canReview}
          handleBatchEvaluate={handleBatchEvaluate}
          t={t}
        />

        {/* ─── AI EVALUATION PROGRESS PANEL ─── */}
        <EvalProgressPanel evalProgress={evalProgress} evalStats={evalStats} t={t} />

        {/* Tabs */}
        <RunTabs tabs={tabs} detailTab={detailTab} onSelect={setDetailTab} />

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <RunResponsesPanel bulkAbortRef={bulkAbortRef} filterRowRef={filterRowRef} runBulkApprove={runBulkApprove} ctx={ctx} />

          <RunAdminTabs retryAbortRef={retryAbortRef} runRetryEmails={runRetryEmails} ctx={ctx} />
        </div>

        <RunDetailModals ctx={ctx} />

      </div>
    );
  }

  // ─── LIST VIEW ───

    <RunListView ctx={ctx} />
}

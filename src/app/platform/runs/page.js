"use client";


import { useState as useState, useEffect as useEffect, useCallback as useCallback, useRef as useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { usePermissions } from "@/lib/PermissionProvider";
import { useDialogs } from "@/components/ui/DialogProvider";
import {
  EMPTY_RUN_LIST,
  pickRunList, pickPaymentsBySubmission,
} from "@/components/platform/runs/helpers";
import useRunResponseFilters from "./useRunResponseFilters";
import useRunBulkActions from "./useRunBulkActions";
import useRunsReferenceData from "./useRunsReferenceData";
import useRunDerivedData from "./useRunDerivedData";
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
import RunListView from "@/components/platform/runs/RunListView";
import RunDetailView from "@/components/platform/runs/RunDetailView";


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
  const {
    forms,
    contacts,
    groups,
    programs,
    dashboardStats,
    fetchGroups,
  } = useRunsReferenceData();
  const canReview = can("runs", "review");
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
  const {
    respSearch, setRespSearch,
    scoreOp, setScoreOp,
    scoreValue, setScoreValue,
    scoreValue2, setScoreValue2,
    fieldFilters, setFieldFilters,
    approvalEmailFilter, setApprovalEmailFilter,
    activationEmailFilter, setActivationEmailFilter,
    reviewFilter, setReviewFilter,
    accountStatusFilter, setAccountStatusFilter,
    fieldLabels, setFieldLabels,
    filterableFields, setFilterableFields,
    filterPickerOpen, setFilterPickerOpen,
    filterPickerMode, setFilterPickerMode,
    filterRowRef,
    respPage, setRespPage,
    selectedIds, setSelectedIds,
    showDuplicates, setShowDuplicates,
    resetFilters,
  } = useRunResponseFilters(subFilter);
  // The payment side of the open Execution's responses. Separate read, so the
  // platform surface never needs the LMS tables and the run's own read budget is
  // unchanged; without the capability the column simply stays empty.
  const paymentsRead = useApi(
    selectedRun?.id ? `/api/lms/registrations?runId=${encodeURIComponent(selectedRun.id)}&perPage=200` : null,
    { defaultValue: { bySubmission: {} }, transform: pickPaymentsBySubmission, deps: [selectedRun?.id] },
  );
  const paymentsBySubmission = paymentsRead.data.bySubmission;
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
  const openRunRef = useRef(null);
  const {
    bulkMenuOpen, setBulkMenuOpen,
    bulkConfirmOpen, setBulkConfirmOpen,
    bulkProcessing,
    bulkProgress,
    bulkSummary, setBulkSummary,
    bulkIncludeResultPdf, setBulkIncludeResultPdf,
    bulkAbortRef,
    retrySelected, setRetrySelected,
    retryProcessing,
    retryProgress,
    retrySummary, setRetrySummary,
    retryAbortRef,
    activationConfirmOpen, setActivationConfirmOpen,
    activationForceResend, setActivationForceResend,
    activationProcessing, setActivationProcessing,
    activationProgress, setActivationProgress,
    resultConfirmOpen, setResultConfirmOpen,
    resultProcessing, setResultProcessing,
    resultProgress, setResultProgress,
    resultPreviewId, setResultPreviewId,
    previewSubmission, setPreviewSubmission,
    previewNonce, setPreviewNonce,
    reportRegenerating, setReportRegenerating,
    resetBulk,
    runBulkApprove,
    runRetryEmails,
  } = useRunBulkActions({ selectedRun, selectedIds, setSelectedIds, openRunRef, notify });

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
          resetFilters();
          setReportFileText(null);
          setReportFileTextOpen(false);
          resetBulk();
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
  }, [resetFilters, resetBulk, setFieldLabels, setFilterableFields, setDetailTab, setSelectedRun]);
  useEffect(() => { openRunRef.current = openRun; }, [openRun]);














































































  const [emailStatusFilter, setEmailStatusFilter] = useState("all");
  const [emailDateFrom, setEmailDateFrom] = useState("");
  const [emailDateTo, setEmailDateTo] = useState("");
  const [emailSearch, setEmailSearch] = useState("");
  const [emailTypeFilter, setEmailTypeFilter] = useState("all"); // all | approval | activation
  const [emailPage, setEmailPage] = useState(1);
  const {
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
  } = useRunDerivedData({
    fieldLabels,
    emailLog,
    reviews,
    selectedRun,
    submissions,
    evaluations,
    subFilter,
    respSearch,
    scoreOp,
    scoreValue,
    scoreValue2,
    fieldFilters,
    approvalEmailFilter,
    activationEmailFilter,
    reviewFilter,
    accountStatusFilter,
    filterableFields,
    showDuplicates,
    respPage,
    perPage,
    selectedIds,
    emailStatusFilter,
    emailDateFrom,
    emailDateTo,
    emailSearch,
    emailTypeFilter,
    emailPage,
    retrySelected,
  });





























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
    setDetailTab,
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
    evalProgress,
    evalStats,
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
    return <RunDetailView bulkAbortRef={bulkAbortRef} filterRowRef={filterRowRef} runBulkApprove={runBulkApprove} retryAbortRef={retryAbortRef} runRetryEmails={runRetryEmails} ctx={ctx} />;
  }

  // ─── LIST VIEW ───
  return <RunListView ctx={ctx} />
}

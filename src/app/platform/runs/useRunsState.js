"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useApi } from "@/lib/hooks/useApi";
import { usePermissions } from "@/lib/PermissionProvider";
import { useDialogs } from "@/components/ui/DialogProvider";
import { useI18n } from "@/lib/i18n";
import { pickPaymentsBySubmission } from "@/components/platform/runs/helpers";
import useRunResponseFilters from "./useRunResponseFilters";
import useRunBulkActions from "./useRunBulkActions";
import useRunsReferenceData from "./useRunsReferenceData";
import useRunDerivedData from "./useRunDerivedData";
import { useRunsUiState } from "./useRunsUiState";

const EMPTY_RUN_LIST = { runs: [], total: 0 };
const pickRunList = (payload) => (payload?.success ? { runs: payload.runs || [], total: payload.total || 0 } : EMPTY_RUN_LIST);

export function useRunsState() {
  const { t } = useI18n();
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

  // All screen state lives in its own hook; destructured here so every name the
  // `values` object and the action factories read is declared in this function.
  const {
    notification, setNotification, statusFilter, setStatusFilter,
    search, setSearch, page, setPage, perPage,
    sortField, setSortField, sortDir, setSortDir,
    selectedRun, setSelectedRun, submissions, setSubmissions,
    reviews, setReviews, assignments, setAssignments,
    subLoading, setSubLoading, detailTab, setDetailTab, subFilter, setSubFilter,
    showCreate, setShowCreate, createData, setCreateData, saving, setSaving,
    showDatePicker, setShowDatePicker,
    showInlineGroup, setShowInlineGroup, inlineGroupName, setInlineGroupName,
    creatingGroup, setCreatingGroup,
    showReview, setShowReview, reviewing, setReviewing, reviewData, setReviewData,
    reviewTimeline, setReviewTimeline, evaluation, setEvaluation,
    reviewIncludeResultPdf, setReviewIncludeResultPdf,
    showAssign, setShowAssign, assignTypes, setAssignTypes,
    assignUserId, setAssignUserId, assignGroupId, setAssignGroupId,
    assignProgramId, setAssignProgramId, assignOtherType, setAssignOtherType,
    assignOtherId, setAssignOtherId,
    runSettings, setRunSettings, editingSettings, setEditingSettings,
    selectedSubmission, setSelectedSubmission, runFormFields, setRunFormFields,
    evalProgress, setEvalProgress, evalStats, setEvalStats,
    evaluations, setEvaluations, emailLog, setEmailLog,
    runTemplates, setRunTemplates, runFormSettings, setRunFormSettings,
    runTplSaving, setRunTplSaving, runPersonalizing, setRunPersonalizing,
    reportFile, setReportFile, reportFileBusy, setReportFileBusy,
    reportFileText, setReportFileText, reportFileTextOpen, setReportFileTextOpen,
    emailStatusFilter, setEmailStatusFilter, emailDateFrom, setEmailDateFrom,
    emailDateTo, setEmailDateTo, emailSearch, setEmailSearch,
    emailTypeFilter, setEmailTypeFilter, emailPage, setEmailPage,
    showMessageComposer, setShowMessageComposer, messageSubject, setMessageSubject,
    messageBody, setMessageBody, messageSending, setMessageSending,
    messageResult, setMessageResult, messageSummary, setMessageSummary,
    aiPersonalizing, setAiPersonalizing,
    showManualAdd, setShowManualAdd, manualAddName, setManualAddName,
    manualAddEmail, setManualAddEmail, manualAdding, setManualAdding,
    showExportOptions, setShowExportOptions, exportFormat, setExportFormat,
    exportScope, setExportScope,
  } = useRunsUiState();

  const notify = useCallback((message) => { setNotification(message); setTimeout(() => setNotification(null), 3000); }, []);

  // Response filters hook
  const responseFilters = useRunResponseFilters(subFilter);

  // Payments read
  const paymentsRead = useApi(
    selectedRun?.id ? `/api/lms/registrations?runId=${encodeURIComponent(selectedRun.id)}&perPage=200` : null,
    { defaultValue: { bySubmission: {} }, transform: pickPaymentsBySubmission, deps: [selectedRun?.id] },
  );
  const paymentsBySubmission = paymentsRead.data.bySubmission;

  // Run list
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

  // Run list failure handling
  const runListRefusal = runList.failure || (runListStatus !== null && runListStatus >= 400 ? String(runListStatus) : null);
  const runListFailure = runListRefusal || runListError || null;
  const [dismissedRunListFailure, setDismissedRunListFailure] = useState(null);
  const runListNotice = runListFailure && runListFailure !== dismissedRunListFailure ? t("platformMisc.runs.loadError", { error: runListFailure }) : null;
  useEffect(() => {
    if (!runListNotice) return;
    if (runListRefusal) console.error("[runs] list error:", runListRefusal);
    else console.error("[runs] list fetch failed:", runListError);
    const timer = setTimeout(() => setDismissedRunListFailure(runListFailure), 3000);
    return () => clearTimeout(timer);
  }, [runListNotice, runListFailure, runListRefusal, runListError]);

  // Derived data
  const derived = useRunDerivedData({
    fieldLabels: responseFilters.fieldLabels,
    emailLog,
    reviews,
    selectedRun,
    submissions,
    evaluations,
    subFilter,
    respSearch: responseFilters.respSearch,
    scoreOp: responseFilters.scoreOp,
    scoreValue: responseFilters.scoreValue,
    scoreValue2: responseFilters.scoreValue2,
    fieldFilters: responseFilters.fieldFilters,
    approvalEmailFilter: responseFilters.approvalEmailFilter,
    activationEmailFilter: responseFilters.activationEmailFilter,
    reviewFilter: responseFilters.reviewFilter,
    accountStatusFilter: responseFilters.accountStatusFilter,
    filterableFields: responseFilters.filterableFields,
    showDuplicates: responseFilters.showDuplicates,
    respPage: responseFilters.respPage,
    perPage,
    selectedIds: responseFilters.selectedIds,
    emailStatusFilter,
    emailDateFrom,
    emailDateTo,
    emailSearch,
    emailTypeFilter,
    emailPage,
    retrySelected: responseFilters.retrySelected,
  });

  // Bulk actions hook
  const openRunRef = useRef(null);
  const bulkActions = useRunBulkActions({ selectedRun, selectedIds: responseFilters.selectedIds, setSelectedIds: responseFilters.setSelectedIds, openRunRef, notify });

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
        setReportFile(data.report_file || null);
        setEvaluations(data.evaluations || []);
        setEmailLog(data.emails || []);
        setRunTemplates(data.run?.settings?.templates || {});
        responseFilters.setFieldLabels(data.field_labels || {});
        responseFilters.setFilterableFields(data.filterable_fields || []);
        if (!options.keepTab) {
          responseFilters.resetFilters();
          setReportFileText(null);
          setReportFileTextOpen(false);
          bulkActions.resetBulk();
        }
      }

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
  }, [responseFilters.resetFilters, bulkActions.resetBulk, responseFilters.setFieldLabels, responseFilters.setFilterableFields, setDetailTab, setSelectedRun]);
  useEffect(() => { openRunRef.current = openRun; }, [openRun]);

  // Values object
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
    respSearch: responseFilters.respSearch,
    setRespSearch: responseFilters.setRespSearch,
    scoreOp: responseFilters.scoreOp,
    setScoreOp: responseFilters.setScoreOp,
    scoreValue: responseFilters.scoreValue,
    setScoreValue: responseFilters.setScoreValue,
    scoreValue2: responseFilters.scoreValue2,
    setScoreValue2: responseFilters.setScoreValue2,
    fieldFilters: responseFilters.fieldFilters,
    setFieldFilters: responseFilters.setFieldFilters,
    approvalEmailFilter: responseFilters.approvalEmailFilter,
    setApprovalEmailFilter: responseFilters.setApprovalEmailFilter,
    activationEmailFilter: responseFilters.activationEmailFilter,
    setActivationEmailFilter: responseFilters.setActivationEmailFilter,
    reviewFilter: responseFilters.reviewFilter,
    setReviewFilter: responseFilters.setReviewFilter,
    accountStatusFilter: responseFilters.accountStatusFilter,
    setAccountStatusFilter: responseFilters.setAccountStatusFilter,
    fieldLabels: responseFilters.fieldLabels,
    filterPickerOpen: responseFilters.filterPickerOpen,
    setFilterPickerOpen: responseFilters.setFilterPickerOpen,
    filterPickerMode: responseFilters.filterPickerMode,
    setFilterPickerMode: responseFilters.setFilterPickerMode,
    setRespPage: responseFilters.setRespPage,
    selectedIds: responseFilters.selectedIds,
    setSelectedIds: responseFilters.setSelectedIds,
    visibleSubmissions: derived.visibleSubmissions,
    setEmailTypeFilter: derived.setEmailTypeFilter,
    setEmailSearch: derived.setEmailSearch,
    setEmailStatusFilter: derived.setEmailStatusFilter,
    setEmailDateFrom: derived.setEmailDateFrom,
    setEmailDateTo: derived.setEmailDateTo,
    setEmailPage: derived.setEmailPage,
    visibleEmailRows: derived.visibleEmailRows,
    emailTypeFilter: derived.emailTypeFilter,
    emailSearch: derived.emailSearch,
    emailStatusFilter: derived.emailStatusFilter,
    emailDateFrom: derived.emailDateFrom,
    emailDateTo: derived.emailDateTo,
    emailPage: derived.emailPage,
    retryableVisible: derived.retryableVisible,
    safeEmailPage: derived.safeEmailPage,
    pagedEmailRows: derived.pagedEmailRows,
    retrySelectedSet: derived.retrySelectedSet,
    emailSummary: derived.emailSummary,
    emailTotalPages: derived.emailTotalPages,
    allEmailRows: derived.allEmailRows,
    emailStatusSets: derived.emailStatusSets,
    subtotal: derived.subtotal,
    submitted: derived.submitted,
    approved: derived.approved,
    rejected: derived.rejected,
    revision: derived.revision,
    drafts: derived.drafts,
    overdue: derived.overdue,
    scoreChipLabel: derived.scoreChipLabel,
    selectedSet: derived.selectedSet,
    respTotalPages: derived.respTotalPages,
    scoreChipActive: derived.scoreChipActive,
    respSafePage: derived.respSafePage,
    // Handed to the responses table as-is. It is read from the LMS registrations
    // of the selected Execution (see `paymentsRead`), NOT from `derived` — the
    // derived-data hook never produced it, so routing it through `derived` left
    // the table with `undefined` and crashed the row map on the first submission.
    paymentsBySubmission,
    filteredSubmissions: derived.filteredSubmissions,
    pagedSubmissions: derived.pagedSubmissions,
    evaluatedSubmissionIds: derived.evaluatedSubmissionIds,
    fieldOptionsOf: derived.fieldOptionsOf,
    eligibleSendActivationIds: derived.eligibleSendActivationIds,
    eligibleSendResultIds: derived.eligibleSendResultIds,
    duplicateGroups: derived.duplicateGroups,
    eligibleResendActivationIds: derived.eligibleResendActivationIds,
    availableParams: derived.availableParams,
    duplicateEmailSet: derived.duplicateEmailSet,
    allFilteredSelected: derived.allFilteredSelected,
    allSelectedEvaluated: derived.allSelectedEvaluated,
    activeFieldFilters: derived.activeFieldFilters,
    activeTrackingFilters: derived.activeTrackingFilters,
    submissionAnswers: derived.submissionAnswers,
    showDuplicates: responseFilters.showDuplicates,
    setShowDuplicates: responseFilters.setShowDuplicates,
    bulkMenuOpen: bulkActions.bulkMenuOpen,
    setBulkMenuOpen: bulkActions.setBulkMenuOpen,
    bulkConfirmOpen: bulkActions.bulkConfirmOpen,
    setBulkConfirmOpen: bulkActions.setBulkConfirmOpen,
    bulkProcessing: bulkActions.bulkProcessing,
    bulkProgress: bulkActions.bulkProgress,
    bulkSummary: bulkActions.bulkSummary,
    setBulkSummary: bulkActions.setBulkSummary,
    bulkIncludeResultPdf: bulkActions.bulkIncludeResultPdf,
    setBulkIncludeResultPdf: bulkActions.setBulkIncludeResultPdf,
    retrySelected: responseFilters.retrySelected,
    setRetrySelected: responseFilters.setRetrySelected,
    retryProcessing: bulkActions.retryProcessing,
    retryProgress: bulkActions.retryProgress,
    retrySummary: bulkActions.retrySummary,
    setRetrySummary: bulkActions.setRetrySummary,
    activationConfirmOpen: bulkActions.activationConfirmOpen,
    setActivationConfirmOpen: bulkActions.setActivationConfirmOpen,
    activationForceResend: bulkActions.activationForceResend,
    setActivationForceResend: bulkActions.setActivationForceResend,
    activationProcessing: bulkActions.activationProcessing,
    setActivationProcessing: bulkActions.setActivationProcessing,
    activationProgress: bulkActions.activationProgress,
    setActivationProgress: bulkActions.setActivationProgress,
    resultConfirmOpen: bulkActions.resultConfirmOpen,
    setResultConfirmOpen: bulkActions.setResultConfirmOpen,
    resultProcessing: bulkActions.resultProcessing,
    setResultProcessing: bulkActions.setResultProcessing,
    resultProgress: bulkActions.resultProgress,
    setResultProgress: bulkActions.setResultProgress,
    resultPreviewId: bulkActions.resultPreviewId,
    setResultPreviewId: bulkActions.setResultPreviewId,
    previewSubmission: bulkActions.previewSubmission,
    setPreviewSubmission: bulkActions.setPreviewSubmission,
    previewNonce: bulkActions.previewNonce,
    setPreviewNonce: bulkActions.setPreviewNonce,
    reportRegenerating: bulkActions.reportRegenerating,
    setReportRegenerating: bulkActions.setReportRegenerating,
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
    ...derived,
  };

  return {
    values,
    bulkActions,
    openRunRef,
    responseFilters,
    setSelectedRun,
    setSubmissions,
    setReviews,
    setAssignments,
    setRunSettings,
    setReportFile,
    setEvaluations,
    setEmailLog,
    setRunTemplates,
    setRunFormFields,
    setRunFormSettings,
    setSubLoading,
    setDetailTab,
    setSubFilter,
  };
}
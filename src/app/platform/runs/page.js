"use client";

import { useI18n } from "@/lib/i18n";
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
import { useRunsState } from "./useRunsState";

/**
 * PLATFORM FORM RUNS — Launch, assign, collect, review
 * Module 4 — Full implementation with assignments, settings, timeline, and enhanced review.
 */

export default function FormRunsPage() {
  const { t } = useI18n();

  const {
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
  } = useRunsState();

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
  if (values.selectedRun) {
    return <RunDetailView bulkAbortRef={bulkActions.bulkAbortRef} filterRowRef={responseFilters.filterRowRef} runBulkApprove={bulkActions.runBulkApprove} retryAbortRef={bulkActions.retryAbortRef} runRetryEmails={bulkActions.runRetryEmails} ctx={ctx} />;
  }

  // ─── LIST VIEW ───
  return <RunListView ctx={ctx} />;
}
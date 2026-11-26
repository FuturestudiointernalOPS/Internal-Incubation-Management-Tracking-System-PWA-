"use client";

/**
 * The platform-runs screen's UI state: every `useState` the hook owns, grouped
 * in one place. Extracted verbatim from useRunsState so that hook stays within
 * the line guardrail; the state values, setters and defaults are unchanged.
 */
import { useState } from "react";

export function useRunsUiState() {
  // ── Core state ──
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
  const [subFilter, setSubFilter] = useState("all");

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createData, setCreateData] = useState({ form_id: "", name: "", description: "", opens_at: "", closes_at: "", group_id: "" });
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Inline group creation
  const [showInlineGroup, setShowInlineGroup] = useState(false);
  const [inlineGroupName, setInlineGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Review modal
  const [showReview, setShowReview] = useState(false);
  const [reviewing, setReviewing] = useState(null);
  const [reviewData, setReviewData] = useState({ decision: "approved", comment: "", internal_note: "" });
  const [reviewTimeline, setReviewTimeline] = useState([]);
  const [evaluation, setEvaluation] = useState(null);
  const [reviewIncludeResultPdf, setReviewIncludeResultPdf] = useState(false);

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

  // AI Evaluation progress state
  const [evalProgress, setEvalProgress] = useState(null);
  const [evalStats, setEvalStats] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [emailLog, setEmailLog] = useState([]);
  const [runTemplates, setRunTemplates] = useState({});
  const [runFormSettings, setRunFormSettings] = useState({});
  const [runTplSaving, setRunTplSaving] = useState(false);
  const [runPersonalizing, setRunPersonalizing] = useState(null);
  const [reportFile, setReportFile] = useState(null);
  const [reportFileBusy, setReportFileBusy] = useState(false);
  const [reportFileText, setReportFileText] = useState(null);
  const [reportFileTextOpen, setReportFileTextOpen] = useState(false);

  // Email log filters
  const [emailStatusFilter, setEmailStatusFilter] = useState("all");
  const [emailDateFrom, setEmailDateFrom] = useState("");
  const [emailDateTo, setEmailDateTo] = useState("");
  const [emailSearch, setEmailSearch] = useState("");
  const [emailTypeFilter, setEmailTypeFilter] = useState("all");
  const [emailPage, setEmailPage] = useState(1);

  // Manual message composer
  const [showMessageComposer, setShowMessageComposer] = useState(false);
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [messageSending, setMessageSending] = useState(false);
  const [messageResult, setMessageResult] = useState(null);
  const [messageSummary, setMessageSummary] = useState(null);
  const [aiPersonalizing, setAiPersonalizing] = useState(false);

  // Manual add respondent
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualAddName, setManualAddName] = useState("");
  const [manualAddEmail, setManualAddEmail] = useState("");
  const [manualAdding, setManualAdding] = useState(false);

  // Export options
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [exportFormat, setExportFormat] = useState("csv");
  const [exportScope, setExportScope] = useState("filtered");

  return {
    notification,
    setNotification,
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
    setSubmissions,
    reviews,
    setReviews,
    assignments,
    setAssignments,
    subLoading,
    setSubLoading,
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
    evalProgress,
    setEvalProgress,
    evalStats,
    setEvalStats,
    evaluations,
    setEvaluations,
    emailLog,
    setEmailLog,
    runTemplates,
    setRunTemplates,
    runFormSettings,
    setRunFormSettings,
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
    emailPage,
    setEmailPage,
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
  };
}

"use client";

import { useCallback, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import {
  EMAIL_PAGE_SIZE,
  RETRYABLE_EMAIL_STATUSES,
  TRACKING_FILTERS,
} from "@/components/platform/runs/constants";
import { accountStatusOf, fmtAnswer } from "@/components/platform/runs/helpers";

/**
 * Everything the open Execution DERIVES from its own reads and filter state:
 * the respondent table's filtered/visible/paged rows, the duplicate-room
 * view, the email delivery summary and tray, the activation and result
 * eligibility sets and the status counts. Same-layer move: the page keeps every
 * state value and every write; this hook only computes, from the reads it
 * receives as parameters, so a change to a read or a filter re-derives here
 * exactly as it did inline.
 */
export default function useRunDerivedData({
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
}) {
  const { t } = useI18n();

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

  // The PDF opt-in needs an evaluation on EVERY selected submission — the server
  // refuses an approval whose document cannot follow.
  const allSelectedEvaluated = selectedIds.every((id) => evaluations.some((evaluation) => evaluation.submission_id === id));

  // ─── Email delivery summary: latest row per (submission, email_type) ───
  const emailSummary = useMemo(() => {
    const latest = new Map();
    for (const email of emailLog) latest.set(`${email.submission_id}:${email.email_type}`, email);
    const empty = () => ({ sent: 0, delivered: 0, opened: 0, clicked: 0, delayed: 0, complained: 0, failed: 0, bounced: 0, cancelled: 0, skipped: 0, pending: 0 });
    const stats = { approval: empty(), activation: empty(), acknowledgement: empty(), result: empty() };
    const notDelivered = [];
    for (const email of latest.values()) {
      const bucket =
        email.email_type === "activation" ? stats.activation
        : email.email_type === "acknowledgement" ? stats.acknowledgement
        : email.email_type === "result" ? stats.result
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

  const subtotal = submissions.length;
  const submitted = submissions.filter((submission) => submission.status === "submitted").length;
  const approved = submissions.filter((submission) => submission.status === "approved").length;
  const rejected = submissions.filter((submission) => submission.status === "rejected").length;
  const revision = submissions.filter((submission) => submission.status === "revision_requested").length;
  const drafts = submissions.filter((submission) => submission.status === "draft").length;
  // "Overdue" only exists relative to a deadline. `selectedRun` can be gone
  // while the previous run's submissions are still in state (closing a run
  // clears the run before the list it fed), so read the deadline defensively
  // rather than dereferencing the run.
  const overdueDeadline = selectedRun?.closes_at ? new Date(selectedRun.closes_at) : null;
  const overdue = overdueDeadline
    ? submissions.filter((submission) => submission.status === "submitted" && submission.submitted_at && new Date(submission.submitted_at) > overdueDeadline).length
    : 0;

  return {
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
  };
}

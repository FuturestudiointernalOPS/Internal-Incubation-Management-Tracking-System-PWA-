/**
 * The run's response filters: chips, tracking filters, and row selection.
 *
 * Cut out of src/app/platform/runs/page.js as-is: no state, no React, no read of
 * its own. The page keeps every state value and every data read, and passes the
 * 26 values this module reads into
 * runFilterActions().
 */

import { ACCOUNT_STATUS_OPTIONS, ACCOUNT_STATUS_STYLES, EMAIL_FILTER_OPTIONS, EMAIL_STATUS_CONFIG, REVIEW_FILTER_OPTIONS, STATUS_FILTER_OPTIONS, SUB_STATUS } from "@/components/platform/runs/constants";

export function runFilterActions({
  accountStatusFilter,
  activationEmailFilter,
  allFilteredSelected,
  approvalEmailFilter,
  fieldFilters,
  respSearch,
  reviewFilter,
  scoreOp,
  scoreValue,
  setAccountStatusFilter,
  setActivationEmailFilter,
  setApprovalEmailFilter,
  setFieldFilters,
  setFilterPickerMode,
  setFilterPickerOpen,
  setRespPage,
  setRespSearch,
  setRetrySelected,
  setReviewFilter,
  setScoreOp,
  setScoreValue,
  setScoreValue2,
  setSelectedIds,
  setSubFilter,
  t,
  visibleSubmissions,
}) {
  const hasRunFilters = !!(
    respSearch.trim() ||
    (scoreOp && scoreValue !== "") ||
    Object.values(fieldFilters).some(Boolean) ||
    approvalEmailFilter ||
    activationEmailFilter ||
    reviewFilter ||
    accountStatusFilter
  );

  const clearRunFilters = () => {
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
    setFilterPickerOpen(false);
    setFilterPickerMode(null);
  };

  const setTrackingFilter = (key, value) => {
    if (key === "approval_email") setApprovalEmailFilter(value);
    else if (key === "review") setReviewFilter(value);
    else if (key === "status") setSubFilter(value || "all");
    else if (key === "activation_email") setActivationEmailFilter(value);
    else if (key === "account_status") setAccountStatusFilter(value);
  };

  const trackingFilterOptions = (key) => {
    if (key === "approval_email" || key === "activation_email") return EMAIL_FILTER_OPTIONS;
    if (key === "review") return REVIEW_FILTER_OPTIONS;
    if (key === "status") return STATUS_FILTER_OPTIONS;
    if (key === "account_status") return ACCOUNT_STATUS_OPTIONS;
    return [];
  };

  const trackingFilterOptionLabel = (key, optionValue) => {
    if (key === "account_status") {
      const statusStyle = ACCOUNT_STATUS_STYLES[optionValue];
      return statusStyle ? t(statusStyle.label) : optionValue;
    }
    if (key === "approval_email" || key === "activation_email") {
      if (optionValue === "not_sent") return t("platformMisc.runs.emailNotSent");
      return EMAIL_STATUS_CONFIG[optionValue] ? t(EMAIL_STATUS_CONFIG[optionValue].label) : optionValue;
    }
    return SUB_STATUS[optionValue] ? t(SUB_STATUS[optionValue].label) : optionValue;
  };

  const removeFieldFilter = (label) =>
    setFieldFilters((prev) => {
      const next = { ...prev };
      delete next[label];
      return next;
    });

  const clearScoreFilter = () => {
    setScoreOp("");
    setScoreValue("");
    setScoreValue2("");
  };

  const pickFilterParam = (param) => {
    setFilterPickerOpen(false);
    if (param.key === "score") setFilterPickerMode("score");
    else if (param.key.startsWith("field:")) setFilterPickerMode({ type: "field", label: param.label });
    else setFilterPickerMode({ type: "status", key: param.key });
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((selectedId) => selectedId !== id) : [...prev, id]
    );
  };

  const toggleSelectAllFiltered = () => {
    setSelectedIds(allFilteredSelected ? [] : visibleSubmissions.map((submission) => submission.id));
  };

  const toggleRetrySelect = (key) =>
    setRetrySelected((prev) => (prev.includes(key) ? prev.filter((retryKey) => retryKey !== key) : [...prev, key]));

  return {
    hasRunFilters,
    clearRunFilters,
    setTrackingFilter,
    trackingFilterOptions,
    trackingFilterOptionLabel,
    removeFieldFilter,
    clearScoreFilter,
    pickFilterParam,
    toggleSelect,
    toggleSelectAllFiltered,
    toggleRetrySelect,
  };
}

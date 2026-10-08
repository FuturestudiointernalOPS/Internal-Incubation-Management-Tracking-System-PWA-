"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { EMPTY_SELECTION } from "@/components/platform/runs/helpers";

/**
 * The respondent table's filter combination and everything remembered WITH it.
 *
 * A single key identifies the filter combination on screen. The table's page,
 * its selected rows and the duplicates-only view are each remembered together
 * with the combination they belong to and read during render, so a search or
 * filter change needs no effect to reset them: the reset IS the comparison
 * (§4.3 — a reset reachable during render is derived, not written). Each setter
 * takes its identity from the combination in force, because the record it
 * writes is keyed on that combination.
 *
 * `subFilter` stays page state (the run's status tab) but participates in the
 * key, so it is passed in.
 */
export default function useRunResponseFilters(subFilter) {
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

  const respFilterKey = JSON.stringify([
    respSearch, scoreOp, scoreValue, scoreValue2, fieldFilters, subFilter,
    approvalEmailFilter, activationEmailFilter, reviewFilter, accountStatusFilter,
  ]);

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

  const [duplicatesKey, setDuplicatesKey] = useState(null); // duplicates-only view
  const showDuplicates = duplicatesKey === respFilterKey;
  const setShowDuplicates = useCallback(
    (next) => {
      const open = typeof next === "function" ? next(showDuplicates) : next;
      setDuplicatesKey(open ? respFilterKey : null);
    },
    [respFilterKey, showDuplicates],
  );

  // Fresh run → reset search/filters so nothing leaks across runs. Pairs with
  // the keyed records above: the write is keyed on the combination in force, so
  // after the filter values change the records fall out of reach by comparison.
  const resetFilters = useCallback(() => {
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
    setFilterPickerOpen(false);
    setFilterPickerMode(null);
  }, [setRespPage, setSelectedIds, setShowDuplicates]);

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

  return {
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
  };
}

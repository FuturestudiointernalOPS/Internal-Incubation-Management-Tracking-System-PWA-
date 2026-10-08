"use client";

import { useCallback, useState } from "react";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";

export function useAdminActions({ tasks, assignments, fetchWidgetData, t, lang, router }) {
  const [processingId, setProcessingId] = useState(null);
  const [resolvingBlocker, setResolvingBlocker] = useState(null);

  const handleResolveBlocker = useCallback(async (blockerId) => {
    setResolvingBlocker(blockerId);
    try {
      await fetch("/api/blockers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: blockerId,
          status: "resolved",
          resolved_by: "sa",
        }),
      });
      fetchWidgetData();
    } catch (error) {
      console.error(error);
    } finally {
      setResolvingBlocker(null);
    }
  }, [fetchWidgetData]);

  const handleAssignmentAction = useCallback(async (task, action) => {
    setProcessingId(task.id);
    try {
      await fetch("/api/tasks/assignment-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: task.id,
          user_id:
            JSON.parse(
              localStorage.getItem("user") || "{}",
            ).cid || "sa",
          action,
        }),
      });
      fetchWidgetData();
    } finally {
      setProcessingId(null);
    }
  }, [fetchWidgetData]);

  const handlePrevMonth = useCallback((calYear, calMonth, setCalYear, setCalMonth) => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear(calYear - 1);
    } else setCalMonth(calMonth - 1);
  }, []);

  const handleNextMonth = useCallback((calYear, calMonth, setCalYear, setCalMonth) => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear(calYear + 1);
    } else setCalMonth(calMonth + 1);
  }, []);

  return {
    processingId,
    setProcessingId,
    handleAssignmentAction,
    handlePrevMonth,
    handleNextMonth,
  };
}
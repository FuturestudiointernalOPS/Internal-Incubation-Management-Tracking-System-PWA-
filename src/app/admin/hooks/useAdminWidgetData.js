"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";
import { formatDate, getCalendarDays } from "@/components/admin/dashboard-page/constants";

export function useAdminWidgetData({ t, lang }) {
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [assignmentsLoading] = useState(false);
  const [activeBlockers, setActiveBlockers] = useState([]);
  const [resolvingBlocker, setResolvingBlocker] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [expandedCalendarDays, setExpandedCalendarDays] = useState({});

  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  const fetchWidgetData = useCallback(async () => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const userId = user.cid || user.id;
      const isSA = user.role === "super_admin";

      const urls = [
        isSA
          ? "/api/tasks?brief=true"
          : `/api/tasks?user_id=${userId}&brief=true`,
        isSA
          ? "/api/blockers?status=active"
          : `/api/blockers?user_id=${userId}&status=active`,
      ];
      if (userId) urls.push(`/api/tasks?assigned_to=${userId}&brief=true`);

      const apply = (taskData, blockerData, assignData) => {
        if (taskData && taskData.success) setTasks(taskData.tasks || []);
        if (blockerData && blockerData.success)
          setActiveBlockers(blockerData.blockers || []);
        if (assignData && assignData.success)
          setAssignments(assignData.tasks || []);
      };

      const cached = urls.map((url) => cacheGet(url));
      if (cached.every((cachedItem) => cachedItem !== null)) {
        apply(cached[0], cached[1], cached[2]);
      }

      const responses = await Promise.all(urls.map((url) => fetch(url)));
      const payloads = await Promise.all(
        responses.map((response) => response.json()),
      );
      urls.forEach((url, index) => cacheSet(url, payloads[index]));
      apply(payloads[0], payloads[1], payloads[2]);
    } catch (error) {
      console.error("Widget data fetch error:", error);
    }
  }, []);

  useEffect(() => {
    fetchWidgetData();
  }, [fetchWidgetData]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__refreshAdminDashboard = fetchWidgetData;
    }
    return () => {
      if (typeof window !== "undefined") delete window.__refreshAdminDashboard;
    };
  }, [fetchWidgetData]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchWidgetData();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchWidgetData]);

  const handlePrevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear(calYear - 1);
    } else setCalMonth(calMonth - 1);
  };
  const handleNextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear(calYear + 1);
    } else setCalMonth(calMonth + 1);
  };

  const handleResolveBlocker = async (blockerId) => {
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
  };

  const handleAssignmentAction = async (task, action) => {
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
  };

  // Calendar computed
  const calendarDays = getCalendarDays(calYear, calMonth);

  const calendarSpans = useMemo(() => {
    const spans = {};
    const allTasks = [...(tasks || []), ...(assignments || [])];
    allTasks.forEach((task) => {
      if (!task.start_date || !task.end_date) return;
      const start = new Date(task.start_date);
      const end = new Date(task.end_date);
      const current = new Date(start);
      current.setDate(current.getDate() + 1);
      while (current < end) {
        const key = formatDate(
          current.getFullYear(),
          current.getMonth(),
          current.getDate(),
        );
        spans[`${key}:${task.id}`] = "middle";
        current.setDate(current.getDate() + 1);
      }
    });
    return spans;
  }, [tasks, assignments]);

  const calendarTasks = useMemo(() => {
    const cal = {};
    const allTasks = [...(tasks || []), ...(assignments || [])];
    const seen = new Set();
    const unique = allTasks.filter((task) => {
      if (seen.has(task.id)) return false;
      seen.add(task.id);
      return true;
    });
    unique.forEach((task) => {
      if (task.start_date || task.end_date) {
        const start = task.start_date ? new Date(task.start_date) : null;
        const end = task.end_date ? new Date(task.end_date) : null;
        if (start && end) {
          const current = new Date(start);
          while (current <= end) {
            const key = formatDate(
              current.getFullYear(),
              current.getMonth(),
              current.getDate(),
            );
            if (!cal[key]) cal[key] = [];
            cal[key].push(task);
            current.setDate(current.getDate() + 1);
          }
        } else if (start) {
          const key = formatDate(
            start.getFullYear(),
            start.getMonth(),
            start.getDate(),
          );
          if (!cal[key]) cal[key] = [];
          cal[key].push(task);
        } else if (end) {
          const key = formatDate(
            end.getFullYear(),
            end.getMonth(),
            end.getDate(),
          );
          if (!cal[key]) cal[key] = [];
          cal[key].push(task);
        }
      }
    });
    return cal;
  }, [tasks, assignments]);

  return {
    tasks,
    selectedTask,
    setSelectedTask,
    assignments,
    assignmentsLoading,
    activeBlockers,
    resolvingBlocker,
    setResolvingBlocker,
    processingId,
    expandedCalendarDays,
    setExpandedCalendarDays,
    calYear,
    setCalYear,
    calMonth,
    setCalMonth,
    handlePrevMonth,
    handleNextMonth,
    handleResolveBlocker,
    handleAssignmentAction,
    calendarDays,
    calendarTasks,
    calendarSpans,
    fetchWidgetData,
  };
}
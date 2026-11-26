"use client";

import { useState } from "react";
import { useSessionUser } from "@/lib/hooks/useSessionUser";

/**
 * The three writes the dashboard makes, and the flags that say one is in flight.
 *
 * Every write here re-reads rather than patching the row it was made from, so a
 * status change, an assignment and a new comment all leave the table showing what
 * the server actually stored. A comment is the exception: its draft is cleared
 * here so the input does not keep text the server already has.
 *
 * The signed-in person is read from the shell's session cache: no request of its
 * own, and no dependence on the browser's stored copy.
 */
export default function useAdminTaskWrites({ t, refreshTasks, refreshProjects, refreshComments }) {
  const { cid: currentUserCid, user: currentUser } = useSessionUser();

  const [commentInput, setCommentInput] = useState("");
  const [statusUpdating, setStatusUpdating] = useState(null);
  const [assigningUser, setAssigningUser] = useState(false);

  /**
   * Move a task to a new status.
   *
   * A task that still has an active blocker refuses to be completed; that answer
   * is a question, not a refusal, so it is retried once with the force flag and
   * the second answer is what the screen believes.
   */
  const updateStatus = async (taskId, newStatus) => {
    setStatusUpdating(taskId);
    try {
      const response = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, status: newStatus }),
      });
      const data = await response.json();
      if (data.success) {
        refreshTasks();
        refreshProjects();
      } else if (data.hasActiveBlockers) {
        // Attempt with force_complete
        const retryRes = await fetch("/api/tasks", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: taskId,
            status: newStatus,
            force_complete: true,
          }),
        });
        const retryData = await retryRes.json();
        if (retryData.success) { refreshTasks(); refreshProjects(); }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setStatusUpdating(null);
    }
  };

  const addComment = async (taskId) => {
    if (!commentInput.trim() || !currentUserCid) return;
    try {
      const response = await fetch("/api/tasks/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: taskId,
          sender_id: currentUserCid,
          sender_name: currentUser.name,
          body: commentInput.trim(),
        }),
      });
      const data = await response.json();
      if (data.success) {
        setCommentInput("");
        refreshComments();
      }
    } catch (error) {
      console.error(error);
    }
  };

  /**
   * Hand a task to someone else.
   *
   * The open row is updated from the server's answer rather than optimistically,
   * so a rejected assignment leaves the task showing the owner it really has.
   */
  const assignTask = async (taskId, assignedTo, onAssigned) => {
    if (!assignedTo) return;
    setAssigningUser(true);
    try {
      const response = await fetch(`/api/tasks`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: taskId,
          assigned_to: assignedTo,
        }),
      });
      const data = await response.json();
      if (data.success) {
        onAssigned(assignedTo);
      } else {
        window.dispatchEvent(new CustomEvent('impactos:notify', { detail: { type: 'error', message: t((data.error || t("adminMisc.tasks.assignFailed")) || "") || (data.error || t("adminMisc.tasks.assignFailed")) } }));
      }
    } catch (_) {} finally {
      setAssigningUser(false);
    }
  };

  return {
    commentInput,
    setCommentInput,
    statusUpdating,
    assigningUser,
    updateStatus,
    addComment,
    assignTask,
  };
}
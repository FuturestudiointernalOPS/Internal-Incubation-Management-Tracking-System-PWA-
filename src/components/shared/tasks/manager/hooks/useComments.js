"use client";

import { useState, useCallback } from "react";

/**
 * A task's comment thread.
 *
 * Comments are fetched the first time a thread is opened and then kept, so
 * re-opening it is instant; a newly posted comment is inserted locally from the
 * server's answer rather than re-reading the whole thread.
 */
export default function useComments({ userId, userName, onTasksChange }) {
  const uid = userId;

  const [openComments, setOpenComments] = useState(null); // task id or null
  const [commentsByTask, setCommentsByTask] = useState({});
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  const toggleComments = useCallback(
    async (taskId) => {
      if (openComments === taskId) {
        setOpenComments(null);
        return;
      }
      setOpenComments(taskId);
      if (!commentsByTask[taskId]) {
        setLoadingComments(true);
        try {
          const res = await fetch(`/api/tasks/comments?task_id=${taskId}`);
          const data = await res.json();
          if (data.success) {
            setCommentsByTask((prev) => ({
              ...prev,
              [taskId]: data.comments || [],
            }));
          }
        } catch (error) {
          console.error(error);
        } finally {
          setLoadingComments(false);
        }
      }
    },
    [openComments, commentsByTask],
  );

  const postComment = useCallback(
    async (taskId) => {
      const text = newComment.trim();
      if (!text) return;
      setPostingComment(true);
      try {
        const res = await fetch("/api/tasks/comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task_id: taskId,
            sender_id: uid,
            sender_name: userName || "User",
            body: text,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setCommentsByTask((prev) => ({
            ...prev,
            [taskId]: [
              ...(prev[taskId] || []),
              {
                id: data.id,
                task_id: taskId,
                sender_id: uid,
                sender_name: userName || "User",
                body: text,
                created_at: data.created_at || new Date().toISOString(),
              },
            ],
          }));
          setNewComment("");
          if (onTasksChange) onTasksChange();
        }
      } catch (error) {
        console.error(error);
      } finally {
        setPostingComment(false);
      }
    },
    [newComment, uid, userName, onTasksChange],
  );

  return {
    openComments,
    commentsByTask,
    loadingComments,
    newComment,
    setNewComment,
    postingComment,
    toggleComments,
    postComment,
  };
}
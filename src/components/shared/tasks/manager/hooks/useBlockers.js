"use client";

import { useState, useCallback } from "react";

/**
 * Blockers on a task, and the discussion under each one.
 *
 * A blocker is raised against a task, resolved when it stops being in the way,
 * and can carry its own thread — the same fetch-then-keep shape as task comments,
 * because a blocker discussion is also read once per blocker.
 */
export default function useBlockers({ userId, userName, onTasksChange }) {
  const uid = userId;

  const [blockerModal, setBlockerModal] = useState(null); // { taskId, taskTitle } or null
  const [blockerTitle, setBlockerTitle] = useState("");
  const [blockerDescription, setBlockerDescription] = useState("");
  const [blockerPriority, setBlockerPriority] = useState("medium");
  const [blockerRefUrl, setBlockerRefUrl] = useState("");
  const [blockerNotes, setBlockerNotes] = useState("");
  const [blockerAdding, setBlockerAdding] = useState(false);

  // ── Blocker Discussions ──
  const [openBlockerDiscuss, setOpenBlockerDiscuss] = useState(null); // blocker id or null
  const [blockerMessages, setBlockerMessages] = useState({});
  const [newBlockerMsg, setNewBlockerMsg] = useState("");
  const [postingBlockerMsg, setPostingBlockerMsg] = useState(false);

  // ── API: Add blocker to task ──
  const handleAddBlocker = async () => {
    if (!blockerModal || !blockerTitle.trim()) return;
    setBlockerAdding(true);
    try {
      const res = await fetch("/api/blockers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: blockerModal.taskId,
          user_id: uid,
          user_name: userName || "User",
          title: blockerTitle.trim(),
          description: blockerDescription.trim() || null,
          severity: blockerPriority,
          reference_url: blockerRefUrl.trim() || null,
          notes: blockerNotes.trim() || null,
        }),
      });
      if (res.ok) {
        setBlockerModal(null);
        setBlockerTitle("");
        setBlockerDescription("");
        setBlockerPriority("medium");
        setBlockerRefUrl("");
        setBlockerNotes("");
        if (onTasksChange) onTasksChange();
      }
    } catch (error) {
      console.error(error);
    }
    setBlockerAdding(false);
  };

  // ── API: Resolve blocker ──
  const handleResolveBlocker = async (blockerId) => {
    try {
      await fetch("/api/blockers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: blockerId,
          user_id: uid,
          status: "resolved",
          resolved_by: uid,
        }),
      });
      if (onTasksChange) onTasksChange();
    } catch (error) {
      console.error(error);
    }
  };

  const toggleBlockerDiscuss = useCallback(
    async (blockerId) => {
      if (openBlockerDiscuss === blockerId) {
        setOpenBlockerDiscuss(null);
        return;
      }
      setOpenBlockerDiscuss(blockerId);
      setNewBlockerMsg("");
      if (!blockerMessages[blockerId]) {
        try {
          const res = await fetch(`/api/blockers/discuss?blocker_id=${blockerId}`);
          const data = await res.json();
          if (data.success) {
            setBlockerMessages((prev) => ({
              ...prev,
              [blockerId]: data.messages || [],
            }));
          }
        } catch (_) {}
      }
    },
    [openBlockerDiscuss, blockerMessages],
  );

  const postBlockerMessage = useCallback(
    async (blockerId) => {
      const text = newBlockerMsg.trim();
      if (!text) return;
      setPostingBlockerMsg(true);
      try {
        const res = await fetch("/api/blockers/discuss", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blocker_id: blockerId,
            sender_id: uid,
            sender_name: userName || "User",
            body: text,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setBlockerMessages((prev) => ({
            ...prev,
            [blockerId]: [
              ...(prev[blockerId] || []),
              {
                id: data.id,
                sender_id: uid,
                sender_name: userName || "User",
                body: text,
                blocker_id: blockerId,
                created_at: new Date().toISOString(),
              },
            ],
          }));
          setNewBlockerMsg("");
        }
      } catch (_) {}
      setPostingBlockerMsg(false);
    },
    [newBlockerMsg, uid, userName],
  );

  return {
    blockerModal,
    setBlockerModal,
    blockerTitle,
    setBlockerTitle,
    blockerDescription,
    setBlockerDescription,
    blockerPriority,
    setBlockerPriority,
    blockerRefUrl,
    setBlockerRefUrl,
    blockerNotes,
    setBlockerNotes,
    blockerAdding,
    handleAddBlocker,
    handleResolveBlocker,
    openBlockerDiscuss,
    blockerMessages,
    newBlockerMsg,
    setNewBlockerMsg,
    postingBlockerMsg,
    toggleBlockerDiscuss,
    postBlockerMessage,
  };
}
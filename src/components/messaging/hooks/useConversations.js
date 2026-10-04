"use client";

import { useMemo } from "react";

export function useConversations({
  messages,
  contacts,
  families,
  allPrograms,
  uid,
  t,
}) {
  const conversations = useMemo(() => {
    if (!Array.isArray(messages) || !uid) return [];
    const threads = [];
    const seen = new Set();

    for (const message of messages) {
      if (!message) continue;
      let threadId, label, icon, otherId;

      if (message.target_type === "individual") {
        otherId = message.sender_id === uid ? message.recipient_id : message.sender_id;
        if (!otherId) continue;
        threadId = `individual_${otherId}`;
        const contact = contacts.find((candidate) => (candidate.cid || candidate.id) === otherId);
        label = contact?.name || otherId;
        icon = "user";
      } else if (message.target_type === "all") {
        threadId = "broadcast_all";
        label = t("messaging.broadcastAllUsers");
        icon = "broadcast";
      } else if (message.target_type === "role") {
        threadId = `role_${message.target_id}`;
        const family = families.find(
          (candidate) => String(candidate.id) === String(message.target_id),
        );
        label =
          family?.name ||
          (String(message.target_id) === "__staff__"
            ? t("messaging.staffGroup")
            : message.target_id || t("messaging.groupFallback"));
        icon = "group";
      } else if (message.target_type === "program") {
        threadId = `program_${message.target_id}`;
        const program = allPrograms.find((candidate) => candidate.id === message.target_id);
        label = t("messaging.programLabel", {
          name: program?.name || message.target_id,
        });
        icon = "program";
      } else {
        continue;
      }

      if (!seen.has(threadId)) {
        seen.add(threadId);
        threads.push({
          id: threadId,
          label,
          type: message.target_type,
          targetId: message.target_type === "individual" ? otherId : message.target_id,
          lastMessage: message,
          icon,
        });
      }
    }

    threads.sort(
      (leftThread, rightThread) =>
        new Date(rightThread.lastMessage?.created_at || 0) -
        new Date(leftThread.lastMessage?.created_at || 0),
    );
    return threads;
  }, [messages, contacts, families, allPrograms, uid, t]);

  const unreadCounts = useMemo(() => {
    if (!Array.isArray(messages) || !uid) return {};
    const counts = {};
    for (const message of messages) {
      if (!message) continue;
      const isUnread =
        message.recipient_id === uid &&
        (message.is_read === 0 || message.is_read === null || message.is_read === false);
      if (!isUnread) continue;

      let threadId;
      if (message.target_type === "individual") {
        threadId = `individual_${message.sender_id}`;
      } else if (message.target_type === "all") {
        threadId = "broadcast_all";
      } else if (message.target_type === "role") {
        threadId = `role_${message.target_id}`;
      } else if (message.target_type === "program") {
        threadId = `program_${message.target_id}`;
      }
      if (threadId) counts[threadId] = (counts[threadId] || 0) + 1;
    }
    return counts;
  }, [messages, uid]);

  const totalUnread = useMemo(
    () => Object.values(unreadCounts).reduce((total, count) => total + count, 0),
    [unreadCounts],
  );

  const filteredConversations = useMemo(() => {
    return conversations.filter((thread) => {
      return thread.label.toLowerCase().includes(""); // search handled elsewhere
    });
  }, [conversations]);

  return {
    conversations,
    unreadCounts,
    totalUnread,
  };
}
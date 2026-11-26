"use client";

import { useMemo } from "react";

export function useActiveMessages({ messages, activeConversation, uid }) {
  const activeMessages = useMemo(() => {
    if (!activeConversation) return [];
    const seen = new Set();
    return messages
      .filter((message) => {
        if (seen.has(message.id)) return false;
        seen.add(message.id);
        if (activeConversation.type === "individual") {
          const otherId =
            message.sender_id === uid ? message.recipient_id : message.sender_id;
          return otherId === activeConversation.targetId;
        }
        if (activeConversation.type === "all") return message.target_type === "all";
        if (activeConversation.type === "role")
          return (
            message.target_type === "role" &&
            message.target_id === activeConversation.targetId
          );
        if (activeConversation.type === "program")
          return (
            message.target_type === "program" &&
            message.target_id === activeConversation.targetId
          );
        return false;
      })
      .sort(
        (leftMessage, rightMessage) =>
          new Date(leftMessage.created_at).getTime() - new Date(rightMessage.created_at).getTime(),
      );
  }, [messages, activeConversation, uid]);

  return { activeMessages };
}
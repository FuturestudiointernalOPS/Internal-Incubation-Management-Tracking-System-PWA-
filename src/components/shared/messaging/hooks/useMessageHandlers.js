"use client";

import { useCallback } from "react";

export function useMessageHandlers({
  activeConversation,
  uid,
  messages,
  t,
  sending,
  setSending,
  replyText,
  setReplyText,
  replyAttachmentUrl,
  setReplyAttachmentUrl,
  replyAttachmentName,
  setReplyAttachmentName,
  replyShowAttachment,
  setReplyShowAttachment,
  composeBody,
  setComposeBody,
  sendMode,
  composeRecipient,
  setComposeRecipient,
  composeGroupId,
  setComposeGroupId,
  composeProgram,
  setComposeProgram,
  composeAttachmentUrl,
  setComposeAttachmentUrl,
  composeAttachmentName,
  setComposeAttachmentName,
  composeShowAttachment,
  setComposeShowAttachment,
  contactSearch,
  setContactSearch,
  programSearch,
  setProgramSearch,
  showContactDropdown,
  setShowContactDropdown,
  showProgramDropdown,
  setShowProgramDropdown,
  showCompose,
  setShowCompose,
  availableGroups,
  availablePrograms,
  refreshMessages,
}) {
  const handleReply = useCallback(async () => {
    if (!replyText.trim() || !activeConversation || sending) return;
    setSending(true);
    try {
      let payload;
      const attachmentUrl = replyAttachmentUrl.trim() || null;
      const attachmentName = replyAttachmentName.trim() || attachmentUrl || null;
      if (activeConversation.type === "individual") {
        payload = {
          sender_id: uid,
          recipient_id: activeConversation.targetId,
          target_type: "individual",
          subject: t("messaging.noSubject"),
          body: replyText,
          priority: "normal",
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
        };
      } else if (activeConversation.type === "role") {
        payload = {
          sender_id: uid,
          target_type: "role",
          target_id: activeConversation.targetId,
          subject: t("messaging.replyTo", { label: activeConversation.label }),
          body: replyText,
          priority: "normal",
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
        };
      } else if (activeConversation.type === "program") {
        payload = {
          sender_id: uid,
          target_type: "program",
          target_id: activeConversation.targetId,
          subject: t("messaging.replyTo", { label: activeConversation.label }),
          body: replyText,
          priority: "normal",
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
        };
      } else if (activeConversation.type === "all") {
        payload = {
          sender_id: uid,
          target_type: "all",
          subject: t("messaging.reply"),
          body: replyText,
          priority: "normal",
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
        };
      }
      if (!payload) return;
      await fetch("/api/internal-comms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setReplyText("");
      setReplyAttachmentUrl("");
      setReplyAttachmentName("");
      setReplyShowAttachment(false);
      await refreshMessages();
    } catch (error) {
      console.error(error);
    } finally {
      setSending(false);
    }
  }, [
    replyText,
    activeConversation,
    sending,
    uid,
    t,
    replyAttachmentUrl,
    replyAttachmentName,
    setReplyText,
    setReplyAttachmentUrl,
    setReplyAttachmentName,
    setReplyShowAttachment,
    setSending,
    refreshMessages,
  ]);

  const handleReplyKeyDown = useCallback((event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleReply();
    }
  }, [handleReply]);

  const handleSendNew = useCallback(async () => {
    if (!composeBody) return;
    if (sendMode === "individual" && !composeRecipient) return;
    if (sendMode === "group" && !composeGroupId) return;
    if (sendMode === "program" && !composeProgram) return;

    setSending(true);
    try {
      let payload;
      const attachmentUrl = composeAttachmentUrl.trim() || null;
      const attachmentName = composeAttachmentName.trim() || attachmentUrl || null;
      if (sendMode === "individual") {
        payload = {
          sender_id: uid,
          recipient_id: composeRecipient,
          target_type: "individual",
          subject: t("messaging.noSubject"),
          body: composeBody,
          priority: "normal",
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
        };
      } else if (sendMode === "group") {
        payload = {
          sender_id: uid,
          target_type: "role",
          target_id: composeGroupId,
          subject: t("messaging.messageTo", {
            name:
              availableGroups.find(
                (group) => String(group.id) === String(composeGroupId),
              )?.name || t("messaging.groupFallback"),
          }),
          body: composeBody,
          priority: "normal",
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
        };
      } else if (sendMode === "program") {
        const program = availablePrograms.find((candidate) => candidate.id === composeProgram);
        payload = {
          sender_id: uid,
          target_type: "program",
          target_id: composeProgram,
          subject: t("messaging.messageTo", {
            name: program?.name || t("messaging.program"),
          }),
          body: composeBody,
          priority: "normal",
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
        };
      } else if (sendMode === "broadcast") {
        payload = {
          sender_id: uid,
          target_type: "all",
          subject: t("messaging.broadcast"),
          body: composeBody,
          priority: "normal",
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
        };
      }
      if (!payload) return;

      await fetch("/api/internal-comms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setShowCompose(false);
      setComposeRecipient("");
      setComposeGroupId("");
      setComposeProgram("");
      setComposeBody("");
      setComposeAttachmentUrl("");
      setComposeAttachmentName("");
      setComposeShowAttachment(false);
      setContactSearch("");
      setProgramSearch("");
      setShowContactDropdown(false);
      setShowProgramDropdown(false);

      await refreshMessages();
    } catch (error) {
      console.error(error);
    } finally {
      setSending(false);
    }
  }, [
    composeBody,
    sendMode,
    composeRecipient,
    composeGroupId,
    composeProgram,
    uid,
    t,
    composeAttachmentUrl,
    composeAttachmentName,
    availableGroups,
    availablePrograms,
    setShowCompose,
    setComposeRecipient,
    setComposeGroupId,
    setComposeProgram,
    setComposeBody,
    setComposeAttachmentUrl,
    setComposeAttachmentName,
    setComposeShowAttachment,
    setContactSearch,
    setProgramSearch,
    setShowContactDropdown,
    setShowProgramDropdown,
    setSending,
    refreshMessages,
  ]);

  return {
    handleReply,
    handleReplyKeyDown,
    handleSendNew,
  };
}
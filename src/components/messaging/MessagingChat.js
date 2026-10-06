"use client";

import ConversationThread from "@/components/messaging/chat/ConversationThread";
import ConversationList from "@/components/messaging/chat/ConversationList";
import ComposeMessageModal from "@/components/messaging/chat/ComposeMessageModal";
import NewMessageButton from "@/components/messaging/chat/NewMessageButton";
import GlobalToast from "@/components/ui/GlobalToast";

import { useI18n } from "@/lib/i18n";
import { useEffect } from "react";
import { Send, Users, Briefcase, User } from "lucide-react";

import { useMessagingState } from "./hooks/useMessagingState";
import { useMessagingData } from "./hooks/useMessagingData";
import { useDerivedData } from "./hooks/useDerivedData";
import { useConversations } from "./hooks/useConversations";
import { useActiveMessages } from "./hooks/useActiveMessages";
import { useAttachments } from "./hooks/useAttachments";
import { useMessageHandlers } from "./hooks/useMessageHandlers";
import { useFilteredData } from "./hooks/useFilteredData";

const EMPTY_USER = {};

const threadIcon = (thread) => {
  switch (thread.icon) {
    case "group":
      return Users;
    case "program":
      return Briefcase;
    case "broadcast":
      return Send;
    default:
      return User;
  }
};

export default function MessagingChat({
  role = "super_admin",
}) {
  const { t } = useI18n();

  const state = useMessagingState();

  const { user: sessionUser } = useDerivedData;
  const user = sessionUser || EMPTY_USER;
  const uid = user?.cid || user?.id;
  const groupName = user?.group_name;

  const data = useMessagingData({ uid, role, user });

  const derived = useDerivedData({
    role,
    groupName,
    allPrograms: data.allPrograms,
    allContacts: data.allContacts,
    families: data.families,
    uid,
    effectiveUser: data.effectiveUser,
  });

  const conversationsData = useConversations({
    messages: data.messages,
    contacts: derived.contacts,
    families: data.families,
    allPrograms: data.allPrograms,
    uid,
    t,
  });

  const { activeMessages } = useActiveMessages({
    messages: data.messages,
    activeConversation: state.activeConversation,
    uid,
  });

  const { handleReplyFile, handleComposeFile } = useAttachments({ t });

  const handlers = useMessageHandlers({
    activeConversation: state.activeConversation,
    uid,
    messages: data.messages,
    t,
    sending: state.sending,
    setSending: state.setSending,
    replyText: state.replyText,
    setReplyText: state.setReplyText,
    replyAttachmentUrl: state.replyAttachmentUrl,
    setReplyAttachmentUrl: state.setReplyAttachmentUrl,
    replyAttachmentName: state.replyAttachmentName,
    setReplyAttachmentName: state.setReplyAttachmentName,
    replyShowAttachment: state.replyShowAttachment,
    setReplyShowAttachment: state.setReplyShowAttachment,
    composeBody: state.composeBody,
    setComposeBody: state.setComposeBody,
    sendMode: state.sendMode,
    composeRecipient: state.composeRecipient,
    setComposeRecipient: state.setComposeRecipient,
    composeGroupId: state.composeGroupId,
    setComposeGroupId: state.setComposeGroupId,
    composeProgram: state.composeProgram,
    setComposeProgram: state.setComposeProgram,
    composeAttachmentUrl: state.composeAttachmentUrl,
    setComposeAttachmentUrl: state.setComposeAttachmentUrl,
    composeAttachmentName: state.composeAttachmentName,
    setComposeAttachmentName: state.setComposeAttachmentName,
    composeShowAttachment: state.composeShowAttachment,
    setComposeShowAttachment: state.setComposeShowAttachment,
    contactSearch: state.contactSearch,
    setContactSearch: state.setContactSearch,
    programSearch: state.programSearch,
    setProgramSearch: state.setProgramSearch,
    showContactDropdown: state.showContactDropdown,
    setShowContactDropdown: state.setShowContactDropdown,
    showProgramDropdown: state.showProgramDropdown,
    setShowProgramDropdown: state.setShowProgramDropdown,
    showCompose: state.showCompose,
    setShowCompose: state.setShowCompose,
    availableGroups: derived.availableGroups,
    availablePrograms: derived.availablePrograms,
    refreshMessages: data.refreshMessages,
  });

  const filteredData = useFilteredData({
    contacts: derived.contacts,
    availablePrograms: derived.availablePrograms,
    contactSearch: state.contactSearch,
    programSearch: state.programSearch,
    composeRecipient: state.composeRecipient,
  });

  useEffect(() => {
    if (state.activeConversation && state.replyInputRef.current) {
      state.replyInputRef.current.focus();
    }
  }, [state.activeConversation]);

  useEffect(() => {
    if (state.chatEndRef.current) {
      state.chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [state.activeConversation, data.messages]);

  const openConversation = async (thread) => {
    state.setActiveConversation(thread);
    state.setMobileView("chat");

    const unreadIds = data.messages
      .filter((message) => {
        if (message.is_read) return false;
        if (thread.type === "individual") {
          const otherId =
            message.sender_id === uid ? message.recipient_id : message.sender_id;
          return otherId === thread.targetId;
        }
        return false;
      })
      .map((message) => message.id);

    if (unreadIds.length > 0) {
      try {
        await fetch("/api/internal-comms", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageIds: unreadIds }),
        });
        window.dispatchEvent(new Event("notifications:refresh"));
      } catch (_) {}
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 px-6 pt-6">
        <div>
          <h1 className="text-lg font-black uppercase tracking-tight text-[var(--text-primary)]">
            {t("messaging.title")}
          </h1>
          <p className="text-[10px] text-[var(--text-secondary)] mt-1">
            {conversationsData.totalUnread > 0
              ? t("messaging.unreadCount", { count: conversationsData.totalUnread })
              : conversationsData.conversations.length !== 1
              ? t("messaging.conversationCountPlural", {
                  count: conversationsData.conversations.length,
                })
              : t("messaging.conversationCount", {
                  count: conversationsData.conversations.length,
                })}
          </p>
        </div>
        <NewMessageButton
          setShowCompose={state.setShowCompose}
          setContactSearch={state.setContactSearch}
          setComposeRecipient={state.setComposeRecipient}
          setComposeBody={state.setComposeBody}
          setComposeAttachmentUrl={state.setComposeAttachmentUrl}
          setComposeAttachmentName={state.setComposeAttachmentName}
          setComposeShowAttachment={state.setComposeShowAttachment}
          setSendMode={state.setSendMode}
          sendModes={derived.sendModes}
          t={t}
        />
      </div>

      <div className="flex-1 flex min-h-0 px-6 pb-6">
        <ConversationList
          mobileView={state.mobileView}
          t={t}
          search={state.search}
          setSearch={state.setSearch}
          loading={data.loading}
          filteredConversations={conversationsData.conversations.filter((thread) => {
            if (!state.search) return true;
            return thread.label.toLowerCase().includes(state.search.toLowerCase());
          })}
          activeConversation={state.activeConversation}
          unreadCounts={conversationsData.unreadCounts}
          uid={uid}
          threadIcon={threadIcon}
          openConversation={openConversation}
        />

        <ConversationThread
          mobileView={state.mobileView}
          activeConversation={state.activeConversation}
          t={t}
          setMobileView={state.setMobileView}
          threadIcon={threadIcon}
          activeMessages={activeMessages}
          uid={uid}
          chatEndRef={state.chatEndRef}
          replyShowAttachment={state.replyShowAttachment}
          handleReplyFile={handleReplyFile}
          replyUploading={state.replyUploading}
          replyAttachmentUrl={state.replyAttachmentUrl}
          setReplyAttachmentUrl={state.setReplyAttachmentUrl}
          setReplyShowAttachment={state.setReplyShowAttachment}
          setReplyAttachmentName={state.setReplyAttachmentName}
          replyAttachmentName={state.replyAttachmentName}
          replyInputRef={state.replyInputRef}
          replyText={state.replyText}
          setReplyText={state.setReplyText}
          handleReplyKeyDown={handlers.handleReplyKeyDown}
          handleReply={handlers.handleReply}
          sending={state.sending}
        />
      </div>

      {state.showCompose && (
        <ComposeMessageModal
          setShowCompose={state.setShowCompose}
          t={t}
          sendModes={derived.sendModes}
          setSendMode={state.setSendMode}
          sendMode={state.sendMode}
          selectedContact={filteredData.selectedContact}
          setComposeRecipient={state.setComposeRecipient}
          setContactSearch={state.setContactSearch}
          contactSearch={state.contactSearch}
          setShowContactDropdown={state.setShowContactDropdown}
          showContactDropdown={state.showContactDropdown}
          filteredContacts={filteredData.filteredContacts}
          composeGroupId={state.composeGroupId}
          setComposeGroupId={state.setComposeGroupId}
          availableGroups={derived.availableGroups}
          composeProgram={state.composeProgram}
          availablePrograms={derived.availablePrograms}
          setComposeProgram={state.setComposeProgram}
          setProgramSearch={state.setProgramSearch}
          programSearch={state.programSearch}
          setShowProgramDropdown={state.setShowProgramDropdown}
          showProgramDropdown={state.showProgramDropdown}
          filteredPrograms={filteredData.filteredPrograms}
          composeShowAttachment={state.composeShowAttachment}
          setComposeShowAttachment={state.setComposeShowAttachment}
          handleComposeFile={handleComposeFile}
          composeUploading={state.composeUploading}
          composeAttachmentUrl={state.composeAttachmentUrl}
          setComposeAttachmentUrl={state.setComposeAttachmentUrl}
          setComposeAttachmentName={state.setComposeAttachmentName}
          composeAttachmentName={state.composeAttachmentName}
          composeBody={state.composeBody}
          setComposeBody={state.setComposeBody}
          handleSendNew={handlers.handleSendNew}
          sending={state.sending}
          composeRecipient={state.composeRecipient}
        />
      )}

      <GlobalToast />
    </div>
  );
}
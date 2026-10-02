"use client";
import ConversationThread from "@/components/messaging/chat/ConversationThread";

import ConversationList from "@/components/messaging/chat/ConversationList";

import ComposeMessageModal from "@/components/messaging/chat/ComposeMessageModal";

import NewMessageButton from "@/components/messaging/chat/NewMessageButton";

import { getPermissions } from "@/components/messaging/chat/getPermissions";

import { useState, useEffect, useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import { Send, Users, Briefcase, User } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { useSessionUser } from "@/lib/hooks/useSessionUser";
import GlobalToast from "@/components/ui/GlobalToast";

// ─── Helpers ─────────────────────────────────────────────────────────────

// ─── Permission logic ────────────────────────────────────────────────────
// Determines what contacts, groups, and send modes a user can access
// based on their role, group membership, and program assignments.

// ─── Read shapers ────────────────────────────────────────────────────────
// Module scope on purpose: the hook mirrors the transformation it is handed, so
// one built inside the component would be a new identity on every render.

const pickMessages = (payload) => (payload?.success ? payload.messages || [] : []);
const pickContacts = (payload) => (payload?.success ? payload.contacts || [] : []);
const pickFamilies = (payload) => (payload?.success ? payload.families || [] : []);
const pickPrograms = (payload) => (payload?.success ? payload.programs || [] : []);

// The identity is absent for the first moment of a cold load. One stable shape
// for it keeps the memos that read `user` from recomputing on every render.
const EMPTY_USER = {};

// ─── Page visibility ─────────────────────────────────────────────────────
// The chat polls, and the loop has to STOP while the tab is hidden - a property
// of the page rather than of the read. Subscribing to it (the same mechanism the
// repo uses for the session) makes it a value the poll can be keyed on, with no
// state of ours to write from an effect.

function subscribeVisibility(onChange) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

function readVisibility() {
  return document.visibilityState === "visible";
}

function readVisibilityOnServer() {
  return true;
}

// ─── Main Component ──────────────────────────────────────────────────────

export default function MessagingChat({
  role = "super_admin",
}) {
  // ── State ──
  const [activeConversation, setActiveConversation] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replyAttachmentUrl, setReplyAttachmentUrl] = useState("");
  const [replyAttachmentName, setReplyAttachmentName] = useState("");
  const [replyShowAttachment, setReplyShowAttachment] = useState(false);
  const [replyUploading, setReplyUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");

  // Compose modal state
  const [showCompose, setShowCompose] = useState(false);
  const [sendMode, setSendMode] = useState("individual");
  const [composeRecipient, setComposeRecipient] = useState("");
  const [composeGroupId, setComposeGroupId] = useState("");
  const [composeProgram, setComposeProgram] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeAttachmentUrl, setComposeAttachmentUrl] = useState("");
  const [composeAttachmentName, setComposeAttachmentName] = useState("");
  const [composeShowAttachment, setComposeShowAttachment] = useState(false);
  const [composeUploading, setComposeUploading] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [programSearch, setProgramSearch] = useState("");
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [showProgramDropdown, setShowProgramDropdown] = useState(false);

  // Mobile responsive
  const [mobileView, setMobileView] = useState("list"); // 'list' or 'chat'

  const chatEndRef = useRef(null);
  const replyInputRef = useRef(null);
  const { t } = useI18n();

  // ── The signed-in identity ──
  // The shell already fetches the session and publishes it, so this only
  // observes that cache: no request of its own, and no effect parsing the
  // browser's stored copy. It is momentarily absent on a cold load, which the
  // reads below treat as "not known yet" rather than as "nothing to show".
  const { user: sessionUser } = useSessionUser();
  const user = sessionUser || EMPTY_USER;

  const uid = user?.cid || user?.id;
  const groupName = user?.group_name;

  // ── Is the tab on screen? ──
  const pageVisible = useSyncExternalStore(
    subscribeVisibility,
    readVisibility,
    readVisibilityOnServer,
  );

  // ── Reads ──
  // One read per source, each addressed on the identity and each shaped by a
  // module-scope function. No identity yet means no address, so no request goes
  // out and nothing is reported as loading until it arrives.
  const {
    data: messages,
    loading: messagesLoading,
    refresh: refreshMessages,
  } = useApi(uid ? `/api/internal-comms?cid=${uid}` : null, {
    defaultValue: [],
    transform: pickMessages,
    deps: [uid],
    // The chat's live-update loop, kept in the hook so it reuses the read's own
    // cache, stale-answer handling and loading flag: the same read every 3 s,
    // and no interval at all while the tab is hidden.
    refetchInterval: pageVisible ? 3000 : 0,
  });

  // ── All contacts ──
  // Messaging is internal-only: internal staff use the CRM list as the
  // recipient directory (they hold contacts.view). The participant/founder
  // scoped endpoint was removed with the external messaging MVP decision.
  const { data: allContacts } = useApi(uid ? "/api/contacts" : null, {
    defaultValue: [],
    transform: pickContacts,
    deps: [uid],
  });

  // ── Families (contact groups) ──
  const { data: families } = useApi(uid ? "/api/families" : null, {
    defaultValue: [],
    transform: pickFamilies,
    deps: [uid],
  });

  // ── All programs ──
  const { data: allPrograms } = useApi(uid ? "/api/programs" : null, {
    defaultValue: [],
    transform: pickPrograms,
    deps: [uid],
  });

  // The messages read's own flag, plus "the identity is not known yet": the
  // list keeps its spinner for that moment instead of claiming it is empty.
  const loading = !uid || messagesLoading;

  // ── Determine user's program IDs based on role ──
  const userProgramIds = useMemo(() => {
    if (!uid || !role) return [];
    if (role === "super_admin") return []; // SA sees all, no filter needed
    if (role === "staff") return []; // Staff sees by group, not programs
    if (role === "program_manager") {
      // Find programs where this user is the assigned PM
      return allPrograms
        .filter((program) => String(program.assigned_pm_id) === String(uid))
        .map((program) => program.id);
    }
    if (role === "participant") {
      // Participants see their program from their contact record
      if (user?.program_id) return [user.program_id];
      return [];
    }
    return [];
  }, [uid, role, allPrograms, user]);

  // ── Permissions derived from role + group + programs ──
  const permissions = useMemo(
    () => getPermissions(role, groupName, userProgramIds, allPrograms),
    [role, groupName, userProgramIds, allPrograms],
  );

  // ── Available contacts (filtered by permissions) ──
  // Participants/founders get a server-scoped list from /api/messaging/contacts,
  // so their contacts can be trusted directly (no extra client-side canMessage).
  const contacts = useMemo(() => {
    return allContacts.filter((contact) => {
      if (String(contact.cid || contact.id) === String(uid)) return false;
      if (role === "participant" || role === "founder") return true;
      return permissions.canMessage(contact, allContacts);
    });
  }, [allContacts, permissions, uid, role]);

  // ── Available groups for group messaging ──
  const availableGroups = useMemo(
    () => permissions.getAvailableGroups(families),
    [permissions, families],
  );

  // ── Available programs for program messaging ──
  const availablePrograms = useMemo(
    () => permissions.getAvailablePrograms(allPrograms),
    [permissions, allPrograms],
  );

  // ── Derive send modes (only SA/staff can broadcast) ──
  const sendModes = permissions.sendModes;

  // ── Focus reply input when conversation changes ──
  useEffect(() => {
    if (activeConversation && replyInputRef.current) {
      replyInputRef.current.focus();
    }
  }, [activeConversation]);

  // ── Scroll to bottom when new messages arrive ──
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeConversation, messages]);

  // ── Build conversation threads ──
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
        // Look up the group name from families (or the internal staff group)
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

  // ── Unread counts ──
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

  // ── Filter messages for active conversation ──
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

  // ── Open a conversation and mark messages as read ──
  const openConversation = useCallback(
    async (thread) => {
      setActiveConversation(thread);
      setMobileView("chat");

      const unreadIds = messages
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
          // Also mark notifications as read so sidebar badge updates
          window.dispatchEvent(new Event("notifications:refresh"));
        } catch (_) {}
      }
    },
    [messages, uid],
  );

  // ── Upload a file attachment (server-validated) and store the returned URL ──
  const uploadAttachment = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (data.success && data.url) return { url: data.url };
    return { error: data.error || t("messaging.uploadFailed", { error: "" }) };
  };

  const notifyError = (message) => {
    window.dispatchEvent(
      new CustomEvent("impactos:notify", {
        detail: { type: "error", message },
      }),
    );
  };

  const handleReplyFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setReplyUploading(true);
    try {
      const result = await uploadAttachment(file);
      if (result.url) {
        setReplyAttachmentUrl(result.url);
        setReplyAttachmentName(file.name);
      } else {
        notifyError(result.error || t("messaging.uploadFailed", { error: "" }));
      }
    } catch (error) {
      console.error(error);
      notifyError(t("messaging.uploadFailed", { error: "" }));
    } finally {
      setReplyUploading(false);
      if (event.target) event.target.value = "";
    }
  };

  const handleComposeFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setComposeUploading(true);
    try {
      const result = await uploadAttachment(file);
      if (result.url) {
        setComposeAttachmentUrl(result.url);
        setComposeAttachmentName(file.name);
      } else {
        notifyError(result.error || t("messaging.uploadFailed", { error: "" }));
      }
    } catch (error) {
      console.error(error);
      notifyError(t("messaging.uploadFailed", { error: "" }));
    } finally {
      setComposeUploading(false);
      if (event.target) event.target.value = "";
    }
  };

  // ── Handle quick reply from the chat panel ──
  const handleReply = async () => {
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
      // The POST answers with the new id and not with the thread, so the read
      // that shows it is refreshed rather than published into.
      await refreshMessages();
    } catch (error) {
      console.error(error);
    } finally {
      setSending(false);
    }
  };

  // ── Handle keyboard shortcut for reply ──
  const handleReplyKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleReply();
    }
  };

  // ── Handle sending a new message from compose modal ──
  const handleSendNew = async () => {
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
          target_type: "role", // uses target_id = family/group id
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

      // Same as the quick reply: the write's body carries no thread, so the
      // messages read is refreshed.
      await refreshMessages();
    } catch (error) {
      console.error(error);
    } finally {
      setSending(false);
    }
  };

  // ── Filtered contact list for compose modal ──
  const filteredContacts = contacts.filter((contact) => {
    if (!contactSearch) return true;
    const normalizedQuery = contactSearch.toLowerCase();
    return (
      (contact.name || "").toLowerCase().includes(normalizedQuery) ||
      (contact.email || "").toLowerCase().includes(normalizedQuery) ||
      (contact.role || "").toLowerCase().includes(normalizedQuery) ||
      (contact.group_name || "").toLowerCase().includes(normalizedQuery)
    );
  });

  const filteredPrograms = availablePrograms.filter((program) => {
    if (!programSearch) return true;
    return (program.name || "").toLowerCase().includes(programSearch.toLowerCase());
  });

  const selectedContact = contacts.find(
    (contact) => (contact.cid || contact.id) === composeRecipient,
  );

  // ── Conversation icon ──
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

  // ── Filter conversations by search ──
  const filteredConversations = conversations.filter((thread) => {
    if (!search) return true;
    return thread.label.toLowerCase().includes(search.toLowerCase());
  });

  // ── Render ──
  return (
    <div className="flex flex-col h-full">
      {/* ───── Header ───── */}
      <div className="flex items-center justify-between mb-4 px-6 pt-6">
        <div>
          <h1 className="text-lg font-black uppercase tracking-tight text-[var(--text-primary)]">
            {t("messaging.title")}
          </h1>
          <p className="text-[10px] text-[var(--text-secondary)] mt-1">
            {totalUnread > 0
              ? t("messaging.unreadCount", { count: totalUnread })
              : conversations.length !== 1
                ? t("messaging.conversationCountPlural", {
                    count: conversations.length,
                  })
                : t("messaging.conversationCount", {
                    count: conversations.length,
                  })}
          </p>
        </div>
        <NewMessageButton
          setShowCompose={setShowCompose}
          setContactSearch={setContactSearch}
          setComposeRecipient={setComposeRecipient}
          setComposeBody={setComposeBody}
          setComposeAttachmentUrl={setComposeAttachmentUrl}
          setComposeAttachmentName={setComposeAttachmentName}
          setComposeShowAttachment={setComposeShowAttachment}
          setSendMode={setSendMode}
          sendModes={sendModes}
          t={t}
        />
      </div>

      {/* ───── Main area ───── */}
      <div className="flex-1 flex min-h-0 px-6 pb-6">
        {/* ─── Conversation List ─── */}
        <ConversationList
          mobileView={mobileView}
          t={t}
          search={search}
          setSearch={setSearch}
          loading={loading}
          filteredConversations={filteredConversations}
          activeConversation={activeConversation}
          unreadCounts={unreadCounts}
          uid={uid}
          threadIcon={threadIcon}
          openConversation={openConversation}
        />

        {/* ───── Chat Panel ───── */}
        <ConversationThread
          mobileView={mobileView}
          activeConversation={activeConversation}
          t={t}
          setMobileView={setMobileView}
          threadIcon={threadIcon}
          activeMessages={activeMessages}
          uid={uid}
          chatEndRef={chatEndRef}
          replyShowAttachment={replyShowAttachment}
          handleReplyFile={handleReplyFile}
          replyUploading={replyUploading}
          replyAttachmentUrl={replyAttachmentUrl}
          setReplyAttachmentUrl={setReplyAttachmentUrl}
          setReplyShowAttachment={setReplyShowAttachment}
          setReplyAttachmentName={setReplyAttachmentName}
          replyAttachmentName={replyAttachmentName}
          replyInputRef={replyInputRef}
          replyText={replyText}
          setReplyText={setReplyText}
          handleReplyKeyDown={handleReplyKeyDown}
          handleReply={handleReply}
          sending={sending}
        />
      </div>

      {/* ───── Compose Modal ───── */}
      {showCompose && (
        <ComposeMessageModal
          setShowCompose={setShowCompose}
          t={t}
          sendModes={sendModes}
          setSendMode={setSendMode}
          sendMode={sendMode}
          selectedContact={selectedContact}
          setComposeRecipient={setComposeRecipient}
          setContactSearch={setContactSearch}
          contactSearch={contactSearch}
          setShowContactDropdown={setShowContactDropdown}
          showContactDropdown={showContactDropdown}
          filteredContacts={filteredContacts}
          composeGroupId={composeGroupId}
          setComposeGroupId={setComposeGroupId}
          availableGroups={availableGroups}
          composeProgram={composeProgram}
          availablePrograms={availablePrograms}
          setComposeProgram={setComposeProgram}
          setProgramSearch={setProgramSearch}
          programSearch={programSearch}
          setShowProgramDropdown={setShowProgramDropdown}
          showProgramDropdown={showProgramDropdown}
          filteredPrograms={filteredPrograms}
          composeShowAttachment={composeShowAttachment}
          setComposeShowAttachment={setComposeShowAttachment}
          handleComposeFile={handleComposeFile}
          composeUploading={composeUploading}
          composeAttachmentUrl={composeAttachmentUrl}
          setComposeAttachmentUrl={setComposeAttachmentUrl}
          setComposeAttachmentName={setComposeAttachmentName}
          composeAttachmentName={composeAttachmentName}
          composeBody={composeBody}
          setComposeBody={setComposeBody}
          handleSendNew={handleSendNew}
          sending={sending}
          composeRecipient={composeRecipient}
        />
      )}

      {/* Confirm Dialog removed — messages are never deleted (retention rule) */}
      <GlobalToast />
    </div>
  );
}

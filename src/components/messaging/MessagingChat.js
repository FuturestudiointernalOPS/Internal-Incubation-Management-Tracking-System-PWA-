"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import {
  Send,
  MessageSquare,
  Search,
  Users,
  Briefcase,
  User,
  X,
  Check,
  CheckCheck,
  Paperclip,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { useSessionUser } from "@/lib/hooks/useSessionUser";
import GlobalToast from "@/components/ui/GlobalToast";

// ─── Helpers ─────────────────────────────────────────────────────────────

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function formatTime(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const hour = date.getHours().toString().padStart(2, "0");
  const minute = date.getMinutes().toString().padStart(2, "0");
  if (isToday) return `${hour}:${minute}`;
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

// ─── Permission logic ────────────────────────────────────────────────────
// Determines what contacts, groups, and send modes a user can access
// based on their role, group membership, and program assignments.

function getPermissions(role, groupName, userProgramIds, allPrograms) {
  const isSA = role === "super_admin";
  const isStaffFutureStudio =
    role === "staff" &&
    String(groupName || "").toUpperCase() === "FUTURE STUDIO";
  const isPM = role === "program_manager";
  const isParticipant = role === "participant";

  // Send modes available
  const sendModes = ["individual"];
  if (isSA) sendModes.push("group", "program", "broadcast");
  if (isStaffFutureStudio) sendModes.push("group");
  if (isPM) sendModes.push("group", "program");

  // Contact filter: returns true if the user can message this contact
  function canMessage(contact, allContacts) {
    if (!contact || contact.status !== "active") return false;
    if (contact.cid === role) return false; // can't message self (uid check below)

    // Super Admin can message anyone
    if (isSA) return true;

    // Staff (FUTURE STUDIO): only other FUTURE STUDIO members
    if (isStaffFutureStudio) {
      return (
        String(contact.group_name || "").toUpperCase() === "FUTURE STUDIO"
      );
    }

    // Program Manager: only contacts in programs they manage
    if (isPM) {
      if (userProgramIds.length === 0) return false;
      // Participants with matching program_id
      if (contact.program_id && userProgramIds.includes(contact.program_id))
        return true;
      // FUTURE STUDIO staff who may be assigned to PM's programs
      if (String(contact.group_name || "").toUpperCase() === "FUTURE STUDIO")
        return true;
      // Contacts whose group_name matches a family linked to PM's programs
      if (contact.group_name) {
        const familyProgramId = allContacts
          .filter((candidate) => candidate.group_name === contact.group_name)
          .find((candidate) => candidate.program_id && userProgramIds.includes(candidate.program_id));
        if (familyProgramId) return true;
      }
      return false;
    }

    // Participant: only contacts linked to their specific program
    if (isParticipant) {
      // Other participants with same group_name (case-insensitive — group
      // names can be stored uppercased by some flows and original-case by others)
      if (
        contact.role === "participant" &&
        String(contact.group_name || "").toUpperCase() ===
          String(groupName || "").toUpperCase()
      )
        return true;
      // Staff/PM assigned to this participant's program
      if (contact.role !== "participant" && userProgramIds.length > 0) {
        // Contact is the assigned PM for participant's program
        const isAssignedPm = userProgramIds.some((programId) => {
          const program = allPrograms.find((candidate) => candidate.id === programId);
          return (
            program &&
            String(program.assigned_pm_id) === String(contact.cid || contact.id)
          );
        });
        if (isAssignedPm) return true;
        // Contact is assigned as assistant for participant's program
        const isAssistantPm = userProgramIds.some((programId) => {
          const program = allPrograms.find((candidate) => candidate.id === programId);
          if (!program || !program.assigned_assistant_id) return false;
          try {
            const assistants = JSON.parse(program.assigned_assistant_id);
            return (
              Array.isArray(assistants) &&
              assistants.some(
                (assistantId) => String(assistantId) === String(contact.cid || contact.id),
              )
            );
          } catch {
            return false;
          }
        });
        if (isAssistantPm) return true;
        // Contact has matching program_id in their record
        if (contact.program_id && userProgramIds.includes(contact.program_id))
          return true;
      }
      return false;
    }

    return false;
  }

  // Groups available for group messaging
  function getAvailableGroups(allFamilies) {
    const groups = [];

    // Super Admin sees all families + Future Studio Staff
    if (isSA) {
      groups.push({
        id: "__staff__",
        name: "Future Studio Staff",
        type: "staff",
      });
      allFamilies.forEach((family) => {
        if (!family.is_archived && family.program_id) {
          groups.push({
            id: family.id,
            name: family.name,
            type: "family",
            programId: family.program_id,
          });
        }
      });
      return groups;
    }

    // Staff (FUTURE STUDIO) sees only Future Studio Staff
    if (isStaffFutureStudio) {
      groups.push({
        id: "__staff__",
        name: "Future Studio Staff",
        type: "staff",
      });
      return groups;
    }

    // PM sees families linked to their programs
    if (isPM && userProgramIds.length > 0) {
      allFamilies.forEach((family) => {
        if (
          !family.is_archived &&
          family.program_id &&
          userProgramIds.includes(family.program_id)
        ) {
          groups.push({
            id: family.id,
            name: family.name,
            type: "family",
            programId: family.program_id,
          });
        }
      });
      return groups;
    }

    return groups;
  }

  // Programs available for program-wide messaging
  function getAvailablePrograms(allPrograms) {
    if (isSA) return allPrograms.filter((program) => !program.is_archived);
    if (isPM && userProgramIds.length > 0) {
      return allPrograms.filter((program) => userProgramIds.includes(program.id));
    }
    return [];
  }

  return {
    sendModes,
    canMessage,
    getAvailableGroups,
    getAvailablePrograms,
    userProgramIds,
  };
}

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

export default function MessagingChat({ role = "super_admin" }) {
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
        <button
          onClick={() => {
            setShowCompose(true);
            setContactSearch("");
            setComposeRecipient("");
            setComposeBody("");
            setComposeAttachmentUrl("");
            setComposeAttachmentName("");
            setComposeShowAttachment(false);
            setSendMode(
              sendModes.includes("individual")
                ? "individual"
                : sendModes[0] || "individual",
            );
          }}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-[10px] font-bold uppercase tracking-wide hover:brightness-110 transition-all"
        >
          <Send className="w-3.5 h-3.5" /> {t("messaging.new")}
        </button>
      </div>

      {/* ───── Main area ───── */}
      <div className="flex-1 flex min-h-0 px-6 pb-6">
        {/* ─── Conversation List ─── */}
        <div
          className={cn(
            "w-full lg:w-80 xl:w-96 flex-shrink-0 border-r border-[var(--border-primary)] bg-tertiary/20 flex flex-col rounded-l-xl overflow-hidden",
            mobileView === "chat" && "hidden lg:flex",
          )}
        >
          <div className="p-3 border-b border-[var(--border-primary)]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" />
              <input
                type="text"
                placeholder={t("messaging.search")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none focus:border-[var(--brand-orange)] transition-all"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <MessageSquare className="w-10 h-10 text-[var(--text-secondary)] mb-3 opacity-30" />
                <p className="text-[11px] font-bold text-[var(--text-secondary)]">
                  {search
                    ? t("messaging.noMatchingConversations")
                    : t("messaging.noConversations")}
                </p>
                <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-1 opacity-50">
                  {t("messaging.clickNewToStart")}
                </p>
              </div>
            ) : (
              filteredConversations.map((thread) => {
                const isActive = activeConversation?.id === thread.id;
                const unread = unreadCounts[thread.id] || 0;
                const lastMessage = thread.lastMessage;
                const isLastFromOther = lastMessage?.sender_id !== uid;
                const Icon = threadIcon(thread);

                return (
                  <button
                    key={thread.id}
                    onClick={() => openConversation(thread)}
                    className={cn(
                      "w-full text-left p-3 transition-all flex items-center gap-3 border-b border-divider/50",
                      isActive
                        ? "bg-brand-orange/10"
                        : "hover:bg-tertiary",
                    )}
                  >
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                        isActive || unread > 0
                          ? "bg-brand-orange/15 text-[var(--brand-orange)]"
                          : "bg-tertiary text-[var(--text-secondary)]",
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={cn(
                            "text-[11px] truncate",
                            unread > 0
                              ? "font-black text-[var(--text-primary)]"
                              : "font-bold text-[var(--text-primary)]",
                          )}
                        >
                          {thread.label}
                        </p>
                        <span className="text-[10px] font-medium text-[var(--text-secondary)] shrink-0">
                          {formatTime(lastMessage?.created_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {thread.type === "individual" &&
                          !isLastFromOther &&
                          (lastMessage?.is_read === 1 ? (
                            <span className="flex items-center gap-0.5 shrink-0">
                              <Check className="w-2.5 h-2.5 text-emerald-400" />
                              <Check className="w-2.5 h-2.5 text-emerald-400 -ml-1" />
                            </span>
                          ) : (
                            <Check className="w-2.5 h-2.5 text-[var(--text-secondary)] shrink-0" />
                          ))}
                        <p
                          className={cn(
                            "text-[10px] truncate flex-1",
                            unread > 0
                              ? "font-bold text-[var(--text-primary)]"
                              : "text-[var(--text-secondary)]",
                          )}
                        >
                          {lastMessage?.body || lastMessage?.subject || ""}
                        </p>
                      </div>
                    </div>

                    {unread > 0 && (
                      <div className="w-5 h-5 rounded-full bg-[var(--brand-orange)] text-black text-[8px] font-black flex items-center justify-center shrink-0">
                        {unread}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ───── Chat Panel ───── */}
        <div
          className={cn(
            "flex-1 flex flex-col bg-tertiary/10 rounded-r-xl overflow-hidden",
            mobileView === "list" && "hidden lg:flex",
          )}
        >
          {!activeConversation ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center px-6">
                <MessageSquare className="w-16 h-16 text-[var(--text-secondary)] mx-auto mb-4 opacity-20" />
                <p className="text-sm font-bold text-[var(--text-secondary)]">
                  {t("messaging.selectConversation")}
                </p>
                <p className="text-[10px] text-[var(--text-secondary)] mt-1 opacity-50">
                  {t("messaging.unreadHighlight")}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="flex items-center gap-3 px-4 lg:px-6 py-3 border-b border-[var(--border-primary)] flex-shrink-0 bg-tertiary/30">
                {mobileView === "chat" && (
                  <button
                    onClick={() => setMobileView("list")}
                    className="lg:hidden text-[var(--text-secondary)] hover:text-[var(--text-primary)] mr-1"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </button>
                )}
                <div className="w-9 h-9 rounded-full bg-brand-orange/15 text-[var(--brand-orange)] flex items-center justify-center flex-shrink-0">
                  {React.createElement(threadIcon(activeConversation), {
                    className: "w-4 h-4",
                  })}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-black text-[var(--text-primary)] uppercase tracking-wider truncate">
                    {activeConversation.label}
                  </p>
                  <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                    {activeMessages.length !== 1
                      ? t("messaging.messageCountPlural", {
                          count: activeMessages.length,
                        })
                      : t("messaging.messageCount", {
                          count: activeMessages.length,
                        })}
                  </p>
                </div>
              </div>

              {/* Messages area */}
              <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-4 space-y-2">
                {activeMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-[10px] text-[var(--text-secondary)]">
                      {t("messaging.noMessages")}
                    </p>
                  </div>
                ) : (
                  activeMessages.map((message, index) => {
                    const isSent = message.sender_id === uid;
                    const isLast = index === activeMessages.length - 1;
                    const showRead = isSent && isLast && message.is_read === 1;
                    return (
                      <div
                        key={message.id}
                        className={cn(
                          "flex items-center gap-1.5 group",
                          isSent ? "justify-end" : "justify-start",
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[75%] lg:max-w-[60%] px-3.5 py-2.5 rounded-2xl",
                            isSent
                              ? "bg-[var(--brand-orange)] text-black rounded-br-md"
                              : "bg-tertiary border border-[var(--border-primary)] text-[var(--text-primary)] rounded-bl-md",
                          )}
                        >
                          <p className="text-[11px] leading-relaxed whitespace-pre-wrap break-words">
                            {message.body}
                          </p>
                          {message.attachment_url && (
                            <a
                              href={message.attachment_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(
                                "flex items-center gap-1.5 mt-1.5 px-2 py-1 rounded-md text-[10px] font-bold transition-colors",
                                isSent
                                  ? "bg-black/10 text-black hover:bg-black/20"
                                  : "bg-brand-orange/10 text-[var(--brand-orange)] hover:bg-brand-orange/20",
                              )}
                            >
                              <ExternalLink className="w-3 h-3 shrink-0" />
                              <span className="truncate max-w-[200px]">
                                {message.attachment_name || message.attachment_url}
                              </span>
                            </a>
                          )}
                          <div
                            className={cn(
                              "flex items-center gap-1 mt-1",
                              isSent ? "justify-end" : "justify-start",
                            )}
                          >
                            <span className="text-[10px] font-medium opacity-50">
                              {formatTime(message.created_at)}
                            </span>
                            {showRead && (
                              <CheckCheck className="w-3 h-3 text-emerald-500 shrink-0" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Quick reply */}
              <div className="p-3 border-t border-[var(--border-primary)] flex-shrink-0 space-y-2">
                {/* Attachment fields */}
                {replyShowAttachment && (
                  <div className="space-y-2 px-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        onChange={handleReplyFile}
                        className="flex-1 text-[10px] text-slate-400 file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-tertiary file:text-[10px] file:font-bold file:uppercase file:tracking-wider file:text-[var(--text-primary)] file:cursor-pointer"
                      />
                      {replyUploading && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--brand-orange)] shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder={t("messaging.attachmentUrlPlaceholder")}
                        value={replyAttachmentUrl}
                        onChange={(event) => setReplyAttachmentUrl(event.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)] focus:border-[var(--brand-orange)] transition-all"
                      />
                      <button
                        onClick={() => {
                          setReplyShowAttachment(false);
                          setReplyAttachmentUrl("");
                          setReplyAttachmentName("");
                        }}
                        className="text-[var(--text-secondary)] hover:text-red-500"
                        title={t("messaging.removeAttachment")}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder={t("messaging.attachmentNamePlaceholder")}
                      value={replyAttachmentName}
                      onChange={(event) => setReplyAttachmentName(event.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)] focus:border-[var(--brand-orange)] transition-all"
                    />
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setReplyShowAttachment(!replyShowAttachment)}
                    className={cn(
                      "px-2.5 py-2.5 rounded-xl text-[10px] font-bold transition-all",
                      replyShowAttachment || replyAttachmentUrl
                        ? "bg-brand-orange/20 text-[var(--brand-orange)]"
                        : "bg-tertiary border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                    )}
                    title={t("messaging.attachFile")}
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                  </button>
                  <input
                    ref={replyInputRef}
                    type="text"
                    placeholder={t("messaging.typeMessage")}
                    value={replyText}
                    onChange={(event) => setReplyText(event.target.value)}
                    onKeyDown={handleReplyKeyDown}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)] focus:border-[var(--brand-orange)] transition-all"
                  />
                  <button
                    onClick={handleReply}
                    disabled={!replyText.trim() || sending}
                    className="px-5 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-bold uppercase tracking-wide hover:brightness-110 transition-all disabled:opacity-30 flex items-center gap-1.5"
                  >
                    {sending ? (
                      <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" /> {t("messaging.send")}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ───── Compose Modal ───── */}
      {showCompose && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowCompose(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-[var(--bg-primary)] border border-[var(--border-primary)] p-6 space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">
                {t("messaging.composeMessage")}
              </h2>
              <button onClick={() => setShowCompose(false)}>
                <X className="w-5 h-5 text-[var(--text-secondary)]" />
              </button>
            </div>

            {/* Mode selector */}
            {sendModes.length > 1 && (
              <div className="flex gap-2 p-1 rounded-lg bg-tertiary border border-[var(--border-primary)]">
                {sendModes.map((mode) => {
                  const icons = {
                    individual: User,
                    group: Users,
                    program: Briefcase,
                    broadcast: Send,
                  };
                  const labels = {
                    individual: t("messaging.direct"),
                    group: t("messaging.group"),
                    program: t("messaging.program"),
                    broadcast: t("messaging.broadcast"),
                  };
                  const Icon = icons[mode];
                  return (
                    <button
                      key={mode}
                      onClick={() => setSendMode(mode)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
                        sendMode === mode
                          ? "bg-[var(--brand-orange)] text-black"
                          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {labels[mode] || mode}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Individual: person picker */}
            {sendMode === "individual" && (
              <div className="relative">
                {selectedContact ? (
                  <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-tertiary border border-[var(--border-primary)]">
                    <span className="text-[11px] font-bold text-[var(--text-primary)]">
                      {selectedContact.name}
                    </span>
                    <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                      {selectedContact.email}
                    </span>
                    <button
                      onClick={() => {
                        setComposeRecipient("");
                        setContactSearch("");
                      }}
                      className="text-[var(--text-secondary)]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      placeholder={t("messaging.searchPerson")}
                      value={contactSearch}
                      onChange={(event) => {
                        setContactSearch(event.target.value);
                        setShowContactDropdown(true);
                      }}
                      onFocus={() => setShowContactDropdown(true)}
                      className="w-full px-4 py-2.5 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)]"
                    />
                    {showContactDropdown && (
                      <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] shadow-xl">
                        {filteredContacts.length === 0 ? (
                          <p className="px-4 py-3 text-[10px] font-medium text-[var(--text-secondary)]">
                            {t("messaging.noContactsFound")}
                          </p>
                        ) : (
                          filteredContacts.map((contact) => (
                            <button
                              key={contact.cid || contact.id}
                              onClick={() => {
                                setComposeRecipient(contact.cid || contact.id);
                                setContactSearch("");
                                setShowContactDropdown(false);
                              }}
                              className="w-full text-left px-4 py-2.5 hover:bg-tertiary transition-colors border-b border-divider/50 last:border-0"
                            >
                              <p className="text-[11px] font-bold text-[var(--text-primary)]">
                                {contact.name}
                              </p>
                              <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                                {contact.email}
                              </p>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Group: contact group selector */}
            {sendMode === "group" && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  {t("messaging.selectGroup")}
                </p>
                <select
                  value={composeGroupId}
                  onChange={(event) => setComposeGroupId(event.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none"
                >
                  <option value="">
                    {t("messaging.selectGroupPlaceholder")}
                  </option>
                  {availableGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.type === "staff" ? t("messaging.staffGroup") : group.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                  {t("messaging.groupMessageInfo")}
                </p>
              </div>
            )}

            {/* Program: program picker */}
            {sendMode === "program" && (
              <div className="relative">
                {composeProgram ? (
                  <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-tertiary border border-[var(--border-primary)]">
                    <span className="text-[11px] font-bold text-[var(--text-primary)]">
                      {availablePrograms.find((program) => program.id === composeProgram)
                        ?.name || composeProgram}
                    </span>
                    <button
                      onClick={() => {
                        setComposeProgram("");
                        setProgramSearch("");
                      }}
                      className="text-[var(--text-secondary)]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      placeholder={t("messaging.searchPrograms")}
                      value={programSearch}
                      onChange={(event) => {
                        setProgramSearch(event.target.value);
                        setShowProgramDropdown(true);
                      }}
                      onFocus={() => setShowProgramDropdown(true)}
                      className="w-full px-4 py-2.5 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)]"
                    />
                    {showProgramDropdown && (
                      <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] shadow-xl">
                        {filteredPrograms.length === 0 ? (
                          <p className="px-4 py-3 text-[10px] font-medium text-[var(--text-secondary)]">
                            {t("messaging.noProgramsFound")}
                          </p>
                        ) : (
                          filteredPrograms.map((program) => (
                            <button
                              key={program.id}
                              onClick={() => {
                                setComposeProgram(program.id);
                                setProgramSearch("");
                                setShowProgramDropdown(false);
                              }}
                              className="w-full text-left px-4 py-2.5 hover:bg-tertiary transition-colors"
                            >
                              <p className="text-[11px] font-bold text-[var(--text-primary)]">
                                {program.name}
                              </p>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Broadcast info */}
            {sendMode === "broadcast" && (
              <div className="px-4 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold text-amber-400">
                {t("messaging.broadcastWarning")}
              </div>
            )}

            {/* Attachment section */}
            <div className="space-y-2">
              {!composeShowAttachment && (
                <button
                  onClick={() => setComposeShowAttachment(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  {t("messaging.attachFile")}
                </button>
              )}
              {composeShowAttachment && (
                <div className="space-y-2 p-3 rounded-lg bg-tertiary border border-[var(--border-primary)]">
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      onChange={handleComposeFile}
                      className="flex-1 text-[10px] text-slate-400 file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-[var(--bg-primary)] file:text-[10px] file:font-bold file:uppercase file:tracking-wider file:text-[var(--text-primary)] file:cursor-pointer"
                    />
                    {composeUploading && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--brand-orange)] shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={t("messaging.attachmentUrlPlaceholder")}
                      value={composeAttachmentUrl}
                      onChange={(event) => setComposeAttachmentUrl(event.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)] focus:border-[var(--brand-orange)] transition-all"
                    />
                    <button
                      onClick={() => {
                        setComposeShowAttachment(false);
                        setComposeAttachmentUrl("");
                        setComposeAttachmentName("");
                      }}
                      className="text-[var(--text-secondary)] hover:text-red-500"
                      title={t("messaging.removeAttachment")}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder={t("messaging.attachmentNamePlaceholder")}
                    value={composeAttachmentName}
                    onChange={(event) => setComposeAttachmentName(event.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)] focus:border-[var(--brand-orange)] transition-all"
                  />
                </div>
              )}
            </div>

            {/* Message body */}
            <textarea
              placeholder={
                sendMode === "individual"
                  ? t("messaging.typeYourMessage")
                  : t("messaging.messagePlaceholder")
              }
              value={composeBody}
              onChange={(event) => setComposeBody(event.target.value)}
              rows={4}
              className="w-full px-4 py-2.5 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)] resize-none"
            />

            <button
              onClick={handleSendNew}
              disabled={
                sending ||
                !composeBody.trim() ||
                (sendMode === "individual" && !composeRecipient) ||
                (sendMode === "group" && !composeGroupId) ||
                (sendMode === "program" && !composeProgram)
              }
              className="w-full py-3 bg-[var(--brand-orange)] text-black rounded-xl text-sm font-bold uppercase tracking-wide disabled:opacity-30 hover:brightness-110 transition-all flex items-center justify-center gap-2"
            >
              {sending ? (
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" /> {t("messaging.sendMessage")}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Confirm Dialog removed — messages are never deleted (retention rule) */}
      <GlobalToast />
    </div>
  );
}

"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
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
  Building2,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function formatTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const hour = d.getHours().toString().padStart(2, "0");
  const minute = d.getMinutes().toString().padStart(2, "0");
  if (isToday) return `${hour}:${minute}`;
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

// ─── Permission logic ────────────────────────────────────────────────────
// Determines what contacts, groups, and send modes a user can access
// based on their role, group membership, and program assignments.

function getPermissions(role, groupName, userProgramIds, allPrograms) {
  const isSA = role === "super_admin";
  const isStaffFutureStudio = role === "staff" && groupName === "FUTURE STUDIO";
  const isPM = role === "program_manager";
  const isTeacher = role === "teacher";
  const isParticipant = role === "participant";

  // Send modes available
  const sendModes = ["individual"];
  if (isSA) sendModes.push("group", "program", "broadcast");
  if (isStaffFutureStudio) sendModes.push("group");
  if (isPM) sendModes.push("group", "program");
  if (isTeacher) sendModes.push("group", "program");

  // Contact filter: returns true if the user can message this contact
  function canMessage(contact, allContacts) {
    if (!contact || contact.status !== "active") return false;
    if (contact.cid === role) return false; // can't message self (uid check below)

    // Super Admin can message anyone
    if (isSA) return true;

    // Staff (FUTURE STUDIO): only other FUTURE STUDIO members
    if (isStaffFutureStudio) {
      return contact.group_name === "FUTURE STUDIO";
    }

    // Program Manager: only contacts in programs they manage
    if (isPM) {
      if (userProgramIds.length === 0) return false;
      // Participants with matching program_id
      if (contact.program_id && userProgramIds.includes(contact.program_id))
        return true;
      // FUTURE STUDIO staff who may be assigned to PM's programs
      if (contact.group_name === "FUTURE STUDIO") return true;
      // Contacts whose group_name matches a family linked to PM's programs
      if (contact.group_name) {
        const familyProgramId = allContacts
          .filter((c) => c.group_name === contact.group_name)
          .find((c) => c.program_id && userProgramIds.includes(c.program_id));
        if (familyProgramId) return true;
      }
      return false;
    }

    // Teacher: contacts in programs they teach
    if (isTeacher && userProgramIds.length > 0) {
      if (contact.program_id && userProgramIds.includes(contact.program_id))
        return true;
      return false;
    }

    // Participant: only contacts linked to their specific program
    if (isParticipant) {
      // Other participants with same group_name
      if (contact.role === "participant" && contact.group_name === groupName)
        return true;
      // Staff/PM/teachers assigned to this participant's program
      if (contact.role !== "participant" && userProgramIds.length > 0) {
        // Contact is the assigned PM for participant's program
        const isAssignedPm = userProgramIds.some((pid) => {
          const prog = allPrograms.find((p) => p.id === pid);
          return (
            prog &&
            String(prog.assigned_pm_id) === String(contact.cid || contact.id)
          );
        });
        if (isAssignedPm) return true;
        // Contact is assigned as assistant for participant's program
        const isAssistantPm = userProgramIds.some((pid) => {
          const prog = allPrograms.find((p) => p.id === pid);
          if (!prog || !prog.assigned_assistant_id) return false;
          try {
            const assistants = JSON.parse(prog.assigned_assistant_id);
            return (
              Array.isArray(assistants) &&
              assistants.some(
                (a) => String(a) === String(contact.cid || contact.id),
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
      allFamilies.forEach((f) => {
        if (!f.is_archived && f.program_id) {
          groups.push({
            id: f.id,
            name: f.name,
            type: "family",
            programId: f.program_id,
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
      allFamilies.forEach((f) => {
        if (
          !f.is_archived &&
          f.program_id &&
          userProgramIds.includes(f.program_id)
        ) {
          groups.push({
            id: f.id,
            name: f.name,
            type: "family",
            programId: f.program_id,
          });
        }
      });
      return groups;
    }

    // Teacher sees families linked to programs they teach
    if (isTeacher && userProgramIds.length > 0) {
      allFamilies.forEach((f) => {
        if (
          !f.is_archived &&
          f.program_id &&
          userProgramIds.includes(f.program_id)
        ) {
          groups.push({
            id: f.id,
            name: f.name,
            type: "family",
            programId: f.program_id,
          });
        }
      });
      return groups;
    }

    return groups;
  }

  // Programs available for program-wide messaging
  function getAvailablePrograms(allPrograms) {
    if (isSA) return allPrograms.filter((p) => !p.is_archived);
    if (isPM && userProgramIds.length > 0) {
      return allPrograms.filter((p) => userProgramIds.includes(p.id));
    }
    if (isTeacher && userProgramIds.length > 0) {
      return allPrograms.filter((p) => userProgramIds.includes(p.id));
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

// ─── Main Component ──────────────────────────────────────────────────────

export default function MessagingChat({ role = "super_admin" }) {
  // ── State ──
  const [user, setUser] = useState(null);
  const [allContacts, setAllContacts] = useState([]);
  const [families, setFamilies] = useState([]);
  const [allPrograms, setAllPrograms] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeConversation, setActiveConversation] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");

  // Compose modal state
  const [showCompose, setShowCompose] = useState(false);
  const [sendMode, setSendMode] = useState("individual");
  const [composeRecipient, setComposeRecipient] = useState("");
  const [composeGroupId, setComposeGroupId] = useState("");
  const [composeProgram, setComposeProgram] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [programSearch, setProgramSearch] = useState("");
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [showProgramDropdown, setShowProgramDropdown] = useState(false);

  // Mobile responsive
  const [mobileView, setMobileView] = useState("list"); // 'list' or 'chat'

  const chatEndRef = useRef(null);
  const replyInputRef = useRef(null);

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(u);
  }, []);

  const uid = user?.cid || user?.id;
  const groupName = user?.group_name;

  // ── Determine user's program IDs based on role ──
  const userProgramIds = useMemo(() => {
    if (!uid || !role) return [];
    if (role === "super_admin") return []; // SA sees all, no filter needed
    if (role === "staff") return []; // Staff sees by group, not programs
    if (role === "program_manager") {
      // Find programs where this user is the assigned PM
      return allPrograms
        .filter((p) => String(p.assigned_pm_id) === String(uid))
        .map((p) => p.id);
    }
    if (role === "teacher") {
      // Teachers don't have assigned_pm_id, they come from v2_program_staff
      // We'll use allPrograms and check via assigned_assistant_id or just allow
      // the teacher to see programs they're linked to
      return allPrograms
        .filter((p) => {
          if (String(p.assigned_pm_id) === String(uid)) return true;
          if (p.assigned_assistant_id) {
            try {
              const ids = JSON.parse(p.assigned_assistant_id);
              if (Array.isArray(ids) && ids.includes(uid)) return true;
            } catch {}
          }
          return false;
        })
        .map((p) => p.id);
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
  const contacts = useMemo(() => {
    return allContacts.filter((c) => {
      if (String(c.cid || c.id) === String(uid)) return false;
      return permissions.canMessage(c, allContacts);
    });
  }, [allContacts, permissions, uid]);

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

  // ── Fetch messages ──
  const fetchMessages = useCallback(async () => {
    if (!uid) return [];
    try {
      const res = await fetch(`/api/internal-comms?cid=${uid}`);
      const data = await res.json();
      if (data.success) {
        setMessages(data.messages || []);
        return data.messages || [];
      }
      return [];
    } catch (e) {
      console.error(e);
      return [];
    } finally {
      setLoading(false);
    }
  }, [uid]);

  // ── Fetch all contacts ──
  const fetchAllContacts = useCallback(async () => {
    try {
      const res = await fetch("/api/contacts");
      const data = await res.json();
      if (data.success) setAllContacts(data.contacts || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  // ── Fetch families (contact groups) ──
  const fetchFamilies = useCallback(async () => {
    try {
      const res = await fetch("/api/families");
      const data = await res.json();
      if (data.success) setFamilies(data.families || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  // ── Fetch all programs ──
  const fetchPrograms = useCallback(async () => {
    try {
      const res = await fetch("/api/programs");
      const data = await res.json();
      if (data.success) setAllPrograms(data.programs || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  // ── Initial data load ──
  useEffect(() => {
    if (uid) {
      fetchMessages();
      fetchAllContacts();
      fetchFamilies();
      fetchPrograms();
    }
  }, [uid, fetchMessages, fetchAllContacts, fetchFamilies, fetchPrograms]);

  // ── Auto-poll every 10 seconds ──
  useEffect(() => {
    if (!uid) return;
    const interval = setInterval(fetchMessages, 10000);
    return () => clearInterval(interval);
  }, [uid, fetchMessages]);

  // ── Build conversation threads ──
  const conversations = useMemo(() => {
    if (!Array.isArray(messages) || !uid) return [];
    const threads = [];
    const seen = new Set();

    for (const msg of messages) {
      if (!msg) continue;
      let threadId, label, icon, otherId;

      if (msg.target_type === "individual") {
        otherId = msg.sender_id === uid ? msg.recipient_id : msg.sender_id;
        if (!otherId) continue;
        threadId = `individual_${otherId}`;
        const contact = contacts.find((c) => (c.cid || c.id) === otherId);
        label = contact?.name || otherId;
        icon = "user";
      } else if (msg.target_type === "all") {
        threadId = "broadcast_all";
        label = "Broadcast (All Users)";
        icon = "broadcast";
      } else if (msg.target_type === "role") {
        threadId = `role_${msg.target_id}`;
        // Look up the group name from families
        const fam = families.find(
          (f) => String(f.id) === String(msg.target_id),
        );
        label = fam ? fam.name : msg.target_id || "Group";
        icon = "group";
      } else if (msg.target_type === "program") {
        threadId = `program_${msg.target_id}`;
        const prog = allPrograms.find((p) => p.id === msg.target_id);
        label = `Program: ${prog?.name || msg.target_id}`;
        icon = "program";
      } else {
        continue;
      }

      if (!seen.has(threadId)) {
        seen.add(threadId);
        threads.push({
          id: threadId,
          label,
          type: msg.target_type,
          targetId: msg.target_type === "individual" ? otherId : msg.target_id,
          lastMessage: msg,
          icon,
        });
      }
    }

    threads.sort(
      (a, b) =>
        new Date(b.lastMessage?.created_at || 0) -
        new Date(a.lastMessage?.created_at || 0),
    );
    return threads;
  }, [messages, contacts, families, allPrograms, uid]);

  // ── Unread counts ──
  const unreadCounts = useMemo(() => {
    if (!Array.isArray(messages) || !uid) return {};
    const counts = {};
    for (const msg of messages) {
      if (!msg) continue;
      const isUnread =
        msg.recipient_id === uid &&
        (msg.is_read === 0 || msg.is_read === null || msg.is_read === false);
      if (!isUnread) continue;

      let threadId;
      if (msg.target_type === "individual") {
        threadId = `individual_${msg.sender_id}`;
      } else if (msg.target_type === "all") {
        threadId = "broadcast_all";
      } else if (msg.target_type === "role") {
        threadId = `role_${msg.target_id}`;
      } else if (msg.target_type === "program") {
        threadId = `program_${msg.target_id}`;
      }
      if (threadId) counts[threadId] = (counts[threadId] || 0) + 1;
    }
    return counts;
  }, [messages, uid]);

  const totalUnread = useMemo(
    () => Object.values(unreadCounts).reduce((a, b) => a + b, 0),
    [unreadCounts],
  );

  // ── Filter messages for active conversation ──
  const activeMessages = useMemo(() => {
    if (!activeConversation) return [];
    const seen = new Set();
    return messages.filter((msg) => {
      if (seen.has(msg.id)) return false;
      seen.add(msg.id);
      if (activeConversation.type === "individual") {
        const otherId =
          msg.sender_id === uid ? msg.recipient_id : msg.sender_id;
        return otherId === activeConversation.targetId;
      }
      if (activeConversation.type === "all") return msg.target_type === "all";
      if (activeConversation.type === "role")
        return (
          msg.target_type === "role" &&
          msg.target_id === activeConversation.targetId
        );
      if (activeConversation.type === "program")
        return (
          msg.target_type === "program" &&
          msg.target_id === activeConversation.targetId
        );
      return false;
    });
  }, [messages, activeConversation, uid]);

  // ── Open a conversation and mark messages as read ──
  const openConversation = useCallback(
    async (thread) => {
      setActiveConversation(thread);
      setMobileView("chat");

      const unreadIds = messages
        .filter((msg) => {
          if (msg.is_read) return false;
          if (thread.type === "individual") {
            const otherId =
              msg.sender_id === uid ? msg.recipient_id : msg.sender_id;
            return otherId === thread.targetId;
          }
          return false;
        })
        .map((msg) => msg.id);

      if (unreadIds.length > 0) {
        try {
          await fetch("/api/internal-comms", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messageIds: unreadIds }),
          });
        } catch (_) {}
      }
    },
    [messages, uid],
  );

  // ── Handle quick reply from the chat panel ──
  const handleReply = async () => {
    if (!replyText.trim() || !activeConversation || sending) return;
    setSending(true);
    try {
      let payload;
      if (activeConversation.type === "individual") {
        payload = {
          sender_id: uid,
          recipient_id: activeConversation.targetId,
          target_type: "individual",
          subject: "(No subject)",
          body: replyText,
          priority: "normal",
        };
      } else if (activeConversation.type === "role") {
        payload = {
          sender_id: uid,
          target_type: "role",
          target_id: activeConversation.targetId,
          subject: "Reply to " + activeConversation.label,
          body: replyText,
          priority: "normal",
        };
      } else if (activeConversation.type === "program") {
        payload = {
          sender_id: uid,
          target_type: "program",
          target_id: activeConversation.targetId,
          subject: "Reply to " + activeConversation.label,
          body: replyText,
          priority: "normal",
        };
      } else if (activeConversation.type === "all") {
        payload = {
          sender_id: uid,
          target_type: "all",
          subject: "Reply",
          body: replyText,
          priority: "normal",
        };
      }
      if (!payload) return;
      await fetch("/api/internal-comms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setReplyText("");
      await fetchMessages();
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  // ── Handle keyboard shortcut for reply ──
  const handleReplyKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
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
      if (sendMode === "individual") {
        payload = {
          sender_id: uid,
          recipient_id: composeRecipient,
          target_type: "individual",
          subject: "(No subject)",
          body: composeBody,
          priority: "normal",
        };
      } else if (sendMode === "group") {
        payload = {
          sender_id: uid,
          target_type: "role", // uses target_id = family/group id
          target_id: composeGroupId,
          subject:
            "Message to " +
            (availableGroups.find(
              (g) => String(g.id) === String(composeGroupId),
            )?.name || "Group"),
          body: composeBody,
          priority: "normal",
        };
      } else if (sendMode === "program") {
        const prog = availablePrograms.find((p) => p.id === composeProgram);
        payload = {
          sender_id: uid,
          target_type: "program",
          target_id: composeProgram,
          subject: "Message to " + (prog?.name || "Program"),
          body: composeBody,
          priority: "normal",
        };
      } else if (sendMode === "broadcast") {
        payload = {
          sender_id: uid,
          target_type: "all",
          subject: "Broadcast",
          body: composeBody,
          priority: "normal",
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
      setContactSearch("");
      setProgramSearch("");
      setShowContactDropdown(false);
      setShowProgramDropdown(false);

      await fetchMessages();
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  // ── Filtered contact list for compose modal ──
  const filteredContacts = contacts.filter((c) => {
    if (!contactSearch) return true;
    const q = contactSearch.toLowerCase();
    return (
      (c.name || "").toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.role || "").toLowerCase().includes(q) ||
      (c.group_name || "").toLowerCase().includes(q)
    );
  });

  const filteredPrograms = availablePrograms.filter((p) => {
    if (!programSearch) return true;
    return (p.name || "").toLowerCase().includes(programSearch.toLowerCase());
  });

  const selectedContact = contacts.find(
    (c) => (c.cid || c.id) === composeRecipient,
  );

  const selectedGroup = availableGroups.find(
    (g) => String(g.id) === String(composeGroupId),
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
  const filteredConversations = conversations.filter((t) => {
    if (!search) return true;
    return t.label.toLowerCase().includes(search.toLowerCase());
  });

  // ── Render ──
  return (
    <div className="flex flex-col h-full">
      {/* ───── Header ───── */}
      <div className="flex items-center justify-between mb-4 px-6 pt-6">
        <div>
          <h1 className="text-lg font-black uppercase tracking-tight text-[var(--text-primary)]">
            Messages
          </h1>
          <p className="text-[10px] text-[var(--text-secondary)] mt-1">
            {totalUnread > 0
              ? `${totalUnread} unread`
              : `${conversations.length} conversation${conversations.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={() => {
            setShowCompose(true);
            setContactSearch("");
            setComposeRecipient("");
            setComposeBody("");
            setSendMode(
              sendModes.includes("individual")
                ? "individual"
                : sendModes[0] || "individual",
            );
          }}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
        >
          <Send className="w-3.5 h-3.5" /> New
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
                placeholder="Search conversations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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
                    ? "No matching conversations"
                    : "No conversations yet"}
                </p>
                <p className="text-[9px] text-[var(--text-secondary)] mt-1 opacity-50">
                  Click &quot;New&quot; to start messaging
                </p>
              </div>
            ) : (
              filteredConversations.map((thread) => {
                const isActive = activeConversation?.id === thread.id;
                const unread = unreadCounts[thread.id] || 0;
                const lastMsg = thread.lastMessage;
                const isLastFromOther = lastMsg?.sender_id !== uid;
                const Icon = threadIcon(thread);

                return (
                  <button
                    key={thread.id}
                    onClick={() => openConversation(thread)}
                    className={cn(
                      "w-full text-left p-3 transition-all flex items-center gap-3 border-b border-[var(--border-primary)]/50",
                      isActive
                        ? "bg-[var(--brand-orange)]/10"
                        : "hover:bg-tertiary",
                    )}
                  >
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                        isActive || unread > 0
                          ? "bg-[var(--brand-orange)]/15 text-[var(--brand-orange)]"
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
                        <span className="text-[8px] text-[var(--text-secondary)] shrink-0">
                          {formatTime(lastMsg?.created_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {thread.type === "individual" && !isLastFromOther && (
                          <Check className="w-2.5 h-2.5 text-[var(--text-secondary)] shrink-0" />
                        )}
                        <p
                          className={cn(
                            "text-[9px] truncate flex-1",
                            unread > 0
                              ? "font-bold text-[var(--text-primary)]"
                              : "text-[var(--text-secondary)]",
                          )}
                        >
                          {lastMsg?.body || lastMsg?.subject || ""}
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
                  Select a conversation
                </p>
                <p className="text-[10px] text-[var(--text-secondary)] mt-1 opacity-50">
                  Messages with unread replies are highlighted in orange
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
                <div className="w-9 h-9 rounded-full bg-[var(--brand-orange)]/15 text-[var(--brand-orange)] flex items-center justify-center flex-shrink-0">
                  {React.createElement(threadIcon(activeConversation), {
                    className: "w-4 h-4",
                  })}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-black text-[var(--text-primary)] uppercase tracking-wider truncate">
                    {activeConversation.label}
                  </p>
                  <p className="text-[8px] text-[var(--text-secondary)]">
                    {activeMessages.length} message
                    {activeMessages.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {/* Messages area */}
              <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-4 space-y-2">
                {activeMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-[10px] text-[var(--text-secondary)] italic">
                      No messages yet. Say hello!
                    </p>
                  </div>
                ) : (
                  activeMessages.map((msg, idx) => {
                    const isSent = msg.sender_id === uid;
                    const isLast = idx === activeMessages.length - 1;
                    const showRead = isSent && isLast && msg.is_read === 1;
                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex",
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
                            {msg.body}
                          </p>
                          <div
                            className={cn(
                              "flex items-center gap-1 mt-1",
                              isSent ? "justify-end" : "justify-start",
                            )}
                          >
                            <span className="text-[8px] opacity-50">
                              {formatTime(msg.created_at)}
                            </span>
                            {showRead && (
                              <span className="text-[8px] text-black/50 flex items-center gap-0.5">
                                <Check className="w-2.5 h-2.5" /> Read
                              </span>
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
              <div className="p-3 border-t border-[var(--border-primary)] flex-shrink-0">
                <div className="flex gap-2">
                  <input
                    ref={replyInputRef}
                    type="text"
                    placeholder="Type a message..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={handleReplyKeyDown}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)] focus:border-[var(--brand-orange)] transition-all"
                  />
                  <button
                    onClick={handleReply}
                    disabled={!replyText.trim() || sending}
                    className="px-5 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-wider hover:brightness-110 transition-all disabled:opacity-30 flex items-center gap-1.5"
                  >
                    {sending ? (
                      <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" /> Send
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
            className="w-full max-w-lg rounded-xl bg-[var(--bg-primary)] border border-[var(--border-primary)] p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">
                New Message
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
                    individual: "Direct",
                    group: "Group",
                    program: "Program",
                    broadcast: "Broadcast",
                  };
                  const Icon = icons[mode];
                  return (
                    <button
                      key={mode}
                      onClick={() => setSendMode(mode)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-[9px] font-black uppercase tracking-wider transition-all ${
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
                    <span className="text-[9px] text-[var(--text-secondary)]">
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
                      placeholder="Search for a person..."
                      value={contactSearch}
                      onChange={(e) => {
                        setContactSearch(e.target.value);
                        setShowContactDropdown(true);
                      }}
                      onFocus={() => setShowContactDropdown(true)}
                      className="w-full px-4 py-2.5 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)]"
                    />
                    {showContactDropdown && (
                      <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] shadow-xl">
                        {filteredContacts.length === 0 ? (
                          <p className="px-4 py-3 text-[10px] text-[var(--text-secondary)] italic">
                            No contacts found
                          </p>
                        ) : (
                          filteredContacts.map((c) => (
                            <button
                              key={c.cid || c.id}
                              onClick={() => {
                                setComposeRecipient(c.cid || c.id);
                                setContactSearch("");
                                setShowContactDropdown(false);
                              }}
                              className="w-full text-left px-4 py-2.5 hover:bg-tertiary transition-colors border-b border-[var(--border-primary)]/50 last:border-0"
                            >
                              <p className="text-[11px] font-bold text-[var(--text-primary)]">
                                {c.name}
                              </p>
                              <p className="text-[8px] text-[var(--text-secondary)]">
                                {c.email}
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
                <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  Select a contact group
                </p>
                <select
                  value={composeGroupId}
                  onChange={(e) => setComposeGroupId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none"
                >
                  <option value="">Select a group...</option>
                  {availableGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <p className="text-[8px] text-[var(--text-secondary)] italic">
                  Message will be sent to all members of this group.
                </p>
              </div>
            )}

            {/* Program: program picker */}
            {sendMode === "program" && (
              <div className="relative">
                {composeProgram ? (
                  <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-tertiary border border-[var(--border-primary)]">
                    <span className="text-[11px] font-bold text-[var(--text-primary)]">
                      {availablePrograms.find((p) => p.id === composeProgram)
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
                      placeholder="Search programs..."
                      value={programSearch}
                      onChange={(e) => {
                        setProgramSearch(e.target.value);
                        setShowProgramDropdown(true);
                      }}
                      onFocus={() => setShowProgramDropdown(true)}
                      className="w-full px-4 py-2.5 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)]"
                    />
                    {showProgramDropdown && (
                      <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] shadow-xl">
                        {filteredPrograms.length === 0 ? (
                          <p className="px-4 py-3 text-[10px] text-[var(--text-secondary)] italic">
                            No programs found
                          </p>
                        ) : (
                          filteredPrograms.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => {
                                setComposeProgram(p.id);
                                setProgramSearch("");
                                setShowProgramDropdown(false);
                              }}
                              className="w-full text-left px-4 py-2.5 hover:bg-tertiary transition-colors"
                            >
                              <p className="text-[11px] font-bold text-[var(--text-primary)]">
                                {p.name}
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
                This will send to ALL users across the platform.
              </div>
            )}

            {/* Message body */}
            <textarea
              placeholder={
                sendMode === "individual" ? "Type your message..." : "Message"
              }
              value={composeBody}
              onChange={(e) => setComposeBody(e.target.value)}
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
              className="w-full py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-black uppercase tracking-wider disabled:opacity-30 hover:brightness-110 transition-all flex items-center justify-center gap-2"
            >
              {sending ? (
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" /> Send Message
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

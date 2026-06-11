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
  User,
  X,
  ChevronLeft,
  Clock,
  Check,
  CheckCheck,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

/**
 * PMS MESSENGER — WhatsApp-style conversation interface
 *
 * Left panel: list of conversations with last message preview and unread badge.
 * Right panel: chat thread with reply input. Messages auto-mark as read on open.
 */
export default function PmMessages() {
  const [user, setUser] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeConversation, setActiveConversation] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [showCompose, setShowCompose] = useState(false);
  const [composeRecipient, setComposeRecipient] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [mobileView, setMobileView] = useState("list"); // 'list' or 'chat'
  const chatEndRef = useRef(null);

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(u);
  }, []);

  const uid = user?.cid || user?.id;

  // ── Fetch messages with is_read status ──
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

  // ── Fetch staff contacts ──
  const fetchContacts = useCallback(async () => {
    if (!uid) return;
    try {
      const seen = new Set();
      const contactRes = await fetch("/api/contacts");
      const contactData = await contactRes.json();
      let all = [];
      if (contactData.success) {
        const staff = contactData.contacts.filter(
          (c) =>
            c.status === "active" &&
            ["super_admin", "program_manager", "teacher", "staff"].includes(
              c.role,
            ),
        );
        staff.forEach((p) => {
          const pid = p.cid || p.id;
          if (!seen.has(pid) && pid !== uid) {
            seen.add(pid);
            all.push(p);
          }
        });
      }
      setContacts(all);
    } catch (e) {
      console.error(e);
    }
  }, [uid]);

  useEffect(() => {
    if (uid) {
      fetchMessages();
      fetchContacts();
    }
  }, [uid, fetchMessages, fetchContacts]);

  // ── Auto-poll for new messages every 10s ──
  useEffect(() => {
    if (!uid) return;
    const interval = setInterval(fetchMessages, 10000);
    return () => clearInterval(interval);
  }, [uid, fetchMessages]);

  // ── Build conversation list ──
  const conversations = useMemo(() => {
    if (!Array.isArray(messages) || !uid) return [];
    const threads = [];
    const seen = new Set();
    for (const msg of messages) {
      if (!msg || msg.target_type !== "individual") continue;
      const targetId = msg.sender_id === uid ? msg.recipient_id : msg.sender_id;
      if (!targetId) continue;
      const threadId = `individual_${targetId}`;
      if (!seen.has(threadId)) {
        seen.add(threadId);
        const contact = contacts.find((c) => (c.cid || c.id) === targetId);
        threads.push({
          id: threadId,
          otherId: targetId,
          label: contact?.name || targetId,
          lastMessage: msg,
        });
      }
    }
    // Sort by most recent first
    threads.sort(
      (a, b) =>
        new Date(b.lastMessage?.created_at || 0) -
        new Date(a.lastMessage?.created_at || 0),
    );
    return threads;
  }, [messages, contacts, uid]);

  // ── Compute unread count per conversation ──
  const unreadCounts = useMemo(() => {
    if (!Array.isArray(messages) || !uid) return {};
    const counts = {};
    for (const msg of messages) {
      if (!msg || msg.target_type !== "individual") continue;
      const isUnread =
        msg.recipient_id === uid &&
        (msg.is_read === 0 || msg.is_read === null || msg.is_read === false);
      if (isUnread) {
        const senderId = msg.sender_id;
        if (!senderId) continue;
        const threadId = `individual_${senderId}`;
        counts[threadId] = (counts[threadId] || 0) + 1;
      }
    }
    return counts;
  }, [messages, uid]);

  const totalUnread = useMemo(
    () => Object.values(unreadCounts).reduce((a, b) => a + b, 0),
    [unreadCounts],
  );

  // ── Messages for active conversation ──
  const activeMessages = useMemo(() => {
    if (!activeConversation) return [];
    const seen = new Set();
    return messages
      .filter((msg) => {
        if (seen.has(msg.id)) return false;
        seen.add(msg.id);
        const otherId =
          msg.sender_id === uid ? msg.recipient_id : msg.sender_id;
        return otherId === activeConversation.otherId;
      })
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }, [messages, activeConversation, uid]);

  // ── Mark conversation as read when opened ──
  const openConversation = useCallback(
    async (thread) => {
      setActiveConversation(thread);
      setMobileView("chat");
      // Mark unread messages as read
      const unreadIds = messages
        .filter(
          (msg) =>
            msg.recipient_id === uid &&
            msg.sender_id === thread.otherId &&
            (msg.is_read === 0 ||
              msg.is_read === null ||
              msg.is_read === false),
        )
        .map((msg) => msg.id);
      if (unreadIds.length > 0) {
        try {
          await fetch("/api/internal-comms", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messageIds: unreadIds }),
          });
          // Update local state
          setMessages((prev) =>
            prev.map((m) =>
              unreadIds.includes(m.id) ? { ...m, is_read: 1 } : m,
            ),
          );
        } catch (e) {
          console.error(e);
        }
      }
    },
    [uid, messages],
  );

  // ── Auto-scroll chat to bottom ──
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeMessages]);

  // ── Send reply ──
  const handleSendReply = async () => {
    if (!replyText.trim() || !activeConversation) return;
    setSending(true);
    try {
      await fetch("/api/internal-comms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender_id: uid,
          recipient_id: activeConversation.otherId,
          target_type: "individual",
          subject: replyText.substring(0, 50),
          body: replyText,
          priority: "normal",
        }),
      });
      setReplyText("");
      await fetchMessages();
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  // ── Send new message ──
  const handleSendNew = async () => {
    if (!composeBody.trim() || !composeRecipient) return;
    setSending(true);
    try {
      await fetch("/api/internal-comms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender_id: uid,
          recipient_id: composeRecipient,
          target_type: "individual",
          subject: composeBody.substring(0, 50),
          body: composeBody,
          priority: "normal",
        }),
      });
      setShowCompose(false);
      setComposeRecipient("");
      setComposeBody("");
      await fetchMessages();
      // Auto-open the new conversation
      const contact = contacts.find(
        (c) => (c.cid || c.id) === composeRecipient,
      );
      openConversation({
        id: `individual_${composeRecipient}`,
        otherId: composeRecipient,
        label: contact?.name || composeRecipient,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  // ── Filter contacts for compose ──
  const filteredContacts = contacts.filter((c) => {
    if (!contactSearch) return true;
    const q = contactSearch.toLowerCase();
    return (
      (c.name || "").toLowerCase().includes(q) ||
      (c.role || "").toLowerCase().includes(q)
    );
  });

  // ── Key handler for Enter to send ──
  const handleReplyKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday)
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  // ── RENDER ──
  return (
    <DashboardLayout role="program_manager">
      <div className="h-[calc(100vh-80px)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 lg:px-6 py-3 border-b border-[var(--border-primary)] flex-shrink-0">
          <div className="flex items-center gap-3">
            {mobileView === "chat" && activeConversation && (
              <button
                onClick={() => setMobileView("list")}
                className="lg:hidden p-1 rounded-lg hover:bg-tertiary"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <MessageSquare className="w-4 h-4 text-[var(--brand-orange)]" />
            <h1 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
              Messages
            </h1>
            {totalUnread > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-[var(--brand-orange)] text-black text-[8px] font-black">
                {totalUnread}
              </span>
            )}
          </div>
          <button
            onClick={() => {
              setShowCompose(true);
              setContactSearch("");
              setComposeRecipient("");
              setComposeBody("");
            }}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
          >
            <Send className="w-3.5 h-3.5" /> New
          </button>
        </div>

        {/* Main area */}
        <div className="flex-1 flex min-h-0">
          {/* ───── Conversation List ───── */}
          <div
            className={cn(
              "w-full lg:w-80 xl:w-96 flex-shrink-0 border-r border-[var(--border-primary)] bg-tertiary/20 flex flex-col",
              mobileView === "chat" && "hidden lg:flex",
            )}
          >
            {/* Search */}
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

            {/* Conversation items */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-6 h-6 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <MessageSquare className="w-10 h-10 text-[var(--text-secondary)] mb-3 opacity-30" />
                  <p className="text-[11px] font-bold text-[var(--text-secondary)]">
                    No conversations yet
                  </p>
                  <p className="text-[9px] text-[var(--text-secondary)] mt-1 opacity-50">
                    Click &quot;New&quot; to start messaging
                  </p>
                </div>
              ) : (
                conversations
                  .filter((t) =>
                    search
                      ? t.label.toLowerCase().includes(search.toLowerCase())
                      : true,
                  )
                  .map((thread) => {
                    const isActive = activeConversation?.id === thread.id;
                    const unread = unreadCounts[thread.id] || 0;
                    const lastMsg = thread.lastMessage;
                    const isLastFromOther = lastMsg?.sender_id !== uid;
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
                        {/* Avatar */}
                        <div
                          className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-black uppercase",
                            isActive
                              ? "bg-[var(--brand-orange)]/20 text-[var(--brand-orange)]"
                              : unread > 0
                                ? "bg-[var(--brand-orange)]/15 text-[var(--brand-orange)]"
                                : "bg-tertiary text-[var(--text-secondary)]",
                          )}
                        >
                          {(thread.label || "?").charAt(0)}
                        </div>

                        {/* Name + last message */}
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
                            {!isLastFromOther && (
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

                        {/* Unread badge */}
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
              "flex-1 flex flex-col",
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
                  <div className="w-9 h-9 rounded-full bg-[var(--brand-orange)]/15 text-[var(--brand-orange)] flex items-center justify-center text-[10px] font-black uppercase shrink-0">
                    {(activeConversation.label || "?").charAt(0)}
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

                {/* Messages */}
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
                            <p
                              className={cn(
                                "text-[12px] leading-relaxed",
                                isSent
                                  ? "text-black font-medium"
                                  : "font-medium",
                              )}
                            >
                              {msg.body}
                            </p>
                            <div
                              className={cn(
                                "flex items-center gap-1 mt-1",
                                isSent ? "justify-end" : "justify-start",
                              )}
                            >
                              <span
                                className={cn(
                                  "text-[8px]",
                                  isSent
                                    ? "text-black/60"
                                    : "text-[var(--text-secondary)]",
                                )}
                              >
                                {formatTime(msg.created_at)}
                              </span>
                              {isSent && showRead && (
                                <CheckCheck className="w-3 h-3 text-black/60" />
                              )}
                              {isSent && !showRead && (
                                <Check className="w-3 h-3 text-black/40" />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Reply input */}
                <div className="p-3 lg:p-4 border-t border-[var(--border-primary)] flex-shrink-0 bg-tertiary/20">
                  <div className="flex gap-2 items-end">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        placeholder="Type a message..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={handleReplyKeyDown}
                        className="w-full px-4 py-3 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[12px] font-medium text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)] focus:border-[var(--brand-orange)]/50 transition-all"
                      />
                    </div>
                    <button
                      onClick={handleSendReply}
                      disabled={sending || !replyText.trim()}
                      className="px-5 py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-wider disabled:opacity-30 hover:brightness-110 transition-all flex items-center gap-2"
                    >
                      {sending ? (
                        <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
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
            className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowCompose(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-primary)] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between p-5 pb-3 border-b border-[var(--border-primary)]">
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-[var(--brand-orange)]" />
                  <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">
                    New Message
                  </h2>
                </div>
                <button
                  onClick={() => setShowCompose(false)}
                  className="p-1 rounded-lg hover:bg-tertiary transition-all"
                >
                  <X className="w-4 h-4 text-[var(--text-secondary)]" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Recipient selector */}
                <div className="relative">
                  {composeRecipient ? (
                    <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[var(--brand-orange)]/15 text-[var(--brand-orange)] flex items-center justify-center text-[9px] font-black uppercase">
                          {(
                            contacts.find(
                              (c) => (c.cid || c.id) === composeRecipient,
                            )?.name || "?"
                          ).charAt(0)}
                        </div>
                        <span className="text-[12px] font-bold text-[var(--text-primary)]">
                          {contacts.find(
                            (c) => (c.cid || c.id) === composeRecipient,
                          )?.name || composeRecipient}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setComposeRecipient("");
                          setContactSearch("");
                        }}
                        className="p-1 rounded hover:bg-white/5"
                      >
                        <X className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
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
                        className="w-full px-4 py-3 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[12px] font-bold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)] focus:border-[var(--brand-orange)]/50 transition-all"
                      />
                      {showContactDropdown && (
                        <div className="absolute z-10 mt-1.5 w-full max-h-56 overflow-y-auto rounded-xl bg-[var(--bg-primary)] border border-[var(--border-primary)] shadow-xl">
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
                                className="w-full text-left px-4 py-3 hover:bg-tertiary transition-colors border-b border-[var(--border-primary)]/50 last:border-0 flex items-center gap-3"
                              >
                                <div className="w-8 h-8 rounded-full bg-tertiary text-[var(--text-secondary)] flex items-center justify-center text-[9px] font-black uppercase shrink-0">
                                  {(c.name || "?").charAt(0)}
                                </div>
                                <div>
                                  <p className="text-[11px] font-bold text-[var(--text-primary)]">
                                    {c.name}
                                  </p>
                                  <p className="text-[8px] text-[var(--text-secondary)]">
                                    {c.role?.replace(/_/g, " ")}
                                  </p>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Message input */}
                <textarea
                  placeholder="Write your message..."
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[12px] font-bold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)] resize-none focus:border-[var(--brand-orange)]/50 transition-all"
                />

                {/* Send button */}
                <button
                  onClick={handleSendNew}
                  disabled={sending || !composeBody.trim() || !composeRecipient}
                  className="w-full py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-black uppercase tracking-wider disabled:opacity-30 hover:brightness-110 transition-all flex items-center justify-center gap-2"
                >
                  {sending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Message
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Send,
  MessageSquare,
  Search,
  Users,
  Briefcase,
  User,
  X,
  ChevronRight,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function SuperAdminComms() {
  const [user, setUser] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [search, setSearch] = useState("");

  // Compose state
  const [sendMode, setSendMode] = useState("individual");
  const [composeRecipient, setComposeRecipient] = useState("");
  const [composeGroup, setComposeGroup] = useState("staff");
  const [composeProgram, setComposeProgram] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");

  // Search state for dropdowns
  const [contactSearch, setContactSearch] = useState("");
  const [programSearch, setProgramSearch] = useState("");
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [showProgramDropdown, setShowProgramDropdown] = useState(false);

  // Active conversation
  const [activeConversation, setActiveConversation] = useState(null);

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(u);
  }, []);

  const uid = user?.cid || user?.id;

  const fetchMessages = useCallback(async () => {
    if (!uid) return;
    try {
      const res = await fetch(`/api/internal-comms?cid=${uid}`);
      const data = await res.json();
      if (data.success) setMessages(data.messages || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  const fetchContacts = useCallback(async () => {
    try {
      const res = await fetch("/api/contacts");
      const data = await res.json();
      if (data.success) {
        setContacts((data.contacts || []).filter((c) => c.status === "active"));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchPrograms = useCallback(async () => {
    try {
      const res = await fetch("/api/programs");
      const data = await res.json();
      if (data.success) setPrograms(data.programs || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (uid) {
      fetchMessages();
      fetchContacts();
      fetchPrograms();
    }
  }, [uid, fetchMessages, fetchContacts, fetchPrograms]);

  // Build conversation threads from messages
  const conversations = useMemo(() => {
    const threads = [];
    const seen = new Set();

    messages.forEach((msg) => {
      let threadId;
      let label;
      let icon = "user";

      if (msg.target_type === "individual") {
        // Determine the other participant
        const otherId =
          msg.sender_id === uid ? msg.recipient_id : msg.sender_id;
        if (!otherId) return;
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
        label = `To ${(msg.target_id || "").replace(/_/g, " ")}`;
        icon = "group";
      } else if (msg.target_type === "program") {
        threadId = `program_${msg.target_id}`;
        const prog = programs.find((p) => p.id === msg.target_id);
        label = `Program: ${prog?.name || msg.target_id}`;
        icon = "program";
      } else {
        return;
      }

      if (!seen.has(threadId)) {
        seen.add(threadId);
        threads.push({
          id: threadId,
          label,
          type: msg.target_type,
          targetId: msg.target_id,
          lastMessage: msg,
          icon,
        });
      }
    });

    // Sort by most recent message
    threads.sort(
      (a, b) =>
        new Date(b.lastMessage?.created_at || 0) -
        new Date(a.lastMessage?.created_at || 0),
    );

    return threads;
  }, [messages, contacts, programs, uid]);

  // Filter messages for active conversation
  const activeMessages = useMemo(() => {
    if (!activeConversation) return [];
    return messages.filter((msg) => {
      if (activeConversation.type === "individual") {
        const otherId =
          msg.sender_id === uid ? msg.recipient_id : msg.sender_id;
        return otherId === activeConversation.targetId;
      }
      if (activeConversation.type === "all") {
        return msg.target_type === "all";
      }
      if (activeConversation.type === "role") {
        return (
          msg.target_type === "role" &&
          msg.target_id === activeConversation.targetId
        );
      }
      if (activeConversation.type === "program") {
        return (
          msg.target_type === "program" &&
          msg.target_id === activeConversation.targetId
        );
      }
      return false;
    });
  }, [messages, activeConversation, uid]);

  const handleSend = async () => {
    if (!composeSubject || !composeBody) return;
    let payload;
    if (sendMode === "individual") {
      if (!composeRecipient) return;
      payload = {
        sender_id: uid,
        recipient_id: composeRecipient,
        target_type: "individual",
        subject: composeSubject,
        body: composeBody,
        priority: "normal",
      };
    } else if (sendMode === "group") {
      payload = {
        sender_id: uid,
        target_type: "role",
        target_id: composeGroup,
        subject: composeSubject,
        body: composeBody,
        priority: "normal",
      };
    } else if (sendMode === "program") {
      if (!composeProgram) return;
      payload = {
        sender_id: uid,
        target_type: "program",
        target_id: composeProgram,
        subject: composeSubject,
        body: composeBody,
        priority: "normal",
      };
    } else if (sendMode === "broadcast") {
      payload = {
        sender_id: uid,
        target_type: "all",
        subject: composeSubject,
        body: composeBody,
        priority: "normal",
      };
    }
    try {
      await fetch("/api/internal-comms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setShowCompose(false);
      setComposeRecipient("");
      setComposeGroup("staff");
      setComposeProgram("");
      setComposeSubject("");
      setComposeBody("");
      await fetchMessages();
      // Auto-select the conversation we just sent to
      const contact =
        payload.target_type === "individual"
          ? contacts.find((c) => (c.cid || c.id) === payload.recipient_id)
          : null;
      const prog =
        payload.target_type === "program"
          ? programs.find((p) => p.id === payload.target_id)
          : null;
      setActiveConversation({
        id:
          payload.target_type === "individual"
            ? `individual_${payload.recipient_id}`
            : payload.target_type === "role"
              ? `role_${payload.target_id}`
              : payload.target_type === "program"
                ? `program_${payload.target_id}`
                : "broadcast_all",
        label:
          payload.target_type === "individual"
            ? contact?.name || payload.recipient_id
            : payload.target_type === "role"
              ? `To ${(payload.target_id || "").replace(/_/g, " ")}`
              : payload.target_type === "program"
                ? `Program: ${prog?.name || payload.target_id}`
                : "Broadcast (All Users)",
        type: payload.target_type,
        targetId:
          payload.target_type === "individual"
            ? payload.recipient_id
            : payload.target_id,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const filteredContacts = contacts.filter((c) => {
    if (!contactSearch) return true;
    const q = contactSearch.toLowerCase();
    return (
      (c.name || "").toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.role || "").toLowerCase().includes(q)
    );
  });

  const filteredPrograms = programs.filter((p) => {
    if (!programSearch) return true;
    return (p.name || "").toLowerCase().includes(programSearch.toLowerCase());
  });

  const selectedContact = contacts.find(
    (c) => (c.cid || c.id) === composeRecipient,
  );
  const selectedProgram = programs.find((p) => p.id === composeProgram);

  const threadIcon = (type) => {
    if (type === "user" || type === "individual") return User;
    if (type === "group" || type === "role") return Users;
    if (type === "program") return Briefcase;
    return MessageSquare;
  };

  return (
    <DashboardLayout role="super_admin">
      <div className="p-6 h-[calc(100vh-80px)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight text-[var(--text-primary)]">
              Messages
            </h1>
            <p className="text-[10px] text-[var(--text-secondary)] mt-1">
              {conversations.length} conversations
            </p>
          </div>
          <button
            onClick={() => {
              setShowCompose(true);
              fetchContacts();
              fetchPrograms();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
          >
            <Send className="w-3.5 h-3.5" /> New Message
          </button>
        </div>

        {/* Body: conversation sidebar + message panel */}
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Conversation sidebar */}
          <div className="w-64 flex-shrink-0 rounded-xl border border-[var(--border-primary)] bg-tertiary/30 flex flex-col">
            <div className="p-3 border-b border-[var(--border-primary)]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" />
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[10px] font-medium text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none focus:border-[var(--brand-orange)] transition-all"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {loading ? (
                <div className="text-center py-8">
                  <div className="w-6 h-6 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : conversations.length === 0 ? (
                <p className="text-[10px] text-[var(--text-secondary)] italic text-center py-8">
                  No conversations yet
                </p>
              ) : (
                conversations.map((thread) => {
                  const Icon = threadIcon(thread.icon);
                  const isActive = activeConversation?.id === thread.id;
                  return (
                    <button
                      key={thread.id}
                      onClick={() => setActiveConversation(thread)}
                      className={`w-full text-left p-2.5 rounded-lg transition-all flex items-center gap-2.5 ${
                        isActive
                          ? "bg-[var(--brand-orange)]/10 border border-[var(--brand-orange)]/30"
                          : "hover:bg-tertiary border border-transparent"
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isActive
                            ? "bg-[var(--brand-orange)]/20"
                            : "bg-tertiary"
                        }`}
                      >
                        <Icon
                          className={`w-3.5 h-3.5 ${isActive ? "text-[var(--brand-orange)]" : "text-[var(--text-secondary)]"}`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold text-[var(--text-primary)] truncate">
                          {thread.label}
                        </p>
                        <p className="text-[8px] text-[var(--text-secondary)] truncate mt-0.5">
                          {thread.lastMessage?.subject || ""}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Message panel */}
          <div className="flex-1 rounded-xl border border-[var(--border-primary)] bg-tertiary/30 flex flex-col">
            {!activeConversation ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="w-12 h-12 text-[var(--text-secondary)] mx-auto mb-4 opacity-30" />
                  <p className="text-[12px] font-bold text-[var(--text-secondary)]">
                    Select a conversation
                  </p>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-1 opacity-50">
                    Or click "New Message" to start one
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Conversation header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-primary)] flex-shrink-0">
                  {(() => {
                    const Icon = threadIcon(activeConversation.type);
                    return (
                      <Icon className="w-4 h-4 text-[var(--brand-orange)]" />
                    );
                  })()}
                  <span className="text-[11px] font-black text-[var(--text-primary)] uppercase tracking-wider">
                    {activeConversation.label}
                  </span>
                  <span className="text-[9px] text-[var(--text-secondary)] ml-auto">
                    {activeMessages.length} message
                    {activeMessages.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {activeMessages.length === 0 ? (
                    <p className="text-[10px] text-[var(--text-secondary)] italic text-center py-8">
                      No messages in this conversation
                    </p>
                  ) : (
                    [...activeMessages].reverse().map((msg) => {
                      const isSent = msg.sender_id === uid;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isSent ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[70%] p-3 rounded-xl ${
                              isSent
                                ? "bg-[var(--brand-orange)] text-black rounded-br-md"
                                : "bg-tertiary border border-[var(--border-primary)] text-[var(--text-primary)] rounded-bl-md"
                            }`}
                          >
                            <p
                              className={`text-[9px] font-black uppercase tracking-wider mb-1 ${isSent ? "text-black/60" : "text-[var(--text-secondary)]"}`}
                            >
                              {msg.subject}
                            </p>
                            <p
                              className={`text-[11px] ${isSent ? "font-bold text-black" : "font-bold"}`}
                            >
                              {msg.body}
                            </p>
                            <p
                              className={`text-[8px] mt-1 ${isSent ? "text-black/50" : "text-[var(--text-secondary)]"}`}
                            >
                              {msg.created_at
                                ? new Date(msg.created_at).toLocaleString()
                                : ""}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Quick reply */}
                <div className="p-3 border-t border-[var(--border-primary)] flex-shrink-0">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Type a quick reply..."
                      value={composeSubject}
                      onChange={(e) => setComposeSubject(e.target.value)}
                      className="flex-1 px-4 py-2 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)]"
                    />
                    <button
                      onClick={async () => {
                        if (!composeSubject) return;
                        let payload;
                        if (activeConversation.type === "individual") {
                          payload = {
                            sender_id: uid,
                            recipient_id: activeConversation.targetId,
                            target_type: "individual",
                            subject: composeSubject,
                            body: composeBody || composeSubject,
                            priority: "normal",
                          };
                        } else if (activeConversation.type === "role") {
                          payload = {
                            sender_id: uid,
                            target_type: "role",
                            target_id: activeConversation.targetId,
                            subject: composeSubject,
                            body: composeBody || composeSubject,
                            priority: "normal",
                          };
                        } else if (activeConversation.type === "program") {
                          payload = {
                            sender_id: uid,
                            target_type: "program",
                            target_id: activeConversation.targetId,
                            subject: composeSubject,
                            body: composeBody || composeSubject,
                            priority: "normal",
                          };
                        } else if (activeConversation.type === "all") {
                          payload = {
                            sender_id: uid,
                            target_type: "all",
                            subject: composeSubject,
                            body: composeBody || composeSubject,
                            priority: "normal",
                          };
                        }
                        if (!payload) return;
                        await fetch("/api/internal-comms", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(payload),
                        });
                        setComposeSubject("");
                        setComposeBody("");
                        fetchMessages();
                      }}
                      className="px-4 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-[9px] font-black uppercase tracking-wider hover:brightness-110 transition-all"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Compose Modal */}
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

              <div className="flex gap-2 p-1 rounded-lg bg-tertiary border border-[var(--border-primary)]">
                {[
                  { id: "individual", label: "Individual", icon: User },
                  { id: "group", label: "Group", icon: Users },
                  { id: "program", label: "Program", icon: Briefcase },
                  { id: "broadcast", label: "Broadcast", icon: Send },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setSendMode(mode.id)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-[9px] font-black uppercase tracking-wider transition-all ${sendMode === mode.id ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
                  >
                    <mode.icon className="w-3.5 h-3.5" />
                    {mode.label}
                  </button>
                ))}
              </div>

              {sendMode === "individual" && (
                <div className="relative">
                  {selectedContact ? (
                    <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-tertiary border border-[var(--border-primary)]">
                      <span className="text-[11px] font-bold text-[var(--text-primary)]">
                        {selectedContact.name} (
                        {selectedContact.role?.replace(/_/g, " ")})
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
                                  {c.role?.replace(/_/g, " ")} — {c.email}
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

              {sendMode === "group" && (
                <select
                  value={composeGroup}
                  onChange={(e) => setComposeGroup(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none"
                >
                  <option value="staff">All Staff</option>
                  <option value="program_manager">All Program Managers</option>
                  <option value="teacher">All Teachers</option>
                  <option value="participant">All Participants</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              )}

              {sendMode === "program" && (
                <div className="relative">
                  {selectedProgram ? (
                    <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-tertiary border border-[var(--border-primary)]">
                      <span className="text-[11px] font-bold text-[var(--text-primary)]">
                        {selectedProgram.name}
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
                        placeholder="Search for a program..."
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
                                className="w-full text-left px-4 py-2.5 hover:bg-tertiary transition-colors border-b border-[var(--border-primary)]/50 last:border-0"
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

              {sendMode === "broadcast" && (
                <div className="px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <p className="text-[10px] font-bold text-amber-400 text-center">
                    This message will be sent to all users in the system
                  </p>
                </div>
              )}

              <input
                type="text"
                placeholder="Subject"
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)]"
              />
              <textarea
                placeholder="Message"
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                rows={4}
                className="w-full px-4 py-2.5 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)] resize-none"
              />
              <button
                onClick={handleSend}
                disabled={!composeSubject || !composeBody}
                className="w-full py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-black uppercase tracking-wider disabled:opacity-30 hover:brightness-110 transition-all"
              >
                Send Message
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

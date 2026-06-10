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
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function PmMessages() {
  const [user, setUser] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [activeConversation, setActiveConversation] = useState(null);

  const [sendMode, setSendMode] = useState("individual");
  const [composeRecipient, setComposeRecipient] = useState("");
  const [composeProgram, setComposeProgram] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [showContactDropdown, setShowContactDropdown] = useState(false);

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(u);
  }, []);

  const uid = user?.cid || user?.id;

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

  const fetchContacts = useCallback(async () => {
    if (!uid) return;
    try {
      const allowed = [];
      const seen = new Set();
      const contactRes = await fetch("/api/contacts");
      const contactData = await contactRes.json();
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
          if (!seen.has(pid)) {
            seen.add(pid);
            allowed.push(p);
          }
        });
      }
      const progRes = await fetch(`/api/pm/programs?assigned_pm_id=${uid}`);
      const progData = await progRes.json();
      const myPrograms = progData.programs || [];
      setPrograms(myPrograms);
      for (const prog of myPrograms) {
        try {
          const stateRes = await fetch(`/api/pm/full-state?id=${prog.id}`);
          const stateData = await stateRes.json();
          if (stateData.success) {
            (stateData.participants || []).forEach((p) => {
              const pid = p.cid || p.id;
              if (!seen.has(pid)) {
                seen.add(pid);
                allowed.push({ ...p, role: "participant" });
              }
            });
          }
        } catch (e) {
          /* skip */
        }
      }
      setContacts(allowed);
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

  const conversations = useMemo(() => {
    const threads = [];
    const seen = new Set();
    messages.forEach((msg) => {
      let threadId,
        label,
        icon = "user";
      if (msg.target_type === "individual") {
        const otherId =
          msg.sender_id === uid ? msg.recipient_id : msg.sender_id;
        if (!otherId) return;
        threadId = `individual_${otherId}`;
        const contact = contacts.find((c) => (c.cid || c.id) === otherId);
        label = contact?.name || otherId;
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
          targetId: msg.target_type === "individual" ? otherId : msg.target_id,
          lastMessage: msg,
          icon,
        });
      }
    });
    threads.sort(
      (a, b) =>
        new Date(b.lastMessage?.created_at || 0) -
        new Date(a.lastMessage?.created_at || 0),
    );
    return threads;
  }, [messages, contacts, programs, uid]);

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
      if (activeConversation.type === "program")
        return (
          msg.target_type === "program" &&
          msg.target_id === activeConversation.targetId
        );
      return false;
    });
  }, [messages, activeConversation, uid]);

  const handleSend = async () => {
    if (!composeBody) return;
    let payload;
    if (sendMode === "individual") {
      if (!composeRecipient) return;
      payload = {
        sender_id: uid,
        recipient_id: composeRecipient,
        target_type: "individual",
        subject: composeBody.substring(0, 50),
        body: composeBody,
        priority: "normal",
      };
    } else if (sendMode === "program") {
      if (!composeProgram) return;
      payload = {
        sender_id: uid,
        target_type: "program",
        target_id: composeProgram,
        subject: composeBody.substring(0, 50),
        body: composeBody,
        priority: "normal",
      };
    }
    try {
      setSending(true);
      await fetch("/api/internal-comms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setShowCompose(false);
      setComposeRecipient("");
      setComposeProgram("");
      setComposeBody("");
      await fetchMessages();
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
            : `program_${payload.target_id}`,
        label:
          payload.target_type === "individual"
            ? contact?.name || payload.recipient_id
            : `Program: ${prog?.name || payload.target_id}`,
        type: payload.target_type,
        targetId:
          payload.target_type === "individual"
            ? payload.recipient_id
            : payload.target_id,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  const filteredContacts = contacts.filter((c) => {
    if (!contactSearch) return true;
    const q = contactSearch.toLowerCase();
    return (
      (c.name || "").toLowerCase().includes(q) ||
      (c.role || "").toLowerCase().includes(q)
    );
  });

  const threadIcon = (type) => (type === "program" ? Briefcase : User);

  return (
    <DashboardLayout role="program_manager">
      <div className="p-6 h-[calc(100vh-80px)] flex flex-col">
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
            }}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
          >
            <Send className="w-3.5 h-3.5" /> New Message
          </button>
        </div>

        <div className="flex-1 flex gap-4 min-h-0">
          {/* Conversation sidebar */}
          <div className="w-64 flex-shrink-0 rounded-xl border border-[var(--border-primary)] bg-tertiary/30 flex flex-col">
            <div className="p-3 border-b border-[var(--border-primary)]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" />
                <input
                  type="text"
                  placeholder="Search..."
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
                  No conversations
                </p>
              ) : (
                conversations.map((thread) => {
                  const Icon = threadIcon(thread.icon);
                  const isActive = activeConversation?.id === thread.id;
                  return (
                    <button
                      key={thread.id}
                      onClick={() => setActiveConversation(thread)}
                      className={`w-full text-left p-2.5 rounded-lg transition-all flex items-center gap-2.5 ${isActive ? "bg-[var(--brand-orange)]/10 border border-[var(--brand-orange)]/30" : "hover:bg-tertiary border border-transparent"}`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isActive ? "bg-[var(--brand-orange)]/20" : "bg-tertiary"}`}
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
                    Or click &quot;New Message&quot; to start one
                  </p>
                </div>
              </div>
            ) : (
              <>
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
                            className={`max-w-[70%] p-3 rounded-xl ${isSent ? "bg-[var(--brand-orange)] text-black rounded-br-md" : "bg-tertiary border border-[var(--border-primary)] text-[var(--text-primary)] rounded-bl-md"}`}
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
                <div className="p-3 border-t border-[var(--border-primary)] flex-shrink-0">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Type a quick reply..."
                      value={composeBody}
                      onChange={(e) => setComposeBody(e.target.value)}
                      className="flex-1 px-4 py-2 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)]"
                    />
                    <button
                      onClick={async () => {
                        if (!composeBody) return;
                        let payload;
                        if (activeConversation.type === "individual")
                          payload = {
                            sender_id: uid,
                            recipient_id: activeConversation.targetId,
                            target_type: "individual",
                            subject: "Re: " + activeConversation.label,
                            body: composeBody,
                            priority: "normal",
                          };
                        else if (activeConversation.type === "program")
                          payload = {
                            sender_id: uid,
                            target_type: "program",
                            target_id: activeConversation.targetId,
                            subject: "Reply to " + activeConversation.label,
                            body: composeBody,
                            priority: "normal",
                          };
                        if (!payload) return;
                        await fetch("/api/internal-comms", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(payload),
                        });
                        setComposeBody("");
                        await fetchMessages();
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
                  { id: "program", label: "To Program", icon: Briefcase },
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
                  {composeRecipient ? (
                    <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-tertiary border border-[var(--border-primary)]">
                      <span className="text-[11px] font-bold text-[var(--text-primary)]">
                        {contacts.find(
                          (c) => (c.cid || c.id) === composeRecipient,
                        )?.name || composeRecipient}
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
                                  {c.role?.replace(/_/g, " ")}
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

              {sendMode === "program" && (
                <select
                  value={composeProgram}
                  onChange={(e) => setComposeProgram(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none"
                >
                  <option value="">Select a program...</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}

              <textarea
                placeholder="Message"
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                rows={4}
                className="w-full px-4 py-2.5 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)] resize-none"
              />
              <button
                onClick={handleSend}
                disabled={sending || !composeBody}
                className="w-full py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-black uppercase tracking-wider disabled:opacity-30 hover:brightness-110 transition-all"
              >
                {sending ? "Sending..." : "Send Message"}
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

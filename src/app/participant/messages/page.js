"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Send, MessageSquare, Search, X } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function ParticipantMessages() {
  const [user, setUser] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(u);
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!user?.cid && !user?.id) return;
    try {
      const res = await fetch(
        `/api/internal-comms?cid=${user.cid || user.id}`,
      );
      const data = await res.json();
      if (data.success) setMessages(data.messages || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchContacts = useCallback(async () => {
    if (!user?.cid && !user?.id) return;
    try {
      // Participants can message: super_admin + program PM + their teachers
      const contactRes = await fetch("/api/contacts");
      const contactData = await contactRes.json();
      if (contactData.success) {
        const allowed = contactData.contacts.filter(
          (c) =>
            c.status === "active" &&
            ["super_admin", "program_manager", "teacher", "staff"].includes(
              c.role,
            ),
        );
        setContacts(allowed);
      }
    } catch (e) {
      console.error(e);
    }
  }, [user]);

  useEffect(() => {
    if (user?.cid || user?.id) {
      fetchMessages();
      fetchContacts();
    }
  }, [user, fetchMessages, fetchContacts]);

  const handleSend = async () => {
    if (!composeBody || !composeSubject || !composeTo) return;
    try {
      await fetch("/api/internal-comms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender_id: user.cid || user.id,
          recipient_id: composeTo,
          target_type: "individual",
          subject: composeSubject,
          body: composeBody,
          priority: "normal",
        }),
      });
      setShowCompose(false);
      setComposeTo("");
      setComposeSubject("");
      setComposeBody("");
      fetchMessages();
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = messages.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (m.subject || "").toLowerCase().includes(q) ||
      (m.body || "").toLowerCase().includes(q)
    );
  });

  return (
    <DashboardLayout role="participant">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight text-[var(--text-primary)]">
              Communication
            </h1>
            <p className="text-[10px] text-[var(--text-secondary)] mt-1">
              {messages.length} messages
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-52 pl-9 pr-4 py-2 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[11px] font-medium outline-none focus:border-[var(--brand-orange)] transition-all"
              />
            </div>
            <button
              onClick={() => { setShowCompose(true); fetchContacts(); }}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
            >
              <Send className="w-3.5 h-3.5" /> New Message
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {loading ? (
            <div className="text-center py-20">
              <div className="w-8 h-8 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <MessageSquare className="w-10 h-10 text-[var(--text-secondary)] mx-auto mb-3 opacity-30" />
              <p className="text-[11px] font-bold text-[var(--text-secondary)]">
                No messages
              </p>
            </div>
          ) : (
            filtered.map((msg) => (
              <div key={msg.id} className="p-4 rounded-xl border border-[var(--border-primary)] bg-tertiary hover:border-[var(--brand-orange)]/20 transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-bold text-[var(--brand-orange)] uppercase tracking-wider">
                        {msg.sender_id === (user?.cid || user?.id) ? "Sent" : "Received"}
                      </span>
                    </div>
                    <h3 className="text-[13px] font-bold text-[var(--text-primary)]">{msg.subject}</h3>
                    <p className="text-[11px] text-[var(--text-secondary)] mt-1 line-clamp-2">{msg.body}</p>
                  </div>
                  <span className="text-[8px] text-[var(--text-secondary)] whitespace-nowrap ml-3">
                    {msg.created_at ? new Date(msg.created_at).toLocaleDateString() : ""}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {showCompose && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm" onClick={() => setShowCompose(false)}>
            <div className="w-full max-w-lg rounded-xl bg-[var(--bg-primary)] border border-[var(--border-primary)] p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">New Message</h2>
                <button onClick={() => setShowCompose(false)}><X className="w-5 h-5 text-[var(--text-secondary)]" /></button>
              </div>
              <select value={composeTo} onChange={(e) => setComposeTo(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none">
                <option value="">Select recipient...</option>
                {contacts.map((c) => (
                  <option key={c.cid || c.id} value={c.cid || c.id}>
                    {c.name} ({c.role?.replace(/_/g, " ") || "staff"})
                  </option>
                ))}
              </select>
              <input type="text" placeholder="Subject" value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold outline-none placeholder:text-[var(--text-secondary)]" />
              <textarea placeholder="Message" value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)} rows={5}
                className="w-full px-4 py-2.5 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold outline-none placeholder:text-[var(--text-secondary)] resize-none" />
              <button onClick={handleSend}
                disabled={!composeTo || !composeSubject || !composeBody}
                className="w-full py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-black uppercase tracking-wider disabled:opacity-30 hover:brightness-110 transition-all">
                Send Message
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

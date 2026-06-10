"use client";
import React, { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Mail,
  Search,
  MessageCircle,
  Send,
  Shield,
  Loader2,
  ChevronRight,
  Filter,
  Briefcase,
  Key,
  Copy,
  Check,
  Globe,
  X,
} from "lucide-react";
import { IMPACT_CACHE } from "@/utils/impactCache";
import { useRouter } from "next/navigation";

/**
 * COHORT OUTREACH TERMINAL (PM RESTRICTED)
 * Specialized communication suite for assigned program participants.
 */
export default function PMCohortOutreach() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedProgram, setSelectedProgram] = useState("All Assignments");
  const [assignedPrograms, setAssignedPrograms] = useState([]);
  const [staffContacts, setStaffContacts] = useState([]);
  const [teams, setTeams] = useState([]);
  const [viewMode, setViewMode] = useState("participants"); // 'participants' or 'staff'
  const [deliveryMode, setDeliveryMode] = useState("individuals"); // 'individuals' or 'teams'
  const [showInbox, setShowInbox] = useState(false);
  const [messages, setMessages] = useState([]);
  const [showCompose, setShowCompose] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeTarget, setComposeTarget] = useState("individual");
  const router = useRouter();

  // Fetch messages
  const fetchMessages = async () => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const uid = user.cid || user.id;
    if (!uid) return;
    try {
      const res = await fetch(`/api/internal-comms?cid=${uid}`);
      const data = await res.json();
      if (data.success) setMessages(data.messages || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchAssignedRegistry();
  }, []);

  const fetchAssignedRegistry = async () => {
    try {
      setLoading(true);
      const user = JSON.parse(localStorage.getItem("user") || "{}");

      // 1. Fetch programs to identify assignments
      const progRes = await fetch(
        "/api/pm/programs?assigned_pm_id=" + (user.cid || user.id),
      );
      const progData = await progRes.json();
      const myProgs = progData.programs || [];
      setAssignedPrograms(myProgs);

      const myProgIds = myProgs.map((p) => p.id);

      // 2. Fetch staff and teams for these programs
      const statePromises = myProgIds.map((id) =>
        fetch(`/api/pm/full-state?id=${id}`).then((r) => r.json()),
      );
      const stateData = await Promise.all(statePromises);

      const allAssignedStaff = stateData.flatMap((d) => {
        const direct = d.assignedStaff || [];
        let asstIds = [];
        try {
          const parsed = JSON.parse(d.program?.assigned_assistant_id || "[]");
          asstIds = Array.isArray(parsed)
            ? parsed
            : d.program?.assigned_assistant_id
              ? [d.program.assigned_assistant_id]
              : [];
        } catch (e) {}

        const fromAssistants = (d.staffList || [])
          .filter((s) => asstIds.includes(s.cid))
          .map((s) => ({ ...s, role: "Team Member" }));
        return [...direct, ...fromAssistants];
      });
      const allTeams = stateData.flatMap((d) => d.teams || []);

      // Unique by CID/ID
      setStaffContacts(
        Array.from(new Map(allAssignedStaff.map((s) => [s.cid, s])).values()),
      );
      setTeams(Array.from(new Map(allTeams.map((t) => [t.id, t])).values()));

      // 3. Fetch contacts
      const res = await fetch(
        `/api/contacts/full-state?pm_id=${user.cid || user.id}`,
      );
      const data = await res.json();

      if (data.success) {
        setContacts(data.contacts || []);
        setTeams(data.teams || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const currentList =
    viewMode === "participants"
      ? deliveryMode === "individuals"
        ? contacts
        : teams
      : staffContacts;

  const filtered = currentList.filter((c) => {
    const searchVal = search.toLowerCase();
    const nameMatch = (c.name || "").toLowerCase().includes(searchVal);
    const emailMatch =
      viewMode === "participants" && deliveryMode === "teams"
        ? false
        : (c.email || "").toLowerCase().includes(searchVal);
    const matchesSearch = nameMatch || emailMatch;

    if (viewMode === "staff") return matchesSearch;

    const matchesCohort =
      selectedProgram === "All Assignments" ||
      (deliveryMode === "individuals"
        ? c.program_id === selectedProgram
        : c.program_id === selectedProgram);

    // Also check by group_name for contacts that matched via group name
    if (!matchesCohort && selectedProgram !== "All Assignments") {
      const selectedProg = assignedPrograms.find(
        (p) => p.id === selectedProgram,
      );
      if (
        selectedProg &&
        (c.group_name || "").toUpperCase() === selectedProg.name.toUpperCase()
      ) {
        return matchesSearch;
      }
    }

    return matchesSearch && matchesCohort;
  });

  // --- Credential Management ---
  const [showCredsModal, setShowCredsModal] = useState(false);
  const [credsForm, setCredsForm] = useState({
    cid: "",
    name: "",
    email: "",
    password: "",
    phone: "",
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  const generatePassword = () => {
    const chars =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#\$%";
    return Array.from({ length: 10 }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length)),
    ).join("");
  };

  const handleResetPassword = async (c) => {
    const newPass = generatePassword();
    setIsProcessing(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cid: c.cid, password: newPass }),
      });
      if ((await res.json()).success) {
        setCredsForm({ ...c, password: newPass });
        setShowCredsModal(true);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const getPortalUrl = (c) => {
    const isStaff =
      c.role?.toLowerCase() === "staff" ||
      c.group_name?.toUpperCase() === "FUTURE STUDIO";
    return `${window.location.origin}${isStaff ? "/login" : "/login"}`;
  };

  const buildWelcomeMessage = (c, pass) => {
    const portalUrl = getPortalUrl(c);
    return `Welcome to ImpactOS, ${c.name}!\n\nYour account has been created. Use the credentials below to log in and access your dashboard.\n\n🔗 Login URL: ${portalUrl}\n📧 Email: ${c.email}\n🔑 Password: ${pass || "N/A"}\n\nFor security, please change your password after your first login.\n\nBest regards,\nThe ImpactOS Team`;
  };

  const copyWelcomeMessage = (c, pass) => {
    const msg = buildWelcomeMessage(c, pass);
    navigator.clipboard.writeText(msg);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2000);
  };

  const getCredsWhatsAppLink = (c, pass) => {
    const phone = c.phone?.replace(/[^0-9]/g, "");
    if (!phone) return "#";
    const msg = buildWelcomeMessage(c, pass);
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  };

  const getEmailLink = (c, pass) => {
    const portalUrl = getPortalUrl(c);
    const subject = encodeURIComponent("Your ImpactOS Account Credentials");
    const body = encodeURIComponent(buildWelcomeMessage(c, pass));
    return `mailto:${c.email}?subject=${subject}&body=${body}`;
  };

  const getWhatsAppLink = (c) => {
    const phone = (c.phone || "").replace(/[^0-9]/g, "");
    if (!phone) return "#";
    const message = `Hello ${c.name},\n\nThis is your Program Manager from ImpactOS. I am reaching out regarding the ${c.group_name || "Program"} cohort.`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  };

  return (
    <DashboardLayout role="program_manager" activeTab="communication">
      <div className="space-y-12 pb-20">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-10">
          <div>
            <div className="flex items-center gap-4 mb-4 text-left">
              <span className="text-[#FF6600] font-black text-[10px] uppercase tracking-[0.4em]">
                Operations Outreach
              </span>
              <div className="h-px w-10 bg-[#FF6600]/30" />
              <span className="badge badge-glow-blue uppercase text-[8px] font-black italic">
                PM Authority
              </span>
            </div>
            <h2 className="text-5xl font-black text-white tracking-tighter uppercase leading-none italic">
              Cohort Registry
            </h2>
            <p className="text-slate-500 font-bold mt-4 uppercase text-[10px] tracking-widest opacity-60">
              Restricted access to your assigned program participants
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 font-sans">
          <div className="xl:col-span-1 space-y-6">
            <div className="ios-card !p-8 border-white/5 space-y-8 shadow-2xl">
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-[#FF6600] uppercase tracking-widest pl-2 italic">
                  Registry View
                </h4>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setViewMode("participants")}
                    className={`w-full flex items-center justify-between px-5 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === "participants" ? "bg-[#FF6600] text-black shadow-lg shadow-[#FF6600]/20" : "bg-white/5 text-slate-400 border border-white/5"}`}
                  >
                    <span>Active Participants</span>
                    <Users className="w-4 h-4 opacity-50" />
                  </button>
                  <button
                    onClick={() => setViewMode("staff")}
                    className={`w-full flex items-center justify-between px-5 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === "staff" ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "bg-white/5 text-slate-400 border border-white/5"}`}
                  >
                    <span>Assigned Team Mates</span>
                    <Shield className="w-4 h-4 opacity-50" />
                  </button>
                  <button
                    onClick={() => {
                      setShowInbox(!showInbox);
                      if (!showInbox) fetchMessages();
                    }}
                    className={`w-full flex items-center justify-between px-5 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${showInbox ? "bg-[#FF6600] text-black shadow-lg shadow-[#FF6600]/20" : "bg-white/5 text-slate-400 border border-white/5"}`}
                  >
                    <span>Messages</span>
                    <Mail className="w-4 h-4 opacity-50" />
                  </button>
                </div>

                {viewMode === "participants" && (
                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <h4 className="text-[10px] font-black text-[#FF6600] uppercase tracking-widest pl-2 italic">
                      Delivery Mode
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setDeliveryMode("individuals")}
                        className={`px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${deliveryMode === "individuals" ? "bg-white/10 text-white border border-white/20" : "text-slate-500 hover:bg-white/5"}`}
                      >
                        Individuals
                      </button>
                      <button
                        onClick={() => setDeliveryMode("teams")}
                        className={`px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${deliveryMode === "teams" ? "bg-white/10 text-white border border-white/20" : "text-slate-500 hover:bg-white/5"}`}
                      >
                        Teams
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Search ${deliveryMode === "teams" ? "teams" : viewMode}...`}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-4 text-white outline-none focus:border-[#FF6600]/50 font-bold transition-all"
                />
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2 opacity-60">
                  Cohort Timelines
                </h4>
                <div className="space-y-1">
                  <button
                    onClick={() => setSelectedProgram("All Assignments")}
                    className={`w-full text-left px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedProgram === "All Assignments" ? "bg-[#FF6600] text-black shadow-lg" : "text-slate-400 hover:bg-white/5"}`}
                  >
                    All Timelines
                  </button>
                  {assignedPrograms.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProgram(p.id)}
                      className={`w-full text-left px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedProgram === p.id ? "bg-white/10 text-white border border-white/10" : "text-slate-400 hover:bg-white/5"}`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="xl:col-span-3 space-y-6">
            {/* Message Inbox */}
            {showInbox ? (
              <div className="ios-card bg-white/[0.01] border-white/5 p-8 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">
                    Messages
                  </h3>
                  <button
                    onClick={() => {
                      setShowCompose(true);
                      fetchMessages();
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#FF6600] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
                  >
                    <Send className="w-3.5 h-3.5" /> New Message
                  </button>
                </div>
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {messages.length === 0 ? (
                    <p className="text-slate-500 italic text-center py-16 text-[10px] uppercase tracking-widest">
                      No messages yet
                    </p>
                  ) : (
                    [...messages].reverse().map((msg) => {
                      const isSent =
                        msg.sender_id ===
                        (JSON.parse(localStorage.getItem("user") || "{}").cid ||
                          JSON.parse(localStorage.getItem("user") || "{}").id);
                      return (
                        <div
                          key={msg.id}
                          className="p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-[#FF6600]/20 transition-all"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span
                                  className={`text-[9px] font-black uppercase tracking-wider ${isSent ? "text-[#FF6600]" : "text-emerald-400"}`}
                                >
                                  {isSent ? "Sent" : "Received"}
                                </span>
                                {msg.target_type !== "individual" && (
                                  <span className="text-[8px] font-bold text-indigo-400 uppercase px-1.5 py-0.5 rounded bg-indigo-500/10">
                                    {msg.target_type === "program"
                                      ? "Program"
                                      : msg.target_type}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm font-black text-white">
                                {msg.subject}
                              </p>
                              <p className="text-xs text-slate-400 mt-1">
                                {msg.body}
                              </p>
                            </div>
                            <span className="text-[8px] text-slate-600 whitespace-nowrap ml-3">
                              {msg.created_at
                                ? new Date(msg.created_at).toLocaleDateString()
                                : ""}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : loading ? (
              <div className="p-20 text-center">
                <Loader2 className="w-12 h-12 text-[#FF6600] animate-spin mx-auto mb-6" />
                <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                  Filtering Assigned Registry...
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="ios-card bg-white/[0.01] border-white/5 py-40 flex flex-col items-center justify-center text-center">
                <Shield className="w-20 h-20 text-slate-800 mb-6 opacity-10" />
                <h4 className="text-2xl font-black text-white uppercase mb-2">
                  No Records Found
                </h4>
                <p className="text-slate-500 font-bold text-xs max-w-sm uppercase tracking-widest opacity-60">
                  You only have access to participants in your assigned cohorts.
                </p>
              </div>
            ) : (
              <div className="ios-card !p-0 overflow-hidden border-white/5 shadow-2xl bg-white/[0.01]">
                <table className="executive-table w-full">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/[0.02]">
                      <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-left">
                        {viewMode === "staff"
                          ? "Personnel Identity"
                          : deliveryMode === "teams"
                            ? "Mission Node"
                            : "Participant Identity"}
                      </th>
                      <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-left">
                        {viewMode === "staff"
                          ? "Assigned Role"
                          : deliveryMode === "teams"
                            ? "Assigned Lead"
                            : "Cohort Assignment"}
                      </th>
                      <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">
                        Outreach
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c, idx) => (
                      <tr
                        key={c.cid || c.id || idx}
                        className="group hover:bg-white/[0.01] transition-colors border-b border-white/[0.02]"
                      >
                        <td className="px-8 py-8">
                          <p className="font-black text-white uppercase tracking-tighter text-xl leading-none mb-2 italic">
                            {c.name}
                          </p>
                          {c.email && (
                            <p className="text-[10px] font-bold text-slate-500 font-mono lower">
                              {c.email}
                            </p>
                          )}
                        </td>
                        <td className="px-8 py-8">
                          <div className="flex items-center gap-2">
                            <Briefcase className="w-3.5 h-3.5 text-[#FF6600] opacity-50" />
                            <span className="text-[10px] font-black text-[#FF6600] uppercase tracking-widest bg-[#FF6600]/10 px-3 py-1 rounded-full border border-[#FF6600]/20 cursor-default">
                              {viewMode === "staff"
                                ? c.role || "Mission Staff"
                                : deliveryMode === "teams"
                                  ? c.handler_name || "Project Lead"
                                  : c.group_name || "Active Cohort"}
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-8 text-right">
                          <div className="flex items-center justify-end gap-4 opacity-0 group-hover:opacity-100 transition-all">
                            {viewMode === "participants" &&
                              deliveryMode === "individuals" &&
                              c.email && (
                                <button
                                  onClick={() => handleResetPassword(c)}
                                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/10 hover:bg-blue-500 hover:text-white rounded-xl text-blue-500 transition-all border border-transparent hover:border-blue-500/20"
                                  title="Reset Password & Show Credentials"
                                >
                                  <Key className="w-5 h-5" />
                                  <span className="text-[9px] font-black uppercase">
                                    Credentials
                                  </span>
                                </button>
                              )}
                            {c.email && (
                              <a
                                href={`mailto:${c.email}`}
                                className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all border border-transparent hover:border-white/10"
                                title="Send Email"
                              >
                                <Mail className="w-5 h-5" />
                                <span className="text-[9px] font-black uppercase">
                                  Email
                                </span>
                              </a>
                            )}
                            {c.phone && (
                              <a
                                href={getWhatsAppLink(c)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 hover:bg-emerald-500 hover:text-white rounded-xl text-emerald-500 transition-all border border-transparent hover:border-emerald-500/20"
                                title="Open WhatsApp Chat"
                              >
                                <MessageCircle className="w-5 h-5" />
                                <span className="text-[9px] font-black uppercase">
                                  WhatsApp
                                </span>
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* COMPOSE MODAL */}
      {showCompose && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowCompose(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-[#0d0d18] border border-white/10 p-8 space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-white uppercase tracking-tight">
                New Message
              </h3>
              <button onClick={() => setShowCompose(false)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="flex gap-2 p-1 rounded-lg bg-white/5 border border-white/10">
              {[
                { id: "individual", label: "Individual" },
                { id: "program", label: "To Program" },
              ].map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setComposeTarget(mode.id)}
                  className={`flex-1 py-2 rounded-md text-[9px] font-black uppercase tracking-wider transition-all ${composeTarget === mode.id ? "bg-[#FF6600] text-black" : "text-slate-400 hover:text-white"}`}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {composeTarget === "individual" ? (
              <select
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-[11px] font-bold outline-none"
              >
                <option value="">Select a person...</option>
                {contacts.map((c) => (
                  <option key={c.cid || c.id} value={c.cid || c.id}>
                    {c.name} ({c.role || "participant"})
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-[11px] font-bold outline-none"
              >
                <option value="">Select a program...</option>
                {assignedPrograms.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}

            <textarea
              placeholder="Type your message..."
              value={composeBody}
              onChange={(e) => setComposeBody(e.target.value)}
              rows={4}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-[11px] font-bold outline-none resize-none placeholder:text-slate-600"
            />

            <button
              onClick={async () => {
                if (!composeBody || !composeTo) return;
                const user = JSON.parse(localStorage.getItem("user") || "{}");
                const uid = user.cid || user.id;
                const payload =
                  composeTarget === "individual"
                    ? {
                        sender_id: uid,
                        recipient_id: composeTo,
                        target_type: "individual",
                        subject: composeBody.substring(0, 50),
                        body: composeBody,
                        priority: "normal",
                      }
                    : {
                        sender_id: uid,
                        target_type: "program",
                        target_id: composeTo,
                        subject: composeBody.substring(0, 50),
                        body: composeBody,
                        priority: "normal",
                      };
                await fetch("/api/internal-comms", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                });
                setShowCompose(false);
                setComposeTo("");
                setComposeBody("");
                fetchMessages();
              }}
              disabled={!composeBody || !composeTo}
              className="w-full py-3.5 bg-[#FF6600] text-black rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-30 hover:brightness-110 transition-all"
            >
              Send Message
            </button>
          </div>
        </div>
      )}

      {/* CREDENTIALS MODAL */}
      {showCredsModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <div className="ios-card bg-[#0d0d18] border-blue-500/30 w-full max-w-lg animate-in flex flex-col max-h-[90vh]">
            {/* Scrollable Content Area */}
            <div className="overflow-y-auto p-6 pb-2 space-y-6">
              {/* Header */}
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="p-4 bg-blue-500/10 rounded-2xl text-blue-500">
                  <Key className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">
                    {credsForm.name}
                  </h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                    Account Credentials
                  </p>
                </div>
              </div>

              {/* Credentials Card */}
              <div className="bg-[#0a0a14] border border-blue-500/20 rounded-2xl p-6 space-y-4 text-left">
                <div className="space-y-3">
                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                      Login URL
                    </label>
                    <div className="flex items-center gap-2 mt-1 p-3 bg-black/60 rounded-xl border border-white/5">
                      <Globe className="w-4 h-4 text-blue-500 shrink-0" />
                      <code className="text-xs font-mono text-blue-400 font-bold break-all">
                        {getPortalUrl(credsForm)}
                      </code>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                        Email
                      </label>
                      <div className="flex items-center gap-2 mt-1 p-3 bg-black/60 rounded-xl border border-white/5">
                        <Mail className="w-4 h-4 text-emerald-500 shrink-0" />
                        <code className="text-xs font-mono text-emerald-400 font-bold truncate">
                          {credsForm.email}
                        </code>
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                        Password
                      </label>
                      <div className="flex items-center gap-2 mt-1 p-3 bg-black/60 rounded-xl border border-amber-500/20">
                        <Shield className="w-4 h-4 text-amber-500 shrink-0" />
                        <code className="text-xs font-mono text-amber-400 font-bold">
                          {credsForm.password}
                        </code>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Welcome Message Preview */}
                <div className="pt-3 border-t border-white/5">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                    Welcome Message Preview
                  </label>
                  <div className="p-4 bg-black/60 rounded-xl border border-white/5 text-[11px] text-slate-400 font-mono leading-relaxed whitespace-pre-wrap">
                    {buildWelcomeMessage(credsForm, credsForm.password)}
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky Actions Footer */}
            <div className="p-6 pt-2 border-t border-white/5 shrink-0">
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() =>
                      copyWelcomeMessage(credsForm, credsForm.password)
                    }
                    className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white flex items-center justify-center gap-2 uppercase font-black text-[9px] tracking-widest transition-all"
                  >
                    {copiedMessage ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-500" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" /> Copy All
                      </>
                    )}
                  </button>
                  {credsForm.phone && (
                    <a
                      href={getCredsWhatsAppLink(credsForm, credsForm.password)}
                      target="_blank"
                      className="w-full py-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white flex items-center justify-center gap-2 uppercase font-black text-[9px] tracking-widest transition-all border border-emerald-500/20 hover:border-emerald-500"
                    >
                      <MessageCircle className="w-4 h-4" /> WhatsApp
                    </a>
                  )}
                  <a
                    href={getEmailLink(credsForm, credsForm.password)}
                    target="_blank"
                    className="w-full py-3 rounded-xl bg-blue-500/10 hover:bg-blue-600 text-blue-500 hover:text-white flex items-center justify-center gap-2 uppercase font-black text-[9px] tracking-widest transition-all border border-blue-500/20 hover:border-blue-600"
                  >
                    <Mail className="w-4 h-4" /> Email
                  </a>
                </div>
                <button
                  onClick={() => setShowCredsModal(false)}
                  className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white uppercase font-black text-[9px] tracking-widest transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

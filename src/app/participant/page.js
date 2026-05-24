"use client";

import React, { useState, useEffect } from "react";
import {
  Rocket,
  Layers,
  Target,
  CheckCircle2,
  Lock,
  ChevronRight,
  MessageSquare,
  ExternalLink,
  Activity,
  Calendar,
  Shield,
  Zap,
  Globe,
  Clock,
  BookOpen,
  Users,
  ChevronDown,
  FileText,
  AlertCircle,
  Bookmark,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { getPrefetchedData } from "@/utils/prefetch";
import { IMPACT_CACHE } from "@/utils/impactCache";

/**
 * PARTICIPANT DASHBOARD — Lightweight LMS Experience v2
 * Clean, week-focused learning dashboard for participants.
 */
export default function ParticipantV2Dashboard() {
  const router = useRouter();

  // State for data
  const [programs, setPrograms] = useState([]);
  const [selectedProgramId, setSelectedProgramId] = useState(null);
  const [program, setProgram] = useState(null);
  const [metrics, setMetrics] = useState({
    percentComplete: 0,
    currentWeek: 1,
  });
  const [deliverables, setDeliverables] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [docRequirements, setDocRequirements] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [team, setTeam] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [grades, setGrades] = useState({
    individualScore: 0,
    groupScore: 0,
    finalGrade: 0,
  });

  // State for feedback modal
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedback, setFeedback] = useState({
    learnings: "",
    challenges: "",
    suggestions: "",
  });

  // UI state
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [knowledgeNotes, setKnowledgeNotes] = useState([]);
  const [showMaterials, setShowMaterials] = useState(false);
  const [activeTab, setActiveTab] = useState("weeks");

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    // Fetch knowledge notes once program data is available
    if (program?.note_id) {
      fetchKnowledgeNotes();
    }
  }, [program?.note_id]);

  const fetchKnowledgeNotes = async () => {
    try {
      const res = await fetch("/api/knowledge");
      const data = await res.json();
      if (data.success) {
        const notes = data.conceptNotes || [];
        // Only show the knowledge base item explicitly linked to this program via note_id
        const filtered = notes.filter(
          (n) => String(n.id) === String(program.note_id),
        );
        setKnowledgeNotes(filtered);
      }
    } catch (e) {
      // Silently fail — knowledge is supplementary
    }
  };

  // Auto-select first program when programs load or change
  useEffect(() => {
    if (programs.length > 0) {
      const currentValid = programs.find((p) => p.id === selectedProgramId);
      if (currentValid) {
        applyProgramData(currentValid);
      } else {
        applyProgramData(programs[0]);
        setSelectedProgramId(programs[0].id);
      }
    }
  }, [programs]);

  const applyProgramData = (prog) => {
    if (!prog) return;
    setProgram(prog);
    setSessions(prog.sessions || []);
    setDeliverables(prog.deliverables || []);
    setSubmissions(prog.submissions || []);
    setFollowups(prog.followups || []);
    setMetrics(prog.metrics || { percentComplete: 0, currentWeek: 1 });
    setSelectedWeek(null);
  };

  const handleProgramChange = (programId) => {
    setSelectedProgramId(programId);
    const prog = programs.find((p) => p.id === programId);
    applyProgramData(prog);
  };

  const fetchDashboardData = async () => {
    try {
      const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
      setUser(storedUser);
      const email = storedUser.email;

      if (!email) {
        setIsLoading(false);
        return;
      }

      const url = `/api/participant/programs?email=${email}`;

      // 1. Check Prefetch Store (Zero Latency)
      const prefetched = getPrefetchedData(url);
      if (prefetched?.programs?.length > 0) {
        setPrograms(prefetched.programs);
        setIsLoading(false);
        return;
      }

      // 2. Check Cache (Fast Feedback)
      const cached = IMPACT_CACHE.get("participant_programs");
      if (cached?.programs?.length > 0) {
        setPrograms(cached.programs);
        setIsLoading(false);
      }

      // 3. Full-state sync from new multi-program API
      const res = await fetch(url);
      const data = await res.json();

      if (!data.success) throw new Error(data.error);

      setPrograms(data.programs || []);
      IMPACT_CACHE.set("participant_programs", data);

      setIsLoading(false);
    } catch (e) {
      console.error("Dashboard sync failure", e);
      setIsLoading(false);
    }
  };

  const handleSubmitLink = async (delId) => {
    const link = prompt("Enter submission URL:");
    if (!link) return;

    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          program_id: program?.id || user?.group_name,
          deliverable_id: delId,
          participant_id: user?.email || user?.cid,
          submission_link: link,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert("Submission submitted for evaluation.");
        fetchDashboardData();
      }
    } catch (e) {
      alert("Submission failed.");
    }
  };

  const handleSendFeedback = async () => {
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          program_id: program?.id || user?.group_name,
          participant_id: user?.email || user?.cid,
          ...feedback,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert("Feedback sent to PM.");
        setShowFeedbackModal(false);
        setFeedback({ learnings: "", challenges: "", suggestions: "" });
      }
    } catch (e) {
      alert("Feedback failed.");
    }
  };

  // ---- Helper: derive weeks from sessions/deliverables ----
  const buildWeeks = () => {
    const weekMap = new Map();
    const allSessions = sessions || [];
    const allDels = deliverables || [];

    // Collect unique week numbers from sessions
    allSessions.forEach((s) => {
      const wn = s.week_number || 1;
      if (!weekMap.has(wn)) {
        weekMap.set(wn, {
          number: wn,
          title: s.title || `Week ${wn}`,
          sessions: [],
          deliverables: [],
          locked: false,
          completed: false,
          current: false,
        });
      }
      weekMap.get(wn).sessions.push(s);
    });

    // If a week has sessions, use the first session's title as the week title
    weekMap.forEach((week) => {
      if (week.sessions.length > 0) {
        // Use the most descriptive title — prefer the session title
        week.title = week.sessions[0].title;
      }
    });

    // Add deliverables to weeks
    allDels.forEach((d) => {
      const wn = d.week_number || 1;
      if (!weekMap.has(wn)) {
        weekMap.set(wn, {
          number: wn,
          title: d.title || `Week ${wn}`,
          sessions: [],
          deliverables: [],
          locked: false,
          completed: false,
          current: false,
        });
      }
      if (!weekMap.get(wn).deliverables.find((dx) => dx.id === d.id)) {
        weekMap.get(wn).deliverables.push(d);
      }
    });

    const currentWeek = metrics.currentWeek || 1;
    const weeks = Array.from(weekMap.values()).sort(
      (a, b) => a.number - b.number,
    );

    weeks.forEach((w) => {
      if (w.number < currentWeek) w.completed = true;
      else if (w.number === currentWeek) w.current = true;
      else w.locked = true;

      // If all deliverables for this week are submitted/approved, mark completed
      if (w.deliverables.length > 0) {
        const allDone = w.deliverables.every((d) => {
          const sub = submissions.find((s) => s.deliverable_id === d.id);
          return (
            sub &&
            (sub.status === "approved" ||
              sub.status === "completed" ||
              sub.status === "reviewed")
          );
        });
        if (allDone) w.completed = true;
      }
    });

    return weeks;
  };

  const weeks = buildWeeks();

  // Get deliverables for a specific week
  const getWeekDeliverables = (weekNumber) => {
    return deliverables.filter((d) => d.week_number === weekNumber);
  };

  // Get status of a deliverable
  const getDeliverableStatus = (delId) => {
    const sub = submissions.find((s) => s.deliverable_id === delId);
    return sub ? sub.status : null;
  };

  if (isLoading)
    return (
      <div className="min-h-screen bg-[#080810] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#FF6600]/20 border-t-[#FF6600] rounded-full animate-spin" />
      </div>
    );

  const currentWeek = metrics.currentWeek || 1;

  return (
    <DashboardLayout role="participant" activeTab="v2">
      <div className="max-w-6xl mx-auto space-y-8 pb-16">
        {/* ─── MULTI-PROGRAM SELECTOR ─── */}
        {programs.length > 1 && (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {programs.map((prog) => {
              const isActive = prog.id === selectedProgramId;
              const progMetrics = prog.metrics || {};
              return (
                <button
                  key={prog.id}
                  onClick={() => handleProgramChange(prog.id)}
                  className={`flex-shrink-0 ios-card !p-4 border text-left transition-all ${
                    isActive
                      ? "bg-[#FF6600]/10 border-[#FF6600]/40"
                      : "bg-[#0F172A] border-white/5 hover:border-white/20 opacity-70 hover:opacity-100"
                  }`}
                >
                  <p className="text-xs font-black text-white uppercase tracking-tight truncate max-w-[180px]">
                    {prog.name}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[9px] font-semibold text-slate-400">
                      {progMetrics.percentComplete || 0}%
                    </span>
                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isActive ? "bg-[#FF6600]" : "bg-emerald-500/50"
                        }`}
                        style={{
                          width: `${progMetrics.percentComplete || 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ─── TOP HEADER: Program Name, Current Week, Progress ─── */}
        <div className="ios-card bg-[#0F172A] border-white/5 !p-6 lg:!p-8">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <Rocket className="w-4 h-4 text-[#FF6600]" />
                <span className="text-[10px] font-black text-[#FF6600] uppercase tracking-[0.3em]">
                  Learning Dashboard
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#FF6600]/10 text-[#FF6600] text-[9px] font-black uppercase tracking-widest">
                  Week {currentWeek}
                </span>
              </div>
              <h1 className="text-2xl lg:text-3xl font-black text-white tracking-tight truncate">
                {program?.name || "Program Dashboard"}
              </h1>
              {team && (
                <p className="text-xs text-slate-400 font-semibold mt-1 flex items-center gap-2">
                  <Users className="w-3.5 h-3.5" /> Team: {team.name}
                </p>
              )}
            </div>

            <div className="w-full lg:w-64 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Progress
                </span>
                <span className="text-lg font-black text-white">
                  {metrics.percentComplete}%
                </span>
              </div>
              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-[#FF6600] rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${metrics.percentComplete}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
              <p className="text-[9px] text-slate-500 font-semibold">
                {
                  sessions.filter(
                    (s) => s.status === "completed" || s.status === "current",
                  ).length
                }{" "}
                / {sessions.length} sessions completed
              </p>
            </div>
          </div>
        </div>

        {/* ─── TAB NAVIGATION ─── */}
        <div className="flex gap-1 bg-[#0F172A] rounded-2xl p-1.5 border border-white/5 w-fit">
          {[
            { id: "weeks", label: "Weeks", icon: Calendar },
            { id: "materials", label: "Materials", icon: BookOpen },
            { id: "messages", label: "Messages", icon: MessageSquare },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab.id
                  ? "bg-[#FF6600] text-white shadow-lg shadow-[#FF6600]/20"
                  : "text-slate-500 hover:text-white hover:bg-white/5"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ─── MATERIALS TAB ─── */}
        {activeTab === "materials" && (
          <div className="space-y-4">
            <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-3">
              <Bookmark className="w-4 h-4 text-[#FF6600]" /> Course Materials &
              Knowledge Bank
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {knowledgeNotes.length === 0 ? (
                <div className="ios-card bg-[#0F172A] border-white/5 !p-8 text-center col-span-full">
                  <BookOpen className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                  <p className="text-sm text-slate-500 font-semibold">
                    No materials have been assigned yet.
                  </p>
                </div>
              ) : (
                knowledgeNotes.map((note) => (
                  <div
                    key={note.id}
                    className="ios-card bg-[#0F172A] border-white/5 !p-5 hover:border-[#FF6600]/20 transition-all group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-sm font-black text-white uppercase tracking-tight">
                        {note.title}
                      </h3>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-600 group-hover:text-[#FF6600] transition-colors flex-shrink-0" />
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                      {note.content ||
                        note.description ||
                        "No description available."}
                    </p>
                    {note.url && (
                      <a
                        href={note.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 mt-3 text-[10px] font-black text-[#FF6600] uppercase tracking-widest hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" /> Open Resource
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="ios-card bg-[#0F172A] border-white/5 !p-5 mt-6">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                Configuration & KPIs
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-2">
                    Baseline KPIs
                  </p>
                  <div className="space-y-1.5">
                    {kpis.map((kpi) => (
                      <div
                        key={kpi.id}
                        className="flex justify-between items-center px-3 py-2 rounded-lg bg-white/5"
                      >
                        <span className="text-[10px] font-bold text-white">
                          {kpi.title}
                        </span>
                        <span className="text-[10px] font-black text-[#FF6600]">
                          {kpi.target_value}
                        </span>
                      </div>
                    ))}
                    {kpis.length === 0 && (
                      <p className="text-[10px] text-slate-600 italic px-3">
                        No KPIs configured.
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-2">
                    Required Documents
                  </p>
                  <div className="space-y-1.5">
                    {docRequirements.map((doc) => {
                      const sub = submissions.find(
                        (s) => s.requirement_id === doc.id,
                      );
                      return (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] font-bold text-white truncate">
                              {doc.title}
                            </span>
                            {sub && (
                              <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                            )}
                          </div>
                          <button
                            onClick={async () => {
                              const link = prompt(
                                `Enter link for ${doc.title}:`,
                              );
                              if (!link) return;
                              try {
                                const res = await fetch("/api/submissions", {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    program_id: program?.id || user?.group_name,
                                    participant_id: user?.email || user?.cid,
                                    requirement_id: doc.id,
                                    submission_type: "link",
                                    submission_link: link,
                                  }),
                                });
                                if ((await res.json()).success) {
                                  alert("Document submitted.");
                                  fetchDashboardData();
                                }
                              } catch (e) {
                                alert("Upload failed.");
                              }
                            }}
                            className="text-[8px] font-black uppercase tracking-widest text-slate-500 hover:text-[#FF6600] transition-colors flex-shrink-0"
                          >
                            {sub ? "Update" : "Upload"}
                          </button>
                        </div>
                      );
                    })}
                    {docRequirements.length === 0 && (
                      <p className="text-[10px] text-slate-600 italic px-3">
                        No documents required.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── MESSAGES TAB ─── */}
        {activeTab === "messages" && (
          <div className="space-y-6">
            {/* PM Followups */}
            <section>
              <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-3 mb-4">
                <Globe className="w-4 h-4 text-[#FF6600]" /> Messages from PM
              </h2>
              <div className="space-y-3">
                {followups.length === 0 ? (
                  <div className="ios-card bg-[#0F172A] border-white/5 !p-8 text-center">
                    <MessageSquare className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                    <p className="text-sm text-slate-500 font-semibold">
                      No messages from your PM yet.
                    </p>
                  </div>
                ) : (
                  followups.map((fol) => (
                    <div
                      key={fol.id}
                      className="ios-card bg-[#0F172A] border-white/5 !p-5 border-l-4 border-l-[#FF6600] hover:bg-white/[0.03] transition-all"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-[9px] font-black text-[#FF6600] uppercase tracking-widest">
                          Week {fol.week_number}
                        </span>
                        <div className="h-px flex-1 bg-white/5" />
                        <Clock className="w-3 h-3 text-slate-600" />
                      </div>
                      <p className="text-sm font-semibold text-slate-300 leading-relaxed">
                        &ldquo;{fol.comment}&rdquo;
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Send Signal to PM */}
            <section className="ios-card bg-[#0F172A] border-white/5 !p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-[#FF6600]/10 border border-[#FF6600]/20 flex items-center justify-center mx-auto mb-4">
                <Zap className="w-6 h-6 text-[#FF6600]" />
              </div>
              <h3 className="text-lg font-black text-white uppercase tracking-tight mb-2">
                Send Signal to PM
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto mb-5">
                Share your weekly learnings, challenges, or suggestions with
                your Program Manager.
              </p>
              <button
                onClick={() => setShowFeedbackModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#FF6600] text-white text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-lg shadow-[#FF6600]/20"
              >
                <Zap className="w-4 h-4" /> Send Pulse Signal
              </button>
            </section>
          </div>
        )}

        {/* ─── WEEKS TAB (Calendar + Deliverables) ─── */}
        {activeTab === "weeks" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* ─── LEFT: Week Calendar ─── */}
            <div className="lg:col-span-1 space-y-4">
              <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-3">
                <Calendar className="w-4 h-4 text-[#FF6600]" /> Program Timeline
              </h2>
              <div className="space-y-2">
                {weeks.map((week) => (
                  <button
                    key={week.number}
                    onClick={() =>
                      !week.locked &&
                      setSelectedWeek(
                        week.number === selectedWeek ? null : week.number,
                      )
                    }
                    disabled={week.locked}
                    className={`w-full ios-card !p-4 transition-all border text-left ${
                      selectedWeek === week.number
                        ? "bg-[#FF6600]/10 border-[#FF6600]/30"
                        : week.current
                          ? "bg-[#FF6600]/5 border-[#FF6600]/20 hover:border-[#FF6600]/30"
                          : week.locked
                            ? "bg-[#0a0a14] border-white/5 opacity-50 cursor-not-allowed"
                            : "bg-[#0F172A] border-white/5 hover:border-emerald-500/30"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Week badge */}
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 ${
                            week.locked
                              ? "bg-white/5 text-slate-700"
                              : week.current
                                ? "bg-[#FF6600]/15 text-[#FF6600]"
                                : "bg-emerald-500/10 text-emerald-400"
                          }`}
                        >
                          {week.locked ? (
                            <Lock className="w-3.5 h-3.5" />
                          ) : (
                            week.number
                          )}
                        </div>
                        <div className="min-w-0">
                          <p
                            className={`text-xs font-black uppercase truncate ${
                              week.locked
                                ? "text-slate-600"
                                : week.current
                                  ? "text-white"
                                  : "text-white"
                            }`}
                          >
                            {week.title}
                          </p>
                          <p className="text-[9px] text-slate-500 font-semibold truncate">
                            Week {week.number}
                            {week.sessions.length > 0 &&
                              ` · ${week.sessions.map((s) => s.type || "Session").join(", ")}`}
                            {week.deliverables.length > 0 &&
                              ` · ${week.deliverables.length} deliverable(s)`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Completion indicator */}
                        {week.completed && !week.current && !week.locked ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : week.current ? (
                          <div className="w-2 h-2 rounded-full bg-[#FF6600] animate-pulse" />
                        ) : week.locked ? null : null}
                        {!week.locked && (
                          <ChevronDown
                            className={`w-3.5 h-3.5 text-slate-600 transition-transform ${
                              selectedWeek === week.number ? "rotate-180" : ""
                            }`}
                          />
                        )}
                      </div>
                    </div>

                    {/* Expandable deliverables for this week */}
                    <AnimatePresence>
                      {selectedWeek === week.number && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="pt-4 mt-4 border-t border-white/5 space-y-2">
                            {/* Sessions for this week */}
                            {week.sessions.map((ses) => (
                              <div
                                key={ses.id}
                                className="flex items-start gap-2 py-1.5"
                              >
                                <div className="w-1.5 h-1.5 rounded-full bg-[#FF6600] mt-1.5 flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-[10px] font-bold text-white truncate">
                                    {ses.title}
                                  </p>
                                  <p className="text-[8px] text-slate-500 font-semibold uppercase">
                                    {ses.type || "Session"}
                                  </p>
                                </div>
                              </div>
                            ))}

                            {/* Deliverables for this week */}
                            {getWeekDeliverables(week.number).map((del) => {
                              const status = getDeliverableStatus(del.id);
                              return (
                                <div
                                  key={del.id}
                                  className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg bg-white/5"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-bold text-white truncate">
                                      {del.title}
                                    </p>
                                    <p
                                      className={`text-[8px] font-semibold uppercase ${
                                        !status
                                          ? "text-slate-600"
                                          : status === "approved" ||
                                              status === "completed"
                                            ? "text-emerald-500"
                                            : status === "submitted" ||
                                                status === "reviewed"
                                              ? "text-[#FF6600]"
                                              : "text-slate-600"
                                      }`}
                                    >
                                      {status || "Pending"}
                                    </p>
                                  </div>
                                  {status === "approved" ||
                                  status === "completed" ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                  ) : (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSubmitLink(del.id);
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-[#FF6600]/10 text-[#FF6600] text-[8px] font-black uppercase tracking-widest hover:bg-[#FF6600]/20 transition-all flex-shrink-0"
                                    >
                                      {status ? "Resubmit" : "Submit"}
                                    </button>
                                  )}
                                </div>
                              );
                            })}

                            {week.sessions.length === 0 &&
                              getWeekDeliverables(week.number).length === 0 && (
                                <p className="text-[10px] text-slate-600 italic py-2">
                                  No content for this week.
                                </p>
                              )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>
                ))}

                {weeks.length === 0 && (
                  <div className="ios-card bg-[#0F172A] border-white/5 !p-8 text-center">
                    <Calendar className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                    <p className="text-sm text-slate-500 font-semibold">
                      No weeks have been configured yet.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ─── RIGHT: Deliverables & Sessions Detail ─── */}
            <div className="lg:col-span-2 space-y-6">
              {/* Show selected week details or default view */}
              {selectedWeek ? (
                <div className="space-y-6">
                  <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-3">
                    <Target className="w-4 h-4 text-[#FF6600]" /> Week{" "}
                    {selectedWeek} — Deliverables
                  </h2>

                  {getWeekDeliverables(selectedWeek).length === 0 && (
                    <div className="ios-card bg-[#0F172A] border-white/5 !p-8 text-center">
                      <FileText className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                      <p className="text-sm text-slate-500 font-semibold">
                        No deliverables for this week.
                      </p>
                    </div>
                  )}

                  <div className="space-y-3">
                    {getWeekDeliverables(selectedWeek).map((del) => {
                      const status = getDeliverableStatus(del.id);
                      const isLocked = del.week_number > currentWeek;

                      return (
                        <div
                          key={del.id}
                          className={`ios-card bg-[#0F172A] border !p-5 flex items-center justify-between gap-4 transition-all ${
                            isLocked
                              ? "border-white/5 opacity-50"
                              : status === "approved" || status === "completed"
                                ? "border-emerald-500/20 bg-emerald-500/[0.02]"
                                : "border-white/5 hover:border-[#FF6600]/20"
                          }`}
                        >
                          <div className="flex items-center gap-4 min-w-0 flex-1">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-base flex-shrink-0 ${
                                status === "approved" || status === "completed"
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : "bg-white/5 text-slate-500"
                              }`}
                            >
                              {isLocked ? (
                                <Lock className="w-4 h-4" />
                              ) : (
                                del.week_number
                              )}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-sm font-black text-white uppercase tracking-tight truncate">
                                {del.title}
                              </h4>
                              <p
                                className={`text-[9px] font-semibold uppercase tracking-widest ${
                                  !status
                                    ? "text-slate-600"
                                    : status === "approved" ||
                                        status === "completed"
                                      ? "text-emerald-500"
                                      : status === "submitted" ||
                                          status === "reviewed"
                                        ? "text-[#FF6600]"
                                        : "text-slate-500"
                                }`}
                              >
                                {!status
                                  ? "Not submitted"
                                  : status === "approved"
                                    ? "Completed ✓"
                                    : status === "reviewed"
                                      ? "Under review"
                                      : status}
                              </p>
                            </div>
                          </div>

                          <div className="flex-shrink-0">
                            {status === "approved" || status === "completed" ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            ) : isLocked ? (
                              <Lock className="w-4 h-4 text-slate-700" />
                            ) : (
                              <button
                                onClick={() => handleSubmitLink(del.id)}
                                className="px-4 py-2 rounded-xl bg-[#FF6600] text-white text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-lg shadow-[#FF6600]/10"
                              >
                                {status ? "Update" : "Submit Link"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Sessions for selected week */}
                  {weeks.find((w) => w.number === selectedWeek)?.sessions
                    ?.length > 0 && (
                    <div>
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                        Sessions
                      </h3>
                      <div className="space-y-2">
                        {weeks
                          .find((w) => w.number === selectedWeek)
                          .sessions.map((ses) => (
                            <div
                              key={ses.id}
                              className="ios-card bg-[#0F172A] border-white/5 !p-4 flex items-center gap-4"
                            >
                              <div className="w-8 h-8 rounded-lg bg-[#FF6600]/10 flex items-center justify-center text-[#FF6600] flex-shrink-0">
                                <BookOpen className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-white">
                                  {ses.title}
                                </p>
                                <p className="text-[9px] text-slate-500 font-semibold uppercase">
                                  {ses.type || "Session"}
                                </p>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Default: Overview grid when no week is selected */
                <div className="space-y-6">
                  <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-3">
                    <Activity className="w-4 h-4 text-[#FF6600]" /> Overview
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Grade card */}
                    <div className="ios-card bg-[#0F172A] border-white/5 !p-5">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">
                          Grade
                        </p>
                        <Target className="w-4 h-4 text-emerald-500" />
                      </div>
                      <p className="text-2xl font-black text-white">
                        {grades.finalGrade}
                        <span className="text-sm text-slate-500">/100</span>
                      </p>
                      <div className="flex gap-4 mt-2 text-[8px] font-black uppercase tracking-widest text-slate-500 border-t border-white/5 pt-2">
                        <span>IND: {grades.individualScore}</span>
                        <span>GRP: {grades.groupScore}</span>
                      </div>
                    </div>

                    {/* Notifications card */}
                    <div className="ios-card bg-[#0F172A] border-white/5 !p-5">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          Alerts
                        </p>
                        <AlertCircle className="w-4 h-4 text-slate-500" />
                      </div>
                      <div className="space-y-2">
                        {notifications.slice(0, 3).map((notif) => (
                          <div
                            key={notif.id}
                            className={`p-2 rounded-lg ${notif.read ? "bg-transparent" : "bg-[#FF6600]/5 border border-[#FF6600]/10"}`}
                          >
                            <p className="text-[10px] font-bold text-white">
                              {notif.title}
                            </p>
                            <p className="text-[9px] text-slate-500">
                              {notif.message}
                            </p>
                          </div>
                        ))}
                        {notifications.length === 0 && (
                          <p className="text-[10px] text-slate-600 italic">
                            No new alerts.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Sessions Timeline */}
                  <div className="ios-card bg-[#0F172A] border-white/5 !p-5">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                      Session Timeline
                    </h3>
                    <div className="space-y-3">
                      {sessions.slice(0, 6).map((ses) => (
                        <div key={ses.id} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div
                              className={`w-2.5 h-2.5 rounded-full ${
                                ses.status === "completed"
                                  ? "bg-emerald-500"
                                  : "bg-[#FF6600]"
                              }`}
                            />
                            <div className="w-px flex-1 bg-white/5" />
                          </div>
                          <div className="pb-3">
                            <p className="text-[9px] font-black text-[#FF6600] uppercase tracking-widest">
                              Week {ses.week_number}
                            </p>
                            <p className="text-xs font-bold text-white">
                              {ses.title}
                            </p>
                            <p className="text-[9px] text-slate-500">
                              {ses.type || "Session"}
                            </p>
                          </div>
                        </div>
                      ))}
                      {sessions.length === 0 && (
                        <p className="text-[10px] text-slate-600 italic text-center py-4">
                          No sessions scheduled.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Quick stats: deliverables summary */}
                  <div className="ios-card bg-[#0F172A] border-white/5 !p-5">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                      Deliverables Summary
                    </h3>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="p-3 rounded-xl bg-white/5">
                        <p className="text-lg font-black text-white">
                          {deliverables.length}
                        </p>
                        <p className="text-[8px] text-slate-500 font-semibold uppercase tracking-widest">
                          Total
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-emerald-500/5">
                        <p className="text-lg font-black text-emerald-400">
                          {
                            deliverables.filter((d) => {
                              const s = submissions.find(
                                (sx) => sx.deliverable_id === d.id,
                              );
                              return (
                                s &&
                                (s.status === "approved" ||
                                  s.status === "completed")
                              );
                            }).length
                          }
                        </p>
                        <p className="text-[8px] text-emerald-400/70 font-semibold uppercase tracking-widest">
                          Done
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-[#FF6600]/5">
                        <p className="text-lg font-black text-[#FF6600]">
                          {
                            deliverables.filter(
                              (d) =>
                                d.week_number <= currentWeek &&
                                !submissions.find(
                                  (s) => s.deliverable_id === d.id,
                                ),
                            ).length
                          }
                        </p>
                        <p className="text-[8px] text-[#FF6600]/70 font-semibold uppercase tracking-widest">
                          Pending
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── FEEDBACK MODAL (Preserved from original) ─── */}
      <AnimatePresence>
        {showFeedbackModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="ios-card w-full max-w-lg !p-12 space-y-8 bg-[#0F172A] border-white/10"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter">
                    Pulse Signal
                  </h3>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">
                    Send feedback to your PM.
                  </p>
                </div>
                <button
                  onClick={() => setShowFeedbackModal(false)}
                  className="text-slate-600 hover:text-white"
                >
                  <Zap className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-[#FF6600] uppercase tracking-widest pl-2">
                    Key Learnings
                  </label>
                  <textarea
                    value={feedback.learnings}
                    onChange={(e) =>
                      setFeedback({ ...feedback, learnings: e.target.value })
                    }
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-xs font-bold text-white outline-none focus:border-[#FF6600]/30 resize-none"
                    placeholder="What did you learn this week?"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-rose-400 uppercase tracking-widest pl-2">
                    Challenges
                  </label>
                  <textarea
                    value={feedback.challenges}
                    onChange={(e) =>
                      setFeedback({ ...feedback, challenges: e.target.value })
                    }
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-xs font-bold text-white outline-none focus:border-[#FF6600]/30 resize-none"
                    placeholder="Any blockers or difficulties?"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-emerald-400 uppercase tracking-widest pl-2">
                    Suggestions
                  </label>
                  <textarea
                    value={feedback.suggestions}
                    onChange={(e) =>
                      setFeedback({ ...feedback, suggestions: e.target.value })
                    }
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-xs font-bold text-white outline-none focus:border-[#FF6600]/30 resize-none"
                    placeholder="Ideas for improvement?"
                  />
                </div>
              </div>

              <button
                onClick={handleSendFeedback}
                className="w-full py-4 rounded-xl bg-[#FF6600] text-white text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-lg shadow-[#FF6600]/20"
              >
                Send Signal
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

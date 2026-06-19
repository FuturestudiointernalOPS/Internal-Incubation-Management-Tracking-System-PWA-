"use client";

import React, { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  Zap,
  ArrowLeft,
  Shield,
  User,
  Users,
  BookOpen,
  Plus,
  X,
  Loader2,
  Target,
  Calendar,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  Info,
  FileText,
  Upload,
  Trash2,
  File,
} from "lucide-react";
import { uploadFile } from "@/lib/storage";
import { useRouter } from "next/navigation";

/**
 * IMPACTOS MISSION DEPLOYMENT — STRATEGIC CONFIGURATION
 * Handles program initialization, personnel assignment, and resource linking.
 * Integrated with v2_knowledge_bank and Personnel Registry.
 */

export default function NewProgram() {
  const router = useRouter();
  const [isDeploying, setIsDeploying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [notification, setNotification] = useState(null);

  // DATA REPOSITORY
  const [knowledgeNodes, setKnowledgeNodes] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(true);

  // FORM STATE
  const [program, setProgram] = useState({
    start_date: "",
    end_date: "",
    duration_weeks: 4,
    materials: [],
    assigned_segments: [],
  });

  // Date validation
  const [dateError, setDateError] = useState("");

  const validateDates = (start, end) => {
    if (!start || !end) {
      setDateError("Start Date and End Date are required.");
      return false;
    }
    if (new Date(end) < new Date(start)) {
      setDateError("End Date cannot be earlier than Start Date.");
      return false;
    }
    setDateError("");
    return true;
  };

  // INLINE CREATION STATES
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroup, setNewGroup] = useState({
    name: "",
    description: "",
    type: "individual",
  });
  const [createdGroup, setCreatedGroup] = useState(null);

  const [isCreatingKB, setIsCreatingKB] = useState(false);
  const [newKB, setNewKB] = useState({ title: "", description: "", files: [] });
  const [createdKB, setCreatedKB] = useState(null);
  const [kpisList, setKpisList] = useState([]);
  const [kpiInput, setKpiInput] = useState({ title: "", target_value: 80 });

  const [segments, setSegments] = useState([]);

  const [selectedAssistants, setSelectedAssistants] = useState([]);

  const toggleAssistant = (cid) => {
    setSelectedAssistants((prev) => {
      const next = prev.includes(cid)
        ? prev.filter((id) => id !== cid)
        : [...prev, cid];
      setProgram((p) => ({
        ...p,
        assigned_assistant_id: JSON.stringify(next),
      }));
      return next;
    });
  };

  const notify = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  useEffect(() => {
    async function loadAssets() {
      setLoadingAssets(true);
      try {
        const [knowRes, staffRes, segRes] = await Promise.all([
          fetch("/api/knowledge"),
          fetch("/api/contacts"),
          fetch("/api/families"),
        ]);

        const knowData = await knowRes.json();
        const staffData = await staffRes.json();
        const segData = await segRes.json();

        if (knowData.success) setKnowledgeNodes(knowData.conceptNotes || []);
        if (segData.success) setSegments(segData.families || []);
        // Filter: Only Future Studio Staff (role='staff' or 'admin')
        if (staffData.success) {
          const staffOnly = (staffData.contacts || []).filter(
            (c) =>
              c.role === "staff" ||
              c.role === "admin" ||
              c.group_name?.toUpperCase() === "FUTURE STUDIO",
          );
          setStaffList(staffOnly);
        }
      } catch (e) {
        console.error("Asset Load Failure:", e);
        notify(
          "error",
          "Failed to synchronize personnel and knowledge assets.",
        );
      } finally {
        setLoadingAssets(false);
      }
    }
    loadAssets();
  }, []);

  const handleFileUpload = async (e, type = "program") => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const uploadedUrls = [];
      for (const file of files) {
        const path = `concept-notes/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
        const res = await uploadFile("knowledge", path, file);
        if (res.success) {
          uploadedUrls.push({
            name: file.name,
            url: res.url,
            type: file.type,
          });
        } else {
          throw new Error(`Upload failed for ${file.name}: ${res.error}`);
        }
      }

      if (type === "kb") {
        setNewKB((prev) => ({
          ...prev,
          files: [...prev.files, ...uploadedUrls],
        }));
      } else {
        setProgram((prev) => ({
          ...prev,
          materials: [...prev.materials, ...uploadedUrls],
        }));
      }
      notify("success", "Attached");
    } catch (e) {
      notify("error", e.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateGroupInline = async () => {
    if (!newGroup.name) return notify("error", "Group name is required.");
    setIsDeploying(true);
    try {
      const res = await fetch("/api/families", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newGroup),
      });
      const data = await res.json();
      if (data.success) {
        setCreatedGroup(data.group);
        setProgram((p) => ({ ...p, assigned_segments: [data.group.id] }));
        setSegments((prev) => [...prev, data.group]);
        setIsCreatingGroup(false);
        notify("success", "Created");
      }
    } catch (e) {
      notify("error", e.message);
    } finally {
      setIsDeploying(false);
    }
  };

  const handleCreateKBInline = async () => {
    if (!newKB.title)
      return notify("error", "Knowledge Base title is required.");
    setIsDeploying(true);
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newKB),
      });
      const data = await res.json();
      if (data.success) {
        setCreatedKB({ id: data.id, ...newKB });
        setProgram((p) => ({ ...p, note_id: data.id }));
        setKnowledgeNodes((prev) => [
          ...prev,
          { id: data.id, title: newKB.title },
        ]);
        setIsCreatingKB(false);
        notify("success", "Created");
      }
    } catch (e) {
      notify("error", e.message);
    } finally {
      setIsDeploying(false);
    }
  };

  const removeMaterial = (index) => {
    setProgram((prev) => ({
      ...prev,
      materials: prev.materials.filter((_, i) => i !== index),
    }));
  };

  const handleDeploy = async (e) => {
    e.preventDefault();
    if (!program.name || !program.assigned_pm_id) {
      notify(
        "error",
        "Critical Parameters Missing: Mission Name and PM are required.",
      );
      return;
    }

    // Calculate duration_weeks from dates for backward compatibility
    if (program.start_date && program.end_date) {
      if (!validateDates(program.start_date, program.end_date)) {
        return;
      }
      const start = new Date(program.start_date);
      const end = new Date(program.end_date);
      const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      program.duration_weeks = Math.max(1, Math.ceil(diffDays / 7));
    }

    setIsDeploying(true);
    try {
      // Create contact group first if a group name was provided
      let groupId = program.assigned_segments?.[0];
      if (!groupId && newGroup.name?.trim()) {
        const groupRes = await fetch("/api/families", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newGroup.name.trim(),
            type: newGroup.type || "individual",
            description: newGroup.description || null,
            program_id: null,
          }),
        });
        const groupData = await groupRes.json();
        if (groupData.success) {
          groupId = groupData.group?.id || groupData.id;
          program.assigned_segments = [groupId];
        }
      }

      const res = await fetch("/api/pm/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...program, kpis: kpisList }),
      });
      const data = await res.json();

      if (data.success) {
        notify("success", "Created");
        setTimeout(() => router.push("/admin/programs"), 1500);
      } else {
        throw new Error(data.error || "Failed to save program");
      }
    } catch (e) {
      notify("error", e.message);
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <DashboardLayout role="super_admin" activeTab="programs">
      {/* NOTIFICATION TOAST */}
      {notification && (
        <div className="fixed top-10 right-10 z-[1000] animate-in slide-in-from-right-10">
          <div
            className={`flex items-center gap-4 p-5 rounded-2xl border shadow-2xl backdrop-blur-xl ${notification.type === "success" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-rose-500/10 border-rose-500/30 text-rose-400"}`}
          >
            {notification.type === "success" ? (
              <CheckCircle2 className="w-6 h-6" />
            ) : (
              <AlertCircle className="w-6 h-6" />
            )}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">
                {notification.type.toUpperCase()}
              </p>
              <p className="text-xs font-bold text-white/90">
                {notification.message}
              </p>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="ml-4 opacity-40 hover:opacity-100 transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-12 pb-20 animate-in text-left">
        {/* HEADER */}
        <header className="space-y-4 border-b border-[var(--border-primary)] pb-10">
          <button
            onClick={() => router.push("/admin/programs")}
            className="group flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--brand-orange)] transition-all font-bold text-[9px] uppercase tracking-widest"
          >
            <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />{" "}
            Program List
          </button>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-bold text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                Administration
              </span>
            </div>
            <h1 className="text-6xl font-black tracking-tighter text-[var(--text-primary)]">
              NEW PROGRAM
            </h1>
          </div>
        </header>

        <form onSubmit={handleDeploy} className="space-y-10">
          {/* SECTION: BASIC IDENTITY */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-2">
                Program Identity
              </label>
              <input
                required
                value={program.name}
                onChange={(e) =>
                  setProgram({ ...program, name: e.target.value })
                }
                placeholder="Ex: Entrepreneurship Bootcamp 2024"
                className="w-full bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 text-lg font-bold text-white outline-none focus:border-[var(--brand-orange)] transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-2">
                Start Date
              </label>
              <input
                required
                type="date"
                value={program.start_date}
                onChange={(e) => {
                  const d = e.target.value;
                  setProgram({ ...program, start_date: d });
                  validateDates(d, program.end_date);
                }}
                className="w-full bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 text-lg font-bold text-white outline-none focus:border-[var(--brand-orange)] transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-2">
                End Date
              </label>
              <input
                required
                type="date"
                value={program.end_date}
                onChange={(e) => {
                  const d = e.target.value;
                  setProgram({ ...program, end_date: d });
                  validateDates(program.start_date, d);
                }}
                className={`w-full bg-secondary border rounded-2xl p-6 text-lg font-bold text-white outline-none focus:border-[var(--brand-orange)] transition-all ${dateError ? "border-rose-500" : "border-[var(--border-primary)]"}`}
              />
              {dateError && (
                <p className="text-[9px] font-bold text-rose-400 uppercase tracking-widest mt-1 ml-2">
                  {dateError}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-2">
              Concept Note
            </label>

            {/* Input type selector */}
            <div className="flex gap-2 bg-primary rounded-xl p-1.5 border border-[var(--border-primary)] w-fit">
              {[
                { id: "text", label: "Rich Text", icon: FileText },
                { id: "link", label: "External Link", icon: Plus },
                { id: "upload", label: "Upload Document", icon: Upload },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() =>
                    setProgram({ ...program, conceptNoteType: opt.id })
                  }
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                    (program.conceptNoteType || "text") === opt.id
                      ? "bg-[var(--brand-orange)] text-black"
                      : "text-slate-500 hover:text-white"
                  }`}
                >
                  <opt.icon className="w-3.5 h-3.5" />
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Rich Text / Description Input */}
            {(program.conceptNoteType || "text") === "text" && (
              <textarea
                rows={4}
                value={program.description}
                onChange={(e) =>
                  setProgram({ ...program, description: e.target.value })
                }
                placeholder="Outline the program objectives and goals..."
                className="w-full bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 font-medium text-white outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
              />
            )}

            {/* External Link Input */}
            {program.conceptNoteType === "link" && (
              <input
                type="url"
                value={program.conceptNoteLink || ""}
                onChange={(e) =>
                  setProgram({ ...program, conceptNoteLink: e.target.value })
                }
                placeholder="https://docs.google.com/..."
                className="w-full bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 text-lg font-bold text-white outline-none focus:border-[var(--brand-orange)] transition-all"
              />
            )}

            {/* File Upload Input */}
            {program.conceptNoteType === "upload" && (
              <div className="relative group">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setProgram({
                        ...program,
                        conceptNoteFile: file.name,
                        conceptNoteFileSize: file.size,
                      });
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                />
                <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-[var(--border-primary)] rounded-2xl group-hover:border-[var(--brand-orange)] transition-all bg-primary/50">
                  <Upload className="w-8 h-8 text-slate-500 group-hover:text-[var(--brand-orange)] mb-3 transition-all" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/60 group-hover:text-white transition-all">
                    {program.conceptNoteFile ||
                      "Click to upload PDF, DOC, or DOCX"}
                  </p>
                  {program.conceptNoteFile && (
                    <p className="text-[8px] text-emerald-400 mt-2 font-semibold">
                      {program.conceptNoteFile} selected
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* SECTION: KNOWLEDGE BANK INTEGRATION */}
            <div className="card space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-5">
                <BookOpen className="w-16 h-16" />
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500">
                  <BookOpen className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold uppercase tracking-tight">
                  Select from Knowledge Base
                </h3>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">
                      Knowledge Node Link
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCreatingKB(!isCreatingKB)}
                      className="text-[8px] font-bold text-[var(--brand-orange)] uppercase tracking-widest hover:underline"
                    >
                      {isCreatingKB ? "Cancel" : "+ Create New KB"}
                    </button>
                  </div>

                  {!isCreatingKB ? (
                    <select
                      value={program.note_id}
                      onChange={(e) =>
                        setProgram({ ...program, note_id: e.target.value })
                      }
                      className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold text-white outline-none focus:border-[var(--brand-orange)] appearance-none cursor-pointer"
                    >
                      <option value="">Link Knowledge Node...</option>
                      {knowledgeNodes.map((node) => (
                        <option key={node.id} value={node.id}>
                          {node.title.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="space-y-4 p-4 bg-primary border border-[var(--brand-orange)]/20 rounded-xl animate-in fade-in zoom-in-95">
                      <input
                        value={newKB.title}
                        onChange={(e) =>
                          setNewKB({ ...newKB, title: e.target.value })
                        }
                        placeholder="Knowledge Base Name..."
                        className="w-full bg-transparent border-b border-[var(--border-primary)] py-2 text-xs font-bold text-white outline-none focus:border-[var(--brand-orange)]"
                      />
                      <div className="relative group h-20">
                        <input
                          type="file"
                          multiple
                          accept=".pdf"
                          onChange={(e) => handleFileUpload(e, "kb")}
                          className="absolute inset-0 opacity-0 cursor-pointer z-10"
                        />
                        <div className="flex flex-col items-center justify-center h-full border border-dashed border-[var(--border-primary)] rounded-lg group-hover:border-[var(--brand-orange)]">
                          <p className="text-[8px] font-black uppercase text-white/40">
                            Upload Documents for KB
                          </p>
                        </div>
                      </div>
                      {newKB.files.length > 0 && (
                        <div className="text-[8px] font-bold text-emerald-400 uppercase italic">
                          {newKB.files.length} documents attached.
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={handleCreateKBInline}
                        className="w-full py-2 bg-[var(--brand-orange)]/10 text-[var(--brand-orange)] text-[9px] font-black uppercase rounded-lg border border-[var(--brand-orange)]/20"
                      >
                        Initialize Knowledge Base
                      </button>
                    </div>
                  )}
                </div>

                <div className="relative group">
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    disabled={isUploading}
                  />
                  <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-[var(--border-primary)] rounded-xl group-hover:border-[var(--brand-orange)] transition-all bg-primary/50">
                    {isUploading ? (
                      <Loader2 className="w-6 h-6 text-[var(--brand-orange)] animate-spin mb-2" />
                    ) : (
                      <Upload className="w-6 h-6 text-[var(--text-secondary)] group-hover:text-[var(--brand-orange)] mb-2 transition-all" />
                    )}
                    <p className="text-[9px] font-black uppercase tracking-widest text-white/60 group-hover:text-white transition-all">
                      {isUploading
                        ? "Uploading Assets..."
                        : "Attach Program Materials (PDF)"}
                    </p>
                  </div>
                </div>

                {program.materials.length > 0 && (
                  <div className="space-y-2">
                    {program.materials.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                          <p className="text-[10px] font-bold text-emerald-100 truncate uppercase">
                            {file.name}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeMaterial(idx)}
                          className="p-1 hover:bg-rose-500/20 rounded text-rose-400 transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* SECTION: CONTACT GROUP INTEGRATION */}
            <div className="card space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-5">
                <Users className="w-16 h-16" />
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold uppercase tracking-tight">
                  Contact Group Assignment
                </h3>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">
                    Group Target
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingGroup(!isCreatingGroup);
                      if (!isCreatingGroup) {
                        setNewGroup((prev) => ({
                          ...prev,
                          name: program.name || prev.name,
                        }));
                      }
                    }}
                    className="text-[8px] font-bold text-blue-400 uppercase tracking-widest hover:underline"
                  >
                    {isCreatingGroup ? "Cancel" : "+ Create New Group"}
                  </button>
                </div>

                {!isCreatingGroup ? (
                  <select
                    value={program.assigned_segments?.[0] || ""}
                    onChange={(e) =>
                      setProgram({
                        ...program,
                        assigned_segments: [e.target.value],
                      })
                    }
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold text-white outline-none focus:border-[var(--brand-orange)] cursor-pointer"
                  >
                    <option value="">Select Existing Group...</option>
                    {segments.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name.toUpperCase()}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-4 p-4 bg-primary border border-blue-500/20 rounded-xl animate-in fade-in zoom-in-95">
                    <input
                      value={newGroup.name}
                      onChange={(e) =>
                        setNewGroup({ ...newGroup, name: e.target.value })
                      }
                      placeholder="Group Name (e.g. Cohort A)..."
                      className="w-full bg-transparent border-b border-[var(--border-primary)] py-2 text-xs font-bold text-white outline-none focus:border-blue-400"
                    />
                    <textarea
                      value={newGroup.description}
                      onChange={(e) =>
                        setNewGroup({
                          ...newGroup,
                          description: e.target.value,
                        })
                      }
                      placeholder="Group Description (optional)..."
                      rows={2}
                      className="w-full bg-transparent border border-[var(--border-primary)] p-2 rounded text-[10px] font-medium text-white outline-none focus:border-blue-400 resize-none"
                    />
                    <button
                      type="button"
                      onClick={handleCreateGroupInline}
                      className="w-full py-2 bg-blue-500/10 text-blue-400 text-[9px] font-black uppercase rounded-lg border border-blue-500/20"
                    >
                      Generate Group & URL
                    </button>
                  </div>
                )}

                {createdGroup && (
                  <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-2">
                    <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">
                      Public Registration URL:
                    </p>
                    <div className="flex items-center justify-between gap-3 bg-black/40 p-2 rounded border border-white/5 overflow-hidden">
                      <span className="text-[8px] font-mono text-white/60 truncate">
                        {window.location.origin}/register-participant?group_id=
                        {createdGroup.registration_id}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(
                            `${window.location.origin}/register-participant?group_id=${createdGroup.registration_id}`,
                          );
                          notify("success", "Copied");
                        }}
                        className="p-1 bg-white/5 rounded hover:bg-white/10"
                      >
                        <Plus className="w-3 h-3 text-emerald-400 rotate-45" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* SECTION: COMMAND PERSONNEL */}
            <div className="card space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-5">
                <Shield className="w-16 h-16" />
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                  <Shield className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold uppercase tracking-tight">
                  Assigned Managers
                </h3>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">
                    PROGRAM MANAGER
                  </label>
                  <select
                    required
                    value={program.assigned_pm_id}
                    onChange={(e) =>
                      setProgram({ ...program, assigned_pm_id: e.target.value })
                    }
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold text-white outline-none focus:border-[var(--brand-orange)] cursor-pointer"
                  >
                    <option value="">Select Manager...</option>
                    {staffList.map((staff) => (
                      <option key={staff.cid} value={staff.cid}>
                        {staff.name.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">
                    ASSIGNED TEAM (Collaborators)
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selectedAssistants.map((cid) => {
                      const staff = staffList.find((s) => s.cid === cid);
                      return (
                        <div
                          key={cid}
                          className="flex items-center gap-2 px-3 py-1.5 bg-[var(--brand-orange)]/10 border border-[var(--brand-orange)]/20 rounded-lg text-[10px] font-bold text-[var(--brand-orange)]"
                        >
                          {staff?.name.toUpperCase()}
                          <button
                            type="button"
                            onClick={() => toggleAssistant(cid)}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) toggleAssistant(e.target.value);
                    }}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold text-white outline-none focus:border-[var(--brand-orange)] cursor-pointer"
                  >
                    <option value="">Select Support...</option>
                    {staffList
                      .filter((s) => !selectedAssistants.includes(s.cid))
                      .map((staff) => (
                        <option key={staff.cid} value={staff.cid}>
                          {staff.name.toUpperCase()}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* STRATEGIC KPIs CONFIGURATION */}
          <div className="card space-y-6 relative overflow-hidden">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-[var(--brand-orange)]/10 flex items-center justify-center text-[var(--brand-orange)]">
                  <Target className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h3 className="text-xl font-bold text-white uppercase tracking-tight italic">
                    Strategic KPIs Configuration
                  </h3>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                    Define KPI targets for this program
                  </p>
                  <p className="text-[11px] text-slate-400 mt-3 max-w-2xl leading-relaxed">
                    <strong className="text-white">What is a Target?</strong> A
                    target is the percentage completion goal (e.g., 80%) you aim
                    to achieve for a metric. Each KPI's progress is averaged
                    together to calculate the program's overall total
                    percentage.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-1 gap-6 items-end">
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">
                  KPI Title
                </label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="e.g. Weekly Attendance Rate, Assignment Submission..."
                    value={kpiInput.title}
                    onChange={(e) =>
                      setKpiInput({ ...kpiInput, title: e.target.value })
                    }
                    className="flex-1 bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold text-white outline-none focus:border-[var(--brand-orange)]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!kpiInput.title.trim()) return;
                      setKpisList([
                        ...kpisList,
                        {
                          title: kpiInput.title,
                        },
                      ]);
                      setKpiInput({ title: "" });
                    }}
                    className="px-6 bg-[var(--brand-orange)] text-black font-bold uppercase text-[10px] tracking-widest rounded-xl hover:bg-white transition-all flex items-center justify-center shrink-0"
                  >
                    <Plus className="w-4 h-4" /> Add
                  </button>
                </div>
              </div>
            </div>

            {kpisList.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-[var(--border-primary)]">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest italic text-left">
                  Defined KPIs ({kpisList.length})
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {kpisList.map((kpi, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-4 bg-white/[0.02] border border-[var(--border-primary)] rounded-xl group hover:border-[var(--brand-orange)]/30 transition-all text-left"
                    >
                      <div>
                        <p className="text-xs font-bold text-white uppercase tracking-tighter">
                          {kpi.title}
                        </p>
                        <p className="text-[9px] font-bold text-[var(--brand-orange)] uppercase tracking-widest mt-1">
                          Target: {kpi.target_value}%
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setKpisList(kpisList.filter((_, i) => i !== idx))
                        }
                        className="text-slate-500 hover:text-rose-500 transition-colors p-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isDeploying || loadingAssets}
            className="btn btn-primary w-full py-6 text-sm font-black uppercase tracking-[0.3em] shadow-2xl shadow-orange-500/20"
          >
            {isDeploying ? (
              <div className="flex items-center justify-center gap-4">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Saving Program...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3">
                <Zap className="w-5 h-5" />
                <span>Save Program</span>
              </div>
            )}
          </button>
        </form>
      </div>
    </DashboardLayout>
  );
}

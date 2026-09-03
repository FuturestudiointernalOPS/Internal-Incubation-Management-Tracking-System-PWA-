"use client";

import React, { useState, useEffect } from "react";
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
import { useI18n } from "@/lib/i18n";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";

/**
 * IMPACTOS MISSION DEPLOYMENT — STRATEGIC CONFIGURATION
 * Handles program initialization, personnel assignment, and resource linking.
 * Integrated with v2_knowledge_bank and Personnel Registry.
 */

export default function NewProgram() {
  const router = useRouter();
  const { t } = useI18n();
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
    name: "",
    description: "",
    concept_note: "",
    vision: "",
    objectives: "",
    program_type: "incubation",
    visibility: "private",
    language: "en",
    assigned_pm_id: "",
    expected_outcomes: "",
    success_metrics: "",
  });

  // Date validation
  const [dateError, setDateError] = useState("");

  // Today's date (YYYY-MM-DD) to prevent picking a past start date
  const todayStr = (() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
  })();

  const validateDates = (start, end) => {
    if (!start || !end) {
      setDateError(t("adminMisc.newProgram.dateErrorRequired"));
      return false;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(start) < today) {
      setDateError(t("adminMisc.newProgram.dateErrorPast"));
      return false;
    }
    if (new Date(end) < new Date(start)) {
      setDateError(t("adminMisc.newProgram.dateErrorOrder"));
      return false;
    }
    if (new Date(end).getTime() === new Date(start).getTime()) {
      setDateError(t("adminMisc.newProgram.dateErrorSameDay"));
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
  const [kpiInput, setKpiInput] = useState({ title: "", target_value: 100 });
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [applyingTemplate, setApplyingTemplate] = useState(false);

  const [segments, setSegments] = useState([]);
  const [customProgramTypes, setCustomProgramTypes] = useState([]);
  const [newTypeInput, setNewTypeInput] = useState("");
  const [showNewTypeInput, setShowNewTypeInput] = useState(false);

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
    async function loadAssets(bypassCache = false) {
      const urls = [
        "/api/knowledge",
        "/api/contacts",
        "/api/families",
        "/api/pm/programs/templates",
      ];
      const apply = (knowData, staffData, segData, tmplData) => {
        if (knowData?.success) setKnowledgeNodes(knowData.conceptNotes || []);
        if (segData?.success) setSegments(segData.families || []);
        if (tmplData?.success) setTemplates(tmplData.templates || []);
        // Filter: Only Future Studio contacts
        if (staffData?.success) {
          const staffOnly = (staffData.contacts || []).filter(
            (c) =>
              c.group_name?.toUpperCase() === "FUTURE STUDIO",
          );
          setStaffList(staffOnly);
        }
      };
      let painted = false;
      setLoadingAssets(true);
      try {
        // Cache-first paint: returning to this page renders the wizard options
        // instantly from fresh snapshots; inline-created groups/KB nodes update
        // local lists directly, so nothing here needs bypassCache.
        if (!bypassCache) {
          const cached = urls.map((u) => cacheGet(u));
          if (cached.every((c) => c !== null && c.success)) {
            apply(cached[0], cached[1], cached[2], cached[3]);
            setLoadingAssets(false);
            painted = true;
          }
        }
        const responses = await Promise.all(
          urls.map((u) =>
            fetch(u)
              .then((r) => r.json())
              .catch(() => ({ success: false })),
          ),
        );
        urls.forEach((u, i) => {
          if (responses[i]?.success) cacheSet(u, responses[i]);
        });
        apply(responses[0], responses[1], responses[2], responses[3]);
      } catch (e) {
        if (!painted) {
          console.error("Asset Load Failure:", e);
          notify(
            "error",
            t("adminMisc.newProgram.syncFailed"),
          );
        }
      } finally {
        setLoadingAssets(false);
      }
    }
    loadAssets();
    // Charger les types personnalisés depuis la DB
    fetch("/api/program-types")
      .then((r) => r.json())
      .then((data) => {
        if (data.types) setCustomProgramTypes(data.types);
      })
      .catch(() => {});
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
          throw new Error(t("adminMisc.newProgram.uploadFailedFor", { name: file.name, error: t(res.error || "") || res.error }));
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
      notify("success", t("adminMisc.newProgram.attached"));
    } catch (e) {
      notify("error", t(e.message || "") || e.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateGroupInline = async () => {
    if (!newGroup.name) return notify("error", t("adminMisc.newProgram.groupNameRequired"));
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
        // Only auto-save program if PM is already selected
        if (program.assigned_pm_id) {
          notify("success", t("adminMisc.newProgram.groupCreatedAutoSaving"));
          setTimeout(() => handleDeploy({ preventDefault: () => {} }, data.group.id), 300);
        } else {
          notify("success", t("adminMisc.newProgram.groupCreatedFillIn"));
        }
      }
    } catch (e) {
      notify("error", t(e.message || "") || e.message);
    } finally {
      setIsDeploying(false);
    }
  };

  const handleCreateKBInline = async () => {
    if (!newKB.title)
      return notify("error", t("adminMisc.newProgram.kbTitleRequired"));
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
        notify("success", t("adminMisc.newProgram.created"));
      }
    } catch (e) {
      notify("error", t(e.message || "") || e.message);
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

  const handleDeploy = async (e, existingGroupId) => {
    e.preventDefault();
    if (!program.name || !program.assigned_pm_id) {
      notify(
        "error",
        t("adminMisc.newProgram.criticalParametersMissing"),
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
      let groupId = existingGroupId || program.assigned_segments?.[0];
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
        body: JSON.stringify({
          name: program.name,
          description: program.description || null,
          concept_note:
            program.conceptNoteType === "link"
              ? program.conceptNoteLink
              : program.description || null,
          vision: program.vision || null,
          objectives: program.objectives || null,
          expected_outcomes: program.expected_outcomes || null,
          success_metrics: program.success_metrics || null,
          program_type: program.program_type || "incubation",
          visibility: program.visibility || "private",
          language: program.language || "en",
          start_date: program.start_date,
          end_date: program.end_date,
          duration_weeks: program.duration_weeks,
          assigned_pm_id: program.assigned_pm_id,
          assigned_assistant_id: program.assigned_assistant_id || null,
          note_id: program.note_id || null,
          materials: program.materials,
          assigned_segments: existingGroupId ? [existingGroupId] : program.assigned_segments,
          kpis: kpisList,
        }),
      });
      const data = await res.json();

      if (data.success) {
        notify("success", t("adminMisc.newProgram.created"));
        setTimeout(() => router.push("/admin/programs"), 1500);
      } else {
        throw new Error(t((data.error || t("adminMisc.newProgram.failedToSaveProgram")) || "") || (data.error || t("adminMisc.newProgram.failedToSaveProgram")));
      }
    } catch (e) {
      notify("error", t(e.message || "") || e.message);
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <>
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
            className="group flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--brand-orange)] transition-all font-bold text-[10px] uppercase tracking-wide"
          >
            <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />{" "}
            {t("adminMisc.newProgram.programList")}
          </button>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                {t("adminMisc.newProgram.administration")}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-[var(--text-primary)]">
              {t("adminMisc.newProgram.title")}
            </h1>
          </div>
        </header>

        <form onSubmit={handleDeploy} className="space-y-10">
          {/* Template Selector */}
          {templates.length > 0 && (
            <div className="space-y-3">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-2">
                {t("admin.startFromTemplate")}
              </label>
              <div className="flex gap-3">
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="flex-1 bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-[var(--brand-orange)] transition-all"
                >
                  <option value="">{t("admin.selectTemplate")}</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.program_type || "incubation"})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!selectedTemplate || applyingTemplate}
                  onClick={async () => {
                    if (!selectedTemplate) return;
                    setApplyingTemplate(true);
                    try {
                      const t = templates.find(
                        (x) => x.id === selectedTemplate,
                      );
                      const res = await fetch(
                        "/api/pm/programs/templates?action=apply",
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            template_id: selectedTemplate,
                            name: program.name || t?.name || "New Program",
                          }),
                        },
                      );
                      const data = await res.json();
                      if (data.success) {
                        notify("success", t("adminMisc.newProgram.programCreatedFromTemplate"));
                        setTimeout(() => router.push("/admin/programs"), 1500);
                      } else {
                        notify("error", t((data.error || t("adminMisc.newProgram.failed")) || "") || (data.error || t("adminMisc.newProgram.failed")));
                      }
                    } catch (e) {
                      notify("error", t(e.message || "") || e.message);
                    } finally {
                      setApplyingTemplate(false);
                    }
                  }}
                  className="px-6 py-3 bg-indigo-500 text-white rounded-xl text-sm font-bold uppercase tracking-wide hover:bg-indigo-600 transition-all disabled:opacity-40"
                >
                  {applyingTemplate ? t("adminMisc.newProgram.creating") : t("admin.apply")}
                </button>
              </div>
            </div>
          )}

          {/* SECTION: BASIC IDENTITY */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-2">
                {t("admin.programName")}
              </label>
              <input
                required
                value={program.name}
                onChange={(e) =>
                  setProgram({ ...program, name: e.target.value })
                }
                placeholder={t("adminMisc.newProgram.namePlaceholder")}
                className="w-full bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 text-lg font-bold text-white outline-none focus:border-[var(--brand-orange)] transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-2">
                {t("adminMisc.newProgram.startDate")}
              </label>
              <input
                required
                type="date"
                min={todayStr}
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
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-2">
                {t("adminMisc.newProgram.endDate")}
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
                <p className="text-[10px] font-bold uppercase tracking-widest text-rose-400 mt-1 ml-2">
                  {dateError}
                </p>
              )}
              {program.start_date &&
                program.end_date &&
                !dateError &&
                (() => {
                  const diffDays = Math.ceil(
                    (new Date(program.end_date) - new Date(program.start_date)) /
                      (1000 * 60 * 60 * 24),
                  );
                  const weeks = Math.max(1, Math.ceil(diffDays / 7));
                  return (
                    <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mt-1 ml-2">
                      {t("adminMisc.newProgram.computedDuration", { weeks })}
                    </p>
                  );
                })()}
            </div>
          </div>

          {/* Program Type & Vision & Objectives */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-2">
                {t("admin.programType")}
              </label>
              <div className="flex gap-2">
                <select
                  value={program.program_type || "incubation"}
                  onChange={(e) =>
                    setProgram({ ...program, program_type: e.target.value })
                  }
                  className="flex-1 bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 text-lg font-bold text-white outline-none focus:border-[var(--brand-orange)] transition-all"
                >
                  <option value="incubation">
                    {t("admin.programTypes.incubation")}
                  </option>
                  <option value="acceleration">
                    {t("admin.programTypes.acceleration")}
                  </option>
                  <option value="bootcamp">
                    {t("admin.programTypes.bootcamp")}
                  </option>
                  <option value="workshop">
                    {t("admin.programTypes.workshop")}
                  </option>
                  <option value="fellowship">
                    {t("admin.programTypes.fellowship")}
                  </option>
                  {customProgramTypes.map((ct, i) => (
                    <option key={i} value={ct}>
                      {ct.toUpperCase()}
                    </option>
                  ))}
                  <option value="custom">{t("admin.programTypes.custom")}</option>
                </select>
                <button
                  type="button"
                  onClick={() => setShowNewTypeInput(!showNewTypeInput)}
                  className="px-4 bg-[var(--brand-orange)]/10 text-[var(--brand-orange)] border border-[var(--brand-orange)]/20 rounded-2xl hover:bg-[var(--brand-orange)]/20 transition-all shrink-0"
                  title={t("adminMisc.newProgram.addTypeTitle")}
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              {showNewTypeInput && (
                <div className="flex gap-2 mt-2 animate-in fade-in slide-in-from-top-2">
                  <input
                    type="text"
                    value={newTypeInput}
                    onChange={(e) => setNewTypeInput(e.target.value)}
                    placeholder={t("adminMisc.newProgram.newTypePlaceholder")}
                    className="flex-1 bg-primary border border-[var(--border-primary)] rounded-xl p-3 text-xs font-bold text-white outline-none focus:border-[var(--brand-orange)]"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!newTypeInput.trim()) return;
                      const typeKey = newTypeInput.trim().toLowerCase().replace(/\s+/g, '_');
                      try {
                        await fetch("/api/program-types", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ type_key: typeKey }),
                        });
                      } catch {}
                      setCustomProgramTypes([...customProgramTypes, typeKey]);
                      setProgram({ ...program, program_type: typeKey });
                      setNewTypeInput("");
                      setShowNewTypeInput(false);
                    }}
                    className="px-4 bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-xl border border-emerald-500/20 hover:bg-emerald-500/20"
                  >
                    {t("adminMisc.newProgram.addType")}
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-2">
                {t("admin.visibility")}
              </label>
              <select
                value={program.visibility || "private"}
                onChange={(e) =>
                  setProgram({ ...program, visibility: e.target.value })
                }
                className="w-full bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 text-lg font-bold text-white outline-none focus:border-[var(--brand-orange)] transition-all"
              >
                <option value="private">
                  {t("admin.visibilityOptions.private")}
                </option>
                <option value="public">
                  {t("admin.visibilityOptions.public")}
                </option>
                <option value="invite_only">
                  {t("admin.visibilityOptions.inviteOnly")}
                </option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-2">
                {t("admin.language")}
              </label>
              <select
                value={program.language || "en"}
                onChange={(e) =>
                  setProgram({ ...program, language: e.target.value })
                }
                className="w-full bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 text-lg font-bold text-white outline-none focus:border-[var(--brand-orange)] transition-all"
              >
                <option value="en">English</option>
                <option value="fr">French</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-2">
                {t("admin.vision")}
              </label>
              <textarea
                rows={3}
                value={program.vision || ""}
                onChange={(e) =>
                  setProgram({ ...program, vision: e.target.value })
                }
                placeholder={t("adminMisc.newProgram.visionPlaceholder")}
                className="w-full bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 font-medium text-white outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-2">
                {t("admin.objectives")}
              </label>
              <textarea
                rows={3}
                value={program.objectives || ""}
                onChange={(e) =>
                  setProgram({ ...program, objectives: e.target.value })
                }
                placeholder={t("adminMisc.newProgram.objectivesPlaceholder")}
                className="w-full bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 font-medium text-white outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
              />
            </div>
          </div>

          {/* Expected Outcomes & Success Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-2">
                {t("adminMisc.newProgram.expectedOutcomes")}
              </label>
              <textarea
                rows={3}
                value={program.expected_outcomes || ""}
                onChange={(e) =>
                  setProgram({ ...program, expected_outcomes: e.target.value })
                }
                placeholder={t("adminMisc.newProgram.expectedOutcomesPlaceholder")}
                className="w-full bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 font-medium text-white outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-2">
                {t("adminMisc.newProgram.successMetrics")}
              </label>
              <textarea
                rows={3}
                value={program.success_metrics || ""}
                onChange={(e) =>
                  setProgram({ ...program, success_metrics: e.target.value })
                }
                placeholder={t("adminMisc.newProgram.successMetricsPlaceholder")}
                className="w-full bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 font-medium text-white outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
              />
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-2">
              {t("admin.conceptNote")}
            </label>

            {/* Input type selector */}
            <div className="flex gap-2 bg-primary rounded-xl p-1.5 border border-[var(--border-primary)] w-fit">
              {[
                { id: "text", label: t("admin.richText"), icon: FileText },
                { id: "link", label: t("admin.externalLink"), icon: Plus },
                {
                  id: "upload",
                  label: t("admin.uploadDocument"),
                  icon: Upload,
                },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() =>
                    setProgram({ ...program, conceptNoteType: opt.id })
                  }
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                    (program.conceptNoteType || "text") === opt.id
                      ? "bg-[var(--brand-orange)] text-black"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
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
                placeholder={t("adminMisc.newProgram.conceptNotePlaceholder")}
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
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 group-hover:text-white transition-all">
                    {program.conceptNoteFile ||
                      t("adminMisc.newProgram.clickToUpload")}
                  </p>
                  {program.conceptNoteFile && (
                    <p className="text-[10px] font-medium text-emerald-400 mt-2">
                      {t("adminMisc.newProgram.fileSelected", {
                        name: program.conceptNoteFile,
                      })}
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
                  {t("adminMisc.newProgram.selectFromKnowledgeBase")}
                </h3>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-1">
                      {t("adminMisc.newProgram.knowledgeNodeLink")}
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCreatingKB(!isCreatingKB)}
                      className="text-[10px] font-bold uppercase tracking-wide text-[var(--brand-orange)] hover:underline"
                    >
                      {isCreatingKB
                        ? t("adminMisc.newProgram.cancel")
                        : t("adminMisc.newProgram.createNewKb")}
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
                      <option value="">{t("adminMisc.newProgram.linkKnowledgeNode")}</option>
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
                        placeholder={t("adminMisc.newProgram.knowledgeBaseNamePlaceholder")}
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
                          <p className="text-[10px] font-bold uppercase text-white/40">
                            {t("adminMisc.newProgram.uploadDocumentsForKb")}
                          </p>
                        </div>
                      </div>
                      {newKB.files.length > 0 && (
                        <div className="text-[10px] font-bold uppercase text-emerald-400">
                          {t("adminMisc.newProgram.documentsAttached", {
                            count: newKB.files.length,
                          })}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={handleCreateKBInline}
                        className="w-full py-2 bg-[var(--brand-orange)]/10 text-[var(--brand-orange)] text-[10px] font-bold uppercase rounded-lg border border-[var(--brand-orange)]/20"
                      >
                        {t("adminMisc.newProgram.initializeKnowledgeBase")}
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
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 group-hover:text-white transition-all">
                      {isUploading
                        ? t("adminMisc.newProgram.uploadingAssets")
                        : t("adminMisc.newProgram.attachProgramMaterials")}
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
                  {t("adminMisc.newProgram.contactGroupAssignment")}
                </h3>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-1">
                    {t("adminMisc.newProgram.groupTarget")}
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
                    className="text-[10px] font-bold uppercase tracking-wide text-blue-400 hover:underline"
                  >
                    {isCreatingGroup
                      ? t("adminMisc.newProgram.cancel")
                      : t("adminMisc.newProgram.createNewGroup")}
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
                    <option value="">{t("adminMisc.newProgram.selectExistingGroup")}</option>
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
                      placeholder={t("adminMisc.newProgram.groupNamePlaceholder")}
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
                      placeholder={t("adminMisc.newProgram.groupDescriptionPlaceholder")}
                      rows={2}
                      className="w-full bg-transparent border border-[var(--border-primary)] p-2 rounded text-[10px] font-medium text-white outline-none focus:border-blue-400 resize-none"
                    />
                    <button
                      type="button"
                      onClick={handleCreateGroupInline}
                      className="w-full py-2 bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase rounded-lg border border-blue-500/20"
                    >
                      {t("adminMisc.newProgram.generateGroupAndUrl")}
                    </button>
                  </div>
                )}

                {createdGroup && (
                  <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                      {t("adminMisc.newProgram.publicRegistrationUrl")}
                    </p>
                    <div className="flex items-center justify-between gap-3 bg-black/40 p-2 rounded border border-white/5 overflow-hidden">
                      <span className="text-[10px] font-mono text-white/60 truncate">
                        {window.location.origin}/register-participant?group_id=
                        {createdGroup.registration_id && encodeURIComponent(createdGroup.registration_id)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(
                            `${window.location.origin}/register-participant?group_id=${createdGroup.registration_id && encodeURIComponent(createdGroup.registration_id)}`,
                          );
                          notify("success", t("adminMisc.newProgram.copied"));
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
                  {t("adminMisc.newProgram.assignedManagers")}
                </h3>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-1">
                    {t("adminMisc.newProgram.programManager")}
                  </label>
                  <select
                    required
                    value={program.assigned_pm_id}
                    onChange={(e) =>
                      setProgram({ ...program, assigned_pm_id: e.target.value })
                    }
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold text-white outline-none focus:border-[var(--brand-orange)] cursor-pointer"
                  >
                    <option value="">{t("adminMisc.newProgram.selectManager")}</option>
                    {staffList.map((staff) => (
                      <option key={staff.cid} value={staff.cid}>
                        {staff.name.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-1">
                    {t("adminMisc.newProgram.assignedTeam")}
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
                    <option value="">{t("adminMisc.newProgram.selectSupport")}</option>
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
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">
                    {t("adminMisc.newProgram.strategicKpisConfiguration")}
                  </h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-1">
                    {t("adminMisc.newProgram.defineKpiTargets")}
                  </p>
                  <p className="text-sm text-[var(--text-secondary)] mt-3 max-w-2xl leading-relaxed">
                    <strong className="text-[var(--text-primary)]">
                      {t("adminMisc.newProgram.targetTitle")}
                    </strong>{" "}
                    {t("adminMisc.newProgram.targetDescription")}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-1 gap-6 items-end">
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-2">
                  {t("adminMisc.newProgram.kpiTitle")}
                </label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder={t("adminMisc.newProgram.kpiTitlePlaceholder")}
                    value={kpiInput.title}
                    onChange={(e) =>
                      setKpiInput({ ...kpiInput, title: e.target.value })
                    }
                    className="flex-1 bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold text-white outline-none focus:border-[var(--brand-orange)]"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={kpiInput.target_value}
                    onChange={(e) =>
                      setKpiInput({ ...kpiInput, target_value: parseInt(e.target.value) || 0 })
                    }
                    className="w-20 bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold text-white outline-none focus:border-[var(--brand-orange)] text-center"
                    placeholder="%"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!kpiInput.title.trim()) return;
                      // Stratégie 100% : le total des KPIs fait toujours 100
                      // Le dernier KPI existant est divisé par 2, le nouveau prend la valeur courante
                      const currentValue = kpiInput.target_value || 100;
                      const nextValue = Math.max(1, Math.floor(currentValue / 2));
                      const updated = [...kpisList];
                      if (updated.length > 0) {
                        const last = updated[updated.length - 1];
                        updated[updated.length - 1] = {
                          ...last,
                          target_value: Math.max(1, Math.floor(last.target_value / 2)),
                        };
                      }
                      setKpisList([
                        ...updated,
                        {
                          title: kpiInput.title,
                          target_value: currentValue,
                        },
                      ]);
                      setKpiInput({ title: "", target_value: nextValue });
                    }}
                    className="px-6 bg-[var(--brand-orange)] text-black font-bold uppercase text-[10px] tracking-widest rounded-xl hover:bg-white transition-all flex items-center justify-center shrink-0"
                  >
                    <Plus className="w-4 h-4" /> {t("adminMisc.newProgram.add")}
                  </button>
                </div>
              </div>
            </div>

            {kpisList.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-[var(--border-primary)]">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] text-left">
                  {t("adminMisc.newProgram.definedKpis", {
                    count: kpisList.length,
                  })}
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
                          <span className="text-[var(--brand-orange)] ml-2">
                            {kpi.target_value}%
                          </span>
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
                <span>{t("adminMisc.newProgram.savingProgram")}</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3">
                <Zap className="w-5 h-5" />
                <span>{t("adminMisc.newProgram.saveProgram")}</span>
              </div>
            )}
          </button>
        </form>
      </div>
    </>
  );
}

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import NextLink from "next/link";
import {
  FileText, Plus, Search, Loader2, Edit3, Archive, Copy,
  Eye, Grid3X3, X, ChevronUp, ChevronDown, Trash2,
  CheckSquare, Circle, List, Hash, Mail, PhoneIcon, Calendar,
  Clock, Star, FileUp, Link, DollarSign, PenTool, AlignLeft,
  Type, Upload, BarChart3, PlusCircle, MinusCircle, RotateCcw, AlertTriangle, Sparkles, CheckCircle2, Play, FolderKanban, GitBranch, Send, Key, XCircle,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/**
 * PLATFORM FORMS — Visual Form Builder
 */

const FIELD_ICONS = {
  text: Type, textarea: AlignLeft, number: Hash, email: Mail, phone: PhoneIcon,
  date: Calendar, time: Clock, select: List, radio: Circle, checkbox: CheckSquare,
  multiselect: Grid3X3, file: Upload, url: Link, currency: DollarSign,
  rating: Star, richtext: PenTool, signature: PenTool, hidden: Eye,
};

const FIELD_TYPES = [
  { value: "text", label: "Short Text", icon: Type },
  { value: "textarea", label: "Long Text", icon: AlignLeft },
  { value: "number", label: "Number", icon: Hash },
  { value: "email", label: "Email", icon: Mail },
  { value: "phone", label: "Phone", icon: PhoneIcon },
  { value: "date", label: "Date", icon: Calendar },
  { value: "time", label: "Time", icon: Clock },
  { value: "select", label: "Dropdown", icon: List },
  { value: "radio", label: "Radio", icon: Circle },
  { value: "checkbox", label: "Checkbox", icon: CheckSquare },
  { value: "multiselect", label: "Multi-Select", icon: Grid3X3 },
  { value: "file", label: "File Upload", icon: Upload },
  { value: "url", label: "URL", icon: Link },
  { value: "currency", label: "Currency", icon: DollarSign },
  { value: "rating", label: "Rating", icon: Star },
  { value: "richtext", label: "Rich Text", icon: PenTool },
];

function cn(...classes) { return classes.filter(Boolean).join(" "); }

export default function PlatformForms() {
  const router = useRouter();
  const { t } = useI18n();
  const [forms, setForms] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("published");
  const [notification, setNotification] = useState(null);

  // Builder state
  const [editingForm, setEditingForm] = useState(null);
  const [sections, setSections] = useState([]);
  const [fields, setFields] = useState([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState(null); // Now uses field temp ID, not array index
  const [addingFieldType, setAddingFieldType] = useState(null);
  const [activeSectionId, setActiveSectionId] = useState(null); // Track which section new fields go into

  // Scoring config panel
  const [showScoring, setShowScoring] = useState(false);
  const [scoringConfig, setScoringConfig] = useState(null);

  // AI Evaluation panel
  const [showAiEval, setShowAiEval] = useState(false);
  const [aiEvalFramework, setAiEvalFramework] = useState(null);
  const [aiEvalText, setAiEvalText] = useState("");
  const [aiEvalLoading, setAiEvalLoading] = useState(false);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", description: "", collection_id: "", visibility: "internal", tags: "" });
  const [createMode, setCreateMode] = useState("manual"); // "manual" | "ai"
  const [aiGenText, setAiGenText] = useState("");
  const [aiGenLoading, setAiGenLoading] = useState(false);

  // Archive confirmation
  const [archiveConfirm, setArchiveConfirm] = useState(null);

  // Re-publish confirmation
  const [showRepublishConfirm, setShowRepublishConfirm] = useState(false);

  // Workflow config panel
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [workflowConfig, setWorkflowConfig] = useState(null);
  const [automationConfig, setAutomationConfig] = useState(null);

  // Templates panel
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateConfig, setTemplateConfig] = useState(null);
  const [personalizing, setPersonalizing] = useState(null); // template key while AI is writing

  const DEFAULT_AUTOMATION = {
    on_submit: { send_acknowledgement: true },
    on_approve: { send_approval_email: true, create_platform_user: true, send_activation_email: true, enroll_in_program: true, assign_to_group: true },
    on_reject: { send_rejection_email: true },
    auto_approve: false,
    auto_approve_cutoff: 80,
    redirect_after_submit: "",
    success_message: "",
  };

  const notify = (msg) => { setNotification(msg); setTimeout(() => setNotification(null), 3000); };

  const fetchForms = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/platform/forms?${params}`);
      const data = await res.json();
      if (data.success) setForms(data.forms || []);
    } catch (_) {}
    setLoading(false);
  }, [statusFilter]);

  const fetchCollections = useCallback(async () => {
    try {
      const res = await fetch("/api/platform/collections");
      const data = await res.json();
      if (data.success) setCollections(data.collections || []);
    } catch (_) {}
  }, []);

  useEffect(() => { fetchForms(); fetchCollections(); }, [fetchForms, fetchCollections]);

  const genTempId = () => `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const openBuilder = async (form) => {
    setEditingForm(form);
    setShowBuilder(true);
    setPreviewMode(false);
    setSelectedFieldId(null);

    // Load scoring config from form settings
    const formSettings = form.settings || {};
    setScoringConfig(formSettings.scoring && formSettings.scoring.enabled
      ? { ...formSettings.scoring }
      : { enabled: false, max_per_question: 0, sections: {}, rankings: [{ min: 0, max: 59, label: "Needs Work" }, { min: 60, max: 79, label: "Good" }, { min: 80, max: 100, label: "Excellent" }] }
    );

    // Load workflow config from form settings
    setWorkflowConfig(formSettings.workflow || null);

    // Load automation config from form settings
    setAutomationConfig(formSettings.automation || { ...DEFAULT_AUTOMATION });

    // Load template config from form settings
    setTemplateConfig(formSettings.automation?.templates || null);

    try {
      const res = await fetch(`/api/platform/forms?id=${form.id}`);
      const data = await res.json();
      if (data.success) {
        const loadedSections = (data.sections || []).map(s => ({ ...s, id: String(s.id) }));
        const loadedFields = (data.fields || []).map(f => ({ ...f, _tmpId: genTempId(), section_id: f.section_id ? String(f.section_id) : null }));
        
        // Auto-create default section if none exist
        if (loadedSections.length === 0) {
          const defaultSection = { id: genTempId(), title: "Section 1", description: "", sort_order: 0 };
          loadedSections.push(defaultSection);
          // Assign any loaded fields to this section
          loadedFields.forEach(f => { if (!f.section_id) f.section_id = defaultSection.id; });
        }
        
        setSections(loadedSections);
        setFields(loadedFields);
        setActiveSectionId(loadedSections.length > 0 ? loadedSections[loadedSections.length - 1].id : null);
      }
    } catch (_) {}

    // Load AI evaluation framework if exists
    try {
      const fwRes = await fetch(`/api/platform/ai/evaluation-config?form_id=${form.id}`);
      const fwData = await fwRes.json();
      if (fwData.success && fwData.framework) setAiEvalFramework(fwData.framework);
      else setAiEvalFramework(null);
    } catch (_) {}
  };

  const handleCreateForm = async () => {
    if (!createForm.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/platform/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createForm,
          tags: createForm.tags ? createForm.tags.split(",").map((t) => t.trim()) : [],
        }),
      });
      const data = await res.json();
      if (data.success) {
        notify("Form created");
        setShowCreate(false);
        setCreateForm({ name: "", description: "", collection_id: "", visibility: "internal", tags: "" });
        fetchForms();
        // Start with a default section for new forms
        const defaultSecId = genTempId();
        setEditingForm(data.form);
        setShowBuilder(true);
        setPreviewMode(false);
        setSelectedFieldId(null);
        setSections([{ id: defaultSecId, title: "Section 1", description: "", sort_order: 0 }]);
        setFields([]);
        setActiveSectionId(defaultSecId);
        setScoringConfig({ enabled: false, max_per_question: 0, sections: {}, rankings: [{ min: 0, max: 59, label: "Needs Work" }, { min: 60, max: 79, label: "Good" }, { min: 80, max: 100, label: "Excellent" }] });
        setAiEvalFramework(null);
      }
    } catch (_) {}
    setSaving(false);
  };

  const handlePublish = async (opts) => {
    if (!editingForm) return;
    const skipSave = opts?.skipSave;
    if (!skipSave) setSaving(true);
    try {
      let fwData = null;
      try {
        const fwRes = await fetch(`/api/platform/ai/evaluation-config?form_id=${editingForm.id}`);
        const fwJson = await fwRes.json();
        if (fwJson.success && fwJson.framework) fwData = fwJson.framework;
      } catch (e) {}

      const res = await fetch("/api/platform/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish", id: editingForm.id, fields, sections, evaluation_framework: fwData }),
      });
      const data = await res.json();
      if (data.success) {
        notify(`Published version ${data.version}`);
        setEditingForm((prev) => ({ ...prev, status: "published", version: data.version }));
        fetchForms();
      }
    } catch (_) {}
    if (!skipSave) setSaving(false);
  };

  const addSection = async () => {
    const tempId = genTempId();
    setSections((prev) => {
      const next = [
        ...prev,
        { id: tempId, title: "New Section", description: "", sort_order: prev.length },
      ];
      setActiveSectionId(tempId); // New section becomes active
      return next;
    });
  };

  const updateSection = (idx, updates) => {
    setSections((prev) => prev.map((s, i) => (i === idx ? { ...s, ...updates } : s)));
  };

  const removeSection = (idx) => {
    const removedSection = sections[idx];
    setSections((prev) => prev.filter((_, i) => i !== idx));
    // Orphan fields that belonged to this section
    if (removedSection?.id) {
      setFields((prev) => prev.map((f) =>
        f.section_id === removedSection.id ? { ...f, section_id: null } : f
      ));
    }
  };

  const addField = (fieldType, sectionId) => {
    const typeInfo = FIELD_TYPES.find((t) => t.value === fieldType) || FIELD_TYPES[0];
    const tempId = genTempId();
    const targetSectionId = sectionId || activeSectionId || (sections.length > 0 ? sections[sections.length - 1].id : null);
    setFields((prev) => {
      const newField = {
        id: null,
        _tmpId: tempId,
        section_id: targetSectionId,
        field_type: fieldType,
        label: typeInfo.label,
        placeholder: "",
        help_text: "",
        required: false,
        options: fieldType === "rating"
          ? [{ label: "1", value: "1" }, { label: "2", value: "2" }, { label: "3", value: "3" }, { label: "4", value: "4" }, { label: "5", value: "5" }]
          : ["select", "radio", "checkbox", "multiselect"].includes(fieldType)
            ? [{ label: "Option 1", value: "option-1" }]
            : fieldType === "rating"
            ? [{ label: "1", value: "1" }, { label: "2", value: "2" }, { label: "3", value: "3" }, { label: "4", value: "4" }, { label: "5", value: "5" }]
            : null,
        sort_order: prev.length,
      };
      // Auto-select the new field so user can configure it immediately
      setSelectedFieldId(tempId);
      return [...prev, newField];
    });
    setAddingFieldType(null);
  };

  const updateField = (tmpId, updates) => {
    setFields((prev) => prev.map((f) => (f._tmpId === tmpId ? { ...f, ...updates } : f)));
  };

  const removeField = (tmpId) => {
    setFields((prev) => prev.filter((f) => f._tmpId !== tmpId));
    if (selectedFieldId === tmpId) setSelectedFieldId(null);
  };

  const moveField = (tmpId, direction) => {
    setFields((prev) => {
      const idx = prev.findIndex((f) => f._tmpId === tmpId);
      if (idx === -1) return prev;
      const next = [...prev];
      const target = idx + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((f, i) => ({ ...f, sort_order: i }));
    });
  };

  const addOption = (tmpId) => {
    setFields((prev) => prev.map((f) => {
      if (f._tmpId !== tmpId || !f.options) return f;
      return { ...f, options: [...f.options, { label: `Option ${f.options.length + 1}`, value: `option-${f.options.length + 1}` }] };
    }));
  };

  const updateOption = (tmpId, optIdx, key, value) => {
    setFields((prev) => prev.map((f) => {
      if (f._tmpId !== tmpId || !f.options) return f;
      const opts = [...f.options];
      opts[optIdx] = { ...opts[optIdx], [key]: value };
      return { ...f, options: opts };
    }));
  };

  const removeOption = (tmpId, optIdx) => {
    setFields((prev) => prev.map((f) => {
      if (f._tmpId !== tmpId || !f.options) return f;
      return { ...f, options: f.options.filter((_, j) => j !== optIdx) };
    }));
  };

  const saveFields = async (skipRepublishPrompt) => {
    if (!editingForm) return;
    
    // If form is published and user didn't already choose, show the prompt
    // skipRepublishPrompt: undefined = show prompt, true = republish, "draft" = save only
    if (editingForm.status === "published" && skipRepublishPrompt === undefined) {
      setShowRepublishConfirm(true);
      return;
    }
    
    setSaving(true);
    const isRepublishing = editingForm.status === "published" && skipRepublishPrompt === true;
    try {
      // Delete sections that were removed by the user
      const currentSections = sections.filter((s) => s.id && !String(s.id).startsWith("tmp-"));
      try {
        const existing = await fetch(`/api/platform/forms?id=${editingForm.id}`);
        const existingData = await existing.json();
        if (existingData.success) {
          // Delete removed sections
          if (existingData.sections) {
            const existingIds = existingData.sections.map((s) => s.id);
            const keptIds = currentSections.map((s) => s.id);
            for (const existingId of existingIds) {
              if (!keptIds.includes(existingId)) {
                await fetch(`/api/platform/forms`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingForm.id, sections: [{ id: existingId, _delete: true }] }) });
              }
            }
          }
          // Delete removed fields
          if (existingData.fields) {
            const currentFieldIds = fields.filter((f) => f.id && !String(f.id).startsWith("fld-")).map((f) => f.id);
            const existingFieldIds = existingData.fields.map((f) => f.id);
            for (const existingId of existingFieldIds) {
              if (!currentFieldIds.includes(existingId)) {
                await fetch(`/api/platform/forms`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingForm.id, fields: [{ id: existingId, _delete: true }] }) });
              }
            }
          }
        }
      } catch (_) {}

      // Strip temp IDs for new sections
      const cleanSections = sections.map((s) => (String(s.id).startsWith("tmp-") ? { ...s, id: null } : s));
      const payload = { id: editingForm.id, fields, sections: cleanSections };
      const res = await fetch("/api/platform/forms", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        // Also save scoring config in a separate call
        if (scoringConfig) {
          try {
            await fetch("/api/platform/forms", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: editingForm.id, settings: { ...(editingForm.settings || {}), scoring: scoringConfig } }),
            });
          } catch (_) {}
        }
        
        // If republishing, also create a new version snapshot
        if (isRepublishing) {
          await handlePublish({ skipSave: true });
          notify("Form republished — live URL updated");
        } else {
          notify("Form saved");
        }
        
        // Reload to get real DB IDs for new sections/fields
        try {
          const refresh = await fetch(`/api/platform/forms?id=${editingForm.id}`);
          const fresh = await refresh.json();
          if (fresh.success) {
            setSections((fresh.sections || []).map(s => ({ ...s, id: String(s.id) })));
            setFields((fresh.fields || []).map(f => ({ ...f, _tmpId: genTempId(), section_id: f.section_id ? String(f.section_id) : null })));
            setEditingForm(fresh.form || editingForm);
          }
        } catch (_) {}
      } else notify(t((data.error || "Save failed") || "") || (data.error || "Save failed"));
    } catch (_) {}
    setSaving(false);
  };

  const handleDuplicate = async (form) => {
    if (!confirm(`Duplicate "${form.name}"?`)) return;
    try {
      const res = await fetch("/api/platform/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name + " (copy)",
          description: form.description,
          collection_id: form.collection_id,
          visibility: form.visibility,
          tags: form.tags,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Copy fields from source
        const srcRes = await fetch(`/api/platform/forms?id=${form.id}`);
        const srcData = await srcRes.json();
        if (srcData.success) {
          await fetch("/api/platform/forms", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: data.form.id,
              fields: srcData.fields.map((f) => ({ ...f, id: null })),
              sections: srcData.sections.map((s) => ({ ...s, id: null })),
            }),
          });
        }
        notify("Form duplicated");
        fetchForms();
      }
    } catch (_) {}
  };

  const handleArchive = async (id) => {
    const form = forms.find((f) => f.id === id);
    if (!form) return;
    setArchiveConfirm({ id, name: form.name, action: "archive" });
  };

  const handleUnarchive = async (id) => {
    const form = forms.find((f) => f.id === id);
    if (!form) return;
    setArchiveConfirm({ id, name: form.name, action: "unarchive" });
  };

  const confirmArchiveAction = async () => {
    if (!archiveConfirm) return;
    const { id, action } = archiveConfirm;
    try {
      if (action === "archive") {
        await fetch(`/api/platform/forms?id=${id}`, { method: "DELETE" });
      } else {
        await fetch("/api/platform/forms", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, status: "draft" }),
        });
      }
      notify(action === "archive" ? "Form archived" : "Form restored");
      fetchForms();
    } catch (_) {}
    setArchiveConfirm(null);
  };

  const renderFieldPreview = (fld) => {
    const Icon = FIELD_ICONS[fld.field_type] || Type;
    const tmpId = fld._tmpId;
    return (
      <div
        key={tmpId}
        onClick={() => setSelectedFieldId(selectedFieldId === tmpId ? null : tmpId)}
        className={cn(
          "p-4 rounded-xl border transition-all cursor-pointer group",
          selectedFieldId === tmpId
            ? "border-[var(--brand-orange)] bg-[var(--brand-orange)]/5"
            : "border-[var(--border-primary)] bg-secondary hover:border-[var(--text-secondary)]",
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Icon className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-[var(--text-primary)]">
                {fld.label || "Untitled"}
                {fld.required && <span className="text-rose-500 ml-1">*</span>}
              </p>
              <p className="text-[8px] text-[var(--text-secondary)] uppercase tracking-wider">
                {fld.field_type}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
            <button onClick={(e) => { e.stopPropagation(); moveField(tmpId, -1); }}><ChevronUp className="w-3 h-3" /></button>
            <button onClick={(e) => { e.stopPropagation(); moveField(tmpId, 1); }}><ChevronDown className="w-3 h-3" /></button>
            <button onClick={(e) => { e.stopPropagation(); removeField(tmpId); }} className="text-rose-500"><Trash2 className="w-3 h-3" /></button>
          </div>
        </div>

        {/* Field editor (expanded) */}
        {selectedFieldId === tmpId && (
          <div className="mt-4 pt-4 border-t border-[var(--border-primary)] space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-[var(--text-secondary)]">Label</label>
                <input
                  value={fld.label}
                  onChange={(e) => updateField(tmpId, { label: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-[var(--text-secondary)]">Type</label>
                <select
                  value={fld.field_type}
                  onChange={(e) => {
                    const newType = e.target.value;
                    const needsOptions = ["select", "radio", "checkbox", "multiselect", "rating"].includes(newType);
                    updateField(tmpId, { field_type: newType, options: needsOptions ? (newType === "rating" ? [{ label: "1", value: "1" }, { label: "2", value: "2" }, { label: "3", value: "3" }, { label: "4", value: "4" }, { label: "5", value: "5" }] : [{ label: "Option 1", value: "option-1" }]) : null });
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-black uppercase text-[var(--text-secondary)]">Section</label>
              <select
                value={fld.section_id || ""}
                onChange={(e) => updateField(tmpId, { section_id: e.target.value || null })}
                className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
              >
                <option value="">None (unassigned)</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-black uppercase text-[var(--text-secondary)]">Placeholder</label>
              <input
                value={fld.placeholder || ""}
                onChange={(e) => updateField(tmpId, { placeholder: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-black uppercase text-[var(--text-secondary)]">Help Text</label>
              <input
                value={fld.help_text || ""}
                onChange={(e) => updateField(tmpId, { help_text: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
              />
            </div>
            <label className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-primary)]">
              <input type="checkbox" checked={fld.required} onChange={(e) => updateField(tmpId, { required: e.target.checked })} />
              Required
            </label>

            {/* Options editor */}
            {fld.options && (
              <div className="space-y-2">
                <label className="text-[8px] font-black uppercase text-[var(--text-secondary)]">Options</label>
                {fld.options.map((opt, oIdx) => (
                  <div key={oIdx} className="flex items-center gap-2">
                    <input
                      value={opt.label}
                      onChange={(e) => updateOption(tmpId, oIdx, "label", e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
                    />
                    <button onClick={() => removeOption(tmpId, oIdx)} className="text-rose-500"><Trash2 className="w-3 h-3" /></button>
                  </div>
                ))}
                <button onClick={() => addOption(tmpId)} className="text-[9px] font-black text-[var(--brand-orange)] hover:underline">+ Add option</button>
              </div>
            )}

            {/* Validation Rules */}
            <div className="space-y-2 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
              <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-50">Validation</p>
              <div className="grid grid-cols-2 gap-2">
                {["text", "textarea"].includes(fld.field_type) && (
                  <>
                    <div className="space-y-1">
                      <label className="text-[7px] font-bold text-[var(--text-secondary)]">Min Length</label>
                      <input type="number" value={fld.validation?.minLength || ""} onChange={(e) => updateField(tmpId, { validation: { ...(fld.validation || {}), minLength: e.target.value ? parseInt(e.target.value) : undefined } })} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[9px] font-bold text-[var(--text-primary)] outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[7px] font-bold text-[var(--text-secondary)]">Max Length</label>
                      <input type="number" value={fld.validation?.maxLength || ""} onChange={(e) => updateField(tmpId, { validation: { ...(fld.validation || {}), maxLength: e.target.value ? parseInt(e.target.value) : undefined } })} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[9px] font-bold text-[var(--text-primary)] outline-none" />
                    </div>
                  </>
                )}
                {["number", "currency"].includes(fld.field_type) && (
                  <>
                    <div className="space-y-1">
                      <label className="text-[7px] font-bold text-[var(--text-secondary)]">Min Value</label>
                      <input type="number" value={fld.validation?.min || ""} onChange={(e) => updateField(tmpId, { validation: { ...(fld.validation || {}), min: e.target.value ? parseFloat(e.target.value) : undefined } })} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[9px] font-bold text-[var(--text-primary)] outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[7px] font-bold text-[var(--text-secondary)]">Max Value</label>
                      <input type="number" value={fld.validation?.max || ""} onChange={(e) => updateField(tmpId, { validation: { ...(fld.validation || {}), max: e.target.value ? parseFloat(e.target.value) : undefined } })} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[9px] font-bold text-[var(--text-primary)] outline-none" />
                    </div>
                  </>
                )}
                {["file"].includes(fld.field_type) && (
                  <>
                    <div className="space-y-1"><label className="text-[7px] font-bold text-[var(--text-secondary)]">Max Size (MB)</label><input type="number" value={fld.validation?.maxSize || ""} onChange={(e) => updateField(tmpId, { validation: { ...(fld.validation || {}), maxSize: e.target.value ? parseInt(e.target.value) : undefined } })} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[9px] font-bold text-[var(--text-primary)] outline-none" /></div>
                    <div className="space-y-1"><label className="text-[7px] font-bold text-[var(--text-secondary)]">Allowed Types</label><input value={fld.validation?.acceptedFiles || ""} onChange={(e) => updateField(tmpId, { validation: { ...(fld.validation || {}), acceptedFiles: e.target.value } })} placeholder=".pdf,.jpg" className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[9px] font-bold text-[var(--text-primary)] outline-none" /></div>
                  </>
                )}
                <div className="col-span-2 space-y-1"><label className="text-[7px] font-bold text-[var(--text-secondary)]">Error Message</label><input value={fld.validation?.errorMessage || ""} onChange={(e) => updateField(tmpId, { validation: { ...(fld.validation || {}), errorMessage: e.target.value } })} placeholder="Custom error message" className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[9px] font-bold text-[var(--text-primary)] outline-none" /></div>
              </div>
            </div>

            {/* Conditional Logic */}
            <div className="space-y-2 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
              <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-50">Conditional Logic</p>
              <div className="space-y-1"><label className="text-[7px] font-bold text-[var(--text-secondary)]">Show only when</label>
                <select value={fld.conditional_logic?.field_id || ""} onChange={(e) => updateField(tmpId, { conditional_logic: { ...(fld.conditional_logic || {}), field_id: e.target.value || undefined } })} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[9px] font-bold text-[var(--text-primary)] outline-none">
                  <option value="">Always visible</option>
                  {fields.filter((f) => f !== fld).slice(0, 20).map((f) => <option key={f.label} value={f.label}>{f.label}</option>)}
                </select>
              </div>
              {fld.conditional_logic?.field_id && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1"><label className="text-[7px] font-bold text-[var(--text-secondary)]">Operator</label>
                    <select value={fld.conditional_logic?.operator || "equals"} onChange={(e) => updateField(tmpId, { conditional_logic: { ...fld.conditional_logic, operator: e.target.value } })} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[9px] font-bold text-[var(--text-primary)] outline-none">
                      <option value="equals">Equals</option><option value="not_equals">Not Equals</option><option value="contains">Contains</option><option value="greater_than">Greater Than</option><option value="less_than">Less Than</option>
                    </select>
                  </div>
                  <div className="space-y-1"><label className="text-[7px] font-bold text-[var(--text-secondary)]">Value</label><input value={fld.conditional_logic?.value || ""} onChange={(e) => updateField(tmpId, { conditional_logic: { ...fld.conditional_logic, value: e.target.value } })} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[9px] font-bold text-[var(--text-primary)] outline-none" /></div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── LIST VIEW ───
  if (!showBuilder) {
    return (
      <div className="p-6 space-y-6 animate-in">
        {notification && <div className="fixed bottom-6 right-6 z-[500] px-5 py-3 rounded-xl bg-emerald-500 text-black text-[10px] font-black uppercase">{notification}</div>}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight text-[var(--text-primary)]">Forms</h1>
            <p className="text-[10px] text-[var(--text-secondary)] mt-1">Design configurable forms with AI evaluation, scoring, and review.</p>
          </div>
          <div className="flex items-center gap-2">
            <NextLink href="/platform/collections" className="flex items-center gap-2 px-4 py-2.5 bg-tertiary border border-[var(--border-primary)] text-[var(--text-secondary)] rounded-xl text-[10px] font-black uppercase hover:text-[var(--text-primary)] transition-all">
              <FolderKanban className="w-3.5 h-3.5" /> Collections
            </NextLink>
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all">
              <Plus className="w-3.5 h-3.5" /> New Form
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" />
            <input type="text" placeholder="Search forms..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none focus:border-[var(--brand-orange)]" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2.5 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]">
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-[var(--brand-orange)]" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {forms.filter((f) => !search || f.name.toLowerCase().includes(search.toLowerCase())).map((f) => {
              const col = f.collection_id ? collections.find((c) => c.id === f.collection_id) : null;
              return (
                <div key={f.id} className="p-5 rounded-2xl bg-secondary border border-[var(--border-primary)] hover:border-[var(--brand-orange)]/50 transition-all group">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--brand-orange)]/10 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-[var(--brand-orange)]" />
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                      <button onClick={() => openBuilder(f)} className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--brand-orange)] hover:bg-tertiary"><Edit3 className="w-3 h-3" /></button>
                      <button onClick={() => handleDuplicate(f)} className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-blue-500 hover:bg-tertiary"><Copy className="w-3 h-3" /></button>
                      {f.status !== "archived" ? (
                        <button onClick={() => handleArchive(f.id)} className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-rose-500 hover:bg-tertiary" title="Archive this form"><Archive className="w-3 h-3" /></button>
                      ) : (
                        <button onClick={() => handleUnarchive(f.id)} className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-emerald-500 hover:bg-tertiary" title="Restore this form"><RotateCcw className="w-3 h-3" /></button>
                      )}
                    </div>
                  </div>
                  <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">{f.name}</h3>
                  {f.description && <p className="text-[10px] text-[var(--text-secondary)] mt-1">{f.description}</p>}
                  {col && <p className="text-[9px] text-[var(--text-secondary)] mt-2 opacity-50">in {col.name}</p>}
                  <div className="flex items-center gap-2 mt-3">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${f.status === "published" ? "text-emerald-500 bg-emerald-500/10" : f.status === "draft" ? "text-amber-500 bg-amber-500/10" : "text-rose-500 bg-rose-500/10"}`}>{f.status}</span>
                    <span className="text-[9px] text-[var(--text-secondary)]">v{f.version || 1}</span>
                  </div>

                </div>
              );
            })}
          </div>
        )}

        {/* Create modal */}
        {showCreate && (
          <div className="fixed inset-0 z-[400] bg-black/40 flex items-center justify-center p-6" onClick={() => { setShowCreate(false); setCreateMode("manual"); setAiGenText(""); }}>
            <div className="card w-full max-w-md space-y-5" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">New Form</h3>
                <button onClick={() => { setShowCreate(false); setCreateMode("manual"); setAiGenText(""); }}><X className="w-5 h-5" /></button>
              </div>

              {/* Mode Switcher */}
              <div className="flex gap-2 p-1 rounded-xl bg-tertiary">
                <button onClick={() => setCreateMode("manual")} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${createMode === "manual" ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)]"}`}>Create Manually</button>
                <button onClick={() => setCreateMode("ai")} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${createMode === "ai" ? "bg-indigo-500 text-white" : "text-[var(--text-secondary)]"}`}>Generate with AI</button>
              </div>

              {createMode === "manual" ? (
                <>
                  <div className="space-y-4">
                    <div className="space-y-1"><label className="text-[9px] font-black uppercase text-[var(--text-secondary)]">Name</label><input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} className="w-full rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--brand-orange)]" placeholder="e.g. Founder Application" /></div>
                    <div className="space-y-1"><label className="text-[9px] font-black uppercase text-[var(--text-secondary)]">Description</label><textarea value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} rows={2} className="w-full rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--brand-orange)] resize-none" placeholder="What is this form for?" /></div>
                    <div className="space-y-1"><label className="text-[9px] font-black uppercase text-[var(--text-secondary)]">Collection</label>
                      <select value={createForm.collection_id} onChange={(e) => setCreateForm({ ...createForm, collection_id: e.target.value })} className="w-full rounded-xl px-3 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--brand-orange)]">
                        <option value="">None</option>
                        {collections.filter((c) => c.status !== "archived" || String(c.id) === createForm.collection_id).map((c) => <option key={c.id} value={c.id}>{c.name}{c.status === "archived" ? " (archived)" : ""}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1"><label className="text-[9px] font-black uppercase text-[var(--text-secondary)]">Tags</label><input value={createForm.tags} onChange={(e) => setCreateForm({ ...createForm, tags: e.target.value })} className="w-full rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--brand-orange)]" placeholder="e.g. application, onboarding" /></div>
                  </div>
                  <div className="flex gap-3"><button onClick={() => setShowCreate(false)} className="flex-1 btn btn-secondary">Cancel</button><button onClick={handleCreateForm} disabled={saving || !createForm.name.trim()} className="flex-1 btn btn-primary">{saving ? "Creating..." : "Create & Edit"}</button></div>
                </>
              ) : (
                <>
                  <div className="space-y-4">
                    <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">Paste your assessment document, concept note, or application guidelines below. AI will generate a complete form with sections, questions, field types, and validation.</p>
                    <textarea
                      value={aiGenText}
                      onChange={(e) => setAiGenText(e.target.value)}
                      rows={8}
                      placeholder="Paste your assessment guide, rubric, concept note, or application requirements here..."
                      className="w-full rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--brand-orange)] resize-none"
                    />
                    <div className="space-y-1"><label className="text-[9px] font-black uppercase text-[var(--text-secondary)]">Collection</label>
                      <select value={createForm.collection_id} onChange={(e) => setCreateForm({ ...createForm, collection_id: e.target.value })} className="w-full rounded-xl px-3 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--brand-orange)]">
                        <option value="">None</option>
                        {collections.filter((c) => c.status !== "archived" || String(c.id) === createForm.collection_id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => { setCreateMode("manual"); setAiGenText(""); }} className="flex-1 btn btn-secondary">Back</button>
                    <button
                      onClick={async () => {
                        if (!aiGenText.trim()) return;
                        setAiGenLoading(true);
                        try {
                          const res = await fetch("/api/platform/ai/generate-all", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: aiGenText, collection_id: createForm.collection_id || null }) });
                          const data = await res.json();
                          if (data.success) {
                            const parts = [];
                            if (data.sections) parts.push(`${data.sections} sections`);
                            if (data.fields) parts.push(`${data.fields} questions`);
                            if (data.evaluation_dimensions) parts.push(`${data.evaluation_dimensions} eval dimensions`);
                            notify(`✓ AI created "${data.title}" — ${parts.join(", ")}`);
                            setShowCreate(false);
                            setCreateMode("manual");
                            setAiGenText("");
                            fetchForms();
                            if (data.form) {
                              // Brief delay so the notification is visible before builder opens
                              setTimeout(() => openBuilder(data.form), 400);
                            }
                          } else {
                            notify(t((data.error || "Generation failed — try a longer document with more detail") || "") || (data.error || "Generation failed — try a longer document with more detail"));
                          }
                        } catch (_) { notify("AI generation failed — check your connection"); }
                        setAiGenLoading(false);
                      }}
                      disabled={aiGenLoading || !aiGenText.trim()}
                      className="flex-1 px-4 py-3 rounded-xl bg-indigo-500 text-white text-[10px] font-black uppercase hover:bg-indigo-600 disabled:opacity-50 transition-all"
                    >
                      {aiGenLoading ? "Generating..." : "Generate Form"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}


      {/* Archive Confirmation Modal */}
      {archiveConfirm && (
        <div className="fixed inset-0 z-[500] bg-black/50 flex items-center justify-center p-6" onClick={() => setArchiveConfirm(null)}>
          <div className="card w-full max-w-sm space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase text-[var(--text-primary)]">
                  {archiveConfirm.action === 'archive' ? 'Archive Form' : 'Restore Form'}
                </h3>
                <p className="text-[10px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                  {archiveConfirm.action === 'archive'
                    ? 'Are you sure you want to archive '
                    : 'Are you sure you want to restore '}
                  <strong className="text-[var(--text-primary)]">&quot;{archiveConfirm.name}&quot;</strong>?
                </p>
              </div>
            </div>
            {archiveConfirm.action === 'archive' ? (
              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
                <p className="text-[9px] font-bold text-amber-500 uppercase">What happens when you archive:</p>
                <ul className="text-[9px] text-[var(--text-secondary)] space-y-1 list-disc list-inside">
                  <li>The form will be hidden from active views</li>
                  <li>Existing runs using this form continue to work</li>
                  <li>You can restore it at any time</li>
                </ul>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                <p className="text-[9px] font-bold text-emerald-500 uppercase">What happens when you restore:</p>
                <ul className="text-[9px] text-[var(--text-secondary)] space-y-1 list-disc list-inside">
                  <li>The form will return to draft status</li>
                  <li>It will reappear in the forms list</li>
                  <li>All previous data and runs remain unchanged</li>
                </ul>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setArchiveConfirm(null)} className="flex-1 btn btn-secondary">Cancel</button>
              <button onClick={confirmArchiveAction}
                className={archiveConfirm.action === 'archive' ? 'flex-1 px-4 py-2.5 rounded-xl bg-rose-500 text-white text-[10px] font-black uppercase hover:bg-rose-600 transition-all' : 'flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-[10px] font-black uppercase hover:bg-emerald-600 transition-all'}>
                {archiveConfirm.action === 'archive' ? 'Archive' : 'Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    );
  }

  // ─── BUILDER VIEW ───
  const formFieldsForSection = (sectionId) => fields.filter((f) => f.section_id === sectionId);
  const orphanFields = fields.filter((f) => !f.section_id);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {notification && <div className="fixed bottom-6 right-6 z-[500] px-5 py-3 rounded-xl bg-emerald-500 text-black text-[10px] font-black uppercase">{notification}</div>}

      {/* Builder header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--border-primary)] bg-secondary shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => { setShowBuilder(false); setEditingForm(null); }} className="text-[10px] font-black uppercase text-[var(--text-secondary)] hover:text-[var(--text-primary)]">← Back</button>
          <span className="text-[var(--text-secondary)] opacity-30">|</span>
          <h2 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">{editingForm?.name}</h2>
          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${editingForm?.status === "published" ? "text-emerald-500 bg-emerald-500/10" : "text-amber-500 bg-amber-500/10"}`}>{editingForm?.status || "draft"}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowAiEval(!showAiEval); setShowScoring(false); setShowTemplates(false); }} className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${showAiEval ? "bg-purple-500 text-white" : "bg-tertiary border border-[var(--border-primary)] text-[var(--text-secondary)]"}`}>
            <Sparkles className="w-3 h-3 inline mr-1.5" />AI Eval {aiEvalFramework && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />}
          </button>
          <button onClick={() => { setShowScoring(!showScoring); setShowAiEval(false); setShowWorkflow(false); setShowTemplates(false); }} className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${showScoring ? "bg-indigo-500 text-white" : "bg-tertiary border border-[var(--border-primary)] text-[var(--text-secondary)]"}`}>
            <BarChart3 className="w-3 h-3 inline mr-1.5" />Scoring {scoringConfig?.enabled && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />}
          </button>
          <button onClick={() => { setShowWorkflow(!showWorkflow); setShowAiEval(false); setShowScoring(false); setShowTemplates(false); }} className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${showWorkflow ? "bg-amber-500 text-white" : "bg-tertiary border border-[var(--border-primary)] text-[var(--text-secondary)]"}`}>
            <GitBranch className="w-3 h-3 inline mr-1.5" />Workflow {workflowConfig && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />}
          </button>
          <button onClick={() => { setShowTemplates(!showTemplates); setShowAiEval(false); setShowScoring(false); setShowWorkflow(false); }} className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${showTemplates ? "bg-cyan-500 text-white" : "bg-tertiary border border-[var(--border-primary)] text-[var(--text-secondary)]"}`}>
            <Mail className="w-3 h-3 inline mr-1.5" />Templates {templateConfig && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />}
          </button>
          <button onClick={() => setPreviewMode(!previewMode)} className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${previewMode ? "bg-[var(--brand-orange)] text-black" : "bg-tertiary border border-[var(--border-primary)] text-[var(--text-secondary)]"}`}>
            <Eye className="w-3 h-3 inline mr-1.5" />{previewMode ? "Editing" : "Preview"}
          </button>
          <button onClick={() => saveFields(false)} disabled={saving} className="px-3 py-2 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[9px] font-black uppercase text-[var(--text-secondary)] hover:text-[var(--text-primary)]">{saving ? "Saving..." : "Save"}</button>
          {editingForm?.status === "published" ? (
            <>
              <button onClick={() => saveFields(true)} disabled={saving} className="px-3 py-2 rounded-xl bg-indigo-500 text-white text-[9px] font-black uppercase hover:bg-indigo-600 transition-all">
                {saving ? "Publishing..." : "Republish"}
              </button>
              <button onClick={async () => {
                // Auto-create a run for this form and navigate to it
                setSaving(true);
                try {
                  const res = await fetch("/api/platform/form-runs", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ form_id: editingForm.id, name: editingForm.name + " Run", description: "Auto-created from form builder" }),
                  });
                  const data = await res.json();
                  if (data.success) {
                    notify("Run created — launching...");
                    // Launch the run
                    await fetch("/api/platform/form-runs?action=launch", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: data.run.id }),
                    });
                    router.push("/platform/runs");
                  } else {
                    router.push("/platform/runs");
                  }
                } catch (_) { router.push("/platform/runs"); }
                setSaving(false);
              }} disabled={saving} className="px-4 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-[9px] font-black uppercase hover:brightness-110 shadow-[0_0_15px_rgba(255,102,0,0.3)] border border-[var(--brand-orange)] flex items-center">
                <Play className="w-3 h-3 inline mr-1.5" /> {saving ? "Creating..." : "Launch & Collect"}
              </button>
            </>
          ) : (
            <button onClick={() => handlePublish()} disabled={saving} className="px-4 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-[9px] font-black uppercase hover:brightness-110">{saving ? "Publishing..." : "Publish"}</button>
          )}
        </div>
      </div>

      {/* Scoring Configuration Panel */}
      {showScoring && scoringConfig && (
        <div className="px-6 py-4 bg-secondary border-b border-[var(--border-primary)] space-y-4 shrink-0 max-h-[50vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">Scoring Configuration</h3>
            </div>
            <button onClick={() => setShowScoring(false)}><X className="w-4 h-4 text-[var(--text-secondary)]" /></button>
          </div>

          {/* Enable toggle & global settings */}
          <div className="grid grid-cols-3 gap-4">
            <label className="flex items-center gap-3 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)] cursor-pointer">
              <input type="checkbox" checked={scoringConfig.enabled} onChange={(e) => setScoringConfig({ ...scoringConfig, enabled: e.target.checked })} className="w-4 h-4 rounded accent-indigo-500" />
              <div>
                <p className="text-[10px] font-black text-[var(--text-primary)] uppercase">Enable Scoring</p>
                <p className="text-[8px] text-[var(--text-secondary)]">Auto-calculate on submission</p>
              </div>
            </label>
            <div className="space-y-1 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
              <label className="text-[8px] font-black uppercase text-[var(--text-secondary)]">Max Per Question</label>
              <input type="number" min={0} value={scoringConfig.max_per_question ?? ""} onChange={(e) => { const v = e.target.value; setScoringConfig({ ...scoringConfig, max_per_question: v === "" ? 0 : parseInt(v) || 0 }); }} className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none" placeholder="0" />
            </div>
            <div className="space-y-1 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
              <label className="text-[8px] font-black uppercase text-[var(--text-secondary)]">Total Section Weight</label>
              <p className={`text-xl font-black ${Object.values(scoringConfig.sections || {}).reduce((s, sec) => s + (sec.weight || 0), 0) === 100 ? "text-emerald-400" : "text-rose-400"}`}>
                {Object.values(scoringConfig.sections || {}).reduce((s, sec) => s + (sec.weight || 0), 0)}%
              </p>
            </div>
          </div>

          {/* Section weights */}
          {scoringConfig.enabled && (
            <div className="space-y-3">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">Section Weights &amp; Scored Fields</h4>
              <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)]">
                <table className="w-full text-left">
                  <thead className="bg-tertiary">
                    <tr className="text-[8px] font-black uppercase tracking-wider text-[var(--text-secondary)]">
                      <th className="px-3 py-2">Section</th>
                      <th className="px-3 py-2">Weight (%)</th>
                      <th className="px-3 py-2">Scored Fields</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-primary)]">
                    {sections.map((sec) => {
                      const sectionFields = fields.filter((f) => f.section_id === sec.id);
                      const ratingFields = sectionFields.filter((f) => f.field_type === "rating");
                      const sectionKey = sec.title;
                      const currentWeight = (scoringConfig.sections?.[sectionKey]?.weight) || 0;
                      const currentLabels = scoringConfig.sections?.[sectionKey]?.field_labels || [];
                      return (
                        <tr key={sec.title} className="text-[10px] font-bold text-[var(--text-primary)]">
                          <td className="px-3 py-2">{sec.title}</td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={currentWeight}
                              onChange={(e) => setScoringConfig({
                                ...scoringConfig,
                                sections: { ...scoringConfig.sections, [sectionKey]: { ...scoringConfig.sections?.[sectionKey], weight: parseInt(e.target.value) || 0, field_labels: scoringConfig.sections?.[sectionKey]?.field_labels || ratingFields.map((f) => f.label) } },
                              })}
                              className="w-16 px-2 py-1 rounded bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1">
                              {ratingFields.map((f) => {
                                const isScored = currentLabels.includes(f.label);
                                return (
                                  <button
                                    key={f.label}
                                    onClick={() => {
                                      const next = isScored ? currentLabels.filter((l) => l !== f.label) : [...currentLabels, f.label];
                                      setScoringConfig({
                                        ...scoringConfig,
                                        sections: { ...scoringConfig.sections, [sectionKey]: { ...scoringConfig.sections?.[sectionKey], weight: currentWeight, field_labels: next } },
                                      });
                                    }}
                                    className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase transition-all ${isScored ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30" : "bg-tertiary text-[var(--text-secondary)] border border-[var(--border-primary)]"}`}
                                  >
                                    {f.label.substring(0, 30)}{f.label.length > 30 ? "..." : ""}
                                  </button>
                                );
                              })}
                              {ratingFields.length === 0 && <span className="text-[8px] text-[var(--text-secondary)] italic">No rating fields in this section</span>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Rankings */}
              <h4 className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)] pt-2">Ranking Thresholds</h4>
              <div className="space-y-2">
                {(scoringConfig.rankings || []).map((rank, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                    <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: rank.color || "#64748b" }} />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={rank.min}
                      onChange={(e) => {
                        const next = [...(scoringConfig.rankings || [])];
                        next[idx] = { ...next[idx], min: parseInt(e.target.value) || 0 };
                        setScoringConfig({ ...scoringConfig, rankings: next });
                      }}
                      className="w-14 px-2 py-1 rounded bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none text-center"
                      placeholder="Min"
                    />
                    <span className="text-[var(--text-secondary)] text-[9px]">–</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={rank.max}
                      onChange={(e) => {
                        const next = [...(scoringConfig.rankings || [])];
                        next[idx] = { ...next[idx], max: parseInt(e.target.value) || 0 };
                        setScoringConfig({ ...scoringConfig, rankings: next });
                      }}
                      className="w-14 px-2 py-1 rounded bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none text-center"
                      placeholder="Max"
                    />
                    <input
                      type="text"
                      value={rank.label}
                      onChange={(e) => {
                        const next = [...(scoringConfig.rankings || [])];
                        next[idx] = { ...next[idx], label: e.target.value };
                        setScoringConfig({ ...scoringConfig, rankings: next });
                      }}
                      className="flex-1 px-2 py-1 rounded bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
                      placeholder="Label"
                    />
                    <input
                      type="text"
                      value={rank.color || ""}
                      onChange={(e) => {
                        const next = [...(scoringConfig.rankings || [])];
                        next[idx] = { ...next[idx], color: e.target.value };
                        setScoringConfig({ ...scoringConfig, rankings: next });
                      }}
                      className="w-20 px-2 py-1 rounded bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none font-mono"
                      placeholder="#color"
                    />
                    <button onClick={() => {
                      const next = [...(scoringConfig.rankings || [])];
                      next.splice(idx, 1);
                      setScoringConfig({ ...scoringConfig, rankings: next });
                    }} className="text-rose-500 hover:text-rose-400 shrink-0"><MinusCircle className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
                <button onClick={() => setScoringConfig({
                  ...scoringConfig,
                  rankings: [...(scoringConfig.rankings || []), { min: 0, max: 100, label: "New Tier", color: "#64748b" }],
                })} className="flex items-center gap-1 text-[9px] font-black text-indigo-400 hover:text-indigo-300 uppercase"><PlusCircle className="w-3 h-3" /> Add Ranking Tier</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Workflow Configuration Panel */}
      {showWorkflow && (
        <div className="px-6 py-4 bg-secondary border-b border-[var(--border-primary)] space-y-4 shrink-0 max-h-[50vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GitBranch className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">Workflow Configuration</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={saving}
                onClick={async () => {
                  if (!editingForm) return;
                  setSaving(true);
                  try {
                    await fetch("/api/platform/forms", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: editingForm.id, settings: { ...(editingForm.settings || {}), workflow: workflowConfig, automation: automationConfig || DEFAULT_AUTOMATION } }),
                    });
                    notify("Workflow saved");
                  } catch (_) {}
                  setSaving(false);
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-[9px] font-black uppercase hover:bg-amber-600 transition-all"
              >
                Save Workflow
              </button>
              <button onClick={() => setShowWorkflow(false)}><X className="w-4 h-4 text-[var(--text-secondary)]" /></button>
            </div>
          </div>

          <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
            Customize the decision labels and status names for this form's review workflow. Leave empty to use defaults (Approve / Reject / Request Revision).
          </p>

          {(() => {
            const wf = workflowConfig || { decisions: [], statusLabels: {} };
            const defaults = [
              { id: "approved", defaultLabel: "Approve", defaultColor: "emerald" },
              { id: "rejected", defaultLabel: "Reject", defaultColor: "rose" },
              { id: "revision_requested", defaultLabel: "Request Revision", defaultColor: "amber" },
            ];
            const decisions = defaults.map(d => {
              const existing = (wf.decisions || []).find(x => x.id === d.id);
              return existing || { id: d.id, label: d.defaultLabel, color: d.defaultColor, icon: "CheckCircle2" };
            });

            return (
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">Decision Buttons</h4>
                <div className="grid grid-cols-3 gap-3">
                  {decisions.map((d, i) => (
                    <div key={d.id} className="space-y-2 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                      <label className="text-[8px] font-black uppercase text-[var(--text-secondary)]">
                        {d.id === "approved" ? "Positive" : d.id === "rejected" ? "Negative" : "Needs Work"}
                      </label>
                      <input
                        value={d.label}
                        onChange={e => {
                          const next = [...decisions];
                          next[i] = { ...next[i], label: e.target.value };
                          setWorkflowConfig({ ...wf, decisions: next });
                        }}
                        placeholder={d.defaultLabel}
                        className="w-full px-2 py-1.5 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
                      />
                    </div>
                  ))}
                </div>

                <h4 className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)] pt-2">Status Labels</h4>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "submitted", defaultLabel: "Submitted" },
                    { id: "approved", defaultLabel: "Approved" },
                    { id: "rejected", defaultLabel: "Rejected" },
                    { id: "revision_requested", defaultLabel: "Revision" },
                    { id: "draft", defaultLabel: "Draft" },
                  ].map(st => {
                    const val = (wf.statusLabels || {})[st.id] || "";
                    return (
                      <div key={st.id} className="space-y-2 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                        <label className="text-[8px] font-black uppercase text-[var(--text-secondary)]">{st.defaultLabel} →</label>
                        <input
                          value={val}
                          onChange={e => setWorkflowConfig({ ...wf, statusLabels: { ...(wf.statusLabels || {}), [st.id]: e.target.value } })}
                          placeholder={st.defaultLabel}
                          className="w-full px-2 py-1.5 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
                        />
                      </div>
                    );
                  })}
                </div>

                <h4 className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)] pt-4">Automation Actions</h4>
                <p className="text-[9px] text-[var(--text-secondary)] mb-3">What happens automatically after form events. Defaults to full Program Application workflow.</p>

                {(() => {
                  const autoCfg = automationConfig || DEFAULT_AUTOMATION;
                  const update = (path, val) => {
                    const next = JSON.parse(JSON.stringify(autoCfg));
                    const keys = path.split(".");
                    let obj = next;
                    for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
                    obj[keys[keys.length - 1]] = val;
                    setAutomationConfig(next);
                  };
                  const Toggle = ({ path, label, desc }) => {
                    const keys = path.split(".");
                    let val = autoCfg;
                    for (const k of keys) val = val?.[k];
                    return (
                      <label className="flex items-center gap-3 p-2 rounded-lg bg-tertiary/50 cursor-pointer hover:bg-amber-500/5 transition-all">
                        <input type="checkbox" checked={!!val} onChange={(e) => update(path, e.target.checked)} className="w-3.5 h-3.5 rounded accent-amber-500 shrink-0" />
                        <div><p className="text-[9px] font-bold text-[var(--text-primary)]">{label}</p>{desc && <p className="text-[7px] text-[var(--text-secondary)]">{desc}</p>}</div>
                      </label>
                    );
                  };
                  return (
                    <div className="space-y-2 pl-1">
                      <p className="text-[8px] font-black text-amber-400 uppercase">On Submit</p>
                      <Toggle path="on_submit.send_acknowledgement" label="Send acknowledgement email" desc="Confirmation on form submission" />
                      <p className="text-[8px] font-black text-emerald-400 uppercase pt-1">On Approval</p>
                      <Toggle path="on_approve.send_approval_email" label="Send approval email" desc="Notify applicant of acceptance" />
                      <Toggle path="on_approve.create_platform_user" label="Create platform user" desc="Generate user account" />
                      <Toggle path="on_approve.send_activation_email" label="Send activation email" desc="Password setup link" />
                      <Toggle path="on_approve.enroll_in_program" label="Enroll in program" desc="Add to linked program" />
                      <Toggle path="on_approve.assign_to_group" label="Assign to group" desc="Add to form run group" />
                      <p className="text-[7px] text-[var(--text-secondary)] italic mt-1">Tip: The group defines the member's role. Configure this in the group settings.</p>
                      <p className="text-[8px] font-black text-emerald-400 uppercase pt-2">Auto-Approval</p>
                      <Toggle path="auto_approve" label="Auto-approve by score" desc="Approve applicants whose AI score meets the cutoff" />
                      <div className="flex items-center gap-3 pt-1">
                        <label className="text-[9px] font-bold text-[var(--text-secondary)] uppercase">Cutoff Score</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={autoCfg.auto_approve_cutoff ?? 80}
                          onChange={(e) => update("auto_approve_cutoff", e.target.value === "" ? null : parseFloat(e.target.value))}
                          className="w-24 px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-emerald-500"
                        />
                        <span className="text-[10px] font-black text-[var(--text-secondary)]">%</span>
                      </div>
                      <p className="text-[7px] text-[var(--text-secondary)] italic mt-1">Applicants scoring ≥ cutoff are automatically approved and sent through group assignment + activation. Below-cutoff applicants remain for manual review.</p>
                      <p className="text-[8px] font-black text-rose-400 uppercase pt-1">On Rejection</p>
                      <Toggle path="on_reject.send_rejection_email" label="Send rejection email" desc="Notify applicant of decision" />
                    </div>
                  );
                })()}

                <h4 className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)] pt-4">Success Message</h4>
                <p className="text-[9px] text-[var(--text-secondary)] mb-3">Shown to the respondent after successful form submission. Supports HTML and placeholders like {"{{name}}"}, {"{{form_name}}"}, {"{{submitter_name}}"}, {"{{group_name}}"}.</p>
                <textarea
                  value={automationConfig?.success_message || DEFAULT_AUTOMATION.success_message || ""}
                  onChange={(e) => setAutomationConfig({ ...(automationConfig || DEFAULT_AUTOMATION), success_message: e.target.value })}
                  rows={4}
                  placeholder="<p>Thank you <strong>{{submitter_name}}</strong>!</p><p>Your response to <strong>{{form_name}}</strong> has been recorded. Our team will review your submission.</p>"
                  className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-medium text-[var(--text-primary)] outline-none focus:border-amber-500 resize-y font-mono"
                />
                <div className="space-y-1">
                  <label className="text-[7px] font-black uppercase text-[var(--text-secondary)]">Redirect After Submit (optional URL)</label>
                  <input
                    type="url"
                    value={automationConfig?.redirect_after_submit || ""}
                    onChange={(e) => setAutomationConfig({ ...(automationConfig || DEFAULT_AUTOMATION), redirect_after_submit: e.target.value })}
                    placeholder="https://example.com/thank-you"
                    className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-amber-500"
                  />
                </div>
                <p className="text-[7px] text-[var(--text-secondary)] italic">Available placeholders: {"{{submitter_name}}"}, {"{{submitter_email}}"}, {"{{form_name}}"}, {"{{group_name}}"}, {"{{organization}}"}, plus any form field label (e.g. {"{{full_name}}"}, {"{{email_address}}"}).</p>

                <button
                  onClick={() => setWorkflowConfig(null)}
                  className="text-[9px] font-bold text-rose-500 hover:text-rose-400 uppercase"
                >
                  Reset to defaults
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {/* Templates Panel */}
      {showTemplates && (
        <div className="px-6 py-4 bg-secondary border-b border-[var(--border-primary)] space-y-4 shrink-0 max-h-[50vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">Email Templates</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={saving}
                onClick={async () => {
                  if (!editingForm) return;
                  setSaving(true);
                  try {
                    const currentSettings = editingForm.settings || {};
                    const currentAuto = currentSettings.automation || DEFAULT_AUTOMATION;
                    await fetch("/api/platform/forms", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: editingForm.id, settings: { ...currentSettings, automation: { ...currentAuto, templates: templateConfig } } }),
                    });
                    notify("Templates saved");
                  } catch (_) {}
                  setSaving(false);
                }}
                className="px-3 py-1.5 rounded-lg bg-cyan-500 text-white text-[9px] font-black uppercase hover:bg-cyan-600 transition-all"
              >
                Save Templates
              </button>
              <button onClick={() => setShowTemplates(false)}><X className="w-4 h-4 text-[var(--text-secondary)]" /></button>
            </div>
          </div>

          <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
            Customize the email messages sent to applicants. Use <code className="px-1 bg-tertiary rounded text-[var(--brand-orange)]">{`{{variable}}`}</code> placeholders.
          </p>

          {(() => {
            const tmpl = templateConfig || {};
            const update = (key, field, val) => {
              const next = JSON.parse(JSON.stringify(tmpl));
              if (!next[key]) next[key] = {};
              next[key][field] = val;
              setTemplateConfig(next);
            };

            // Ask the existing AI layer to write (or improve) a template,
            // then fill the subject/body fields — saving stays manual.
            const personalize = async (tKey, label) => {
              if (personalizing) return;
              setPersonalizing(tKey);
              try {
                const res = await fetch("/api/platform/ai/personalize-template", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    template_key: tKey,
                    form_name: editingForm?.name || "",
                    organization: "Future Studio",
                    existing_subject: tmpl[tKey]?.subject || "",
                    existing_body: tmpl[tKey]?.body || "",
                  }),
                });
                const data = await res.json();
                if (data.success) {
                  update(tKey, "subject", data.subject);
                  update(tKey, "body", data.body);
                  notify(`${label} personalized with AI`);
                } else {
                  notify(t((data.error || "AI personalization failed") || "") || (data.error || "AI personalization failed"));
                }
              } catch (_) {
                notify("AI personalization failed — network error");
              }
              setPersonalizing(null);
            };

            const TemplateEditor = ({ label, icon: Icon, tKey, desc, defaultSubject, defaultBody, vars, onPersonalize, personalizingKey }) => (
              <div className="space-y-2 p-4 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-3.5 h-3.5 text-cyan-400" />
                  <p className="text-[10px] font-black uppercase text-[var(--text-primary)]">{label}</p>
                  <button
                    type="button"
                    disabled={personalizingKey === tKey}
                    onClick={() => onPersonalize(tKey, label)}
                    className="ml-auto px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[7px] font-black uppercase hover:bg-indigo-500/20 disabled:opacity-40 transition-all flex items-center gap-1"
                  >
                    <Sparkles className="w-2.5 h-2.5" />
                    {personalizingKey === tKey ? "Writing..." : "Personalize with AI"}
                  </button>
                </div>
                <p className="text-[8px] text-[var(--text-secondary)]">{desc}</p>
                <div className="space-y-1">
                  <label className="text-[7px] font-black uppercase text-[var(--text-secondary)]">Subject</label>
                  <input
                    value={tmpl[tKey]?.subject || ""}
                    onChange={(e) => update(tKey, "subject", e.target.value)}
                    placeholder={defaultSubject}
                    className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[7px] font-black uppercase text-[var(--text-secondary)]">Body (HTML)</label>
                  <textarea
                    value={tmpl[tKey]?.body || ""}
                    onChange={(e) => update(tKey, "body", e.target.value)}
                    rows={4}
                    placeholder={defaultBody}
                    className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-medium text-[var(--text-primary)] outline-none focus:border-cyan-500 resize-y font-mono"
                  />
                </div>
                {vars && (
                  <p className="text-[7px] text-[var(--text-secondary)] italic">Variables: {vars.join(", ")}</p>
                )}
              </div>
            );

            return (
              <div className="space-y-3">
                <TemplateEditor
                  label="Submission Confirmation" icon={Send}
                  tKey="acknowledgement"
                  desc="Sent immediately after the applicant submits the form."
                  defaultSubject="Thank you for your submission — {{form_name}}"
                  defaultBody='<p>Hi {{name}},</p><p>We received your submission for <strong>{{form_name}}</strong>.</p><p>Our team will review it soon.</p>'
                  vars={["name", "form_name", "organization"]}
                  onPersonalize={personalize}
                  personalizingKey={personalizing}
                />
                <TemplateEditor
                  label="Approval Message" icon={CheckCircle2}
                  tKey="approval"
                  desc="Sent when the reviewer approves the submission."
                  defaultSubject="Your {{form_name}} application has been approved"
                  defaultBody='<p>Congratulations {{name}}!</p><p>Your application for <strong>{{form_name}}</strong> has been approved.</p><p>We are excited to welcome you.</p>'
                  vars={["name", "form_name", "program_name", "group_name", "organization"]}
                  onPersonalize={personalize}
                  personalizingKey={personalizing}
                />
                <TemplateEditor
                  label="Activation Email" icon={Key}
                  tKey="activation"
                  desc="Sent with the password setup link when a platform account is created."
                  defaultSubject="Welcome to {{organization}} — Set Your Password"
                  defaultBody='<p>Hello {{name}},</p><p>Your account has been created on <strong>{{organization}}</strong>.</p><p>Click the button below to set your password.</p>'
                  vars={["name", "organization", "activation_link"]}
                  onPersonalize={personalize}
                  personalizingKey={personalizing}
                />
                <TemplateEditor
                  label="Rejection Message" icon={XCircle}
                  tKey="rejection"
                  desc="Sent when the application is not accepted."
                  defaultSubject="Update on your {{form_name}} application"
                  defaultBody='<p>Dear {{name}},</p><p>Thank you for your interest in <strong>{{form_name}}</strong>.</p><p>Unfortunately, you were not selected this time.</p><p>We encourage you to apply again.</p>'
                  vars={["name", "form_name", "organization"]}
                  onPersonalize={personalize}
                  personalizingKey={personalizing}
                />
              </div>
            );
          })()}
        </div>
      )}

      {/* AI Evaluation Panel */}
      {showAiEval && (
        <div className="px-6 py-4 bg-secondary border-b border-[var(--border-primary)] space-y-4 shrink-0 max-h-[50vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">AI Evaluation</h3>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={async () => {
                  setSaving(true);
                  try {
                    const res = await fetch("/api/platform/ai/evaluation-config", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ form_id: editingForm.id, framework: aiEvalFramework })
                    });
                    if (res.ok) notify("Evaluation framework saved");
                    else notify("Failed to save framework");
                  } catch (e) {}
                  setSaving(false);
                }}
                disabled={saving}
                className="px-3 py-1.5 rounded-lg bg-purple-500 text-white text-[9px] font-black uppercase hover:bg-purple-600 transition-all"
              >
                Save Framework
              </button>
              <button onClick={() => setShowAiEval(false)}><X className="w-4 h-4 text-[var(--text-secondary)]" /></button>
            </div>
          </div>

          {/* Enable AI Evaluation toggle */}
          <label className="flex items-center gap-3 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)] cursor-pointer">
            <input
              type="checkbox"
              checked={!!(editingForm?.settings?.ai_evaluation)}
              onChange={async (e) => {
                const enabled = e.target.checked;
                const updatedSettings = { ...(editingForm?.settings || {}), ai_evaluation: enabled };
                setEditingForm(prev => ({ ...prev, settings: updatedSettings }));
                try {
                  await fetch("/api/platform/forms", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingForm.id, settings: updatedSettings }) });
                  notify(enabled ? "AI evaluation enabled" : "AI evaluation disabled");
                } catch (_) {}
              }}
              className="w-4 h-4 rounded accent-purple-500"
            />
            <div>
              <p className="text-[10px] font-black text-[var(--text-primary)] uppercase">Enable AI Evaluation</p>
              <p className="text-[8px] text-[var(--text-secondary)]">Automatically evaluate submissions using the framework below</p>
            </div>
          </label>

          {aiEvalFramework ? (
            <>
              {/* Weight validation */}
              {(() => {
                const total = (aiEvalFramework.dimensions || []).reduce((s, d) => s + (parseInt(d.weight) || 0), 0);
                return total !== 100 ? (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[9px] font-bold text-amber-400">
                    ⚠️ Weights total {total}% — must equal 100% before publishing
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[9px] font-bold text-emerald-400">
                    ✓ Weights total 100% — ready to save
                  </div>
                );
              })()}

              {/* Editable dimensions table */}
              <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)]">
                <table className="w-full text-left">
                  <thead className="bg-tertiary">
                    <tr className="text-[8px] font-black uppercase tracking-wider text-[var(--text-secondary)]">
                      <th className="px-2 py-2">Dimension</th>
                      <th className="px-2 py-2 w-16">Weight</th>
                      <th className="px-2 py-2">Criteria</th>
                      <th className="px-2 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-primary)]">
                    {(aiEvalFramework.dimensions || []).map((d, i) => (
                      <tr key={i} className="text-[10px]">
                        <td className="px-2 py-1.5">
                          <input
                            value={d.name}
                            onChange={(e) => {
                              const dims = [...aiEvalFramework.dimensions];
                              dims[i] = { ...dims[i], name: e.target.value };
                              setAiEvalFramework({ ...aiEvalFramework, dimensions: dims });
                            }}
                            className="w-full px-2 py-1 rounded bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={d.weight}
                            onChange={(e) => {
                              const dims = [...aiEvalFramework.dimensions];
                              dims[i] = { ...dims[i], weight: parseInt(e.target.value) || 0 };
                              setAiEvalFramework({ ...aiEvalFramework, dimensions: dims });
                            }}
                            className="w-full px-1 py-1 rounded bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            value={(d.criteria || []).join(", ")}
                            onChange={(e) => {
                              const dims = [...aiEvalFramework.dimensions];
                              dims[i] = { ...dims[i], criteria: e.target.value.split(",").map(c => c.trim()).filter(Boolean) };
                              setAiEvalFramework({ ...aiEvalFramework, dimensions: dims });
                            }}
                            className="w-full px-2 py-1 rounded bg-primary border border-[var(--border-primary)] text-[10px] text-[var(--text-primary)] outline-none"
                            placeholder="criterion 1, criterion 2"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <button
                            onClick={() => {
                              const dims = [...aiEvalFramework.dimensions];
                              dims.splice(i, 1);
                              setAiEvalFramework({ ...aiEvalFramework, dimensions: dims });
                            }}
                            className="text-rose-500 hover:text-rose-400"
                          ><X className="w-3 h-3" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setAiEvalFramework({
                      ...aiEvalFramework,
                      dimensions: [...(aiEvalFramework.dimensions || []), { name: "New Dimension", weight: 0, criteria: [], ai_prompt: "" }],
                    });
                  }}
                  className="text-[9px] font-black text-indigo-400 hover:text-indigo-300 uppercase"
                >
                  + Add Dimension
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    const total = (aiEvalFramework.dimensions || []).reduce((s, d) => s + (parseInt(d.weight) || 0), 0);
                    if (total !== 100) { notify("Weights must total 100%"); return; }
                    if (!editingForm?.id) { notify("No form selected"); return; }
                    setAiEvalLoading(true);
                    try {
                      const payload = { form_id: Number(editingForm.id), framework: aiEvalFramework, source_document: aiEvalText?.substring(0, 500) || null };
                      const res = await fetch("/api/platform/ai/evaluation-config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                      if (res.ok) notify("Framework saved");
                      else { const err = await res.json(); notify(t((err.error || "Save failed") || "") || (err.error || "Save failed")); }
                    } catch (_) { notify("Save failed"); }
                    setAiEvalLoading(false);
                  }}
                  disabled={aiEvalLoading}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-purple-500 text-white text-[10px] font-black uppercase hover:bg-purple-600 disabled:opacity-50 transition-all"
                >
                  Save Framework
                </button>
                <button
                  onClick={async () => {
                    if (!confirm("Remove evaluation framework?")) return;
                    await fetch(`/api/platform/ai/evaluation-config?form_id=${editingForm?.id}`, { method: "DELETE" });
                    setAiEvalFramework(null);
                    notify("Evaluation framework removed");
                  }}
                  className="px-4 py-2.5 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[9px] font-black uppercase text-rose-500 hover:text-rose-400"
                >
                  Remove
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                Upload an evaluation rubric, assessment guide, or selection policy. AI will generate evaluation dimensions, criteria, weights, and evaluation prompts.
              </p>
              <textarea
                value={aiEvalText}
                onChange={(e) => setAiEvalText(e.target.value)}
                rows={6}
                placeholder="Paste your evaluation rubric, assessment guide, or selection criteria here..."
                className="w-full rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--brand-orange)] resize-none"
              />
              <button
                onClick={async () => {
                  if (!aiEvalText.trim()) return;
                  setAiEvalLoading(true);
                  try {
                    const res = await fetch("/api/platform/ai/generate-framework", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: aiEvalText }) });
                    const data = await res.json();
                    if (data.success && data.framework) {
                      setAiEvalFramework(data.framework);
                      // Auto-save framework with safe form_id
                      if (editingForm?.id) {
                        await fetch("/api/platform/ai/evaluation-config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ form_id: Number(editingForm.id), framework: data.framework, source_document: aiEvalText.substring(0, 500) }) });
                      }
                      notify(`Framework generated — ${data.framework.dimensions?.length || 0} dimensions`);
                      setAiEvalText("");
                    } else {
                      notify(t((data.error || "Generation failed") || "") || (data.error || "Generation failed"));
                    }
                  } catch (_) { notify("AI generation failed"); }
                  setAiEvalLoading(false);
                }}
                disabled={aiEvalLoading || !aiEvalText.trim()}
                className="w-full px-4 py-3 rounded-xl bg-purple-500 text-white text-[10px] font-black uppercase hover:bg-purple-600 disabled:opacity-50 transition-all"
              >
                {aiEvalLoading ? "Analyzing..." : "Generate Evaluation Framework"}
              </button>
            </>
          )}
        </div>
      )}

      {/* Builder body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Field palette (left) */}
        {!previewMode && (
          <div className="w-56 shrink-0 bg-secondary border-r border-[var(--border-primary)] p-3 space-y-3 overflow-y-auto">
            <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-50">Add Field</p>
            <button onClick={addSection} className="w-full p-2 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[9px] font-black uppercase text-[var(--text-secondary)] hover:text-[var(--text-primary)]">+ Add Section</button>
            {FIELD_TYPES.map((t) => (
              <button key={t.value} onClick={() => addField(t.value)} className="w-full flex items-center gap-2 p-2 rounded-lg text-left text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary transition-all">
                <t.icon className="w-3.5 h-3.5" />{t.label}
              </button>
            ))}
            {/* Per-section quick-add */}
            {sections.map((sec) => (
              <div key={sec.id} className="pt-2 border-t border-[var(--border-primary)]">
                <button
                  onClick={() => setActiveSectionId(sec.id)}
                  className={`w-full text-left p-1 rounded text-[7px] font-black uppercase mb-1 transition-all ${activeSectionId === sec.id ? 'text-[var(--brand-orange)] bg-[var(--brand-orange)]/10' : 'text-[var(--text-secondary)] opacity-50'}`}
                >
                  Into: {sec.title} {activeSectionId === sec.id && '✓'}
                </button>
                {FIELD_TYPES.slice(0, 6).map((t) => (
                  <button key={t.value} onClick={() => addField(t.value, sec.id)} className="w-full flex items-center gap-2 p-1.5 rounded text-[9px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary">
                    <t.icon className="w-3 h-3" />{t.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Form canvas (right) */}
        <div className="flex-1 bg-primary overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto space-y-4">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-2xl font-black uppercase tracking-tight text-[var(--text-primary)]">{editingForm?.name}</h1>
              {editingForm?.description && <p className="text-[11px] text-[var(--text-secondary)] mt-1">{editingForm.description}</p>}
            </div>

            {/* Sections */}
            {sections.map((sec, sIdx) => (
              <div key={sIdx} className="space-y-3">
                {!previewMode ? (
                  <div className="flex items-center gap-2 group">
                    <input value={sec.title} onChange={(e) => updateSection(sIdx, { title: e.target.value })} className="text-sm font-black uppercase text-[var(--text-primary)] bg-transparent outline-none border-b-2 border-transparent focus:border-[var(--brand-orange)]" />
                    <button onClick={() => { if (sIdx > 0) { const next = [...sections]; [next[sIdx], next[sIdx-1]] = [next[sIdx-1], next[sIdx]]; setSections(next.map((s, i) => ({ ...s, sort_order: i }))); } }} disabled={sIdx === 0} className="opacity-0 group-hover:opacity-100 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-20"><ChevronUp className="w-3 h-3" /></button>
                    <button onClick={() => { if (sIdx < sections.length - 1) { const next = [...sections]; [next[sIdx], next[sIdx+1]] = [next[sIdx+1], next[sIdx]]; setSections(next.map((s, i) => ({ ...s, sort_order: i }))); } }} disabled={sIdx === sections.length - 1} className="opacity-0 group-hover:opacity-100 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-20"><ChevronDown className="w-3 h-3" /></button>
                    <button onClick={() => removeSection(sIdx)} className="opacity-0 group-hover:opacity-100 text-rose-500"><Trash2 className="w-3 h-3" /></button>
                  </div>
                ) : (
                  <h2 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)] pb-2 border-b border-[var(--border-primary)]">{sec.title}</h2>
                )}
                {sec.description && !previewMode && (
                  <textarea value={sec.description} onChange={(e) => updateSection(sIdx, { description: e.target.value })} className="w-full text-[10px] text-[var(--text-secondary)] bg-transparent outline-none resize-none" rows={1} />
                )}
                <div className="space-y-2">
                  {formFieldsForSection(sections[sIdx]?.id).map((fld) => renderFieldPreview(fld))}
                </div>
              </div>
            ))}

            {/* Orphan Fields (legacy — should be empty with new architecture) */}
            {orphanFields.length > 0 && (
              <div className="space-y-3 pt-4 border-t-2 border-dashed border-amber-500/30">
                <p className="text-[9px] font-black uppercase text-amber-500/70 tracking-wider">
                  Unassigned ({orphanFields.length}) — click field to assign a section
                </p>
                <div className="space-y-2">
                  {orphanFields.map((fld) => <div key={fld._tmpId}>{renderFieldPreview(fld)}</div>)}
                </div>
              </div>
            )}

            {fields.length === 0 && <div className="py-16 text-center"><FileText className="w-12 h-12 mx-auto text-[var(--text-secondary)] opacity-20" /><p className="text-[11px] text-[var(--text-secondary)] mt-3 font-bold">Add fields from the left palette</p><p className="text-[9px] text-[var(--text-secondary)] mt-1 opacity-50">Drag, reorder, and configure each field</p></div>}
          </div>
        </div>
      </div>

      {/* Republish Confirmation Modal */}
      {showRepublishConfirm && (
        <div className="fixed inset-0 z-[500] bg-black/50 flex items-center justify-center p-6" onClick={() => setShowRepublishConfirm(false)}>
          <div className="card w-full max-w-md space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase text-[var(--text-primary)]">This form is live</h3>
                <p className="text-[10px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                  <strong className="text-[var(--text-primary)]">&quot;{editingForm?.name}&quot;</strong> is currently published and accepting submissions.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => { setShowRepublishConfirm(false); saveFields(true); }}
                className="w-full px-4 py-3 rounded-xl bg-indigo-500 text-white text-[10px] font-black uppercase hover:bg-indigo-600 transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5" /> Save &amp; Republish — Update the live form
              </button>
              <button
                onClick={() => { setShowRepublishConfirm(false); saveFields("draft"); }}
                className="w-full px-4 py-3 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[10px] font-black uppercase text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
              >
                Save Draft Only — Don't change the live version
              </button>
              <button
                onClick={() => setShowRepublishConfirm(false)}
                className="w-full px-4 py-3 text-[9px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] uppercase"
              >
                Cancel
              </button>
            </div>
            <p className="text-[8px] text-[var(--text-secondary)] text-center opacity-50">
              Republishing creates a new version snapshot. Existing runs using older versions are unaffected.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import NextLink from "next/link";
import {
  FileText, Plus, Search, Loader2, Edit3, Archive, Copy,
  Eye, Grid3X3, X, ChevronUp, ChevronDown, Trash2,
  CheckSquare, Circle, List, Hash, Mail, PhoneIcon, Calendar,
  Clock, Star, FileUp, Link, DollarSign, PenTool, AlignLeft,
  Type, Upload, BarChart3, PlusCircle, MinusCircle, RotateCcw, AlertTriangle, Sparkles, CheckCircle2, Play, FolderKanban, GitBranch, Send, Key, LogIn, XCircle,
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

// i18n key suffixes for display-only labels — `value` attributes and stored values stay as-is
const FIELD_TYPE_KEYS = {
  text: "fieldTypeShortText",
  textarea: "fieldTypeLongText",
  number: "fieldTypeNumber",
  email: "fieldTypeEmail",
  phone: "fieldTypePhone",
  date: "fieldTypeDate",
  time: "fieldTypeTime",
  select: "fieldTypeDropdown",
  radio: "fieldTypeRadio",
  checkbox: "fieldTypeCheckbox",
  multiselect: "fieldTypeMultiSelect",
  file: "fieldTypeFileUpload",
  url: "fieldTypeUrl",
  currency: "fieldTypeCurrency",
  rating: "fieldTypeRating",
  richtext: "fieldTypeRichText",
};

const FORM_STATUS_KEYS = {
  published: "statusPublished",
  draft: "statusDraft",
  archived: "statusArchived",
};

const DECISION_DEFAULT_KEYS = {
  approved: "decisionDefaultApprove",
  rejected: "decisionDefaultReject",
  revision_requested: "decisionDefaultRequestRevision",
};

const WORKFLOW_STATUS_LABEL_KEYS = {
  submitted: "statusDefaultSubmitted",
  approved: "statusDefaultApproved",
  rejected: "statusDefaultRejected",
  revision_requested: "statusDefaultRevision",
  draft: "statusDefaultDraft",
};

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
        notify(t("platformMisc.forms.notifyFormCreated"));
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
        notify(t("platformMisc.forms.notifyPublishedVersion", { version: data.version }));
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
        label: t("platformMisc.forms." + (FIELD_TYPE_KEYS[fieldType] || "")) || typeInfo.label,
        placeholder: "",
        help_text: "",
        required: false,
        options: fieldType === "rating"
          ? [{ label: "1", value: "1" }, { label: "2", value: "2" }, { label: "3", value: "3" }, { label: "4", value: "4" }, { label: "5", value: "5" }]
          : ["select", "radio", "checkbox", "multiselect"].includes(fieldType)
            ? [{ label: t("platformMisc.forms.optionDefault", { n: 1 }), value: "option-1" }]
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
      return { ...f, options: [...f.options, { label: t("platformMisc.forms.optionDefault", { n: f.options.length + 1 }), value: `option-${f.options.length + 1}` }] };
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
          notify(t("platformMisc.forms.notifyFormRepublished"));
        } else {
          notify(t("platformMisc.forms.notifyFormSaved"));
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
      } else notify(t((data.error || t("platformMisc.forms.saveFailed")) || "") || (data.error || t("platformMisc.forms.saveFailed")));
    } catch (_) {}
    setSaving(false);
  };

  const handleDuplicate = async (form) => {
    if (!confirm(t("platformMisc.forms.confirmDuplicate", { name: form.name }))) return;
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
        notify(t("platformMisc.forms.notifyFormDuplicated"));
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
      notify(action === "archive" ? t("platformMisc.forms.notifyFormArchived") : t("platformMisc.forms.notifyFormRestored"));
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
                {fld.label || t("platformMisc.forms.untitled")}
                {fld.required && <span className="text-rose-500 ml-1">*</span>}
              </p>
              <p className="text-[8px] text-[var(--text-secondary)] uppercase tracking-wider">
                {FIELD_TYPE_KEYS[fld.field_type] ? t("platformMisc.forms." + FIELD_TYPE_KEYS[fld.field_type]) : fld.field_type}
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
                <label className="text-[8px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.forms.fieldEditorLabel")}</label>
                <input
                  value={fld.label}
                  onChange={(e) => updateField(tmpId, { label: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.forms.fieldEditorType")}</label>
                <select
                  value={fld.field_type}
                  onChange={(e) => {
                    const newType = e.target.value;
                    const needsOptions = ["select", "radio", "checkbox", "multiselect", "rating"].includes(newType);
                    updateField(tmpId, { field_type: newType, options: needsOptions ? (newType === "rating" ? [{ label: "1", value: "1" }, { label: "2", value: "2" }, { label: "3", value: "3" }, { label: "4", value: "4" }, { label: "5", value: "5" }] : [{ label: t("platformMisc.forms.optionDefault", { n: 1 }), value: "option-1" }]) : null });
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
                >
                  {FIELD_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{t("platformMisc.forms." + FIELD_TYPE_KEYS[type.value])}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.forms.fieldEditorSection")}</label>
              <select
                value={fld.section_id || ""}
                onChange={(e) => updateField(tmpId, { section_id: e.target.value || null })}
                className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
              >
                <option value="">{t("platformMisc.forms.fieldSectionNone")}</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.forms.fieldEditorPlaceholder")}</label>
              <input
                value={fld.placeholder || ""}
                onChange={(e) => updateField(tmpId, { placeholder: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.forms.fieldEditorHelpText")}</label>
              <input
                value={fld.help_text || ""}
                onChange={(e) => updateField(tmpId, { help_text: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
              />
            </div>
            <label className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-primary)]">
              <input type="checkbox" checked={fld.required} onChange={(e) => updateField(tmpId, { required: e.target.checked })} />
              {t("platformMisc.forms.fieldRequired")}
            </label>

            {/* Options editor */}
            {fld.options && (
              <div className="space-y-2">
                <label className="text-[8px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.forms.fieldOptions")}</label>
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
                <button onClick={() => addOption(tmpId)} className="text-[9px] font-black text-[var(--brand-orange)] hover:underline">{t("platformMisc.forms.addOption")}</button>
              </div>
            )}

            {/* Validation Rules */}
            <div className="space-y-2 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
              <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-50">{t("platformMisc.forms.validationTitle")}</p>
              <div className="grid grid-cols-2 gap-2">
                {["text", "textarea"].includes(fld.field_type) && (
                  <>
                    <div className="space-y-1">
                      <label className="text-[7px] font-bold text-[var(--text-secondary)]">{t("platformMisc.forms.validationMinLength")}</label>
                      <input type="number" value={fld.validation?.minLength || ""} onChange={(e) => updateField(tmpId, { validation: { ...(fld.validation || {}), minLength: e.target.value ? parseInt(e.target.value) : undefined } })} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[9px] font-bold text-[var(--text-primary)] outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[7px] font-bold text-[var(--text-secondary)]">{t("platformMisc.forms.validationMaxLength")}</label>
                      <input type="number" value={fld.validation?.maxLength || ""} onChange={(e) => updateField(tmpId, { validation: { ...(fld.validation || {}), maxLength: e.target.value ? parseInt(e.target.value) : undefined } })} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[9px] font-bold text-[var(--text-primary)] outline-none" />
                    </div>
                  </>
                )}
                {["number", "currency"].includes(fld.field_type) && (
                  <>
                    <div className="space-y-1">
                      <label className="text-[7px] font-bold text-[var(--text-secondary)]">{t("platformMisc.forms.validationMinValue")}</label>
                      <input type="number" value={fld.validation?.min || ""} onChange={(e) => updateField(tmpId, { validation: { ...(fld.validation || {}), min: e.target.value ? parseFloat(e.target.value) : undefined } })} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[9px] font-bold text-[var(--text-primary)] outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[7px] font-bold text-[var(--text-secondary)]">{t("platformMisc.forms.validationMaxValue")}</label>
                      <input type="number" value={fld.validation?.max || ""} onChange={(e) => updateField(tmpId, { validation: { ...(fld.validation || {}), max: e.target.value ? parseFloat(e.target.value) : undefined } })} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[9px] font-bold text-[var(--text-primary)] outline-none" />
                    </div>
                  </>
                )}
                {["file"].includes(fld.field_type) && (
                  <>
                    <div className="space-y-1"><label className="text-[7px] font-bold text-[var(--text-secondary)]">{t("platformMisc.forms.validationMaxSizeMb")}</label><input type="number" value={fld.validation?.maxSize || ""} onChange={(e) => updateField(tmpId, { validation: { ...(fld.validation || {}), maxSize: e.target.value ? parseInt(e.target.value) : undefined } })} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[9px] font-bold text-[var(--text-primary)] outline-none" /></div>
                    <div className="space-y-1"><label className="text-[7px] font-bold text-[var(--text-secondary)]">{t("platformMisc.forms.validationAllowedTypes")}</label><input value={fld.validation?.acceptedFiles || ""} onChange={(e) => updateField(tmpId, { validation: { ...(fld.validation || {}), acceptedFiles: e.target.value } })} placeholder=".pdf,.jpg" className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[9px] font-bold text-[var(--text-primary)] outline-none" /></div>
                  </>
                )}
                <div className="col-span-2 space-y-1"><label className="text-[7px] font-bold text-[var(--text-secondary)]">{t("platformMisc.forms.validationErrorMessage")}</label><input value={fld.validation?.errorMessage || ""} onChange={(e) => updateField(tmpId, { validation: { ...(fld.validation || {}), errorMessage: e.target.value } })} placeholder={t("platformMisc.forms.validationErrorMessagePlaceholder")} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[9px] font-bold text-[var(--text-primary)] outline-none" /></div>
              </div>
            </div>

            {/* Conditional Logic */}
            <div className="space-y-2 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
              <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-50">{t("platformMisc.forms.conditionalLogicTitle")}</p>
              <div className="space-y-1"><label className="text-[7px] font-bold text-[var(--text-secondary)]">{t("platformMisc.forms.conditionalShowOnlyWhen")}</label>
                <select value={fld.conditional_logic?.field_id || ""} onChange={(e) => updateField(tmpId, { conditional_logic: { ...(fld.conditional_logic || {}), field_id: e.target.value || undefined } })} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[9px] font-bold text-[var(--text-primary)] outline-none">
                  <option value="">{t("platformMisc.forms.conditionalAlwaysVisible")}</option>
                  {fields.filter((f) => f !== fld).slice(0, 20).map((f) => <option key={f.label} value={f.label}>{f.label}</option>)}
                </select>
              </div>
              {fld.conditional_logic?.field_id && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1"><label className="text-[7px] font-bold text-[var(--text-secondary)]">{t("platformMisc.forms.conditionalOperator")}</label>
                    <select value={fld.conditional_logic?.operator || "equals"} onChange={(e) => updateField(tmpId, { conditional_logic: { ...fld.conditional_logic, operator: e.target.value } })} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[9px] font-bold text-[var(--text-primary)] outline-none">
                      <option value="equals">{t("platformMisc.forms.operatorEquals")}</option><option value="not_equals">{t("platformMisc.forms.operatorNotEquals")}</option><option value="contains">{t("platformMisc.forms.operatorContains")}</option><option value="greater_than">{t("platformMisc.forms.operatorGreaterThan")}</option><option value="less_than">{t("platformMisc.forms.operatorLessThan")}</option>
                    </select>
                  </div>
                  <div className="space-y-1"><label className="text-[7px] font-bold text-[var(--text-secondary)]">{t("platformMisc.forms.conditionalValue")}</label><input value={fld.conditional_logic?.value || ""} onChange={(e) => updateField(tmpId, { conditional_logic: { ...fld.conditional_logic, value: e.target.value } })} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[9px] font-bold text-[var(--text-primary)] outline-none" /></div>
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
            <h1 className="text-lg font-black uppercase tracking-tight text-[var(--text-primary)]">{t("platformMisc.forms.listTitle")}</h1>
            <p className="text-[10px] text-[var(--text-secondary)] mt-1">{t("platformMisc.forms.listSubtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <NextLink href="/platform/collections" className="flex items-center gap-2 px-4 py-2.5 bg-tertiary border border-[var(--border-primary)] text-[var(--text-secondary)] rounded-xl text-[10px] font-black uppercase hover:text-[var(--text-primary)] transition-all">
              <FolderKanban className="w-3.5 h-3.5" /> {t("platformMisc.forms.collectionsLink")}
            </NextLink>
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all">
              <Plus className="w-3.5 h-3.5" /> {t("platformMisc.forms.newForm")}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" />
            <input type="text" placeholder={t("platformMisc.forms.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none focus:border-[var(--brand-orange)]" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2.5 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]">
            <option value="all">{t("platformMisc.forms.statusAll")}</option>
            <option value="draft">{t("platformMisc.forms.statusDraft")}</option>
            <option value="published">{t("platformMisc.forms.statusPublished")}</option>
            <option value="archived">{t("platformMisc.forms.statusArchived")}</option>
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
                        <button onClick={() => handleArchive(f.id)} className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-rose-500 hover:bg-tertiary" title={t("platformMisc.forms.archiveTitle")}><Archive className="w-3 h-3" /></button>
                      ) : (
                        <button onClick={() => handleUnarchive(f.id)} className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-emerald-500 hover:bg-tertiary" title={t("platformMisc.forms.restoreTitle")}><RotateCcw className="w-3 h-3" /></button>
                      )}
                    </div>
                  </div>
                  <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">{f.name}</h3>
                  {f.description && <p className="text-[10px] text-[var(--text-secondary)] mt-1">{f.description}</p>}
                  {col && <p className="text-[9px] text-[var(--text-secondary)] mt-2 opacity-50">{t("platformMisc.forms.inCollection", { name: col.name })}</p>}
                  <div className="flex items-center gap-2 mt-3">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${f.status === "published" ? "text-emerald-500 bg-emerald-500/10" : f.status === "draft" ? "text-amber-500 bg-amber-500/10" : "text-rose-500 bg-rose-500/10"}`}>{FORM_STATUS_KEYS[f.status] ? t("platformMisc.forms." + FORM_STATUS_KEYS[f.status]) : f.status}</span>
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
                <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">{t("platformMisc.forms.newForm")}</h3>
                <button onClick={() => { setShowCreate(false); setCreateMode("manual"); setAiGenText(""); }}><X className="w-5 h-5" /></button>
              </div>

              {/* Mode Switcher */}
              <div className="flex gap-2 p-1 rounded-xl bg-tertiary">
                <button onClick={() => setCreateMode("manual")} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${createMode === "manual" ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)]"}`}>{t("platformMisc.forms.createManual")}</button>
                <button onClick={() => setCreateMode("ai")} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${createMode === "ai" ? "bg-indigo-500 text-white" : "text-[var(--text-secondary)]"}`}>{t("platformMisc.forms.createGenerateAi")}</button>
              </div>

              {createMode === "manual" ? (
                <>
                  <div className="space-y-4">
                    <div className="space-y-1"><label className="text-[9px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.forms.name")}</label><input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} className="w-full rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--brand-orange)]" placeholder={t("platformMisc.forms.namePlaceholder")} /></div>
                    <div className="space-y-1"><label className="text-[9px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.forms.description")}</label><textarea value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} rows={2} className="w-full rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--brand-orange)] resize-none" placeholder={t("platformMisc.forms.descriptionPlaceholder")} /></div>
                    <div className="space-y-1"><label className="text-[9px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.forms.collection")}</label>
                      <select value={createForm.collection_id} onChange={(e) => setCreateForm({ ...createForm, collection_id: e.target.value })} className="w-full rounded-xl px-3 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--brand-orange)]">
                        <option value="">{t("platformMisc.forms.none")}</option>
                        {collections.filter((c) => c.status !== "archived" || String(c.id) === createForm.collection_id).map((c) => <option key={c.id} value={c.id}>{c.name}{c.status === "archived" ? t("platformMisc.forms.archivedSuffix") : ""}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1"><label className="text-[9px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.forms.tags")}</label><input value={createForm.tags} onChange={(e) => setCreateForm({ ...createForm, tags: e.target.value })} className="w-full rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--brand-orange)]" placeholder={t("platformMisc.forms.tagsPlaceholder")} /></div>
                  </div>
                  <div className="flex gap-3"><button onClick={() => setShowCreate(false)} className="flex-1 btn btn-secondary">{t("platformMisc.forms.cancel")}</button><button onClick={handleCreateForm} disabled={saving || !createForm.name.trim()} className="flex-1 btn btn-primary">{saving ? t("platformMisc.forms.creating") : t("platformMisc.forms.createAndEdit")}</button></div>
                </>
              ) : (
                <>
                  <div className="space-y-4">
                    <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">{t("platformMisc.forms.aiGenHint")}</p>
                    <textarea
                      value={aiGenText}
                      onChange={(e) => setAiGenText(e.target.value)}
                      rows={8}
                      placeholder={t("platformMisc.forms.aiGenTextPlaceholder")}
                      className="w-full rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--brand-orange)] resize-none"
                    />
                    <div className="space-y-1"><label className="text-[9px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.forms.collection")}</label>
                      <select value={createForm.collection_id} onChange={(e) => setCreateForm({ ...createForm, collection_id: e.target.value })} className="w-full rounded-xl px-3 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--brand-orange)]">
                        <option value="">{t("platformMisc.forms.none")}</option>
                        {collections.filter((c) => c.status !== "archived" || String(c.id) === createForm.collection_id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => { setCreateMode("manual"); setAiGenText(""); }} className="flex-1 btn btn-secondary">{t("platformMisc.forms.back")}</button>
                    <button
                      onClick={async () => {
                        if (!aiGenText.trim()) return;
                        setAiGenLoading(true);
                        try {
                          const res = await fetch("/api/platform/ai/generate-all", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: aiGenText, collection_id: createForm.collection_id || null }) });
                          const data = await res.json();
                          if (data.success) {
                            const parts = [];
                            if (data.sections) parts.push(t("platformMisc.forms.aiPartsSections", { count: data.sections }));
                            if (data.fields) parts.push(t("platformMisc.forms.aiPartsQuestions", { count: data.fields }));
                            if (data.evaluation_dimensions) parts.push(t("platformMisc.forms.aiPartsEvalDimensions", { count: data.evaluation_dimensions }));
                            notify(t("platformMisc.forms.aiCreated", { title: data.title, parts: parts.join(", ") }));
                            setShowCreate(false);
                            setCreateMode("manual");
                            setAiGenText("");
                            fetchForms();
                            if (data.form) {
                              // Brief delay so the notification is visible before builder opens
                              setTimeout(() => openBuilder(data.form), 400);
                            }
                          } else {
                            notify(t((data.error || t("platformMisc.forms.aiGenFailed")) || "") || (data.error || t("platformMisc.forms.aiGenFailed")));
                          }
                        } catch (_) { notify(t("platformMisc.forms.aiGenFailedConnection")); }
                        setAiGenLoading(false);
                      }}
                      disabled={aiGenLoading || !aiGenText.trim()}
                      className="flex-1 px-4 py-3 rounded-xl bg-indigo-500 text-white text-[10px] font-black uppercase hover:bg-indigo-600 disabled:opacity-50 transition-all"
                    >
                      {aiGenLoading ? t("platformMisc.forms.generating") : t("platformMisc.forms.generateForm")}
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
                  {archiveConfirm.action === 'archive' ? t("platformMisc.forms.archiveModalTitle") : t("platformMisc.forms.restoreModalTitle")}
                </h3>
                <p className="text-[10px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                  {archiveConfirm.action === 'archive'
                    ? t("platformMisc.forms.archiveConfirmArchive")
                    : t("platformMisc.forms.archiveConfirmRestore")}
                  <strong className="text-[var(--text-primary)]">&quot;{archiveConfirm.name}&quot;</strong>?
                </p>
              </div>
            </div>
            {archiveConfirm.action === 'archive' ? (
              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
                <p className="text-[9px] font-bold text-amber-500 uppercase">{t("platformMisc.forms.archiveWhatHappens")}</p>
                <ul className="text-[9px] text-[var(--text-secondary)] space-y-1 list-disc list-inside">
                  <li>{t("platformMisc.forms.archiveBulletHidden")}</li>
                  <li>{t("platformMisc.forms.archiveBulletRuns")}</li>
                  <li>{t("platformMisc.forms.archiveBulletRestore")}</li>
                </ul>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                <p className="text-[9px] font-bold text-emerald-500 uppercase">{t("platformMisc.forms.restoreWhatHappens")}</p>
                <ul className="text-[9px] text-[var(--text-secondary)] space-y-1 list-disc list-inside">
                  <li>{t("platformMisc.forms.restoreBulletDraft")}</li>
                  <li>{t("platformMisc.forms.restoreBulletReappear")}</li>
                  <li>{t("platformMisc.forms.restoreBulletData")}</li>
                </ul>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setArchiveConfirm(null)} className="flex-1 btn btn-secondary">{t("platformMisc.forms.cancel")}</button>
              <button onClick={confirmArchiveAction}
                className={archiveConfirm.action === 'archive' ? 'flex-1 px-4 py-2.5 rounded-xl bg-rose-500 text-white text-[10px] font-black uppercase hover:bg-rose-600 transition-all' : 'flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-[10px] font-black uppercase hover:bg-emerald-600 transition-all'}>
                {archiveConfirm.action === 'archive' ? t("platformMisc.forms.archiveAction") : t("platformMisc.forms.restoreAction")}
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
          <button onClick={() => { setShowBuilder(false); setEditingForm(null); }} className="text-[10px] font-black uppercase text-[var(--text-secondary)] hover:text-[var(--text-primary)]">← {t("platformMisc.forms.back")}</button>
          <span className="text-[var(--text-secondary)] opacity-30">|</span>
          <h2 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">{editingForm?.name}</h2>
          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${editingForm?.status === "published" ? "text-emerald-500 bg-emerald-500/10" : "text-amber-500 bg-amber-500/10"}`}>{editingForm?.status ? (FORM_STATUS_KEYS[editingForm.status] ? t("platformMisc.forms." + FORM_STATUS_KEYS[editingForm.status]) : editingForm.status) : t("platformMisc.forms.statusDraft")}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowAiEval(!showAiEval); setShowScoring(false); setShowTemplates(false); }} className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${showAiEval ? "bg-purple-500 text-white" : "bg-tertiary border border-[var(--border-primary)] text-[var(--text-secondary)]"}`}>
            <Sparkles className="w-3 h-3 inline mr-1.5" />{t("platformMisc.forms.builderAiEval")} {aiEvalFramework && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />}
          </button>
          <button onClick={() => { setShowScoring(!showScoring); setShowAiEval(false); setShowWorkflow(false); setShowTemplates(false); }} className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${showScoring ? "bg-indigo-500 text-white" : "bg-tertiary border border-[var(--border-primary)] text-[var(--text-secondary)]"}`}>
            <BarChart3 className="w-3 h-3 inline mr-1.5" />{t("platformMisc.forms.builderScoring")} {scoringConfig?.enabled && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />}
          </button>
          <button onClick={() => { setShowWorkflow(!showWorkflow); setShowAiEval(false); setShowScoring(false); setShowTemplates(false); }} className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${showWorkflow ? "bg-amber-500 text-white" : "bg-tertiary border border-[var(--border-primary)] text-[var(--text-secondary)]"}`}>
            <GitBranch className="w-3 h-3 inline mr-1.5" />{t("platformMisc.forms.builderWorkflow")} {workflowConfig && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />}
          </button>
          <button onClick={() => { setShowTemplates(!showTemplates); setShowAiEval(false); setShowScoring(false); setShowWorkflow(false); }} className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${showTemplates ? "bg-cyan-500 text-white" : "bg-tertiary border border-[var(--border-primary)] text-[var(--text-secondary)]"}`}>
            <Mail className="w-3 h-3 inline mr-1.5" />{t("platformMisc.forms.builderTemplates")} {templateConfig && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />}
          </button>
          <button onClick={() => setPreviewMode(!previewMode)} className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${previewMode ? "bg-[var(--brand-orange)] text-black" : "bg-tertiary border border-[var(--border-primary)] text-[var(--text-secondary)]"}`}>
            <Eye className="w-3 h-3 inline mr-1.5" />{previewMode ? t("platformMisc.forms.previewEditing") : t("platformMisc.forms.previewPreview")}
          </button>
          <button onClick={() => saveFields(false)} disabled={saving} className="px-3 py-2 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[9px] font-black uppercase text-[var(--text-secondary)] hover:text-[var(--text-primary)]">{saving ? t("platformMisc.forms.saving") : t("platformMisc.forms.save")}</button>
          {editingForm?.status === "published" ? (
            <>
              <button onClick={() => saveFields(true)} disabled={saving} className="px-3 py-2 rounded-xl bg-indigo-500 text-white text-[9px] font-black uppercase hover:bg-indigo-600 transition-all">
                {saving ? t("platformMisc.forms.publishing") : t("platformMisc.forms.republish")}
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
                    notify(t("platformMisc.forms.runCreated"));
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
                <Play className="w-3 h-3 inline mr-1.5" /> {saving ? t("platformMisc.forms.creating") : t("platformMisc.forms.launchAndCollect")}
              </button>
            </>
          ) : (
            <button onClick={() => handlePublish()} disabled={saving} className="px-4 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-[9px] font-black uppercase hover:brightness-110">{saving ? t("platformMisc.forms.publishing") : t("platformMisc.forms.publish")}</button>
          )}
        </div>
      </div>

      {/* Scoring Configuration Panel */}
      {showScoring && scoringConfig && (
        <div className="px-6 py-4 bg-secondary border-b border-[var(--border-primary)] space-y-4 shrink-0 max-h-[50vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">{t("platformMisc.forms.scoringConfigTitle")}</h3>
            </div>
            <button onClick={() => setShowScoring(false)}><X className="w-4 h-4 text-[var(--text-secondary)]" /></button>
          </div>

          {/* Enable toggle & global settings */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="flex items-center gap-3 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)] cursor-pointer">
              <input type="checkbox" checked={scoringConfig.enabled} onChange={(e) => setScoringConfig({ ...scoringConfig, enabled: e.target.checked })} className="w-4 h-4 rounded accent-indigo-500" />
              <div>
                <p className="text-[10px] font-black text-[var(--text-primary)] uppercase">{t("platformMisc.forms.scoringEnable")}</p>
                <p className="text-[8px] text-[var(--text-secondary)]">{t("platformMisc.forms.scoringAutoCalc")}</p>
              </div>
            </label>
            <div className="space-y-1 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
              <label className="text-[8px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.forms.scoringMaxPerQuestion")}</label>
              <input type="number" min={0} value={scoringConfig.max_per_question ?? ""} onChange={(e) => { const v = e.target.value; setScoringConfig({ ...scoringConfig, max_per_question: v === "" ? 0 : parseInt(v) || 0 }); }} className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none" placeholder="0" />
            </div>
            <div className="space-y-1 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
              <label className="text-[8px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.forms.scoringTotalWeight")}</label>
              <p className={`text-xl font-black ${Object.values(scoringConfig.sections || {}).reduce((s, sec) => s + (sec.weight || 0), 0) === 100 ? "text-emerald-400" : "text-rose-400"}`}>
                {Object.values(scoringConfig.sections || {}).reduce((s, sec) => s + (sec.weight || 0), 0)}%
              </p>
            </div>
          </div>

          {/* Section weights */}
          {scoringConfig.enabled && (
            <div className="space-y-3">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">{t("platformMisc.forms.scoringSectionWeights")}</h4>
              <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)]">
                <table className="w-full text-left">
                  <thead className="bg-tertiary">
                    <tr className="text-[8px] font-black uppercase tracking-wider text-[var(--text-secondary)]">
                      <th className="px-3 py-2">{t("platformMisc.forms.scoringTableSection")}</th>
                      <th className="px-3 py-2">{t("platformMisc.forms.scoringTableWeight")}</th>
                      <th className="px-3 py-2">{t("platformMisc.forms.scoringTableScoredFields")}</th>
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
                              {ratingFields.length === 0 && <span className="text-[8px] text-[var(--text-secondary)] italic">{t("platformMisc.forms.scoringNoRatingFields")}</span>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Rankings */}
              <h4 className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)] pt-2">{t("platformMisc.forms.scoringRankingThresholds")}</h4>
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
                      placeholder={t("platformMisc.forms.rankingMin")}
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
                      placeholder={t("platformMisc.forms.rankingMax")}
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
                      placeholder={t("platformMisc.forms.rankingLabel")}
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
                })} className="flex items-center gap-1 text-[9px] font-black text-indigo-400 hover:text-indigo-300 uppercase"><PlusCircle className="w-3 h-3" /> {t("platformMisc.forms.scoringAddRankingTier")}</button>
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
              <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">{t("platformMisc.forms.workflowConfigTitle")}</h3>
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
                    notify(t("platformMisc.forms.notifyWorkflowSaved"));
                  } catch (_) {}
                  setSaving(false);
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-[9px] font-black uppercase hover:bg-amber-600 transition-all"
              >
                {t("platformMisc.forms.workflowSave")}
              </button>
              <button onClick={() => setShowWorkflow(false)}><X className="w-4 h-4 text-[var(--text-secondary)]" /></button>
            </div>
          </div>

          <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
            {t("platformMisc.forms.workflowHint")}
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
                <h4 className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">{t("platformMisc.forms.workflowDecisionButtons")}</h4>
                <div className="grid grid-cols-3 gap-3">
                  {decisions.map((d, i) => (
                    <div key={d.id} className="space-y-2 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                      <label className="text-[8px] font-black uppercase text-[var(--text-secondary)]">
                        {d.id === "approved" ? t("platformMisc.forms.decisionPositive") : d.id === "rejected" ? t("platformMisc.forms.decisionNegative") : t("platformMisc.forms.decisionNeedsWork")}
                      </label>
                      <input
                        value={d.label}
                        onChange={e => {
                          const next = [...decisions];
                          next[i] = { ...next[i], label: e.target.value };
                          setWorkflowConfig({ ...wf, decisions: next });
                        }}
                        placeholder={t("platformMisc.forms." + DECISION_DEFAULT_KEYS[d.id])}
                        className="w-full px-2 py-1.5 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
                      />
                    </div>
                  ))}
                </div>

                <h4 className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)] pt-2">{t("platformMisc.forms.workflowStatusLabels")}</h4>
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
                        <label className="text-[8px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.forms." + WORKFLOW_STATUS_LABEL_KEYS[st.id])} →</label>
                        <input
                          value={val}
                          onChange={e => setWorkflowConfig({ ...wf, statusLabels: { ...(wf.statusLabels || {}), [st.id]: e.target.value } })}
                          placeholder={t("platformMisc.forms." + WORKFLOW_STATUS_LABEL_KEYS[st.id])}
                          className="w-full px-2 py-1.5 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
                        />
                      </div>
                    );
                  })}
                </div>

                <h4 className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)] pt-4">{t("platformMisc.forms.workflowAutomationActions")}</h4>
                <p className="text-[9px] text-[var(--text-secondary)] mb-3">{t("platformMisc.forms.workflowAutomationHint")}</p>

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
                      <p className="text-[8px] font-black text-amber-400 uppercase">{t("platformMisc.forms.automationOnSubmit")}</p>
                      <Toggle path="on_submit.send_acknowledgement" label={t("platformMisc.forms.autoSendAckLabel")} desc={t("platformMisc.forms.autoSendAckDesc")} />
                      <p className="text-[8px] font-black text-emerald-400 uppercase pt-1">{t("platformMisc.forms.automationOnApproval")}</p>
                      <Toggle path="on_approve.send_approval_email" label={t("platformMisc.forms.autoSendApprovalLabel")} desc={t("platformMisc.forms.autoSendApprovalDesc")} />
                      <Toggle path="on_approve.create_platform_user" label={t("platformMisc.forms.autoCreateUserLabel")} desc={t("platformMisc.forms.autoCreateUserDesc")} />
                      <Toggle path="on_approve.send_activation_email" label={t("platformMisc.forms.autoSendActivationLabel")} desc={t("platformMisc.forms.autoSendActivationDesc")} />
                      <Toggle path="on_approve.enroll_in_program" label={t("platformMisc.forms.autoEnrollLabel")} desc={t("platformMisc.forms.autoEnrollDesc")} />
                      <Toggle path="on_approve.assign_to_group" label={t("platformMisc.forms.autoAssignGroupLabel")} desc={t("platformMisc.forms.autoAssignGroupDesc")} />
                      <p className="text-[7px] text-[var(--text-secondary)] italic mt-1">{t("platformMisc.forms.autoGroupTip")}</p>
                      <p className="text-[8px] font-black text-emerald-400 uppercase pt-2">{t("platformMisc.forms.automationAutoApproval")}</p>
                      <Toggle path="auto_approve" label={t("platformMisc.forms.autoApproveScoreLabel")} desc={t("platformMisc.forms.autoApproveScoreDesc")} />
                      <div className="flex items-center gap-3 pt-1">
                        <label className="text-[9px] font-bold text-[var(--text-secondary)] uppercase">{t("platformMisc.forms.autoCutoffScore")}</label>
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
                      <p className="text-[7px] text-[var(--text-secondary)] italic mt-1">{t("platformMisc.forms.autoCutoffHint")}</p>
                      <p className="text-[8px] font-black text-rose-400 uppercase pt-1">{t("platformMisc.forms.automationOnRejection")}</p>
                      <Toggle path="on_reject.send_rejection_email" label={t("platformMisc.forms.autoSendRejectionLabel")} desc={t("platformMisc.forms.autoSendRejectionDesc")} />
                    </div>
                  );
                })()}

                <h4 className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)] pt-4">{t("platformMisc.forms.workflowSuccessMessage")}</h4>
                <p className="text-[9px] text-[var(--text-secondary)] mb-3">{t("platformMisc.forms.workflowSuccessHint")}</p>
                <textarea
                  value={automationConfig?.success_message || DEFAULT_AUTOMATION.success_message || ""}
                  onChange={(e) => setAutomationConfig({ ...(automationConfig || DEFAULT_AUTOMATION), success_message: e.target.value })}
                  rows={4}
                  placeholder={t("platformMisc.forms.successMessagePlaceholder")}
                  className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-medium text-[var(--text-primary)] outline-none focus:border-amber-500 resize-y font-mono"
                />
                <div className="space-y-1">
                  <label className="text-[7px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.forms.redirectAfterSubmitLabel")}</label>
                  <input
                    type="url"
                    value={automationConfig?.redirect_after_submit || ""}
                    onChange={(e) => setAutomationConfig({ ...(automationConfig || DEFAULT_AUTOMATION), redirect_after_submit: e.target.value })}
                    placeholder="https://example.com/thank-you"
                    className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-amber-500"
                  />
                </div>
                <p className="text-[7px] text-[var(--text-secondary)] italic">{t("platformMisc.forms.workflowPlaceholdersHint")}</p>

                <button
                  onClick={() => setWorkflowConfig(null)}
                  className="text-[9px] font-bold text-rose-500 hover:text-rose-400 uppercase"
                >
                  {t("platformMisc.forms.workflowResetDefaults")}
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
              <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">{t("platformMisc.forms.templatesTitle")}</h3>
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
                    notify(t("platformMisc.forms.notifyTemplatesSaved"));
                  } catch (_) {}
                  setSaving(false);
                }}
                className="px-3 py-1.5 rounded-lg bg-cyan-500 text-white text-[9px] font-black uppercase hover:bg-cyan-600 transition-all"
              >
                {t("platformMisc.forms.templatesSave")}
              </button>
              <button onClick={() => setShowTemplates(false)}><X className="w-4 h-4 text-[var(--text-secondary)]" /></button>
            </div>
          </div>

          <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
            {t("platformMisc.forms.templatesHintPrefix")} <code className="px-1 bg-tertiary rounded text-[var(--brand-orange)]">{`{{variable}}`}</code> {t("platformMisc.forms.templatesHintSuffix")}
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
                  notify(t("platformMisc.forms.templatePersonalized", { label }));
                } else {
                  notify(data.error || t("platformMisc.forms.templatePersonalizeFailed"));
                }
              } catch (_) {
                notify(t("platformMisc.forms.templatePersonalizeNetworkError"));
              }
              setPersonalizing(null);
            };

            const TemplateEditor = ({ label, icon: Icon, tKey, desc, defaultSubject, defaultBody, vars, onPersonalize, personalizingKey }) => {
              const { t } = useI18n();
              return (
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
                      {personalizingKey === tKey ? t("platformMisc.forms.templateWriting") : t("platformMisc.forms.templatePersonalize")}
                    </button>
                  </div>
                  <p className="text-[8px] text-[var(--text-secondary)]">{desc}</p>
                  <div className="space-y-1">
                    <label className="text-[7px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.forms.templateSubject")}</label>
                    <input
                      value={tmpl[tKey]?.subject || ""}
                      onChange={(e) => update(tKey, "subject", e.target.value)}
                      placeholder={defaultSubject}
                      className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[7px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.forms.templateBody")}</label>
                    <textarea
                      value={tmpl[tKey]?.body || ""}
                      onChange={(e) => update(tKey, "body", e.target.value)}
                      rows={4}
                      placeholder={defaultBody}
                      className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-medium text-[var(--text-primary)] outline-none focus:border-cyan-500 resize-y font-mono"
                    />
                  </div>
                  {vars && (
                    <p className="text-[7px] text-[var(--text-secondary)] italic">{t("platformMisc.forms.templateVariables", { vars: vars.join(", ") })}</p>
                  )}
                </div>
              );
            };

            return (
              <div className="space-y-3">
                <TemplateEditor
                  label={t("platformMisc.forms.templateSubmissionLabel")} icon={Send}
                  tKey="acknowledgement"
                  desc={t("platformMisc.forms.templateSubmissionDesc")}
                  defaultSubject={t("platformMisc.forms.templateSubmissionSubject")}
                  defaultBody={t("platformMisc.forms.templateSubmissionBody")}
                  vars={["name", "form_name", "organization"]}
                  onPersonalize={personalize}
                  personalizingKey={personalizing}
                />
                <TemplateEditor
                  label={t("platformMisc.forms.templateApprovalLabel")} icon={CheckCircle2}
                  tKey="approval"
                  desc={t("platformMisc.forms.templateApprovalDesc")}
                  defaultSubject={t("platformMisc.forms.templateApprovalSubject")}
                  defaultBody={t("platformMisc.forms.templateApprovalBody")}
                  vars={["name", "form_name", "program_name", "group_name", "organization"]}
                  onPersonalize={personalize}
                  personalizingKey={personalizing}
                />
                <TemplateEditor
                  label={t("platformMisc.forms.templateActivationLabel")} icon={Key}
                  tKey="activation"
                  desc={t("platformMisc.forms.templateActivationDesc")}
                  defaultSubject={t("platformMisc.forms.templateActivationSubject")}
                  defaultBody={t("platformMisc.forms.templateActivationBody")}
                  vars={["name", "organization", "activation_link"]}
                  onPersonalize={personalize}
                  personalizingKey={personalizing}
                />
                <TemplateEditor
                  label={t("platformMisc.forms.templateExistingUserLabel")} icon={LogIn}
                  tKey="existing_user"
                  desc={t("platformMisc.forms.templateExistingUserDesc")}
                  defaultSubject={t("platformMisc.forms.templateExistingUserSubject")}
                  defaultBody={t("platformMisc.forms.templateExistingUserBody")}
                  vars={["name", "organization", "login_url"]}
                  onPersonalize={personalize}
                  personalizingKey={personalizing}
                />
                <TemplateEditor
                  label={t("platformMisc.forms.templateRejectionLabel")} icon={XCircle}
                  tKey="rejection"
                  desc={t("platformMisc.forms.templateRejectionDesc")}
                  defaultSubject={t("platformMisc.forms.templateRejectionSubject")}
                  defaultBody={t("platformMisc.forms.templateRejectionBody")}
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
              <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">{t("platformMisc.forms.aiEvalTitle")}</h3>
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
                    if (res.ok) notify(t("platformMisc.forms.aiEvalFrameworkSaved"));
                    else notify(t("platformMisc.forms.aiEvalSaveFailed"));
                  } catch (e) {}
                  setSaving(false);
                }}
                disabled={saving}
                className="px-3 py-1.5 rounded-lg bg-purple-500 text-white text-[9px] font-black uppercase hover:bg-purple-600 transition-all"
              >
                {t("platformMisc.forms.aiEvalSaveFramework")}
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
                  notify(enabled ? t("platformMisc.forms.aiEvalEnabled") : t("platformMisc.forms.aiEvalDisabled"));
                } catch (_) {}
              }}
              className="w-4 h-4 rounded accent-purple-500"
            />
            <div>
              <p className="text-[10px] font-black text-[var(--text-primary)] uppercase">{t("platformMisc.forms.aiEvalEnable")}</p>
              <p className="text-[8px] text-[var(--text-secondary)]">{t("platformMisc.forms.aiEvalEnableHint")}</p>
            </div>
          </label>

          {aiEvalFramework ? (
            <>
              {/* Weight validation */}
              {(() => {
                const total = (aiEvalFramework.dimensions || []).reduce((s, d) => s + (parseInt(d.weight) || 0), 0);
                return total !== 100 ? (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[9px] font-bold text-amber-400">
                    {t("platformMisc.forms.aiEvalWeightsWarning", { total })}
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[9px] font-bold text-emerald-400">
                    {t("platformMisc.forms.aiEvalWeightsReady")}
                  </div>
                );
              })()}

              {/* Editable dimensions table */}
              <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)]">
                <table className="w-full text-left">
                  <thead className="bg-tertiary">
                    <tr className="text-[8px] font-black uppercase tracking-wider text-[var(--text-secondary)]">
                      <th className="px-2 py-2">{t("platformMisc.forms.aiEvalTableDimension")}</th>
                      <th className="px-2 py-2 w-16">{t("platformMisc.forms.aiEvalTableWeight")}</th>
                      <th className="px-2 py-2">{t("platformMisc.forms.aiEvalTableCriteria")}</th>
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
                            placeholder={t("platformMisc.forms.aiEvalCriteriaPlaceholder")}
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
                  {t("platformMisc.forms.aiEvalAddDimension")}
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    const total = (aiEvalFramework.dimensions || []).reduce((s, d) => s + (parseInt(d.weight) || 0), 0);
                    if (total !== 100) { notify(t("platformMisc.forms.aiEvalWeightsMustTotal")); return; }
                    if (!editingForm?.id) { notify(t("platformMisc.forms.aiEvalNoForm")); return; }
                    setAiEvalLoading(true);
                    try {
                      const payload = { form_id: Number(editingForm.id), framework: aiEvalFramework, source_document: aiEvalText?.substring(0, 500) || null };
                      const res = await fetch("/api/platform/ai/evaluation-config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                      if (res.ok) notify(t("platformMisc.forms.aiEvalFrameworkSaved"));
                      else { const err = await res.json(); notify(t((err.error || t("platformMisc.forms.saveFailed")) || "") || (err.error || t("platformMisc.forms.saveFailed"))); }
                    } catch (_) { notify(t("platformMisc.forms.saveFailed")); }
                    setAiEvalLoading(false);
                  }}
                  disabled={aiEvalLoading}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-purple-500 text-white text-[10px] font-black uppercase hover:bg-purple-600 disabled:opacity-50 transition-all"
                >
                  {t("platformMisc.forms.aiEvalSaveFramework")}
                </button>
                <button
                  onClick={async () => {
                    if (!confirm(t("platformMisc.forms.aiEvalRemoveConfirm"))) return;
                    await fetch(`/api/platform/ai/evaluation-config?form_id=${editingForm?.id}`, { method: "DELETE" });
                    setAiEvalFramework(null);
                    notify(t("platformMisc.forms.aiEvalFrameworkRemoved"));
                  }}
                  className="px-4 py-2.5 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[9px] font-black uppercase text-rose-500 hover:text-rose-400"
                >
                  {t("platformMisc.forms.remove")}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                {t("platformMisc.forms.aiEvalEmptyHint")}
              </p>
              <textarea
                value={aiEvalText}
                onChange={(e) => setAiEvalText(e.target.value)}
                rows={6}
                placeholder={t("platformMisc.forms.aiEvalTextPlaceholder")}
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
                      notify(t("platformMisc.forms.aiEvalGenerated", { count: data.framework.dimensions?.length || 0 }));
                      setAiEvalText("");
                    } else {
                      notify(t((data.error || t("platformMisc.forms.aiEvalGenerationFailed")) || "") || (data.error || t("platformMisc.forms.aiEvalGenerationFailed")));
                    }
                  } catch (_) { notify(t("platformMisc.forms.aiEvalGenerationFailedConnection")); }
                  setAiEvalLoading(false);
                }}
                disabled={aiEvalLoading || !aiEvalText.trim()}
                className="w-full px-4 py-3 rounded-xl bg-purple-500 text-white text-[10px] font-black uppercase hover:bg-purple-600 disabled:opacity-50 transition-all"
              >
                {aiEvalLoading ? t("platformMisc.forms.analyzing") : t("platformMisc.forms.aiEvalGenerate")}
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
            <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-50">{t("platformMisc.forms.paletteAddField")}</p>
            <button onClick={addSection} className="w-full p-2 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[9px] font-black uppercase text-[var(--text-secondary)] hover:text-[var(--text-primary)]">{t("platformMisc.forms.paletteAddSection")}</button>
            {FIELD_TYPES.map((type) => (
              <button key={type.value} onClick={() => addField(type.value)} className="w-full flex items-center gap-2 p-2 rounded-lg text-left text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary transition-all">
                <type.icon className="w-3.5 h-3.5" />{t("platformMisc.forms." + FIELD_TYPE_KEYS[type.value])}
              </button>
            ))}
            {/* Per-section quick-add */}
            {sections.map((sec) => (
              <div key={sec.id} className="pt-2 border-t border-[var(--border-primary)]">
                <button
                  onClick={() => setActiveSectionId(sec.id)}
                  className={`w-full text-left p-1 rounded text-[7px] font-black uppercase mb-1 transition-all ${activeSectionId === sec.id ? 'text-[var(--brand-orange)] bg-[var(--brand-orange)]/10' : 'text-[var(--text-secondary)] opacity-50'}`}
                >
                  {t("platformMisc.forms.paletteInto", { title: sec.title })} {activeSectionId === sec.id && '✓'}
                </button>
                {FIELD_TYPES.slice(0, 6).map((type) => (
                  <button key={type.value} onClick={() => addField(type.value, sec.id)} className="w-full flex items-center gap-2 p-1.5 rounded text-[9px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary">
                    <type.icon className="w-3 h-3" />{t("platformMisc.forms." + FIELD_TYPE_KEYS[type.value])}
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
                  {t("platformMisc.forms.orphanFieldsTitle", { count: orphanFields.length })}
                </p>
                <div className="space-y-2">
                  {orphanFields.map((fld) => <div key={fld._tmpId}>{renderFieldPreview(fld)}</div>)}
                </div>
              </div>
            )}

            {fields.length === 0 && <div className="py-16 text-center"><FileText className="w-12 h-12 mx-auto text-[var(--text-secondary)] opacity-20" /><p className="text-[11px] text-[var(--text-secondary)] mt-3 font-bold">{t("platformMisc.forms.emptyCanvasTitle")}</p><p className="text-[9px] text-[var(--text-secondary)] mt-1 opacity-50">{t("platformMisc.forms.emptyCanvasHint")}</p></div>}
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
                <h3 className="text-sm font-black uppercase text-[var(--text-primary)]">{t("platformMisc.forms.republishModalTitle")}</h3>
                <p className="text-[10px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                  <strong className="text-[var(--text-primary)]">&quot;{editingForm?.name}&quot;</strong>{t("platformMisc.forms.republishModalText")}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => { setShowRepublishConfirm(false); saveFields(true); }}
                className="w-full px-4 py-3 rounded-xl bg-indigo-500 text-white text-[10px] font-black uppercase hover:bg-indigo-600 transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5" /> {t("platformMisc.forms.republishSaveAndRepublish")}
              </button>
              <button
                onClick={() => { setShowRepublishConfirm(false); saveFields("draft"); }}
                className="w-full px-4 py-3 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[10px] font-black uppercase text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
              >
                {t("platformMisc.forms.republishSaveDraftOnly")}
              </button>
              <button
                onClick={() => setShowRepublishConfirm(false)}
                className="w-full px-4 py-3 text-[9px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] uppercase"
              >
                {t("platformMisc.forms.cancel")}
              </button>
            </div>
            <p className="text-[8px] text-[var(--text-secondary)] text-center opacity-50">
              {t("platformMisc.forms.republishFootnote")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import NextLink from "next/link";
import {
  FileText, Plus, Search, Loader2, Edit3, Archive, Copy,
  Eye, Grid3X3, X, ChevronUp, ChevronDown, Trash2,
  CheckSquare, Circle, List, Hash, Mail, PhoneIcon, Calendar,
  Clock, Star, Link, DollarSign, PenTool, AlignLeft,
  Type, Upload, BarChart3, PlusCircle, MinusCircle, RotateCcw, AlertTriangle, Sparkles, CheckCircle2, Play, FolderKanban, GitBranch, Send, Key, LogIn, XCircle,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { usePermissions } from "@/lib/PermissionProvider";
import { useDialogs } from "@/components/ui/DialogProvider";
import ResultDelayEditor from "@/components/ui/ResultDelayEditor";
import { findUnknownTemplateVariables, readResultDelayMinutes, TEMPLATE_VARIABLES } from "@/lib/constants";

// ─── Module-scope readers ────────────────────────────────────────────────────
// The reading hook keys its internal work on these, so they are made once here
// rather than rebuilt on every render.

const FORMS_URL = "/api/platform/forms";
const COLLECTIONS_URL = "/api/platform/collections";

const pickForms = (response) => (response?.success ? response.forms || [] : []);
const pickCollections = (response) => (response?.success ? response.collections || [] : []);

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

/**
 * One email template of a form.
 *
 * Defined at MODULE scope, not inside the panel's render: a component created
 * during a render is a new type every time, so React unmounts and remounts its
 * inputs on every keystroke — the field loses focus after each letter and the
 * author can never finish a sentence. Nothing here depends on render-local
 * state, so hoisting it costs nothing and typing works.
 */
function TemplateEditor({ label, icon: Icon, tKey, desc, defaultSubject, defaultBody, vars, onPersonalize, personalizingKey, templates, onChange }) {
  const { t } = useI18n();
  const entry = templates?.[tKey] || {};
  // Names the sender will not fill in — it removes them, so the author is told
  // before sending rather than discovering it in the sent mail.
  const unknownVariables = findUnknownTemplateVariables(
    `${entry.subject || ""} ${entry.body || ""}`,
    vars || [],
  );
  return (
    <div className="space-y-2 p-4 rounded-xl bg-tertiary border border-[var(--border-primary)]">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5 text-cyan-400" />
        <p className="text-[10px] font-black uppercase text-[var(--text-primary)]">{label}</p>
        <button
          type="button"
          disabled={personalizingKey === tKey}
          onClick={() => onPersonalize(tKey, label)}
          className="ml-auto px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold uppercase tracking-wide hover:bg-indigo-500/20 disabled:opacity-40 transition-all flex items-center gap-1"
        >
          <Sparkles className="w-2.5 h-2.5" />
          {personalizingKey === tKey ? t("platformMisc.forms.templateWriting") : t("platformMisc.forms.templatePersonalize")}
        </button>
      </div>
      <p className="text-[10px] font-medium text-[var(--text-secondary)]">{desc}</p>
      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.templateSubject")}</label>
        <input
          value={entry.subject || ""}
          onChange={(event) => onChange(tKey, "subject", event.target.value)}
          placeholder={defaultSubject}
          className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-cyan-500"
        />
      </div>
      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.templateBody")}</label>
        <textarea
          value={entry.body || ""}
          onChange={(event) => onChange(tKey, "body", event.target.value)}
          rows={4}
          placeholder={defaultBody}
          className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-medium text-[var(--text-primary)] outline-none focus:border-cyan-500 resize-y font-mono"
        />
      </div>
      {vars && (
        <p className="text-[10px] font-medium text-[var(--text-secondary)]">{t("platformMisc.forms.templateVariables", { vars: vars.join(", ") })}</p>
      )}
      {unknownVariables.length > 0 && (
        <p className="text-[10px] font-bold text-amber-500">
          {t("platformMisc.forms.templateUnknownVariables", { vars: unknownVariables.join(", ") })}
        </p>
      )}
    </div>
  );
}

export default function PlatformForms() {
  const router = useRouter();
  const { t } = useI18n();
  const { can } = usePermissions();
  const { confirm } = useDialogs();
  const canCreate = can("forms", "create");
  const canEdit = can("forms", "edit");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("published");

  // The grid and the collection dropdown, read through the shared hook: it owns
  // the cache, the cache-first paint and the discarding of a stale answer, so
  // the page keeps no copy of its own and reads its data during render.
  const { data: forms, loading, refresh: refreshForms } = useApi(
    statusFilter === "all" ? FORMS_URL : `${FORMS_URL}?status=${statusFilter}`,
    { defaultValue: [], transform: pickForms, deps: [statusFilter] },
  );
  const { data: collections } = useApi(COLLECTIONS_URL, {
    defaultValue: [],
    transform: pickCollections,
  });
  const [notification, setNotification] = useState(null);
  // Snapshot the clock once per render — reading it mid-render is impure.
  const [now] = useState(() => Date.now());
  // Monotonic sequence for temp ids: the clock snapshot above is fixed for this
  // component's lifetime, so uniqueness comes from the counter.
  const tempIdSeq = useRef(0);

  // Builder state
  const [editingForm, setEditingForm] = useState(null);
  const [sections, setSections] = useState([]);
  const [fields, setFields] = useState([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState(null); // Now uses field temp ID, not array index
  const [, setAddingFieldType] = useState(null);
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
  const [isVentureForm, setIsVentureForm] = useState(false);

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

  const notify = (message) => { setNotification(message); setTimeout(() => setNotification(null), 3000); };

  const genTempId = () => `tmp-${now}-${++tempIdSeq.current}`;

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

    // Venture Application flag (approval creates a Venture)
    setIsVentureForm(!!formSettings.venture_application);

    // Load template config from form settings
    setTemplateConfig(formSettings.automation?.templates || null);

    try {
      const response = await fetch(`/api/platform/forms?id=${form.id}`);
      const data = await response.json();
      if (data.success) {
        const loadedSections = (data.sections || []).map(section => ({ ...section, id: String(section.id) }));
        const loadedFields = (data.fields || []).map(field => ({ ...field, _tmpId: genTempId(), section_id: field.section_id ? String(field.section_id) : null }));
        
        // Auto-create default section if none exist
        if (loadedSections.length === 0) {
          const defaultSection = { id: genTempId(), title: "Section 1", description: "", sort_order: 0 };
          loadedSections.push(defaultSection);
          // Assign any loaded fields to this section
          loadedFields.forEach(field => { if (!field.section_id) field.section_id = defaultSection.id; });
        }
        
        setSections(loadedSections);
        setFields(loadedFields);
        setActiveSectionId(loadedSections.length > 0 ? loadedSections[loadedSections.length - 1].id : null);
      }
    } catch (_) {}

    // Load AI evaluation framework if exists
    try {
      const frameworkResponse = await fetch(`/api/platform/ai/evaluation-config?form_id=${form.id}`);
      const frameworkData = await frameworkResponse.json();
      if (frameworkData.success && frameworkData.framework) setAiEvalFramework(frameworkData.framework);
      else setAiEvalFramework(null);
    } catch (_) {}
  };

  const handleCreateForm = async () => {
    if (!createForm.name.trim()) return;
    setSaving(true);
    try {
      const response = await fetch("/api/platform/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createForm,
          tags: createForm.tags ? createForm.tags.split(",").map((tag) => tag.trim()) : [],
        }),
      });
      const data = await response.json();
      if (data.success) {
        notify(t("platformMisc.forms.notifyFormCreated"));
        setShowCreate(false);
        setCreateForm({ name: "", description: "", collection_id: "", visibility: "internal", tags: "" });
        refreshForms();
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

  const handlePublish = async (options) => {
    if (!editingForm) return;
    const skipSave = options?.skipSave;
    if (!skipSave) setSaving(true);
    try {
      let framework = null;
      try {
        const frameworkResponse = await fetch(`/api/platform/ai/evaluation-config?form_id=${editingForm.id}`);
        const frameworkData = await frameworkResponse.json();
        if (frameworkData.success && frameworkData.framework) framework = frameworkData.framework;
      } catch {}

      const response = await fetch("/api/platform/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish", id: editingForm.id, fields, sections, evaluation_framework: framework }),
      });
      const data = await response.json();
      if (data.success) {
        notify(t("platformMisc.forms.notifyPublishedVersion", { version: data.version }));
        setEditingForm((prev) => ({ ...prev, status: "published", version: data.version }));
        refreshForms();
      }
    } catch (_) {}
    if (!skipSave) setSaving(false);
  };

  const addSection = async () => {
    const tempId = genTempId();
    setSections((previousSections) => {
      const nextSections = [
        ...previousSections,
        { id: tempId, title: "New Section", description: "", sort_order: previousSections.length },
      ];
      setActiveSectionId(tempId); // New section becomes active
      return nextSections;
    });
  };

  const updateSection = (sectionIndex, updates) => {
    setSections((previousSections) => previousSections.map((section, index) => (index === sectionIndex ? { ...section, ...updates } : section)));
  };

  const removeSection = (sectionIndex) => {
    const removedSection = sections[sectionIndex];
    setSections((previousSections) => previousSections.filter((_, index) => index !== sectionIndex));
    // Orphan fields that belonged to this section
    if (removedSection?.id) {
      setFields((previousFields) => previousFields.map((field) =>
        field.section_id === removedSection.id ? { ...field, section_id: null } : field
      ));
    }
  };

  const addField = (fieldType, sectionId) => {
    const typeInfo = FIELD_TYPES.find((fieldTypeOption) => fieldTypeOption.value === fieldType) || FIELD_TYPES[0];
    const tempId = genTempId();
    const targetSectionId = sectionId || activeSectionId || (sections.length > 0 ? sections[sections.length - 1].id : null);
    setFields((previousFields) => {
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
        sort_order: previousFields.length,
      };
      // Auto-select the new field so user can configure it immediately
      setSelectedFieldId(tempId);
      return [...previousFields, newField];
    });
    setAddingFieldType(null);
  };

  const updateField = (tempId, updates) => {
    setFields((previousFields) => previousFields.map((field) => (field._tmpId === tempId ? { ...field, ...updates } : field)));
  };

  const removeField = (tempId) => {
    setFields((previousFields) => previousFields.filter((field) => field._tmpId !== tempId));
    if (selectedFieldId === tempId) setSelectedFieldId(null);
  };

  const moveField = (tempId, direction) => {
    setFields((previousFields) => {
      const currentIndex = previousFields.findIndex((field) => field._tmpId === tempId);
      if (currentIndex === -1) return previousFields;
      const nextFields = [...previousFields];
      const target = currentIndex + direction;
      if (target < 0 || target >= nextFields.length) return previousFields;
      [nextFields[currentIndex], nextFields[target]] = [nextFields[target], nextFields[currentIndex]];
      return nextFields.map((field, index) => ({ ...field, sort_order: index }));
    });
  };

  const addOption = (tempId) => {
    setFields((previousFields) => previousFields.map((field) => {
      if (field._tmpId !== tempId || !field.options) return field;
      return { ...field, options: [...field.options, { label: t("platformMisc.forms.optionDefault", { n: field.options.length + 1 }), value: `option-${field.options.length + 1}` }] };
    }));
  };

  const updateOption = (tempId, optionIndex, key, value) => {
    setFields((previousFields) => previousFields.map((field) => {
      if (field._tmpId !== tempId || !field.options) return field;
      const nextOptions = [...field.options];
      nextOptions[optionIndex] = { ...nextOptions[optionIndex], [key]: value };
      return { ...field, options: nextOptions };
    }));
  };

  const removeOption = (tempId, optionIndex) => {
    setFields((previousFields) => previousFields.map((field) => {
      if (field._tmpId !== tempId || !field.options) return field;
      return { ...field, options: field.options.filter((_, index) => index !== optionIndex) };
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
      const currentSections = sections.filter((section) => section.id && !String(section.id).startsWith("tmp-"));
      try {
        const existing = await fetch(`/api/platform/forms?id=${editingForm.id}`);
        const existingData = await existing.json();
        if (existingData.success) {
          // Delete removed sections
          if (existingData.sections) {
            const existingIds = existingData.sections.map((section) => section.id);
            const keptIds = currentSections.map((section) => section.id);
            for (const existingId of existingIds) {
              if (!keptIds.includes(existingId)) {
                await fetch(`/api/platform/forms`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingForm.id, sections: [{ id: existingId, _delete: true }] }) });
              }
            }
          }
          // Delete removed fields
          if (existingData.fields) {
            const currentFieldIds = fields.filter((field) => field.id && !String(field.id).startsWith("fld-")).map((field) => field.id);
            const existingFieldIds = existingData.fields.map((field) => field.id);
            for (const existingId of existingFieldIds) {
              if (!currentFieldIds.includes(existingId)) {
                await fetch(`/api/platform/forms`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingForm.id, fields: [{ id: existingId, _delete: true }] }) });
              }
            }
          }
        }
      } catch (_) {}

      // Strip temp IDs for new sections
      const cleanSections = sections.map((section) => (String(section.id).startsWith("tmp-") ? { ...section, id: null } : section));
      const payload = { id: editingForm.id, fields, sections: cleanSections };
      const response = await fetch("/api/platform/forms", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
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
          const refreshResponse = await fetch(`/api/platform/forms?id=${editingForm.id}`);
          const freshData = await refreshResponse.json();
          if (freshData.success) {
            setSections((freshData.sections || []).map(section => ({ ...section, id: String(section.id) })));
            setFields((freshData.fields || []).map(field => ({ ...field, _tmpId: genTempId(), section_id: field.section_id ? String(field.section_id) : null })));
            setEditingForm(freshData.form || editingForm);
          }
        } catch (_) {}
      } else notify(t((data.error || t("platformMisc.forms.saveFailed")) || "") || (data.error || t("platformMisc.forms.saveFailed")));
    } catch (_) {}
    setSaving(false);
  };

  const handleDuplicate = async (form) => {
    if (!(await confirm({ message: t("platformMisc.forms.confirmDuplicate", { name: form.name }) }))) return;
    try {
      const response = await fetch("/api/platform/forms", {
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
      const data = await response.json();
      if (data.success) {
        // Copy fields from source
        const sourceResponse = await fetch(`/api/platform/forms?id=${form.id}`);
        const sourceData = await sourceResponse.json();
        if (sourceData.success) {
          await fetch("/api/platform/forms", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: data.form.id,
              fields: sourceData.fields.map((field) => ({ ...field, id: null })),
              sections: sourceData.sections.map((section) => ({ ...section, id: null })),
            }),
          });
        }
        notify(t("platformMisc.forms.notifyFormDuplicated"));
        refreshForms();
      }
    } catch (_) {}
  };

  const handleArchive = async (formId) => {
    const form = forms.find((candidate) => candidate.id === formId);
    if (!form) return;
    setArchiveConfirm({ id: formId, name: form.name, action: "archive" });
  };

  const handleUnarchive = async (formId) => {
    const form = forms.find((candidate) => candidate.id === formId);
    if (!form) return;
    setArchiveConfirm({ id: formId, name: form.name, action: "unarchive" });
  };

  const handleDeletePermanently = async (formId) => {
    const form = forms.find((candidate) => candidate.id === formId);
    if (!form) return;
    if (!(await confirm({ message: t("platformMisc.forms.deleteFormConfirm"), tone: "danger" }))) return;
    try {
      const response = await fetch(`/api/platform/forms?id=${formId}&permanent=true`, { method: "DELETE" });
      const data = await response.json();
      if (data.success) {
        notify(t("platformMisc.forms.notifyFormDeleted"));
        refreshForms();
      }
    } catch (_) {}
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
      refreshForms();
    } catch (_) {}
    setArchiveConfirm(null);
  };

  const renderFieldPreview = (field) => {
    const Icon = FIELD_ICONS[field.field_type] || Type;
    const tempId = field._tmpId;
    return (
      <div
        key={tempId}
        onClick={() => setSelectedFieldId(selectedFieldId === tempId ? null : tempId)}
        className={cn(
          "p-4 rounded-xl border transition-all cursor-pointer group",
          selectedFieldId === tempId
            ? "border-[var(--brand-orange)] bg-brand-orange/5"
            : "border-[var(--border-primary)] bg-secondary hover:border-[var(--text-secondary)]",
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Icon className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-[var(--text-primary)]">
                {field.label || t("platformMisc.forms.untitled")}
                {field.required && <span className="text-rose-500 ml-1">*</span>}
              </p>
              <p className="text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-widest">
                {FIELD_TYPE_KEYS[field.field_type] ? t("platformMisc.forms." + FIELD_TYPE_KEYS[field.field_type]) : field.field_type}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
            <button onClick={(event) => { event.stopPropagation(); moveField(tempId, -1); }}><ChevronUp className="w-3 h-3" /></button>
            <button onClick={(event) => { event.stopPropagation(); moveField(tempId, 1); }}><ChevronDown className="w-3 h-3" /></button>
            <button onClick={(event) => { event.stopPropagation(); removeField(tempId); }} className="text-rose-500"><Trash2 className="w-3 h-3" /></button>
          </div>
        </div>

        {/* Field editor (expanded) */}
        {selectedFieldId === tempId && (
          <div className="mt-4 pt-4 border-t border-[var(--border-primary)] space-y-3" onClick={(event) => event.stopPropagation()}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.fieldEditorLabel")}</label>
                <input
                  value={field.label}
                  onChange={(event) => updateField(tempId, { label: event.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.fieldEditorType")}</label>
                <select
                  value={field.field_type}
                  onChange={(event) => {
                    const newType = event.target.value;
                    const needsOptions = ["select", "radio", "checkbox", "multiselect", "rating"].includes(newType);
                    updateField(tempId, { field_type: newType, options: needsOptions ? (newType === "rating" ? [{ label: "1", value: "1" }, { label: "2", value: "2" }, { label: "3", value: "3" }, { label: "4", value: "4" }, { label: "5", value: "5" }] : [{ label: t("platformMisc.forms.optionDefault", { n: 1 }), value: "option-1" }]) : null });
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
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.fieldEditorSection")}</label>
              <select
                value={field.section_id || ""}
                onChange={(event) => updateField(tempId, { section_id: event.target.value || null })}
                className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
              >
                <option value="">{t("platformMisc.forms.fieldSectionNone")}</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>{section.title}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.fieldEditorPlaceholder")}</label>
              <input
                value={field.placeholder || ""}
                onChange={(event) => updateField(tempId, { placeholder: event.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.fieldEditorHelpText")}</label>
              <input
                value={field.help_text || ""}
                onChange={(event) => updateField(tempId, { help_text: event.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
              />
            </div>
            <label className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-primary)]">
              <input type="checkbox" checked={field.required} onChange={(event) => updateField(tempId, { required: event.target.checked })} />
              {t("platformMisc.forms.fieldRequired")}
            </label>

            {/* Options editor */}
            {field.options && (
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.fieldOptions")}</label>
                {field.options.map((option, optionIndex) => (
                  <div key={optionIndex} className="flex items-center gap-2">
                    <input
                      value={option.label}
                      onChange={(event) => updateOption(tempId, optionIndex, "label", event.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
                    />
                    <button onClick={() => removeOption(tempId, optionIndex)} className="text-rose-500"><Trash2 className="w-3 h-3" /></button>
                  </div>
                ))}
                <button onClick={() => addOption(tempId)} className="text-[10px] font-bold text-[var(--brand-orange)] uppercase tracking-wide hover:underline">{t("platformMisc.forms.addOption")}</button>
              </div>
            )}

            {/* Validation Rules */}
            <div className="space-y-2 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-50">{t("platformMisc.forms.validationTitle")}</p>
              <div className="grid grid-cols-2 gap-2">
                {["text", "textarea"].includes(field.field_type) && (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.validationMinLength")}</label>
                      <input type="number" value={field.validation?.minLength || ""} onChange={(event) => updateField(tempId, { validation: { ...(field.validation || {}), minLength: event.target.value ? parseInt(event.target.value) : undefined } })} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.validationMaxLength")}</label>
                      <input type="number" value={field.validation?.maxLength || ""} onChange={(event) => updateField(tempId, { validation: { ...(field.validation || {}), maxLength: event.target.value ? parseInt(event.target.value) : undefined } })} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none" />
                    </div>
                  </>
                )}
                {["number", "currency"].includes(field.field_type) && (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.validationMinValue")}</label>
                      <input type="number" value={field.validation?.min || ""} onChange={(event) => updateField(tempId, { validation: { ...(field.validation || {}), min: event.target.value ? parseFloat(event.target.value) : undefined } })} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.validationMaxValue")}</label>
                      <input type="number" value={field.validation?.max || ""} onChange={(event) => updateField(tempId, { validation: { ...(field.validation || {}), max: event.target.value ? parseFloat(event.target.value) : undefined } })} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none" />
                    </div>
                  </>
                )}
                {["file"].includes(field.field_type) && (
                  <>
                    <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.validationMaxSizeMb")}</label><input type="number" value={field.validation?.maxSize || ""} onChange={(event) => updateField(tempId, { validation: { ...(field.validation || {}), maxSize: event.target.value ? parseInt(event.target.value) : undefined } })} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none" /></div>
                    <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.validationAllowedTypes")}</label><input value={field.validation?.acceptedFiles || ""} onChange={(event) => updateField(tempId, { validation: { ...(field.validation || {}), acceptedFiles: event.target.value } })} placeholder=".pdf,.jpg" className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none" /></div>
                  </>
                )}
                <div className="col-span-2 space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.validationErrorMessage")}</label><input value={field.validation?.errorMessage || ""} onChange={(event) => updateField(tempId, { validation: { ...(field.validation || {}), errorMessage: event.target.value } })} placeholder={t("platformMisc.forms.validationErrorMessagePlaceholder")} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none" /></div>
              </div>
            </div>

            {/* Conditional Logic */}
            <div className="space-y-2 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-50">{t("platformMisc.forms.conditionalLogicTitle")}</p>
              <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.conditionalShowOnlyWhen")}</label>
                <select value={field.conditional_logic?.field_id || ""} onChange={(event) => updateField(tempId, { conditional_logic: { ...(field.conditional_logic || {}), field_id: event.target.value || undefined } })} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none">
                  <option value="">{t("platformMisc.forms.conditionalAlwaysVisible")}</option>
                  {fields.filter((candidate) => candidate !== field).slice(0, 20).map((candidate) => <option key={candidate.label} value={candidate.label}>{candidate.label}</option>)}
                </select>
              </div>
              {field.conditional_logic?.field_id && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.conditionalOperator")}</label>
                    <select value={field.conditional_logic?.operator || "equals"} onChange={(event) => updateField(tempId, { conditional_logic: { ...field.conditional_logic, operator: event.target.value } })} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none">
                      <option value="equals">{t("platformMisc.forms.operatorEquals")}</option><option value="not_equals">{t("platformMisc.forms.operatorNotEquals")}</option><option value="contains">{t("platformMisc.forms.operatorContains")}</option><option value="greater_than">{t("platformMisc.forms.operatorGreaterThan")}</option><option value="less_than">{t("platformMisc.forms.operatorLessThan")}</option>
                    </select>
                  </div>
                  <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.conditionalValue")}</label><input value={field.conditional_logic?.value || ""} onChange={(event) => updateField(tempId, { conditional_logic: { ...field.conditional_logic, value: event.target.value } })} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none" /></div>
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
            <input type="text" placeholder={t("platformMisc.forms.searchPlaceholder")} value={search} onChange={(event) => setSearch(event.target.value)} className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none focus:border-[var(--brand-orange)]" />
          </div>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="px-3 py-2.5 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]">
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
            {forms.filter((form) => !search || form.name.toLowerCase().includes(search.toLowerCase())).map((form) => {
              const collection = form.collection_id ? collections.find((candidate) => candidate.id === form.collection_id) : null;
              return (
                <div key={form.id} className="p-5 rounded-2xl bg-secondary border border-[var(--border-primary)] hover:border-brand-orange/50 transition-all group">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-orange/10 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-[var(--brand-orange)]" />
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                      <button onClick={() => openBuilder(form)} className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--brand-orange)] hover:bg-tertiary"><Edit3 className="w-3 h-3" /></button>
                      <button onClick={() => handleDuplicate(form)} className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-blue-500 hover:bg-tertiary"><Copy className="w-3 h-3" /></button>
                      {form.status !== "archived" ? (
                        <button onClick={() => handleArchive(form.id)} className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-rose-500 hover:bg-tertiary" title={t("platformMisc.forms.archiveTitle")}><Archive className="w-3 h-3" /></button>
                      ) : (
                        <>
                          <button onClick={() => handleUnarchive(form.id)} className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-emerald-500 hover:bg-tertiary" title={t("platformMisc.forms.restoreTitle")}><RotateCcw className="w-3 h-3" /></button>
                          <button onClick={() => handleDeletePermanently(form.id)} className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-rose-500 hover:bg-tertiary" title={t("platformMisc.forms.deleteTitle")}><Trash2 className="w-3 h-3" /></button>
                        </>
                      )}
                    </div>
                  </div>
                  <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">{form.name}</h3>
                  {form.description && <p className="text-[10px] text-[var(--text-secondary)] mt-1">{form.description}</p>}
                  {collection && <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-2 opacity-50">{t("platformMisc.forms.inCollection", { name: collection.name })}</p>}
                  <div className="flex items-center gap-2 mt-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${form.status === "published" ? "text-emerald-500 bg-emerald-500/10" : form.status === "draft" ? "text-amber-500 bg-amber-500/10" : "text-rose-500 bg-rose-500/10"}`}>{FORM_STATUS_KEYS[form.status] ? t("platformMisc.forms." + FORM_STATUS_KEYS[form.status]) : form.status}</span>
                    <span className="text-[10px] font-medium text-[var(--text-secondary)]">v{form.version || 1}</span>
                  </div>

                </div>
              );
            })}
          </div>
        )}

        {/* Create modal */}
        {showCreate && (
          <div className="fixed inset-0 z-[400] bg-black/40 flex items-center justify-center p-6" onClick={() => { setShowCreate(false); setCreateMode("manual"); setAiGenText(""); }}>
            <div className="card w-full max-w-md space-y-5" onClick={(event) => event.stopPropagation()}>
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">{t("platformMisc.forms.newForm")}</h3>
                <button onClick={() => { setShowCreate(false); setCreateMode("manual"); setAiGenText(""); }}><X className="w-5 h-5" /></button>
              </div>

              {/* Mode Switcher */}
              <div className="flex gap-2 p-1 rounded-xl bg-tertiary">
                <button onClick={() => setCreateMode("manual")} className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${createMode === "manual" ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)]"}`}>{t("platformMisc.forms.createManual")}</button>
                {canCreate && <button onClick={() => setCreateMode("ai")} className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${createMode === "ai" ? "bg-indigo-500 text-white" : "text-[var(--text-secondary)]"}`}>{t("platformMisc.forms.createGenerateAi")}</button>}
              </div>

              {createMode === "manual" ? (
                <>
                  <div className="space-y-4">
                    <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.name")}</label><input value={createForm.name} onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })} className="w-full rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--brand-orange)]" placeholder={t("platformMisc.forms.namePlaceholder")} /></div>
                    <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.description")}</label><textarea value={createForm.description} onChange={(event) => setCreateForm({ ...createForm, description: event.target.value })} rows={2} className="w-full rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--brand-orange)] resize-none" placeholder={t("platformMisc.forms.descriptionPlaceholder")} /></div>
                    <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.collection")}</label>
                      <select value={createForm.collection_id} onChange={(event) => setCreateForm({ ...createForm, collection_id: event.target.value })} className="w-full rounded-xl px-3 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--brand-orange)]">
                        <option value="">{t("platformMisc.forms.none")}</option>
                        {collections.filter((collection) => collection.status !== "archived" || String(collection.id) === createForm.collection_id).map((collection) => <option key={collection.id} value={collection.id}>{collection.name}{collection.status === "archived" ? t("platformMisc.forms.archivedSuffix") : ""}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.tags")}</label><input value={createForm.tags} onChange={(event) => setCreateForm({ ...createForm, tags: event.target.value })} className="w-full rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--brand-orange)]" placeholder={t("platformMisc.forms.tagsPlaceholder")} /></div>
                  </div>
                  <div className="flex gap-3"><button onClick={() => setShowCreate(false)} className="flex-1 btn btn-secondary">{t("platformMisc.forms.cancel")}</button><button onClick={handleCreateForm} disabled={saving || !createForm.name.trim()} className="flex-1 btn btn-primary">{saving ? t("platformMisc.forms.creating") : t("platformMisc.forms.createAndEdit")}</button></div>
                </>
              ) : (
                <>
                  <div className="space-y-4">
                    <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">{t("platformMisc.forms.aiGenHint")}</p>
                    <textarea
                      value={aiGenText}
                      onChange={(event) => setAiGenText(event.target.value)}
                      rows={8}
                      placeholder={t("platformMisc.forms.aiGenTextPlaceholder")}
                      className="w-full rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--brand-orange)] resize-none"
                    />
                    <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.collection")}</label>
                      <select value={createForm.collection_id} onChange={(event) => setCreateForm({ ...createForm, collection_id: event.target.value })} className="w-full rounded-xl px-3 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--brand-orange)]">
                        <option value="">{t("platformMisc.forms.none")}</option>
                        {collections.filter((collection) => collection.status !== "archived" || String(collection.id) === createForm.collection_id).map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => { setCreateMode("manual"); setAiGenText(""); }} className="flex-1 btn btn-secondary">{t("platformMisc.forms.back")}</button>
                    {canCreate && (
                    <button
                      onClick={async () => {
                        if (!aiGenText.trim()) return;
                        setAiGenLoading(true);
                        try {
                          const response = await fetch("/api/platform/ai/generate-all", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: aiGenText, collection_id: createForm.collection_id || null }) });
                          const data = await response.json();
                          if (data.success) {
                            const parts = [];
                            if (data.sections) parts.push(t("platformMisc.forms.aiPartsSections", { count: data.sections }));
                            if (data.fields) parts.push(t("platformMisc.forms.aiPartsQuestions", { count: data.fields }));
                            if (data.evaluation_dimensions) parts.push(t("platformMisc.forms.aiPartsEvalDimensions", { count: data.evaluation_dimensions }));
                            notify(t("platformMisc.forms.aiCreated", { title: data.title, parts: parts.join(", ") }));
                            setShowCreate(false);
                            setCreateMode("manual");
                            setAiGenText("");
                            refreshForms();
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
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}


      {/* Archive Confirmation Modal */}
      {archiveConfirm && (
        <div className="fixed inset-0 z-[500] bg-black/50 flex items-center justify-center p-6" onClick={() => setArchiveConfirm(null)}>
          <div className="card w-full max-w-sm space-y-5" onClick={(event) => event.stopPropagation()}>
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
                <p className="text-[10px] font-bold text-amber-500 uppercase">{t("platformMisc.forms.archiveWhatHappens")}</p>
                <ul className="text-[10px] font-medium text-[var(--text-secondary)] space-y-1 list-disc list-inside">
                  <li>{t("platformMisc.forms.archiveBulletHidden")}</li>
                  <li>{t("platformMisc.forms.archiveBulletRuns")}</li>
                  <li>{t("platformMisc.forms.archiveBulletRestore")}</li>
                </ul>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                <p className="text-[10px] font-bold text-emerald-500 uppercase">{t("platformMisc.forms.restoreWhatHappens")}</p>
                <ul className="text-[10px] font-medium text-[var(--text-secondary)] space-y-1 list-disc list-inside">
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
  const formFieldsForSection = (sectionId) => fields.filter((field) => field.section_id === sectionId);
  const orphanFields = fields.filter((field) => !field.section_id);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {notification && <div className="fixed bottom-6 right-6 z-[500] px-5 py-3 rounded-xl bg-emerald-500 text-black text-[10px] font-black uppercase">{notification}</div>}

      {/* Builder header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--border-primary)] bg-secondary shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => { setShowBuilder(false); setEditingForm(null); }} className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)] hover:text-[var(--text-primary)]">← {t("platformMisc.forms.back")}</button>
          <span className="text-[var(--text-secondary)] opacity-30">|</span>
          <h2 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">{editingForm?.name}</h2>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${editingForm?.status === "published" ? "text-emerald-500 bg-emerald-500/10" : "text-amber-500 bg-amber-500/10"}`}>{editingForm?.status ? (FORM_STATUS_KEYS[editingForm.status] ? t("platformMisc.forms." + FORM_STATUS_KEYS[editingForm.status]) : editingForm.status) : t("platformMisc.forms.statusDraft")}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowAiEval(!showAiEval); setShowScoring(false); setShowTemplates(false); }} className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all ${showAiEval ? "bg-purple-500 text-white" : "bg-tertiary border border-[var(--border-primary)] text-[var(--text-secondary)]"}`}>
            <Sparkles className="w-3 h-3 inline mr-1.5" />{t("platformMisc.forms.builderAiEval")} {aiEvalFramework && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />}
          </button>
          <button onClick={() => { setShowScoring(!showScoring); setShowAiEval(false); setShowWorkflow(false); setShowTemplates(false); }} className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all ${showScoring ? "bg-indigo-500 text-white" : "bg-tertiary border border-[var(--border-primary)] text-[var(--text-secondary)]"}`}>
            <BarChart3 className="w-3 h-3 inline mr-1.5" />{t("platformMisc.forms.builderScoring")} {scoringConfig?.enabled && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />}
          </button>
          <button onClick={() => { setShowWorkflow(!showWorkflow); setShowAiEval(false); setShowScoring(false); setShowTemplates(false); }} className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all ${showWorkflow ? "bg-amber-500 text-white" : "bg-tertiary border border-[var(--border-primary)] text-[var(--text-secondary)]"}`}>
            <GitBranch className="w-3 h-3 inline mr-1.5" />{t("platformMisc.forms.builderWorkflow")} {workflowConfig && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />}
          </button>
          <button onClick={() => { setShowTemplates(!showTemplates); setShowAiEval(false); setShowScoring(false); setShowWorkflow(false); }} className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all ${showTemplates ? "bg-cyan-500 text-white" : "bg-tertiary border border-[var(--border-primary)] text-[var(--text-secondary)]"}`}>
            <Mail className="w-3 h-3 inline mr-1.5" />{t("platformMisc.forms.builderTemplates")} {templateConfig && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />}
          </button>
          <button onClick={() => setPreviewMode(!previewMode)} className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all ${previewMode ? "bg-[var(--brand-orange)] text-black" : "bg-tertiary border border-[var(--border-primary)] text-[var(--text-secondary)]"}`}>
            <Eye className="w-3 h-3 inline mr-1.5" />{previewMode ? t("platformMisc.forms.previewEditing") : t("platformMisc.forms.previewPreview")}
          </button>
          <button onClick={() => saveFields(false)} disabled={saving} className="px-3 py-2 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)] hover:text-[var(--text-primary)]">{saving ? t("platformMisc.forms.saving") : t("platformMisc.forms.save")}</button>
          {editingForm?.status === "published" ? (
            <>
              <button onClick={() => saveFields(true)} disabled={saving} className="px-3 py-2 rounded-xl bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-wide hover:bg-indigo-600 transition-all">
                {saving ? t("platformMisc.forms.publishing") : t("platformMisc.forms.republish")}
              </button>
              <button onClick={async () => {
                // Auto-create a run for this form and navigate to it
                setSaving(true);
                try {
                  const response = await fetch("/api/platform/form-runs", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ form_id: editingForm.id, name: editingForm.name + " Run", description: "Auto-created from form builder" }),
                  });
                  const data = await response.json();
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
              }} disabled={saving} className="px-4 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-sm font-bold uppercase tracking-wide hover:brightness-110 shadow-[0_0_15px_rgba(255,102,0,0.3)] border border-[var(--brand-orange)] flex items-center">
                <Play className="w-3 h-3 inline mr-1.5" /> {saving ? t("platformMisc.forms.creating") : t("platformMisc.forms.launchAndCollect")}
              </button>
            </>
          ) : (
            <button onClick={() => handlePublish()} disabled={saving} className="px-4 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-sm font-bold uppercase tracking-wide hover:brightness-110">{saving ? t("platformMisc.forms.publishing") : t("platformMisc.forms.publish")}</button>
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
              <input type="checkbox" checked={scoringConfig.enabled} onChange={(event) => setScoringConfig({ ...scoringConfig, enabled: event.target.checked })} className="w-4 h-4 rounded accent-indigo-500" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-primary)]">{t("platformMisc.forms.scoringEnable")}</p>
                <p className="text-[10px] font-medium text-[var(--text-secondary)]">{t("platformMisc.forms.scoringAutoCalc")}</p>
              </div>
            </label>
            <div className="space-y-1 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.scoringMaxPerQuestion")}</label>
              <input type="number" min={0} value={scoringConfig.max_per_question ?? ""} onChange={(event) => { const nextValue = event.target.value; setScoringConfig({ ...scoringConfig, max_per_question: nextValue === "" ? 0 : parseInt(nextValue) || 0 }); }} className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none" placeholder="0" />
            </div>
            <div className="space-y-1 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.scoringTotalWeight")}</label>
              <p className={`text-xl font-black ${Object.values(scoringConfig.sections || {}).reduce((total, section) => total + (section.weight || 0), 0) === 100 ? "text-emerald-400" : "text-rose-400"}`}>
                {Object.values(scoringConfig.sections || {}).reduce((total, section) => total + (section.weight || 0), 0)}%
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
                    <tr className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                      <th className="px-3 py-2">{t("platformMisc.forms.scoringTableSection")}</th>
                      <th className="px-3 py-2">{t("platformMisc.forms.scoringTableWeight")}</th>
                      <th className="px-3 py-2">{t("platformMisc.forms.scoringTableScoredFields")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-primary)]">
                    {sections.map((section) => {
                      const sectionFields = fields.filter((field) => field.section_id === section.id);
                      const ratingFields = sectionFields.filter((field) => field.field_type === "rating");
                      const sectionKey = section.title;
                      const currentWeight = (scoringConfig.sections?.[sectionKey]?.weight) || 0;
                      const currentLabels = scoringConfig.sections?.[sectionKey]?.field_labels || [];
                      return (
                        <tr key={section.title} className="text-[10px] font-bold text-[var(--text-primary)]">
                          <td className="px-3 py-2">{section.title}</td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={currentWeight}
                              onChange={(event) => setScoringConfig({
                                ...scoringConfig,
                                sections: { ...scoringConfig.sections, [sectionKey]: { ...scoringConfig.sections?.[sectionKey], weight: parseInt(event.target.value) || 0, field_labels: scoringConfig.sections?.[sectionKey]?.field_labels || ratingFields.map((field) => field.label) } },
                              })}
                              className="w-16 px-2 py-1 rounded bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1">
                              {ratingFields.map((field) => {
                                const isScored = currentLabels.includes(field.label);
                                return (
                                  <button
                                    key={field.label}
                                    onClick={() => {
                                      const nextLabels = isScored ? currentLabels.filter((label) => label !== field.label) : [...currentLabels, field.label];
                                      setScoringConfig({
                                        ...scoringConfig,
                                        sections: { ...scoringConfig.sections, [sectionKey]: { ...scoringConfig.sections?.[sectionKey], weight: currentWeight, field_labels: nextLabels } },
                                      });
                                    }}
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase transition-all ${isScored ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30" : "bg-tertiary text-[var(--text-secondary)] border border-[var(--border-primary)]"}`}
                                  >
                                    {field.label.substring(0, 30)}{field.label.length > 30 ? "..." : ""}
                                  </button>
                                );
                              })}
                              {ratingFields.length === 0 && <span className="text-[10px] font-medium text-[var(--text-secondary)]">{t("platformMisc.forms.scoringNoRatingFields")}</span>}
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
                {(scoringConfig.rankings || []).map((rank, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                    <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: rank.color || "#64748b" }} />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={rank.min}
                      onChange={(event) => {
                        const nextRankings = [...(scoringConfig.rankings || [])];
                        nextRankings[index] = { ...nextRankings[index], min: parseInt(event.target.value) || 0 };
                        setScoringConfig({ ...scoringConfig, rankings: nextRankings });
                      }}
                      className="w-14 px-2 py-1 rounded bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none text-center"
                      placeholder={t("platformMisc.forms.rankingMin")}
                    />
                    <span className="text-[var(--text-secondary)] text-[10px]">–</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={rank.max}
                      onChange={(event) => {
                        const nextRankings = [...(scoringConfig.rankings || [])];
                        nextRankings[index] = { ...nextRankings[index], max: parseInt(event.target.value) || 0 };
                        setScoringConfig({ ...scoringConfig, rankings: nextRankings });
                      }}
                      className="w-14 px-2 py-1 rounded bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none text-center"
                      placeholder={t("platformMisc.forms.rankingMax")}
                    />
                    <input
                      type="text"
                      value={rank.label}
                      onChange={(event) => {
                        const nextRankings = [...(scoringConfig.rankings || [])];
                        nextRankings[index] = { ...nextRankings[index], label: event.target.value };
                        setScoringConfig({ ...scoringConfig, rankings: nextRankings });
                      }}
                      className="flex-1 px-2 py-1 rounded bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
                      placeholder={t("platformMisc.forms.rankingLabel")}
                    />
                    <input
                      type="text"
                      value={rank.color || ""}
                      onChange={(event) => {
                        const nextRankings = [...(scoringConfig.rankings || [])];
                        nextRankings[index] = { ...nextRankings[index], color: event.target.value };
                        setScoringConfig({ ...scoringConfig, rankings: nextRankings });
                      }}
                      className="w-20 px-2 py-1 rounded bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none font-mono"
                      placeholder="#color"
                    />
                    <button onClick={() => {
                      const nextRankings = [...(scoringConfig.rankings || [])];
                      nextRankings.splice(index, 1);
                      setScoringConfig({ ...scoringConfig, rankings: nextRankings });
                    }} className="text-rose-500 hover:text-rose-400 shrink-0"><MinusCircle className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
                <button onClick={() => setScoringConfig({
                  ...scoringConfig,
                  rankings: [...(scoringConfig.rankings || []), { min: 0, max: 100, label: "New Tier", color: "#64748b" }],
                })} className="flex items-center gap-1 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 uppercase"><PlusCircle className="w-3 h-3" /> {t("platformMisc.forms.scoringAddRankingTier")}</button>
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
                      body: JSON.stringify({ id: editingForm.id, settings: { ...(editingForm.settings || {}), venture_application: isVentureForm, workflow: workflowConfig, automation: automationConfig || DEFAULT_AUTOMATION } }),
                    });
                    notify(t("platformMisc.forms.notifyWorkflowSaved"));
                  } catch (_) {}
                  setSaving(false);
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wide hover:bg-amber-600 transition-all"
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
            const workflow = workflowConfig || { decisions: [], statusLabels: {} };
            const defaults = [
              { id: "approved", defaultLabel: "Approve", defaultColor: "emerald" },
              { id: "rejected", defaultLabel: "Reject", defaultColor: "rose" },
              { id: "revision_requested", defaultLabel: "Request Revision", defaultColor: "amber" },
            ];
            const decisions = defaults.map(defaultDecision => {
              const existing = (workflow.decisions || []).find(candidate => candidate.id === defaultDecision.id);
              return existing || { id: defaultDecision.id, label: defaultDecision.defaultLabel, color: defaultDecision.defaultColor, icon: "CheckCircle2" };
            });

            return (
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">{t("platformMisc.forms.workflowDecisionButtons")}</h4>
                <div className="grid grid-cols-3 gap-3">
                  {decisions.map((decision, index) => (
                    <div key={decision.id} className="space-y-2 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                        {decision.id === "approved" ? t("platformMisc.forms.decisionPositive") : decision.id === "rejected" ? t("platformMisc.forms.decisionNegative") : t("platformMisc.forms.decisionNeedsWork")}
                      </label>
                      <input
                        value={decision.label}
                        onChange={event => {
                          const nextDecisions = [...decisions];
                          nextDecisions[index] = { ...nextDecisions[index], label: event.target.value };
                          setWorkflowConfig({ ...workflow, decisions: nextDecisions });
                        }}
                        placeholder={t("platformMisc.forms." + DECISION_DEFAULT_KEYS[decision.id])}
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
                  ].map(statusOption => {
                    const labelValue = (workflow.statusLabels || {})[statusOption.id] || "";
                    return (
                      <div key={statusOption.id} className="space-y-2 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms." + WORKFLOW_STATUS_LABEL_KEYS[statusOption.id])} →</label>
                        <input
                          value={labelValue}
                          onChange={event => setWorkflowConfig({ ...workflow, statusLabels: { ...(workflow.statusLabels || {}), [statusOption.id]: event.target.value } })}
                          placeholder={t("platformMisc.forms." + WORKFLOW_STATUS_LABEL_KEYS[statusOption.id])}
                          className="w-full px-2 py-1.5 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
                        />
                      </div>
                    );
                  })}
                </div>

                <h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] pt-4">{t("platformMisc.forms.workflowAutomationActions")}</h4>
                <p className="text-[10px] font-medium text-[var(--text-secondary)] mb-3">{t("platformMisc.forms.workflowAutomationHint")}</p>

                {/* Venture Application flag — approval of this form's submissions creates a Venture */}
                {(() => {
                  const ventureOwner = forms.find(
                    (candidate) =>
                      candidate.id !== editingForm?.id &&
                      (candidate.settings?.venture_application === true || candidate.settings?.venture_application === "true")
                  );
                  const locked = !!ventureOwner && !isVentureForm;
                  return (
                    <div className="mb-3">
                      <label className={`flex items-start gap-3 p-3 rounded-xl bg-tertiary border border-brand-orange/30 ${locked ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}>
                        <input
                          type="checkbox"
                          checked={isVentureForm}
                          disabled={locked}
                          onChange={(event) => setIsVentureForm(event.target.checked)}
                          className="mt-0.5 w-4 h-4 accent-[var(--brand-orange)]"
                        />
                        <span>
                          <span className="block text-[10px] font-black uppercase tracking-wider text-[var(--brand-orange)]">{t("platformMisc.forms.ventureFormLabel")}</span>
                          <span className="block text-[9px] text-[var(--text-secondary)]">{t("platformMisc.forms.ventureFormDesc")}</span>
                        </span>
                      </label>
                      {locked && (
                        <p className="text-[9px] text-[var(--text-secondary)] px-1 -mt-1">
                          {t("platformMisc.forms.ventureFormLockedPrefix")}{" "}
                          <b className="text-[var(--brand-orange)]">{ventureOwner.name}</b>.{" "}
                          {t("platformMisc.forms.ventureFormLockedSuffix")}
                        </p>
                      )}
                    </div>
                  );
                })()}

                {(() => {
                  const autoCfg = automationConfig || DEFAULT_AUTOMATION;
                  const update = (path, value) => {
                    const nextConfig = JSON.parse(JSON.stringify(autoCfg));
                    const keys = path.split(".");
                    let target = nextConfig;
                    for (let keyIndex = 0; keyIndex < keys.length - 1; keyIndex++) target = target[keys[keyIndex]];
                    target[keys[keys.length - 1]] = value;
                    setAutomationConfig(nextConfig);
                  };
                  const Toggle = ({ path, label, desc }) => {
                    const keys = path.split(".");
                    let currentValue = autoCfg;
                    for (const key of keys) currentValue = currentValue?.[key];
                    return (
                      <label className="flex items-center gap-3 p-2 rounded-lg bg-tertiary/50 cursor-pointer hover:bg-amber-500/5 transition-all">
                        <input type="checkbox" checked={!!currentValue} onChange={(event) => update(path, event.target.checked)} className="w-3.5 h-3.5 rounded accent-amber-500 shrink-0" />
                        <div><p className="text-[10px] font-bold text-[var(--text-primary)]">{label}</p>{desc && <p className="text-[10px] font-medium text-[var(--text-secondary)]">{desc}</p>}</div>
                      </label>
                    );
                  };
                  return (
                    <div className="space-y-2 pl-1">
                      {/* The applicant-email switches are a RUN decision: the run's
                          Settings tab owns them (see the run screen). The form
                          keeps only its scoring policy below. Values already
                          stored here stay as the default every run of this form
                          inherits — lib/platform/automationSettings.js resolves
                          run → form → on — so nothing configured before this
                          change stops applying. */}
                      <p className="text-[10px] font-medium text-[var(--text-secondary)]">{t("platformMisc.forms.automationMovedToRun")}</p>
                      <p className="text-[10px] font-bold text-emerald-400 uppercase pt-2">{t("platformMisc.forms.automationAutoApproval")}</p>
                      <Toggle path="auto_approve" label={t("platformMisc.forms.autoApproveScoreLabel")} desc={t("platformMisc.forms.autoApproveScoreDesc")} />
                      <div className="flex items-center gap-3 pt-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.autoCutoffScore")}</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={autoCfg.auto_approve_cutoff ?? 80}
                          onChange={(event) => update("auto_approve_cutoff", event.target.value === "" ? null : parseFloat(event.target.value))}
                          className="w-24 px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-emerald-500"
                        />
                        <span className="text-[10px] font-bold text-[var(--text-secondary)]">%</span>
                      </div>
                      <p className="text-[10px] text-[var(--text-secondary)] mt-1">{t("platformMisc.forms.autoCutoffHint")}</p>
                    </div>
                  );
                })()}

                <h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] pt-4">{t("platformMisc.forms.workflowSuccessMessage")}</h4>
                <p className="text-[10px] font-medium text-[var(--text-secondary)] mb-3">{t("platformMisc.forms.workflowSuccessHint")}</p>
                <textarea
                  value={automationConfig?.success_message || DEFAULT_AUTOMATION.success_message || ""}
                  onChange={(event) => setAutomationConfig({ ...(automationConfig || DEFAULT_AUTOMATION), success_message: event.target.value })}
                  rows={4}
                  placeholder={t("platformMisc.forms.successMessagePlaceholder")}
                  className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-medium text-[var(--text-primary)] outline-none focus:border-amber-500 resize-y font-mono"
                />
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.redirectAfterSubmitLabel")}</label>
                  <input
                    type="url"
                    value={automationConfig?.redirect_after_submit || ""}
                    onChange={(event) => setAutomationConfig({ ...(automationConfig || DEFAULT_AUTOMATION), redirect_after_submit: event.target.value })}
                    placeholder="https://example.com/thank-you"
                    className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-amber-500"
                  />
                </div>
                <p className="text-[10px] font-medium text-[var(--text-secondary)]">{t("platformMisc.forms.workflowPlaceholdersHint")}</p>

                <button
                  onClick={() => setWorkflowConfig(null)}
                  className="text-[10px] font-bold text-rose-500 hover:text-rose-400 uppercase tracking-wide"
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
                className="px-3 py-1.5 rounded-lg bg-cyan-500 text-white text-[10px] font-bold uppercase tracking-wide hover:bg-cyan-600 transition-all"
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
            const templateData = templateConfig || {};
            const updateTemplate = (templateKey, fieldName, value) => {
              const nextTemplates = JSON.parse(JSON.stringify(templateData));
              if (!nextTemplates[templateKey]) nextTemplates[templateKey] = {};
              nextTemplates[templateKey][fieldName] = value;
              setTemplateConfig(nextTemplates);
            };

            // Ask the existing AI layer to write (or improve) a template,
            // then fill the subject/body fields — saving stays manual.
            const personalize = async (templateKey, label) => {
              if (personalizing) return;
              setPersonalizing(templateKey);
              try {
                const response = await fetch("/api/platform/ai/personalize-template", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    template_key: templateKey,
                    form_name: editingForm?.name || "",
                    organization: "Future Studio",
                    existing_subject: templateData[templateKey]?.subject || "",
                    existing_body: templateData[templateKey]?.body || "",
                  }),
                });
                const data = await response.json();
                if (data.success) {
                  updateTemplate(templateKey, "subject", data.subject);
                  updateTemplate(templateKey, "body", data.body);
                  notify(t("platformMisc.forms.templatePersonalized", { label }));
                } else {
                  notify(data.error || t("platformMisc.forms.templatePersonalizeFailed"));
                }
              } catch (_) {
                notify(t("platformMisc.forms.templatePersonalizeNetworkError"));
              }
              setPersonalizing(null);
            };

            return (
              <div className="space-y-3">
                <TemplateEditor
                  label={t("platformMisc.forms.templateSubmissionLabel")} icon={Send}
                  tKey="acknowledgement"
                  desc={t("platformMisc.forms.templateSubmissionDesc")}
                  defaultSubject={t("platformMisc.forms.templateSubmissionSubject")}
                  defaultBody={t("platformMisc.forms.templateSubmissionBody")}
                  vars={TEMPLATE_VARIABLES.acknowledgement}
                  onPersonalize={personalize}
                  personalizingKey={personalizing}
                  templates={templateData}
                  onChange={updateTemplate}
                />
                <TemplateEditor
                  label={t("platformMisc.forms.templateApprovalLabel")} icon={CheckCircle2}
                  tKey="approval"
                  desc={t("platformMisc.forms.templateApprovalDesc")}
                  defaultSubject={t("platformMisc.forms.templateApprovalSubject")}
                  defaultBody={t("platformMisc.forms.templateApprovalBody")}
                  vars={TEMPLATE_VARIABLES.approval}
                  onPersonalize={personalize}
                  personalizingKey={personalizing}
                  templates={templateData}
                  onChange={updateTemplate}
                />
                <TemplateEditor
                  label={t("platformMisc.forms.templateActivationLabel")} icon={Key}
                  tKey="activation"
                  desc={t("platformMisc.forms.templateActivationDesc")}
                  defaultSubject={t("platformMisc.forms.templateActivationSubject")}
                  defaultBody={t("platformMisc.forms.templateActivationBody")}
                  vars={TEMPLATE_VARIABLES.activation}
                  onPersonalize={personalize}
                  personalizingKey={personalizing}
                  templates={templateData}
                  onChange={updateTemplate}
                />
                <TemplateEditor
                  label={t("platformMisc.forms.templateExistingUserLabel")} icon={LogIn}
                  tKey="existing_user"
                  desc={t("platformMisc.forms.templateExistingUserDesc")}
                  defaultSubject={t("platformMisc.forms.templateExistingUserSubject")}
                  defaultBody={t("platformMisc.forms.templateExistingUserBody")}
                  vars={TEMPLATE_VARIABLES.existing_user}
                  onPersonalize={personalize}
                  personalizingKey={personalizing}
                  templates={templateData}
                  onChange={updateTemplate}
                />
                <TemplateEditor
                  label={t("platformMisc.forms.templateRejectionLabel")} icon={XCircle}
                  tKey="rejection"
                  desc={t("platformMisc.forms.templateRejectionDesc")}
                  defaultSubject={t("platformMisc.forms.templateRejectionSubject")}
                  defaultBody={t("platformMisc.forms.templateRejectionBody")}
                  vars={TEMPLATE_VARIABLES.rejection}
                  onPersonalize={personalize}
                  personalizingKey={personalizing}
                  templates={templateData}
                  onChange={updateTemplate}
                />
                <TemplateEditor
                  label={t("platformMisc.forms.templateResultLabel")} icon={FileText}
                  tKey="result"
                  desc={t("platformMisc.forms.templateResultDesc")}
                  defaultSubject={t("platformMisc.forms.templateResultSubject")}
                  defaultBody={t("platformMisc.forms.templateResultBody")}
                  vars={TEMPLATE_VARIABLES.result}
                  onPersonalize={personalize}
                  personalizingKey={personalizing}
                  templates={templateData}
                  onChange={updateTemplate}
                />

                {/* The result message can also be timed: the delay lives with the
                    template it belongs to, and a run may override it. */}
                <ResultDelayEditor
                  title={t("platformMisc.forms.templateResultDelayTitle")}
                  description={t("platformMisc.forms.templateResultDelayDesc")}
                  hoursLabel={t("platformMisc.forms.templateResultDelayUnitHours")}
                  minutesLabel={t("platformMisc.forms.templateResultDelayUnitMinutes")}
                  afterLabel={t("platformMisc.forms.templateResultDelayAfterSubmission")}
                  footnote={t("platformMisc.forms.templateResultDelayHint")}
                  value={readResultDelayMinutes(templateData.result) ?? 0}
                  onChange={(minutes) => updateTemplate("result", "delay_minutes", minutes)}
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
              {canEdit && (
              <button
                onClick={async () => {
                  setSaving(true);
                  try {
                    const response = await fetch("/api/platform/ai/evaluation-config", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ form_id: editingForm.id, framework: aiEvalFramework })
                    });
                    if (response.ok) notify(t("platformMisc.forms.aiEvalFrameworkSaved"));
                    else notify(t("platformMisc.forms.aiEvalSaveFailed"));
                  } catch {}
                  setSaving(false);
                }}
                disabled={saving}
                className="px-3 py-1.5 rounded-lg bg-purple-500 text-white text-[10px] font-bold uppercase tracking-wide hover:bg-purple-600 transition-all"
              >
                {t("platformMisc.forms.aiEvalSaveFramework")}
              </button>
              )}
              <button onClick={() => setShowAiEval(false)}><X className="w-4 h-4 text-[var(--text-secondary)]" /></button>
            </div>
          </div>

          {/* Enable AI Evaluation toggle */}
          <label className="flex items-center gap-3 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)] cursor-pointer">
            <input
              type="checkbox"
              checked={!!(editingForm?.settings?.ai_evaluation)}
              onChange={async (event) => {
                const enabled = event.target.checked;
                const updatedSettings = { ...(editingForm?.settings || {}), ai_evaluation: enabled };
                setEditingForm(previousForm => ({ ...previousForm, settings: updatedSettings }));
                try {
                  await fetch("/api/platform/forms", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingForm.id, settings: updatedSettings }) });
                  notify(enabled ? t("platformMisc.forms.aiEvalEnabled") : t("platformMisc.forms.aiEvalDisabled"));
                } catch (_) {}
              }}
              className="w-4 h-4 rounded accent-purple-500"
            />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-primary)]">{t("platformMisc.forms.aiEvalEnable")}</p>
              <p className="text-[10px] font-medium text-[var(--text-secondary)]">{t("platformMisc.forms.aiEvalEnableHint")}</p>
            </div>
          </label>

          {aiEvalFramework ? (
            <>
              {/* Weight validation */}
              {(() => {
                const total = (aiEvalFramework.dimensions || []).reduce((sum, dimension) => sum + (parseInt(dimension.weight) || 0), 0);
                return total !== 100 ? (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[10px] font-bold text-amber-400">
                    {t("platformMisc.forms.aiEvalWeightsWarning", { total })}
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-bold text-emerald-400">
                    {t("platformMisc.forms.aiEvalWeightsReady")}
                  </div>
                );
              })()}

              {/* Editable dimensions table */}
              <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)]">
                <table className="w-full text-left">
                  <thead className="bg-tertiary">
                    <tr className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                      <th className="px-2 py-2">{t("platformMisc.forms.aiEvalTableDimension")}</th>
                      <th className="px-2 py-2 w-16">{t("platformMisc.forms.aiEvalTableWeight")}</th>
                      <th className="px-2 py-2">{t("platformMisc.forms.aiEvalTableCriteria")}</th>
                      <th className="px-2 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-primary)]">
                    {(aiEvalFramework.dimensions || []).map((dimension, index) => (
                      <tr key={index} className="text-[10px]">
                        <td className="px-2 py-1.5">
                          <input
                            value={dimension.name}
                            onChange={(event) => {
                              const dimensions = [...aiEvalFramework.dimensions];
                              dimensions[index] = { ...dimensions[index], name: event.target.value };
                              setAiEvalFramework({ ...aiEvalFramework, dimensions });
                            }}
                            className="w-full px-2 py-1 rounded bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={dimension.weight}
                            onChange={(event) => {
                              const dimensions = [...aiEvalFramework.dimensions];
                              dimensions[index] = { ...dimensions[index], weight: parseInt(event.target.value) || 0 };
                              setAiEvalFramework({ ...aiEvalFramework, dimensions });
                            }}
                            className="w-full px-1 py-1 rounded bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            value={(dimension.criteria || []).join(", ")}
                            onChange={(event) => {
                              const dimensions = [...aiEvalFramework.dimensions];
                              dimensions[index] = { ...dimensions[index], criteria: event.target.value.split(",").map(criterion => criterion.trim()).filter(Boolean) };
                              setAiEvalFramework({ ...aiEvalFramework, dimensions });
                            }}
                            className="w-full px-2 py-1 rounded bg-primary border border-[var(--border-primary)] text-[10px] text-[var(--text-primary)] outline-none"
                            placeholder={t("platformMisc.forms.aiEvalCriteriaPlaceholder")}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <button
                            onClick={() => {
                              const dimensions = [...aiEvalFramework.dimensions];
                              dimensions.splice(index, 1);
                              setAiEvalFramework({ ...aiEvalFramework, dimensions });
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
                  className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 uppercase tracking-wide"
                >
                  {t("platformMisc.forms.aiEvalAddDimension")}
                </button>
              </div>

              {canEdit && (
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    const total = (aiEvalFramework.dimensions || []).reduce((sum, dimension) => sum + (parseInt(dimension.weight) || 0), 0);
                    if (total !== 100) { notify(t("platformMisc.forms.aiEvalWeightsMustTotal")); return; }
                    if (!editingForm?.id) { notify(t("platformMisc.forms.aiEvalNoForm")); return; }
                    setAiEvalLoading(true);
                    try {
                      const payload = { form_id: Number(editingForm.id), framework: aiEvalFramework, source_document: aiEvalText?.substring(0, 500) || null };
                      const response = await fetch("/api/platform/ai/evaluation-config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                      if (response.ok) notify(t("platformMisc.forms.aiEvalFrameworkSaved"));
                      else { const errorData = await response.json(); notify(t((errorData.error || t("platformMisc.forms.saveFailed")) || "") || (errorData.error || t("platformMisc.forms.saveFailed"))); }
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
                    if (!(await confirm({ message: t("platformMisc.forms.aiEvalRemoveConfirm"), tone: "danger" }))) return;
                    await fetch(`/api/platform/ai/evaluation-config?form_id=${editingForm?.id}`, { method: "DELETE" });
                    setAiEvalFramework(null);
                    notify(t("platformMisc.forms.aiEvalFrameworkRemoved"));
                  }}
                  className="px-4 py-2.5 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-wide text-rose-500 hover:text-rose-400"
                >
                  {t("platformMisc.forms.remove")}
                </button>
              </div>
              )}
            </>
          ) : (
            <>
              <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                {t("platformMisc.forms.aiEvalEmptyHint")}
              </p>
              <textarea
                value={aiEvalText}
                onChange={(event) => setAiEvalText(event.target.value)}
                rows={6}
                placeholder={t("platformMisc.forms.aiEvalTextPlaceholder")}
                className="w-full rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--brand-orange)] resize-none"
              />
              {canEdit && (
              <button
                onClick={async () => {
                  if (!aiEvalText.trim()) return;
                  setAiEvalLoading(true);
                  try {
                    const response = await fetch("/api/platform/ai/generate-framework", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: aiEvalText }) });
                    const data = await response.json();
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
              )}
            </>
          )}
        </div>
      )}

      {/* Builder body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Field palette (left) */}
        {!previewMode && (
          <div className="w-56 shrink-0 bg-secondary border-r border-[var(--border-primary)] p-3 space-y-3 overflow-y-auto">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-50">{t("platformMisc.forms.paletteAddField")}</p>
            <button onClick={addSection} className="w-full p-2 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)] hover:text-[var(--text-primary)]">{t("platformMisc.forms.paletteAddSection")}</button>
            {FIELD_TYPES.map((type) => (
              <button key={type.value} onClick={() => addField(type.value)} className="w-full flex items-center gap-2 p-2 rounded-lg text-left text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary transition-all">
                <type.icon className="w-3.5 h-3.5" />{t("platformMisc.forms." + FIELD_TYPE_KEYS[type.value])}
              </button>
            ))}
            {/* Per-section quick-add */}
            {sections.map((section) => (
              <div key={section.id} className="pt-2 border-t border-[var(--border-primary)]">
                <button
                  onClick={() => setActiveSectionId(section.id)}
                  className={`w-full text-left p-1 rounded text-[10px] font-bold uppercase mb-1 transition-all ${activeSectionId === section.id ? 'text-[var(--brand-orange)] bg-brand-orange/10' : 'text-[var(--text-secondary)] opacity-50'}`}
                >
                  {t("platformMisc.forms.paletteInto", { title: section.title })} {activeSectionId === section.id && '✓'}
                </button>
                {FIELD_TYPES.slice(0, 6).map((type) => (
                  <button key={type.value} onClick={() => addField(type.value, section.id)} className="w-full flex items-center gap-2 p-1.5 rounded text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary">
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
            {sections.map((section, sectionIndex) => (
              <div key={sectionIndex} className="space-y-3">
                {!previewMode ? (
                  <div className="flex items-center gap-2 group">
                    <input value={section.title} onChange={(event) => updateSection(sectionIndex, { title: event.target.value })} className="text-sm font-black uppercase text-[var(--text-primary)] bg-transparent outline-none border-b-2 border-transparent focus:border-[var(--brand-orange)]" />
                    <button onClick={() => { if (sectionIndex > 0) { const nextSections = [...sections]; [nextSections[sectionIndex], nextSections[sectionIndex-1]] = [nextSections[sectionIndex-1], nextSections[sectionIndex]]; setSections(nextSections.map((item, index) => ({ ...item, sort_order: index }))); } }} disabled={sectionIndex === 0} className="opacity-0 group-hover:opacity-100 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-20"><ChevronUp className="w-3 h-3" /></button>
                    <button onClick={() => { if (sectionIndex < sections.length - 1) { const nextSections = [...sections]; [nextSections[sectionIndex], nextSections[sectionIndex+1]] = [nextSections[sectionIndex+1], nextSections[sectionIndex]]; setSections(nextSections.map((item, index) => ({ ...item, sort_order: index }))); } }} disabled={sectionIndex === sections.length - 1} className="opacity-0 group-hover:opacity-100 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-20"><ChevronDown className="w-3 h-3" /></button>
                    <button onClick={() => removeSection(sectionIndex)} className="opacity-0 group-hover:opacity-100 text-rose-500"><Trash2 className="w-3 h-3" /></button>
                  </div>
                ) : (
                  <h2 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)] pb-2 border-b border-[var(--border-primary)]">{section.title}</h2>
                )}
                {section.description && !previewMode && (
                  <textarea value={section.description} onChange={(event) => updateSection(sectionIndex, { description: event.target.value })} className="w-full text-[10px] text-[var(--text-secondary)] bg-transparent outline-none resize-none" rows={1} />
                )}
                <div className="space-y-2">
                  {formFieldsForSection(sections[sectionIndex]?.id).map((field) => renderFieldPreview(field))}
                </div>
              </div>
            ))}

            {/* Orphan Fields (legacy — should be empty with new architecture) */}
            {orphanFields.length > 0 && (
              <div className="space-y-3 pt-4 border-t-2 border-dashed border-amber-500/30">
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-500/70">
                  {t("platformMisc.forms.orphanFieldsTitle", { count: orphanFields.length })}
                </p>
                <div className="space-y-2">
                  {orphanFields.map((field) => <div key={field._tmpId}>{renderFieldPreview(field)}</div>)}
                </div>
              </div>
            )}

            {fields.length === 0 && <div className="py-16 text-center"><FileText className="w-12 h-12 mx-auto text-[var(--text-secondary)] opacity-20" /><p className="text-[11px] text-[var(--text-secondary)] mt-3 font-bold">{t("platformMisc.forms.emptyCanvasTitle")}</p><p className="text-[10px] font-medium text-[var(--text-secondary)] mt-1 opacity-50">{t("platformMisc.forms.emptyCanvasHint")}</p></div>}
          </div>
        </div>
      </div>

      {/* Republish Confirmation Modal */}
      {showRepublishConfirm && (
        <div className="fixed inset-0 z-[500] bg-black/50 flex items-center justify-center p-6" onClick={() => setShowRepublishConfirm(false)}>
          <div className="card w-full max-w-md space-y-5" onClick={(event) => event.stopPropagation()}>
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
                className="w-full px-4 py-3 text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] uppercase tracking-wide"
              >
                {t("platformMisc.forms.cancel")}
              </button>
            </div>
            <p className="text-[10px] font-medium text-[var(--text-secondary)] text-center opacity-50">
              {t("platformMisc.forms.republishFootnote")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

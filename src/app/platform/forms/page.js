"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  FileText, Plus, Search, Loader2, Edit3, Archive, Copy,
  Eye, Grid3X3, X, ChevronUp, ChevronDown, Trash2,
  CheckSquare, Circle, List, Hash, Mail, PhoneIcon, Calendar,
  Clock, Star, FileUp, Link, DollarSign, PenTool, AlignLeft,
  Type, Upload, BarChart3, PlusCircle, MinusCircle, RotateCcw, AlertTriangle,
} from "lucide-react";

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

export default function FormsPage() {
  const [forms, setForms] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [notification, setNotification] = useState(null);

  // Builder state
  const [editingForm, setEditingForm] = useState(null);
  const [sections, setSections] = useState([]);
  const [fields, setFields] = useState([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [selectedField, setSelectedField] = useState(null);
  const [addingFieldType, setAddingFieldType] = useState(null);

  // Scoring config panel
  const [showScoring, setShowScoring] = useState(false);
  const [scoringConfig, setScoringConfig] = useState(null);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", description: "", collection_id: "", visibility: "internal", tags: "" });

  // Archive confirmation
  const [archiveConfirm, setArchiveConfirm] = useState(null);

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

  const openBuilder = async (form) => {
    setEditingForm(form);
    setShowBuilder(true);
    setPreviewMode(false);

    // Load scoring config from form settings
    const formSettings = form.settings || {};
    setScoringConfig(formSettings.scoring && formSettings.scoring.enabled
      ? { ...formSettings.scoring }
      : { enabled: false, max_per_question: 0, sections: {}, rankings: [{ min: 0, max: 59, label: "Needs Work" }, { min: 60, max: 79, label: "Good" }, { min: 80, max: 100, label: "Excellent" }] }
    );

    try {
      const res = await fetch(`/api/platform/forms?id=${form.id}`);
      const data = await res.json();
      if (data.success) {
        const loadedSections = data.sections || [];
        const loadedFields = data.fields || [];
        // Auto-create default section if form has none (new forms start organized)
        if (loadedSections.length === 0) {
          const defaultSec = { id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, title: "Untitled Section", description: "", sort_order: 0 };
          setSections([defaultSec]);
          // Assign any existing orphan fields to this section
          if (loadedFields.length > 0) {
            setFields(loadedFields.map((f) => (f.section_id ? f : { ...f, section_id: defaultSec.id })));
          } else {
            setFields([]);
          }
        } else {
          setSections(loadedSections);
          setFields(loadedFields);
        }
      }
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
        openBuilder(data.form);
      }
    } catch (_) {}
    setSaving(false);
  };

  const handlePublish = async () => {
    if (!editingForm) return;
    setSaving(true);
    try {
      const res = await fetch("/api/platform/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish", id: editingForm.id, fields, sections }),
      });
      const data = await res.json();
      if (data.success) {
        notify(`Published version ${data.version}`);
        fetchForms();
      }
    } catch (_) {}
    setSaving(false);
  };

  const addSection = async () => {
    const tempId = `sec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setSections((prev) => [
      ...prev,
      { id: tempId, title: "New Section", description: "", sort_order: prev.length },
    ]);
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
    setFields((prev) => {
      const newIdx = prev.length;
      // Auto-select the new field so user can configure it immediately
      setSelectedField(newIdx);
      return [
        ...prev,
        {
          id: null,
          section_id: sectionId || null,
          field_type: fieldType,
          label: typeInfo.label,
          placeholder: "",
          help_text: "",
          required: false,
          options: ["select", "radio", "checkbox", "multiselect"].includes(fieldType)
            ? [{ label: "Option 1", value: "option-1" }]
            : null,
          sort_order: prev.length,
        },
      ];
    });
    setAddingFieldType(null);
  };

  const updateField = (idx, updates) => {
    setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...updates } : f)));
  };

  const removeField = (idx) => {
    setFields((prev) => prev.filter((_, i) => i !== idx));
    if (selectedField === idx) setSelectedField(null);
  };

  const moveField = (idx, direction) => {
    setFields((prev) => {
      const next = [...prev];
      const target = idx + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((f, i) => ({ ...f, sort_order: i }));
    });
  };

  const addOption = (idx) => {
    setFields((prev) => prev.map((f, i) => {
      if (i !== idx || !f.options) return f;
      return { ...f, options: [...f.options, { label: `Option ${f.options.length + 1}`, value: `option-${f.options.length + 1}` }] };
    }));
  };

  const updateOption = (fieldIdx, optIdx, key, value) => {
    setFields((prev) => prev.map((f, i) => {
      if (i !== fieldIdx || !f.options) return f;
      const opts = [...f.options];
      opts[optIdx] = { ...opts[optIdx], [key]: value };
      return { ...f, options: opts };
    }));
  };

  const removeOption = (fieldIdx, optIdx) => {
    setFields((prev) => prev.map((f, i) => {
      if (i !== fieldIdx || !f.options) return f;
      return { ...f, options: f.options.filter((_, j) => j !== optIdx) };
    }));
  };

  const saveFields = async () => {
    if (!editingForm) return;
    setSaving(true);
    try {
      // Strip temporary client-side IDs so API creates new sections
      const cleanSections = sections.map((s) => (String(s.id).startsWith("sec-") ? { ...s, id: null } : s));
      const payload = { id: editingForm.id, fields, sections: cleanSections };
      // Save scoring config in form settings
      if (scoringConfig) {
        payload.settings = { ...(editingForm.settings || {}), scoring: scoringConfig };
      }
      const res = await fetch("/api/platform/forms", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        notify("Form saved");
        // Reload to get real DB IDs for new sections/fields
        try {
          const refresh = await fetch(`/api/platform/forms?id=${editingForm.id}`);
          const fresh = await refresh.json();
          if (fresh.success) {
            setSections(fresh.sections || []);
            setFields(fresh.fields || []);
          }
        } catch (_) {}
      } else notify(data.error || "Save failed");
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

  const renderFieldPreview = (fld, idx) => {
    const Icon = FIELD_ICONS[fld.field_type] || Type;
    return (
      <div
        key={idx}
        onClick={() => setSelectedField(selectedField === idx ? null : idx)}
        className={cn(
          "p-4 rounded-xl border transition-all cursor-pointer group",
          selectedField === idx
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
            <button onClick={(e) => { e.stopPropagation(); moveField(idx, -1); }}><ChevronUp className="w-3 h-3" /></button>
            <button onClick={(e) => { e.stopPropagation(); moveField(idx, 1); }}><ChevronDown className="w-3 h-3" /></button>
            <button onClick={(e) => { e.stopPropagation(); removeField(idx); }} className="text-rose-500"><Trash2 className="w-3 h-3" /></button>
          </div>
        </div>

        {/* Field editor (expanded) */}
        {selectedField === idx && (
          <div className="mt-4 pt-4 border-t border-[var(--border-primary)] space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-[var(--text-secondary)]">Label</label>
                <input
                  value={fld.label}
                  onChange={(e) => updateField(idx, { label: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-[var(--text-secondary)]">Type</label>
                <select
                  value={fld.field_type}
                  onChange={(e) => {
                    const newType = e.target.value;
                    const needsOptions = ["select", "radio", "checkbox", "multiselect"].includes(newType);
                    updateField(idx, { field_type: newType, options: needsOptions ? [{ label: "Option 1", value: "option-1" }] : null });
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
                onChange={(e) => updateField(idx, { section_id: e.target.value || null })}
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
                onChange={(e) => updateField(idx, { placeholder: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-black uppercase text-[var(--text-secondary)]">Help Text</label>
              <input
                value={fld.help_text || ""}
                onChange={(e) => updateField(idx, { help_text: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
              />
            </div>
            <label className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-primary)]">
              <input type="checkbox" checked={fld.required} onChange={(e) => updateField(idx, { required: e.target.checked })} />
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
                      onChange={(e) => updateOption(idx, oIdx, "label", e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
                    />
                    <button onClick={() => removeOption(idx, oIdx)} className="text-rose-500"><Trash2 className="w-3 h-3" /></button>
                  </div>
                ))}
                <button onClick={() => addOption(idx)} className="text-[9px] font-black text-[var(--brand-orange)] hover:underline">+ Add option</button>
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
                      <input type="number" value={fld.validation?.minLength || ""} onChange={(e) => updateField(idx, { validation: { ...(fld.validation || {}), minLength: e.target.value ? parseInt(e.target.value) : undefined } })} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[9px] font-bold text-[var(--text-primary)] outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[7px] font-bold text-[var(--text-secondary)]">Max Length</label>
                      <input type="number" value={fld.validation?.maxLength || ""} onChange={(e) => updateField(idx, { validation: { ...(fld.validation || {}), maxLength: e.target.value ? parseInt(e.target.value) : undefined } })} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[9px] font-bold text-[var(--text-primary)] outline-none" />
                    </div>
                  </>
                )}
                {["number", "currency"].includes(fld.field_type) && (
                  <>
                    <div className="space-y-1">
                      <label className="text-[7px] font-bold text-[var(--text-secondary)]">Min Value</label>
                      <input type="number" value={fld.validation?.min || ""} onChange={(e) => updateField(idx, { validation: { ...(fld.validation || {}), min: e.target.value ? parseFloat(e.target.value) : undefined } })} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[9px] font-bold text-[var(--text-primary)] outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[7px] font-bold text-[var(--text-secondary)]">Max Value</label>
                      <input type="number" value={fld.validation?.max || ""} onChange={(e) => updateField(idx, { validation: { ...(fld.validation || {}), max: e.target.value ? parseFloat(e.target.value) : undefined } })} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[9px] font-bold text-[var(--text-primary)] outline-none" />
                    </div>
                  </>
                )}
                {["file"].includes(fld.field_type) && (
                  <>
                    <div className="space-y-1"><label className="text-[7px] font-bold text-[var(--text-secondary)]">Max Size (MB)</label><input type="number" value={fld.validation?.maxSize || ""} onChange={(e) => updateField(idx, { validation: { ...(fld.validation || {}), maxSize: e.target.value ? parseInt(e.target.value) : undefined } })} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[9px] font-bold text-[var(--text-primary)] outline-none" /></div>
                    <div className="space-y-1"><label className="text-[7px] font-bold text-[var(--text-secondary)]">Allowed Types</label><input value={fld.validation?.acceptedFiles || ""} onChange={(e) => updateField(idx, { validation: { ...(fld.validation || {}), acceptedFiles: e.target.value } })} placeholder=".pdf,.jpg" className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[9px] font-bold text-[var(--text-primary)] outline-none" /></div>
                  </>
                )}
                <div className="col-span-2 space-y-1"><label className="text-[7px] font-bold text-[var(--text-secondary)]">Error Message</label><input value={fld.validation?.errorMessage || ""} onChange={(e) => updateField(idx, { validation: { ...(fld.validation || {}), errorMessage: e.target.value } })} placeholder="Custom error message" className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[9px] font-bold text-[var(--text-primary)] outline-none" /></div>
              </div>
            </div>

            {/* Conditional Logic */}
            <div className="space-y-2 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
              <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-50">Conditional Logic</p>
              <div className="space-y-1"><label className="text-[7px] font-bold text-[var(--text-secondary)]">Show only when</label>
                <select value={fld.conditional_logic?.field_id || ""} onChange={(e) => updateField(idx, { conditional_logic: { ...(fld.conditional_logic || {}), field_id: e.target.value || undefined } })} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[9px] font-bold text-[var(--text-primary)] outline-none">
                  <option value="">Always visible</option>
                  {fields.filter((f) => f !== fld).slice(0, 20).map((f) => <option key={f.label} value={f.label}>{f.label}</option>)}
                </select>
              </div>
              {fld.conditional_logic?.field_id && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1"><label className="text-[7px] font-bold text-[var(--text-secondary)]">Operator</label>
                    <select value={fld.conditional_logic?.operator || "equals"} onChange={(e) => updateField(idx, { conditional_logic: { ...fld.conditional_logic, operator: e.target.value } })} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[9px] font-bold text-[var(--text-primary)] outline-none">
                      <option value="equals">Equals</option><option value="not_equals">Not Equals</option><option value="contains">Contains</option><option value="greater_than">Greater Than</option><option value="less_than">Less Than</option>
                    </select>
                  </div>
                  <div className="space-y-1"><label className="text-[7px] font-bold text-[var(--text-secondary)]">Value</label><input value={fld.conditional_logic?.value || ""} onChange={(e) => updateField(idx, { conditional_logic: { ...fld.conditional_logic, value: e.target.value } })} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[9px] font-bold text-[var(--text-primary)] outline-none" /></div>
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
            <p className="text-[10px] text-[var(--text-secondary)] mt-1">Design configurable forms — every form belongs to a Collection.</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all">
            <Plus className="w-3.5 h-3.5" /> New Form
          </button>
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
          <div className="fixed inset-0 z-[400] bg-black/40 flex items-center justify-center p-6" onClick={() => setShowCreate(false)}>
            <div className="card w-full max-w-md space-y-5" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">New Form</h3>
                <button onClick={() => setShowCreate(false)}><X className="w-5 h-5" /></button>
              </div>
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
          <button onClick={() => setShowScoring(!showScoring)} className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${showScoring ? "bg-indigo-500 text-white" : "bg-tertiary border border-[var(--border-primary)] text-[var(--text-secondary)]"}`}>
            <BarChart3 className="w-3 h-3 inline mr-1.5" />Scoring {scoringConfig?.enabled && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />}
          </button>
          <button onClick={() => setPreviewMode(!previewMode)} className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${previewMode ? "bg-[var(--brand-orange)] text-black" : "bg-tertiary border border-[var(--border-primary)] text-[var(--text-secondary)]"}`}>
            <Eye className="w-3 h-3 inline mr-1.5" />{previewMode ? "Editing" : "Preview"}
          </button>
          <button onClick={saveFields} disabled={saving} className="px-3 py-2 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[9px] font-black uppercase text-[var(--text-secondary)] hover:text-[var(--text-primary)]">{saving ? "Saving..." : "Save"}</button>
          <button onClick={handlePublish} disabled={saving} className="px-4 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-[9px] font-black uppercase hover:brightness-110">{saving ? "Publishing..." : "Publish"}</button>
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
              <input type="number" min={0} value={scoringConfig.max_per_question ?? ""} onChange={(e) => { const v = e.target.value; setScoringConfig({ ...scoringConfig, max_per_question: v === "" ? 0 : parseInt(v) || 0 }); }} className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
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

      {/* Builder body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Field palette (left) */}
        {!previewMode && (
          <div className="w-56 shrink-0 bg-secondary border-r border-[var(--border-primary)] p-3 space-y-3 overflow-y-auto">
            <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-50">Add Field</p>
            <button onClick={addSection} className="w-full p-2 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[9px] font-black uppercase text-[var(--text-secondary)] hover:text-[var(--text-primary)]">+ Add Section</button>
            {FIELD_TYPES.map((t) => (
              <button key={t.value} onClick={() => addField(t.value, sections.length > 0 ? sections[sections.length - 1].id : null)} className="w-full flex items-center gap-2 p-2 rounded-lg text-left text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary transition-all">
                <t.icon className="w-3.5 h-3.5" />{t.label}
              </button>
            ))}
            {sections.map((sec) => (
              <div key={sec.title + Math.random()} className="pt-2 border-t border-[var(--border-primary)]">
                <p className="text-[7px] font-black uppercase text-[var(--text-secondary)] opacity-50 mb-1">Into: {sec.title}</p>
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
                  {formFieldsForSection(sections[sIdx]?.id).map((fld, fIdx) => {
                    const globalIdx = fields.indexOf(fld);
                    return renderFieldPreview(fld, globalIdx);
                  })}
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
                  {orphanFields.map((fld) => {
                    const globalIdx = fields.indexOf(fld);
                    return <div key={"orphan-" + globalIdx}>{renderFieldPreview(fld, globalIdx)}</div>;
                  })}
                </div>
              </div>
            )}

            {fields.length === 0 && <div className="py-16 text-center"><FileText className="w-12 h-12 mx-auto text-[var(--text-secondary)] opacity-20" /><p className="text-[11px] text-[var(--text-secondary)] mt-3 font-bold">Add fields from the left palette</p><p className="text-[9px] text-[var(--text-secondary)] mt-1 opacity-50">Drag, reorder, and configure each field</p></div>}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { usePermissions } from "@/lib/PermissionProvider";
import { useDialogs } from "@/components/ui/DialogProvider";
import { DEFAULT_AUTOMATION, FIELD_TYPES, FIELD_TYPE_KEYS } from "@/components/platform/forms/constants";
import PlatformFormsView from "@/components/platform/forms/PlatformFormsView";

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

  // Templates panel
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateConfig, setTemplateConfig] = useState(null);
  const [personalizing, setPersonalizing] = useState(null); // template key while AI is writing

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

  const moveSection = (sectionIndex, direction) => {
    const target = sectionIndex + direction;
    if (target < 0 || target >= sections.length) return;
    const nextSections = [...sections];
    [nextSections[sectionIndex], nextSections[target]] = [nextSections[target], nextSections[sectionIndex]];
    setSections(nextSections.map((item, index) => ({ ...item, sort_order: index })));
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

  const handleGenerateForm = async () => {
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
  };

  const handleLaunchRun = async () => {
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
  };

  const handleSaveWorkflow = async () => {
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
  };

  const updateTemplate = (templateKey, fieldName, value) => {
    const templateData = templateConfig || {};
    const nextTemplates = JSON.parse(JSON.stringify(templateData));
    if (!nextTemplates[templateKey]) nextTemplates[templateKey] = {};
    nextTemplates[templateKey][fieldName] = value;
    setTemplateConfig(nextTemplates);
  };

  // Ask the existing AI layer to write (or improve) a template,
  // then fill the subject/body fields — saving stays manual.
  const personalizeTemplate = async (templateKey, label) => {
    if (personalizing) return;
    setPersonalizing(templateKey);
    try {
      const templateData = templateConfig || {};
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

  const handleSaveTemplates = async () => {
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
  };

  const handleSaveAiEvalFramework = async () => {
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
  };

  const handleToggleAiEvalEnabled = async (enabled) => {
    const updatedSettings = { ...(editingForm?.settings || {}), ai_evaluation: enabled };
    setEditingForm(previousForm => ({ ...previousForm, settings: updatedSettings }));
    try {
      await fetch("/api/platform/forms", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingForm.id, settings: updatedSettings }) });
      notify(enabled ? t("platformMisc.forms.aiEvalEnabled") : t("platformMisc.forms.aiEvalDisabled"));
    } catch (_) {}
  };

  const handleGenerateFramework = async () => {
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
  };

  const handleSaveAiEvalDetailed = async () => {
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
  };

  const handleRemoveAiEvalFramework = async () => {
    if (!(await confirm({ message: t("platformMisc.forms.aiEvalRemoveConfirm"), tone: "danger" }))) return;
    await fetch(`/api/platform/ai/evaluation-config?form_id=${editingForm?.id}`, { method: "DELETE" });
    setAiEvalFramework(null);
    notify(t("platformMisc.forms.aiEvalFrameworkRemoved"));
  };

  const closeCreateModal = () => { setShowCreate(false); setCreateMode("manual"); setAiGenText(""); };
  const cancelCreateModal = () => setShowCreate(false);
  const backToManualMode = () => { setCreateMode("manual"); setAiGenText(""); };
  const closeBuilder = () => { setShowBuilder(false); setEditingForm(null); };

  const toggleAiEval = () => { setShowAiEval(!showAiEval); setShowScoring(false); setShowTemplates(false); };
  const toggleScoring = () => { setShowScoring(!showScoring); setShowAiEval(false); setShowWorkflow(false); setShowTemplates(false); };
  const toggleWorkflow = () => { setShowWorkflow(!showWorkflow); setShowAiEval(false); setShowScoring(false); setShowTemplates(false); };
  const toggleTemplates = () => { setShowTemplates(!showTemplates); setShowAiEval(false); setShowScoring(false); setShowWorkflow(false); };

  const ctx = {
    activeSectionId,
    addField,
    addOption,
    addSection,
    aiEvalFramework,
    aiEvalLoading,
    aiEvalText,
    aiGenLoading,
    aiGenText,
    archiveConfirm,
    automationConfig,
    backToManualMode,
    canCreate,
    canEdit,
    cancelCreateModal,
    closeBuilder,
    closeCreateModal,
    collections,
    confirmArchiveAction,
    createForm,
    createMode,
    editingForm,
    fields,
    forms,
    handleArchive,
    handleCreateForm,
    handleDeletePermanently,
    handleDuplicate,
    handleGenerateForm,
    handleGenerateFramework,
    handleLaunchRun,
    handlePublish,
    handleRemoveAiEvalFramework,
    handleSaveAiEvalDetailed,
    handleSaveAiEvalFramework,
    handleSaveTemplates,
    handleSaveWorkflow,
    handleToggleAiEvalEnabled,
    handleUnarchive,
    loading,
    moveField,
    moveSection,
    notification,
    openBuilder,
    personalizeTemplate,
    personalizing,
    previewMode,
    removeField,
    removeOption,
    removeSection,
    saveFields,
    saving,
    scoringConfig,
    search,
    sections,
    selectedFieldId,
    setActiveSectionId,
    setAiEvalFramework,
    setAiEvalText,
    setAiGenText,
    setArchiveConfirm,
    setAutomationConfig,
    setCreateForm,
    setCreateMode,
    setPreviewMode,
    setScoringConfig,
    setSearch,
    setSelectedFieldId,
    setShowAiEval,
    setShowCreate,
    setShowRepublishConfirm,
    setShowScoring,
    setShowTemplates,
    setShowWorkflow,
    setStatusFilter,
    setWorkflowConfig,
    showAiEval,
    showBuilder,
    showCreate,
    showRepublishConfirm,
    showScoring,
    showTemplates,
    showWorkflow,
    statusFilter,
    templateConfig,
    toggleAiEval,
    toggleScoring,
    toggleTemplates,
    toggleWorkflow,
    updateField,
    updateOption,
    updateSection,
    updateTemplate,
    workflowConfig,
  };

  return <PlatformFormsView ctx={ctx} />;
}

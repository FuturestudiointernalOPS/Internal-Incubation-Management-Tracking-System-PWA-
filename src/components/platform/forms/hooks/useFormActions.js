"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_AUTOMATION } from "@/components/platform/forms/constants";

export function useFormActions({
  editingForm,
  setEditingForm,
  sections,
  fields,
  scoringConfig,
  workflowConfig,
  automationConfig,
  templateConfig,
  aiEvalFramework,
  aiEvalText,
  forms,
  refreshForms,
  notify,
  t,
  confirm,
  router,
  genTempId,
  loadSections,
  createDefaultSection,
  loadFields,
  refreshSections,
  refreshFields,
  loadScoringConfig,
  loadWorkflowConfig,
  loadTemplateConfig,
  loadAiEvalFramework,
  setShowBuilder,
  setPreviewMode,
  setSelectedFieldId,
  setFields,
  setScoringConfig,
  setAiEvalFramework,
  openBuilder,
  showAiEval,
  setShowAiEval,
  showScoring,
  setShowScoring,
  showWorkflow,
  setShowWorkflow,
  showTemplates,
  setShowTemplates,
  setAiEvalLoading,
  setAiEvalText,
}) {
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", description: "", collection_id: "", visibility: "internal", tags: "" });
  const [createMode, setCreateMode] = useState("manual");
  const [aiGenText, setAiGenText] = useState("");
  const [aiGenLoading, setAiGenLoading] = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState(null);
  const [showRepublishConfirm, setShowRepublishConfirm] = useState(false);

  const handleCreateForm = useCallback(async () => {
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
        const defaultSecId = createDefaultSection();
        setEditingForm(data.form);
        setShowBuilder(true);
        setPreviewMode(false);
        setSelectedFieldId(null);
        setFields([]);
        setScoringConfig({ enabled: false, max_per_question: 0, sections: {}, rankings: [{ min: 0, max: 59, label: "Needs Work" }, { min: 60, max: 79, label: "Good" }, { min: 80, max: 100, label: "Excellent" }] });
        setAiEvalFramework(null);
      }
    } catch (_) {}
    setSaving(false);
  }, [createForm, notify, refreshForms, t, createDefaultSection, setEditingForm, setShowBuilder, setPreviewMode, setSelectedFieldId, setFields, setScoringConfig, setAiEvalFramework]);

  const handlePublish = useCallback(async (options) => {
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
  }, [editingForm, fields, sections, notify, refreshForms, t, setEditingForm]);

  const handleDuplicate = useCallback(async (form) => {
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
  }, [confirm, t, notify, refreshForms]);

  const handleArchive = useCallback(async (formId) => {
    const form = forms.find((candidate) => candidate.id === formId);
    if (!form) return;
    setArchiveConfirm({ id: formId, name: form.name, action: "archive" });
  }, [forms]);

  const handleUnarchive = useCallback(async (formId) => {
    const form = forms.find((candidate) => candidate.id === formId);
    if (!form) return;
    setArchiveConfirm({ id: formId, name: form.name, action: "unarchive" });
  }, [forms]);

  const handleDeletePermanently = useCallback(async (formId) => {
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
  }, [forms, confirm, t, notify, refreshForms]);

  const confirmArchiveAction = useCallback(async () => {
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
  }, [archiveConfirm, notify, refreshForms, t]);

  const handleGenerateForm = useCallback(async () => {
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
          setTimeout(() => openBuilder(data.form), 400);
        }
      } else {
        notify(t((data.error || t("platformMisc.forms.aiGenFailed")) || "") || (data.error || t("platformMisc.forms.aiGenFailed")));
      }
    } catch (_) { notify(t("platformMisc.forms.aiGenFailedConnection")); }
    setAiGenLoading(false);
  }, [aiGenText, createForm.collection_id, t, notify, refreshForms, openBuilder]);

  const handleLaunchRun = useCallback(async () => {
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
  }, [editingForm, router, notify, t]);

  const handleSaveWorkflow = useCallback(async () => {
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
  }, [editingForm, workflowConfig, automationConfig, notify, t]);

  const handleSaveTemplates = useCallback(async () => {
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
  }, [editingForm, templateConfig, notify, t]);

  const handleSaveAiEvalFramework = useCallback(async () => {
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
  }, [editingForm, aiEvalFramework, notify, t]);

  const handleToggleAiEvalEnabled = useCallback(async (enabled) => {
    const updatedSettings = { ...(editingForm?.settings || {}), ai_evaluation: enabled };
    setEditingForm(previousForm => ({ ...previousForm, settings: updatedSettings }));
    try {
      await fetch("/api/platform/forms", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingForm.id, settings: updatedSettings }) });
      notify(enabled ? t("platformMisc.forms.aiEvalEnabled") : t("platformMisc.forms.aiEvalDisabled"));
    } catch (_) {}
  }, [editingForm, notify, t, setEditingForm]);

  const handleGenerateFramework = useCallback(async () => {
    if (!aiEvalText.trim()) return;
    setAiEvalLoading(true);
    try {
      const response = await fetch("/api/platform/ai/generate-framework", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: aiEvalText }) });
      const data = await response.json();
      if (data.success && data.framework) {
        setAiEvalFramework(data.framework);
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
  }, [aiEvalText, editingForm, notify, t, setAiEvalFramework]);

  const handleSaveAiEvalDetailed = useCallback(async () => {
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
  }, [aiEvalFramework, aiEvalText, editingForm, notify, t]);

  const handleRemoveAiEvalFramework = useCallback(async () => {
    if (!(await confirm({ message: t("platformMisc.forms.aiEvalRemoveConfirm"), tone: "danger" }))) return;
    await fetch(`/api/platform/ai/evaluation-config?form_id=${editingForm?.id}`, { method: "DELETE" });
    setAiEvalFramework(null);
    notify(t("platformMisc.forms.aiEvalFrameworkRemoved"));
  }, [editingForm, confirm, t, notify, setAiEvalFramework]);

  const saveFields = useCallback(async (skipRepublishPrompt) => {
    if (!editingForm) return;

    if (editingForm.status === "published" && skipRepublishPrompt === undefined) {
      setShowRepublishConfirm(true);
      return;
    }

    setSaving(true);
    const isRepublishing = editingForm.status === "published" && skipRepublishPrompt === true;
    try {
      const currentSections = sections.filter((section) => section.id && !String(section.id).startsWith("tmp-"));
      try {
        const existing = await fetch(`/api/platform/forms?id=${editingForm.id}`);
        const existingData = await existing.json();
        if (existingData.success) {
          if (existingData.sections) {
            const existingIds = existingData.sections.map((section) => section.id);
            const keptIds = currentSections.map((section) => section.id);
            for (const existingId of existingIds) {
              if (!keptIds.includes(existingId)) {
                await fetch(`/api/platform/forms`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingForm.id, sections: [{ id: existingId, _delete: true }] }) });
              }
            }
          }
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

      const cleanSections = sections.map((section) => (String(section.id).startsWith("tmp-") ? { ...section, id: null } : section));
      const payload = { id: editingForm.id, fields, sections: cleanSections };
      const response = await fetch("/api/platform/forms", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (data.success) {
        if (scoringConfig) {
          try {
            await fetch("/api/platform/forms", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: editingForm.id, settings: { ...(editingForm.settings || {}), scoring: scoringConfig } }),
            });
          } catch (_) {}
        }

        if (isRepublishing) {
          await handlePublish({ skipSave: true });
          notify(t("platformMisc.forms.notifyFormRepublished"));
        } else {
          notify(t("platformMisc.forms.notifyFormSaved"));
        }

        try {
          const refreshResponse = await fetch(`/api/platform/forms?id=${editingForm.id}`);
          const freshData = await refreshResponse.json();
          if (freshData.success) {
            refreshSections(freshData, genTempId);
            refreshFields(freshData, genTempId);
            setEditingForm(freshData.form || editingForm);
          }
        } catch (_) {}
      } else notify(t((data.error || t("platformMisc.forms.saveFailed")) || "") || (data.error || t("platformMisc.forms.saveFailed")));
    } catch (_) {}
    setSaving(false);
  }, [editingForm, sections, fields, scoringConfig, genTempId, handlePublish, notify, t, refreshSections, refreshFields, setSaving]);

  const closeCreateModal = useCallback(() => { setShowCreate(false); setCreateMode("manual"); setAiGenText(""); }, []);
  const cancelCreateModal = useCallback(() => setShowCreate(false), []);
  const backToManualMode = useCallback(() => { setCreateMode("manual"); setAiGenText(""); }, []);
  const closeBuilder = useCallback(() => { setShowBuilder(false); setEditingForm(null); }, [setShowBuilder, setEditingForm]);

  const toggleAiEval = useCallback(() => { setShowAiEval(!showAiEval); setShowScoring(false); setShowTemplates(false); }, [showAiEval, setShowAiEval, setShowScoring, setShowTemplates]);
  const toggleScoring = useCallback(() => { setShowScoring(!showScoring); setShowAiEval(false); setShowWorkflow(false); setShowTemplates(false); }, [showScoring, setShowScoring, setShowAiEval, setShowWorkflow, setShowTemplates]);
  const toggleWorkflow = useCallback(() => { setShowWorkflow(!showWorkflow); setShowAiEval(false); setShowScoring(false); setShowTemplates(false); }, [showWorkflow, setShowWorkflow, setShowAiEval, setShowScoring, setShowTemplates]);
  const toggleTemplates = useCallback(() => { setShowTemplates(!showTemplates); setShowAiEval(false); setShowScoring(false); setShowWorkflow(false); }, [showTemplates, setShowTemplates, setShowAiEval, setShowScoring, setShowWorkflow]);

  return {
    saving,
    setSaving,
    setPreviewMode,
    showCreate,
    setShowCreate,
    createForm,
    setCreateForm,
    createMode,
    setCreateMode,
    aiGenText,
    setAiGenText,
    aiGenLoading,
    archiveConfirm,
    setArchiveConfirm,
    showRepublishConfirm,
    setShowRepublishConfirm,
    handleCreateForm,
    handlePublish,
    handleDuplicate,
    handleArchive,
    handleUnarchive,
    handleDeletePermanently,
    confirmArchiveAction,
    handleGenerateForm,
    handleLaunchRun,
    handleSaveWorkflow,
    handleSaveTemplates,
    handleSaveAiEvalFramework,
    handleToggleAiEvalEnabled,
    handleGenerateFramework,
    handleSaveAiEvalDetailed,
    handleRemoveAiEvalFramework,
    saveFields,
    closeCreateModal,
    cancelCreateModal,
    backToManualMode,
    closeBuilder,
    toggleAiEval,
    toggleScoring,
    toggleWorkflow,
    toggleTemplates,
  };
}
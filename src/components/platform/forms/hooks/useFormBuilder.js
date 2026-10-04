"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { usePermissions } from "@/lib/PermissionProvider";
import { useDialogs } from "@/components/ui/DialogProvider";
import { useFormSections } from "./useFormSections";
import { useFormFields } from "./useFormFields";
import { useScoringConfig } from "./useScoringConfig";
import { useAiEvaluation } from "./useAiEvaluation";
import { useWorkflowConfig } from "./useWorkflowConfig";
import { useTemplateConfig } from "./useTemplateConfig";
import { useFormActions } from "./useFormActions";

const FORMS_URL = "/api/platform/forms";
const COLLECTIONS_URL = "/api/platform/collections";

export function useFormBuilder({ refreshForms, forms, collections, loading }) {
  const router = useRouter();
  const { t } = useI18n();
  const { can } = usePermissions();
  const { confirm } = useDialogs();
  const canCreate = can("forms", "create");
  const canEdit = can("forms", "edit");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("published");
  const [notification, setNotification] = useState(null);
  const [now] = useState(() => Date.now());
  const tempIdSeq = useRef(0);

  // Builder state
  const [editingForm, setEditingForm] = useState(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const genTempId = useCallback(() => `tmp-${now}-${++tempIdSeq.current}`, [now]);
  const notify = useCallback((message) => { setNotification(message); setTimeout(() => setNotification(null), 3000); }, []);

  // Compose sub-hooks
  const {
    sections,
    setSections,
    activeSectionId,
    setActiveSectionId,
    addSection,
    updateSection,
    removeSection,
    moveSection,
    loadSections,
    createDefaultSection,
    refreshSections,
  } = useFormSections();

  const {
    fields,
    setFields,
    selectedFieldId,
    setSelectedFieldId,
    addField,
    updateField,
    removeField,
    moveField,
    addOption,
    updateOption,
    removeOption,
    loadFields,
    refreshFields,
  } = useFormFields({ t });

  const {
    showScoring,
    setShowScoring,
    scoringConfig,
    setScoringConfig,
    loadScoringConfig,
  } = useScoringConfig({ editingForm });

  const {
    showAiEval,
    setShowAiEval,
    aiEvalFramework,
    setAiEvalFramework,
    aiEvalText,
    setAiEvalText,
    aiEvalLoading,
    setAiEvalLoading,
    loadAiEvalFramework,
  } = useAiEvaluation({ editingForm });

  const {
    showWorkflow,
    setShowWorkflow,
    workflowConfig,
    setWorkflowConfig,
    automationConfig,
    setAutomationConfig,
    loadWorkflowConfig,
  } = useWorkflowConfig({ editingForm });

  const {
    showTemplates,
    setShowTemplates,
    templateConfig,
    setTemplateConfig,
    personalizing,
    loadTemplateConfig,
    updateTemplate,
    personalizeTemplate,
  } = useTemplateConfig({ editingForm });

  // openBuilder defined here, before useFormActions, so it can be passed
  const openBuilder = useCallback(async (form) => {
    setEditingForm(form);
    setShowBuilder(true);
    setPreviewMode(false);
    setSelectedFieldId(null);

    loadScoringConfig();
    loadWorkflowConfig();
    loadTemplateConfig();
    loadAiEvalFramework();

    try {
      const response = await fetch(`/api/platform/forms?id=${form.id}`);
      const data = await response.json();
      if (data.success) {
        loadSections(data.sections, genTempId);
        loadFields(data.fields, genTempId);
      }
    } catch (_) {}
  }, [
    setEditingForm,
    setShowBuilder,
    setPreviewMode,
    setSelectedFieldId,
    loadScoringConfig,
    loadWorkflowConfig,
    loadTemplateConfig,
    loadAiEvalFramework,
    loadSections,
    loadFields,
    genTempId,
  ]);

  const {
    saving,
    setSaving,
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
  } = useFormActions({
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
  });

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

  return ctx;
}
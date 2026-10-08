"use client";

import FormsListView from "@/components/platform/forms/FormsListView";
import CreateFormModal from "@/components/platform/forms/CreateFormModal";
import ArchiveConfirmModal from "@/components/platform/forms/ArchiveConfirmModal";
import RepublishConfirmModal from "@/components/platform/forms/RepublishConfirmModal";
import BuilderHeader from "@/components/platform/forms/BuilderHeader";
import ScoringPanel from "@/components/platform/forms/ScoringPanel";
import WorkflowPanel from "@/components/platform/forms/WorkflowPanel";
import TemplatesPanel from "@/components/platform/forms/TemplatesPanel";
import EvaluationFrameworkPanel from "@/components/platform/forms/EvaluationFrameworkPanel";
import FieldPalette from "@/components/platform/forms/FieldPalette";
import FormCanvas from "@/components/platform/forms/FormCanvas";

export default function PlatformFormsView({ ctx }) {
  const {
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
  } = ctx;

  // ─── LIST VIEW ───
  if (!showBuilder) {
    return (
      <div className="p-6 space-y-6 animate-in">
        {notification && <div className="fixed bottom-6 right-6 z-[500] px-5 py-3 rounded-xl bg-emerald-500 text-black text-[10px] font-black uppercase">{notification}</div>}
        <FormsListView
          forms={forms}
          loading={loading}
          collections={collections}
          search={search}
          onSearch={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onNew={() => setShowCreate(true)}
          onOpen={openBuilder}
          onDuplicate={handleDuplicate}
          onArchive={handleArchive}
          onUnarchive={handleUnarchive}
          onDelete={handleDeletePermanently}
        />

        {/* Create modal */}
        {showCreate && (
          <CreateFormModal
            createForm={createForm}
            setCreateForm={setCreateForm}
            createMode={createMode}
            setCreateMode={setCreateMode}
            aiGenText={aiGenText}
            setAiGenText={setAiGenText}
            aiGenLoading={aiGenLoading}
            collections={collections}
            canCreate={canCreate}
            saving={saving}
            onClose={closeCreateModal}
            onCancel={cancelCreateModal}
            onBack={backToManualMode}
            onCreate={handleCreateForm}
            onGenerate={handleGenerateForm}
          />
        )}

        {/* Archive Confirmation Modal */}
        {archiveConfirm && (
          <ArchiveConfirmModal
            archiveConfirm={archiveConfirm}
            onClose={() => setArchiveConfirm(null)}
            onConfirm={confirmArchiveAction}
          />
        )}
      </div>
    );
  }

  // ─── BUILDER VIEW ───
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {notification && <div className="fixed bottom-6 right-6 z-[500] px-5 py-3 rounded-xl bg-emerald-500 text-black text-[10px] font-black uppercase">{notification}</div>}

      {/* Builder header */}
      <BuilderHeader
        editingForm={editingForm}
        showAiEval={showAiEval}
        showScoring={showScoring}
        showWorkflow={showWorkflow}
        showTemplates={showTemplates}
        aiEvalFramework={aiEvalFramework}
        scoringConfig={scoringConfig}
        workflowConfig={workflowConfig}
        templateConfig={templateConfig}
        previewMode={previewMode}
        saving={saving}
        onToggleAiEval={toggleAiEval}
        onToggleScoring={toggleScoring}
        onToggleWorkflow={toggleWorkflow}
        onToggleTemplates={toggleTemplates}
        onTogglePreview={() => setPreviewMode(!previewMode)}
        onBack={closeBuilder}
        onSave={() => saveFields(false)}
        onRepublish={() => saveFields(true)}
        onPublish={() => handlePublish()}
        onLaunchRun={handleLaunchRun}
      />

      {/* Scoring Configuration Panel */}
      {showScoring && scoringConfig && (
        <ScoringPanel
          scoringConfig={scoringConfig}
          setScoringConfig={setScoringConfig}
          sections={sections}
          fields={fields}
          onClose={() => setShowScoring(false)}
        />
      )}

      {/* Workflow Configuration Panel */}
      {showWorkflow && (
        <WorkflowPanel
          workflowConfig={workflowConfig}
          setWorkflowConfig={setWorkflowConfig}
          automationConfig={automationConfig}
          setAutomationConfig={setAutomationConfig}
          onSave={handleSaveWorkflow}
          saving={saving}
          onClose={() => setShowWorkflow(false)}
        />
      )}

      {/* Templates Panel */}
      {showTemplates && (
        <TemplatesPanel
          templateConfig={templateConfig}
          updateTemplate={updateTemplate}
          onPersonalize={personalizeTemplate}
          personalizing={personalizing}
          onSave={handleSaveTemplates}
          saving={saving}
          onClose={() => setShowTemplates(false)}
        />
      )}

      {/* AI Evaluation Panel */}
      {showAiEval && (
        <EvaluationFrameworkPanel
          aiEvalFramework={aiEvalFramework}
          setAiEvalFramework={setAiEvalFramework}
          aiEvalText={aiEvalText}
          setAiEvalText={setAiEvalText}
          aiEvalLoading={aiEvalLoading}
          editingForm={editingForm}
          canEdit={canEdit}
          saving={saving}
          onSaveFramework={handleSaveAiEvalFramework}
          onToggleEnabled={handleToggleAiEvalEnabled}
          onGenerate={handleGenerateFramework}
          onSaveDetailed={handleSaveAiEvalDetailed}
          onRemove={handleRemoveAiEvalFramework}
          onClose={() => setShowAiEval(false)}
        />
      )}

      {/* Builder body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Field palette (left) */}
        {!previewMode && (
          <FieldPalette
            sections={sections}
            activeSectionId={activeSectionId}
            onSetActiveSection={setActiveSectionId}
            onAddSection={addSection}
            onAddField={addField}
          />
        )}

        {/* Form canvas (right) */}
        <FormCanvas
          editingForm={editingForm}
          previewMode={previewMode}
          sections={sections}
          fields={fields}
          selectedFieldId={selectedFieldId}
          setSelectedFieldId={setSelectedFieldId}
          onUpdateSection={updateSection}
          onRemoveSection={removeSection}
          onMoveSection={moveSection}
          onUpdate={updateField}
          onMove={moveField}
          onRemove={removeField}
          onAddOption={addOption}
          onUpdateOption={updateOption}
          onRemoveOption={removeOption}
        />
      </div>

      {/* Republish Confirmation Modal */}
      {showRepublishConfirm && (
        <RepublishConfirmModal
          editingForm={editingForm}
          onClose={() => setShowRepublishConfirm(false)}
          onSaveAndRepublish={() => { setShowRepublishConfirm(false); saveFields(true); }}
          onSaveDraft={() => { setShowRepublishConfirm(false); saveFields("draft"); }}
        />
      )}
    </div>
  );
}

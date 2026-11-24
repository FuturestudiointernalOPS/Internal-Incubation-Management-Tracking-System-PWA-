/**
 * The three dialogs the panel opens: save as template, apply a template, add a stage.
 *
 * Cut out of src/components/shared/ventures/console/JourneyManagerPanel.js as-is: the panel
 * keeps every state value and every write, and hands this block what it reads
 * through `ctx`. The names it needs are listed in the signature — nothing else.
 */

"use client";
import JourneyAddStageForm from "@/components/shared/ventures/console/journey/JourneyAddStageForm";
import JourneyApplyTemplateBar from "@/components/shared/ventures/console/journey/JourneyApplyTemplateBar";
import JourneySaveTemplateForm from "@/components/shared/ventures/console/journey/JourneySaveTemplateForm";

export default function JourneyManagerModals({ ctx }) {
  const {
    addOpen,
    addStage,
    applyOpen,
    applyTemplate,
    form,
    journeyTemplates,
    saveForm,
    saveJourneyTemplate,
    saveOpen,
    saving,
    savingSave,
    savingTemplate,
    selectedTemplateId,
    setApplyOpen,
    setForm,
    setSaveForm,
    setSaveOpen,
    setSelectedTemplateId,
    templates,
  } = ctx;

  return (
    <>
      {saveOpen && (
        <JourneySaveTemplateForm
          saveForm={saveForm}
          saveJourneyTemplate={saveJourneyTemplate}
          savingSave={savingSave}
          setSaveForm={setSaveForm}
          setSaveOpen={setSaveOpen}
        />
      )}
      {applyOpen && (
        <JourneyApplyTemplateBar
          applyTemplate={applyTemplate}
          journeyTemplates={journeyTemplates}
          onClose={() => setApplyOpen(false)}
          savingTemplate={savingTemplate}
          selectedTemplateId={selectedTemplateId}
          setSelectedTemplateId={setSelectedTemplateId}
          templates={templates}
        />
      )}
      {addOpen && (
        <JourneyAddStageForm
          addStage={addStage}
          form={form}
          saving={saving}
          setForm={setForm}
        />
      )}
    </>
  );
}

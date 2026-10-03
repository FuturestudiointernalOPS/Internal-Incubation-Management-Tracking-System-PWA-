/**
 * The three dialogs the panel opens: save as template, apply a template, add a stage.
 *
 * Cut out of src/components/ventures/JourneyManagerPanel.js as-is: the panel
 * keeps every state value and every write, and hands this block what it reads
 * through `ctx`. The names it needs are listed in the signature — nothing else.
 */

"use client";
import JourneyAddStageForm from "@/components/ventures/journey/JourneyAddStageForm";
import JourneyApplyTemplateBar from "@/components/ventures/journey/JourneyApplyTemplateBar";
import JourneySaveTemplateForm from "@/components/ventures/journey/JourneySaveTemplateForm";

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

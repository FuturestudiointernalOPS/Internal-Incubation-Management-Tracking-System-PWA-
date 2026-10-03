/**
 * Writing a journey stage
 *
 * Create, edit, duplicate, patch, and the two template flows (load a
 * reusable operating-plan template, save the current journey as one).
 *
 * Cut out of src/components/ventures/JourneyManagerPanel.js as-is: no state of
 * its own, no reads. The panel keeps every state value and every read, and hands
 * this factory what it reads through `values` — plus what the factories above
 * it return. The names it need are listed in the signature — nothing else.
 */

import { dateOnly } from "@/lib/ventureMilestoneDates";

export function stageWrites({
  setToast,
  setTemplates,
  setJourneyTemplates,
  applyOpen,
  setApplyOpen,
  form,
  setSaving,
  ventureId,
  t,
  setForm,
  setAddOpen,
  setStages,
  confirm,
  setDuplicatingStageId,
  editId,
  editForm,
  setEditId,
  setEditForm,
  selectedTemplateId,
  setSavingTemplate,
  setSelectedTemplateId,
  setSavingSave,
  saveForm,
  setSaveOpen,
  setSaveForm,
}) {
  const notify = (message, type = "success") => {
    setToast({ msg: message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const loadTemplates = async () => {
    try {
      const res = await fetch(`/api/venture-plan-templates`);
      const payload = await res.json();
      if (payload.success) setTemplates(payload.templates || []);
    } catch (error) {
      console.error("Failed to load plan templates:", error);
    }
    try {
      const journeyRes = await fetch(`/api/journey-templates`);
      const journeyPayload = await journeyRes.json();
      if (journeyPayload.success) setJourneyTemplates(journeyPayload.templates || []);
    } catch (error) {
      console.error("Failed to load journey templates:", error);
    }
  };

  const toggleApply = async () => {
    const next = !applyOpen;
    setApplyOpen(next);
    if (next) await loadTemplates();
  };

  const addStage = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/journey`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await res.json();
      if (payload.success) {
        notify(t("venture.manager.stageAdded"));
        setForm({ name: "", description: "", objective: "", start_date: "" });
        setAddOpen(false);
        setStages(payload.stages || []);
      } else {
        notify(payload.error || t("venture.manager.addFailed"), "error");
      }
    } catch {
      notify(t("venture.manager.addFailed"), "error");
    } finally {
      setSaving(false);
    }
  };

  const patch = async (body) => {
    const res = await fetch(`/api/ventures/${ventureId}/journey`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await res.json();
    if (payload.success) setStages(payload.stages || []);
    else notify(payload.error || t("venture.manager.actionFailed"), "error");
    return payload.success;
  };

  // Duplicate a stage as an independent structure copy (milestones + tasks,
  // never submissions/reviews/history — those stay with the source).
  const duplicateStage = async (stage) => {
    if (!(await confirm({ message: t("venture.manager.duplicateStageConfirm", { name: stage.name }) }))) return;
    setDuplicatingStageId(stage.id);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/journey/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage_id: stage.id }),
      });
      const payload = await res.json();
      if (payload.success) {
        notify(t("venture.manager.duplicateStageSuccess", { milestones: payload.milestones_copied || 0, tasks: payload.tasks_copied || 0 }));
        setStages(payload.stages || []);
      } else {
        notify(payload.error || t("venture.manager.duplicateStageFailed"), "error");
      }
    } catch {
      notify(t("venture.manager.duplicateStageFailed"), "error");
    } finally {
      setDuplicatingStageId(null);
    }
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    const ok = await patch({ action: "update", stage_id: editId, ...editForm });
    if (ok) {
      notify(t("venture.manager.stageUpdated"));
      setEditId(null);
      setEditForm({});
    }
  };

  const startEdit = (stage) => {
    setEditId(stage.id);
    setEditForm({
      name: stage.name || "",
      description: stage.description || "",
      objective: stage.objective || "",
      start_date: dateOnly(stage.start_date),
    });
  };

  const applyTemplate = async () => {
    if (!selectedTemplateId) return;
    setSavingTemplate(true);
    try {
      // Journey templates (structure incl. milestones/tasks) vs operating-plan
      // templates (stage structure only) — two libraries, one picker.
      const [kind, rawId] = String(selectedTemplateId).split(":");
      const isJourneyTemplate = kind === "journey";
      const endpoint = isJourneyTemplate
        ? `/api/ventures/${ventureId}/journey/apply-journey-template`
        : `/api/ventures/${ventureId}/journey/apply-template`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: rawId }),
      });
      const payload = await res.json();
      if (payload.success) {
        notify(isJourneyTemplate ? t("venture.manager.journeyTemplateApplied") : t("venture.manager.journeyGeneratedPlan"));
        setApplyOpen(false);
        setSelectedTemplateId("");
        setStages(payload.stages || []);
      } else {
        notify(payload.error || t("venture.manager.applyFailed"), "error");
      }
    } catch {
      notify(t("venture.manager.applyFailed"), "error");
    } finally {
      setSavingTemplate(false);
    }
  };

  // Save this Venture's ENTIRE journey (stages + milestones + tasks) as a
  // reusable template in the ImpactOS library (structure only).
  const saveJourneyTemplate = async (event) => {
    event.preventDefault();
    setSavingSave(true);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/journey/save-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(saveForm),
      });
      const payload = await res.json();
      if (payload.success) {
        notify(t("venture.manager.saveTemplateSaved", { stages: payload.stages || 0, milestones: payload.milestones || 0, tasks: payload.tasks || 0 }));
        setSaveOpen(false);
        setSaveForm({ name: "", description: "" });
      } else {
        notify(payload.error || t("venture.manager.saveTemplateFailed"), "error");
      }
    } catch {
      notify(t("venture.manager.saveTemplateFailed"), "error");
    } finally {
      setSavingSave(false);
    }
  };

  return {
    notify,
    loadTemplates,
    toggleApply,
    addStage,
    patch,
    duplicateStage,
    saveEdit,
    startEdit,
    applyTemplate,
    saveJourneyTemplate,
  };
}

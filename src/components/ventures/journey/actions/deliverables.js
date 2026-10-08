/**
 * Writing a deliverable
 *
 * The deliverable rows of a milestone form, the evidence a contributor
 * submits, and the review that accepts or rejects it.
 *
 * Cut out of src/components/ventures/JourneyManagerPanel.js as-is: no state of
 * its own, no reads. The panel keeps every state value and every read, and hands
 * this factory what it reads through `values` — plus what the factories above
 * it return. The names it need are listed in the signature — nothing else.
 */

import { deliverableStatusWord } from "@/lib/ventureStatuses";
import {
  CheckCircle2,
  RotateCcw,
  Pencil,
  Upload,
} from "lucide-react";
import {
  deliverableDateIssue,
  dateOnly,
  todayDateInput,
} from "@/lib/ventureMilestoneDates";
import { DATE_ISSUE_KEYS } from "@/components/ventures/journey/journeyShapers";

export function deliverableWrites({
  setMilestoneDeliverables,
  ventureId,
  notify,
  t,
  deliverableForm,
  fmtDate,
  setDeliverableSaving,
  deliverableNewUrl,
  deliverableNewFile,
  refreshJourney,
  setDeliverableForm,
  setDeliverableNewFile,
  setDeliverableNewUrl,
  setDeliverableAddFor,
  setDeliverableAction,
  deliverableAction,
  deliverableFile,
  deliverableText,
  setDeliverableText,
  setDeliverableFile,
  setDeliverableBusy,
}) {
  const addMilestoneDeliverable = () =>
    setMilestoneDeliverables((prev) => [...prev, { title: "", deliverable_type: "document", due_date: "" }]);
  const updateMilestoneDeliverable = (index, patch) =>
    setMilestoneDeliverables((prev) => prev.map((deliverable, itemIndex) => (itemIndex === index ? { ...deliverable, ...patch } : deliverable)));
  const removeMilestoneDeliverable = (index) =>
    setMilestoneDeliverables((prev) => prev.filter((_, itemIndex) => itemIndex !== index));

  // ── Deliverables inside a milestone ──────────────────────────────────────
  // Evidence is a document or a URL — only these two types exist.
  const DELIVERABLE_TYPES = ["document", "link"];
  const emptyDeliverableForm = { title: "", description: "", deliverable_type: "document", due_date: "", assigned_cid: "", assigned_name: "" };

  const patchDeliverable = async (body) => {
    const res = await fetch(`/api/ventures/${ventureId}/deliverables`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await res.json().catch(() => ({}));
    if (payload.success) return true;
    notify(payload.error || t("venture.manager.actionFailed"), "error");
    return false;
  };

  const addDeliverable = async (event, milestone) => {
    event.preventDefault();
    if (!deliverableForm.title.trim()) return;
    // A deliverable is owed ON or after its milestone — never before it.
    const issue = deliverableDateIssue({ dueDate: deliverableForm.due_date, milestoneDate: milestone.target_date });
    if (issue) {
      notify(
        t(DATE_ISSUE_KEYS[issue], {
          title: deliverableForm.title.trim(),
          date: fmtDate(milestone.target_date || todayDateInput()),
        }),
        "error",
      );
      return;
    }
    setDeliverableSaving(true);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/deliverables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...deliverableForm, milestone_id: milestone.id }),
      });
      const payload = await res.json();
      if (payload.success) {
        // Evidence attached while defining the deliverable: upload it and
        // record it as submitted right away.
        let evidenceUrl = deliverableNewUrl.trim();
        let evidenceName = null;
        if (deliverableNewFile) {
          const formData = new FormData();
          formData.append("file", deliverableNewFile);
          if (payload.id) formData.append("deliverable_id", String(payload.id));
          const uploadResponse = await fetch(`/api/ventures/${ventureId}/deliverables/upload`, { method: "POST", body: formData });
          const uploadPayload = await uploadResponse.json().catch(() => ({}));
          if (!uploadPayload.success) {
            notify(uploadPayload.error || t("venture.manager.actionFailed"), "error");
            await refreshJourney();
            return;
          }
          evidenceUrl = uploadPayload.path;
          evidenceName = uploadPayload.name || deliverableNewFile.name || null;
        }
        if (payload.id && evidenceUrl) {
          // The uploaded file is only "attached" once the server has recorded it.
          // The answer used to be thrown away, so a refused write left the file
          // orphaned, the deliverable without evidence, and the manager told it
          // had all worked. Read the answer, and say when it did not.
          const attachResponse = await fetch(`/api/ventures/${ventureId}/deliverables`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: payload.id, action: "submit", attachment_url: evidenceUrl, attachment_name: evidenceName }),
          });
          const attachPayload = await attachResponse.json().catch(() => ({}));
          if (!attachPayload.success) {
            notify(t("venture.manager.evidenceAttachFailed"), "error");
            setDeliverableForm(emptyDeliverableForm);
            setDeliverableNewFile(null);
            setDeliverableNewUrl("");
            setDeliverableAddFor(null);
            await refreshJourney();
            return;
          }
        }
        notify(t("venture.manager.deliverableAdded"));
        setDeliverableForm(emptyDeliverableForm);
        setDeliverableNewFile(null);
        setDeliverableNewUrl("");
        setDeliverableAddFor(null);
        await refreshJourney();
      } else {
        notify(payload.error || t("venture.manager.actionFailed"), "error");
      }
    } catch (_) {
      notify(t("venture.manager.actionFailed"), "error");
    } finally {
      setDeliverableSaving(false);
    }
  };

  const startDeliverableEdit = (deliverable) => {
    setDeliverableAction({ id: deliverable.id, mode: "edit" });
    setDeliverableForm({
      title: deliverable.title || "",
      description: deliverable.description || "",
      deliverable_type: deliverable.deliverable_type || "document",
      due_date: dateOnly(deliverable.due_date),
      assigned_cid: deliverable.assigned_cid || "",
      assigned_name: deliverable.assigned_name || "",
    });
  };

  const saveDeliverableEdit = async (event, deliverable, milestone) => {
    event.preventDefault();
    // An untouched due date is never re-judged (see saveMilestoneEdit).
    const issue = deliverableDateIssue({
      dueDate: deliverableForm.due_date,
      milestoneDate: milestone?.target_date,
      enforceFloor: dateOnly(deliverableForm.due_date) !== dateOnly(deliverable?.due_date),
    });
    if (issue) {
      notify(
        t(DATE_ISSUE_KEYS[issue], {
          title: deliverableForm.title.trim(),
          date: fmtDate(milestone?.target_date || todayDateInput()),
        }),
        "error",
      );
      return;
    }
    setDeliverableSaving(true);
    const ok = await patchDeliverable({ id: deliverableAction.id, action: "update", ...deliverableForm });
    setDeliverableSaving(false);
    if (ok) {
      notify(t("venture.manager.deliverableUpdated"));
      setDeliverableAction(null);
      await refreshJourney();
    }
  };

  const submitDeliverableEvidence = async () => {
    if (!deliverableFile && !deliverableText.trim()) return;
    setDeliverableSaving(true);
    try {
      let url = deliverableText.trim();
      let name = null;
      // A chosen file is uploaded first (any type, max 5MB); the returned URL
      // is what gets recorded on the deliverable.
      if (deliverableFile) {
        const formData = new FormData();
        formData.append("file", deliverableFile);
        if (deliverableAction?.id) formData.append("deliverable_id", String(deliverableAction.id));
        const uploadResponse = await fetch(`/api/ventures/${ventureId}/deliverables/upload`, { method: "POST", body: formData });
        const uploadPayload = await uploadResponse.json().catch(() => ({}));
        if (!uploadPayload.success) {
          notify(uploadPayload.error || t("venture.manager.actionFailed"), "error");
          return;
        }
        url = uploadPayload.path;
        name = uploadPayload.name || deliverableFile.name || null;
      }
      const ok = await patchDeliverable({ id: deliverableAction.id, action: "submit", attachment_url: url, attachment_name: name });
      if (ok) {
        notify(t("venture.manager.deliverableSubmitted"));
        setDeliverableAction(null);
        setDeliverableText("");
        setDeliverableFile(null);
        await refreshJourney();
      }
    } catch (_) {
      notify(t("venture.manager.actionFailed"), "error");
    } finally {
      setDeliverableSaving(false);
    }
  };

  const reviewDeliverable = async (deliverable, decision) => {
    setDeliverableBusy(deliverable.id);
    const ok = await patchDeliverable({
      id: deliverable.id,
      action: "review",
      decision,
      comments: decision === "changes_requested" ? deliverableText.trim() : undefined,
    });
    setDeliverableBusy(null);
    if (ok) {
      notify(t("venture.manager.deliverableReviewed", { decision: t(decision === "approved" ? "venture.manager.approveDeliverable" : "venture.manager.requestChanges") }));
      setDeliverableAction(null);
      setDeliverableText("");
      await refreshJourney();
    }
  };

  const deliverableStatus = (deliverable) => deliverableStatusWord(deliverable);

  const deliverableMenuItems = (deliverable) => [
    { key: "edit", label: t("venture.manager.editDeliverable"), icon: Pencil, onSelect: () => startDeliverableEdit(deliverable) },
    { key: "submit", label: t("venture.manager.submitEvidence"), icon: Upload, onSelect: () => { setDeliverableAction({ id: deliverable.id, mode: "submit" }); setDeliverableText(/^https?:\/\//i.test(deliverable.attachment_url || "") ? deliverable.attachment_url : ""); } },
    { separator: true },
    { key: "approve", label: t("venture.manager.approveDeliverable"), icon: CheckCircle2, onSelect: () => reviewDeliverable(deliverable, "approved") },
    { key: "changes", label: t("venture.manager.requestChanges"), icon: RotateCcw, onSelect: () => { setDeliverableAction({ id: deliverable.id, mode: "review" }); setDeliverableText(""); } },
  ];

  return {
    addMilestoneDeliverable,
    updateMilestoneDeliverable,
    removeMilestoneDeliverable,
    DELIVERABLE_TYPES,
    emptyDeliverableForm,
    patchDeliverable,
    addDeliverable,
    startDeliverableEdit,
    saveDeliverableEdit,
    submitDeliverableEvidence,
    reviewDeliverable,
    deliverableStatus,
    deliverableMenuItems,
  };
}

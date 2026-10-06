/**
 * Writing a milestone
 *
 * Add, edit, move, duplicate; and the menu that offers those actions.
 *
 * Cut out of src/components/ventures/JourneyManagerPanel.js as-is: no state of
 * its own, no reads. The panel keeps every state value and every read, and hands
 * this factory what it reads through `values` — plus what the factories above
 * it return. The names it need are listed in the signature — nothing else.
 */

import {
  ChevronUp,
  ChevronDown,
  CopyPlus,
  CheckCircle2,
  Archive,
  Pencil,
  StickyNote,
} from "lucide-react";
import {
  nextMilestoneDate,
  milestoneDateIssue,
  deliverableDateIssue,
  earliestStoredDate,
  dateOnly,
  todayDateInput,
} from "@/lib/ventureMilestoneDates";
import {
  DATE_ISSUE_KEYS,
  findStageMilestone,
} from "@/components/ventures/journey/journeyShapers";

export function milestoneWrites({
  milestoneOpenId,
  setMilestoneOpenId,
  setNotesMilestoneId,
  loadMilestoneSubmissions,
  milestoneForm,
  stages,
  notify,
  t,
  fmtDate,
  milestoneDeliverables,
  setMilestoneSaving,
  ventureId,
  setMilestoneForm,
  setMilestoneDeliverables,
  setMilestoneAddFor,
  refreshJourney,
  setMilestoneEditId,
  setMilestoneEditForm,
  milestoneEditId,
  milestoneEditForm,
  setMilestoneBusy,
  setConfirmState,
}) {
  // ── Milestones inside a journey ─────────────────────────────────────────
  const emptyMilestoneForm = { title: "", description: "", objective: "", target_date: "", owner_cid: "", owner_name: "" };

  const toggleMilestoneOpen = (id) => {
    const next = String(milestoneOpenId) === String(id) ? null : String(id);
    setMilestoneOpenId(next);
    if (!next) setNotesMilestoneId(null);
    if (next) loadMilestoneSubmissions(next);
  };

  const addMilestone = async (event, stage) => {
    event.preventDefault();
    if (!milestoneForm.title.trim()) return;
    // The roadmap reads forwards: a new milestone may not be dated in the past,
    // nor overtake a milestone that already follows it in the journey.
    const nextDate = nextMilestoneDate(stages, { stageId: stage.id });
    const milestoneIssue = milestoneDateIssue({ targetDate: milestoneForm.target_date, nextDate });
    if (milestoneIssue) {
      notify(t(DATE_ISSUE_KEYS[milestoneIssue], { date: fmtDate(nextDate) }), "error");
      return;
    }
    // Only the deliverables that will actually be saved are judged, and each is
    // owed ON or after its milestone — never before it.
    const rows = milestoneDeliverables.filter((draft) => draft.title.trim());
    const deliverableIssue = rows
      .map((deliverable) => ({ dv: deliverable, code: deliverableDateIssue({ dueDate: deliverable.due_date, milestoneDate: milestoneForm.target_date }) }))
      .find((candidate) => candidate.code);
    if (deliverableIssue) {
      notify(
        t(DATE_ISSUE_KEYS[deliverableIssue.code], {
          title: deliverableIssue.dv.title.trim(),
          date: fmtDate(milestoneForm.target_date || todayDateInput()),
        }),
        "error",
      );
      return;
    }
    setMilestoneSaving(true);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/milestones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...milestoneForm,
          journey_stage_id: stage.id,
          display_order: (stage.milestones?.length || 0) + 1,
        }),
      });
      const payload = await res.json();
      if (payload.success) {
        // Deliverables drafted in the same form are created right after the
        // milestone, so the milestone is never saved without its evidence list.
        // Each create is REPORTED: a failure here used to be discarded, leaving
        // a milestone that looked complete while its deliverables silently
        // never existed — reported as success all the same.
        let deliverablesFailed = 0;
        for (const row of rows) {
          if (!payload.milestone_id) break;
          try {
            const deliverableResponse = await fetch(`/api/ventures/${ventureId}/deliverables`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...row, milestone_id: payload.milestone_id }),
            });
            const deliverablePayload = await deliverableResponse.json().catch(() => ({}));
            if (!deliverablePayload.success) deliverablesFailed += 1;
          } catch (_) {
            deliverablesFailed += 1;
          }
        }
        if (deliverablesFailed > 0) {
          notify(t("venture.manager.milestoneAddedDeliverablesFailed", { n: deliverablesFailed }), "error");
        } else {
          notify(t("venture.manager.milestoneAdded"));
        }
        setMilestoneForm(emptyMilestoneForm);
        setMilestoneDeliverables([]);
        setMilestoneAddFor(null);
        if (payload.milestone_id) setMilestoneOpenId(String(payload.milestone_id));
        await refreshJourney();
      } else {
        notify(payload.error || t("venture.manager.actionFailed"), "error");
      }
    } catch (_) {
      notify(t("venture.manager.actionFailed"), "error");
    } finally {
      setMilestoneSaving(false);
    }
  };

  const patchMilestone = async (milestoneId, body) => {
    const res = await fetch(`/api/ventures/${ventureId}/milestones?id=${encodeURIComponent(milestoneId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await res.json().catch(() => ({}));
    // The payload matters, not just success: completing a milestone can CLOSE a
    // journey, and the caller needs to know so it can ask for the closing report.
    if (payload.success) return payload;
    notify(payload.error || t("venture.manager.actionFailed"), "error");
    return null;
  };

  const startMilestoneEdit = (milestone) => {
    setMilestoneOpenId(String(milestone.id));
    setMilestoneEditId(milestone.id);
    setMilestoneEditForm({
      title: milestone.title || "",
      description: milestone.description || "",
      objective: milestone.objective || "",
      target_date: dateOnly(milestone.target_date),
      // The owner in both halves: an identity if there is one, a name if not.
      owner_cid: milestone.owner_cid || "",
      owner_name: milestone.owner_name || "",
    });
  };

  const saveMilestoneEdit = async (event) => {
    event.preventDefault();
    // Same rules as creating one: the roadmap order is always checked — against
    // the milestones that follow AND against the deliverables this one owes —
    // while the floor is switched off as long as the stored date is left
    // untouched, so an older roadmap stays editable through a rule it predates.
    const editing = findStageMilestone(stages, milestoneEditId);
    const nextDate = nextMilestoneDate(stages, { milestoneId: milestoneEditId });
    const deliverableDates = (editing?.deliverables || []).map((deliverable) => deliverable.due_date);
    const issue = milestoneDateIssue({
      targetDate: milestoneEditForm.target_date,
      nextDate,
      deliverableDates,
      enforceFloor: dateOnly(milestoneEditForm.target_date) !== dateOnly(editing?.target_date),
    });
    if (issue) {
      const bound = issue === "milestone_date_after_deliverable" ? earliestStoredDate(deliverableDates) : nextDate;
      notify(t(DATE_ISSUE_KEYS[issue], { date: fmtDate(bound) }), "error");
      return;
    }
    // Owner travels only when the reviewer actually changed it: the form is
    // seeded from the roadmap read, and an unrelated edit (a title change) must
    // never CLEAR an owner the form could not show. A deliberate change — or a
    // deliberate clear — still passes through.
    const payload = { ...milestoneEditForm };
    if (editing) {
      const sameCid = (payload.owner_cid || "") === (editing.owner_cid || "");
      const sameName = (payload.owner_name || "") === (editing.owner_name || "");
      if (sameCid && sameName) {
        delete payload.owner_cid;
        delete payload.owner_name;
      }
    }
    const ok = await patchMilestone(milestoneEditId, payload);
    if (ok) {
      notify(t("venture.manager.milestoneUpdated"));
      setMilestoneEditId(null);
      setMilestoneEditForm({});
      await refreshJourney();
    }
  };

  const moveMilestone = async (stage, milestone, direction) => {
    setMilestoneBusy(milestone.id);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/milestones/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestone_id: milestone.id, journey_stage_id: stage.id, direction }),
      });
      const payload = await res.json();
      if (payload.success) await refreshJourney();
      else notify(payload.error || t("venture.manager.actionFailed"), "error");
    } catch (_) {
      notify(t("venture.manager.actionFailed"), "error");
    } finally {
      setMilestoneBusy(null);
    }
  };

  const duplicateMilestone = async (milestone) => {
    setMilestoneBusy(milestone.id);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/milestones/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestone_id: milestone.id }),
      });
      const payload = await res.json();
      if (payload.success) {
        notify(t("venture.manager.milestoneDuplicated"));
        await refreshJourney();
      } else {
        notify(payload.error || t("venture.manager.actionFailed"), "error");
      }
    } catch (_) {
      notify(t("venture.manager.actionFailed"), "error");
    } finally {
      setMilestoneBusy(null);
    }
  };

  const milestoneMenuItems = (stage, milestone, index, list) => [
    { key: "edit", label: t("venture.manager.editMilestone"), icon: Pencil, onSelect: () => startMilestoneEdit(milestone) },
    { key: "up", label: t("venture.manager.moveUp"), icon: ChevronUp, disabled: index === 0, onSelect: () => moveMilestone(stage, milestone, "up") },
    { key: "down", label: t("venture.manager.moveDown"), icon: ChevronDown, disabled: index === list.length - 1, onSelect: () => moveMilestone(stage, milestone, "down") },
    // Internal notes live on the milestone — never outside one.
    { key: "notes", label: t("venture.manager.notes.title"), icon: StickyNote, onSelect: () => { setMilestoneOpenId(String(milestone.id)); setNotesMilestoneId((cur) => (String(cur) === String(milestone.id) ? null : String(milestone.id))); } },
    milestone.status !== "completed" && {
      key: "complete",
      label: t("venture.manager.markCompleted"),
      icon: CheckCircle2,
      onSelect: () => setConfirmState({ kind: "milestone-complete", ids: [String(milestone.id)], n: 1, name: milestone.title, step: 1 }),
    },
    { key: "duplicate", label: t("venture.manager.duplicateMilestone"), icon: CopyPlus, onSelect: () => duplicateMilestone(milestone) },
    { separator: true },
    {
      key: "archive",
      label: t("venture.manager.archiveMilestone"),
      icon: Archive,
      danger: true,
      onSelect: () => setConfirmState({ kind: "milestone-archive", ids: [String(milestone.id)], n: 1, name: milestone.title, step: 1 }),
    },
  ].filter(Boolean);

  return {
    emptyMilestoneForm,
    toggleMilestoneOpen,
    addMilestone,
    patchMilestone,
    startMilestoneEdit,
    saveMilestoneEdit,
    moveMilestone,
    duplicateMilestone,
    milestoneMenuItems,
  };
}

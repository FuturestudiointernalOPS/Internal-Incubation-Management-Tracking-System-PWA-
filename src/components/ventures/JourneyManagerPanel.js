"use client";

import React, { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import {
  Route,
  Plus,
  X,
  Loader2,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Trash2,
  Save,
  Copy,
  CopyPlus,
  CheckCircle2,
  AlertTriangle,
  Square,
  CheckSquare,
  Archive,
  RotateCcw,
  Pencil,
  Lock,
  Play,
  StickyNote,
  Flag,
  Upload,
  CalendarPlus,
} from "lucide-react";
import ScopedNotes from "@/components/ventures/ScopedNotes";
import AppModal from "@/components/ui/AppModal";
import AppMenu from "@/components/ui/AppMenu";

/**
 * JourneyManagerPanel — staff instrument for a Venture's Journey.
 *
 * The Journey is Venture-facing but staff-defined: authorized staff (Lead
 * Manager / Facilitator / others with operating_plan capabilities on this
 * Venture) configure the stages that this Venture actually needs. Nothing is
 * hardcoded — stage name, description, objective, target date, order and
 * status are all configurable, and the journey can be generated from a
 * reusable operating-plan template (structure only).
 *
 * Server-enforced: read through the journey API; every write checks the
 * global permission matrix (`operating_plan` area) + venture-wide assignment.
 * Members only ever see the published stages on their own Journey tab.
 */
export default function JourneyManagerPanel({ ventureId }) {
  const { t, lang } = useI18n();
  const [stages, setStages] = useState([]);
  const [access, setAccess] = useState({ create: false, edit: false, manage: false });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", objective: "" });
  const [saving, setSaving] = useState(false);

  const [applyOpen, setApplyOpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [tplSel, setTplSel] = useState("");
  const [savingTpl, setSavingTpl] = useState(false);
  const [dupBusy, setDupBusy] = useState(null);
  const [notesMsId, setNotesMsId] = useState(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveForm, setSaveForm] = useState({ name: "", description: "" });
  const [savingSave, setSavingSave] = useState(false);
  const [journeyTemplates, setJourneyTemplates] = useState([]);
  const [templateSource, setTemplateSource] = useState(null);
  // Journey archive/delete: selection + archived view + busy flag.
  const [viewArchived, setViewArchived] = useState(false);
  const [selectedStageIds, setSelectedStageIds] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  // In-app confirmation flow (no browser dialogs): step 1 asks, step 2 is the
  // final confirmation for archive/delete; restore asks once.
  const [confirmState, setConfirmState] = useState(null);

  // Milestones inside a journey (Phase 1): add/edit/reorder/archive. The
  // structure controls are shown only when the server says the viewer is the
  // Lead Manager or a Super Admin (milestone_authority on the journey read).
  const [milestoneAuthority, setMilestoneAuthority] = useState(false);
  const [msAddFor, setMsAddFor] = useState(null);
  const [msForm, setMsForm] = useState({ title: "", description: "", objective: "", target_date: "" });
  // Deliverables drafted while creating the milestone (created right after it).
  const [msDeliverables, setMsDeliverables] = useState([]);
  const [msSaving, setMsSaving] = useState(false);
  const [msEditId, setMsEditId] = useState(null);
  const [msEditForm, setMsEditForm] = useState({});
  const [msBusy, setMsBusy] = useState(null);
  // Milestones are collapsed by default; clicking one opens it (accordion).
  const [msOpenId, setMsOpenId] = useState(null);

  // Deliverables (evidence) attached to a milestone: add/edit (Lead Manager /
  // Super Admin), submit evidence, approve / request changes.
  const [dvAddFor, setDvAddFor] = useState(null);
  const [dvAction, setDvAction] = useState(null); // { id, mode: edit|submit|review }
  const [dvForm, setDvForm] = useState({ title: "", description: "", deliverable_type: "document", due_date: "" });
  const [dvText, setDvText] = useState("");
  const [dvFile, setDvFile] = useState(null);
  const [dvSaving, setDvSaving] = useState(false);
  const [dvBusy, setDvBusy] = useState(null);
  // Evidence attached while defining a NEW deliverable (optional).
  const [dvNewFile, setDvNewFile] = useState(null);
  const [dvNewUrl, setDvNewUrl] = useState("");

  // Review inbox per milestone: the Venture's submitted work awaiting a
  // decision, reviewable right here (Approve / Request changes).
  const [msSubs, setMsSubs] = useState({});
  const [subsBusy, setSubsBusy] = useState(null);
  const [subsReview, setSubsReview] = useState(null); // { submission_id, task_id, milestoneId }
  const [subsComment, setSubsComment] = useState("");
  // Book a session on a milestone (date + exact time), optionally with a coach.
  const [bookFor, setBookFor] = useState(null);
  const [bookForm, setBookForm] = useState({ date: "", time: "", duration: "45", coach_id: "", title: "", note: "" });
  const [bookSaving, setBookSaving] = useState(false);
  const [coachOptions, setCoachOptions] = useState([]);

  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const notify = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  };

  const load = async () => {
    try {
      // include_archived=1: management surfaces render archived journeys in
      // their own view (the Venture never sees them).
      const res = await fetch(`/api/ventures/${ventureId}/journey?include_archived=1`);
      const d = await res.json();
      if (d.success) {
        setStages(d.stages || []);
        setAccess(d.access || {});
        setTemplateSource(d.template_source || null);
        setMilestoneAuthority(Boolean(d.milestone_authority));
      }
    } catch (e) {
      console.error("Failed to load journey:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ventureId) load();
  }, [ventureId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTemplates = async () => {
    try {
      const res = await fetch(`/api/venture-plan-templates`);
      const d = await res.json();
      if (d.success) setTemplates(d.templates || []);
    } catch (e) {
      console.error("Failed to load plan templates:", e);
    }
    try {
      const jres = await fetch(`/api/journey-templates`);
      const jd = await jres.json();
      if (jd.success) setJourneyTemplates(jd.templates || []);
    } catch (e) {
      console.error("Failed to load journey templates:", e);
    }
  };

  const toggleApply = async () => {
    const next = !applyOpen;
    setApplyOpen(next);
    if (next) await loadTemplates();
  };

  const addStage = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/journey`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (d.success) {
        notify(t("venture.manager.stageAdded"));
        setForm({ name: "", description: "", objective: "" });
        setAddOpen(false);
        setStages(d.stages || []);
      } else {
        notify(d.error || t("venture.manager.addFailed"), "error");
      }
    } catch (err) {
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
    const d = await res.json();
    if (d.success) setStages(d.stages || []);
    else notify(d.error || t("venture.manager.actionFailed"), "error");
    return d.success;
  };

  // Duplicate a stage as an independent structure copy (milestones + tasks,
  // never submissions/reviews/history — those stay with the source).
  const duplicateStage = async (stage) => {
    if (!window.confirm(t("venture.manager.duplicateStageConfirm", { name: stage.name }))) return;
    setDupBusy(stage.id);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/journey/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage_id: stage.id }),
      });
      const d = await res.json();
      if (d.success) {
        notify(t("venture.manager.duplicateStageSuccess", { milestones: d.milestones_copied || 0, tasks: d.tasks_copied || 0 }));
        setStages(d.stages || []);
      } else {
        notify(d.error || t("venture.manager.duplicateStageFailed"), "error");
      }
    } catch (e) {
      notify(t("venture.manager.duplicateStageFailed"), "error");
    } finally {
      setDupBusy(null);
    }
  };

  const saveEdit = async (e) => {
    e.preventDefault();
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
    });
  };

  const applyTemplate = async () => {
    if (!tplSel) return;
    setSavingTpl(true);
    try {
      // Journey templates (structure incl. milestones/tasks) vs operating-plan
      // templates (stage structure only) — two libraries, one picker.
      const [kind, rawId] = String(tplSel).split(":");
      const isJourneyTpl = kind === "journey";
      const endpoint = isJourneyTpl
        ? `/api/ventures/${ventureId}/journey/apply-journey-template`
        : `/api/ventures/${ventureId}/journey/apply-template`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: rawId }),
      });
      const d = await res.json();
      if (d.success) {
        notify(isJourneyTpl ? t("venture.manager.journeyTemplateApplied") : t("venture.manager.journeyGeneratedPlan"));
        setApplyOpen(false);
        setTplSel("");
        setStages(d.stages || []);
      } else {
        notify(d.error || t("venture.manager.applyFailed"), "error");
      }
    } catch (err) {
      notify(t("venture.manager.applyFailed"), "error");
    } finally {
      setSavingTpl(false);
    }
  };

  // Save this Venture's ENTIRE journey (stages + milestones + tasks) as a
  // reusable template in the ImpactOS library (structure only).
  const saveJourneyTemplate = async (e) => {
    e.preventDefault();
    setSavingSave(true);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/journey/save-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(saveForm),
      });
      const d = await res.json();
      if (d.success) {
        notify(t("venture.manager.saveTemplateSaved", { stages: d.stages || 0, milestones: d.milestones || 0, tasks: d.tasks || 0 }));
        setSaveOpen(false);
        setSaveForm({ name: "", description: "" });
      } else {
        notify(d.error || t("venture.manager.saveTemplateFailed"), "error");
      }
    } catch (err) {
      notify(t("venture.manager.saveTemplateFailed"), "error");
    } finally {
      setSavingSave(false);
    }
  };

  // ── Journey archive / permanent delete (double-confirmed) ────────────────
  const activeStages = stages.filter((s) => s.is_archived !== true);
  const archivedStages = stages.filter((s) => s.is_archived === true);
  const visibleStages = viewArchived ? archivedStages : activeStages;
  const allSelected =
    activeStages.length > 0 && activeStages.every((s) => selectedStageIds.has(String(s.id)));

  const toggleSelectStage = (id) => {
    const next = new Set(selectedStageIds);
    const key = String(id);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedStageIds(next);
  };
  const toggleSelectAllStages = () => {
    if (allSelected) setSelectedStageIds(new Set());
    else setSelectedStageIds(new Set(activeStages.map((s) => String(s.id))));
  };

  const runBulk = async ({ ids, action = "archive", endpoint }) => {
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/journey/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action }),
      });
      const d = await res.json();
      if (d.success) {
        const done =
          endpoint === "delete"
            ? d.deleted || []
            : action === "restore"
              ? d.restored || []
              : d.archived || [];
        const blocked = d.blocked || [];
        const parts = [];
        if (done.length) {
          parts.push(
            endpoint === "delete"
              ? t("venture.manager.journeysDeleted", { n: done.length })
              : action === "restore"
                ? t("venture.manager.journeysRestored", { n: done.length })
                : t("venture.manager.journeysArchived", { n: done.length }),
          );
        }
        if (blocked.length) parts.push(blocked[0]?.reason || t("venture.manager.journeysBlocked", { n: blocked.length }));
        notify(parts.join(" — ") || t("venture.manager.journeysArchived", { n: 0 }), blocked.length && !done.length ? "error" : "success");
        if (d.stages) setStages(d.stages);
      } else {
        notify(d.error || t("venture.manager.actionFailed"), "error");
      }
    } catch (_) {
      notify(t("venture.manager.actionFailed"), "error");
    }
    setSelectedStageIds(new Set());
    setBulkBusy(false);
  };

  // Destructive journey actions always go through an in-app confirmation
  // modal. Archive/delete need TWO explicit steps; restore needs one.
  const selectedActiveIds = () =>
    activeStages.filter((s) => selectedStageIds.has(String(s.id))).map((s) => String(s.id));

  const askArchiveSelected = () => {
    const ids = selectedActiveIds();
    if (ids.length) setConfirmState({ kind: "archive", ids, n: ids.length, step: 1 });
  };

  const askDeleteSelected = () => {
    const ids = selectedActiveIds();
    if (ids.length) setConfirmState({ kind: "delete", ids, n: ids.length, step: 1 });
  };

  const archiveOneJourney = (stage) =>
    setConfirmState({ kind: "archive", ids: [String(stage.id)], n: 1, name: stage.name, step: 1 });
  const restoreOneJourney = (stage) =>
    setConfirmState({ kind: "restore", ids: [String(stage.id)], n: 1, name: stage.name, step: 1 });
  const deleteOneJourney = (stage) =>
    setConfirmState({ kind: "delete", ids: [String(stage.id)], n: 1, name: stage.name, step: 1 });

  // ── Milestones inside a journey ─────────────────────────────────────────
  const emptyMilestoneForm = { title: "", description: "", objective: "", target_date: "" };

  const toggleMilestoneOpen = (id) => {
    const next = String(msOpenId) === String(id) ? null : String(id);
    setMsOpenId(next);
    if (!next) setNotesMsId(null);
    if (next) loadMilestoneSubmissions(next);
  };

  /** The Venture's submissions awaiting a decision inside one milestone. */
  const loadMilestoneSubmissions = async (milestoneId) => {
    try {
      const res = await fetch(
        `/api/ventures/${ventureId}/submissions/review-queue?milestone_id=${encodeURIComponent(milestoneId)}`,
      );
      const d = await res.json();
      setMsSubs((p) => ({ ...p, [milestoneId]: d.success ? d.items || [] : [] }));
    } catch (_) {
      setMsSubs((p) => ({ ...p, [milestoneId]: [] }));
    }
  };

  const decideSubmission = async (milestoneId, item, decision, comment = "") => {
    setSubsBusy(item.submission_id);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/tasks/${item.task_id}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "review",
          submission_id: item.submission_id,
          decision,
          comment: comment.trim() || null,
        }),
      });
      const d = await res.json();
      if (d.success) {
        notify(t(decision === "approved" ? "venture.manager.submissionApproved" : "venture.manager.submissionChangesRequested"));
        setSubsReview(null);
        setSubsComment("");
        await loadMilestoneSubmissions(milestoneId);
      } else {
        notify(d.error || t("venture.manager.actionFailed"), "error");
      }
    } catch (_) {
      notify(t("venture.manager.actionFailed"), "error");
    } finally {
      setSubsBusy(null);
    }
  };

  const openBooking = async (ms) => {
    setBookFor(ms.id);
    setBookForm({ date: "", time: "", duration: "45", coach_id: "", title: ms.title || "", note: "" });
    if (coachOptions.length === 0) {
      try {
        const res = await fetch(`/api/ventures/${ventureId}/coaches`);
        const d = await res.json();
        if (d.success) setCoachOptions(d.coaches || []);
      } catch (_) {}
    }
  };

  const bookSession = async (e, stage, ms) => {
    e.preventDefault();
    if (!bookForm.date || !bookForm.time) return;
    // A session always carries its internal note — the record of why it exists.
    if (!bookForm.note.trim()) {
      notify(t("venture.manager.sessionNoteRequired"), "error");
      return;
    }
    setBookSaving(true);
    try {
      const start = new Date(`${bookForm.date}T${bookForm.time}:00`);
      const minutes = Number(bookForm.duration) || 45;
      const end = new Date(start.getTime() + minutes * 60000);
      const coach = coachOptions.find((c) => String(c.coach_id) === String(bookForm.coach_id));
      const res = await fetch(`/api/ventures/${ventureId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_session",
          title: bookForm.title || ms.title,
          description: bookForm.note.trim(),
          session_type: "coaching",
          coach_id: bookForm.coach_id || null,
          coach_name: coach?.full_name || null,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          // The Venture is meant to see this session and be notified of it.
          venture_facing: true,
          journey_stage_id: stage.id,
          milestone_ref: String(ms.id),
        }),
      });
      const d = await res.json();
      if (d.success) {
        notify(t("venture.manager.sessionBooked"));
        setBookFor(null);
      } else {
        notify(d.error || t("venture.manager.actionFailed"), "error");
      }
    } catch (_) {
      notify(t("venture.manager.actionFailed"), "error");
    } finally {
      setBookSaving(false);
    }
  };

  const addMsDeliverable = () =>
    setMsDeliverables((p) => [...p, { title: "", deliverable_type: "document", due_date: "" }]);
  const updateMsDeliverable = (idx, patch) =>
    setMsDeliverables((p) => p.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  const removeMsDeliverable = (idx) =>
    setMsDeliverables((p) => p.filter((_, i) => i !== idx));

  const addMilestone = async (e, stage) => {
    e.preventDefault();
    if (!msForm.title.trim()) return;
    setMsSaving(true);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/milestones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...msForm,
          journey_stage_id: stage.id,
          display_order: (stage.milestones?.length || 0) + 1,
        }),
      });
      const d = await res.json();
      if (d.success) {
        // Deliverables drafted in the same form are created right after the
        // milestone, so the milestone is never saved without its evidence list.
        const rows = msDeliverables.filter((x) => x.title.trim());
        for (const row of rows) {
          if (!d.milestone_id) break;
          await fetch(`/api/ventures/${ventureId}/deliverables`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...row, milestone_id: d.milestone_id }),
          }).catch(() => {});
        }
        notify(t("venture.manager.milestoneAdded"));
        setMsForm(emptyMilestoneForm);
        setMsDeliverables([]);
        setMsAddFor(null);
        if (d.milestone_id) setMsOpenId(String(d.milestone_id));
        await load();
      } else {
        notify(d.error || t("venture.manager.actionFailed"), "error");
      }
    } catch (_) {
      notify(t("venture.manager.actionFailed"), "error");
    } finally {
      setMsSaving(false);
    }
  };

  const patchMilestone = async (milestoneId, body) => {
    const res = await fetch(`/api/ventures/${ventureId}/milestones?id=${encodeURIComponent(milestoneId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    if (d.success) return true;
    notify(d.error || t("venture.manager.actionFailed"), "error");
    return false;
  };

  const startMilestoneEdit = (ms) => {
    setMsOpenId(String(ms.id));
    setMsEditId(ms.id);
    setMsEditForm({
      title: ms.title || "",
      description: ms.description || "",
      objective: ms.objective || "",
      target_date: ms.target_date ? String(ms.target_date).slice(0, 10) : "",
    });
  };

  const saveMilestoneEdit = async (e) => {
    e.preventDefault();
    const ok = await patchMilestone(msEditId, msEditForm);
    if (ok) {
      notify(t("venture.manager.milestoneUpdated"));
      setMsEditId(null);
      setMsEditForm({});
      await load();
    }
  };

  const moveMilestone = async (stage, ms, direction) => {
    setMsBusy(ms.id);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/milestones/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestone_id: ms.id, journey_stage_id: stage.id, direction }),
      });
      const d = await res.json();
      if (d.success) await load();
      else notify(d.error || t("venture.manager.actionFailed"), "error");
    } catch (_) {
      notify(t("venture.manager.actionFailed"), "error");
    } finally {
      setMsBusy(null);
    }
  };

  const duplicateMilestone = async (ms) => {
    setMsBusy(ms.id);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/milestones/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestone_id: ms.id }),
      });
      const d = await res.json();
      if (d.success) {
        notify(t("venture.manager.milestoneDuplicated"));
        await load();
      } else {
        notify(d.error || t("venture.manager.actionFailed"), "error");
      }
    } catch (_) {
      notify(t("venture.manager.actionFailed"), "error");
    } finally {
      setMsBusy(null);
    }
  };

  // ── Deliverables inside a milestone ──────────────────────────────────────
  // Evidence is a document or a URL — only these two types exist.
  const DELIVERABLE_TYPES = ["document", "link"];
  const emptyDeliverableForm = { title: "", description: "", deliverable_type: "document", due_date: "" };

  const patchDeliverable = async (body) => {
    const res = await fetch(`/api/ventures/${ventureId}/deliverables`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    if (d.success) return true;
    notify(d.error || t("venture.manager.actionFailed"), "error");
    return false;
  };

  const addDeliverable = async (e, ms) => {
    e.preventDefault();
    if (!dvForm.title.trim()) return;
    setDvSaving(true);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/deliverables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...dvForm, milestone_id: ms.id }),
      });
      const d = await res.json();
      if (d.success) {
        // Evidence attached while defining the deliverable: upload it and
        // record it as submitted right away.
        let evidenceUrl = dvNewUrl.trim();
        let evidenceName = null;
        if (dvNewFile) {
          const fd = new FormData();
          fd.append("file", dvNewFile);
          if (d.id) fd.append("deliverable_id", String(d.id));
          const upRes = await fetch(`/api/ventures/${ventureId}/deliverables/upload`, { method: "POST", body: fd });
          const up = await upRes.json().catch(() => ({}));
          if (!up.success) {
            notify(up.error || t("venture.manager.actionFailed"), "error");
            await load();
            return;
          }
          evidenceUrl = up.path;
          evidenceName = up.name || dvNewFile.name || null;
        }
        if (d.id && evidenceUrl) {
          await fetch(`/api/ventures/${ventureId}/deliverables`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: d.id, action: "submit", attachment_url: evidenceUrl, attachment_name: evidenceName }),
          }).catch(() => {});
        }
        notify(t("venture.manager.deliverableAdded"));
        setDvForm(emptyDeliverableForm);
        setDvNewFile(null);
        setDvNewUrl("");
        setDvAddFor(null);
        await load();
      } else {
        notify(d.error || t("venture.manager.actionFailed"), "error");
      }
    } catch (_) {
      notify(t("venture.manager.actionFailed"), "error");
    } finally {
      setDvSaving(false);
    }
  };

  const startDeliverableEdit = (dv) => {
    setDvAction({ id: dv.id, mode: "edit" });
    setDvForm({
      title: dv.title || "",
      description: dv.description || "",
      deliverable_type: dv.deliverable_type || "document",
      due_date: dv.due_date ? String(dv.due_date).slice(0, 10) : "",
    });
  };

  const saveDeliverableEdit = async (e) => {
    e.preventDefault();
    setDvSaving(true);
    const ok = await patchDeliverable({ id: dvAction.id, action: "update", ...dvForm });
    setDvSaving(false);
    if (ok) {
      notify(t("venture.manager.deliverableUpdated"));
      setDvAction(null);
      await load();
    }
  };

  const submitDeliverableEvidence = async () => {
    if (!dvFile && !dvText.trim()) return;
    setDvSaving(true);
    try {
      let url = dvText.trim();
      let name = null;
      // A chosen file is uploaded first (any type, max 5MB); the returned URL
      // is what gets recorded on the deliverable.
      if (dvFile) {
        const fd = new FormData();
        fd.append("file", dvFile);
        if (dvAction?.id) fd.append("deliverable_id", String(dvAction.id));
        const upRes = await fetch(`/api/ventures/${ventureId}/deliverables/upload`, { method: "POST", body: fd });
        const up = await upRes.json().catch(() => ({}));
        if (!up.success) {
          notify(up.error || t("venture.manager.actionFailed"), "error");
          return;
        }
        url = up.path;
        name = up.name || dvFile.name || null;
      }
      const ok = await patchDeliverable({ id: dvAction.id, action: "submit", attachment_url: url, attachment_name: name });
      if (ok) {
        notify(t("venture.manager.deliverableSubmitted"));
        setDvAction(null);
        setDvText("");
        setDvFile(null);
        await load();
      }
    } catch (_) {
      notify(t("venture.manager.actionFailed"), "error");
    } finally {
      setDvSaving(false);
    }
  };

  const reviewDeliverable = async (dv, decision) => {
    setDvBusy(dv.id);
    const ok = await patchDeliverable({
      id: dv.id,
      action: "review",
      decision,
      comments: decision === "changes_requested" ? dvText.trim() : undefined,
    });
    setDvBusy(null);
    if (ok) {
      notify(t("venture.manager.deliverableReviewed", { decision: t(decision === "approved" ? "venture.manager.approveDeliverable" : "venture.manager.requestChanges") }));
      setDvAction(null);
      setDvText("");
      await load();
    }
  };

  const deliverableStatus = (dv) => {
    if (dv.approval_status === "approved" || dv.status === "completed" || dv.status === "approved") {
      return { key: "approved", dot: "bg-emerald-400", cls: "text-emerald-400 bg-emerald-500/10" };
    }
    if (dv.approval_status === "rejected") {
      return { key: "changes_requested", dot: "bg-rose-400", cls: "text-rose-400 bg-rose-500/10" };
    }
    if (dv.status === "submitted") {
      return { key: "submitted", dot: "bg-amber-400", cls: "text-amber-400 bg-amber-500/10" };
    }
    if (dv.status === "in_progress") {
      return { key: "in_progress", dot: "bg-sky-400", cls: "text-sky-400 bg-sky-500/10" };
    }
    return { key: "pending", dot: "bg-slate-500", cls: "text-slate-400 bg-slate-500/10" };
  };

  const deliverableMenuItems = (dv) => [
    { key: "edit", label: t("venture.manager.editDeliverable"), icon: Pencil, onSelect: () => startDeliverableEdit(dv) },
    { key: "submit", label: t("venture.manager.submitEvidence"), icon: Upload, onSelect: () => { setDvAction({ id: dv.id, mode: "submit" }); setDvText(/^https?:\/\//i.test(dv.attachment_url || "") ? dv.attachment_url : ""); } },
    { separator: true },
    { key: "approve", label: t("venture.manager.approveDeliverable"), icon: CheckCircle2, onSelect: () => reviewDeliverable(dv, "approved") },
    { key: "changes", label: t("venture.manager.requestChanges"), icon: RotateCcw, onSelect: () => { setDvAction({ id: dv.id, mode: "review" }); setDvText(""); } },
  ];

  const milestoneMenuItems = (stage, ms, idx, list) => [
    { key: "edit", label: t("venture.manager.editMilestone"), icon: Pencil, onSelect: () => startMilestoneEdit(ms) },
    { key: "up", label: t("venture.manager.moveUp"), icon: ChevronUp, disabled: idx === 0, onSelect: () => moveMilestone(stage, ms, "up") },
    { key: "down", label: t("venture.manager.moveDown"), icon: ChevronDown, disabled: idx === list.length - 1, onSelect: () => moveMilestone(stage, ms, "down") },
    // Internal notes live on the milestone — never outside one.
    { key: "notes", label: t("venture.manager.notes.title"), icon: StickyNote, onSelect: () => { setMsOpenId(String(ms.id)); setNotesMsId((cur) => (String(cur) === String(ms.id) ? null : String(ms.id))); } },
    ms.status !== "completed" && {
      key: "complete",
      label: t("venture.manager.markCompleted"),
      icon: CheckCircle2,
      onSelect: () => setConfirmState({ kind: "milestone-complete", ids: [String(ms.id)], n: 1, name: ms.title, step: 1 }),
    },
    { key: "duplicate", label: t("venture.manager.duplicateMilestone"), icon: CopyPlus, onSelect: () => duplicateMilestone(ms) },
    { separator: true },
    {
      key: "archive",
      label: t("venture.manager.archiveMilestone"),
      icon: Archive,
      danger: true,
      onSelect: () => setConfirmState({ kind: "milestone-archive", ids: [String(ms.id)], n: 1, name: ms.title, step: 1 }),
    },
  ].filter(Boolean);

  const journeyMenuItems = (stage, i) => [
    stage.status === "locked" && {
      key: "activate", label: t("venture.manager.activateStage"), icon: Play,
      onSelect: () => patch({ action: "activate", stage_id: stage.id }),
    },
    stage.status === "active" && {
      key: "lock", label: t("venture.manager.lockStage"), icon: Lock,
      onSelect: () => patch({ action: "lock", stage_id: stage.id }),
    },
    stage.status === "completed" && {
      key: "reset", label: t("venture.manager.reopenStage"), icon: RotateCcw,
      onSelect: () => patch({ action: "reset", stage_id: stage.id }),
    },
    { separator: true },
    { key: "edit", label: t("venture.manager.editStage"), icon: Pencil, disabled: !access.edit, onSelect: () => startEdit(stage) },
    { key: "up", label: t("venture.manager.moveUp"), icon: ChevronUp, disabled: !access.manage || i === 0, onSelect: () => patch({ action: "move", stage_id: stage.id, direction: "up" }) },
    { key: "down", label: t("venture.manager.moveDown"), icon: ChevronDown, disabled: !access.manage || i === visibleStages.length - 1, onSelect: () => patch({ action: "move", stage_id: stage.id, direction: "down" }) },
    { key: "duplicate", label: t("venture.manager.duplicateStageTitle"), icon: CopyPlus, disabled: !access.manage || dupBusy === stage.id, onSelect: () => duplicateStage(stage) },
    { separator: true },
    { key: "archive", label: t("venture.manager.archiveJourney"), icon: Archive, disabled: !access.manage, onSelect: () => archiveOneJourney(stage) },
    { key: "delete", label: t("venture.manager.deleteJourney"), icon: Trash2, danger: true, disabled: !access.manage, onSelect: () => deleteOneJourney(stage) },
  ].filter(Boolean);

  const confirmCopy = (state) => {
    if (!state) return { title: "", body: "", confirm: "" };
    if (state.kind === "milestone-complete") {
      return {
        title: t("venture.manager.markCompleted"),
        body: t("venture.manager.completeMilestoneConfirm", { name: state.name }),
        confirm: t("venture.manager.markCompleted"),
      };
    }
    if (state.kind === "milestone-archive") {
      return {
        title: t("venture.manager.archiveMilestone"),
        body: t("venture.manager.milestoneArchiveConfirm", { name: state.name }),
        confirm: t("venture.manager.archiveMilestone"),
      };
    }
    if (state.kind === "archive") {
      return {
        title: t("venture.manager.archiveJourney"),
        body:
          state.step === 1
            ? t("venture.manager.archiveJourneysConfirm", { n: state.n })
            : t("venture.manager.archiveJourneysConfirm2", { n: state.n }),
        confirm: t("venture.manager.archiveJourney"),
      };
    }
    if (state.kind === "restore") {
      return {
        title: t("venture.manager.restoreJourney"),
        body: t("venture.manager.restoreJourneyConfirm", { name: state.name }),
        confirm: t("venture.manager.restoreJourney"),
      };
    }
    return {
      title: t("venture.manager.deleteJourney"),
      body:
        state.step === 1
          ? t("venture.manager.deleteJourneysConfirm", { n: state.n })
          : t("venture.manager.deleteJourneysConfirm2", { n: state.n }),
      confirm: t("common.delete"),
    };
  };

  const confirmBusy = bulkBusy;

  const runConfirmedAction = async () => {
    if (!confirmState) return;
    const { kind, ids, step } = confirmState;

    // Milestone actions are single-step in-app confirmations.
    if (kind === "milestone-complete") {
      setConfirmState(null);
      const ok = await patchMilestone(ids[0], { status: "completed" });
      if (ok) {
        notify(t("venture.manager.milestoneCompleted"));
        await load();
      }
      return;
    }
    if (kind === "milestone-archive") {
      setConfirmState(null);
      setMsBusy(ids[0]);
      try {
        const res = await fetch(`/api/ventures/${ventureId}/milestones/archive`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, action: "archive" }),
        });
        const d = await res.json();
        if (d.success) {
          const archived = d.archived || [];
          const blocked = d.blocked || [];
          const parts = [];
          if (archived.length) parts.push(t("venture.manager.milestoneArchived"));
          if (blocked.length) parts.push(blocked[0]?.reason || t("venture.manager.actionFailed"));
          notify(parts.join(" — ") || t("venture.manager.milestoneArchived"), blocked.length && !archived.length ? "error" : "success");
          await load();
        } else {
          notify(d.error || t("venture.manager.actionFailed"), "error");
        }
      } catch (_) {
        notify(t("venture.manager.actionFailed"), "error");
      } finally {
        setMsBusy(null);
      }
      return;
    }

    // Archive/delete: step 1 → step 2 → execute. Restore executes at step 1.
    if ((kind === "archive" || kind === "delete") && step === 1) {
      setConfirmState({ ...confirmState, step: 2 });
      return;
    }
    setConfirmState(null);
    if (kind === "restore") await runBulk({ ids, action: "restore", endpoint: "archive" });
    else if (kind === "archive") await runBulk({ ids, action: "archive", endpoint: "archive" });
    else await runBulk({ ids, endpoint: "delete" });
  };

  const stageStatusKey = (status) =>
    status === "completed"
      ? "vadmin.journey.statusCompleted"
      : status === "active"
        ? "vadmin.journey.statusActive"
        : "vadmin.journey.statusLocked";

  const stageNodeClass = (status) =>
    status === "completed"
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/40"
      : status === "active"
        ? "bg-blue-500/15 text-blue-400 border-blue-500/40"
        : "bg-slate-500/10 text-slate-400 border-[var(--border-primary)]";

  const milestoneStatusKey = (status) => {
    const known = ["locked", "not_started", "in_progress", "under_review", "changes_requested", "completed"];
    return known.includes(status)
      ? t(`venture.manager.milestoneStatuses.${status}`)
      : status ? status.replace(/_/g, " ") : "—";
  };

  const milestoneStatusClass = (status) =>
    status === "completed"
      ? "text-emerald-400 bg-emerald-500/10"
      : status === "in_progress"
        ? "text-sky-400 bg-sky-500/10"
        : status === "under_review"
          ? "text-amber-400 bg-amber-500/10"
          : status === "changes_requested"
            ? "text-rose-400 bg-rose-500/10"
            : "text-slate-400 bg-slate-500/10";

  const milestoneDotClass = (status) =>
    status === "completed"
      ? "bg-emerald-400"
      : status === "in_progress"
        ? "bg-sky-400"
        : status === "under_review"
          ? "bg-amber-400"
          : status === "changes_requested"
            ? "bg-rose-400"
            : "bg-slate-500";

  const statusPill = (stage) => {
    const cls =
      stage.status === "completed"
        ? "bg-emerald-500/10 text-emerald-400"
        : stage.status === "active"
          ? "bg-blue-500/10 text-blue-400"
          : "bg-slate-500/10 text-slate-400";
    return (
      <span className={`text-[9px] uppercase tracking-widest px-2 py-0.5 rounded ${cls}`}>{t(stageStatusKey(stage.status))}</span>
    );
  };

  const fmtDate = (iso) => (iso ? new Date(`${String(iso).slice(0, 10)}T00:00:00`).toLocaleDateString(lang) : "");

  return (
    <div className="card">
      {/* Inline status message — never a floating top-right toast */}
      {toast && (
        <div className={`mb-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-bold ${toast.type === "error" ? "bg-rose-500/10 text-rose-400 border-rose-500/30" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"}`}>
          {toast.type === "error" ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span>{toast.msg}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Route className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
          {t("venture.manager.title")}
          <span className="px-1.5 py-0.5 rounded bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]">{t("venture.manager.stagesCount", { count: activeStages.length })}</span>
        </h3>
        {access.create && (
          <div className="flex items-center gap-2">
            <button
              onClick={toggleApply}
              className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-[var(--border-primary)] text-slate-500 hover:text-[var(--text-primary)] flex items-center gap-1.5"
            >
              <Copy className="w-3 h-3" />
              {applyOpen ? t("common.cancel") : t("venture.manager.fromTemplate")}
            </button>
            {access.manage && stages.length > 0 && (
              <button
                onClick={() => setSaveOpen(!saveOpen)}
                className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-[var(--brand-orange)]/40 text-[var(--brand-orange)] hover:bg-[var(--brand-orange)]/10 flex items-center gap-1.5"
              >
                <Save className="w-3 h-3" />
                {t("venture.manager.saveTemplate")}
              </button>
            )}
            <button
              onClick={() => setAddOpen(!addOpen)}
              className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-[var(--brand-orange)] text-black flex items-center gap-1.5"
            >
              {addOpen ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
              {addOpen ? t("common.cancel") : t("venture.manager.addStage")}
            </button>
          </div>
        )}
      </div>
      <p className="text-[10px] text-slate-400 mb-3 -mt-1">{t("venture.manager.intro")}</p>

      {templateSource && (
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-[var(--brand-orange)]/25 bg-[var(--brand-orange)]/[0.04] px-4 py-2.5">
          <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-[var(--brand-orange)]">
            <Copy className="w-3.5 h-3.5" /> {t("venture.manager.sourceFrom")}
          </span>
          <span className="text-xs font-bold text-[var(--text-primary)]">{templateSource.name || templateSource.id}</span>
          <span className="px-1.5 py-0.5 rounded bg-[var(--brand-orange)]/10 text-[9px] font-black uppercase tracking-widest text-[var(--brand-orange)]">
            {t(templateSource.type === "journey" ? "venture.manager.sourceTypeJourney" : "venture.manager.sourceTypePlan")}
          </span>
        </div>
      )}

      {/* Journey archive toolbar: Active/Archived views, select all, bulk
          archive/delete (each with a double confirmation). */}
      {access.manage && stages.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button
            onClick={() => { setViewArchived(false); setSelectedStageIds(new Set()); }}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${!viewArchived ? "bg-[var(--brand-orange)]/15 text-[var(--brand-orange)] border-[var(--brand-orange)]/30" : "bg-tertiary border-[var(--border-primary)] text-slate-500 hover:text-[var(--text-primary)]"}`}
          >
            {t("venture.manager.viewActiveJourneys", { n: activeStages.length })}
          </button>
          <button
            onClick={() => { setViewArchived(true); setSelectedStageIds(new Set()); }}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${viewArchived ? "bg-[var(--brand-orange)]/15 text-[var(--brand-orange)] border-[var(--brand-orange)]/30" : "bg-tertiary border-[var(--border-primary)] text-slate-500 hover:text-[var(--text-primary)]"}`}
          >
            {t("venture.manager.viewArchivedJourneys", { n: archivedStages.length })}
          </button>
          {!viewArchived && activeStages.length > 0 && (
            <button
              onClick={toggleSelectAllStages}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-[var(--text-primary)] border border-[var(--border-primary)] transition-all"
            >
              {allSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
              {t("venture.manager.selectAllJourneys")}
            </button>
          )}
          {!viewArchived && selectedStageIds.size > 0 && (
            <>
              <button
                onClick={askArchiveSelected}
                disabled={bulkBusy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 disabled:opacity-40"
              >
                {bulkBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
                {t("venture.manager.archiveSelectedJourneys", { n: selectedStageIds.size })}
              </button>
              <button
                onClick={askDeleteSelected}
                disabled={bulkBusy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25 disabled:opacity-40"
              >
                {bulkBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                {t("venture.manager.deleteSelectedJourneys", { n: selectedStageIds.size })}
              </button>
            </>
          )}
        </div>
      )}

      {saveOpen && (
        <form onSubmit={saveJourneyTemplate} className="mb-4 p-3 rounded-xl border border-[var(--brand-orange)]/30 bg-tertiary space-y-2">
          <p className="text-[9px] font-black uppercase tracking-widest text-[var(--brand-orange)]">
            {t("venture.manager.saveTemplateTitle")}
          </p>
          <input
            value={saveForm.name}
            onChange={(e) => setSaveForm({ ...saveForm, name: e.target.value })}
            placeholder={t("venture.manager.saveTemplateNamePlaceholder")}
            className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
          />
          <textarea
            rows={2}
            value={saveForm.description}
            onChange={(e) => setSaveForm({ ...saveForm, description: e.target.value })}
            placeholder={t("venture.manager.saveTemplateDescPlaceholder")}
            className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
          />
          <div className="flex items-center gap-2 justify-end">
            <button type="button" onClick={() => { setSaveOpen(false); setSaveForm({ name: "", description: "" }); }} className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-[var(--border-primary)] text-slate-500 hover:text-[var(--text-primary)]">
              {t("common.cancel")}
            </button>
            <button type="submit" disabled={savingSave} className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-[var(--brand-orange)] text-black flex items-center gap-1.5 disabled:opacity-50">
              {savingSave ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} {t("venture.manager.saveTemplate")}
            </button>
          </div>
        </form>
      )}

      {applyOpen && (
        <div className="mb-4 p-3 rounded-xl border border-[var(--border-primary)] bg-tertiary flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">{t("venture.manager.generateFromTemplate")}</label>
            <select value={tplSel} onChange={(e) => setTplSel(e.target.value)} className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]">
              <option value="">{t("venture.manager.selectTemplate")}</option>
              {journeyTemplates.map((tpl) => (
                <option key={`j-${tpl.id}`} value={`journey:${tpl.id}`}>{t("venture.manager.journeyTplOption", { name: tpl.name, count: tpl.stage_count || 0 })}</option>
              ))}
              {journeyTemplates.length > 0 && templates.length > 0 && <option disabled>──────────</option>}
              {templates.map((tpl) => (
                <option key={`p-${tpl.id}`} value={`plan:${tpl.id}`}>{t("venture.manager.planTplOption", { name: tpl.name, count: tpl.section_count || 0 })}</option>
              ))}
            </select>
          </div>
          <button onClick={applyTemplate} disabled={savingTpl || !tplSel} className="px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50">
            {savingTpl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />} {t("venture.manager.generate")}
          </button>
        </div>
      )}

      {addOpen && (
        <form onSubmit={addStage} className="mb-4 p-4 rounded-xl border border-[var(--border-primary)] bg-tertiary space-y-3">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={t("venture.manager.stageNamePlaceholder")}
            className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
            required
          />
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            placeholder={t("venture.manager.stageDescPlaceholder")}
            className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
          />
          <input
            value={form.objective}
            onChange={(e) => setForm({ ...form, objective: e.target.value })}
            placeholder={t("venture.manager.stageObjectivePlaceholder")}
            className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
          />
          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} {t("venture.manager.addStage")}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-6"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" /></div>
      ) : visibleStages.length === 0 ? (
        viewArchived ? (
          <div className="rounded-xl border border-dashed border-[var(--border-primary)] p-6 text-center">
            <Archive className="w-6 h-6 mx-auto text-slate-500 mb-2" />
            <p className="text-xs font-bold text-[var(--text-primary)]">{t("venture.manager.emptyArchivedJourneys")}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--border-primary)] p-8 text-center">
            <Route className="w-6 h-6 mx-auto text-slate-500 mb-2" />
            <p className="text-xs font-bold text-[var(--text-primary)]">{t("venture.manager.noStages")}</p>
            <p className="text-[10px] text-slate-500 mt-1 max-w-md mx-auto">{t("venture.manager.noStagesDesc")}</p>
          </div>
        )
      ) : (
        <div className="space-y-5">
          {visibleStages.map((stage, i) => {
            const isEditing = editId === stage.id;
            const milestones = stage.milestones || [];
            const done = stage.milestone_counts?.completed || 0;
            const total = stage.milestone_counts?.total || 0;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            const isDone = stage.status === "completed";
            const isActive = stage.status === "active";
            const isLocked = stage.status === "locked";
            return (
              <div key={stage.id} className="relative pl-10">
                {/* Timeline connector between stage nodes */}
                {i < visibleStages.length - 1 && (
                  <span aria-hidden className={`absolute left-[15px] top-9 -bottom-5 w-px ${isDone ? "bg-emerald-500/40" : "bg-[var(--border-primary)]"}`} />
                )}
                {/* Stage node */}
                <span
                  className={`absolute left-0 top-0 w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] font-black ${stageNodeClass(stage.status)} ${isActive ? "ring-4 ring-blue-500/10" : ""}`}
                >
                  {isDone ? <CheckCircle2 className="w-4 h-4" /> : (stage.stage_order || i + 1)}
                </span>

                <div className={`card overflow-hidden ${isLocked ? "opacity-80" : ""}`}>
                  {isEditing ? (
                    <form onSubmit={saveEdit} className="p-4 space-y-3">
                      <input
                        value={editForm.name || ""}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        placeholder={t("venture.manager.stageNamePlaceholder")}
                        className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
                        required
                      />
                      <textarea
                        value={editForm.description || ""}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        rows={2}
                        placeholder={t("venture.manager.stageDescPlaceholder")}
                        className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                      />
                      <input
                        value={editForm.objective || ""}
                        onChange={(e) => setEditForm({ ...editForm, objective: e.target.value })}
                        placeholder={t("venture.manager.stageObjectivePlaceholder")}
                        className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                      />
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => { setEditId(null); setEditForm({}); }} className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-[var(--border-primary)] text-slate-500 hover:bg-tertiary">
                          {t("common.cancel")}
                        </button>
                        <button type="submit" className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-[var(--brand-orange)] text-black flex items-center gap-1">
                          <Save className="w-3 h-3" /> {t("common.save")}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="p-4 pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2 min-w-0">
                            {access.manage && !stage.is_archived && (
                              <button
                                onClick={() => toggleSelectStage(stage.id)}
                                className={`mt-0.5 shrink-0 transition-colors ${selectedStageIds.has(String(stage.id)) ? "text-[var(--brand-orange)]" : "text-slate-500 hover:text-[var(--text-primary)]"}`}
                                title={t("venture.manager.selectJourney")}
                              >
                                {selectedStageIds.has(String(stage.id)) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                              </button>
                            )}
                            <h4 className={`text-sm font-black text-[var(--text-primary)] ${isDone ? "line-through text-slate-400" : ""}`}>{stage.name}</h4>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {statusPill(stage)}
                            {!isEditing && !stage.is_archived && (access.edit || access.manage) && (
                              <AppMenu
                                label={t("venture.manager.journeyActions")}
                                align="right"
                                buttonClassName="!p-1"
                                items={journeyMenuItems(stage, i)}
                              />
                            )}
                            {!isEditing && stage.is_archived && access.manage && (
                              <button onClick={() => restoreOneJourney(stage)} disabled={bulkBusy} className="p-1 text-slate-400 hover:text-emerald-400 disabled:opacity-40" title={t("venture.manager.restoreJourney")}>
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        {stage.description && <p className="text-xs text-[var(--text-secondary)] mt-1.5">{stage.description}</p>}
                        {stage.objective && (
                          <p className="text-[10px] text-[var(--text-secondary)] italic mt-1">
                            <span className="font-bold not-italic uppercase tracking-widest text-slate-500">{t("venture.manager.objective")}: </span>{stage.objective}
                          </p>
                        )}
                        {(stage.completed_at || !isDone) && (
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[10px] text-slate-400">
                            {stage.completed_at && <span>{t("venture.manager.completedOn", { date: new Date(stage.completed_at).toLocaleDateString(lang) })}</span>}
                            {!isDone && (
                              <span className={isActive ? "text-sky-300/90" : "text-slate-500"}>
                                {t(isLocked ? "venture.manager.memberVisibilityLocked" : "venture.manager.memberVisibilityActive")}
                              </span>
                            )}
                            {isActive && (
                              <span className="text-[10px] text-slate-500 italic">{t("venture.manager.journeyAutoCompletes")}</span>
                            )}
                          </div>
                        )}
                        {total > 0 && (
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                              <span>{t("venture.manager.milestoneProgress", { done, total })}</span>
                              <span className={isDone ? "text-emerald-400" : "text-[var(--brand-orange)]"}>{pct}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-tertiary overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${isDone ? "bg-emerald-400" : "bg-gradient-to-r from-[var(--brand-orange)] to-orange-400"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {(milestones.length > 0 || (milestoneAuthority && !stage.is_archived)) && (
                        <div className="px-4 pb-4 space-y-2">
                          {milestones.length > 0 && (
                            <div className="rounded-xl border border-[var(--border-primary)] divide-y divide-[var(--border-primary)]/60 overflow-hidden">
                              {milestones.map((ms, msIdx) => {
                                const msProgress = Math.min(100, Math.max(0, Number(ms.progress) || 0));
                                const dvList = ms.deliverables || [];
                                const isOpen = msOpenId !== null && String(msOpenId) === String(ms.id);
                                return (
                                  <div key={ms.id} className="px-3 py-2">
                                    {msEditId === ms.id ? (
                                      <form onSubmit={saveMilestoneEdit} className="space-y-2 py-1">
                                        <input
                                          value={msEditForm.title || ""}
                                          onChange={(e) => setMsEditForm({ ...msEditForm, title: e.target.value })}
                                          placeholder={t("venture.manager.milestoneTitlePlaceholder")}
                                          className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
                                          required
                                        />
                                        <textarea
                                          value={msEditForm.description || ""}
                                          onChange={(e) => setMsEditForm({ ...msEditForm, description: e.target.value })}
                                          rows={2}
                                          placeholder={t("venture.manager.milestoneDescPlaceholder")}
                                          className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                                        />
                                        <input
                                          value={msEditForm.objective || ""}
                                          onChange={(e) => setMsEditForm({ ...msEditForm, objective: e.target.value })}
                                          placeholder={t("venture.manager.stageObjectivePlaceholder")}
                                          className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                                        />
                                        <input
                                          type="date"
                                          value={msEditForm.target_date || ""}
                                          onChange={(e) => setMsEditForm({ ...msEditForm, target_date: e.target.value })}
                                          className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                                        />
                                        <div className="flex justify-end gap-2">
                                          <button type="button" onClick={() => { setMsEditId(null); setMsEditForm({}); }} className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border border-[var(--border-primary)] text-slate-500">
                                            {t("common.cancel")}
                                          </button>
                                          <button type="submit" className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg bg-[var(--brand-orange)] text-black flex items-center gap-1">
                                            <Save className="w-3 h-3" /> {t("common.save")}
                                          </button>
                                        </div>
                                      </form>
                                    ) : (
                                      <>
                                      <div className="flex items-center gap-3">
                                        <button
                                          type="button"
                                          onClick={() => toggleMilestoneOpen(ms.id)}
                                          aria-expanded={isOpen}
                                          className="flex items-center gap-3 flex-1 min-w-0 text-left"
                                        >
                                          <span className={`w-2 h-2 rounded-full shrink-0 ${milestoneDotClass(ms.status)}`} />
                                          <span className={`flex-1 min-w-0 text-[11px] font-bold text-[var(--text-primary)] truncate ${ms.status === "completed" ? "line-through text-slate-400" : ""}`}>
                                            {ms.title}
                                          </span>
                                          {dvList.length > 0 && (
                                            <span className="shrink-0 flex items-center gap-1 text-[9px] font-bold text-slate-500" title={t("venture.manager.deliverables")}>
                                              <Flag className="w-3 h-3" /> {dvList.length}
                                            </span>
                                          )}
                                          {msProgress > 0 && <span className="shrink-0 text-[10px] font-bold text-[var(--text-secondary)]">{msProgress}%</span>}
                                          {isOpen ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-slate-500" />}
                                        </button>
                                        <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0 ${milestoneStatusClass(ms.status)}`}>
                                          {milestoneStatusKey(ms.status)}
                                        </span>
                                        {milestoneAuthority && !stage.is_archived && (
                                          <AppMenu
                                            label={t("venture.manager.milestoneActions")}
                                            align="right"
                                            buttonClassName="!p-1"
                                            items={milestoneMenuItems(stage, ms, msIdx, milestones)}
                                          />
                                        )}
                                        {msBusy === ms.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 shrink-0" />}
                                      </div>

                                      {isOpen && msProgress > 0 && ms.status !== "completed" && (
                                        <div className="mt-2 ml-5 w-full max-w-xs h-1 rounded-full bg-tertiary overflow-hidden">
                                          <div className="h-full bg-sky-400/70 rounded-full" style={{ width: `${msProgress}%` }} />
                                        </div>
                                      )}
                                      {isOpen && ms.target_date && (
                                        <p className="mt-1 ml-5 text-[10px] text-slate-500">{fmtDate(ms.target_date)}</p>
                                      )}

                                      {/* Review inbox: what the Venture submitted for the tasks in this milestone */}
                                      {isOpen && (msSubs[ms.id] || []).length > 0 && (
                                        <div className="mt-2 ml-5 space-y-1.5">
                                          <p className="text-[8px] font-black uppercase tracking-widest text-amber-400">
                                            {t("venture.manager.submissionsToReview", { n: (msSubs[ms.id] || []).length })}
                                          </p>
                                          {(msSubs[ms.id] || []).map((item) => (
                                            <div key={item.submission_id} className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-2.5 py-2 space-y-1.5">
                                              <div className="flex items-center gap-2">
                                                <p className="flex-1 min-w-0 text-[11px] font-bold text-[var(--text-primary)] truncate">{item.task_title}</p>
                                                <span className="text-[9px] text-slate-500 shrink-0">
                                                  v{item.version} · {item.submitted_by_name || t("venture.manager.theVenture")} · {new Date(item.created_at).toLocaleDateString()}
                                                </span>
                                              </div>
                                              {item.notes && <p className="text-[10px] text-slate-400">{item.notes}</p>}
                                              {item.file_url && (
                                                <a href={item.file_url} target="_blank" rel="noreferrer" className="text-[9px] font-bold text-sky-300 hover:underline">
                                                  {item.file_name || t("venture.manager.viewSubmission")}
                                                </a>
                                              )}
                                              {subsReview?.submission_id === item.submission_id ? (
                                                <div className="space-y-1.5">
                                                  <textarea
                                                    value={subsComment}
                                                    onChange={(e) => setSubsComment(e.target.value)}
                                                    rows={2}
                                                    placeholder={t("venture.manager.reviewCommentsPlaceholder")}
                                                    className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                                                  />
                                                  <div className="flex justify-end gap-2">
                                                    <button type="button" onClick={() => { setSubsReview(null); setSubsComment(""); }} className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-[var(--border-primary)] text-slate-500">
                                                      {t("common.cancel")}
                                                    </button>
                                                    <button type="button" disabled={subsBusy === item.submission_id || !subsComment.trim()} onClick={() => decideSubmission(ms.id, item, "changes_requested", subsComment)} className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-400 border border-rose-500/30 disabled:opacity-50">
                                                      {t("venture.manager.requestChanges")}
                                                    </button>
                                                  </div>
                                                </div>
                                              ) : (
                                                <div className="flex items-center gap-2">
                                                  <button type="button" disabled={subsBusy === item.submission_id} onClick={() => decideSubmission(ms.id, item, "approved")} className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 disabled:opacity-50">
                                                    {t("venture.manager.approveDeliverable")}
                                                  </button>
                                                  <button type="button" disabled={subsBusy === item.submission_id} onClick={() => { setSubsReview({ submission_id: item.submission_id, task_id: item.task_id }); setSubsComment(""); }} className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 disabled:opacity-50">
                                                    {t("venture.manager.requestChanges")}
                                                  </button>
                                                  {subsBusy === item.submission_id && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      {isOpen && (dvList.length > 0 || milestoneAuthority) && (
                                        <div className="mt-2 ml-5 space-y-1.5">
                                          <p className="text-[8px] font-black uppercase tracking-widest text-slate-500">
                                            {t("venture.manager.deliverables")}
                                          </p>
                                          {dvList.map((dv) => {
                                            const st = deliverableStatus(dv);
                                            const mode = dvAction?.id === dv.id ? dvAction.mode : null;
                                            return (
                                              <div key={dv.id} className="rounded-lg border border-[var(--border-primary)]/70 px-2.5 py-2">
                                                {mode === "edit" ? (
                                                  <form onSubmit={saveDeliverableEdit} className="space-y-2">
                                                    <input
                                                      value={dvForm.title}
                                                      onChange={(e) => setDvForm({ ...dvForm, title: e.target.value })}
                                                      placeholder={t("venture.manager.deliverableTitlePlaceholder")}
                                                      className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                                                      required
                                                    />
                                                    <textarea
                                                      value={dvForm.description}
                                                      onChange={(e) => setDvForm({ ...dvForm, description: e.target.value })}
                                                      rows={2}
                                                      placeholder={t("venture.manager.deliverableDescPlaceholder")}
                                                      className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                                                    />
                                                    <div className="flex flex-wrap items-center gap-2">
                                                      <input
                                                        type="date"
                                                        value={dvForm.due_date}
                                                        onChange={(e) => setDvForm({ ...dvForm, due_date: e.target.value })}
                                                        className="flex-1 min-w-[140px] px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                                                      />
                                                      <select
                                                        value={dvForm.deliverable_type}
                                                        onChange={(e) => setDvForm({ ...dvForm, deliverable_type: e.target.value })}
                                                        className="px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                                                      >
                                                        {DELIVERABLE_TYPES.map((ty) => (
                                                          <option key={ty} value={ty}>{t(`venture.manager.deliverableTypes.${ty}`)}</option>
                                                        ))}
                                                      </select>
                                                    </div>
                                                    <div className="flex justify-end gap-2">
                                                      <button type="button" onClick={() => setDvAction(null)} className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-[var(--border-primary)] text-slate-500">
                                                        {t("common.cancel")}
                                                      </button>
                                                      <button type="submit" disabled={dvSaving} className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-[var(--brand-orange)] text-black flex items-center gap-1 disabled:opacity-50">
                                                        {dvSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} {t("common.save")}
                                                      </button>
                                                    </div>
                                                  </form>
                                                ) : mode === "submit" ? (
                                                  <div className="space-y-2">
                                                    <p className="text-[11px] font-bold text-[var(--text-primary)]">{dv.title}</p>
                                                    <p className="text-[9px] uppercase tracking-widest text-slate-500">{t("venture.manager.attachFile")}</p>
                                                    <input
                                                      type="file"
                                                      onChange={(e) => setDvFile(e.target.files?.[0] || null)}
                                                      className="w-full text-[10px] text-slate-400 file:mr-2 file:px-2.5 file:py-1 file:rounded-lg file:border-0 file:text-[9px] file:font-black file:uppercase file:tracking-widest file:bg-[var(--brand-orange)] file:text-black"
                                                    />
                                                    <p className="text-[9px] uppercase tracking-widest text-slate-500">{t("venture.manager.orPasteLink")}</p>
                                                    <input
                                                      value={dvText}
                                                      onChange={(e) => setDvText(e.target.value)}
                                                      placeholder={t("venture.manager.evidenceUrlPlaceholder")}
                                                      className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                                                    />
                                                    <div className="flex justify-end gap-2">
                                                      <button type="button" onClick={() => { setDvAction(null); setDvFile(null); }} className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-[var(--border-primary)] text-slate-500">
                                                        {t("common.cancel")}
                                                      </button>
                                                      <button type="button" onClick={submitDeliverableEvidence} disabled={dvSaving || (!dvFile && !dvText.trim())} className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-[var(--brand-orange)] text-black disabled:opacity-50">
                                                        {dvSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : null} {t("venture.manager.submitEvidence")}
                                                      </button>
                                                    </div>
                                                  </div>
                                                ) : mode === "review" ? (
                                                  <div className="space-y-2">
                                                    <p className="text-[11px] font-bold text-[var(--text-primary)]">{dv.title}</p>
                                                    <textarea
                                                      value={dvText}
                                                      onChange={(e) => setDvText(e.target.value)}
                                                      rows={2}
                                                      placeholder={t("venture.manager.reviewCommentsPlaceholder")}
                                                      className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                                                    />
                                                    <div className="flex justify-end gap-2">
                                                      <button type="button" onClick={() => setDvAction(null)} className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-[var(--border-primary)] text-slate-500">
                                                        {t("common.cancel")}
                                                      </button>
                                                      <button type="button" onClick={() => reviewDeliverable(dv, "changes_requested")} disabled={dvBusy === dv.id || !dvText.trim()} className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-400 border border-rose-500/30 disabled:opacity-50">
                                                        {t("venture.manager.requestChanges")}
                                                      </button>
                                                    </div>
                                                  </div>
                                                ) : (
                                                  <div className="flex items-center gap-2">
                                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${st.dot}`} />
                                                    <p className="flex-1 min-w-0 text-[11px] font-bold text-[var(--text-primary)] truncate">{dv.title}</p>
                                                    {dv.due_date && <span className="hidden sm:inline text-[9px] text-slate-500">{fmtDate(dv.due_date)}</span>}
                                                    {dv.attachment_url && (
                                                      <a href={dv.evidence_download_url || dv.attachment_url} target="_blank" rel="noreferrer" className="text-[9px] font-bold text-sky-300 hover:underline shrink-0">
                                                        {dv.attachment_name || t("venture.manager.viewEvidence")}
                                                      </a>
                                                    )}
                                                    <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0 ${st.cls}`}>
                                                      {t(`venture.manager.deliverableStatuses.${st.key}`)}
                                                    </span>
                                                    {milestoneAuthority && (
                                                      <AppMenu
                                                        label={t("venture.manager.deliverableActions")}
                                                        align="right"
                                                        buttonClassName="!p-1"
                                                        items={deliverableMenuItems(dv)}
                                                      />
                                                    )}
                                                    {dvBusy === dv.id && <Loader2 className="w-3 h-3 animate-spin text-slate-400 shrink-0" />}
                                                  </div>
                                                )}
                                                {!mode && dv.approval_status === "rejected" && dv.rejection_reason && (
                                                  <p className="text-[9px] text-rose-400 mt-1">
                                                    {t("venture.manager.changesRequestedReason", { reason: dv.rejection_reason })}
                                                  </p>
                                                )}
                                              </div>
                                            );
                                          })}

                                          {milestoneAuthority && (
                                            dvAddFor === ms.id ? (
                                              <form onSubmit={(e) => addDeliverable(e, ms)} className="rounded-lg border border-[var(--border-primary)] bg-tertiary p-2.5 space-y-2">
                                                <input
                                                  value={dvForm.title}
                                                  onChange={(e) => setDvForm({ ...dvForm, title: e.target.value })}
                                                  placeholder={t("venture.manager.deliverableTitlePlaceholder")}
                                                  className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                                                  required
                                                />
                                                <textarea
                                                  value={dvForm.description}
                                                  onChange={(e) => setDvForm({ ...dvForm, description: e.target.value })}
                                                  rows={2}
                                                  placeholder={t("venture.manager.deliverableDescPlaceholder")}
                                                  className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                                                />
                                                <div className="flex flex-wrap items-center gap-2">
                                                  <input
                                                    type="date"
                                                    value={dvForm.due_date}
                                                    onChange={(e) => setDvForm({ ...dvForm, due_date: e.target.value })}
                                                    className="flex-1 min-w-[140px] px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                                                  />
                                                  <select
                                                    value={dvForm.deliverable_type}
                                                    onChange={(e) => setDvForm({ ...dvForm, deliverable_type: e.target.value })}
                                                    className="px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                                                  >
                                                    {DELIVERABLE_TYPES.map((ty) => (
                                                      <option key={ty} value={ty}>{t(`venture.manager.deliverableTypes.${ty}`)}</option>
                                                    ))}
                                                  </select>
                                                </div>
                                                {/* Optional: attach the document itself now. */}
                                                <p className="text-[9px] uppercase tracking-widest text-slate-500">{t("venture.manager.attachFile")}</p>
                                                <input
                                                  type="file"
                                                  onChange={(e) => setDvNewFile(e.target.files?.[0] || null)}
                                                  className="w-full text-[10px] text-slate-400 file:mr-2 file:px-2.5 file:py-1 file:rounded-lg file:border-0 file:text-[9px] file:font-black file:uppercase file:tracking-widest file:bg-[var(--brand-orange)] file:text-black"
                                                />
                                                <input
                                                  value={dvNewUrl}
                                                  onChange={(e) => setDvNewUrl(e.target.value)}
                                                  placeholder={t("venture.manager.orPasteLink")}
                                                  className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                                                />
                                                <div className="flex justify-end gap-2">
                                                  <button type="button" onClick={() => { setDvAddFor(null); setDvForm(emptyDeliverableForm); setDvNewFile(null); setDvNewUrl(""); }} className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-[var(--border-primary)] text-slate-500">
                                                    {t("common.cancel")}
                                                  </button>
                                                  <button type="submit" disabled={dvSaving} className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-[var(--brand-orange)] text-black flex items-center gap-1 disabled:opacity-50">
                                                    {dvSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} {t("venture.manager.addDeliverable")}
                                                  </button>
                                                </div>
                                              </form>
                                            ) : (
                                              <button
                                                onClick={() => { setDvAddFor(ms.id); setDvForm(emptyDeliverableForm); setDvNewFile(null); setDvNewUrl(""); }}
                                                className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest text-slate-400 border border-[var(--border-primary)] hover:text-[var(--brand-orange)]"
                                              >
                                                <Plus className="w-3 h-3" /> {t("venture.manager.addDeliverable")}
                                              </button>
                                            )
                                          )}
                                        </div>
                                      )}

                                      {/* Book a session on this milestone (date + exact time) */}
                                      {isOpen && (milestoneAuthority || access.manage) && !stage.is_archived && (
                                        <div className="mt-2 ml-5">
                                          {bookFor === ms.id ? (
                                            <form onSubmit={(e) => bookSession(e, stage, ms)} className="rounded-lg border border-[var(--border-primary)] p-2.5 space-y-2">
                                              <p className="text-[9px] font-black uppercase tracking-widest text-[var(--brand-orange)] flex items-center gap-1.5">
                                                <CalendarPlus className="w-3.5 h-3.5" /> {t("venture.manager.bookSession")}
                                              </p>
                                              <input
                                                value={bookForm.title}
                                                onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })}
                                                placeholder={t("venture.manager.sessionTitlePlaceholder")}
                                                className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                                              />
                                              <textarea
                                                value={bookForm.note}
                                                onChange={(e) => setBookForm({ ...bookForm, note: e.target.value })}
                                                rows={2}
                                                required
                                                placeholder={t("venture.manager.sessionNotePlaceholder")}
                                                className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                                              />
                                              <div className="flex flex-wrap items-center gap-2">
                                                <input
                                                  type="date"
                                                  required
                                                  value={bookForm.date}
                                                  onChange={(e) => setBookForm({ ...bookForm, date: e.target.value })}
                                                  className="px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                                                />
                                                <input
                                                  type="time"
                                                  required
                                                  value={bookForm.time}
                                                  onChange={(e) => setBookForm({ ...bookForm, time: e.target.value })}
                                                  className="px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                                                />
                                                <select
                                                  value={bookForm.duration}
                                                  onChange={(e) => setBookForm({ ...bookForm, duration: e.target.value })}
                                                  className="px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                                                >
                                                  {["30", "45", "60", "90"].map((min) => (
                                                    <option key={min} value={min}>{t("venture.manager.minutes", { n: min })}</option>
                                                  ))}
                                                </select>
                                                <select
                                                  value={bookForm.coach_id}
                                                  onChange={(e) => setBookForm({ ...bookForm, coach_id: e.target.value })}
                                                  className="px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                                                >
                                                  <option value="">{t("venture.manager.noCoach")}</option>
                                                  {coachOptions.map((c) => (
                                                    <option key={c.id || c.coach_id} value={c.coach_id}>{c.full_name || c.email}</option>
                                                  ))}
                                                </select>
                                              </div>
                                              <p className="text-[9px] text-slate-500">{t("venture.manager.sessionNotifyHint")}</p>
                                              <div className="flex justify-end gap-2">
                                                <button type="button" onClick={() => setBookFor(null)} className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-[var(--border-primary)] text-slate-500">
                                                  {t("common.cancel")}
                                                </button>
                                                <button type="submit" disabled={bookSaving} className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-[var(--brand-orange)] text-black flex items-center gap-1.5 disabled:opacity-50">
                                                  {bookSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CalendarPlus className="w-3 h-3" />} {t("venture.manager.bookSession")}
                                                </button>
                                              </div>
                                            </form>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => openBooking(ms)}
                                              className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-[var(--brand-orange)]"
                                            >
                                              <CalendarPlus className="w-3 h-3" /> {t("venture.manager.bookSession")}
                                            </button>
                                          )}
                                        </div>
                                      )}

                                      {/* Internal notes are milestone-scoped — they never exist outside a milestone. */}
                                      {isOpen && notesMsId !== null && String(notesMsId) === String(ms.id) && (
                                        <div className="mt-2 ml-5">
                                          <ScopedNotes ventureId={ventureId} scopeType="milestone" scopeId={ms.id} />
                                        </div>
                                      )}
                                      </>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {milestoneAuthority && !stage.is_archived && (
                            msAddFor === stage.id ? (
                              <form onSubmit={(e) => addMilestone(e, stage)} className="rounded-xl border border-[var(--border-primary)] bg-tertiary p-3 space-y-2">
                                <p className="text-[9px] font-black uppercase tracking-widest text-[var(--brand-orange)] flex items-center gap-1.5">
                                  <Flag className="w-3.5 h-3.5" /> {t("venture.manager.addMilestone")}
                                </p>
                                <input
                                  value={msForm.title}
                                  onChange={(e) => setMsForm({ ...msForm, title: e.target.value })}
                                  placeholder={t("venture.manager.milestoneTitlePlaceholder")}
                                  className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
                                  required
                                />
                                <textarea
                                  value={msForm.description}
                                  onChange={(e) => setMsForm({ ...msForm, description: e.target.value })}
                                  rows={2}
                                  placeholder={t("venture.manager.milestoneDescPlaceholder")}
                                  className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                                />
                                <input
                                  value={msForm.objective}
                                  onChange={(e) => setMsForm({ ...msForm, objective: e.target.value })}
                                  placeholder={t("venture.manager.stageObjectivePlaceholder")}
                                  className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                                />
                                <input
                                  type="date"
                                  value={msForm.target_date}
                                  onChange={(e) => setMsForm({ ...msForm, target_date: e.target.value })}
                                  className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                                />

                                {/* Deliverables are defined with the milestone, so
                                    the milestone is never created empty. */}
                                <div className="space-y-2 rounded-lg border border-[var(--border-primary)] p-2.5">
                                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                                    {t("venture.manager.deliverables")}
                                  </p>
                                  {msDeliverables.map((dv, dvIdx) => (
                                    <div key={dvIdx} className="flex flex-wrap items-center gap-2">
                                      <input
                                        value={dv.title}
                                        onChange={(e) => updateMsDeliverable(dvIdx, { title: e.target.value })}
                                        placeholder={t("venture.manager.deliverableTitlePlaceholder")}
                                        className="flex-1 min-w-[150px] px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                                      />
                                      <select
                                        value={dv.deliverable_type}
                                        onChange={(e) => updateMsDeliverable(dvIdx, { deliverable_type: e.target.value })}
                                        className="px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                                      >
                                        {DELIVERABLE_TYPES.map((ty) => (
                                          <option key={ty} value={ty}>{t(`venture.manager.deliverableTypes.${ty}`)}</option>
                                        ))}
                                      </select>
                                      <input
                                        type="date"
                                        value={dv.due_date}
                                        onChange={(e) => updateMsDeliverable(dvIdx, { due_date: e.target.value })}
                                        className="px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                                      />
                                      <button type="button" onClick={() => removeMsDeliverable(dvIdx)} className="p-1 text-slate-500 hover:text-rose-400" title={t("common.delete")}>
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ))}
                                  <button type="button" onClick={addMsDeliverable} className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-[var(--brand-orange)]">
                                    <Plus className="w-3 h-3" /> {t("venture.manager.addDeliverable")}
                                  </button>
                                </div>
                                <div className="flex justify-end gap-2">
                                  <button type="button" onClick={() => { setMsAddFor(null); setMsForm(emptyMilestoneForm); }} className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-[var(--border-primary)] text-slate-500 hover:text-[var(--text-primary)]">
                                    {t("common.cancel")}
                                  </button>
                                  <button type="submit" disabled={msSaving} className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-[var(--brand-orange)] text-black flex items-center gap-1.5 disabled:opacity-50">
                                    {msSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} {t("venture.manager.addMilestone")}
                                  </button>
                                </div>
                              </form>
                            ) : (
                              <button
                                onClick={() => { setMsAddFor(stage.id); setMsForm(emptyMilestoneForm); setMsDeliverables([]); }}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-[var(--brand-orange)] border border-[var(--brand-orange)]/30 hover:bg-[var(--brand-orange)]/10"
                              >
                                <Plus className="w-3.5 h-3.5" /> {t("venture.manager.addMilestone")}
                              </button>
                            )
                          )}
                        </div>
                      )}
                    </>
                  )}

                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* In-app confirmation — replaces browser dialogs. Archive/delete ask
          twice; restore asks once. */}
      <AppModal
        isOpen={Boolean(confirmState)}
        onClose={() => { if (!confirmBusy) setConfirmState(null); }}
        title={confirmCopy(confirmState).title}
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2">
            {confirmState?.step === 2 && <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />}
            <p className="text-sm text-[var(--text-secondary)]">{confirmCopy(confirmState).body}</p>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmState(null)}
              disabled={confirmBusy}
              className="text-[9px] font-black uppercase tracking-widest px-3 py-2 rounded-lg border border-[var(--border-primary)] text-slate-500 hover:text-[var(--text-primary)] disabled:opacity-40"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={runConfirmedAction}
              disabled={confirmBusy}
              className={`text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50 ${
                confirmState?.kind === "delete" && confirmState?.step === 2
                  ? "bg-rose-500 text-white"
                  : "bg-[var(--brand-orange)] text-black"
              }`}
            >
              {confirmBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {confirmState?.kind !== "restore" && confirmState?.step === 1
                ? t("common.continue")
                : confirmCopy(confirmState).confirm}
            </button>
          </div>
        </div>
      </AppModal>
    </div>
  );
}

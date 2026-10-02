"use client";

import React, { useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  stageStatusWord,
  milestoneStatusWord,
  deliverableStatusWord,
  statusLabel,
  statusChipClass,
  statusDotClass,
} from "@/lib/ventureStatuses";
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
} from "lucide-react";
import ScopedNotes from "@/components/ventures/ScopedNotes";
import PlanImportPanel from "@/components/ventures/PlanImportPanel";
import VentureChangeLogPanel from "@/components/ventures/VentureChangeLogPanel";
import VenturePersonField from "@/components/ventures/VenturePersonField";
import AppMenu from "@/components/ui/AppMenu";
import { useDialogs } from "@/components/ui/DialogProvider";
import { minSessionStartInput, isValidSessionStart, toDateInput, toTimeInput } from "@/lib/ventureSessionRules";
import {
  nextMilestoneDate,
  milestoneDateIssue,
  deliverableDateIssue,
  earliestStoredDate,
  dateOnly,
  todayDateInput,
} from "@/lib/ventureMilestoneDates";
import { useApi } from "@/lib/hooks/useApi";
import {
  EMPTY_JOURNEY,
  pickJourney,
  pickSessions,
  DATE_ISSUE_KEYS,
  findStageMilestone,
  datePickerFloor,
  datePickerCeiling,
  pickReportsByStage,
} from "@/components/ventures/journey/journeyShapers";
import JourneyConfirmModal from "@/components/ventures/journey/JourneyConfirmModal";
import MilestoneSessionsList from "@/components/ventures/journey/MilestoneSessionsList";
import AddMilestoneForm from "@/components/ventures/journey/AddMilestoneForm";
import JourneyAddStageForm from "@/components/ventures/journey/JourneyAddStageForm";
import JourneyApplyTemplateBar from "@/components/ventures/journey/JourneyApplyTemplateBar";
import JourneyArchiveToolbar from "@/components/ventures/journey/JourneyArchiveToolbar";
import JourneyReportSection from "@/components/ventures/journey/JourneyReportSection";
import JourneySaveTemplateForm from "@/components/ventures/journey/JourneySaveTemplateForm";
import MilestoneDeliverables from "@/components/ventures/journey/MilestoneDeliverables";
import MilestoneReviewInbox from "@/components/ventures/journey/MilestoneReviewInbox";
import MilestoneSessionBooking from "@/components/ventures/journey/MilestoneSessionBooking";

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
  const { confirm } = useDialogs();

  // The journey, the sessions and the reports are three reads through the shared
  // hook, which owns the cache, the cache-first paint and the discarding of a
  // stale answer. A write publishes its OWN response body into the read it
  // belongs to (setJourney / setStages below) rather than paying for a second
  // read of what the server has just handed back, so a successful write cannot
  // be undone on screen by a re-read that then fails.
  const { data: journey, loading, refresh: refreshJourney, setData: setJourney } = useApi(
    ventureId ? `/api/ventures/${ventureId}/journey?include_archived=1` : null,
    { defaultValue: EMPTY_JOURNEY, transform: pickJourney },
  );
  const { stages, access, templateSource, milestoneAuthority, deliverablesUnavailable } = journey;

  const { data: ventureSessions, refresh: refreshSessions } = useApi(
    ventureId ? `/api/ventures/${ventureId}/sessions` : null,
    { defaultValue: [], transform: pickSessions },
  );

  const { data: reportsByStage, refresh: refreshReports } = useApi(
    ventureId ? `/api/ventures/${ventureId}/progress-reports` : null,
    { defaultValue: {}, transform: pickReportsByStage },
  );

  /** What a write returned replaces the stages, leaving the rest of the read be. */
  const setStages = (next) => setJourney((prev) => ({ ...prev, stages: next }));

  const [toast, setToast] = useState(null);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", objective: "", start_date: "" });
  const [saving, setSaving] = useState(false);

  const [applyOpen, setApplyOpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [duplicatingStageId, setDuplicatingStageId] = useState(null);
  const [notesMilestoneId, setNotesMilestoneId] = useState(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveForm, setSaveForm] = useState({ name: "", description: "" });
  const [savingSave, setSavingSave] = useState(false);
  const [journeyTemplates, setJourneyTemplates] = useState([]);
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
  const [milestoneAddFor, setMilestoneAddFor] = useState(null);
  const [milestoneForm, setMilestoneForm] = useState({ title: "", description: "", objective: "", target_date: "", owner_cid: "", owner_name: "" });
  // Deliverables drafted while creating the milestone (created right after it).
  const [milestoneDeliverables, setMilestoneDeliverables] = useState([]);
  const [milestoneSaving, setMilestoneSaving] = useState(false);
  const [milestoneEditId, setMilestoneEditId] = useState(null);
  const [milestoneEditForm, setMilestoneEditForm] = useState({});
  const [milestoneBusy, setMilestoneBusy] = useState(null);
  // Milestones are collapsed by default; clicking one opens it (accordion).
  const [milestoneOpenId, setMilestoneOpenId] = useState(null);

  // Deliverables (evidence) attached to a milestone: add/edit (Lead Manager /
  // Super Admin), submit evidence, approve / request changes.
  const [deliverableAddFor, setDeliverableAddFor] = useState(null);
  const [deliverableAction, setDeliverableAction] = useState(null); // { id, mode: edit|submit|review }
  const [deliverableForm, setDeliverableForm] = useState({ title: "", description: "", deliverable_type: "document", due_date: "", assigned_cid: "", assigned_name: "" });
  const [deliverableText, setDeliverableText] = useState("");
  const [deliverableFile, setDeliverableFile] = useState(null);
  const [deliverableSaving, setDeliverableSaving] = useState(false);
  const [deliverableBusy, setDeliverableBusy] = useState(null);
  // Evidence attached while defining a NEW deliverable (optional).
  const [deliverableNewFile, setDeliverableNewFile] = useState(null);
  const [deliverableNewUrl, setDeliverableNewUrl] = useState("");

  // Review inbox per milestone: the Venture's submitted work awaiting a
  // decision, reviewable right here (Approve / Request changes).
  const [milestoneSubmissions, setMilestoneSubmissions] = useState({});
  const [submissionsBusy, setSubmissionsBusy] = useState(null);
  const [submissionReview, setSubmissionReview] = useState(null); // { submission_id, task_id, milestoneId }
  const [submissionComment, setSubmissionComment] = useState("");
  // Book a session on a milestone (date + exact time), optionally with a coach.
  const [bookFor, setBookFor] = useState(null);
  const [bookForm, setBookForm] = useState({ date: "", time: "", min_time: "", duration: "45", coach_id: "", title: "", deliverable_id: "", note: "" });
  const [bookSaving, setBookSaving] = useState(false);
  const [coachOptions, setCoachOptions] = useState([]);
  // Sessions already booked on this venture, listed inside their milestone.
  // Journey reports are shown and written where their journey lives — never in a
  // separate module.
  const [reportFor, setReportFor] = useState(null);
  const [reportForm, setReportForm] = useState(null);
  const [reportSaving, setReportSaving] = useState(false);
  // Which report's content is open for reading (a report is written to be read).
  const [reportOpenId, setReportOpenId] = useState(null);
  // The session's ONE note, edited in place (never appended to).
  const [noteEditFor, setNoteEditFor] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});

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

  // ── Journey archive / permanent delete (double-confirmed) ────────────────
  const activeStages = stages.filter((stage) => stage.is_archived !== true);
  const archivedStages = stages.filter((stage) => stage.is_archived === true);
  const visibleStages = viewArchived ? archivedStages : activeStages;
  const allSelected =
    activeStages.length > 0 && activeStages.every((stage) => selectedStageIds.has(String(stage.id)));

  const toggleSelectStage = (id) => {
    const next = new Set(selectedStageIds);
    const key = String(id);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedStageIds(next);
  };
  const toggleSelectAllStages = () => {
    if (allSelected) setSelectedStageIds(new Set());
    else setSelectedStageIds(new Set(activeStages.map((stage) => String(stage.id))));
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
      const payload = await res.json();
      if (payload.success) {
        const done =
          endpoint === "delete"
            ? payload.deleted || []
            : action === "restore"
              ? payload.restored || []
              : payload.archived || [];
        const blocked = payload.blocked || [];
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
        if (payload.stages) setStages(payload.stages);
      } else {
        notify(payload.error || t("venture.manager.actionFailed"), "error");
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
    activeStages.filter((stage) => selectedStageIds.has(String(stage.id))).map((stage) => String(stage.id));

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
  const emptyMilestoneForm = { title: "", description: "", objective: "", target_date: "", owner_cid: "", owner_name: "" };

  const toggleMilestoneOpen = (id) => {
    const next = String(milestoneOpenId) === String(id) ? null : String(id);
    setMilestoneOpenId(next);
    if (!next) setNotesMilestoneId(null);
    if (next) loadMilestoneSubmissions(next);
  };

  /** The Venture's submissions awaiting a decision inside one milestone. */
  const loadMilestoneSubmissions = async (milestoneId) => {
    try {
      const res = await fetch(
        `/api/ventures/${ventureId}/submissions/review-queue?milestone_id=${encodeURIComponent(milestoneId)}`,
      );
      const payload = await res.json();
      setMilestoneSubmissions((prev) => ({ ...prev, [milestoneId]: payload.success ? payload.items || [] : [] }));
    } catch (_) {
      setMilestoneSubmissions((prev) => ({ ...prev, [milestoneId]: [] }));
    }
  };

  const decideSubmission = async (milestoneId, item, decision, comment = "") => {
    setSubmissionsBusy(item.submission_id);
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
      const payload = await res.json();
      if (payload.success) {
        notify(t(decision === "approved" ? "venture.manager.submissionApproved" : "venture.manager.submissionChangesRequested"));
        setSubmissionReview(null);
        setSubmissionComment("");
        await loadMilestoneSubmissions(milestoneId);
      } else {
        notify(payload.error || t("venture.manager.actionFailed"), "error");
      }
    } catch (_) {
      notify(t("venture.manager.actionFailed"), "error");
    } finally {
      setSubmissionsBusy(null);
    }
  };

  const openBooking = async (milestone) => {
    setBookFor(milestone.id);
    // Prefill the earliest bookable slot (30 minutes from now) — never an empty picker.
    // One instant drives both the floor and the prefill, so the prefilled slot is always valid.
    const min = minSessionStartInput();
    setBookForm({ date: toDateInput(min), time: toTimeInput(min), min_time: toTimeInput(min), duration: "45", coach_id: "", title: milestone.title || "", deliverable_id: "", note: "", files: [] });
    if (coachOptions.length === 0) {
      try {
        const res = await fetch(`/api/ventures/${ventureId}/coaches`);
        const payload = await res.json();
        if (payload.success) setCoachOptions(payload.coaches || []);
      } catch (_) {}
    }
  };

  const bookSession = async (event, stage, milestone) => {
    event.preventDefault();
    if (!bookForm.date || !bookForm.time) return;
    // A session always carries its internal note — the record of why it exists.
    if (!bookForm.note.trim()) {
      notify(t("venture.manager.memoRequired"), "error");
      return;
    }
    // One instant for the whole submit: the guard, the end-time maths and the payload.
    const start = new Date(`${bookForm.date}T${bookForm.time}:00`);
    if (!isValidSessionStart(start)) {
      const next = minSessionStartInput();
      setBookForm((prev) => ({ ...prev, date: toDateInput(next), time: toTimeInput(next), min_time: toTimeInput(next) }));
      notify(t("venture.manager.sessionTooSoon"), "error");
      return;
    }
    setBookSaving(true);
    try {
      // Attach the documents first: each file goes to the Venture's session
      // material route (private bucket) and only its path is stored, so the
      // booking carries the deck the participants are meant to read.
      const materials = [];
      for (const file of bookForm.files || []) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("milestone_id", String(milestone.id));
        const uploadResponse = await fetch(`/api/ventures/${ventureId}/sessions/upload`, { method: "POST", body: formData });
        const uploadPayload = await uploadResponse.json().catch(() => ({}));
        if (!uploadPayload.success) {
          notify(uploadPayload.error || t("venture.manager.actionFailed"), "error");
          return;
        }
        materials.push({ path: uploadPayload.path, name: uploadPayload.name, size: uploadPayload.size });
      }
      const minutes = Number(bookForm.duration) || 45;
      const end = new Date(start.getTime() + minutes * 60000);
      const coach = coachOptions.find((option) => String(option.coach_id) === String(bookForm.coach_id));
      const res = await fetch(`/api/ventures/${ventureId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_session",
          title: bookForm.title || milestone.title,
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
          milestone_ref: String(milestone.id),
          deliverable_id: bookForm.deliverable_id || null,
          materials,
        }),
      });
      const payload = await res.json();
      if (payload.success) {
        notify(t("venture.manager.sessionBooked"));
        setBookFor(null);
        // Surface the new session inside its milestone right away.
        refreshSessions();
      } else {
        notify(payload.error || t("venture.manager.actionFailed"), "error");
      }
    } catch (_) {
      notify(t("venture.manager.actionFailed"), "error");
    } finally {
      setBookSaving(false);
    }
  };

  const addMilestoneDeliverable = () =>
    setMilestoneDeliverables((prev) => [...prev, { title: "", deliverable_type: "document", due_date: "" }]);
  const updateMilestoneDeliverable = (index, patch) =>
    setMilestoneDeliverables((prev) => prev.map((deliverable, itemIndex) => (itemIndex === index ? { ...deliverable, ...patch } : deliverable)));
  const removeMilestoneDeliverable = (index) =>
    setMilestoneDeliverables((prev) => prev.filter((_, itemIndex) => itemIndex !== index));

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
    const ok = await patchMilestone(milestoneEditId, milestoneEditForm);
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

  const journeyMenuItems = (stage, index) => [
    stage.status === "upcoming" && {
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
    { key: "up", label: t("venture.manager.moveUp"), icon: ChevronUp, disabled: !access.manage || index === 0, onSelect: () => patch({ action: "move", stage_id: stage.id, direction: "up" }) },
    { key: "down", label: t("venture.manager.moveDown"), icon: ChevronDown, disabled: !access.manage || index === visibleStages.length - 1, onSelect: () => patch({ action: "move", stage_id: stage.id, direction: "down" }) },
    { key: "duplicate", label: t("venture.manager.duplicateStageTitle"), icon: CopyPlus, disabled: !access.manage || duplicatingStageId === stage.id, onSelect: () => duplicateStage(stage) },
    { separator: true },
    { key: "archive", label: t("venture.manager.archiveJourney"), icon: Archive, disabled: !access.manage, onSelect: () => archiveOneJourney(stage) },
    { key: "delete", label: t("venture.manager.deleteJourney"), icon: Trash2, danger: true, disabled: !access.manage, onSelect: () => deleteOneJourney(stage) },
  ].filter(Boolean);

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
        await refreshJourney();
        // Completing the LAST milestone of a journey closes it, and a closed
        // journey is owed a report. The composer opens on that journey and the
        // manager can simply dismiss it — that is what keeps the automatic close
        // intact: the report is prompted, never required.
        if (ok.journey_completed && ok.journey?.id) {
          const closed = stages.find((stage) => String(stage.id) === String(ok.journey.id));
          const name = ok.journey.name || closed?.name || "";
          openReportComposer({ id: ok.journey.id, name }, "closing");
          notify(t("venture.manager.journeyClosedWriteReport", { name }));
        }
      }
      return;
    }
    if (kind === "milestone-archive") {
      setConfirmState(null);
      setMilestoneBusy(ids[0]);
      try {
        const res = await fetch(`/api/ventures/${ventureId}/milestones/archive`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, action: "archive" }),
        });
        const payload = await res.json();
        if (payload.success) {
          const archived = payload.archived || [];
          const blocked = payload.blocked || [];
          const parts = [];
          if (archived.length) parts.push(t("venture.manager.milestoneArchived"));
          if (blocked.length) parts.push(blocked[0]?.reason || t("venture.manager.actionFailed"));
          notify(parts.join(" — ") || t("venture.manager.milestoneArchived"), blocked.length && !archived.length ? "error" : "success");
          await refreshJourney();
        } else {
          notify(payload.error || t("venture.manager.actionFailed"), "error");
        }
      } catch (_) {
        notify(t("venture.manager.actionFailed"), "error");
      } finally {
        setMilestoneBusy(null);
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

  const SESSION_STATUSES = ["scheduled", "confirmed", "in_progress", "completed", "cancelled", "rescheduled", "no_show"];
  const sessionStatusKey = (status) => `venture.manager.sessionStatuses.${SESSION_STATUSES.includes(status) ? status : "scheduled"}`;

  const reportStatusLabel = (status) =>
    t(`venture.manager.reportStatuses.${["draft", "submitted", "reviewed", "archived"].includes(status) ? status : "draft"}`);

  /** A textarea of bullet lines → the array the report stores (one per line). */
  const linesToArray = (text) =>
    String(text || "").split("\n").map((line) => line.trim()).filter(Boolean);

  const openReportComposer = (stage, kind = "progress") => {
    setReportFor(stage.id);
    setReportForm({
      kind,
      title: kind === "closing" ? t("venture.manager.closingReportTitle", { name: stage.name }) : "",
      period: "",
      summary: "",
      completed: "",
      outstanding: "",
      support: "",
      challenges: "",
      recommendation: "",
    });
  };

  /** Save the report this journey is owed, optionally submitting it to Super Admin. */
  const saveReport = async (stage, submit) => {
    const form = reportForm || {};
    if (!String(form.title || "").trim()) {
      notify(t("venture.manager.reportTitleRequired"), "error");
      return;
    }
    setReportSaving(true);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/progress-reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: String(form.title).trim(),
          journey_stage_id: stage.id,
          report_kind: form.kind || "progress",
          reporting_period: form.period || null,
          summary: form.summary || null,
          completed_items: linesToArray(form.completed),
          outstanding_items: linesToArray(form.outstanding),
          support_delivered: form.support || null,
          challenges: form.challenges || null,
          recommendation: form.recommendation || null,
        }),
      });
      const payload = await res.json();
      if (!payload.success) {
        notify(payload.error || t("venture.manager.actionFailed"), "error");
        return;
      }
      if (submit) {
        await fetch(`/api/ventures/${ventureId}/progress-reports`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: payload.id, status: "submitted" }),
        });
      }
      notify(t(submit ? "venture.manager.reportSubmitted" : "venture.manager.reportSaved"));
      setReportFor(null);
      setReportForm(null);
      refreshReports();
    } catch (_) {
      notify(t("venture.manager.actionFailed"), "error");
    } finally {
      setReportSaving(false);
    }
  };

  /** Save the session's single note. The server rewrites the SAME record the
   *  session was booked with — it never files a second note. */
  const saveSessionNote = async (sessionId) => {
    const note = noteDraft.trim();
    if (!note) return;
    setNoteSaving(true);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_session_note", session_id: sessionId, note }),
      });
      const payload = await res.json();
      if (payload.success) {
        notify(t("venture.manager.memoSaved"));
        setNoteEditFor(null);
        setNoteDraft("");
        refreshSessions();
      } else {
        notify(payload.error || t("venture.manager.actionFailed"), "error");
      }
    } catch (_) {
      notify(t("venture.manager.actionFailed"), "error");
    } finally {
      setNoteSaving(false);
    }
  };

  const stageNodeClass = (status) =>
    status === "completed"
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/40"
      : status === "active"
        ? "bg-blue-500/15 text-blue-400 border-blue-500/40"
        : "bg-slate-500/10 text-slate-400 border-[var(--border-primary)]";

  const milestoneStatusKey = (status) => statusLabel(milestoneStatusWord(status), t);

  const milestoneStatusClass = (status) => statusChipClass(milestoneStatusWord(status));

  const milestoneDotClass = (status) => statusDotClass(milestoneStatusWord(status));

  // ONE vocabulary (lib/ventureStatuses): the same words the founder and Super
  // Admin see for the same state. Stage: Upcoming → In Progress → Completed.
  const statusPill = (stage) => {
    const word = stageStatusWord(stage.status);
    return (
      <span className={`text-[9px] uppercase tracking-widest px-2 py-0.5 rounded ${statusChipClass(word)}`}>{statusLabel(word, t)}</span>
    );
  };

  const fmtDate = (iso) => (iso ? new Date(`${String(iso).slice(0, 10)}T00:00:00`).toLocaleDateString(lang) : "");

  // A textarea that grows with its content (paragraph note, never a scrollbar).
  const autoGrow = (event) => { const element = event.target; element.style.height = "auto"; element.style.height = `${element.scrollHeight}px`; };

  return (
    <div className="card">
      {/* Inline status message — never a floating top-right toast */}
      {toast && (
        <div className={`mb-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-bold ${toast.type === "error" ? "bg-rose-500/10 text-rose-400 border-rose-500/30" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"}`}>
          {toast.type === "error" ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* The deliverables could not be read — say so, rather than showing an
          empty list that reads as "this Venture has no evidence". */}
      {deliverablesUnavailable && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-bold text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{t("venture.manager.deliverablesUnavailable")}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Route className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
          {t("venture.manager.title")}
          <span className="px-1.5 py-0.5 rounded bg-brand-orange/10 text-[var(--brand-orange)]">{t("venture.manager.stagesCount", { count: activeStages.length })}</span>
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
                className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-brand-orange/40 text-[var(--brand-orange)] hover:bg-brand-orange/10 flex items-center gap-1.5"
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

      {/* Phase 1 of the programme import: read a tracker, show what the analysts
          proposes. Guarded by the same authority that may define the journey —
          importing a plan IS defining one. */}
      {access.create && <PlanImportPanel ventureId={ventureId} />}

      {/* History answers a question, so it sits with the thing it describes. */}
      <VentureChangeLogPanel ventureId={ventureId} />

      {templateSource && (
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-brand-orange/25 bg-brand-orange/[0.04] px-4 py-2.5">
          <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-[var(--brand-orange)]">
            <Copy className="w-3.5 h-3.5" /> {t("venture.manager.sourceFrom")}
          </span>
          <span className="text-xs font-bold text-[var(--text-primary)]">{templateSource.name || templateSource.id}</span>
          <span className="px-1.5 py-0.5 rounded bg-brand-orange/10 text-[9px] font-black uppercase tracking-widest text-[var(--brand-orange)]">
            {t(templateSource.type === "journey" ? "venture.manager.sourceTypeJourney" : "venture.manager.sourceTypePlan")}
          </span>
        </div>
      )}

      {/* Journey archive toolbar: Active/Archived views, select all, bulk
          archive/delete (each with a double confirmation). */}
      {access.manage && stages.length > 0 && (
        <JourneyArchiveToolbar
          activeStages={activeStages}
          allSelected={allSelected}
          archivedStages={archivedStages}
          askArchiveSelected={askArchiveSelected}
          askDeleteSelected={askDeleteSelected}
          bulkBusy={bulkBusy}
          selectedStageIds={selectedStageIds}
          setSelectedStageIds={setSelectedStageIds}
          setViewArchived={setViewArchived}
          toggleSelectAllStages={toggleSelectAllStages}
          viewArchived={viewArchived}
        />
      )}

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
          {visibleStages.map((stage, index) => {
            const isEditing = editId === stage.id;
            const milestones = stage.milestones || [];
            const done = stage.milestone_counts?.completed || 0;
            const total = stage.milestone_counts?.total || 0;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            const isDone = stage.status === "completed";
            const isActive = stage.status === "active";
            const isLocked = stage.status === "upcoming";
            // A journey that has CLOSED without its closing report: the gap is
            // shown in place and the button above writes exactly that report.
            const closingMissing =
              isDone && !(reportsByStage[String(stage.id)] || []).some((report) => report.report_kind === "closing");
            return (
              <div key={stage.id} className="relative pl-10">
                {/* Timeline connector between stage nodes */}
                {index < visibleStages.length - 1 && (
                  <span aria-hidden className={`absolute left-[15px] top-9 -bottom-5 w-px ${isDone ? "bg-emerald-500/40" : "bg-[var(--border-primary)]"}`} />
                )}
                {/* Stage node */}
                <span
                  className={`absolute left-0 top-0 w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] font-black ${stageNodeClass(stage.status)} ${isActive ? "ring-4 ring-blue-500/10" : ""}`}
                >
                  {isDone ? <CheckCircle2 className="w-4 h-4" /> : (stage.stage_order || index + 1)}
                </span>

                <div className={`card overflow-hidden ${isLocked ? "opacity-80" : ""}`}>
                  {isEditing ? (
                    <form onSubmit={saveEdit} className="p-4 space-y-3">
                      <input
                        value={editForm.name || ""}
                        onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
                        placeholder={t("venture.manager.stageNamePlaceholder")}
                        className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
                        required
                      />
                      <textarea
                        value={editForm.description || ""}
                        onChange={(event) => setEditForm({ ...editForm, description: event.target.value })}
                        rows={2}
                        placeholder={t("venture.manager.stageDescPlaceholder")}
                        className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                      />
                      <input
                        value={editForm.objective || ""}
                        onChange={(event) => setEditForm({ ...editForm, objective: event.target.value })}
                        placeholder={t("venture.manager.stageObjectivePlaceholder")}
                        className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                      />
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[var(--text-secondary)]">{t("venture.manager.stageStartDate")}</label>
                        <input
                          type="date"
                          value={editForm.start_date || ""}
                          onChange={(event) => setEditForm({ ...editForm, start_date: event.target.value })}
                          className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                        />
                        <p className="text-[10px] text-[var(--text-secondary)]">{t("venture.manager.stageStartDateHint")}</p>
                      </div>
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
                                items={journeyMenuItems(stage, index)}
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

                      {/* The report this journey is owed. A report BELONGS to a
                          journey, so it is written here — where the journey lives —
                          and never in a separate module. */}
                      {!stage.is_archived && (
                        <JourneyReportSection
                          autoGrow={autoGrow}
                          closingMissing={closingMissing}
                          openReportComposer={openReportComposer}
                          reportFor={reportFor}
                          reportForm={reportForm}
                          reportOpenId={reportOpenId}
                          reportSaving={reportSaving}
                          reportStatusLabel={reportStatusLabel}
                          reportsByStage={reportsByStage}
                          saveReport={saveReport}
                          setReportFor={setReportFor}
                          setReportForm={setReportForm}
                          setReportOpenId={setReportOpenId}
                          stage={stage}
                        />
                      )}

                      {(milestones.length > 0 || (milestoneAuthority && !stage.is_archived)) && (
                        <div className="px-4 pb-4 space-y-2">
                          {milestones.length > 0 && (
                            <div className="rounded-xl border border-[var(--border-primary)] divide-y divide-divider/60 overflow-hidden">
                              {milestones.map((milestone, milestoneIndex) => {
                                const milestoneProgress = Math.min(100, Math.max(0, Number(milestone.progress) || 0));
                                const deliverableList = milestone.deliverables || [];
                                // A milestone may not be dated after what it owes, nor
                                // after a milestone that follows it: the picker stops at
                                // whichever of the two comes first.
                                const milestoneDateCeiling = earliestStoredDate([
                                  nextMilestoneDate(stages, { milestoneId: milestone.id }),
                                  earliestStoredDate(deliverableList.map((deliverable) => deliverable.due_date)),
                                ]);
                                const isOpen = milestoneOpenId !== null && String(milestoneOpenId) === String(milestone.id);
                                return (
                                  <div key={milestone.id} className="px-3 py-2">
                                    {milestoneEditId === milestone.id ? (
                                      <form onSubmit={saveMilestoneEdit} className="space-y-2 py-1">
                                        <input
                                          value={milestoneEditForm.title || ""}
                                          onChange={(event) => setMilestoneEditForm({ ...milestoneEditForm, title: event.target.value })}
                                          placeholder={t("venture.manager.milestoneTitlePlaceholder")}
                                          className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
                                          required
                                        />
                                        <textarea
                                          value={milestoneEditForm.description || ""}
                                          onChange={(event) => setMilestoneEditForm({ ...milestoneEditForm, description: event.target.value })}
                                          rows={2}
                                          placeholder={t("venture.manager.milestoneDescPlaceholder")}
                                          className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                                        />
                                        <input
                                          value={milestoneEditForm.objective || ""}
                                          onChange={(event) => setMilestoneEditForm({ ...milestoneEditForm, objective: event.target.value })}
                                          placeholder={t("venture.manager.stageObjectivePlaceholder")}
                                          className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                                        />
                                        <div className="space-y-1">
                                          <label className="text-[10px] font-bold text-[var(--text-secondary)]">{t("venture.manager.milestoneOwner")}</label>
                                          <VenturePersonField
                                            value={{ cid: milestoneEditForm.owner_cid, name: milestoneEditForm.owner_name }}
                                            onChange={({ cid, name }) =>
                                              setMilestoneEditForm({ ...milestoneEditForm, owner_cid: cid || "", owner_name: name || "" })
                                            }
                                            listId="milestone-owner-options"
                                          />
                                        </div>
                                        <input
                                          type="date"
                                          value={milestoneEditForm.target_date || ""}
                                          min={datePickerFloor(todayDateInput(), milestone.target_date)}
                                          max={datePickerCeiling(milestoneDateCeiling, milestone.target_date) || undefined}
                                          onChange={(event) => setMilestoneEditForm({ ...milestoneEditForm, target_date: event.target.value })}
                                          className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                                        />
                                        <div className="flex justify-end gap-2">
                                          <button type="button" onClick={() => { setMilestoneEditId(null); setMilestoneEditForm({}); }} className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border border-[var(--border-primary)] text-slate-500">
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
                                          onClick={() => toggleMilestoneOpen(milestone.id)}
                                          aria-expanded={isOpen}
                                          className="flex items-center gap-3 flex-1 min-w-0 text-left"
                                        >
                                          <span className={`w-2 h-2 rounded-full shrink-0 ${milestoneDotClass(milestone.status)}`} />
                                          <span className={`flex-1 min-w-0 text-[11px] font-bold text-[var(--text-primary)] truncate ${milestone.status === "completed" ? "line-through text-slate-400" : ""}`}>
                                            {milestone.title}
                                          </span>
                                          {deliverableList.length > 0 && (
                                            <span className="shrink-0 flex items-center gap-1 text-[9px] font-bold text-slate-500" title={t("venture.manager.deliverables")}>
                                              <Flag className="w-3 h-3" /> {deliverableList.length}
                                            </span>
                                          )}
                                          {milestoneProgress > 0 && <span className="shrink-0 text-[10px] font-bold text-[var(--text-secondary)]">{milestoneProgress}%</span>}
                                          {isOpen ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-slate-500" />}
                                        </button>
                                        <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0 ${milestoneStatusClass(milestone.status)}`}>
                                          {milestoneStatusKey(milestone.status)}
                                        </span>
                                        {milestoneAuthority && !stage.is_archived && (
                                          <AppMenu
                                            label={t("venture.manager.milestoneActions")}
                                            align="right"
                                            buttonClassName="!p-1"
                                            items={milestoneMenuItems(stage, milestone, milestoneIndex, milestones)}
                                          />
                                        )}
                                        {milestoneBusy === milestone.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 shrink-0" />}
                                      </div>

                                      {isOpen && milestoneProgress > 0 && milestone.status !== "completed" && (
                                        <div className="mt-2 ml-5 w-full max-w-xs h-1 rounded-full bg-tertiary overflow-hidden">
                                          <div className="h-full bg-sky-400/70 rounded-full" style={{ width: `${milestoneProgress}%` }} />
                                        </div>
                                      )}
                                      {isOpen && milestone.target_date && (
                                        <p className="mt-1 ml-5 text-[10px] text-slate-500">{fmtDate(milestone.target_date)}</p>
                                      )}

                                      {/* Review inbox: what the Venture submitted for the tasks in this milestone */}
                                      {isOpen && (milestoneSubmissions[milestone.id] || []).length > 0 && (
                                        <MilestoneReviewInbox
                                          decideSubmission={decideSubmission}
                                          milestone={milestone}
                                          milestoneSubmissions={milestoneSubmissions}
                                          setSubmissionComment={setSubmissionComment}
                                          setSubmissionReview={setSubmissionReview}
                                          submissionComment={submissionComment}
                                          submissionReview={submissionReview}
                                          submissionsBusy={submissionsBusy}
                                        />
                                      )}

                                      {isOpen && (deliverableList.length > 0 || milestoneAuthority) && (
                                        <MilestoneDeliverables
                                          DELIVERABLE_TYPES={DELIVERABLE_TYPES}
                                          addDeliverable={addDeliverable}
                                          deliverableAction={deliverableAction}
                                          deliverableAddFor={deliverableAddFor}
                                          deliverableBusy={deliverableBusy}
                                          deliverableFile={deliverableFile}
                                          deliverableForm={deliverableForm}
                                          deliverableList={deliverableList}
                                          deliverableMenuItems={deliverableMenuItems}
                                          deliverableNewUrl={deliverableNewUrl}
                                          deliverableSaving={deliverableSaving}
                                          deliverableStatus={deliverableStatus}
                                          deliverableText={deliverableText}
                                          emptyDeliverableForm={emptyDeliverableForm}
                                          fmtDate={fmtDate}
                                          milestone={milestone}
                                          milestoneAuthority={milestoneAuthority}
                                          reviewDeliverable={reviewDeliverable}
                                          saveDeliverableEdit={saveDeliverableEdit}
                                          setDeliverableAction={setDeliverableAction}
                                          setDeliverableAddFor={setDeliverableAddFor}
                                          setDeliverableFile={setDeliverableFile}
                                          setDeliverableForm={setDeliverableForm}
                                          setDeliverableNewFile={setDeliverableNewFile}
                                          setDeliverableNewUrl={setDeliverableNewUrl}
                                          setDeliverableText={setDeliverableText}
                                          submitDeliverableEvidence={submitDeliverableEvidence}
                                        />
                                      )}

                                      {/* Book a session on this milestone (date + exact time) */}
                                      {isOpen && (milestoneAuthority || access.manage) && !stage.is_archived && (
                                        <MilestoneSessionBooking
                                          autoGrow={autoGrow}
                                          bookFor={bookFor}
                                          bookForm={bookForm}
                                          bookSaving={bookSaving}
                                          bookSession={bookSession}
                                          coachOptions={coachOptions}
                                          deliverableList={deliverableList}
                                          milestone={milestone}
                                          openBooking={openBooking}
                                          setBookFor={setBookFor}
                                          setBookForm={setBookForm}
                                          stage={stage}
                                        />
                                      )}

                                      {/* Sessions already booked on this milestone — the milestone stays the home of its sessions. */}
                                      {isOpen && (() => {
                                        const mine = ventureSessions.filter((session) => String(session.milestone_ref) === String(milestone.id) && session.status !== "cancelled");
                                        if (mine.length === 0) return null;
                                        return (
                                          <MilestoneSessionsList
                                            sessions={mine}
                                            deliverables={deliverableList}
                                            statusKey={sessionStatusKey}
                                            noteEditFor={noteEditFor}
                                            noteDraft={noteDraft}
                                            onNoteDraftChange={setNoteDraft}
                                            noteSaving={noteSaving}
                                            onEditNote={(session) => { setNoteEditFor(session.id); setNoteDraft(session.description || ""); }}
                                            onCancelNote={() => { setNoteEditFor(null); setNoteDraft(""); }}
                                            onSaveNote={saveSessionNote}
                                            autoGrow={autoGrow}
                                          />
                                        );
                                      })()}

                                      {/* Internal notes are milestone-scoped — they never exist outside a milestone. */}
                                      {isOpen && notesMilestoneId !== null && String(notesMilestoneId) === String(milestone.id) && (
                                        <div className="mt-2 ml-5">
                                          <ScopedNotes ventureId={ventureId} scopeType="milestone" scopeId={milestone.id} />
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
                            <AddMilestoneForm
                              DELIVERABLE_TYPES={DELIVERABLE_TYPES}
                              addMilestone={addMilestone}
                              addMilestoneDeliverable={addMilestoneDeliverable}
                              emptyMilestoneForm={emptyMilestoneForm}
                              milestoneAddFor={milestoneAddFor}
                              milestoneDeliverables={milestoneDeliverables}
                              milestoneForm={milestoneForm}
                              milestoneSaving={milestoneSaving}
                              removeMilestoneDeliverable={removeMilestoneDeliverable}
                              setMilestoneAddFor={setMilestoneAddFor}
                              setMilestoneDeliverables={setMilestoneDeliverables}
                              setMilestoneForm={setMilestoneForm}
                              stage={stage}
                              stages={stages}
                              updateMilestoneDeliverable={updateMilestoneDeliverable}
                            />
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
      <JourneyConfirmModal
        confirmState={confirmState}
        busy={confirmBusy}
        onCancel={() => setConfirmState(null)}
        onConfirm={runConfirmedAction}
      />
    </div>
  );
}

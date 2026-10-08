"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import PlanImportPanel from "@/components/ventures/PlanImportPanel";
import VentureChangeLogPanel from "@/components/ventures/VentureChangeLogPanel";
import { useDialogs } from "@/components/ui/DialogProvider";
import { useApi } from "@/lib/hooks/useApi";
import {
  EMPTY_JOURNEY,
  pickJourney,
  pickSessions,
  pickReportsByStage,
} from "@/components/ventures/journey/journeyShapers";
import JourneyConfirmModal from "@/components/ventures/journey/JourneyConfirmModal";
import JourneyNotices from "@/components/ventures/journey/JourneyNotices";
import JourneyPanelHeader from "@/components/ventures/journey/JourneyPanelHeader";
import JourneyTemplateSource from "@/components/ventures/journey/JourneyTemplateSource";
import JourneyArchiveToolbar from "@/components/ventures/journey/JourneyArchiveToolbar";
import JourneyManagerModals from "@/components/ventures/journey/JourneyManagerModals";
import JourneyStageList from "@/components/ventures/journey/JourneyStageList";
import { stageWrites } from "@/components/ventures/journey/actions/stageWrites";
import { journeyLabels } from "@/components/ventures/journey/actions/labels";
import { reportWrites } from "@/components/ventures/journey/actions/reports";
import { submissionWrites } from "@/components/ventures/journey/actions/submissions";
import { milestoneWrites } from "@/components/ventures/journey/actions/milestones";
import { deliverableWrites } from "@/components/ventures/journey/actions/deliverables";
import { sessionBooking } from "@/components/ventures/journey/actions/booking";
import { journeySelection } from "@/components/ventures/journey/actions/journeyBulk";

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

  // Every state value and every read stays here; the writes live in
  // ./journey/actions (one factory per concern) and the two large markup
  // blocks in ./journey. Both sides read the panel through `values` (what it
  // holds) and `ctx` (what it holds plus every handler) — each factory and
  // each block lists the names it needs in its own signature.
  const values = {
    ventureId,
    t,
    lang,
    confirm,
    loading,
    refreshJourney,
    stages,
    access,
    templateSource,
    milestoneAuthority,
    deliverablesUnavailable,
    ventureSessions,
    refreshSessions,
    reportsByStage,
    refreshReports,
    setStages,
    toast,
    setToast,
    addOpen,
    setAddOpen,
    form,
    setForm,
    saving,
    setSaving,
    applyOpen,
    setApplyOpen,
    templates,
    setTemplates,
    selectedTemplateId,
    setSelectedTemplateId,
    savingTemplate,
    setSavingTemplate,
    duplicatingStageId,
    setDuplicatingStageId,
    notesMilestoneId,
    setNotesMilestoneId,
    saveOpen,
    setSaveOpen,
    saveForm,
    setSaveForm,
    savingSave,
    setSavingSave,
    journeyTemplates,
    setJourneyTemplates,
    viewArchived,
    setViewArchived,
    selectedStageIds,
    setSelectedStageIds,
    bulkBusy,
    setBulkBusy,
    confirmState,
    setConfirmState,
    milestoneAddFor,
    setMilestoneAddFor,
    milestoneForm,
    setMilestoneForm,
    milestoneDeliverables,
    setMilestoneDeliverables,
    milestoneSaving,
    setMilestoneSaving,
    milestoneEditId,
    setMilestoneEditId,
    milestoneEditForm,
    setMilestoneEditForm,
    milestoneBusy,
    setMilestoneBusy,
    milestoneOpenId,
    setMilestoneOpenId,
    deliverableAddFor,
    setDeliverableAddFor,
    deliverableAction,
    setDeliverableAction,
    deliverableForm,
    setDeliverableForm,
    deliverableText,
    setDeliverableText,
    deliverableFile,
    setDeliverableFile,
    deliverableSaving,
    setDeliverableSaving,
    deliverableBusy,
    setDeliverableBusy,
    deliverableNewFile,
    setDeliverableNewFile,
    deliverableNewUrl,
    setDeliverableNewUrl,
    milestoneSubmissions,
    setMilestoneSubmissions,
    submissionsBusy,
    setSubmissionsBusy,
    submissionReview,
    setSubmissionReview,
    submissionComment,
    setSubmissionComment,
    bookFor,
    setBookFor,
    bookForm,
    setBookForm,
    bookSaving,
    setBookSaving,
    coachOptions,
    setCoachOptions,
    reportFor,
    setReportFor,
    reportForm,
    setReportForm,
    reportSaving,
    setReportSaving,
    reportOpenId,
    setReportOpenId,
    noteEditFor,
    setNoteEditFor,
    noteDraft,
    setNoteDraft,
    noteSaving,
    setNoteSaving,
    editId,
    setEditId,
    editForm,
    setEditForm,
  };

  const stageWritesResult = stageWrites(values);
  const journeyLabelsResult = journeyLabels(values);
  const reportWritesResult = reportWrites({ ...values, ...stageWritesResult });
  const submissionWritesResult = submissionWrites({ ...values, ...stageWritesResult });
  const milestoneWritesResult = milestoneWrites({
    ...values,
    ...stageWritesResult,
    ...journeyLabelsResult,
    ...submissionWritesResult,
  });
  const deliverableWritesResult = deliverableWrites({ ...values, ...stageWritesResult, ...journeyLabelsResult });
  const sessionBookingResult = sessionBooking({ ...values, ...stageWritesResult });
  const journeySelectionResult = journeySelection({
    ...values,
    ...stageWritesResult,
    ...reportWritesResult,
    ...milestoneWritesResult,
  });

  const ctx = {
    ...stageWritesResult,
    ...journeyLabelsResult,
    ...reportWritesResult,
    ...submissionWritesResult,
    ...milestoneWritesResult,
    ...deliverableWritesResult,
    ...sessionBookingResult,
    ...journeySelectionResult,
    ...values,
  };

  // The handlers this panel renders with itself (its own header, its own
  // toolbar, its own confirmation dialog).
  const {
    activeStages,
    allSelected,
    archivedStages,
    askArchiveSelected,
    askDeleteSelected,
    confirmBusy,
    runConfirmedAction,
    toggleApply,
    toggleSelectAllStages,
  } = ctx;

  return (
    <div className="card">
      <JourneyNotices toast={toast} deliverablesUnavailable={deliverablesUnavailable} />

      <JourneyPanelHeader
        access={access}
        activeStages={activeStages}
        addOpen={addOpen}
        applyOpen={applyOpen}
        saveOpen={saveOpen}
        stages={stages}
        setAddOpen={setAddOpen}
        setSaveOpen={setSaveOpen}
        toggleApply={toggleApply}
      />

      {/* Phase 1 of the programme import: read a tracker, show what the analysts
          proposes. Guarded by the same authority that may define the journey —
          importing a plan IS defining one. */}
      {access.create && <PlanImportPanel ventureId={ventureId} />}

      {/* History answers a question, so it sits with the thing it describes. */}
      <VentureChangeLogPanel ventureId={ventureId} />

      <JourneyTemplateSource templateSource={templateSource} />

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

      <JourneyManagerModals ctx={ctx} />

      <JourneyStageList ctx={ctx} />

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

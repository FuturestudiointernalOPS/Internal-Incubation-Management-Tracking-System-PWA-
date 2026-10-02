"use client";

import {
  Plus,
  Loader2,
  Users,
  Trash2,
  FileText,
  Upload,
  Target,
  Copy,
  ExternalLink,
  Search,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

const FACILITATOR_CAPS = [
  { key: "participants.view", labelKey: "capParticipantsView" },
  { key: "participants.manage", labelKey: "capParticipantsManage" },
  { key: "attendance.view", labelKey: "capAttendanceView" },
  { key: "attendance.record", labelKey: "capAttendanceRecord" },
  { key: "assignments.view", labelKey: "capAssignmentsView" },
  { key: "assignments.review", labelKey: "capAssignmentsReview" },
  { key: "assignments.grade", labelKey: "capAssignmentsGrade" },
  { key: "sessions.conduct", labelKey: "capSessionsConduct" },
  { key: "sessions.record", labelKey: "capSessionsRecord" },
  { key: "progress.view", labelKey: "capProgressView" },
  { key: "groups.view", labelKey: "capGroupsView" },
  { key: "groups.manage", labelKey: "capGroupsManage" },
];

/**
 * EditProgramModal
 *
 * Full-screen modal for editing a programme's operational registry.
 *
 * Props:
 * - editingProgram          {object|null}  The program being edited (null = closed)
 * - setEditingProgram       {fn}           Setter for editingProgram state
 * - programDateError        {string}       Date validation error message
 * - setProgramDateError     {fn}           Setter
 * - validateEditDates       {fn}           (start, end, weeks) => string
 * - isUpdating              {boolean}      Save in progress
 * - isUploading             {boolean}      File upload in progress
 * - isCreatingGroup         {boolean}
 * - setIsCreatingGroup      {fn}
 * - newGroup                {object}
 * - setNewGroup             {fn}
 * - showCreateNote          {boolean}
 * - setShowCreateNote       {fn}
 * - newNoteTitle            {string}
 * - setNewNoteTitle         {fn}
 * - creatingNote            {boolean}
 * - editKpiInput            {object}
 * - setEditKpiInput         {fn}
 * - isKpiSubmitting         {boolean}
 * - facilitatorPool         {Array}
 * - facilitatorSearch       {string}
 * - setFacilitatorSearch    {fn}
 * - facBusy                 {boolean}
 * - inviteForm              {object}
 * - setInviteForm           {fn}
 * - teams                   {Array}
 * - notes                   {Array}
 * - setNotes                {fn}
 * - knowledgeItems          {Array}
 * - editingKpis             {Array}
 * - programRegLink          {object|null}
 * - groupRegLinks           {object}       { [groupId]: url }
 * - userRole                {string}
 * - onSubmit                {fn}           handleUpdate (form submit handler)
 * - onAddKpi                {fn}
 * - onDeleteKpi             {fn}
 * - onAddFacilitator        {fn}
 * - onRemoveFacilitator     {fn}
 * - onToggleFacOverride     {fn}
 * - onToggleFacDefault      {fn}
 * - onCreateFacilitator     {fn}
 * - onSetLeadFacilitator    {fn}
 * - onFileUpload            {fn}
 * - onCreateConceptNote     {fn}
 * - onCreateGroupInline     {fn}
 * - onSaveAsTemplate        {fn}
 */
export default function EditProgramModal({
  editingProgram,
  setEditingProgram,
  programDateError,
  setProgramDateError,
  validateEditDates,
  isUpdating,
  isUploading,
  isCreatingGroup,
  setIsCreatingGroup,
  newGroup,
  setNewGroup,
  showCreateNote,
  setShowCreateNote,
  newNoteTitle,
  setNewNoteTitle,
  creatingNote,
  editKpiInput,
  setEditKpiInput,
  isKpiSubmitting,
  facilitatorPool,
  facilitatorSearch,
  setFacilitatorSearch,
  facBusy,
  inviteForm,
  setInviteForm,
  teams,
  notes,
  setNotes,
  knowledgeItems,
  editingKpis,
  programRegLink,
  groupRegLinks,
  userRole,
  onSubmit,
  onAddKpi,
  onDeleteKpi,
  onAddFacilitator,
  onRemoveFacilitator,
  onToggleFacOverride,
  onToggleFacDefault,
  onCreateFacilitator,
  onSetLeadFacilitator,
  onFileUpload,
  onCreateConceptNote,
  onCreateGroupInline,
  onSaveAsTemplate,
}) {
  const { t } = useI18n();

  if (!editingProgram) return null;

  const formUrl =
    programRegLink?.url ||
    groupRegLinks[editingProgram?.assigned_segments?.[0]] ||
    null;
  const formName = programRegLink?.name || null;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md overflow-y-auto">
      <div className="card w-full max-w-xl space-y-8 border-brand-orange/30 animate-in text-left my-auto max-h-[85vh] overflow-y-auto custom-scrollbar">
        {/* ── Modal header ──────────────────────────────────────────────── */}
        <div className="flex justify-between items-center sticky top-0 bg-secondary pb-4 z-10 border-b border-[var(--border-primary)]">
          <div>
            <h3 className="text-lg font-black text-[var(--text-primary)] tracking-tight">
              {t("adminMisc.programs.editProgramRegistry")}
            </h3>
            <p className="text-[10px] font-bold text-[var(--brand-orange)] uppercase tracking-widest mt-1">
              {t("adminMisc.programs.operationalId")}: {editingProgram?.id}
            </p>
          </div>
          <button
            onClick={() => {
              setEditingProgram(null);
              setIsCreatingGroup(false);
            }}
            className="p-2 hover:bg-tertiary rounded-lg text-[var(--text-secondary)] transition-all"
          >
            <Plus className="w-5 h-5 rotate-45" />
          </button>
        </div>

        {/* ── Form ──────────────────────────────────────────────────────── */}
        <form onSubmit={onSubmit} className="space-y-6 pt-4">
          {/* Program Name */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
              {t("adminMisc.programs.programName")}
            </label>
            <input
              type="text"
              value={editingProgram?.name || ""}
              onChange={(e) =>
                setEditingProgram({ ...editingProgram, name: e.target.value })
              }
              className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] focus:ring-1 focus:ring-[var(--brand-orange)] transition-all"
            />
          </div>

          {/* Start / End Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
                {t?.("admin.startDate") || "Start Date"}
              </label>
              <input
                type="date"
                value={editingProgram?.start_date || ""}
                onChange={(e) => {
                  const start = e.target.value;
                  setEditingProgram({ ...editingProgram, start_date: start });
                  setProgramDateError(
                    validateEditDates(
                      start,
                      editingProgram?.end_date,
                      editingProgram?.duration_weeks,
                    ),
                  );
                }}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
                {t?.("admin.endDate") || "End Date"}
              </label>
              <input
                type="date"
                value={editingProgram?.end_date || ""}
                onChange={(e) => {
                  const end = e.target.value;
                  setEditingProgram({ ...editingProgram, end_date: end });
                  setProgramDateError(
                    validateEditDates(
                      editingProgram?.start_date,
                      end,
                      editingProgram?.duration_weeks,
                    ),
                  );
                }}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
              />
            </div>
          </div>

          {programDateError && (
            <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mt-1 ml-2">
              {programDateError}
            </p>
          )}

          {/* Visibility / Language */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
                {t?.("admin.visibility") || "Visibility"}
              </label>
              <select
                value={editingProgram?.visibility || "private"}
                onChange={(e) =>
                  setEditingProgram({
                    ...editingProgram,
                    visibility: e.target.value,
                  })
                }
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-[13px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all cursor-pointer"
              >
                <option value="private">
                  {t?.("admin.visibilityOptions.private") || "Private"}
                </option>
                <option value="public">
                  {t?.("admin.visibilityOptions.public") || "Public"}
                </option>
                <option value="invite_only">
                  {t?.("admin.visibilityOptions.inviteOnly") || "Invite Only"}
                </option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
                {t?.("admin.language") || "Language"}
              </label>
              <select
                value={editingProgram?.language || "en"}
                onChange={(e) =>
                  setEditingProgram({
                    ...editingProgram,
                    language: e.target.value,
                  })
                }
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-[13px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all cursor-pointer"
              >
                <option value="en">English</option>
                <option value="fr">French</option>
              </select>
            </div>
          </div>

          {/* Vision / Objectives */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
                {t?.("admin.vision") || "Vision"}
              </label>
              <textarea
                rows={2}
                value={editingProgram?.vision || ""}
                onChange={(e) =>
                  setEditingProgram({ ...editingProgram, vision: e.target.value })
                }
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] resize-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
                {t?.("admin.objectives") || "Objectives"}
              </label>
              <textarea
                rows={2}
                value={editingProgram?.objectives || ""}
                onChange={(e) =>
                  setEditingProgram({
                    ...editingProgram,
                    objectives: e.target.value,
                  })
                }
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] resize-none transition-all"
              />
            </div>
          </div>

          {/* Expected Outcomes / Success Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
                {t("adminMisc.programs.expectedOutcomes")}
              </label>
              <textarea
                rows={2}
                value={editingProgram?.expected_outcomes || ""}
                onChange={(e) =>
                  setEditingProgram({
                    ...editingProgram,
                    expected_outcomes: e.target.value,
                  })
                }
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] resize-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
                {t("adminMisc.programs.successMetrics")}
              </label>
              <textarea
                rows={2}
                value={editingProgram?.success_metrics || ""}
                onChange={(e) =>
                  setEditingProgram({
                    ...editingProgram,
                    success_metrics: e.target.value,
                  })
                }
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] resize-none transition-all"
              />
            </div>
          </div>

          {/* Registration Link */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
              {t("adminMisc.programs.registrationLink")}
            </label>
            {formUrl ? (
              <div className="space-y-1.5">
                {formName && (
                  <p className="text-[10px] font-bold uppercase text-[var(--text-primary)] ml-2 truncate">
                    {formName}
                  </p>
                )}
                <div className="flex items-center gap-2 bg-primary/50 rounded-xl px-1 py-1 border border-[var(--border-primary)]">
                  <code
                    className="flex-1 text-[10px] font-mono bg-black/30 px-4 py-3 rounded-xl border border-[var(--border-primary)] truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {formUrl}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(formUrl);
                      window.dispatchEvent(
                        new CustomEvent("impactos:notify", {
                          detail: {
                            type: "success",
                            message: t(
                              "adminMisc.programs.registrationLinkCopied",
                            ),
                          },
                        }),
                      );
                    }}
                    className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-all border border-emerald-500/20"
                    title={t("adminMisc.programs.copyRegistrationLink")}
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <a
                    href={formUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-3 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all border border-blue-500/20"
                    title={t("adminMisc.programs.openForm")}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ) : (
              <div className="space-y-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                <p className="text-[10px] font-bold uppercase text-amber-400">
                  {t("adminMisc.programs.noFormYet")}
                </p>
                <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                  {t("adminMisc.programs.noFormYetHint")}
                </p>
                <a
                  href="/platform/forms"
                  className="inline-block text-[10px] font-bold uppercase tracking-wide text-blue-400 hover:underline"
                >
                  {t("adminMisc.programs.goToCrmForms")}
                </a>
              </div>
            )}
          </div>

          {/* Program Manager */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
              {t?.("admin.selectManager") || "PROGRAM MANAGER"}
            </label>
            <select
              value={editingProgram?.assigned_pm_id || ""}
              onChange={(e) =>
                setEditingProgram({
                  ...editingProgram,
                  assigned_pm_id: e.target.value,
                })
              }
              className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-[13px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all cursor-pointer"
            >
              <option value="">{t?.("admin.unassigned") || "Unassigned"}</option>
              {(Array.isArray(teams) ? teams : []).map(
                (member) =>
                  member && (
                    <option
                      key={member.cid || member.id}
                      value={member.cid || member.id}
                    >
                      {member.name?.toUpperCase()}
                    </option>
                  ),
              )}
            </select>
          </div>

          {/* Staff / Personnel */}
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
              {t?.("admin.programPersonnel") || "PROGRAM PERSONNEL (STAFF)"}
            </label>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-2">
              {t("adminMisc.programs.staffAssistHint", {
                manager: t("admin.selectManager"),
              })}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-3 bg-primary rounded-2xl border border-[var(--border-primary)]">
              {(Array.isArray(teams) ? teams : [])
                .filter(
                  (m) =>
                    m &&
                    (m.cid || m.id) !== editingProgram?.assigned_pm_id,
                )
                .map((member) => {
                  if (!member) return null;
                  const memberId = member.cid || member.id;
                  let assistantIds = [];
                  if (typeof editingProgram?.assigned_assistant_id === "string") {
                    try {
                      const parsed = JSON.parse(
                        editingProgram.assigned_assistant_id,
                      );
                      assistantIds = Array.isArray(parsed)
                        ? parsed
                        : editingProgram.assigned_assistant_id
                            .split(",")
                            .filter(Boolean);
                    } catch {
                      assistantIds = editingProgram.assigned_assistant_id
                        .split(",")
                        .filter(Boolean);
                    }
                  } else if (
                    Array.isArray(editingProgram?.assigned_assistant_id)
                  ) {
                    assistantIds = editingProgram.assigned_assistant_id;
                  }
                  const isActive = assistantIds.includes(memberId);
                  return (
                    <button
                      key={memberId}
                      type="button"
                      onClick={() => {
                        const next = isActive
                          ? assistantIds.filter((id) => id !== memberId)
                          : [...assistantIds, memberId];
                        setEditingProgram({
                          ...editingProgram,
                          assigned_assistant_id: next.join(","),
                        });
                      }}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                        isActive
                          ? "bg-brand-orange/10 border-[var(--brand-orange)] text-[var(--brand-orange)]"
                          : "bg-secondary border-[var(--border-primary)] text-[var(--text-secondary)]"
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[10px] font-bold ${isActive ? "text-[var(--brand-orange)] border-brand-orange/30" : ""}`}
                      >
                        {member.name?.charAt(0) || "?"}
                      </div>
                      <span className="text-[10px] font-bold uppercase truncate">
                        {member.name ||
                          member.email ||
                          member.cid ||
                          t("adminMisc.programs.unknown")}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Knowledge Base Note */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
              {t("adminMisc.programs.knowledgeBaseNote")}
            </label>
            <div className="flex gap-2">
              <select
                value={editingProgram?.note_id || ""}
                onChange={(e) =>
                  setEditingProgram({
                    ...editingProgram,
                    note_id: e.target.value,
                  })
                }
                className="flex-1 bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-[13px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all cursor-pointer"
              >
                <option value="">
                  {t("adminMisc.programs.noneAssigned")}
                </option>
                {(Array.isArray(knowledgeItems) ? knowledgeItems : []).map(
                  (item) =>
                    item && (
                      <option key={item.id} value={item.id}>
                        {item.title?.toUpperCase() ||
                          t("adminMisc.programs.untitledNode")}
                      </option>
                    ),
                )}
              </select>
              <button
                type="button"
                onClick={() => setShowCreateNote(!showCreateNote)}
                className="px-3 py-2 rounded-xl border border-dashed border-[var(--brand-orange)] text-[10px] font-bold text-[var(--brand-orange)] uppercase tracking-wider hover:bg-brand-orange/10 transition-all whitespace-nowrap"
              >
                {t("adminMisc.programs.newNote")}
              </button>
            </div>
            {showCreateNote && (
              <div className="mt-3 p-4 bg-primary border border-[var(--border-primary)] rounded-xl space-y-3 animate-in">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--brand-orange)]">
                  {t("adminMisc.programs.createNewConceptNote")}
                </p>
                <input
                  type="text"
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  placeholder={t(
                    "adminMisc.programs.conceptNoteTitlePlaceholder",
                  )}
                  className="w-full bg-secondary border border-[var(--border-primary)] rounded-lg p-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onCreateConceptNote}
                    disabled={creatingNote || !newNoteTitle.trim()}
                    className="flex-1 py-2 rounded-lg bg-[var(--brand-orange)] text-black text-sm font-bold uppercase tracking-wide disabled:opacity-50 transition-all"
                  >
                    {creatingNote
                      ? t("adminMisc.programs.creating")
                      : t("adminMisc.programs.createAndLink")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateNote(false);
                      setNewNoteTitle("");
                    }}
                    className="py-2 px-4 rounded-lg border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider hover:bg-tertiary transition-all"
                  >
                    {t("adminMisc.programs.cancel")}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Duration Weeks */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
              {t("adminMisc.programs.durationWeeks")}
            </label>
            <input
              type="number"
              value={editingProgram?.duration_weeks || 4}
              onChange={(e) => {
                const weeks = parseInt(e.target.value) || 4;
                setEditingProgram({
                  ...editingProgram,
                  duration_weeks: weeks,
                });
                setProgramDateError(
                  validateEditDates(
                    editingProgram?.start_date,
                    editingProgram?.end_date,
                    weeks,
                  ),
                );
              }}
              className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
              {t("admin.programStatus")}
            </label>
            <select
              value={editingProgram?.status || "active"}
              onChange={(e) =>
                setEditingProgram({
                  ...editingProgram,
                  status: e.target.value,
                })
              }
              className={`w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-[13px] font-bold outline-none focus:border-[var(--brand-orange)] transition-all cursor-pointer ${
                editingProgram?.status === "active"
                  ? "text-emerald-500"
                  : editingProgram?.status === "planned"
                    ? "text-sky-500"
                    : editingProgram?.status === "pending"
                      ? "text-amber-500"
                      : editingProgram?.status === "completed"
                        ? "text-purple-500"
                        : editingProgram?.status === "archived"
                          ? "text-rose-500"
                          : "text-[var(--text-primary)]"
              }`}
            >
              <option value="planned" className="text-sky-500">
                {t("adminMisc.programs.statusPlanned")}
              </option>
              <option value="active" className="text-emerald-500">
                {t("adminMisc.programs.statusInProgress")}
              </option>
              <option value="pending" className="text-amber-500">
                {t("adminMisc.programs.statusPending")}
              </option>
              <option value="completed" className="text-purple-500">
                {t("adminMisc.programs.statusCompleted")}
              </option>
              <option value="archived" className="text-rose-500">
                {t("adminMisc.programs.statusArchived")}
              </option>
            </select>
          </div>

          {/* Curriculum Materials */}
          <div className="space-y-4">
            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
              {t?.("admin.curriculumMaterials") || "Curriculum Materials (PDF)"}
            </label>
            <div className="grid grid-cols-1 gap-2">
              {(() => {
                let materials = [];
                try {
                  const raw = Array.isArray(editingProgram.materials)
                    ? editingProgram.materials
                    : typeof editingProgram.materials === "string"
                      ? JSON.parse(editingProgram.materials || "[]")
                      : [];
                  materials = Array.isArray(raw) ? raw : [];
                } catch (err) {
                  console.error("Materials parse failure:", err);
                }
                if (materials.length === 0)
                  return (
                    <p className="text-[10px] font-medium opacity-40 ml-2">
                      {t?.("admin.noProgramPdfs") ||
                        "No program-specific PDFs uploaded."}
                    </p>
                  );
                return materials.map(
                  (file, idx) =>
                    file && (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-tertiary border border-[var(--border-primary)] rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="w-4 h-4 text-blue-500" />
                          <span className="text-[10px] font-bold text-[var(--text-primary)] uppercase truncate max-w-[200px]">
                            {file.name || t("adminMisc.programs.untitledPdf")}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const remaining = materials.filter(
                              (_, i) => i !== idx,
                            );
                            setEditingProgram({
                              ...editingProgram,
                              materials: remaining,
                            });
                          }}
                          className="text-rose-500 hover:bg-rose-500/10 p-1 rounded transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ),
                );
              })()}
            </div>
            <div className="flex items-center gap-3 mt-2">
              <button
                type="button"
                disabled={isUploading}
                onClick={() =>
                  document.getElementById("curriculum-upload")?.click()
                }
                className="btn btn-secondary px-6 py-3 flex items-center gap-2 border-dashed"
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                <span className="text-[10px] uppercase font-bold">
                  {isUploading
                    ? t?.("common.saving") || "Syncing..."
                    : t?.("admin.uploadPdf") || "Upload Additional PDF"}
                </span>
              </button>
              <input
                id="curriculum-upload"
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={onFileUpload}
              />
            </div>
          </div>

          {/* Target Groups + Facilitators section */}
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
              {t?.("admin.targetGroups") || "TARGET STUDENT GROUPS"}
            </label>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-2">
              {t?.("admin.assignProgramToGroups") ||
                "Assign this program to specific student cohorts or families."}
            </p>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-3 bg-primary rounded-2xl border border-[var(--border-primary)]">
              {(Array.isArray(notes) ? notes : []).map((family) => {
                if (!family) return null;
                const assignedSegments = Array.isArray(
                  editingProgram?.assigned_segments,
                )
                  ? editingProgram.assigned_segments
                  : [];
                const isActive = assignedSegments.some(
                  (sid) => String(sid) === String(family.id),
                );
                const canEditRole = userRole === "super_admin";
                return (
                  <div
                    key={family.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      isActive
                        ? "bg-brand-orange/10 border-[var(--brand-orange)] text-[var(--brand-orange)]"
                        : "bg-secondary border-[var(--border-primary)] text-[var(--text-secondary)]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        const next = isActive
                          ? assignedSegments.filter(
                              (sid) => String(sid) !== String(family.id),
                            )
                          : [...assignedSegments, family.id];
                        setEditingProgram({
                          ...editingProgram,
                          assigned_segments: next,
                        });
                      }}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    >
                      <Users
                        className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isActive ? "text-[var(--brand-orange)]" : "text-[var(--text-secondary)]"}`}
                      />
                      <div className="flex flex-col overflow-hidden">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase truncate">
                            {family.name || t("adminMisc.programs.unnamed")}
                          </span>
                          {isActive && family.default_role && !canEditRole && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 uppercase shrink-0">
                              {family.default_role}
                            </span>
                          )}
                        </div>
                        {isActive && (
                          <span
                            className="text-[10px] font-medium text-emerald-400/80 hover:text-emerald-400 truncate mt-0.5"
                            title={t(
                              "adminMisc.programs.clickToCopyRegistrationLink",
                            )}
                            onClick={async (e) => {
                              e.stopPropagation();
                              const regId =
                                family.registration_id || family.id;
                              try {
                                const res = await fetch(
                                  `/api/platform/form-runs?group_id=${encodeURIComponent(regId)}`,
                                );
                                const payload = await res.json();
                                const run = (
                                  payload.success ? payload.runs || [] : []
                                ).find(
                                  (r) =>
                                    r.status === "active" && r.public_slug,
                                );
                                if (run) {
                                  navigator.clipboard.writeText(
                                    `${window.location.origin}/s/${run.public_slug}`,
                                  );
                                  window.dispatchEvent(
                                    new CustomEvent("impactos:notify", {
                                      detail: {
                                        type: "success",
                                        message: t("admin.copied"),
                                      },
                                    }),
                                  );
                                } else {
                                  window.dispatchEvent(
                                    new CustomEvent("impactos:notify", {
                                      detail: {
                                        type: "error",
                                        message: t(
                                          "adminMisc.programs.noFormYet",
                                        ),
                                      },
                                    }),
                                  );
                                }
                              } catch (_) {
                                window.dispatchEvent(
                                  new CustomEvent("impactos:notify", {
                                    detail: {
                                      type: "error",
                                      message: t(
                                        "adminMisc.programs.noFormYet",
                                      ),
                                    },
                                  }),
                                );
                              }
                            }}
                          >
                            {t("admin.copyLink")}
                          </span>
                        )}
                      </div>
                    </button>
                    {isActive && family.default_role && canEditRole && (
                      <select
                        value={family.default_role}
                        onChange={async (e) => {
                          const newRole = e.target.value || null;
                          try {
                            const res = await fetch("/api/families", {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                id: family.id,
                                default_role: newRole,
                              }),
                            });
                            const payload = await res.json();
                            if (payload.success) {
                              setNotes(
                                (Array.isArray(notes) ? notes : []).map((n) =>
                                  String(n.id) === String(family.id)
                                    ? { ...n, default_role: newRole }
                                    : n,
                                ),
                              );
                              window.dispatchEvent(
                                new CustomEvent("impactos:notify", {
                                  detail: {
                                    type: "success",
                                    message: t(
                                      "adminMisc.programs.roleUpdated",
                                    ),
                                  },
                                }),
                              );
                            } else {
                              window.dispatchEvent(
                                new CustomEvent("impactos:notify", {
                                  detail: {
                                    type: "error",
                                    message: t(
                                      "adminMisc.programs.roleUpdateFailed",
                                    ),
                                  },
                                }),
                              );
                            }
                          } catch (_) {
                            window.dispatchEvent(
                              new CustomEvent("impactos:notify", {
                                detail: {
                                  type: "error",
                                  message: t(
                                    "adminMisc.programs.roleUpdateFailed",
                                  ),
                                },
                              }),
                            );
                          }
                        }}
                        className="text-[10px] font-bold px-1 py-0.5 rounded bg-purple-500/20 text-purple-400 uppercase outline-none border-none cursor-pointer hover:bg-purple-500/30 shrink-0"
                      >
                        <option value={family.default_role}>
                          {family.default_role}
                        </option>
                        <option value="">{t("adminMisc.programs.roleNone")}</option>
                        <option value="participant">
                          {t("adminMisc.programs.roleParticipant")}
                        </option>
                        <option value="staff">
                          {t("adminMisc.programs.roleStaff")}
                        </option>
                        <option value="program_manager">
                          {t("adminMisc.programs.roleProgramManager")}
                        </option>
                        <option value="mentor">
                          {t("adminMisc.programs.roleMentor")}
                        </option>
                        <option value="investor">
                          {t("adminMisc.programs.roleInvestor")}
                        </option>
                        <option value="founder">
                          {t("adminMisc.programs.roleFounder")}
                        </option>
                      </select>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Create group toggle */}
            <div className="flex items-center justify-between mt-3">
              <button
                type="button"
                onClick={() => {
                  setIsCreatingGroup(!isCreatingGroup);
                  if (!isCreatingGroup && editingProgram?.name) {
                    setNewGroup({
                      name: editingProgram.name,
                      description: "",
                      type: "cohort",
                      default_role: "",
                    });
                  }
                }}
                className="text-[10px] font-bold uppercase tracking-wide text-blue-400 hover:underline"
              >
                {isCreatingGroup
                  ? t?.("common.cancel") || "Cancel"
                  : t?.("admin.createNewGroup") || "+ Create New Group"}
              </button>
            </div>

            {/* ═══ PROGRAM FACILITATORS ═══ */}
            <div className="space-y-3 mt-4 pt-4 border-t border-divider/40">
              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
                {t("adminMisc.programs.programFacilitatorsTitle")}
              </label>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-2">
                {t("adminMisc.programs.programFacilitatorsHint")}
              </p>

              {/* Scope toggle */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setEditingProgram({
                      ...editingProgram,
                      facilitator_scope: "assigned_groups",
                    })
                  }
                  className={`p-3 rounded-xl border text-left transition-all ${
                    editingProgram?.facilitator_scope !== "all"
                      ? "bg-brand-orange/10 border-[var(--brand-orange)]"
                      : "bg-secondary border-[var(--border-primary)]"
                  }`}
                >
                  <p
                    className={`text-[10px] font-bold uppercase ${editingProgram?.facilitator_scope !== "all" ? "text-[var(--brand-orange)]" : "text-[var(--text-secondary)]"}`}
                  >
                    {t("adminMisc.programs.scopeAssignedGroups")}
                  </p>
                  <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-1">
                    {t("adminMisc.programs.scopeAssignedGroupsHint")}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setEditingProgram({
                      ...editingProgram,
                      facilitator_scope: "all",
                    })
                  }
                  className={`p-3 rounded-xl border text-left transition-all ${
                    editingProgram?.facilitator_scope === "all"
                      ? "bg-brand-orange/10 border-[var(--brand-orange)]"
                      : "bg-secondary border-[var(--border-primary)]"
                  }`}
                >
                  <p
                    className={`text-[10px] font-bold uppercase ${editingProgram?.facilitator_scope === "all" ? "text-[var(--brand-orange)]" : "text-[var(--text-secondary)]"}`}
                  >
                    {t("adminMisc.programs.scopeAll")}
                  </p>
                  <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-1">
                    {t("adminMisc.programs.scopeAllHint")}
                  </p>
                </button>
              </div>

              {/* Default permissions */}
              <div className="p-3 bg-primary rounded-2xl border border-[var(--border-primary)] space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("adminMisc.programs.defaultPermissionsTitle")}
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {FACILITATOR_CAPS.map((cap) => {
                    const active = !!(
                      editingProgram?.facilitator_default_permissions || {}
                    )[cap.key];
                    return (
                      <button
                        key={cap.key}
                        type="button"
                        onClick={() => onToggleFacDefault(cap.key)}
                        className={`text-[10px] font-bold uppercase px-1.5 py-1.5 rounded-lg border text-left truncate transition-all ${
                          active
                            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                            : "bg-secondary border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--brand-orange)]"
                        }`}
                      >
                        {t(`adminMisc.programs.${cap.labelKey}`)}
                        {active ? " ✓" : ""}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Assigned facilitators */}
              <div className="p-3 bg-primary rounded-2xl border border-[var(--border-primary)] space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("adminMisc.programs.assignedFacilitatorsTitle")}
                </p>
                {(editingProgram?.facilitators || []).length === 0 && (
                  <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                    {t("adminMisc.programs.noFacilitatorsAssigned")}
                  </p>
                )}
                {(editingProgram?.facilitators || []).map((fac) => (
                  <div
                    key={fac.id}
                    className="rounded-xl border border-[var(--border-primary)] p-2.5 space-y-2 bg-secondary"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase truncate">
                          {fac.name || fac.email || fac.cid}
                        </p>
                        <p className="text-[10px] font-medium text-[var(--text-secondary)] truncate">
                          {fac.email && fac.email !== fac.name ? fac.email : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveFacilitator(fac)}
                        className="text-[10px] font-bold uppercase text-rose-400 hover:underline shrink-0"
                      >
                        {t("adminMisc.programs.remove")}
                      </button>
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                      {t("adminMisc.programs.individualOverridesTitle")}
                    </p>
                    <div className="grid grid-cols-2 gap-1">
                      {FACILITATOR_CAPS.map((cap) => {
                        const active = !!(fac.permissions || {})[cap.key];
                        return (
                          <button
                            key={cap.key}
                            type="button"
                            onClick={() => onToggleFacOverride(fac, cap.key)}
                            className={`text-[10px] font-bold uppercase px-1.5 py-1 rounded-lg border text-left truncate transition-all ${
                              active
                                ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-400"
                                : "bg-primary border-[var(--border-primary)] text-[var(--text-secondary)]"
                            }`}
                          >
                            {t(`adminMisc.programs.${cap.labelKey}`)}
                            {active ? " ✓" : ""}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Add facilitator */}
              <div className="p-3 bg-primary rounded-2xl border border-[var(--border-primary)] space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("adminMisc.programs.addFacilitatorTitle")}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={inviteForm.name}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, name: e.target.value })
                    }
                    placeholder={t(
                      "adminMisc.programs.newFacilitatorNamePlaceholder",
                    )}
                    className="bg-primary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)]"
                  />
                  <input
                    value={inviteForm.email}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, email: e.target.value })
                    }
                    placeholder={t(
                      "adminMisc.programs.newFacilitatorEmailPlaceholder",
                    )}
                    className="bg-primary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)]"
                  />
                </div>
                <button
                  type="button"
                  disabled={facBusy}
                  onClick={onCreateFacilitator}
                  className="w-full text-[10px] font-bold uppercase px-3 py-2 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 hover:bg-blue-500/25 transition-all"
                >
                  {t("adminMisc.programs.createAndInviteFacilitator")}
                </button>
                <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                  {t("adminMisc.programs.createAndInviteHint")}
                </p>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                  <input
                    value={facilitatorSearch}
                    onChange={(e) => setFacilitatorSearch(e.target.value)}
                    placeholder={t(
                      "adminMisc.programs.searchFacilitatorPlaceholder",
                    )}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-xl pl-9 pr-3 py-2.5 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)]"
                  />
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1">
                  {facilitatorPool
                    .filter(
                      (c) =>
                        !(editingProgram?.facilitators || []).some(
                          (f) => f.cid === c.cid,
                        ),
                    )
                    .filter(
                      (c) =>
                        c.role !== "participant" &&
                        c.role !== "applicant" &&
                        c.role !== "student",
                    )
                    .filter(
                      (c) =>
                        !facilitatorSearch ||
                        (c.name || "")
                          .toLowerCase()
                          .includes(facilitatorSearch.toLowerCase()) ||
                        (c.email || "")
                          .toLowerCase()
                          .includes(facilitatorSearch.toLowerCase()),
                    )
                    .map((contact) => (
                      <button
                        key={contact.cid}
                        type="button"
                        disabled={facBusy}
                        onClick={() => onAddFacilitator(contact)}
                        className="w-full flex items-center justify-between gap-2 p-2 rounded-lg border border-dashed border-[var(--border-primary)] hover:border-[var(--brand-orange)] text-left transition-all"
                      >
                        <span className="text-[10px] font-bold uppercase truncate">
                          {contact.name || contact.email}
                        </span>
                        <span className="text-[10px] font-medium text-[var(--text-secondary)] truncate">
                          {contact.email && contact.email !== contact.name
                            ? contact.email
                            : ""}
                        </span>
                        <Plus className="w-3 h-3 shrink-0 text-emerald-400" />
                      </button>
                    ))}
                  {facilitatorPool.length === 0 && (
                    <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                      {t("adminMisc.programs.noContactsInFacilitatorGroup")}
                    </p>
                  )}
                </div>
              </div>

              {/* Lead facilitator per group */}
              <div className="p-3 bg-primary rounded-2xl border border-[var(--border-primary)] space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("adminMisc.programs.leadFacilitatorPerGroupTitle")}
                </p>
                {(editingProgram?.assigned_segments || []).map((segmentId) => {
                  const family = (Array.isArray(notes) ? notes : []).find(
                    (n) => String(n.id) === String(segmentId),
                  );
                  if (!family) return null;
                  return (
                    <div
                      key={segmentId}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="text-[10px] font-bold uppercase truncate">
                        {family.name}
                      </span>
                      <select
                        value={family.lead_facilitator_id || ""}
                        onChange={(e) =>
                          onSetLeadFacilitator(
                            family.id,
                            e.target.value || null,
                          )
                        }
                        className="bg-primary border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none cursor-pointer max-w-[45%]"
                      >
                        <option value="">
                          {t("adminMisc.programs.noneOption")}
                        </option>
                        {(editingProgram?.facilitators || []).map((fac) => (
                          <option key={fac.cid} value={fac.cid}>
                            {fac.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
                {(editingProgram?.assigned_segments || []).length === 0 && (
                  <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                    {t(
                      "adminMisc.programs.assignGroupsForLeadFacilitatorHint",
                    )}
                  </p>
                )}
              </div>
            </div>

            {/* Inline group creation */}
            {isCreatingGroup && (
              <div className="space-y-3 p-4 bg-primary border border-blue-500/20 rounded-xl animate-in fade-in mt-2">
                <input
                  value={newGroup.name}
                  onChange={(e) =>
                    setNewGroup({ ...newGroup, name: e.target.value })
                  }
                  placeholder={t("adminMisc.programs.groupNamePlaceholder")}
                  className="w-full bg-transparent border-b border-[var(--border-primary)] py-2 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-blue-400"
                />
                <textarea
                  value={newGroup.description}
                  onChange={(e) =>
                    setNewGroup({ ...newGroup, description: e.target.value })
                  }
                  placeholder={t(
                    "adminMisc.programs.groupDescriptionPlaceholder",
                  )}
                  rows={2}
                  className="w-full bg-transparent border border-[var(--border-primary)] p-2 rounded text-[10px] font-medium text-[var(--text-primary)] outline-none focus:border-blue-400 resize-none"
                />
                <select
                  value={newGroup.default_role || ""}
                  onChange={(e) =>
                    setNewGroup({ ...newGroup, default_role: e.target.value })
                  }
                  className="w-full bg-transparent border border-[var(--border-primary)] p-2 rounded text-[10px] font-medium text-[var(--text-primary)] outline-none focus:border-blue-400"
                >
                  <option value="">
                    {t("adminMisc.programs.defaultRoleOptional")}
                  </option>
                  <option value="participant">
                    {t("adminMisc.programs.roleParticipant")}
                  </option>
                  <option value="staff">
                    {t("adminMisc.programs.roleStaff")}
                  </option>
                  <option value="program_manager">
                    {t("adminMisc.programs.roleProgramManager")}
                  </option>
                  <option value="mentor">
                    {t("adminMisc.programs.roleMentor")}
                  </option>
                  <option value="investor">
                    {t("adminMisc.programs.roleInvestor")}
                  </option>
                  <option value="founder">
                    {t("adminMisc.programs.roleFounder")}
                  </option>
                </select>
                <button
                  type="button"
                  onClick={onCreateGroupInline}
                  className="w-full py-2.5 bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase rounded-lg border border-blue-500/20 hover:bg-blue-500/20 transition-all"
                >
                  {t?.("common.create") || "Create & Assign Group"}
                </button>
              </div>
            )}
          </div>

          {/* Description (Concept Note) */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
              {t("adminMisc.programs.conceptNote")}
            </label>
            <textarea
              rows={3}
              value={editingProgram?.description || ""}
              onChange={(e) =>
                setEditingProgram({
                  ...editingProgram,
                  description: e.target.value,
                })
              }
              className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] resize-none transition-all"
            />
          </div>

          {/* Strategic KPIs */}
          <div className="space-y-4 pt-6 border-t border-[var(--border-primary)] text-left">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2 font-sans flex items-center gap-2">
                <Target className="w-3.5 h-3.5" />{" "}
                {t("adminMisc.programs.strategicKpisConfiguration")}
              </label>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("adminMisc.programs.superAdminOnly")}
              </span>
            </div>

            <div className="space-y-3">
              {editingKpis.map((kpi) => (
                <div
                  key={kpi.id}
                  className="flex items-center justify-between p-3.5 bg-white/[0.02] border border-[var(--border-primary)] rounded-xl group hover:border-brand-orange/30 transition-all"
                >
                  <div>
                    <p className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide">
                      {kpi.title}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--brand-orange)] mt-1">
                      {t("admin.targetValue")}: {kpi.target_value}%
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteKpi(kpi.id)}
                    className="text-[var(--text-secondary)] hover:text-rose-500 transition-colors p-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              <div className="p-4 bg-brand-orange/5 border border-brand-orange/10 rounded-xl space-y-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--brand-orange)]">
                    {t("adminMisc.programs.defineNewTarget")}
                  </p>
                  <p className="text-[10px] text-[var(--text-secondary)]">
                    {t("adminMisc.programs.targetDescription")}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    placeholder={t("adminMisc.programs.kpiTitlePlaceholder", {
                      title: t("admin.kpiTitle"),
                    })}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] text-xs font-bold"
                    value={editKpiInput.title}
                    onChange={(e) =>
                      setEditKpiInput({ ...editKpiInput, title: e.target.value })
                    }
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      placeholder={t(
                        "adminMisc.programs.targetPercentSample",
                      )}
                      className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] text-xs font-bold"
                      value={editKpiInput.target_value}
                      onChange={(e) =>
                        setEditKpiInput({
                          ...editKpiInput,
                          target_value: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                    <button
                      type="button"
                      onClick={onAddKpi}
                      disabled={isKpiSubmitting || !editKpiInput.title.trim()}
                      className="px-4 bg-[var(--brand-orange)] text-black font-bold uppercase text-sm tracking-wide rounded-xl hover:bg-white transition-all disabled:opacity-50"
                    >
                      {t("adminMisc.programs.add")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isUpdating}
            className="btn btn-primary w-full py-5 text-sm font-bold uppercase tracking-wide shadow-xl shadow-orange-500/20"
          >
            {isUpdating ? (
              <div className="flex items-center justify-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin" />{" "}
                <span>{t("common.saving")}</span>
              </div>
            ) : (
              t("adminMisc.programs.save")
            )}
          </button>

          {/* Save as template */}
          <button
            type="button"
            onClick={onSaveAsTemplate}
            className="btn btn-secondary w-full py-5 uppercase font-black tracking-[0.2em] mt-3"
          >
            <FileText className="w-4 h-4" /> {t("admin.saveAsTemplate")}
          </button>
        </form>
      </div>
    </div>
  );
}

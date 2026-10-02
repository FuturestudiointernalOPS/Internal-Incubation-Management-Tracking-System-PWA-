"use client";

import { Plus, Loader2, FileText } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import RegistrationLinkField from "./edit-modal/RegistrationLinkField";
import CurriculumMaterialsSection from "./edit-modal/CurriculumMaterialsSection";
import TargetGroupsSection from "./edit-modal/TargetGroupsSection";
import ProgramFacilitatorsSection from "./edit-modal/ProgramFacilitatorsSection";
import InlineGroupCreation from "./edit-modal/InlineGroupCreation";
import StrategicKpisSection from "./edit-modal/StrategicKpisSection";

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
            <RegistrationLinkField formUrl={formUrl} formName={formName} />
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
          <CurriculumMaterialsSection
            editingProgram={editingProgram}
            setEditingProgram={setEditingProgram}
            isUploading={isUploading}
            onFileUpload={onFileUpload}
          />

          {/* Target Groups + Facilitators section */}
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
              {t?.("admin.targetGroups") || "TARGET STUDENT GROUPS"}
            </label>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-2">
              {t?.("admin.assignProgramToGroups") ||
                "Assign this program to specific student cohorts or families."}
            </p>
            <TargetGroupsSection
              editingProgram={editingProgram}
              setEditingProgram={setEditingProgram}
              notes={notes}
              setNotes={setNotes}
              userRole={userRole}
              isCreatingGroup={isCreatingGroup}
              setIsCreatingGroup={setIsCreatingGroup}
              setNewGroup={setNewGroup}
            />

            {/* ═══ PROGRAM FACILITATORS ═══ */}
            <ProgramFacilitatorsSection
              editingProgram={editingProgram}
              setEditingProgram={setEditingProgram}
              onToggleFacDefault={onToggleFacDefault}
              onToggleFacOverride={onToggleFacOverride}
              onRemoveFacilitator={onRemoveFacilitator}
              inviteForm={inviteForm}
              setInviteForm={setInviteForm}
              facBusy={facBusy}
              onCreateFacilitator={onCreateFacilitator}
              facilitatorSearch={facilitatorSearch}
              setFacilitatorSearch={setFacilitatorSearch}
              facilitatorPool={facilitatorPool}
              onAddFacilitator={onAddFacilitator}
              notes={notes}
              onSetLeadFacilitator={onSetLeadFacilitator}
            />

            {/* Inline group creation */}
            {isCreatingGroup && (
              <InlineGroupCreation
                newGroup={newGroup}
                setNewGroup={setNewGroup}
                onCreateGroupInline={onCreateGroupInline}
              />
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
          <StrategicKpisSection
            editingKpis={editingKpis}
            onDeleteKpi={onDeleteKpi}
            editKpiInput={editKpiInput}
            setEditKpiInput={setEditKpiInput}
            isKpiSubmitting={isKpiSubmitting}
            onAddKpi={onAddKpi}
          />

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

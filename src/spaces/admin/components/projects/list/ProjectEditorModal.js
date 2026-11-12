import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function ProjectEditorModal({
  projectId,
  editProject,
  onFieldChange,
  onToggleLead,
  allStaff,
  editConceptFile,
  onConceptFileChange,
  uploadingEditConcept,
  onUploadConcept,
  savingEdit,
  onSave,
  onClose,
  projectMembers,
  onRemoveMember,
  onAddCollaborator,
}) {
  const { t } = useI18n();
  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-lg space-y-4 max-h-[85vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">
            {t("adminMisc.projectsList.editProject")}
          </h2>
          <button onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Editable project fields */}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] block mb-1">
              {t("adminMisc.projectsList.projectName")}
            </label>
            <input
              value={editProject.name}
              onChange={(event) => onFieldChange({ name: event.target.value })}
              className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-sm font-bold outline-none focus:border-[var(--brand-orange)] transition-all"
            />
          </div>

          <div className="col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] block mb-1">
              {t("adminMisc.projectsList.description")}
            </label>
            <textarea
              value={editProject.description}
              onChange={(event) => onFieldChange({ description: event.target.value })}
              placeholder={t("adminMisc.projectsList.descriptionPlaceholder")}
              rows={2}
              className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] block mb-1">
              {t("adminMisc.projectsList.status")}
            </label>
            <select
              value={editProject.status}
              onChange={(event) => onFieldChange({ status: event.target.value })}
              className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-sm font-bold outline-none text-[var(--text-primary)] appearance-none cursor-pointer"
            >
              <option value="Active">
                {t("adminMisc.projectsList.statusActive")}
              </option>
              <option value="Paused">
                {t("adminMisc.projectsList.statusPaused")}
              </option>
              <option value="Completed">
                {t("adminMisc.projectsList.statusCompleted")}
              </option>
              <option value="Archived">
                {t("adminMisc.projectsList.statusArchived")}
              </option>
              <option value="Closed">
                {t("adminMisc.projectsList.statusClosed")}
              </option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] block mb-1">
              {t("adminMisc.projectsList.priority")}
            </label>
            <select
              value={editProject.priority || "medium"}
              onChange={(event) => onFieldChange({ priority: event.target.value })}
              className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-sm font-bold outline-none appearance-none cursor-pointer"
            >
              <option value="critical">
                {t("adminMisc.projectsList.priorityCritical")}
              </option>
              <option value="high">
                {t("adminMisc.projectsList.priorityHigh")}
              </option>
              <option value="medium">
                {t("adminMisc.projectsList.priorityMedium")}
              </option>
              <option value="low">
                {t("adminMisc.projectsList.priorityLow")}
              </option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] block mb-1">
              {t("adminMisc.projectsList.startDate")}
            </label>
            <input
              type="date"
              value={editProject.start_date || ""}
              onChange={(event) => onFieldChange({ start_date: event.target.value })}
              className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] block mb-1">
              {t("adminMisc.projectsList.endDate")}
            </label>
            <input
              type="date"
              value={editProject.end_date || ""}
              onChange={(event) => onFieldChange({ end_date: event.target.value })}
              className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold outline-none"
            />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] block mb-1">
              {t("adminMisc.projectsList.projectLeads")}
            </label>
            <div className="max-h-32 overflow-y-auto space-y-1 border border-[var(--border-primary)] rounded-lg p-2">
              {allStaff.map((staffMember) => {
                const isSelected = editProject.leads.includes(
                  staffMember.cid || staffMember.id,
                );
                return (
                  <label
                    key={staffMember.cid || staffMember.id}
                    className="flex items-center gap-2 p-1.5 hover:bg-white/5 rounded cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(event) =>
                        onToggleLead(
                          staffMember.cid || staffMember.id,
                          event.target.checked,
                        )
                      }
                      className="rounded border-[var(--border-primary)] bg-transparent text-[var(--brand-orange)] focus:ring-brand-orange/50"
                    />
                    <span className="text-[10px] text-[var(--text-primary)]">
                      {staffMember.name}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Concept Note */}
        <div className="p-3 rounded-lg bg-tertiary/50 border border-[var(--border-primary)] space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
            {t("adminMisc.projectsList.conceptNote")}{" "}
            <span className="text-[var(--text-secondary)] font-normal normal-case">
              {t("adminMisc.projectsList.optional")}
            </span>
          </p>
          <p className="text-[10px] font-medium text-[var(--text-secondary)]">
            {t("adminMisc.projectsList.uploadOrLinkHint")}
          </p>
          {editProject.conceptNoteUrl && (
            <a
              href={editProject.conceptNoteUrl}
              target="_blank"
              className="text-[10px] text-[var(--brand-orange)] font-bold underline truncate block" rel="noreferrer"
            >
              {t("adminMisc.projectsList.viewCurrentConceptNote")}
            </a>
          )}
          <div className="flex gap-2 items-center">
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt,.png,.jpg"
              id="edit-concept-file"
              className="hidden"
              onChange={(event) => onConceptFileChange(event.target.files[0])}
            />
            <button
              onClick={() =>
                document.getElementById("edit-concept-file")?.click()
              }
              className="px-3 py-1.5 bg-[var(--brand-orange)] text-black rounded-lg text-[10px] font-bold uppercase tracking-widest"
            >
              {editProject.conceptNoteUrl
                ? t("adminMisc.projectsList.replaceFile")
                : t("adminMisc.projectsList.uploadFile")}
            </button>
            {editConceptFile && (
              <button
                onClick={onUploadConcept}
                disabled={uploadingEditConcept}
                className="px-3 py-1.5 bg-emerald-500 text-black rounded-lg text-[10px] font-bold uppercase tracking-widest disabled:opacity-30"
              >
                {uploadingEditConcept
                  ? "..."
                  : t("adminMisc.projectsList.save")}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-[var(--border-primary)]" />
            <span className="text-[10px] font-medium text-[var(--text-secondary)]">
              {t("adminMisc.projectsList.or")}
            </span>
            <div className="flex-1 h-px bg-[var(--border-primary)]" />
          </div>
          <input
            type="url"
            value={editProject.conceptNoteUrl || ""}
            onChange={(event) => onFieldChange({ conceptNoteUrl: event.target.value })}
            placeholder={t("adminMisc.projectsList.pasteLinkPlaceholder")}
            className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-[var(--brand-orange)] transition-all"
          />
        </div>

        <button
          onClick={onSave}
          disabled={savingEdit || !editProject.name.trim()}
          className="w-full py-2.5 bg-[var(--brand-orange)] text-black rounded-lg text-sm font-bold uppercase tracking-wide hover:brightness-110 transition-all"
        >
          {savingEdit
            ? t("adminMisc.projectsList.saving")
            : t("adminMisc.projectsList.saveChanges")}
        </button>

        {/* Collaborators */}
        <div className="pt-3 border-t border-divider/30">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2">
            {t("adminMisc.projectsList.collaborators")}
          </p>
          <div className="space-y-1.5 max-h-32 overflow-y-auto mb-3">
            {(projectMembers[projectId] || []).length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)] text-center py-4">
                {t("adminMisc.projectsList.noCollaborators")}
              </p>
            ) : (
              (projectMembers[projectId] || []).map((member) => (
                <div
                  key={member.user_cid}
                  className="flex items-center justify-between p-2 rounded-lg bg-tertiary/50"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[10px] font-bold uppercase">
                      {member.name?.charAt(0) || "?"}
                    </div>
                    <span className="text-[10px] font-bold text-[var(--text-primary)]">
                      {member.name || member.user_cid}
                    </span>
                    <span className="text-[10px] font-medium text-[var(--text-secondary)] uppercase">
                      {member.role}
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      onRemoveMember(member.user_cid)
                    }
                    className="text-[10px] font-bold uppercase text-rose-400 hover:text-rose-300"
                  >
                    {t("adminMisc.projectsList.remove")}
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <select
              id="add-collab-select"
              className="flex-1 bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-bold outline-none text-[var(--text-primary)] appearance-none cursor-pointer"
            >
              <option value="">
                {t("adminMisc.projectsList.addCollaboratorPlaceholder")}
              </option>
              {allStaff
                .filter(
                  (staffMember) =>
                    !(projectMembers[projectId] || []).find(
                      (member) =>
                        member.user_cid === (staffMember.cid || staffMember.id),
                    ),
                )
                .map((staffMember) => (
                  <option key={staffMember.cid || staffMember.id} value={staffMember.cid || staffMember.id}>
                    {staffMember.name}
                  </option>
                ))}
            </select>
            <button
              onClick={onAddCollaborator}
              className="px-4 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-sm font-bold uppercase tracking-wide hover:brightness-110"
            >
              {t("adminMisc.projectsList.add")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

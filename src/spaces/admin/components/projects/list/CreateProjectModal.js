import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function CreateProjectModal({
  newProject,
  onFieldChange,
  onToggleLead,
  conceptNoteFile,
  onConceptFileChange,
  uploadingConcept,
  onUploadConcept,
  allStaff,
  selectedMembers,
  onToggleMember,
  creating,
  onClose,
  onCreate,
}) {
  const { t } = useI18n();
  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-project-title"
        className="card w-full max-w-lg flex flex-col max-h-[90vh] my-auto"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="flex items-center justify-between shrink-0 px-5 pt-5 pb-3 border-b border-[var(--border-primary)]">
          <h2 id="create-project-title" className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">
            {t("adminMisc.projectsList.createProject")}
          </h2>
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            className="p-1 rounded-lg hover:bg-tertiary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="space-y-4 overflow-y-auto flex-1 px-5 py-4">
          <div>
            <label htmlFor="project-name" className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] block mb-1">
              {t("adminMisc.projectsList.projectNameRequired")}
            </label>
            <input
              id="project-name"
              value={newProject.name}
              onChange={(event) => onFieldChange({ name: event.target.value })}
              placeholder={t("adminMisc.projectsList.projectNameExample")}
              className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2.5 text-xs font-bold outline-none focus:border-[var(--brand-orange)] transition-all"
            />
          </div>

          <div>
            <label htmlFor="project-description" className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] block mb-1">
              {t("adminMisc.projectsList.description")}
            </label>
            <textarea
              id="project-description"
              value={newProject.description}
              onChange={(event) => onFieldChange({ description: event.target.value })}
              placeholder={t("adminMisc.projectsList.descriptionGoalsPlaceholder")}
              rows={3}
              className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2.5 text-xs font-bold outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
            />
          </div>

          {/* Start / End Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="project-start-date" className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] block mb-1">
                {t("adminMisc.projectsList.startDate")}
              </label>
              <input
                id="project-start-date"
                type="date"
                value={newProject.start_date}
                onChange={(event) => onFieldChange({ start_date: event.target.value })}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2.5 text-xs font-bold outline-none focus:border-[var(--brand-orange)] transition-all"
              />
            </div>
            <div>
              <label htmlFor="project-end-date" className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] block mb-1">
                {t("adminMisc.projectsList.endDate")}
              </label>
              <input
                id="project-end-date"
                type="date"
                value={newProject.end_date}
                onChange={(event) => onFieldChange({ end_date: event.target.value })}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2.5 text-xs font-bold outline-none focus:border-[var(--brand-orange)] transition-all"
              />
            </div>
          </div>

          <div>
            <label htmlFor="project-concept-url" className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] block mb-1">
              {t("adminMisc.projectsList.conceptNote")}{" "}
              <span className="text-[var(--text-secondary)] font-normal">
                {t("adminMisc.projectsList.optional")}
              </span>
            </label>
            <p className="text-[10px] font-medium text-[var(--text-secondary)] mb-2">
              {t("adminMisc.projectsList.uploadOrLinkHint")}
            </p>
            <div className="space-y-2">
              {/* Upload option */}
              <div className="flex gap-2 items-center">
                <input
                  id="project-concept-file"
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.png,.jpg"
                  onChange={(event) => onConceptFileChange(event.target.files[0])}
                  className="flex-1 text-[10px] text-[var(--text-secondary)] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[9px] file:font-black file:uppercase file:tracking-wider file:bg-[var(--brand-orange)] file:text-black file:cursor-pointer hover:file:brightness-110"
                />
                {conceptNoteFile && (
                  <button
                    onClick={onUploadConcept}
                    disabled={uploadingConcept}
                    className="px-3 py-1.5 bg-[var(--brand-orange)] text-black rounded-lg text-[10px] font-bold uppercase tracking-widest disabled:opacity-30"
                  >
                    {uploadingConcept
                      ? "..."
                      : t("adminMisc.projectsList.upload")}
                  </button>
                )}
              </div>
              {/* Divider */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-[var(--border-primary)]" />
                <span className="text-[8px] text-[var(--text-secondary)] font-bold">
                  {t("adminMisc.projectsList.or")}
                </span>
                <div className="flex-1 h-px bg-[var(--border-primary)]" />
              </div>
              {/* URL option */}
              <input
                id="project-concept-url"
                type="url"
                value={newProject.conceptNoteUrlInput}
                onChange={(event) => onFieldChange({ conceptNoteUrlInput: event.target.value })}
                placeholder={t("adminMisc.projectsList.pasteLinkPlaceholder")}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2.5 text-xs font-bold outline-none focus:border-[var(--brand-orange)] transition-all"
              />
            </div>
            {newProject.conceptNoteUrl && (
              <a
                href={newProject.conceptNoteUrl}
                target="_blank"
                className="text-[9px] text-[var(--brand-orange)] font-bold underline mt-1 inline-block" rel="noreferrer"
              >
                {t("adminMisc.projectsList.viewUploadedConceptNote")}
              </a>
            )}
            {newProject.conceptNoteUrlInput &&
              !newProject.conceptNoteUrl && (
                <p className="text-[9px] text-[var(--text-secondary)] mt-1 italic">
                  {t("adminMisc.projectsList.linkSavedHint")}
                </p>
              )}
          </div>
          <div>
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              {t("adminMisc.projectsList.projectLeads")}
            </label>
            <div className="max-h-32 overflow-y-auto space-y-1 border border-[var(--border-primary)] rounded-lg p-2">
              {allStaff.map((staffMember) => {
                const isSelected = newProject.leads.includes(
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
          <div>
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              {t("adminMisc.projectsList.collaboratorsCount", {
                count: selectedMembers.length,
              })}
            </label>
            <div className="max-h-32 overflow-y-auto space-y-1 border border-[var(--border-primary)] rounded-lg p-2">
              {allStaff.map((staffMember) => {
                const staffId = staffMember.cid || staffMember.id;
                const isSelected = selectedMembers.includes(staffId);
                return (
                  <label
                    key={staffId}
                    className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-tertiary cursor-pointer text-[10px]"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleMember(staffId, isSelected)}
                      className="accent-[var(--brand-orange)]"
                    />
                    <span className="font-bold">{staffMember.name}</span>
                    <span className="text-slate-500">{staffMember.role}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sticky footer */}
        <div className="flex gap-3 shrink-0 px-5 pb-5 pt-3 border-t border-[var(--border-primary)] bg-secondary/80 backdrop-blur">
          <button
            onClick={onClose}
            className="flex-1 btn btn-secondary py-3 text-[10px] font-black uppercase tracking-widest"
          >
            {t("adminMisc.projectsList.cancel")}
          </button>
          <button
            onClick={onCreate}
            disabled={creating || !newProject.name.trim()}
            className="flex-1 btn btn-primary py-3 text-[10px] font-black uppercase tracking-widest"
          >
            {creating
              ? t("adminMisc.projectsList.creating")
              : t("adminMisc.projectsList.createProject")}
          </button>
        </div>
      </div>
    </div>
  );
}

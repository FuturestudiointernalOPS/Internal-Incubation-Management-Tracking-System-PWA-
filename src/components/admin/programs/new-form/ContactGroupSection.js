import { Users, Plus } from "lucide-react";

/** Contact group assignment: link an existing group or create one inline. */
export default function ContactGroupSection({
  t,
  program,
  setProgram,
  isCreatingGroup,
  setIsCreatingGroup,
  newGroup,
  setNewGroup,
  handleCreateGroupInline,
  segments,
  createdGroup,
  notify,
}) {
  return (
    <div className="card space-y-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-6 opacity-5">
        <Users className="w-16 h-16" />
      </div>
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
          <Users className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-bold uppercase tracking-tight">
          {t("adminMisc.newProgram.contactGroupAssignment")}
        </h3>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center mb-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-1">
            {t("adminMisc.newProgram.groupTarget")}
          </label>
          <button
            type="button"
            onClick={() => {
              setIsCreatingGroup(!isCreatingGroup);
              if (!isCreatingGroup) {
                setNewGroup((prev) => ({
                  ...prev,
                  name: program.name || prev.name,
                }));
              }
            }}
            className="text-[10px] font-bold uppercase tracking-wide text-blue-400 hover:underline"
          >
            {isCreatingGroup
              ? t("adminMisc.newProgram.cancel")
              : t("adminMisc.newProgram.createNewGroup")}
          </button>
        </div>

        {!isCreatingGroup ? (
          <select
            value={program.assigned_segments?.[0] || ""}
            onChange={(event) =>
              setProgram({
                ...program,
                assigned_segments: [event.target.value],
              })
            }
            className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold text-white outline-none focus:border-[var(--brand-orange)] cursor-pointer"
          >
            <option value="">{t("adminMisc.newProgram.selectExistingGroup")}</option>
            {segments.map((segment) => (
              <option key={segment.id} value={segment.id}>
                {segment.name.toUpperCase()}
              </option>
            ))}
          </select>
        ) : (
          <div className="space-y-4 p-4 bg-primary border border-blue-500/20 rounded-xl animate-in fade-in zoom-in-95">
            <input
              value={newGroup.name}
              onChange={(event) =>
                setNewGroup({ ...newGroup, name: event.target.value })
              }
              placeholder={t("adminMisc.newProgram.groupNamePlaceholder")}
              className="w-full bg-transparent border-b border-[var(--border-primary)] py-2 text-xs font-bold text-white outline-none focus:border-blue-400"
            />
            <textarea
              value={newGroup.description}
              onChange={(event) =>
                setNewGroup({
                  ...newGroup,
                  description: event.target.value,
                })
              }
              placeholder={t("adminMisc.newProgram.groupDescriptionPlaceholder")}
              rows={2}
              className="w-full bg-transparent border border-[var(--border-primary)] p-2 rounded text-[10px] font-medium text-white outline-none focus:border-blue-400 resize-none"
            />
            <button
              type="button"
              onClick={handleCreateGroupInline}
              className="w-full py-2 bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase rounded-lg border border-blue-500/20"
            >
              {t("adminMisc.newProgram.generateGroupAndUrl")}
            </button>
          </div>
        )}

        {createdGroup && (
          <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
              {t("adminMisc.newProgram.publicRegistrationUrl")}
            </p>
            <div className="flex items-center justify-between gap-3 bg-black/40 p-2 rounded border border-white/5 overflow-hidden">
              <span className="text-[10px] font-mono text-white/60 truncate">
                {window.location.origin}/register-participant?group_id=
                {createdGroup.registration_id && encodeURIComponent(createdGroup.registration_id)}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${window.location.origin}/register-participant?group_id=${createdGroup.registration_id && encodeURIComponent(createdGroup.registration_id)}`,
                  );
                  notify("success", t("adminMisc.newProgram.copied"));
                }}
                className="p-1 bg-white/5 rounded hover:bg-white/10"
              >
                <Plus className="w-3 h-3 text-emerald-400 rotate-45" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

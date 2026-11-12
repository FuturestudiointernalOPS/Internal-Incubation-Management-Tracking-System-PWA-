import { X, Calendar, Plus } from "lucide-react";

export default function CreateRunModal({
  createData, setCreateData, forms, groups, saving, handleCreate,
  showInlineGroup, setShowInlineGroup, inlineGroupName, setInlineGroupName,
  creatingGroup, handleCreateGroupInline, setShowDatePicker, onClose, onDismiss, t,
}) {
  return (
    <div className="fixed inset-0 z-[400] bg-black/60 flex items-center justify-center p-6" onClick={onDismiss}>
      <div className="card w-full max-w-md space-y-5" onClick={(event) => event.stopPropagation()}>
        <div className="flex justify-between items-center"><h3 className="text-sm font-black uppercase text-[var(--text-primary)]">{t("platformMisc.runs.newFormRun")}</h3><button onClick={onClose}><X className="w-5 h-5" /></button></div>
        <div className="space-y-4">
          <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.runs.form")}</label>
            <select value={createData.form_id} onChange={(event) => setCreateData({ ...createData, form_id: event.target.value })} className="w-full rounded-xl px-3 py-3 text-sm font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)]">
              <option value="">{t("platformMisc.runs.selectPublishedForm")}</option>
              {forms.map((form) => <option key={form.id} value={form.id}>{form.name} (v{form.version})</option>)}
            </select>
          </div>
          <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.runs.runName")}</label><input value={createData.name} onChange={(event) => setCreateData({ ...createData, name: event.target.value })} className="w-full rounded-xl px-4 py-3 text-sm font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)]" placeholder={t("platformMisc.runs.runNamePlaceholder")} /></div>
          <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.runs.description")}</label><textarea value={createData.description} onChange={(event) => setCreateData({ ...createData, description: event.target.value })} rows={2} className="w-full rounded-xl px-4 py-3 text-sm font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] resize-none" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.runs.opens")}</label>
              <button onClick={() => setShowDatePicker('opens')} className={`w-full rounded-xl px-3 py-3 text-sm font-bold outline-none bg-primary border text-left flex items-center gap-2 transition-all ${createData.opens_at ? 'border-[var(--brand-orange)] text-[var(--text-primary)]' : 'border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--brand-orange)]'}`}>
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{createData.opens_at ? new Date(createData.opens_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : t("platformMisc.runs.setOpenDate")}</span>
              </button>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.runs.closes")}</label>
              <button onClick={() => setShowDatePicker('closes')} className={`w-full rounded-xl px-3 py-3 text-sm font-bold outline-none bg-primary border text-left flex items-center gap-2 transition-all ${createData.closes_at ? 'border-[var(--brand-orange)] text-[var(--text-primary)]' : 'border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--brand-orange)]'}`}>
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{createData.closes_at ? new Date(createData.closes_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : t("platformMisc.runs.setCloseDate")}</span>
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.runs.assignToGroupOptional")}</label>
            <select
              value={createData.group_id}
              onChange={(event) => setCreateData({ ...createData, group_id: event.target.value })}
              className="w-full rounded-xl px-3 py-3 text-sm font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)]"
            >
              <option value="">{t("platformMisc.runs.noGroupAssignLater")}</option>
              {groups.map((group) => (
                <option key={group.registration_id || group.id} value={group.registration_id || group.id}>
                  {group.name} {group.program_id ? t("platformMisc.runs.programLabel", { id: group.program_id }) : ""}
                </option>
              ))}
            </select>
            {!showInlineGroup ? (
              <button
                type="button"
                onClick={() => setShowInlineGroup(true)}
                className="text-[10px] font-bold uppercase tracking-wide text-[var(--brand-orange)] hover:opacity-80 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> {t("platformMisc.runs.newGroup")}
              </button>
            ) : (
              <div className="flex gap-2 items-center">
                <input
                  autoFocus
                  value={inlineGroupName}
                  onChange={(event) => setInlineGroupName(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") handleCreateGroupInline((group) => setCreateData({ ...createData, group_id: group.registration_id || group.id })); }}
                  placeholder={t("platformMisc.runs.groupNamePlaceholder")}
                  className="flex-1 rounded-xl px-3 py-2 text-sm font-bold outline-none bg-primary border border-[var(--brand-orange)] text-[var(--text-primary)]"
                />
                <button
                  type="button"
                  onClick={() => handleCreateGroupInline((group) => setCreateData({ ...createData, group_id: group.registration_id || group.id }))}
                  disabled={creatingGroup || !inlineGroupName.trim()}
                  className="px-3 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-sm font-bold uppercase tracking-wide disabled:opacity-40"
                >
                  {creatingGroup ? "..." : t("platformMisc.runs.create")}
                </button>
                <button type="button" onClick={() => { setShowInlineGroup(false); setInlineGroupName(""); }} className="p-2 text-[var(--text-secondary)] hover:text-rose-500"><X className="w-3 h-3" /></button>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-3"><button onClick={onClose} className="flex-1 btn btn-secondary">{t("platformMisc.runs.cancel")}</button><button onClick={handleCreate} disabled={saving || !createData.form_id || !createData.name.trim()} className="flex-1 btn btn-primary">{saving ? t("platformMisc.runs.creating") : t("platformMisc.runs.createRun")}</button></div>
      </div>
    </div>
  );
}

import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function CreateFormModal({
  createForm, setCreateForm, createMode, setCreateMode,
  aiGenText, setAiGenText, aiGenLoading, collections, canCreate, saving,
  onClose, onCancel, onBack, onCreate, onGenerate,
}) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-[400] bg-black/40 flex items-center justify-center p-6" onClick={onClose}>
      <div className="card w-full max-w-md space-y-5" onClick={(event) => event.stopPropagation()}>
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">{t("platformMisc.forms.newForm")}</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        {/* Mode Switcher */}
        <div className="flex gap-2 p-1 rounded-xl bg-tertiary">
          <button onClick={() => setCreateMode("manual")} className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${createMode === "manual" ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)]"}`}>{t("platformMisc.forms.createManual")}</button>
          {canCreate && <button onClick={() => setCreateMode("ai")} className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${createMode === "ai" ? "bg-indigo-500 text-white" : "text-[var(--text-secondary)]"}`}>{t("platformMisc.forms.createGenerateAi")}</button>}
        </div>

        {createMode === "manual" ? (
          <>
            <div className="space-y-4">
              <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.name")}</label><input value={createForm.name} onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })} className="w-full rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--brand-orange)]" placeholder={t("platformMisc.forms.namePlaceholder")} /></div>
              <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.description")}</label><textarea value={createForm.description} onChange={(event) => setCreateForm({ ...createForm, description: event.target.value })} rows={2} className="w-full rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--brand-orange)] resize-none" placeholder={t("platformMisc.forms.descriptionPlaceholder")} /></div>
              <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.collection")}</label>
                <select value={createForm.collection_id} onChange={(event) => setCreateForm({ ...createForm, collection_id: event.target.value })} className="w-full rounded-xl px-3 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--brand-orange)]">
                  <option value="">{t("platformMisc.forms.none")}</option>
                  {collections.filter((collection) => collection.status !== "archived" || String(collection.id) === createForm.collection_id).map((collection) => <option key={collection.id} value={collection.id}>{collection.name}{collection.status === "archived" ? t("platformMisc.forms.archivedSuffix") : ""}</option>)}
                </select>
              </div>
              <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.tags")}</label><input value={createForm.tags} onChange={(event) => setCreateForm({ ...createForm, tags: event.target.value })} className="w-full rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--brand-orange)]" placeholder={t("platformMisc.forms.tagsPlaceholder")} /></div>
            </div>
            <div className="flex gap-3"><button onClick={onCancel} className="flex-1 btn btn-secondary">{t("platformMisc.forms.cancel")}</button><button onClick={onCreate} disabled={saving || !createForm.name.trim()} className="flex-1 btn btn-primary">{saving ? t("platformMisc.forms.creating") : t("platformMisc.forms.createAndEdit")}</button></div>
          </>
        ) : (
          <>
            <div className="space-y-4">
              <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">{t("platformMisc.forms.aiGenHint")}</p>
              <textarea
                value={aiGenText}
                onChange={(event) => setAiGenText(event.target.value)}
                rows={8}
                placeholder={t("platformMisc.forms.aiGenTextPlaceholder")}
                className="w-full rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--brand-orange)] resize-none"
              />
              <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.collection")}</label>
                <select value={createForm.collection_id} onChange={(event) => setCreateForm({ ...createForm, collection_id: event.target.value })} className="w-full rounded-xl px-3 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--brand-orange)]">
                  <option value="">{t("platformMisc.forms.none")}</option>
                  {collections.filter((collection) => collection.status !== "archived" || String(collection.id) === createForm.collection_id).map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={onBack} className="flex-1 btn btn-secondary">{t("platformMisc.forms.back")}</button>
              {canCreate && (
              <button
                onClick={onGenerate}
                disabled={aiGenLoading || !aiGenText.trim()}
                className="flex-1 px-4 py-3 rounded-xl bg-indigo-500 text-white text-[10px] font-black uppercase hover:bg-indigo-600 disabled:opacity-50 transition-all"
              >
                {aiGenLoading ? t("platformMisc.forms.generating") : t("platformMisc.forms.generateForm")}
              </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

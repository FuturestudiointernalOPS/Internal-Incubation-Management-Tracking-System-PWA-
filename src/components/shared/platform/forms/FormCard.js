import { FileText, Edit3, Copy, Archive, RotateCcw, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { FORM_STATUS_KEYS } from "./constants";

export default function FormCard({ form, collection, onOpen, onDuplicate, onArchive, onUnarchive, onDelete }) {
  const { t } = useI18n();
  return (
    <div className="p-5 rounded-2xl bg-secondary border border-[var(--border-primary)] hover:border-brand-orange/50 transition-all group">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-brand-orange/10 flex items-center justify-center">
          <FileText className="w-5 h-5 text-[var(--brand-orange)]" />
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
          <button onClick={() => onOpen(form)} className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--brand-orange)] hover:bg-tertiary"><Edit3 className="w-3 h-3" /></button>
          <button onClick={() => onDuplicate(form)} className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-blue-500 hover:bg-tertiary"><Copy className="w-3 h-3" /></button>
          {form.status !== "archived" ? (
            <button onClick={() => onArchive(form.id)} className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-rose-500 hover:bg-tertiary" title={t("platformMisc.forms.archiveTitle")}><Archive className="w-3 h-3" /></button>
          ) : (
            <button onClick={() => onUnarchive(form.id)} className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-emerald-500 hover:bg-tertiary" title={t("platformMisc.forms.restoreTitle")}><RotateCcw className="w-3 h-3" /></button>
          )}
          <button onClick={() => onDelete(form.id)} className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-rose-500 hover:bg-tertiary" title={t("platformMisc.forms.deleteTitle")}><Trash2 className="w-3 h-3" /></button>
        </div>
      </div>
      <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">{form.name}</h3>
      {form.description && <p className="text-[10px] text-[var(--text-secondary)] mt-1">{form.description}</p>}
      {collection && <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-2 opacity-50">{t("platformMisc.forms.inCollection", { name: collection.name })}</p>}
      <div className="flex items-center gap-2 mt-3">
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${form.status === "published" ? "text-emerald-500 bg-emerald-500/10" : form.status === "draft" ? "text-amber-500 bg-amber-500/10" : "text-rose-500 bg-rose-500/10"}`}>{FORM_STATUS_KEYS[form.status] ? t("platformMisc.forms." + FORM_STATUS_KEYS[form.status]) : form.status}</span>
        <span className="text-[10px] font-medium text-[var(--text-secondary)]">v{form.version || 1}</span>
      </div>

    </div>
  );
}

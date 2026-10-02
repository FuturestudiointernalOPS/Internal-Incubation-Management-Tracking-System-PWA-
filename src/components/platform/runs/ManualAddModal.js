import { X } from "lucide-react";

export default function ManualAddModal({ onClose, name, setName, email, setEmail, adding, onSubmit, t }) {
  return (
    <div className="fixed inset-0 z-[500] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-secondary border border-[var(--border-primary)] p-6 space-y-4" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black uppercase text-[var(--text-primary)]">{t("platformMisc.runs.addRespondent")}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-tertiary text-[var(--text-secondary)]"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-[10px] font-medium text-[var(--text-secondary)] leading-relaxed">{t("platformMisc.runs.addRespondentDesc")}</p>
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.runs.manualAddName")}</label>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder={t("platformMisc.runs.manualAddNamePlaceholder")} className="w-full px-3 py-2.5 rounded-lg bg-primary border border-[var(--border-primary)] text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.runs.manualAddEmail")}</label>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t("platformMisc.runs.manualAddEmailPlaceholder")} className="w-full px-3 py-2.5 rounded-lg bg-primary border border-[var(--border-primary)] text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]" />
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} disabled={adding} className="flex-1 btn btn-secondary">{t("platformMisc.runs.cancel")}</button>
          <button onClick={onSubmit} disabled={adding} className="flex-1 btn btn-primary">{adding ? t("platformMisc.runs.manualAdding") : t("platformMisc.runs.addRespondent")}</button>
        </div>
      </div>
    </div>
  );
}

import { AlertTriangle, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function RepublishConfirmModal({ editingForm, onClose, onSaveAndRepublish, onSaveDraft }) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-[500] bg-black/50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="card w-full max-w-md space-y-5" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase text-[var(--text-primary)]">{t("platformMisc.forms.republishModalTitle")}</h3>
            <p className="text-[10px] text-[var(--text-secondary)] mt-1 leading-relaxed">
              <strong className="text-[var(--text-primary)]">&quot;{editingForm?.name}&quot;</strong>{t("platformMisc.forms.republishModalText")}
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <button
            onClick={onSaveAndRepublish}
            className="w-full px-4 py-3 rounded-xl bg-indigo-500 text-white text-[10px] font-black uppercase hover:bg-indigo-600 transition-all flex items-center justify-center gap-2"
          >
            <Sparkles className="w-3.5 h-3.5" /> {t("platformMisc.forms.republishSaveAndRepublish")}
          </button>
          <button
            onClick={onSaveDraft}
            className="w-full px-4 py-3 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[10px] font-black uppercase text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
          >
            {t("platformMisc.forms.republishSaveDraftOnly")}
          </button>
          <button
            onClick={onClose}
            className="w-full px-4 py-3 text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] uppercase tracking-wide"
          >
            {t("platformMisc.forms.cancel")}
          </button>
        </div>
        <p className="text-[10px] font-medium text-[var(--text-secondary)] text-center opacity-50">
          {t("platformMisc.forms.republishFootnote")}
        </p>
      </div>
    </div>
  );
}

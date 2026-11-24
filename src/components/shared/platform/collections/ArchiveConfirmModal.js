import { AlertTriangle } from "lucide-react";

export default function ArchiveConfirmModal({ t, archiveConfirm, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-[500] bg-black/50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="card w-full max-w-sm space-y-5" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase text-[var(--text-primary)]">
              {archiveConfirm.action === 'archive' ? t("platformMisc.collections.archiveCollectionTitle") : t("platformMisc.collections.restoreCollectionTitle")}
            </h3>
            <p className="text-[10px] text-[var(--text-secondary)] mt-1 leading-relaxed">
              {archiveConfirm.action === 'archive'
                ? t("platformMisc.collections.confirmArchivePrompt")
                : t("platformMisc.collections.confirmRestorePrompt")}
              <strong className="text-[var(--text-primary)]">&quot;{archiveConfirm.name}&quot;</strong>?
            </p>
          </div>
        </div>
        {archiveConfirm.action === 'archive' ? (
          <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
            <p className="text-[10px] font-bold text-amber-500 uppercase">{t("platformMisc.collections.archiveExplanationTitle")}</p>
            <ul className="text-[10px] font-medium text-[var(--text-secondary)] space-y-1 list-disc list-inside">
              <li>{t("platformMisc.collections.archiveHidden")}</li>
              <li>{t("platformMisc.collections.archiveFormsAccessible")}</li>
              <li>{t("platformMisc.collections.archiveRestorable")}</li>
              <li>{t("platformMisc.collections.archiveInFilter")}</li>
            </ul>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
            <p className="text-[10px] font-bold text-emerald-500 uppercase">{t("platformMisc.collections.restoreExplanationTitle")}</p>
            <ul className="text-[10px] font-medium text-[var(--text-secondary)] space-y-1 list-disc list-inside">
              <li>{t("platformMisc.collections.restoreActive")}</li>
              <li>{t("platformMisc.collections.restoreReappear")}</li>
              <li>{t("platformMisc.collections.restoreFormsUnchanged")}</li>
            </ul>
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 btn btn-secondary">{t("platformMisc.collections.cancel")}</button>
          <button onClick={onConfirm}
            className={archiveConfirm.action === 'archive' ? 'flex-1 px-4 py-2.5 rounded-xl bg-rose-500 text-white text-[10px] font-black uppercase hover:bg-rose-600 transition-all' : 'flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-[10px] font-black uppercase hover:bg-emerald-600 transition-all'}>
            {archiveConfirm.action === 'archive' ? t("platformMisc.collections.archive") : t("platformMisc.collections.restore")}
          </button>
        </div>
      </div>
    </div>
  );
}

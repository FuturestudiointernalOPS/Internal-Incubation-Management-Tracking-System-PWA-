import { useI18n } from "@/lib/i18n";
import { AlertCircle } from "lucide-react";

export default function ConfirmActionDialog({
  confirmTarget,
  onClearConfirmTarget,
  onConfirmAction,
}) {
  const { t } = useI18n();

  return (
    <div
      className="fixed inset-0 z-[500] bg-black/60 flex items-center justify-center p-6"
      onClick={() => onClearConfirmTarget()}
    >
      <div
        className="card w-full max-w-sm space-y-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-rose-500" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold">
              {t("pmMisc.workspace.confirmAction")}
            </p>
            <p className="text-xs text-[var(--text-secondary)]">
              {confirmTarget.message}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onClearConfirmTarget()}
            className="flex-1 px-4 py-2.5 bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-lg text-sm font-bold hover:opacity-80"
          >
            {t("pmMisc.workspace.cancel")}
          </button>
          <button
            onClick={onConfirmAction}
            className="flex-1 px-4 py-2.5 bg-rose-500 text-white rounded-lg text-sm font-bold hover:bg-rose-600"
          >
            {t("pmMisc.workspace.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

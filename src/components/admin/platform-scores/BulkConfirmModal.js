"use client";

import { ShieldAlert } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * The bulk approve/reject confirmation modal.
 * Extracted verbatim from ScoresPage.
 */
export default function BulkConfirmModal({ showBulkConfirm, pendingCount, bulkLoading, onCancel, onConfirm }) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-[600] bg-black/70 flex items-center justify-center p-6" onClick={onCancel}>
      <div className="card w-full max-w-md p-6 space-y-5" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3">
          <ShieldAlert className={`w-6 h-6 ${showBulkConfirm.decision === "approved" ? "text-emerald-500" : "text-rose-500"}`} />
          <h3 className="text-lg font-black text-[var(--text-primary)] tracking-tight">
            {showBulkConfirm.decision === "approved"
              ? pendingCount === 1
                ? t("adminMisc.platformScores.bulkApproveTitleOne", { count: pendingCount })
                : t("adminMisc.platformScores.bulkApproveTitleMany", { count: pendingCount })
              : pendingCount === 1
                ? t("adminMisc.platformScores.bulkRejectTitleOne", { count: pendingCount })
                : t("adminMisc.platformScores.bulkRejectTitleMany", { count: pendingCount })}
          </h3>
        </div>
        {showBulkConfirm.decision === "approved" ? (
          <div className="space-y-2 text-[10px] font-bold text-[var(--text-secondary)]">
            <p>{t("adminMisc.platformScores.bulkApproveBullet1")}</p>
            <p>{t("adminMisc.platformScores.bulkApproveBullet2")}</p>
            <p>{t("adminMisc.platformScores.bulkApproveBullet3")}</p>
            <p>{t("adminMisc.platformScores.bulkApproveBullet4")}</p>
          </div>
        ) : (
          <div className="space-y-2 text-[10px] font-bold text-[var(--text-secondary)]">
            <p>{t("adminMisc.platformScores.bulkRejectBullet1")}</p>
            <p>{t("adminMisc.platformScores.bulkRejectBullet2")}</p>
            <p>{t("adminMisc.platformScores.bulkRejectBullet3")}</p>
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 btn btn-secondary" disabled={bulkLoading}>
            {t("adminMisc.platformScores.cancel")}
          </button>
          <button
            onClick={onConfirm}
            disabled={bulkLoading}
            className={`flex-1 btn ${showBulkConfirm.decision === "approved" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"} text-white`}
          >
            {bulkLoading ? t("adminMisc.platformScores.processing") : t("adminMisc.platformScores.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

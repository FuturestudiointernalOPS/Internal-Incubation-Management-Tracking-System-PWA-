"use client";

import { LogOut, CheckCircle2 } from "lucide-react";

export default function SecurityConfirmDialog({
  t,
  confirmAction,
  onCancel,
  onRevoke,
  onResolve,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl w-full max-w-md m-4" onClick={(event) => event.stopPropagation()}>
        <div className="p-6">
          {confirmAction.type === "revoke" ? (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-red-500/10 rounded-xl">
                  <LogOut size={24} className="text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">{t("adminMisc.security.revokeSession")}</h3>
                  <p className="text-sm text-[var(--text-secondary)]">{t("adminMisc.security.forceLogoutWarning")}</p>
                </div>
              </div>
              {confirmAction.session && (
                <div className="bg-[var(--bg-primary)] rounded-lg p-3 mb-4 text-sm">
                  <p>{t("adminMisc.security.userLabel")} <span className="text-[var(--text-primary)]">{confirmAction.session.user_name || confirmAction.session.user_cid}</span></p>
                  <p>{t("adminMisc.security.ipLabel")} <span className="text-[var(--text-primary)] font-mono">{confirmAction.session.ip_address || t("adminMisc.security.na")}</span></p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-emerald-500/10 rounded-xl">
                  <CheckCircle2 size={24} className="text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">{t("adminMisc.security.resolveEvent")}</h3>
                  <p className="text-sm text-[var(--text-secondary)]">{t("adminMisc.security.markResolvedDesc")}</p>
                </div>
              </div>
            </>
          )}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-sm hover:bg-[var(--surface-2)] transition-colors"
            >
              {t("adminMisc.security.cancel")}
            </button>
            <button
              onClick={() => {
                if (confirmAction.type === "revoke") onRevoke(confirmAction.session.token);
                else onResolve(confirmAction.eventId);
              }}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                confirmAction.type === "revoke"
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-emerald-500 hover:bg-emerald-600 text-white"
              }`}
            >
              {t("adminMisc.security.confirm")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

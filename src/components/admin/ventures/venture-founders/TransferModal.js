"use client";

import { Crown, X, ChevronRight } from "lucide-react";

export default function TransferModal({
  setShowTransferModal,
  founders,
  setConfirmAction,
  setTransferTarget,
  setTransferring,
  notify,
  t,
  id,
  reload,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-3xl p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Crown className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-black text-[var(--text-primary)]">{t("vadmin.founders.transferOwnership")}</h2>
              <p className="text-[10px] text-[var(--text-secondary)]">{t("vadmin.founders.selectNewOwner")}</p>
            </div>
          </div>
          <button onClick={() => setShowTransferModal(false)} className="p-2 hover:bg-white/5 rounded-lg">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {founders
            .filter((founder) => !founder.is_owner && !founder.suspended_at && founder.status === "accepted")
            .map((founder) => (
              <button
                key={founder.id}
                onClick={() => {
                  setConfirmAction({
                    title: t("vadmin.founders.transferOwnership"),
                    message: t("vadmin.founders.transferConfirmDetailed", { name: founder.name, email: founder.email }),
                    confirmLabel: t("vadmin.founders.transferOwnership"),
                    onConfirm: async () => {
                      setTransferTarget(String(founder.id));
                      setShowTransferModal(false);
                      setTransferring(true);
                      try {
                        const response = await fetch(`/api/ventures/${id}/founders/transfer-ownership`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ new_owner_id: founder.id }),
                        });
                        const data = await response.json();
                        if (data.success) {
                          notify(t("vadmin.founders.ownershipTransferredTo", { name: founder.name }));
                          setConfirmAction(null);
                          reload();
                        } else {
                          notify(t((data.error || t("vadmin.founders.transferFailed")) || "") || (data.error || t("vadmin.founders.transferFailed")), "error");
                          setConfirmAction(null);
                        }
                      } catch { notify(t("vadmin.founders.networkError"), "error"); setConfirmAction(null); }
                      setTransferring(false);
                    },
                  });
                }}
                className="w-full text-left p-4 rounded-xl bg-primary border border-[var(--border-primary)] hover:border-amber-500/30 transition-all flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-sm font-black text-amber-400">
                  {founder.name?.charAt(0) || founder.email?.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-bold text-[var(--text-primary)]">{founder.name || founder.email}</p>
                  <p className="text-[10px] text-[var(--text-secondary)]">{founder.email} · {founder.role}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 ml-auto" />
              </button>
            ))}
          {founders.filter((founder) => !founder.is_owner && !founder.suspended_at && founder.status === "accepted").length === 0 && (
            <p className="text-sm text-[var(--text-secondary)] text-center py-8">
              {t("vadmin.founders.noEligibleFounders")}
            </p>
          )}
        </div>

        <button
          onClick={() => setShowTransferModal(false)}
          className="w-full py-3 rounded-xl border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest hover:bg-tertiary transition-all"
        >
          {t("vadmin.founders.cancel")}
        </button>
      </div>
    </div>
  );
}

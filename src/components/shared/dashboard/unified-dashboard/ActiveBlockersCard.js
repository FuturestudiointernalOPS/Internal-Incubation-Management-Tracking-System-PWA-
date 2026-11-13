"use client";

import { Shield } from "lucide-react";

/**
 * ACTIVE BLOCKERS — the compact rows, each resolvable in place.
 *
 * Extracted verbatim from UnifiedDashboard.
 */
export default function ActiveBlockersCard({
  t,
  blockers,
  fetching,
  resolvingBlocker,
  onResolveBlocker,
}) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3">
        <Shield className="w-4 h-4 text-rose-400" />
        <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
          {t("dashboard.activeBlockers", "Bloqueurs Actifs")}
        </span>
        <span className="text-[10px] font-bold text-[var(--text-secondary)] ml-auto">
          {blockers?.length || 0}
        </span>
      </div>
      {fetching ? (
        <div className="flex justify-center py-6">
          <div
            className="w-4 h-4 border-2 border-t-[var(--brand-orange)] rounded-full animate-spin"
            style={{
              borderColor: "rgba(255,102,0,0.1)",
              borderTopColor: "var(--brand-orange)",
            }}
          />
        </div>
      ) : blockers?.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)] py-4 text-center">
          {t("dashboard.noActiveBlockers", "Aucun bloqueur actif")}
        </p>
      ) : (
        <div className="space-y-1.5">
          {blockers?.slice(0, 5).map((blocker) => (
            <div
              key={blocker.id}
              className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-500/[0.02] border border-rose-500/5"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-[var(--text-primary)] truncate">
                  {blocker.title}
                </p>
                {blocker.severity && (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-rose-500">
                    {blocker.severity}
                  </span>
                )}
              </div>
              <button
                onClick={() => onResolveBlocker(blocker.id)}
                disabled={resolvingBlocker === blocker.id}
                className="px-2 py-1 bg-emerald-500 text-black rounded-lg text-[10px] font-bold uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-50 shrink-0"
              >
                {resolvingBlocker === blocker.id ? "..." : t("common.resolve", "Résoudre")}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

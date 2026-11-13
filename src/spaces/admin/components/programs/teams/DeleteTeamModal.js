"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/** Delete-confirmation modal for the program-teams screen. */
export default function DeleteTeamModal({
  deleteTarget,
  setDeleteTarget,
  handleDelete,
  deleting,
}) {
  const { t } = useI18n();

  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDeleteTarget(null)}
          />
          <div className="relative w-full max-w-md bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-[var(--border-primary)]">
              <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                {t("admin.teams.deleteTeam")}
              </h3>
            </div>
            <div className="p-6 space-y-2">
              <p className="text-sm font-bold text-[var(--text-primary)]">
                {t("admin.teams.deleteConfirm")}
              </p>
              <p className="text-xs text-[var(--text-secondary)] font-bold">
                {t("adminMisc.programTeams.teamLabel")}{" "}
                <span className="text-[var(--brand-orange)]">
                  {deleteTarget.name}
                </span>
              </p>
            </div>
            <div className="flex justify-end gap-3 px-6 pb-5">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-5 py-2.5 text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest rounded-xl hover:bg-secondary transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-5 py-2.5 bg-rose-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {t("common.delete")}
              </button>
            </div>
          </div>
        </div>
  );
}

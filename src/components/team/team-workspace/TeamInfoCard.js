"use client";

import { Star } from "lucide-react";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import { useI18n } from "@/lib/i18n";

/**
 * The overview's team panel: the name, programme, handler, project and status
 * rows, the venture-ready row, and — to those who may — the button that flips
 * it.
 * Extracted verbatim from app/team/[id]/page.js.
 */
export default function TeamInfoCard({ team, program, canMarkVentureReady, onToggleVentureReady }) {
  const { t } = useI18n();
  return (
    <AppCard padding="lg" className="lg:col-span-2">
      <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider mb-4">
        {t("rootMisc.team.teamInfo")}
      </h3>
      <div className="space-y-3">
        <div className="flex justify-between py-2 border-b border-[var(--border-primary)]">
          <span className="text-xs font-bold text-[var(--text-secondary)]">
            {t("rootMisc.team.teamName")}
          </span>
          <span className="text-xs font-bold text-[var(--text-primary)]">
            {team.name}
          </span>
        </div>
        <div className="flex justify-between py-2 border-b border-[var(--border-primary)]">
          <span className="text-xs font-bold text-[var(--text-secondary)]">
            {t("rootMisc.team.program")}
          </span>
          <span className="text-xs font-bold text-[var(--text-primary)]">
            {program?.name || "—"}
          </span>
        </div>
        <div className="flex justify-between py-2 border-b border-[var(--border-primary)]">
          <span className="text-xs font-bold text-[var(--text-secondary)]">
            {t("rootMisc.team.handler")}
          </span>
          <span className="text-xs font-bold text-[var(--text-primary)]">
            {team.handler_name || t("rootMisc.team.unassigned")}
          </span>
        </div>
        <div className="flex justify-between py-2 border-b border-[var(--border-primary)]">
          <span className="text-xs font-bold text-[var(--text-secondary)]">
            {t("rootMisc.team.project")}
          </span>
          <span className="text-xs font-bold text-[var(--text-primary)]">
            {program?.project_description || "—"}
          </span>
        </div>
        <div className="flex justify-between py-2">
          <span className="text-xs font-bold text-[var(--text-secondary)]">
            {t("rootMisc.team.status")}
          </span>
          <span className="text-xs font-bold text-emerald-500 uppercase">
            {t("rootMisc.team.active")}
          </span>
        </div>
        <div className="flex justify-between py-2 border-t border-[var(--border-primary)]">
          <span className="text-xs font-bold text-[var(--text-secondary)]">
            {t("rootMisc.team.ventureReady")}
          </span>
          <span
            className={`text-xs font-bold uppercase ${team.is_venture_ready ? "text-emerald-500" : "text-[var(--text-tertiary)]"}`}
          >
            {team.is_venture_ready ? (
              <span className="flex items-center gap-1">
                <Star className="w-3 h-3" /> {t("rootMisc.team.ready")}
              </span>
            ) : (
              t("rootMisc.team.notReady")
            )}
          </span>
        </div>
        {canMarkVentureReady && (
          <div className="flex justify-end pt-2">
            <AppButton
              variant={team.is_venture_ready ? "secondary" : "primary"}
              size="sm"
              icon={Star}
              onClick={onToggleVentureReady}
            >
              {team.is_venture_ready
                ? t("rootMisc.team.unmark")
                : t("rootMisc.team.markAsVentureReady")}
            </AppButton>
          </div>
        )}
      </div>
    </AppCard>
  );
}
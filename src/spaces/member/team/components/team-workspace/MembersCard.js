"use client";

import AppCard from "@/components/ui/AppCard";
import { useI18n } from "@/lib/i18n";

/**
 * The overview's members panel: one row per member, with the empty state when
 * the team has none yet.
 * Extracted verbatim from app/team/[id]/page.js.
 */
export default function MembersCard({ members }) {
  const { t } = useI18n();
  return (
    <AppCard padding="lg">
      <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider mb-4">
        {t("rootMisc.team.teamMembers")}
      </h3>
      {members.length === 0 ? (
        <p className="text-xs text-[var(--text-tertiary)] font-bold">
          {t("rootMisc.team.noMembersYet")}
        </p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {members.map((member, index) => (
            <div
              key={member.cid || member.id || index}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--surface-3)] transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-brand-orange/10 flex items-center justify-center text-[10px] font-black text-[var(--brand-orange)]">
                {(member.name || "?")[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                  {member.name || t("rootMisc.team.unnamed")}
                </p>
                <p className="text-[10px] font-medium text-[var(--text-tertiary)] truncate">
                  {member.email || ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppCard>
  );
}
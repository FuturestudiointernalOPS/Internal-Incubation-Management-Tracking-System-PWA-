"use client";

import { Users } from "lucide-react";
import AppBadge from "@/components/ui/AppBadge";
import AppEmptyState from "@/components/ui/AppEmptyState";

/**
 * 2. Who the rule would affect.
 *
 * Everyone on a template that grants programme management, with the running
 * programmes they keep. The decision number is how many would keep NOTHING.
 */
export default function HoldersPanel({ t, holders }) {
  return (
    <div className="space-y-2 border-t border-[var(--border-primary)] pt-3">
      <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
        <Users className="h-3 w-3 text-[var(--brand-orange)]" />
        {t("engineering.permissions.programScopeHoldersTitle")}
      </p>
      <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
        {t("engineering.permissions.programScopeHoldersBody")}
      </p>

      {holders.length === 0 ? (
        <AppEmptyState
          size="sm"
          icon={Users}
          title={t("engineering.permissions.programScopeHoldersEmpty")}
        />
      ) : (
        <div className="space-y-1.5">
          {holders.map((holder) => (
            <div
              key={holder.cid}
              className={`rounded-lg border px-3 py-2 ${
                holder.losesEverything
                  ? "border-amber-500/40 bg-amber-500/5"
                  : "border-[var(--border-primary)] bg-surface-2"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-[var(--text-primary)]">
                  {holder.name || holder.cid}
                </span>
                {holder.role && (
                  <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                    {holder.role}
                  </span>
                )}
                <span className="text-[10px] text-[var(--text-secondary)]">
                  {holder.viaRole
                    ? t(
                        "engineering.permissions.programScopeProfileDefault",
                        {
                          profile: holder.profile || holder.profileId || "—",
                          role: holder.viaRole,
                        },
                      )
                    : t(
                        "engineering.permissions.programScopeProfileExplicit",
                        { profile: holder.profile || holder.profileId || "—" },
                      )}
                </span>
                {holder.losesEverything ? (
                  <AppBadge variant="warning">
                    {t(
                      "engineering.permissions.programScopeKeepsNone",
                    )}
                  </AppBadge>
                ) : (
                  <AppBadge variant="default">
                    {t("engineering.permissions.programScopeKeeps", {
                      n: holder.keptCount ?? 0,
                    })}
                  </AppBadge>
                )}
              </div>
              {(holder.keptPrograms || []).length > 0 && (
                <p className="mt-1 text-[10px] leading-relaxed text-[var(--text-secondary)]">
                  <span className="font-bold">
                    {t("engineering.permissions.programScopeKeptIds")}:
                  </span>{" "}
                  {holder.keptPrograms.join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { UserPlus, CheckCircle2 } from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import AppEmptyState from "@/components/ui/AppEmptyState";
import Stat from "./Stat";
import { statusLabel } from "./labels";

/**
 * 1. Unmanaged programmes — the repair worklist.
 *
 * The programme-scope rule matches a person to a programme through the manager
 * relationship, so a running programme with nobody recorded as its manager
 * matches NOBODY. Each row carries the repair: record a manager.
 */
export default function UnmanagedWorklist({ t, unmanaged, onAssign }) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
        <UserPlus className="h-3 w-3 text-[var(--brand-orange)]" />
        {t("engineering.permissions.programScopeUnmanagedTitle")}
      </p>
      <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
        {t("engineering.permissions.programScopeUnmanagedBody")}
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          label={t(
            "engineering.permissions.programScopeUnmanagedToRepair",
          )}
          value={unmanaged.length}
          tone={unmanaged.length > 0 ? "warn" : "good"}
        />
      </div>

      {unmanaged.length === 0 ? (
        <AppEmptyState
          size="sm"
          icon={CheckCircle2}
          title={t("engineering.permissions.programScopeUnmanagedEmpty")}
        />
      ) : (
        <div className="space-y-1.5">
          {unmanaged.map((profile) => (
            <div
              key={profile.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2"
            >
              <span className="text-xs font-bold text-[var(--text-primary)]">
                {profile.name || profile.id}
              </span>
              {profile.status && (
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                  {statusLabel(t, profile.status)}
                </span>
              )}
              {profile.endDate && (
                <span className="text-[10px] text-[var(--text-secondary)]">
                  {t("engineering.permissions.operationsEnds")} {profile.endDate}
                </span>
              )}
              <span className="ml-auto">
                <AppButton
                  variant="secondary"
                  size="sm"
                  icon={UserPlus}
                  onClick={() => onAssign(profile)}
                >
                  {t("engineering.permissions.programScopeAssign")}
                </AppButton>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import React from "react";
import { ChevronDown } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import PermissionShell from "@/components/permissions/PermissionShell";
import PermissionManager from "@/components/permissions/PermissionCenter";
import OverviewView from "@/components/permissions/OverviewView";
import GovernanceView from "@/components/permissions/permission-center/GovernanceView";

/**
 * History — "what changed, who did it, and why?", plus the health that used to
 * need its own door.
 *
 * Three bands, longest-lived first:
 *   1. governance health (coverage, profiles, scope-engine state)
 *   2. membership health (who holds what, protected groups, default profiles)
 *   3. the log itself, with its filters and reasons
 *
 * Read-only and append-only: nothing on this screen can be edited.
 */
export default function PermissionHistoryPage() {
  const { t } = useI18n();

  return (
    <PermissionShell active="history">
      <p className="mb-4 text-xs font-medium text-[var(--text-secondary)]">
        {t("engineering.permissions.questionHistory")}
      </p>
      <div className="space-y-6">
        <OverviewView hideRecent />
        <details className="group rounded-[14px] border border-[var(--border-primary)] bg-[var(--bg-secondary)] open:pb-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-[var(--text-primary)] [&::-webkit-details-marker]:hidden">
            {t("engineering.permissions.historyGovernanceToggle")}
            <ChevronDown className="h-4 w-4 text-[var(--text-secondary)] transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="px-5">
            <GovernanceView hideRecent />
          </div>
        </details>
        <PermissionManager initialTab="audit" />
      </div>
    </PermissionShell>
  );
}

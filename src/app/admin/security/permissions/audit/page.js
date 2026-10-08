"use client";

import React from "react";
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
        <GovernanceView hideRecent />
        <PermissionManager initialTab="audit" />
      </div>
    </PermissionShell>
  );
}

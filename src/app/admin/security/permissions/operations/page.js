"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";
import PermissionShell from "@/components/permissions/PermissionShell";
import OperationsView from "@/components/permissions/OperationsView";

/**
 * PHASE UI-8 — Operations.
 *
 * "Run the jobs that change access for many people at once."
 *
 * The two portfolio-wide operations live in a door of their own rather than as
 * a sub-tab of Where it applies: that tab already carries its three sub-tasks,
 * and the "never more than three" rule is what keeps a tab readable. Each action
 * states its consequences before it runs and shows its result afterwards.
 *
 * Read-only in itself: both operations call endpoints the server authorizes, and
 * neither can widen access on its own — the re-derive is additive and
 * idempotent, and the report changes nothing.
 */
export default function PermissionOperationsPage() {
  const { t } = useI18n();

  return (
    <PermissionShell active="operations">
      <p className="mb-4 text-xs font-medium text-[var(--text-secondary)]">
        {t("engineering.permissions.questionOperations")}
      </p>
      <OperationsView />
    </PermissionShell>
  );
}

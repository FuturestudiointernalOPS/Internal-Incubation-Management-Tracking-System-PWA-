"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";
import PermissionShell, { useSubTab } from "@/components/permissions/PermissionShell";
import ContextScopeView from "@/components/permissions/ContextScopeView";

/**
 * PHASE UI-1/UI-5 — Where it applies.
 * Sub-tabs: the context-role registry, the memberships review and the scope
 * policy catalogue with the live verification bench.
 */
export default function PermissionContextScopePage() {
  const { t } = useI18n();
  const [sub, setSub] = useSubTab("roles");
  return (
    <PermissionShell active="context" sub={sub} onSubChange={setSub}>
      <p className="mb-4 text-xs font-medium text-[var(--text-secondary)]">
        {t("engineering.permissions.questionWhere")}
      </p>
      <ContextScopeView sub={sub} />
    </PermissionShell>
  );
}

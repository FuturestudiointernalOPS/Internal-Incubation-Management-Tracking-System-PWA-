"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";
import PermissionShell from "@/components/permissions/PermissionShell";
import PermissionManager from "@/components/permissions/PermissionCenter";
import OverviewView from "@/components/permissions/OverviewView";

/**
 * PHASE UI-5 — History.
 *
 * "What changed, who did it, and why?"
 *
 * The retired Home door lives at the top here (coverage, template count, scope
 * state) because both answer the same question at two lengths: the numbers are
 * the summary, the log is the detail — including the reason each admin typed.
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
        <PermissionManager initialTab="audit" />
      </div>
    </PermissionShell>
  );
}

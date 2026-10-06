"use client";

import React from "react";
import PermissionShell from "@/components/permissions/PermissionShell";
import IndividualAccessScreen from "@/components/permissions/IndividualAccessScreen";
import { useI18n } from "@/lib/i18n";

export default function PermissionPeoplePage() {
  const { t } = useI18n();

  return (
    <PermissionShell active="people">
      <div className="mb-5 space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          {t("engineering.permissions.accessPageTitle")}
        </h1>
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
          {t("engineering.permissions.accessPageSubtitle")}
        </p>
      </div>
      <IndividualAccessScreen />
    </PermissionShell>
  );
}

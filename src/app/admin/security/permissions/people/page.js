"use client";

import React from "react";
import PermissionShell from "@/components/permissions/PermissionShell";
import IndividualAccessScreen from "@/components/permissions/IndividualAccessScreen";
import { useI18n } from "@/lib/i18n";

/**
 * Person access — ONE screen under one door.
 *
 * Pick a person, see everything they can do and why (read), and change it
 * (write). The former "Person access" / "Job shortcuts" sub-tabs were retired:
 * with the read-only job report gone, the sub-tab bar had nothing left to
 * switch between, so the door renders the person-access screen directly.
 *
 * Pre-merge deep links (?sub=search, ?sub=matrix, ?sub=jobs) simply land here;
 * the `?sub=` value is ignored, and `?cid=` still preselects a person.
 */
export default function PermissionPeoplePage() {
  const { t } = useI18n();

  return (
    <PermissionShell active="people">
      <p className="mb-4 text-xs font-medium text-[var(--text-secondary)]">
        {t("engineering.permissions.questionPeople")}
      </p>
      <IndividualAccessScreen />
    </PermissionShell>
  );
}

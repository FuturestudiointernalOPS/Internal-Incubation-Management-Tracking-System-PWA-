"use client";

import React, { useEffect } from "react";
import PermissionShell, { useSubTab } from "@/components/permissions/PermissionShell";
import PermissionManager from "@/components/permissions/PermissionCenter";
import IndividualAccessScreen from "@/components/permissions/IndividualAccessScreen";
import { defer } from "@/components/permissions/effectUtils";
import { PERMISSION_PEOPLE_SUB_ALIASES } from "@/components/permissions/permissionNav";
import { useI18n } from "@/lib/i18n";

/**
 * PHASE UI-1/UI-2b/UI-3e — Individual Access.
 *
 *   access → ONE screen: the person picker plus the selected person's panels —
 *            what they hold and why (read) directly above how to change it
 *            (write). Merged in Phase 3 from the former "Manage access" and
 *            "User Matrix" sub-tabs, which had a search each.
 *   jobs   → responsibility assignments ("job shortcuts") with the role
 *            eligibility warning; assigning grants base view access and is
 *            never revoked on unassign.
 *
 * Pre-merge deep links (`?sub=search`, `?sub=matrix`) are canonicalised to
 * `access` so old bookmarks land on the merged screen instead of a blank one.
 */
export default function PermissionPeoplePage() {
  const { t } = useI18n();
  const [subTab, setSubTab] = useSubTab("access");
  const canonicalSubTab = PERMISSION_PEOPLE_SUB_ALIASES[subTab] || subTab;

  useEffect(() => {
    if (canonicalSubTab !== subTab) defer(() => setSubTab(canonicalSubTab));
  }, [canonicalSubTab, subTab, setSubTab]);

  return (
    <PermissionShell active="people" sub={canonicalSubTab} onSubChange={setSubTab}>
      <p className="mb-4 text-xs font-medium text-[var(--text-secondary)]">
        {t("engineering.permissions.questionPeople")}
      </p>
      {canonicalSubTab === "jobs" ? (
        <PermissionManager initialTab="responsibilities" />
      ) : (
        <IndividualAccessScreen />
      )}
    </PermissionShell>
  );
}

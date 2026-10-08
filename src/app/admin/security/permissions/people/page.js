"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";
import PermissionShell, { useSubTab } from "@/components/permissions/PermissionShell";
import IndividualAccessScreen from "@/components/permissions/IndividualAccessScreen";
import GroupsView from "@/components/permissions/GroupsView";
import AdminsView from "@/components/permissions/AdminsView";
import AccessChecker from "@/components/permissions/AccessChecker";

/**
 * People — the daily door, with the two people-wide registries beside it.
 *
 *   people → what ONE person can do (pick a person, read it, change it)
 *   groups → what a GROUP adds to everyone in it
 *   admins → who holds the platform-wide bypass
 *
 * The person-access editor keeps its own `?cid=` deep link; the sub-tab lives
 * in `?sub=`, so a specific person is still one shareable URL.
 */
export default function PermissionPeoplePage() {
  const { t } = useI18n();
  const [sub, setSub] = useSubTab("people");

  return (
    <PermissionShell active="people" sub={sub} onSubChange={setSub}>
      <p className="mb-4 text-xs font-medium text-[var(--text-secondary)]">
        {t("engineering.permissions.questionPeople")}
      </p>

      {sub === "groups" ? (
        <GroupsView />
      ) : sub === "admins" ? (
        <AdminsView />
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1.5">
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
                {t("engineering.permissions.accessPageTitle")}
              </h1>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                {t("engineering.permissions.accessPageSubtitle")}
              </p>
            </div>
            <AccessChecker />
          </div>
          <IndividualAccessScreen />
        </>
      )}
    </PermissionShell>
  );
}

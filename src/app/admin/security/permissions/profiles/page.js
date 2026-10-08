"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import PermissionShell, { useSubTab } from "@/components/permissions/PermissionShell";
import ProfilesView from "@/components/permissions/ProfilesView";
import ContextRolesView from "@/components/permissions/ContextRolesView";
import { defer } from "@/components/permissions/effectUtils";
import { PERMISSION_BASE } from "@/components/permissions/permissionNav";

/**
 * Profiles (formerly "Templates") — what a WHOLE kind of person gets.
 *
 *   matrix       → the profile catalogue: create, delete and give each profile
 *                  its capabilities (a profile IS its capability set)
 *   contextRoles → map a contextual relationship (mentor of this program…)
 *                  onto a profile, which is what turns a link into rights
 *
 * Retired link: ?sub=catalog forwards to Rules, where the capability registry
 * now opens beneath the ceiling it explains.
 */
export default function PermissionTemplatesPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [sub, setSub] = useSubTab("matrix");

  useEffect(() => {
    defer(() => {
      try {
        const retiredSub = new URLSearchParams(window.location.search).get("sub");
        if (retiredSub === "catalog") {
          router.replace(`${PERMISSION_BASE}/eligibility?sub=eligibility`);
        }
      } catch {
        /* cosmetic forwarding only */
      }
    });
  }, [router]);

  return (
    <PermissionShell active="templates" sub={sub} onSubChange={setSub}>
      <p className="mb-4 text-xs font-medium text-[var(--text-secondary)]">
        {t("engineering.permissions.questionTemplates")}
      </p>
      {sub === "contextRoles" ? <ContextRolesView /> : <ProfilesView />}
    </PermissionShell>
  );
}

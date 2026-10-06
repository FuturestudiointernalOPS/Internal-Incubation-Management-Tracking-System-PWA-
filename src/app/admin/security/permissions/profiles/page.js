"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import PermissionShell from "@/components/permissions/PermissionShell";
import ProfilesView from "@/components/permissions/ProfilesView";
import { defer } from "@/components/permissions/effectUtils";
import { PERMISSION_BASE } from "@/components/permissions/permissionNav";

/**
 * PHASE UI-5 → profiles takeover.
 *
 * "What does a kind of person get by default?" — now answered on ONE screen:
 * the profile catalogue, where each profile is created, deleted and given its
 * capabilities (docs/PROFILES_TAKEOVER_MIGRATION.md).
 *
 * Retired with this screen:
 *   • the "Access profiles" editor sub-tab (a profile IS the capability set);
 *   • the role/group rollup (it answered a read-only half of the same question).
 *
 * Retired link: ?sub=catalog forwards to Rules, where the eligibility registry
 * lives.
 */
export default function PermissionTemplatesPage() {
  const router = useRouter();

  useEffect(() => {
    // Deferred (project convention): a mount effect performs no synchronous
    // state write.
    defer(() => {
      try {
        const retiredSub = new URLSearchParams(window.location.search).get("sub");
        if (retiredSub === "catalog") {
          router.replace(`${PERMISSION_BASE}/eligibility?sub=ceilings`);
        }
      } catch {
        /* cosmetic forwarding only */
      }
    });
  }, [router]);

  return (
    <PermissionShell active="templates">
      <ProfilesView />
    </PermissionShell>
  );
}

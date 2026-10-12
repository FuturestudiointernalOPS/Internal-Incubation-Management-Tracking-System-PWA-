"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PERMISSION_BASE } from "@/components/permissions/permissionNav";

/**
 * Retired "Where it applies" door.
 *
 * The door is gone (five doors, one nav each). This route stays only so old
 * bookmarks and deep links do not 404: each former sub-tab forwards to the
 * question it now belongs to.
 *
 *   roles       → Profiles → Context roles
 *   policies    → Rules    → Scope policies
 *   memberships → History  (membership health heads the log)
 *
 * Nothing is rendered here; the shell is never mounted on this path.
 */
const TARGET_BY_SUB = {
  roles: `${PERMISSION_BASE}/profiles?sub=contextRoles`,
  policies: `${PERMISSION_BASE}/eligibility?sub=scope`,
  memberships: `${PERMISSION_BASE}/audit`,
};

export default function PermissionContextScopeRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    let subTab = "roles";
    try {
      subTab = new URLSearchParams(window.location.search).get("sub") || "roles";
    } catch {
      /* malformed URL — fall through to the context roles */
    }
    router.replace(TARGET_BY_SUB[subTab] || TARGET_BY_SUB.roles);
  }, [router]);

  return null;
}

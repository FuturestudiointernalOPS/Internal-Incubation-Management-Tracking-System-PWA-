"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PERMISSION_BASE } from "@/components/permissions/permissionNav";

/**
 * Retired "Advanced" / "Governance" door.
 *
 * The door is gone from the navigation (five doors, one nav each). This route
 * stays only so old bookmarks and deep links do not 404: each former sub-tab
 * forwards to the question it now belongs to.
 *
 *   catalog          → Rules      → Eligibility
 *   responsibilities → People     (the single person-access door)
 *   access           → Rules      → Responsibility access
 *   governance       → History    (membership health heads the log)
 *
 * Nothing is rendered here; the shell is never mounted on this path.
 */
const TARGET_BY_SUB = {
  catalog: `${PERMISSION_BASE}/eligibility?sub=eligibility`,
  responsibilities: `${PERMISSION_BASE}/people`,
  access: `${PERMISSION_BASE}/eligibility?sub=responsibilities`,
  governance: `${PERMISSION_BASE}/audit`,
  eligibility: `${PERMISSION_BASE}/eligibility?sub=eligibility`,
};

export default function PermissionGovernanceRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    let subTab = "catalog";
    try {
      subTab = new URLSearchParams(window.location.search).get("sub") || "catalog";
    } catch {
      /* malformed URL — fall through to the catalog */
    }
    router.replace(TARGET_BY_SUB[subTab] || TARGET_BY_SUB.catalog);
  }, [router]);

  return null;
}

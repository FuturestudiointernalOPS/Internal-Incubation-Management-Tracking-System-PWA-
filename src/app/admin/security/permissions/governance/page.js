"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PERMISSION_BASE } from "@/components/permissions/permissionNav";

/**
 * PHASE UI-2d — retired "Advanced" door.
 *
 * The door is gone from the navigation (six doors, one nav each). This route
 * stays only so old bookmarks and deep links do not 404: each former sub-tab
 * forwards to the question it now belongs to.
 *
 *   catalog          → Access Profiles    (Profiles → Catalog)
 *   responsibilities → Individual Access  (People  → Job shortcuts)
 *   access           → Eligibility        (Eligibility → Responsibility access)
 *   governance       → Context & Scope    (Context & Scope → Memberships)
 *
 * Nothing is rendered here; the shell is never mounted on this path.
 */
const TARGET_BY_SUB = {
  catalog: `${PERMISSION_BASE}/eligibility?sub=ceilings`,
  responsibilities: `${PERMISSION_BASE}/people?sub=jobs`,
  access: `${PERMISSION_BASE}/eligibility?sub=warnings`,
  governance: `${PERMISSION_BASE}/context-scope?sub=memberships`,
  eligibility: `${PERMISSION_BASE}/eligibility?sub=ceilings`,
};

export default function PermissionGovernanceRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    let sub = "catalog";
    try {
      sub = new URLSearchParams(window.location.search).get("sub") || "catalog";
    } catch {
      /* malformed URL — fall through to the catalog */
    }
    router.replace(TARGET_BY_SUB[sub] || TARGET_BY_SUB.catalog);
  }, [router]);

  return null;
}

"use client";

import React from "react";
import PermissionShell, { useSubTab } from "@/components/permissions/PermissionShell";
import PermissionManager from "@/components/permissions/PermissionCenter";

/**
 * PHASE UI-1 — Advanced (formerly Governance).
 * Sub-tabs: capability catalog and the advanced responsibilities screens.
 * Eligibility was promoted to its own primary route (nav slot 2); a stale
 * `?sub=eligibility` deep link lands on Catalog instead of a blank screen.
 */
const TAB_BY_SUB = {
  catalog: "catalog",
  responsibilities: "responsibilities",
  access: "access",
  eligibility: "catalog",
};

export default function PermissionGovernancePage() {
  const [sub, setSub] = useSubTab("catalog");
  const tab = TAB_BY_SUB[sub] || "eligibility";
  return (
    <PermissionShell active="governance" sub={sub} onSubChange={setSub}>
      <PermissionManager key={sub} embedded initialTab={tab} />
    </PermissionShell>
  );
}

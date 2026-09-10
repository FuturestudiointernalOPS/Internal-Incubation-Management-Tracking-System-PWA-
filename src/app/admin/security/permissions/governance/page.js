"use client";

import React from "react";
import PermissionShell, { useSubTab } from "@/components/permissions/PermissionShell";
import PermissionManager from "@/components/permissions/PermissionCenter";

/**
 * PHASE UI-1 — Governance.
 * Sub-tabs: eligibility matrix, capability catalog, and the advanced
 * responsibilities screens (previously the secondary admin row).
 */
const TAB_BY_SUB = {
  eligibility: "eligibility",
  catalog: "catalog",
  responsibilities: "responsibilities",
  access: "access",
};

export default function PermissionGovernancePage() {
  const [sub, setSub] = useSubTab("eligibility");
  const tab = TAB_BY_SUB[sub] || "eligibility";
  return (
    <PermissionShell active="governance" sub={sub} onSubChange={setSub}>
      <PermissionManager key={sub} embedded initialTab={tab} />
    </PermissionShell>
  );
}

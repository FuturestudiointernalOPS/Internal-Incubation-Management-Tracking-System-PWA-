"use client";

import React from "react";
import PermissionShell, { useSubTab } from "@/components/permissions/PermissionShell";
import PermissionManager from "@/components/permissions/PermissionCenter";

/**
 * PHASE UI-1/UI-2 — Eligibility (primary slot 2).
 *
 *   ceilings → the feature × identity allowlists the engine enforces (fail
 *              closed: a missing row denies)
 *   warnings → the responsibility role allowlists that drive the in-app
 *              "role incompatibility" warnings (relocated here in Phase 2
 *              from the retired "Advanced" section)
 *
 * Same two views as before, now two clicks closer to the top.
 */
const TAB_BY_SUB = {
  ceilings: "eligibility",
  warnings: "access",
};

export default function PermissionEligibilityPage() {
  const [sub, setSub] = useSubTab("ceilings");
  const tab = TAB_BY_SUB[sub] || "eligibility";
  return (
    <PermissionShell active="eligibility" sub={sub} onSubChange={setSub}>
      <PermissionManager key={sub} initialTab={tab} />
    </PermissionShell>
  );
}

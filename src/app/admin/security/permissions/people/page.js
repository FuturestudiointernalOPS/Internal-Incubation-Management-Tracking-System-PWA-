"use client";

import React from "react";
import PermissionShell, { useSubTab } from "@/components/permissions/PermissionShell";
import PermissionManager from "@/components/permissions/PermissionCenter";

/**
 * PHASE UI-1 — People.
 * Sub-tabs: user search (individual access) and the user capability matrix.
 * Supports the existing ?cid= deep link (View Effective Access).
 */
const TAB_BY_SUB = {
  search: "search",
  matrix: "userMatrix",
};

export default function PermissionPeoplePage() {
  const [sub, setSub] = useSubTab("search");
  const tab = TAB_BY_SUB[sub] || "search";
  return (
    <PermissionShell active="people" sub={sub} onSubChange={setSub}>
      <PermissionManager key={sub} embedded initialTab={tab} />
    </PermissionShell>
  );
}

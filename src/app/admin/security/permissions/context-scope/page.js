"use client";

import React from "react";
import PermissionShell, { useSubTab } from "@/components/permissions/PermissionShell";
import PermissionManager from "@/components/permissions/PermissionCenter";

/**
 * PHASE UI-1 — Context & Scope.
 * Sub-tabs: the context-role registry and the scope policy catalogue.
 */
const TAB_BY_SUB = {
  roles: "contextRoles",
  policies: "scopePolicies",
};

export default function PermissionContextScopePage() {
  const [sub, setSub] = useSubTab("roles");
  const tab = TAB_BY_SUB[sub] || "contextRoles";
  return (
    <PermissionShell active="context" sub={sub} onSubChange={setSub}>
      <PermissionManager key={sub} embedded initialTab={tab} />
    </PermissionShell>
  );
}

"use client";

import React from "react";
import PermissionShell, { useSubTab } from "@/components/permissions/PermissionShell";
import ContextScopeView from "@/components/permissions/ContextScopeView";

/**
 * PHASE UI-1/UI-2 — Context & Scope.
 * Sub-tabs: the context-role registry and the scope policy catalogue with the
 * live verification bench.
 */
export default function PermissionContextScopePage() {
  const [sub, setSub] = useSubTab("roles");
  return (
    <PermissionShell active="context" sub={sub} onSubChange={setSub}>
      <ContextScopeView sub={sub} />
    </PermissionShell>
  );
}

"use client";

import React from "react";
import PermissionShell, { useSubTab } from "@/components/permissions/PermissionShell";
import PermissionManager from "@/components/permissions/PermissionCenter";

/**
 * PHASE UI-1 — Profiles & Capabilities.
 * Sub-tabs map to the existing Access Setup sections (views unchanged).
 */
const SECTION_BY_SUB = {
  profiles: "profiles",
  roles: "roles",
  defaultsMatrix: "defaultsMatrix",
};

export default function PermissionProfilesPage() {
  const [sub, setSub] = useSubTab("profiles");
  const section = SECTION_BY_SUB[sub] || "profiles";
  return (
    <PermissionShell active="profiles" sub={sub} onSubChange={setSub}>
      <PermissionManager
        key={sub}
        embedded
        initialTab="setup"
        initialSection={section}
      />
    </PermissionShell>
  );
}

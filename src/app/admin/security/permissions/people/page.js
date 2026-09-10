"use client";

import React from "react";
import PermissionShell, { useSubTab } from "@/components/permissions/PermissionShell";
import PermissionManager from "@/components/permissions/PermissionCenter";
import PeopleView from "@/components/permissions/PeopleView";

/**
 * PHASE UI-1/UI-2b — People.
 *   search → Individual Access editor (existing write surface, unchanged)
 *   matrix → the access matrix with sources, effective reasons and a "why"
 *            drawer, plus the resolved-scope panel (read-only).
 * Supports the ?cid= deep link on both sub-tabs.
 */
export default function PermissionPeoplePage() {
  const [sub, setSub] = useSubTab("search");

  const manageAccess = (cid) => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("sub", "search");
      if (cid) url.searchParams.set("cid", cid);
      window.history.replaceState(null, "", url);
    } catch {
      /* URL update is cosmetic */
    }
    setSub("search");
  };

  return (
    <PermissionShell active="people" sub={sub} onSubChange={setSub}>
      {sub === "matrix" ? (
        <PeopleView onManageAccess={manageAccess} />
      ) : (
        <PermissionManager key={sub} embedded initialTab="search" />
      )}
    </PermissionShell>
  );
}

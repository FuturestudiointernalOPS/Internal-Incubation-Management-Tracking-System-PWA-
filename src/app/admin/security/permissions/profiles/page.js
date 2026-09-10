"use client";

import React, { useEffect, useState } from "react";
import PermissionShell, { useSubTab } from "@/components/permissions/PermissionShell";
import PermissionManager from "@/components/permissions/PermissionCenter";
import { defer } from "@/components/permissions/effectUtils";

/**
 * PHASE UI-1/UI-2c — Profiles & Capabilities.
 *   profiles       → master (list with badges: role default / inactive / SA)
 *                    + detail editor with a sticky review bar (impact, change
 *                    count, reason → audit log)
 *   roles          → role default mapping (unchanged)
 *   defaultsMatrix → the feature → module defaults matrix (unchanged)
 *   catalog        → the read-only capability registry (relocated here in
 *                    Phase 2 from the retired "Advanced" door)
 *
 * Deep link: ?profile=<id> selects a profile (shareable; the editor also uses
 * it for preselection when arriving from another screen).
 */
const SECTION_BY_SUB = {
  profiles: "profiles",
  roles: "roles",
  defaultsMatrix: "defaultsMatrix",
  catalog: "catalog",
};

export default function PermissionProfilesPage() {
  const [sub, setSub] = useSubTab("profiles");
  const [profileId, setProfileId] = useState(null);

  useEffect(() => {
    // Deferred (project convention): the deep link is read after the commit, so
    // the mount effect performs no synchronous state write.
    defer(() => {
      try {
        const pid = new URLSearchParams(window.location.search).get("profile");
        if (pid) setProfileId(pid);
      } catch {
        /* no deep link — keep the default state */
      }
    });
  }, []);

  const section = SECTION_BY_SUB[sub] || "profiles";
  return (
    <PermissionShell active="profiles" sub={sub} onSubChange={setSub}>
      <PermissionManager
        key={sub}
        initialTab="setup"
        initialSection={section}
        initialProfileId={section === "profiles" ? profileId : null}
      />
    </PermissionShell>
  );
}

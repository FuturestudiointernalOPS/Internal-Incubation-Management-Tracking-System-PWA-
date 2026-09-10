"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import PermissionShell from "@/components/permissions/PermissionShell";
import OverviewView from "@/components/permissions/OverviewView";

/**
 * PHASE UI-1 — Permission Center landing (Overview).
 * Governance health + recent changes + quick links. Read-only.
 *
 * Backward compatibility: old "View Effective Access" links pointed at the
 * root with ?cid= — forward them to the People screen, which preselects the
 * user (the deep-link handling lives in the People view).
 */
export default function PermissionOverviewPage() {
  const router = useRouter();

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const cid = params.get("cid");
      if (cid) {
        router.replace(
          `/admin/security/permissions/people?cid=${encodeURIComponent(cid)}`,
        );
      }
    } catch {
      /* cosmetic forwarding only */
    }
  }, [router]);

  return (
    <PermissionShell active="overview">
      <OverviewView />
    </PermissionShell>
  );
}

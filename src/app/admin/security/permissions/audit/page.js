"use client";

import React from "react";
import PermissionShell from "@/components/permissions/PermissionShell";
import PermissionManager from "@/components/permissions/PermissionCenter";

/** PHASE UI-1 — Audit (append-only permission history). */
export default function PermissionAuditPage() {
  return (
    <PermissionShell active="audit">
      <PermissionManager embedded initialTab="audit" />
    </PermissionShell>
  );
}

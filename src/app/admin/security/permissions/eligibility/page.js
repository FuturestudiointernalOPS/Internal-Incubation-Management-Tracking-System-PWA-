"use client";

import React from "react";
import PermissionShell from "@/components/permissions/PermissionShell";
import PermissionManager from "@/components/permissions/PermissionCenter";

/**
 * PHASE UI-1 — Eligibility (promoted to its own primary item, slot 2).
 *
 * The ceiling: "who may EVER receive this feature?" — checked by the engine
 * before any capability and fails closed. It never grants access by itself;
 * it only decides who is allowed to receive it.
 */
export default function PermissionEligibilityPage() {
  return (
    <PermissionShell active="eligibility">
      <PermissionManager key="eligibility" embedded initialTab="eligibility" />
    </PermissionShell>
  );
}

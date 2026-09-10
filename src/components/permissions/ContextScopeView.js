"use client";

import React from "react";
import ContextRolesView from "./ContextRolesView";
import ScopePoliciesView from "./ScopePoliciesView";
import LiveCheckPanel from "./LiveCheckPanel";
import { GovernanceView } from "./PermissionCenter";

/**
 * PHASE UI-2 / UI-2d — Context & Scope screen.
 *
 * Sub-tabs (from the shell):
 *   roles       → the context-role → profile registry (editable)
 *   policies    → the scope policy catalogue + the live verification bench
 *   memberships → who currently holds which contextual relationship, with the
 *                 expiry/protection stats (relocated here in Phase 2 when the
 *                 temporary "Advanced" door was retired)
 *
 * Read + existing writes only; nothing here changes authorization behavior.
 */
export default function ContextScopeView({ sub = "roles" }) {
  if (sub === "policies") {
    return (
      <div className="space-y-4">
        <ScopePoliciesView />
        <LiveCheckPanel />
      </div>
    );
  }
  if (sub === "memberships") {
    return <GovernanceView />;
  }
  return <ContextRolesView />;
}

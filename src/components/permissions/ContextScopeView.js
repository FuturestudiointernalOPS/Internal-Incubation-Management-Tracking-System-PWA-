"use client";

import React from "react";
import ContextRolesView from "./ContextRolesView";
import ScopePoliciesView from "./ScopePoliciesView";
import LiveCheckPanel from "./LiveCheckPanel";

/**
 * PHASE UI-2 — Context & Scope screen.
 *
 * Sub-tabs (from the shell):
 *   roles    → the context-role → profile registry (editable)
 *   policies → the scope policy catalogue + the live verification bench
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
  return <ContextRolesView />;
}

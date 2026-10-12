/**
 * PERMISSION CENTER — the screen dispatcher.
 *
 * What used to be one 4 884-line `"use client"` file is now a shell that routes
 * to the view a route/sub-tab asks for, plus eight modules under
 * `permission-center/`. Each view owns its own state and markup; this file owns
 * only the routing and the public surface:
 *
 *   default PermissionManager  — the screen for a given `initialTab`
 *   { GovernanceView }         — re-exported, imported by the History route
 *
 * The individual-access editor (the `search` view) keeps its own
 * `space-y-8 pb-20` wrapper, exactly as it had before the split, so the rendered
 * markup is byte-for-byte the same. No code crossed a layer boundary here: this
 * is a same-layer decomposition.
 */
"use client";

import AuditView from "@/components/permissions/permission-center/AuditView";
import EligibilityView from "@/components/permissions/permission-center/EligibilityView";
import PersonAccessScreen from "@/components/permissions/permission-center/PersonAccessScreen";
import ResponsibilitiesView from "@/components/permissions/permission-center/ResponsibilitiesView";
import ResponsibilityAccessView from "@/components/permissions/permission-center/ResponsibilityAccessView";

export default function PermissionManager({
  initialTab = "search",
  cid = null,
  // Forwarded from the screen above so the profiles bar can open the editor's
  // access-profile override dialog (see IndividualAccessScreen).
  overrideOpen = false,
  onOverrideClose = null,
}) {
  // The person editor owns its outer wrapper; the other tabs share one.
  if (initialTab === "search") {
    return (
      <PersonAccessScreen
        cid={cid}
        overrideOpen={overrideOpen}
        onOverrideClose={onOverrideClose}
      />
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {initialTab === "eligibility" && <EligibilityView />}
      {initialTab === "responsibilities" && <ResponsibilitiesView />}
      {initialTab === "access" && <ResponsibilityAccessView />}
      {initialTab === "audit" && <AuditView />}
    </div>
  );
}

export { default as GovernanceView } from "@/components/permissions/permission-center/GovernanceView";

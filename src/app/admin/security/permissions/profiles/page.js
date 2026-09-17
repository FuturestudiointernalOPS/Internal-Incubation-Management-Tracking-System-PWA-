"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import PermissionShell from "@/components/permissions/PermissionShell";
import PermissionManager from "@/components/permissions/PermissionCenter";
import EntitlementRollup from "@/components/permissions/EntitlementRollup";
import { defer } from "@/components/permissions/effectUtils";
import { PERMISSION_BASE } from "@/components/permissions/permissionNav";

/**
 * PHASE UI-5 — Templates (one screen, no sub-tabs).
 *
 * "What does a kind of person get by default?" — the reusable permission
 * packages, what each contains, how many people a change reaches, and the
 * "Default for: staff, member" control (which replaced the Role → Profile tab).
 *
 * Deep link: ?profile=<id> selects a template (unchanged).
 * Retired link: ?sub=catalog forwards to Rules, where the registry now lives.
 *
 * UI-9: the role/group ROLLUP lives here as a control (./EntitlementRollup)
 * rather than as a seventh door — it answers the read-only half of this screen's
 * own question ("what does a kind of person get?") for a whole category instead
 * of one template.
 */
export default function PermissionTemplatesPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [profileId, setProfileId] = useState(null);

  useEffect(() => {
    // Deferred (project convention): a mount effect performs no synchronous
    // state write.
    defer(() => {
      try {
        const pid = new URLSearchParams(window.location.search).get("profile");
        if (pid) setProfileId(pid);
      } catch {
        /* no deep link — keep the default state */
      }
    });
  }, []);

  useEffect(() => {
    defer(() => {
      try {
        const sub = new URLSearchParams(window.location.search).get("sub");
        if (sub === "catalog") {
          router.replace(`${PERMISSION_BASE}/eligibility?sub=ceilings`);
        }
      } catch {
        /* cosmetic forwarding only */
      }
    });
  }, [router]);

  return (
    <PermissionShell active="templates">
      <div className="mb-4 space-y-4">
        <p className="text-xs font-medium text-[var(--text-secondary)]">
          {t("engineering.permissions.questionTemplates")}
        </p>
        <EntitlementRollup />
      </div>
      <PermissionManager initialTab="setup" initialProfileId={profileId} />
    </PermissionShell>
  );
}

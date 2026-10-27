"use client";

import React, { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import CrmActionDashboard from "@/components/crm/CrmActionDashboard";

export const dynamic = "force-dynamic";

/**
 * CRM WORKSPACE — the single entry point for the CRM section.
 *
 * The screen is the action dashboard. The doors to organizations, leads,
 * opportunities, pipelines, activities, segments, automations, timeline and
 * membership live in the sidebar, so the hub does not repeat them.
 *
 * Nothing here is a permission — the APIs authorize every request again — the
 * capability read only keeps the dashboard away from a profile that cannot
 * open it.
 */
export default function CrmWorkspace() {
  const { t } = useI18n();
  const [effective, setEffective] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/me/permissions")
      .then((response) => response.json())
      .then((permissionData) => {
        if (!alive || !permissionData.success) return;
        setEffective(permissionData.effective || null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const has = (moduleKey, capability) =>
    Number(effective?.[moduleKey]?.[capability] ?? 0) >= 1;

  const canSeeCrm = has("crm", "view");

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <header className="flex items-center gap-3 border-b border-[var(--border-primary)] pb-6">
        <Users className="w-6 h-6 text-[var(--brand-orange)]" />
        <div>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-[var(--text-primary)]">
            {t("crm.hub.title")}
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            {t("crm.hub.subtitle")}
          </p>
        </div>
      </header>

      {canSeeCrm && <CrmActionDashboard />}
    </div>
  );
}

"use client";

import Link from "next/link";
import { Briefcase, Plus, Rocket, UserPlus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { usePermissions } from "@/lib/PermissionProvider";
import { CREATION_ACTIONS } from "@/lib/creationActions";

// Icon names from the shared catalogue resolved to components here, where the
// screen can import lucide without making the pure catalogue depend on React.
const ICONS = {
  briefcase: Briefcase,
  rocket: Rocket,
  userPlus: UserPlus,
};

/**
 * The creation ACTIONS, rendered where the records live.
 *
 * No sidebar entry: a person granted `programs.create` / `ventures.create` /
 * `investor.create` gets the button on the dashboard and on the matching list
 * view (Programs, Ventures). Each button appears only when its capability is
 * held; the server still re-authorizes the creation route.
 *
 * `only` narrows the row to one domain (e.g. the Programs page shows the
 * program action only); `tone="primary"` styles it as the page's main action.
 */
export default function CreateActions({ only = null, tone = "secondary" }) {
  const { t } = useI18n();
  const { can } = usePermissions();

  const actions = CREATION_ACTIONS.filter(
    (action) =>
      (!only || only.includes(action.id)) && can(action.module, action.capability),
  );
  if (actions.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((action) => {
        const Icon = ICONS[action.icon] || Plus;
        return (
          <Link
            key={action.id}
            href={action.href}
            className={`stf-btn${tone === "primary" ? " pr" : ""}`}
          >
            <Icon size={15} />
            {t(action.actionKey)}
          </Link>
        );
      })}
    </div>
  );
}

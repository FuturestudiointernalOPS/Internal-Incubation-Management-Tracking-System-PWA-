"use client";

/**
 * Section 2 — Profiles: "what does a role receive by default?"
 *
 * The matrix (a profile × a feature = a cell you can open) and the contextual
 * role → profile registry beside it. The cell drawer is where a profile's
 * capabilities are changed; the registry is read here, edited where the
 * governance screen owns it.
 */

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import AppButton from "@/components/ui/AppButton";
import { useDialogs } from "@/components/ui/DialogProvider";
import { notify } from "@/lib/notify";
import { deriveProfileBadges } from "../../profileBadges";
import {
  profileFeatureCaps,
  profileOverCeiling,
  rolesDefaultingTo,
} from "../personAccess";
import {
  Cell,
  EmptyRow,
  HeadCell,
  Kpi,
  KpiRow,
  Note,
  Pill,
  PrototypeTable,
  Toolbar,
} from "../prototypeUi";
import RederiveDrawer from "../drawers/RederiveDrawer";

const BADGE_KEY = {
  roleDefault: "profileBadge_roleDefault",
  inactive: "profileBadge_inactive",
  superAdmin: "profileBadge_superAdmin",
};

/** The server's refusal, in words the administrator can act on. */
function deleteBlockedMessage(json, t) {
  if (json?.error === "profile_in_use_role_default") {
    return t("engineering.permissions.profileDeleteBlockedRoleDefault", {
      roles: (json.roles || []).join(", "),
    });
  }
  if (json?.error === "profile_in_use_assignments") {
    return t("engineering.permissions.profileDeleteBlockedAssignments", {
      count: json.assignedCount ?? 0,
    });
  }
  if (json?.error === "profile_in_use_context") {
    return t("engineering.permissions.profileDeleteBlockedContext", {
      count: json.contextCount ?? 0,
    });
  }
  return json?.error || t("engineering.permissions.profileDeleteFailed");
}

export default function ProfilesSection({ data, tab, openDrawer }) {
  const { t } = useI18n();
  const { confirm } = useDialogs();
  const [rederive, setRederive] = useState(false);
  const { profiles = [], roleDefaults = {} } = data;

  const features = useMemo(() => {
    const fromModules = [...new Set(Object.values(data.moduleToFeature || {}))].filter(Boolean);
    const list = data.features?.length ? data.features : fromModules;
    return [...list].sort((a, b) => a.localeCompare(b));
  }, [data.features, data.moduleToFeature]);

  const deleteProfile = async (profile) => {
    const label = profile.label || profile.key;
    const accepted = await confirm({
      title: t("engineering.permissions.profilesDeleteTitle"),
      message: t("engineering.permissions.profilesDeleteConfirm", { label }),
      tone: "danger",
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
    });
    if (!accepted) return;
    try {
      const response = await fetch(
        `/api/engineering/permissions/profiles?key=${encodeURIComponent(profile.key)}`,
        { method: "DELETE" },
      );
      const json = await response.json().catch(() => null);
      if (!json?.success) throw new Error(deleteBlockedMessage(json, t));
      notify("success", t("engineering.permissions.profileDeleted", { label }));
      data.refresh?.("profiles");
      data.refresh?.("audit");
    } catch (error) {
      notify("error", error.message || t("engineering.permissions.profileDeleteFailed"));
    }
  };

  if (tab === "contextRoles")
    return (
      <ContextRolesTab
        data={data}
        rederive={rederive}
        onRederive={() => setRederive(true)}
        onCloseRederive={() => setRederive(false)}
      />
    );

  const activeCount = profiles.filter((profile) => Number(profile.is_active) !== 0).length;
  const defaultCount = Object.keys(roleDefaults).length;

  return (
    <>
      <KpiRow>
        <Kpi value={profiles.length} label={t("engineering.permissions.prototype.profilesCount")} />
        <Kpi value={activeCount} label={t("engineering.permissions.prototype.active")} />
        <Kpi value={defaultCount} label={t("engineering.permissions.prototype.defaultFor")} />
      </KpiRow>

      <Note>{t("engineering.permissions.prototype.matrixNote")}</Note>

      <PrototypeTable minWidth="52rem">
        <thead>
          <tr>
            <HeadCell>{t("engineering.permissions.prototype.profile")}</HeadCell>
            {features.map((feature) => (
              <HeadCell key={feature}>{feature}</HeadCell>
            ))}
            <HeadCell />
          </tr>
        </thead>
        <tbody>
          {profiles.length === 0 && (
            <EmptyRow colSpan={features.length + 2} label={t("common.noResults")} />
          )}
          {profiles.map((profile) => {
            const roles = rolesDefaultingTo(profile, roleDefaults);
            const badges = deriveProfileBadges(profile, roles);
            return (
              <tr key={profile.key}>
                <Cell className="min-w-48">
                  <span className="font-bold text-[var(--text-primary)]">{profile.name}</span>
                  <span className="ml-2 flex flex-wrap gap-1 pt-1">
                    {badges.map((badge) => (
                      <Pill key={badge} tone={badge === "inactive" ? "warn" : "accent"}>
                        {t(`engineering.permissions.${BADGE_KEY[badge]}`)}
                      </Pill>
                    ))}
                  </span>
                </Cell>
                {features.map((feature) => {
                  const held = profileFeatureCaps(
                    data.profileCapsById?.[profile.key] || {},
                    feature,
                    data.moduleToFeature || {},
                  );
                  const count = Object.values(held).reduce(
                    (sum, capabilities) => sum + Object.keys(capabilities).length,
                    0,
                  );
                  const locked = profileOverCeiling(profile, feature, {
                    roleDefaults,
                    eligibilityMatrix: data.eligibilityMatrix || {},
                  });
                  return (
                    <Cell key={feature} className="text-center">
                      <button
                        type="button"
                        onClick={() => openDrawer({ kind: "profileFeature", profile, feature })}
                        className={`min-w-10 rounded-[var(--radius-sm)] border px-2 py-1 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 ${
                          count > 0
                            ? "border-[var(--brand-orange)]/50 bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]"
                            : "border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        }`}
                        title={t("engineering.permissions.prototype.cellHint", {
                          profile: profile.name,
                          feature,
                        })}
                      >
                        {locked ? "🔒 " : ""}
                        {count > 0 ? count : t("engineering.permissions.prototype.emptyValue")}
                      </button>
                    </Cell>
                  );
                })}
                <Cell className="text-right">
                  <AppButton variant="danger" onClick={() => deleteProfile(profile)}>
                    {t("common.delete")}
                  </AppButton>
                </Cell>
              </tr>
            );
          })}
        </tbody>
      </PrototypeTable>
    </>
  );
}

/* ---------------------------------------------------------- contextRoles -- */

function ContextRolesTab({ data, rederive, onRederive, onCloseRederive }) {
  const { t } = useI18n();
  const rows = data.contextRoles || [];
  const empty = t("engineering.permissions.prototype.emptyValue");

  return (
    <>
      <Note>{t("engineering.permissions.prototype.contextRolesHint")}</Note>
      <Toolbar>
        <p className="flex-1 text-sm text-[var(--text-secondary)]">
          {t("engineering.permissions.prototype.contextRederiveHint")}
        </p>
        <AppButton variant="secondary" onClick={onRederive}>
          {t("engineering.permissions.prototype.rederiveOpen")}
        </AppButton>
      </Toolbar>
      <PrototypeTable minWidth="40rem">
        <thead>
          <tr>
            <HeadCell>{t("engineering.permissions.prototype.context")}</HeadCell>
            <HeadCell>{t("engineering.permissions.prototype.role")}</HeadCell>
            <HeadCell>{t("engineering.permissions.prototype.profile")}</HeadCell>
            <HeadCell>{t("engineering.permissions.prototype.members")}</HeadCell>
            <HeadCell>{t("engineering.permissions.prototype.status")}</HeadCell>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <EmptyRow colSpan={5} label={t("common.noResults")} />}
          {rows.map((row) => (
            <tr key={row.id || `${row.context}:${row.role_key}`} className="hover:bg-surface-2">
              <Cell>{row.context}</Cell>
              <Cell className="font-bold">{row.role_key}</Cell>
              <Cell>
                {row.profile_name || row.profile_key || (
                  <Pill tone="warn">{t("engineering.permissions.prototype.noProfile")}</Pill>
                )}
              </Cell>
              <Cell>{row.holders ?? empty}</Cell>
              <Cell>
                <Pill tone={Number(row.is_active) === 0 ? "neutral" : "ok"}>
                  {Number(row.is_active) === 0
                    ? t("engineering.permissions.prototype.inactive")
                    : t("engineering.permissions.prototype.active")}
                </Pill>
              </Cell>
            </tr>
          ))}
        </tbody>
      </PrototypeTable>

      {rederive && <RederiveDrawer onClose={onCloseRederive} onDone={() => data.refresh?.("all")} />}
    </>
  );
}

"use client";

/**
 * One cell of the Profiles matrix — the capabilities a profile holds inside
 * ONE feature — as the drawer where they are changed.
 *
 * Toggling behaves exactly like the matrix: clearing View clears the module,
 * checking anything checks View, a child implies its parent. The write is the
 * profile PUT (the whole capability set travels, so nothing else can be lost
 * by the side), and the ceiling refuses ineligible capabilities server-side.
 */

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import AppDrawer from "@/components/ui/AppDrawer";
import AppButton from "@/components/ui/AppButton";
import { notify } from "@/lib/notify";
import { toggleCapability } from "../../matrixHelpers/toggles";
import { CONTROL_CLASS, Field, Note, Pill } from "../prototypeUi";
import { modulesByFeature, profileOverCeiling, rolesDefaultingTo } from "../personAccess";

function clone(caps) {
  return JSON.parse(JSON.stringify(caps || {}));
}

export default function ProfileFeatureDrawer({ profile, feature, data, onClose, onSaved }) {
  const { t } = useI18n();
  const { catalog = {}, moduleToFeature = {}, profileCapsById = {}, roleDefaults = {} } = data;
  const initial = useMemo(() => profileCapsById[profile.key] || {}, [profileCapsById, profile.key]);
  const [draft, setDraft] = useState(() => clone(initial));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const modules = useMemo(
    () => modulesByFeature(moduleToFeature)[feature] || [],
    [moduleToFeature, feature],
  );
  const overCeiling = profileOverCeiling(profile, feature, {
    roleDefaults,
    eligibilityMatrix: data.eligibilityMatrix || {},
    profileEligibilityMatrix: data.profileEligibilityMatrix || {},
  });
  const defaultRoles = rolesDefaultingTo(profile, roleDefaults);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  const toggle = (mod, capability) => {
    const catalogCaps = catalog?.[mod]?.capabilities || {};
    const moduleCapabilities = [
      ...new Set([...Object.keys(catalogCaps), ...Object.keys(draft?.[mod] || {})]),
    ];
    const parents = {};
    for (const [child, meta] of Object.entries(catalogCaps)) {
      if (meta?.parent) parents[child] = meta.parent;
    }
    const held = Number(draft?.[mod]?.[capability] ?? 0) > 0;
    setDraft((current) =>
      toggleCapability(current, mod, capability, !held, moduleCapabilities, parents),
    );
  };

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/engineering/permissions/profiles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: profile.key,
          // The PUT replaces the profile row: everything it does NOT change
          // has to travel with it, or the write would clear it.
          allowed_roles: profile.allowed_roles || [],
          is_active: profile.is_active,
          capabilities: draft,
          reason: reason.trim() || undefined,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.success === false) {
        const key = typeof result?.error === "string" ? result.error : "";
        throw new Error(key.startsWith("errors.") && t(key) !== key ? t(key) : key || t("engineering.permissions.saveFailed"));
      }
      notify("success", t("engineering.permissions.prototype.featureSaved"));
      onSaved?.();
      onClose();
    } catch (caught) {
      setError(caught?.message || t("engineering.permissions.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppDrawer
      isOpen
      onClose={onClose}
      title={`${profile.name} ▸ ${feature}`}
      footer={
        <>
          <AppButton onClick={save} disabled={!dirty || busy} loading={busy}>
            {t("common.save")}
          </AppButton>
          <AppButton variant="secondary" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </AppButton>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={dirty ? "accent" : "neutral"}>
          {dirty ? t("engineering.permissions.prototype.modified") : t("engineering.permissions.prototype.unchanged")}
        </Pill>
        {defaultRoles.map((role) => (
          <Pill key={role}>{role}</Pill>
        ))}
      </div>

      {overCeiling && (
        <Note>
          {t("engineering.permissions.prototype.overCeilingHint", { feature, roles: defaultRoles.join(", ") })}
        </Note>
      )}

      <div className="space-y-3">
        {modules.map((mod) => {
          const catalogCaps = catalog?.[mod]?.capabilities || {};
          const held = draft?.[mod] || {};
          const capabilityNames = [
            ...new Set([...Object.keys(catalogCaps), ...Object.keys(held)]),
          ].sort();
          const heldCount = Object.keys(held).length;
          return (
            <div
              key={mod}
              className="rounded-[var(--radius-md)] border border-[var(--border-primary)] bg-surface-1 p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <b className="text-sm text-[var(--text-primary)]">
                  {catalog?.[mod]?.name || mod}
                </b>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("engineering.permissions.prototype.heldCount", { count: heldCount })}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {capabilityNames.map((capability) => {
                  const level = Number(held?.[capability] ?? 0);
                  const isHeld = level > 0;
                  const label = catalogCaps[capability]?.label || capability;
                  return (
                    <button
                      key={capability}
                      type="button"
                      onClick={() => toggle(mod, capability)}
                      aria-pressed={isHeld}
                      title={catalogCaps[capability]?.description || label}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 ${
                        isHeld
                          ? "border-[var(--brand-orange)] bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]"
                          : "border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
                {capabilityNames.length === 0 && (
                  <span className="text-xs text-[var(--text-secondary)]">
                    {t("engineering.permissions.prototype.noCapabilities")}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {modules.length === 0 && (
          <p className="text-sm text-[var(--text-secondary)]">
            {t("engineering.permissions.prototype.noModules")}
          </p>
        )}
      </div>

      <Field label={t("engineering.permissions.prototype.reasonOptional")}>
        <textarea
          rows={2}
          className={`${CONTROL_CLASS} w-full`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>

      {error && <p className="text-xs text-rose-500">{error}</p>}
    </AppDrawer>
  );
}

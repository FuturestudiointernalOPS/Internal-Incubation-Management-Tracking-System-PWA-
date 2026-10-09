"use client";

/**
 * New profile — the drawer the Profiles screen opens to CREATE a catalogue row
 * (the profiles takeover made the catalogue dynamic: a profile is a free key +
 * a display label + a context, and its capabilities are then edited cell by
 * cell on the matrix).
 *
 * It is the write the profile catalogue API's create already supports; the
 * screen simply had no door of its own. On success the catalogue AND the
 * eligibility ceiling are re-read, so the new profile immediately appears as a
 * row in Rules → Eligibility where its feature ceiling can be opened.
 */

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import AppDrawer from "@/components/ui/AppDrawer";
import AppButton from "@/components/ui/AppButton";
import { notify } from "@/lib/notify";
import { CONTROL_CLASS, Field } from "../prototypeUi";

/** The contexts the API accepts, as a fallback when the read did not supply them. */
const FALLBACK_CONTEXTS = ["program", "venture", "lms", "investor", "global", "staff"];
const FALLBACK_BASELINE_ROLES = ["super_admin", "staff", "member"];

/** A profile key: lowercase letter first, then letters / digits / underscores. */
const KEY_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;

export default function CreateProfileDrawer({ data, onClose, onSaved }) {
  const { t } = useI18n();
  const contexts = data?.contexts?.length ? data.contexts : FALLBACK_CONTEXTS;
  const baselineRoles = data?.baselineRoles?.length ? data.baselineRoles : FALLBACK_BASELINE_ROLES;

  const [draft, setDraft] = useState({
    key: "",
    label: "",
    context: contexts[0],
    allowed_roles: ["member"],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const key = draft.key.trim();
  const canSubmit = KEY_PATTERN.test(key) && draft.label.trim().length > 0 && !busy;

  const toggleRole = (role) =>
    setDraft((current) => ({
      ...current,
      allowed_roles: current.allowed_roles.includes(role)
        ? current.allowed_roles.filter((item) => item !== role)
        : [...current.allowed_roles, role],
    }));

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/engineering/permissions/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          label: draft.label.trim(),
          context: draft.context,
          allowed_roles: draft.allowed_roles,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.success === false) {
        if (result?.error === "profile_exists") {
          throw new Error(t("engineering.permissions.profileCreateExists"));
        }
        const code = typeof result?.error === "string" ? result.error : "";
        throw new Error(
          code.startsWith("errors.") && t(code) !== code
            ? t(code)
            : code || t("engineering.permissions.profileCreateFailed"),
        );
      }
      notify("success", t("engineering.permissions.profileCreated", { label: draft.label.trim() }));
      onSaved?.();
      onClose();
    } catch (caught) {
      setError(caught?.message || t("engineering.permissions.profileCreateFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppDrawer
      isOpen
      onClose={onClose}
      title={t("engineering.permissions.profilesCreateTitle")}
      footer={
        <>
          <AppButton onClick={submit} disabled={!canSubmit} loading={busy}>
            {t("engineering.permissions.profilesCreateSubmit")}
          </AppButton>
          <AppButton variant="secondary" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </AppButton>
        </>
      }
    >
      <Field label={t("engineering.permissions.profilesCreateKey")}>
        <input
          value={draft.key}
          onChange={(event) => setDraft((current) => ({ ...current, key: event.target.value }))}
          placeholder="auditor"
          className={`${CONTROL_CLASS} w-full`}
        />
      </Field>
      <p className="-mt-1 text-[11px] text-[var(--text-secondary)]">
        {t("engineering.permissions.profilesCreateKeyHint")}
      </p>

      <Field label={t("engineering.permissions.profilesCreateLabel")}>
        <input
          value={draft.label}
          onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))}
          placeholder="Auditor"
          className={`${CONTROL_CLASS} w-full`}
        />
      </Field>

      <Field label={t("engineering.permissions.profilesCreateContext")}>
        <select
          value={draft.context}
          onChange={(event) => setDraft((current) => ({ ...current, context: event.target.value }))}
          className={`${CONTROL_CLASS} w-full`}
        >
          {contexts.map((contextKey) => (
            <option key={contextKey} value={contextKey}>
              {t(`engineering.permissions.contextRolesContexts.${contextKey}`)}
            </option>
          ))}
        </select>
      </Field>

      <div>
        <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
          {t("engineering.permissions.profilesAllowedRoles")}
        </span>
        <div className="flex flex-wrap gap-3">
          {baselineRoles.map((role) => (
            <label
              key={role}
              className="inline-flex items-center gap-1.5 text-sm text-[var(--text-primary)]"
            >
              <input
                type="checkbox"
                checked={draft.allowed_roles.includes(role)}
                onChange={() => toggleRole(role)}
                className="accent-[var(--brand-orange)]"
              />
              {t(`engineering.permissions.profilesRoles.${role}`)}
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-rose-500">{error}</p>}
    </AppDrawer>
  );
}

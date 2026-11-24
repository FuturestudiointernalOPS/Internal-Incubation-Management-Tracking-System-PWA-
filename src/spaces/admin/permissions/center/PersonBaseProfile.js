"use client";

/**
 * Person ▸ Profiles ▸ base profile — the ONE profile that decides a person's
 * rights.
 *
 * Two different things share the word "profile" in the centre:
 *
 *   - the BASE profile: the capability bundle a person receives (their personal
 *     override, or the role's default). This is what actually grants rights;
 *   - the CONTEXTUAL profiles listed below: they describe what the person is in
 *     a programme or a Venture, and feed eligibility — they grant nothing by
 *     themselves.
 *
 * Without this card the second list was the only visible one, so assigning a
 * profile there looked like it should grant its capabilities. It does not. This
 * card is the write the profile-override endpoint has always offered.
 */

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import AppButton from "@/components/ui/AppButton";
import { useDialogs } from "@/components/ui/DialogProvider";
import { notify } from "@/lib/notify";
import { defer } from "../effectUtils";
import { CONTROL_CLASS, Note, Pill, Toolbar } from "./centerUi";

async function getJson(url) {
  const response = await fetch(url);
  return response.json();
}

export default function PersonBaseProfile({ cid, data, onChanged }) {
  const { t } = useI18n();
  const { confirm } = useDialogs();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!cid) return;
    try {
      const json = await getJson(
        `/api/engineering/permissions/profile-override?user_cid=${encodeURIComponent(cid)}`,
      );
      if (json?.success) {
        setSummary(json);
        setPicked(json.assignedProfile?.key || "");
        setError("");
      } else {
        setError(t("engineering.permissions.center.baseProfile.loadFailed"));
      }
    } catch {
      setError(t("engineering.permissions.center.baseProfile.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [cid, t]);

  useEffect(() => {
    defer(() => load());
  }, [load]);

  const profiles = (data?.profiles || []).filter(
    (profile) => Number(profile.is_active) !== 0,
  );
  const assigned = summary?.assignedProfile || null;
  const roleDefault = summary?.roleDefault || null;
  const currentKey = assigned?.key || "";
  const dirty = picked !== currentKey;

  const write = async (confirmLoss) => {
    const response = await fetch("/api/engineering/permissions/profile-override", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_cid: cid,
        profile_key: picked || null,
        ...(confirmLoss ? { confirm: true } : {}),
      }),
    });
    const json = await response.json().catch(() => ({}));
    return { response, json };
  };

  const save = async () => {
    if (!summary || !dirty) return;
    setBusy(true);
    setError("");
    try {
      let { response, json } = await write(false);

      // Removing a profile can take rights away. The server asks first; the
      // administrator sees the same warning and confirms explicitly.
      if (response.status === 409 && json?.requiresConfirmation) {
        const accepted = await confirm({
          title: t("engineering.permissions.center.baseProfile.lossTitle"),
          message: t("engineering.permissions.center.baseProfile.lossMessage"),
          tone: "danger",
          confirmLabel: t("engineering.permissions.center.baseProfile.confirm"),
          cancelLabel: t("common.cancel"),
        });
        if (!accepted) return;
        ({ response, json } = await write(true));
      }

      if (!response.ok || json?.success === false) {
        // The server may answer with an `errors.*` KEY (translatable) or a
        // diagnostic sentence. Only the key is shown; a raw sentence would be
        // an untranslated string in a French interface.
        const code = typeof json?.error === "string" ? json.error : "";
        throw new Error(
          code.startsWith("errors.") && t(code) !== code
            ? t(code)
            : t("engineering.permissions.center.baseProfile.saveFailed"),
        );
      }

      notify("success", t("engineering.permissions.center.baseProfile.saved"));
      await load();
      onChanged?.();
    } catch (caught) {
      setError(
        caught?.message || t("engineering.permissions.center.baseProfile.saveFailed"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--border-primary)] bg-surface-1 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
            {t("engineering.permissions.center.baseProfile.title")}
          </p>
          <p className="text-sm font-bold text-[var(--text-primary)]">
            {assigned?.name ||
              roleDefault?.name ||
              t("engineering.permissions.center.baseProfile.none")}
          </p>
        </div>
        <Pill tone={assigned ? "accent" : "neutral"}>
          {assigned
            ? t("engineering.permissions.center.baseProfile.sourceUser")
            : t("engineering.permissions.center.baseProfile.sourceRole")}
        </Pill>
      </div>

      <Note>{t("engineering.permissions.center.baseProfile.hint")}</Note>

      <Toolbar>
        <select
          className={CONTROL_CLASS}
          value={picked}
          onChange={(event) => setPicked(event.target.value)}
          disabled={loading || busy}
          aria-label={t("engineering.permissions.center.baseProfile.select")}
        >
          <option value="">
            {t("engineering.permissions.center.baseProfile.roleDefaultOption", {
              name:
                roleDefault?.name ||
                t("engineering.permissions.center.baseProfile.none"),
            })}
          </option>
          {profiles.map((profile) => (
            <option key={profile.key} value={profile.key}>
              {profile.name}
            </option>
          ))}
        </select>
        <AppButton onClick={save} disabled={!dirty || busy} loading={busy}>
          {t("engineering.permissions.center.baseProfile.apply")}
        </AppButton>
      </Toolbar>

      {error && <p className="text-xs text-rose-500">{error}</p>}
    </div>
  );
}

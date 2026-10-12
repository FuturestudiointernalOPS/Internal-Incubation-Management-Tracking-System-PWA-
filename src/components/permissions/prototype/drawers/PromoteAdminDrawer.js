"use client";

/**
 * Promote / withdraw a Super Administrator — the most locked action of the
 * centre, exactly as the prototype gates it: a mandatory motif AND the word
 * CONFIRMER typed by hand, before the button unlocks.
 *
 * The role gate itself is the server's: only a Super Admin session can send
 * these two actions at all.
 */

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import AppDrawer from "@/components/ui/AppDrawer";
import AppButton from "@/components/ui/AppButton";
import { notify } from "@/lib/notify";
import { CONTROL_CLASS, Field, Note, Pill } from "../prototypeUi";

export default function PromoteAdminDrawer({ person, mode, onClose, onSaved }) {
  const { t } = useI18n();
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const confirmWord = t("engineering.permissions.prototype.confirmWord");
  const valid = Boolean(reason.trim()) && typed.trim() === confirmWord;

  const confirm = async () => {
    if (!valid) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/engineering/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode === "promote" ? "promote_super_admin" : "remove_super_admin",
          user_cid: person.cid,
          reason: reason.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.success === false) throw new Error(data?.error || "save failed");
      notify("success", t("engineering.permissions.prototype.promoteApplied"));
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
      title={
        mode === "promote"
          ? t("engineering.permissions.prototype.promoteTitle")
          : t("engineering.permissions.prototype.removeTitle")
      }
      footer={
        <>
          <AppButton onClick={confirm} disabled={!valid || busy} loading={busy}>
            {t("common.confirm")}
          </AppButton>
          <AppButton variant="secondary" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </AppButton>
        </>
      }
    >
      <div className="flex items-center gap-2">
        <Pill tone="crit">{t("engineering.permissions.prototype.critical")}</Pill>
        <span className="text-sm font-bold text-[var(--text-primary)]">{person.name || person.cid}</span>
      </div>

      <Note>{t("engineering.permissions.prototype.promoteHint")}</Note>

      <Field label={t("engineering.permissions.prototype.reasonRequired")}>
        <textarea
          rows={3}
          className={`${CONTROL_CLASS} w-full`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>

      <Field label={t("engineering.permissions.prototype.typeToConfirm", { word: confirmWord })}>
        <input className={`${CONTROL_CLASS} w-full`} value={typed} onChange={(event) => setTyped(event.target.value)} />
      </Field>

      {error && <p className="text-xs text-rose-500">{error}</p>}
    </AppDrawer>
  );
}

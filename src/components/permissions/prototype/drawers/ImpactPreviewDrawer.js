"use client";

/**
 * The impact preview — the drawer that stands between an administrator and a
 * change whose consequences the server cannot refuse for them: dead rights
 * after a ceiling closes, capabilities a re-derivation would withdraw.
 *
 * It shows WHAT would happen, names the people affected, and only then lets
 * the change through. Nothing is written until Confirm.
 */

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import AppDrawer from "@/components/ui/AppDrawer";
import AppButton from "@/components/ui/AppButton";
import { Note, Pill } from "../prototypeUi";

export default function ImpactPreviewDrawer({ title, hint, lines = [], confirmLabel, onConfirm, onClose }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      await onConfirm();
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
      title={title}
      footer={
        <>
          <AppButton onClick={confirm} disabled={busy} loading={busy}>
            {confirmLabel || t("common.confirm")}
          </AppButton>
          <AppButton variant="secondary" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </AppButton>
        </>
      }
    >
      <div className="flex items-center gap-2">
        <Pill tone="warn">{t("engineering.permissions.prototype.impact")}</Pill>
      </div>
      {hint && <Note>{hint}</Note>}

      <div className="space-y-2 rounded-[var(--radius-md)] border border-[var(--border-primary)] bg-surface-2 p-3">
        {lines.map((line, index) => (
          <p key={index} className="text-sm text-[var(--text-primary)]">
            {line}
          </p>
        ))}
        {lines.length === 0 && (
          <p className="text-sm text-[var(--text-secondary)]">{t("engineering.permissions.prototype.noImpact")}</p>
        )}
      </div>

      <p className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">
        {t("engineering.permissions.prototype.nothingWritten")}
      </p>

      {error && <p className="text-xs text-rose-500">{error}</p>}
    </AppDrawer>
  );
}

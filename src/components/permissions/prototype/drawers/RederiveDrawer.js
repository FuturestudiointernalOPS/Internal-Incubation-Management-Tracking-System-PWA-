"use client";

/**
 * "Re-dériver les droits depuis les liens contextuels" — preview first, then
 * execute.
 *
 * The preview is the readiness report (who the reconcile would touch, what it
 * would add, what it would withdraw); the execution is the sync endpoint. The
 * drawer never applies anything on open: it is read-only until Confirm.
 */

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import AppDrawer from "@/components/ui/AppDrawer";
import AppButton from "@/components/ui/AppButton";
import { notify } from "@/lib/notify";
import { Kpi, KpiRow, Note, Pill } from "../prototypeUi";

export default function RederiveDrawer({ onClose, onDone }) {
  const { t } = useI18n();
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/engineering/permissions/context-grant-readiness")
      .then((response) => response.json())
      .then((data) => active && setPreview(data))
      .catch((caught) => active && setError(caught?.message || "load failed"));
    return () => {
      active = false;
    };
  }, []);

  const execute = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/engineering/permissions/sync-context-grants");
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.success === false) throw new Error(data?.error || "sync failed");
      notify("success", t("engineering.permissions.prototype.rederiveDone"));
      onDone?.();
      onClose();
    } catch (caught) {
      setError(caught?.message || t("engineering.permissions.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const summary = preview?.summary;

  return (
    <AppDrawer
      isOpen
      onClose={onClose}
      title={t("engineering.permissions.prototype.rederiveTitle")}
      footer={
        <>
          <AppButton onClick={execute} disabled={busy || !preview?.success} loading={busy}>
            {t("engineering.permissions.prototype.rederiveRun")}
          </AppButton>
          <AppButton variant="secondary" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </AppButton>
        </>
      }
    >
      <Note>{t("engineering.permissions.prototype.rederiveHint")}</Note>

      {!preview && !error && <p className="text-sm text-[var(--text-secondary)]">{t("common.loading")}</p>}

      {summary && (
        <>
          <KpiRow>
            <Kpi value={summary.people} label={t("engineering.permissions.prototype.people")} />
            <Kpi value={summary.assignments} label={t("engineering.permissions.prototype.assignments")} />
            <Kpi value={summary.drift} label={t("engineering.permissions.prototype.drift")} />
            <Kpi value={summary.impact} label={t("engineering.permissions.prototype.impact")} />
          </KpiRow>

          <div className="rounded-[var(--radius-md)] border border-[var(--border-primary)] bg-surface-2 p-3 text-sm">
            {summary.wouldLose.length === 0 ? (
              <p className="text-[var(--text-secondary)]">{t("engineering.permissions.prototype.nothingToLose")}</p>
            ) : (
              <>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-amber-500">
                  {t("engineering.permissions.prototype.wouldLose", { count: summary.wouldLose.length })}
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {summary.wouldLose.slice(0, 12).map((capability) => (
                    <li key={capability}>
                      <Pill tone="warn">{capability}</Pill>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {preview.truncated && (
              <p className="mt-2 text-xs text-[var(--text-secondary)]">
                {t("engineering.permissions.prototype.readinessTruncated")}
              </p>
            )}
          </div>
        </>
      )}

      {error && <p className="text-xs text-rose-500">{error}</p>}
    </AppDrawer>
  );
}

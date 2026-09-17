"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { capabilityLabel } from "@/lib/authorization/capability-catalog";
import AppModal from "@/components/ui/AppModal";
import AppButton from "@/components/ui/AppButton";
import RiskBadge from "./RiskBadge";
import { capabilityLabelKey } from "./riskGate";

/**
 * PHASE UI-9 — "confirm, do not block".
 *
 * A capability's risk level is a property of the CATALOG, not of the person
 * being edited, so the same write can be routine on one account and
 * consequential on another. This dialog does not decide for the administrator:
 * it names the capability and its risk level, and lets them proceed. Every
 * capability in the change is listed, because "grant something at high risk" is
 * not actionable — "grant `permissions.promote_super_admin` (critical)" is.
 *
 * Props:
 *   open      — visibility
 *   changes   — [{ module, capability, risk }] already classified (see ./riskGate)
 *   subject   — the person the change applies to, when there is one
 *   onCancel  — dismiss
 *   onConfirm — apply the change anyway
 */
export default function RiskConfirmDialog({
  open = false,
  changes = [],
  subject = "",
  onCancel,
  onConfirm,
  busy = false,
}) {
  const { t } = useI18n();
  if (!open) return null;

  const capText = (module, capability) => {
    const key = capabilityLabelKey(capability);
    const label = t(key);
    const resolved = label === key ? capabilityLabel(module, capability) : label;
    return `${module} · ${resolved}`;
  };

  return (
    <AppModal
      isOpen={open}
      onClose={onCancel}
      title={t("engineering.permissions.riskConfirmTitle")}
      size="sm"
    >
      <div className="space-y-4">
        <p className="flex items-start gap-2 text-xs leading-relaxed text-[var(--text-secondary)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <span>
            {t("engineering.permissions.riskConfirmBody", {
              count: changes.length,
            })}
          </span>
        </p>

        {subject && (
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
            {t("engineering.permissions.riskConfirmSubject", { name: subject })}
          </p>
        )}

        <ul className="space-y-1.5">
          {changes.map((change) => (
            <li
              key={`${change.module}.${change.capability}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-primary)] bg-surface-1 px-3 py-2"
            >
              <span className="min-w-0 break-words text-[11px] font-bold text-[var(--text-primary)]">
                {capText(change.module, change.capability)}
              </span>
              <RiskBadge risk={change.risk} />
            </li>
          ))}
        </ul>

        <p className="text-[10px] leading-relaxed text-[var(--text-secondary)] opacity-80">
          {t("engineering.permissions.riskConfirmNote")}
        </p>

        <div className="flex justify-end gap-2">
          <AppButton variant="secondary" size="sm" onClick={onCancel} disabled={busy}>
            {t("common.cancel")}
          </AppButton>
          <AppButton
            variant="primary"
            size="sm"
            onClick={onConfirm}
            loading={busy}
          >
            {t("engineering.permissions.riskConfirmApply")}
          </AppButton>
        </div>
      </div>
    </AppModal>
  );
}

"use client";

import React from "react";
import { AlertTriangle, ShieldAlert, Zap } from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import AppModal from "@/components/ui/AppModal";

/**
 * PHASE UI-8e — the refusal to switch a wave on while it is unsafe, and the
 * explicit override that follows it.
 *
 * The switch endpoint refuses (409) to turn a domain ON while either readiness
 * finding still stands, and it sends the blockers back with the refusal. That is
 * not a failure and it is not silence: it is a reason, and it is the one refusal
 * in this feature that has a legitimate answer besides "not yet".
 *
 *   `WaveEnableRefusal` is the state itself, rendered beside the switch that was
 *   clicked: what the server counted, in plain language, plus the choice to
 *   overrule the check deliberately.
 *
 *   `WaveOverrideConfirm` is that choice behind its own confirmation, stating
 *   what the override does — it removes access for people not staffed on a
 *   programme — before the second, explicit write goes out. The override is
 *   never sent automatically: only this dialog sends it.
 *
 * The blocker sentences are passed in already translated (they are the same
 * vocabulary the wave's own verdict prints, built by the caller), so a blocker
 * can never be described two different ways in one screen.
 */

/** The refusal, stated where the switch is, with the deliberate override offered. */
export function WaveEnableRefusal({ t, reason, items, onOverride }) {
  return (
    <div className="space-y-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2">
      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-400">
        <ShieldAlert className="h-3 w-3" />
        {t("engineering.permissions.programScopeWaveRefusedTitle")}
      </p>
      <p className="text-[10px] leading-relaxed text-[var(--text-secondary)]">
        {t("engineering.permissions.programScopeWaveRefusedBody")}
      </p>
      <ul className="list-disc space-y-0.5 pl-4">
        {items.map((item) => (
          <li
            key={item}
            className="text-[10px] leading-relaxed text-[var(--text-primary)]"
          >
            {item}
          </li>
        ))}
      </ul>
      {reason && (
        <p className="text-[10px] leading-relaxed text-[var(--text-secondary)]">
          {t("engineering.permissions.programScopeWaveRefusedReason", {
            reason,
          })}
        </p>
      )}
      <div className="flex justify-end">
        <AppButton
          variant="secondary"
          size="sm"
          icon={AlertTriangle}
          onClick={onOverride}
        >
          {t("engineering.permissions.programScopeWaveRefusedOverride")}
        </AppButton>
      </div>
    </div>
  );
}

/**
 * The override's own confirmation. What it says is the whole point: the check
 * is being overruled, the rule goes on anyway, and everyone not staffed on a
 * programme — including the people counted below — loses access in this domain.
 */
export function WaveOverrideConfirm({
  t,
  wave,
  open,
  items,
  busy = false,
  children,
  onCancel,
  onConfirm,
}) {
  return (
    <AppModal
      isOpen={open}
      onClose={onCancel}
      title={t("engineering.permissions.programScopeWaveOverrideConfirmTitle", {
        wave,
      })}
      size="sm"
    >
      <div className="space-y-3">
        <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
          {t("engineering.permissions.programScopeWaveOverrideConfirmBody")}
        </p>
        <ul className="list-disc space-y-0.5 pl-4">
          {items.map((item) => (
            <li
              key={item}
              className="text-[10px] leading-relaxed text-[var(--text-primary)]"
            >
              {item}
            </li>
          ))}
        </ul>
        {children}
        <div className="flex justify-end gap-2">
          <AppButton
            variant="secondary"
            size="sm"
            onClick={onCancel}
            disabled={busy}
          >
            {t("common.cancel")}
          </AppButton>
          <AppButton
            variant="danger"
            size="sm"
            icon={Zap}
            loading={busy}
            onClick={onConfirm}
          >
            {t("engineering.permissions.programScopeWaveOverrideConfirmApply")}
          </AppButton>
        </div>
      </div>
    </AppModal>
  );
}

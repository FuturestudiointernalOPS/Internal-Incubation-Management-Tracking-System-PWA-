"use client";

import { useState } from "react";
import AppButton from "@/components/ui/AppButton";
import AppInput from "@/components/ui/AppInput";
import AppModal from "@/components/ui/AppModal";

/* ── Renew / Reactivate ─────────────────────────────────────────────────── */

export function RenewModal({ member, isReactivate, t, fmtDate, onClose, onConfirm }) {
  const [expires, setExpires] = useState("");
  const [noExpiry, setNoExpiry] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await onConfirm(noExpiry ? null : expires || null);
    if (!ok) setBusy(false);
  };

  return (
    <AppModal
      isOpen
      onClose={onClose}
      title={isReactivate ? t("membership.actions.reactivate") : t("membership.renew.title")}
      size="md"
    >
      <div className="space-y-5">
        <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
          {member.name || member.user_cid}
        </p>
        <div
          className="rounded-xl p-4 space-y-2"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border-primary)" }}
        >
          <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
            {t("membership.renew.currentExpires")}:{" "}
            <b style={{ color: "var(--text-primary)" }}>
              {member.expires_at ? fmtDate(member.expires_at) : t("membership.renew.noExpiry")}
            </b>
          </p>
          <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
            {t("membership.columns.start")}:{" "}
            <b style={{ color: "var(--text-primary)" }}>{fmtDate(member.started_at)}</b>
          </p>
          <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
            {t("membership.renew.hint")}
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <AppInput
              label={t("membership.renew.newExpires")}
              type="date"
              value={expires}
              disabled={noExpiry}
              onChange={(event) => setExpires(event.target.value)}
            />
          </div>
          <label
            className="flex items-center gap-2 pb-3 text-[10px] font-bold cursor-pointer"
            style={{ color: "var(--text-secondary)" }}
          >
            <input
              type="checkbox"
              checked={noExpiry}
              onChange={(event) => {
                setNoExpiry(event.target.checked);
                if (event.target.checked) setExpires("");
              }}
            />
            {t("membership.status.never")}
          </label>
        </div>
        <div className="flex justify-end gap-3">
          <AppButton variant="ghost" onClick={onClose}>
            {t("membership.actions.cancel")}
          </AppButton>
          <AppButton variant="primary" loading={busy} onClick={confirm} disabled={!noExpiry && !expires}>
            {t("membership.renew.confirm")}
          </AppButton>
        </div>
      </div>
    </AppModal>
  );
}

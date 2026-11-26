"use client";

import { useState } from "react";
import AppButton from "@/components/ui/AppButton";
import AppModal from "@/components/ui/AppModal";

/* ── Deactivate / End confirm ───────────────────────────────────────────── */

export function ConfirmModal({ state, t, onClose, onConfirm }) {
  const [busy] = useState(false);
  const isEnd = state.action === "ended";

  return (
    <AppModal
      isOpen
      onClose={onClose}
      title={isEnd ? t("membership.actions.end") : t("membership.actions.deactivate")}
      size="sm"
    >
      <div className="space-y-5">
        <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
          {state.member.name || state.member.user_cid} — {state.member.group_name}
        </p>
        <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {t("membership.actions.endedNote")}
        </p>
        <div className="flex justify-end gap-3">
          <AppButton variant="ghost" onClick={onClose}>
            {t("membership.actions.cancel")}
          </AppButton>
          <AppButton variant={isEnd ? "danger" : "secondary"} loading={busy} onClick={onConfirm}>
            {isEnd ? t("membership.actions.end") : t("membership.actions.deactivate")}
          </AppButton>
        </div>
      </div>
    </AppModal>
  );
}

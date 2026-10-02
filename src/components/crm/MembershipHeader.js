"use client";

import { Users, RefreshCw, UserPlus } from "lucide-react";
import AppButton from "@/components/ui/AppButton";

export function MembershipHeader({ t, readOnly, onReload, onAddMember }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1
          className="text-xl font-black uppercase tracking-tight flex items-center gap-3"
          style={{ color: "var(--text-primary)" }}
        >
          <Users className="w-6 h-6" style={{ color: "var(--brand-orange)" }} />
          {t("membership.page.title")}
        </h1>
        <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
          {t("membership.page.subtitle")}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <AppButton variant="secondary" size="sm" icon={RefreshCw} onClick={onReload}>
          {t("membership.page.refresh")}
        </AppButton>
        {!readOnly && (
          <AppButton variant="primary" size="sm" icon={UserPlus} onClick={onAddMember}>
            {t("membership.page.addMember")}
          </AppButton>
        )}
      </div>
    </div>
  );
}
